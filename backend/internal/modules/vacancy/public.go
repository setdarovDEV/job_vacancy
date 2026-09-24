package vacancy

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/isbot"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/pkg/searchq"
	"jobvacancy.uz/backend/internal/platform/respcache"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

// Public reads answer from PublicCache: cached JSON bytes with an ETag (304 on
// If-None-Match), gzip-encoded when the client accepts it, X-Cache HIT|STALE|MISS.

const (
	listCacheControl   = "public, max-age=15"
	detailCacheControl = "public, max-age=60" // TZ BE-05: anonymous visitors
	// A signed-in visitor gets the same bytes but no shared caching; the browser
	// revalidates with the ETag.
	privateCacheControl = "private, no-cache"
)

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	f, err := parseFilter(r)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	c := h.Svc.Cache
	e, st, err := c.List.Get(r.Context(), listKey(f), func(ctx context.Context) (respcache.Loaded, error) {
		res, err := h.Svc.List(ctx, f)
		if err != nil {
			return respcache.Loaded{}, err
		}
		body, err := response.Encode(res.Cards, listMeta{NextCursor: res.NextCursor, Total: res.Total,
			TotalCapped: res.TotalCapped, Fuzzy: res.Fuzzy})
		found := byte(0)
		if len(res.Cards) > 0 {
			found = 1
		}
		return respcache.Loaded{Body: body, Meta: []byte{found}}, err
	})
	if err != nil {
		response.Error(w, r, err)
		return
	}
	if !f.Query.Empty() && f.After == nil && len(e.Meta) == 1 && e.Meta[0] == 1 {
		c.RecordSearch(r.Context(), r.URL.Query().Get("q"), reqctx.ClientIP(r.Context()))
	}
	c.List.Serve(w, r, e, st, listCacheControl)
}

type listMeta struct {
	NextCursor  *string `json:"next_cursor"`
	Total       *int    `json:"total,omitempty"`
	TotalCapped bool    `json:"total_capped,omitempty"`
	Fuzzy       bool    `json:"fuzzy,omitempty"`
}

// get serves the vacancy page. Company members (and admins) see drafts, can_edit and the
// reject reason, so an employer's or admin's request is built fresh; everyone else gets
// the cached public page.
func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	ref := chi.URLParam(r, "vacancy")
	p, signed := reqctx.PrincipalFrom(r.Context())
	if signed && p.Role != string(gen.UserRoleSeeker) {
		d, member, err := h.Svc.Get(r.Context(), ref, &p)
		if err != nil {
			response.Error(w, r, err)
			return
		}
		if !member {
			h.countView(r, d.ID)
		}
		w.Header().Set("Cache-Control", privateCacheControl)
		response.JSON(w, http.StatusOK, d)
		return
	}
	c := h.Svc.Cache.Detail
	e, st, err := c.Get(r.Context(), RefKey(ref), func(ctx context.Context) (respcache.Loaded, error) {
		return h.Svc.publicDetail(ctx, ref)
	})
	if err != nil {
		response.Error(w, r, err)
		return
	}
	// Still counted here until the web sends the view beacon (then GET stops writing).
	if id, _, ok := detailIDs(e.Meta); ok {
		h.countView(r, id)
	}
	cc := detailCacheControl
	if signed {
		cc = privateCacheControl
	}
	c.Serve(w, r, e, st, cc)
}

