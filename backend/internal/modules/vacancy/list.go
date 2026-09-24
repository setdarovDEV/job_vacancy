package vacancy

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/company"
	"jobvacancy.uz/backend/internal/pkg/cursor"
	"jobvacancy.uz/backend/internal/pkg/imgurl"
	"jobvacancy.uz/backend/internal/pkg/searchq"
	"jobvacancy.uz/backend/internal/pkg/sqlb"
)

type cursorKey = cursor.TimeID

func encodeCursor(k any) string { return cursor.Encode(k) }

const (
	SortNewest    = "newest"
	SortRelevance = "relevance"
	// Counting every match of a broad query is expensive; beyond this we report "1000+".
	totalCap = 1000
)

// Filter holds the public listing filters. Empty fields don't filter.
type Filter struct {
	Query           searchq.Query `json:"q"`
	Sort            string        `json:"sort"`
	CategoryID      *int32        `json:"category_id,omitempty"`
	RegionID        *int32        `json:"region_id,omitempty"`
	DistrictID      *int32        `json:"district_id,omitempty"`
	CompanyID       *uuid.UUID    `json:"company_id,omitempty"`
	EmploymentTypes []string      `json:"employment_type,omitempty"`
	WorkFormats     []string      `json:"work_format,omitempty"`
	Experiences     []string      `json:"experience,omitempty"`
	Schedules       []string      `json:"schedule,omitempty"`
	SalaryFrom      *int64        `json:"salary_from,omitempty"`
	Currency        string        `json:"currency,omitempty"`
	WithSalary      bool          `json:"with_salary,omitempty"`
	After           *listCursor   `json:"after,omitempty"`
	Limit           int           `json:"limit"`
	// PublishedAfter keeps only vacancies published later (saved-search alerts).
	PublishedAfter *time.Time `json:"published_after,omitempty"`
	// Fuzzy switches matching from full-text to typo-tolerant title similarity. It is set
	// internally when the exact search finds nothing, and carried in the cursor.
	Fuzzy bool `json:"fuzzy,omitempty"`
	// SkipTotal leaves meta.total out (saved-search alerts don't need the count).
	SkipTotal bool `json:"-"`
}

// listCursor is the keyset position. For relevance it also freezes the reference time
// used by the freshness boost, so scores don't drift between pages.
type listCursor struct {
	Sort  string    `json:"o"`
	T     time.Time `json:"t,omitzero"`
	Score float64   `json:"s,omitempty"`
	Ref   time.Time `json:"r,omitzero"`
	Fuzzy bool      `json:"f,omitempty"`
	ID    uuid.UUID `json:"i"`
}

// ListResult is one page of the public listing (also the cached value).
type ListResult struct {
	Cards       []Card  `json:"cards"`
	NextCursor  *string `json:"next_cursor"`
	Total       *int    `json:"total,omitempty"`
	TotalCapped bool    `json:"total_capped,omitempty"`
	// Fuzzy tells the UI that results are approximate ("showing similar results").
	Fuzzy bool `json:"fuzzy,omitempty"`
}

const cardColumns = `v.id, v.slug, v.title, v.category_id, v.region_id, v.district_id,
	v.salary_min, v.salary_max, v.currency, v.employment_type, v.work_format,
	v.experience, v.schedule, v.is_featured, v.views_count, v.applications_count,
	v.published_at, v.expires_at, v.created_at,
	c.id AS c_id, c.name AS c_name, c.slug AS c_slug, c.logo_url AS c_logo, c.verified_at IS NOT NULL AS c_verified`

// List returns published vacancies. With a text query results are ordered by relevance
// (full-text rank, weighted title > skills/company > catalog names > description, plus
// featured and freshness boosts); if nothing matches exactly, a typo-tolerant title
// search runs instead. Without a query: newest first. Both use keyset pagination.
//
// The SQL is built dynamically (rather than "col = $1 OR $1 IS NULL" in one static
// statement) so the planner only sees real conditions and can use the partial indexes.
func (s *Service) List(ctx context.Context, f Filter) (ListResult, error) {
	if f.After != nil {
		f.Fuzzy = f.After.Fuzzy
	}
	res, err := s.list(ctx, f)
	if err != nil || f.Query.Empty() || f.After != nil || f.Fuzzy || len(res.Cards) > 0 {
		return res, err
	}
	// Nothing matched exactly: retry forgiving typos ("dasturchy" → "dasturchi").
	f.Fuzzy = true
	return s.list(ctx, f)
}

// ListNew is the listing for saved-search alerts (TZ BE-11): exact matches only, newest
// first, no total. The typo-tolerant fallback is never used here: "showing similar
// results" is fine on a page the user is looking at, but an alert about vacancies the
// user didn't search for is wrong.
func (s *Service) ListNew(ctx context.Context, f Filter) (ListResult, error) {
	f.Fuzzy, f.After, f.SkipTotal, f.Sort = false, nil, true, SortNewest
	return s.list(ctx, f)
}

