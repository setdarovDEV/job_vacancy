// Package admin implements platform administration: overview counters, the company and
// user directories, and account moderation. Company rules (verification, blocking) live
// in company.Service and vacancy moderation in vacancy.Service; admin only orchestrates
// them and adds the admin-side projections.
package admin

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/cursor"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
)

var (
	ErrUserNotFound = apperr.NotFound("user_not_found", "user not found")
	// Guards against an admin locking themselves out or silently dropping their own role.
	ErrCannotBlockSelf     = apperr.Forbidden("admin_cannot_block_self", "you can't block your own account")
	ErrCannotChangeOwnRole = apperr.Forbidden("admin_cannot_change_own_role", "you can't change your own role")
)

// Store is the slice of the generated queries admin reads and writes (*gen.Queries).
type Store interface {
	AdminStats(ctx context.Context) (gen.AdminStatsRow, error)
	AdminListCompanies(ctx context.Context, arg gen.AdminListCompaniesParams) ([]gen.AdminListCompaniesRow, error)
	AdminGetCompany(ctx context.Context, id uuid.UUID) (gen.AdminGetCompanyRow, error)
	AdminListUsers(ctx context.Context, arg gen.AdminListUsersParams) ([]gen.User, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (gen.User, error)
	SetUserRoleByID(ctx context.Context, arg gen.SetUserRoleByIDParams) (gen.User, error)
	SetUserStatus(ctx context.Context, arg gen.SetUserStatusParams) (gen.User, error)
	AdminListSkillsNewest(ctx context.Context, arg gen.AdminListSkillsNewestParams) ([]gen.SkillDirectory, error)
	AdminListSkillsByPopularity(ctx context.Context, arg gen.AdminListSkillsByPopularityParams) ([]gen.SkillDirectory, error)
	AdminListSkillsInUse(ctx context.Context, arg gen.AdminListSkillsInUseParams) ([]gen.SkillDirectory, error)
	AdminGetSkill(ctx context.Context, id int32) (gen.SkillDirectory, error)
	AdminGetSkills(ctx context.Context, ids []int32) ([]gen.SkillDirectory, error)
}

// CompanyModerator applies the company module's admin-only rules (company.Service).
type CompanyModerator interface {
	SetVerified(ctx context.Context, ref string, verified bool) (gen.Company, error)
	SetBlocked(ctx context.Context, ref string, blocked bool) (gen.Company, error)
}

// SessionRevoker signs a user out of every device at once (auth.Service). Access tokens
// carry the role and are checked against a revocation list, so revoking is what makes a
// block or a role change take effect immediately instead of when the token expires.
type SessionRevoker interface {
	RevokeAll(ctx context.Context, userID uuid.UUID) error
}

type Service struct {
	Store     Store
	Companies CompanyModerator
	Sessions  SessionRevoker
	Skills    SkillCurator
}

// CompanyFilter selects a company directory page; nil fields don't filter.
type CompanyFilter struct {
	Query    string
	Status   *gen.CompanyStatus
	Verified *bool
	After    *cursor.TimeID
	Limit    int
}

// UserFilter selects a user directory page; nil fields don't filter.
type UserFilter struct {
	Query  string
	Role   *gen.UserRole
	Status *gen.UserStatus
	After  *cursor.TimeID
	Limit  int
}

// AdminCompany is the company plus the owner and counters admins see in the directory.
type AdminCompany = gen.AdminGetCompanyRow

func (s *Service) Stats(ctx context.Context) (gen.AdminStatsRow, error) {
	return s.Store.AdminStats(ctx)
}

// ---- companies ---------------------------------------------------------------------------

func (s *Service) ListCompanies(ctx context.Context, f CompanyFilter) ([]AdminCompany, cursor.Meta, error) {
	p := gen.AdminListCompaniesParams{Q: optional(f.Query), Status: f.Status, Verified: f.Verified, MaxResults: int32(f.Limit + 1)}
	if f.After != nil {
		p.AfterT, p.AfterID = &f.After.T, &f.After.ID
	}
	rows, err := s.Store.AdminListCompanies(ctx, p)
	if err != nil {
		return nil, cursor.Meta{}, err
	}
	out := make([]AdminCompany, len(rows))
	for i, r := range rows {
		out[i] = AdminCompany(r)
	}
	page, meta := cursor.Page(out, f.Limit, func(r AdminCompany) any {
		return cursor.TimeID{T: r.Company.CreatedAt, ID: r.Company.ID}
	})
	return page, meta, nil
}

// SetCompanyVerified and SetCompanyBlocked apply the company module's rule, then re-read
// the directory projection so the response has the same shape as a list row.
func (s *Service) SetCompanyVerified(ctx context.Context, ref string, verified bool) (AdminCompany, error) {
	c, err := s.Companies.SetVerified(ctx, ref, verified)
	if err != nil {
		return AdminCompany{}, err
	}
	return s.Store.AdminGetCompany(ctx, c.ID)
}

func (s *Service) SetCompanyBlocked(ctx context.Context, ref string, blocked bool) (AdminCompany, error) {
	c, err := s.Companies.SetBlocked(ctx, ref, blocked)
	if err != nil {
		return AdminCompany{}, err
	}
	return s.Store.AdminGetCompany(ctx, c.ID)
}

// ---- users -------------------------------------------------------------------------------

func (s *Service) ListUsers(ctx context.Context, f UserFilter) ([]gen.User, cursor.Meta, error) {
	p := gen.AdminListUsersParams{Q: optional(f.Query), Role: f.Role, Status: f.Status, MaxResults: int32(f.Limit + 1)}
	if f.After != nil {
		p.AfterT, p.AfterID = &f.After.T, &f.After.ID
	}
	rows, err := s.Store.AdminListUsers(ctx, p)
	if err != nil {
		return nil, cursor.Meta{}, err
	}
	page, meta := cursor.Page(rows, f.Limit, func(u gen.User) any { return cursor.TimeID{T: u.CreatedAt, ID: u.ID} })
	return page, meta, nil
}

// SetUserRole changes a user's platform role and signs them out everywhere, because the
// role travels inside their access tokens. Sessions are revoked even when the role already
// matches: if an earlier call changed the role but failed to revoke, a retry finishes it.
func (s *Service) SetUserRole(ctx context.Context, actor reqctx.Principal, id uuid.UUID, role gen.UserRole) (gen.User, error) {
	if id == actor.UserID {
		return gen.User{}, ErrCannotChangeOwnRole
	}
	u, err := s.Store.GetUserByID(ctx, id)
	if err != nil {
		return u, userNotFound(err)
	}
	// Deleted accounts don't exist for admins (the list and the other operations skip them).
	if u.Status == gen.UserStatusDeleted {
		return gen.User{}, ErrUserNotFound
	}
	if u.Role != role {
		if u, err = s.Store.SetUserRoleByID(ctx, gen.SetUserRoleByIDParams{ID: id, Role: role}); err != nil {
			return u, userNotFound(err)
		}
	}
	return u, s.Sessions.RevokeAll(ctx, id)
}

// SetUserBlocked blocks or unblocks a user. Blocking always revokes every session (even if
// the user was already blocked) so a retry completes a revocation that failed before;
// login and token refresh refuse non-active accounts on their own.
func (s *Service) SetUserBlocked(ctx context.Context, actor reqctx.Principal, id uuid.UUID, blocked bool) (gen.User, error) {
	if id == actor.UserID {
		return gen.User{}, ErrCannotBlockSelf
	}
	status := gen.UserStatusActive
	if blocked {
		status = gen.UserStatusBlocked
	}
	u, err := s.Store.SetUserStatus(ctx, gen.SetUserStatusParams{ID: id, Status: status})
	if err != nil {
		return u, userNotFound(err)
	}
	if blocked {
		return u, s.Sessions.RevokeAll(ctx, id)
	}
	return u, nil
}

func userNotFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrUserNotFound
	}
	return err
}

func optional(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
