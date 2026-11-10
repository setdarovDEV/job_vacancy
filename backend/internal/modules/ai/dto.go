package ai

// ImproveResumeRequest asks the model to rewrite a resume section.
type ImproveResumeRequest struct {
	Section string `json:"section" validate:"required,oneof=summary experience skills"`
	Text    string `json:"text" validate:"required,max=4000"`
}

// CoverLetterRequest generates a cover letter from a resume and a vacancy.
type CoverLetterRequest struct {
	ResumeID  string `json:"resume_id" validate:"required,uuid"`
	VacancyID string `json:"vacancy_id" validate:"required,uuid"`
}

// GenerationResponse is the result returned to the client.
type GenerationResponse struct {
	Text        string `json:"text"`
	CostCredits int    `json:"cost_credits"`
	TokensUsed  int    `json:"tokens_used"`
}

// BalanceResponse is the user's current AI credit balance.
type BalanceResponse struct {
	Balance int `json:"balance"`
}

// UsageItem is one recorded AI operation.
type UsageItem struct {
	ID            int64  `json:"id"`
	Operation     string `json:"operation"`
	Model         string `json:"model"`
	TokensInput   int32  `json:"tokens_input"`
	TokensOutput  int32  `json:"tokens_output"`
	CostCredits   int32  `json:"cost_credits"`
	CreatedAt     string `json:"created_at"`
}
