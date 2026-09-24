package realtime

import (
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/coder/websocket"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/random"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	mw "jobvacancy.uz/backend/internal/transport/http/middleware"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

const ticketTTL = 30 * time.Second

var errTicket = apperr.Unauthorized("invalid_ws_ticket", "websocket ticket is invalid or expired")

// Handler opens WebSocket connections.
//
// Browsers can't send an Authorization header on a WebSocket handshake, and putting the
// JWT in the URL would leak it into logs. So the client first trades its access token
// for a one-time ticket (POST /ws/ticket, valid 30 s) and connects with GET /ws?ticket=….
type Handler struct {
	Hub     *Hub
	RDB     *redis.Client
	Frames  FrameHandler
	Origins []string // allowed browser origins; native apps send none
	Log     *slog.Logger
}

func (h *Handler) Routes(r chi.Router, auth *mw.Authenticator) {
	r.With(auth.Require).Post("/ticket", h.ticket)
	r.Get("/", h.connect)
	r.With(auth.Require).Get("/presence", h.presence)
}

// The ticket is bound to the caller's session (TZ BE-15): revoking that session closes
// the socket opened with it.
func (h *Handler) ticket(w http.ResponseWriter, r *http.Request) {
	t := random.Token(24)
	p := reqctx.MustPrincipal(r.Context())
	if err := h.RDB.Set(r.Context(), "ws:ticket:"+t, p.UserID.String()+"|"+p.SessionID.String(), ticketTTL).Err(); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]any{"ticket": t, "expires_in": int(ticketTTL.Seconds())})
}

func (h *Handler) connect(w http.ResponseWriter, r *http.Request) {
	raw, err := h.RDB.GetDel(r.Context(), "ws:ticket:"+r.URL.Query().Get("ticket")).Result()
	uid, sid, perr := parseTicket(raw)
	if errors.Is(err, redis.Nil) || perr != nil {
		response.Error(w, r, errTicket)
		return
	}
	if err != nil {
		response.Error(w, r, err)
		return
	}
	// The server's read/write timeouts stay on a hijacked connection; clear them, the
	// hub keeps the connection alive with its own pings.
	rc := http.NewResponseController(w)
	_ = rc.SetReadDeadline(time.Time{})
	_ = rc.SetWriteDeadline(time.Time{})

	ws, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: hosts(h.Origins)})
	if err != nil {
		h.Log.InfoContext(r.Context(), "websocket accept failed", "err", err)
		return
	}
	h.Hub.Serve(r.Context(), ws, uid, sid, h.Frames)
}

// parseTicket reads "user|session"; a ticket from before sessions were bound holds only
// the user id (session uuid.Nil).
func parseTicket(v string) (uid, sid uuid.UUID, err error) {
	u, s, bound := strings.Cut(v, "|")
	if uid, err = uuid.Parse(u); err != nil {
		return uid, sid, err
	}
	if bound {
		sid, err = uuid.Parse(s)
	}
	return uid, sid, err
}

// presence answers GET /ws/presence?ids=a,b,c for screens that don't hold a socket.
// Asking about anyone the caller shares no conversation with is 403 (TZ SEC-05).
func (h *Handler) presence(w http.ResponseWriter, r *http.Request) {
	var ids []uuid.UUID
	for _, s := range splitComma(r.URL.Query().Get("ids")) {
		if id, err := uuid.Parse(s); err == nil && len(ids) < maxWatched {
			ids = append(ids, id)
		}
	}
	w.Header().Set("Cache-Control", "no-store")
	st, err := h.Hub.VisiblePresence(r.Context(), reqctx.MustPrincipal(r.Context()).UserID, ids, true)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, st)
}

// OriginPatterns match hosts, not full origins.
func hosts(origins []string) []string {
	var out []string
	for _, o := range origins {
		if u, err := url.Parse(o); err == nil && u.Host != "" {
			out = append(out, u.Host)
		}
	}
	return out
}

func splitComma(s string) []string {
	var out []string
	start := 0
	for i := 0; i <= len(s); i++ {
		if i == len(s) || s[i] == ',' {
			if i > start {
				out = append(out, s[start:i])
			}
			start = i + 1
		}
	}
	return out
}
