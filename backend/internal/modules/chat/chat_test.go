package chat

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"math/rand/v2"
	"slices"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/riverqueue/river"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/config"
	"jobvacancy.uz/backend/internal/modules/company"
	"jobvacancy.uz/backend/internal/modules/file"
	"jobvacancy.uz/backend/internal/modules/notification"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/platform/storage"
	"jobvacancy.uz/backend/internal/realtime"
	"jobvacancy.uz/backend/internal/testutil/pgtest"
)

// fakeJobs records delivery jobs enqueued inside transactions.
type fakeJobs struct {
	mu   sync.Mutex
	jobs []notification.DeliverArgs
}

func (f *fakeJobs) InsertManyTx(_ context.Context, _ pgx.Tx, args []river.JobArgs) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, a := range args {
		f.jobs = append(f.jobs, a.(notification.DeliverArgs))
	}
	return nil
}

func (f *fakeJobs) take() []notification.DeliverArgs {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := f.jobs
	f.jobs = nil
	return out
}

type chatFixture struct {
	t        *testing.T
	pool     *pgxpool.Pool // plain pool for setup and checks
	svc      *Service
	counter  *pgtest.Counter
	jobs     *fakeJobs
	mr       *miniredis.Miniredis
	seeker   reqctx.Principal
	members  []reqctx.Principal
	company  uuid.UUID
	category int32
	region   int32
	resume   uuid.UUID
	tag      string
}

func newChatFixture(t *testing.T) *chatFixture {
	t.Helper()
	pool := pgtest.Pool(t)
	cpool, counter := pgtest.CountingPool(t)
	ctx := context.Background()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	f := &chatFixture{t: t, pool: pool, counter: counter, jobs: &fakeJobs{}, tag: fmt.Sprintf("%08x", rand.Uint32())}
	f.mr = miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: f.mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	must(t, pool.QueryRow(ctx, `SELECT id FROM categories WHERE parent_id IS NOT NULL ORDER BY id LIMIT 1`).Scan(&f.category))
	must(t, pool.QueryRow(ctx, `SELECT id FROM regions WHERE parent_id IS NULL ORDER BY id LIMIT 1`).Scan(&f.region))
	f.seeker = reqctx.Principal{UserID: f.user("seeker", "seeker"), Role: "seeker"}
	owner := f.user("owner", "employer")
	f.members = []reqctx.Principal{{UserID: owner, Role: "employer"}, {UserID: f.user("hr", "employer"), Role: "employer"}}
	must(t, pool.QueryRow(ctx, `INSERT INTO companies (owner_id, name, slug) VALUES ($1, $2, $2) RETURNING id`,
		owner, "chat-co-"+f.tag).Scan(&f.company))
	for i, m := range f.members {
		role := "owner"
		if i > 0 {
			role = "recruiter"
		}
		f.exec(`INSERT INTO company_members (company_id, user_id, role) VALUES ($1, $2, $3)`, f.company, m.UserID, role)
	}
	must(t, pool.QueryRow(ctx, `INSERT INTO resumes (user_id, title) VALUES ($1, 'Dev') RETURNING id`, f.seeker.UserID).Scan(&f.resume))

	st, err := storage.New(config.S3{Endpoint: "127.0.0.1:9", PublicEndpoint: "127.0.0.1:9", AccessKey: "k",
		SecretKey: "secret-key", Region: "us-east-1", PublicBucket: "pub", PrivateBucket: "priv"})
	must(t, err)
	q := gen.New(cpool)
	pub := &realtime.Publisher{RDB: rdb}
	hub := realtime.NewHub(ctx, rdb, log)
	t.Cleanup(func() { _ = hub.Close() })
	f.svc = &Service{
		Pool: cpool, Q: q, Companies: &company.Service{Pool: cpool, Q: q},
		Files: &file.Service{Q: q, Storage: st, Log: log}, Publisher: pub, Hub: hub,
		Notify: &notification.Service{Pool: cpool, Q: q, Publisher: pub, Jobs: f.jobs, Log: log},
		RDB:    rdb, Log: log,
	}
	return f
}

func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