// view is the page-view beacon (TZ FE-02): POST /vacancies/{vacancy}/view, sent by the
// browser after the page rendered, so cached pages still count and bots (which rarely
// run scripts, and are filtered by User-Agent when they do) don't. A viewer is counted
// once per vacancy per hour: by user when signed in, otherwise by client IP.
func (h *Handler) view(w http.ResponseWriter, r *http.Request) {
	id, companyID, err := h.Svc.publicIDs(r.Context(), chi.URLParam(r, "vacancy"))
	if err != nil {
		response.Error(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	if p, ok := reqctx.PrincipalFrom(r.Context()); ok && p.Role != string(gen.UserRoleSeeker) &&
		h.Svc.Companies.IsMember(r.Context(), p, companyID) {
		response.NoContent(w) // the company looking at its own vacancy
		return
	}
	h.countView(r, id)
	response.NoContent(w)
}

// countView records a page view unless the client is a bot.
func (h *Handler) countView(r *http.Request, id uuid.UUID) {
	if isbot.Match(r.UserAgent()) {
		return
	}
	key := "ip:" + reqctx.ClientIP(r.Context()).String()
	if p, ok := reqctx.PrincipalFrom(r.Context()); ok {
		key = "u:" + p.UserID.String()
	}
	if err := h.Svc.Views.Hit(r.Context(), id, key); err != nil {
		h.Svc.Log.WarnContext(r.Context(), "view count failed", "err", err)
	}
}

func (h *Handler) suggest(w http.ResponseWriter, r *http.Request) {
	raw := r.URL.Query().Get("q")
	if len(raw) > 100 {
		raw = strings.ToValidUTF8(raw[:100], "")
	}
	q := searchq.Parse(raw)
	if q.Empty() {
		w.Header().Set("Cache-Control", "public, max-age=3600")
		response.JSON(w, http.StatusOK, emptySuggestions())
		return
	}
	c := h.Svc.Cache.Suggest
	e, st, err := c.Get(r.Context(), q.Folded, func(ctx context.Context) (respcache.Loaded, error) {
		out, err := h.Svc.Suggest(ctx, raw)
		if err != nil {
			return respcache.Loaded{}, err
		}
		body, err := response.Encode(out, nil)
		return respcache.Loaded{Body: body}, err
	})
	if err != nil {
		response.Error(w, r, err)
		return
	}
	c.Serve(w, r, e, st, "public, max-age=60")
}

func (h *Handler) popular(w http.ResponseWriter, r *http.Request) {
	c := h.Svc.Cache.Popular
	e, st, err := c.Get(r.Context(), popularKey, func(ctx context.Context) (respcache.Loaded, error) {
		out, err := h.Svc.popular(ctx)
		if err != nil {
			return respcache.Loaded{}, err
		}
		body, err := response.Encode(out, nil)
		return respcache.Loaded{Body: body}, err
	})
	if err != nil {
		response.Error(w, r, err)
		return
	}
	c.Serve(w, r, e, st, "public, max-age=300")
}

// ---- service side --------------------------------------------------------------------------

// publicDetail builds the cached page: the public view of a published vacancy of an
// active company; anything else is 404 (and not cached). Meta carries the vacancy and
// company ids, so a cache hit by slug still knows which vacancy to count a view for.
func (s *Service) publicDetail(ctx context.Context, ref string) (respcache.Loaded, error) {
	v, err := s.resolve(ctx, ref)
	if err != nil {
		return respcache.Loaded{}, err
	}
	c, err := s.Q.GetCompanyByID(ctx, v.CompanyID)
	if err != nil {
		return respcache.Loaded{}, err
	}
	if v.Status != gen.VacancyStatusPublished || c.Status != gen.CompanyStatusActive {
		return respcache.Loaded{}, ErrNotFound
	}
	d, err := s.detail(ctx, v, c, false)
	if err != nil {
		return respcache.Loaded{}, err
	}
	body, err := response.Encode(d, nil)
	meta := make([]byte, 0, 32)
	meta = append(meta, v.ID[:]...)
	meta = append(meta, c.ID[:]...)
	return respcache.Loaded{Body: body, Meta: meta}, err
}

func detailIDs(meta []byte) (vacancyID, companyID uuid.UUID, ok bool) {
	if len(meta) != 32 {
		return vacancyID, companyID, false
	}
	copy(vacancyID[:], meta[:16])
	copy(companyID[:], meta[16:])
	return vacancyID, companyID, true
}

// publicIDs resolves a published vacancy for the view beacon: from its cached page when
// there is one (the page was just rendered, so usually), else from Postgres.
func (s *Service) publicIDs(ctx context.Context, ref string) (uuid.UUID, uuid.UUID, error) {
	if e, err := s.Cache.Detail.Peek(ctx, RefKey(ref)); err == nil && e != nil {
		if id, cid, ok := detailIDs(e.Meta); ok {
			return id, cid, nil
		}
	}
	v, err := s.resolve(ctx, ref)
	if err != nil {
		return uuid.Nil, uuid.Nil, err
	}
	c, err := s.Q.GetCompanyByID(ctx, v.CompanyID)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, uuid.Nil, ErrNotFound
	}
	if err != nil {
		return uuid.Nil, uuid.Nil, err
	}
	if v.Status != gen.VacancyStatusPublished || c.Status != gen.CompanyStatusActive {
		return uuid.Nil, uuid.Nil, ErrNotFound
	}
	return v.ID, c.ID, nil
}
