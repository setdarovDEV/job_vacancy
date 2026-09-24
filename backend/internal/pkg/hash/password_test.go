package hash

import (
	"context"
	"errors"
	"testing"
	gotime "time"
)

func TestPasswordRoundTrip(t *testing.T) {
	h, err := Password("s3cret-Pa55")
	if err != nil {
		t.Fatal(err)
	}
	ok, err := VerifyPassword("s3cret-Pa55", h)
	if err != nil || !ok {
		t.Fatalf("expected match, got ok=%v err=%v", ok, err)
	}
	ok, _ = VerifyPassword("wrong", h)
	if ok {
		t.Fatal("wrong password matched")
	}
	if _, err := VerifyPassword("x", "$bcrypt$nope"); err == nil {
		t.Fatal("expected malformed error")
	}
}

// TZ BE-12: at most Slots() hashes run at once; a hash waiting past its deadline gives up
// instead of queueing forever.
func TestHashingIsBounded(t *testing.T) {
	var held []func()
	for range Slots() {
		release, err := acquire(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		held = append(held, release)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*gotime.Millisecond)
	defer cancel()
	if _, err := PasswordCtx(ctx, "x"); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("with every slot taken: %v, want deadline exceeded", err)
	}
	if _, err := VerifyPasswordCtx(ctx, "x", "$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g"); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("verify with every slot taken: %v", err)
	}
	held[0]()
	if _, err := PasswordCtx(context.Background(), "x"); err != nil {
		t.Fatalf("after a slot freed: %v", err)
	}
	for _, r := range held[1:] {
		r()
	}
	if Slots() < 2 {
		t.Fatalf("slots = %d", Slots())
	}
}
