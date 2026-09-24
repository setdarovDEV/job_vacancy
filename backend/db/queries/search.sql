-- Copies the filter/rank columns and the title as written from the vacancy row; the folded
-- text comes from Go.
-- name: UpsertVacancySearch :exec
INSERT INTO vacancy_search (vacancy_id, is_published, published_at, is_featured, company_id,
                            category_id, region_id, district_id, employment_type, work_format,
                            experience, schedule, salary_min, salary_max, currency,
                            display_title, title, tags, company, meta, body)
SELECT v.id, v.status = 'published', v.published_at, v.is_featured, v.company_id,
       v.category_id, v.region_id, v.district_id, v.employment_type, v.work_format,
       v.experience, v.schedule, v.salary_min, v.salary_max, v.currency,
       v.title, $2, $3, $4, $5, $6
FROM vacancies v WHERE v.id = $1
ON CONFLICT (vacancy_id) DO UPDATE
SET is_published = EXCLUDED.is_published, published_at = EXCLUDED.published_at,
    is_featured = EXCLUDED.is_featured, company_id = EXCLUDED.company_id,
    category_id = EXCLUDED.category_id, region_id = EXCLUDED.region_id,
    district_id = EXCLUDED.district_id, employment_type = EXCLUDED.employment_type,
    work_format = EXCLUDED.work_format, experience = EXCLUDED.experience,
    schedule = EXCLUDED.schedule, salary_min = EXCLUDED.salary_min,
    salary_max = EXCLUDED.salary_max, currency = EXCLUDED.currency,
    display_title = EXCLUDED.display_title,
    title = EXCLUDED.title, tags = EXCLUDED.tags, company = EXCLUDED.company,
    meta = EXCLUDED.meta, body = EXCLUDED.body;

-- name: SetVacancySearchCompany :exec
UPDATE vacancy_search SET company = $2 WHERE company_id = $1;

-- name: ListVacancyIDsAfter :many
SELECT id FROM vacancies WHERE id > $1 ORDER BY id LIMIT $2;

-- Title suggestions: the ":*A" labels in the tsquery restrict matching to title lexemes.
-- Grouped by folded title so "Kassir" and "кассир" collapse into one suggestion, shown
-- with an original spelling (display_title; the folded title only for a row written
-- before that column existed). Only the newest 500 matches are grouped, all from
-- vacancy_search alone (TZ BE-11): suggestions run on every keystroke, and the most
-- common titles are well represented in that sample. "vacancies" is therefore a lower
-- bound for very broad prefixes.
-- name: SuggestTitles :many
WITH m AS MATERIALIZED (
    SELECT s.title, s.display_title, s.published_at FROM vacancy_search s
    WHERE s.is_published AND s.document @@ to_tsquery('simple', sqlc.arg(tsquery)::text)
    ORDER BY s.published_at DESC
    LIMIT 500
)
SELECT COALESCE(min(m.display_title), min(m.title))::text AS title, count(*) AS vacancies
FROM m
GROUP BY m.title
ORDER BY count(*) DESC, max(m.published_at) DESC
LIMIT sqlc.arg(max_results);

-- Company suggestions: names starting with the prefix first (companies_name_prefix_idx),
-- then the closest names by trigram distance (KNN on companies_name_gist_idx). Each
-- branch stops after max_results rows however many names match; Go drops duplicates.
-- prefix is the lower-cased input with LIKE wildcards escaped.
-- name: SuggestCompanies :many
(SELECT id, name, slug, logo_url, (verified_at IS NOT NULL)::boolean AS verified
 FROM companies
 WHERE status = 'active' AND lower(name) COLLATE "C" LIKE sqlc.arg(prefix)::text || '%'
 ORDER BY lower(name) COLLATE "C"
 LIMIT sqlc.arg(max_results))
UNION ALL
(SELECT id, name, slug, logo_url, (verified_at IS NOT NULL)::boolean AS verified
 FROM companies
 WHERE status = 'active' AND lower(name) % lower(sqlc.arg(q)::text)
 ORDER BY lower(name) <-> lower(sqlc.arg(q)::text)
 LIMIT sqlc.arg(max_results));

-- name: GetVacanciesByIDs :many
SELECT sqlc.embed(v), c.name AS company_name
FROM vacancies v JOIN companies c ON c.id = v.company_id
WHERE v.id = ANY(sqlc.arg(ids)::uuid[]);

-- Words or phrases hidden from the public "popular searches" list (TZ SEC-07).
-- name: ListHiddenSearchTerms :many
SELECT term, created_at FROM search_hidden_terms ORDER BY term;

-- name: HideSearchTerm :exec
INSERT INTO search_hidden_terms (term, hidden_by) VALUES ($1, $2)
ON CONFLICT (term) DO NOTHING;

-- name: UnhideSearchTerm :execrows
DELETE FROM search_hidden_terms WHERE term = $1;
