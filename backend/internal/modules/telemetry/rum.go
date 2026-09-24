// Package telemetry receives what browsers report about the site: real-user Web Vitals
// (TZ FE-06) and Content-Security-Policy violations (TZ SEC-03). Both become Prometheus
// series with bounded labels; nothing is stored.
package telemetry

import (
	"encoding/json"
	"io"
	"math"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/isbot"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

const maxBody = 8 << 10 // a beacon carries a handful of numbers

// Web Vitals histograms by page route (TZ FE-06). Grafana reads p75 per route, e.g.
// histogram_quantile(0.75, sum by (le, route) (rate(web_vitals_lcp_seconds_bucket[1h]))).
// Buckets straddle Google's good/poor thresholds (LCP 2.5/4 s, INP 0.2/0.5 s, CLS
// 0.1/0.25, FCP 1.8/3 s, TTFB 0.8/1.8 s).
var (
	vitals = map[string]*prometheus.HistogramVec{
		"LCP": hist("web_vitals_lcp_seconds", "Largest Contentful Paint.", []float64{.5, 1, 1.5, 2, 2.5, 3, 4, 6, 10}),
		"INP": hist("web_vitals_inp_seconds", "Interaction to Next Paint.", []float64{.05, .1, .15, .2, .3, .5, .75, 1, 2}),
		"CLS": hist("web_vitals_cls", "Cumulative Layout Shift (unitless).", []float64{.01, .025, .05, .1, .15, .25, .5, 1}),
		"FCP": hist("web_vitals_fcp_seconds", "First Contentful Paint.", []float64{.3, .6, 1, 1.4, 1.8, 2.4, 3, 5}),
		"TTFB": hist("web_vitals_ttfb_seconds", "Time to First Byte of the document.",
			[]float64{.05, .1, .2, .4, .8, 1.2, 1.8, 3}),
	}
	// Plausible upper bounds; anything above is a bogus or broken report.
	ceilings = map[string]float64{"LCP": 60, "INP": 60, "CLS": 20, "FCP": 60, "TTFB": 60}

	rumReports = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "rum_reports_total",
		Help: "Web Vitals beacons by result (ok, invalid, bot).",
	}, []string{"result"})
)

func hist(name, help string, buckets []float64) *prometheus.HistogramVec {
	return promauto.NewHistogramVec(prometheus.HistogramOpts{Name: name, Help: help, Buckets: buckets}, []string{"route"})
}

// Metric is one web-vitals measurement: LCP, INP, FCP and TTFB in milliseconds (as the
// web-vitals library reports them), CLS unitless.
type Metric struct {
	Name  string  `json:"name"`
	Value float64 `json:"value"`
}

// Report is a beacon: the page's route pattern and one or more metrics. A single metric
// may also be sent flat ({"route","name","value"}).
type Report struct {
	Route   string   `json:"route"`
	Metrics []Metric `json:"metrics"`
	Name    string   `json:"name"`
	Value   float64  `json:"value"`
}

type Handler struct{}

// Routes are public (browsers post with navigator.sendBeacon, no credentials).
func (h *Handler) Routes(r chi.Router) {
	r.Post("/rum", h.rum)
	r.Post("/csp-report", h.cspReport)
}

func (h *Handler) rum(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if isbot.Match(r.UserAgent()) {
		rumReports.WithLabelValues("bot").Inc()
		response.NoContent(w)
		return
	}
	// sendBeacon posts text/plain unless given a typed Blob; both carry JSON.
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBody))
	var rep Report
	if err == nil {
		err = json.Unmarshal(body, &rep)
	}
	if err != nil {
		rumReports.WithLabelValues("invalid").Inc()
		response.Error(w, r, apperr.BadRequest("invalid_request", "expected a JSON web-vitals report"))
		return
	}
	if rep.Name != "" {
		rep.Metrics = append(rep.Metrics, Metric{Name: rep.Name, Value: rep.Value})
	}
	if len(rep.Metrics) == 0 || len(rep.Metrics) > 10 {
		rumReports.WithLabelValues("invalid").Inc()
		response.Error(w, r, apperr.Validation(map[string]string{"metrics": "1..10"}))
		return
	}
	route := NormalizeRoute(rep.Route)
	accepted := 0
	for _, m := range rep.Metrics {
		name := strings.ToUpper(strings.TrimSpace(m.Name))
		h, ok := vitals[name]
		if !ok || math.IsNaN(m.Value) || m.Value < 0 || m.Value > ceilingIn(name) {
			continue
		}
		v := m.Value
		if name != "CLS" {
			v /= 1000 // ms → s
		}
		h.WithLabelValues(route).Observe(v)
		accepted++
	}
	result := "ok"
	if accepted == 0 {
		result = "invalid"
	}
	rumReports.WithLabelValues(result).Inc()
	response.NoContent(w)
}

// ceilingIn is the bound in the unit the value arrives in.
func ceilingIn(name string) float64 {
	if name == "CLS" {
		return ceilings[name]
	}
	return ceilings[name] * 1000
}
