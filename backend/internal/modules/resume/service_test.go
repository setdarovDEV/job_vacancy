package resume

import "testing"

func TestTotalMonths(t *testing.T) {
	cases := []struct {
		spans [][2]int
		want  int32
	}{
		{nil, 0},
		{[][2]int{{0, 11}}, 12},                   // one year
		{[][2]int{{0, 11}, {6, 17}}, 18},          // overlap counted once
		{[][2]int{{12, 23}, {0, 5}}, 18},          // unsorted, gap between
		{[][2]int{{0, 5}, {6, 11}}, 12},           // adjacent spans merge
		{[][2]int{{0, 23}, {3, 5}, {30, 30}}, 25}, // nested + single month
	}
	for _, c := range cases {
		if got := totalMonths(c.spans); got != c.want {
			t.Errorf("totalMonths(%v) = %d, want %d", c.spans, got, c.want)
		}
	}
}
