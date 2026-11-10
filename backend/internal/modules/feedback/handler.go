package feedback

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/cursor"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

type Handler struct{ Svc *Service }

// Routes: POST /feedback (public; the router adds optional auth, rate limit and CAPTCHA).
func (h *Handler) Routes(r chi.Router) { r.Post("/", h.submit) }

// AdminRoutes are mounted at /admin/feedback.
func (h *Handler) AdminRoutes(r chi.Router) {
	r.Get("/", h.list)
	r.Put("/{feedback}/handled", h.setHandled(true))
	r.Delete("/{feedback}/handled", h.setHandled(false))
}

type submitRequest struct {
	Category string `json:"category" validate:"required"`
	// Length rules apply after trimming (Service.Submit); this only caps the body.
	Message string `json:"message" validate:"required,max=8000"`
	Contact string `json:"contact" validate:"max=200"`
	// Kept only when it is an absolute http(s) link to this site; otherwise stored as null.
	PageURL string `json:"page_url" validate:"max=500"`
}

type submittedDTO struct {
	ID        uuid.UUID `json:"id"`
	CreatedAt time.Time `json:"created_at"`
}

type userDTO struct {
	ID    uuid.UUID `json:"id"`
	Name  *string   `json:"name"`
	Email *string   `json:"email"`
}

type itemDTO struct {
	ID        uuid.UUID            `json:"id"`
	Category  gen.FeedbackCategory `json:"category"`
	Message   string               `json:"message"`
	Contact   *string              `json:"contact"`
	PageURL   *string              `json:"page_url"`
	User      *userDTO             `json:"user"`
	HandledAt *time.Time           `json:"handled_at"`
	CreatedAt time.Time            `json:"created_at"`
}

func toDTO(f Item) itemDTO {
	out := itemDTO{ID: f.ID, Category: f.Category, Message: f.Message, Contact: f.Contact, PageURL: f.PageURL,
		HandledAt: f.HandledAt, CreatedAt: f.CreatedAt}
	if f.UserID != nil {
		out.User = &userDTO{ID: *f.UserID, Name: f.UserName, Email: f.UserEmail}
	}
	return out
}

func (h *Handler) submit(w http.ResponseWriter, r *http.Request) {
	var req submitRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	cat := gen.FeedbackCategory(req.Category)
	if !cat.Valid() {
		response.Error(w, r, apperr.Validation(map[string]string{"category": apperr.OneOf(gen.AllFeedbackCategoryValues())}))
		return
	}
	in := Input{Category: cat, Message: req.Message, Contact: req.Contact, PageURL: req.PageURL, IP: reqctx.ClientIP(r.Context())}
	if p, ok := reqctx.PrincipalFrom(r.Context()); ok {
		in.UserID = &p.UserID
	}
	f, err := h.Svc.Submit(r.Context(), in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusCreated, submittedDTO{ID: f.ID, CreatedAt: f.CreatedAt})
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	after, limit, err := cursor.ParseAdminPage(q)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	f := Filter{Status: StatusOpen, After: after, Limit: limit}
	if s := q.Get("status"); s != "" {
		f.Status = Status(s)
	}
	items, meta, err := h.Svc.List(r.Context(), f)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	out := make([]itemDTO, len(items))
	for i, it := range items {
		out[i] = toDTO(it)
	}
	response.List(w, out, meta)
}

func (h *Handler) setHandled(handled bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "feedback"))
		if err != nil {
			response.Error(w, r, ErrNotFound)
			return
		}
		f, err := h.Svc.SetHandled(r.Context(), reqctx.MustPrincipal(r.Context()), id, handled)
		if err != nil {
			response.Error(w, r, err)
			return
		}
		response.JSON(w, http.StatusOK, toDTO(f))
	}
}
