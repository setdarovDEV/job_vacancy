package application

import (
	"time"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/resume"
	"jobvacancy.uz/backend/internal/modules/vacancy"
)

type Summary struct {
	ID              uuid.UUID  `json:"id"`
	VacancyID       uuid.UUID  `json:"vacancy_id"`
	ResumeID        uuid.UUID  `json:"resume_id"`
	Status          string     `json:"status"`
	Source          string     `json:"source"`
	CoverLetter     string     `json:"cover_letter"`
	ViewedAt        *time.Time `json:"viewed_at"`
	StatusChangedAt time.Time  `json:"status_changed_at"`
	CreatedAt       time.Time  `json:"created_at"`
}

// Candidate is the employer's view of who applied.
type Candidate struct {
	UserID           uuid.UUID      `json:"user_id"`
	FullName         string         `json:"full_name"`
	AvatarURL        *string        `json:"avatar_url"`
	ResumeTitle      string         `json:"resume_title"`
	ExperienceMonths int32          `json:"experience_months"`
	DesiredSalary    *resume.Salary `json:"desired_salary"`
	RegionID         *int32         `json:"region_id"`
}

type SeekerItem struct {
	Summary
	Vacancy vacancy.Card `json:"vacancy"`
}

type EmployerItem struct {
	Summary
	Candidate    Candidate `json:"candidate"`
	EmployerNote string    `json:"employer_note"`
}

type Event struct {
	From *string   `json:"from"`
	To   string    `json:"to"`
	Note string    `json:"note,omitempty"`
	At   time.Time `json:"at"`
}

type Detail struct {
	Summary
	Vacancy      *vacancy.Card `json:"vacancy"`
	Candidate    *Candidate    `json:"candidate,omitempty"`     // employer only
	EmployerNote *string       `json:"employer_note,omitempty"` // employer only
	Events       []Event       `json:"events"`
}

func summaryOf(a gen.Application) Summary {
	return Summary{
		ID: a.ID, VacancyID: a.VacancyID, ResumeID: a.ResumeID, Status: string(a.Status),
		Source: string(a.Source), CoverLetter: a.CoverLetter, ViewedAt: a.ViewedAt,
		StatusChangedAt: a.StatusChangedAt, CreatedAt: a.CreatedAt,
	}
}

func candidateOf(a gen.Application, name string, avatar *string, title string, months int32,
	salary *int64, cur gen.Currency, region *int32) Candidate {
	c := Candidate{UserID: a.SeekerID, FullName: name, AvatarURL: avatar, ResumeTitle: title,
		ExperienceMonths: months, RegionID: region}
	if salary != nil {
		c.DesiredSalary = &resume.Salary{Amount: *salary, Currency: string(cur)}
	}
	return c
}
