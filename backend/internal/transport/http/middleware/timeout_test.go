package middleware

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestTimeoutBudgets(t *testing.T) {
	var deadline time.Time
	var has bool
	h := Timeout(8*time.Second, 25*time.Second)(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		deadline, has = r.Context().Deadline()
	}))
	for _, tc := range []struct {
		path string
		want time.Duration // 0 = no deadline
	}{
		{"/api/v1/vacancies", 8 * time.Second},
		{"/api/v1/ws", 0},
		{"/api/v1/ws/ticket", 8 * time.Second},
		{"/api/v1/resumes/0192/pdf", 25 * time.Second},
		{"/readyz", 8 * time.Second},
	} {
		start := time.Now()
		h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, tc.path, nil))
		if tc.want == 0 {
			if has {
				t.Errorf("%s: unexpected deadline", tc.path)
			}
			continue
		}
		if !has {
			t.Errorf("%s: no deadline", tc.path)
			continue
		}
		if got := deadline.Sub(start); got < tc.want-time.Second || got > tc.want+time.Second {
			t.Errorf("%s: deadline in %v, want ~%v", tc.path, got, tc.want)
		}
	}
}

func listBody() []byte {
	type card struct {
		ID, Title, Company, Region, Salary, Format string
	}
	cards := make([]card, 20)
	for i := range cards {
		cards[i] = card{"0192f7a4-5d7e-7c3b-9a1e-6f2d8c4b3a" + strings.Repeat("0", 2), "Senior Go dasturchi",
			"Najot Ta'lim", "Toshkent shahri", "15 000 000 – 25 000 000 so'm", "hybrid"}
	}
	b, _ := json.Marshal(map[string]any{"data": cards})
	return b
}

func TestCompressShrinksJSON(t *testing.T) {
	body := listBody()
	h := Compress(5)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_, _ = w.Write(body)
	}))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/vacancies", nil)
	req.Header.Set("Accept-Encoding", "gzip, deflate, br")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Header().Get("Content-Encoding") != "gzip" {
		t.Fatalf("Content-Encoding = %q", rec.Header().Get("Content-Encoding"))
	}
	zr, err := gzip.NewReader(rec.Body)
	if err != nil {
		t.Fatal(err)
	}
	plain, _ := io.ReadAll(zr)
	if !bytes.Equal(plain, body) {
		t.Fatal("round trip mismatch")
	}
}

// Cache bytes that are already gzipped must go out as they are.
func TestCompressLeavesPrecompressedBytes(t *testing.T) {
	var gz bytes.Buffer
	zw := gzip.NewWriter(&gz)
	_, _ = zw.Write(listBody())
	_ = zw.Close()
	pre := gz.Bytes()
	h := Compress(5)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Encoding", "gzip")
		_, _ = w.Write(pre)
	}))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/vacancies", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if !bytes.Equal(rec.Body.Bytes(), pre) {
		t.Fatal("pre-compressed body was compressed again")
	}
}

func TestCompressSkipsWebSocketUpgrade(t *testing.T) {
	var wrapped bool
	h := Compress(5)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, wrapped = w.(*httptest.ResponseRecorder)
		wrapped = !wrapped
	}))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/ws", nil)
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Accept-Encoding", "gzip")
	h.ServeHTTP(httptest.NewRecorder(), req)
	if wrapped {
		t.Fatal("websocket upgrade went through the compressor")
	}
}
