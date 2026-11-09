// Package catalog serves reference data: job categories, regions and skills.
// Categories and regions change rarely, so the whole tree lives in memory as a snapshot
// (with its JSON pre-encoded) and is refreshed periodically — reads never touch the DB.
package catalog

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/slug"
	"jobvacancy.uz/backend/internal/pkg/translit"
	"jobvacancy.uz/backend/internal/platform/postgres"
)

const (
	refreshEvery       = 5 * time.Minute
	MaxSkillsPerAd     = 20 // vacancies
	MaxSkillsPerResume = 30
	// MaxSkillNameLen is the longest skill name accepted anywhere (vacancies, resumes,
	// admin renames); validation errors say "max=50".
	MaxSkillNameLen = 50
)

type Names struct {
	Uz     string `json:"uz"`
	UzCyrl string `json:"uz-Cyrl"`
	Ru     string `json:"ru"`
	En     string `json:"en"`
}

type Category struct {
	ID       int32       `json:"id"`
	Slug     string      `json:"slug"`
	Name     Names       `json:"name"`
	Icon     string      `json:"icon,omitempty"`
	Children []*Category `json:"children,omitempty"`
}

type Region struct {
	ID       int32     `json:"id"`
	Slug     string    `json:"slug"`
	Kind     string    `json:"kind"`
	Name     Names     `json:"name"`
	Children []*Region `json:"children,omitempty"`
}

type Skill struct {
	ID   int32  `json:"id"`
	Name string `json:"name"`
}

// encoded is a ready-to-send response body with its ETag.
type encoded struct {
	body []byte
	etag string
}

type snapshot struct {
	categoryByID map[int32]*Category
	parentOf     map[int32]int32
	regionByID   map[int32]regionInfo
	categories   encoded
	regions      encoded
}

type regionInfo struct {
	parentID *int32
	kind     gen.RegionKind
	name     Names
}

type Service struct {
	Q    *gen.Queries
	Log  *slog.Logger
	snap atomic.Pointer[snapshot]
}

// Start loads the snapshot and keeps refreshing it until ctx is cancelled.
func (s *Service) Start(ctx context.Context) error {
	if err := s.Reload(ctx); err != nil {
		return err
	}
	go func() {
		t := time.NewTicker(refreshEvery)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				if err := s.Reload(ctx); err != nil {
					s.Log.Error("catalog reload failed", "err", err)
				}
			}
		}
	}()
	return nil
}

func (s *Service) Reload(ctx context.Context) error {
	cats, err := s.Q.ListCategories(ctx)
	if err != nil {
		return fmt.Errorf("catalog: categories: %w", err)
	}
	regs, err := s.Q.ListRegions(ctx)
	if err != nil {
		return fmt.Errorf("catalog: regions: %w", err)
	}

	snap := &snapshot{categoryByID: map[int32]*Category{}, parentOf: map[int32]int32{}, regionByID: map[int32]regionInfo{}}

	// Rows are ordered parents-first, so a parent is always seen before its children.
	var catRoots []*Category
	for _, c := range cats {
		node := &Category{ID: c.ID, Slug: c.Slug, Icon: c.Icon,
			Name: Names{c.NameUz, c.NameUzCyrl, c.NameRu, c.NameEn}}
		snap.categoryByID[c.ID] = node
		if c.ParentID == nil {
			catRoots = append(catRoots, node)
		} else if p := snap.categoryByID[*c.ParentID]; p != nil {
			p.Children = append(p.Children, node)
			snap.parentOf[c.ID] = p.ID
		}
	}

	regionNodes := map[int32]*Region{}
	var regRoots []*Region
	for _, r := range regs {
		node := &Region{ID: r.ID, Slug: r.Slug, Kind: string(r.Kind),
			Name: Names{r.NameUz, r.NameUzCyrl, r.NameRu, r.NameEn}}
		regionNodes[r.ID] = node
		snap.regionByID[r.ID] = regionInfo{parentID: r.ParentID, kind: r.Kind, name: node.Name}
		if r.ParentID == nil {
			regRoots = append(regRoots, node)
		} else if p := regionNodes[*r.ParentID]; p != nil {
			p.Children = append(p.Children, node)
		}
	}

	if snap.categories, err = encode(catRoots); err != nil {
		return err
	}
	if snap.regions, err = encode(regRoots); err != nil {
		return err
	}
	s.snap.Store(snap)
	return nil
}

func encode(v any) (encoded, error) {
	b, err := json.Marshal(map[string]any{"data": v})
	if err != nil {
		return encoded{}, err
	}
	sum := sha256.Sum256(b)
	return encoded{body: b, etag: `"` + hex.EncodeToString(sum[:8]) + `"`}, nil
}

// ---- validation helpers used by other modules --------------------------------------------

var (
	errCategory = apperr.Validation(map[string]string{"category_id": "exists"})
	errRegion   = apperr.Validation(map[string]string{"region_id": "exists"})
	errDistrict = apperr.Validation(map[string]string{"district_id": "in_region"})
)

func (s *Service) Category(id int32) (*Category, bool) {
	c, ok := s.snap.Load().categoryByID[id]
	return c, ok
}

func (s *Service) ValidateCategory(id int32) error {
	if _, ok := s.Category(id); !ok {
		return errCategory
	}
	return nil
}

