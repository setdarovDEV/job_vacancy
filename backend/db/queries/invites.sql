-- Company invites (TZ FN-05): membership starts only when the invitee accepts.

-- (Re)send an invite; a pending invite to the same address is refreshed (role, sender,
-- a new 7-day window) instead of duplicated.
-- name: UpsertCompanyInvite :one
INSERT INTO company_invites (company_id, email, role, invited_by, expires_at)
VALUES (sqlc.arg(company_id), sqlc.arg(email), sqlc.arg(role), sqlc.arg(invited_by),
        now() + make_interval(days => sqlc.arg(ttl_days)::int))
ON CONFLICT (company_id, email) WHERE status = 'pending'
DO UPDATE SET role = EXCLUDED.role, invited_by = EXCLUDED.invited_by,
              expires_at = EXCLUDED.expires_at, created_at = now()
RETURNING *;

-- Pending invites of a company, expired ones included (the UI offers to resend them).
-- name: ListCompanyInvites :many
SELECT i.id, i.company_id, i.email, i.role, i.invited_by, i.status, i.expires_at, i.created_at,
       u.full_name AS invited_by_name
FROM company_invites i
LEFT JOIN users u ON u.id = i.invited_by
WHERE i.company_id = $1 AND i.status = 'pending'
ORDER BY i.id DESC
LIMIT 200;

-- name: RevokeCompanyInvite :execrows
UPDATE company_invites SET status = 'revoked', responded_at = now()
WHERE id = $1 AND company_id = $2 AND status = 'pending';

-- Invites addressed to an e-mail that can still be answered. Only public company
-- details are returned: the invitee is not a member yet.
-- name: ListInvitesForEmail :many
SELECT i.id, i.company_id, i.role, i.expires_at, i.created_at,
       c.name AS company_name, c.slug AS company_slug, c.logo_url AS company_logo,
       (c.verified_at IS NOT NULL)::boolean AS company_verified,
       u.full_name AS invited_by_name
FROM company_invites i
JOIN companies c ON c.id = i.company_id
LEFT JOIN users u ON u.id = i.invited_by
WHERE i.email = sqlc.arg(email) AND i.status = 'pending' AND i.expires_at > now() AND c.status = 'active'
ORDER BY i.id DESC
LIMIT 50;

-- name: LockInvite :one
SELECT * FROM company_invites WHERE id = $1 FOR UPDATE;

-- name: RespondInvite :one
UPDATE company_invites
SET status = sqlc.arg(status), responded_by = sqlc.arg(user_id), responded_at = now()
WHERE id = sqlc.arg(id) AND status = 'pending'
RETURNING *;

-- Joining never changes the role of someone who is already a member.
-- name: JoinCompany :execrows
INSERT INTO company_members (company_id, user_id, role) VALUES ($1, $2, $3)
ON CONFLICT (company_id, user_id) DO NOTHING;

-- name: UpdateMemberRole :execrows
UPDATE company_members SET role = sqlc.arg(role)
WHERE company_id = sqlc.arg(company_id) AND user_id = sqlc.arg(user_id) AND role <> 'owner';

-- The owner hands the company to another member, who becomes owner; the old owner stays
-- as an admin. Nothing changes unless new_owner is a member.
-- name: TransferCompanyOwnership :execrows
WITH target AS (
    UPDATE company_members SET role = 'owner'
    WHERE company_id = sqlc.arg(company_id) AND user_id = sqlc.arg(new_owner) AND role <> 'owner'
    RETURNING user_id
), demoted AS (
    UPDATE company_members SET role = 'admin'
    WHERE company_id = sqlc.arg(company_id) AND user_id = sqlc.arg(old_owner) AND EXISTS (SELECT 1 FROM target)
    RETURNING user_id
)
UPDATE companies SET owner_id = sqlc.arg(new_owner)
WHERE id = sqlc.arg(company_id) AND owner_id = sqlc.arg(old_owner) AND EXISTS (SELECT 1 FROM target);
