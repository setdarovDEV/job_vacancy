// Package auth handles sign-up, sign-in (email+password, Google), token refresh,
// e-mail verification, password reset and phone verification via Telegram Gateway.
package auth

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"log/slog"
	"net/netip"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/jobs"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/hash"
	"jobvacancy.uz/backend/internal/pkg/otp"
	"jobvacancy.uz/backend/internal/pkg/phone"
	"jobvacancy.uz/backend/internal/pkg/random"
	"jobvacancy.uz/backend/internal/pkg/token"
	"jobvacancy.uz/backend/internal/platform/mailer"
	"jobvacancy.uz/backend/internal/platform/telegram"
)

const (
	emailCodeTTL   = 15 * time.Minute
	phoneCodeTTL   = 5 * time.Minute
	codeCooldown   = 60 * time.Second
	refreshRaceWin = 30 * time.Second
)

type EmailQueue interface {
	EnqueueEmailCode(ctx context.Context, a jobs.EmailCodeArgs) error
}

type Service struct {
	Q       *gen.Queries
	Tokens  *token.Manager
	OTP     *otp.Store
	Revoked *RevocationStore
	Emails  EmailQueue
	Phone   telegram.CodeSender
	Google  *GoogleVerifier // nil when Google sign-in is disabled
	// Guard slows down and captcha-gates repeated failed sign-ins without ever locking an
	// account (TZ SEC-04); nil disables it (tests).
	Guard      *LoginGuard
	RefreshTTL time.Duration
	// ConsentVersion is the current privacy policy version users agree to (TZ FN-08).
	ConsentVersion string
	Log            *slog.Logger
}

// Consent is the sign-up agreement to the processing of personal data (TZ FN-08).
type Consent struct {
	Given   bool
	Version string // empty: the current version
}

// consentVersion checks c and returns the version to store.
func (s *Service) consentVersion(c Consent) (string, error) {
	if !c.Given {
		return "", ErrConsentRequired
	}
	if c.Version != "" && c.Version != s.ConsentVersion {
		return "", ErrConsentOutdated
	}
	return s.ConsentVersion, nil
}

// AcceptConsent records that the user agreed to the current (or the given, which must be
// current) version, e.g. after the policy changed.
func (s *Service) AcceptConsent(ctx context.Context, userID uuid.UUID, version string) (gen.User, error) {
	v, err := s.consentVersion(Consent{Given: true, Version: version})
	if err != nil {
		return gen.User{}, err
	}
	return s.Q.SetUserConsent(ctx, gen.SetUserConsentParams{ID: userID, ConsentVersion: v})
}

// ClientMeta describes the device a session is created from.
type ClientMeta struct {
	Platform  string // web | android | ios
	UserAgent string
	IP        netip.Addr
}

// Result is returned by every successful sign-in.
type Result struct {
	User             gen.User
	AccessToken      string
	AccessExpiresAt  time.Time
	RefreshToken     string
	RefreshExpiresAt time.Time
	IsNewUser        bool
}

// A precomputed hash so unknown e-mails cost the same time as wrong passwords.
var dummyHash, _ = hash.Password("timing-equalizer-not-a-real-password")

// ---- sign-up / sign-in -----------------------------------------------------------------

type RegisterInput struct {
	Email    string
	Password string
	FullName string
	Role     gen.UserRole
	Locale   gen.AppLocale
	Consent  Consent
}

func (s *Service) Register(ctx context.Context, in RegisterInput, meta ClientMeta) (*Result, error) {
	consent, err := s.consentVersion(in.Consent)
	if err != nil {
		return nil, err
	}
	email := normalizeEmail(in.Email)
	pw, err := hash.PasswordCtx(ctx, in.Password)
	if err != nil {
		return nil, err
	}
	u, err := s.Q.CreateUser(ctx, gen.CreateUserParams{
		Email: &email, PasswordHash: &pw, FullName: in.FullName, Role: in.Role, Locale: in.Locale,
		ConsentVersion: consent,
	})
	if isUniqueViolation(err) {
		return nil, ErrEmailTaken
	}
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}

	// The account is usable right away; verification is required later for actions like
	// applying or posting vacancies. A failed send must not fail the sign-up.
	if err := s.sendEmailCode(ctx, otp.EmailVerify, u.ID.String(), email, string(u.Locale),
		mailer.TemplateVerifyEmail); err != nil {
		s.Log.WarnContext(ctx, "verification email not queued", "user_id", u.ID, "err", err)
	}

	res, err := s.startSession(ctx, u, meta)
	if err != nil {
		return nil, err
	}
	res.IsNewUser = true
	return res, nil
}

