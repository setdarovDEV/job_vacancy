package catalog

// Skill administration (admins only): verify, rename, merge and delete user-added skills.
//
// Skill names are folded into the vacancy and resume search indexes. Renames, merges and
// deletes therefore enqueue ReindexArgs jobs inside the same transaction as the change:
// the jobs exist exactly when the change committed, and the worker recomputes the index
// rows from the current data, so it is safe to run them more than once.

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/slug"
	"jobvacancy.uz/backend/internal/platform/postgres"
)

var (
	ErrSkillNotFound = apperr.NotFound("skill_not_found", "skill not found")
	// The new name's slug already belongs to another skill (as its name or an alias): the
	// two are the same skill, so the admin should merge instead of renaming.
	ErrSkillExists = apperr.Conflict("skill_exists", "another skill already has this name; merge into it instead")
	// A merge target or a bulk-verified id that doesn't exist. The body is at fault, not
	// the path, so it is a validation error on that field rather than a 404.
	errMergeTargetMissing = apperr.Validation(map[string]string{"into": "not_found"})
	errMergeIntoSelf      = apperr.Validation(map[string]string{"into": "not_self"})
	errVerifyIDsMissing   = apperr.Validation(map[string]string{"ids": "not_found"})
)

// reindexChunk bounds the ids one job carries, so a skill used everywhere doesn't become
// one huge job payload or one long-running job.
const reindexChunk = 1000

// ReindexArgs asks the worker to rebuild the search rows of items whose skill names
// changed. It carries ids, not names: the worker reads the current names itself.
type ReindexArgs struct {
	VacancyIDs []uuid.UUID `json:"vacancy_ids"`
	ResumeIDs  []uuid.UUID `json:"resume_ids"`
}

func (ReindexArgs) Kind() string { return "catalog.reindex_skill_users" }

// chunks splits the ids into jobs of at most size ids each.
func (a ReindexArgs) chunks(size int) []ReindexArgs {
	var out []ReindexArgs
	for start := 0; start < len(a.VacancyIDs); start += size {
		out = append(out, ReindexArgs{VacancyIDs: a.VacancyIDs[start:min(start+size, len(a.VacancyIDs))]})
	}
	for start := 0; start < len(a.ResumeIDs); start += size {
		out = append(out, ReindexArgs{ResumeIDs: a.ResumeIDs[start:min(start+size, len(a.ResumeIDs))]})
	}
	return out
}

// SkillTx is what one skill-administration transaction can read and write.
type SkillTx interface {
	GetSkillForUpdate(ctx context.Context, id int32) (gen.Skill, error)
	FindSkillBySlug(ctx context.Context, slug string) (int32, error)
	RenameSkill(ctx context.Context, arg gen.RenameSkillParams) (gen.Skill, error)
	SetSkillVerified(ctx context.Context, arg gen.SetSkillVerifiedParams) (gen.Skill, error)
	SetSkillsVerified(ctx context.Context, ids []int32) ([]int32, error)
	AddSkillAlias(ctx context.Context, arg gen.AddSkillAliasParams) error
	DeleteSkillAlias(ctx context.Context, slug string) error
	RepointSkillAliases(ctx context.Context, arg gen.RepointSkillAliasesParams) error
	ListSkillVacancyIDs(ctx context.Context, skillID int32) ([]uuid.UUID, error)
	ListSkillResumeIDs(ctx context.Context, skillID int32) ([]uuid.UUID, error)
	CopyVacancySkillLinks(ctx context.Context, arg gen.CopyVacancySkillLinksParams) (int64, error)
	CopyResumeSkillLinks(ctx context.Context, arg gen.CopyResumeSkillLinksParams) error
	AddSkillUsage(ctx context.Context, arg gen.AddSkillUsageParams) error
	DeleteSkill(ctx context.Context, id int32) (int64, error)
	// Reindex enqueues search refresh jobs; they commit or roll back with the transaction.
	Reindex(ctx context.Context, jobs []ReindexArgs) error
}

// SkillTransactor runs fn in one transaction (PgSkillTx in production).
type SkillTransactor interface {
	InTx(ctx context.Context, fn func(SkillTx) error) error
}

// TxInserter inserts background jobs inside an open transaction (jobs.Enqueuer).
type TxInserter interface {
	InsertManyTx(ctx context.Context, tx pgx.Tx, args []river.JobArgs) error
}

// PgSkillTx is the Postgres SkillTransactor: generated queries plus a transactional job
// insert on the same transaction.
type PgSkillTx struct {
	Pool *pgxpool.Pool
	Jobs TxInserter
}

