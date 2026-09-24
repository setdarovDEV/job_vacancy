package telemetry

import "strings"

// pageRoutes are the web's route patterns (web/app/routes.ts) without the optional
// language segment. Metrics are labelled only with these, so a client can't create new
// Prometheus series; anything else counts as "other". Add new pages here.
var pageRoutes = func() map[string]bool {
	m := map[string]bool{}
	for _, r := range []string{
		"/", "/login", "/register", "/verify-email", "/forgot-password",
		"/vacancies", "/vacancies/:slug", "/companies", "/companies/:slug", "/employers",
		"/about", "/contacts", "/privacy", "/terms",
		"/me", "/me/resumes", "/me/resumes/new", "/me/resumes/:id/edit", "/me/applications",
		"/me/applications/:id", "/me/saved", "/me/searches", "/me/notifications", "/me/invites",
		"/employer", "/employer/company", "/employer/vacancies/new", "/employer/vacancies/:id/edit",
		"/employer/vacancies/:id/applications", "/employer/applications/:id", "/employer/candidates",
		"/resumes/:id", "/admin", "/chat/:id?", "/ui", "*",
	} {
		m[r] = true
	}
	return m
}()

// NormalizeRoute maps what the page sent to a known pattern or "other". It accepts the
// pattern with or without the ":lang?" prefix and a trailing slash.
func NormalizeRoute(r string) string {
	r = strings.TrimSpace(r)
	if len(r) > 100 {
		return "other"
	}
	r = strings.TrimPrefix(r, "/:lang?")
	if r == "" {
		r = "/"
	}
	if len(r) > 1 {
		r = strings.TrimSuffix(r, "/")
	}
	if r == "/*" {
		r = "*"
	}
	if pageRoutes[r] {
		return r
	}
	if strings.HasPrefix(r, "/admin/") { // admin sections share one label
		return "/admin"
	}
	return "other"
}
