package middleware

import (
	"net/http"
	"net/url"
	"strings"
	"unicode/utf8"

	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

var errBadURL = apperr.BadRequest("invalid_request", "the URL contains a NUL byte or invalid UTF-8")

// RejectBadURL answers 400 when the path or query carries a NUL byte or invalid UTF-8.
// Postgres refuses such text ("invalid byte sequence for encoding UTF8: 0x00"), so they
// used to surface as 500s from slug lookups and searches and trip the 5xx alert.
func RejectBadURL(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if badText(r.URL.Path) || badQuery(r.URL.RawQuery) {
			response.Error(w, r, errBadURL)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func badText(s string) bool { return strings.IndexByte(s, 0) >= 0 || !utf8.ValidString(s) }

// badQuery checks every decoded key and value the way url.ParseQuery splits them; pairs
// with malformed escapes are skipped (ParseQuery drops them too). A plain query without
// escapes costs one scan.
func badQuery(raw string) bool {
	if !strings.Contains(raw, "%") {
		return badText(raw)
	}
	for pair := range strings.SplitSeq(raw, "&") {
		for part := range strings.SplitSeq(pair, "=") {
			s, err := url.QueryUnescape(part)
			if err == nil && badText(s) {
				return true
			}
		}
	}
	return false
}