func (f *chatFixture) exec(sql string, args ...any) {
	f.t.Helper()
	if _, err := f.pool.Exec(context.Background(), sql, args...); err != nil {
		f.t.Fatal(err)
	}
}

func (f *chatFixture) user(name, role string) uuid.UUID {
	f.t.Helper()
	var id uuid.UUID
	must(f.t, f.pool.QueryRow(context.Background(), `INSERT INTO users (email, full_name, role, email_verified_at)
		VALUES ($1, $2, $3, now()) RETURNING id`, name+"-"+f.tag+"-"+uuid.NewString()[:6]+"@test.local", name, role).Scan(&id))
	return id
}

// conversation creates a published vacancy, an application and its conversation.
func (f *chatFixture) conversation() uuid.UUID {
	f.t.Helper()
	ctx := context.Background()
	var vacancyID, appID, convID uuid.UUID
	must(f.t, f.pool.QueryRow(ctx, `INSERT INTO vacancies (company_id, created_by, title, slug, description,
		category_id, region_id, employment_type, work_format, experience, schedule, status, published_at)
		VALUES ($1, $2, 'Chat job', $3, 'D', $4, $5, 'full_time', 'office', 'none', 'full_day', 'published', now())
		RETURNING id`, f.company, f.members[0].UserID, "chat-"+uuid.NewString(), f.category, f.region).Scan(&vacancyID))
	must(f.t, f.pool.QueryRow(ctx, `INSERT INTO applications (vacancy_id, company_id, seeker_id, resume_id, source, status)
		VALUES ($1, $2, $3, $4, 'apply', 'sent') RETURNING id`, vacancyID, f.company, f.seeker.UserID, f.resume).Scan(&appID))
	must(f.t, f.pool.QueryRow(ctx, `INSERT INTO conversations (application_id, company_id, seeker_id, vacancy_id)
		VALUES ($1, $2, $3, $4) RETURNING id`, appID, f.company, f.seeker.UserID, vacancyID).Scan(&convID))
	return convID
}

func (f *chatFixture) send(p reqctx.Principal, conv uuid.UUID, body string) Message {
	f.t.Helper()
	m, err := f.svc.Send(context.Background(), p, conv, SendInput{ClientID: uuid.New(), Kind: "text", Body: body})
	must(f.t, err)
	return m
}

// unread reads conversation_reads.unread_count (0 when there's no row).
func (f *chatFixture) unread(conv uuid.UUID, user uuid.UUID) int {
	f.t.Helper()
	var n int
	err := f.pool.QueryRow(context.Background(), `SELECT unread_count FROM conversation_reads
		WHERE conversation_id = $1 AND user_id = $2`, conv, user).Scan(&n)
	if err == pgx.ErrNoRows {
		return 0
	}
	must(f.t, err)
	return n
}

