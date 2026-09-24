package vacancy

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"testing"
	"time"
)

func body(t *testing.T, rec interface {
	Result() *http.Response
}) []byte {
	t.Helper()
	res := rec.Result()
	b, _ := io.ReadAll(res.Body)
	if res.Header.Get("Content-Encoding") == "gzip" {
		zr, err := gzip.NewReader(bytes.NewReader(b))
		if err != nil {
			t.Fatal(err)
		}
		b, _ = io.ReadAll(zr)
	}
	return b
}

func detailTitle(t *testing.T, b []byte) string {
	t.Helper()
	var env struct {
		Data Detail `json:"data"`
	}
	if err := json.Unmarshal(b, &env); err != nil {
		t.Fatalf("decode %s: %v", b, err)
	}
	return env.Data.Title
}

// TZ BE-05: the public vacancy page is served from cached bytes with an ETag; a repeat
// request with If-None-Match gets 304; an edit or archive is visible on the next
// request (the entry is invalidated, not left to expire).
func TestDetailCacheETagAndInvalidation(t *testing.T) {
	f := newFixture(t)
	d := f.publish("Omborchi " + randWord(6))
	path := "/vacancies/" + d.Slug

	rec := f.do("GET", path, map[string]string{"Accept-Encoding": "gzip"})
	if rec.Code != 200 || rec.Header().Get("X-Cache") != "MISS" || rec.Header().Get("Content-Encoding") != "gzip" {
		t.Fatalf("first GET: %d %v", rec.Code, rec.Header())
	}
	if cc := rec.Header().Get("Cache-Control"); cc != "public, max-age=60" {
		t.Fatalf("anonymous Cache-Control = %q", cc)
	}
	etag := rec.Header().Get("ETag")
	if got := detailTitle(t, body(t, rec)); got != d.Title {
		t.Fatalf("title %q", got)
	}

	rec = f.do("GET", path, nil)
	if rec.Header().Get("X-Cache") != "HIT" || rec.Header().Get("ETag") != etag {
		t.Fatalf("second GET: %v", rec.Header())
	}
	if got := detailTitle(t, body(t, rec)); got != d.Title { // plain client: decompressed
		t.Fatalf("plain body title %q", got)
	}
	if rec = f.do("GET", path, map[string]string{"If-None-Match": etag}); rec.Code != http.StatusNotModified {
		t.Fatalf("If-None-Match: %d, want 304", rec.Code)
	}

	// The author edits the title: the next public request sees it.
	in := Input{Title: d.Title + " (yangi)", Description: d.Description, CategoryID: d.CategoryID,
		RegionID: d.RegionID, EmploymentType: d.EmploymentType, WorkFormat: d.WorkFormat,
		Experience: d.Experience, Schedule: d.Schedule}
	if _, err := f.svc.Update(context.Background(), f.employer, d.ID, in); err != nil {
		t.Fatal(err)
	}
	rec = f.do("GET", path, map[string]string{"If-None-Match": etag})
	if rec.Code != 200 || rec.Header().Get("X-Cache") != "MISS" || detailTitle(t, body(t, rec)) != in.Title {
		t.Fatalf("after update: %d %s", rec.Code, rec.Header().Get("X-Cache"))
	}
	if rec.Header().Get("ETag") == etag {
		t.Fatal("ETag unchanged after an edit")
	}
	// Both spellings of the address were dropped.
	if rec = f.do("GET", "/vacancies/"+d.ID.String(), nil); detailTitle(t, body(t, rec)) != in.Title {
		t.Fatal("uuid address still shows the old title")
	}

	if _, err := f.svc.Archive(context.Background(), f.employer, d.ID); err != nil {
		t.Fatal(err)
	}
	for _, p := range []string{path, "/vacancies/" + d.ID.String()} {
		if rec = f.do("GET", p, nil); rec.Code != http.StatusNotFound {
			t.Fatalf("archived %s: %d, want 404", p, rec.Code)
		}
	}
}

// TZ BE-05: publishing marks cached listings stale; the next request serves the old page
// once (stale-while-revalidate) while it is rebuilt, then the new vacancy is listed.
func TestListInvalidatedOnPublish(t *testing.T) {
	f := newFixture(t)
	f.publish("Qorovul " + randWord(6))
	path := "/vacancies?company_id=" + f.company.ID.String()
	count := func(rec interface{ Result() *http.Response }) int {
		var env struct {
			Data []Card `json:"data"`
			Meta struct {
				Total *int `json:"total"`
			} `json:"meta"`
		}
		if err := json.Unmarshal(body(t, rec), &env); err != nil {
			t.Fatal(err)
		}
		return len(env.Data)
	}
	if rec := f.do("GET", path, nil); count(rec) != 1 || rec.Header().Get("X-Cache") != "MISS" {
		t.Fatalf("first list: %s", rec.Header().Get("X-Cache"))
	}
	if rec := f.do("GET", path, nil); rec.Header().Get("X-Cache") != "HIT" {
		t.Fatalf("second list: %s", rec.Header().Get("X-Cache"))
	}
	f.publish("Farrosh " + randWord(6))
	rec := f.do("GET", path, nil)
	if rec.Header().Get("X-Cache") != "STALE" || count(rec) != 1 {
		t.Fatalf("after publish: %s", rec.Header().Get("X-Cache"))
	}
	var n int
	for i := 0; i < 50; i++ {
		settle()
		rec = f.do("GET", path, nil)
		if n = count(rec); n == 2 {
			break
		}
	}
	if n != 2 || rec.Header().Get("X-Cache") != "HIT" {
		t.Fatalf("refreshed list has %d cards (%s), want 2 HIT", n, rec.Header().Get("X-Cache"))
	}
}

