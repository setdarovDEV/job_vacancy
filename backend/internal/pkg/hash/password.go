// Package hash implements password hashing with argon2id (PHC string format).
package hash

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

// OWASP-recommended argon2id parameters: 19 MiB memory, 2 iterations, 1 lane.
const (
	memory  = 19 * 1024
	time    = 2
	threads = 1
	keyLen  = 32
	saltLen = 16
)

var ErrMalformed = errors.New("hash: malformed password hash")

// Password hashes plain, waiting for a free hashing slot (see limit.go) without a
// deadline. Request paths use PasswordCtx.
func Password(plain string) (string, error) { return PasswordCtx(context.Background(), plain) }

// PasswordCtx hashes plain once a hashing slot is free; it gives up when ctx ends.
func PasswordCtx(ctx context.Context, plain string) (string, error) {
	release, err := acquire(ctx)
	if err != nil {
		return "", err
	}
	defer release()
	salt := make([]byte, saltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key := argon2.IDKey([]byte(plain), salt, time, memory, threads, keyLen)
	b64 := base64.RawStdEncoding
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, memory, time, threads, b64.EncodeToString(salt), b64.EncodeToString(key)), nil
}

// VerifyPassword reports whether plain matches the encoded hash. Parameters are read from
// the hash itself, so old hashes keep working if we raise the cost later.
func VerifyPassword(plain, encoded string) (bool, error) {
	return VerifyPasswordCtx(context.Background(), plain, encoded)
}

// VerifyPasswordCtx is VerifyPassword bounded by the hashing slots and ctx.
func VerifyPasswordCtx(ctx context.Context, plain, encoded string) (bool, error) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false, ErrMalformed
	}
	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil || version != argon2.Version {
		return false, ErrMalformed
	}
	var m, t uint32
	var p uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &m, &t, &p); err != nil {
		return false, ErrMalformed
	}
	b64 := base64.RawStdEncoding
	salt, err := b64.DecodeString(parts[4])
	if err != nil {
		return false, ErrMalformed
	}
	want, err := b64.DecodeString(parts[5])
	if err != nil {
		return false, ErrMalformed
	}
	release, err := acquire(ctx)
	if err != nil {
		return false, err
	}
	defer release()
	got := argon2.IDKey([]byte(plain), salt, t, m, p, uint32(len(want)))
	return subtle.ConstantTimeCompare(got, want) == 1, nil
}
