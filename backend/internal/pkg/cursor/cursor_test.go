package cursor

import (
	"net/url"
	"testing"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/internal/pkg/apperr"
)

func TestParseLimit(t *testing.T) {
	cases := []struct {
		raw     string
		want    int
		wantMsg string
	}{
		{"", 20, ""}, {"1", 1, ""}, {"50", 50, ""},
		{"0", 0, "min=1"}, {"-3", 0, "min=1"}, {"51", 0, "max=50"}, {"x", 0, "integer"}, {"2.5", 0, "integer"},
	}
	for _, c := range cases {
		n, err := ParseLimit(c.raw, 20, 50)
		if c.wantMsg == "" {
			if err != nil || n != c.want {
				t.Errorf("%q: %d %v", c.raw, n, err)
			}
			continue
		}
		e, ok := apperr.As(err)
		if !ok || e.Fields["limit"] != c.wantMsg {
			t.Errorf("%q: got %v, want limit=%s", c.raw, err, c.wantMsg)
		}
	}
}

func TestParseAdminPage(t *testing.T) {
	c := Encode(TimeID{ID: uuid.New()})
	cases := []struct {
		query     string
		wantLimit int
		wantAfter bool
		wantErr   bool
	}{
		{"", AdminDefaultLimit, false, false},
		{"limit=5", 5, false, false},
		{"limit=100", 100, false, false},
		{"limit=0", 0, false, true},
		{"limit=101", 0, false, true},
		{"limit=abc", 0, false, true},
		{"cursor=" + c, AdminDefaultLimit, true, false},
		{"cursor=not-a-cursor", 0, false, true},
	}
	for _, tc := range cases {
		q, _ := url.ParseQuery(tc.query)
		after, limit, err := ParseAdminPage(q)
		if (err != nil) != tc.wantErr {
			t.Errorf("%q: err=%v, wantErr=%v", tc.query, err, tc.wantErr)
			continue
		}
		if !tc.wantErr && (limit != tc.wantLimit || (after != nil) != tc.wantAfter) {
			t.Errorf("%q: limit=%d after=%v", tc.query, limit, after)
		}
	}
}
