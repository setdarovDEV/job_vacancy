package middleware

import "net/http"

// apiCSP matches nginx's policy for /api/ (nginx/conf.d/00-maps.conf): a JSON response
// may not render, frame or load anything. Identical values keep the duplicate header
// nginx adds in production harmless (both policies are enforced and they agree).
const apiCSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"

// SecurityHeaders sets the headers that belong to the API itself (TZ SEC-03), so they
// hold with or without nginx in front (dev, staging, a misrouted request):
//
//   - X-Content-Type-Options: nosniff and a deny-all CSP: API bodies are data, never a
//     document or a script, whatever a browser guesses;
//   - Cross-Origin-Resource-Policy: same-site: other sites can't embed or read API
//     responses through no-cors requests (<img>, <script>);
//   - X-Robots-Tag: noindex: the JSON API never ends up in search results;
//   - Cache-Control: no-store on responses to signed-in requests unless the handler chose
//     a policy (it overwrites this default): personal data isn't kept by the browser's
//     disk cache or any shared cache on the way.
//
// HSTS, Referrer-Policy, Permissions-Policy and the pages' CSP are set by nginx and the
// SSR server, which own TLS and HTML.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Content-Security-Policy", apiCSP)
		h.Set("Cross-Origin-Resource-Policy", "same-site")
		h.Set("X-Robots-Tag", "noindex")
		if r.Header.Get("Authorization") != "" || hasCookie(r, "jv_refresh") {
			h.Set("Cache-Control", "no-store")
		}
		next.ServeHTTP(w, r)
	})
}

func hasCookie(r *http.Request, name string) bool {
	_, err := r.Cookie(name)
	return err == nil
}
