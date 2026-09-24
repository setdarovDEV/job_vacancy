package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRejectBadURL(t *testing.T) {
	h := RejectBadURL(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }))
	for target, want := range map[string]int{
		"/api/v1/vacancies/a%00b":                  http.StatusBadRequest,
		"/api/v1/catalog/skills?q=%00x":            http.StatusBadRequest,
		"/api/v1/companies?q=%ff%fe":               http.StatusBadRequest,
		"/api/v1/vacancies/%ff":                    http.StatusBadRequest,
		"/api/v1/vacancies?q=%D0%B4%D0%B0%D1%81":   http.StatusNoContent, // "дас"
		"/api/v1/vacancies?q=go+developer&limit=5": http.StatusNoContent,
		"/api/v1/vacancies/senior-go-dasturchi":    http.StatusNoContent,
		"/api/v1/vacancies?q=100%25":               http.StatusNoContent,
	} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, target, nil))
		if rec.Code != want {
			t.Errorf("%s: got %d, want %d", target, rec.Code, want)
		}
	}
}
