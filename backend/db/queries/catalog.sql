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

-- Matches a skill's own slug or one of its aliases (names merged or renamed away);
-- "slug" is always the slug that was asked for.
-- name: GetSkillsBySlugs :many
SELECT s.id, s.name, s.slug AS slug FROM skills s WHERE s.slug = ANY(sqlc.arg(slugs)::text[])
UNION ALL
SELECT s.id, s.name, a.slug AS slug
FROM skill_aliases a JOIN skills s ON s.id = a.skill_id
WHERE a.slug = ANY(sqlc.arg(slugs)::text[]);

-- The no-op DO UPDATE makes RETURNING yield the existing row on conflict. A slug that is
-- an alias is never inserted as a new skill: no row comes back, and the caller resolves
-- the alias instead (the trigger from 00015 backs this up under concurrency).
-- name: UpsertSkill :one
INSERT INTO skills (name, slug)
SELECT sqlc.arg(name)::text, sqlc.arg(slug)::text
WHERE NOT EXISTS (SELECT 1 FROM skill_aliases a WHERE a.slug = sqlc.arg(slug)::text)
ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
RETURNING id, name, slug;

-- name: IncrementSkillUsage :exec
UPDATE skills SET usage_count = usage_count + 1 WHERE id = ANY(sqlc.arg(ids)::int[]);

-- ---- skill administration (catalog.Service, admins only) ----------------------------------

-- Locks the row so concurrent renames/merges of the same skill run one after another.
-- name: GetSkillForUpdate :one
SELECT * FROM skills WHERE id = $1 FOR UPDATE;

-- Which skill a slug belongs to, as its own slug or as an alias.
-- name: FindSkillBySlug :one
SELECT id FROM skills WHERE skills.slug = sqlc.arg(slug)::text
UNION ALL
SELECT skill_id FROM skill_aliases WHERE skill_aliases.slug = sqlc.arg(slug)::text
LIMIT 1;

-- name: RenameSkill :one
UPDATE skills SET name = $2, slug = $3 WHERE id = $1 RETURNING *;

-- name: SetSkillVerified :one
UPDATE skills SET is_verified = $2 WHERE id = $1 RETURNING *;

-- name: AddSkillAlias :exec
INSERT INTO skill_aliases (slug, skill_id) VALUES ($1, $2)
ON CONFLICT (slug) DO UPDATE SET skill_id = EXCLUDED.skill_id;

-- name: DeleteSkillAlias :exec
DELETE FROM skill_aliases WHERE slug = $1;

-- name: RepointSkillAliases :exec
UPDATE skill_aliases SET skill_id = sqlc.arg(target_id)::int WHERE skill_id = sqlc.arg(source_id)::int;

-- name: ListSkillVacancyIDs :many
SELECT vacancy_id FROM vacancy_skills WHERE skill_id = $1;

-- name: ListSkillResumeIDs :many
SELECT resume_id FROM resume_skills WHERE skill_id = $1;

-- Copies the source's links to the target; items that already have both keep one link.
-- The source's own rows go away with the skill (ON DELETE CASCADE).
-- name: CopyVacancySkillLinks :execrows
INSERT INTO vacancy_skills (vacancy_id, skill_id)
SELECT l.vacancy_id, sqlc.arg(target_id)::int FROM vacancy_skills l WHERE l.skill_id = sqlc.arg(source_id)::int
ON CONFLICT DO NOTHING;

-- name: CopyResumeSkillLinks :exec
INSERT INTO resume_skills (resume_id, skill_id)
SELECT l.resume_id, sqlc.arg(target_id)::int FROM resume_skills l WHERE l.skill_id = sqlc.arg(source_id)::int
ON CONFLICT DO NOTHING;

-- name: AddSkillUsage :exec
UPDATE skills SET usage_count = usage_count + sqlc.arg(n) WHERE id = sqlc.arg(id);

-- name: CountSkillVacancyLinks :one
SELECT count(*)::int FROM vacancy_skills WHERE skill_id = $1;

-- Bulk review; the caller compares the returned ids with the requested ones.
-- name: SetSkillsVerified :many
UPDATE skills SET is_verified = true WHERE id = ANY(sqlc.arg(ids)::int[]) RETURNING id;

-- name: DeleteSkill :execrows
DELETE FROM skills WHERE id = $1;
