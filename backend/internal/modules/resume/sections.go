package resume

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Resume sections are written as whole arrays (TZ BE-12): one statement clears all four
// section tables and one inserts every row through unnest, sent together in a single
// round trip, instead of a DELETE per table and an INSERT per row. (Written by hand: sqlc
// can't type a multi-array unnest.)

const deleteSectionsSQL = `
WITH e AS (DELETE FROM resume_experiences WHERE resume_id = $1),
     ed AS (DELETE FROM resume_educations WHERE resume_id = $1),
     sk AS (DELETE FROM resume_skills WHERE resume_id = $1)
DELETE FROM resume_languages WHERE resume_id = $1`

const insertSectionsSQL = `
WITH e AS (
    INSERT INTO resume_experiences (resume_id, company, position, start_date, end_date, description, sort_order)
    SELECT $1, x.company, x.position, x.start_date, x.end_date, x.description, x.sort_order
    FROM unnest($2::text[], $3::text[], $4::date[], $5::date[], $6::text[], $7::int[])
         AS x(company, position, start_date, end_date, description, sort_order)
), ed AS (
    INSERT INTO resume_educations (resume_id, institution, level, field, start_year, end_year, sort_order)
    SELECT $1, x.institution, x.level::education_level, x.field, x.start_year, x.end_year, x.sort_order
    FROM unnest($8::text[], $9::text[], $10::text[], $11::smallint[], $12::smallint[], $13::int[])
         AS x(institution, level, field, start_year, end_year, sort_order)
), sk AS (
    INSERT INTO resume_skills (resume_id, skill_id)
    SELECT $1, unnest($14::int[])
    ON CONFLICT DO NOTHING
)
INSERT INTO resume_languages (resume_id, language, level)
SELECT $1, x.language, x.level::language_level
FROM unnest($15::text[], $16::text[]) AS x(language, level)`

// sectionArrays are the columns of every section, one array per column.
type sectionArrays struct {
	expCompany, expPosition, expDescription []string
	expStart                                []time.Time
	expEnd                                  []*time.Time
	expOrder                                []int32

	eduInstitution, eduLevel, eduField []string
	eduStart, eduEnd                   []*int16
	eduOrder                           []int32

	skills []int32

	langs, langLevels []string
}

func (s *Service) sectionArrays(p parsed) sectionArrays {
	var a sectionArrays
	for _, e := range p.experiences {
		a.expCompany = append(a.expCompany, e.Company)
		a.expPosition = append(a.expPosition, e.Position)
		a.expStart = append(a.expStart, e.StartDate)
		a.expEnd = append(a.expEnd, e.EndDate)
		a.expDescription = append(a.expDescription, e.Description)
		a.expOrder = append(a.expOrder, e.SortOrder)
	}
	for i, e := range p.in.Educations {
		a.eduInstitution = append(a.eduInstitution, strings.TrimSpace(e.Institution))
		a.eduLevel = append(a.eduLevel, e.Level)
		a.eduField = append(a.eduField, strings.TrimSpace(e.Field))
		a.eduStart = append(a.eduStart, e.StartYear)
		a.eduEnd = append(a.eduEnd, e.EndYear)
		a.eduOrder = append(a.eduOrder, int32(i))
	}
	for _, sk := range p.skills {
		a.skills = append(a.skills, sk.ID)
	}
	for _, l := range p.in.Languages {
		a.langs = append(a.langs, l.Language)
		a.langLevels = append(a.langLevels, l.Level)
	}
	return a
}

// writeSections replaces the sections of resume id inside tx: one batch, one round trip.
// replace=false (a new resume) skips the delete.
func (s *Service) writeSections(ctx context.Context, tx pgx.Tx, id uuid.UUID, p parsed, replace bool) error {
	a := s.sectionArrays(p)
	b := &pgx.Batch{}
	if replace {
		b.Queue(deleteSectionsSQL, id)
	}
	b.Queue(insertSectionsSQL, id,
		nonNil(a.expCompany), nonNil(a.expPosition), nonNil(a.expStart), nonNil(a.expEnd), nonNil(a.expDescription), nonNil(a.expOrder),
		nonNil(a.eduInstitution), nonNil(a.eduLevel), nonNil(a.eduField), nonNil(a.eduStart), nonNil(a.eduEnd), nonNil(a.eduOrder),
		nonNil(a.skills), nonNil(a.langs), nonNil(a.langLevels))
	return tx.SendBatch(ctx, b).Close()
}

// nonNil sends an empty array rather than NULL (unnest(NULL) is fine, but an explicit
// empty array keeps the statement's intent obvious in logs).
func nonNil[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}
