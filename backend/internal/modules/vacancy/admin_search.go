package vacancy

import (
	"net/http"
	"net/url"
	"strconv"

	"github.com/go-chi/chi/v5"

	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

// Popular-search moderation for platform admins (TZ SEC-07).

var errLimit200 = apperr.Validation(map[string]string{"limit": "max=200"})

// adminPopular lists the week's most searched queries with the numbers and flags that
// decide whether each is public (?limit=1..200, default 50). Never cached.
func (h *Handler) adminPopular(w http.ResponseWriter, r *http.Request) {
	limit := 50
	if s := r.URL.Query().Get("limit"); s != "" {
		n, err := strconv.Atoi(s)
		if err != nil || n < 1 || n > popularPool {
			response.Error(w, r, errLimit200)
			return
		}
		limit = n
	}
	out, err := h.Svc.PopularCandidates(r.Context(), limit)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	response.JSON(w, http.StatusOK, out)
}

func (h *Handler) hiddenTerms(w http.ResponseWriter, r *http.Request) {
	out, err := h.Svc.HiddenTerms(r.Context())
	if err != nil {
		response.Error(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	response.JSON(w, http.StatusOK, out)
}

type hideTermRequest struct {
	Term string `json:"term" validate:"required,max=100"`
}

func (h *Handler) hideTerm(w http.ResponseWriter, r *http.Request) {
	var req hideTermRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	t, err := h.Svc.HideTerm(r.Context(), reqctx.MustPrincipal(r.Context()).UserID, req.Term)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, t)
}

func (h *Handler) unhideTerm(w http.ResponseWriter, r *http.Request) {
	term, err := url.PathUnescape(chi.URLParam(r, "term"))
	if err != nil {
		response.Error(w, r, errTerm)
		return
	}
	if err := h.Svc.UnhideTerm(r.Context(), term); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}
