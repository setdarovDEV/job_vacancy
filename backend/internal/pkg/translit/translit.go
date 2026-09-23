// Package translit folds Uzbek (Latin and Cyrillic), Russian and English text into one
// lowercase Latin form, so a vacancy written in any script is found by a query typed in
// any other: "Дастурчи", "dasturchi" and "Dasturchi" all become "dasturchi";
// "Программист" becomes "programmist".
package translit

import (
	"strings"
	"unicode"
)

// Uzbek Cyrillic letters map to the official Latin alphabet (without apostrophes);
// Russian-only letters use the common Uzbek-style transliteration.
var cyrillic = map[rune]string{
	'а': "a", 'б': "b", 'в': "v", 'г': "g", 'д': "d", 'е': "e", 'ё': "yo", 'ж': "j",
	'з': "z", 'и': "i", 'й': "y", 'к': "k", 'л': "l", 'м': "m", 'н': "n", 'о': "o",
	'п': "p", 'р': "r", 'с': "s", 'т': "t", 'у': "u", 'ф': "f", 'х': "x", 'ц': "ts",
	'ч': "ch", 'ш': "sh", 'щ': "sh", 'ъ': "", 'ы': "i", 'ь': "", 'э': "e", 'ю': "yu",
	'я': "ya", 'ў': "o", 'қ': "q", 'ғ': "g", 'ҳ': "h",
}

// Apostrophe-like marks inside Uzbek words (oʻ, gʻ, taʼlim) are dropped, not split on.
func IsApostrophe(r rune) bool {
	switch r {
	case '\'', 'ʻ', 'ʼ', '‘', '’', '`', 'ʹ':
		return true
	}
	return false
}

// Rune reports how r folds: its Latin replacement, and whether r is a word character.
func Rune(r rune) (string, bool) {
	switch {
	case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
		return string(r), true
	case IsApostrophe(r):
		return "", true
	}
	if s, ok := cyrillic[r]; ok {
		return s, true
	}
	switch r {
	case '+':
		return "plus", true
	case '#':
		return "sharp", true
	}
	return "", false
}

// Fold lowercases and transliterates s, replacing every run of non-word characters with
// a single space. Letters of other scripts are dropped.
func Fold(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	space := true // suppress leading space
	for _, r := range strings.ToLower(s) {
		out, word := Rune(r)
		switch {
		case word:
			b.WriteString(out)
			space = false
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			// foreign script: skip
		case !space:
			b.WriteByte(' ')
			space = true
		}
	}
	return strings.TrimRight(b.String(), " ")
}
