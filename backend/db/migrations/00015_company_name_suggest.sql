-- TZ BE-11: company suggestions stop after the few rows they show, however many names
-- match. Prefix matches walk companies_name_prefix_idx (byte order, so LIKE 'x%' can use
-- it under any database collation); typo-tolerant matches walk companies_name_gist_idx
-- in trigram-distance order (KNN). The previous query sorted every similar name: 15 ms
-- when most names look alike ("OOO ...", "MChJ ..."), now ~1 ms (2000 companies).
-- companies_name_trgm_idx (GIN) stays: the company directory's ?q= filter uses it.

-- +goose NO TRANSACTION
-- +goose Up
CREATE INDEX CONCURRENTLY IF NOT EXISTS companies_name_prefix_idx
    ON companies ((lower(name) COLLATE "C")) WHERE status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS companies_name_gist_idx
    ON companies USING gist (lower(name) gist_trgm_ops) WHERE status = 'active';

-- +goose Down
DROP INDEX CONCURRENTLY IF EXISTS companies_name_gist_idx;
DROP INDEX CONCURRENTLY IF EXISTS companies_name_prefix_idx;
