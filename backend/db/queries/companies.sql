-- name: CreateCompany :one
INSERT INTO companies (owner_id, name, slug, industry_id, size, website, email, phone,
                       region_id, address, about, founded_year)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING *;

-- name: UpdateCompany :one
UPDATE companies
SET name = $2, industry_id = $3, size = $4, website = $5, email = $6, phone = $7,
    region_id = $8, address = $9, about = $10, founded_year = $11
WHERE id = $1
RETURNING *;

-- name: SetCompanyLogo :one
UPDATE companies SET logo_url = $2 WHERE id = $1 RETURNING *;

-- name: GetCompanyByID :one
SELECT * FROM companies WHERE id = $1;

-- name: GetCompanyBySlug :one
SELECT * FROM companies WHERE slug = $1;

-- name: CompanySlugExists :one
SELECT EXISTS (SELECT 1 FROM companies WHERE slug = $1);

-- name: SetCompanyVerified :one
UPDATE companies
SET verified_at = CASE WHEN sqlc.arg(verified)::boolean THEN COALESCE(verified_at, now()) END
WHERE id = $1
RETURNING *;

-- name: AddCompanyMember :exec
INSERT INTO company_members (company_id, user_id, role) VALUES ($1, $2, $3)
ON CONFLICT (company_id, user_id) DO UPDATE SET role = EXCLUDED.role;

-- name: GetMemberRole :one
SELECT role FROM company_members WHERE company_id = $1 AND user_id = $2;

-- name: RemoveCompanyMember :execrows
DELETE FROM company_members WHERE company_id = $1 AND user_id = $2 AND role <> 'owner';

-- name: ListCompanyMembers :many
SELECT u.id, u.full_name, u.email, u.avatar_url, m.role, m.created_at
FROM company_members m JOIN users u ON u.id = m.user_id
WHERE m.company_id = $1
ORDER BY m.created_at;

-- name: ListUserCompanies :many
SELECT sqlc.embed(c), m.role
FROM company_members m JOIN companies c ON c.id = m.company_id
WHERE m.user_id = $1
ORDER BY m.created_at;

-- name: CountPublishedVacancies :one
SELECT count(*) FROM vacancies WHERE company_id = $1 AND status = 'published';

-- name: SetCompanyLogoURL :one
UPDATE companies SET logo_url = $2 WHERE id = $1 RETURNING *;

-- Public directory: verified first, then by open vacancies. Offset paging is fine here:
-- the directory is small and sorted by a computed count.
-- name: ListCompaniesDirectory :many
SELECT sqlc.embed(c),
       (SELECT count(*) FROM vacancies v WHERE v.company_id = c.id AND v.status = 'published')::int AS open_vacancies
FROM companies c
WHERE c.status = 'active'
  AND (sqlc.narg(q)::text IS NULL OR lower(c.name) LIKE '%' || lower(sqlc.narg(q)::text) || '%')
ORDER BY (c.verified_at IS NOT NULL) DESC, open_vacancies DESC, c.name, c.id
LIMIT sqlc.arg(max_results) OFFSET sqlc.arg(skip);
