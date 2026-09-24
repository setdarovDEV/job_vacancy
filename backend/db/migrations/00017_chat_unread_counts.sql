-- TZ BE-04: denormalized unread counters for chat.
--
-- The conversation list counted unread messages per row (a capped sub-select per
-- conversation) and GET /conversations/unread-count scanned every conversation of the
-- user with an EXISTS per row. conversation_reads.unread_count now holds, per participant,
-- the number of undeleted messages from others after their read position:
--
--   * a new message adds 1 for every other participant who hasn't read past it, and
--     creates the missing rows of participants who never opened the conversation (their
--     count starts from the whole history, as before);
--   * moving a read position forward recounts the messages after it. The recount runs in
--     a BEFORE trigger after the row lock is taken, and a PL/pgSQL statement takes a fresh
--     snapshot, so a message committed while the reader waited for the lock is counted.
--     Reading up to the newest message makes it 0, and any drift heals on the next read;
--   * deleting a message takes 1 off for everyone who hadn't read past it.
--
-- Triggers rather than service code keep the counters right for every writer, including
-- API instances still running the previous release during a rolling deploy.
--
-- Locks (live-safe): ADD COLUMN with a constant default is metadata-only (short ACCESS
-- EXCLUSIVE, reset right after); the triggers are created in one short transaction. The
-- backfill and its index are in migration 00018 (batched, CONCURRENTLY).

-- +goose NO TRANSACTION
-- +goose Up
SET lock_timeout = '5s';
ALTER TABLE conversation_reads ADD COLUMN IF NOT EXISTS unread_count integer NOT NULL DEFAULT 0;
RESET lock_timeout;

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION conversation_reads_recount() RETURNS trigger AS $$
BEGIN
    SELECT count(*) INTO NEW.unread_count
    FROM messages m
    WHERE m.conversation_id = NEW.conversation_id AND m.id > NEW.last_read_id
      AND m.sender_id IS DISTINCT FROM NEW.user_id AND m.deleted_at IS NULL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION messages_count_unread() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE conversation_reads r SET unread_count = r.unread_count + 1
        WHERE r.conversation_id = NEW.conversation_id AND r.user_id IS DISTINCT FROM NEW.sender_id
          AND r.last_read_id < NEW.id;
        -- Participants without a row yet: the BEFORE INSERT trigger counts their history.
        INSERT INTO conversation_reads (conversation_id, user_id)
        SELECT NEW.conversation_id, p.user_id
        FROM (SELECT c.seeker_id AS user_id FROM conversations c WHERE c.id = NEW.conversation_id
              UNION
              SELECT m.user_id FROM conversations c
              JOIN company_members m ON m.company_id = c.company_id
              WHERE c.id = NEW.conversation_id) p
        WHERE p.user_id IS DISTINCT FROM NEW.sender_id
          AND NOT EXISTS (SELECT 1 FROM conversation_reads r
                          WHERE r.conversation_id = NEW.conversation_id AND r.user_id = p.user_id)
        ON CONFLICT (conversation_id, user_id) DO UPDATE
        SET unread_count = conversation_reads.unread_count
            + CASE WHEN NEW.id > conversation_reads.last_read_id THEN 1 ELSE 0 END;
    ELSE -- soft delete
        UPDATE conversation_reads r SET unread_count = GREATEST(r.unread_count - 1, 0)
        WHERE r.conversation_id = NEW.conversation_id AND r.user_id IS DISTINCT FROM NEW.sender_id
          AND r.last_read_id < NEW.id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

-- +goose StatementBegin
DO $$
BEGIN
    PERFORM set_config('lock_timeout', '5s', true);
    DROP TRIGGER IF EXISTS conversation_reads_recount_ins ON conversation_reads;
    CREATE TRIGGER conversation_reads_recount_ins BEFORE INSERT ON conversation_reads
        FOR EACH ROW EXECUTE FUNCTION conversation_reads_recount();
    DROP TRIGGER IF EXISTS conversation_reads_recount_upd ON conversation_reads;
    CREATE TRIGGER conversation_reads_recount_upd BEFORE UPDATE OF last_read_id ON conversation_reads
        FOR EACH ROW WHEN (NEW.last_read_id > OLD.last_read_id)
        EXECUTE FUNCTION conversation_reads_recount();
    DROP TRIGGER IF EXISTS messages_count_unread_ins ON messages;
    CREATE TRIGGER messages_count_unread_ins AFTER INSERT ON messages
        FOR EACH ROW EXECUTE FUNCTION messages_count_unread();
    DROP TRIGGER IF EXISTS messages_count_unread_del ON messages;
    CREATE TRIGGER messages_count_unread_del AFTER UPDATE OF deleted_at ON messages
        FOR EACH ROW WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
        EXECUTE FUNCTION messages_count_unread();
END $$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DO $$
BEGIN
    PERFORM set_config('lock_timeout', '5s', true);
    DROP TRIGGER IF EXISTS messages_count_unread_ins ON messages;
    DROP TRIGGER IF EXISTS messages_count_unread_del ON messages;
    DROP TRIGGER IF EXISTS conversation_reads_recount_ins ON conversation_reads;
    DROP TRIGGER IF EXISTS conversation_reads_recount_upd ON conversation_reads;
    ALTER TABLE conversation_reads DROP COLUMN IF EXISTS unread_count;
END $$;
-- +goose StatementEnd
DROP FUNCTION IF EXISTS messages_count_unread();
DROP FUNCTION IF EXISTS conversation_reads_recount();
