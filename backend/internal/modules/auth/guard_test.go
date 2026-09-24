package auth

import (
	"context"
	"errors"
	"net/netip"
	"strings"
	"sync"
	"testing"
	"time"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/hash"
	"jobvacancy.uz/backend/internal/pkg/otp"
	"jobvacancy.uz/backend/internal/pkg/token"
	"jobvacancy.uz/backend/internal/testutil/fixture"
)

// fakeCaptcha accepts the token "solved".
type fakeCaptcha struct{}

func (fakeCaptcha) Verify(_ context.Context, tok string, _ netip.Addr) (bool, error) {
	return tok == "solved", nil
}

// recordSleep replaces the guard's sleep and records the delays asked for.
type recordSleep struct {
	mu     sync.Mutex
	delays []time.Duration
}

func (r *recordSleep) sleep(_ context.Context, d time.Duration) error {
	r.mu.Lock()
	r.delays = append(r.delays, d)
	r.mu.Unlock()
	return nil
}

func (r *recordSleep) last() time.Duration {
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.delays) == 0 {
		return 0
	}
	return r.delays[len(r.delays)-1]
}

var (
	ipA = netip.MustParseAddr("198.51.100.10") // attacker
	ipB = netip.MustParseAddr("203.0.113.20")  // the owner, elsewhere
)

func TestLoginGuardDelays(t *testing.T) {
	_, rdb := fixture.Redis(t)
	g := NewLoginGuard(rdb, nil, fixture.New(t).Log)
	ctx := context.Background()
	want := []time.Duration{0, 0, 0, 500 * time.Millisecond, time.Second, 2 * time.Second, 4 * time.Second, 4 * time.Second}
	for i, w := range want {
		if d := g.Delay(g.State(ctx, ipA, "victim@x.uz")); d != w {
			t.Fatalf("after %d failures: delay %v, want %v", i, d, w)
		}
		g.Failed(ctx, ipA, "victim@x.uz")
	}
	// From another address the pair counter is fresh, and without a captcha the e-mail's
	// 8 failures cost the owner 4 s at most, never a lock.
	if d := g.Delay(g.State(ctx, ipB, "victim@x.uz")); d > g.MaxDelay || d == 0 {
		t.Fatalf("owner elsewhere: delay %v, want (0, %v]", d, g.MaxDelay)
	}
	// With a captcha configured the same counters ask for it instead.
	g.Captcha = fakeCaptcha{}
	if st := g.State(ctx, ipB, "victim@x.uz"); !g.NeedsCaptcha(st) || g.Delay(st) != 0 {
		t.Fatalf("captcha on: needs=%v delay=%v", g.NeedsCaptcha(st), g.Delay(st))
	}
	if st := g.State(ctx, ipB, "someone-else@x.uz"); g.NeedsCaptcha(st) {
		t.Fatal("another e-mail from a clean IP must not need a captcha")
	}
}

func newGuardedService(t *testing.T, captcha CaptchaVerifier) (*Service, *fixture.World, *recordSleep) {
	w := fixture.New(t)
	_, rdb := fixture.Redis(t)
	rec := &recordSleep{}
	g := NewLoginGuard(rdb, captcha, w.Log)
	g.sleep = rec.sleep
	svc := &Service{Q: w.Q, Tokens: token.NewManager(strings.Repeat("s", 40), "t", time.Minute),
		OTP: otp.NewStore(rdb, strings.Repeat("o", 40)), Revoked: NewRevocationStore(rdb, time.Minute),
		Emails: noMail{}, Guard: g, RefreshTTL: time.Hour, ConsentVersion: "2026-09-24", Log: w.Log}
	return svc, w, rec
}

func userWithPassword(t *testing.T, w *fixture.World, pw string) string {
	u := w.User(gen.UserRoleSeeker, true)
	h, err := hash.Password(pw)
	w.Must(err)
	w.Exec(`UPDATE users SET password_hash = $2 WHERE id = $1`, u.ID, h)
	return *u.Email
}

// TZ SEC-04 ✅ "Email bo'yicha lock boshqa odamni bloklab qo'ya olmaydi": an attacker who
// fails 30 times on someone's e-mail doesn't lock the owner out. Without a captcha the
// owner signing in from their own address waits at most MaxDelay; with Turnstile they
// solve it and get in. The attacker's own attempts are slowed and captcha-gated.
func TestLoginGuardNeverLocksTheOwner(t *testing.T) {
	ctx := context.Background()
	for _, withCaptcha := range []bool{false, true} {
		var captcha CaptchaVerifier
		if withCaptcha {
			captcha = fakeCaptcha{}
		}
		svc, w, rec := newGuardedService(t, captcha)
		victim := userWithPassword(t, w, "Right-Pass1")
		attacker := ClientMeta{IP: ipA}
		for i := 0; i < 30; i++ {
			tok := ""
			if withCaptcha {
				tok = "solved" // even a human-solving attacker only gets delays, never a lock
			}
			if _, err := svc.LoginWithCaptcha(ctx, victim, "guess", tok, attacker); !errors.Is(err, ErrInvalidCredentials) {
				t.Fatalf("captcha=%v attempt %d: %v", withCaptcha, i, err)
			}
		}
		if withCaptcha {
			if _, err := svc.Login(ctx, victim, "guess", attacker); !errors.Is(err, ErrCaptchaRequired) {
				t.Fatalf("attacker without captcha: %v", err)
			}
			if _, err := svc.LoginWithCaptcha(ctx, victim, "guess", "forged", attacker); !errors.Is(err, ErrCaptchaInvalid) {
				t.Fatalf("attacker with a bad token: %v", err)
			}
		} else if d := rec.last(); d != 4*time.Second {
			t.Fatalf("attacker's last attempt waited %v, want the 4s cap", d)
		}

		owner := ClientMeta{IP: ipB}
		rec.delays = nil
		if withCaptcha {
			if _, err := svc.Login(ctx, victim, "Right-Pass1", owner); !errors.Is(err, ErrCaptchaRequired) {
				t.Fatalf("owner, captcha on, no token: %v", err)
			}
			if _, err := svc.LoginWithCaptcha(ctx, victim, "Right-Pass1", "solved", owner); err != nil {
				t.Fatalf("owner with a solved captcha is locked out: %v", err)
			}
			if len(rec.delays) != 0 {
				t.Fatalf("a solved captcha still waited %v", rec.delays)
			}
		} else {
			if _, err := svc.Login(ctx, victim, "Right-Pass1", owner); err != nil {
				t.Fatalf("owner is locked out: %v", err)
			}
			if d := rec.last(); d > 4*time.Second {
				t.Fatalf("owner waited %v", d)
			}
		}
		// Success clears the e-mail's failures: the next sign-in is instant and captcha-free.
		rec.delays = nil
		if _, err := svc.Login(ctx, victim, "Right-Pass1", owner); err != nil || len(rec.delays) != 0 {
			t.Fatalf("after success: err=%v delays=%v", err, rec.delays)
		}
	}
}
