package realtime

import (
	"context"
	"errors"
	"strconv"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/testutil/fixture"
)

// TZ SEC-05 ✅ "Begona user presence so'rovi 403 qaytaradi": presence is visible only
// between people who share a conversation (seeker ↔ the company's members, colleagues of
// a company with conversations), and a user who hides it reads as offline to everyone.
func TestPresenceAudience(t *testing.T) {
	w := fixture.New(t)
	ctx := context.Background()
	_, rdb := fixture.Redis(t)
	hub := NewHub(ctx, rdb, w.Log)
	t.Cleanup(func() { _ = hub.Close() })
	hub.Audience = DBAudience{Q: w.Q}

	seeker := w.User(gen.UserRoleSeeker, true)
	stranger := w.User(gen.UserRoleSeeker, true)
	hr, recruiter := w.User(gen.UserRoleEmployer, true), w.User(gen.UserRoleEmployer, true)
	other := w.User(gen.UserRoleEmployer, true)
	c := w.Company(hr.ID, true)
	w.Member(c.ID, recruiter.ID, "recruiter")
	w.Company(other.ID, true)
	v := w.Vacancy(c.ID, hr.ID, gen.VacancyStatusPublished)
	var resume, app uuid.UUID
	w.Must(w.Pool.QueryRow(ctx, `INSERT INTO resumes (user_id, title) VALUES ($1, 'x') RETURNING id`, seeker.ID).Scan(&resume))
	w.Must(w.Pool.QueryRow(ctx, `INSERT INTO applications (vacancy_id, company_id, seeker_id, resume_id)
		VALUES ($1, $2, $3, $4) RETURNING id`, v.ID, c.ID, seeker.ID, resume).Scan(&app))
	w.Exec(`INSERT INTO conversations (application_id, company_id, seeker_id, vacancy_id) VALUES ($1, $2, $3, $4)`,
		app, c.ID, seeker.ID, v.ID)
	online := func(id uuid.UUID) {
		exp := strconv.FormatInt(time.Now().Add(time.Minute).Unix(), 10)
		rdb.ZAdd(ctx, presenceKey(id), redis.Z{Score: mustFloat(exp), Member: "conn-" + id.String()})
	}
	for _, u := range []gen.User{seeker, stranger, hr, recruiter, other} {
		online(u.ID)
	}

	vis := func(viewer gen.User, ids ...gen.User) map[uuid.UUID]bool {
		list := make([]uuid.UUID, len(ids))
		for i, u := range ids {
			list[i] = u.ID
		}
		m, err := hub.Audience.Visible(ctx, viewer.ID, list)
		w.Must(err)
		return m
	}
	has := func(m map[uuid.UUID]bool, u gen.User) bool { _, ok := m[u.ID]; return ok }

	m := vis(seeker, hr, recruiter, stranger, other, seeker)
	if !has(m, hr) || !has(m, recruiter) || !has(m, seeker) || has(m, stranger) || has(m, other) || len(m) != 3 {
		t.Fatalf("seeker sees %v", m)
	}
	m = vis(hr, seeker, recruiter, stranger, other)
	if !has(m, seeker) || !has(m, recruiter) || len(m) != 2 {
		t.Fatalf("hr sees %v", m)
	}
	if m = vis(stranger, seeker, hr); len(m) != 0 {
		t.Fatalf("stranger sees %v", m)
	}
	if m = vis(other, hr, seeker); len(m) != 0 {
		t.Fatalf("another company's employer sees %v", m)
	}

	// REST (strict): naming a stranger is 403; watching (not strict) just drops them.
	if _, err := hub.VisiblePresence(ctx, stranger.ID, []uuid.UUID{seeker.ID}, true); !errors.Is(err, ErrPresenceForbidden) {
		t.Fatalf("stranger asking: %v", err)
	}
	if _, err := hub.VisiblePresence(ctx, hr.ID, []uuid.UUID{seeker.ID, stranger.ID}, true); !errors.Is(err, ErrPresenceForbidden) {
		t.Fatalf("asking about a stranger among partners: %v", err)
	}
	st, err := hub.VisiblePresence(ctx, hr.ID, []uuid.UUID{seeker.ID, stranger.ID}, false)
	if err != nil || len(st) != 1 || st[0].UserID != seeker.ID || !st[0].Online {
		t.Fatalf("watch: %+v %v", st, err)
	}

	// Hidden: offline for others, still online for themselves.
	w.Exec(`UPDATE users SET hide_online = true WHERE id = $1`, seeker.ID)
	hub.SetHidden(ctx, seeker.ID, true)
	st, _ = hub.VisiblePresence(ctx, hr.ID, []uuid.UUID{seeker.ID}, true)
	if st[0].Online || st[0].LastSeenAt != nil {
		t.Fatalf("hidden seeker as hr sees them: %+v", st[0])
	}
	st, _ = hub.VisiblePresence(ctx, seeker.ID, []uuid.UUID{seeker.ID}, true)
	if !st[0].Online {
		t.Fatal("hidden user can't see their own status")
	}
	if n, _ := rdb.Exists(ctx, hiddenKey(seeker.ID)).Result(); n != 1 {
		t.Fatal("hidden flag not stored")
	}
	// Without an Audience nobody but yourself is visible.
	hub.Audience = nil
	if _, err := hub.VisiblePresence(ctx, hr.ID, []uuid.UUID{seeker.ID}, true); !errors.Is(err, ErrPresenceForbidden) {
		t.Fatalf("no audience: %v", err)
	}
}

func mustFloat(s string) float64 {
	f, _ := strconv.ParseFloat(s, 64)
	return f
}
