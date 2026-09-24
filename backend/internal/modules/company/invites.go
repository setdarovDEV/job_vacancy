package company

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/notification"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/ratelimit"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/platform/postgres"
)

// Joining a company takes the invitee's consent (TZ FN-05): an admin sends an invite by
// e-mail, the invitee accepts or declines it within InviteDays. Until then they are not a
// member and see nothing of the company but its public profile.

const InviteDays = 7

// A company may send this many invites a day: invites e-mail any address, so they must
// not become a spam channel.
var inviteRule = ratelimit.Rule{Name: "company_invites", Limit: 50, Window: 24 * time.Hour}

var (
	ErrInviteNotFound  = apperr.NotFound("invite_not_found", "invite not found")
	ErrInviteExpired   = apperr.Conflict("invite_expired", "this invite has expired; ask for a new one")
	ErrAlreadyMember   = apperr.Conflict("already_member", "this person is already a member of the company")
	ErrNotOwner        = apperr.Forbidden("owner_only", "only the company owner can do this")
	ErrInviteEmailOnly = apperr.Forbidden("verification_required", "confirm your email to answer invites")
)

// Invite is a pending invite as the company sees it.
type Invite struct {
	ID            uuid.UUID `json:"id"`
	Email         string    `json:"email"`
	Role          string    `json:"role"`
	InvitedByName *string   `json:"invited_by_name"`
	ExpiresAt     time.Time `json:"expires_at"`
	Expired       bool      `json:"expired"`
	CreatedAt     time.Time `json:"created_at"`
}

// MyInvite is an invite as its addressee sees it: public company details only.
type MyInvite struct {
	ID            uuid.UUID `json:"id"`
	Role          string    `json:"role"`
	InvitedByName *string   `json:"invited_by_name"`
	ExpiresAt     time.Time `json:"expires_at"`
	CreatedAt     time.Time `json:"created_at"`
	Company       Summary   `json:"company"`
}

// Invite (re)sends an invite to email for role. Admins invite recruiters; the owner also
// invites admins. The invitee is told in the app and by e-mail if they have an account,
// and by e-mail otherwise; both are queued with the invite.
func (s *Service) Invite(ctx context.Context, p reqctx.Principal, ref, email string, role gen.CompanyMemberRole) (Invite, error) {
	c, myRole, err := s.Authorize(ctx, p, ref, gen.CompanyMemberRoleAdmin)
	if err != nil {
		return Invite{}, err
	}
	if role == gen.CompanyMemberRoleOwner || rank[role] >= rank[myRole] && myRole != gen.CompanyMemberRoleOwner {
		return Invite{}, ErrForbidden
	}
	email = strings.ToLower(strings.TrimSpace(email))
	invitee, err := s.Q.GetUserByEmail(ctx, &email)
	exists := err == nil
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return Invite{}, err
	}
	if exists {
		if invitee.Role != gen.UserRoleEmployer || invitee.Status != gen.UserStatusActive {
			return Invite{}, ErrMemberNotFound
		}
		if _, err := s.Q.GetMemberRole(ctx, gen.GetMemberRoleParams{CompanyID: c.ID, UserID: invitee.ID}); err == nil {
			return Invite{}, ErrAlreadyMember
		}
	}
	inviter, err := s.Q.GetUserByID(ctx, p.UserID)
	if err != nil {
		return Invite{}, err
	}
	if s.Limiter != nil {
		if ok, retry, _ := s.Limiter.Allow(ctx, inviteRule, c.ID.String()); !ok {
			return Invite{}, apperr.TooManyRequests(int(retry.Seconds()) + 1)
		}
	}

	var inv gen.CompanyInvite
	var sent notification.Sent
	err = postgres.WithPgxTx(ctx, s.Pool, func(tx pgx.Tx) error {
		var err error
		inv, err = gen.New(tx).UpsertCompanyInvite(ctx, gen.UpsertCompanyInviteParams{
			CompanyID: c.ID, Email: email, Role: role, InvitedBy: &p.UserID, TtlDays: InviteDays,
		})
		if err != nil || s.Notify == nil {
			return err
		}
		payload := notification.Payload{InviteID: inv.ID.String(), CompanyID: c.ID.String(), CompanyName: c.Name,
			Role: string(role), InviterName: inviter.FullName, ExpiresAt: inv.ExpiresAt.UTC().Format(time.RFC3339)}
		if exists {
			sent, err = s.Notify.NotifyTx(ctx, tx, notification.TypeCompanyInvite,
				[]notification.Recipient{{UserID: invitee.ID, Payload: payload}}, true)
			return err
		}
		return s.Notify.EmailAddressTx(ctx, tx, email, string(inviter.Locale), notification.TypeCompanyInvite, payload)
	})
	if err != nil {
		return Invite{}, err
	}
	sent.Publish(ctx)
	name := inviter.FullName
	return Invite{ID: inv.ID, Email: inv.Email, Role: string(inv.Role), InvitedByName: &name,
		ExpiresAt: inv.ExpiresAt, CreatedAt: inv.CreatedAt}, nil
}

