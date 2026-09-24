// Package process is the worker side of image processing (TZ BE-14, SEC-06): it turns a
// chosen upload into published WebP variants and deletes what they replace. Only the
// worker links it (the WebP encoder stays out of the API binary).
package process

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/redis/go-redis/v9"
	"github.com/riverqueue/river"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/media"
	"jobvacancy.uz/backend/internal/pkg/imaging"
	"jobvacancy.uz/backend/internal/pkg/imgurl"
	"jobvacancy.uz/backend/internal/platform/storage"
	"jobvacancy.uz/backend/internal/realtime"
)

// maxUpload is the largest original read into memory (the cover upload limit).
const maxUpload = 10 << 20

// Variants are immutable (a new upload gets a new key), so browsers and nginx keep them.
const variantCacheControl = "public, max-age=31536000, immutable"

var (
	images = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "media_images_total",
		Help: "Processed uploads by target and result (published, superseded, rejected, done_before).",
	}, []string{"target", "result"})
	seconds = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "media_process_seconds",
		Help:    "Time from reading an upload to publishing its variants.",
		Buckets: []float64{.1, .25, .5, 1, 2, 3, 5, 10, 30},
	}, []string{"target"})
)

// Processor publishes image variants.
type Processor struct {
	Pool      *pgxpool.Pool
	Q         *gen.Queries
	Storage   *storage.Storage
	Jobs      media.Enqueuer      // queues the retirement in the publishing transaction
	Publisher *realtime.Publisher // tells the uploader's open tabs (media.ready / media.failed)
	RDB       *redis.Client       // answers the request waiting on media.DoneChannel
	// CompanyChanged drops cached pages that show a company's logo or cover.
	CompanyChanged func(ctx context.Context, c gen.Company)
	Log            *slog.Logger
}

// Rendition is one encoded variant.
type Rendition struct {
	Size          int
	Width, Height int
	Data          []byte
}

// Render decodes an original and encodes the variants of target (largest last) and, for
// covers, a tiny blurred-preview data URI.
func Render(t imgurl.Target, data []byte) ([]Rendition, string, error) {
	var side, quality int
	var shape func(image.Image, int) *image.RGBA
	switch t {
	case imgurl.Avatar: // centre square; the short side must stay ≥ 256 after the shrink
		side, quality, shape = 1024, 82, imaging.Square
	case imgurl.Logo: // whole logo, transparency kept
		side, quality, shape = 1024, 90, imaging.Fit
	case imgurl.Cover: // wide banner, 16:9 at most
		side, quality = 2048, 80
		shape = func(img image.Image, w int) *image.RGBA { return imaging.Banner(img, w, 9.0/16) }
	default:
		return nil, "", fmt.Errorf("media: unknown target %q", t)
	}
	img, _, err := imaging.Load(data, side)
	if err != nil {
		return nil, "", err
	}
	var out []Rendition
	for _, s := range imgurl.Sizes[t] {
		v := shape(img, s)
		b, err := imaging.EncodeWebP(v, quality)
		if err != nil {
			return nil, "", err
		}
		out = append(out, Rendition{Size: s, Width: v.Bounds().Dx(), Height: v.Bounds().Dy(), Data: b})
	}
	var lqip string
	if t == imgurl.Cover {
		b, err := imaging.EncodeWebP(shape(img, 24), 40)
		if err != nil {
			return nil, "", err
		}
		lqip = "data:image/webp;base64," + base64.StdEncoding.EncodeToString(b)
	}
	return out, lqip, nil
}

// state is what the owner's row says now.
func (p *Processor) state(ctx context.Context, a media.ProcessArgs) (shown *string, chosen *uuid.UUID, err error) {
	switch a.Target {
	case imgurl.Avatar:
		u, err := p.Q.GetUserByID(ctx, a.OwnerID)
		return u.AvatarUrl, u.AvatarFileID, err
	case imgurl.Logo:
		c, err := p.Q.GetCompanyByID(ctx, a.OwnerID)
		return c.LogoUrl, c.LogoFileID, err
	default:
		c, err := p.Q.GetCompanyByID(ctx, a.OwnerID)
		return c.CoverUrl, c.CoverFileID, err
	}
}