// TZ BE-04 ✅: one page of 30 conversations costs ≤ 4 SQL round trips, whatever the
// page size (no per-row participants or unread queries). Also: keyset pages cover every
// conversation exactly once, in activity order, for both sides.
func TestListPageQueryCount(t *testing.T) {
	f := newChatFixture(t)
	ctx := context.Background()
	const n = 35
	var convs []uuid.UUID
	for i := range n {
		c := f.conversation()
		convs = append(convs, c)
		if i%3 == 0 { // some with a location, most with text, a few without messages
			_, err := f.svc.Send(ctx, f.members[1], c, SendInput{ClientID: uuid.New(), Kind: "location",
				Location: &Location{Lat: 41.3, Lng: 69.2, Name: "Office"}})
			must(t, err)
		} else if i%7 != 1 {
			f.send(f.seeker, c, "salom "+strconv.Itoa(i))
		}
	}
	f.svc.lru().Purge() // cold participants cache

	for _, who := range []struct {
		name string
		p    reqctx.Principal
	}{{"seeker (cold cache)", f.seeker}, {"seeker (warm cache)", f.seeker}, {"company member", f.members[1]}} {
		f.counter.Reset()
		page, next, err := f.svc.List(ctx, who.p, nil, 30)
		must(t, err)
		trips := f.counter.N()
		t.Logf("%s: 30 conversations in %d round trips (+%d first-use prepares)\n%s", who.name, trips, f.counter.Prepares(), f.counter)
		if len(page) != 30 || next == nil {
			t.Fatalf("%s: %d conversations, next=%v", who.name, len(page), next)
		}
		if trips > 4 {
			t.Fatalf("%s: %d round trips for one page, want ≤ 4", who.name, trips)
		}
		withLast := 0
		for _, c := range page {
			if c.LastMessage != nil {
				withLast++
				if c.LastMessage.Sender == nil {
					t.Fatalf("last message without sender: %+v", c.LastMessage)
				}
			}
		}
		if withLast < 20 {
			t.Fatalf("%s: only %d conversations carry their last message", who.name, withLast)
		}
	}

	// Walk all pages of 8: every conversation once, newest activity first.
	for _, p := range []reqctx.Principal{f.seeker, f.members[0]} {
		var seen []uuid.UUID
		var after *ListCursor
		var prev *Conversation
		for {
			page, next, err := f.svc.List(ctx, p, after, 8)
			must(t, err)
			for i := range page {
				c := page[i]
				if prev != nil && sortAt(c).After(sortAt(*prev)) {
					t.Fatalf("out of order: %v after %v", sortAt(c), sortAt(*prev))
				}
				prev = &c
				seen = append(seen, c.ID)
			}
			if next == nil {
				break
			}
			after = next
		}
		for _, c := range convs {
			if !slices.Contains(seen, c) {
				t.Fatalf("conversation %s missing from the walk (%d seen)", c, len(seen))
			}
		}
		if len(seen) != len(convs) {
			t.Fatalf("walk returned %d conversations, want %d", len(seen), len(convs))
		}
	}
}

func sortAt(c Conversation) time.Time {
	if c.LastMessageAt != nil {
		return *c.LastMessageAt
	}
	return c.CreatedAt
}

// conversation_reads.unread_count: +1 per message from others, recount on read (0 when
// read to the newest), −1 when an unread message is deleted, and history counted for a
// participant who never opened the conversation. The header badge counts conversations
// with something unread and ignores companies the user left.
func TestUnreadCounters(t *testing.T) {
	f := newChatFixture(t)
	ctx := context.Background()
	conv := f.conversation()
	m1 := f.send(f.seeker, conv, "one")
	f.send(f.seeker, conv, "two")
	m3 := f.send(f.seeker, conv, "three")
	for _, m := range f.members {
		if got := f.unread(conv, m.UserID); got != 3 {
			t.Fatalf("member unread after 3 messages: %d", got)
		}
	}
	if got := f.unread(conv, f.seeker.UserID); got != 0 {
		t.Fatalf("sender's own unread: %d", got)
	}
	badge := func(p reqctx.Principal) int64 {
		n, err := f.svc.UnreadCount(ctx, p)
		must(t, err)
		return n
	}
	if badge(f.members[0]) < 1 {
		t.Fatal("badge doesn't count the conversation")
	}

	// Partial read recounts what's left; reading to the newest makes it 0.
	must(t, f.svc.MarkRead(ctx, f.members[0], conv, m1.ID))
	if got := f.unread(conv, f.members[0].UserID); got != 2 {
		t.Fatalf("after reading the first message: %d, want 2", got)
	}
	must(t, f.svc.MarkRead(ctx, f.members[0], conv, m3.ID))
	if got := f.unread(conv, f.members[0].UserID); got != 0 {
		t.Fatalf("after reading all: %d", got)
	}
	must(t, f.svc.MarkRead(ctx, f.members[0], conv, m1.ID)) // going back doesn't count again
	if got := f.unread(conv, f.members[0].UserID); got != 0 {
		t.Fatalf("after a stale read: %d", got)
	}
	if got := f.unread(conv, f.members[1].UserID); got != 3 {
		t.Fatalf("the other member is untouched: %d", got)
	}

	// Deleting an unread message takes it off.
	must(t, f.svc.Delete(ctx, f.seeker, m3.ID))
	if got := f.unread(conv, f.members[1].UserID); got != 2 {
		t.Fatalf("after delete: %d, want 2", got)
	}

	// A reply: the seeker has 1 unread, the replier's position moved to its message.
	reply := f.send(f.members[1], conv, "javob")
	if got := f.unread(conv, f.seeker.UserID); got != 1 {
		t.Fatalf("seeker after a reply: %d", got)
	}
	if got := f.unread(conv, f.members[1].UserID); got != 0 {
		t.Fatalf("replier after replying: %d", got)
	}
	list, _, err := f.svc.List(ctx, f.seeker, nil, 10)
	must(t, err)
	if len(list) != 1 || list[0].Unread != 1 || list[0].LastMessage == nil || list[0].LastMessage.ID != reply.ID {
		t.Fatalf("seeker list: %+v", list)
	}
	if list[0].ReadUpTo != reply.ID { // the company side read up to its own reply
		t.Fatalf("read_up_to %d, want %d", list[0].ReadUpTo, reply.ID)
	}

	// A member who joins later gets their row with the history from others counted.
	late := reqctx.Principal{UserID: f.user("late", "employer"), Role: "employer"}
	f.exec(`INSERT INTO company_members (company_id, user_id, role) VALUES ($1, $2, 'recruiter')`, f.company, late.UserID)
	f.svc.lru().Purge()
	f.send(f.seeker, conv, "four")
	// one, two (three was deleted), javob, four
	if got := f.unread(conv, late.UserID); got != 4 {
		t.Fatalf("late member's first count: %d, want 4", got)
	}
	if badge(late) != 1 {
		t.Fatalf("late member badge: %d", badge(late))
	}
	f.exec(`DELETE FROM company_members WHERE company_id = $1 AND user_id = $2`, f.company, late.UserID)
	if badge(late) != 0 {
		t.Fatalf("badge after leaving the company: %d", badge(late))
	}
}

