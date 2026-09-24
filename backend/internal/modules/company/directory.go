package company

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"log/slog"
	"math"
	"math/rand/v2"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/redis/go-redis/v9"
	"golang.org/x/sync/singleflight"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/cursor"
)

// DirectoryPerPage is the company directory page size.
const DirectoryPerPage = 24

const (
	anchorsTTL         = 3 * time.Minute // numbered pages may lag ranking changes this long
	anchorsLoadTimeout = 3 * time.Second
	anchorsKeyPrefix   = "company:dir:v1:"
)

var anchorLookups = promauto.NewCounterVec(prometheus.CounterOpts{
	Name: "company_directory_anchors_total",
	Help: "Company directory page-anchor lookups by result (hit, miss, error).",
}, []string{"result"})

// DirKey is a position in directory order: verified companies first, then by open
// vacancies (descending), name, id. It is the key of companies_directory_idx.
type DirKey struct {
	Unverified bool      `json:"u"`
	NegOpen    int32     `json:"o"`
	Name       string    `json:"n"`
	ID         uuid.UUID `json:"i"`
}

// dirStart sorts before every company, so the first page is the same index range scan as
// every other page.
var dirStart = DirKey{Unverified: false, NegOpen: math.MinInt32}

func keyOf(c gen.Company) DirKey {
	return DirKey{Unverified: c.VerifiedAt == nil, NegOpen: -c.OpenVacancies, Name: c.Name, ID: c.ID}
}

// Anchors describe numbered pages of one directory listing (one search term).
type Anchors struct {
	Total int64
	// starts[p] is the key the page p+2 seeks from (the last row of page p+1).
	starts []DirKey
}

// PageCount is the number of pages of DirectoryPerPage rows.
func (a Anchors) PageCount() int64 {
	return (a.Total + DirectoryPerPage - 1) / DirectoryPerPage
}

// Start returns the key page (1-based) seeks from; ok is false past the last page.
func (a Anchors) Start(page int64) (DirKey, bool) {
	if page <= 1 {
		return dirStart, true
	}
	i := page - 2
	if i >= int64(len(a.starts)) {
		return DirKey{}, false
	}
	return a.starts[i], true
}

// Directory serves the public company directory with keyset pages. Numbered pages
// (?page=N) seek from cached page anchors instead of skipping rows with OFFSET (TZ BE-03):
// one ordered pass over the index computes the key of every page boundary and the total,
// cached in Redis for a few minutes per search term.
type Directory struct {
	Q   *gen.Queries
	RDB *redis.Client // nil: anchors are computed per request (tests)
	Log *slog.Logger

	group singleflight.Group
}

// DirPage is one page of the directory.
type DirPage struct {
	Companies []gen.Company
	Next      *DirKey // set when more rows follow
}

// List returns up to DirectoryPerPage companies after key.
func (d *Directory) List(ctx context.Context, q *string, after DirKey) (DirPage, error) {
	rows, err := d.Q.ListCompaniesDirectory(ctx, gen.ListCompaniesDirectoryParams{
		AfterUnverified: after.Unverified, AfterNegOpen: after.NegOpen, AfterName: after.Name, AfterID: after.ID,
		Q: q, MaxResults: DirectoryPerPage + 1,
	})
	if err != nil {
		return DirPage{}, err
	}
	out := DirPage{Companies: make([]gen.Company, 0, min(len(rows), DirectoryPerPage))}
	for i, r := range rows {
		if i == DirectoryPerPage {
			k := keyOf(out.Companies[i-1])
			out.Next = &k
			break
		}
		out.Companies = append(out.Companies, r.Company)
	}
	return out, nil
}

