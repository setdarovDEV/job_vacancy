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

-- Districts and cities of regional subordination from the SOATO file (TZ FN-06), in one
-- statement. Rows are matched by slug; a row whose values are all unchanged is left
-- alone, so a repeated import changes nothing. Rows whose region slug is unknown are
-- skipped (the caller compares counts).
-- name: UpsertDistricts :many
INSERT INTO regions (parent_id, kind, slug, name_uz, name_uz_cyrl, name_ru, name_en, sort_order, soato)
SELECT p.id, d.kind::region_kind, d.slug, d.name_uz, d.name_uz_cyrl, d.name_ru, d.name_en, d.sort_order, d.soato
FROM (SELECT unnest(sqlc.arg(region_slugs)::text[]) AS region_slug, unnest(sqlc.arg(kinds)::text[]) AS kind,
             unnest(sqlc.arg(slugs)::text[]) AS slug, unnest(sqlc.arg(names_uz)::text[]) AS name_uz,
             unnest(sqlc.arg(names_uz_cyrl)::text[]) AS name_uz_cyrl, unnest(sqlc.arg(names_ru)::text[]) AS name_ru,
             unnest(sqlc.arg(names_en)::text[]) AS name_en, unnest(sqlc.arg(sort_orders)::int[]) AS sort_order,
             unnest(sqlc.arg(soatos)::int[]) AS soato) d
JOIN regions p ON p.slug = d.region_slug AND p.parent_id IS NULL
ON CONFLICT (slug) DO UPDATE
SET parent_id = EXCLUDED.parent_id, kind = EXCLUDED.kind, name_uz = EXCLUDED.name_uz,
    name_uz_cyrl = EXCLUDED.name_uz_cyrl, name_ru = EXCLUDED.name_ru, name_en = EXCLUDED.name_en,
    sort_order = EXCLUDED.sort_order, soato = EXCLUDED.soato
WHERE (regions.parent_id, regions.kind, regions.name_uz, regions.name_uz_cyrl, regions.name_ru,
       regions.name_en, regions.sort_order, regions.soato)
      IS DISTINCT FROM (EXCLUDED.parent_id, EXCLUDED.kind, EXCLUDED.name_uz, EXCLUDED.name_uz_cyrl,
                        EXCLUDED.name_ru, EXCLUDED.name_en, EXCLUDED.sort_order, EXCLUDED.soato)
RETURNING slug, (xmax = 0)::boolean AS inserted;
