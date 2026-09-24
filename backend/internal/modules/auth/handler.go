package auth

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/user"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

// Web clients keep the refresh token in an HttpOnly cookie scoped to the auth endpoints,
// so JavaScript (and any XSS) never sees it. Mobile clients send X-Client-Type: android|ios
// and receive/send the refresh token in the JSON body instead.
const (
	refreshCookie = "jv_refresh"
	cookiePath    = "/api/v1/auth"
)

type CookieConfig struct {
	Domain string
	Secure bool
}

type Handler struct {
	Svc    *Service
	Cookie CookieConfig
	// CaptchaSiteKey is the public Turnstile key the web shows the widget with; empty when
	// the captcha is disabled.
	CaptchaSiteKey string
}

// PublicRoutes are mounted under /auth behind the strict per-IP limit (sign-up and
// password-reset e-mails, code guessing).
func (h *Handler) PublicRoutes(r chi.Router) {
	r.Post("/register", h.register)
	r.Post("/password/forgot", h.forgotPassword)
	r.Post("/password/reset", h.resetPassword)
}

// LoginRoutes are mounted under /auth behind a CGNAT-sized per-IP limit; failed
// passwords are handled by the login guard (TZ SEC-04).
func (h *Handler) LoginRoutes(r chi.Router) {
	r.Post("/login", h.login)
	r.Post("/google", h.google)
	r.Get("/captcha", h.captcha)
}

// SessionRoutes (token refresh, sign-out) run for every open tab every few minutes, so
// they get their own soft per-IP limit (TZ SEC-04).
func (h *Handler) SessionRoutes(r chi.Router) {
	r.Post("/refresh", h.refresh)
	r.Post("/logout", h.logout)
}

// ProtectedRoutes are mounted under /auth behind RequireAuth.
func (h *Handler) ProtectedRoutes(r chi.Router) {
	r.Post("/logout-all", h.logoutAll)
	r.Post("/email/send-code", h.sendEmailCode)
	r.Post("/email/verify", h.verifyEmail)
	r.Post("/phone/send-code", h.sendPhoneCode)
	r.Post("/phone/verify", h.verifyPhone)
}

// MeRoutes are mounted under /me behind RequireAuth.
func (h *Handler) MeRoutes(r chi.Router) {
	r.Get("/sessions", h.listSessions)
	r.Delete("/sessions/{id}", h.revokeSession)
	r.Put("/password", h.changePassword)
	r.Put("/consent", h.acceptConsent)
}

// ---- DTOs ------------------------------------------------------------------------------

type authResponse struct {
	User                  user.DTO   `json:"user"`
	AccessToken           string     `json:"access_token"`
	AccessTokenExpiresAt  time.Time  `json:"access_token_expires_at"`
	RefreshToken          string     `json:"refresh_token,omitempty"`
	RefreshTokenExpiresAt *time.Time `json:"refresh_token_expires_at,omitempty"`
	IsNewUser             bool       `json:"is_new_user"`
}

type registerRequest struct {
	Email    string `json:"email" validate:"required,email,max=254"`
	Password string `json:"password" validate:"required,password"`
	FullName string `json:"full_name" validate:"required,min=2,max=100"`
	Role     string `json:"role" validate:"required,oneof=seeker employer"`
	Locale   string `json:"locale" validate:"omitempty,oneof=uz uz-Cyrl ru en"`
	// Consent to the processing of personal data (TZ FN-08); must be true.
	Consent        bool   `json:"consent"`
	ConsentVersion string `json:"consent_version" validate:"omitempty,max=32"`
}

type loginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,max=72"`
	// Solved Cloudflare Turnstile token; needed only after captcha_required (TZ SEC-04).
	CaptchaToken string `json:"captcha_token" validate:"max=2048"`
}

type googleRequest struct {
	IDToken string `json:"id_token" validate:"required"`
	// Used only when this sign-in creates a new account.
	Role   string `json:"role" validate:"omitempty,oneof=seeker employer"`
	Locale string `json:"locale" validate:"omitempty,oneof=uz uz-Cyrl ru en"`
	// Needed only when this sign-in creates the account (TZ FN-08).
	Consent        bool   `json:"consent"`
	ConsentVersion string `json:"consent_version" validate:"omitempty,max=32"`
}

type consentRequest struct {
	Version string `json:"version" validate:"omitempty,max=32"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type codeRequest struct {
	Code string `json:"code" validate:"required,numeric,len=6"`
}

type forgotRequest struct {
	Email string `json:"email" validate:"required,email"`
}

type resetRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Code     string `json:"code" validate:"required,numeric,len=6"`
	Password string `json:"password" validate:"required,password"`
}

type phoneRequest struct {
	Phone string `json:"phone" validate:"required,max=32"`
}

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password" validate:"max=72"`
	NewPassword     string `json:"new_password" validate:"required,password"`
}

