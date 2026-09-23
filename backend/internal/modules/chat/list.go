package chat

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
)

type ListCursor struct {
	T  time.Time `json:"t"`
	ID uuid.UUID `json:"i"`
}

// List returns the caller's conversations, most recently active first, with the last
// message and unread count of each.
func (s *Service) List(ctx context.Context, p reqctx.Principal, after *ListCursor, limit int) ([]Conversation, *ListCursor, error) {
	params := gen.ListConversationsParams{UserID: p.UserID, MaxResults: int32(limit + 1)}
	if after != nil {
		params.BeforeAt, params.BeforeID = &after.T, &after.ID
	}
	rows, err := s.Q.ListConversations(ctx, params)
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
	var lastIDs []int64
	for _, r := range rows {
		if r.LastMessageID != nil {
			lastIDs = append(lastIDs, *r.LastMessageID)
		}
	}
	last := map[int64]Message{}
	if len(lastIDs) > 0 {
		ms, err := s.Q.GetMessagesByIDs(ctx, lastIDs)
		if err != nil {
			return nil, err
		}
		dtos, err := s.messageDTOs(ctx, ms)
		if err != nil {
			return nil, err
		}
		for _, d := range dtos {
			last[d.ID] = d
		}
	}
	convIDs := make([]uuid.UUID, len(rows))
	for i, r := range rows {
		convIDs[i] = r.ID
	}
	allReads, err := s.Q.ListReadPositionsFor(ctx, convIDs)
	if err != nil {
		return nil, err
	}
	reads := map[uuid.UUID][]gen.ConversationRead{}
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
			Company: CompanyBrief{ID: r.CompanyID, Name: r.CompanyName, Slug: r.CompanySlug, LogoURL: r.CompanyLogo},
			Seeker:  Person{ID: r.SeekerID, FullName: r.SeekerName, AvatarURL: r.SeekerAvatar},
			Side:    side, LastMessageAt: r.LastMessageAt, Unread: r.Unread, CreatedAt: r.CreatedAt,
		}
		if r.LastMessageID != nil {
			if m, ok := last[*r.LastMessageID]; ok {
				c.LastMessage = &m
			}
		}
		_, users, _ := s.participants(ctx, r.ID)
		for _, rp := range reads[r.ID] {
			// "the other side": the seeker for company viewers, any member for the seeker
			other := (side == "seeker" && rp.UserID != r.SeekerID) || (side == "company" && rp.UserID == r.SeekerID)
			if other && slices.Contains(users, rp.UserID) {
				c.ReadUpTo = max(c.ReadUpTo, rp.LastReadID)
			}
		}
		out[i] = c
	}
	return out, nil
}

func (s *Service) UnreadCount(ctx context.Context, p reqctx.Principal) (int64, error) {
	return s.Q.CountUnreadConversations(ctx, p.UserID)
}
