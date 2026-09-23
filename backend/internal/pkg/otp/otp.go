// Package otp stores one-time codes (e-mail verification, password reset, phone
// verification) in Redis. Only an HMAC of the code is stored, each code has a limited
// number of attempts, and re-sending is throttled by a cooldown.
package otp

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/internal/pkg/random"
)

type Purpose string

const (
	EmailVerify   Purpose = "email_verify"
	PasswordReset Purpose = "password_reset"
	PhoneVerify   Purpose = "phone_verify"
)

const (
	CodeLength  = 6
	MaxAttempts = 5
)

var (
	ErrNotFound        = errors.New("otp: code expired or not requested")
	ErrInvalid         = errors.New("otp: invalid code")
	ErrTooManyAttempts = errors.New("otp: too many attempts")
)

// CooldownError is returned when a new code is requested too soon.
type CooldownError struct{ RetryAfter time.Duration }

func (e *CooldownError) Error() string { return fmt.Sprintf("otp: retry after %s", e.RetryAfter) }

type Store struct {
	rdb    *redis.Client
	secret []byte
}

func NewStore(rdb *redis.Client, secret string) *Store {
	return &Store{rdb: rdb, secret: []byte(secret)}
}

type IssueOptions struct {
	TTL      time.Duration
	Cooldown time.Duration
	// Payload is returned by Verify, e.g. the phone number the code was sent to.
	Payload string
}

// Issue generates a fresh code for (purpose, subject), replacing any previous one.
func (s *Store) Issue(ctx context.Context, p Purpose, subject string, o IssueOptions) (string, error) {
	cdKey := s.key("cd", p, subject)
	ok, err := s.rdb.SetNX(ctx, cdKey, 1, o.Cooldown).Result()
	if err != nil {
		return "", fmt.Errorf("otp: %w", err)
	}
	if !ok {
		ttl, _ := s.rdb.PTTL(ctx, cdKey).Result()
		return "", &CooldownError{RetryAfter: max(ttl, time.Second)}
	}

	code := random.Digits(CodeLength)
	k := s.key("code", p, subject)
	_, err = s.rdb.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
		pipe.Del(ctx, k)
		pipe.HSet(ctx, k, "h", s.mac(p, subject, code), "a", MaxAttempts, "p", o.Payload)
		pipe.PExpire(ctx, k, o.TTL)
		return nil
	})
	if err != nil {
		return "", fmt.Errorf("otp: %w", err)
	}
	return code, nil
}

// Atomically: check existence, spend one attempt, compare, delete on success.
var verifyScript = redis.NewScript(`
local h = redis.call("HGET", KEYS[1], "h")
if not h then return {-1, ""} end
local left = redis.call("HINCRBY", KEYS[1], "a", -1)
if left < 0 then redis.call("DEL", KEYS[1]) return {-2, ""} end
if h == ARGV[1] then
  local p = redis.call("HGET", KEYS[1], "p")
  redis.call("DEL", KEYS[1])
  return {1, p}
end
return {0, ""}
`)

// Verify checks code and, on success, consumes it and returns the stored payload.
func (s *Store) Verify(ctx context.Context, p Purpose, subject, code string) (string, error) {
	res, err := verifyScript.Run(ctx, s.rdb, []string{s.key("code", p, subject)}, s.mac(p, subject, code)).Slice()
	if err != nil {
		return "", fmt.Errorf("otp: %w", err)
	}
	status, _ := res[0].(int64)
	payload, _ := res[1].(string)
	switch status {
	case 1:
		return payload, nil
	case -1:
		return "", ErrNotFound
	case -2:
		return "", ErrTooManyAttempts
	default:
		return "", ErrInvalid
	}
}

func (s *Store) key(kind string, p Purpose, subject string) string {
	return fmt.Sprintf("otp:%s:%s:%s", kind, p, subject)
}

func (s *Store) mac(p Purpose, subject, code string) string {
	m := hmac.New(sha256.New, s.secret)
	fmt.Fprintf(m, "%s|%s|%s", p, subject, code)
	return hex.EncodeToString(m.Sum(nil))
}
