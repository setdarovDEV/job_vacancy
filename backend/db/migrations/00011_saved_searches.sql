-- +goose Up

-- A saved vacancy search. params is the listing query string (q=…&region_id=…), replayed
-- through the same parser as GET /vacancies, so saved searches support every filter.
CREATE TABLE saved_searches (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    user_id         uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name            text        NOT NULL,
    params          text        NOT NULL,
    notify          boolean     NOT NULL DEFAULT true,
    -- New vacancies are those published after this moment.
    last_checked_at timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, params)
);
CREATE INDEX saved_searches_due_idx ON saved_searches (last_checked_at) WHERE notify;

-- +goose Down
DROP TABLE IF EXISTS saved_searches;
