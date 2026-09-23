// Package chat implements seeker ↔ company conversations attached to applications:
// text, images, files, voice notes and locations, read receipts and typing indicators.
package chat

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"slices"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/company"
	"jobvacancy.uz/backend/internal/modules/file"
	"jobvacancy.uz/backend/internal/modules/notification"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/platform/postgres"
	"jobvacancy.uz/backend/internal/realtime"
)

const (
	participantsTTL  = 30 * time.Second
	offlineNotifyGap = 10 * time.Minute // at most one "new message" push per conversation per user
	deleteWindow     = 48 * time.Hour
)

var (
	ErrNotFound     = apperr.NotFound("conversation_not_found", "conversation not found")
	ErrMsgNotFound  = apperr.NotFound("message_not_found", "message not found")
	ErrEmpty        = apperr.Validation(map[string]string{"body": "required"})
	ErrAttachment   = apperr.Validation(map[string]string{"file_id": "required"})
	ErrLocation     = apperr.Validation(map[string]string{"location": "required"})
	ErrDeleteWindow = apperr.Conflict("delete_window_passed", "messages can be deleted within 48 hours")
)

var filePurpose = map[string]gen.FilePurpose{
	"image": gen.FilePurposeChatImage, "file": gen.FilePurposeChatFile, "voice": gen.FilePurposeChatVoice,
}

type Service struct {
	Pool      *pgxpool.Pool
	Q         *gen.Queries
	Companies *company.Service
	Files     *file.Service
	Publisher *realtime.Publisher
	Hub       *realtime.Hub
	Notify    *notification.Service
	RDB       *redis.Client
	Log       *slog.Logger

	mu    sync.Mutex
	cache map[uuid.UUID]cachedParticipants
}

type cachedParticipants struct {
	conv    gen.Conversation
	users   []uuid.UUID // seeker + every company member
	expires time.Time
}

// participants returns the conversation and everyone on it; membership changes show up
// within 30 s. Checked on every request and typing frame, so it's cached.
func (s *Service) participants(ctx context.Context, id uuid.UUID) (gen.Conversation, []uuid.UUID, error) {
	s.mu.Lock()
	if c, ok := s.cache[id]; ok && time.Now().Before(c.expires) {
		s.mu.Unlock()
		return c.conv, c.users, nil
	}
	s.mu.Unlock()
	conv, err := s.Q.GetConversation(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return conv, nil, ErrNotFound
	}
	if err != nil {
		return conv, nil, err
	}
	members, err := s.Q.ListCompanyMemberIDs(ctx, conv.CompanyID)
	if err != nil {
		return conv, nil, err
	}
	users := append([]uuid.UUID{conv.SeekerID}, members...)
	s.mu.Lock()
	if s.cache == nil {
		s.cache = map[uuid.UUID]cachedParticipants{}
	}
	s.cache[id] = cachedParticipants{conv: conv, users: users, expires: time.Now().Add(participantsTTL)}
	s.mu.Unlock()
	return conv, users, nil
}

// access loads a conversation the caller takes part in; others get 404.
func (s *Service) access(ctx context.Context, p reqctx.Principal, id uuid.UUID) (gen.Conversation, []uuid.UUID, error) {
	conv, users, err := s.participants(ctx, id)
	if err != nil {
		return conv, nil, err
	}
	if !slices.Contains(users, p.UserID) {
		return conv, nil, ErrNotFound
	}
	return conv, users, nil
}

// Open returns the conversation of an application, creating it on first use. Either the
// applicant or a member of the hiring company can open it.
func (s *Service) Open(ctx context.Context, p reqctx.Principal, applicationID uuid.UUID) (Conversation, error) {
	a, err := s.Q.GetApplication(ctx, applicationID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Conversation{}, ErrNotFound
	}
	if err != nil {
		return Conversation{}, err
	}
	if a.SeekerID != p.UserID && !s.Companies.IsMember(ctx, reqctx.Principal{UserID: p.UserID}, a.CompanyID) {
		return Conversation{}, ErrNotFound
	}
	conv, err := s.Q.CreateConversation(ctx, gen.CreateConversationParams{
		ApplicationID: a.ID, CompanyID: a.CompanyID, SeekerID: a.SeekerID, VacancyID: a.VacancyID,
	})
	if err != nil {
		return Conversation{}, err
	}
	return s.Get(ctx, p, conv.ID)
}

// ---- messages ----------------------------------------------------------------------------