// Invites lists a company's pending invites (expired ones flagged, so they can be resent).
func (s *Service) Invites(ctx context.Context, p reqctx.Principal, ref string) ([]Invite, error) {
	c, _, err := s.Authorize(ctx, p, ref, gen.CompanyMemberRoleAdmin)
	if err != nil {
		return nil, err
	}
	rows, err := s.Q.ListCompanyInvites(ctx, c.ID)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	out := make([]Invite, len(rows))
	for i, r := range rows {
		out[i] = Invite{ID: r.ID, Email: r.Email, Role: string(r.Role), InvitedByName: r.InvitedByName,
			ExpiresAt: r.ExpiresAt, Expired: !r.ExpiresAt.After(now), CreatedAt: r.CreatedAt}
	}
	return out, nil
}

// RevokeInvite withdraws a pending invite.
func (s *Service) RevokeInvite(ctx context.Context, p reqctx.Principal, ref string, id uuid.UUID) error {
	c, _, err := s.Authorize(ctx, p, ref, gen.CompanyMemberRoleAdmin)
	if err != nil {
		return err
	}
	n, err := s.Q.RevokeCompanyInvite(ctx, gen.RevokeCompanyInviteParams{ID: id, CompanyID: c.ID})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrInviteNotFound
	}
	return nil
}

// MyInvites lists the invites addressed to the caller's e-mail that can still be answered.
func (s *Service) MyInvites(ctx context.Context, userID uuid.UUID) ([]MyInvite, error) {
	u, err := s.Q.GetUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if u.Email == nil {
		return []MyInvite{}, nil
	}
	rows, err := s.Q.ListInvitesForEmail(ctx, *u.Email)
	if err != nil {
		return nil, err
	}
	out := make([]MyInvite, len(rows))
	for i, r := range rows {
		out[i] = MyInvite{ID: r.ID, Role: string(r.Role), InvitedByName: r.InvitedByName, ExpiresAt: r.ExpiresAt,
			CreatedAt: r.CreatedAt, Company: NewSummary(r.CompanyID, r.CompanyName, r.CompanySlug,
				r.CompanyLogo, r.CompanyVerified)}
	}
	return out, nil
}

// AcceptInvite makes the caller a member with the invite's role. The caller must own the
// invited address (verified e-mail) and have an employer account.
func (s *Service) AcceptInvite(ctx context.Context, p reqctx.Principal, id uuid.UUID) (DTO, error) {
	var c gen.Company
	var role gen.CompanyMemberRole
	var sent notification.Sent
	err := postgres.WithPgxTx(ctx, s.Pool, func(tx pgx.Tx) error {
		q := gen.New(tx)
		u, inv, err := s.answerable(ctx, q, p.UserID, id)
		if err != nil {
			return err
		}
		if u.EmailVerifiedAt == nil {
			return ErrInviteEmailOnly
		}
		if u.Role != gen.UserRoleEmployer {
			return ErrEmployerOnly
		}
		if c, err = q.GetCompanyByID(ctx, inv.CompanyID); err != nil {
			return err
		}
		if c.Status != gen.CompanyStatusActive {
			return ErrInviteNotFound
		}
		if _, err := q.JoinCompany(ctx, gen.JoinCompanyParams{CompanyID: inv.CompanyID, UserID: u.ID, Role: inv.Role}); err != nil {
			return err
		}
		if _, err := q.RespondInvite(ctx, gen.RespondInviteParams{ID: id, Status: gen.InviteStatusAccepted, UserID: &u.ID}); err != nil {
			return err
		}
		role = inv.Role
		if cur, err := q.GetMemberRole(ctx, gen.GetMemberRoleParams{CompanyID: c.ID, UserID: u.ID}); err == nil {
			role = cur // already a member before: keep their role
		}
		if inv.InvitedBy == nil || s.Notify == nil {
			return nil
		}
		sent, err = s.Notify.NotifyTx(ctx, tx, notification.TypeInviteAccepted, []notification.Recipient{{
			UserID: *inv.InvitedBy, Payload: notification.Payload{CompanyID: c.ID.String(), CompanyName: c.Name,
				InviterName: u.FullName, Role: string(inv.Role)},
		}}, true)
		return err
	})
	if err != nil {
		return DTO{}, err
	}
	sent.Publish(ctx)
	d := ToDTO(c)
	d.MyRole = string(role)
	return d, nil
}

