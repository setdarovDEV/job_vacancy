package chat

import (
	"time"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/internal/modules/file"
)

type Person struct {
	ID        uuid.UUID `json:"id"`
	FullName  string    `json:"full_name"`
	AvatarURL *string   `json:"avatar_url"`
}

type Location struct {
	Lat  float64 `json:"lat" validate:"required,latitude"`
	Lng  float64 `json:"lng" validate:"required,longitude"`
	Name string  `json:"name" validate:"max=200"`
}

type Message struct {
	ID             int64     `json:"id"`
	ConversationID uuid.UUID `json:"conversation_id"`
	Sender         *Person   `json:"sender"`
	Kind           string    `json:"kind"`
	Body           string    `json:"body"`
	File           *file.DTO `json:"file,omitempty"`     // signed URL, valid 1 h
	Location       *Location `json:"location,omitempty"` // kind=location
	ClientID       uuid.UUID `json:"client_id"`
	CreatedAt      time.Time `json:"created_at"`
	Deleted        bool      `json:"deleted"`
}

type Brief struct {
	ID    uuid.UUID `json:"id"`
	Title string    `json:"title"`
}

type CompanyBrief struct {
	ID      uuid.UUID `json:"id"`
	Name    string    `json:"name"`
	Slug    string    `json:"slug"`
	LogoURL *string   `json:"logo_url"`
}

type Conversation struct {
	ID            uuid.UUID    `json:"id"`
	ApplicationID uuid.UUID    `json:"application_id"`
	Vacancy       Brief        `json:"vacancy"`
	Company       CompanyBrief `json:"company"`
	Seeker        Person       `json:"seeker"`
	// Side is the viewer's side: "seeker" or "company".
	Side          string     `json:"side"`
	LastMessage   *Message   `json:"last_message"`
	LastMessageAt *time.Time `json:"last_message_at"`
	Unread        int32      `json:"unread"` // capped at 100
	// ReadUpTo is how far the other side has read (for "seen" ticks).
	ReadUpTo  int64     `json:"read_up_to"`
	CreatedAt time.Time `json:"created_at"`
}

type SendInput struct {
	ClientID uuid.UUID  `json:"client_id" validate:"required"`
	Kind     string     `json:"kind" validate:"required,oneof=text image file voice location"`
	Body     string     `json:"body" validate:"max=4000"`
	FileID   *uuid.UUID `json:"file_id"`
	Location *Location  `json:"location"`
}
