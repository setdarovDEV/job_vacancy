package imgurl

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestURLs(t *testing.T) {
	id := uuid.MustParse("01925f1c-7a2b-7c3d-8e4f-0123456789ab")
	key := Key(Avatar, id, time.Date(2026, 9, 24, 10, 0, 0, 0, time.UTC), 256)
	if key != "img/avatar/2026/09/01925f1c-7a2b-7c3d-8e4f-0123456789ab/256.webp" {
		t.Fatal(key)
	}
	u := "https://jobvacancy.uz/media/" + key
	got := URLs(&u)
	want := map[string]string{
		"64":  "https://jobvacancy.uz/media/img/avatar/2026/09/01925f1c-7a2b-7c3d-8e4f-0123456789ab/64.webp",
		"128": "https://jobvacancy.uz/media/img/avatar/2026/09/01925f1c-7a2b-7c3d-8e4f-0123456789ab/128.webp",
		"256": u,
	}
	if len(got) != 3 || got["64"] != want["64"] || got["128"] != want["128"] || got["256"] != want["256"] {
		t.Fatalf("got %v", got)
	}
	v, ok := Parse(key)
	if !ok || v.FileID != id || v.Target != Avatar || v.Size != 256 || len(v.All()) != 3 {
		t.Fatalf("parse key: %+v %v", v, ok)
	}
	if vu, _ := Parse(u); vu.Keys()[0] != "img/avatar/2026/09/01925f1c-7a2b-7c3d-8e4f-0123456789ab/64.webp" || vu.Keys()[2] != key {
		t.Fatalf("keys from URL: %v", vu.Keys())
	}
	cover := "http://localhost:9200/jv-public/img/cover/2026/09/01925f1c-7a2b-7c3d-8e4f-0123456789ab/1280.webp"
	if c := URLs(&cover); len(c) != 2 || c["640"] == "" {
		t.Fatalf("cover: %v", c)
	}
	for _, s := range []string{"https://lh3.googleusercontent.com/a/xyz=s96-c",
		"http://localhost:9200/jv-public/avatar/2026/09/abc.jpg", ""} {
		if URLs(&s) != nil {
			t.Errorf("%q should have no variants", s)
		}
	}
	if URLs(nil) != nil {
		t.Error("nil")
	}
}
