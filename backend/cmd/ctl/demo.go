package main

// `ctl seed-demo` fills the database with realistic demo data for showing the product;
// `ctl purge-demo` removes exactly that data again. Demo data is everything owned by users
// whose email ends with demoDomain, plus the few new skills in demoNewSkills.
//
// Rows are written with SQL so the timeline can be backdated (signups over 90 days,
// vacancies over 60, applications and their history in between); resumes go through the
// resume service so their sections and search rows are built exactly like the app does.
// Randomness has a fixed seed, so every run produces the same data.

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math/rand/v2"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	goredis "github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/modules/resume"
	"jobvacancy.uz/backend/internal/modules/vacancy"
	"jobvacancy.uz/backend/internal/pkg/hash"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/pkg/slug"
)

type demoLeaf struct {
	id     int32
	slug   string
	family string
}

type demoRegion struct {
	id        int32
	slug      string
	name      string
	districts []int32
}

type demoUser struct {
	id    uuid.UUID
	email string
	name  string
	role  string
	at    time.Time
}

type demoCompany struct {
	id       uuid.UUID
	name     string
	owner    demoUser
	verified bool
	blocked  bool
	family   string
}

type demoVacancy struct {
	id          uuid.UUID
	company     *demoCompany
	title       string
	status      string
	publishedAt *time.Time
	expiresAt   *time.Time
}

type demoApp struct {
	id      uuid.UUID
	vac     *demoVacancy
	seeker  demoUser
	resume  uuid.UUID
	status  string
	at      time.Time
	changed time.Time
}

type seeder struct {
	ctx      context.Context
	pool     *pgxpool.Pool
	rdb      *goredis.Client
	log      *slog.Logger
	r        *rand.Rand
	now      time.Time
	pwHash   string
	cat      *catalog.Service
	leaves   []demoLeaf
	regions  []demoRegion
	tashkent int32
	phoneSeq int

	seeker, hr, admin demoUser
	seekers           []demoUser
	employers         []demoUser
	companies         []*demoCompany
	vacancies         []*demoVacancy
	resumes           map[uuid.UUID]uuid.UUID // user → main resume
	apps              []demoApp
}

