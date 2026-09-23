package chat

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/cursor"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

type Handler struct{ Svc *Service }

// Routes are mounted under /conversations behind RequireAuth.
func (h *Handler) Routes(r chi.Router) {
	r.Get("/", h.list)
	r.Get("/unread-count", h.unread)
	r.Get("/{conversation}", h.get)
	r.Get("/{conversation}/messages", h.messages)
	r.Post("/{conversation}/messages", h.send)
	r.Post("/{conversation}/read", h.read)
}

// ApplicationRoutes register on the /applications router.
func (h *Handler) ApplicationRoutes(r chi.Router) {
	r.Post("/{application}/conversation", h.open)
}

// MessageRoutes are mounted under /messages behind RequireAuth.
func (h *Handler) MessageRoutes(r chi.Router) {
	r.Delete("/{message}", h.delete)
}

func convID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "conversation"))
	if err != nil {
		response.Error(w, r, ErrNotFound)
		return id, false
	}
	return id, true
}

func (h *Handler) open(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "application"))
	if err != nil {
		response.Error(w, r, ErrNotFound)
		return
	}
	c, err := h.Svc.Open(r.Context(), reqctx.MustPrincipal(r.Context()), id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	limit, ok := limitParam(w, r, 20)
	if !ok {
		return
	}
	var after *ListCursor
	if s := r.URL.Query().Get("cursor"); s != "" {
		var c ListCursor
		if err := cursor.Decode(s, &c); err != nil {
			response.Error(w, r, apperr.BadRequest("invalid_cursor", "cursor is invalid"))
			return
		}
		after = &c
	}
	items, next, err := h.Svc.List(r.Context(), reqctx.MustPrincipal(r.Context()), after, limit)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	meta := cursor.Meta{}
	if next != nil {
		c := cursor.Encode(next)
		meta.NextCursor = &c
	}
	response.List(w, items, meta)
}

func (h *Handler) unread(w http.ResponseWriter, r *http.Request) {
	n, err := h.Svc.UnreadCount(r.Context(), reqctx.MustPrincipal(r.Context()))
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]int64{"conversations": n})
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id, ok := convID(w, r)
	if !ok {
		return
	}
	c, err := h.Svc.Get(r.Context(), reqctx.MustPrincipal(r.Context()), id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

// messages: ?before=<id> pages into history, ?after=<id> catches up after a reconnect.
func (h *Handler) messages(w http.ResponseWriter, r *http.Request) {
	id, ok := convID(w, r)
	if !ok {
		return
	}
	limit, ok := limitParam(w, r, 30)
	if !ok {
		return
	}
	before, err1 := int64Param(r, "before")
	after, err2 := int64Param(r, "after")
	if err1 != nil || err2 != nil {
		response.Error(w, r, apperr.Validation(map[string]string{"before": "numeric", "after": "numeric"}))
		return
	}
	msgs, next, err := h.Svc.Messages(r.Context(), reqctx.MustPrincipal(r.Context()), id, before, after, limit)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	var nc *string
	if next != nil {
		s := strconv.FormatInt(*next, 10)
		nc = &s
	}
	response.List(w, msgs, map[string]any{"next_before": nc})
}

func (h *Handler) send(w http.ResponseWriter, r *http.Request) {
	id, ok := convID(w, r)
	if !ok {
		return
	}
	var in SendInput
	if !response.DecodeValid(w, r, &in) {
		return
	}
	m, err := h.Svc.Send(r.Context(), reqctx.MustPrincipal(r.Context()), id, in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusCreated, m)
}

type readRequest struct {
	MessageID int64 `json:"message_id" validate:"required,min=1"`
}

func (h *Handler) read(w http.ResponseWriter, r *http.Request) {
	id, ok := convID(w, r)
	if !ok {
		return
	}
	var req readRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	if err := h.Svc.MarkRead(r.Context(), reqctx.MustPrincipal(r.Context()), id, req.MessageID); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "message"), 10, 64)
	if err != nil {
		response.Error(w, r, ErrMsgNotFound)
		return
	}
	if err := h.Svc.Delete(r.Context(), reqctx.MustPrincipal(r.Context()), id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

func limitParam(w http.ResponseWriter, r *http.Request, def int) (int, bool) {
	s := r.URL.Query().Get("limit")
	if s == "" {
		return def, true
	}
	n, err := strconv.Atoi(s)
	if err != nil || n < 1 || n > 100 {
		response.Error(w, r, apperr.Validation(map[string]string{"limit": "max=100"}))
		return 0, false
	}
	return n, true
}

func int64Param(r *http.Request, name string) (*int64, error) {
	s := r.URL.Query().Get(name)
	if s == "" {
		return nil, nil
	}
	n, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return nil, err
	}
	return &n, nil
}
