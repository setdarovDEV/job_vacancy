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
	// ExpiresAt is an RFC 3339 time (vacancy expiry, invite expiry).
	ExpiresAt string `json:"expires_at,omitempty"`
	InviteID  string `json:"invite_id,omitempty"`
	CompanyID string `json:"company_id,omitempty"`
	Role      string `json:"role,omitempty"`
	// InviterName is who sent a company invite (or who answered it).
	InviterName string `json:"inviter_name,omitempty"`
}

const (
	TypeApplicationNew     = "application.new"         // → company members
	TypeApplicationStatus  = "application.status"      // → seeker
	TypeApplicationInvited = "application.invited"     // → seeker
	TypeVacancyApproved    = "vacancy.approved"        // → vacancy author
	TypeVacancyRejected    = "vacancy.rejected"        // → vacancy author
	TypeMessageNew         = "message.new"             // → offline chat participant (not stored)
	TypeSearchAlert        = "search.alert"            // → saved-search owner
	TypeVacancyExpiring    = "vacancy.expiring"        // → vacancy author, 3 days before expiry (TZ FN-04)
	TypeVacancyExpired     = "vacancy.expired"         // → vacancy author (TZ FN-04)
	TypeVacancyReported    = "vacancy.reported"        // → vacancy author: back to moderation after reports (TZ FN-02)
	TypeCompanyInvite      = "company.invite"          // → invitee (TZ FN-05); also e-mailed to addresses without an account
	TypeInviteAccepted     = "company.invite_accepted" // → whoever sent the invite
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
	"invite":  {"uz": "Taklifni ko'rish", "uz-Cyrl": "Таклифни кўриш", "ru": "Посмотреть приглашение", "en": "View invitation"},
	"renew":   {"uz": "Qayta e'lon qilish", "uz-Cyrl": "Қайта эълон қилиш", "ru": "Опубликовать снова", "en": "Republish"},
	"reply":   {"uz": "Javob berish", "uz-Cyrl": "Жавоб бериш", "ru": "Ответить", "en": "Reply"},
	"results": {"uz": "Vakansiyalarni ko'rish", "uz-Cyrl": "Вакансияларни кўриш", "ru": "Смотреть вакансии", "en": "See vacancies"},
}

var roleNames = map[string]map[string]string{
	"uz":      {"admin": "administrator", "recruiter": "rekruter"},
	"uz-Cyrl": {"admin": "администратор", "recruiter": "рекрутер"},
	"ru":      {"admin": "администратор", "recruiter": "рекрутер"},
	"en":      {"admin": "admin", "recruiter": "recruiter"},
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
	case TypeVacancyExpiring:
		body := fmt.Sprintf(pick("«%s» 3 kundan keyin e'londan olinadi. Muddati tugagach uni bir tugma bilan qayta e'lon qilishingiz mumkin.", "«%s» 3 кундан кейин эълондан олинади. Муддати тугагач уни бир тугма билан қайта эълон қилишингиз мумкин.", "«%s» снимется с публикации через 3 дня. После этого её можно опубликовать снова одной кнопкой.", "“%s” goes offline in 3 days. Once it expires you can republish it with one click."), p.VacancyTitle)
		if p.Count > 1 {
			body = fmt.Sprintf(pick("«%s» va yana %d ta vakansiya 3 kun ichida e'londan olinadi.", "«%s» ва яна %d та вакансия 3 кун ичида эълондан олинади.", "«%s» и ещё %d вакансий снимутся с публикации в ближайшие 3 дня.", "“%s” and %d more vacancies go offline within 3 days."), p.VacancyTitle, p.Count-1)
		}
		return text{
			Title: pick("Vakansiya muddati tugamoqda", "Вакансия муддати тугамоқда", "Срок вакансии заканчивается", "Your vacancy expires soon"),
			Body:  body, Button: b("open"), Path: "/employer/vacancies/" + p.VacancyID,
		}, true
	case TypeVacancyExpired:
		body := fmt.Sprintf(pick("«%s» endi qidiruvda ko'rinmaydi. O'zgartirmagan bo'lsangiz, moderatsiyasiz qayta e'lon qilinadi.", "«%s» энди қидирувда кўринмайди. Ўзгартирмаган бўлсангиз, модерациясиз қайта эълон қилинади.", "«%s» больше не видна в поиске. Если вы её не меняли, повторная публикация пройдёт без модерации.", "“%s” is no longer listed. If you haven't changed it, republishing skips moderation."), p.VacancyTitle)
		if p.Count > 1 {
			body = fmt.Sprintf(pick("«%s» va yana %d ta vakansiyaning muddati tugadi. O'zgartirilmaganlari moderatsiyasiz qayta e'lon qilinadi.", "«%s» ва яна %d та вакансиянинг муддати тугади. Ўзгартирилмаганлари модерациясиз қайта эълон қилинади.", "Срок «%s» и ещё %d вакансий истёк. Неизменённые можно опубликовать снова без модерации.", "“%s” and %d more vacancies have expired. Unchanged ones can be republished without moderation."), p.VacancyTitle, p.Count-1)
		}
		return text{
			Title: pick("Vakansiya muddati tugadi", "Вакансия муддати тугади", "Срок вакансии истёк", "Your vacancy has expired"),
			Body:  body, Button: b("renew"), Path: "/employer/vacancies/" + p.VacancyID,
		}, true
	case TypeVacancyReported:
		return text{
			Title:  pick("Vakansiya qayta tekshiruvda", "Вакансия қайта текширувда", "Вакансия на повторной проверке", "Vacancy under review"),
			Body:   fmt.Sprintf(pick("Foydalanuvchilar «%s» haqida shikoyat qildi. Moderator tekshirguncha u vaqtincha e'londan olindi.", "Фойдаланувчилар «%s» ҳақида шикоят қилди. Модератор текширгунча у вақтинча эълондан олинди.", "На вакансию «%s» поступили жалобы. Она скрыта до проверки модератором.", "Users reported “%s”. It is hidden until a moderator reviews it."), p.VacancyTitle),
			Button: b("open"), Path: "/employer/vacancies/" + p.VacancyID,
		}, true
	case TypeCompanyInvite:
		role := roleNames[lang][p.Role]
		return text{
			Title:  fmt.Sprintf(pick("%s sizni jamoaga taklif qildi", "%s сизни жамоага таклиф қилди", "%s приглашает вас в команду", "%s invited you to join the team"), p.CompanyName),
			Body:   fmt.Sprintf(pick("%s sizni «%s» kompaniyasiga %s sifatida qo'shmoqchi. Taklif 7 kun amal qiladi.", "%s сизни «%s» компаниясига %s сифатида қўшмоқчи. Таклиф 7 кун амал қилади.", "%s приглашает вас в компанию «%s» как %s. Приглашение действует 7 дней.", "%s invited you to “%s” as %s. The invitation is valid for 7 days."), p.InviterName, p.CompanyName, role),
			Button: b("invite"), Path: "/me/invites",
		}, true
	case TypeInviteAccepted:
		return text{
			Title:  fmt.Sprintf(pick("%s taklifni qabul qildi", "%s таклифни қабул қилди", "%s принял(а) приглашение", "%s accepted the invitation"), p.InviterName),
			Body:   fmt.Sprintf(pick("Endi u «%s» jamoasida.", "Энди у «%s» жамоасида.", "Теперь он(а) в команде «%s».", "They are now on the “%s” team."), p.CompanyName),
			Button: b("open"), Path: "/employer/company",
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
