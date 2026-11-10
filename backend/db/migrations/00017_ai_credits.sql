-- +goose Up
-- +goose StatementBegin
CREATE TYPE ai_operation AS ENUM ('resume_improve', 'cover_letter', 'vacancy_description');

CREATE TABLE ai_credits (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ai_usages (
    ID BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operation ai_operation NOT NULL,
    model TEXT NOT NULL,
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    tokens_input INT NOT NULL DEFAULT 0,
    tokens_output INT NOT NULL DEFAULT 0,
    cost_credits INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usages_user_id ON ai_usages(user_id);
CREATE INDEX idx_ai_usages_created_at ON ai_usages(created_at);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE ai_usages;
DROP TABLE ai_credits;
DROP TYPE ai_operation;
-- +goose StatementEnd