func (s *Service) list(ctx context.Context, f Filter) (ListResult, error) {
	search := !f.Query.Empty()
	sort := f.Sort
	if sort == "" || !search {
		sort = map[bool]string{true: SortRelevance, false: SortNewest}[search]
	}
	if f.After != nil && f.After.Sort != sort {
		return ListResult{}, errCursor
	}

	// Without a text query the vacancies table and its partial indexes serve the listing
	// directly. With one, the search index table picks the page's ids on its own and only
	// those rows are joined (see migration 00005).
	t := "v"
	if search {
		t = "s"
	}
	b := &sqlb.Builder{}
	tsq := s.filterConditions(b, f, t)
	where := b.SQL()
	countArgs := len(b.Args)

	ref := time.Now().UTC()
	if f.After != nil && sort == SortRelevance {
		ref = f.After.Ref
	}

	var sql, countFrom string
	if !search {
		countFrom = `vacancies v JOIN companies c ON c.id = v.company_id`
		if f.After != nil {
			where += fmt.Sprintf(" AND (v.published_at, v.id) < (%s, %s)", b.Arg(f.After.T), b.Arg(f.After.ID))
		}
		sql = `SELECT ` + cardColumns + `, 0::float8 FROM ` + countFrom + ` WHERE ` + where +
			` ORDER BY v.published_at DESC, v.id DESC LIMIT ` + b.Arg(f.Limit+1)
	} else {
		countFrom = `vacancy_search s`
		var ranked, order string
		if sort == SortRelevance {
			// ts_rank (not ts_rank_cd, ~30x slower with prefix queries) already weighs title
			// (A) matches highest. Fuzzy results are ranked by title similarity instead.
			match := "ts_rank(s.document, to_tsquery('simple', " + tsq + "))"
			if f.Fuzzy {
				match = "word_similarity(" + b.Arg(f.Query.Folded) + ", s.title)"
			}
			// Freshness decays with a two-week time constant. The float8 cast matters:
			// extract() returns numeric, and exp() over numeric is ~2x slower.
			score := match + ` + CASE WHEN s.is_featured THEN 0.3 ELSE 0 END
				+ 0.25 * exp(-greatest(extract(epoch FROM ` + b.Arg(ref) + `::timestamptz - s.published_at)::float8, 0) / 1209600.0)`
			ranked = `SELECT id, score FROM (SELECT s.vacancy_id AS id, ` + score + ` AS score
				FROM vacancy_search s WHERE ` + where + `) x`
			if f.After != nil {
				ranked += fmt.Sprintf(` WHERE (x.score, x.id) < (%s::float8, %s::uuid)`, b.Arg(f.After.Score), b.Arg(f.After.ID))
			}
			ranked += ` ORDER BY x.score DESC, x.id DESC LIMIT ` + b.Arg(f.Limit+1)
			order = `h.score DESC, h.id DESC`
		} else {
			ranked = `SELECT s.vacancy_id AS id, s.published_at, 0::float8 AS score FROM vacancy_search s WHERE ` + where
			if f.After != nil {
				ranked += fmt.Sprintf(` AND (s.published_at, s.vacancy_id) < (%s, %s)`, b.Arg(f.After.T), b.Arg(f.After.ID))
			}
			ranked += ` ORDER BY s.published_at DESC, s.vacancy_id DESC LIMIT ` + b.Arg(f.Limit+1)
			order = `h.published_at DESC, h.id DESC`
		}
		// A blocked company's rows are dropped here; blocking also unpublishes its vacancies.
		sql = `WITH h AS MATERIALIZED (` + ranked + `)
			SELECT ` + cardColumns + `, h.score FROM h
			JOIN vacancies v ON v.id = h.id JOIN companies c ON c.id = v.company_id
			WHERE c.status = 'active' ORDER BY ` + order
	}

	// Exec mode plans each statement with its actual parameters. Cached prepared
	// statements would drift to a generic plan, and for full-text conditions that plan
	// can't see how selective the query is (it once chose a 100k-row nested loop).
	rows, err := s.Pool.Query(ctx, sql, append([]any{pgx.QueryExecModeExec}, b.Args...)...)
	if err != nil {
		return ListResult{}, fmt.Errorf("list vacancies: %w", err)
	}
	defer rows.Close()

	var vs []gen.Vacancy
	summaries := map[uuid.UUID]company.Summary{}
	scores := map[uuid.UUID]float64{}
	for rows.Next() {
		var v gen.Vacancy
		var cs company.Summary
		var score float64
		if err := rows.Scan(&v.ID, &v.Slug, &v.Title, &v.CategoryID, &v.RegionID, &v.DistrictID,
			&v.SalaryMin, &v.SalaryMax, &v.Currency, &v.EmploymentType, &v.WorkFormat,
			&v.Experience, &v.Schedule, &v.IsFeatured, &v.ViewsCount, &v.ApplicationsCount,
			&v.PublishedAt, &v.ExpiresAt, &v.CreatedAt,
			&cs.ID, &cs.Name, &cs.Slug, &cs.LogoURL, &cs.Verified, &score); err != nil {
			return ListResult{}, err
		}
		v.Status = gen.VacancyStatusPublished
		cs.LogoURLs = imgurl.URLs(cs.LogoURL)
		vs = append(vs, v)
		summaries[v.ID] = cs
		scores[v.ID] = score
	}
	if err := rows.Err(); err != nil {
		return ListResult{}, err
	}

	cards, next, err := s.cards(ctx, vs, f.Limit, func(v gen.Vacancy) (company.Summary, any) {
		c := listCursor{Sort: sort, ID: v.ID, Fuzzy: f.Fuzzy}
		if sort == SortRelevance {
			c.Score, c.Ref = scores[v.ID], ref
		} else if v.PublishedAt != nil {
			c.T = *v.PublishedAt
		}
		return summaries[v.ID], c
	})
	if err != nil {
		return ListResult{}, err
	}
	res := ListResult{Cards: cards, NextCursor: next, Fuzzy: f.Fuzzy}

	// Only the first page reports a total, computed with the same filters. A full page
	// needs a count query; its result is cached apart for longer than the page (TZ BE-11).
	if f.After == nil && !f.SkipTotal {
		n := len(cards)
		if next != nil {
			key := totalKey(f)
			if cached, ok := s.Cache.cachedTotal(ctx, key); ok {
				n = max(cached, len(cards)+1) // there is a next page, whatever the old count says
			} else {
				countSQL := fmt.Sprintf(`SELECT count(*) FROM (SELECT 1 FROM %s WHERE %s LIMIT %d) t`,
					countFrom, b.SQL(), totalCap+1)
				args := append([]any{pgx.QueryExecModeExec}, b.Args[:countArgs]...)
				if err := s.Pool.QueryRow(ctx, countSQL, args...).Scan(&n); err != nil {
					return ListResult{}, fmt.Errorf("count vacancies: %w", err)
				}
				s.Cache.storeTotal(ctx, key, n)
			}
		}
		if n > totalCap {
			n, res.TotalCapped = totalCap, true
		}
		res.Total = &n
	}
	return res, nil
}

