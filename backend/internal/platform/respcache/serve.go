package respcache

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	requests = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "respcache_requests_total",
		Help: "Response cache lookups by cache and result (hit, stale, miss, error).",
	}, []string{"cache", "result"})
	loadSeconds = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "respcache_load_duration_seconds",
		Help:    "Time to build a response on a miss or refresh.",
		Buckets: []float64{.001, .0025, .005, .01, .025, .05, .1, .25, .5, 1, 3},
	}, []string{"cache"})
	writesSkipped = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "respcache_writes_skipped_total",
		Help: "Loads not stored because the key was invalidated while they ran.",
	}, []string{"cache"})
	notModified = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "respcache_not_modified_total",
		Help: "Conditional requests answered with 304.",
	}, []string{"cache"})
)

// Serve sends a cached response: 304 when If-None-Match matches, otherwise the gzip
// bytes as they are (Content-Encoding: gzip) or, for the rare client without gzip,
// decompressed on the fly.
func (c *Cache) Serve(w http.ResponseWriter, r *http.Request, e *Entry, st Status, cacheControl string) {
	h := w.Header()
	h.Set("ETag", e.ETag)
	h.Set("Cache-Control", cacheControl)
	h.Add("Vary", "Accept-Encoding")
	h.Set("X-Cache", st.String())
	if NoneMatch(r.Header.Get("If-None-Match"), e.ETag) {
		notModified.WithLabelValues(c.Name).Inc()
		w.WriteHeader(http.StatusNotModified)
		return
	}
	h.Set("Content-Type", "application/json; charset=utf-8")
	h.Set("X-Content-Type-Options", "nosniff")
	if AcceptsGzip(r.Header.Get("Accept-Encoding")) {
		h.Set("Content-Encoding", "gzip")
		h.Set("Content-Length", strconv.Itoa(len(e.Gzip)))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(e.Gzip)
		return
	}
	zr, err := gzip.NewReader(bytes.NewReader(e.Gzip))
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, zr)
}

// NoneMatch reports whether an If-None-Match header matches etag (weak comparison,
// RFC 9110 §13.1.2).
func NoneMatch(header, etag string) bool {
	if header == "" {
		return false
	}
	want := strings.TrimPrefix(etag, "W/")
	for _, t := range strings.Split(header, ",") {
		t = strings.TrimSpace(t)
		if t == "*" || strings.TrimPrefix(t, "W/") == want {
			return true
		}
	}
	return false
}

// AcceptsGzip parses Accept-Encoding ("gzip, deflate, br", "gzip;q=0", "*").
func AcceptsGzip(header string) bool {
	for _, part := range strings.Split(header, ",") {
		coding, params, _ := strings.Cut(strings.TrimSpace(part), ";")
		coding = strings.ToLower(strings.TrimSpace(coding))
		if coding != "gzip" && coding != "x-gzip" && coding != "*" {
			continue
		}
		if q, ok := strings.CutPrefix(strings.ReplaceAll(params, " ", ""), "q="); ok {
			if v, err := strconv.ParseFloat(q, 64); err == nil && v == 0 {
				return false
			}
		}
		return true
	}
	return false
}
