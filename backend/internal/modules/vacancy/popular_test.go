package vacancy

import (
	"context"
	"encoding/json"
	"fmt"
	"net/netip"
	"slices"
	"testing"
)

// TZ SEC-07 / BE-11: a query reaches the public popular list only from 3+ different
// client IPs, spam never does, one IP can't push a query up, and an admin can hide any
// term.
func TestPopularSearches(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	c := f.svc.Cache
	ip := func(i int) netip.Addr { return netip.MustParseAddr(fmt.Sprintf("198.51.100.%d", i)) }
	popular := func() []string {
		t.Helper()
		rec := f.do("GET", "/search/popular", nil)
		var env struct {
			Data []string `json:"data"`
		}
		if err := json.Unmarshal(body(t, rec), &env); err != nil {
			t.Fatal(err)
		}
		return env.Data
	}

	word := "zq" + randWord(6)
	for i := 1; i <= 3; i++ {
		c.RecordSearch(ctx, "  Dasturchi  ", ip(i)) // normalized to "dasturchi"
	}
	for i := 1; i <= 4; i++ {
		c.RecordSearch(ctx, word+" operator", ip(i))
	}
	for range 50 {
		c.RecordSearch(ctx, "arzon ish", ip(9)) // one address, many times
	}
	c.RecordSearch(ctx, "arzon ish", ip(10))
	for i := 20; i < 30; i++ {
		c.RecordSearch(ctx, "онлайн казино", ip(i))
		c.RecordSearch(ctx, "t.me/tezkor_ish", ip(i))
	}

	got := popular()
	if !slices.Contains(got, "dasturchi") || !slices.Contains(got, word+" operator") {
		t.Fatalf("popular = %v, want dasturchi and %q", got, word+" operator")
	}
	for _, q := range []string{"arzon ish", "онлайн казино", "t.me/tezkor_ish"} {
		if slices.Contains(got, q) {
			t.Fatalf("%q is listed: %v", q, got)
		}
	}

	all, err := f.svc.PopularCandidates(ctx, 50)
	if err != nil {
		t.Fatal(err)
	}
	byQuery := map[string]PopularEntry{}
	for _, e := range all {
		byQuery[e.Query] = e
	}
	if e := byQuery["arzon ish"]; e.IPs != 2 || e.Score != 2 || e.Shown {
		t.Fatalf("arzon ish: %+v, want 2 IPs, score 2, hidden from the list", e)
	}
	if _, ok := byQuery["онлайн казино"]; ok {
		t.Fatal("spam was recorded at all")
	}

	// Hiding a word removes every query containing it, right away (cache invalidated).
	if _, err := f.svc.HideTerm(ctx, f.employer.UserID, word); err != nil {
		t.Fatal(err)
	}
	if got := popular(); slices.Contains(got, word+" operator") {
		t.Fatalf("hidden term still listed: %v", got)
	}
	if err := f.svc.UnhideTerm(ctx, word); err != nil {
		t.Fatal(err)
	}
	if got := popular(); !slices.Contains(got, word+" operator") {
		t.Fatalf("unhidden term missing: %v", got)
	}
	if err := f.svc.UnhideTerm(ctx, word); err == nil {
		t.Fatal("unhiding a term that isn't hidden should be 404")
	}
}

// Only searches with exact results are recorded; a typo answered with similar results
// never becomes a "popular search".
func TestPopularSkipsFuzzyResults(t *testing.T) {
	f := newFixture(t)
	word := "zyq" + randWord(10)
	f.publish(word + " operator")
	typo := word[:5] + "x" + word[6:]
	if word[5] == 'x' {
		typo = word[:5] + "w" + word[6:]
	}
	for _, q := range []string{word, typo} {
		rec := f.do("GET", "/vacancies?q="+q, nil)
		var env struct {
			Data []Card `json:"data"`
			Meta struct {
				Fuzzy bool `json:"fuzzy"`
			} `json:"meta"`
		}
		if err := json.Unmarshal(body(t, rec), &env); err != nil || len(env.Data) == 0 || env.Meta.Fuzzy != (q == typo) {
			t.Fatalf("q=%s: %d cards fuzzy=%v err=%v", q, len(env.Data), env.Meta.Fuzzy, err)
		}
	}
	all, err := f.svc.PopularCandidates(context.Background(), popularPool)
	if err != nil {
		t.Fatal(err)
	}
	var got []string
	for _, e := range all {
		got = append(got, e.Query)
	}
	if !slices.Contains(got, word) || slices.Contains(got, typo) {
		t.Fatalf("recorded %v: want the exact query only", got)
	}
}

// One IP can add at most popularPerIP queries a day to the statistics.
func TestPopularPerIPBudget(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	flood := netip.MustParseAddr("203.0.113.99")
	for i := range popularPerIP {
		f.svc.Cache.RecordSearch(ctx, fmt.Sprintf("savol n%03d", i), flood) // never spam-filtered
	}
	last := "oxirgi savol"
	f.svc.Cache.RecordSearch(ctx, last, flood)
	all, err := f.svc.PopularCandidates(ctx, popularPool)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range all {
		if e.Query == last {
			t.Fatalf("query over the daily budget was recorded: %+v", e)
		}
	}
}