func (s *Service) Send(ctx context.Context, p reqctx.Principal, convID uuid.UUID, in SendInput) (Message, error) {
	conv, users, err := s.access(ctx, p, convID)
	if err != nil {
		return Message{}, err
	}
	in.Body = strings.TrimSpace(in.Body)
	meta := []byte("{}")
	var fileID *uuid.UUID
	switch in.Kind {
	case "text":
		if in.Body == "" {
			return Message{}, ErrEmpty
		}
	case "image", "file", "voice":
		if in.FileID == nil {
			return Message{}, ErrAttachment
		}
		if utf8.RuneCountInString(in.Body) > 1000 {
			return Message{}, apperr.Validation(map[string]string{"body": "max=1000"})
		}
		f, err := s.Files.Use(ctx, p.UserID, *in.FileID, filePurpose[in.Kind])
		if err != nil {
			return Message{}, err
		}
		fileID = &f.ID
	case "location":
		if in.Location == nil || (in.Location.Lat == 0 && in.Location.Lng == 0) {
			return Message{}, ErrLocation
		}
		meta, _ = json.Marshal(in.Location)
		in.Body = ""
	}

	var m gen.Message
	fresh := true
	err = postgres.WithTx(ctx, s.Pool, func(q *gen.Queries) error {
		var err error
		m, err = q.InsertMessage(ctx, gen.InsertMessageParams{
			ConversationID: conv.ID, SenderID: &p.UserID, Kind: gen.MessageKind(in.Kind),
			Body: in.Body, FileID: fileID, Meta: meta, ClientID: in.ClientID,
		})
		if errors.Is(err, pgx.ErrNoRows) { // retried send: return the original, publish nothing
			fresh = false
			m, err = q.GetMessageByClientID(ctx, gen.GetMessageByClientIDParams{SenderID: &p.UserID, ClientID: in.ClientID})
			return err
		}
		if err != nil {
			return err
		}
		if err := q.TouchConversation(ctx, gen.TouchConversationParams{ID: conv.ID, LastMessageID: &m.ID, LastMessageAt: &m.CreatedAt}); err != nil {
			return err
		}
		_, err = q.MarkConversationRead(ctx, gen.MarkConversationReadParams{ConversationID: conv.ID, UserID: p.UserID, LastReadID: m.ID})
		return err
	})
	if err != nil {
		return Message{}, err
	}
	if m.ConversationID != conv.ID { // client_id reused in another conversation
		return Message{}, apperr.Conflict("client_id_reused", "client_id already used")
	}
	dtos, err := s.messageDTOs(ctx, []gen.Message{m})
	if err != nil {
		return Message{}, err
	}
	out := dtos[0]
	if fresh {
		if err := s.Publisher.ToUsers(ctx, users, realtime.Event{Type: "message.new", Data: out}); err != nil {
			s.Log.WarnContext(ctx, "publish message", "err", err)
		}
		s.notifyOffline(ctx, conv, users, p.UserID, out)
	}
	return out, nil
}

// notifyOffline pushes a "new message" notification to participants without an open
// connection, at most once per conversation per 10 minutes each.
func (s *Service) notifyOffline(ctx context.Context, conv gen.Conversation, users []uuid.UUID, sender uuid.UUID, m Message) {
	var targets []uuid.UUID
	for _, u := range users {
		if u == sender || s.Hub.IsOnline(ctx, u) {
			continue
		}
		key := "chat:notified:" + conv.ID.String() + ":" + u.String()
		if ok, err := s.RDB.SetNX(ctx, key, 1, offlineNotifyGap).Result(); err == nil && ok {
			targets = append(targets, u)
		}
	}
	if len(targets) == 0 {
		return
	}
	name := ""
	if m.Sender != nil {
		name = m.Sender.FullName
	}
	if sender != conv.SeekerID { // the company speaks as the company
		if c, err := s.Q.GetCompanyByID(ctx, conv.CompanyID); err == nil {
			name = c.Name
		}
	}
	s.Notify.Notify(ctx, targets, notification.TypeMessageNew, notification.Payload{
		ConversationID: conv.ID.String(), SenderName: name, Preview: preview(m),
	}, false)
}

func preview(m Message) string {
	switch m.Kind {
	case "image":
		return "📷 " + m.Body
	case "file":
		if m.File != nil {
			return "📎 " + m.File.Name
		}
		return "📎"
	case "voice":
		return "🎤"
	case "location":
		return "📍"
	}
	r := []rune(m.Body)
	if len(r) > 140 {
		return string(r[:140]) + "…"
	}
	return m.Body
}

// Messages returns a page, newest first. before pages back through history; after
// returns what arrived since a message (used after reconnecting).
func (s *Service) Messages(ctx context.Context, p reqctx.Principal, convID uuid.UUID, before, after *int64, limit int) ([]Message, *int64, error) {
	if _, _, err := s.access(ctx, p, convID); err != nil {
		return nil, nil, err
	}
	rows, err := s.Q.ListMessages(ctx, gen.ListMessagesParams{
		ConversationID: convID, BeforeID: before, AfterID: after, MaxResults: int32(limit + 1),
	})
	if err != nil {
		return nil, nil, err
	}
	var next *int64
	if len(rows) > limit {
		rows = rows[:limit]
		id := rows[len(rows)-1].ID
		next = &id
	}
	out, err := s.messageDTOs(ctx, rows)
	return out, next, err
}