// TZ BE-11: the listing total is cached apart (120 s) so a refreshed page doesn't recount.
func TestListTotalCachedSeparately(t *testing.T) {
	f := newFixture(t)
	for range 3 {
		f.publish("Haydovchi " + randWord(6))
	}
	path := "/vacancies?limit=2&company_id=" + f.company.ID.String()
	rec := f.do("GET", path, nil)
	var env struct {
		Meta struct {
			Total int `json:"total"`
		} `json:"meta"`
	}
	if err := json.Unmarshal(body(t, rec), &env); err != nil || env.Meta.Total != 3 {
		t.Fatalf("total = %d (%v)", env.Meta.Total, err)
	}
	var keys []string
	for _, k := range f.mr.Keys() {
		if len(k) > 14 && k[:14] == "vacancy:total:" {
			keys = append(keys, k)
		}
	}
	if len(keys) != 1 {
		t.Fatalf("total keys: %v", keys)
	}
	if ttl := f.mr.TTL(keys[0]); ttl < 100*time.Second || ttl > 120*time.Second {
		t.Fatalf("total TTL %v, want 120s", ttl)
	}
}

// TZ FE-02/BE-10: the view beacon counts real visitors once per hour, skips bots, and
// works for cached pages; the cached GET still counts too (until the web switches).
func TestViewBeacon(t *testing.T) {
	f := newFixture(t)
	d := f.publish("Sotuvchi " + randWord(6))
	ctx := context.Background()
	views := func() int {
		n, _ := f.rdb.HGet(ctx, viewsKey, d.ID.String()).Int()
		return n
	}
	ua := map[string]string{"User-Agent": browserUA}

	if rec := f.do("POST", "/vacancies/"+d.Slug+"/view", ua); rec.Code != http.StatusNoContent {
		t.Fatalf("beacon: %d", rec.Code)
	}
	if rec := f.do("POST", "/vacancies/"+d.ID.String()+"/view", ua); rec.Code != http.StatusNoContent {
		t.Fatalf("beacon by id: %d", rec.Code)
	}
	if views() != 1 {
		t.Fatalf("views after two beacons from one IP = %d, want 1", views())
	}
	for i, bot := range []string{"", "curl/8.5.0", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"} {
		req := map[string]string{"User-Agent": bot, "RemoteAddr": "198.51.100." + string(rune('1'+i)) + ":443"}
		if rec := f.do("POST", "/vacancies/"+d.Slug+"/view", req); rec.Code != http.StatusNoContent {
			t.Fatalf("bot beacon: %d", rec.Code)
		}
	}
	if views() != 1 {
		t.Fatalf("bots were counted: %d", views())
	}
	if rec := f.do("POST", "/vacancies/no-such-vacancy/view", ua); rec.Code != http.StatusNotFound {
		t.Fatalf("unknown vacancy beacon: %d", rec.Code)
	}

	// GET still counts, cached or not (the web's SSR today); the hour's dedupe key is
	// dropped in between to stand for other visitors.
	dedupe := "vacancy:viewed:" + d.ID.String() + ":ip:203.0.113.10"
	f.mr.Del(dedupe)
	if rec := f.do("GET", "/vacancies/"+d.Slug, ua); rec.Header().Get("X-Cache") != "MISS" || views() != 2 {
		t.Fatalf("uncached GET: %s views=%d", rec.Header().Get("X-Cache"), views())
	}
	f.mr.Del(dedupe)
	if rec := f.do("GET", "/vacancies/"+d.Slug, ua); rec.Header().Get("X-Cache") != "HIT" || views() != 3 {
		t.Fatalf("cached GET: %s views=%d", rec.Header().Get("X-Cache"), views())
	}

	// Flushing moves the counts into Postgres.
	if _, err := f.svc.Views.Flush(ctx, f.q); err != nil {
		t.Fatal(err)
	}
	v, err := f.q.GetVacancyByID(ctx, d.ID)
	if err != nil || v.ViewsCount != 3 {
		t.Fatalf("views_count = %d (%v), want 3", v.ViewsCount, err)
	}
}

