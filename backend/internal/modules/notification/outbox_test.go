package notification_test

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math/rand/v2"
	"slices"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/jobs"
	"jobvacancy.uz/backend/internal/modules/notification"
	"jobvacancy.uz/backend/internal/platform/postgres"
	"jobvacancy.uz/backend/internal/realtime"
	"jobvacancy.uz/backend/internal/testutil/pgtest"
)

type outboxFixture struct {
	t    *testing.T
	pool *pgxpool.Pool
	svc  *notification.Service
	rdb  *redis.Client
}

func newOutbox(t *testing.T) *outboxFixture {
	t.Helper()
	pool := pgtest.Pool(t)
	pgtest.River(t)
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	enq, err := jobs.NewEnqueuer(pool, log)
	if err != nil {
		t.Fatal(err)
	}
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	return &outboxFixture{t: t, pool: pool, rdb: rdb, svc: &notification.Service{
		Pool: pool, Q: gen.New(pool), Publisher: &realtime.Publisher{RDB: rdb}, Jobs: enq, Log: log,
	}}
}

// user creates an account; setup runs SQL on it ($1 = the user id).
func (f *outboxFixture) user(setup string) uuid.UUID {
	f.t.Helper()
	ctx := context.Background()
	var id uuid.UUID
	if err := f.pool.QueryRow(ctx, `INSERT INTO users (email, full_name, role) VALUES ($1, 'N', 'seeker') RETURNING id`,
		fmt.Sprintf("n-%s@test.local", uuid.NewString()[:13])).Scan(&id); err != nil {
		f.t.Fatal(err)
	}
	if setup != "" {
		if _, err := f.pool.Exec(ctx, setup, id); err != nil {
			f.t.Fatal(err)
		}
	}
	return id
}

// channels lists the queued delivery jobs of a user, sorted.
func (f *outboxFixture) channels(user uuid.UUID) []string {
	f.t.Helper()
	rows, err := f.pool.Query(context.Background(), `SELECT args->>'channel' FROM river_job
		WHERE kind = 'notification.deliver' AND args->>'user_id' = $1 ORDER BY 1`, user.String())
	if err != nil {
		f.t.Fatal(err)
	}
	out, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		f.t.Fatal(err)
	}
	return out
}

func (f *outboxFixture) stored(user uuid.UUID) int {
	f.t.Helper()
	var n int
	if err := f.pool.QueryRow(context.Background(), `SELECT count(*) FROM notifications WHERE user_id = $1`, user).Scan(&n); err != nil {
		f.t.Fatal(err)
	}
	return n
}

