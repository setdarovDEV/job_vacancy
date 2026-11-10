package auth

import (
	"net/http"
	"time"

	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

type twoFactorChallengeResponse struct {
	TwoFactorRequired bool   `json:"two_factor_required"`
	ChallengeToken    string `json:"challenge_token"`
	ExpiresIn         int    `json:"expires_in"`
}

// Either code (from the app) or recovery_code.
type verifySecondFactorRequest struct {
	ChallengeToken string `json:"challenge_token" validate:"required,max=128"`
	Code           string `json:"code" validate:"required_without=RecoveryCode,omitempty,numeric,len=6"`
	RecoveryCode   string `json:"recovery_code" validate:"required_without=Code,omitempty,max=32"`
}

type twoFactorCodeRequest struct {
	Code string `json:"code" validate:"required,numeric,len=6"`
}

type twoFactorReauthRequest struct {
	Password string `json:"password" validate:"max=72"`
	Code     string `json:"code" validate:"required,numeric,len=6"`
}

type twoFactorStatusDTO struct {
	Required          bool       `json:"required"`
	Enabled           bool       `json:"enabled"`
	Pending           bool       `json:"pending"`
	ConfirmedAt       *time.Time `json:"confirmed_at"`
	RecoveryCodesLeft int        `json:"recovery_codes_left"`
}

type twoFactorSetupDTO struct {
	Secret     string `json:"secret"`
	OtpauthURI string `json:"otpauth_uri"`
}

type recoveryCodesDTO struct {
	RecoveryCodes []string `json:"recovery_codes"`
}

func (h *Handler) verifySecondFactor(w http.ResponseWriter, r *http.Request) {
	var req verifySecondFactorRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	res, err := h.Svc.CompleteSecondFactor(r.Context(), req.ChallengeToken, req.Code, req.RecoveryCode, clientMeta(r))
	h.writeAuth(w, r, res, err, http.StatusOK)
}

func (h *Handler) twoFactorStatus(w http.ResponseWriter, r *http.Request) {
	st, err := h.Svc.MFA.Status(r.Context(), reqctx.MustPrincipal(r.Context()))
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, twoFactorStatusDTO(st))
}

func (h *Handler) twoFactorSetup(w http.ResponseWriter, r *http.Request) {
	u, err := h.Svc.Q.GetUserByID(r.Context(), reqctx.MustPrincipal(r.Context()).UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	en, err := h.Svc.MFA.Setup(r.Context(), u)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	response.JSON(w, http.StatusOK, twoFactorSetupDTO{Secret: en.Secret, OtpauthURI: en.URI})
}

func (h *Handler) twoFactorConfirm(w http.ResponseWriter, r *http.Request) {
	var req twoFactorCodeRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	codes, err := h.Svc.MFA.Confirm(r.Context(), reqctx.MustPrincipal(r.Context()).UserID, req.Code)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	response.JSON(w, http.StatusOK, recoveryCodesDTO{RecoveryCodes: codes})
}

func (h *Handler) twoFactorRecoveryCodes(w http.ResponseWriter, r *http.Request) {
	var req twoFactorReauthRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	u, err := h.Svc.Q.GetUserByID(r.Context(), reqctx.MustPrincipal(r.Context()).UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	codes, err := h.Svc.MFA.RegenerateRecoveryCodes(r.Context(), u, req.Password, req.Code)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	response.JSON(w, http.StatusOK, recoveryCodesDTO{RecoveryCodes: codes})
}

func (h *Handler) twoFactorDisable(w http.ResponseWriter, r *http.Request) {
	var req twoFactorReauthRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	u, err := h.Svc.Q.GetUserByID(r.Context(), reqctx.MustPrincipal(r.Context()).UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	if err := h.Svc.MFA.Disable(r.Context(), u, req.Password, req.Code); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}
