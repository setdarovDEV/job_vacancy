package vacancy

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/pkg/translit"
	"jobvacancy.uz/backend/internal/platform/postgres"
)

// searchDoc builds the folded search document for a vacancy.
func (s *Service) searchDoc(v gen.Vacancy, companyName string, skills []catalog.Skill) gen.UpsertVacancySearchParams {
	var tags []string
	for _, sk := range skills {
		tags = append(tags, sk.Name)
	}
	var meta []string
	for _, n := range s.Catalog.Names(v.CategoryID, v.RegionID, v.DistrictID) {
		meta = append(meta, n.Uz, n.UzCyrl, n.Ru, n.En)
	}
	return gen.UpsertVacancySearchParams{
		ID:      v.ID,
		Title:   translit.Fold(v.Title),
		Tags:    catalog.SearchTags(tags),
		Company: translit.Fold(companyName),
		Meta:    dedupeWords(translit.Fold(strings.Join(meta, " "))),
		Body:    translit.Fold(v.Description),
	}
}

// Category names repeat across languages ("Kassir"/"Кассир"); keep each word once so
// they don't inflate ranking.
func dedupeWords(s string) string {
	seen := map[string]bool{}
	var out []string
	for _, w := range strings.Fields(s) {
		if !seen[w] {
			seen[w] = true
			out = append(out, w)
		}
	}
	return strings.Join(out, " ")
}

// Reindex rebuilds every search document, e.g. after changing the folding rules or
// catalog names. It walks vacancies in id order, 500 per transaction.
func (s *Service) Reindex(ctx context.Context) (int, error) {
	var after uuid.UUID
	total := 0
	for {
		ids, err := s.Q.ListVacancyIDsAfter(ctx, gen.ListVacancyIDsAfterParams{ID: after, Limit: 500})
		if err != nil || len(ids) == 0 {
			return total, err
		}
		n, err := s.reindexBatch(ctx, ids)
		total += n
		if err != nil {
			return total, err
		}
		after = ids[len(ids)-1]
	}
}

// ReindexIDs rebuilds the search documents of the given vacancies from their current rows
// (a skill they use was renamed, merged or deleted) and drops cached public results, so
// searches see the new names at once. Safe to repeat; ids that no longer exist are skipped.
func (s *Service) ReindexIDs(ctx context.Context, ids []uuid.UUID) error {
	for start := 0; start < len(ids); start += 500 {
		batch := ids[start:min(start+500, len(ids))]
		if _, err := s.reindexBatch(ctx, batch); err != nil {
			return err
		}
	}
	if len(ids) == 0 || s.Cache == nil {
		return nil
	}
	return s.Cache.DropPublicResults(ctx)
}

func (s *Service) reindexBatch(ctx context.Context, ids []uuid.UUID) (int, error) {
	skills, err := s.skillsByID(ctx, ids)
	if err != nil {
		return 0, err
	}
	rows, err := s.Q.GetVacanciesByIDs(ctx, ids)
	if err != nil {
		return 0, err
	}
	err = postgres.WithTx(ctx, s.Pool, func(q *gen.Queries) error {
		for _, r := range rows {
			if err := q.UpsertVacancySearch(ctx, s.searchDoc(r.Vacancy, r.CompanyName, skills[r.Vacancy.ID])); err != nil {
				return err
			}
		}
		return nil
	})
	return len(rows), err
}
