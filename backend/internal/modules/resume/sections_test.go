package resume

import (
	"context"
	"io"
	"log/slog"
	"strings"
	"testing"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/testutil/pgtest"
)

func strp(s string) *string { return &s }
func i16(v int16) *int16    { return &v }

// TZ BE-12: sections are written with unnest in one batch; NULLs (current job, unknown
// years) survive, order is kept, and saving again replaces every section.
func TestSectionsWrittenWithUnnest(t *testing.T) {
	pgtest.Pool(t)
	pool, counter := pgtest.CountingPool(t)
	ctx := context.Background()
	q := gen.New(pool)
	cat := &catalog.Service{Q: q, Log: slog.New(slog.NewTextHandler(io.Discard, nil))}
	if err := cat.Reload(ctx); err != nil {
		t.Fatal(err)
	}
	svc := &Service{Pool: pool, Q: q, Catalog: cat}
	var uid uuid.UUID
	if err := pool.QueryRow(ctx, `INSERT INTO users (email, full_name, role, email_verified_at)
		VALUES ($1, 'Sections', 'seeker', now()) RETURNING id`, "sec-"+uuid.NewString()[:12]+"@test.local").Scan(&uid); err != nil {
		t.Fatal(err)
	}
	p := reqctx.Principal{UserID: uid, Role: "seeker"}
	in := Input{
		Title: "Backend dasturchi",
		Experiences: []ExperienceInput{
			{Company: "Alpha", Position: "Go dev", Start: "2022-01", Description: "API"}, // current job: end NULL
			{Company: "Beta", Position: "Intern", Start: "2020-06", End: strp("2021-12")},
		},
		Educations: []EducationInput{
			{Institution: "TATU", Level: "bachelor", Field: "CS", StartYear: i16(2016), EndYear: i16(2020)},
			{Institution: "Litsey", Level: "secondary"}, // no years
		},
		Skills:    []string{"Go", "PostgreSQL"},
		Languages: []LanguageInput{{Language: "uz", Level: "native"}, {Language: "en", Level: "b2"}},
	}
	d, err := svc.Create(ctx, p, in)
	if err != nil {
		t.Fatal(err)
	}
	if len(d.Experiences) != 2 || d.Experiences[0].Company != "Alpha" || d.Experiences[0].End != nil ||
		d.Experiences[1].End == nil || *d.Experiences[1].End != "2021-12" {
		t.Fatalf("experiences: %+v", d.Experiences)
	}
	if len(d.Educations) != 2 || d.Educations[0].StartYear == nil || *d.Educations[0].StartYear != 2016 ||
		d.Educations[1].StartYear != nil || d.Educations[1].Level != "secondary" {
		t.Fatalf("educations: %+v", d.Educations)
	}
	if len(d.Skills) != 2 || len(d.Languages) != 2 {
		t.Fatalf("skills %+v languages %+v", d.Skills, d.Languages)
	}

	// Saving again replaces every section: one batch for delete + insert.
	in.Experiences = in.Experiences[1:]
	in.Educations = nil
	in.Skills = []string{"Docker"}
	in.Languages = []LanguageInput{{Language: "ru", Level: "c1"}}
	counter.Reset()
	d, err = svc.Update(ctx, p, d.ID, in)
	if err != nil {
		t.Fatal(err)
	}
	log := counter.String()
	batches := strings.Count(log, "batch[")
	t.Logf("update: %d round trips (%d batch)\n%s", counter.N(), batches, log)
	if batches != 1 || strings.Contains(log, "DELETE FROM resume_skills WHERE resume_id = $1 ") {
		t.Fatalf("sections not written as one batch:\n%s", log)
	}
	if len(d.Experiences) != 1 || d.Experiences[0].Company != "Beta" || len(d.Educations) != 0 ||
		len(d.Skills) != 1 || len(d.Languages) != 1 || d.Languages[0].Language != "ru" {
		t.Fatalf("after update: %+v", d)
	}
}
