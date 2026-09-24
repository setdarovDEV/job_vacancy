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

-- name: SetCompanyLogoURL :one
UPDATE companies SET logo_url = $2 WHERE id = $1 RETURNING *;

-- Company directory page (TZ BE-03): verified first, then by open vacancies, name, id,
-- which is the order of companies_directory_idx. Pages are keyset: the query seeks past the
-- key of the previous page's last row. The first page passes a key below every row
-- (unverified=false, neg_open=-2147483648), so the plan is always one index range scan and
-- a cached generic plan can't degrade into walking the index from the start.
-- q is lower-cased with LIKE wildcards escaped by the caller.
-- name: ListCompaniesDirectory :many
SELECT sqlc.embed(c)
FROM companies c
WHERE c.status = 'active'
  AND ((c.verified_at IS NULL), -c.open_vacancies, c.name, c.id)
      > (sqlc.arg(after_unverified)::boolean, sqlc.arg(after_neg_open)::int,
         sqlc.arg(after_name)::text, sqlc.arg(after_id)::uuid)
  AND (sqlc.narg(q)::text IS NULL OR lower(c.name) LIKE '%' || sqlc.narg(q)::text || '%')
ORDER BY (c.verified_at IS NULL), -c.open_vacancies, c.name, c.id
LIMIT sqlc.arg(max_results);

-- Page anchors for numbered directory pages: the key of every per-th row in directory
-- order (the last row of each page, from which the next page seeks) plus the total. One
-- ordered pass over the index; cached for a few minutes by company.Directory.
-- name: CompanyDirectoryAnchors :many
SELECT s.rn::bigint AS rn, s.total::bigint AS total, s.unverified::boolean AS unverified,
       s.neg_open::int AS neg_open, s.name::text AS name, s.id::uuid AS id
FROM (SELECT row_number() OVER (ORDER BY (c.verified_at IS NULL), -c.open_vacancies, c.name, c.id) AS rn,
             count(*) OVER () AS total,
             (c.verified_at IS NULL) AS unverified, -c.open_vacancies AS neg_open, c.name, c.id
      FROM companies c
      WHERE c.status = 'active'
        AND (sqlc.narg(q)::text IS NULL OR lower(c.name) LIKE '%' || sqlc.narg(q)::text || '%')) s
WHERE s.rn % sqlc.arg(per)::bigint = 0 OR s.rn = s.total
ORDER BY s.rn;
