package resume

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/ratelimit"
)

// PDF export cache (TZ BE-13). A rendered PDF is stored in the private bucket under a key
// derived from everything it shows, the resume's updated_at included: the resume id, a
// hash of the viewer's view of it (contacts are shown only to some viewers) and the
// label language. Any change to the resume, the owner's name or contacts, or the layout
// version gives a new key, so a stale PDF is never served; old copies expire through the
// bucket's lifecycle rule (storage.EnsureBuckets) and account deletion removes them at
// once. Rendering is limited per user; cached copies are not.

// pdfLayout changes whenever RenderPDF's output changes, so old copies aren't reused.
const pdfLayout = "2"

// PDFPrefix is where cached PDFs live in the private bucket (one folder per resume).
const PDFPrefix = "resume-pdf/"

var pdfRule = ratelimit.Rule{Name: "resume_pdf", Limit: 10, Window: time.Minute}

var pdfRequests = promauto.NewCounterVec(prometheus.CounterOpts{
	Name: "resume_pdf_requests_total",
	Help: "Resume PDF exports by result (hit: served from storage, miss: rendered).",
}, []string{"result"})

// PDFStore is the private object storage (storage.Storage).
type PDFStore interface {
	Get(ctx context.Context, bucket, key string, max int64) ([]byte, error)
	Put(ctx context.Context, bucket, key string, data []byte, contentType, cacheControl string) error
	PrivateBucket() string
}

// PDFCache serves rendered PDFs from object storage.
type PDFCache struct {
	Store   PDFStore
	Limiter *ratelimit.Limiter // nil: renders are not limited
	Log     *slog.Logger
}

// pdfKey names the PDF of d in lang as seen by this viewer.
func pdfKey(d Detail, lang string) (key, etag string) {
	view := d
	view.IsOwner = false // not printed; owner and others with the same contacts share a copy
	b, _ := json.Marshal(view)
	h := sha256.New()
	h.Write([]byte(pdfLayout + "\x00" + lang + "\x00" + d.UpdatedAt.UTC().Format(time.RFC3339Nano) + "\x00"))
	h.Write(b)
	sum := hex.EncodeToString(h.Sum(nil)[:16])
	return PDFPrefix + d.ID.String() + "/" + lang + "-" + sum + ".pdf", `"` + sum + `"`
}

const maxPDF = 8 << 20

// PDF returns the PDF of d, from storage when this exact version was rendered before.
func (c *PDFCache) PDF(ctx context.Context, userKey string, d Detail, lang string, render func() ([]byte, error)) (pdf []byte, etag string, hit bool, err error) {
	key, etag := pdfKey(d, lang)
	if c != nil && c.Store != nil {
		if b, err := c.Store.Get(ctx, c.Store.PrivateBucket(), key, maxPDF); err == nil && bytes.HasPrefix(b, []byte("%PDF")) {
			pdfRequests.WithLabelValues("hit").Inc()
			return b, etag, true, nil
		}
		if c.Limiter != nil {
			if ok, retry, _ := c.Limiter.Allow(ctx, pdfRule, userKey); !ok {
				return nil, "", false, apperr.TooManyRequests(int(retry.Seconds()) + 1)
			}
		}
	}
	b, err := render()
	if err != nil {
		return nil, "", false, err
	}
	pdfRequests.WithLabelValues("miss").Inc()
	if c != nil && c.Store != nil {
		// Stored before answering: the next request is a hit even if this client leaves.
		sctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		if err := c.Store.Put(sctx, c.Store.PrivateBucket(), key, b, "application/pdf", "private, no-store"); err != nil {
			c.Log.WarnContext(ctx, "resume pdf not cached", "resume_id", d.ID, "err", err)
		}
	}
	return b, etag, false, nil
}
