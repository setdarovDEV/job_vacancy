package chat

import (
	"context"
	"encoding/json"
	"slices"
	"time"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/imgurl"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
)

type ListCursor struct {
	T  time.Time `json:"t"`
	ID uuid.UUID `json:"i"`
}

// listStart sorts after every conversation, so the first page is the same index seek as
// the others (see ListConversations).
var listStart = ListCursor{
	T:  time.Date(9999, 12, 31, 0, 0, 0, 0, time.UTC),
	ID: uuid.Max,
}

// List returns the caller's conversations, most recently active first, with the last
// message and unread count of each. A page costs at most 4 queries whatever its size
// (TZ BE-04): the page itself (with unread counts), participants of cache misses, read
// positions, and the last messages with their senders and files.
func (s *Service) List(ctx context.Context, p reqctx.Principal, after *ListCursor, limit int) ([]Conversation, *ListCursor, error) {
	if after == nil {
		after = &listStart
	}
	rows, err := s.Q.ListConversations(ctx, gen.ListConversationsParams{
		UserID: p.UserID, MaxResults: int32(limit + 1), BeforeAt: after.T, BeforeID: after.ID,
	})
	if err != nil {
		return nil, nil, err
	}
	var next *ListCursor
	if len(rows) > limit {
		rows = rows[:limit]
		last := rows[len(rows)-1]
		t := last.CreatedAt
		if last.LastMessageAt != nil {
			t = *last.LastMessageAt
		}
		next = &ListCursor{T: t, ID: last.ID}
	}
	out, err := s.conversations(ctx, p, rows)
	return out, next, err
}

func (s *Service) Get(ctx context.Context, p reqctx.Principal, id uuid.UUID) (Conversation, error) {
	if _, _, err := s.access(ctx, p, id); err != nil {
		return Conversation{}, err
	}
	v, err := s.Q.GetConversationView(ctx, gen.GetConversationViewParams{ID: id, UserID: p.UserID})
	if err != nil {
		return Conversation{}, err
	}
	out, err := s.conversations(ctx, p, []gen.ListConversationsRow{gen.ListConversationsRow(v)})
	if err != nil {
		return Conversation{}, err
	}
	return out[0], nil
}

func (s *Service) conversations(ctx context.Context, p reqctx.Principal, rows []gen.ListConversationsRow) ([]Conversation, error) {
	if len(rows) == 0 {
		return []Conversation{}, nil
	}
	convIDs := make([]uuid.UUID, len(rows))
	var lastIDs []int64
	for i, r := range rows {
		convIDs[i] = r.ID
		if r.LastMessageID != nil {
			lastIDs = append(lastIDs, *r.LastMessageID)
		}
	}
	last := map[int64]Message{}
	if len(lastIDs) > 0 {
		ms, err := s.Q.GetMessagesWithRefs(ctx, lastIDs)
		if err != nil {
			return nil, err
		}
		dtos, err := s.joinedDTOs(ctx, rowsOf(ms))
		if err != nil {
			return nil, err
		}
		for _, d := range dtos {
			last[d.ID] = d
		}
	}
	parts, err := s.participantsMany(ctx, convIDs)
	if err != nil {
		return nil, err
	}
	allReads, err := s.Q.ListReadPositionsFor(ctx, convIDs)
	if err != nil {
		return nil, err
	}
	reads := map[uuid.UUID][]gen.ListReadPositionsForRow{}
	for _, rp := range allReads {
		reads[rp.ConversationID] = append(reads[rp.ConversationID], rp)
	}
	out := make([]Conversation, len(rows))
	for i, r := range rows {
		side := "company"
		if r.SeekerID == p.UserID {
			side = "seeker"
		}
		c := Conversation{
			ID: r.ID, ApplicationID: r.ApplicationID, Vacancy: Brief{ID: r.VacancyID, Title: r.VacancyTitle},
			Company: CompanyBrief{ID: r.CompanyID, Name: r.CompanyName, Slug: r.CompanySlug, LogoURL: r.CompanyLogo,
				LogoURLs: imgurl.URLs(r.CompanyLogo)},
			Seeker: Person{ID: r.SeekerID, FullName: r.SeekerName, AvatarURL: r.SeekerAvatar, AvatarURLs: imgurl.URLs(r.SeekerAvatar)},
			Side:   side, LastMessageAt: r.LastMessageAt, Unread: r.Unread, CreatedAt: r.CreatedAt,
		}
		if r.LastMessageID != nil {
			if m, ok := last[*r.LastMessageID]; ok {
				c.LastMessage = &m
			}
		}
		users := parts[r.ID].users
		for _, rp := range reads[r.ID] {
			// "the other side": the seeker for company viewers, any current member for the seeker
			other := (side == "seeker" && rp.UserID != r.SeekerID) || (side == "company" && rp.UserID == r.SeekerID)
			if other && slices.Contains(users, rp.UserID) {
				c.ReadUpTo = max(c.ReadUpTo, rp.LastReadID)
			}
		}
		out[i] = c
	}
	return out, nil
}

// UnreadCount is the number of conversations with unread messages: an index-only count
// over conversation_reads_unread_idx (TZ BE-04).
func (s *Service) UnreadCount(ctx context.Context, p reqctx.Principal) (int64, error) {
	return s.Q.CountUnreadConversations(ctx, p.UserID)
}

// joinedRow is a message with its sender and attachment, as ListMessages and
// GetMessagesWithRefs return it.
type joinedRow = gen.ListMessagesRow

func rowsOf(ms []gen.GetMessagesWithRefsRow) []joinedRow {
	out := make([]joinedRow, len(ms))
	for i, m := range ms {
		out[i] = joinedRow(m)
	}
	return out
}

// joinedDTOs builds message DTOs from rows that already carry the sender and the file,
// so no further query is needed (file URLs are signed locally).
func (s *Service) joinedDTOs(ctx context.Context, rows []joinedRow) ([]Message, error) {
	out := make([]Message, len(rows))
	for i, r := range rows {
		m := r.Message
		d := Message{ID: m.ID, ConversationID: m.ConversationID, Kind: string(m.Kind), Body: m.Body,
			ClientID: m.ClientID, CreatedAt: m.CreatedAt, Deleted: m.DeletedAt != nil}
		if m.SenderID != nil && r.SenderName != nil {
			d.Sender = &Person{ID: *m.SenderID, FullName: *r.SenderName, AvatarURL: r.SenderAvatar, AvatarURLs: imgurl.URLs(r.SenderAvatar)}
		}
		if f, ok := fileOf(r); ok {
			fd, err := s.Files.DTO(ctx, f)
			if err != nil {
				return nil, err
			}
			d.File = &fd
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

func fileOf(r joinedRow) (gen.File, bool) {
	if r.FileRefID == nil || r.FileOwnerID == nil || r.FilePurpose == nil || r.FileStatus == nil ||
		r.FileBucket == nil || r.FileObjectKey == nil || r.FileContentType == nil || r.FileSize == nil ||
		r.FileName == nil || r.FileCreatedAt == nil {
		return gen.File{}, false
	}
	return gen.File{
		ID: *r.FileRefID, OwnerID: *r.FileOwnerID, Purpose: *r.FilePurpose, Status: *r.FileStatus,
		Bucket: *r.FileBucket, ObjectKey: *r.FileObjectKey, ContentType: *r.FileContentType,
		Size: *r.FileSize, Name: *r.FileName, Meta: r.FileMeta, CreatedAt: *r.FileCreatedAt,
	}, true
}
