package admin

import (
	"time"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/company"
	"jobvacancy.uz/backend/internal/modules/user"
)

// StatsDTO is the admin overview: what needs attention, and how big the platform is.
// Deleted accounts are excluded from every user counter.
type StatsDTO struct {
	Users struct {
		Total          int32 `json:"total"`
		SignedUpLast7d int32 `json:"signed_up_last_7d"`
		Blocked        int32 `json:"blocked"`
	} `json:"users"`
	Companies struct {
		Total            int32 `json:"total"`
		ActiveUnverified int32 `json:"active_unverified"`
		Blocked          int32 `json:"blocked"`
	} `json:"companies"`
	Vacancies struct {
		Live              int32 `json:"live"` // published right now
		PendingModeration int32 `json:"pending_moderation"`
	} `json:"vacancies"`
	Applications struct {
		SentLast7d int32 `json:"sent_last_7d"`
	} `json:"applications"`
	Reports struct {
		// Vacancies and companies with at least one open report (the admin queue's length).
		OpenTargets int32 `json:"open_targets"`
	} `json:"reports"`
	Skills struct {
		// User-added skills nobody has reviewed yet (not offered in autocomplete).
		Unverified int32 `json:"unverified"`
	} `json:"skills"`
	Feedback struct {
		// Messages from "Fikr bildirish" nobody has marked handled.
		Unhandled int32 `json:"unhandled"`
	} `json:"feedback"`
}

func statsDTO(r gen.AdminStatsRow) StatsDTO {
	var d StatsDTO
	d.Users.Total, d.Users.SignedUpLast7d, d.Users.Blocked = r.UsersTotal, r.UsersSignedUpLast7d, r.UsersBlocked
	d.Companies.Total, d.Companies.ActiveUnverified, d.Companies.Blocked = r.CompaniesTotal, r.CompaniesActiveUnverified, r.CompaniesBlocked
	d.Vacancies.Live, d.Vacancies.PendingModeration = r.VacanciesLive, r.VacanciesPendingModeration
	d.Applications.SentLast7d = r.ApplicationsSentLast7d
	d.Reports.OpenTargets = r.ReportsOpenTargets
	d.Skills.Unverified = r.SkillsUnverified
	d.Feedback.Unhandled = r.FeedbackUnhandled
	return d
}

// CompanyDTO is a company as admins see it: the public profile plus moderation state,
// owner and open vacancies. Lists and mutation responses return the same, complete shape.
type CompanyDTO struct {
	company.DTO
	Status     string  `json:"status"`
	OwnerName  string  `json:"owner_name"`
	OwnerEmail *string `json:"owner_email"`
}

func companyDTO(r AdminCompany) CompanyDTO {
	d := CompanyDTO{DTO: company.ToDTO(r.Company), Status: string(r.Company.Status), OwnerName: r.OwnerName, OwnerEmail: r.OwnerEmail}
	n := int64(r.OpenVacancies)
	d.OpenVacancies = &n
	return d
}

// UserDTO is an account as admins see it.
type UserDTO struct {
	user.DTO
	Status     string     `json:"status"`
	LastSeenAt *time.Time `json:"last_seen_at"`
}

func userDTO(u gen.User) UserDTO {
	return UserDTO{DTO: user.ToDTO(u), Status: string(u.Status), LastSeenAt: u.LastSeenAt}
}

// SkillDTO is a skill as admins see it. Lists and mutation responses have the same shape.
type SkillDTO struct {
	ID       int32  `json:"id"`
	Name     string `json:"name"`
	Slug     string `json:"slug"`
	Verified bool   `json:"verified"`
	// Autocomplete ranking: grows each time a vacancy listing the skill is published and
	// never shrinks. Not the same as how many items list it now (in_use).
	Popularity   int32 `json:"popularity"`
	VacancyCount int32 `json:"vacancy_count"`
	ResumeCount  int32 `json:"resume_count"`
	InUse        int32 `json:"in_use"` // vacancy_count + resume_count
	// Slugs of names merged or renamed into this skill; typing them resolves here.
	Aliases   []string  `json:"aliases"`
	CreatedAt time.Time `json:"created_at"`
}

func skillDTO(r Skill) SkillDTO {
	aliases := r.Aliases
	if aliases == nil {
		aliases = []string{}
	}
	return SkillDTO{ID: r.ID, Name: r.Name, Slug: r.Slug, Verified: r.IsVerified, Popularity: r.Popularity,
		VacancyCount: r.VacancyCount, ResumeCount: r.ResumeCount, InUse: r.InUse,
		Aliases: aliases, CreatedAt: r.CreatedAt}
}

func mapSlice[T, R any](in []T, f func(T) R) []R {
	out := make([]R, len(in))
	for i, v := range in {
		out[i] = f(v)
	}
	return out
}