func seedDemo(ctx context.Context, pool *pgxpool.Pool, rdb *goredis.Client, reset bool) error {
	var n int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM users WHERE email ILIKE $1`, "%"+demoDomain).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		if !reset {
			return fmt.Errorf("%d demo users already exist; run `ctl seed-demo --reset` to replace them or `ctl purge-demo` to remove them", n)
		}
		if err := purgeDemo(ctx, pool, rdb); err != nil {
			return err
		}
	}

	pw, err := hash.Password(demoPassword)
	if err != nil {
		return err
	}
	log := slog.Default()
	q := gen.New(pool)
	cat := &catalog.Service{Q: q, Log: log}
	if err := cat.Reload(ctx); err != nil {
		return err
	}
	s := &seeder{
		ctx: ctx, pool: pool, rdb: rdb, log: log, cat: cat, pwHash: pw,
		r:       rand.New(rand.NewPCG(20261110, 42)),
		now:     time.Now().UTC().Truncate(time.Minute),
		resumes: map[uuid.UUID]uuid.UUID{},
	}
	if err := s.loadCatalog(); err != nil {
		return err
	}
	steps := []struct {
		name string
		fn   func() error
	}{
		{"users", s.seedUsers},
		{"companies and vacancies", s.seedCompaniesAndVacancies},
		{"resumes", s.seedResumes},
		{"applications, chats, notifications, reports", s.seedActivity},
		{"search index and caches", s.refresh},
	}
	for _, st := range steps {
		if err := st.fn(); err != nil {
			return fmt.Errorf("%s: %w", st.name, err)
		}
		fmt.Printf("✔ %s\n", st.name)
	}
	fmt.Printf("demo data ready: %d seekers, %d employers, %d companies, %d vacancies, %d resumes, %d applications\n",
		len(s.seekers)+1, len(s.employers)+1, len(s.companies), len(s.vacancies), len(s.resumes), len(s.apps))
	fmt.Printf("sign in as seeker@demo.uz, hr@demo.uz or admin@demo.uz with password %s\n", demoPassword)
	return nil
}

// ---- helpers ------------------------------------------------------------------------------

func (s *seeder) pick(xs []string) string { return xs[s.r.IntN(len(xs))] }
func (s *seeder) chance(pct int) bool     { return s.r.IntN(100) < pct }
func (s *seeder) between(a, b time.Time) time.Time {
	if !b.After(a) {
		return a
	}
	return a.Add(time.Duration(s.r.Int64N(int64(b.Sub(a)))))
}
func (s *seeder) daysAgo(d int) time.Time { return s.now.Add(-time.Duration(d) * 24 * time.Hour) }

func (s *seeder) person() (string, bool) {
	female := s.chance(45)
	first := s.pick(maleFirst)
	last := s.pick(lastNames)
	if female {
		first = s.pick(femaleFirst)
		last += "a"
	}
	return first + " " + last, female
}

func (s *seeder) phone() string {
	s.phoneSeq++
	return fmt.Sprintf("+99877%07d", 7000000+s.phoneSeq)
}

func (s *seeder) leaf() demoLeaf {
	total := 0
	for _, l := range s.leaves {
		total += familyWeight[l.family]
	}
	n := s.r.IntN(total)
	for _, l := range s.leaves {
		n -= familyWeight[l.family]
		if n < 0 {
			return l
		}
	}
	return s.leaves[0]
}

// region is weighted to the capital the way the market is; half the time a district too.
func (s *seeder) region() (int32, *int32) {
	reg := s.regions[s.r.IntN(len(s.regions))]
	if s.chance(45) {
		for _, x := range s.regions {
			if x.id == s.tashkent {
				reg = x
			}
		}
	}
	if len(reg.districts) > 0 && s.chance(50) {
		d := reg.districts[s.r.IntN(len(reg.districts))]
		return reg.id, &d
	}
	return reg.id, nil
}

func (s *seeder) loadCatalog() error {
	rows, err := s.pool.Query(s.ctx, `
		SELECT c.id, c.slug, p.slug FROM categories c JOIN categories p ON p.id = c.parent_id
		WHERE c.is_active ORDER BY c.id`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var l demoLeaf
		if err := rows.Scan(&l.id, &l.slug, &l.family); err != nil {
			return err
		}
		if _, ok := roles[l.slug]; ok {
			s.leaves = append(s.leaves, l)
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	rrows, err := s.pool.Query(s.ctx, `SELECT id, parent_id, slug, name_uz FROM regions ORDER BY sort_order, id`)
	if err != nil {
		return err
	}
	byID := map[int32]*demoRegion{}
	var order []int32
	type child struct{ id, parent int32 }
	var children []child
	for rrows.Next() {
		var id int32
		var parent *int32
		var sl, name string
		if err := rrows.Scan(&id, &parent, &sl, &name); err != nil {
			return err
		}
		if parent == nil {
			byID[id] = &demoRegion{id: id, slug: sl, name: name}
			order = append(order, id)
			if sl == "tashkent-city" {
				s.tashkent = id
			}
		} else {
			children = append(children, child{id, *parent})
		}
	}
	if err := rrows.Err(); err != nil {
		return err
	}
	for _, c := range children {
		if r := byID[c.parent]; r != nil {
			r.districts = append(r.districts, c.id)
		}
	}
	for _, id := range order {
		s.regions = append(s.regions, *byID[id])
	}
	if len(s.leaves) == 0 || len(s.regions) == 0 || s.tashkent == 0 {
		return errors.New("catalog is empty: run migrations first")
	}
	return nil
}

func (s *seeder) regionName(id int32) string {
	for _, r := range s.regions {
		if r.id == id {
			return r.name
		}
	}
	return ""
}

func (s *seeder) leafFor(family string) demoLeaf {
	var xs []demoLeaf
	for _, l := range s.leaves {
		if l.family == family {
			xs = append(xs, l)
		}
	}
	if len(xs) == 0 {
		return s.leaf()
	}
	return xs[s.r.IntN(len(xs))]
}

func (s *seeder) categoryID(familySlug string) *int32 {
	var id int32
	if err := s.pool.QueryRow(s.ctx, `SELECT id FROM categories WHERE slug = $1`, familySlug).Scan(&id); err != nil {
		return nil
	}
	return &id
}

func (s *seeder) tx(fn func(pgx.Tx) error) error {
	return pgx.BeginFunc(s.ctx, s.pool, fn)
}

// ---- users ----------------------------------------------------------------------------------

func (s *seeder) insertUser(tx pgx.Tx, email, name, role string, at time.Time, phoneVerified bool, status string) (demoUser, error) {
	u := demoUser{email: email, name: name, role: role, at: at}
	var phone *string
	var phoneAt *time.Time
	if phoneVerified {
		p := s.phone()
		phone, phoneAt = &p, &at
	}
	lastSeen := s.between(at, s.now)
	err := tx.QueryRow(s.ctx, `
		INSERT INTO users (email, email_verified_at, phone, phone_verified_at, password_hash, full_name,
		                   role, status, locale, last_seen_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'uz', $9, $2, $2) RETURNING id`,
		email, at, phone, phoneAt, s.pwHash, name, role, status, lastSeen).Scan(&u.id)
	return u, err
}

func (s *seeder) seedUsers() error {
	return s.tx(func(tx pgx.Tx) error {
		var err error
		if s.seeker, err = s.insertUser(tx, "seeker"+demoDomain, "Jasur Aliyev", "seeker", s.daysAgo(85), true, "active"); err != nil {
			return err
		}
		if s.hr, err = s.insertUser(tx, "hr"+demoDomain, "Madina Rahimova", "employer", s.daysAgo(88), true, "active"); err != nil {
			return err
		}
		if s.admin, err = s.insertUser(tx, "admin"+demoDomain, "Demo Admin", "admin", s.daysAgo(90), true, "active"); err != nil {
			return err
		}
		for i := 1; i <= 45; i++ {
			name, _ := s.person()
			u, err := s.insertUser(tx, fmt.Sprintf("hr%02d%s", i, demoDomain), name, "employer", s.daysAgo(30+s.r.IntN(60)), s.chance(60), "active")
			if err != nil {
				return err
			}
			s.employers = append(s.employers, u)
		}
		// Signups lean to recent weeks so the admin charts show growth.
		for i := 1; i <= 120; i++ {
			name, _ := s.person()
			d := int(90 * (1 - s.r.Float64()*s.r.Float64()))
			status := "active"
			if i%31 == 0 {
				status = "blocked"
			}
			u, err := s.insertUser(tx, fmt.Sprintf("user%03d%s", i, demoDomain), name, "seeker", s.daysAgo(90-d), s.chance(40), status)
			if err != nil {
				return err
			}
			s.seekers = append(s.seekers, u)
		}
		for _, u := range []demoUser{s.seeker, s.hr, s.admin} {
			if _, err := tx.Exec(s.ctx, `INSERT INTO ai_credits (user_id, balance) VALUES ($1, 50)`, u.id); err != nil {
				return err
			}
		}
		return nil
	})
}

// ---- companies and vacancies --------------------------------------------------------------

var companyFamilies = []string{
	"it", "it", "agriculture", "manufacturing", "sales", "logistics", "education", "medicine", "construction", "media",
	"hospitality", "finance", "manufacturing", "sales", "education", "education", "medicine", "hospitality", "manufacturing", "construction",
	"logistics", "agriculture", "services", "manufacturing", "beauty", "it", "it", "it", "construction", "beauty",
	"marketing", "hr", "legal", "security", "services", "agriculture", "office", "medicine", "logistics", "media",
}

var sizes = []string{"1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"}

func (s *seeder) seedCompaniesAndVacancies() error {
	return s.tx(func(tx pgx.Tx) error {
		for i, name := range companyNames {
			owner := s.hr
			if i > 0 {
				owner = s.employers[i-1]
			}
			family := companyFamilies[i]
			c := &demoCompany{name: name, owner: owner, family: family,
				verified: i == 0 || i%3 == 1, blocked: i == 37 || i == 23}
			regionID, _ := s.region()
			founded := 1995 + s.r.IntN(29)
			about := fmt.Sprintf(companyAbout[i%len(companyAbout)], name, strings.ToLower(familyLabel[family]), founded)
			sl := slug.Make(name)
			var verifiedAt *time.Time
			if c.verified {
				t := s.between(owner.at, s.now)
				verifiedAt = &t
			}
			status := "active"
			if c.blocked {
				status = "blocked"
			}
			website := sl + ".uz"
			created := s.between(owner.at, owner.at.Add(48*time.Hour))
			err := tx.QueryRow(s.ctx, `
				INSERT INTO companies (owner_id, name, slug, industry_id, size, website, email, phone, region_id,
				                       address, about, founded_year, verified_at, status, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15) RETURNING id`,
				owner.id, name, sl, s.categoryID(family), sizes[s.r.IntN(len(sizes))], website, "info@"+sl+".uz",
				s.phone(), regionID, s.regionName(regionID)+", "+s.pick([]string{"Amir Temur ko'chasi", "Mustaqillik shoh ko'chasi", "Navoiy ko'chasi", "Bobur ko'chasi", "Mirobod ko'chasi"})+", "+strconv.Itoa(1+s.r.IntN(120)),
				about, founded, verifiedAt, status, created).Scan(&c.id)
			if err != nil {
				return err
			}
			if _, err := tx.Exec(s.ctx, `INSERT INTO company_members (company_id, user_id, role, created_at) VALUES ($1, $2, 'owner', $3)`, c.id, owner.id, created); err != nil {
				return err
			}
			// A few companies have a recruiter on the team.
			if i < 5 && i > 0 {
				rec := s.employers[39+i]
				if _, err := tx.Exec(s.ctx, `INSERT INTO company_members (company_id, user_id, role, created_at) VALUES ($1, $2, 'recruiter', $3)`, c.id, rec.id, created); err != nil {
					return err
				}
			}
			s.companies = append(s.companies, c)
		}

		// Demo company: every status, so each tab of the employer dashboard has content.
		demo := s.companies[0]
		demoStatuses := []string{"published", "published", "published", "published", "published", "published", "published", "published", "published",
			"moderation", "moderation", "draft", "draft", "archived", "rejected"}
		for i, st := range demoStatuses {
			l := s.leafFor([]string{"it", "it", "sales", "marketing", "it", "office", "hr", "it", "finance", "it", "sales", "it", "marketing", "sales", "it"}[i])
			if err := s.insertVacancy(tx, demo, l, st, i < 2); err != nil {
				return err
			}
		}
		// The rest of the market.
		for i := 0; i < 235; i++ {
			c := s.companies[1+s.r.IntN(len(s.companies)-1)]
			l := s.leaf()
			if s.chance(55) {
				l = s.leafFor(c.family)
			}
			st := "published"
			switch {
			case i < 7 && !c.verified:
				st = "moderation"
			case i%41 == 3:
				st = "rejected"
			case i%37 == 5:
				st = "archived"
			case i%43 == 7:
				st = "draft"
			}
			if err := s.insertVacancy(tx, c, l, st, i%30 == 0); err != nil {
				return err
			}
		}
		return nil
	})
}

var familyLabel = map[string]string{
	"it": "Axborot texnologiyalari", "sales": "Savdo", "marketing": "Marketing", "finance": "Moliya", "education": "Ta'lim",
	"medicine": "Tibbiyot", "construction": "Qurilish", "manufacturing": "Ishlab chiqarish", "logistics": "Logistika",
	"hospitality": "Mehmondo'stlik va ovqatlanish", "beauty": "Go'zallik va sport", "office": "Ofis xizmatlari", "hr": "Kadrlar",
	"legal": "Huquq", "security": "Xavfsizlik", "services": "Maishiy xizmatlar", "agriculture": "Qishloq xo'jaligi", "media": "Media",
}

func (s *seeder) description(family string) string {
	ds := duties[family]
	var b strings.Builder
	b.WriteString(s.pick([]string{
		"Jamoamiz kengaymoqda va biz mas'uliyatli mutaxassisni qidiryapmiz.",
		"Rivojlanayotgan kompaniyamizga yangi hamkasb kerak.",
		"Barqaror kompaniyada uzoq muddatli ishlash imkoniyati.",
	}))
	b.WriteString("\n\n**Vazifalar:**\n")
	for _, i := range s.r.Perm(len(ds))[:3] {
		b.WriteString("- " + ds[i] + "\n")
	}
	b.WriteString("\n**Talablar:**\n")
	for _, i := range s.r.Perm(len(requirements))[:3] {
		b.WriteString("- " + requirements[i] + "\n")
	}
	b.WriteString("\n**Shartlar:**\n")
	for _, i := range s.r.Perm(len(conditions))[:4] {
		b.WriteString("- " + conditions[i] + "\n")
	}
	return strings.TrimSpace(b.String())
}

func (s *seeder) insertVacancy(tx pgx.Tx, c *demoCompany, l demoLeaf, status string, featured bool) error {
	ro := roles[l.slug]
	title := s.pick(ro.titles)
	regionID, district := s.region()
	currency := "UZS"
	var smin, smax *int64
	if s.chance(85) {
		lo := int64(ro.pay[0]+s.r.IntN(ro.pay[1]-ro.pay[0]+1)) * 1_000_000
		hi := lo + int64(1+s.r.IntN(6))*1_000_000
		if s.chance(ro.usdShare) {
			currency = "USD"
			lo, hi = lo/12800/50*50+300, hi/12800/50*50+500
		}
		smin, smax = &lo, &hi
		if s.chance(20) {
			smax = nil
		}
	}
	created := s.between(c.owner.at, s.now.Add(-2*time.Hour))
	var submitted, published, expires, moderatedAt *time.Time
	var moderatedBy *uuid.UUID
	var reason *string
	switch status {
	case "published", "archived":
		p := s.between(maxTime(created, s.daysAgo(60)), s.now.Add(-time.Hour))
		e := p.Add(30 * 24 * time.Hour)
		published, expires, submitted = &p, &e, &p
		if e.Before(s.now) && status == "published" {
			status = "expired"
		}
		if !c.verified {
			moderatedBy, moderatedAt = &s.admin.id, &p
		}
	case "moderation":
		t := s.between(maxTime(created, s.daysAgo(3)), s.now)
		submitted = &t
	case "rejected":
		t := s.between(maxTime(created, s.daysAgo(20)), s.now)
		submitted, moderatedAt, moderatedBy = &t, &t, &s.admin.id
		r := s.pick([]string{"Maosh ko'rsatilmagan va tavsif juda qisqa. Iltimos, to'ldirib qayta yuboring.",
			"Vakansiya matnida aloqa uchun telefon raqami bor — buni maxsus maydonda ko'rsating.",
			"Talablarda yosh va jins bo'yicha cheklov mumkin emas."})
		reason = &r
	}
	if created.After(maxTime(derefTime(published), derefTime(submitted))) && (published != nil || submitted != nil) {
		created = minTime(derefTime(published), derefTime(submitted)).Add(-time.Hour)
	}
	views := 0
	if published != nil {
		views = 20 + s.r.IntN(900)
	}
	sl := slug.Make(title)
	if len(sl) > 60 {
		sl = strings.TrimRight(sl[:60], "-")
	}
	sl += "-" + strconv.FormatInt(s.r.Int64N(36*36*36*36*36*36), 36)
	v := &demoVacancy{company: c, title: title, status: status, publishedAt: published, expiresAt: expires}
	err := tx.QueryRow(s.ctx, `
		INSERT INTO vacancies (company_id, created_by, title, slug, description, category_id, region_id, district_id,
		    salary_min, salary_max, currency, employment_type, work_format, experience, schedule, status,
		    reject_reason, moderated_by, moderated_at, is_featured, views_count, submitted_at, published_at, expires_at,
		    created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$25)
		RETURNING id`,
		c.id, c.owner.id, title, sl, s.description(l.family), l.id, regionID, district, smin, smax, currency,
		s.pick([]string{"full_time", "full_time", "full_time", "part_time", "project", "internship"}),
		s.pick([]string{"office", "office", "office", "hybrid", "remote"}),
		s.pick([]string{"none", "1_3", "1_3", "3_6", "6_plus"}),
		s.pick([]string{"full_day", "full_day", "shift", "flexible", "rotation"}),
		status, reason, moderatedBy, moderatedAt, featured && published != nil, views, submitted, published, expires, created,
	).Scan(&v.id)
	if err != nil {
		return err
	}
	names := []string{}
	for _, i := range s.r.Perm(len(ro.skills)) {
		if len(names) == 4 {
			break
		}
		names = append(names, ro.skills[i])
	}
	if len(names) > 0 {
		skills, err := s.cat.ResolveSkills(s.ctx, names, catalog.MaxSkillsPerAd)
		if err != nil {
			return err
		}
		for _, sk := range skills {
			if _, err := tx.Exec(s.ctx, `INSERT INTO vacancy_skills (vacancy_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, v.id, sk.ID); err != nil {
				return err
			}
		}
	}
	s.vacancies = append(s.vacancies, v)
	return nil
}

