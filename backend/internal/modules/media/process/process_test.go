package process

import (
	"bytes"
	"context"
	"errors"
	"os"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/riverqueue/river"
	xwebp "golang.org/x/image/webp"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/file"
	"jobvacancy.uz/backend/internal/modules/media"
	"jobvacancy.uz/backend/internal/modules/user"
	"jobvacancy.uz/backend/internal/pkg/imgurl"
	"jobvacancy.uz/backend/internal/testutil/fixture"
)

// memObjects is object storage in a map.
type memObjects struct {
	mu   sync.Mutex
	objs map[string][]byte // bucket/key
	ct   map[string]string
}

func newObjects() *memObjects {
	return &memObjects{objs: map[string][]byte{}, ct: map[string]string{}}
}

func (m *memObjects) Get(_ context.Context, bucket, key string, max int64) ([]byte, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	b, ok := m.objs[bucket+"/"+key]
	if !ok {
		return nil, minio.ErrorResponse{Code: "NoSuchKey"}
	}
	if int64(len(b)) > max {
		return nil, errors.New("too large")
	}
	return b, nil
}

func (m *memObjects) Put(_ context.Context, bucket, key string, data []byte, ct, _ string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.objs[bucket+"/"+key] = append([]byte(nil), data...)
	m.ct[bucket+"/"+key] = ct
	return nil
}

func (m *memObjects) Remove(_ context.Context, bucket, key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.objs, bucket+"/"+key)
	return nil
}

func (m *memObjects) PublicBucket() string        { return "pub" }
func (m *memObjects) PublicURL(key string) string { return "https://jobvacancy.uz/media/" + key }
func (m *memObjects) PublicKey(u string) (string, bool) {
	k, ok := strings.CutPrefix(u, "https://jobvacancy.uz/media/")
	return k, ok && k != ""
}

func (m *memObjects) keys(prefix string) []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []string
	for k := range m.objs {
		if strings.HasPrefix(k, prefix) {
			out = append(out, k)
		}
	}
	return out
}

type env struct {
	*fixture.World
	objs *memObjects
	jobs *fixture.Jobs
	svc  *media.Service
	proc *Processor
}

func newEnv(t *testing.T) *env {
	w := fixture.New(t)
	_, rdb := fixture.Redis(t)
	objs := newObjects()
	jobs := &fixture.Jobs{}
	svc := &media.Service{Pool: w.Pool, Q: w.Q, Files: &file.Service{Q: w.Q, Log: w.Log}, Storage: objs,
		Jobs: jobs, RDB: rdb, Wait: 3 * time.Second, Log: w.Log}
	proc := &Processor{Pool: w.Pool, Q: w.Q, Storage: objs, Jobs: jobs, RDB: rdb, Log: w.Log}
	return &env{World: w, objs: objs, jobs: jobs, svc: svc, proc: proc}
}

// upload stores data as a ready private upload of owner.
func (e *env) upload(owner uuid.UUID, purpose gen.FilePurpose, data []byte) gen.File {
	e.T.Helper()
	key := string(purpose) + "/2026/09/" + uuid.NewString() + ".jpg"
	f, err := e.Q.CreateFile(context.Background(), gen.CreateFileParams{OwnerID: owner, Purpose: purpose,
		Bucket: "priv", ObjectKey: key, ContentType: "image/jpeg", Meta: []byte("{}")})
	e.Must(err)
	f, err = e.Q.MarkFileReady(context.Background(), gen.MarkFileReadyParams{ID: f.ID, Size: int64(len(data)), ContentType: "image/jpeg"})
	e.Must(err)
	e.Must(e.objs.Put(context.Background(), "priv", key, data, "image/jpeg", ""))
	return f
}

// worker runs every queued media.process job, like the River media queue.
func (e *env) worker(ctx context.Context) error {
	for {
		var next *media.ProcessArgs
		e.jobs.Take(func(a river.JobArgs) bool {
			if p, ok := a.(media.ProcessArgs); ok && next == nil {
				next = &p
				return true
			}
			return false
		})
		if next == nil {
			return nil
		}
		if err := e.proc.Process(ctx, *next); err != nil {
			return err
		}
	}
}

