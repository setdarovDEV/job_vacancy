package telemetry

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	dto "github.com/prometheus/client_model/go"
)

const browserUA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36"

func samples(t *testing.T, name, route string) (uint64, float64) {
	t.Helper()
	var m dto.Metric
	if err := vitals[name].WithLabelValues(route).(prometheus.Histogram).Write(&m); err != nil {
		t.Fatal(err)
	}
	return m.GetHistogram().GetSampleCount(), m.GetHistogram().GetSampleSum()
}

func post(r http.Handler, path, ctype, ua, body string) int {
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set("Content-Type", ctype)
	req.Header.Set("User-Agent", ua)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec.Code
}

func router() http.Handler {
	r := chi.NewRouter()
	(&Handler{}).Routes(r)
	return r
}

// TZ FE-06: a web-vitals beacon lands in per-route histograms (ms → s; CLS as is), with
// the route label limited to the web's known patterns.
func TestRUMBeacon(t *testing.T) {
	r := router()
	lcp0, _ := samples(t, "LCP", "/vacancies/:slug")
	cls0, clsSum0 := samples(t, "CLS", "/vacancies/:slug")
	inp0, inpSum0 := samples(t, "INP", "/vacancies/:slug")

	// sendBeacon posts text/plain; the route may carry the language segment.
	body := `{"route":"/:lang?/vacancies/:slug","metrics":[{"name":"LCP","value":1830},{"name":"CLS","value":0.04},{"name":"INP","value":96}]}`
	if code := post(r, "/rum", "text/plain;charset=UTF-8", browserUA, body); code != http.StatusNoContent {
		t.Fatalf("beacon: %d", code)
	}
	if n, _ := samples(t, "LCP", "/vacancies/:slug"); n != lcp0+1 {
		t.Fatalf("LCP samples %d, want %d", n, lcp0+1)
	}
	if n, sum := samples(t, "CLS", "/vacancies/:slug"); n != cls0+1 || sum-clsSum0 < 0.039 || sum-clsSum0 > 0.041 {
		t.Fatalf("CLS: %d samples, +%v", n, sum-clsSum0)
	}
	if n, sum := samples(t, "INP", "/vacancies/:slug"); n != inp0+1 || sum-inpSum0 < 0.0959 || sum-inpSum0 > 0.0961 {
		t.Fatalf("INP: %d samples, +%v s (want 0.096)", n, sum-inpSum0)
	}

	// A flat single metric on an unknown route counts as "other"; no new label.
	other0, _ := samples(t, "TTFB", "other")
	if code := post(r, "/rum", "application/json", browserUA, `{"route":"/wp-admin/x","name":"TTFB","value":210}`); code != 204 {
		t.Fatalf("flat beacon: %d", code)
	}
	if n, _ := samples(t, "TTFB", "other"); n != other0+1 {
		t.Fatal("unknown route not folded into other")
	}
	if got := testutil.CollectAndCount(vitals["TTFB"]); got > len(pageRoutes)+1 {
		t.Fatalf("%d TTFB series", got)
	}

	// Bogus values, unknown metrics, bots and junk are not recorded.
	lcp1, _ := samples(t, "LCP", "/")
	post(r, "/rum", "application/json", browserUA, `{"route":"/","metrics":[{"name":"LCP","value":-5},{"name":"LCP","value":9e9},{"name":"XYZ","value":1}]}`)
	post(r, "/rum", "application/json", "Googlebot/2.1 (+http://www.google.com/bot.html)", `{"route":"/","name":"LCP","value":900}`)
	if n, _ := samples(t, "LCP", "/"); n != lcp1 {
		t.Fatal("invalid or bot measurements were recorded")
	}
	if code := post(r, "/rum", "application/json", browserUA, `not json`); code != http.StatusBadRequest {
		t.Fatalf("junk: %d", code)
	}
	if code := post(r, "/rum", "application/json", browserUA, `{"route":"/","metrics":[]}`); code != http.StatusUnprocessableEntity {
		t.Fatalf("empty: %d", code)
	}
	if code := post(r, "/rum", "application/json", browserUA, `{"route":"/","name":"LCP","value":1,"pad":"`+strings.Repeat("x", 9000)+`"}`); code != http.StatusBadRequest {
		t.Fatalf("oversized: %d", code)
	}
}

func TestNormalizeRoute(t *testing.T) {
	for in, want := range map[string]string{
		"/": "/", "": "/", "/:lang?": "/", "/:lang?/": "/", "/companies/:slug/": "/companies/:slug",
		"/:lang?/chat/:id?": "/chat/:id?", "/*": "*", "/admin/reports": "/admin", "/vacancies/123": "other",
		strings.Repeat("/a", 80): "other",
	} {
		if got := NormalizeRoute(in); got != want {
			t.Errorf("NormalizeRoute(%q) = %q, want %q", in, got, want)
		}
	}
}

// TZ SEC-03: CSP reports in both formats are counted with bounded labels.
func TestCSPReports(t *testing.T) {
	r := router()
	c := func(d, b, disp string) float64 { return testutil.ToFloat64(cspViolations.WithLabelValues(d, b, disp)) }
	inline0, ext0, extn0 := c("script-src-elem", "inline", "enforce"), c("img-src", "external", "report"), c("other", "extension", "enforce")

	legacy := `{"csp-report":{"document-uri":"https://jobvacancy.uz/vacancies/x?token=secret","violated-directive":"script-src-elem",
		"effective-directive":"script-src-elem","blocked-uri":"inline","line-number":12,"disposition":"enforce"}}`
	if code := post(r, "/csp-report", "application/csp-report", browserUA, legacy); code != 204 {
		t.Fatalf("legacy: %d", code)
	}
	reporting := `[{"type":"csp-violation","body":{"documentURL":"https://jobvacancy.uz/","effectiveDirective":"img-src",
		"blockedURL":"https://tracker.example/p.gif?u=1","disposition":"report"}},
		{"type":"csp-violation","body":{"effectiveDirective":"made-up-src","blockedURL":"chrome-extension://abc/x.js"}},
		{"type":"deprecation","body":{}}]`
	if code := post(r, "/csp-report", "application/reports+json", browserUA, reporting); code != 204 {
		t.Fatalf("reporting API: %d", code)
	}
	if c("script-src-elem", "inline", "enforce") != inline0+1 || c("img-src", "external", "report") != ext0+1 ||
		c("other", "extension", "enforce") != extn0+1 {
		t.Fatal("violations not counted as expected")
	}
	if code := post(r, "/csp-report", "application/csp-report", browserUA, `garbage`); code != 204 {
		t.Fatalf("garbage: %d", code)
	}
}
