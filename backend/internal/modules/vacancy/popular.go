package vacancy

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/netip"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/translit"
)

// Popular searches (TZ BE-11, SEC-07). A query that returned results is counted once per
// client IP per day; the public list shows only queries that
//   - were run from at least PopularMinIPs different IPs over the last 7 days,
//   - pass the automatic spam filter (links, contacts, phone numbers, profanity, …), and
//   - contain no term an admin has hidden.
//
// Redis layout (keys expire on their own after 8 days):
//
//	search:pop:<day>                  ZSET  query → IPs that ran it that day
//	search:pop:ips:<day>:<hash(q)>    HLL   the client IPs of one query on one day
//	search:pop:budget:<day>:<ip>      int   queries recorded for an IP today (≤ 100)
const (
	popularDays    = 7
	popularShown   = 10  // queries returned by /search/popular
	popularPool    = 200 // top-scored candidates checked against filters and IP counts
	popularPerIP   = 100 // queries one IP can add to the statistics per day
	defaultMinIPs  = 3
	maxQueryRunes  = 60
	popularKeepFor = (popularDays + 1) * 24 * time.Hour
)

func day(t time.Time) string                         { return t.UTC().Format("20060102") }
func popularDayKey(t time.Time) string               { return "search:pop:" + day(t) }
func popularBudgetKey(t time.Time, ip string) string { return "search:pop:budget:" + day(t) + ":" + ip }
func popularIPsKey(t time.Time, q string) string {
	sum := sha256.Sum256([]byte(q))
	return "search:pop:ips:" + day(t) + ":" + hex.EncodeToString(sum[:8])
}

// normalizeQuery lower-cases and collapses spaces; "" if the query is too short or long
// to be worth listing.
func normalizeQuery(raw string) string {
	q := strings.ToLower(strings.Join(strings.Fields(raw), " "))
	if n := len([]rune(q)); n < 2 || n > maxQueryRunes {
		return ""
	}
	return q
}

// recordScript: KEYS = budget, HLL of the day's IPs for the query, the day's ZSET;
// ARGV = ip, query, ttl seconds, per-IP daily budget. Only an IP new to the query today
// raises its score, so repeating a search from one address never pushes it up.
var recordScript = redis.NewScript(`
local n = redis.call("INCR", KEYS[1])
if n == 1 then redis.call("EXPIRE", KEYS[1], 90000) end
if n > tonumber(ARGV[4]) then return 0 end
if redis.call("PFADD", KEYS[2], ARGV[1]) == 1 then
  redis.call("ZINCRBY", KEYS[3], 1, ARGV[2])
end
redis.call("EXPIRE", KEYS[2], ARGV[3])
redis.call("EXPIRE", KEYS[3], ARGV[3])
return 1
`)

// RecordSearch counts a query that returned results for the popular list.
func (p *PublicCache) RecordSearch(ctx context.Context, raw string, ip netip.Addr) {
	if p == nil || !ip.IsValid() {
		return
	}
	q := normalizeQuery(raw)
	if q == "" || spamQuery(q) {
		return
	}
	now := time.Now()
	addr := ip.Unmap().String()
	err := recordScript.Run(ctx, p.RDB,
		[]string{popularBudgetKey(now, addr), popularIPsKey(now, q), popularDayKey(now)},
		addr, q, int(popularKeepFor.Seconds()), popularPerIP).Err()
	if err != nil {
		p.Log.WarnContext(ctx, "record search failed", "err", err)
	}
}

// PopularEntry is a candidate for the popular list with the numbers behind the decision
// (the admin view shows all of them).
type PopularEntry struct {
	Query  string `json:"query"`
	Score  int    `json:"score"`  // new client IPs per day, summed over 7 days
	IPs    int    `json:"ips"`    // different client IPs over 7 days (HyperLogLog estimate)
	Spam   bool   `json:"spam"`   // caught by the automatic filter
	Hidden bool   `json:"hidden"` // contains a term hidden by an admin
	Shown  bool   `json:"shown"`  // on the public list
}

func (p *PublicCache) minIPs() int {
	if p.PopularMinIPs > 0 {
		return p.PopularMinIPs
	}
	return defaultMinIPs
}