func (p PgSkillTx) InTx(ctx context.Context, fn func(SkillTx) error) error {
	return postgres.InTx(ctx, p.Pool, func(tx pgx.Tx, q *gen.Queries) error {
		return fn(pgSkillTx{Queries: q, tx: tx, jobs: p.Jobs})
	})
}

type pgSkillTx struct {
	*gen.Queries
	tx   pgx.Tx
	jobs TxInserter
}

func (t pgSkillTx) Reindex(ctx context.Context, jobs []ReindexArgs) error {
	args := make([]river.JobArgs, len(jobs))
	for i, j := range jobs {
		args[i] = j
	}
	return t.jobs.InsertManyTx(ctx, t.tx, args)
}

// SkillAdmin applies the skill catalog rules for platform admins. It only exists where
// admins work (the API process), so its transaction dependency is required, not optional.
type SkillAdmin struct {
	Tx SkillTransactor
}

// SetVerified marks a skill as reviewed (verified skills appear in autocomplete
// suggestions) or takes that back. Names don't change, so nothing is reindexed.
func (a *SkillAdmin) SetVerified(ctx context.Context, id int32, verified bool) (gen.Skill, error) {
	var out gen.Skill
	err := a.Tx.InTx(ctx, func(tx SkillTx) error {
		var err error
		out, err = tx.SetSkillVerified(ctx, gen.SetSkillVerifiedParams{ID: id, IsVerified: verified})
		return skillNotFound(err)
	})
	return out, err
}

// VerifyMany verifies several skills at once, all or nothing: if any id is unknown,
// nothing changes (422 ids=not_found).
func (a *SkillAdmin) VerifyMany(ctx context.Context, ids []int32) error {
	return a.Tx.InTx(ctx, func(tx SkillTx) error {
		done, err := tx.SetSkillsVerified(ctx, ids)
		if err != nil {
			return err
		}
		if len(done) != len(ids) {
			return errVerifyIDsMissing
		}
		return nil
	})
}

// Rename fixes a skill's spelling. The old slug becomes an alias, so people who type the
// old name keep getting this skill. A name whose slug belongs to a different skill is
// refused (ErrSkillExists): those are duplicates to merge.
func (a *SkillAdmin) Rename(ctx context.Context, id int32, name string) (gen.Skill, error) {
	name, sl, err := cleanSkillName(name, "name")
	if err != nil {
		return gen.Skill{}, err
	}
	var out gen.Skill
	err = a.Tx.InTx(ctx, func(tx SkillTx) error {
		cur, err := tx.GetSkillForUpdate(ctx, id)
		if err != nil {
			return skillNotFound(err)
		}
		if sl != cur.Slug {
			owner, err := tx.FindSkillBySlug(ctx, sl)
			switch {
			case err == nil && owner != id:
				return ErrSkillExists
			case err == nil: // renaming back to one of its own former names
				if err := tx.DeleteSkillAlias(ctx, sl); err != nil {
					return err
				}
			case !errors.Is(err, pgx.ErrNoRows):
				return err
			}
		}
		// The skill must move off its old slug before that slug can become an alias.
		if out, err = tx.RenameSkill(ctx, gen.RenameSkillParams{ID: id, Name: name, Slug: sl}); err != nil {
			return err
		}
		if sl != cur.Slug {
			if err := tx.AddSkillAlias(ctx, gen.AddSkillAliasParams{Slug: cur.Slug, SkillID: id}); err != nil {
				return err
			}
		}
		if out.Name == cur.Name {
			return nil
		}
		users, err := skillUsers(ctx, tx, id)
		if err != nil {
			return err
		}
		return reindex(ctx, tx, users)
	})
	return out, err
}

