package notification

import (
	"fmt"
	"strings"
)

// Payload is the data stored with a notification; every type uses a subset of it.
type Payload struct {
	ApplicationID  string `json:"application_id,omitempty"`
	VacancyID      string `json:"vacancy_id,omitempty"`
	VacancyTitle   string `json:"vacancy_title,omitempty"`
	CompanyName    string `json:"company_name,omitempty"`
	CandidateName  string `json:"candidate_name,omitempty"`
	Status         string `json:"status,omitempty"`
	Reason         string `json:"reason,omitempty"`
	ConversationID string `json:"conversation_id,omitempty"`
	SenderName     string `json:"sender_name,omitempty"`
	Preview        string `json:"preview,omitempty"`
	SearchID       string `json:"search_id,omitempty"`
	SearchName     string `json:"search_name,omitempty"`
	Count          int    `json:"count,omitempty"`
}

const (
	TypeApplicationNew     = "application.new"     // → company members
	TypeApplicationStatus  = "application.status"  // → seeker
	TypeApplicationInvited = "application.invited" // → seeker
	TypeVacancyApproved    = "vacancy.approved"    // → vacancy author
	TypeVacancyRejected    = "vacancy.rejected"    // → vacancy author
	TypeMessageNew         = "message.new"         // → offline chat participant (not stored)
	TypeSearchAlert        = "search.alert"        // → saved-search owner
)

// text is the rendered, localized notification.
type text struct {
	Title, Body, Button, Path string
}

var statusNames = map[string]map[string]string{
	"uz":      {"viewed": "ko'rib chiqildi", "invited": "taklif qilindi", "interview": "suhbatga chaqirildi", "hired": "ishga qabul qilindi 🎉", "rejected": "rad etildi"},
	"uz-Cyrl": {"viewed": "кўриб чиқилди", "invited": "таклиф қилинди", "interview": "суҳбатга чақирилди", "hired": "ишга қабул қилинди 🎉", "rejected": "рад этилди"},
	"ru":      {"viewed": "просмотрен", "invited": "приглашение", "interview": "приглашение на собеседование", "hired": "вас приняли на работу 🎉", "rejected": "отказ"},
	"en":      {"viewed": "viewed", "invited": "invited", "interview": "invited to an interview", "hired": "hired 🎉", "rejected": "declined"},
}

var buttons = map[string]map[string]string{
	"open":    {"uz": "Ochish", "uz-Cyrl": "Очиш", "ru": "Открыть", "en": "Open"},
	"reply":   {"uz": "Javob berish", "uz-Cyrl": "Жавоб бериш", "ru": "Ответить", "en": "Reply"},
	"results": {"uz": "Vakansiyalarni ko'rish", "uz-Cyrl": "Вакансияларни кўриш", "ru": "Смотреть вакансии", "en": "See vacancies"},
}

var footers = map[string]string{
	"uz":      "Bildirishnoma sozlamalarini profilingizda o'zgartirishingiz mumkin. · jobvacancy.uz",
	"uz-Cyrl": "Билдиришнома созламаларини профилингизда ўзгартиришингиз мумкин. · jobvacancy.uz",
	"ru":      "Настройки уведомлений можно изменить в профиле. · jobvacancy.uz",
	"en":      "You can change notification settings in your profile. · jobvacancy.uz",
}

// render builds the localized title/body for a notification type.
func render(typ, lang string, p Payload) (text, bool) {
	if _, ok := footers[lang]; !ok {
		lang = "uz"
	}
	pick := func(uz, cyrl, ru, en string) string {
		return map[string]string{"uz": uz, "uz-Cyrl": cyrl, "ru": ru, "en": en}[lang]
	}
	b := func(k string) string { return buttons[k][lang] }
	switch typ {
	case TypeApplicationNew:
		return text{
			Title:  pick("Yangi ariza", "Янги ариза", "Новый отклик", "New application"),
			Body:   fmt.Sprintf(pick("%s «%s» vakansiyasiga ariza yubordi.", "%s «%s» вакансиясига ариза юборди.", "%s откликнулся на вакансию «%s».", "%s applied for “%s”."), p.CandidateName, p.VacancyTitle),
			Button: b("open"), Path: "/employer/applications/" + p.ApplicationID,
		}, true
	case TypeApplicationStatus:
		st := statusNames[lang][p.Status]
		return text{
			Title:  fmt.Sprintf(pick("Arizangiz: %s", "Аризангиз: %s", "Ваш отклик: %s", "Your application: %s"), st),
			Body:   fmt.Sprintf(pick("%s — «%s»", "%s — «%s»", "%s — «%s»", "%s — “%s”"), p.CompanyName, p.VacancyTitle),
			Button: b("open"), Path: "/applications/" + p.ApplicationID,
		}, true
	case TypeApplicationInvited:
		return text{
			Title:  pick("Sizni ishga taklif qilishdi", "Сизни ишга таклиф қилишди", "Вас пригласили на вакансию", "You've been invited"),
			Body:   fmt.Sprintf(pick("%s sizni «%s» vakansiyasiga taklif qildi.", "%s сизни «%s» вакансиясига таклиф қилди.", "%s приглашает вас на вакансию «%s».", "%s invited you to apply for “%s”."), p.CompanyName, p.VacancyTitle),
			Button: b("open"), Path: "/applications/" + p.ApplicationID,
		}, true
	case TypeVacancyApproved:
		return text{
			Title:  pick("Vakansiya e'lon qilindi", "Вакансия эълон қилинди", "Вакансия опубликована", "Vacancy published"),
			Body:   fmt.Sprintf(pick("«%s» moderatsiyadan o'tdi va 30 kun davomida ko'rinadi.", "«%s» модерациядан ўтди ва 30 кун давомида кўринади.", "«%s» прошла модерацию и будет видна 30 дней.", "“%s” passed moderation and is live for 30 days."), p.VacancyTitle),
			Button: b("open"), Path: "/employer/vacancies/" + p.VacancyID,
		}, true
	case TypeVacancyRejected:
		return text{
			Title:  pick("Vakansiya rad etildi", "Вакансия рад этилди", "Вакансия отклонена", "Vacancy rejected"),
			Body:   fmt.Sprintf(pick("«%s»: %s\nTuzatib, qayta yuboring.", "«%s»: %s\nТузатиб, қайта юборинг.", "«%s»: %s\nИсправьте и отправьте снова.", "“%s”: %s\nPlease fix it and resubmit."), p.VacancyTitle, p.Reason),
			Button: b("open"), Path: "/employer/vacancies/" + p.VacancyID,
		}, true
	case TypeMessageNew:
		return text{
			Title:  fmt.Sprintf(pick("%s: yangi xabar", "%s: янги хабар", "%s: новое сообщение", "%s: new message"), p.SenderName),
			Body:   p.Preview,
			Button: b("reply"), Path: "/chat/" + p.ConversationID,
		}, true
	case TypeSearchAlert:
		return text{
			Title:  fmt.Sprintf(pick("«%s» bo'yicha %d ta yangi vakansiya", "«%s» бўйича %d та янги вакансия", "Новые вакансии по запросу «%s»: %d", "New vacancies for “%s”: %d"), p.SearchName, p.Count),
			Body:   p.Preview,
			Button: b("results"), Path: "/search?saved=" + p.SearchID,
		}, true
	}
	return text{}, false
}

// escapeHTML for Telegram's HTML parse mode.
func escapeHTML(s string) string {
	return strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;").Replace(s)
}
