package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

const anthropicAPIURL = "https://api.anthropic.com/v1/messages"

// AnthropicClient is a thin HTTP client for the Messages API.
type AnthropicClient struct {
	APIKey string
	Model  string
	Client *http.Client
}

// MessagesRequest is the Anthropic request body.
type MessagesRequest struct {
	Model     string    `json:"model"`
	MaxTokens int       `json:"max_tokens"`
	Messages  []Message `json:"messages"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// MessagesResponse is the parts of the Anthropic response we care about.
type MessagesResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	Usage struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
}

func (c *AnthropicClient) Generate(ctx context.Context, system, prompt string, maxTokens int) (*MessagesResponse, error) {
	if c.APIKey == "" {
		return nil, fmt.Errorf("anthropic api key is not configured")
	}
	body := MessagesRequest{
		Model:     c.Model,
		MaxTokens: maxTokens,
		Messages: []Message{
			{Role: "user", Content: prompt},
		},
	}
	if system != "" {
		// Anthropic supports a top-level system field; for simplicity we prepend it.
		body.Messages = append([]Message{{Role: "user", Content: system}}, body.Messages...)
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, anthropicAPIURL, bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", c.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	client := c.Client
	if client == nil {
		client = http.DefaultClient
	}
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("anthropic %d: %s", res.StatusCode, string(b))
	}
	var out MessagesResponse
	if err := json.Unmarshal(b, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
