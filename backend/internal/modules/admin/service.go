// Package admin is the platform admin panel's API (TZ FN-01): user search and blocking,
// company blocking, skill moderation (verification and merging), statistics and the
// audit log. Every write records an admin_audit_log row in its own transaction; routes
// are mounted behind RequireRole("admin").
package admin

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/audit"
	"jobvacancy.uz/backend/internal/modules/company"
	"jobvacancy.uz/backend/internal/modules/vacancy"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/platform/postgres"
)

var (
	ErrUserNotFound    = apperr.NotFound("user_not_found", "user not found")
	ErrCannotBlockSelf = apperr.BadRequest("cannot_block_self", "you can't block your own account")
	ErrCannotBlockAdm  = apperr.Forbidden("cannot_block_admin", "admins can't be blocked here")
	ErrUserDeleted     = apperr.Conflict("user_deleted", "this account was deleted")
	ErrSkillNotFound   = apperr.NotFound("skill_not_found", "skill not found")
	ErrSkillMergeSelf  = apperr.BadRequest("skill_merge_self", "a skill can't be merged into itself")
	errReason          = apperr.Validation(map[string]string{"reason": "min=3"})
)

// Revoker cuts off access tokens of revoked sessions (auth.RevocationStore).
type Revoker interface {
	Revoke(ctx context.Context, ids ...uuid.UUID) error
}

// Inserter enqueues jobs inside a transaction (River InsertManyTx).
type Inserter interface {
	InsertManyTx(ctx context.Context, tx pgx.Tx, args []river.JobArgs) error
}

type Service struct {
	Pool      *pgxpool.Pool
	Q         *gen.Queries
	Companies *company.Service
	Revoked   Revoker
	Cache     *vacancy.PublicCache // nil skips cache invalidation
	Jobs      Inserter             // search reindex after a skill merge
	Log       *slog.Logger
}

// ---- users -------------------------------------------------------------------------------

// UserFilter selects a page of the user search.
type UserFilter struct {
	Q      string
	Role   *gen.UserRole
	Status *gen.UserStatus
	Before *uuid.UUID
	Limit  int
}

// Users searches users by a substring of name, e-mail or phone, newest first.
func (s *Service) Users(ctx context.Context, f UserFilter) ([]UserDTO, *uuid.UUID, error) {
	rows, err := postgres.PlanPerCall(s.Pool).AdminSearchUsers(ctx, gen.AdminSearchUsersParams{
		Q: likeArg(f.Q), Role: f.Role, Status: f.Status, BeforeID: f.Before, MaxResults: int32(f.Limit + 1),
	})
	if err != nil {
		return nil, nil, err
	}
	var next *uuid.UUID
	if len(rows) > f.Limit {
		rows = rows[:f.Limit]
		next = &rows[len(rows)-1].ID
	}
	out := make([]UserDTO, len(rows))
	for i, r := range rows {
		out[i] = userOf(gen.User{ID: r.ID, Email: r.Email, Phone: r.Phone, FullName: r.FullName,
			AvatarUrl: r.AvatarUrl, Role: r.Role, Status: r.Status, EmailVerifiedAt: r.EmailVerifiedAt,
			PhoneVerifiedAt: r.PhoneVerifiedAt, LastSeenAt: r.LastSeenAt, CreatedAt: r.CreatedAt, DeletedAt: r.DeletedAt})
	}
	return out, next, nil
}

// User is one user with their company memberships.
func (s *Service) User(ctx context.Context, id uuid.UUID) (UserDetail, error) {
	u, err := s.Q.GetUserByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return UserDetail{}, ErrUserNotFound
	}
	if err != nil {
		return UserDetail{}, err
	}
	rows, err := s.Q.ListUserCompanies(ctx, id)
	if err != nil {
		return UserDetail{}, err
	}
	d := UserDetail{UserDTO: userOf(u), Companies: make([]Membership, len(rows))}
	for i, r := range rows {
		d.Companies[i] = Membership{ID: r.Company.ID, Name: r.Company.Name, Slug: r.Company.Slug,
			Status: string(r.Company.Status), Role: string(r.Role)}
	}
	return d, nil
}