func derefTime(t *time.Time) time.Time {
	if t == nil {
		return time.Time{}
	}
	return *t
}

func maxTime(a, b time.Time) time.Time {
	if a.After(b) {
		return a
	}
	return b
}

func minTime(a, b time.Time) time.Time {
	if a.IsZero() {
		return b
	}
	if b.IsZero() || a.Before(b) {
		return a
	}
	return b
}

// ---- resumes ------------------------------------------------------------------------------

func (s *seeder) seedResumes() error {
	svc := &resume.Service{Pool: s.pool, Q: gen.New(s.pool), Catalog: s.cat}
	people := append([]demoUser{s.seeker}, s.seekers...)
	for i, u := range people {
		if i > 0 && i%9 == 0 {
			continue // some seekers have no resume yet
		}
		l := s.leaf()
		if i == 0 {
			l = s.leafFor("it")
			for _, x := range s.leaves {
				if x.slug == "it-backend" {
					l = x
				}
			}
		}
		in := s.resumeInput(u, l, i == 0)
		d, err := svc.Create(s.ctx, reqctx.Principal{UserID: u.id, Role: "seeker"}, in)
		if err != nil {
			return fmt.Errorf("%s: %w", u.email, err)
		}
		s.resumes[u.id] = d.ID
		if i == 0 {
			// The main seeker also keeps a second, more general resume.
			in2 := s.resumeInput(u, s.leafFor("it"), false)
			in2.Title = "Loyiha menejeri (IT)"
			if _, err := svc.Create(s.ctx, reqctx.Principal{UserID: u.id, Role: "seeker"}, in2); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *seeder) resumeInput(u demoUser, l demoLeaf, rich bool) resume.Input {
	ro := roles[l.slug]
	regionID, _ := s.region()
	salary := int64(ro.pay[0]+s.r.IntN(ro.pay[1]-ro.pay[0]+1)) * 1_000_000
	in := resume.Input{
		Title:           strings.SplitN(s.pick(ro.titles), " (", 2)[0],
		About:           s.pick([]string{"Mas'uliyatli, natijaga yo'naltirilgan mutaxassisman. Yangi bilimlarni tez o'zlashtiraman va jamoada ishlashni yaxshi ko'raman.", "Sohamda bir necha yillik tajribam bor. Murakkab vazifalarni mustaqil hal qila olaman.", "Rivojlanish imkoniyati bo'lgan barqaror kompaniyada ishlamoqchiman."}),
		CategoryID:      &l.id,
		RegionID:        &regionID,
		Relocate:        s.chance(20),
		DesiredSalary:   &salary,
		EmploymentTypes: []string{"full_time"},
		WorkFormats:     []string{s.pick([]string{"office", "hybrid", "remote"})},
		Visibility:      s.pick([]string{"public", "public", "public", "public", "applied_only"}),
	}
	if rich {
		in.Title = "Go backend dasturchi"
		in.About = "4 yillik tajribaga ega backend dasturchiman. Go va PostgreSQL da yuqori yuklamali servislar quraman, mikroservislar, Docker va CI/CD bilan ishlayman. Toshkentda gibrid formatda ishlashni afzal ko'raman."
		in.WorkFormats = []string{"hybrid", "remote"}
		in.Visibility = "public"
		in.RegionID = &s.tashkent
		sal := int64(22_000_000)
		in.DesiredSalary = &sal
	}
	// Work history, newest first, ending today or some months ago.
	end := s.now.AddDate(0, -s.r.IntN(4), 0)
	jobs := 1 + s.r.IntN(3)
	if rich {
		jobs = 3
	}
	for j := 0; j < jobs; j++ {
		months := 8 + s.r.IntN(30)
		start := end.AddDate(0, -months, 0)
		var endStr *string
		if j > 0 || s.chance(50) {
			e := end.Format("2006-01")
			endStr = &e
		}
		in.Experiences = append(in.Experiences, resume.ExperienceInput{
			Company:     s.pick(companyNames[1:]),
			Position:    strings.SplitN(s.pick(ro.titles), " (", 2)[0],
			Start:       start.Format("2006-01"),
			End:         endStr,
			Description: strings.Join(duties[l.family][:2], ". ") + ".",
		})
		end = start.AddDate(0, -1-s.r.IntN(3), 0)
	}
	sy := int16(end.Year() - 4)
	ey := int16(end.Year())
	in.Educations = []resume.EducationInput{{
		Institution: s.pick(universities), Level: s.pick([]string{"bachelor", "bachelor", "master", "vocational"}),
		Field: familyLabel[l.family], StartYear: &sy, EndYear: &ey,
	}}
	in.Languages = []resume.LanguageInput{{Language: "uz", Level: "native"}, {Language: "ru", Level: s.pick([]string{"b1", "b2", "c1"})}}
	if s.chance(50) || rich {
		in.Languages = append(in.Languages, resume.LanguageInput{Language: "en", Level: s.pick([]string{"a2", "b1", "b2"})})
	}
	for _, i := range s.r.Perm(len(ro.skills)) {
		if len(in.Skills) == 5 {
			break
		}
		in.Skills = append(in.Skills, ro.skills[i])
	}
	if rich {
		in.Skills = []string{"Go", "PostgreSQL", "Redis", "Docker", "Kubernetes", "REST API", "Git", "Linux"}
	}
	return in
}

// ---- applications, chats, notifications, reports -----------------------------------------

var appStatuses = []string{"sent", "viewed", "viewed", "invited", "interview", "hired", "rejected", "rejected", "withdrawn"}

// path is the status history leading to the final status.
func path(final string) []string {
	switch final {
	case "sent":
		return []string{"sent"}
	case "viewed":
		return []string{"sent", "viewed"}
	case "invited":
		return []string{"sent", "viewed", "invited"}
	case "interview":
		return []string{"sent", "viewed", "invited", "interview"}
	case "hired":
		return []string{"sent", "viewed", "invited", "interview", "hired"}
	case "rejected":
		return []string{"sent", "viewed", "rejected"}
	case "withdrawn":
		return []string{"sent", "withdrawn"}
	}
	return []string{"sent"}
}

func (s *seeder) seedActivity() error {
	return s.tx(func(tx pgx.Tx) error {
		open := []*demoVacancy{}
		var demoOpen []*demoVacancy
		for _, v := range s.vacancies {
			if v.publishedAt != nil && !v.company.blocked {
				open = append(open, v)
				if v.company == s.companies[0] {
					demoOpen = append(demoOpen, v)
				}
			}
		}
		used := map[string]bool{}
		apply := func(v *demoVacancy, u demoUser, final string) error {
			key := v.id.String() + u.id.String()
			resumeID, ok := s.resumes[u.id]
			if used[key] || !ok {
				return nil
			}
			used[key] = true
			end := s.now
			if v.expiresAt != nil && v.expiresAt.Before(end) {
				end = *v.expiresAt
			}
			at := s.between(*v.publishedAt, end)
			steps := path(final)
			a := demoApp{vac: v, seeker: u, resume: resumeID, status: final, at: at}
			cover := s.pick(coverLetters)
			note := ""
			if len(steps) > 2 {
				note = s.pick(employerNotes)
			}
			var viewed *time.Time
			if len(steps) > 1 && steps[1] != "withdrawn" {
				t := s.between(at, minTime(s.now, at.Add(72*time.Hour)))
				viewed = &t
			}
			err := tx.QueryRow(s.ctx, `
				INSERT INTO applications (vacancy_id, company_id, seeker_id, resume_id, status, cover_letter, employer_note,
				                          viewed_at, status_changed_at, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $9) RETURNING id`,
				v.id, v.company.id, u.id, resumeID, final, cover, note, viewed, at).Scan(&a.id)
			if err != nil {
				return err
			}
			t := at
			var from *string
			for _, st := range steps {
				actor := v.company.owner.id
				if st == "sent" || st == "withdrawn" {
					actor = u.id
				}
				if st != "sent" {
					t = s.between(t, minTime(s.now, t.Add(96*time.Hour)))
				}
				if _, err := tx.Exec(s.ctx, `INSERT INTO application_events (application_id, actor_id, from_status, to_status, created_at) VALUES ($1, $2, $3, $4, $5)`,
					a.id, actor, from, st, t); err != nil {
					return err
				}
				st := st
				from = &st
			}
			a.changed = t
			if _, err := tx.Exec(s.ctx, `UPDATE applications SET status_changed_at = $2, updated_at = $2 WHERE id = $1`, a.id, t); err != nil {
				return err
			}
			s.apps = append(s.apps, a)
			return nil
		}

		// Main seeker: one application in every status (and a few more).
		for i, st := range []string{"sent", "sent", "viewed", "viewed", "invited", "interview", "interview", "hired", "rejected", "rejected", "withdrawn", "viewed"} {
			v := open[(i*17+3)%len(open)]
			if i < 3 && len(demoOpen) > i {
				v = demoOpen[i]
			}
			if err := apply(v, s.seeker, st); err != nil {
				return err
			}
		}
		// Demo company: a full kanban.
		for i, v := range demoOpen {
			for j := 0; j < 4+s.r.IntN(4); j++ {
				u := s.seekers[(i*13+j*7)%len(s.seekers)]
				if err := apply(v, u, appStatuses[s.r.IntN(len(appStatuses))]); err != nil {
					return err
				}
			}
		}
		// Everyone else.
		for len(s.apps) < 400 {
			v := open[s.r.IntN(len(open))]
			u := s.seekers[s.r.IntN(len(s.seekers))]
			if err := apply(v, u, appStatuses[s.r.IntN(len(appStatuses))]); err != nil {
				return err
			}
		}
		if _, err := tx.Exec(s.ctx, `
			UPDATE vacancies v SET applications_count = x.n
			FROM (SELECT vacancy_id, count(*)::int AS n FROM applications GROUP BY vacancy_id) x
			WHERE v.id = x.vacancy_id AND v.company_id IN (SELECT id FROM companies WHERE owner_id IN (SELECT id FROM users WHERE email ILIKE $1))`, "%"+demoDomain); err != nil {
			return err
		}

		if err := s.seedChats(tx); err != nil {
			return err
		}
		if err := s.seedSaved(tx, open); err != nil {
			return err
		}
		if err := s.seedNotifications(tx); err != nil {
			return err
		}
		return s.seedReports(tx, open)
	})
}

func (s *seeder) seedChats(tx pgx.Tx) error {
	for _, a := range s.apps {
		main := a.seeker.id == s.seeker.id || a.vac.company == s.companies[0]
		if a.status != "invited" && a.status != "interview" && a.status != "hired" && !(main && a.status == "viewed") {
			continue
		}
		var convID uuid.UUID
		if err := tx.QueryRow(s.ctx, `
			INSERT INTO conversations (application_id, company_id, seeker_id, vacancy_id, created_at)
			VALUES ($1, $2, $3, $4, $5) RETURNING id`, a.id, a.vac.company.id, a.seeker.id, a.vac.id, a.changed).Scan(&convID); err != nil {
			return err
		}
		t := a.changed
		var lastID int64
		var lastAt time.Time
		n := 1 + s.r.IntN(len(chatLines))
		if main {
			n = len(chatLines) - 1
		}
		for i := 0; i < n; i++ {
			for k, body := range chatLines[i] {
				sender := a.vac.company.owner.id
				if k == 1 {
					sender = a.seeker.id
				}
				t = s.between(t, minTime(s.now, t.Add(6*time.Hour)))
				if err := tx.QueryRow(s.ctx, `
					INSERT INTO messages (conversation_id, sender_id, kind, body, client_id, created_at)
					VALUES ($1, $2, 'text', $3, $4, $5) RETURNING id`, convID, sender, body, uuid.New(), t).Scan(&lastID); err != nil {
					return err
				}
				lastAt = t
			}
		}
		// In the main accounts' chats the employer has the last word, unread by the seeker.
		seekerRead := lastID
		if main {
			t = s.between(t, minTime(s.now, t.Add(6*time.Hour)))
			if err := tx.QueryRow(s.ctx, `
				INSERT INTO messages (conversation_id, sender_id, kind, body, client_id, created_at)
				VALUES ($1, $2, 'text', $3, $4, $5) RETURNING id`, convID, a.vac.company.owner.id,
				"Yana bir savol: ishni qachondan boshlay olasiz?", uuid.New(), t).Scan(&lastID); err != nil {
				return err
			}
			lastAt = t
		}
		if _, err := tx.Exec(s.ctx, `UPDATE conversations SET last_message_id = $2, last_message_at = $3 WHERE id = $1`, convID, lastID, lastAt); err != nil {
			return err
		}
		if _, err := tx.Exec(s.ctx, `INSERT INTO conversation_reads (conversation_id, user_id, last_read_id) VALUES ($1, $2, $3), ($1, $4, $5)`,
			convID, a.seeker.id, seekerRead, a.vac.company.owner.id, lastID); err != nil {
			return err
		}
	}
	return nil
}

func (s *seeder) seedSaved(tx pgx.Tx, open []*demoVacancy) error {
	for i := 0; i < 6; i++ {
		v := open[(i*29+11)%len(open)]
		if _, err := tx.Exec(s.ctx, `INSERT INTO saved_vacancies (user_id, vacancy_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
			s.seeker.id, v.id, s.between(*v.publishedAt, s.now)); err != nil {
			return err
		}
	}
	for _, u := range s.seekers[:40] {
		v := open[s.r.IntN(len(open))]
		if _, err := tx.Exec(s.ctx, `INSERT INTO saved_vacancies (user_id, vacancy_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
			u.id, v.id, s.between(*v.publishedAt, s.now)); err != nil {
			return err
		}
	}
	searches := []struct{ name, params string }{
		{"Go dasturchi, Toshkent", fmt.Sprintf("q=go+dasturchi&region_id=%d", s.tashkent)},
		{"Masofaviy ish", "work_format=remote"},
	}
	for _, ss := range searches {
		if _, err := tx.Exec(s.ctx, `INSERT INTO saved_searches (user_id, name, params, notify, last_checked_at, created_at) VALUES ($1, $2, $3, true, $4, $5)`,
			s.seeker.id, ss.name, ss.params, s.now.Add(-6*time.Hour), s.daysAgo(20)); err != nil {
			return err
		}
	}
	return nil
}

func (s *seeder) notify(tx pgx.Tx, user uuid.UUID, typ string, p map[string]any, at time.Time, read bool) error {
	raw, err := json.Marshal(p)
	if err != nil {
		return err
	}
	var readAt *time.Time
	if read {
		r := at.Add(time.Hour)
		readAt = &r
	}
	_, err = tx.Exec(s.ctx, `INSERT INTO notifications (user_id, type, payload, read_at, created_at) VALUES ($1, $2, $3, $4, $5)`, user, typ, raw, readAt, at)
	return err
}

func (s *seeder) seedNotifications(tx pgx.Tx) error {
	for i, a := range s.apps {
		v := a.vac
		base := map[string]any{"application_id": a.id.String(), "vacancy_id": v.id.String(), "vacancy_title": v.title, "company_name": v.company.name}
		mainSeeker := a.seeker.id == s.seeker.id
		// Company side: a new application.
		if v.company == s.companies[0] || i%5 == 0 {
			p := map[string]any{"application_id": a.id.String(), "vacancy_id": v.id.String(), "vacancy_title": v.title, "candidate_name": a.seeker.name}
			if err := s.notify(tx, v.company.owner.id, "application.new", p, a.at, v.company != s.companies[0] || s.chance(70)); err != nil {
				return err
			}
		}
		// Seeker side: status changes.
		if a.status != "sent" && a.status != "withdrawn" && (mainSeeker || i%4 == 0) {
			typ := "application.status"
			if a.status == "invited" {
				typ = "application.invited"
			}
			p := base
			p["status"] = a.status
			if err := s.notify(tx, a.seeker.id, typ, p, a.changed, !mainSeeker || s.chance(40)); err != nil {
				return err
			}
		}
	}
	if err := s.notify(tx, s.seeker.id, "search.alert", map[string]any{"search_name": "Go dasturchi, Toshkent", "count": 3}, s.now.Add(-5*time.Hour), false); err != nil {
		return err
	}
	for _, v := range s.vacancies {
		if v.company != s.companies[0] {
			continue
		}
		switch {
		case v.status == "published" && v.publishedAt != nil && s.chance(40):
			if err := s.notify(tx, s.hr.id, "vacancy.approved", map[string]any{"vacancy_id": v.id.String(), "vacancy_title": v.title}, *v.publishedAt, true); err != nil {
				return err
			}
		case v.status == "rejected":
			if err := s.notify(tx, s.hr.id, "vacancy.rejected", map[string]any{"vacancy_id": v.id.String(), "vacancy_title": v.title, "reason": "Maosh ko'rsatilmagan va tavsif juda qisqa."}, s.now.Add(-30*time.Hour), false); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *seeder) seedReports(tx pgx.Tx, open []*demoVacancy) error {
	reasons := []string{"fraud", "misleading", "spam", "offensive", "other", "fraud", "misleading", "spam"}
	n := 0
	for i := 0; n < 15 && i < 200; i++ {
		reporter := s.seekers[(i*7+5)%len(s.seekers)]
		reason := reasons[i%len(reasons)]
		comment := s.pick(reportTexts[reason])
		status, resolvedAt, resolvedBy, note := "open", (*time.Time)(nil), (*uuid.UUID)(nil), (*string)(nil)
		at := s.between(s.daysAgo(10), s.now)
		if n >= 12 {
			status = []string{"resolved", "dismissed", "resolved"}[n-12]
			t := at.Add(5 * time.Hour)
			nt := "Ko'rib chiqildi"
			resolvedAt, resolvedBy, note = &t, &s.admin.id, &nt
		}
		var err error
		if i%3 == 2 {
			c := s.companies[1+(i*5)%(len(s.companies)-1)]
			if c.blocked {
				continue
			}
			_, err = tx.Exec(s.ctx, `INSERT INTO reports (reporter_id, target_type, company_id, reason, comment, status, resolution_note, resolved_by, resolved_at, created_at)
				VALUES ($1, 'company', $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING`, reporter.id, c.id, reason, comment, status, note, resolvedBy, resolvedAt, at)
		} else {
			v := open[(i*23+7)%len(open)]
			if v.company == s.companies[0] {
				continue
			}
			_, err = tx.Exec(s.ctx, `INSERT INTO reports (reporter_id, target_type, vacancy_id, reason, comment, status, resolution_note, resolved_by, resolved_at, created_at)
				VALUES ($1, 'vacancy', $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING`, reporter.id, v.id, reason, comment, status, note, resolvedBy, resolvedAt, at)
		}
		if err != nil {
			return err
		}
		n++
	}
	return nil
}

// ---- search and caches ----------------------------------------------------------------------

func (s *seeder) refresh() error {
	return refreshAfterDemo(s.ctx, s.pool, s.rdb, s.cat)
}

func refreshAfterDemo(ctx context.Context, pool *pgxpool.Pool, rdb *goredis.Client, cat *catalog.Service) error {
	q := gen.New(pool)
	log := slog.Default()
	if cat == nil {
		cat = &catalog.Service{Q: q, Log: log}
		if err := cat.Reload(ctx); err != nil {
			return err
		}
	}
	svc := &vacancy.Service{Pool: pool, Q: q, Catalog: cat, Log: log}
	if rdb != nil {
		svc.Cache = &vacancy.ListCache{RDB: rdb, Log: log}
	}
	if _, err := svc.Reindex(ctx); err != nil {
		return err
	}
	if rdb == nil {
		return nil
	}
	if err := svc.Cache.DropPublicResults(ctx); err != nil {
		return err
	}
	iter := rdb.Scan(ctx, 0, "admin:stats:*", 200).Iterator()
	for iter.Next(ctx) {
		rdb.Unlink(ctx, iter.Val())
	}
	return iter.Err()
}

// ---- purge ----------------------------------------------------------------------------------

// purgeDemo removes every demo user and everything hanging off them: their companies (and
// with them vacancies, applications, chats, reports), resumes, sessions, notifications and
// the demo-only skills. Non-demo rows that merely point at a demo user (a vacancy moderated
// by admin@demo.uz) keep existing with that reference cleared.
func purgeDemo(ctx context.Context, pool *pgxpool.Pool, rdb *goredis.Client) error {
	var users, companies int64
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		pattern := "%" + demoDomain
		if _, err := tx.Exec(ctx, `CREATE TEMP TABLE demo_users ON COMMIT DROP AS SELECT id FROM users WHERE email ILIKE $1`, pattern); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `CREATE TEMP TABLE demo_companies ON COMMIT DROP AS SELECT id FROM companies WHERE owner_id IN (SELECT id FROM demo_users)`); err != nil {
			return err
		}
		var foreign int
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM vacancies WHERE created_by IN (SELECT id FROM demo_users) AND company_id NOT IN (SELECT id FROM demo_companies)`).Scan(&foreign); err != nil {
			return err
		}
		if foreign > 0 {
			return fmt.Errorf("%d vacancies of non-demo companies were created by demo users; reassign them first", foreign)
		}
		stmts := []string{
			`UPDATE vacancies SET moderated_by = NULL WHERE moderated_by IN (SELECT id FROM demo_users) AND company_id NOT IN (SELECT id FROM demo_companies)`,
			// applications.resume_id is ON DELETE RESTRICT: remove applications before resumes go.
			`DELETE FROM applications WHERE seeker_id IN (SELECT id FROM demo_users) OR company_id IN (SELECT id FROM demo_companies)`,
		}
		for _, st := range stmts {
			if _, err := tx.Exec(ctx, st); err != nil {
				return err
			}
		}
		ct, err := tx.Exec(ctx, `DELETE FROM companies WHERE id IN (SELECT id FROM demo_companies)`)
		if err != nil {
			return err
		}
		companies = ct.RowsAffected()
		ct, err = tx.Exec(ctx, `DELETE FROM users WHERE id IN (SELECT id FROM demo_users)`)
		if err != nil {
			return err
		}
		users = ct.RowsAffected()
		slugs := make([]string, len(demoNewSkills))
		for i, n := range demoNewSkills {
			slugs[i] = slug.Make(n)
		}
		_, err = tx.Exec(ctx, `
			DELETE FROM skills s WHERE s.slug = ANY($1) AND NOT s.is_verified
			  AND NOT EXISTS (SELECT 1 FROM vacancy_skills WHERE skill_id = s.id)
			  AND NOT EXISTS (SELECT 1 FROM resume_skills WHERE skill_id = s.id)`, slugs)
		return err
	})
	if err != nil {
		return err
	}
	fmt.Printf("removed %d demo users and %d demo companies (with their vacancies, applications, chats and reports)\n", users, companies)
	return refreshAfterDemo(ctx, pool, rdb, nil)
}
