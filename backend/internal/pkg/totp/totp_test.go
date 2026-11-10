package totp

import (
	"strings"
	"testing"
	"time"
)

// RFC 6238 appendix B, SHA1, truncated to 6 digits.
func TestRFC6238Vectors(t *testing.T) {
	secret := []byte("12345678901234567890")
	for _, c := range []struct {
		unix int64
		want string
	}{{59, "287082"}, {1111111109, "081804"}, {1111111111, "050471"}, {1234567890, "005924"}, {2000000000, "279037"}} {
		if got := Code(secret, Step(time.Unix(c.unix, 0))); got != c.want {
			t.Errorf("t=%d: got %s want %s", c.unix, got, c.want)
		}
	}
}

func TestVerifySkewAndReplay(t *testing.T) {
	secret := []byte("12345678901234567890")
	now := time.Unix(1111111111, 0)
	prev := Code(secret, Step(now)-1)
	step, ok := Verify(secret, prev, now, 0)
	if !ok || step != Step(now)-1 {
		t.Fatal("previous step should be accepted")
	}
	if _, ok := Verify(secret, prev, now, step); ok {
		t.Fatal("a used step must not verify again")
	}
	if _, ok := Verify(secret, Code(secret, Step(now)-3), now, 0); ok {
		t.Fatal("codes outside the skew window must fail")
	}
	if _, ok := Verify(secret, "12345", now, 0); ok {
		t.Fatal("short codes must fail")
	}
}

func TestEncodeDecodeAndURI(t *testing.T) {
	s, err := NewSecret()
	if err != nil || len(s) != 20 {
		t.Fatal(err)
	}
	back, err := Decode(strings.ToLower(Encode(s)))
	if err != nil || string(back) != string(s) {
		t.Fatal("round trip failed")
	}
	u := URI("Job Vacancy", "admin@demo.uz", s)
	if !strings.HasPrefix(u, "otpauth://totp/Job%20Vacancy:admin@demo.uz?") || !strings.Contains(u, "secret="+Encode(s)) {
		t.Fatal(u)
	}
}