func (s *Service) MarkRead(ctx context.Context, p reqctx.Principal, convID uuid.UUID, messageID int64) error {
	conv, users, err := s.access(ctx, p, convID)
	if err != nil {
		return err
	}
	// Never mark past the newest message. The cached row may lag, so re-check the DB
	// only when the client claims to be ahead of it.
	if conv.LastMessageID == nil || messageID > *conv.LastMessageID {
		latest, err := s.Q.GetConversation(ctx, convID)
		if err != nil {
			return err
		}
		if latest.LastMessageID == nil {
			return nil
		}
		messageID = min(messageID, *latest.LastMessageID)
	}
	pos, err := s.Q.MarkConversationRead(ctx, gen.MarkConversationReadParams{ConversationID: convID, UserID: p.UserID, LastReadID: messageID})
	if err != nil {
		return err
	}
	return s.Publisher.ToUsers(ctx, users, realtime.Event{Type: "message.read", Data: map[string]any{
		"conversation_id": convID, "user_id": p.UserID, "message_id": pos,
	}})
}

func (s *Service) Delete(ctx context.Context, p reqctx.Principal, messageID int64) error {
	m, err := s.Q.GetMessage(ctx, messageID)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && (m.SenderID == nil || *m.SenderID != p.UserID)) {
		return ErrMsgNotFound
	}
	if err != nil {
		return err
	}
	if time.Since(m.CreatedAt) > deleteWindow {
		return ErrDeleteWindow
	}
	_, users, err := s.participants(ctx, m.ConversationID)
	if err != nil {
		return err
	}
	if _, err := s.Q.SoftDeleteMessage(ctx, gen.SoftDeleteMessageParams{ID: m.ID, SenderID: &p.UserID}); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	return s.Publisher.ToUsers(ctx, users, realtime.Event{Type: "message.deleted", Data: map[string]any{
		"conversation_id": m.ConversationID, "message_id": m.ID,
	}})
}

// HandleFrame implements realtime.FrameHandler.
func (s *Service) HandleFrame(ctx context.Context, userID uuid.UUID, f realtime.Frame) error {
	p := reqctx.Principal{UserID: userID}
	switch f.Type {
	case "typing":
		_, users, err := s.access(ctx, p, f.ConversationID)
		if err != nil {
			return err
		}
		others := slices.DeleteFunc(slices.Clone(users), func(u uuid.UUID) bool { return u == userID })
		return s.Publisher.ToUsers(ctx, others, realtime.Event{Type: "typing", Data: map[string]any{
			"conversation_id": f.ConversationID, "user_id": userID,
		}})
	case "read":
		return s.MarkRead(ctx, p, f.ConversationID, f.MessageID)
	}
	return errors.New("unknown frame type")
}

// messageDTOs attaches senders and (signed) file URLs to a batch of messages.
func (s *Service) messageDTOs(ctx context.Context, rows []gen.Message) ([]Message, error) {
	var userIDs, fileIDs []uuid.UUID
	for _, m := range rows {
		if m.SenderID != nil && !slices.Contains(userIDs, *m.SenderID) {
			userIDs = append(userIDs, *m.SenderID)
		}
		if m.FileID != nil {
			fileIDs = append(fileIDs, *m.FileID)
		}
	}
	people := map[uuid.UUID]*Person{}
	if len(userIDs) > 0 {
		us, err := s.Q.GetUsersBrief(ctx, userIDs)
		if err != nil {
			return nil, err
		}
		for _, u := range us {
			people[u.ID] = &Person{ID: u.ID, FullName: u.FullName, AvatarURL: u.AvatarUrl}
		}
	}
	files := map[uuid.UUID]*file.DTO{}
	if len(fileIDs) > 0 {
		fs, err := s.Q.GetFilesByIDs(ctx, fileIDs)
		if err != nil {
			return nil, err
		}
		for _, f := range fs {
			d, err := s.Files.DTO(ctx, f)
			if err != nil {
				return nil, err
			}
			files[f.ID] = &d
		}
	}
	out := make([]Message, len(rows))
	for i, m := range rows {
		d := Message{ID: m.ID, ConversationID: m.ConversationID, Kind: string(m.Kind), Body: m.Body,
			ClientID: m.ClientID, CreatedAt: m.CreatedAt, Deleted: m.DeletedAt != nil}
		if m.SenderID != nil {
			d.Sender = people[*m.SenderID]
		}
		if m.FileID != nil {
			d.File = files[*m.FileID]
		}
		if m.Kind == gen.MessageKindLocation && m.DeletedAt == nil {
			var loc Location
			if json.Unmarshal(m.Meta, &loc) == nil {
				d.Location = &loc
			}
		}
		out[i] = d
	}
	return out, nil
}
