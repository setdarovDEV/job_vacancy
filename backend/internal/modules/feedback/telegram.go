package feedback

import (
	"context"
	"fmt"
	"html"
	"log/slog"

	"jobvacancy.uz/backend/internal/platform/telegram"
)

// TelegramNotifier posts new feedback to one team chat (FEEDBACK_TELEGRAM_CHAT_ID).
type TelegramNotifier struct {
	Bot    telegram.Bot
	ChatID int64
	WebURL string
	Log    *slog.Logger
}

var categoryLabel = map[string]string{"bug": "🐞 Xato", "idea": "💡 Taklif", "other": "💬 Boshqa"}

func (t TelegramNotifier) FeedbackReceived(ctx context.Context, f Item) {
	msg := fmt.Sprintf("<b>%s</b>\n%s", categoryLabel[string(f.Category)], html.EscapeString(f.Message))
	if f.Contact != nil {
		msg += "\n\n✉️ " + html.EscapeString(*f.Contact)
	}
	if f.PageURL != nil {
		msg += "\n🔗 " + html.EscapeString(*f.PageURL)
	}
	btn := &telegram.Button{Text: "Fikrlar", URL: t.WebURL + "/admin/feedback"}
	if err := t.Bot.Send(ctx, t.ChatID, msg, btn); err != nil {
		t.Log.WarnContext(ctx, "feedback telegram notification failed", "err", err)
	}
}