// TZ BE-11: suggestions come from vacancy_search alone and show the title as written.
func TestSuggestShowsOriginalTitle(t *testing.T) {
	f := newFixture(t)
	word := "Zq" + randWord(7)
	d := f.publish(word + " Operatori")
	rec := f.do("GET", "/search/suggest?q="+url.QueryEscape(word[:5]), nil)
	var env struct {
		Data Suggestions `json:"data"`
	}
	if err := json.Unmarshal(body(t, rec), &env); err != nil {
		t.Fatal(err)
	}
	if len(env.Data.Titles) != 1 || env.Data.Titles[0].Title != d.Title || env.Data.Titles[0].Vacancies != 1 {
		t.Fatalf("suggestions: %+v", env.Data.Titles)
	}
	if rec.Header().Get("ETag") == "" || rec.Header().Get("X-Cache") != "MISS" {
		t.Fatalf("suggest headers: %v", rec.Header())
	}

	// Companies: the name-prefix match comes first, then similar names, no duplicates.
	var name string
	if err := f.pool.QueryRow(context.Background(), `SELECT name FROM companies WHERE id = $1`, f.company.ID).Scan(&name); err != nil {
		t.Fatal(err)
	}
	rec = f.do("GET", "/search/suggest?q="+url.QueryEscape(name), nil)
	env.Data = Suggestions{}
	if err := json.Unmarshal(body(t, rec), &env); err != nil {
		t.Fatal(err)
	}
	cs := env.Data.Companies
	if len(cs) == 0 || cs[0].ID != f.company.ID || len(cs) > 3 {
		t.Fatalf("company suggestions: %+v", cs)
	}
	seen := map[string]bool{}
	for _, c := range cs {
		if seen[c.ID.String()] {
			t.Fatalf("duplicate company %s", c.Name)
		}
		seen[c.ID.String()] = true
	}
}

// TZ BE-11: saved-search alerts never fall back to typo-tolerant matching.
func TestListNewIsExactOnly(t *testing.T) {
	f := newFixture(t)
	start := time.Now().Add(-time.Second)
	word := "zyq" + randWord(10) // long enough for one typo to stay above the 0.6 similarity
	f.publish(word + " mutaxassis")
	// One letter wrong in the middle (a missing last letter would still match as a prefix).
	swap := byte('x')
	if word[5] == 'x' {
		swap = 'w'
	}
	typo := word[:5] + string(swap) + word[6:]

	pub := Filter{Limit: 10, Sort: SortRelevance, PublishedAfter: &start}
	pub.Query = parseQ(typo)
	res, err := f.svc.List(context.Background(), pub)
	if err != nil || !res.Fuzzy || len(res.Cards) != 1 {
		t.Fatalf("public listing: fuzzy=%v cards=%d err=%v (want the similar result)", res.Fuzzy, len(res.Cards), err)
	}
	alert := Filter{Limit: 10, PublishedAfter: &start}
	alert.Query = parseQ(typo)
	res, err = f.svc.ListNew(context.Background(), alert)
	if err != nil || res.Fuzzy || len(res.Cards) != 0 || res.Total != nil {
		t.Fatalf("alert listing: fuzzy=%v cards=%d total=%v err=%v", res.Fuzzy, len(res.Cards), res.Total, err)
	}
	alert.Query = parseQ(word)
	if res, err = f.svc.ListNew(context.Background(), alert); err != nil || len(res.Cards) != 1 || res.Total != nil {
		t.Fatalf("exact alert listing: cards=%d total=%v err=%v", len(res.Cards), res.Total, err)
	}
}

// TZ BE-10: flushing views or counting an application doesn't move updated_at; a content
// edit still does.
func TestCountersKeepUpdatedAt(t *testing.T) {
	f := newFixture(t)
	d := f.publish("Oshpaz " + randWord(6))
	ctx := context.Background()
	before, err := f.q.GetVacancyByID(ctx, d.ID)
	if err != nil {
		t.Fatal(err)
	}
	for _, viewer := range []string{"ip:198.51.100.1", "ip:198.51.100.2", "u:" + f.employer.UserID.String()} {
		if err := f.svc.Views.Hit(ctx, d.ID, viewer); err != nil {
			t.Fatal(err)
		}
	}
	time.Sleep(10 * time.Millisecond)
	if _, err := f.svc.Views.Flush(ctx, f.q); err != nil {
		t.Fatal(err)
	}
	if err := f.q.IncrementVacancyApplications(ctx, d.ID); err != nil {
		t.Fatal(err)
	}
	after, err := f.q.GetVacancyByID(ctx, d.ID)
	if err != nil {
		t.Fatal(err)
	}
	if after.ViewsCount != 3 || after.ApplicationsCount != 1 {
		t.Fatalf("counters %d/%d, want 3/1", after.ViewsCount, after.ApplicationsCount)
	}
	if !after.UpdatedAt.Equal(before.UpdatedAt) {
		t.Fatalf("updated_at moved from %v to %v on counter updates", before.UpdatedAt, after.UpdatedAt)
	}
	if _, err := f.pool.Exec(ctx, `UPDATE vacancies SET address = 'Chilonzor 1' WHERE id = $1`, d.ID); err != nil {
		t.Fatal(err)
	}
	edited, _ := f.q.GetVacancyByID(ctx, d.ID)
	if !edited.UpdatedAt.After(before.UpdatedAt) {
		t.Fatal("a content edit no longer moves updated_at")
	}
}
