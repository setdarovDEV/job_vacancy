-- name: ListCategories :many
SELECT * FROM categories WHERE is_active ORDER BY parent_id NULLS FIRST, sort_order, id;

-- name: ListRegions :many
SELECT * FROM regions ORDER BY parent_id NULLS FIRST, sort_order, id;

-- Prefix matches first, then verified and popular skills. The trigram index serves
-- the substring match for queries of 3+ characters.
-- name: SearchSkills :many
SELECT id, name FROM skills
WHERE lower(name) LIKE '%' || lower(sqlc.arg(q)::text) || '%'
ORDER BY (lower(name) LIKE lower(sqlc.arg(q)::text) || '%') DESC, is_verified DESC, usage_count DESC, name
LIMIT sqlc.arg(max_results);

-- name: PopularSkills :many
SELECT id, name FROM skills WHERE is_verified
ORDER BY usage_count DESC, name
LIMIT sqlc.arg(max_results);

-- name: GetSkillsBySlugs :many
SELECT id, name, slug FROM skills WHERE slug = ANY(sqlc.arg(slugs)::text[]);

-- The no-op DO UPDATE makes RETURNING yield the existing row on conflict.
-- name: UpsertSkill :one
INSERT INTO skills (name, slug) VALUES ($1, $2)
ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
RETURNING id, name, slug;

-- name: IncrementSkillUsage :exec
UPDATE skills SET usage_count = usage_count + 1 WHERE id = ANY(sqlc.arg(ids)::int[]);