// ValidateLocation checks that region is a top-level region and district (optional)
// belongs to it.
func (s *Service) ValidateLocation(regionID int32, districtID *int32) error {
	snap := s.snap.Load()
	r, ok := snap.regionByID[regionID]
	if !ok || r.parentID != nil {
		return errRegion
	}
	if districtID != nil {
		d, ok := snap.regionByID[*districtID]
		if !ok || d.parentID == nil || *d.parentID != regionID {
			return errDistrict
		}
	}
	return nil
}

// Names returns the localized names describing a vacancy's category (with its parent)
// and location, used to make "dasturchi toshkent" or "savdo" match by catalog terms.
func (s *Service) Names(categoryID, regionID int32, districtID *int32) []Names {
	snap := s.snap.Load()
	var out []Names
	if c, ok := snap.categoryByID[categoryID]; ok {
		out = append(out, c.Name)
		if pid, ok := snap.parentOf[categoryID]; ok {
			out = append(out, snap.categoryByID[pid].Name)
		}
	}
	if r, ok := snap.regionByID[regionID]; ok {
		out = append(out, r.name)
	}
	if districtID != nil {
		if d, ok := snap.regionByID[*districtID]; ok {
			out = append(out, d.name)
		}
	}
	return out
}

// ---- skills ------------------------------------------------------------------------------

func (s *Service) SearchSkills(ctx context.Context, q string, limit int32) ([]Skill, error) {
	q = strings.TrimSpace(q)
	var rows []gen.SearchSkillsRow
	var err error
	if q == "" {
		var pop []gen.PopularSkillsRow
		pop, err = s.Q.PopularSkills(ctx, limit)
		for _, p := range pop {
			rows = append(rows, gen.SearchSkillsRow(p))
		}
	} else {
		rows, err = s.Q.SearchSkills(ctx, gen.SearchSkillsParams{Q: q, MaxResults: limit})
	}
	if err != nil {
		return nil, err
	}
	out := make([]Skill, len(rows))
	for i, r := range rows {
		out[i] = Skill{ID: r.ID, Name: r.Name}
	}
	return out, nil
}

// ResolveSkills maps free-text skill names to skill rows, creating unknown ones.
// Names are matched by slug, so "postgresql", "PostgreSQL " and "Postgre SQL" differ only
// where their slugs differ.
// Merged or renamed-away names resolve to the surviving skill through skill_aliases.
// maxItems is the caller's limit (MaxSkillsPerAd, MaxSkillsPerResume). Errors use the
// request validator's shape: "skills" for the count, "skills[i]" for one name (API-032).
func (s *Service) ResolveSkills(ctx context.Context, names []string, maxItems int) ([]Skill, error) {
	bySlug := map[string]string{}
	var slugs []string
	for i, n := range names {
		n = strings.Join(strings.Fields(n), " ")
		if n == "" {
			continue
		}
		if len([]rune(n)) > MaxSkillNameLen {
			return nil, apperr.Validation(map[string]string{fmt.Sprintf("skills[%d]", i): fmt.Sprintf("max=%d", MaxSkillNameLen)})
		}
		sl := slug.Make(n)
		if sl == "" {
			continue
		}
		if _, dup := bySlug[sl]; !dup {
			bySlug[sl] = n
			slugs = append(slugs, sl)
		}
	}
	if len(slugs) > maxItems {
		return nil, apperr.Validation(map[string]string{"skills": fmt.Sprintf("max=%d", maxItems)})
	}
	if len(slugs) == 0 {
		return nil, nil
	}

	existing, err := s.Q.GetSkillsBySlugs(ctx, slugs)
	if err != nil {
		return nil, err
	}
	found := make(map[string]Skill, len(existing))
	for _, e := range existing {
		found[e.Slug] = Skill{ID: e.ID, Name: e.Name}
	}
	out := make([]Skill, 0, len(slugs))
	for _, sl := range slugs {
		sk, ok := found[sl]
		if !ok {
			if sk, err = s.createSkill(ctx, bySlug[sl], sl); err != nil {
				return nil, err
			}
		}
		out = append(out, sk)
	}
	return out, nil
}

// createSkill adds a skill nobody has used yet. If the slug turned into an alias in the
// meantime (an admin merged or renamed concurrently), UpsertSkill inserts nothing or the
// slug trigger refuses it; either way the alias now resolves, so look it up again.
func (s *Service) createSkill(ctx context.Context, name, sl string) (Skill, error) {
	row, err := s.Q.UpsertSkill(ctx, gen.UpsertSkillParams{Name: name, Slug: sl})
	if err == nil {
		return Skill{ID: row.ID, Name: row.Name}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) && !postgres.IsUniqueViolation(err) {
		return Skill{}, err
	}
	again, err := s.Q.GetSkillsBySlugs(ctx, []string{sl})
	if err != nil {
		return Skill{}, err
	}
	if len(again) == 0 {
		return Skill{}, fmt.Errorf("catalog: skill %q neither created nor found", sl)
	}
	return Skill{ID: again[0].ID, Name: again[0].Name}, nil
}

// SearchTags is the folded text the vacancy and resume search indexes store for a list of
// skill names (one definition, so admin reindexing writes exactly what saving does).
func SearchTags(names []string) string {
	return translit.Fold(strings.Join(names, " "))
}
