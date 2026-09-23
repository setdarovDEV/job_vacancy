// Package slug makes URL-safe identifiers from Uzbek (Latin or Cyrillic), Russian and
// English text: "Backend dasturchi (Go)" → "backend-dasturchi-go",
// "Бош ҳисобчи" → "bosh-hisobchi", "Oʻqituvchi" → "oqituvchi".
package slug

import (
	"strings"

	"jobvacancy.uz/backend/internal/pkg/translit"
)

const maxLen = 80

// Make returns a slug of at most 80 characters; it can be empty for input with no
// letters or digits.
func Make(s string) string {
	out := strings.ReplaceAll(translit.Fold(s), " ", "-")
	if len(out) > maxLen {
		out = strings.TrimRight(out[:maxLen], "-")
	}
	return out
}
