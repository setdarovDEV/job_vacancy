package searchq

import "testing"

func TestParse(t *testing.T) {
	cases := map[string]string{
		"Dasturchilar":             "dasturch:*",
		"дастурчи":                 "dasturch:*",
		"программиста 1С":          "programmist:* & 1s",
		"Go dasturchi va Toshkent": "go & dasturch:* & toshkent:*",
		"Savdo menejeri":           "savd:* & menejer:*",
		"o'qituvchilarni":          "oqituvch:*",
		"  !!!  ":                  "",
		"React React react":        "react:*",
		"Менеджер по продажам":     "menedjer:* & prodajam:*",
	}
	for in, want := range cases {
		if got := Parse(in).TSQuery; got != want {
			t.Errorf("Parse(%q) = %q, want %q", in, got, want)
		}
	}
}
