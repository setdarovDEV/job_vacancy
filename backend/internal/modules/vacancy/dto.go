package vacancy

import (
	"time"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/modules/company"
)

// Input is the editable part of a vacancy (create and full update).
type Input struct {
	Title          string   `json:"title" validate:"required,min=3,max=150"`
	Description    string   `json:"description" validate:"required,min=30,max=10000"`
	CategoryID     int32    `json:"category_id" validate:"required"`
	RegionID       int32    `json:"region_id" validate:"required"`
	DistrictID     *int32   `json:"district_id"`
	Address        *string  `json:"address" validate:"omitempty,max=300"`
	SalaryMin      *int64   `json:"salary_min" validate:"omitempty,min=0,max=1000000000000"`
	SalaryMax      *int64   `json:"salary_max" validate:"omitempty,min=0,max=1000000000000"`
	Currency       string   `json:"currency" validate:"omitempty,oneof=UZS USD"`
	EmploymentType string   `json:"employment_type" validate:"required,oneof=full_time part_time project internship volunteer"`
	WorkFormat     string   `json:"work_format" validate:"required,oneof=office remote hybrid"`
	Experience     string   `json:"experience" validate:"required,oneof=none 1_3 3_6 6_plus"`
	Schedule       string   `json:"schedule" validate:"required,oneof=full_day shift flexible rotation"`
	Skills         []string `json:"skills" validate:"max=20,dive,max=50"`
}

type Salary struct {
	Min      *int64 `json:"min"`
	Max      *int64 `json:"max"`
	Currency string `json:"currency"`
}

// Card is the list item shape (no description) used by search results and dashboards.
type Card struct {
	ID                uuid.UUID       `json:"id"`
	Slug              string          `json:"slug"`
	Title             string          `json:"title"`
	Company           company.Summary `json:"company"`
	CategoryID        int32           `json:"category_id"`
	RegionID          int32           `json:"region_id"`
	DistrictID        *int32          `json:"district_id"`
	Salary            *Salary         `json:"salary"`
	EmploymentType    string          `json:"employment_type"`
	WorkFormat        string          `json:"work_format"`
	Experience        string          `json:"experience"`
	Schedule          string          `json:"schedule"`
	Skills            []catalog.Skill `json:"skills"`
	IsFeatured        bool            `json:"is_featured"`
	Status            string          `json:"status"`
	ViewsCount        int32           `json:"views_count"`
	ApplicationsCount int32           `json:"applications_count"`
	PublishedAt       *time.Time      `json:"published_at"`
	ExpiresAt         *time.Time      `json:"expires_at"`
	CreatedAt         time.Time       `json:"created_at"`
}

// Detail is the full vacancy page.
type Detail struct {
	Card
	Description string    `json:"description"`
	Address     *string   `json:"address"`
	UpdatedAt   time.Time `json:"updated_at"`
	// Only for company members and admins.
	RejectReason *string    `json:"reject_reason,omitempty"`
	SubmittedAt  *time.Time `json:"submitted_at,omitempty"`
	CanEdit      bool       `json:"can_edit"`
	// FeaturedUntil ends the "TOP" placement (members and admins only).
	FeaturedUntil *time.Time `json:"featured_until,omitempty"`
	// Republish tells members what POST /vacancies/{id}/republish would do for an expired
	// or archived vacancy (TZ FN-04): "direct" (goes live at once) or "moderation".
	Republish string `json:"republish,omitempty"`
}

func salaryOf(min, max *int64, cur gen.Currency) *Salary {
	if min == nil && max == nil {
		return nil
	}
	return &Salary{Min: min, Max: max, Currency: string(cur)}
}

func summaryOf(c gen.Company) company.Summary {
	return company.Summary{ID: c.ID, Name: c.Name, Slug: c.Slug, LogoURL: c.LogoUrl, Verified: c.VerifiedAt != nil}
}

func cardOf(v gen.Vacancy, c company.Summary, skills []catalog.Skill) Card {
	if skills == nil {
		skills = []catalog.Skill{}
	}
	return Card{
		ID: v.ID, Slug: v.Slug, Title: v.Title, Company: c,
		CategoryID: v.CategoryID, RegionID: v.RegionID, DistrictID: v.DistrictID,
		Salary:         salaryOf(v.SalaryMin, v.SalaryMax, v.Currency),
		EmploymentType: string(v.EmploymentType), WorkFormat: string(v.WorkFormat),
		Experience: string(v.Experience), Schedule: string(v.Schedule),
		Skills: skills, IsFeatured: v.IsFeatured, Status: string(v.Status),
		ViewsCount: v.ViewsCount, ApplicationsCount: v.ApplicationsCount,
		PublishedAt: v.PublishedAt, ExpiresAt: v.ExpiresAt, CreatedAt: v.CreatedAt,
	}
}

func detailOf(v gen.Vacancy, c gen.Company, skills []catalog.Skill, member bool) Detail {
	d := Detail{
		Card:        cardOf(v, summaryOf(c), skills),
		Description: v.Description, Address: v.Address, UpdatedAt: v.UpdatedAt, CanEdit: member,
	}
	if member {
		d.RejectReason = v.RejectReason
		d.SubmittedAt = v.SubmittedAt
		d.FeaturedUntil = v.FeaturedUntil
		d.Republish = republishMode(v, c)
	}
	return d
}

// republishMode mirrors RepublishVacancy's condition (and Submit's rule that verified
// companies publish without moderation).
func republishMode(v gen.Vacancy, c gen.Company) string {
	if v.Status != gen.VacancyStatusExpired && v.Status != gen.VacancyStatusArchived {
		return ""
	}
	if c.VerifiedAt != nil {
		return "direct"
	}
	notAfter := func(t *time.Time) bool { return t == nil || !t.After(*v.PublishedAt) }
	if v.PublishedAt != nil && notAfter(v.ContentUpdatedAt) && notAfter(v.SubmittedAt) && notAfter(v.ModeratedAt) {
		return "direct"
	}
	return "moderation"
}
