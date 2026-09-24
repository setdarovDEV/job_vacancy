-- TZ BE-04: backfill conversation_reads.unread_count (see 00017) and index unread rows.
--
-- For every conversation, in batches of 500 conversations each committed separately (no
-- long transaction, no table lock): recount the existing read rows and create the missing
-- rows of participants (seeker and company members) who never opened a conversation; the
-- BEFORE INSERT trigger counts their history. The triggers from 00017 are live while this
-- runs, so messages sent meanwhile are counted either way; a row recounted while a message
-- is being committed can end up one short until its reader's next read (which recounts).
--
-- conversation_reads_unread_idx serves GET /conversations/unread-count: it holds only the
-- rows with something unread, so the count reads a handful of index entries per user.

-- +goose NO TRANSACTION
-- +goose Up
-- +goose StatementBegin
DO $$
DECLARE
    last_id uuid := '00000000-0000-0000-0000-000000000000';
    batch   uuid[];
BEGIN
    LOOP
        SELECT array_agg(id ORDER BY id) INTO batch
        FROM (SELECT id FROM conversations WHERE id > last_id ORDER BY id LIMIT 500) b;
        EXIT WHEN batch IS NULL;

        UPDATE conversation_reads r SET unread_count = (
            SELECT count(*) FROM messages m
            WHERE m.conversation_id = r.conversation_id AND m.id > r.last_read_id
              AND m.sender_id IS DISTINCT FROM r.user_id AND m.deleted_at IS NULL)
        WHERE r.conversation_id = ANY(batch);

        INSERT INTO conversation_reads (conversation_id, user_id)
        SELECT p.conversation_id, p.user_id
        FROM (SELECT c.id AS conversation_id, c.seeker_id AS user_id
              FROM conversations c WHERE c.id = ANY(batch)
              UNION
              SELECT c.id, m.user_id FROM conversations c
              JOIN company_members m ON m.company_id = c.company_id
              WHERE c.id = ANY(batch)) p
        WHERE EXISTS (SELECT 1 FROM messages x WHERE x.conversation_id = p.conversation_id)
        ON CONFLICT (conversation_id, user_id) DO NOTHING;

        last_id := batch[array_length(batch, 1)];
        COMMIT;
    END LOOP;
END $$;
-- +goose StatementEnd

CREATE INDEX CONCURRENTLY IF NOT EXISTS conversation_reads_unread_idx
    ON conversation_reads (user_id, conversation_id) WHERE unread_count > 0;

-- +goose Down
DROP INDEX CONCURRENTLY IF EXISTS conversation_reads_unread_idx;
