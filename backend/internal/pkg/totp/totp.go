// Package totp implements time-based one-time passwords (RFC 6238) as used by
// authenticator apps: HMAC-SHA1, 30-second steps, 6 digits.
package totp

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/subtle"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"net/url"
	"strings"
	"time"
)

const (
	Period = 30 * time.Second
	Digits = 6
	// Skew accepts the neighbouring steps too, for phones whose clock is a little off.
	Skew = 1
)

var b32 = base32.StdEncoding.WithPadding(base32.NoPadding)

// NewSecret returns a random 160-bit key.
func NewSecret() ([]byte, error) {
	s := make([]byte, 20)
	_, err := rand.Read(s)
	return s, err
}

// Encode is the secret as authenticator apps expect it (base32, no padding).
func Encode(secret []byte) string { return b32.EncodeToString(secret) }

// Decode accepts what Encode produced, ignoring case and spaces.
func Decode(s string) ([]byte, error) {
	return b32.DecodeString(strings.ToUpper(strings.ReplaceAll(s, " ", "")))
}

// Step is the counter for t.
func Step(t time.Time) int64 { return t.Unix() / int64(Period/time.Second) }

// Code is the one-time password for a counter value.
func Code(secret []byte, step int64) string {
	var msg [8]byte
	binary.BigEndian.PutUint64(msg[:], uint64(step))
	mac := hmac.New(sha1.New, secret)
	mac.Write(msg[:])
	sum := mac.Sum(nil)
	off := sum[len(sum)-1] & 0x0f
	bin := binary.BigEndian.Uint32(sum[off:off+4]) & 0x7fffffff
	return fmt.Sprintf("%0*d", Digits, bin%1_000_000)
}

// Verify checks code at time now and returns the step it matched. Steps at or before
// lastUsed are refused, so a code can't be replayed within its validity window.
func Verify(secret []byte, code string, now time.Time, lastUsed int64) (int64, bool) {
	code = strings.TrimSpace(code)
	if len(code) != Digits {
		return 0, false
	}
	cur := Step(now)
	for d := int64(-Skew); d <= Skew; d++ {
		step := cur + d
		if step <= lastUsed {
			continue
		}
		if subtle.ConstantTimeCompare([]byte(Code(secret, step)), []byte(code)) == 1 {
			return step, true
		}
	}
	return 0, false
}

// URI is the otpauth:// link shown as a QR code.
func URI(issuer, account string, secret []byte) string {
	label := url.PathEscape(issuer + ":" + account)
	q := url.Values{}
	q.Set("secret", Encode(secret))
	q.Set("issuer", issuer)
	q.Set("algorithm", "SHA1")
	q.Set("digits", fmt.Sprint(Digits))
	q.Set("period", fmt.Sprint(int(Period/time.Second)))
	return "otpauth://totp/" + label + "?" + q.Encode()
}
