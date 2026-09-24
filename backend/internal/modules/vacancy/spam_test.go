package vacancy

import (
	"testing"

	"jobvacancy.uz/backend/internal/pkg/translit"
)

// TZ SEC-07: spam queries never reach the public popular list, however often they run.
func TestSpamQuery(t *testing.T) {
	spam := []string{
		"t.me/cheap_jobs", "https://example.com", "www.work.uz", "ishlar.com", "pul @admin",
		"+998 90 123 45 67", "998901234567", "karta 8600 1234",
		"онлайн казино", "kazino bonus", "1xbet", "porno", "секс работа", "escort girls",
		"наркотики", "закладки", "xuy", "пиздец", "блядь", "сука", "fuck you",
		"aaaaaa", "ish!!!!", "ish 🔥", "<script>", "a b c d e f g",
		"jobjobjobjobjobjobjobjobjobjob",
	}
	for _, q := range spam {
		if !spamQuery(q) {
			t.Errorf("spam not caught: %q", q)
		}
	}
	legit := []string{
		"dasturchi", "дастурчи", "frontend react", "c#", "c++ developer", ".net", "node.js",
		"socket.io", "1c buxgalter", "oʻqituvchi", "o'qituvchi", "бош ҳисобчи",
		"менеджер по продажам", "haydovchi b toifa", "sotuvchi-kassir", "ставка 0.5",
		"вулканизатор", "sekretar", "amaliyotchi", "kassir", "mobile remote",
		"yuk tashuvchi 24/7", "r&d engineer",
	}
	for _, q := range legit {
		if spamQuery(q) {
			t.Errorf("legit query treated as spam: %q", q)
		}
	}
}

func TestHiddenBy(t *testing.T) {
	terms := []string{translit.Fold("казино"), translit.Fold("Black Jack")}
	for q, want := range map[string]bool{
		"kazino":            true,
		"онлайн казино":     true,
		"kazinochi":         false, // whole words only
		"black jack dealer": true,
		"black":             false,
		"dasturchi":         false,
	} {
		if got := hiddenBy(translit.Fold(q), terms); got != want {
			t.Errorf("hiddenBy(%q) = %v, want %v", q, got, want)
		}
	}
}

func TestNormalizeQuery(t *testing.T) {
	for in, want := range map[string]string{
		"  Dasturchi   Toshkent ": "dasturchi toshkent",
		"a":                       "",
		"":                        "",
	} {
		if got := normalizeQuery(in); got != want {
			t.Errorf("normalizeQuery(%q) = %q, want %q", in, got, want)
		}
	}
	long := ""
	for range 61 {
		long += "x"
	}
	if normalizeQuery(long) != "" {
		t.Error("over-long query kept")
	}
}
