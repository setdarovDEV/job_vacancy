package admin

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/pkg/cursor"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
)

// ---- fakes -------------------------------------------------------------------------------

type fakeStore struct {
	Store                    // unused methods panic if called
	users                    map[uuid.UUID]gen.User
	roleWrites, statusWrites int
	companyReads             int
	lastSkillLimit           int32
}

func (f *fakeStore) AdminListSkillsNewest(_ context.Context, p gen.AdminListSkillsNewestParams) ([]gen.SkillDirectory, error) {
	f.lastSkillLimit = p.MaxResults
	return nil, nil
}

func (f *fakeStore) GetUserByID(_ context.Context, id uuid.UUID) (gen.User, error) {
	u, ok := f.users[id]
	if !ok {
		return u, pgx.ErrNoRows
	}
	return u, nil
}

func (f *fakeStore) SetUserRoleByID(_ context.Context, p gen.SetUserRoleByIDParams) (gen.User, error) {
	f.roleWrites++
	u := f.users[p.ID]
	u.Role = p.Role
	f.users[p.ID] = u
	return u, nil
}

func (f *fakeStore) SetUserStatus(_ context.Context, p gen.SetUserStatusParams) (gen.User, error) {
	u, ok := f.users[p.ID]
	if !ok {
		return u, pgx.ErrNoRows
	}
	f.statusWrites++
	u.Status = p.Status
	f.users[p.ID] = u
	return u, nil
}

func (f *fakeStore) AdminGetCompany(_ context.Context, id uuid.UUID) (gen.AdminGetCompanyRow, error) {
	f.companyReads++
	return gen.AdminGetCompanyRow{Company: gen.Company{ID: id}, OwnerName: "Owner", OpenVacancies: 3}, nil
}

type fakeRevoker struct {
	revoked []uuid.UUID
	fail    error
}

func (f *fakeRevoker) RevokeAll(_ context.Context, id uuid.UUID) error {
	if f.fail != nil {
		return f.fail
	}
	f.revoked = append(f.revoked, id)
	return nil
}

type fakeCompanies struct{ blocked, verified []bool }

func (f *fakeCompanies) SetVerified(_ context.Context, _ string, v bool) (gen.Company, error) {
	f.verified = append(f.verified, v)
	return gen.Company{ID: uuid.New()}, nil
}

func (f *fakeCompanies) SetBlocked(_ context.Context, _ string, b bool) (gen.Company, error) {
	f.blocked = append(f.blocked, b)
	return gen.Company{ID: uuid.New()}, nil
}

func setup() (*Service, *fakeStore, *fakeRevoker, *fakeCompanies, reqctx.Principal, uuid.UUID) {
	admin := reqctx.Principal{UserID: uuid.New(), Role: "admin"}
	target := uuid.New()
	st := &fakeStore{users: map[uuid.UUID]gen.User{
		target: {ID: target, Role: gen.UserRoleSeeker, Status: gen.UserStatusActive},
	}}
	rv, co := &fakeRevoker{}, &fakeCompanies{}
	return &Service{Store: st, Companies: co, Sessions: rv}, st, rv, co, admin, target
}

// ---- service -----------------------------------------------------------------------------

func TestAdminCannotTargetThemselves(t *testing.T) {
	s, _, rv, _, me, _ := setup()
	if _, err := s.SetUserBlocked(context.Background(), me, me.UserID, true); !errors.Is(err, ErrCannotBlockSelf) {
		t.Fatalf("block self: got %v", err)
	}
	if _, err := s.SetUserRole(context.Background(), me, me.UserID, gen.UserRoleSeeker); !errors.Is(err, ErrCannotChangeOwnRole) {
		t.Fatalf("change own role: got %v", err)
	}
	if len(rv.revoked) != 0 {
		t.Fatal("nothing may be revoked for a refused self-action")
	}
}

func TestRoleChangeRevokesSessions(t *testing.T) {
	s, st, rv, _, me, target := setup()
	u, err := s.SetUserRole(context.Background(), me, target, gen.UserRoleEmployer)
	if err != nil || u.Role != gen.UserRoleEmployer {
		t.Fatalf("got %v, %v", u.Role, err)
	}
	if st.roleWrites != 1 || len(rv.revoked) != 1 || rv.revoked[0] != target {
		t.Fatalf("writes=%d revoked=%v", st.roleWrites, rv.revoked)
	}
}

// CA-001: a retry after a failed revocation must still revoke, although the role matches.
func TestRoleChangeRetryCompletesRevocation(t *testing.T) {
	s, st, rv, _, me, target := setup()
	rv.fail = errors.New("redis down")
	if _, err := s.SetUserRole(context.Background(), me, target, gen.UserRoleAdmin); err == nil {
		t.Fatal("revocation failure must surface")
	}
	rv.fail = nil
	if _, err := s.SetUserRole(context.Background(), me, target, gen.UserRoleAdmin); err != nil {
		t.Fatal(err)
	}
	if st.roleWrites != 1 || len(rv.revoked) != 1 {
		t.Fatalf("retry: writes=%d revoked=%v (want 1 write, 1 revoke)", st.roleWrites, rv.revoked)
	}
}

