package auth

import (
	"net/http"

	"jobvacancy.uz/backend/internal/pkg/apperr"
)

// Stable error codes; the web and mobile apps translate them into the user's language.
var (
	ErrEmailTaken         = apperr.Conflict("email_taken", "an account with this email already exists")
	ErrInvalidCredentials = apperr.Unauthorized("invalid_credentials", "invalid email or password")
	ErrAccountBlocked     = apperr.Forbidden("account_blocked", "this account is blocked")
	ErrInvalidRefresh     = apperr.Unauthorized("invalid_refresh_token", "refresh token is invalid or expired")
	ErrRefreshRace        = apperr.Unauthorized("refresh_race", "token was just rotated by a parallel request; retry")
	ErrGoogleToken        = apperr.Unauthorized("invalid_google_token", "google sign-in could not be verified")
	ErrGoogleDisabled     = apperr.New(http.StatusServiceUnavailable, "google_disabled", "google sign-in is not configured")
	ErrAlreadyVerified    = apperr.Conflict("already_verified", "already verified")
	ErrNoEmail            = apperr.BadRequest("no_email", "account has no email address")
	ErrCodeInvalid        = apperr.BadRequest("code_invalid", "verification code is invalid")
	ErrCodeExpired        = apperr.BadRequest("code_expired", "verification code expired, request a new one")
	ErrCodeAttempts       = apperr.BadRequest("code_attempts_exceeded", "too many wrong attempts, request a new code")
	ErrPhoneInvalid       = apperr.Validation(map[string]string{"phone": "phone"})
	ErrPhoneTaken         = apperr.Conflict("phone_taken", "this phone number belongs to another account")
	ErrPhoneNoTelegram    = apperr.BadRequest("phone_no_telegram", "no Telegram account found for this number")
	ErrDeliveryFailed     = apperr.New(http.StatusBadGateway, "delivery_failed", "could not deliver the code, try again later")
	ErrWrongPassword      = apperr.BadRequest("wrong_password", "current password is incorrect")
	ErrSessionNotFound    = apperr.NotFound("session_not_found", "session not found")
	// TZ FN-08: sign-up needs consent to the processing of personal data.
	ErrConsentRequired = apperr.BadRequest("consent_required", "accept the privacy policy to create an account")
	ErrConsentOutdated = apperr.Conflict("consent_outdated", "the privacy policy was updated; reload the page and accept the current version")
)
