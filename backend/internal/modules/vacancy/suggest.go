package vacancy

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/modules/company"
	"jobvacancy.uz/backend/internal/pkg/searchq"
	"jobvacancy.uz/backend/internal/platform/postgres"
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

// likePrefix escapes LIKE wildcards so "50%" is matched literally.
var likePrefix = strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`)

func emptySuggestions() Suggestions {
	return Suggestions{Titles: []TitleSuggestion{}, Companies: []company.Summary{}, Skills: []catalog.Skill{}}
}

// Suggest returns vacancy titles, companies and skills matching what the user has typed
// so far. The handler caches the response per folded prefix (the same prefixes repeat a
// lot); this is the uncached path, three indexed queries.
func (s *Service) Suggest(ctx context.Context, raw string) (Suggestions, error) {
	out := emptySuggestions()
	q := searchq.Parse(raw)
	if q.Empty() {
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
	// Planned per call: a broad prefix walks the newest rows, a narrow one uses GIN
	// (migration 00014); a cached generic plan would pick one path for both.
	titles, err := postgres.PlanPerCall(s.Pool).SuggestTitles(ctx, gen.SuggestTitlesParams{
		Tsquery: strings.Join(parts, " & "), MaxResults: 6,
	})
	if err != nil {
		return out, err
	}
	for _, t := range titles {
		out.Titles = append(out.Titles, TitleSuggestion{Title: t.Title, Vacancies: t.Vacancies})
	}

	name := strings.TrimSpace(raw)
	const maxCompanies = 3
	companies, err := s.Q.SuggestCompanies(ctx, gen.SuggestCompaniesParams{
		Prefix: likePrefix.Replace(strings.ToLower(name)), Q: name, MaxResults: maxCompanies,
	})
	if err != nil {
		return out, err
	}
	seen := make(map[uuid.UUID]bool, len(companies))
	for _, c := range companies { // prefix matches first, then the closest names
		if seen[c.ID] || len(out.Companies) == maxCompanies {
			continue
		}
		seen[c.ID] = true
		out.Companies = append(out.Companies, company.NewSummary(c.ID, c.Name, c.Slug, c.LogoUrl, c.Verified))
	}

	if out.Skills, err = s.Catalog.SearchSkills(ctx, name, 4); err != nil {
		return out, err
	}
	return out, nil
}
