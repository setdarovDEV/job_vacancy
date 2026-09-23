-- +goose Up

-- Job categories form a two-level tree (e.g. "IT" → "Backend development").
-- Names are stored per UI language; the API returns all four so clients can cache one copy.
CREATE TABLE categories (
    id           integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    parent_id    integer REFERENCES categories (id) ON DELETE RESTRICT,
    slug         text    NOT NULL UNIQUE,
    name_uz      text    NOT NULL,
    name_uz_cyrl text    NOT NULL,
    name_ru      text    NOT NULL,
    name_en      text    NOT NULL,
    icon         text    NOT NULL DEFAULT '',
    sort_order   integer NOT NULL DEFAULT 0,
    is_active    boolean NOT NULL DEFAULT true
);
CREATE INDEX categories_parent_idx ON categories (parent_id, sort_order);

CREATE TYPE region_kind AS ENUM ('region', 'city', 'district');

-- Administrative divisions: regions (viloyat) → districts (tuman / shahar).
CREATE TABLE regions (
    id           integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    parent_id    integer REFERENCES regions (id) ON DELETE RESTRICT,
    kind         region_kind NOT NULL,
    slug         text        NOT NULL UNIQUE,
    name_uz      text        NOT NULL,
    name_uz_cyrl text        NOT NULL,
    name_ru      text        NOT NULL,
    name_en      text        NOT NULL,
    sort_order   integer     NOT NULL DEFAULT 0
);
CREATE INDEX regions_parent_idx ON regions (parent_id, sort_order);

-- Skills are mostly language-neutral ("Go", "Excel", "1C"). Employers may add new ones;
-- those start unverified until an admin reviews them. usage_count orders autocomplete.
CREATE TABLE skills (
    id          integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name        text    NOT NULL,
    slug        text    NOT NULL UNIQUE,
    is_verified boolean NOT NULL DEFAULT false,
    usage_count integer NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX skills_name_trgm_idx ON skills USING gin (lower(name) gin_trgm_ops);
CREATE INDEX skills_popular_idx ON skills (usage_count DESC) WHERE is_verified;

-- +goose Down
DROP TABLE IF EXISTS skills;
DROP TABLE IF EXISTS regions;
DROP TYPE IF EXISTS region_kind;
DROP TABLE IF EXISTS categories;
