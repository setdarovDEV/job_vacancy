package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/hash"
	"jobvacancy.uz/backend/internal/pkg/random"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/pkg/sealbox"
	"jobvacancy.uz/backend/internal/pkg/totp"
	"jobvacancy.uz/backend/internal/platform/postgres"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

var (
	ErrTwoFactorAdminsOnly     = apperr.Forbidden("two_factor_admins_only", "two-factor sign-in is available for administrators")
	ErrTwoFactorAlreadyEnabled = apperr.Conflict("two_factor_already_enabled", "two-factor sign-in is already on")
	ErrTwoFactorNotEnabled     = apperr.Conflict("two_factor_not_enabled", "two-factor sign-in is not set up")
	ErrTwoFactorCodeInvalid    = apperr.BadRequest("two_factor_code_invalid", "the code is wrong or was already used")
	ErrTwoFactorChallenge      = apperr.Unauthorized("two_factor_challenge_invalid", "this sign-in step expired; sign in again")
	ErrTwoFactorSetupRequired  = apperr.Forbidden("two_factor_setup_required", "administrators must turn on two-factor sign-in first")
)

const (
	recoveryCodeCount = 10
	challengeTTL      = 5 * time.Minute
	challengeAttempts = 5
)

// Wrong codes allowed per user (across challenges, setup and changes) per window. Only
// failures count, so normal use never runs into it.
const (
	maxCodeFailures = 10
	failureWindow   = 15 * time.Minute
)

// SecondFactor owns TOTP sign-in: enrollment (admins only), verification with a replay
// guard, single-use recovery codes and the short-lived challenge between password and code.
type SecondFactor struct {
	Pool       *pgxpool.Pool
	Q          *gen.Queries
	Box        *sealbox.Box // seals secrets at rest
	Challenges *ChallengeStore
	Failures   *FailureBudget
	Issuer     string
	// AdminRequired: administrators must have 2FA on to use /admin (ADMIN_2FA_REQUIRED).
	AdminRequired bool
	Now           func() time.Time
}

type TwoFactorStatus struct {
	Required          bool // this user must turn it on (admin while AdminRequired)
	Enabled           bool
	Pending           bool // a secret was issued but not confirmed yet
	ConfirmedAt       *time.Time
	RecoveryCodesLeft int
}

type Enrollment struct {
	Secret string // base32, for manual entry
	URI    string // otpauth://, shown as a QR code
}

func (f *SecondFactor) now() time.Time {
	if f.Now != nil {
		return f.Now()
	}
	return time.Now()
}

// Enabled reports whether u signs in with a second factor.
func (f *SecondFactor) Enabled(ctx context.Context, userID uuid.UUID) (bool, error) {
	return f.Q.IsTOTPEnabled(ctx, userID)
}

func (f *SecondFactor) Status(ctx context.Context, p reqctx.Principal) (TwoFactorStatus, error) {
	userID := p.UserID
	required := f.AdminRequired && p.Role == string(gen.UserRoleAdmin)
	row, err := f.Q.GetUserTOTP(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return TwoFactorStatus{Required: required}, nil
	}
	if err != nil {
		return TwoFactorStatus{}, err
	}
	st := TwoFactorStatus{Required: required, Enabled: row.ConfirmedAt != nil, Pending: row.ConfirmedAt == nil, ConfirmedAt: row.ConfirmedAt}
	if st.Enabled {
		n, err := f.Q.CountRecoveryCodesLeft(ctx, userID)
		if err != nil {
			return st, err
		}
		st.RecoveryCodesLeft = int(n)
	}
	return st, nil
}

// Setup issues a new secret (replacing an unconfirmed one) for an administrator.
func (f *SecondFactor) Setup(ctx context.Context, u gen.User) (Enrollment, error) {
	if u.Role != gen.UserRoleAdmin {
		return Enrollment{}, ErrTwoFactorAdminsOnly
	}
	secret, err := totp.NewSecret()
	if err != nil {
		return Enrollment{}, err
	}
	sealed, err := f.Box.Seal(secret)
	if err != nil {
		return Enrollment{}, err
	}
	if _, err := f.Q.UpsertPendingTOTP(ctx, gen.UpsertPendingTOTPParams{UserID: u.ID, SecretEnc: sealed}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Enrollment{}, ErrTwoFactorAlreadyEnabled
		}
		return Enrollment{}, err
	}
	account := u.FullName
	if u.Email != nil {
		account = *u.Email
	}
	return Enrollment{Secret: totp.Encode(secret), URI: totp.URI(f.Issuer, account, secret)}, nil
}