// TZ BE-08: the "new message" push is queued in the message's transaction, only for
// participants without a live connection and only for channels they have; one push per
// conversation per 10 minutes.
func TestSendNotifiesOfflineParticipants(t *testing.T) {
	f := newChatFixture(t)
	ctx := context.Background()
	conv := f.conversation()
	online, offline := f.members[0], f.members[1]
	f.exec(`UPDATE users SET telegram_chat_id = $2, notify_telegram = true WHERE id = $1`, offline.UserID, rand.Int64N(1e12)+1)
	f.exec(`UPDATE users SET telegram_chat_id = $2, notify_telegram = true WHERE id = $1`, online.UserID, rand.Int64N(1e12)+1)
	// online has a fresh presence entry
	_, err := f.mr.ZAdd("presence:"+online.UserID.String(), float64(time.Now().Add(time.Minute).Unix()), "conn-1")
	must(t, err)

	f.send(f.seeker, conv, "salom")
	jobs := f.jobs.take()
	if len(jobs) != 1 || jobs[0].UserID != offline.UserID || jobs[0].Channel != notification.ChannelTelegram ||
		jobs[0].Type != notification.TypeMessageNew || jobs[0].Payload.Preview != "salom" {
		t.Fatalf("jobs: %+v", jobs)
	}
	f.send(f.seeker, conv, "yana") // throttled for 10 minutes
	if jobs := f.jobs.take(); len(jobs) != 0 {
		t.Fatalf("second message within 10 min queued %d jobs", len(jobs))
	}
	// Everyone offline now (presence and throttles gone): a message from the owner reaches
	// the other member (Telegram) but not the seeker, who has no channel at all.
	f.mr.FlushAll()
	in := SendInput{ClientID: uuid.New(), Kind: "text", Body: "bir marta"}
	_, err = f.svc.Send(ctx, online, conv, in)
	must(t, err)
	if jobs := f.jobs.take(); len(jobs) != 1 || jobs[0].UserID != offline.UserID {
		t.Fatalf("jobs: %+v", jobs)
	}
	// A retried send (same client_id) queues nothing.
	f.mr.FlushAll()
	_, err = f.svc.Send(ctx, online, conv, in)
	must(t, err)
	if again := f.jobs.take(); len(again) != 0 {
		t.Fatalf("retried send queued %d jobs", len(again))
	}
	// …and gives the throttle back, so the next real message can still push.
	if f.mr.Exists(throttleKey(conv, offline.UserID)) {
		t.Fatal("throttle kept after a retried send")
	}
}
