package auth

import (
	"context"
	"crypto/sha256"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/hash"
	"jobvacancy.uz/backend/internal/pkg/random"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/pkg/sealbox"
	"jobvacancy.uz/backend/internal/pkg/totp"
)

var (
	ErrTwoFactorAdminsOnly     = apperr.Forbidden("two_factor_admins_only", "two-factor sign-in is available for administrators")
	ErrTwoFactorAlreadyEnabled = apperr.Conflict("two_factor_already_enabled", "two-factor sign-in is already on")
	ErrTwoFactorNotEnabled     = apperr.Conflict("two_factor_not_enabled", "two-factor sign-in is not set up")
	ErrTwoFactorCodeInvalid    = apperr.BadRequest("two_factor_code_invalid", "the code is wrong or was already used")
	ErrTwoFactorChallenge      = apperr.Unauthorized("two_factor_challenge_invalid", "this sign-in step expired; sign in again")
	ErrTwoFactorSetupRequired  = apperr.Forbidden("two_factor_setup_required", "administrators must turn on two-factor sign-in first")
	ErrTwoFactorSession        = apperr.Forbidden("two_factor_session_required", "sign in again with your two-factor code")
	// One answer for any failed re-authentication, so it can't be used to test passwords.
	ErrReauthFailed = apperr.BadRequest("reauth_failed", "the password or the code is wrong")
)

const recoveryCodeCount = 10

// SecondFactor owns TOTP sign-in: enrollment (admins only), verification with a replay
// guard, single-use recovery codes, the challenge between password and code, and which
// sessions proved a second factor.
type SecondFactor struct {
	Store      TwoFactorStore
	Box        *sealbox.Box // seals secrets at rest
	Challenges ChallengeKeeper
	Failures   FailureLimiter
	Sessions   AccessRevoker
	Issuer     string
	// AdminRequired: administrators must have 2FA on to use /admin (ADMIN_2FA_REQUIRED).
	AdminRequired bool
	Log           *slog.Logger
	Now           func() time.Time
}

type TwoFactorStatus struct {
	Required          bool // this user must turn it on (admin while AdminRequired)
	Enabled           bool
	Pending           bool // a secret was issued but not confirmed yet
	SessionVerified   bool // the current session proved a second factor
	ConfirmedAt       *time.Time
	RecoveryCodesLeft int
}

type Enrollment struct {
	Secret string // base32, for manual entry
	URI    string // otpauth://, shown as a QR code
}

// Reauth proves the account owner before 2FA changes: the password (when the account has
// one) and either a current code or a recovery code.
type Reauth struct {
	Password string
	Code     string
	Recovery string
}

func (f *SecondFactor) now() time.Time {
	if f.Now != nil {
		return f.Now()
	}
	return time.Now()
}

// Enabled reports whether the user signs in with a second factor.
func (f *SecondFactor) Enabled(ctx context.Context, userID uuid.UUID) (bool, error) {
	return f.Store.IsTOTPEnabled(ctx, userID)
}

func (f *SecondFactor) Status(ctx context.Context, p reqctx.Principal) (TwoFactorStatus, error) {
	st := TwoFactorStatus{Required: f.AdminRequired && p.Role == string(gen.UserRoleAdmin)}
	row, err := f.Store.GetUserTOTP(ctx, p.UserID)
	if errors.Is(err, pgx.ErrNoRows) {
		return st, nil
	}
	if err != nil {
		return TwoFactorStatus{}, err
	}
	st.Enabled, st.Pending, st.ConfirmedAt = row.ConfirmedAt != nil, row.ConfirmedAt == nil, row.ConfirmedAt
	if st.Enabled {
		state, err := f.Store.SecondFactorState(ctx, gen.SecondFactorStateParams{UserID: p.UserID, SessionID: p.SessionID})
		if err != nil {
			return TwoFactorStatus{}, err
		}
		st.SessionVerified = state.SessionVerified
		n, err := f.Store.CountRecoveryCodesLeft(ctx, p.UserID)
		if err != nil {
			return TwoFactorStatus{}, err
		}
		st.RecoveryCodesLeft = int(n)
	}
	return st, nil
}

// AdminAccess is the /admin gate. With 2FA on, the session must have proven it (a session
// from before 2FA was turned on doesn't count); without, required admins must enroll.
// Lookup failures refuse.
func (f *SecondFactor) AdminAccess(ctx context.Context, p reqctx.Principal) error {
	state, err := f.Store.SecondFactorState(ctx, gen.SecondFactorStateParams{UserID: p.UserID, SessionID: p.SessionID})
	if err != nil {
		return err
	}
	switch {
	case state.Enabled && !state.SessionVerified:
		return ErrTwoFactorSession
	case !state.Enabled && f.AdminRequired:
		return ErrTwoFactorSetupRequired
	}
	return nil
}