type sessionDTO struct {
	ID         uuid.UUID `json:"id"`
	Platform   string    `json:"platform"`
	UserAgent  string    `json:"user_agent"`
	IP         string    `json:"ip,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
	LastUsedAt time.Time `json:"last_used_at"`
	Current    bool      `json:"current"`
}

// ---- handlers --------------------------------------------------------------------------

func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	res, err := h.Svc.Register(r.Context(), RegisterInput{
		Email:    req.Email,
		Password: req.Password,
		FullName: strings.Join(strings.Fields(req.FullName), " "),
		Role:     gen.UserRole(req.Role),
		Locale:   pickLocale(req.Locale, r),
		Consent:  Consent{Given: req.Consent, Version: req.ConsentVersion},
	}, clientMeta(r))
	h.writeAuth(w, r, res, err, http.StatusCreated)
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	res, err := h.Svc.LoginWithCaptcha(r.Context(), req.Email, req.Password, req.CaptchaToken, clientMeta(r))
	h.writeAuth(w, r, res, err, http.StatusOK)
}

// captcha tells clients which captcha to show after captcha_required.
func (h *Handler) captcha(w http.ResponseWriter, r *http.Request) {
	out := map[string]any{"enabled": false, "provider": nil, "site_key": nil}
	if h.CaptchaSiteKey != "" && h.Svc != nil && h.Svc.Guard != nil && h.Svc.Guard.Captcha != nil {
		out = map[string]any{"enabled": true, "provider": "turnstile", "site_key": h.CaptchaSiteKey}
	}
	w.Header().Set("Cache-Control", "public, max-age=3600")
	response.JSON(w, http.StatusOK, out)
}

func (h *Handler) google(w http.ResponseWriter, r *http.Request) {
	var req googleRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	role := gen.UserRoleSeeker
	if req.Role != "" {
		role = gen.UserRole(req.Role)
	}
	res, err := h.Svc.GoogleLogin(r.Context(), req.IDToken, role, pickLocale(req.Locale, r),
		Consent{Given: req.Consent, Version: req.ConsentVersion}, clientMeta(r))
	h.writeAuth(w, r, res, err, http.StatusOK)
}

func (h *Handler) refresh(w http.ResponseWriter, r *http.Request) {
	res, err := h.Svc.Refresh(r.Context(), h.readRefresh(r), clientMeta(r))
	if errors.Is(err, ErrInvalidRefresh) {
		h.clearCookie(w)
	}
	h.writeAuth(w, r, res, err, http.StatusOK)
}

// logout works without a valid access token: it revokes whichever session the refresh
// token belongs to, so an expired access token can still sign out.
func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	if rt := h.readRefresh(r); rt != "" {
		if sess, err := h.Svc.Q.GetSessionByRefreshHash(r.Context(), sha(rt)); err == nil {
			if err := h.Svc.Logout(r.Context(), sess.ID); err != nil {
				response.Error(w, r, err)
				return
			}
		}
	}
	h.clearCookie(w)
	response.NoContent(w)
}

func (h *Handler) logoutAll(w http.ResponseWriter, r *http.Request) {
	p := reqctx.MustPrincipal(r.Context())
	if err := h.Svc.RevokeAll(r.Context(), p.UserID); err != nil {
		response.Error(w, r, err)
		return
	}
	h.clearCookie(w)
	response.NoContent(w)
}

func (h *Handler) sendEmailCode(w http.ResponseWriter, r *http.Request) {
	p := reqctx.MustPrincipal(r.Context())
	if err := h.Svc.SendEmailVerification(r.Context(), p.UserID); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

func (h *Handler) verifyEmail(w http.ResponseWriter, r *http.Request) {
	p := reqctx.MustPrincipal(r.Context())
	var req codeRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	u, err := h.Svc.VerifyEmail(r.Context(), p.UserID, req.Code)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, user.ToDTO(u))
}

func (h *Handler) forgotPassword(w http.ResponseWriter, r *http.Request) {
	var req forgotRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	if err := h.Svc.ForgotPassword(r.Context(), req.Email); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

func (h *Handler) resetPassword(w http.ResponseWriter, r *http.Request) {
	var req resetRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	if err := h.Svc.ResetPassword(r.Context(), req.Email, req.Code, req.Password); err != nil {
		response.Error(w, r, err)
		return
	}
	h.clearCookie(w)
	response.NoContent(w)
}

func (h *Handler) sendPhoneCode(w http.ResponseWriter, r *http.Request) {
	p := reqctx.MustPrincipal(r.Context())
	var req phoneRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	num, err := h.Svc.SendPhoneCode(r.Context(), p.UserID, req.Phone)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusAccepted, map[string]any{
		"phone": num, "channel": "telegram", "expires_in": int(phoneCodeTTL.Seconds()),
	})
}

func (h *Handler) verifyPhone(w http.ResponseWriter, r *http.Request) {
	p := reqctx.MustPrincipal(r.Context())
	var req codeRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	u, err := h.Svc.VerifyPhone(r.Context(), p.UserID, req.Code)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, user.ToDTO(u))
}

func (h *Handler) listSessions(w http.ResponseWriter, r *http.Request) {
	p := reqctx.MustPrincipal(r.Context())
	sessions, err := h.Svc.Sessions(r.Context(), p.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	out := make([]sessionDTO, 0, len(sessions))
	for _, s := range sessions {
		d := sessionDTO{
			ID: s.ID, Platform: s.Platform, UserAgent: s.UserAgent,
			CreatedAt: s.CreatedAt, LastUsedAt: s.LastUsedAt, Current: s.ID == p.SessionID,
		}
		if s.Ip != nil {
			d.IP = s.Ip.String()
		}
		out = append(out, d)
	}
	response.JSON(w, http.StatusOK, out)
}

func (h *Handler) revokeSession(w http.ResponseWriter, r *http.Request) {
	p := reqctx.MustPrincipal(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, r, ErrSessionNotFound)
		return
	}
	if err := h.Svc.RevokeSession(r.Context(), p.UserID, id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

func (h *Handler) acceptConsent(w http.ResponseWriter, r *http.Request) {
	var req consentRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	u, err := h.Svc.AcceptConsent(r.Context(), reqctx.MustPrincipal(r.Context()).UserID, req.Version)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, user.ToDTO(u))
}

func (h *Handler) changePassword(w http.ResponseWriter, r *http.Request) {
	p := reqctx.MustPrincipal(r.Context())
	var req changePasswordRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	err := h.Svc.ChangePassword(r.Context(), p.UserID, p.SessionID, req.CurrentPassword, req.NewPassword)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

// ---- helpers ---------------------------------------------------------------------------

func (h *Handler) writeAuth(w http.ResponseWriter, r *http.Request, res *Result, err error, status int) {
	if err != nil {
		response.Error(w, r, err)
		return
	}
	out := authResponse{
		User:                 user.ToDTO(res.User),
		AccessToken:          res.AccessToken,
		AccessTokenExpiresAt: res.AccessExpiresAt,
		IsNewUser:            res.IsNewUser,
	}
	if isMobile(r) {
		out.RefreshToken = res.RefreshToken
		out.RefreshTokenExpiresAt = &res.RefreshExpiresAt
	} else {
		http.SetCookie(w, &http.Cookie{
			Name: refreshCookie, Value: res.RefreshToken, Path: cookiePath, Domain: h.Cookie.Domain,
			Expires: res.RefreshExpiresAt, HttpOnly: true, Secure: h.Cookie.Secure, SameSite: http.SameSiteStrictMode,
		})
	}
	w.Header().Set("Cache-Control", "no-store")
	response.JSON(w, status, out)
}

func (h *Handler) readRefresh(r *http.Request) string {
	if isMobile(r) {
		var req refreshRequest
		if err := response.Decode(r, &req); err == nil {
			return req.RefreshToken
		}
		return ""
	}
	if c, err := r.Cookie(refreshCookie); err == nil {
		return c.Value
	}
	return ""
}

func (h *Handler) clearCookie(w http.ResponseWriter) { ClearRefreshCookie(w, h.Cookie) }

// ClearRefreshCookie removes the web client's refresh cookie (sign-out, account deletion).
func ClearRefreshCookie(w http.ResponseWriter, c CookieConfig) {
	http.SetCookie(w, &http.Cookie{
		Name: refreshCookie, Value: "", Path: cookiePath, Domain: c.Domain,
		MaxAge: -1, HttpOnly: true, Secure: c.Secure, SameSite: http.SameSiteStrictMode,
	})
}

func platform(r *http.Request) string {
	switch strings.ToLower(r.Header.Get("X-Client-Type")) {
	case "android":
		return "android"
	case "ios":
		return "ios"
	default:
		return "web"
	}
}

func isMobile(r *http.Request) bool { return platform(r) != "web" }

func clientMeta(r *http.Request) ClientMeta {
	return ClientMeta{Platform: platform(r), UserAgent: r.UserAgent(), IP: reqctx.ClientIP(r.Context())}
}

// pickLocale uses the explicit choice, else the Accept-Language header, else Uzbek.
func pickLocale(explicit string, r *http.Request) gen.AppLocale {
	if explicit != "" {
		return gen.AppLocale(explicit)
	}
	al := strings.ToLower(r.Header.Get("Accept-Language"))
	switch {
	case strings.HasPrefix(al, "uz-cyrl"):
		return gen.AppLocaleUzCyrl
	case strings.HasPrefix(al, "ru"):
		return gen.AppLocaleRu
	case strings.HasPrefix(al, "en"):
		return gen.AppLocaleEn
	default:
		return gen.AppLocaleUz
	}
}
