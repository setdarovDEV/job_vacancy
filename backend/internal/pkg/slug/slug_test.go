package slug

import "testing"

func TestMake(t *testing.T) {
	cases := map[string]string{
		"Backend dasturchi (Go)":     "backend-dasturchi-go",
		"O'qituvchi":                 "oqituvchi",
		"Oʻqituvchi  —  ingliz tili": "oqituvchi-ingliz-tili",
		"Бош ҳисобчи":                "bosh-hisobchi",
		"Менеджер по продажам":       "menedjer-po-prodajam",
		"Ўқитувчи ғалаба":            "oqituvchi-galaba",
		"C++ / C# developer":         "cplusplus-csharp-developer",
		"  --Hello, World!--  ":      "hello-world",
		"日本語":                        "",
		"Yangi   yil  2026":          "yangi-yil-2026",
	}
	for in, want := range cases {
		if got := Make(in); got != want {
			t.Errorf("Make(%q) = %q, want %q", in, got, want)
		}
	}
}
