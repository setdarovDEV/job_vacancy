package resume

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/cursor"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/pkg/searchq"
	"jobvacancy.uz/backend/internal/pkg/sqlb"
)

const (
	SortRelevance = "relevance"
	SortUpdated   = "updated"
	totalCap      = 1000
)

// Experience buckets match vacancy.experience values, in months of total experience.
var experienceRanges = map[string][2]int{
	"none": {0, 11}, "1_3": {12, 35}, "3_6": {36, 71}, "6_plus": {72, 1 << 30},
}

type SearchFilter struct {
	Query           searchq.Query
	Sort            string
	CategoryID      *int32
	RegionID        *int32
	WithRelocate    bool // with RegionID: also candidates elsewhere who are willing to relocate
	Experiences     []string
	SalaryTo        *int64 // desired salary at most this (candidates without one match too)
	Currency        string
	EmploymentTypes []string
	WorkFormats     []string
	Language        string
	After           *SearchCursor
	Limit           int
	Fuzzy           bool
}

type SearchCursor struct {
	Sort  string    `json:"o"`
	T     time.Time `json:"t,omitzero"`
	Score float64   `json:"s,omitempty"`
	Ref   time.Time `json:"r,omitzero"`
	Fuzzy bool      `json:"f,omitempty"`
	ID    uuid.UUID `json:"i"`
}

type SearchResult struct {
	Cards       []Card  `json:"cards"`
	NextCursor  *string `json:"next_cursor"`
	Total       *int    `json:"total,omitempty"`
	TotalCapped bool    `json:"total_capped,omitempty"`
	Fuzzy       bool    `json:"fuzzy,omitempty"`
}

var errCursor = apperr.BadRequest("invalid_cursor", "cursor is invalid")

// Search finds public resumes for employers. Like vacancy search it ranks ids inside the
// resume_search index table and loads full rows only for the page; with no exact match it
// falls back to typo-tolerant title matching.
func (s *Service) Search(ctx context.Context, viewer reqctx.Principal, f SearchFilter) (SearchResult, error) {
	if viewer.Role != string(gen.UserRoleEmployer) && viewer.Role != string(gen.UserRoleAdmin) {
		return SearchResult{}, ErrEmployerOnly
	}
	if f.After != nil {
		f.Fuzzy = f.After.Fuzzy
	}
	res, err := s.search(ctx, f)
	if err != nil || f.Query.Empty() || f.After != nil || f.Fuzzy || len(res.Cards) > 0 {
		return res, err
	}
	f.Fuzzy = true
	return s.search(ctx, f)
}