// TZ BE-14 ✅ "Yangi avatar yuklanganidan 5 s ichida o'lchamlari tayyor bo'ladi" and
// SEC-06 ✅ "GPS EXIF qolmaydi": a phone photo with GPS coordinates, stored sideways,
// becomes three upright WebP squares without any metadata; the private original is
// deleted and the choice is answered with the new avatar well within 5 s (the request
// waits for the worker). Replacing it later retires the old sizes and upload row.
func TestAvatarPublishedWithoutGPS(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	photo, err := os.ReadFile("testdata/phone-gps.jpg")
	e.Must(err)
	if !bytes.Contains(photo, []byte("Exif")) {
		t.Fatal("fixture lost its EXIF")
	}
	u := e.User(gen.UserRoleSeeker, true)
	f := e.upload(u.ID, gen.FilePurposeAvatar, photo)

	// The worker picks the job up while the request waits for it.
	errc := make(chan error, 1)
	go func() {
		for i := 0; i < 100; i++ {
			if len(e.jobs.Kinds()) > 0 {
				errc <- e.worker(ctx)
				return
			}
			time.Sleep(10 * time.Millisecond)
		}
		errc <- errors.New("no job queued")
	}()
	start := time.Now()
	got, err := e.svc.SetAvatar(ctx, u.ID, &f.ID)
	took := time.Since(start)
	e.Must(err)
	e.Must(<-errc)
	t.Logf("avatar chosen → sizes published and returned in %v", took.Round(time.Millisecond))
	if took > 5*time.Second {
		t.Fatalf("took %v, TZ asks for ≤ 5 s", took)
	}
	d := user.ToDTO(got)
	if d.AvatarPending || len(d.AvatarURLs) != 3 || d.AvatarURL == nil || *d.AvatarURL != d.AvatarURLs["256"] {
		t.Fatalf("user after choice: pending=%v url=%v urls=%v", d.AvatarPending, d.AvatarURL, d.AvatarURLs)
	}
	if !strings.Contains(*d.AvatarURL, "/img/avatar/") || !strings.Contains(*d.AvatarURL, f.ID.String()) {
		t.Fatalf("avatar url %s", *d.AvatarURL)
	}
	for size, u := range d.AvatarURLs {
		key, _ := e.objs.PublicKey(u)
		b, err := e.objs.Get(ctx, "pub", key, 1<<20)
		e.Must(err)
		for _, leak := range []string{"Exif", "GPS", "II*\x00", "XMP"} {
			if bytes.Contains(b, []byte(leak)) {
				t.Fatalf("%s variant contains %q", size, leak)
			}
		}
		img, err := xwebp.Decode(bytes.NewReader(b))
		e.Must(err)
		if s := img.Bounds().Dx(); strconv.Itoa(s) != size || img.Bounds().Dy() != s {
			t.Fatalf("variant %s is %dpx wide", size, s)
		}
		// Upright: the sun, at (550, 200) in the sideways 800×600 original, is at
		// (399, 450) of the centre square once turned 90° clockwise → (170, 192) at 256 px.
		// Unrotated it would sit near (192, 85).
		if size == "256" {
			if r, g, b, _ := img.At(170, 192).RGBA(); r>>8 < 200 || g>>8 < 170 || b>>8 > 130 {
				t.Fatalf("256 variant not upright: no sun at (170,192): %d %d %d", r>>8, g>>8, b>>8)
			}
		}
		if ct := e.objs.ct["pub/"+key]; ct != "image/webp" {
			t.Fatalf("content type %q", ct)
		}
	}
	if len(e.objs.keys("priv/")) != 0 {
		t.Fatalf("original with EXIF still stored: %v", e.objs.keys("priv/"))
	}

	// Replacing it: the old sizes and upload row are retired (after RetireDelay).
	f2 := e.upload(u.ID, gen.FilePurposeAvatar, photo)
	e.svc.RDB = nil // don't wait this time: the response says pending
	got, err = e.svc.SetAvatar(ctx, u.ID, &f2.ID)
	e.Must(err)
	if !user.ToDTO(got).AvatarPending || *got.AvatarUrl != *d.AvatarURL {
		t.Fatal("while processing, the old avatar stays and avatar_pending is set")
	}
	e.Must(e.worker(ctx))
	var retire *media.RetireArgs
	e.jobs.Take(func(a river.JobArgs) bool {
		if r, ok := a.(media.RetireArgs); ok {
			retire = &r
			return true
		}
		return false
	})
	if retire == nil || len(retire.Objects) != 3 || len(retire.FileIDs) != 1 || retire.FileIDs[0] != f.ID {
		t.Fatalf("retire job: %+v", retire)
	}
	if o := (media.RetireArgs{}).InsertOpts(); time.Until(o.ScheduledAt) < 50*time.Minute {
		t.Fatalf("retirement scheduled at %v, want about an hour later", o.ScheduledAt)
	}
	e.Must(e.proc.Retire(ctx, *retire))
	if n := e.Int(`SELECT count(*) FROM files WHERE id = $1`, f.ID); n != 0 {
		t.Fatal("old upload row not deleted")
	}
	v, _ := imgurl.Parse(*d.AvatarURL)
	for _, k := range v.Keys() {
		if _, err := e.objs.Get(ctx, "pub", k, 1<<20); err == nil {
			t.Fatalf("old variant %s still stored", k)
		}
	}
}

