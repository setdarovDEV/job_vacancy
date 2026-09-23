package vacancy

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/modules/company"
	"jobvacancy.uz/backend/internal/pkg/searchq"
)

type TitleSuggestion struct {
	Title     string `json:"title"`
	Vacancies int64  `json:"vacancies"`
}

// Suggestions power the search box dropdown.
type Suggestions struct {
	Titles    []TitleSuggestion `json:"titles"`
	Companies []company.Summary `json:"companies"`
	Skills    []catalog.Skill   `json:"skills"`
}

const suggestTTL = 5 * time.Minute

// Suggest returns vacancy titles, companies and skills matching what the user has typed
// so far. Results are cached per folded prefix, since the same prefixes repeat a lot.
func (s *Service) Suggest(ctx context.Context, raw string) (Suggestions, error) {
	out := Suggestions{Titles: []TitleSuggestion{}, Companies: []company.Summary{}, Skills: []catalog.Skill{}}
	q := searchq.Parse(raw)
	if q.Empty() {
		return out, nil
	}
	key := "search:suggest:" + q.Folded
	if b, err := s.Cache.RDB.Get(ctx, key).Bytes(); err == nil && json.Unmarshal(b, &out) == nil {
		return out, nil
	}

	// Same terms, restricted to title lexemes (weight A).
	parts := make([]string, len(q.Terms))
	for i, t := range q.Terms {
		if len(t) >= 3 {
			parts[i] = t + ":*A"
		} else {
			parts[i] = t + ":A"
		}
	}
	titles, err := s.Q.SuggestTitles(ctx, gen.SuggestTitlesParams{
		Tsquery: strings.Join(parts, " & "), MaxResults: 6,
	})
	if err != nil {
		return out, err
	}
	for _, t := range titles {
		out.Titles = append(out.Titles, TitleSuggestion{Title: t.Title, Vacancies: t.Vacancies})
	}

	name := strings.TrimSpace(raw)
	companies, err := s.Q.SuggestCompanies(ctx, gen.SuggestCompaniesParams{Q: name, MaxResults: 3})
	if err != nil {
		return out, err
	}
	for _, c := range companies {
		out.Companies = append(out.Companies, company.Summary{ID: c.ID, Name: c.Name, Slug: c.Slug, LogoURL: c.LogoUrl, Verified: c.Verified})
	}

	if out.Skills, err = s.Catalog.SearchSkills(ctx, name, 4); err != nil {
		return out, err
	}
	if b, err := json.Marshal(out); err == nil {
		_ = s.Cache.RDB.Set(ctx, key, b, suggestTTL).Err()
	}
	return out, nil
}