// DeclineInvite turns an invite down.
func (s *Service) DeclineInvite(ctx context.Context, p reqctx.Principal, id uuid.UUID) error {
	return postgres.WithTx(ctx, s.Pool, func(q *gen.Queries) error {
		u, _, err := s.answerable(ctx, q, p.UserID, id)
		if err != nil {
			return err
		}
		_, err = q.RespondInvite(ctx, gen.RespondInviteParams{ID: id, Status: gen.InviteStatusDeclined, UserID: &u.ID})
		return err
	})
}

// answerable locks the invite and checks it is pending, unexpired and addressed to the
// user. Invites to someone else are reported as not found.
func (s *Service) answerable(ctx context.Context, q *gen.Queries, userID, id uuid.UUID) (gen.User, gen.CompanyInvite, error) {
	u, err := q.GetUserByID(ctx, userID)
	if err != nil {
		return u, gen.CompanyInvite{}, err
	}
	inv, err := q.LockInvite(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) || err == nil && (u.Email == nil || !strings.EqualFold(*u.Email, inv.Email)) {
		return u, inv, ErrInviteNotFound
	}
	if err != nil {
		return u, inv, err
	}
	if inv.Status != gen.InviteStatusPending {
		return u, inv, ErrInviteNotFound
	}
	if !inv.ExpiresAt.After(time.Now()) {
		return u, inv, ErrInviteExpired
	}
	return u, inv, nil
}

// ---- roles and ownership -------------------------------------------------------------------

// SetMemberRole changes a member's role (not the owner's). Admins manage recruiters; the
// owner manages admins too.
func (s *Service) SetMemberRole(ctx context.Context, p reqctx.Principal, ref string, userID uuid.UUID, role gen.CompanyMemberRole) error {
	c, myRole, err := s.Authorize(ctx, p, ref, gen.CompanyMemberRoleAdmin)
	if err != nil {
		return err
	}
	if role == gen.CompanyMemberRoleOwner || myRole != gen.CompanyMemberRoleOwner && rank[role] >= rank[myRole] {
		return ErrForbidden
	}
	cur, err := s.Q.GetMemberRole(ctx, gen.GetMemberRoleParams{CompanyID: c.ID, UserID: userID})
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrMemberNotFound
	}
	if err != nil {
		return err
	}
	if cur == gen.CompanyMemberRoleOwner {
		return ErrCannotRemoveOwner
	}
	if myRole != gen.CompanyMemberRoleOwner && rank[cur] >= rank[myRole] {
		return ErrForbidden
	}
	_, err = s.Q.UpdateMemberRole(ctx, gen.UpdateMemberRoleParams{CompanyID: c.ID, UserID: userID, Role: role})
	return err
}

// TransferOwnership hands the company to another member (active employer account); the
// previous owner stays on as an admin. Required before the owner can delete their account
// (TZ FN-03).
func (s *Service) TransferOwnership(ctx context.Context, p reqctx.Principal, ref string, to uuid.UUID) (DTO, error) {
	c, err := s.Resolve(ctx, ref)
	if err != nil {
		return DTO{}, err
	}
	if c.OwnerID != p.UserID {
		return DTO{}, ErrNotOwner
	}
	if c.Status != gen.CompanyStatusActive {
		return DTO{}, ErrBlocked
	}
	if to == p.UserID {
		return DTO{}, ErrAlreadyMember
	}
	target, err := s.Q.GetUserByID(ctx, to)
	if errors.Is(err, pgx.ErrNoRows) || err == nil && target.Status != gen.UserStatusActive {
		return DTO{}, ErrMemberNotFound
	}
	if err != nil {
		return DTO{}, err
	}
	n, err := s.Q.TransferCompanyOwnership(ctx, gen.TransferCompanyOwnershipParams{
		CompanyID: c.ID, NewOwner: to, OldOwner: p.UserID,
	})
	if err != nil {
		return DTO{}, err
	}
	if n == 0 {
		return DTO{}, ErrMemberNotFound
	}
	if c, err = s.Q.GetCompanyByID(ctx, c.ID); err != nil {
		return DTO{}, err
	}
	d := ToDTO(c)
	d.MyRole = string(gen.CompanyMemberRoleAdmin)
	return d, nil
}