// PopularCandidates returns the most searched queries of the last week, best first,
// each marked with why it is or isn't shown.
func (s *Service) PopularCandidates(ctx context.Context, limit int) ([]PopularEntry, error) {
	p := s.Cache
	now := time.Now()
	days := make([]string, popularDays)
	for i := range days {
		days[i] = popularDayKey(now.AddDate(0, 0, -i))
	}
	// MULTI/EXEC: the scratch key is private to this transaction.
	const scratch = "search:pop:week"
	pipe := p.RDB.TxPipeline()
	pipe.ZUnionStore(ctx, scratch, &redis.ZStore{Keys: days})
	topCmd := pipe.ZRevRangeWithScores(ctx, scratch, 0, int64(limit-1))
	pipe.Del(ctx, scratch)
	if _, err := pipe.Exec(ctx); err != nil {
		return nil, err
	}
	top := topCmd.Val()
	if len(top) == 0 {
		return []PopularEntry{}, nil
	}

	rows, err := s.Q.ListHiddenSearchTerms(ctx)
	if err != nil {
		return nil, err
	}
	hidden := make([]string, len(rows))
	for i, r := range rows {
		hidden[i] = r.Term // stored folded
	}

	out := make([]PopularEntry, len(top))
	counts := make([]*redis.IntCmd, len(top))
	pipe = p.RDB.Pipeline()
	for i, z := range top {
		q, _ := z.Member.(string)
		out[i] = PopularEntry{Query: q, Score: int(z.Score), Spam: spamQuery(q),
			Hidden: hiddenBy(translit.Fold(q), hidden)}
		keys := make([]string, popularDays)
		for d := range keys {
			keys[d] = popularIPsKey(now.AddDate(0, 0, -d), q)
		}
		counts[i] = pipe.PFCount(ctx, keys...)
	}
	if _, err := pipe.Exec(ctx); err != nil {
		return nil, err
	}
	for i := range out {
		out[i].IPs = int(counts[i].Val())
		out[i].Shown = !out[i].Spam && !out[i].Hidden && out[i].IPs >= p.minIPs()
	}
	return out, nil
}

// popular builds the public list (the /search/popular cache loader).
func (s *Service) popular(ctx context.Context) ([]string, error) {
	all, err := s.PopularCandidates(ctx, popularPool)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, popularShown)
	for _, e := range all {
		if e.Shown && len(out) < popularShown {
			out = append(out, e.Query)
		}
	}
	return out, nil
}

// ---- moderation --------------------------------------------------------------------------

type HiddenTerm struct {
	Term      string    `json:"term"`
	CreatedAt time.Time `json:"created_at"`
}

var errTerm = apperr.Validation(map[string]string{"term": "required"})

// foldTerm is how terms are stored and compared: the same folded form as search text,
// so hiding "казино" also hides "kazino".
func foldTerm(raw string) (string, error) {
	t := translit.Fold(raw)
	if t == "" || len([]rune(t)) > 100 {
		return "", errTerm
	}
	return t, nil
}

func (s *Service) HiddenTerms(ctx context.Context) ([]HiddenTerm, error) {
	rows, err := s.Q.ListHiddenSearchTerms(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]HiddenTerm, len(rows))
	for i, r := range rows {
		out[i] = HiddenTerm{Term: r.Term, CreatedAt: r.CreatedAt}
	}
	return out, nil
}

// HideTerm removes every query containing term from the public list (idempotent).
func (s *Service) HideTerm(ctx context.Context, admin uuid.UUID, raw string) (HiddenTerm, error) {
	t, err := foldTerm(raw)
	if err != nil {
		return HiddenTerm{}, err
	}
	if err := s.Q.HideSearchTerm(ctx, gen.HideSearchTermParams{Term: t, HiddenBy: &admin}); err != nil {
		return HiddenTerm{}, err
	}
	s.popularChanged(ctx)
	return HiddenTerm{Term: t, CreatedAt: time.Now().UTC()}, nil
}

func (s *Service) UnhideTerm(ctx context.Context, raw string) error {
	t, err := foldTerm(raw)
	if err != nil {
		return err
	}
	n, err := s.Q.UnhideSearchTerm(ctx, t)
	if err != nil {
		return err
	}
	if n == 0 {
		return apperr.NotFound("hidden_term_not_found", "this term is not hidden")
	}
	s.popularChanged(ctx)
	return nil
}

func (s *Service) popularChanged(ctx context.Context) {
	ctx, cancel := s.Cache.detached(ctx)
	defer cancel()
	s.Cache.warn(ctx, "popular", s.Cache.Popular.Invalidate(ctx, popularKey))
}

const popularKey = "top"
