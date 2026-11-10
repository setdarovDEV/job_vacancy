package ai

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
)

// Operation names map directly to the ai_operation enum in Postgres.
const (
	OpResumeImprove      gen.AiOperation = "resume_improve"
	OpCoverLetter        gen.AiOperation = "cover_letter"
	OpVacancyDescription gen.AiOperation = "vacancy_description"
)

// Cost table: one credit per operation for now; can be changed independently.
var costs = map[gen.AiOperation]int32{
	OpResumeImprove:      1,
	OpCoverLetter:        2,
	OpVacancyDescription: 2,
}

// Provider turns a prompt into text and token counts.
type Provider interface {
	Generate(ctx context.Context, system, prompt string, maxTokens int) (*MessagesResponse, error)
}

// DevProvider returns a placeholder when no API key is configured.
type DevProvider struct{ Log *slog.Logger }

func (d DevProvider) Generate(_ context.Context, _, prompt string, _ int) (*MessagesResponse, error) {
	d.Log.Info("ai provider disabled: returning placeholder", "prompt_len", len(prompt))
	return &MessagesResponse{
		Content: []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		}{{Type: "text", Text: "[AI javobi shu yerda bo‘ladi. Anthropic API kalitini sozlang.]"}},
		Usage: struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		}{InputTokens: len(prompt) / 4, OutputTokens: 20},
	}, nil
}

type Service struct {
	Q          *gen.Queries
	Provider   Provider
	Model      string
	MaxTokens  int
	Log        *slog.Logger
}

func (s *Service) Balance(ctx context.Context, userID uuid.UUID) (int32, error) {
	row, err := s.Q.GetCreditBalance(ctx, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return row.Balance, nil
}

func (s *Service) Generate(ctx context.Context, userID uuid.UUID, operation gen.AiOperation, system, prompt string) (*GenerationResponse, error) {
	cost, ok := costs[operation]
	if !ok {
		return nil, fmt.Errorf("unknown ai operation %s", operation)
	}

	// Optimistically spend credits; if generation fails we do not refund in the skeleton.
	rows, err := s.Q.SpendCredits(ctx, gen.SpendCreditsParams{UserID: userID, Balance: cost})
	if err != nil {
		return nil, err
	}
	if rows == 0 {
		return nil, errors.New("insufficient ai credits")
	}

	res, err := s.Provider.Generate(ctx, system, prompt, s.MaxTokens)
	if err != nil {
		return nil, err
	}

	text := ""
	for _, c := range res.Content {
		if c.Type == "text" {
			text += c.Text
		}
	}
	tokens := int32(res.Usage.InputTokens + res.Usage.OutputTokens)

	_, err = s.Q.RecordUsage(ctx, gen.RecordUsageParams{
		UserID:        userID,
		Operation:     operation,
		Model:         s.Model,
		Prompt:        prompt,
		Response:      text,
		TokensInput:   int32(res.Usage.InputTokens),
		TokensOutput:  int32(res.Usage.OutputTokens),
		CostCredits:   cost,
	})
	if err != nil {
		s.Log.WarnContext(ctx, "record ai usage", "err", err)
	}

	return &GenerationResponse{
		Text:        text,
		CostCredits: int(cost),
		TokensUsed:  int(tokens),
	}, nil
}

func (s *Service) ListUsage(ctx context.Context, userID uuid.UUID, limit int32) ([]UsageItem, error) {
	rows, err := s.Q.ListUsage(ctx, gen.ListUsageParams{UserID: userID, Limit: limit})
	if err != nil {
		return nil, err
	}
	out := make([]UsageItem, len(rows))
	for i, r := range rows {
		out[i] = UsageItem{
			ID:            r.ID,
			Operation:     string(r.Operation),
			Model:         r.Model,
			TokensInput:   r.TokensInput,
			TokensOutput:  r.TokensOutput,
			CostCredits:   r.CostCredits,
			CreatedAt:     r.CreatedAt.Format("2006-01-02T15:04:05Z"),
		}
	}
	return out, nil
}

func BuildPrompt(operation gen.AiOperation, fields map[string]string) (system, prompt string) {
	switch operation {
	case OpResumeImprove:
		return "Siz professional HR mutaxassisi va rezyume yozish bo‘yicha kouchsisiz.",
			fmt.Sprintf("Quyidagi rezyume bo‘limini qisqacha, aniq va ish beruvchi e'tiborini tortadigan qilib yaxshilang:\n\n[%s]\n%s", fields["section"], fields["text"])
	case OpCoverLetter:
		return "Siz professional HR mutaxassisi.",
			fmt.Sprintf("Quyidagi rezyume asosida ushbu vakansiya uchun qisqa murojaat xati (cover letter) yozing:\nRezyume: %s\nVakansiya: %s", fields["resume"], fields["vacancy"])
	case OpVacancyDescription:
		return "Siz professional ish e'lonlari yozuvchisisiz.",
		fmt.Sprintf("Quyidagi qisqa tavsifdan chiroyli, aniq va inclusive ish e'lonini yozing:\n%s", fields["text"])
	}
	return "", ""
}