func (f *SecondFactor) admin(ctx context.Context, userID uuid.UUID) (gen.User, error) {
	u, err := f.Store.GetUserByID(ctx, userID)
	if err != nil {
		return gen.User{}, err
	}
	if u.Role != gen.UserRoleAdmin {
		return gen.User{}, ErrTwoFactorAdminsOnly
	}
	return u, nil
}

func (f *SecondFactor) enrollment(u gen.User, secret []byte) Enrollment {
	account := u.FullName
	if u.Email != nil {
		account = *u.Email
	}
	return Enrollment{Secret: totp.Encode(secret), URI: totp.URI(f.Issuer, account, secret)}
}

// Setup issues a new secret (replacing an unconfirmed one) for an administrator.
func (f *SecondFactor) Setup(ctx context.Context, userID uuid.UUID) (Enrollment, error) {
	u, err := f.admin(ctx, userID)
	if err != nil {
		return Enrollment{}, err
	}
	secret, err := totp.NewSecret()
	if err != nil {
		return Enrollment{}, err
	}
	sealed, err := f.Box.Seal(secret)
	if err != nil {
		return Enrollment{}, err
	}
	if _, err := f.Store.UpsertPendingTOTP(ctx, gen.UpsertPendingTOTPParams{UserID: u.ID, SecretEnc: sealed}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Enrollment{}, ErrTwoFactorAlreadyEnabled
		}
		return Enrollment{}, err
	}
	return f.enrollment(u, secret), nil
}

// Confirm turns 2FA on once the user proves the app shows the right codes, and returns the
// recovery codes (shown once). The current session counts as verified (it just proved a
// code); every other session of the user is signed out, since none of them did.
func (f *SecondFactor) Confirm(ctx context.Context, p reqctx.Principal, code string) ([]string, error) {
	if err := f.Failures.Reserve(ctx, p.UserID); err != nil {
		return nil, err
	}
	step, err := f.checkPending(ctx, p.UserID, code)
	if !errors.Is(err, ErrTwoFactorCodeInvalid) {
		f.Failures.Release(ctx, p.UserID)
	}
	if err != nil {
		return nil, err
	}
	codes, hashes := newRecoveryCodes()
	var revoked []uuid.UUID
	err = f.Store.InTx(ctx, func(tx TwoFactorTx) error {
		if _, err := tx.ConfirmTOTP(ctx, gen.ConfirmTOTPParams{UserID: p.UserID, LastStep: step}); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrTwoFactorAlreadyEnabled // confirmed concurrently
			}
			return err
		}
		if err := replaceRecoveryCodes(ctx, tx, p.UserID, hashes); err != nil {
			return err
		}
		if _, err := tx.MarkSessionSecondFactor(ctx, gen.MarkSessionSecondFactorParams{ID: p.SessionID, UserID: p.UserID}); err != nil {
			return err
		}
		revoked, err = tx.RevokeOtherUserSessions(ctx, gen.RevokeOtherUserSessionsParams{UserID: p.UserID, Keep: p.SessionID})
		return err
	})
	if err != nil {
		return nil, err
	}
	f.revokeAccess(ctx, revoked)
	return codes, nil
}

func (f *SecondFactor) checkPending(ctx context.Context, userID uuid.UUID, code string) (int64, error) {
	row, err := f.Store.GetUserTOTP(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrTwoFactorNotEnabled
	}
	if err != nil {
		return 0, err
	}
	if row.ConfirmedAt != nil {
		return 0, ErrTwoFactorAlreadyEnabled
	}
	secret, err := f.Box.Open(row.SecretEnc)
	if err != nil {
		return 0, err
	}
	step, ok := totp.Verify(secret, code, f.now(), 0)
	if !ok {
		return 0, ErrTwoFactorCodeInvalid
	}
	return step, nil
}

// Verify checks a TOTP code or, when recovery is set, burns a recovery code. Wrong codes
// count against the user's failure budget; once it is spent every attempt gets 429.
func (f *SecondFactor) Verify(ctx context.Context, userID uuid.UUID, code, recovery string) error {
	if err := f.Failures.Reserve(ctx, userID); err != nil {
		return err
	}
	err := f.verify(ctx, userID, code, recovery)
	if !errors.Is(err, ErrTwoFactorCodeInvalid) {
		f.Failures.Release(ctx, userID)
	}
	return err
}

