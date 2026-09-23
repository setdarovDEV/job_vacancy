// Package user exposes the current user's profile (/me).
package user

import (
	"time"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
)

// DTO is the public shape of a user returned to its owner.
type DTO struct {
	ID            uuid.UUID `json:"id"`
	Email         *string   `json:"email"`
	EmailVerified bool      `json:"email_verified"`
	Phone         *string   `json:"phone"`
	PhoneVerified bool      `json:"phone_verified"`
	FullName      string    `json:"full_name"`
	AvatarURL     *string   `json:"avatar_url"`
	Role          string    `json:"role"`
	Locale        string    `json:"locale"`
	HasPassword   bool      `json:"has_password"`
	GoogleLinked  bool      `json:"google_linked"`
	CreatedAt     time.Time `json:"created_at"`
}

func ToDTO(u gen.User) DTO {
	return DTO{
		ID:            u.ID,
		Email:         u.Email,
		EmailVerified: u.EmailVerifiedAt != nil,
		Phone:         u.Phone,
		PhoneVerified: u.PhoneVerifiedAt != nil,
		FullName:      u.FullName,
		AvatarURL:     u.AvatarUrl,
		Role:          string(u.Role),
		Locale:        string(u.Locale),
		HasPassword:   u.PasswordHash != nil,
		GoogleLinked:  u.GoogleSub != nil,
		CreatedAt:     u.CreatedAt,
	}
}
