// Package phone normalizes phone numbers to E.164.
package phone

import (
	"errors"
	"strings"
)

var ErrInvalid = errors.New("phone: invalid number")

// Normalize accepts common spellings ("+998 90 123-45-67", "998901234567", "90 123 45 67")
// and returns E.164 ("+998901234567"). Bare 9-digit numbers are treated as Uzbek.
func Normalize(raw string) (string, error) {
	var digits strings.Builder
	for _, r := range raw {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
		}
	}
	d := digits.String()
	switch {
	case len(d) == 9: // local Uzbek number without country code
		d = "998" + d
	case strings.HasPrefix(d, "00"):
		d = d[2:]
	}
	if len(d) < 8 || len(d) > 15 || d[0] == '0' {
		return "", ErrInvalid
	}
	if strings.HasPrefix(d, "998") && len(d) != 12 {
		return "", ErrInvalid
	}
	return "+" + d, nil
}
