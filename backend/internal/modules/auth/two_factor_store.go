package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/random"
	"jobvacancy.uz/backend/internal/platform/postgres"
)

// ---- what SecondFactor needs (consumer-side interfaces) -------------------------------------

// TwoFactorStore is the database side of two-factor sign-in.
type TwoFactorStore interface {
	GetUserByID(ctx context.Context, id uuid.UUID) (gen.User, error)
	GetUserTOTP(ctx context.Context, userID uuid.UUID) (gen.UserTotp, error)
	IsTOTPEnabled(ctx context.Context, userID uuid.UUID) (bool, error)
	UpsertPendingTOTP(ctx context.Context, arg gen.UpsertPendingTOTPParams) (gen.UserTotp, error)
	UseTOTPStep(ctx context.Context, arg gen.UseTOTPStepParams) (int64, error)
	UseRecoveryCode(ctx context.Context, arg gen.UseRecoveryCodeParams) (int64, error)
	CountRecoveryCodesLeft(ctx context.Context, userID uuid.UUID) (int32, error)
	SecondFactorState(ctx context.Context, arg gen.SecondFactorStateParams) (gen.SecondFactorStateRow, error)
	// InTx runs fn in one transaction.
	InTx(ctx context.Context, fn func(TwoFactorTx) error) error
}

// TwoFactorTx are the writes that change 2FA state together with sessions.
type TwoFactorTx interface {
	ConfirmTOTP(ctx context.Context, arg gen.ConfirmTOTPParams) (gen.UserTotp, error)
	InsertConfirmedTOTP(ctx context.Context, arg gen.InsertConfirmedTOTPParams) error
	DeleteTOTP(ctx context.Context, userID uuid.UUID) error
	DeleteRecoveryCodes(ctx context.Context, userID uuid.UUID) error
	InsertRecoveryCodes(ctx context.Context, arg gen.InsertRecoveryCodesParams) error
	MarkSessionSecondFactor(ctx context.Context, arg gen.MarkSessionSecondFactorParams) (int64, error)
	RevokeOtherUserSessions(ctx context.Context, arg gen.RevokeOtherUserSessionsParams) ([]uuid.UUID, error)
	RevokeAllUserSessions(ctx context.Context, userID uuid.UUID) ([]uuid.UUID, error)
}

// AccessRevoker makes access tokens of revoked sessions stop working right away.
type AccessRevoker interface {
	Revoke(ctx context.Context, ids ...uuid.UUID) error
}

// ChallengeKeeper holds the short-lived step between password and code.
type ChallengeKeeper interface {
	Create(ctx context.Context, userID uuid.UUID, now time.Time) (Challenge, error)
	// Attempt counts one try and returns the user; expired, unknown or worn-out → ErrTwoFactorChallenge.
	Attempt(ctx context.Context, token string) (uuid.UUID, error)
	// Consume ends the challenge; false if a parallel request already did.
	Consume(ctx context.Context, token string) bool
}

// FailureLimiter bounds wrong codes and passwords per user. Reserve counts an attempt
// before checking it (so parallel guesses can't overshoot) and refuses with 429 once the
// budget is spent; Release gives the attempt back when it turned out right.
type FailureLimiter interface {
	Reserve(ctx context.Context, userID uuid.UUID) error
	Release(ctx context.Context, userID uuid.UUID)
}

// ---- Postgres ------------------------------------------------------------------------------

// PGTwoFactorStore is TwoFactorStore on the generated queries.
type PGTwoFactorStore struct {
	*gen.Queries
	Pool *pgxpool.Pool
}

func (s PGTwoFactorStore) InTx(ctx context.Context, fn func(TwoFactorTx) error) error {
	return postgres.WithTx(ctx, s.Pool, func(q *gen.Queries) error { return fn(q) })
}

// ---- Redis: failure budget ----------------------------------------------------------------

// Wrong codes and passwords allowed per user (setup, sign-in, re-auth) per window. Right
// answers are given back, so normal use never runs into it.
const (
	maxCodeFailures = 10
	failureWindow   = 15 * time.Minute
)

// FailureBudget is FailureLimiter in Redis. Errors fail closed.
type FailureBudget struct{ RDB *redis.Client }

func failureKey(userID uuid.UUID) string { return "mfa:fail:" + userID.String() }

// INCR with the window set on first use; over the limit the increment is undone and the
// remaining TTL (ms) comes back negative.
var reserveScript = redis.NewScript(`
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
if n > tonumber(ARGV[1]) then
  redis.call('DECR', KEYS[1])
  return -math.max(redis.call('PTTL', KEYS[1]), 1)
end
return n`)

// Decrement only an existing, positive counter (never creates a key without a TTL).
var releaseScript = redis.NewScript(`
local n = tonumber(redis.call('GET', KEYS[1]) or '0')
if n > 0 then redis.call('DECR', KEYS[1]) end
return 0`)

func (b *FailureBudget) Reserve(ctx context.Context, userID uuid.UUID) error {
	n, err := reserveScript.Run(ctx, b.RDB, []string{failureKey(userID)}, maxCodeFailures, failureWindow.Milliseconds()).Int64()
	if err != nil {
		return err
	}
	if n < 0 {
		return apperr.TooManyRequests(int((time.Duration(-n) * time.Millisecond).Seconds()) + 1)
	}
	return nil
}

func (b *FailureBudget) Release(ctx context.Context, userID uuid.UUID) {
	_ = releaseScript.Run(ctx, b.RDB, []string{failureKey(userID)}).Err()
}

// ---- Redis: sign-in challenges ------------------------------------------------------------

const (
	challengeTTL      = 5 * time.Minute
	challengeAttempts = 5
)

// ChallengeStore is ChallengeKeeper in Redis (key = hash of the token).
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

// Read and count in one step; a missing key stays missing (HINCRBY would recreate it
// without a TTL), and the attempt over the cap deletes it.
var attemptScript = redis.NewScript(`
if redis.call('EXISTS', KEYS[1]) == 0 then return false end
local n = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
if n > tonumber(ARGV[1]) then
  redis.call('DEL', KEYS[1])
  return false
end
return redis.call('HGET', KEYS[1], 'uid')`)

func (c *ChallengeStore) Attempt(ctx context.Context, token string) (uuid.UUID, error) {
	uid, err := attemptScript.Run(ctx, c.RDB, []string{challengeKey(token)}, challengeAttempts).Text()
	if err == redis.Nil {
		return uuid.Nil, ErrTwoFactorChallenge
	}
	if err != nil {
		return uuid.Nil, err
	}
	return uuid.Parse(uid)
}

func (c *ChallengeStore) Consume(ctx context.Context, token string) bool {
	n, err := c.RDB.Del(ctx, challengeKey(token)).Result()
	return err == nil && n == 1
}