// Process publishes the variants of one upload if its owner still wants it. Safe to
// retry at any point: a finished swap is recognised, a superseded upload is discarded.
func (p *Processor) Process(ctx context.Context, a media.ProcessArgs) error {
	start := time.Now()
	result := func(r string) { images.WithLabelValues(string(a.Target), r).Inc() }
	f, err := p.Q.GetFile(ctx, a.FileID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil // deleted meanwhile (account deletion, a newer choice retired it)
	}
	if err != nil {
		return err
	}
	shown, chosen, err := p.state(ctx, a)
	if errors.Is(err, pgx.ErrNoRows) {
		p.discard(ctx, f)
		return nil
	}
	if err != nil {
		return err
	}
	largest := p.Storage.PublicURL(imgurl.Key(a.Target, f.ID, f.CreatedAt, a.Target.Largest()))
	if shown != nil && *shown == largest {
		result("done_before")
		return nil
	}
	if chosen == nil || *chosen != f.ID {
		result("superseded")
		p.discard(ctx, f)
		return nil
	}

	data, err := p.Storage.Get(ctx, f.Bucket, f.ObjectKey, maxUpload)
	if storage.IsNotFound(err) || errors.Is(err, storage.ErrObjectTooLarge) {
		return p.reject(ctx, a, f, err)
	}
	if err != nil {
		return err
	}
	rends, lqip, err := Render(a.Target, data)
	if err != nil {
		return p.reject(ctx, a, f, err)
	}
	var keys []string
	for _, r := range rends {
		key := imgurl.Key(a.Target, f.ID, f.CreatedAt, r.Size)
		if err := p.Storage.Put(ctx, p.Storage.PublicBucket(), key, r.Data, "image/webp", variantCacheControl); err != nil {
			return fmt.Errorf("media: store %s: %w", key, err)
		}
		keys = append(keys, key)
	}

	var old *string
	err = pgx.BeginFunc(ctx, p.Pool, func(tx pgx.Tx) error {
		q := p.Q.WithTx(tx)
		var err error
		old, err = publish(ctx, q, a, largest, lqip)
		if err != nil {
			return err
		}
		meta, _ := json.Marshal(map[string]any{"processed": true, "format": "webp",
			"width": rends[len(rends)-1].Width, "height": rends[len(rends)-1].Height, "bytes": len(rends[len(rends)-1].Data)})
		if err := q.SetFileMeta(ctx, gen.SetFileMetaParams{ID: f.ID, Meta: meta}); err != nil {
			return err
		}
		if r, ok := media.Retire(ctx, q, p.Storage, old, f.ID); ok {
			return p.Jobs.InsertManyTx(ctx, tx, []river.JobArgs{r})
		}
		return nil
	})
	if errors.Is(err, pgx.ErrNoRows) { // another upload was chosen while this one rendered
		for _, k := range keys {
			_ = p.Storage.Remove(ctx, p.Storage.PublicBucket(), k)
		}
		result("superseded")
		p.discard(ctx, f)
		return nil
	}
	if err != nil {
		return err
	}
	// The original, with its EXIF, goes now. A legacy upload that lived in the public
	// bucket is the old shown image: it's retired with it (cached pages may point at it).
	if f.Bucket != p.Storage.PublicBucket() {
		if err := p.Storage.Remove(ctx, f.Bucket, f.ObjectKey); err != nil && !storage.IsNotFound(err) {
			p.Log.WarnContext(ctx, "media: original not removed", "file_id", f.ID, "err", err)
		}
	}
	seconds.WithLabelValues(string(a.Target)).Observe(time.Since(start).Seconds())
	result("published")
	p.announce(ctx, a, f, "ok", map[string]any{"target": a.Target, "owner_id": a.OwnerID, "file_id": f.ID,
		"url": largest, "urls": imgurl.URLs(&largest), "lqip": nullable(lqip)})
	p.Log.InfoContext(ctx, "image published", "target", a.Target, "file_id", f.ID, "owner_id", a.OwnerID,
		"took", time.Since(start).Round(time.Millisecond), "sizes", len(rends))
	return nil
}

func publish(ctx context.Context, q *gen.Queries, a media.ProcessArgs, url, lqip string) (*string, error) {
	switch a.Target {
	case imgurl.Avatar:
		return q.PublishUserAvatar(ctx, gen.PublishUserAvatarParams{Url: &url, UserID: a.OwnerID, FileID: &a.FileID})
	case imgurl.Logo:
		return q.PublishCompanyLogo(ctx, gen.PublishCompanyLogoParams{Url: &url, CompanyID: a.OwnerID, FileID: &a.FileID})
	default:
		return q.PublishCompanyCover(ctx, gen.PublishCompanyCoverParams{Url: &url, Lqip: nullable(lqip),
			CompanyID: a.OwnerID, FileID: &a.FileID})
	}
}

