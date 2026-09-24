package media

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/riverqueue/river"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/file"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/imgurl"
	"jobvacancy.uz/backend/internal/platform/storage"
)

// ErrImageRejected: the worker could not use the upload (not a decodable image, or more
// than imaging.MaxPixels).
var ErrImageRejected = apperr.Validation(map[string]string{"file_id": "image"})

// Enqueuer inserts jobs in the caller's transaction (jobs.Enqueuer; fixture.Jobs in tests).
type Enqueuer interface {
	InsertManyTx(ctx context.Context, tx pgx.Tx, args []river.JobArgs) error
}

// Service applies the owner's choice of an avatar, logo or cover (API side).
type Service struct {
	Pool    *pgxpool.Pool
	Q       *gen.Queries
	Files   *file.Service
	Storage *storage.Storage
	Jobs    Enqueuer
	// RDB lets a choice wait for its variants (Wait, default 4 s) so the response already
	// shows the new image; nil answers at once with *_pending.
	RDB  *redis.Client
	Wait time.Duration
	Log  *slog.Logger
	// CompanyChanged runs after a logo or cover was removed (public cache invalidation).
	CompanyChanged func(ctx context.Context, c gen.Company)
}

// SetAvatar applies PUT /me/avatar; nil removes the avatar.
func (s *Service) SetAvatar(ctx context.Context, userID uuid.UUID, fileID *uuid.UUID) (gen.User, error) {
	if fileID == nil {
		err := s.clear(ctx, func(q *gen.Queries) (*string, error) { return q.ClearUserAvatar(ctx, userID) })
		if err != nil {
			return gen.User{}, err
		}
		return s.Q.GetUserByID(ctx, userID)
	}
	f, err := s.Files.Use(ctx, userID, *fileID, gen.FilePurposeAvatar)
	if err != nil {
		return gen.User{}, err
	}
	err = s.choose(ctx, f, imgurl.Avatar, userID, func(q *gen.Queries) error {
		return q.ChooseUserAvatar(ctx, gen.ChooseUserAvatarParams{FileID: &f.ID, ID: userID})
	})
	if err != nil {
		return gen.User{}, err
	}
	return s.Q.GetUserByID(ctx, userID)
}

// SetCompanyImage applies PUT /companies/{company}/logo|cover for a member the caller
// already allowed to edit the company; nil removes the image.
func (s *Service) SetCompanyImage(ctx context.Context, t imgurl.Target, companyID, uploader uuid.UUID, fileID *uuid.UUID) (gen.Company, error) {
	if t != imgurl.Logo && t != imgurl.Cover {
		return gen.Company{}, fmt.Errorf("media: %s is not a company image", t)
	}
	if fileID == nil {
		err := s.clear(ctx, func(q *gen.Queries) (*string, error) {
			if t == imgurl.Logo {
				return q.ClearCompanyLogo(ctx, companyID)
			}
			return q.ClearCompanyCover(ctx, companyID)
		})
		if err != nil {
			return gen.Company{}, err
		}
		c, err := s.Q.GetCompanyByID(ctx, companyID)
		if err == nil && s.CompanyChanged != nil {
			s.CompanyChanged(context.WithoutCancel(ctx), c)
		}
		return c, err
	}
	f, err := s.Files.Use(ctx, uploader, *fileID, Purpose(t))
	if err != nil {
		return gen.Company{}, err
	}
	err = s.choose(ctx, f, t, companyID, func(q *gen.Queries) error {
		if t == imgurl.Logo {
			return q.ChooseCompanyLogo(ctx, gen.ChooseCompanyLogoParams{FileID: &f.ID, ID: companyID})
		}
		return q.ChooseCompanyCover(ctx, gen.ChooseCompanyCoverParams{FileID: &f.ID, ID: companyID})
	})
	if err != nil {
		return gen.Company{}, err
	}
	return s.Q.GetCompanyByID(ctx, companyID)
}

// choose records the choice and queues the processing in one transaction, then waits a
// few seconds for the worker (TZ BE-14: sizes are ready within 5 s).
func (s *Service) choose(ctx context.Context, f gen.File, t imgurl.Target, owner uuid.UUID, record func(*gen.Queries) error) error {
	var sub *redis.PubSub
	if s.RDB != nil && s.wait() > 0 {
		// Subscribed before the commit, so a fast worker's answer can't be missed.
		sub = s.RDB.Subscribe(ctx, DoneChannel(f.ID))
		defer sub.Close()
		if _, err := sub.Receive(ctx); err != nil {
			s.Log.WarnContext(ctx, "media: can't wait for the worker", "err", err)
			sub = nil
		}
	}
	err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		if err := record(s.Q.WithTx(tx)); err != nil {
			return err
		}
		return s.Jobs.InsertManyTx(ctx, tx, []river.JobArgs{ProcessArgs{FileID: f.ID, Target: t, OwnerID: owner}})
	})
	if err != nil || sub == nil {
		return err
	}
	timer := time.NewTimer(s.wait())
	defer timer.Stop()
	select {
	case msg := <-sub.Channel():
		if msg.Payload == "failed" {
			return ErrImageRejected
		}
	case <-timer.C: // still processing: the response shows *_pending
	case <-ctx.Done():
		return ctx.Err()
	}
	return nil
}

func (s *Service) wait() time.Duration {
	if s.Wait == 0 {
		return 4 * time.Second
	}
	return s.Wait
}

// clear removes an image and schedules its files for deletion, in one transaction.
func (s *Service) clear(ctx context.Context, update func(*gen.Queries) (*string, error)) error {
	return pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		q := s.Q.WithTx(tx)
		old, err := update(q)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		if err != nil {
			return err
		}
		if r, ok := Retire(ctx, q, s.Storage, old, uuid.Nil); ok {
			return s.Jobs.InsertManyTx(ctx, tx, []river.JobArgs{r})
		}
		return nil
	})
}

// Retire lists what to delete once an image stops being shown: every variant of a
// processed image (and its upload row), or a legacy upload shown straight from the public
// bucket. keep is an upload that must survive (the one replacing it, when a legacy
// original is reprocessed). External URLs (Google avatars) need nothing.
func Retire(ctx context.Context, q *gen.Queries, st *storage.Storage, old *string, keep uuid.UUID) (RetireArgs, bool) {
	if old == nil || st == nil {
		return RetireArgs{}, false
	}
	var r RetireArgs
	if v, ok := imgurl.Parse(*old); ok {
		for _, u := range v.All() {
			if key, ok := st.PublicKey(u); ok {
				r.Objects = append(r.Objects, file.StoredObject{Bucket: st.PublicBucket(), Key: key})
			}
		}
		if v.FileID != keep {
			r.FileIDs = append(r.FileIDs, v.FileID)
		}
	} else if key, ok := st.PublicKey(*old); ok {
		r.Objects = append(r.Objects, file.StoredObject{Bucket: st.PublicBucket(), Key: key})
		if f, err := q.GetFileByKey(ctx, key); err == nil && f.ID != keep {
			r.FileIDs = append(r.FileIDs, f.ID)
		}
	}
	return r, len(r.Objects)+len(r.FileIDs) > 0
}
