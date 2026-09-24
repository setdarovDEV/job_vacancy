// Package account deletes user accounts (TZ FN-03).
//
// Deletion is confirmed with the password, or for Google-only accounts with a fresh
// Google ID token or a sign-in less than ten minutes old. In one transaction it:
//   - refuses while the user owns a company that has other members (ownership must be
//     transferred first); a company the user is the only member of closes with the account
//     (its vacancies are unpublished, the company disappears from the site);
//   - deletes resumes nobody applied with and empties the others (employers keep the
//     application, shown as "deleted user");
//   - deletes uploads (the objects are removed by a job queued in the same transaction),
//     notifications, devices, saved searches and vacancies, memberships and pending invites;
//   - revokes every session;
//   - anonymizes the user row: name, e-mail, phone, avatar, Telegram and Google links are
//     cleared, the e-mail becomes a placeholder so the address can register again, and the
//     status becomes deleted, which blocks every sign-in path.
package account

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
	"jobvacancy.uz/backend/internal/modules/auth"
	"jobvacancy.uz/backend/internal/modules/file"
	"jobvacancy.uz/backend/internal/modules/vacancy"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/hash"
	"jobvacancy.uz/backend/internal/pkg/ratelimit"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/platform/postgres"
)

// RecentSignIn is how fresh a session must be to delete a Google-only account without a
// new Google ID token.
const RecentSignIn = 10 * time.Minute

// purgeBatch is how many stored objects one purge job removes.
const purgeBatch = 200

var (
	ErrReauthRequired = apperr.Forbidden("reauth_required", "confirm it's you: sign in again or confirm with Google")
	errPassword       = apperr.Validation(map[string]string{"password": "required"})
)

// ownershipError lists the companies whose ownership must be transferred first.
func ownershipError(slugs []string) error {
	e := apperr.Conflict("ownership_transfer_required", "transfer the ownership of your companies to another member first")
	e.Fields = map[string]string{"companies": strings.Join(slugs, ",")}
	return e
}

// Revoker cuts off access tokens of revoked sessions (auth.RevocationStore).
type Revoker interface {
	Revoke(ctx context.Context, ids ...uuid.UUID) error
}

// Inserter enqueues jobs inside a transaction (River InsertManyTx).
type Inserter interface {
	InsertManyTx(ctx context.Context, tx pgx.Tx, args []river.JobArgs) error
}

// GoogleVerifier checks Google ID tokens (auth.GoogleVerifier); nil disables that path.
type GoogleVerifier interface {
	Verify(raw string) (*auth.GoogleIdentity, error)
}

// Wrong passwords on DELETE /me are limited like sign-ins, so a stolen access token can't
// be used to guess the password.
var deleteRule = ratelimit.Rule{Name: "account_delete", Limit: 10, Window: 15 * time.Minute}

type Service struct {
	Pool    *pgxpool.Pool
	Q       *gen.Queries
	Limiter *ratelimit.Limiter // nil: no limit
	Revoked Revoker
	Google  GoogleVerifier
	Jobs    Inserter
	Cache   *vacancy.PublicCache // nil skips cache invalidation
	Log     *slog.Logger
}

// DeleteInput confirms the deletion.
type DeleteInput struct {
	Password      string `json:"password" validate:"max=72"`
	GoogleIDToken string `json:"google_id_token" validate:"max=8192"`
}

