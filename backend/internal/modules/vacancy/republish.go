package vacancy

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/audit"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/platform/postgres"
)

// Republish puts an expired or archived vacancy back online for another PublishDays
// (TZ FN-04). If nothing happened to it since it was last published (no edit, no trip
// back to moderation, no unpublishing by an admin) it goes live at once, whatever the
// company's verification; otherwise it takes the normal Submit path (moderation for
// unverified companies).
func (s *Service) Republish(ctx context.Context, p reqctx.Principal, id uuid.UUID) (Detail, error) {
	v, c, err := s.authorize(ctx, p, id)
	if err != nil {
		return Detail{}, err
	}
	if v.Status != gen.VacancyStatusExpired && v.Status != gen.VacancyStatusArchived {
		return Detail{}, ErrTransition
	}
	if err := s.Companies.RequireVerifiedUser(ctx, p.UserID); err != nil {
		return Detail{}, err
	}
	nv, err := s.Q.RepublishVacancy(ctx, gen.RepublishVacancyParams{ID: v.ID, TtlDays: PublishDays})
	if errors.Is(err, pgx.ErrNoRows) {
		return s.Submit(ctx, p, id)
	}
	if err != nil {
		return Detail{}, err
	}
	s.changed(ctx, nv, c)
	return s.detail(ctx, nv, c, true)
}

// ---- "TOP" placement (TZ FN-01) -----------------------------------------------------------

// MaxFeatured is the longest "TOP" placement an admin can set at once.
const MaxFeatured = 365 * 24 * time.Hour

var errFeaturedUntil = apperr.Validation(map[string]string{"until": "future"})

// SetFeatured marks a vacancy "TOP" until the given time; the lifecycle job ends it then.
func (s *Service) SetFeatured(ctx context.Context, id uuid.UUID, until time.Time) (Detail, error) {
	if !until.After(time.Now()) || until.After(time.Now().Add(MaxFeatured)) {
		return Detail{}, errFeaturedUntil
	}
	return s.setFeatured(ctx, id, &until, "vacancy.feature")
}

// ClearFeatured ends a "TOP" placement now.
func (s *Service) ClearFeatured(ctx context.Context, id uuid.UUID) (Detail, error) {
	return s.setFeatured(ctx, id, nil, "vacancy.unfeature")
}

func (s *Service) setFeatured(ctx context.Context, id uuid.UUID, until *time.Time, action string) (Detail, error) {
	var v gen.Vacancy
	err := postgres.WithTx(ctx, s.Pool, func(q *gen.Queries) error {
		var err error
		v, err = q.SetVacancyFeatured(ctx, gen.SetVacancyFeaturedParams{ID: id, Featured: until != nil, Until: until})
		if err != nil {
			return err
		}
		details := map[string]any{"title": v.Title}
		if until != nil {
			details["until"] = until.UTC()
		}
		return audit.Write(ctx, q, audit.Entry{Action: action, ObjectType: audit.ObjectVacancy,
			ObjectID: v.ID.String(), Details: details})
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Detail{}, ErrNotFound
	}
	if err != nil {
		return Detail{}, err
	}
	return s.afterModeration(ctx, v)
}
