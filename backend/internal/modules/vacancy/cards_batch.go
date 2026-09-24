package vacancy

import (
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/modules/company"
)

// QueueCards adds the queries of CardsByIDs to a pgx.Batch, so the cards arrive in the
// same round trip as the caller's other statements (TZ BE-12: applying returns the card
// without extra round trips). Call the returned func after the batch has been closed.
func QueueCards(b *pgx.Batch, ids []uuid.UUID) func() map[uuid.UUID]Card {
	var vs []gen.Vacancy
	sums := map[uuid.UUID]company.Summary{}
	skills := map[uuid.UUID][]catalog.Skill{}
	b.Queue(`SELECT `+cardColumns+`, v.status
		FROM vacancies v JOIN companies c ON c.id = v.company_id WHERE v.id = ANY($1)`, ids).
		Query(func(rows pgx.Rows) error {
			for rows.Next() {
				var v gen.Vacancy
				var cs company.Summary
				if err := rows.Scan(&v.ID, &v.Slug, &v.Title, &v.CategoryID, &v.RegionID, &v.DistrictID,
					&v.SalaryMin, &v.SalaryMax, &v.Currency, &v.EmploymentType, &v.WorkFormat,
					&v.Experience, &v.Schedule, &v.IsFeatured, &v.ViewsCount, &v.ApplicationsCount,
					&v.PublishedAt, &v.ExpiresAt, &v.CreatedAt,
					&cs.ID, &cs.Name, &cs.Slug, &cs.LogoURL, &cs.Verified, &v.Status); err != nil {
					return err
				}
				vs = append(vs, v)
				sums[v.ID] = cs
			}
			return rows.Err()
		})
	b.Queue(`SELECT vs.vacancy_id, s.id, s.name
		FROM vacancy_skills vs JOIN skills s ON s.id = vs.skill_id
		WHERE vs.vacancy_id = ANY($1) ORDER BY s.name`, ids).
		Query(func(rows pgx.Rows) error {
			for rows.Next() {
				var vid uuid.UUID
				var sk catalog.Skill
				if err := rows.Scan(&vid, &sk.ID, &sk.Name); err != nil {
					return err
				}
				skills[vid] = append(skills[vid], sk)
			}
			return rows.Err()
		})
	return func() map[uuid.UUID]Card {
		out := make(map[uuid.UUID]Card, len(vs))
		for _, v := range vs {
			out[v.ID] = cardOf(v, sums[v.ID], skills[v.ID])
		}
		return out
	}
}
