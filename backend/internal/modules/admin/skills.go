package admin

import (
	"context"
	"errors"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/riverqueue/river"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/audit"
	"jobvacancy.uz/backend/internal/modules/vacancy"
	"jobvacancy.uz/backend/internal/platform/postgres"
)

// SkillFilter selects a page of the skill list.
type SkillFilter struct {
	Q        string
	Verified *bool
	Before   *int32
	Limit    int
}

// Skills lists skills newest first (unverified ones are what moderation looks at).
func (s *Service) Skills(ctx context.Context, f SkillFilter) ([]SkillDTO, *int32, error) {
	rows, err := postgres.PlanPerCall(s.Pool).AdminListSkills(ctx, gen.AdminListSkillsParams{
		Q: likeArg(f.Q), Verified: f.Verified, BeforeID: f.Before, MaxResults: int32(f.Limit + 1),
	})
	if err != nil {
		return nil, nil, err
	}
	var next *int32
	if len(rows) > f.Limit {
		rows = rows[:f.Limit]
		next = &rows[len(rows)-1].ID
	}
	out := make([]SkillDTO, len(rows))
	for i, r := range rows {
		out[i] = SkillDTO{ID: r.ID, Name: r.Name, Slug: r.Slug, IsVerified: r.IsVerified, UsageCount: r.UsageCount,
			Vacancies: r.Vacancies, Resumes: r.Resumes, CreatedAt: r.CreatedAt}
	}
	return out, next, nil
}

// SetSkillVerified marks a skill as reviewed (shown in suggestions) or not.
func (s *Service) SetSkillVerified(ctx context.Context, id int32, verified bool) (SkillDTO, error) {
	var out SkillDTO
	err := postgres.WithTx(ctx, s.Pool, func(q *gen.Queries) error {
		r, err := q.SetSkillVerified(ctx, gen.SetSkillVerifiedParams{ID: id, Verified: verified})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrSkillNotFound
		}
		if err != nil {
			return err
		}
		out = SkillDTO{ID: r.ID, Name: r.Name, Slug: r.Slug, IsVerified: r.IsVerified, UsageCount: r.UsageCount, CreatedAt: r.CreatedAt}
		action := map[bool]string{true: "skill.verify", false: "skill.unverify"}[verified]
		return audit.Write(ctx, q, audit.Entry{Action: action, ObjectType: audit.ObjectSkill,
			ObjectID: itoa(id), Details: map[string]any{"name": r.Name}})
	})
	return out, err
}

// reindexChunk is how many vacancies one reindex job rebuilds.
const reindexChunk = 500

// MergeResult reports what a merge moved.
type MergeResult struct {
	Into      SkillDTO `json:"into"`
	Vacancies int      `json:"vacancies"`
	Resumes   int64    `json:"resumes"`
}

// MergeSkill folds a duplicate skill (e.g. "golang") into another ("Go"): every vacancy
// and resume that had it gets the target instead, usage counts add up, and the duplicate
// is deleted. The affected vacancies' search documents are rebuilt by jobs enqueued in the
// same transaction.
func (s *Service) MergeSkill(ctx context.Context, fromID, intoID int32) (MergeResult, error) {
	if fromID == intoID {
		return MergeResult{}, ErrSkillMergeSelf
	}
	var res MergeResult
	err := postgres.WithPgxTx(ctx, s.Pool, func(tx pgx.Tx) error {
		q := gen.New(tx)
		locked, err := q.LockSkills(ctx, []int32{fromID, intoID}) // same order for every merge: no deadlocks
		if err != nil {
			return err
		}
		if len(locked) != 2 {
			return ErrSkillNotFound
		}
		from, into := locked[0], locked[1]
		if from.ID != fromID {
			from, into = into, from
		}
		m, err := q.MergeSkill(ctx, gen.MergeSkillParams{FromID: fromID, IntoID: intoID})
		if err != nil {
			return err
		}
		if _, err := q.DeleteSkill(ctx, fromID); err != nil {
			return err
		}
		res = MergeResult{Into: SkillDTO{ID: into.ID, Name: into.Name, Slug: into.Slug, IsVerified: into.IsVerified,
			UsageCount: into.UsageCount + from.UsageCount}, Vacancies: len(m.VacancyIds), Resumes: m.Resumes}
		var jobs []river.JobArgs
		for i := 0; i < len(m.VacancyIds); i += reindexChunk {
			jobs = append(jobs, vacancy.ReindexArgs{IDs: m.VacancyIds[i:min(i+reindexChunk, len(m.VacancyIds))]})
		}
		if len(jobs) > 0 && s.Jobs != nil {
			if err := s.Jobs.InsertManyTx(ctx, tx, jobs); err != nil {
				return err
			}
		}
		return audit.Write(ctx, q, audit.Entry{Action: "skill.merge", ObjectType: audit.ObjectSkill, ObjectID: itoa(fromID),
			Details: map[string]any{"from": from.Name, "into_id": intoID, "into": into.Name,
				"vacancies": len(m.VacancyIds), "resumes": m.Resumes}})
	})
	return res, err
}

func itoa(n int32) string { return strconv.Itoa(int(n)) }
