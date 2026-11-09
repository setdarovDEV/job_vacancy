package admin

// The skill directory: user-added skills to review, rename, merge or delete. The rules
// live in catalog.SkillAdmin; admin lists the directory and re-reads it after a change.

import (
	"context"
	"time"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/cursor"
)

// SkillCurator applies the catalog's skill rules (catalog.SkillAdmin): verification,
// renames, merges and deletes, including the search refresh they trigger.
type SkillCurator interface {
	SetVerified(ctx context.Context, id int32, verified bool) (gen.Skill, error)
	VerifyMany(ctx context.Context, ids []int32) error
	Rename(ctx context.Context, id int32, name string) (gen.Skill, error)
	Merge(ctx context.Context, sourceID, targetID int32) (gen.Skill, error)
	Delete(ctx context.Context, id int32) error
}

// Skill is a skill as the directory shows it (view skill_directory).
type Skill = gen.SkillDirectory

// SkillSort orders the skill directory.
type SkillSort string

const (
	SkillSortNewest     SkillSort = "newest"     // created_at: the review queue
	SkillSortPopularity SkillSort = "popularity" // autocomplete ranking (grows on each publish)
	SkillSortInUse      SkillSort = "in_use"     // vacancies + resumes listing it right now
)

// SkillSorts lists the valid orderings; the first is the default.
var SkillSorts = []SkillSort{SkillSortNewest, SkillSortPopularity, SkillSortInUse}

// SkillCursor is a skill directory position. Sort is part of the key, so a cursor from
// one ordering is refused by another (400 invalid_cursor) instead of skipping rows.
type SkillCursor struct {
	Sort SkillSort `json:"s"`
	N    int64     `json:"n"` // created_at in µs (newest), popularity or in_use
	ID   int32     `json:"i"`
}

// SkillFilter selects a skill directory page; nil fields don't filter. A zero Sort means
// the default ordering and a zero Limit the default page size.
type SkillFilter struct {
	Query    string
	Verified *bool
	Sort     SkillSort
	After    *SkillCursor
	Limit    int
}

// skillOrder is one directory ordering: how to query a page and where a row sits in it.
type skillOrder struct {
	page func(s Store, ctx context.Context, f SkillFilter, max int32) ([]Skill, error)
	key  func(Skill) int64
}

var skillOrders = map[SkillSort]skillOrder{
	SkillSortNewest: {
		page: func(st Store, ctx context.Context, f SkillFilter, max int32) ([]Skill, error) {
			p := gen.AdminListSkillsNewestParams{Q: optional(f.Query), Verified: f.Verified, MaxResults: max}
			if f.After != nil {
				t := time.UnixMicro(f.After.N)
				p.AfterT, p.AfterID = &t, &f.After.ID
			}
			return st.AdminListSkillsNewest(ctx, p)
		},
		key: func(r Skill) int64 { return r.CreatedAt.UnixMicro() },
	},
	SkillSortPopularity: {
		page: func(st Store, ctx context.Context, f SkillFilter, max int32) ([]Skill, error) {
			p := gen.AdminListSkillsByPopularityParams{Q: optional(f.Query), Verified: f.Verified, MaxResults: max}
			if f.After != nil {
				n := int32(f.After.N)
				p.AfterN, p.AfterID = &n, &f.After.ID
			}
			return st.AdminListSkillsByPopularity(ctx, p)
		},
		key: func(r Skill) int64 { return int64(r.Popularity) },
	},
	SkillSortInUse: {
		page: func(st Store, ctx context.Context, f SkillFilter, max int32) ([]Skill, error) {
			p := gen.AdminListSkillsInUseParams{Q: optional(f.Query), Verified: f.Verified, MaxResults: max}
			if f.After != nil {
				n := int32(f.After.N)
				p.AfterN, p.AfterID = &n, &f.After.ID
			}
			return st.AdminListSkillsInUse(ctx, p)
		},
		key: func(r Skill) int64 { return int64(r.InUse) },
	},
}

func (s *Service) ListSkills(ctx context.Context, f SkillFilter) ([]Skill, cursor.Meta, error) {
	if f.Sort == "" {
		f.Sort = SkillSorts[0]
	}
	if f.Limit <= 0 {
		f.Limit = cursor.AdminDefaultLimit
	}
	order, ok := skillOrders[f.Sort]
	if !ok {
		return nil, cursor.Meta{}, apperr.Validation(map[string]string{"sort": apperr.OneOf(SkillSorts)})
	}
	if f.After != nil && f.After.Sort != f.Sort {
		return nil, cursor.Meta{}, cursor.ErrBadCursor
	}
	rows, err := order.page(s.Store, ctx, f, int32(f.Limit+1))
	if err != nil {
		return nil, cursor.Meta{}, err
	}
	page, meta := cursor.Page(rows, f.Limit, func(r Skill) any {
		return SkillCursor{Sort: f.Sort, N: order.key(r), ID: r.ID}
	})
	return page, meta, nil
}

// Mutations apply the catalog rule, then re-read the directory so the response has the
// same shape as a list row. A merge answers with the surviving target.
func (s *Service) SetSkillVerified(ctx context.Context, id int32, verified bool) (Skill, error) {
	sk, err := s.Skills.SetVerified(ctx, id, verified)
	if err != nil {
		return Skill{}, err
	}
	return s.Store.AdminGetSkill(ctx, sk.ID)
}

// VerifySkills verifies several skills at once (all or nothing) and returns them.
func (s *Service) VerifySkills(ctx context.Context, ids []int32) ([]Skill, error) {
	if err := s.Skills.VerifyMany(ctx, ids); err != nil {
		return nil, err
	}
	return s.Store.AdminGetSkills(ctx, ids)
}

func (s *Service) RenameSkill(ctx context.Context, id int32, name string) (Skill, error) {
	sk, err := s.Skills.Rename(ctx, id, name)
	if err != nil {
		return Skill{}, err
	}
	return s.Store.AdminGetSkill(ctx, sk.ID)
}

func (s *Service) MergeSkill(ctx context.Context, sourceID, targetID int32) (Skill, error) {
	sk, err := s.Skills.Merge(ctx, sourceID, targetID)
	if err != nil {
		return Skill{}, err
	}
	return s.Store.AdminGetSkill(ctx, sk.ID)
}

func (s *Service) DeleteSkill(ctx context.Context, id int32) error {
	return s.Skills.Delete(ctx, id)
}