func (f *SecondFactor) verify(ctx context.Context, userID uuid.UUID, code, recovery string) error {
	if strings.TrimSpace(recovery) != "" {
		n, err := f.Store.UseRecoveryCode(ctx, gen.UseRecoveryCodeParams{UserID: userID, CodeHash: recoveryHash(recovery)})
		if err != nil {
			return err
		}
		if n != 1 {
			return ErrTwoFactorCodeInvalid
		}
		return nil
	}
	row, err := f.Store.GetUserTOTP(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && row.ConfirmedAt == nil) {
		return ErrTwoFactorNotEnabled
	}
	if err != nil {
		return err
	}
	secret, err := f.Box.Open(row.SecretEnc)
	if err != nil {
		return err
	}
	step, ok := totp.Verify(secret, code, f.now(), row.LastStep)
	if !ok {
		return ErrTwoFactorCodeInvalid
	}
	// The conditional update makes a code usable once even under concurrent requests.
	n, err := f.Store.UseTOTPStep(ctx, gen.UseTOTPStepParams{UserID: userID, LastStep: step})
	if err != nil {
		return err
	}
	if n != 1 {
		return ErrTwoFactorCodeInvalid
	}
	return nil
}

// RegenerateRecoveryCodes replaces all recovery codes after re-authentication.
func (f *SecondFactor) RegenerateRecoveryCodes(ctx context.Context, userID uuid.UUID, in Reauth) ([]string, error) {
	if err := f.reauth(ctx, userID, in); err != nil {
		return nil, err
	}
	codes, hashes := newRecoveryCodes()
	err := f.Store.InTx(ctx, func(tx TwoFactorTx) error { return replaceRecoveryCodes(ctx, tx, userID, hashes) })
	return codes, err
}

// Disable turns 2FA off after re-authentication and signs out the user's other sessions.
// For admins with ADMIN_2FA_REQUIRED this locks /admin until they enroll again.
func (f *SecondFactor) Disable(ctx context.Context, p reqctx.Principal, in Reauth) error {
	if err := f.reauth(ctx, p.UserID, in); err != nil {
		return err
	}
	var revoked []uuid.UUID
	err := f.Store.InTx(ctx, func(tx TwoFactorTx) error {
		if err := tx.DeleteRecoveryCodes(ctx, p.UserID); err != nil {
			return err
		}
		if err := tx.DeleteTOTP(ctx, p.UserID); err != nil {
			return err
		}
		var err error
		revoked, err = tx.RevokeOtherUserSessions(ctx, gen.RevokeOtherUserSessionsParams{UserID: p.UserID, Keep: p.SessionID})
		return err
	})
	if err != nil {
		return err
	}
	f.revokeAccess(ctx, revoked)
	return nil
}

// reauth: the password (when the account has one) and a code or a recovery code. A wrong
// password counts against the same budget as a wrong code, and every failure answers
// reauth_failed, so this can't be used to guess passwords or tell which part was wrong.
func (f *SecondFactor) reauth(ctx context.Context, userID uuid.UUID, in Reauth) error {
	u, err := f.Store.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}
	if err := f.Failures.Reserve(ctx, userID); err != nil {
		return err
	}
	if u.PasswordHash != nil {
		ok, err := hash.VerifyPassword(in.Password, *u.PasswordHash)
		if err != nil {
			f.Failures.Release(ctx, userID)
			return err
		}
		if !ok {
			return ErrReauthFailed
		}
	}
	switch err := f.verify(ctx, userID, in.Code, in.Recovery); {
	case errors.Is(err, ErrTwoFactorCodeInvalid):
		return ErrReauthFailed
	case err != nil:
		f.Failures.Release(ctx, userID)
		return err
	}
	f.Failures.Release(ctx, userID)
	return nil
}

// ---- operator commands (ctl two-factor) -----------------------------------------------------

