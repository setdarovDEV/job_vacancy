package hash

import "testing"

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
