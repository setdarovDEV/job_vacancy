// Package searchq turns a user's search box text into a Postgres full-text query.
//
// Text is folded to Latin (see translit), stop words are removed, and each term is
// lightly stemmed and prefix-matched. Uzbek is agglutinative ("dasturchi", "dasturchilar",
// "dasturchini") and Russian inflects ("программист", "программиста"), so instead of a
// full morphological stemmer we strip common suffixes and trailing vowels from the query
// term and match it as a prefix: "dasturchilar" → dasturch:* matches all of the above.
package searchq

import (
	"strings"

	"jobvacancy.uz/backend/internal/pkg/translit"
)

const maxTerms = 8

type Query struct {
	Folded  string   // whole query folded to Latin, for trigram similarity
	Terms   []string // stemmed terms
	TSQuery string   // for to_tsquery('simple', ...); empty if nothing searchable
}

func (q Query) Empty() bool { return q.TSQuery == "" }

var stopWords = map[string]bool{
	// uz
	"va": true, "bilan": true, "uchun": true, "yoki": true, "ham": true, "boyicha": true,
	// ru (folded)
	"i": true, "v": true, "na": true, "s": true, "dlya": true, "po": true, "ili": true, "bez": true,
	// en
	"and": true, "or": true, "for": true, "the": true, "a": true, "in": true, "of": true, "to": true,
}

// Longest first. Only suffixes that are unlikely to be part of a stem.
var suffixes = []string{"larining", "laridan", "larini", "larning", "lardan", "larga", "larda", "larni", "lari", "lar", "ning", "dagi"}

func Parse(raw string) Query {
	folded := translit.Fold(raw)
	q := Query{Folded: folded}
	var parts []string
	seen := map[string]bool{}
	for _, w := range strings.Fields(folded) {
		if stopWords[w] {
			continue
		}
		t := stem(w)
		if seen[t] {
			continue
		}
		seen[t] = true
		q.Terms = append(q.Terms, t)
		// Terms are [a-z0-9] only after folding, so they can't inject tsquery syntax.
		if len(t) >= 3 {
			parts = append(parts, t+":*")
		} else {
			parts = append(parts, t)
		}
		if len(q.Terms) == maxTerms {
			break
		}
	}
	q.TSQuery = strings.Join(parts, " & ")
	return q
}

func stem(w string) string {
	if len(w) < 5 {
		return w
	}
	for _, s := range suffixes {
		if strings.HasSuffix(w, s) && len(w)-len(s) >= 4 {
			w = w[:len(w)-len(s)]
			break
		}
	}
	for i := 0; i < 2 && len(w) > 4 && strings.ContainsRune("aeiouy", rune(w[len(w)-1])); i++ {
		w = w[:len(w)-1]
	}
	return w
}
