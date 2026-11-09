package admin

import (
	"context"
	"fmt"
	"slices"
	"time"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/pkg/apperr"
)

// StatsPeriod is how many calendar days (Asia/Tashkent) a statistics view covers. The
// period ends today and includes it.
type StatsPeriod int32

// StatsPeriods lists the periods the overview offers; the second is the default.
var StatsPeriods = []StatsPeriod{7, 30, 90}

const (
	DefaultStatsPeriod StatsPeriod = 30
	statsCacheTTL                  = 5 * time.Minute
	statsTopN                      = 8
)

// Valid reports whether p is one of StatsPeriods.
func (p StatsPeriod) Valid() bool { return slices.Contains(StatsPeriods, p) }

var errStatsPeriod = apperr.Validation(map[string]string{"days": apperr.OneOf(StatsPeriods)})

// StatsCache keeps computed statistics for a few minutes (they scan whole tables and the
// overview is opened often). Get reports whether dst was filled. Required by Activity and
// Breakdown; NoStatsCache computes every time (tests, tools).
type StatsCache interface {
	Get(ctx context.Context, key string, dst any) (bool, error)
	Set(ctx context.Context, key string, v any, ttl time.Duration) error
}

// NoStatsCache is a StatsCache that never hits.
type NoStatsCache struct{}

func (NoStatsCache) Get(context.Context, string, any) (bool, error)        { return false, nil }
func (NoStatsCache) Set(context.Context, string, any, time.Duration) error { return nil }

// statsCacheVersion is part of every key: bump it when a response shape changes so old
// entries are never served to new code.
const statsCacheVersion = "v1"

// StatsWindow is the period a response covers: Days calendar days ending today (To).
type StatsWindow struct {
	Days StatsPeriod `json:"days"`
	From string      `json:"from"` // YYYY-MM-DD, Asia/Tashkent
	To   string      `json:"to"`   // today
}

func windowOf(p StatsPeriod, today time.Time) StatsWindow {
	return StatsWindow{Days: p, From: today.AddDate(0, 0, -int(p)+1).Format(time.DateOnly), To: today.Format(time.DateOnly)}
}

// PeriodTotal is a count for the period and for the same number of days just before it.
type PeriodTotal struct {
	Current  int32 `json:"current"`
	Previous int32 `json:"previous"`
}

// DayActivity is one day's counts.
type DayActivity struct {
	Date               string `json:"date"` // YYYY-MM-DD, Asia/Tashkent
	SignupsSeeker      int32  `json:"signups_seeker"`
	SignupsEmployer    int32  `json:"signups_employer"`
	VacanciesPublished int32  `json:"vacancies_published"`
	ApplicationsSent   int32  `json:"applications_sent"`
	ReportsFiled       int32  `json:"reports_filed"`
}

type ActivityTotals struct {
	SignupsSeeker      PeriodTotal `json:"signups_seeker"`
	SignupsEmployer    PeriodTotal `json:"signups_employer"`
	VacanciesPublished PeriodTotal `json:"vacancies_published"`
	ApplicationsSent   PeriodTotal `json:"applications_sent"`
	ReportsFiled       PeriodTotal `json:"reports_filed"`
}

// Activity is the daily activity view: one bucket per day of the period, oldest first.
type Activity struct {
	Period StatsWindow    `json:"period"`
	Daily  []DayActivity  `json:"daily"`
	Totals ActivityTotals `json:"totals"`
}

// RankedItem is a category or region with the vacancies published in it in the period.
type RankedItem struct {
	ID                 int32         `json:"id"`
	Slug               string        `json:"slug"`
	Name               catalog.Names `json:"name"`
	VacanciesPublished int32         `json:"vacancies_published"`
}

// ApplicationFunnel counts applications sent in the period and how many of them ever
// reached each later stage (see AdminApplicationFunnel for the exact rules).
type ApplicationFunnel struct {
	Sent    int32 `json:"sent"`
	Viewed  int32 `json:"viewed"`
	Invited int32 `json:"invited"`
	Hired   int32 `json:"hired"`
}

// Breakdown is where the period's activity went.
type Breakdown struct {
	Period        StatsWindow       `json:"period"`
	TopCategories []RankedItem      `json:"top_categories"`
	TopRegions    []RankedItem      `json:"top_regions"`
	Funnel        ApplicationFunnel `json:"funnel"`
}

// Activity returns the daily counts for the period with period-over-period totals.
func (s *Service) Activity(ctx context.Context, p StatsPeriod) (Activity, error) {
	w, err := s.window(ctx, p)
	if err != nil {
		return Activity{}, err
	}
	return cached(ctx, s.Cache, statsKey("activity", w), func() (Activity, error) {
		rows, err := s.Store.AdminDailyActivity(ctx, int32(p))
		if err != nil {
			return Activity{}, err
		}
		return activityFrom(w, rows), nil
	})
}