// Delete deletes the caller's account (see the package comment).
func (s *Service) Delete(ctx context.Context, p reqctx.Principal, in DeleteInput) error {
	u, err := s.Q.GetUserByID(ctx, p.UserID)
	if err != nil {
		return err
	}
	if u.Status != gen.UserStatusActive {
		return auth.ErrAccountBlocked
	}
	if s.Limiter != nil {
		if ok, retry, _ := s.Limiter.Allow(ctx, deleteRule, u.ID.String()); !ok {
			return apperr.TooManyRequests(int(retry.Seconds()) + 1)
		}
	}
	if err := s.reauth(ctx, u, p.SessionID, in); err != nil {
		return err
	}

	var sessions []uuid.UUID
	var unpublished []vacancy.VacancyRef
	var closed []gen.ListOwnedCompaniesRow
	err = postgres.WithPgxTx(ctx, s.Pool, func(tx pgx.Tx) error {
		q := gen.New(tx)
		owned, err := q.ListOwnedCompanies(ctx, u.ID)
		if err != nil {
			return err
		}
		var blockers []string
		for _, c := range owned {
			if c.OtherMembers > 0 {
				blockers = append(blockers, c.Slug)
			}
		}
		if len(blockers) > 0 {
			return ownershipError(blockers)
		}
		for _, c := range owned { // the user is the only member: the company closes
			refs, err := q.UnpublishCompanyVacancies(ctx, gen.UnpublishCompanyVacanciesParams{CompanyID: c.ID})
			if err != nil {
				return err
			}
			for _, r := range refs {
				unpublished = append(unpublished, vacancy.VacancyRef{ID: r.ID, Slug: r.Slug, CompanyID: r.CompanyID, CompanySlug: r.CompanySlug})
			}
			if err := q.CloseCompany(ctx, c.ID); err != nil {
				return err
			}
		}
		closed = owned
		if _, err := q.DeleteUnusedResumes(ctx, u.ID); err != nil {
			return err
		}
		if _, err := q.WipeUserResumes(ctx, u.ID); err != nil {
			return err
		}
		files, err := q.DeleteUserFiles(ctx, u.ID)
		if err != nil {
			return err
		}
		if err := q.PurgeUserData(ctx, gen.PurgeUserDataParams{UserID: u.ID, Email: u.Email}); err != nil {
			return err
		}
		if sessions, err = q.RevokeAllUserSessions(ctx, u.ID); err != nil {
			return err
		}
		if _, err := q.AnonymizeUser(ctx, u.ID); err != nil {
			return err
		}
		return s.purge(ctx, tx, files)
	})
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 3*time.Second)
	defer cancel()
	if err := s.Revoked.Revoke(ctx, sessions...); err != nil {
		s.Log.ErrorContext(ctx, "revoke access tokens after account deletion", "err", err)
	}
	s.Cache.VacanciesChanged(ctx, unpublished...)
	for _, c := range closed {
		s.Cache.CompanyChanged(ctx, s.Q, gen.Company{ID: c.ID, Slug: c.Slug})
	}
	s.Log.InfoContext(ctx, "account deleted", "user_id", u.ID, "sessions", len(sessions),
		"companies_closed", len(closed), "vacancies_unpublished", len(unpublished))
	return nil
}

// reauth checks the confirmation: the password when the account has one; otherwise a
// Google ID token of the same Google account, or a session signed in within RecentSignIn.
func (s *Service) reauth(ctx context.Context, u gen.User, sessionID uuid.UUID, in DeleteInput) error {
	if u.PasswordHash != nil {
		if in.Password == "" {
			return errPassword
		}
		ok, err := hash.VerifyPasswordCtx(ctx, in.Password, *u.PasswordHash)
		if err != nil {
			return err
		}
		if !ok {
			return auth.ErrWrongPassword
		}
		return nil
	}
	if in.GoogleIDToken != "" && s.Google != nil && u.GoogleSub != nil {
		id, err := s.Google.Verify(in.GoogleIDToken)
		if err == nil && id.Subject == *u.GoogleSub {
			return nil
		}
		return ErrReauthRequired
	}
	sess, err := s.Q.GetSession(ctx, sessionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrReauthRequired
	}
	if err != nil {
		return err
	}
	if time.Since(sess.CreatedAt) > RecentSignIn {
		return ErrReauthRequired
	}
	return nil
}

// purge queues the removal of the deleted uploads' objects.
func (s *Service) purge(ctx context.Context, tx pgx.Tx, files []gen.DeleteUserFilesRow) error {
	if len(files) == 0 || s.Jobs == nil {
		return nil
	}
	var jobs []river.JobArgs
	for i := 0; i < len(files); i += purgeBatch {
		batch := files[i:min(i+purgeBatch, len(files))]
		objs := make([]file.StoredObject, len(batch))
		for j, f := range batch {
			objs[j] = file.StoredObject{Bucket: f.Bucket, Key: f.ObjectKey}
		}
		jobs = append(jobs, file.PurgeObjectsArgs{Objects: objs})
	}
	return s.Jobs.InsertManyTx(ctx, tx, jobs)
}
