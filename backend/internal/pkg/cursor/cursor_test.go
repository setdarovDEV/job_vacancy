package cursor

import (
	"testing"

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