// A newer choice wins: the job for the older upload discards it; an upload that isn't
// an image is refused, the old avatar stays and the request learns at once.
func TestSupersededAndRejectedUploads(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	photo, err := os.ReadFile("testdata/phone-gps.jpg")
	e.Must(err)
	u := e.User(gen.UserRoleSeeker, true)
	e.svc.RDB = nil
	a := e.upload(u.ID, gen.FilePurposeAvatar, photo)
	b := e.upload(u.ID, gen.FilePurposeAvatar, photo)
	_, err = e.svc.SetAvatar(ctx, u.ID, &a.ID)
	e.Must(err)
	_, err = e.svc.SetAvatar(ctx, u.ID, &b.ID)
	e.Must(err)
	e.Must(e.worker(ctx)) // runs a (superseded) then b
	got, err := e.Q.GetUserByID(ctx, u.ID)
	e.Must(err)
	if got.AvatarUrl == nil || !strings.Contains(*got.AvatarUrl, b.ID.String()) {
		t.Fatalf("avatar %v, want upload b", got.AvatarUrl)
	}
	if n := e.Int(`SELECT count(*) FROM files WHERE id = $1`, a.ID); n != 0 {
		t.Fatal("superseded upload not discarded")
	}
	if len(e.objs.keys("pub/img/avatar/2")) != 3 {
		t.Fatalf("published objects: %v", e.objs.keys("pub/"))
	}

	// A text file declared as a JPEG (it passed nothing but the first bytes' sniff).
	bad := e.upload(u.ID, gen.FilePurposeAvatar, append([]byte{0xFF, 0xD8, 0xFF, 0xE0}, []byte("not really a jpeg")...))
	e.svc.RDB = e.proc.RDB
	go func() {
		for i := 0; i < 100 && len(e.jobs.Kinds()) == 0; i++ {
			time.Sleep(10 * time.Millisecond)
		}
		err := e.worker(ctx)
		if !errors.Is(err, &river.JobCancelError{}) && (err == nil || !strings.Contains(err.Error(), "jpeg")) {
			t.Errorf("rejected job: %v", err)
		}
	}()
	if _, err := e.svc.SetAvatar(ctx, u.ID, &bad.ID); !errors.Is(err, media.ErrImageRejected) {
		t.Fatalf("bad image: %v", err)
	}
	got, err = e.Q.GetUserByID(ctx, u.ID)
	e.Must(err)
	if !strings.Contains(*got.AvatarUrl, b.ID.String()) || user.ToDTO(got).AvatarPending {
		t.Fatalf("after a rejected upload the old avatar must stay: %v %v", got.AvatarUrl, got.AvatarFileID)
	}
	if n := e.Int(`SELECT count(*) FROM files WHERE id = $1`, bad.ID); n != 0 {
		t.Fatal("rejected upload not deleted")
	}
}

// Logos keep their shape and covers get two widths plus an inline blurred preview.
func TestCompanyLogoAndCover(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	photo, err := os.ReadFile("testdata/phone-gps.jpg")
	e.Must(err)
	owner := e.User(gen.UserRoleEmployer, true)
	c := e.Company(owner.ID, true)
	e.svc.RDB = nil
	var changed int
	e.proc.CompanyChanged = func(context.Context, gen.Company) { changed++ }
	logo := e.upload(owner.ID, gen.FilePurposeCompanyLogo, photo)
	cover := e.upload(owner.ID, gen.FilePurposeCompanyCover, photo)
	_, err = e.svc.SetCompanyImage(ctx, imgurl.Logo, c.ID, owner.ID, &logo.ID)
	e.Must(err)
	_, err = e.svc.SetCompanyImage(ctx, imgurl.Cover, c.ID, owner.ID, &cover.ID)
	e.Must(err)
	e.Must(e.worker(ctx))
	got, err := e.Q.GetCompanyByID(ctx, c.ID)
	e.Must(err)
	if got.LogoUrl == nil || got.CoverUrl == nil || got.CoverLqip == nil || changed != 2 {
		t.Fatalf("company: logo=%v cover=%v lqip=%v changed=%d", got.LogoUrl, got.CoverUrl, got.CoverLqip != nil, changed)
	}
	if !strings.HasPrefix(*got.CoverLqip, "data:image/webp;base64,") || len(*got.CoverLqip) > 2000 {
		t.Fatalf("lqip %d bytes", len(*got.CoverLqip))
	}
	urls := imgurl.URLs(got.CoverUrl)
	key, _ := e.objs.PublicKey(urls["1280"])
	b, err := e.objs.Get(ctx, "pub", key, 1<<20)
	e.Must(err)
	img, err := xwebp.Decode(bytes.NewReader(b))
	e.Must(err)
	// The upright photo is 600×800 (portrait): the banner is cropped to 16:9.
	if img.Bounds().Dx() != 1280 || img.Bounds().Dy() != 720 {
		t.Fatalf("cover %v", img.Bounds())
	}
	t.Logf("cover 1280: %d bytes (FE-04 budget for the company page's LCP image: 60 KB)", len(b))
	if len(b) > 60<<10 {
		t.Fatalf("cover 1280 is %d bytes", len(b))
	}
	// Removing the cover retires it right away and invalidates the page.
	e.svc.CompanyChanged = func(context.Context, gen.Company) { changed++ }
	_, err = e.svc.SetCompanyImage(ctx, imgurl.Cover, c.ID, owner.ID, nil)
	e.Must(err)
	got, _ = e.Q.GetCompanyByID(ctx, c.ID)
	if got.CoverUrl != nil || got.CoverLqip != nil || got.CoverFileID != nil || changed != 3 {
		t.Fatal("cover not removed")
	}
}
