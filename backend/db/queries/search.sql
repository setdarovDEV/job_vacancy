-- Copies the filter/rank columns from the vacancy row; the folded text comes from Go.
-- name: UpsertVacancySearch :exec
INSERT INTO vacancy_search (vacancy_id, is_published, published_at, is_featured, company_id,
                            category_id, region_id, district_id, employment_type, work_format,
                            experience, schedule, salary_min, salary_max, currency,
                            title, tags, company, meta, body)
SELECT v.id, v.status = 'published', v.published_at, v.is_featured, v.company_id,
       v.category_id, v.region_id, v.district_id, v.employment_type, v.work_format,
       v.experience, v.schedule, v.salary_min, v.salary_max, v.currency,
       $2, $3, $4, $5, $6
FROM vacancies v WHERE v.id = $1
ON CONFLICT (vacancy_id) DO UPDATE
SET is_published = EXCLUDED.is_published, published_at = EXCLUDED.published_at,
    is_featured = EXCLUDED.is_featured, company_id = EXCLUDED.company_id,
    category_id = EXCLUDED.category_id, region_id = EXCLUDED.region_id,
    district_id = EXCLUDED.district_id, employment_type = EXCLUDED.employment_type,
    work_format = EXCLUDED.work_format, experience = EXCLUDED.experience,
    schedule = EXCLUDED.schedule, salary_min = EXCLUDED.salary_min,
    salary_max = EXCLUDED.salary_max, currency = EXCLUDED.currency,
    title = EXCLUDED.title, tags = EXCLUDED.tags, company = EXCLUDED.company,
    meta = EXCLUDED.meta, body = EXCLUDED.body;

-- name: SetVacancySearchCompany :exec
UPDATE vacancy_search SET company = $2 WHERE company_id = $1;

-- name: ListVacancyIDsAfter :many
SELECT id FROM vacancies WHERE id > $1 ORDER BY id LIMIT $2;

-- Title suggestions: the ":*A" labels in the tsquery restrict matching to title lexemes.
-- Grouped by folded title so "Kassir" and "кассир" collapse into one suggestion.
-- Only the newest 2000 matches are grouped: suggestions need to be fast on every
-- keystroke, and the most common titles are well represented in that sample.
-- "vacancies" is therefore a lower bound for very broad prefixes.
-- name: SuggestTitles :many
WITH m AS MATERIALIZED (
    SELECT s.vacancy_id, s.title FROM vacancy_search s
    WHERE s.is_published AND s.document @@ to_tsquery('simple', sqlc.arg(tsquery)::text)
    ORDER BY s.published_at DESC
    LIMIT 2000
)
SELECT min(v.title)::text AS title, count(*) AS vacancies
FROM m JOIN vacancies v ON v.id = m.vacancy_id
GROUP BY m.title
ORDER BY count(*) DESC, max(v.published_at) DESC
LIMIT sqlc.arg(max_results);

-- name: SuggestCompanies :many
SELECT id, name, slug, logo_url, (verified_at IS NOT NULL)::boolean AS verified
FROM companies
WHERE status = 'active'
  AND (lower(name) LIKE lower(sqlc.arg(q)::text) || '%' OR lower(name) % lower(sqlc.arg(q)::text))
ORDER BY lower(name) LIKE lower(sqlc.arg(q)::text) || '%' DESC, similarity(lower(name), lower(sqlc.arg(q)::text)) DESC
LIMIT sqlc.arg(max_results);

-- name: GetVacanciesByIDs :many
SELECT sqlc.embed(v), c.name AS company_name
FROM vacancies v JOIN companies c ON c.id = v.company_id
WHERE v.id = ANY(sqlc.arg(ids)::uuid[]);
