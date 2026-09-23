package token

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestIssueParse(t *testing.T) {
	m := NewManager("0123456789abcdef0123456789abcdef", "test", time.Minute)
	uid, sid := uuid.New(), uuid.New()
	raw, _, err := m.Issue(uid, sid, "seeker", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	c, err := m.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	if c.UserID != uid || c.SessionID != sid || c.Role != "seeker" {
		t.Fatalf("claims mismatch: %+v", c)
	}

	expired, _, _ := m.Issue(uid, sid, "seeker", time.Now().Add(-time.Hour))
	if _, err := m.Parse(expired); err == nil {
		t.Fatal("expired token accepted")
	}
	other := NewManager("ffffffffffffffffffffffffffffffff", "test", time.Minute)
	if _, err := other.Parse(raw); err == nil {
		t.Fatal("token signed with another key accepted")
	}
}
