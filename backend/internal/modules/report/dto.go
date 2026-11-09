package report

import (
	"time"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
)

// DTO is a report as its author sees it right after filing it.
type DTO struct {
	ID         uuid.UUID `json:"id"`
	TargetType string    `json:"target_type"`
	TargetID   uuid.UUID `json:"target_id"`
	Reason     string    `json:"reason"`
	Comment    *string   `json:"comment"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
}

func toDTO(r gen.Report) DTO {
	return DTO{ID: r.ID, TargetType: string(r.TargetType), TargetID: r.TargetID, Reason: string(r.Reason),
		Comment: r.Comment, Status: string(r.Status), CreatedAt: r.CreatedAt}
}

// ReasonCounts has one counter per reason, always all of them.
type ReasonCounts struct {
	Fraud      int32 `json:"fraud"`
	Misleading int32 `json:"misleading"`
	Offensive  int32 `json:"offensive"`
	Spam       int32 `json:"spam"`
	Other      int32 `json:"other"`
}

// Public says whether anyone can see the target right now, computed by the server's own
// visibility rules (CA-010) so clients don't re-derive them.
type reportedVacancyDTO struct {
	ID      uuid.UUID          `json:"id"`
	Title   string             `json:"title"`
	Slug    string             `json:"slug"`
	Status  string             `json:"status"`
	Public  bool               `json:"public"`
	Company reportedCompanyRef `json:"company"`
}

type reportedCompanyRef struct {
	ID     uuid.UUID `json:"id"`
	Name   string    `json:"name"`
	Slug   string    `json:"slug"`
	Status string    `json:"status"`
}

type reportedCompanyDTO struct {
	ID       uuid.UUID `json:"id"`
	Name     string    `json:"name"`
	Slug     string    `json:"slug"`
	LogoURL  *string   `json:"logo_url"`
	Status   string    `json:"status"`
	Public   bool      `json:"public"`
	Verified bool      `json:"verified"`
}

type latestReportDTO struct {
	ID           uuid.UUID `json:"id"`
	Reason       string    `json:"reason"`
	Comment      *string   `json:"comment"`
	ReporterName string    `json:"reporter_name"`
	CreatedAt    time.Time `json:"created_at"`
}

// TargetReportsDTO is one row of the admin queue. Exactly one of vacancy / company is set,
// matching target_type; counts and latest cover the reports in `status`.
// status_report_count and the reasons count the reports in `status`;
// total_report_count counts every report ever filed on the target (API-023).
type TargetReportsDTO struct {
	TargetType        string              `json:"target_type"`
	TargetID          uuid.UUID           `json:"target_id"`
	Status            string              `json:"status"`
	Vacancy           *reportedVacancyDTO `json:"vacancy"`
	Company           *reportedCompanyDTO `json:"company"`
	StatusReportCount int32               `json:"status_report_count"`
	TotalReportCount  int32               `json:"total_report_count"`
	Reasons           ReasonCounts        `json:"reasons"`
	Latest            []latestReportDTO   `json:"latest"`
	FirstReportedAt   time.Time           `json:"first_reported_at"`
	LastReportedAt    time.Time           `json:"last_reported_at"`
	LastActivityAt    time.Time           `json:"last_activity_at"`
}

func targetDTO(t TargetReports) TargetReportsDTO {
	s := t.Summary
	d := TargetReportsDTO{
		TargetType: string(s.TargetType), TargetID: s.TargetID, Status: string(t.Status),
		StatusReportCount: s.StatusReportCount, TotalReportCount: s.TotalReportCount,
		Reasons:         ReasonCounts{Fraud: s.FraudCount, Misleading: s.MisleadingCount, Offensive: s.OffensiveCount, Spam: s.SpamCount, Other: s.OtherCount},
		Latest:          make([]latestReportDTO, len(t.Latest)),
		FirstReportedAt: s.FirstReportedAt, LastReportedAt: s.LastReportedAt, LastActivityAt: s.LastActivityAt,
	}
	for i, l := range t.Latest {
		d.Latest[i] = latestReportDTO{ID: l.ID, Reason: string(l.Reason), Comment: l.Comment, ReporterName: l.ReporterName, CreatedAt: l.CreatedAt}
	}
	if v := t.Vacancy; v != nil {
		d.Vacancy = &reportedVacancyDTO{ID: v.ID, Title: v.Title, Slug: v.Slug, Status: string(v.Status), Public: v.IsPublic,
			Company: reportedCompanyRef{ID: v.CompanyID, Name: v.CompanyName, Slug: v.CompanySlug, Status: string(v.CompanyStatus)}}
	}
	if c := t.Company; c != nil {
		d.Company = &reportedCompanyDTO{ID: c.ID, Name: c.Name, Slug: c.Slug, LogoURL: c.LogoUrl, Status: string(c.Status), Public: c.IsPublic, Verified: c.Verified}
	}
	return d
}
