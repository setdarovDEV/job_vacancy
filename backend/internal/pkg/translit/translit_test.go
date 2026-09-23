package translit

import "testing"

func TestFold(t *testing.T) {
	cases := map[string]string{
		"Дастурчи":                   "dasturchi",
		"Dasturchi":                  "dasturchi",
		"O'qituvchi, oʻqituvchi":     "oqituvchi oqituvchi",
		"Ўқитувчи":                   "oqituvchi",
		"Программист 1С":             "programmist 1s",
		"Бухгалтер / Buxgalter":      "buxgalter buxgalter",
		"C++ va C# (senior)":         "cplusplus va csharp senior",
		"  Ҳамшира—ҳамшира!  ":       "hamshira hamshira",
		"Toshkent shahri, Chilonzor": "toshkent shahri chilonzor",
	}
	for in, want := range cases {
		if got := Fold(in); got != want {
			t.Errorf("Fold(%q) = %q, want %q", in, got, want)
		}
	}
}
