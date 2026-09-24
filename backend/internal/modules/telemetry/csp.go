package telemetry

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

// CSP violation reports (TZ SEC-03). The web's nonce-based policy and nginx's fallback
// point report-uri / report-to here, so a policy can be tightened in report-only mode first
// and a regression (a blocked script after a deploy) shows up on a dashboard.

var cspViolations = promauto.NewCounterVec(prometheus.CounterOpts{
	Name: "csp_violations_total",
	Help: "Content-Security-Policy violation reports by directive, what was blocked and disposition.",
}, []string{"directive", "blocked", "disposition"})

// knownDirectives keeps the directive label bounded.
var knownDirectives = map[string]bool{
	"default-src": true, "script-src": true, "script-src-elem": true, "script-src-attr": true,
	"style-src": true, "style-src-elem": true, "style-src-attr": true, "img-src": true, "font-src": true,
	"connect-src": true, "media-src": true, "object-src": true, "frame-src": true, "child-src": true,
	"worker-src": true, "manifest-src": true, "form-action": true, "frame-ancestors": true,
	"base-uri": true, "trusted-types": true, "require-trusted-types-for": true, "upgrade-insecure-requests": true,
}

// violation is the part of a report we use (both report formats map onto it).
type violation struct {
	Directive   string
	Blocked     string
	Document    string
	Source      string
	Line        int
	Disposition string
}

type legacyReport struct {
	Body struct {
		DocumentURI        string `json:"document-uri"`
		ViolatedDirective  string `json:"violated-directive"`
		EffectiveDirective string `json:"effective-directive"`
		BlockedURI         string `json:"blocked-uri"`
		SourceFile         string `json:"source-file"`
		LineNumber         int    `json:"line-number"`
		Disposition        string `json:"disposition"`
	} `json:"csp-report"`
}

type reportingAPI struct {
	Type string `json:"type"`
	Body struct {
		DocumentURL        string `json:"documentURL"`
		EffectiveDirective string `json:"effectiveDirective"`
		BlockedURL         string `json:"blockedURL"`
		SourceFile         string `json:"sourceFile"`
		LineNumber         int    `json:"lineNumber"`
		Disposition        string `json:"disposition"`
	} `json:"body"`
}

func parseViolations(body []byte) []violation {
	var out []violation
	trimmed := strings.TrimSpace(string(body))
	if strings.HasPrefix(trimmed, "[") { // application/reports+json
		var reps []reportingAPI
		if json.Unmarshal(body, &reps) != nil {
			return nil
		}
		for _, r := range reps {
			if r.Type != "csp-violation" {
				continue
			}
			b := r.Body
			out = append(out, violation{Directive: b.EffectiveDirective, Blocked: b.BlockedURL, Document: b.DocumentURL,
				Source: b.SourceFile, Line: b.LineNumber, Disposition: b.Disposition})
		}
		return out
	}
	var r legacyReport // application/csp-report
	if json.Unmarshal(body, &r) != nil {
		return nil
	}
	b := r.Body
	d := b.EffectiveDirective
	if d == "" {
		d, _, _ = strings.Cut(b.ViolatedDirective, " ")
	}
	if d == "" && b.BlockedURI == "" {
		return nil
	}
	return append(out, violation{Directive: d, Blocked: b.BlockedURI, Document: b.DocumentURI,
		Source: b.SourceFile, Line: b.LineNumber, Disposition: b.Disposition})
}

// blockedClass reduces the blocked resource to a small set of labels.
func blockedClass(u string) string {
	switch {
	case u == "inline" || u == "eval" || u == "wasm-eval" || u == "trusted-types-policy" || u == "trusted-types-sink":
		return u
	case u == "" || u == "self":
		return "self"
	case strings.HasPrefix(u, "data"):
		return "data"
	case strings.HasPrefix(u, "blob"):
		return "blob"
	case strings.Contains(u, "-extension") || strings.HasPrefix(u, "safari-web-extension"):
		return "extension"
	}
	return "external"
}

// originOf keeps scheme and host only: report URLs may carry tokens in their query.
func originOf(raw string) string {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		if len(raw) > 40 {
			return raw[:40]
		}
		return raw
	}
	return u.Scheme + "://" + u.Host
}

func pathOf(raw string) string {
	if u, err := url.Parse(raw); err == nil {
		return u.Path
	}
	return ""
}

// logBudget allows a few sample log lines a minute, so a broken deploy (every page view
// reporting) doesn't flood the logs; the counter still counts everything.
var logBudget = struct {
	sync.Mutex
	window time.Time
	n      int
}{}

func mayLog() bool {
	logBudget.Lock()
	defer logBudget.Unlock()
	if now := time.Now(); now.Sub(logBudget.window) > time.Minute {
		logBudget.window, logBudget.n = now, 0
	}
	logBudget.n++
	return logBudget.n <= 10
}

func (h *Handler) cspReport(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 16<<10))
	if err != nil {
		response.NoContent(w)
		return
	}
	for _, v := range parseViolations(body) {
		directive := strings.ToLower(v.Directive)
		if !knownDirectives[directive] {
			directive = "other"
		}
		class := blockedClass(v.Blocked)
		disposition := "enforce"
		if v.Disposition == "report" {
			disposition = "report"
		}
		cspViolations.WithLabelValues(directive, class, disposition).Inc()
		if class != "extension" && mayLog() {
			slog.WarnContext(r.Context(), "csp violation", "directive", directive, "blocked", originOf(v.Blocked),
				"page", pathOf(v.Document), "source", originOf(v.Source), "line", v.Line, "disposition", disposition,
				"request_id", reqctx.RequestID(r.Context()))
		}
	}
	response.NoContent(w) // reports are fire-and-forget; never an error for the browser
}