// Merge folds source into target: every vacancy and resume that had source gets target
// instead, source's names (its slug and aliases) become target's aliases, and source is
// deleted. It returns the surviving target. An unknown source (the path) is 404; an
// unknown target (the body) is 422 into=not_found.
func (a *SkillAdmin) Merge(ctx context.Context, sourceID, targetID int32) (gen.Skill, error) {
	if sourceID == targetID {
		return gen.Skill{}, errMergeIntoSelf
	}
	var out gen.Skill
	err := a.Tx.InTx(ctx, func(tx SkillTx) error {
		src, dst, err := lockPair(ctx, tx, sourceID, targetID)
		if err != nil {
			return err
		}
		users, err := skillUsers(ctx, tx, src.ID)
		if err != nil {
			return err
		}
		moved, err := tx.CopyVacancySkillLinks(ctx, gen.CopyVacancySkillLinksParams{SourceID: src.ID, TargetID: dst.ID})
		if err != nil {
			return err
		}
		if err := tx.CopyResumeSkillLinks(ctx, gen.CopyResumeSkillLinksParams{SourceID: src.ID, TargetID: dst.ID}); err != nil {
			return err
		}
		// The source's slug must be free (source deleted) before it can become an alias.
		if err := tx.RepointSkillAliases(ctx, gen.RepointSkillAliasesParams{SourceID: src.ID, TargetID: dst.ID}); err != nil {
			return err
		}
		if _, err := tx.DeleteSkill(ctx, src.ID); err != nil {
			return err
		}
		if err := tx.AddSkillAlias(ctx, gen.AddSkillAliasParams{Slug: src.Slug, SkillID: dst.ID}); err != nil {
			return err
		}
		if gain := mergedPopularity(src.UsageCount, moved, len(users.VacancyIDs)); gain > 0 {
			if err := tx.AddSkillUsage(ctx, gen.AddSkillUsageParams{ID: dst.ID, N: gain}); err != nil {
				return err
			}
		}
		out = dst
		return reindex(ctx, tx, users)
	})
	return out, err
}

// mergedPopularity is the share of the source's popularity the target inherits: only for
// the vacancies that actually moved, since vacancies that listed both skills were already
// counted for the target.
func mergedPopularity(popularity int32, moved int64, linked int) int32 {
	if linked == 0 || moved == 0 {
		return 0
	}
	return int32((int64(popularity)*moved + int64(linked)/2) / int64(linked))
}

// Delete removes a skill everywhere (its vacancy and resume links go with it).
func (a *SkillAdmin) Delete(ctx context.Context, id int32) error {
	return a.Tx.InTx(ctx, func(tx SkillTx) error {
		if _, err := tx.GetSkillForUpdate(ctx, id); err != nil {
			return skillNotFound(err)
		}
		users, err := skillUsers(ctx, tx, id)
		if err != nil {
			return err
		}
		if _, err := tx.DeleteSkill(ctx, id); err != nil {
			return err
		}
		return reindex(ctx, tx, users)
	})
}

// lockPair locks both skills in id order, so two merges of the same pair in opposite
// directions can't deadlock; the loser then finds its source gone (404).
func lockPair(ctx context.Context, tx SkillTx, sourceID, targetID int32) (src, dst gen.Skill, err error) {
	first, second := sourceID, targetID
	if second < first {
		first, second = second, first
	}
	locked := map[int32]gen.Skill{}
	for _, id := range []int32{first, second} {
		sk, err := tx.GetSkillForUpdate(ctx, id)
		switch {
		case errors.Is(err, pgx.ErrNoRows) && id == sourceID:
			return src, dst, ErrSkillNotFound
		case errors.Is(err, pgx.ErrNoRows):
			return src, dst, errMergeTargetMissing
		case err != nil:
			return src, dst, err
		}
		locked[id] = sk
	}
	return locked[sourceID], locked[targetID], nil
}

// skillUsers lists what uses a skill, read before the change so the reindex covers it.
func skillUsers(ctx context.Context, tx SkillTx, id int32) (ReindexArgs, error) {
	vac, err := tx.ListSkillVacancyIDs(ctx, id)
	if err != nil {
		return ReindexArgs{}, err
	}
	res, err := tx.ListSkillResumeIDs(ctx, id)
	if err != nil {
		return ReindexArgs{}, err
	}
	return ReindexArgs{VacancyIDs: vac, ResumeIDs: res}, nil
}

func reindex(ctx context.Context, tx SkillTx, a ReindexArgs) error {
	jobs := a.chunks(reindexChunk)
	if len(jobs) == 0 {
		return nil
	}
	return tx.Reindex(ctx, jobs)
}

// cleanSkillName applies the same normalisation as ResolveSkills; field names the
// request field for validation errors.
func cleanSkillName(raw, field string) (name, sl string, err error) {
	name = strings.Join(strings.Fields(raw), " ")
	switch {
	case name == "":
		return "", "", apperr.Validation(map[string]string{field: "required"})
	case len([]rune(name)) > MaxSkillNameLen:
		return "", "", apperr.Validation(map[string]string{field: fmt.Sprintf("max=%d", MaxSkillNameLen)})
	}
	if sl = slug.Make(name); sl == "" {
		return "", "", apperr.Validation(map[string]string{field: "invalid"})
	}
	return name, sl, nil
}

func skillNotFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrSkillNotFound
	}
	return err
}