// Confirm turns 2FA on once the user proves the app shows the right codes, and returns the
// recovery codes (shown once).
func (f *SecondFactor) Confirm(ctx context.Context, userID uuid.UUID, code string) ([]string, error) {
	if err := f.Failures.Check(ctx, userID); err != nil {
		return nil, err
	}
	row, err := f.Q.GetUserTOTP(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrTwoFactorNotEnabled
	}
	if err != nil {
		return nil, err
	}
	if row.ConfirmedAt != nil {
		return nil, ErrTwoFactorAlreadyEnabled
	}
	secret, err := f.Box.Open(row.SecretEnc)
	if err != nil {
		return nil, err
	}
	step, ok := totp.Verify(secret, code, f.now(), 0)
	if !ok {
		return nil, f.Failures.Record(ctx, userID)
	}
	codes, hashes := newRecoveryCodes()
	err = postgres.WithTx(ctx, f.Pool, func(q *gen.Queries) error {
		if _, err := q.ConfirmTOTP(ctx, gen.ConfirmTOTPParams{UserID: userID, LastStep: step}); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrTwoFactorAlreadyEnabled // confirmed concurrently
			}
			return err
		}
		if err := q.DeleteRecoveryCodes(ctx, userID); err != nil {
			return err
		}
		return q.InsertRecoveryCodes(ctx, gen.InsertRecoveryCodesParams{UserID: userID, Hashes: hashes})
	})
	if err != nil {
		return nil, err
	}
	return codes, nil
}

// Verify checks a TOTP code or, when recovery is set, burns a recovery code. Wrong codes
// count against the user's failure budget; once it is spent every attempt gets 429.
func (f *SecondFactor) Verify(ctx context.Context, userID uuid.UUID, code, recovery string) error {
	if err := f.Failures.Check(ctx, userID); err != nil {
		return err
	}
	err := f.verify(ctx, userID, code, recovery)
	if errors.Is(err, ErrTwoFactorCodeInvalid) {
		return f.Failures.Record(ctx, userID)
	}
	return err
}

func (f *SecondFactor) verify(ctx context.Context, userID uuid.UUID, code, recovery string) error {
	if strings.TrimSpace(recovery) != "" {
		n, err := f.Q.UseRecoveryCode(ctx, gen.UseRecoveryCodeParams{UserID: userID, CodeHash: recoveryHash(recovery)})
		if err != nil {
			return err
		}
		if n != 1 {
			return ErrTwoFactorCodeInvalid
		}
		return nil
	}
	row, err := f.Q.GetUserTOTP(ctx, userID)
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
	n, err := f.Q.UseTOTPStep(ctx, gen.UseTOTPStepParams{UserID: userID, LastStep: step})
	if err != nil {
		return err
	}
	if n != 1 {
		return ErrTwoFactorCodeInvalid
	}
	return nil
}

// RegenerateRecoveryCodes replaces all recovery codes; needs the password and a code.
func (f *SecondFactor) RegenerateRecoveryCodes(ctx context.Context, u gen.User, password, code string) ([]string, error) {
	if err := f.reauth(ctx, u, password, code); err != nil {
		return nil, err
	}
	codes, hashes := newRecoveryCodes()
	err := postgres.WithTx(ctx, f.Pool, func(q *gen.Queries) error {
		if err := q.DeleteRecoveryCodes(ctx, u.ID); err != nil {
			return err
		}
		return q.InsertRecoveryCodes(ctx, gen.InsertRecoveryCodesParams{UserID: u.ID, Hashes: hashes})
	})
	return codes, err
}

// Disable turns 2FA off; needs the password and a code. For admins with ADMIN_2FA_REQUIRED
// this locks /admin until they enroll again.
func (f *SecondFactor) Disable(ctx context.Context, u gen.User, password, code string) error {
	if err := f.reauth(ctx, u, password, code); err != nil {
		return err
	}
	return postgres.WithTx(ctx, f.Pool, func(q *gen.Queries) error {
		if err := q.DeleteRecoveryCodes(ctx, u.ID); err != nil {
			return err
		}
		return q.DeleteTOTP(ctx, u.ID)
	})
}

