// Package user exposes the current user's profile (/me).
package user

import (
	"sync/atomic"
	"time"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/imgurl"
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
	// AvatarURLs lists the avatar's sizes ("64", "128", "256") for srcset; null for a
	// Google picture or an image from before processing (TZ BE-14).
	AvatarURLs map[string]string `json:"avatar_urls"`
	// AvatarPending: a new avatar was chosen and its sizes are still being made.
	AvatarPending bool      `json:"avatar_pending"`
	Role          string    `json:"role"`
	Locale        string    `json:"locale"`
	HasPassword   bool      `json:"has_password"`
	GoogleLinked  bool      `json:"google_linked"`
	CreatedAt     time.Time `json:"created_at"`
	// HideOnline hides the user's online status from everyone (TZ SEC-05).
	HideOnline bool `json:"hide_online"`
	// The privacy policy version the user agreed to and when (TZ FN-08); null for accounts
	// created before consent was recorded. ConsentOutdated asks the client to show the
	// current policy and PUT /me/consent.
	ConsentVersion  *string    `json:"consent_version"`
	ConsentAt       *time.Time `json:"consent_at"`
	ConsentOutdated bool       `json:"consent_outdated"`
}

// consentVersion is the current privacy policy version (set once at startup).
var consentVersion atomic.Value

// SetConsentVersion sets the current privacy policy version (TZ FN-08).
func SetConsentVersion(v string) { consentVersion.Store(v) }

func currentConsent() string {
	v, _ := consentVersion.Load().(string)
	return v
}

func ToDTO(u gen.User) DTO {
	return DTO{
		ID:              u.ID,
		Email:           u.Email,
		EmailVerified:   u.EmailVerifiedAt != nil,
		Phone:           u.Phone,
		PhoneVerified:   u.PhoneVerifiedAt != nil,
		FullName:        u.FullName,
		AvatarURL:       u.AvatarUrl,
		AvatarURLs:      imgurl.URLs(u.AvatarUrl),
		AvatarPending:   imgurl.Pending(u.AvatarFileID, u.AvatarUrl),
		Role:            string(u.Role),
		Locale:          string(u.Locale),
		HasPassword:     u.PasswordHash != nil,
		GoogleLinked:    u.GoogleSub != nil,
		CreatedAt:       u.CreatedAt,
		HideOnline:      u.HideOnline,
		ConsentVersion:  u.ConsentVersion,
		ConsentAt:       u.ConsentAt,
		ConsentOutdated: currentConsent() != "" && (u.ConsentVersion == nil || *u.ConsentVersion != currentConsent()),
	}
}
