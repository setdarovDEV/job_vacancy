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

// Exactly one of code (from the app) or recovery_code.
type verifySecondFactorRequest struct {
	ChallengeToken string `json:"challenge_token" validate:"required,max=128"`
	Code           string `json:"code" validate:"required_without=RecoveryCode,excluded_with=RecoveryCode,omitempty,numeric,len=6"`
	RecoveryCode   string `json:"recovery_code" validate:"required_without=Code,excluded_with=Code,omitempty,max=32"`
}

type twoFactorCodeRequest struct {
	Code string `json:"code" validate:"required,numeric,len=6"`
}

// The password (when the account has one) and exactly one of code or recovery_code.
type twoFactorReauthRequest struct {
	Password     string `json:"password" validate:"max=72"`
	Code         string `json:"code" validate:"required_without=RecoveryCode,excluded_with=RecoveryCode,omitempty,numeric,len=6"`
	RecoveryCode string `json:"recovery_code" validate:"required_without=Code,excluded_with=Code,omitempty,max=32"`
}

func (r twoFactorReauthRequest) reauth() Reauth {
	return Reauth{Password: r.Password, Code: r.Code, Recovery: r.RecoveryCode}
}

type twoFactorStatusDTO struct {
	Required          bool       `json:"required"`
	Enabled           bool       `json:"enabled"`
	Pending           bool       `json:"pending"`
	SessionVerified   bool       `json:"session_verified"`
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
	en, err := h.Svc.MFA.Setup(r.Context(), reqctx.MustPrincipal(r.Context()).UserID)
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
	codes, err := h.Svc.MFA.Confirm(r.Context(), reqctx.MustPrincipal(r.Context()), req.Code)
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
	codes, err := h.Svc.MFA.RegenerateRecoveryCodes(r.Context(), reqctx.MustPrincipal(r.Context()).UserID, req.reauth())
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
	if err := h.Svc.MFA.Disable(r.Context(), reqctx.MustPrincipal(r.Context()), req.reauth()); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}
