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
	"github.com/hashicorp/golang-lru/v2/expirable"
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

	cacheOnce sync.Once
	cache     *expirable.LRU[uuid.UUID, cachedParticipants]
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
	var fileName string
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
		fileID, fileName = &f.ID, f.Name
	case "location":
		if in.Location == nil || (in.Location.Lat == 0 && in.Location.Lng == 0) {
			return Message{}, ErrLocation
		}
		meta, _ = json.Marshal(in.Location)
		in.Body = ""
	}

	// Offline participants to push to, decided before the transaction so it holds no
	// Redis calls: one Presence(ids) call and one pipelined throttle (TZ BE-08).
	targets := s.offlineTargets(ctx, conv, users, p.UserID)

	var m gen.Message
	var sent notification.Sent
	fresh := true
	err = postgres.WithPgxTx(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		row, err := q.SendMessage(ctx, gen.SendMessageParams{
			ConversationID: conv.ID, SenderID: &p.UserID, Kind: gen.MessageKind(in.Kind),
			Body: in.Body, FileID: fileID, Meta: meta, ClientID: in.ClientID,
		})
		m = gen.Message(row)
		if errors.Is(err, pgx.ErrNoRows) { // retried send: return the original, publish nothing
			fresh = false
			m, err = q.GetMessageByClientID(ctx, gen.GetMessageByClientIDParams{SenderID: &p.UserID, ClientID: in.ClientID})
			return err
		}
		if err != nil || len(targets) == 0 {
			return err
		}
		// The push/Telegram jobs commit with the message (TZ BE-08).
		sent, err = s.notifyOffline(ctx, tx, conv, p.UserID, targets, previewOf(in, fileName))
		return err
	})
	if err != nil || !fresh {
		s.releaseThrottle(ctx, conv.ID, targets)
	}
	if err != nil {
		return Message{}, err
	}
	if m.ConversationID != conv.ID { // client_id reused in another conversation
		return Message{}, apperr.Conflict("client_id_reused", "client_id already used")
	}
	rows, err := s.Q.GetMessagesWithRefs(ctx, []int64{m.ID})
	if err != nil {
		return Message{}, err
	}
	if len(rows) == 0 {
		return Message{}, ErrMsgNotFound
	}
	dtos, err := s.joinedDTOs(ctx, rowsOf(rows))
	if err != nil {
		return Message{}, err
	}
	out := dtos[0]
	if fresh {
		if err := s.Publisher.ToUsers(ctx, users, realtime.Event{Type: "message.new", Data: out}); err != nil {
			s.Log.WarnContext(ctx, "publish message", "err", err)
		}
		sent.Publish(ctx)
	}
	return out, nil
}

// offlineTargets returns the participants (other than the sender) with no open
// connection who haven't been pushed about this conversation in the last 10 minutes,
// and marks them as pushed. Two Redis round trips whatever the team size: one
// Presence(ids) and one pipelined SET NX. Redis errors mean no push, never a failed send.
func (s *Service) offlineTargets(ctx context.Context, conv gen.Conversation, users []uuid.UUID, sender uuid.UUID) []uuid.UUID {
	others := slices.DeleteFunc(slices.Clone(users), func(u uuid.UUID) bool { return u == sender })
	if len(others) == 0 || s.Hub == nil || s.RDB == nil {
		return nil
	}
	states, err := s.Hub.Presence(ctx, others)
	if err != nil {
		s.Log.WarnContext(ctx, "presence for offline push", "err", err)
		return nil
	}
	var offline []uuid.UUID
	for _, st := range states {
		if !st.Online {
			offline = append(offline, st.UserID)
		}
	}
	if len(offline) == 0 {
		return nil
	}
	cmds := make([]*redis.BoolCmd, len(offline))
	_, err = s.RDB.Pipelined(ctx, func(pipe redis.Pipeliner) error {
		for i, u := range offline {
			cmds[i] = pipe.SetNX(ctx, throttleKey(conv.ID, u), 1, offlineNotifyGap)
		}
		return nil
	})
	if err != nil {
		s.Log.WarnContext(ctx, "offline push throttle", "err", err)
		return nil
	}
	var targets []uuid.UUID
	for i, c := range cmds {
		if c.Val() {
			targets = append(targets, offline[i])
		}
	}
	return targets
}

// releaseThrottle undoes offlineTargets when nothing was sent (retry or failed insert).
func (s *Service) releaseThrottle(ctx context.Context, convID uuid.UUID, targets []uuid.UUID) {
	if len(targets) == 0 {
		return
	}
	keys := make([]string, len(targets))
	for i, u := range targets {
		keys[i] = throttleKey(convID, u)
	}
	if err := s.RDB.Del(context.WithoutCancel(ctx), keys...).Err(); err != nil {
		s.Log.WarnContext(ctx, "release offline push throttle", "err", err)
	}
}

func throttleKey(convID, userID uuid.UUID) string {
	return "chat:notified:" + convID.String() + ":" + userID.String()
}

// notifyOffline queues the "new message" push (Telegram, mobile) for targets inside the
// message's transaction.
func (s *Service) notifyOffline(ctx context.Context, tx pgx.Tx, conv gen.Conversation, sender uuid.UUID, targets []uuid.UUID, text string) (notification.Sent, error) {
	// The company speaks as the company; the seeker by name.
	var name string
	var err error
	if sender == conv.SeekerID {
		err = tx.QueryRow(ctx, `SELECT full_name FROM users WHERE id = $1`, sender).Scan(&name)
	} else {
		err = tx.QueryRow(ctx, `SELECT name FROM companies WHERE id = $1`, conv.CompanyID).Scan(&name)
	}
	if err != nil {
		return notification.Sent{}, err
	}
	p := notification.Payload{ConversationID: conv.ID.String(), SenderName: name, Preview: text}
	to := make([]notification.Recipient, len(targets))
	for i, u := range targets {
		to[i] = notification.Recipient{UserID: u, Payload: p}
	}
	return s.Notify.NotifyTx(ctx, tx, notification.TypeMessageNew, to, false)
}

// previewOf is the notification preview of a message being sent.
func previewOf(in SendInput, fileName string) string {
	m := Message{Kind: in.Kind, Body: in.Body}
	if in.Kind == "file" && fileName != "" {
		m.File = &file.DTO{Name: fileName}
	}
	return preview(m)
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
		id := rows[len(rows)-1].Message.ID
		next = &id
	}
	out, err := s.joinedDTOs(ctx, rows)
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