// Anchors returns the page anchors of a listing: one HGETALL-free Redis round trip on a
// hit (only the requested page's anchor and the total are read), one index pass on a miss.
// Redis errors fall back to computing the anchors.
func (d *Directory) Anchors(ctx context.Context, q *string, page int64) (Anchors, error) {
	if d.RDB == nil {
		return d.loadAnchors(ctx, q)
	}
	key := anchorsKey(q)
	field := "p" + strconv.FormatInt(page, 10)
	vals, err := d.RDB.HMGet(ctx, key, "total", field).Result()
	if err == nil && vals[0] != nil {
		a, ok := decodeCached(vals, page)
		if ok {
			anchorLookups.WithLabelValues("hit").Inc()
			return a, nil
		}
	}
	if err != nil && !errors.Is(err, redis.Nil) {
		anchorLookups.WithLabelValues("error").Inc()
		d.logWarn(ctx, "directory anchors read", err)
	} else {
		anchorLookups.WithLabelValues("miss").Inc()
	}
	// Share one build per instance; it runs detached from the caller (TZ BE-01) so a
	// client that goes away doesn't fail the others waiting for it.
	ch := d.group.DoChan(key, func() (any, error) {
		lctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), anchorsLoadTimeout)
		defer cancel()
		a, err := d.loadAnchors(lctx, q)
		if err != nil {
			return a, err
		}
		d.store(lctx, key, a)
		return a, nil
	})
	select {
	case <-ctx.Done():
		return Anchors{}, ctx.Err()
	case res := <-ch:
		if res.Err != nil {
			return Anchors{}, res.Err
		}
		return res.Val.(Anchors), nil
	}
}

func (d *Directory) loadAnchors(ctx context.Context, q *string) (Anchors, error) {
	rows, err := d.Q.CompanyDirectoryAnchors(ctx, gen.CompanyDirectoryAnchorsParams{Q: q, Per: DirectoryPerPage})
	if err != nil {
		return Anchors{}, err
	}
	var a Anchors
	for _, r := range rows {
		a.Total = r.Total
		if r.Rn%DirectoryPerPage == 0 && r.Rn < r.Total {
			a.starts = append(a.starts, DirKey{Unverified: r.Unverified, NegOpen: r.NegOpen, Name: r.Name, ID: r.ID})
		}
	}
	return a, nil
}

// store writes the anchors as one hash (total + one field per page) with a jittered TTL.
func (d *Directory) store(ctx context.Context, key string, a Anchors) {
	fields := make([]any, 0, 2+2*len(a.starts))
	fields = append(fields, "total", a.Total)
	for i, k := range a.starts {
		fields = append(fields, "p"+strconv.Itoa(i+2), cursor.Encode(k))
	}
	ttl := time.Duration(float64(anchorsTTL) * (0.8 + 0.4*rand.Float64()))
	_, err := d.RDB.TxPipelined(ctx, func(p redis.Pipeliner) error {
		p.Del(ctx, key)
		p.HSet(ctx, key, fields...)
		p.PExpire(ctx, key, ttl)
		return nil
	})
	if err != nil {
		d.logWarn(ctx, "directory anchors write", err)
	}
}

// decodeCached rebuilds the part of Anchors a request needs from HMGET total, p<page>.
func decodeCached(vals []any, page int64) (Anchors, bool) {
	total, err := strconv.ParseInt(toString(vals[0]), 10, 64)
	if err != nil {
		return Anchors{}, false
	}
	a := Anchors{Total: total}
	if page <= 1 || page > a.PageCount() {
		return a, true
	}
	var k DirKey
	if vals[1] == nil || cursor.Decode(toString(vals[1]), &k) != nil {
		return Anchors{}, false
	}
	a.starts = make([]DirKey, page-1)
	a.starts[page-2] = k
	return a, true
}

func toString(v any) string {
	s, _ := v.(string)
	return s
}

func (d *Directory) logWarn(ctx context.Context, msg string, err error) {
	if d.Log != nil {
		d.Log.WarnContext(ctx, msg, "err", err)
	}
}

func anchorsKey(q *string) string {
	if q == nil {
		return anchorsKeyPrefix + "all"
	}
	h := sha256.Sum256([]byte(*q))
	return anchorsKeyPrefix + "q:" + hex.EncodeToString(h[:12])
}

// likePattern lower-cases a search term and escapes LIKE wildcards, so "50%" or "a_b"
// match literally.
func likePattern(s string) string {
	s = strings.ToLower(s)
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}
