package admin

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/company"
)

// UserDTO is a user as the admin panel shows it.
type UserDTO struct {
	ID            uuid.UUID  `json:"id"`
	Email         *string    `json:"email"`
	Phone         *string    `json:"phone"`
	FullName      string     `json:"full_name"`
	AvatarURL     *string    `json:"avatar_url"`
	Role          string     `json:"role"`
	Status        string     `json:"status"`
	EmailVerified bool       `json:"email_verified"`
	PhoneVerified bool       `json:"phone_verified"`
	LastSeenAt    *time.Time `json:"last_seen_at"`
	CreatedAt     time.Time  `json:"created_at"`
	DeletedAt     *time.Time `json:"deleted_at"`
}

func userOf(u gen.User) UserDTO {
	return UserDTO{ID: u.ID, Email: u.Email, Phone: u.Phone, FullName: u.FullName, AvatarURL: u.AvatarUrl,
		Role: string(u.Role), Status: string(u.Status), EmailVerified: u.EmailVerifiedAt != nil,
		PhoneVerified: u.PhoneVerifiedAt != nil, LastSeenAt: u.LastSeenAt, CreatedAt: u.CreatedAt, DeletedAt: u.DeletedAt}
}

// UserDetail adds the user's company memberships.
type UserDetail struct {
	UserDTO
	Companies []Membership `json:"companies"`
}

type Membership struct {
	ID     uuid.UUID `json:"id"`
	Name   string    `json:"name"`
	Slug   string    `json:"slug"`
	Status string    `json:"status"`
	Role   string    `json:"role"`
}

// CompanyDTO is a company as the admin panel shows it (any status).
type CompanyDTO struct {
	company.DTO
	Status        string    `json:"status"`
	OwnerID       uuid.UUID `json:"owner_id"`
	OwnerName     string    `json:"owner_name"`
	OwnerEmail    *string   `json:"owner_email"`
	OpenVacancies int64     `json:"open_vacancies"`
}

func companyOf(c gen.Company, ownerName string, ownerEmail *string) CompanyDTO {
	return CompanyDTO{DTO: company.ToDTO(c), Status: string(c.Status), OwnerID: c.OwnerID,
		OwnerName: ownerName, OwnerEmail: ownerEmail, OpenVacancies: int64(c.OpenVacancies)}
}

// SkillDTO is a skill with how often it is used.
type SkillDTO struct {
	ID         int32     `json:"id"`
	Name       string    `json:"name"`
	Slug       string    `json:"slug"`
	IsVerified bool      `json:"is_verified"`
	UsageCount int32     `json:"usage_count"`
	Vacancies  int64     `json:"vacancies"`
	Resumes    int64     `json:"resumes"`
	CreatedAt  time.Time `json:"created_at"`
}

// AuditEntry is one row of the audit log.
type AuditEntry struct {
	ID         uuid.UUID       `json:"id"`
	Action     string          `json:"action"`
	ObjectType string          `json:"object_type"`
	ObjectID   string          `json:"object_id"`
	Details    json.RawMessage `json:"details"`
	IP         *string         `json:"ip"`
	CreatedAt  time.Time       `json:"created_at"`
	Admin      *AuditAdmin     `json:"admin"`
}

type AuditAdmin struct {
	ID       uuid.UUID `json:"id"`
	FullName string    `json:"full_name"`
	Email    *string   `json:"email"`
}

// Stats is the dashboard: current totals and a daily series.
type Stats struct {
	Totals Totals     `json:"totals"`
	Days   []DayStats `json:"days"`
}

type Totals struct {
	Users              int64 `json:"users"`
	Seekers            int64 `json:"seekers"`
	Employers          int64 `json:"employers"`
	BlockedUsers       int64 `json:"blocked_users"`
	Companies          int64 `json:"companies"`
	PublishedVacancies int64 `json:"published_vacancies"`
	ModerationQueue    int64 `json:"moderation_queue"`
	OpenReports        int64 `json:"open_reports"`
}

type DayStats struct {
	Date          string `json:"date"` // YYYY-MM-DD, Asia/Tashkent
	Registrations int64  `json:"registrations"`
	Vacancies     int64  `json:"vacancies"`
	Applications  int64  `json:"applications"`
}