func TestBlockRevokesUnblockDoesNot(t *testing.T) {
	s, _, rv, _, me, target := setup()
	if u, err := s.SetUserBlocked(context.Background(), me, target, true); err != nil || u.Status != gen.UserStatusBlocked {
		t.Fatalf("block: %v %v", u.Status, err)
	}
	if _, err := s.SetUserBlocked(context.Background(), me, target, true); err != nil { // already blocked: revoke again
		t.Fatal(err)
	}
	if _, err := s.SetUserBlocked(context.Background(), me, target, false); err != nil {
		t.Fatal(err)
	}
	if len(rv.revoked) != 2 {
		t.Fatalf("revoked %d times, want 2 (each block, not the unblock)", len(rv.revoked))
	}
}

func TestUnknownUser(t *testing.T) {
	s, _, _, _, me, _ := setup()
	if _, err := s.SetUserBlocked(context.Background(), me, uuid.New(), true); !errors.Is(err, ErrUserNotFound) {
		t.Fatalf("block: %v", err)
	}
	if _, err := s.SetUserRole(context.Background(), me, uuid.New(), gen.UserRoleAdmin); !errors.Is(err, ErrUserNotFound) {
		t.Fatalf("role: %v", err)
	}
}

// API-003: company mutations delegate the rule and answer with the full list projection.
func TestCompanyMutationsDelegateAndReturnFullRow(t *testing.T) {
	s, st, _, co, _, _ := setup()
	c, err := s.SetCompanyBlocked(context.Background(), "acme", true)
	if err != nil || c.OwnerName != "Owner" || c.OpenVacancies != 3 {
		t.Fatalf("block: %+v %v", c, err)
	}
	if _, err := s.SetCompanyVerified(context.Background(), "acme", true); err != nil {
		t.Fatal(err)
	}
	if len(co.blocked) != 1 || !co.blocked[0] || len(co.verified) != 1 || st.companyReads != 2 {
		t.Fatalf("blocked=%v verified=%v reads=%d", co.blocked, co.verified, st.companyReads)
	}
}

// ---- parsing -----------------------------------------------------------------------------

func TestSearchTextIsTrimmedAndCapped(t *testing.T) {
	if got := searchText("  kassir  "); got != "kassir" {
		t.Errorf("trim: %q", got)
	}
	if got := searchText(strings.Repeat("ў", 150)); len([]rune(got)) != maxQueryLen {
		t.Errorf("cap: %d runes", len([]rune(got)))
	}
}

// API-013: a deleted account is "not found" whatever role is requested, and nothing is revoked.
func TestRoleChangeOnDeletedUserIsNotFound(t *testing.T) {
	s, st, rv, _, me, target := setup()
	u := st.users[target]
	u.Status = gen.UserStatusDeleted
	st.users[target] = u
	for _, role := range []gen.UserRole{gen.UserRoleSeeker, gen.UserRoleEmployer} {
		if _, err := s.SetUserRole(context.Background(), me, target, role); !errors.Is(err, ErrUserNotFound) {
			t.Fatalf("role %s: got %v", role, err)
		}
	}
	if st.roleWrites != 0 || len(rv.revoked) != 0 {
		t.Fatalf("writes=%d revokes=%d", st.roleWrites, len(rv.revoked))
	}
}

// A cursor from one skill ordering can't be used with the other.
func TestSkillCursorMustMatchSort(t *testing.T) {
	s, _, _, _, _, _ := setup()
	_, _, err := s.ListSkills(context.Background(), SkillFilter{Sort: SkillSortPopularity, Limit: 10,
		After: &SkillCursor{Sort: SkillSortNewest, N: 1, ID: 1}})
	if !errors.Is(err, cursor.ErrBadCursor) {
		t.Fatalf("got %v", err)
	}
}

// The rename request's validate tag can't reference catalog.MaxSkillNameLen; keep them equal.
func TestRenameLimitMatchesCatalog(t *testing.T) {
	f, _ := reflect.TypeOf(renameSkillRequest{}).FieldByName("Name")
	want := fmt.Sprintf("required,max=%d", catalog.MaxSkillNameLen)
	if got := f.Tag.Get("validate"); got != want {
		t.Fatalf("validate tag %q, want %q", got, want)
	}
}

// The verify-many cap is the admin page size, like every other admin batch.
func TestVerifyManyCapMatchesAdminLimit(t *testing.T) {
	f, _ := reflect.TypeOf(verifySkillsRequest{}).FieldByName("IDs")
	if !strings.Contains(f.Tag.Get("validate"), fmt.Sprintf("max=%d,", cursor.AdminMaxLimit)) {
		t.Fatalf("tag %q", f.Tag.Get("validate"))
	}
}

// Zero values select the default ordering and page size instead of failing.
func TestListSkillsDefaults(t *testing.T) {
	s, st, _, _, _, _ := setup()
	if _, _, err := s.ListSkills(context.Background(), SkillFilter{}); err != nil {
		t.Fatal(err)
	}
	if st.lastSkillLimit != int32(cursor.AdminDefaultLimit+1) {
		t.Fatalf("limit %d", st.lastSkillLimit)
	}
}

// OO-032: every advertised sort has an ordering, so the handler's check and the
// service's lookup can't drift apart.
func TestEverySkillSortHasAnOrdering(t *testing.T) {
	for _, s := range SkillSorts {
		if _, ok := skillOrders[s]; !ok {
			t.Fatalf("sort %q has no ordering", s)
		}
	}
	if len(skillOrders) != len(SkillSorts) {
		t.Fatalf("%d orderings for %d sorts", len(skillOrders), len(SkillSorts))
	}
}
