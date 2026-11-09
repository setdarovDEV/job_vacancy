package admin

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
)

type statsStore struct {
	Store // unused methods panic
	today time.Time
	rows  []gen.AdminDailyActivityRow
	calls int
}

func (s *statsStore) AdminStatsToday(context.Context) (time.Time, error) { return s.today, nil }

func (s *statsStore) AdminDailyActivity(_ context.Context, days int32) ([]gen.AdminDailyActivityRow, error) {
	s.calls++
	return s.rows, nil
}

type memCache map[string][]byte

func (m memCache) Get(_ context.Context, key string, dst any) (bool, error) {
	raw, ok := m[key]
	if !ok {
		return false, nil
	}
	return true, json.Unmarshal(raw, dst)
}

func (m memCache) Set(_ context.Context, key string, v any, _ time.Duration) error {
	raw, err := json.Marshal(v)
	m[key] = raw
	return err
}

func days(start time.Time, n int, each func(i int) gen.AdminDailyActivityRow) []gen.AdminDailyActivityRow {
	out := make([]gen.AdminDailyActivityRow, n)
	for i := range out {
		r := each(i)
		r.Day = start.AddDate(0, 0, i)
		out[i] = r
	}
	return out
}

// The query returns 2 × days rows: the first half only feeds previous_total, the second
// half becomes the daily buckets and current_total.
func TestActivitySplitsCurrentAndPreviousPeriod(t *testing.T) {
	start := time.Date(2026, 10, 27, 0, 0, 0, 0, time.UTC)
	rows := days(start, 14, func(i int) gen.AdminDailyActivityRow {
		if i < 7 {
			return gen.AdminDailyActivityRow{SignupsSeeker: 1, ReportsFiled: 2}
		}
		return gen.AdminDailyActivityRow{SignupsSeeker: 3, ApplicationsSent: 1}
	})
	a := activityFrom(windowOf(7, rows[13].Day), rows)
	if len(a.Daily) != 7 || a.Period.From != "2026-11-03" || a.Period.To != "2026-11-09" || a.Daily[0].Date != "2026-11-03" {
		t.Fatalf("buckets: %d %+v", len(a.Daily), a.Period)
	}
	if a.Totals.SignupsSeeker != (PeriodTotal{Current: 21, Previous: 7}) {
		t.Fatalf("signups: %+v", a.Totals.SignupsSeeker)
	}
	if a.Totals.ReportsFiled != (PeriodTotal{Current: 0, Previous: 14}) || a.Totals.ApplicationsSent.Current != 7 {
		t.Fatalf("totals: %+v", a.Totals)
	}
}

func TestActivityIsCachedPerPeriod(t *testing.T) {
	today := time.Date(2026, 11, 9, 0, 0, 0, 0, time.UTC)
	st := &statsStore{today: today, rows: days(today.AddDate(0, 0, -13), 14, func(int) gen.AdminDailyActivityRow { return gen.AdminDailyActivityRow{} })}
	cache := memCache{}
	s := &Service{Store: st, Cache: cache}
	for range 3 {
		if _, err := s.Activity(context.Background(), 7); err != nil {
			t.Fatal(err)
		}
	}
	if st.calls != 1 {
		t.Fatalf("queried %d times, want 1", st.calls)
	}
	if _, err := s.Activity(context.Background(), 30); err != nil || st.calls != 2 {
		t.Fatalf("another period must not reuse the cache: calls=%d err=%v", st.calls, err)
	}
	// API-039: a new day is a new key, so yesterday's view is never served today.
	if _, ok := cache["admin:stats:v1:activity:7:2026-11-09"]; !ok {
		t.Fatalf("keys: %v", keys(cache))
	}
	st.today = today.AddDate(0, 0, 1)
	if _, err := s.Activity(context.Background(), 7); err != nil || st.calls != 3 {
		t.Fatalf("next day must recompute: calls=%d err=%v", st.calls, err)
	}
}

func keys(m memCache) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

func TestStatsRejectUnknownPeriod(t *testing.T) {
	s := &Service{Store: &statsStore{}, Cache: NoStatsCache{}}
	_, err := s.Activity(context.Background(), 14)
	var ae *apperr.Error
	if !errors.As(err, &ae) || ae.Fields["days"] != "oneof=7 30 90" {
		t.Fatalf("got %v", err)
	}
	if _, err := s.Breakdown(context.Background(), 0); !errors.As(err, &ae) {
		t.Fatalf("breakdown: %v", err)
	}
}
