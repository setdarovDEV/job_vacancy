package catalog

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
)

// fakeSkills is an in-memory SkillTx; InTx commits fn's writes only when fn succeeds,
// like the real transaction, so tests can see what a failed call leaves behind.
type fakeSkills struct {
	skills   map[int32]gen.Skill
	aliases  map[string]int32
	vacLinks map[int32][]uuid.UUID
	resLinks map[int32][]uuid.UUID
	jobs     []ReindexArgs
	locked   []int32
}

func newFake() *fakeSkills {
	return &fakeSkills{skills: map[int32]gen.Skill{}, aliases: map[string]int32{},
		vacLinks: map[int32][]uuid.UUID{}, resLinks: map[int32][]uuid.UUID{}}
}

func (f *fakeSkills) InTx(ctx context.Context, fn func(SkillTx) error) error {
	snap := *f
	snap.skills, snap.aliases = clone(f.skills), clone(f.aliases)
	snap.vacLinks, snap.resLinks = clone(f.vacLinks), clone(f.resLinks)
	snap.jobs = append([]ReindexArgs{}, f.jobs...)
	if err := fn(&snap); err != nil {
		return err
	}
	*f = snap
	return nil
}

func clone[K comparable, V any](m map[K]V) map[K]V {
	out := make(map[K]V, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}

func (f *fakeSkills) GetSkillForUpdate(_ context.Context, id int32) (gen.Skill, error) {
	f.locked = append(f.locked, id)
	sk, ok := f.skills[id]
	if !ok {
		return sk, pgx.ErrNoRows
	}
	return sk, nil
}
func (f *fakeSkills) FindSkillBySlug(_ context.Context, sl string) (int32, error) {
	for id, sk := range f.skills {
		if sk.Slug == sl {
			return id, nil
		}
	}
	if id, ok := f.aliases[sl]; ok {
		return id, nil
	}
	return 0, pgx.ErrNoRows
}

// errSlugTaken mirrors the skill_slug_exclusive trigger (00015): one slug, one place.
var errSlugTaken = errors.New("unique_violation: slug held by the other table")

func (f *fakeSkills) RenameSkill(_ context.Context, a gen.RenameSkillParams) (gen.Skill, error) {
	if _, alias := f.aliases[a.Slug]; alias {
		return gen.Skill{}, errSlugTaken
	}
	sk := f.skills[a.ID]
	sk.Name, sk.Slug = a.Name, a.Slug
	f.skills[a.ID] = sk
	return sk, nil
}
func (f *fakeSkills) SetSkillVerified(_ context.Context, a gen.SetSkillVerifiedParams) (gen.Skill, error) {
	sk, ok := f.skills[a.ID]
	if !ok {
		return sk, pgx.ErrNoRows
	}
	sk.IsVerified = a.IsVerified
	f.skills[a.ID] = sk
	return sk, nil
}
func (f *fakeSkills) SetSkillsVerified(_ context.Context, ids []int32) ([]int32, error) {
	var done []int32
	for _, id := range ids {
		if sk, ok := f.skills[id]; ok {
			sk.IsVerified = true
			f.skills[id] = sk
			done = append(done, id)
		}
	}
	return done, nil
}
func (f *fakeSkills) AddSkillAlias(_ context.Context, a gen.AddSkillAliasParams) error {
	for _, sk := range f.skills {
		if sk.Slug == a.Slug {
			return errSlugTaken
		}
	}
	f.aliases[a.Slug] = a.SkillID
	return nil
}
func (f *fakeSkills) DeleteSkillAlias(_ context.Context, sl string) error {
	delete(f.aliases, sl)
	return nil
}
func (f *fakeSkills) RepointSkillAliases(_ context.Context, a gen.RepointSkillAliasesParams) error {
	for sl, id := range f.aliases {
		if id == a.SourceID {
			f.aliases[sl] = a.TargetID
		}
	}
	return nil
}
func (f *fakeSkills) ListSkillVacancyIDs(_ context.Context, id int32) ([]uuid.UUID, error) {
	return f.vacLinks[id], nil
}
func (f *fakeSkills) ListSkillResumeIDs(_ context.Context, id int32) ([]uuid.UUID, error) {
	return f.resLinks[id], nil
}
func (f *fakeSkills) CopyVacancySkillLinks(_ context.Context, a gen.CopyVacancySkillLinksParams) (int64, error) {
	before := len(f.vacLinks[a.TargetID])
	f.vacLinks[a.TargetID] = union(f.vacLinks[a.TargetID], f.vacLinks[a.SourceID])
	return int64(len(f.vacLinks[a.TargetID]) - before), nil
}
func (f *fakeSkills) CopyResumeSkillLinks(_ context.Context, a gen.CopyResumeSkillLinksParams) error {
	f.resLinks[a.TargetID] = union(f.resLinks[a.TargetID], f.resLinks[a.SourceID])
	return nil
}
func (f *fakeSkills) AddSkillUsage(_ context.Context, a gen.AddSkillUsageParams) error {
	sk := f.skills[a.ID]
	sk.UsageCount += a.N
	f.skills[a.ID] = sk
	return nil
}
func (f *fakeSkills) DeleteSkill(_ context.Context, id int32) (int64, error) {
	delete(f.skills, id)
	delete(f.vacLinks, id)
	delete(f.resLinks, id)
	for sl, a := range f.aliases {
		if a == id {
			delete(f.aliases, sl)
		}
	}
	return 1, nil
}
func (f *fakeSkills) Reindex(_ context.Context, jobs []ReindexArgs) error {
	f.jobs = append(f.jobs, jobs...)
	return nil
}

// ids collects every id the queued jobs carry.
func (f *fakeSkills) ids() (vac, res int) {
	for _, j := range f.jobs {
		vac += len(j.VacancyIDs)
		res += len(j.ResumeIDs)
	}
	return
}

func union(a, b []uuid.UUID) []uuid.UUID {
	seen := map[uuid.UUID]bool{}
	var out []uuid.UUID
	for _, id := range append(append([]uuid.UUID{}, a...), b...) {
		if !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	return out
}

var (
	vacA, vacB = uuid.New(), uuid.New()
	resA       = uuid.New()
)

func setup() (*SkillAdmin, *fakeSkills) {
	f := newFake()
	f.skills[1] = gen.Skill{ID: 1, Name: "React", Slug: "react", IsVerified: true, UsageCount: 10}
	f.skills[2] = gen.Skill{ID: 2, Name: "React.js", Slug: "react-js", UsageCount: 3}
	f.aliases["reactjs"] = 2
	f.vacLinks[1] = []uuid.UUID{vacA}
	f.vacLinks[2] = []uuid.UUID{vacA, vacB}
	f.resLinks[2] = []uuid.UUID{resA}
	return &SkillAdmin{Tx: f}, f
}

func fieldRule(err error, field string) string {
	if e, ok := apperr.As(err); ok {
		return e.Fields[field]
	}
	return ""
}

func code(err error) string {
	if e, ok := apperr.As(err); ok {
		return e.Code
	}
	return ""
}

func TestRenameKeepsOldNameAsAliasAndReindexes(t *testing.T) {
	s, f := setup()
	sk, err := s.Rename(context.Background(), 2, "  ReactJS  Native ")
	if err != nil || sk.Name != "ReactJS Native" {
		t.Fatalf("rename: %+v %v", sk, err)
	}
	if f.aliases["react-js"] != 2 {
		t.Fatalf("old slug should become an alias: %v", f.aliases)
	}
	if v, r := f.ids(); v != 2 || r != 1 {
		t.Fatalf("reindex jobs: %+v", f.jobs)
	}
}

func TestRenameOntoAnotherSkillIsRefused(t *testing.T) {
	s, f := setup()
	if _, err := s.Rename(context.Background(), 2, "react"); !errors.Is(err, ErrSkillExists) {
		t.Fatalf("own name of another skill: %v", err)
	}
	f.aliases["react-native"] = 1
	if _, err := s.Rename(context.Background(), 2, "React Native"); !errors.Is(err, ErrSkillExists) {
		t.Fatalf("alias of another skill: %v", err)
	}
	if f.skills[2].Name != "React.js" || len(f.jobs) != 0 {
		t.Fatalf("a refused rename must change nothing: %+v %v", f.skills[2], f.jobs)
	}
}

func TestRenameBackToOwnAliasReclaimsIt(t *testing.T) {
	s, f := setup()
	if _, err := s.Rename(context.Background(), 2, "ReactJS"); err != nil {
		t.Fatal(err)
	}
	if _, isAlias := f.aliases["reactjs"]; isAlias || f.skills[2].Slug != "reactjs" {
		t.Fatalf("slug must live in skills, not aliases: %v %+v", f.aliases, f.skills[2])
	}
}

func TestRenameWithoutNameChangeDoesNotReindex(t *testing.T) {
	s, f := setup()
	if _, err := s.Rename(context.Background(), 1, "React"); err != nil || len(f.jobs) != 0 {
		t.Fatalf("no-op rename: %v jobs=%v", err, f.jobs)
	}
	if _, err := s.Rename(context.Background(), 1, ""); code(err) != "validation_failed" {
		t.Fatalf("empty name accepted")
	}
}

func TestMergeMovesLinksNamesAndUsage(t *testing.T) {
	s, f := setup()
	dst, err := s.Merge(context.Background(), 2, 1)
	if err != nil || dst.ID != 1 {
		t.Fatalf("merge: %+v %v", dst, err)
	}
	if _, gone := f.skills[2]; gone {
		t.Fatal("source must be deleted")
	}
	if len(f.vacLinks[1]) != 2 || len(f.resLinks[1]) != 1 {
		t.Fatalf("links: vac=%v res=%v", f.vacLinks[1], f.resLinks[1])
	}
	if f.aliases["react-js"] != 1 || f.aliases["reactjs"] != 1 {
		t.Fatalf("source names must point at the target: %v", f.aliases)
	}
	// Source had popularity 3 over 2 vacancy links; vacA already listed the target, so
	// only vacB moved: the target gains round(3 × 1/2) = 2, not 3 (CA-021).
	if f.skills[1].UsageCount != 12 {
		t.Fatalf("popularity: %d", f.skills[1].UsageCount)
	}
	if v, _ := f.ids(); v != 2 {
		t.Fatalf("reindex jobs: %+v", f.jobs)
	}
	if f.locked[0] != 1 || f.locked[1] != 2 {
		t.Fatalf("locks must be taken in id order: %v", f.locked)
	}
}

func TestMergeRefusesSelfAndUnknown(t *testing.T) {
	s, f := setup()
	if _, err := s.Merge(context.Background(), 1, 1); err == nil {
		t.Fatal("merge into itself accepted")
	}
	// The path names the source, the body the target (API-028).
	if _, err := s.Merge(context.Background(), 2, 99); fieldRule(err, "into") != "not_found" {
		t.Fatalf("unknown target: %v", err)
	}
	if _, err := s.Merge(context.Background(), 99, 1); !errors.Is(err, ErrSkillNotFound) {
		t.Fatalf("unknown source: %v", err)
	}
	if _, ok := f.skills[2]; !ok || len(f.jobs) != 0 {
		t.Fatal("a failed merge must change nothing")
	}
}

func TestDeleteReindexesWhatUsedIt(t *testing.T) {
	s, f := setup()
	if err := s.Delete(context.Background(), 2); err != nil {
		t.Fatal(err)
	}
	if _, r := f.ids(); r != 1 {
		t.Fatalf("reindex jobs: %+v", f.jobs)
	}
	if err := s.Delete(context.Background(), 2); !errors.Is(err, ErrSkillNotFound) {
		t.Fatalf("second delete: %v", err)
	}
}

func TestUnusedSkillChangesEnqueueNothing(t *testing.T) {
	s, f := setup()
	f.skills[3] = gen.Skill{ID: 3, Name: "Cobol", Slug: "cobol"}
	if _, err := s.Rename(context.Background(), 3, "COBOL"); err != nil {
		t.Fatal(err)
	}
	if err := s.Delete(context.Background(), 3); err != nil || len(f.jobs) != 0 {
		t.Fatalf("jobs for an unused skill: %v %v", err, f.jobs)
	}
}

func TestVerifyManyIsAllOrNothing(t *testing.T) {
	s, f := setup()
	if err := s.VerifyMany(context.Background(), []int32{2, 99}); fieldRule(err, "ids") != "not_found" {
		t.Fatalf("unknown id: %v", err)
	}
	if f.skills[2].IsVerified {
		t.Fatal("a failed bulk verify must change nothing")
	}
	if err := s.VerifyMany(context.Background(), []int32{2}); err != nil || !f.skills[2].IsVerified {
		t.Fatalf("verify: %v", err)
	}
}

// A skill used by thousands of items is refreshed by several bounded jobs (CA-018).
func TestReindexIsChunked(t *testing.T) {
	ids := make([]uuid.UUID, 2*reindexChunk+5)
	for i := range ids {
		ids[i] = uuid.New()
	}
	jobs := ReindexArgs{VacancyIDs: ids, ResumeIDs: ids[:3]}.chunks(reindexChunk)
	if len(jobs) != 4 || len(jobs[0].VacancyIDs) != reindexChunk || len(jobs[2].VacancyIDs) != 5 || len(jobs[3].ResumeIDs) != 3 {
		t.Fatalf("chunks: %d", len(jobs))
	}
	if len((ReindexArgs{}).chunks(reindexChunk)) != 0 {
		t.Fatal("nothing to refresh, no jobs")
	}
}

func TestNameLengthRule(t *testing.T) {
	s, _ := setup()
	long := strings.Repeat("x", MaxSkillNameLen+1)
	if _, err := s.Rename(context.Background(), 1, long); fieldRule(err, "name") != "max=50" {
		t.Fatalf("got %v", err)
	}
}

func TestMergedPopularity(t *testing.T) {
	for _, c := range []struct {
		pop          int32
		moved        int64
		linked, want int
	}{{10, 2, 2, 10}, {10, 0, 2, 0}, {10, 1, 3, 3}, {5, 1, 0, 0}} {
		if got := mergedPopularity(c.pop, c.moved, c.linked); int(got) != c.want {
			t.Fatalf("%+v: %d", c, got)
		}
	}
}
