package feedback

import (
	"context"
	"errors"
	"fmt"
	"html"

	"github.com/google/uuid"
	"github.com/riverqueue/river"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/platform/telegram"
)

// NotifyArgs posts one feedback message to the team chat (worker job, retried on failure).
type NotifyArgs struct {
	FeedbackID uuid.UUID `json:"feedback_id"`
}

func (NotifyArgs) Kind() string { return "feedback.notify" }

func (NotifyArgs) InsertOpts() river.InsertOpts { return river.InsertOpts{MaxAttempts: 5} }

// TelegramNotifier posts feedback to one team chat (FEEDBACK_TELEGRAM_CHAT_ID).
type TelegramNotifier struct {
	Feedback *Service
	Bot      telegram.Bot
	ChatID   int64 // 0 = not configured: jobs finish without sending
	WebURL   string
}

var categoryLabel = map[gen.FeedbackCategory]string{
	gen.FeedbackCategoryBug:   "🐞 Xato",
	gen.FeedbackCategoryIdea:  "💡 Taklif",
	gen.FeedbackCategoryOther: "💬 Boshqa",
}

func label(c gen.FeedbackCategory) string {
	if l, ok := categoryLabel[c]; ok {
		return l
	}
	return "💬 " + string(c)
}

// Notify sends the message; a message deleted meanwhile is skipped.
func (t TelegramNotifier) Notify(ctx context.Context, id uuid.UUID) error {
	if t.ChatID == 0 {
		return nil
	}
	f, err := t.Feedback.Get(ctx, id)
	if errors.Is(err, ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	msg := fmt.Sprintf("<b>%s</b>\n%s", label(f.Category), html.EscapeString(f.Message))
	if f.Contact != nil {
		msg += "\n\n✉️ " + html.EscapeString(*f.Contact)
	}
	if f.PageURL != nil {
		msg += "\n🔗 " + html.EscapeString(*f.PageURL)
	}
	return t.Bot.Send(ctx, t.ChatID, msg, &telegram.Button{Text: "Fikrlar", URL: t.WebURL + "/admin/feedback"})
}
