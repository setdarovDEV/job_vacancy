package auth

import (
	"context"
	"crypto/rand"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/hash"
	"jobvacancy.uz/backend/internal/testutil/pgtest"
)

// TZ BE-12: ChangePassword sets the password and revokes every other session with one
// statement, then cuts their access tokens off with one pipelined Redis call.
func TestChangePasswordRevokesOthersInOneStatement(t *testing.T) {
	pgtest.Pool(t)
	pool, counter := pgtest.CountingPool(t)
	ctx := context.Background()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	svc := &Service{Q: gen.New(pool), Revoked: NewRevocationStore(rdb, 15*time.Minute)}

	old, err := hash.Password("old-Secret123")
	if err != nil {
		t.Fatal(err)
	}
	var uid uuid.UUID
	if err := pool.QueryRow(ctx, `INSERT INTO users (email, full_name, role, password_hash)
		VALUES ($1, 'P', 'seeker', $2) RETURNING id`, "pw-"+uuid.NewString()[:12]+"@test.local", old).Scan(&uid); err != nil {
		t.Fatal(err)
	}
	sessions := make([]uuid.UUID, 4)
	for i := range sessions {
		h := make([]byte, 32)
		_, _ = rand.Read(h)
		if err := pool.QueryRow(ctx, `INSERT INTO user_sessions (user_id, refresh_hash, expires_at)
			VALUES ($1, $2, now() + interval '1 day') RETURNING id`, uid, h).Scan(&sessions[i]); err != nil {
			t.Fatal(err)
		}
	}
	keep := sessions[0]

	counter.Reset()
	if err := svc.ChangePassword(ctx, uid, keep, "wrong", "new-Secret456"); err != ErrWrongPassword {
		t.Fatalf("wrong current password: %v", err)
	}
	counter.Reset()
	if err := svc.ChangePassword(ctx, uid, keep, "old-Secret123", "new-Secret456"); err != nil {
		t.Fatal(err)
	}
	t.Logf("change password: %d Postgres round trips\n%s", counter.N(), counter)
	if counter.N() != 2 { // read the user, one UPDATE for password + sessions
		t.Fatalf("%d round trips, want 2", counter.N())
	}
	for i, s := range sessions {
		var revoked bool
		if err := pool.QueryRow(ctx, `SELECT revoked_at IS NOT NULL FROM user_sessions WHERE id = $1`, s).Scan(&revoked); err != nil {
			t.Fatal(err)
		}
		marked := mr.Exists("sess:revoked:" + s.String())
		if (i == 0) == revoked || (i == 0) == marked {
			t.Fatalf("session %d: revoked=%v redis=%v", i, revoked, marked)
		}
	}
	var h string
	if err := pool.QueryRow(ctx, `SELECT password_hash FROM users WHERE id = $1`, uid).Scan(&h); err != nil {
		t.Fatal(err)
	}
	if ok, _ := hash.VerifyPassword("new-Secret456", h); !ok {
		t.Fatal("new password doesn't verify")
	}
}