func (s *Service) search(ctx context.Context, f SearchFilter) (SearchResult, error) {
	search := !f.Query.Empty()
	sort := f.Sort
	if sort == "" || !search {
		sort = map[bool]string{true: SortRelevance, false: SortUpdated}[search]
	}
	if f.After != nil && f.After.Sort != sort {
		return SearchResult{}, errCursor
	}

	b := &sqlb.Builder{}
	tsq := s.conditions(b, f)
	countArgs := len(b.Args)
	where := b.SQL()

	ref := time.Now().UTC()
	var sql string
	if sort == SortRelevance {
		if f.After != nil {
			ref = f.After.Ref
		}
		match := "ts_rank(s.document, to_tsquery('simple', " + tsq + "))"
		if f.Fuzzy {
			match = "word_similarity(" + b.Arg(f.Query.Folded) + ", s.title)"
		}
		// Recently updated resumes get a small boost (30-day time constant): an active
		// candidate is more likely to answer.
		score := match + ` + 0.15 * exp(-greatest(extract(epoch FROM ` + b.Arg(ref) +
			`::timestamptz - s.updated_at)::float8, 0) / 2592000.0)`
		sql = `SELECT id, score, updated_at FROM (SELECT s.resume_id AS id, s.updated_at, ` + score +
			` AS score FROM resume_search s WHERE ` + where + `) x`
		if f.After != nil {
			sql += fmt.Sprintf(` WHERE (x.score, x.id) < (%s::float8, %s::uuid)`, b.Arg(f.After.Score), b.Arg(f.After.ID))
		}
		sql += ` ORDER BY x.score DESC, x.id DESC LIMIT ` + b.Arg(f.Limit+1)
	} else {
		sql = `SELECT s.resume_id, 0::float8, s.updated_at FROM resume_search s WHERE ` + where
		if f.After != nil {
			sql += fmt.Sprintf(` AND (s.updated_at, s.resume_id) < (%s, %s)`, b.Arg(f.After.T), b.Arg(f.After.ID))
		}
		sql += ` ORDER BY s.updated_at DESC, s.resume_id DESC LIMIT ` + b.Arg(f.Limit+1)
	}

	rows, err := s.Pool.Query(ctx, sql, append([]any{pgx.QueryExecModeExec}, b.Args...)...)
	if err != nil {
		return SearchResult{}, fmt.Errorf("search resumes: %w", err)
	}
	type hit struct {
		id      uuid.UUID
		score   float64
		updated time.Time
	}
	var hits []hit
	for rows.Next() {
		var h hit
		if err := rows.Scan(&h.id, &h.score, &h.updated); err != nil {
			rows.Close()
			return SearchResult{}, err
		}
		hits = append(hits, h)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return SearchResult{}, err
	}

	res := SearchResult{Cards: []Card{}, Fuzzy: f.Fuzzy}
	if len(hits) > f.Limit {
		hits = hits[:f.Limit]
		last := hits[len(hits)-1]
		c := SearchCursor{Sort: sort, ID: last.id, Fuzzy: f.Fuzzy}
		if sort == SortRelevance {
			c.Score, c.Ref = last.score, ref
		} else {
			c.T = last.updated
		}
		next := cursor.Encode(c)
		res.NextCursor = &next
	}

	pageIDs := make([]uuid.UUID, len(hits))
	for i, h := range hits {
		pageIDs[i] = h.id
	}
	loaded, err := s.Q.ListResumesByIDs(ctx, pageIDs)
	if err != nil {
		return SearchResult{}, err
	}
	byID := make(map[uuid.UUID]gen.ListResumesByIDsRow, len(loaded))
	for _, l := range loaded {
		byID[l.Resume.ID] = l
	}
	sec, err := s.loadSections(ctx, pageIDs)
	if err != nil {
		return SearchResult{}, err
	}
	for _, id := range pageIDs { // keep ranking order; skip owners that were blocked
		if l, ok := byID[id]; ok {
			res.Cards = append(res.Cards, cardOf(l.Resume,
				Person{ID: l.Resume.UserID, FullName: l.FullName, AvatarURL: l.AvatarUrl}, sec, false))
		}
	}

	if f.After == nil {
		n := len(res.Cards)
		if res.NextCursor != nil {
			q := fmt.Sprintf(`SELECT count(*) FROM (SELECT 1 FROM resume_search s WHERE %s LIMIT %d) t`, where, totalCap+1)
			if err := s.Pool.QueryRow(ctx, q, append([]any{pgx.QueryExecModeExec}, b.Args[:countArgs]...)...).Scan(&n); err != nil {
				return SearchResult{}, fmt.Errorf("count resumes: %w", err)
			}
		}
		if n > totalCap {
			n, res.TotalCapped = totalCap, true
		}
		res.Total = &n
	}
	return res, nil
}

func (s *Service) conditions(b *sqlb.Builder, f SearchFilter) (tsq string) {
	b.Add("s.is_public")
	if !f.Query.Empty() {
		if f.Fuzzy {
			b.Add("? <% s.title", f.Query.Folded)
		} else {
			tsq = b.Arg(f.Query.TSQuery)
			b.Add("s.document @@ to_tsquery('simple', " + tsq + ")")
		}
	}
	if f.CategoryID != nil {
		ids := []int32{*f.CategoryID}
		if cat, ok := s.Catalog.Category(*f.CategoryID); ok {
			for _, ch := range cat.Children {
				ids = append(ids, ch.ID)
			}
		}
		b.Add("s.category_id = ANY(?)", ids)
	}
	if f.RegionID != nil {
		if f.WithRelocate {
			b.Add("(s.region_id = ? OR s.relocate)", *f.RegionID)
		} else {
			b.Add("s.region_id = ?", *f.RegionID)
		}
	}
	if len(f.Experiences) > 0 {
		var ors []string
		for _, e := range f.Experiences {
			r := experienceRanges[e]
			ors = append(ors, fmt.Sprintf("s.experience_months BETWEEN %s AND %s", b.Arg(r[0]), b.Arg(r[1])))
		}
		b.Add("(" + joinOr(ors) + ")")
	}
	if f.SalaryTo != nil {
		b.Add("(s.desired_salary IS NULL OR (s.currency::text = ? AND s.desired_salary <= ?))", f.Currency, *f.SalaryTo)
	}
	if len(f.EmploymentTypes) > 0 {
		b.Add("s.employment_types && ?::text[]", f.EmploymentTypes)
	}
	if len(f.WorkFormats) > 0 {
		b.Add("s.work_formats && ?::text[]", f.WorkFormats)
	}
	if f.Language != "" {
		b.Add("? = ANY(s.languages)", f.Language)
	}
	return tsq
}

func joinOr(parts []string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += " OR "
		}
		out += p
	}
	return out
}
