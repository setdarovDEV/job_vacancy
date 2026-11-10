package feedback

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/platform/telegram"
)

type memStore struct {
	Store
	got gen.CreateFeedbackParams
}

func (m *memStore) CreateFeedback(_ context.Context, a gen.CreateFeedbackParams) (gen.Feedback, error) {
	m.got = a
	return gen.Feedback{ID: uuid.New(), Category: a.Category, Message: a.Message, PageUrl: a.PageUrl}, nil
}

func TestSubmitTrimsAndKeepsOnlyOwnPages(t *testing.T) {
	st := &memStore{}
	s := &Service{Store: st, SiteHost: "jobvacancy.uz"}
	ctx := context.Background()
	if _, err := s.Submit(ctx, Input{Category: gen.FeedbackCategoryBug, Message: "   hi    "}); err == nil {
		t.Fatal("whitespace-padded short message accepted")
	} else if ae, ok := apperr.As(err); !ok || ae.Fields["message"] != "min=5" {
		t.Fatalf("want 422 fields.message: %v", err)
	}
	if _, err := s.Submit(ctx, Input{Category: gen.FeedbackCategoryBug, Message: strings.Repeat("я", 2001)}); err == nil {
		t.Fatal("too long accepted")
	}
	for raw, want := range map[string]string{
		"https://jobvacancy.uz/vacancies?q=go": "https://jobvacancy.uz/vacancies?q=go",
		"https://evil.example/phish":           "",
		"javascript:alert(1)":                  "",
		"/relative":                            "",
		"https://jobvacancy.uz.evil.example/":  "",
	} {
		if _, err := s.Submit(ctx, Input{Category: gen.FeedbackCategoryIdea, Message: "  hello world  ", PageURL: raw}); err != nil {
			t.Fatal(err)
		}
		got := ""
		if st.got.PageUrl != nil {
			got = *st.got.PageUrl
		}
		if got != want || st.got.Message != "hello world" {
			t.Errorf("%q → page %q msg %q", raw, got, st.got.Message)
		}
	}
}

type fakeBot struct {
	chat int64
	text string
}

func (b *fakeBot) Send(_ context.Context, chat int64, html string, _ *telegram.Button) error {
	b.chat, b.text = chat, html
	return nil
}
func (b *fakeBot) Username() string { return "bot" }

func (m *memStore) GetFeedback(_ context.Context, id uuid.UUID) (gen.GetFeedbackRow, error) {
	return gen.GetFeedbackRow{ID: id, Category: "bug", Message: "<b>broken</b> & more"}, nil
}

func TestTelegramNotice(t *testing.T) {
	bot := &fakeBot{}
	n := TelegramNotifier{Feedback: &Service{Store: &memStore{}}, Bot: bot, ChatID: -100, WebURL: "https://jobvacancy.uz"}
	if err := n.Notify(context.Background(), uuid.New()); err != nil {
		t.Fatal(err)
	}
	if bot.chat != -100 || !strings.Contains(bot.text, "&lt;b&gt;broken") || !strings.Contains(bot.text, "Xato") {
		t.Fatalf("sent %d %q", bot.chat, bot.text)
	}
	off := &fakeBot{}
	if err := (TelegramNotifier{Feedback: &Service{Store: &memStore{}}, Bot: off}).Notify(context.Background(), uuid.New()); err != nil || off.text != "" {
		t.Fatal("no chat configured must not send")
	}
}
