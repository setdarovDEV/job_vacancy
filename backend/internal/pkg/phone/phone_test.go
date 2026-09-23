package phone

import "testing"

func TestNormalize(t *testing.T) {
	ok := map[string]string{
		"+998 90 123-45-67": "+998901234567",
		"998901234567":      "+998901234567",
		"90 123 45 67":      "+998901234567",
		"00998901234567":    "+998901234567",
		"+7 (916) 123-4567": "+79161234567",
	}
	for in, want := range ok {
		got, err := Normalize(in)
		if err != nil || got != want {
			t.Errorf("Normalize(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, in := range []string{"", "123", "+998 90 123", "0901234567"} {
		if _, err := Normalize(in); err == nil {
			t.Errorf("Normalize(%q) expected error", in)
		}
	}
}