func (s *Service) Login(ctx context.Context, email, password string, meta ClientMeta) (*Result, error) {
	return s.LoginWithCaptcha(ctx, email, password, "", meta)
}

// LoginWithCaptcha signs in with e-mail and password. After repeated failures the guard
// delays the attempt or requires captcha, a solved Turnstile token (TZ SEC-04); nothing
// ever locks the account, so the owner's right password always gets in.
func (s *Service) LoginWithCaptcha(ctx context.Context, email, password, captcha string, meta ClientMeta) (*Result, error) {
	email = normalizeEmail(email)
	if s.Guard != nil {
		if err := s.Guard.Check(ctx, meta.IP, email, captcha); err != nil {
			return nil, err
		}
	}
	u, err := s.Q.GetUserByEmail(ctx, &email)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if err != nil || u.PasswordHash == nil {
		_, _ = hash.VerifyPasswordCtx(ctx, password, dummyHash)
		s.loginFailed(ctx, meta.IP, email)
		return nil, ErrInvalidCredentials
	}
	ok, err := hash.VerifyPasswordCtx(ctx, password, *u.PasswordHash)
	if err != nil {
		return nil, err
	}
	if !ok {
		s.loginFailed(ctx, meta.IP, email)
		return nil, ErrInvalidCredentials
	}
	if err := checkStatus(u); err != nil {
		return nil, err
	}
	if s.Guard != nil {
		s.Guard.Succeeded(ctx, meta.IP, email)
	}
	return s.startSession(ctx, u, meta)
}

func (s *Service) loginFailed(ctx context.Context, ip netip.Addr, email string) {
	if s.Guard != nil {
		s.Guard.Failed(ctx, ip, email)
	}
}

// GoogleLogin signs in with a Google ID token. New users are created with the given role
// (and need consent, TZ FN-08); an existing e-mail account is linked, since Google has
// already proven the address.
func (s *Service) GoogleLogin(ctx context.Context, idToken string, role gen.UserRole, locale gen.AppLocale, consent Consent, meta ClientMeta) (*Result, error) {
	if s.Google == nil {
		return nil, ErrGoogleDisabled
	}
	id, err := s.Google.Verify(idToken)
	if err != nil {
		s.Log.InfoContext(ctx, "google token rejected", "err", err)
		return nil, ErrGoogleToken
	}
	res, err := s.googleSignIn(ctx, id, role, locale, consent, meta)
	if isUniqueViolation(err) {
		// Lost a race with a parallel first sign-in; the account exists now.
		res, err = s.googleSignIn(ctx, id, role, locale, consent, meta)
	}
	return res, err
}

func (s *Service) googleSignIn(ctx context.Context, id *GoogleIdentity, role gen.UserRole, locale gen.AppLocale, consent Consent, meta ClientMeta) (*Result, error) {
	u, err := s.Q.GetUserByGoogleSub(ctx, &id.Subject)
	switch {
	case err == nil:
		if err := checkStatus(u); err != nil {
			return nil, err
		}
		return s.startSession(ctx, u, meta)
	case !errors.Is(err, pgx.ErrNoRows):
		return nil, err
	}

	if id.Email == "" || !id.Verified {
		return nil, ErrGoogleToken
	}
	email := normalizeEmail(id.Email)
	picture := nonEmpty(id.Picture)

	existing, err := s.Q.GetUserByEmail(ctx, &email)
	switch {
	case err == nil:
		if err := checkStatus(existing); err != nil {
			return nil, err
		}
		if existing.EmailVerifiedAt == nil {
			// Whoever registered this address never proved they own it. Drop their password
			// and sessions so a squatter can't keep access to the real owner's account.
			if err := s.Q.UpdatePassword(ctx, gen.UpdatePasswordParams{ID: existing.ID}); err != nil {
				return nil, err
			}
			if err := s.RevokeAll(ctx, existing.ID); err != nil {
				return nil, err
			}
		}
		linked, err := s.Q.LinkGoogleAccount(ctx, gen.LinkGoogleAccountParams{
			ID: existing.ID, GoogleSub: &id.Subject, AvatarUrl: picture,
		})
		if err != nil {
			return nil, err
		}
		return s.startSession(ctx, linked, meta)
	case !errors.Is(err, pgx.ErrNoRows):
		return nil, err
	}

	version, err := s.consentVersion(consent)
	if err != nil {
		return nil, err
	}
	name := strings.TrimSpace(id.Name)
	if name == "" {
		name, _, _ = strings.Cut(email, "@")
	}
	u, err = s.Q.CreateGoogleUser(ctx, gen.CreateGoogleUserParams{
		Email: &email, GoogleSub: &id.Subject, FullName: name, AvatarUrl: picture, Role: role, Locale: locale,
		ConsentVersion: version,
	})
	if err != nil {
		return nil, err
	}
	res, err := s.startSession(ctx, u, meta)
	if err != nil {
		return nil, err
	}
	res.IsNewUser = true
	return res, nil
}

