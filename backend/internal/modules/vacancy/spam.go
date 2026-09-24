package vacancy

import (
	"strings"
	"unicode"

	"jobvacancy.uz/backend/internal/pkg/translit"
)

// Queries that never appear in the public "popular searches" list (TZ SEC-07), however
// often they are run: links and contacts (the classic way to advertise through a public
// list), phone numbers, gibberish, and profanity or illegal offers. Admins can hide
// anything else by hand (search_hidden_terms).

// contactMarkers are looked for in the lower-cased raw query (folding drops punctuation).
var contactMarkers = []string{
	"http", "www.", "://", "t.me", "@", ".com", ".ru", ".uz", ".org", ".xyz", ".site",
	".online", ".top", ".club", ".info", ".biz", ".link", // not ".io"/".net": socket.io, .NET
}

// stopRoots are word-start prefixes (a trailing space: a whole word), written as people
// type them and folded at start-up, so Cyrillic and Latin spellings are caught alike
// ("казино" = "kazino"). Words with an innocent job meaning are left out on purpose
// ("ставка" is also a pay rate, "вулкан" starts "вулканизатор").
var stopRoots = foldAll(
	// gambling, adult, drugs, other illegal offers
	"казино", "casino", "1xbet", "mostbet", "melbet", "pin-up", "букмекер", "bukmeker",
	"порн", "porn", "xxx", "секс", "sex", "эскорт", "escort", "интим", "intim",
	"проститу", "prostitu", "шлюх", "наркот", "narkot", "закладк", "zakladk", "гашиш",
	"мефедрон", "кокаин", "cocaine", "героин", "спайс", "обнал", "obnal", "фальшив",
	// profanity
	"хуй", "хуе", "хуё", "пизд", "ебат", "ебан", "ебал", "бляд", "блят", "сука", "мудак",
	"мудил", "пидор", "пидар", "гандон", "залуп", "шалав", "jalab", "qo'toq", "fuck",
	"shit", "bitch",
)

func foldAll(words ...string) []string {
	out := make([]string, 0, len(words))
	for _, w := range words {
		// A trailing space marks a whole word.
		whole := strings.HasSuffix(w, " ")
		f := translit.Fold(w)
		if f == "" {
			continue
		}
		if whole {
			f += " "
		}
		out = append(out, f)
	}
	return out
}

// spamQuery reports whether a normalized query (lower case, single spaces) must stay out
// of the public list.
func spamQuery(q string) bool {
	for _, m := range contactMarkers {
		if strings.Contains(q, m) {
			return true
		}
	}
	digits, run, last := 0, 0, rune(0)
	for _, r := range q {
		if unicode.IsDigit(r) {
			digits++
		}
		if r == last {
			run++
			if run >= 4 { // "aaaa", "!!!!"
				return true
			}
		} else {
			run, last = 1, r
		}
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) && !strings.ContainsRune(" -+#.'’ʻʼ`/&", r) {
			return true // emoji, symbols, markup
		}
	}
	if digits >= 5 { // phone numbers, card numbers, ids
		return true
	}
	folded := translit.Fold(q)
	words := strings.Fields(folded)
	if len(words) == 0 || len(words) > 6 {
		return true
	}
	for _, w := range words {
		if len([]rune(w)) > 25 {
			return true
		}
	}
	padded := " " + folded + " "
	for _, root := range stopRoots {
		if strings.Contains(padded, " "+root) {
			return true
		}
	}
	return false
}

// hiddenBy reports whether any hidden term (already folded) occurs in the folded query as
// a run of whole words: hiding "kazino" hides "onlayn kazino" but not "kazinochi" (that is
// what the stop roots are for), and hiding "a" hides nothing longer.
func hiddenBy(foldedQuery string, terms []string) bool {
	padded := " " + foldedQuery + " "
	for _, t := range terms {
		if t != "" && strings.Contains(padded, " "+t+" ") {
			return true
		}
	}
	return false
}
