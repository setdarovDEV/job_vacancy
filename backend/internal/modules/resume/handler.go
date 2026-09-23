package resume

import (
	"bytes"
	"net/http"
	"slices"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/cursor"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/pkg/searchq"
	"jobvacancy.uz/backend/internal/pkg/slug"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

type Handler struct{ Svc *Service }

// Routes are mounted under /resumes behind RequireAuth.
func (h *Handler) Routes(r chi.Router) {
	r.Get("/", h.search)
	r.Post("/", h.create)
	r.Get("/{resume}", h.get)
	r.Put("/{resume}", h.update)
	r.Delete("/{resume}", h.delete)
	r.Put("/{resume}/visibility", h.visibility)
	r.Get("/{resume}/pdf", h.pdf)
}

// MeRoutes are mounted under /me.
func (h *Handler) MeRoutes(r chi.Router) {
	r.Get("/resumes", h.mine)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var in Input
	if !response.DecodeValid(w, r, &in) {
		return
	}
	d, err := h.Svc.Create(r.Context(), reqctx.MustPrincipal(r.Context()), in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusCreated, d)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	id, ok := resumeID(w, r)
	if !ok {
		return
	}
	var in Input
	if !response.DecodeValid(w, r, &in) {
		return
	}
	d, err := h.Svc.Update(r.Context(), reqctx.MustPrincipal(r.Context()), id, in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, d)
}

type visibilityRequest struct {
	Visibility string `json:"visibility" validate:"required,oneof=public applied_only hidden"`
}

func (h *Handler) visibility(w http.ResponseWriter, r *http.Request) {
	id, ok := resumeID(w, r)
	if !ok {
		return
	}
	var req visibilityRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	d, err := h.Svc.SetVisibility(r.Context(), reqctx.MustPrincipal(r.Context()), id, req.Visibility)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, d)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	id, ok := resumeID(w, r)
	if !ok {
		return
	}
	if err := h.Svc.Delete(r.Context(), reqctx.MustPrincipal(r.Context()), id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id, ok := resumeID(w, r)
	if !ok {
		return
	}
	d, err := h.Svc.Get(r.Context(), reqctx.MustPrincipal(r.Context()), id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, d)
}

func (h *Handler) mine(w http.ResponseWriter, r *http.Request) {
	cards, err := h.Svc.Mine(r.Context(), reqctx.MustPrincipal(r.Context()))
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, cards)
}

// pdf streams the resume as a PDF; ?lang=uz|uz-Cyrl|ru|en picks the label language.
func (h *Handler) pdf(w http.ResponseWriter, r *http.Request) {
	id, ok := resumeID(w, r)
	if !ok {
		return
	}
	d, err := h.Svc.Get(r.Context(), reqctx.MustPrincipal(r.Context()), id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	var buf bytes.Buffer // render fully first so a failure can still send a JSON error
	if err := h.Svc.RenderPDF(&buf, d, r.URL.Query().Get("lang")); err != nil {
		response.Error(w, r, err)
		return
	}
	name := slug.Make(d.Person.FullName + " " + d.Title)
	if name == "" {
		name = "resume"
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `attachment; filename="`+name+`.pdf"`)
	w.Header().Set("Cache-Control", "private, no-store")
	_, _ = w.Write(buf.Bytes())
}

// ---- candidate search ----------------------------------------------------------------------

var enumValues = map[string][]string{
	"employment_type": {"full_time", "part_time", "project", "internship", "volunteer"},
	"work_format":     {"office", "remote", "hybrid"},
	"experience":      {"none", "1_3", "3_6", "6_plus"},
}

func (h *Handler) search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	bad := map[string]string{}
	f := SearchFilter{Limit: 20, WithRelocate: q.Get("with_relocate") == "true"}

	if raw := q.Get("q"); raw != "" {
		if len([]rune(raw)) > 200 {
			bad["q"] = "max=200"
		}
		f.Query = searchq.Parse(raw)
	}
	switch f.Sort = q.Get("sort"); f.Sort {
	case "", SortRelevance, SortUpdated:
	default:
		bad["sort"] = "oneof"
	}
	intParam := func(name string) *int32 {
		s := q.Get(name)
		if s == "" {
			return nil
		}
		n, err := strconv.ParseInt(s, 10, 32)
		if err != nil || n <= 0 {
			bad[name] = "numeric"
			return nil
		}
		v := int32(n)
		return &v
	}
	multi := func(name string) []string {
		var out []string
		for _, raw := range q[name] {
			for _, v := range strings.Split(raw, ",") {
				if v = strings.TrimSpace(v); v == "" {
					continue
				}
				if !slices.Contains(enumValues[name], v) {
					bad[name] = "oneof"
				} else if !slices.Contains(out, v) {
					out = append(out, v)
				}
			}
		}
		return out
	}
	f.CategoryID = intParam("category_id")
	f.RegionID = intParam("region_id")
	f.EmploymentTypes = multi("employment_type")
	f.WorkFormats = multi("work_format")
	f.Experiences = multi("experience")
	if l := q.Get("language"); l != "" {
		if len(l) < 2 || len(l) > 3 || strings.ToLower(l) != l {
			bad["language"] = "iso639"
		}
		f.Language = l
	}
	if s := q.Get("salary_to"); s != "" {
		n, err := strconv.ParseInt(s, 10, 64)
		if err != nil || n < 0 {
			bad["salary_to"] = "numeric"
		} else {
			f.SalaryTo = &n
			f.Currency = strings.ToUpper(q.Get("currency"))
			if f.Currency == "" {
				f.Currency = "UZS"
			}
			if f.Currency != "UZS" && f.Currency != "USD" {
				bad["currency"] = "oneof"
			}
		}
	}
	if s := q.Get("limit"); s != "" {
		n, err := strconv.Atoi(s)
		if err != nil || n < 1 || n > 50 {
			bad["limit"] = "max=50"
		}
		f.Limit = n
	}
	if len(bad) > 0 {
		response.Error(w, r, apperr.Validation(bad))
		return
	}
	if c := q.Get("cursor"); c != "" {
		var sc SearchCursor
		if err := cursor.Decode(c, &sc); err != nil || sc.Sort == "" {
			response.Error(w, r, errCursor)
			return
		}
		f.After = &sc
	}

	res, err := h.Svc.Search(r.Context(), reqctx.MustPrincipal(r.Context()), f)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.List(w, res.Cards, map[string]any{
		"next_cursor": res.NextCursor, "total": res.Total, "total_capped": res.TotalCapped, "fuzzy": res.Fuzzy,
	})
}

func resumeID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "resume"))
	if err != nil {
		response.Error(w, r, ErrNotFound)
		return id, false
	}
	return id, true
}
