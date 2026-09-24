package resume

import (
	"time"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/catalog"
)

const monthLayout = "2006-01"

// Input is a whole resume; saving replaces every section (the builder UI edits all of it).
type Input struct {
	Title           string            `json:"title" validate:"required,min=2,max=150"`
	About           string            `json:"about" validate:"max=5000"`
	CategoryID      *int32            `json:"category_id"`
	RegionID        *int32            `json:"region_id"`
	Relocate        bool              `json:"relocate"`
	DesiredSalary   *int64            `json:"desired_salary" validate:"omitempty,min=0,max=1000000000000"`
	Currency        string            `json:"currency" validate:"omitempty,oneof=UZS USD"`
	EmploymentTypes []string          `json:"employment_types" validate:"max=5,dive,oneof=full_time part_time project internship volunteer"`
	WorkFormats     []string          `json:"work_formats" validate:"max=3,dive,oneof=office remote hybrid"`
	Visibility      string            `json:"visibility" validate:"omitempty,oneof=public applied_only hidden"`
	Experiences     []ExperienceInput `json:"experiences" validate:"max=20,dive"`
	Educations      []EducationInput  `json:"educations" validate:"max=10,dive"`
	Skills          []string          `json:"skills" validate:"max=30,dive,max=50"`
	Languages       []LanguageInput   `json:"languages" validate:"max=10,dive"`
}

type ExperienceInput struct {
	Company     string  `json:"company" validate:"required,max=150"`
	Position    string  `json:"position" validate:"required,max=150"`
	Start       string  `json:"start" validate:"required,datetime=2006-01"` // "2021-03"
	End         *string `json:"end" validate:"omitempty,datetime=2006-01"`  // null = current job
	Description string  `json:"description" validate:"max=3000"`
}

type EducationInput struct {
	Institution string `json:"institution" validate:"required,max=200"`
	Level       string `json:"level" validate:"required,oneof=secondary vocational incomplete_higher bachelor master phd"`
	Field       string `json:"field" validate:"max=150"`
	StartYear   *int16 `json:"start_year" validate:"omitempty,min=1950,max=2100"`
	EndYear     *int16 `json:"end_year" validate:"omitempty,min=1950,max=2100"`
}

type LanguageInput struct {
	Language string `json:"language" validate:"required,min=2,max=3,lowercase,alpha"` // ISO 639
	Level    string `json:"level" validate:"required,oneof=a1 a2 b1 b2 c1 c2 native"`
}

// ---- output --------------------------------------------------------------------------

type Salary struct {
	Amount   int64  `json:"amount"`
	Currency string `json:"currency"`
}

type Person struct {
	ID         uuid.UUID         `json:"id"`
	FullName   string            `json:"full_name"`
	AvatarURL  *string           `json:"avatar_url"`
	AvatarURLs map[string]string `json:"avatar_urls"`
}

// Contacts are shown only to the owner, admins, and companies the seeker applied to.
type Contacts struct {
	Email *string `json:"email"`
	Phone *string `json:"phone"`
}

type Experience struct {
	Company     string  `json:"company"`
	Position    string  `json:"position"`
	Start       string  `json:"start"`
	End         *string `json:"end"`
	Description string  `json:"description"`
}

type Education struct {
	Institution string `json:"institution"`
	Level       string `json:"level"`
	Field       string `json:"field"`
	StartYear   *int16 `json:"start_year"`
	EndYear     *int16 `json:"end_year"`
}

type Language struct {
	Language string `json:"language"`
	Level    string `json:"level"`
}

type LastJob struct {
	Position string `json:"position"`
	Company  string `json:"company"`
	Current  bool   `json:"current"`
}

// Card is the candidate search result / "my resumes" item.
type Card struct {
	ID               uuid.UUID       `json:"id"`
	Title            string          `json:"title"`
	Person           Person          `json:"person"`
	CategoryID       *int32          `json:"category_id"`
	RegionID         *int32          `json:"region_id"`
	Relocate         bool            `json:"relocate"`
	ExperienceMonths int32           `json:"experience_months"`
	DesiredSalary    *Salary         `json:"desired_salary"`
	LastJob          *LastJob        `json:"last_job"`
	Skills           []catalog.Skill `json:"skills"`
	Visibility       string          `json:"visibility,omitempty"` // owner only
	UpdatedAt        time.Time       `json:"updated_at"`
}

type Detail struct {
	Card
	About           string       `json:"about"`
	EmploymentTypes []string     `json:"employment_types"`
	WorkFormats     []string     `json:"work_formats"`
	Experiences     []Experience `json:"experiences"`
	Educations      []Education  `json:"educations"`
	Languages       []Language   `json:"languages"`
	Contacts        *Contacts    `json:"contacts"`
	IsOwner         bool         `json:"is_owner"`
	CreatedAt       time.Time    `json:"created_at"`
}

// sections groups the child rows of a set of resumes.
type sections struct {
	experiences map[uuid.UUID][]gen.ResumeExperience
	educations  map[uuid.UUID][]gen.ResumeEducation
	skills      map[uuid.UUID][]catalog.Skill
	languages   map[uuid.UUID][]gen.ResumeLanguage
}

func salaryOf(amount *int64, cur gen.Currency) *Salary {
	if amount == nil {
		return nil
	}
	return &Salary{Amount: *amount, Currency: string(cur)}
}

func month(t time.Time) string { return t.Format(monthLayout) }

func lastJobOf(exps []gen.ResumeExperience) *LastJob {
	if len(exps) == 0 {
		return nil
	}
	e := exps[0] // the builder keeps the most recent job first
	return &LastJob{Position: e.Position, Company: e.Company, Current: e.EndDate == nil}
}

func cardOf(r gen.Resume, p Person, sec sections, owner bool) Card {
	skills := sec.skills[r.ID]
	if skills == nil {
		skills = []catalog.Skill{}
	}
	c := Card{
		ID: r.ID, Title: r.Title, Person: p, CategoryID: r.CategoryID, RegionID: r.RegionID,
		Relocate: r.Relocate, ExperienceMonths: r.ExperienceMonths,
		DesiredSalary: salaryOf(r.DesiredSalary, r.Currency),
		LastJob:       lastJobOf(sec.experiences[r.ID]), Skills: skills, UpdatedAt: r.UpdatedAt,
	}
	if owner {
		c.Visibility = string(r.Visibility)
	}
	return c
}

func detailOf(r gen.Resume, p Person, sec sections, contacts *Contacts, owner bool) Detail {
	d := Detail{
		Card: cardOf(r, p, sec, owner), About: r.About,
		EmploymentTypes: r.EmploymentTypes, WorkFormats: r.WorkFormats,
		Experiences: []Experience{}, Educations: []Education{}, Languages: []Language{},
		Contacts: contacts, IsOwner: owner, CreatedAt: r.CreatedAt,
	}
	for _, e := range sec.experiences[r.ID] {
		x := Experience{Company: e.Company, Position: e.Position, Start: month(e.StartDate), Description: e.Description}
		if e.EndDate != nil {
			end := month(*e.EndDate)
			x.End = &end
		}
		d.Experiences = append(d.Experiences, x)
	}
	for _, e := range sec.educations[r.ID] {
		d.Educations = append(d.Educations, Education{Institution: e.Institution, Level: string(e.Level),
			Field: e.Field, StartYear: e.StartYear, EndYear: e.EndYear})
	}
	for _, l := range sec.languages[r.ID] {
		d.Languages = append(d.Languages, Language{Language: l.Language, Level: string(l.Level)})
	}
	return d
}