// Breakdown returns the top categories and regions and the application funnel.
func (s *Service) Breakdown(ctx context.Context, p StatsPeriod) (Breakdown, error) {
	w, err := s.window(ctx, p)
	if err != nil {
		return Breakdown{}, err
	}
	return cached(ctx, s.Cache, statsKey("breakdown", w), func() (Breakdown, error) {
		cats, err := s.Store.AdminTopCategories(ctx, gen.AdminTopCategoriesParams{Days: int32(p), MaxResults: statsTopN})
		if err != nil {
			return Breakdown{}, err
		}
		regions, err := s.Store.AdminTopRegions(ctx, gen.AdminTopRegionsParams{Days: int32(p), MaxResults: statsTopN})
		if err != nil {
			return Breakdown{}, err
		}
		f, err := s.Store.AdminApplicationFunnel(ctx, int32(p))
		if err != nil {
			return Breakdown{}, err
		}
		b := Breakdown{Period: w, Funnel: ApplicationFunnel(f),
			TopCategories: make([]RankedItem, len(cats)), TopRegions: make([]RankedItem, len(regions))}
		for i, c := range cats {
			b.TopCategories[i] = rankedItem(gen.AdminTopRegionsRow(c))
		}
		for i, r := range regions {
			b.TopRegions[i] = rankedItem(r)
		}
		return b, nil
	})
}

func rankedItem(r gen.AdminTopRegionsRow) RankedItem {
	return RankedItem{ID: r.ID, Slug: r.Slug, VacanciesPublished: r.VacanciesPublished,
		Name: catalog.Names{Uz: r.NameUz, UzCyrl: r.NameUzCyrl, Ru: r.NameRu, En: r.NameEn}}
}

// window validates p and pins the period to today as the database sees it (the same
// clock the queries use), so the response and its cache key agree with the counts.
func (s *Service) window(ctx context.Context, p StatsPeriod) (StatsWindow, error) {
	if !p.Valid() {
		return StatsWindow{}, errStatsPeriod
	}
	today, err := s.Store.AdminStatsToday(ctx)
	if err != nil {
		return StatsWindow{}, err
	}
	return windowOf(p, today), nil
}

// statsKey includes the day, so a cached view never outlives the day it describes.
func statsKey(view string, w StatsWindow) string {
	return fmt.Sprintf("admin:stats:%s:%s:%d:%s", statsCacheVersion, view, w.Days, w.To)
}

// activityFrom puts each row from AdminDailyActivity (the period and the one before it)
// into the current period's buckets or the previous period's totals by its date.
func activityFrom(w StatsWindow, rows []gen.AdminDailyActivityRow) Activity {
	a := Activity{Period: w, Daily: make([]DayActivity, 0, w.Days)}
	add := func(t *ActivityTotals, r gen.AdminDailyActivityRow, pick func(*PeriodTotal) *int32) {
		*pick(&t.SignupsSeeker) += r.SignupsSeeker
		*pick(&t.SignupsEmployer) += r.SignupsEmployer
		*pick(&t.VacanciesPublished) += r.VacanciesPublished
		*pick(&t.ApplicationsSent) += r.ApplicationsSent
		*pick(&t.ReportsFiled) += r.ReportsFiled
	}
	for _, r := range rows {
		date := r.Day.Format(time.DateOnly)
		if date < w.From { // YYYY-MM-DD compares in date order
			add(&a.Totals, r, func(t *PeriodTotal) *int32 { return &t.Previous })
			continue
		}
		add(&a.Totals, r, func(t *PeriodTotal) *int32 { return &t.Current })
		a.Daily = append(a.Daily, DayActivity{Date: date, SignupsSeeker: r.SignupsSeeker,
			SignupsEmployer: r.SignupsEmployer, VacanciesPublished: r.VacanciesPublished,
			ApplicationsSent: r.ApplicationsSent, ReportsFiled: r.ReportsFiled})
	}
	return a
}

// cached serves key from c, computing and storing it on a miss. A cache failure only
// costs a recomputation, so it never fails the request.
func cached[T any](ctx context.Context, c StatsCache, key string, compute func() (T, error)) (T, error) {
	var v T
	if ok, err := c.Get(ctx, key, &v); err == nil && ok {
		return v, nil
	}
	v, err := compute()
	if err != nil {
		return v, err
	}
	_ = c.Set(ctx, key, v, statsCacheTTL)
	return v, nil
}