// ---- sessions ------------------------------------------------------------------------

func (s *Service) startSession(ctx context.Context, u gen.User, meta ClientMeta) (*Result, error) {
	refresh := random.Token(32)
	now := time.Now()
	sess, err := s.Q.CreateSession(ctx, gen.CreateSessionParams{
		UserID:      u.ID,
		RefreshHash: sha(refresh),
		Platform:    meta.Platform,
		UserAgent:   truncate(meta.UserAgent, 512),
		Ip:          addrPtr(meta.IP),
		ExpiresAt:   now.Add(s.RefreshTTL),
	})
	if err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}
	access, accessExp, err := s.Tokens.Issue(u.ID, sess.ID, string(u.Role), now)
	if err != nil {
		return nil, err
	}
	return &Result{
		User: u, AccessToken: access, AccessExpiresAt: accessExp,
		RefreshToken: refresh, RefreshExpiresAt: sess.ExpiresAt,
	}, nil
}

// Refresh rotates the refresh token. Presenting an already-rotated token means it was
// copied by someone else, so the whole session is revoked.
func (s *Service) Refresh(ctx context.Context, refresh string, meta ClientMeta) (*Result, error) {
	if refresh == "" {
		return nil, ErrInvalidRefresh
	}
	h := sha(refresh)
	sess, err := s.Q.GetSessionByRefreshHash(ctx, h)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, s.handleUnknownRefresh(ctx, h)
	}
	if err != nil {
		return nil, err
	}
	now := time.Now()
	if sess.RevokedAt != nil || now.After(sess.ExpiresAt) {
		return nil, ErrInvalidRefresh
	}

	u, err := s.Q.GetUserByID(ctx, sess.UserID)
	if err != nil {
		return nil, err
	}
	if err := checkStatus(u); err != nil {
		_ = s.revoke(ctx, sess.ID)
		return nil, err
	}

	next := random.Token(32)
	n, err := s.Q.RotateSession(ctx, gen.RotateSessionParams{
		ID: sess.ID, OldHash: h, NewHash: sha(next),
		ExpiresAt: now.Add(s.RefreshTTL), Ip: addrPtr(meta.IP), UserAgent: truncate(meta.UserAgent, 512),
	})
	if err != nil {
		return nil, err
	}
	if n == 0 { // a parallel request rotated it between our read and write
		return nil, ErrRefreshRace
	}
	access, accessExp, err := s.Tokens.Issue(u.ID, sess.ID, string(u.Role), now)
	if err != nil {
		return nil, err
	}
	_ = s.Q.TouchLastSeen(ctx, u.ID)
	return &Result{
		User: u, AccessToken: access, AccessExpiresAt: accessExp,
		RefreshToken: next, RefreshExpiresAt: now.Add(s.RefreshTTL),
	}, nil
}

func (s *Service) handleUnknownRefresh(ctx context.Context, h []byte) error {
	sess, err := s.Q.GetSessionByPrevRefreshHash(ctx, h)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrInvalidRefresh
	}
	if err != nil {
		return err
	}
	if sess.RevokedAt != nil {
		return ErrInvalidRefresh
	}
	// Two tabs refreshing at once is normal: the loser just retries with the new cookie.
	if time.Since(sess.LastUsedAt) < refreshRaceWin {
		return ErrRefreshRace
	}
	s.Log.WarnContext(ctx, "refresh token reuse detected; revoking session",
		"user_id", sess.UserID, "session_id", sess.ID)
	if err := s.revoke(ctx, sess.ID); err != nil {
		return err
	}
	return ErrInvalidRefresh
}

