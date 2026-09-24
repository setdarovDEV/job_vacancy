package resume

import (
	"bytes"
	"context"
	"errors"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/ratelimit"
)

type memStore struct {
	mu   sync.Mutex
	objs map[string][]byte
}

func (m *memStore) Get(_ context.Context, bucket, key string, _ int64) ([]byte, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if b, ok := m.objs[bucket+"/"+key]; ok {
		return b, nil
	}
	return nil, errors.New("NoSuchKey")
}

func (m *memStore) Put(_ context.Context, bucket, key string, data []byte, _, _ string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.objs[bucket+"/"+key] = data
	return nil
}

func (m *memStore) PrivateBucket() string { return "priv" }

// TZ BE-13: a repeated export is served from storage without rendering; any change to
// what the PDF shows (content, updated_at, language, contacts) renders a new copy; renders
// are limited to 10 a minute per user while cached copies keep flowing.
func TestPDFCache(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()
	store := &memStore{objs: map[string][]byte{}}
	c := &PDFCache{Store: store, Limiter: ratelimit.New(rdb), Log: slog.New(slog.NewTextHandler(io.Discard, nil))}
	svc := &Service{}
	d := Detail{Card: Card{ID: uuid.New(), Title: "Backend dasturchi", Person: Person{FullName: "Jasur Toshmatov"},
		UpdatedAt: time.Date(2026, 9, 24, 10, 0, 0, 0, time.UTC)}, About: "Go, PostgreSQL, Redis."}
	renders := 0
	render := func(d Detail, lang string) func() ([]byte, error) {
		return func() ([]byte, error) {
			renders++
			var b bytes.Buffer
			err := svc.RenderPDF(&b, d, lang)
			return b.Bytes(), err
		}
	}
	ctx := context.Background()
	first, etag, hit, err := c.PDF(ctx, "u:1", d, "ru", render(d, "ru"))
	if err != nil || hit || renders != 1 || !bytes.HasPrefix(first, []byte("%PDF")) {
		t.Fatalf("first: hit=%v renders=%d err=%v", hit, renders, err)
	}
	start := time.Now()
	again, etag2, hit, err := c.PDF(ctx, "u:1", d, "ru", render(d, "ru"))
	if err != nil || !hit || renders != 1 || !bytes.Equal(first, again) || etag2 != etag {
		t.Fatalf("repeat: hit=%v renders=%d err=%v", hit, renders, err)
	}
	t.Logf("cached copy served in %v (render skipped)", time.Since(start))

	// The owner sees the same PDF as anyone with the same contacts.
	owner := d
	owner.IsOwner = true
	if _, _, hit, _ := c.PDF(ctx, "u:1", owner, "ru", render(owner, "ru")); !hit {
		t.Fatal("is_owner isn't printed and must not split the cache")
	}
	for name, v := range map[string]Detail{
		"edited":   func() Detail { x := d; x.UpdatedAt = x.UpdatedAt.Add(time.Second); return x }(),
		"contacts": func() Detail { x := d; p := "+998901234567"; x.Contacts = &Contacts{Phone: &p}; return x }(),
	} {
		if _, _, hit, _ := c.PDF(ctx, "u:1", v, "ru", render(v, "ru")); hit {
			t.Fatalf("%s: served the old copy", name)
		}
	}
	if _, _, hit, _ := c.PDF(ctx, "u:1", d, "en", render(d, "en")); hit {
		t.Fatal("another language served the Russian copy")
	}

	// 4 renders so far; 6 more pass, the 11th in the minute is refused. Hits still work.
	for i := 0; i < 6; i++ {
		x := d
		x.About = x.About + string(rune('a'+i))
		if _, _, _, err := c.PDF(ctx, "u:1", x, "uz", render(x, "uz")); err != nil {
			t.Fatalf("render %d: %v", 5+i, err)
		}
	}
	x := d
	x.About = "eleventh"
	_, _, _, err = c.PDF(ctx, "u:1", x, "uz", render(x, "uz"))
	if e, ok := apperr.As(err); !ok || e.Code != "rate_limited" {
		t.Fatalf("11th render: %v", err)
	}
	if _, _, hit, err := c.PDF(ctx, "u:1", d, "ru", render(d, "ru")); err != nil || !hit {
		t.Fatalf("cached copy while limited: hit=%v err=%v", hit, err)
	}
	if _, _, _, err := c.PDF(ctx, "u:2", x, "uz", render(x, "uz")); err != nil {
		t.Fatalf("another user is not limited: %v", err)
	}
}
