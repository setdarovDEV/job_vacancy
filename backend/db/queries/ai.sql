-- name: GetCreditBalance :one
SELECT balance, updated_at FROM ai_credits WHERE user_id = $1;

-- name: AddCredits :one
INSERT INTO ai_credits (user_id, balance)
VALUES ($1, $2)
ON CONFLICT (user_id) DO UPDATE
SET balance = ai_credits.balance + excluded.balance,
    updated_at = now()
RETURNING balance, updated_at;

-- name: SpendCredits :execrows
UPDATE ai_credits
SET balance = balance - $2,
    updated_at = now()
WHERE user_id = $1
  AND balance >= $2;

-- name: RecordUsage :one
INSERT INTO ai_usages (user_id, operation, model, prompt, response, tokens_input, tokens_output, cost_credits)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id, created_at;

-- name: ListUsage :many
SELECT id, operation, model, tokens_input, tokens_output, cost_credits, created_at
FROM ai_usages
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2;