func (s *Service) Logout(ctx context.Context, sessionID uuid.UUID) error {
	return s.revoke(ctx, sessionID)
}

func (s *Service) revoke(ctx context.Context, sessionID uuid.UUID) error {
	if err := s.Q.RevokeSession(ctx, sessionID); err != nil {
		return err
	}
	return s.Revoked.Revoke(ctx, sessionID)
}

func (s *Service) RevokeAll(ctx context.Context, userID uuid.UUID) error {
	ids, err := s.Q.RevokeAllUserSessions(ctx, userID)
	if err != nil {
		return err
	}
	return s.Revoked.Revoke(ctx, ids...)
}

func (s *Service) Sessions(ctx context.Context, userID uuid.UUID) ([]gen.UserSession, error) {
	return s.Q.ListActiveSessions(ctx, userID)
}

func (s *Service) RevokeSession(ctx context.Context, userID, sessionID uuid.UUID) error {
	n, err := s.Q.RevokeUserSession(ctx, gen.RevokeUserSessionParams{ID: sessionID, UserID: userID})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrSessionNotFound
	}
	return s.Revoked.Revoke(ctx, sessionID)
}

// ---- e-mail verification & password -----------------------------------------------------

func (s *Service) SendEmailVerification(ctx context.Context, userID uuid.UUID) error {
	u, err := s.Q.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}
	if u.Email == nil {
		return ErrNoEmail
	}
	if u.EmailVerifiedAt != nil {
		return ErrAlreadyVerified
	}
	return otpError(s.sendEmailCode(ctx, otp.EmailVerify, u.ID.String(), *u.Email, string(u.Locale), mailer.TemplateVerifyEmail))
}

func (s *Service) VerifyEmail(ctx context.Context, userID uuid.UUID, code string) (gen.User, error) {
	if _, err := s.OTP.Verify(ctx, otp.EmailVerify, userID.String(), code); err != nil {
		return gen.User{}, otpError(err)
	}
	return s.Q.MarkEmailVerified(ctx, userID)
}

// ForgotPassword never reveals whether the e-mail exists.
func (s *Service) ForgotPassword(ctx context.Context, email string) error {
	email = normalizeEmail(email)
	u, err := s.Q.GetUserByEmail(ctx, &email)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if u.Status != gen.UserStatusActive {
		return nil
	}
	err = s.sendEmailCode(ctx, otp.PasswordReset, email, email, string(u.Locale), mailer.TemplateResetPassword)
	var cd *otp.CooldownError
	if errors.As(err, &cd) {
		return nil // silently throttled, same response as success
	}
	return err
}

// ResetPassword sets a new password and signs the user out everywhere.
func (s *Service) ResetPassword(ctx context.Context, email, code, newPassword string) error {
	email = normalizeEmail(email)
	if _, err := s.OTP.Verify(ctx, otp.PasswordReset, email, code); err != nil {
		return otpError(err)
	}
	u, err := s.Q.GetUserByEmail(ctx, &email)
	if err != nil {
		return ErrCodeInvalid
	}
	if err := s.setPassword(ctx, u.ID, newPassword); err != nil {
		return err
	}
	// Receiving the code proves ownership of the mailbox.
	if _, err := s.Q.MarkEmailVerified(ctx, u.ID); err != nil {
		return err
	}
	return s.RevokeAll(ctx, u.ID)
}

// ChangePassword keeps the current session and signs out all others.
func (s *Service) ChangePassword(ctx context.Context, userID, currentSession uuid.UUID, current, next string) error {
	u, err := s.Q.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}
	if u.PasswordHash != nil { // Google-only accounts may set a first password directly
		ok, err := hash.VerifyPasswordCtx(ctx, current, *u.PasswordHash)
		if err != nil {
			return err
		}
		if !ok {
			return ErrWrongPassword
		}
	}
	h, err := hash.PasswordCtx(ctx, next)
	if err != nil {
		return err
	}
	// One statement sets the password and revokes the other sessions (TZ BE-12), then one
	// pipelined Redis call cuts their access tokens off.
	ids, err := s.Q.ChangePasswordRevokeOthers(ctx, gen.ChangePasswordRevokeOthersParams{
		PasswordHash: &h, UserID: userID, KeepSession: currentSession,
	})
	if err != nil {
		return err
	}
	return s.Revoked.Revoke(ctx, ids...)
}