// TZ BE-08 ✅ "Kanali yo'q foydalanuvchi uchun job yaratilmaydi": jobs exist only for the
// channels a user has; chat messages never go by e-mail; blocked users get nothing.
func TestJobsOnlyForChannelsUserHas(t *testing.T) {
	f := newOutbox(t)
	ctx := context.Background()
	tg := func() int64 { return rand.Int64N(1e12) + 1 }
	none := f.user(``)                                                                            // e-mail not verified
	telegram := f.user(fmt.Sprintf(`UPDATE users SET telegram_chat_id = %d WHERE id = $1`, tg())) // linked
	tgOff := f.user(fmt.Sprintf(`UPDATE users SET telegram_chat_id = %d, notify_telegram = false WHERE id = $1`, tg()))
	full := f.user(fmt.Sprintf(`WITH d AS (INSERT INTO device_tokens (token, user_id, platform) VALUES ('tok-' || $1::uuid::text, $1::uuid, 'android'))
		UPDATE users SET email_verified_at = now(), telegram_chat_id = %d WHERE id = $1::uuid`, tg()))
	emailOff := f.user(`UPDATE users SET email_verified_at = now(), notify_email = false WHERE id = $1`)
	blocked := f.user(fmt.Sprintf(`UPDATE users SET status = 'blocked', email_verified_at = now(), telegram_chat_id = %d WHERE id = $1`, tg()))
	users := []uuid.UUID{none, telegram, tgOff, full, emailOff, blocked}

	var sent notification.Sent
	err := postgres.WithPgxTx(ctx, f.pool, func(tx pgx.Tx) error {
		to := make([]notification.Recipient, len(users))
		for i, u := range users {
			to[i] = notification.Recipient{UserID: u, Payload: notification.Payload{VacancyTitle: "Dasturchi"}}
		}
		var err error
		sent, err = f.svc.NotifyTx(ctx, tx, notification.TypeApplicationStatus, to, true)
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	sent.Publish(ctx)
	want := map[uuid.UUID][]string{
		none: nil, telegram: {"telegram"}, tgOff: nil, full: {"email", "push", "telegram"}, emailOff: nil, blocked: nil,
	}
	for u, w := range want {
		if got := f.channels(u); !slices.Equal(got, w) {
			t.Errorf("user %s: jobs for %v, want %v", u, got, w)
		}
		if f.stored(u) != 1 {
			t.Errorf("user %s: in-app notification not stored", u)
		}
	}

	// A chat message (transient) never goes by e-mail and isn't stored.
	chatUser := f.user(`WITH d AS (INSERT INTO device_tokens (token, user_id, platform) VALUES ('tok-' || $1::uuid::text, $1::uuid, 'ios'))
		UPDATE users SET email_verified_at = now() WHERE id = $1::uuid`)
	err = postgres.WithPgxTx(ctx, f.pool, func(tx pgx.Tx) error {
		_, err := f.svc.NotifyTx(ctx, tx, notification.TypeMessageNew,
			[]notification.Recipient{{UserID: chatUser, Payload: notification.Payload{Preview: "salom"}}}, false)
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	if got := f.channels(chatUser); !slices.Equal(got, []string{"push"}) || f.stored(chatUser) != 0 {
		t.Fatalf("chat message: jobs %v, stored %d", got, f.stored(chatUser))
	}
}

// The outbox rolls back with the business change: nothing stored, nothing queued, and
// no live event.
func TestNotifyRollsBackWithTheChange(t *testing.T) {
	f := newOutbox(t)
	ctx := context.Background()
	u := f.user(fmt.Sprintf(`UPDATE users SET telegram_chat_id = %d WHERE id = $1`, rand.Int64N(1e12)+1))
	sub := f.rdb.Subscribe(ctx, "rt:u:"+u.String())
	defer sub.Close()
	if _, err := sub.Receive(ctx); err != nil {
		t.Fatal(err)
	}
	boom := errors.New("business rule failed after notifying")
	err := postgres.WithPgxTx(ctx, f.pool, func(tx pgx.Tx) error {
		if _, err := f.svc.NotifyTx(ctx, tx, notification.TypeVacancyApproved,
			[]notification.Recipient{{UserID: u, Payload: notification.Payload{VacancyTitle: "X"}}}, true); err != nil {
			return err
		}
		return boom
	})
	if !errors.Is(err, boom) {
		t.Fatal(err)
	}
	if f.stored(u) != 0 || len(f.channels(u)) != 0 {
		t.Fatalf("rolled back change left %d notifications and jobs %v", f.stored(u), f.channels(u))
	}
	if msg, err := sub.ReceiveTimeout(ctx, 100_000_000); err == nil {
		t.Fatalf("live event published for a rolled-back change: %v", msg)
	}
}

// Company members are notified with one statement; live events for all of them leave in
// one pipelined Redis call after commit.
func TestNotifyCompanyMembers(t *testing.T) {
	f := newOutbox(t)
	ctx := context.Background()
	owner := f.user(`UPDATE users SET role = 'employer', email_verified_at = now() WHERE id = $1`)
	hr := f.user(fmt.Sprintf(`UPDATE users SET role = 'employer', telegram_chat_id = %d WHERE id = $1`, rand.Int64N(1e12)+1))
	var companyID uuid.UUID
	if err := f.pool.QueryRow(ctx, `WITH c AS (INSERT INTO companies (owner_id, name, slug) VALUES ($1, 'N', $2) RETURNING id),
		m AS (INSERT INTO company_members (company_id, user_id, role) SELECT c.id, $1, 'owner'::company_member_role FROM c UNION ALL
		      SELECT c.id, $3, 'recruiter'::company_member_role FROM c RETURNING company_id)
		SELECT id FROM c`, owner, "n-"+uuid.NewString(), hr).Scan(&companyID); err != nil {
		t.Fatal(err)
	}
	var sent notification.Sent
	err := postgres.WithPgxTx(ctx, f.pool, func(tx pgx.Tx) error {
		var err error
		sent, err = f.svc.NotifyCompanyTx(ctx, tx, companyID, notification.TypeApplicationNew,
			notification.Payload{CandidateName: "Ali", VacancyTitle: "Dasturchi"})
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	sub := f.rdb.Subscribe(ctx, "rt:u:"+owner.String(), "rt:u:"+hr.String())
	defer sub.Close()
	if _, err := sub.Receive(ctx); err != nil {
		t.Fatal(err)
	}
	if err := f.rdb.Ping(ctx).Err(); err != nil { // an idle connection, as in steady state
		t.Fatal(err)
	}
	var cmds int
	f.rdb.AddHook(countHook{&cmds})
	sent.Publish(ctx)
	if cmds != 1 {
		t.Fatalf("publishing 2 events took %d Redis round trips: %v", cmds, seenCmds)
	}
	if got := f.channels(owner); !slices.Equal(got, []string{"email"}) {
		t.Fatalf("owner jobs %v", got)
	}
	if got := f.channels(hr); !slices.Equal(got, []string{"telegram"}) {
		t.Fatalf("hr jobs %v", got)
	}
}

var seenCmds []string

type countHook struct{ n *int }

func (h countHook) DialHook(next redis.DialHook) redis.DialHook { return next }
func (h countHook) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return func(ctx context.Context, cmd redis.Cmder) error {
		*h.n++
		seenCmds = append(seenCmds, cmd.Name())
		return next(ctx, cmd)
	}
}
func (h countHook) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return func(ctx context.Context, cmds []redis.Cmder) error {
		*h.n++
		seenCmds = append(seenCmds, fmt.Sprintf("pipeline(%d)", len(cmds)))
		return next(ctx, cmds)
	}
}