// BlockUser blocks an account: it can't sign in, every session is revoked (access tokens
// stop working at once) and the vacancies it published or sent to moderation are
// unpublished. Blocking an already blocked user changes nothing.
func (s *Service) BlockUser(ctx context.Context, admin reqctx.Principal, id uuid.UUID, reason string) (UserDTO, error) {
	reason = strings.TrimSpace(reason)
	if len([]rune(reason)) < 3 {
		return UserDTO{}, errReason
	}
	if id == admin.UserID {
		return UserDTO{}, ErrCannotBlockSelf
	}
	var u gen.User
	var sessions []uuid.UUID
	var refs []gen.UnpublishUserVacanciesRow
	err := postgres.WithTx(ctx, s.Pool, func(q *gen.Queries) error {
		cur, err := q.GetUserByID(ctx, id)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrUserNotFound
		}
		if err != nil {
			return err
		}
		switch {
		case cur.Role == gen.UserRoleAdmin:
			return ErrCannotBlockAdm
		case cur.Status == gen.UserStatusDeleted:
			return ErrUserDeleted
		case cur.Status == gen.UserStatusBlocked:
			u = cur
			return errUnchanged
		}
		if u, err = q.SetUserStatus(ctx, gen.SetUserStatusParams{ID: id, Status: gen.UserStatusBlocked, FromStatus: gen.UserStatusActive}); err != nil {
			return err
		}
		if sessions, err = q.RevokeAllUserSessions(ctx, id); err != nil {
			return err
		}
		if refs, err = q.UnpublishUserVacancies(ctx, gen.UnpublishUserVacanciesParams{AdminID: &admin.UserID, UserID: id}); err != nil {
			return err
		}
		ids := make([]uuid.UUID, len(refs))
		for i, r := range refs {
			ids[i] = r.ID
		}
		return audit.Write(ctx, q, audit.Entry{Action: "user.block", ObjectType: audit.ObjectUser, ObjectID: id.String(),
			Details: map[string]any{"reason": reason, "sessions_revoked": len(sessions), "vacancies_unpublished": ids}})
	})
	if errors.Is(err, errUnchanged) {
		return userOf(u), nil
	}
	if err != nil {
		return UserDTO{}, err
	}
	s.afterCommit(ctx, sessions, userRefs(refs))
	s.Log.InfoContext(ctx, "user blocked", "user_id", id, "sessions", len(sessions), "vacancies", len(refs))
	return userOf(u), nil
}

// UnblockUser lets a blocked user sign in again. Their unpublished vacancies stay
// archived; republishing them goes through moderation.
func (s *Service) UnblockUser(ctx context.Context, id uuid.UUID) (UserDTO, error) {
	var u gen.User
	err := postgres.WithTx(ctx, s.Pool, func(q *gen.Queries) error {
		cur, err := q.GetUserByID(ctx, id)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrUserNotFound
		}
		if err != nil {
			return err
		}
		switch cur.Status {
		case gen.UserStatusDeleted:
			return ErrUserDeleted
		case gen.UserStatusActive:
			u = cur
			return errUnchanged
		}
		if u, err = q.SetUserStatus(ctx, gen.SetUserStatusParams{ID: id, Status: gen.UserStatusActive, FromStatus: gen.UserStatusBlocked}); err != nil {
			return err
		}
		return audit.Write(ctx, q, audit.Entry{Action: "user.unblock", ObjectType: audit.ObjectUser, ObjectID: id.String()})
	})
	if err != nil && !errors.Is(err, errUnchanged) {
		return UserDTO{}, err
	}
	return userOf(u), nil
}

// errUnchanged ends a transaction that has nothing to do (rolled back, not an error).
var errUnchanged = errors.New("unchanged")

// afterCommit cuts off the revoked sessions' access tokens and drops the unpublished
// vacancies' cached pages, on a context that outlives a client hanging up.
func (s *Service) afterCommit(ctx context.Context, sessions []uuid.UUID, refs []vacancy.VacancyRef) {
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 3*time.Second)
	defer cancel()
	if len(sessions) > 0 && s.Revoked != nil {
		if err := s.Revoked.Revoke(ctx, sessions...); err != nil {
			// The sessions are revoked in the database: refresh fails, and access tokens
			// expire within their 15-minute lifetime.
			s.Log.ErrorContext(ctx, "revoke access tokens", "sessions", len(sessions), "err", err)
		}
	}
	s.Cache.VacanciesChanged(ctx, refs...)
}

func userRefs(rows []gen.UnpublishUserVacanciesRow) []vacancy.VacancyRef {
	out := make([]vacancy.VacancyRef, len(rows))
	for i, r := range rows {
		out[i] = vacancy.VacancyRef{ID: r.ID, Slug: r.Slug, CompanyID: r.CompanyID, CompanySlug: r.CompanySlug}
	}
	return out
}

// likeArg turns a search box value into a LIKE argument: trimmed, lower-cased, wildcards
// escaped, at most 100 characters; nil when empty.
func likeArg(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	if r := []rune(s); len(r) > 100 {
		s = string(r[:100])
	}
	s = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(strings.ToLower(s))
	return &s
}