// reject gives up on an upload that isn't a usable image: the choice is dropped (the old
// image stays), the upload deleted, and the uploader told.
func (p *Processor) reject(ctx context.Context, a media.ProcessArgs, f gen.File, cause error) error {
	var err error
	switch a.Target {
	case imgurl.Avatar:
		err = p.Q.AbandonUserAvatar(ctx, gen.AbandonUserAvatarParams{ID: a.OwnerID, FileID: &f.ID})
	case imgurl.Logo:
		err = p.Q.AbandonCompanyLogo(ctx, gen.AbandonCompanyLogoParams{ID: a.OwnerID, FileID: &f.ID})
	default:
		err = p.Q.AbandonCompanyCover(ctx, gen.AbandonCompanyCoverParams{ID: a.OwnerID, FileID: &f.ID})
	}
	if err != nil {
		return err
	}
	p.discard(ctx, f)
	images.WithLabelValues(string(a.Target), "rejected").Inc()
	p.Log.WarnContext(ctx, "image rejected", "target", a.Target, "file_id", f.ID, "err", cause)
	p.announce(ctx, a, f, "failed", map[string]any{"target": a.Target, "owner_id": a.OwnerID, "file_id": f.ID})
	return river.JobCancel(cause)
}

// discard deletes an upload nobody shows.
func (p *Processor) discard(ctx context.Context, f gen.File) {
	if err := p.Storage.Remove(ctx, f.Bucket, f.ObjectKey); err != nil && !storage.IsNotFound(err) {
		p.Log.WarnContext(ctx, "media: upload not removed", "file_id", f.ID, "err", err)
	}
	if err := p.Q.DeleteFiles(ctx, []uuid.UUID{f.ID}); err != nil {
		p.Log.WarnContext(ctx, "media: upload row not deleted", "file_id", f.ID, "err", err)
	}
}

// announce runs after the commit: company caches, the uploader's tabs, the waiting request.
func (p *Processor) announce(ctx context.Context, a media.ProcessArgs, f gen.File, outcome string, data map[string]any) {
	ctx = context.WithoutCancel(ctx)
	if outcome == "ok" && a.Target != imgurl.Avatar && p.CompanyChanged != nil {
		if c, err := p.Q.GetCompanyByID(ctx, a.OwnerID); err == nil {
			p.CompanyChanged(ctx, c)
		}
	}
	if p.Publisher != nil {
		typ := "media.ready"
		if outcome != "ok" {
			typ = "media.failed"
		}
		_ = p.Publisher.ToUsers(ctx, []uuid.UUID{f.OwnerID}, realtime.Event{Type: typ, Data: data})
	}
	if p.RDB != nil {
		_ = p.RDB.Publish(ctx, media.DoneChannel(f.ID), outcome).Err()
	}
}

// Retire deletes a replaced image's objects, then its upload rows.
func (p *Processor) Retire(ctx context.Context, a media.RetireArgs) error {
	var failed error
	for _, o := range a.Objects {
		if err := p.Storage.Remove(ctx, o.Bucket, o.Key); err != nil && !storage.IsNotFound(err) {
			failed = err
		}
	}
	if failed != nil {
		return failed
	}
	if len(a.FileIDs) > 0 {
		if err := p.Q.DeleteFiles(ctx, a.FileIDs); err != nil {
			return err
		}
	}
	p.Log.InfoContext(ctx, "replaced image removed", "objects", len(a.Objects), "files", len(a.FileIDs))
	return nil
}

func nullable(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// ---- River workers -----------------------------------------------------------------------

type ProcessWorker struct {
	river.WorkerDefaults[media.ProcessArgs]
	P *Processor
}

func (w *ProcessWorker) Timeout(*river.Job[media.ProcessArgs]) time.Duration { return time.Minute }

func (w *ProcessWorker) Work(ctx context.Context, job *river.Job[media.ProcessArgs]) error {
	return w.P.Process(ctx, job.Args)
}

type RetireWorker struct {
	river.WorkerDefaults[media.RetireArgs]
	P *Processor
}

func (w *RetireWorker) Work(ctx context.Context, job *river.Job[media.RetireArgs]) error {
	return w.P.Retire(ctx, job.Args)
}

// Register adds the image workers to a River worker set.
func Register(ws *river.Workers, p *Processor) {
	river.AddWorker(ws, &ProcessWorker{P: p})
	river.AddWorker(ws, &RetireWorker{P: p})
}
