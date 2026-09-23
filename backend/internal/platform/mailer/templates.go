package mailer

import (
	"bytes"
	_ "embed"
	"fmt"
	"html/template"
	"strings"
)

// Template names used by jobs.SendEmailArgs.
const (
	TemplateVerifyEmail   = "verify_email"
	TemplateResetPassword = "reset_password"
)

type texts struct {
	Subject, Intro, Expires, Ignore string
}

// Localized copy per template and locale. {ttl} is replaced with the code lifetime in minutes.
var catalog = map[string]map[string]texts{
	TemplateVerifyEmail: {
		"uz": {
			Subject: "Email manzilingizni tasdiqlang",
			Intro:   "Job Vacancy'da ro'yxatdan o'tishni yakunlash uchun quyidagi koddan foydalaning:",
			Expires: "Kod {ttl} daqiqa amal qiladi.",
			Ignore:  "Agar bu so'rovni siz yubormagan bo'lsangiz, xatni e'tiborsiz qoldiring.",
		},
		"uz-Cyrl": {
			Subject: "Электрон почта манзилингизни тасдиқланг",
			Intro:   "Job Vacancy'да рўйхатдан ўтишни якунлаш учун қуйидаги коддан фойдаланинг:",
			Expires: "Код {ttl} дақиқа амал қилади.",
			Ignore:  "Агар бу сўровни сиз юбормаган бўлсангиз, хатни эътиборсиз қолдиринг.",
		},
		"ru": {
			Subject: "Подтвердите адрес электронной почты",
			Intro:   "Чтобы завершить регистрацию в Job Vacancy, введите этот код:",
			Expires: "Код действует {ttl} минут.",
			Ignore:  "Если вы не отправляли этот запрос, просто проигнорируйте письмо.",
		},
		"en": {
			Subject: "Confirm your email address",
			Intro:   "Use this code to finish signing up for Job Vacancy:",
			Expires: "The code is valid for {ttl} minutes.",
			Ignore:  "If you didn't request this, you can safely ignore this email.",
		},
	},
	TemplateResetPassword: {
		"uz": {
			Subject: "Parolni tiklash",
			Intro:   "Parolingizni tiklash uchun quyidagi kodni kiriting:",
			Expires: "Kod {ttl} daqiqa amal qiladi.",
			Ignore:  "Agar bu so'rovni siz yubormagan bo'lsangiz, parolingiz xavfsiz — xatni e'tiborsiz qoldiring.",
		},
		"uz-Cyrl": {
			Subject: "Паролни тиклаш",
			Intro:   "Паролингизни тиклаш учун қуйидаги кодни киритинг:",
			Expires: "Код {ttl} дақиқа амал қилади.",
			Ignore:  "Агар бу сўровни сиз юбормаган бўлсангиз, паролингиз хавфсиз — хатни эътиборсиз қолдиринг.",
		},
		"ru": {
			Subject: "Восстановление пароля",
			Intro:   "Чтобы сбросить пароль, введите этот код:",
			Expires: "Код действует {ttl} минут.",
			Ignore:  "Если вы не запрашивали сброс, ваш пароль в безопасности — просто проигнорируйте письмо.",
		},
		"en": {
			Subject: "Reset your password",
			Intro:   "Enter this code to reset your password:",
			Expires: "The code is valid for {ttl} minutes.",
			Ignore:  "If you didn't request a reset, your password is safe and you can ignore this email.",
		},
	},
}

//go:embed templates/code.html
var codeHTML string

var codeTmpl = template.Must(template.New("code").Parse(codeHTML))

// RenderCode builds a one-time-code e-mail (verification, password reset) in the given locale.
func RenderCode(name, locale, to, code string, ttlMinutes int) (Message, error) {
	byLocale, ok := catalog[name]
	if !ok {
		return Message{}, fmt.Errorf("mailer: unknown template %q", name)
	}
	t, ok := byLocale[locale]
	if !ok {
		t = byLocale["uz"]
	}
	t.Expires = strings.ReplaceAll(t.Expires, "{ttl}", fmt.Sprint(ttlMinutes))

	var html bytes.Buffer
	err := codeTmpl.Execute(&html, map[string]string{
		"Lang": locale, "Title": t.Subject, "Intro": t.Intro,
		"Code": code, "Expires": t.Expires, "Ignore": t.Ignore,
	})
	if err != nil {
		return Message{}, fmt.Errorf("mailer: render %s: %w", name, err)
	}
	text := fmt.Sprintf("%s\n\n%s\n\n    %s\n\n%s\n%s\n\n— Job Vacancy · jobvacancy.uz\n",
		t.Subject, t.Intro, code, t.Expires, t.Ignore)

	return Message{To: to, Subject: t.Subject, HTML: html.String(), Text: text}, nil
}
