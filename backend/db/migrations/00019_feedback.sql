-- +goose Up
-- "Fikr bildirish": messages from visitors and users to the team, read in /admin/feedback.
CREATE TYPE feedback_category AS ENUM ('bug', 'idea', 'other');

CREATE TABLE feedback (
    id         uuid              PRIMARY KEY DEFAULT uuidv7(),
    user_id    uuid              REFERENCES users (id) ON DELETE SET NULL,
    category   feedback_category NOT NULL,
    message    text              NOT NULL CHECK (char_length(message) BETWEEN 5 AND 2000),
    contact    text              CHECK (char_length(contact) <= 200),
    page_url   text              CHECK (char_length(page_url) <= 500),
    ip         inet,
    handled_at timestamptz,
    handled_by uuid              REFERENCES users (id) ON DELETE SET NULL,
    created_at timestamptz       NOT NULL DEFAULT now(),
    -- handled_by may become NULL when that admin is deleted; never set without handled_at.
    CHECK (handled_by IS NULL OR handled_at IS NOT NULL)
);
-- Admin queue: unhandled first, newest first.
CREATE INDEX feedback_queue_idx ON feedback (created_at DESC, id DESC) WHERE handled_at IS NULL;
CREATE INDEX feedback_all_idx ON feedback (created_at DESC, id DESC);

-- +goose Down
DROP TABLE IF EXISTS feedback;
DROP TYPE IF EXISTS feedback_category;
