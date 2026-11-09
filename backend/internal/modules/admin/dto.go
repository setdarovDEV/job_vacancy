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
		Published         int32 `json:"published"`
		PendingModeration int32 `json:"pending_moderation"`
	} `json:"vacancies"`
	Applications struct {
		SentLast7d int32 `json:"sent_last_7d"`
	} `json:"applications"`
	Reports struct {
		// Vacancies and companies with at least one open report (the admin queue's length).
		OpenTargets int32 `json:"open_targets"`
	} `json:"reports"`
}

func statsDTO(r gen.AdminStatsRow) StatsDTO {
	var d StatsDTO
	d.Users.Total, d.Users.SignedUpLast7d, d.Users.Blocked = r.UsersTotal, r.UsersSignedUpLast7d, r.UsersBlocked
	d.Companies.Total, d.Companies.ActiveUnverified, d.Companies.Blocked = r.CompaniesTotal, r.CompaniesActiveUnverified, r.CompaniesBlocked
	d.Vacancies.Published, d.Vacancies.PendingModeration = r.VacanciesPublished, r.VacanciesPendingModeration
	d.Applications.SentLast7d = r.ApplicationsSentLast7d
	d.Reports.OpenTargets = r.ReportsOpenTargets
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

func mapSlice[T, R any](in []T, f func(T) R) []R {
	out := make([]R, len(in))
	for i, v := range in {
		out[i] = f(v)
	}
	return out
}