// filterConditions adds the WHERE conditions; t is the alias of the table they apply to
// ("v" = vacancies, "s" = vacancy_search, which carries the same filter columns).
// It returns the placeholder of the tsquery text so the rank expression can reuse it.
func (s *Service) filterConditions(b *sqlb.Builder, f Filter, t string) (tsq string) {
	col := func(name string) string { return t + "." + name }
	if t == "v" {
		b.Add("v.status = 'published'")
		b.Add("c.status = 'active'")
	} else {
		b.Add("s.is_published")
		if f.Fuzzy {
			// Close title match forgives typos ("fluter" → "flutter").
			b.Add("? <% s.title", f.Query.Folded)
		} else {
			// Inline (not a FROM item) so the planner can estimate selectivity and use GIN.
			tsq = b.Arg(f.Query.TSQuery)
			b.Add("s.document @@ to_tsquery('simple', " + tsq + ")")
		}
	}
	if f.CategoryID != nil {
		ids := []int32{*f.CategoryID}
		if cat, ok := s.Catalog.Category(*f.CategoryID); ok {
			for _, ch := range cat.Children { // a parent category includes its subcategories
				ids = append(ids, ch.ID)
			}
		}
		b.Add(col("category_id")+" = ANY(?)", ids)
	}
	if f.RegionID != nil {
		b.Add(col("region_id")+" = ?", *f.RegionID)
	}
	if f.DistrictID != nil {
		b.Add(col("district_id")+" = ?", *f.DistrictID)
	}
	if f.CompanyID != nil {
		b.Add(col("company_id")+" = ?", *f.CompanyID)
	}
	for name, vals := range map[string][]string{
		"employment_type": f.EmploymentTypes, "work_format": f.WorkFormats,
		"experience": f.Experiences, "schedule": f.Schedules,
	} {
		if len(vals) > 0 {
			b.Add(col(name)+"::text = ANY(?)", vals)
		}
	}
	if f.PublishedAfter != nil {
		b.Add(col("published_at")+" > ?", *f.PublishedAfter)
	}
	if f.SalaryFrom != nil {
		// Matches if the offered range reaches the wanted amount.
		b.Add(col("currency")+"::text = ? AND COALESCE("+col("salary_max")+", "+col("salary_min")+") >= ?", f.Currency, *f.SalaryFrom)
	} else if f.WithSalary {
		b.Add("(" + col("salary_min") + " IS NOT NULL OR " + col("salary_max") + " IS NOT NULL)")
	}
	return tsq
}
