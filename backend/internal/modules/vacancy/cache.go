package vacancy

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/platform/respcache"
)

// PublicCache holds the response caches of the public pages (TZ BE-05) and knows which
// of them each write has to drop. Every cache stores the final JSON bytes with an ETag
// and serves stale-while-revalidate; see package respcache.
//
//	cache           fresh (±20%)  stale  invalidated by
//	vacancy_list    30s           60s    Listings generation (any change to published set)
//	vacancy_detail  60s           120s   the vacancy's own writes, its company's changes
//	company         60s           120s   company writes, its vacancies' status changes
//	suggest         5m            5m     Listings generation
//	popular         10m           10m    hiding/unhiding a term
//
// Listing totals are cached apart for 120s (TZ BE-11) and are never invalidated: a count
// that is a minute old is fine, recounting a broad query on every change is not.
type PublicCache struct {
	RDB     *redis.Client
	Log     *slog.Logger
	List    *respcache.Cache
	Detail  *respcache.Cache
	Company *respcache.Cache
	Suggest *respcache.Cache
	Popular *respcache.Cache
	// Listings is bumped whenever the set of published vacancies or anything shown on
	// their cards changes: every listing and suggestion entry turns stale at once.
	Listings *respcache.Generation
	// PopularMinIPs is how many different client IPs must have run a query before it is
	// shown as popular (TZ SEC-07); 0 means 3.
	PopularMinIPs int
}

const totalsTTL = 120 * time.Second

func NewPublicCache(rdb *redis.Client, log *slog.Logger) *PublicCache {
	listings := &respcache.Generation{RDB: rdb, Key: "rc:gen:listings"}
	mk := func(name string, ttl, stale time.Duration, g *respcache.Generation) *respcache.Cache {
		return &respcache.Cache{RDB: rdb, Log: log, Name: name, TTL: ttl, Stale: stale, Gen: g}
	}
	return &PublicCache{
		RDB:      rdb,
		Log:      log,
		List:     mk("vacancy_list", 30*time.Second, time.Minute, listings),
		Detail:   mk("vacancy_detail", time.Minute, 2*time.Minute, nil),
		Company:  mk("company", time.Minute, 2*time.Minute, nil),
		Suggest:  mk("suggest", 5*time.Minute, 5*time.Minute, listings),
		Popular:  mk("popular", 10*time.Minute, 10*time.Minute, nil),
		Listings: listings,
	}
}

// RefKey is the cache key of a page addressed by uuid or slug. Both spellings are
// cached separately and invalidated together (slugs never change).
func RefKey(ref string) string {
	if id, err := uuid.Parse(ref); err == nil {
		return "id:" + id.String()
	}
	return "slug:" + strings.ToLower(ref)
}

func refKeys(id uuid.UUID, slug string) []string {
	return []string{"id:" + id.String(), "slug:" + slug}
}

// listKey hashes the whole filter, cursor and limit included.
func listKey(f Filter) string {
	b, _ := json.Marshal(f) // struct fields marshal in a fixed order
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:12])
}

// totalKey identifies a listing's match count: the filter without paging or ordering.
func totalKey(f Filter) string {
	f.After, f.Limit, f.Sort = nil, 0, ""
	b, _ := json.Marshal(f)
	sum := sha256.Sum256(b)
	return "vacancy:total:" + hex.EncodeToString(sum[:12])
}

// ---- invalidation ------------------------------------------------------------------------

// Writes call these after their transaction committed. They run on a context detached
// from the request (a client hanging up right after the commit must not leave stale
// pages behind), never fail the write, and are safe on a nil *PublicCache.
func (p *PublicCache) detached(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.WithoutCancel(ctx), 2*time.Second)
}

// VacancyRef names a vacancy page and its company's page.
type VacancyRef struct {
	ID          uuid.UUID
	Slug        string
	CompanyID   uuid.UUID
	CompanySlug string
}

// VacancyChanged drops a vacancy's page and its company's page (open vacancy count) and
// marks every listing stale.
func (p *PublicCache) VacancyChanged(ctx context.Context, id uuid.UUID, slug string, companyID uuid.UUID, companySlug string) {
	p.VacanciesChanged(ctx, VacancyRef{ID: id, Slug: slug, CompanyID: companyID, CompanySlug: companySlug})
}

// VacanciesChanged is VacancyChanged for a batch (the expiry job): one pipeline per
// cache and a single generation bump.
func (p *PublicCache) VacanciesChanged(ctx context.Context, refs ...VacancyRef) {
	if p == nil || len(refs) == 0 {
		return
	}
	ctx, cancel := p.detached(ctx)
	defer cancel()
	details := make([]string, 0, 2*len(refs))
	companies := make([]string, 0, 2*len(refs))
	for _, r := range refs {
		details = append(details, refKeys(r.ID, r.Slug)...)
		companies = append(companies, refKeys(r.CompanyID, r.CompanySlug)...)
	}
	p.warn(ctx, "vacancy_detail", p.Detail.Invalidate(ctx, details...))
	p.warn(ctx, "company", p.Company.Invalidate(ctx, companies...))
	p.warn(ctx, "listings", p.Listings.Bump(ctx))
}

// CompanyChanged drops the company's page and the pages of its live vacancies (they show
// its name, logo and verified badge) and marks every listing stale. Call it after a
// profile, logo or verification change, and when a company is blocked or unblocked.
func (p *PublicCache) CompanyChanged(ctx context.Context, q *gen.Queries, c gen.Company) {
	if p == nil {
		return
	}
	ctx, cancel := p.detached(ctx)
	defer cancel()
	p.warn(ctx, "company", p.Company.Invalidate(ctx, refKeys(c.ID, c.Slug)...))
	refs, err := q.ListPublishedVacancyRefs(ctx, c.ID)
	p.warn(ctx, "vacancy refs", err)
	keys := make([]string, 0, 2*len(refs))
	for _, r := range refs {
		keys = append(keys, refKeys(r.ID, r.Slug)...)
	}
	p.warn(ctx, "vacancy_detail", p.Detail.Invalidate(ctx, keys...))
	p.warn(ctx, "listings", p.Listings.Bump(ctx))
}

// ListingsChanged marks every listing and suggestion stale (e.g. a skill was renamed).
func (p *PublicCache) ListingsChanged(ctx context.Context) {
	if p == nil {
		return
	}
	ctx, cancel := p.detached(ctx)
	defer cancel()
	p.warn(ctx, "listings", p.Listings.Bump(ctx))
}

func (p *PublicCache) warn(ctx context.Context, what string, err error) {
	if err != nil {
		p.Log.WarnContext(ctx, "cache invalidation failed; entries expire on their own", "cache", what, "err", err)
	}
}

// ---- listing totals ----------------------------------------------------------------------

func (p *PublicCache) cachedTotal(ctx context.Context, key string) (int, bool) {
	if p == nil {
		return 0, false
	}
	n, err := p.RDB.Get(ctx, key).Int()
	return n, err == nil
}

func (p *PublicCache) storeTotal(ctx context.Context, key string, n int) {
	if p == nil {
		return
	}
	if err := p.RDB.Set(ctx, key, n, totalsTTL).Err(); err != nil {
		p.Log.WarnContext(ctx, "total cache write failed", "err", err)
	}
}
