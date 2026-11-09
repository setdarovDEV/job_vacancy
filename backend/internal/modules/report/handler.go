package report

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/cursor"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

type Handler struct{ Svc *Service }

// Routes are mounted under /reports (signed-in users, rate-limited).
func (h *Handler) Routes(r chi.Router) {
	r.Post("/", h.create)
}

// AdminRoutes are mounted under /admin/reports. Closing a target is a one-way step with
// a payload, so it's a POST action (see "Verbs for state" in the API description).
func (h *Handler) AdminRoutes(r chi.Router) {
	r.Get("/", h.queue)
	r.Post("/{target_type}/{target_id}/resolve", h.close(Resolved))
	r.Post("/{target_type}/{target_id}/dismiss", h.close(Dismissed))
}

type createRequest struct {
	TargetType string `json:"target_type" validate:"required"`
	// A string so a missing or malformed id is a field error (API-018), not a 404 for
	// uuid.Nil or a generic invalid_json.
	TargetID string `json:"target_id" validate:"required,uuid"`
	Reason   string `json:"reason" validate:"required"`
	Comment  string `json:"comment" validate:"max=1000"`
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var req createRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	in := Input{Target: Target{Type: gen.ReportTarget(req.TargetType)}, Reason: gen.ReportReason(req.Reason), Comment: req.Comment}
	bad := map[string]string{}
	if id, err := uuid.Parse(req.TargetID); err == nil {
		in.Target.ID = id
	} else {
		bad["target_id"] = "uuid"
	}
	if !in.Target.Type.Valid() {
		bad["target_type"] = apperr.OneOf(gen.AllReportTargetValues())
	}
	if !in.Reason.Valid() {
		bad["reason"] = apperr.OneOf(gen.AllReportReasonValues())
	}
	if len(bad) > 0 {
		response.Error(w, r, apperr.Validation(bad))
		return
	}
	rep, err := h.Svc.Create(r.Context(), reqctx.MustPrincipal(r.Context()), in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusCreated, toDTO(rep))
}

func (h *Handler) queue(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	after, limit, err := cursor.ParseAdminPage(q)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	f := QueueFilter{Status: gen.ReportStatusOpen, After: after, Limit: limit}
	bad := map[string]string{}
	if s := q.Get("status"); s != "" {
		if st := gen.ReportStatus(s); st.Valid() {
			f.Status = st
		} else {
			bad["status"] = apperr.OneOf(gen.AllReportStatusValues())
		}
	}
	if s := q.Get("target_type"); s != "" {
		if t := gen.ReportTarget(s); t.Valid() {
			f.TargetType = &t
		} else {
			bad["target_type"] = apperr.OneOf(gen.AllReportTargetValues())
		}
	}
	if len(bad) > 0 {
		response.Error(w, r, apperr.Validation(bad))
		return
	}
	rows, meta, err := h.Svc.Queue(r.Context(), f)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	out := make([]TargetReportsDTO, len(rows))
	for i, t := range rows {
		out[i] = targetDTO(t)
	}
	response.List(w, out, meta)
}

type closeRequest struct {
	Note string `json:"note" validate:"max=1000"`
}

func (h *Handler) close(outcome Outcome) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		t, ok := targetRef(w, r)
		if !ok {
			return
		}
		var req closeRequest // the body is optional (API-018)
		if !response.DecodeValidOptional(w, r, &req) {
			return
		}
		res, err := h.Svc.Close(r.Context(), reqctx.MustPrincipal(r.Context()), t, outcome, req.Note)
		if err != nil {
			response.Error(w, r, err)
			return
		}
		response.JSON(w, http.StatusOK, targetDTO(res))
	}
}

// targetRef parses {target_type}/{target_id}; anything malformed is reported like an
// unknown target (404 reported_target_not_found).
func targetRef(w http.ResponseWriter, r *http.Request) (Target, bool) {
	t := Target{Type: gen.ReportTarget(chi.URLParam(r, "target_type"))}
	id, err := uuid.Parse(chi.URLParam(r, "target_id"))
	if err != nil || !t.Type.Valid() {
		response.Error(w, r, ErrReportedTargetNotFound)
		return t, false
	}
	t.ID = id
	return t, true
}
