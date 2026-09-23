-- name: SaveVacancy :exec
INSERT INTO saved_vacancies (user_id, vacancy_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;

-- name: UnsaveVacancy :exec
DELETE FROM saved_vacancies WHERE user_id = $1 AND vacancy_id = $2;

-- name: ListSavedVacancyIDs :many
SELECT vacancy_id FROM saved_vacancies WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1000;

-- name: ListSavedVacancies :many
SELECT vacancy_id, created_at FROM saved_vacancies
WHERE user_id = sqlc.arg(user_id)
  AND (sqlc.narg(before_created)::timestamptz IS NULL
       OR (created_at, vacancy_id) < (sqlc.narg(before_created), sqlc.narg(before_id)::uuid))
ORDER BY created_at DESC, vacancy_id DESC
LIMIT sqlc.arg(max_results);