// Enroll turns 2FA on for an administrator without the app round trip (the operator hands
// over the QR code and recovery codes). Existing sessions are signed out. With force an
// existing enrollment is replaced; without, it is refused.
func (f *SecondFactor) Enroll(ctx context.Context, userID uuid.UUID, force bool) (Enrollment, []string, error) {
	u, err := f.admin(ctx, userID)
	if err != nil {
		return Enrollment{}, nil, err
	}
	on, err := f.Enabled(ctx, userID)
	if err != nil {
		return Enrollment{}, nil, err
	}
	if on && !force {
		return Enrollment{}, nil, ErrTwoFactorAlreadyEnabled
	}
	secret, err := totp.NewSecret()
	if err != nil {
		return Enrollment{}, nil, err
	}
	sealed, err := f.Box.Seal(secret)
	if err != nil {
		return Enrollment{}, nil, err
	}
	codes, hashes := newRecoveryCodes()
	var revoked []uuid.UUID
	err = f.Store.InTx(ctx, func(tx TwoFactorTx) error {
		if err := tx.DeleteTOTP(ctx, userID); err != nil {
			return err
		}
		if err := tx.InsertConfirmedTOTP(ctx, gen.InsertConfirmedTOTPParams{UserID: userID, SecretEnc: sealed}); err != nil {
			return err
		}
		if err := replaceRecoveryCodes(ctx, tx, userID, hashes); err != nil {
			return err
		}
		revoked, err = tx.RevokeAllUserSessions(ctx, userID)
		return err
	})
	if err != nil {
		return Enrollment{}, nil, err
	}
	f.revokeAccess(ctx, revoked)
	return f.enrollment(u, secret), codes, nil
}

// Reset turns 2FA off for a user who lost both the phone and the recovery codes, and signs
// out every session.
func (f *SecondFactor) Reset(ctx context.Context, userID uuid.UUID) error {
	var revoked []uuid.UUID
	err := f.Store.InTx(ctx, func(tx TwoFactorTx) error {
		if err := tx.DeleteRecoveryCodes(ctx, userID); err != nil {
			return err
		}
		if err := tx.DeleteTOTP(ctx, userID); err != nil {
			return err
		}
		var err error
		revoked, err = tx.RevokeAllUserSessions(ctx, userID)
		return err
	})
	if err != nil {
		return err
	}
	f.revokeAccess(ctx, revoked)
	return nil
}

// revokeAccess stops the access tokens of sessions revoked in the database. Those expire
// within minutes anyway, so a Redis hiccup is logged rather than failing the change.
func (f *SecondFactor) revokeAccess(ctx context.Context, ids []uuid.UUID) {
	if len(ids) == 0 {
		return
	}
	if err := f.Sessions.Revoke(ctx, ids...); err != nil && f.Log != nil {
		f.Log.WarnContext(ctx, "access tokens of revoked sessions not blocked", "err", err, "sessions", len(ids))
	}
}

// ---- sign-in challenge ---------------------------------------------------------------------

// Challenge is handed out instead of a session when the password was right but a second
// factor is still needed.
type Challenge struct {
	Token     string
	ExpiresAt time.Time
}

func (f *SecondFactor) StartChallenge(ctx context.Context, userID uuid.UUID) (Challenge, error) {
	return f.Challenges.Create(ctx, userID, f.now())
}

// CompleteChallenge verifies the code for a challenge and consumes it.
func (f *SecondFactor) CompleteChallenge(ctx context.Context, token, code, recovery string) (uuid.UUID, error) {
	userID, err := f.Challenges.Attempt(ctx, token)
	if err != nil {
		return uuid.Nil, err
	}
	if err := f.Verify(ctx, userID, code, recovery); err != nil {
		return uuid.Nil, err
	}
	if !f.Challenges.Consume(ctx, token) {
		return uuid.Nil, ErrTwoFactorChallenge // used by a parallel request
	}
	return userID, nil
}

// ---- recovery codes -----------------------------------------------------------------------

func replaceRecoveryCodes(ctx context.Context, tx TwoFactorTx, userID uuid.UUID, hashes [][]byte) error {
	if err := tx.DeleteRecoveryCodes(ctx, userID); err != nil {
		return err
	}
	return tx.InsertRecoveryCodes(ctx, gen.InsertRecoveryCodesParams{UserID: userID, Hashes: hashes})
}

func newRecoveryCodes() (codes []string, hashes [][]byte) {
	for range recoveryCodeCount {
		raw := strings.ToLower(random.Base36(10)) // ~51 bits
		code := raw[:5] + "-" + raw[5:]
		codes = append(codes, code)
		hashes = append(hashes, recoveryHash(code))
	}
	return codes, hashes
}

// recoveryHash ignores case, dashes and spaces, so "ABCDE-FGHIJ" and "abcdefghij" match.
func recoveryHash(code string) []byte {
	norm := strings.NewReplacer("-", "", " ", "").Replace(strings.ToLower(strings.TrimSpace(code)))
	sum := sha256.Sum256([]byte(norm))
	return sum[:]
}
