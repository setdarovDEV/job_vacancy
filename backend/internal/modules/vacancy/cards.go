package vacancy

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/company"
	"jobvacancy.uz/backend/internal/pkg/imgurl"
)

// CardsByIDs loads vacancy cards in any status (applications and bookmarks outlive a
// vacancy's publication), keyed by id.
func (s *Service) CardsByIDs(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]Card, error) {
	out := make(map[uuid.UUID]Card, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := s.Pool.Query(ctx, `SELECT `+cardColumns+`, v.status
		FROM vacancies v JOIN companies c ON c.id = v.company_id WHERE v.id = ANY($1)`, ids)
	if err != nil {
		return nil, fmt.Errorf("vacancy cards: %w", err)
	}
	defer rows.Close()
	var vs []gen.Vacancy
	sums := map[uuid.UUID]company.Summary{}
	for rows.Next() {
		var v gen.Vacancy
		var cs company.Summary
		if err := rows.Scan(&v.ID, &v.Slug, &v.Title, &v.CategoryID, &v.RegionID, &v.DistrictID,
			&v.SalaryMin, &v.SalaryMax, &v.Currency, &v.EmploymentType, &v.WorkFormat,
			&v.Experience, &v.Schedule, &v.IsFeatured, &v.ViewsCount, &v.ApplicationsCount,
			&v.PublishedAt, &v.ExpiresAt, &v.CreatedAt,
			&cs.ID, &cs.Name, &cs.Slug, &cs.LogoURL, &cs.Verified, &v.Status); err != nil {
			return nil, err
		}
		cs.LogoURLs = imgurl.URLs(cs.LogoURL)
		vs = append(vs, v)
		sums[v.ID] = cs
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	skills, err := s.skillsFor(ctx, vs)
	if err != nil {
		return nil, err
	}
	for _, v := range vs {
		out[v.ID] = cardOf(v, sums[v.ID], skills[v.ID])
	}
	return out, nil
}