// reauth: the password (when the account has one) plus a current TOTP code.
func (f *SecondFactor) reauth(ctx context.Context, u gen.User, password, code string) error {
	if u.PasswordHash != nil {
		ok, err := hash.VerifyPassword(password, *u.PasswordHash)
		if err != nil {
			return err
		}
		if !ok {
			return ErrWrongPassword
		}
	}
	return f.Verify(ctx, u.ID, code, "")
}

// FailureBudget counts wrong second-factor codes per user in Redis.
type FailureBudget struct{ RDB *redis.Client }

func failureKey(userID uuid.UUID) string { return "mfa:fail:" + userID.String() }

// Check refuses (429) once the budget is spent; Redis errors refuse too (fail closed).
func (b *FailureBudget) Check(ctx context.Context, userID uuid.UUID) error {
	n, err := b.RDB.Get(ctx, failureKey(userID)).Int()
	if errors.Is(err, redis.Nil) {
		return nil
	}
	if err != nil {
		return err
	}
	if n >= maxCodeFailures {
		ttl, _ := b.RDB.TTL(ctx, failureKey(userID)).Result()
		return apperr.TooManyRequests(int(max(ttl, time.Second).Seconds()) + 1)
	}
	return nil
}

// Record counts one wrong code and returns the error to send back.
func (b *FailureBudget) Record(ctx context.Context, userID uuid.UUID) error {
	key := failureKey(userID)
	n, err := b.RDB.Incr(ctx, key).Result()
	if err != nil {
		return err
	}
	if n == 1 {
		b.RDB.Expire(ctx, key, failureWindow)
	}
	return ErrTwoFactorCodeInvalid
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

// ChallengeStore keeps challenges in Redis for a few minutes, with an attempt budget.
type ChallengeStore struct{ RDB *redis.Client }

func challengeKey(token string) string {
	sum := sha256.Sum256([]byte(token))
	return "mfa:challenge:" + hex.EncodeToString(sum[:])
}

func (c *ChallengeStore) Create(ctx context.Context, userID uuid.UUID, now time.Time) (Challenge, error) {
	token := random.Token(32)
	key := challengeKey(token)
	_, err := c.RDB.TxPipelined(ctx, func(p redis.Pipeliner) error {
		p.HSet(ctx, key, "uid", userID.String(), "attempts", 0)
		p.Expire(ctx, key, challengeTTL)
		return nil
	})
	if err != nil {
		return Challenge{}, err
	}
	return Challenge{Token: token, ExpiresAt: now.Add(challengeTTL)}, nil
}

// Attempt counts one try and returns the user; too many tries end the challenge.
func (c *ChallengeStore) Attempt(ctx context.Context, token string) (uuid.UUID, error) {
	key := challengeKey(token)
	uid, err := c.RDB.HGet(ctx, key, "uid").Result()
	if errors.Is(err, redis.Nil) {
		return uuid.Nil, ErrTwoFactorChallenge
	}
	if err != nil {
		return uuid.Nil, err
	}
	n, err := c.RDB.HIncrBy(ctx, key, "attempts", 1).Result()
	if err != nil {
		return uuid.Nil, err
	}
	if n > challengeAttempts {
		c.RDB.Del(ctx, key)
		return uuid.Nil, ErrTwoFactorChallenge
	}
	return uuid.Parse(uid)
}

// Consume deletes the challenge; false if it was already gone (single use).
func (c *ChallengeStore) Consume(ctx context.Context, token string) bool {
	n, err := c.RDB.Del(ctx, challengeKey(token)).Result()
	return err == nil && n == 1
}

// ---- recovery codes -----------------------------------------------------------------------

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

// ---- admin gate -----------------------------------------------------------------------------

// RequireEnrolled blocks signed-in users without 2FA (used on /admin). With AdminRequired
// off (local development only; config refuses it in production) it lets everyone through.
// Lookup failures fail closed.
func (f *SecondFactor) RequireEnrolled() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		if !f.AdminRequired {
			return next
		}
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			p := reqctx.MustPrincipal(r.Context())
			ok, err := f.Enabled(r.Context(), p.UserID)
			if err != nil {
				response.Error(w, r, err)
				return
			}
			if !ok {
				response.Error(w, r, ErrTwoFactorSetupRequired)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
