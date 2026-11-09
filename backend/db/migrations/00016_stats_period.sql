-- +goose Up
-- The admin statistics window, defined once. Days are calendar days in Asia/Tashkent; a
-- period of N days ends today and includes it, so it starts at midnight N − 1 days ago.
-- +goose StatementBegin
CREATE FUNCTION stats_today() RETURNS date AS $$
    SELECT (now() AT TIME ZONE 'Asia/Tashkent')::date
$$ LANGUAGE sql STABLE;

CREATE FUNCTION stats_period_start(days integer) RETURNS timestamptz AS $$
    SELECT (stats_today() - (days - 1))::timestamp AT TIME ZONE 'Asia/Tashkent'
$$ LANGUAGE sql STABLE;
-- +goose StatementEnd

-- +goose Down
DROP FUNCTION IF EXISTS stats_period_start(integer);
DROP FUNCTION IF EXISTS stats_today();
