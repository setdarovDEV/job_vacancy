package savedsearch

import (
	"context"
	"io"
	"log/slog"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/notification"
	"jobvacancy.uz/backend/internal/modules/vacancy"
)

type fakeLister struct {
	mu    sync.Mutex
	calls []vacancy.Filter
	cards []vacancy.Card // newest first
}

func (l *fakeLister) ListNew(_ context.Context, f vacancy.Filter) (vacancy.ListResult, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.calls = append(l.calls, f)
	var out []vacancy.Card
	if f.Query.Folded != "dasturchi" { // only that search has new vacancies
		return vacancy.ListResult{Cards: out}, nil
	}
	for _, c := range l.cards {
		if c.PublishedAt.After(*f.PublishedAfter) && len(out) < f.Limit {
			out = append(out, c)
		}
	}
	return vacancy.ListResult{Cards: out}, nil
}

type sent struct {
	user uuid.UUID
	p    notification.Payload
}

type fakeNotifier struct{ sent []sent }

func (n *fakeNotifier) Notify(_ context.Context, users []uuid.UUID, typ string, p notification.Payload, _ bool) {
	if typ != notification.TypeSearchAlert {
		panic(typ)
	}
	for _, u := range users {
		n.sent = append(n.sent, sent{u, p})
	}
}

// TZ BE-11: identical saved searches are checked with one query (from the oldest last
// check of the group), each owner hears only about vacancies newer than their own last
// check, and the count comes from the fetched rows, not a COUNT query.
func TestAlertsGroupIdenticalSearches(t *testing.T) {
	now := time.Now()
	card := func(title string, ago time.Duration) vacancy.Card {
		at := now.Add(-ago)
		return vacancy.Card{ID: uuid.New(), Title: title, PublishedAt: &at}
	}
	lister := &fakeLister{cards: []vacancy.Card{
		card("Newest", time.Minute), card("Middle", 20*time.Minute), card("Oldest", 50*time.Minute),
	}}
	notify := &fakeNotifier{}
	s := &Service{List: lister, Notify: notify, Log: slog.New(slog.NewTextHandler(io.Discard, nil))}

	due := func(params string, since time.Duration) gen.ClaimDueSavedSearchesRow {
		return gen.ClaimDueSavedSearchesRow{ID: uuid.New(), UserID: uuid.New(), Name: params,
			Params: params, Since: now.Add(-since)}
	}
	rows := []gen.ClaimDueSavedSearchesRow{
		due("q=dasturchi", 30*time.Minute), // sees Newest, Middle
		due("q=kassir", 30*time.Minute),
		due("q=dasturchi", 5*time.Minute),  // sees Newest
		due("q=dasturchi", time.Hour),      // sees all three
		due("q=dasturchi", 10*time.Second), // nothing new
	}
	groups := groupByParams(rows)
	if len(groups) != 2 || len(groups[0]) != 4 || len(groups[1]) != 1 {
		t.Fatalf("groups: %d (%d, %d)", len(groups), len(groups[0]), len(groups[1]))
	}
	alerted := 0
	for _, g := range groups {
		alerted += s.checkGroup(context.Background(), g)
	}
	if len(lister.calls) != 2 {
		t.Fatalf("%d list queries for 2 distinct searches", len(lister.calls))
	}
	if got := *lister.calls[0].PublishedAfter; !got.Equal(now.Add(-time.Hour)) {
		t.Fatalf("group query starts at %v, want the oldest since", got)
	}
	if lister.calls[0].Limit != alertFetch {
		t.Fatalf("limit %d", lister.calls[0].Limit)
	}
	want := map[uuid.UUID]int{rows[0].UserID: 2, rows[2].UserID: 1, rows[3].UserID: 3}
	if alerted != 3 || len(notify.sent) != 3 {
		t.Fatalf("alerted %d, sent %d, want 3", alerted, len(notify.sent))
	}
	for _, m := range notify.sent {
		if m.p.Count != want[m.user] {
			t.Fatalf("user got count %d, want %d", m.p.Count, want[m.user])
		}
		if lines := strings.Count(m.p.Preview, "•"); lines != min(want[m.user], alertSample) {
			t.Fatalf("preview has %d titles: %q", lines, m.p.Preview)
		}
	}
}
