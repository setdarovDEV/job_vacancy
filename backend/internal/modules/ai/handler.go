package ai

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

type Handler struct {
	Svc *Service
}

func (h *Handler) Routes(r chi.Router) {
	r.Get("/balance", h.balance)
	r.Get("/usage", h.usage)
	r.Post("/resume-improve", h.resumeImprove)
	r.Post("/cover-letter", h.coverLetter)
	r.Post("/vacancy-description", h.vacancyDescription)
}

func (h *Handler) balance(w http.ResponseWriter, r *http.Request) {
	b, err := h.Svc.Balance(r.Context(), reqctx.MustPrincipal(r.Context()).UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, BalanceResponse{Balance: int(b)})
}

func (h *Handler) usage(w http.ResponseWriter, r *http.Request) {
	items, err := h.Svc.ListUsage(r.Context(), reqctx.MustPrincipal(r.Context()).UserID, 50)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"data": items})
}

func (h *Handler) resumeImprove(w http.ResponseWriter, r *http.Request) {
	var req ImproveResumeRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	h.generate(w, r, OpResumeImprove, map[string]string{"section": req.Section, "text": req.Text})
}

func (h *Handler) coverLetter(w http.ResponseWriter, r *http.Request) {
	var req CoverLetterRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	// In a full implementation load resume and vacancy text here.
	h.generate(w, r, OpCoverLetter, map[string]string{"resume": req.ResumeID, "vacancy": req.VacancyID})
}

func (h *Handler) vacancyDescription(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Text string `json:"text" validate:"required,max=2000"`
	}
	if !response.DecodeValid(w, r, &req) {
		return
	}
	h.generate(w, r, OpVacancyDescription, map[string]string{"text": req.Text})
}

func (h *Handler) generate(w http.ResponseWriter, r *http.Request, op gen.AiOperation, fields map[string]string) {
	uid := reqctx.MustPrincipal(r.Context()).UserID
	system, prompt := BuildPrompt(op, fields)
	out, err := h.Svc.Generate(r.Context(), uid, op, system, prompt)
	if err != nil {
		if err.Error() == "insufficient ai credits" {
			response.Error(w, r, apperr.New(http.StatusPaymentRequired, "insufficient_ai_credits", err.Error()))
			return
		}
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, out)
}