func (s *Service) setPassword(ctx context.Context, userID uuid.UUID, plain string) error {
	h, err := hash.PasswordCtx(ctx, plain)
	if err != nil {
		return err
	}
	return s.Q.UpdatePassword(ctx, gen.UpdatePasswordParams{ID: userID, PasswordHash: &h})
}

func (s *Service) sendEmailCode(ctx context.Context, p otp.Purpose, subject, to, locale, tmpl string) error {
	code, err := s.OTP.Issue(ctx, p, subject, otp.IssueOptions{TTL: emailCodeTTL, Cooldown: codeCooldown})
	if err != nil {
		return err
	}
	return s.Emails.EnqueueEmailCode(ctx, jobs.EmailCodeArgs{
		To: to, Template: tmpl, Locale: locale, Code: code, TTLMinutes: int(emailCodeTTL.Minutes()),
	})
}

// ---- phone verification via Telegram -------------------------------------------------------

func (s *Service) SendPhoneCode(ctx context.Context, userID uuid.UUID, rawPhone string) (string, error) {
	num, err := phone.Normalize(rawPhone)
	if err != nil {
		return "", ErrPhoneInvalid
	}
	taken, err := s.Q.IsPhoneTaken(ctx, gen.IsPhoneTakenParams{Phone: &num, ID: userID})
	if err != nil {
		return "", err
	}
	if taken {
		return "", ErrPhoneTaken
	}
	code, err := s.OTP.Issue(ctx, otp.PhoneVerify, userID.String(),
		otp.IssueOptions{TTL: phoneCodeTTL, Cooldown: codeCooldown, Payload: num})
	if err != nil {
		return "", otpError(err)
	}
	// Sent synchronously so the user learns immediately if the number has no Telegram.
	sendCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := s.Phone.SendCode(sendCtx, num, code, phoneCodeTTL); err != nil {
		if errors.Is(err, telegram.ErrCannotSend) {
			return "", ErrPhoneNoTelegram
		}
		s.Log.ErrorContext(ctx, "telegram gateway failed", "err", err)
		return "", ErrDeliveryFailed
	}
	return num, nil
}

func (s *Service) VerifyPhone(ctx context.Context, userID uuid.UUID, code string) (gen.User, error) {
	num, err := s.OTP.Verify(ctx, otp.PhoneVerify, userID.String(), code)
	if err != nil {
		return gen.User{}, otpError(err)
	}
	u, err := s.Q.SetVerifiedPhone(ctx, gen.SetVerifiedPhoneParams{ID: userID, Phone: &num})
	if isUniqueViolation(err) {
		return gen.User{}, ErrPhoneTaken
	}
	return u, err
}

// ---- helpers ---------------------------------------------------------------------------

func otpError(err error) error {
	var cd *otp.CooldownError
	switch {
	case errors.Is(err, otp.ErrInvalid):
		return ErrCodeInvalid
	case errors.Is(err, otp.ErrNotFound):
		return ErrCodeExpired
	case errors.Is(err, otp.ErrTooManyAttempts):
		return ErrCodeAttempts
	case errors.As(err, &cd):
		return apperr.TooManyRequests(int(cd.RetryAfter.Seconds()) + 1)
	}
	return err
}

func checkStatus(u gen.User) error {
	if u.Status != gen.UserStatusActive {
		return ErrAccountBlocked
	}
	return nil
}

func normalizeEmail(e string) string { return strings.ToLower(strings.TrimSpace(e)) }

func sha(s string) []byte {
	h := sha256.Sum256([]byte(s))
	return h[:]
}

func isUniqueViolation(err error) bool {
	var pe *pgconn.PgError
	return errors.As(err, &pe) && pe.Code == "23505"
}

func addrPtr(a netip.Addr) *netip.Addr {
	if !a.IsValid() {
		return nil
	}
	return &a
}

func nonEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
