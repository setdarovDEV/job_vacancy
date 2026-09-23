// Package random produces cryptographically secure tokens and numeric codes.
package random

import (
	"crypto/rand"
	"encoding/base64"
	"math/big"
	"strings"
)

// Token returns n random bytes encoded as URL-safe base64 without padding.
func Token(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b) // crypto/rand.Read never fails on supported platforms
	return base64.RawURLEncoding.EncodeToString(b)
}

// Digits returns a numeric code of the given length, e.g. "048213".
func Digits(n int) string {
	var sb strings.Builder
	ten := big.NewInt(10)
	for range n {
		d, _ := rand.Int(rand.Reader, ten)
		sb.WriteByte(byte('0' + d.Int64()))
	}
	return sb.String()
}

const base36 = "0123456789abcdefghijklmnopqrstuvwxyz"

// Base36 returns n random lowercase letters/digits, e.g. for slug suffixes.
func Base36(n int) string {
	b := make([]byte, n)
	max := big.NewInt(int64(len(base36)))
	for i := range b {
		d, _ := rand.Int(rand.Reader, max)
		b[i] = base36[d.Int64()]
	}
	return string(b)
}
