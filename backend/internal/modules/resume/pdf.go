package resume

import (
	_ "embed"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/signintech/gopdf"

	"jobvacancy.uz/backend/internal/modules/catalog"
)

// Noto Sans covers Latin, Cyrillic and the Uzbek letters (ў қ ғ ҳ ʻ). See fonts/OFL.txt.
var (
	//go:embed fonts/NotoSans-Regular.ttf
	fontRegular []byte
	//go:embed fonts/NotoSans-Bold.ttf
	fontBold []byte
)

type pdfLabels struct {
	About, Experience, Education, Skills, Languages, Contacts, Salary, Present, Total string
	Year, Month                                                                       func(n int) string
	Levels                                                                            map[string]string
	Footer                                                                            string
}

var labels = map[string]pdfLabels{
	"uz": {
		About: "O'zim haqimda", Experience: "Ish tajribasi", Education: "Ta'lim", Skills: "Ko'nikmalar",
		Languages: "Tillar", Contacts: "Kontaktlar", Salary: "Kutilayotgan maosh", Present: "hozirgacha",
		Total: "Umumiy tajriba", Year: func(n int) string { return fmt.Sprintf("%d yil", n) },
		Month: func(n int) string { return fmt.Sprintf("%d oy", n) }, Footer: "jobvacancy.uz orqali yaratildi",
		Levels: map[string]string{"secondary": "O'rta", "vocational": "O'rta maxsus", "incomplete_higher": "Tugallanmagan oliy",
			"bachelor": "Bakalavr", "master": "Magistr", "phd": "Fan nomzodi / PhD", "native": "ona tili"},
	},
	"uz-Cyrl": {
		About: "Ўзим ҳақимда", Experience: "Иш тажрибаси", Education: "Таълим", Skills: "Кўникмалар",
		Languages: "Тиллар", Contacts: "Контактлар", Salary: "Кутилаётган маош", Present: "ҳозиргача",
		Total: "Умумий тажриба", Year: func(n int) string { return fmt.Sprintf("%d йил", n) },
		Month: func(n int) string { return fmt.Sprintf("%d ой", n) }, Footer: "jobvacancy.uz орқали яратилди",
		Levels: map[string]string{"secondary": "Ўрта", "vocational": "Ўрта махсус", "incomplete_higher": "Тугалланмаган олий",
			"bachelor": "Бакалавр", "master": "Магистр", "phd": "Фан номзоди / PhD", "native": "она тили"},
	},
	"ru": {
		About: "О себе", Experience: "Опыт работы", Education: "Образование", Skills: "Навыки",
		Languages: "Языки", Contacts: "Контакты", Salary: "Желаемая зарплата", Present: "по настоящее время",
		Total: "Общий опыт", Year: func(n int) string { return fmt.Sprintf("%d %s", n, ruPlural(n, "год", "года", "лет")) },
		Month: func(n int) string {
			return fmt.Sprintf("%d %s", n, ruPlural(n, "месяц", "месяца", "месяцев"))
		},
		Footer: "Создано на jobvacancy.uz",
		Levels: map[string]string{"secondary": "Среднее", "vocational": "Среднее специальное", "incomplete_higher": "Неоконченное высшее",
			"bachelor": "Бакалавр", "master": "Магистр", "phd": "Кандидат наук / PhD", "native": "родной"},
	},
	"en": {
		About: "About", Experience: "Experience", Education: "Education", Skills: "Skills",
		Languages: "Languages", Contacts: "Contacts", Salary: "Desired salary", Present: "present",
		Total: "Total experience", Year: func(n int) string { return plural(n, "year") },
		Month: func(n int) string { return plural(n, "month") }, Footer: "Created with jobvacancy.uz",
		Levels: map[string]string{"secondary": "Secondary", "vocational": "Vocational", "incomplete_higher": "Incomplete higher",
			"bachelor": "Bachelor's", "master": "Master's", "phd": "PhD", "native": "native"},
	},
}

var languageNames = map[string]catalog.Names{
	"uz": {Uz: "O'zbek", UzCyrl: "Ўзбек", Ru: "Узбекский", En: "Uzbek"},
	"ru": {Uz: "Rus", UzCyrl: "Рус", Ru: "Русский", En: "Russian"},
	"en": {Uz: "Ingliz", UzCyrl: "Инглиз", Ru: "Английский", En: "English"},
	"tr": {Uz: "Turk", UzCyrl: "Турк", Ru: "Турецкий", En: "Turkish"},
	"de": {Uz: "Nemis", UzCyrl: "Немис", Ru: "Немецкий", En: "German"},
	"ko": {Uz: "Koreys", UzCyrl: "Корейс", Ru: "Корейский", En: "Korean"},
	"zh": {Uz: "Xitoy", UzCyrl: "Хитой", Ru: "Китайский", En: "Chinese"},
	"ar": {Uz: "Arab", UzCyrl: "Араб", Ru: "Арабский", En: "Arabic"},
	"kk": {Uz: "Qozoq", UzCyrl: "Қозоқ", Ru: "Казахский", En: "Kazakh"},
	"tg": {Uz: "Tojik", UzCyrl: "Тожик", Ru: "Таджикский", En: "Tajik"},
	"fr": {Uz: "Fransuz", UzCyrl: "Француз", Ru: "Французский", En: "French"},
}

func pick(n catalog.Names, lang string) string {
	switch lang {
	case "uz-Cyrl":
		return n.UzCyrl
	case "ru":
		return n.Ru
	case "en":
		return n.En
	}
	return n.Uz
}

const (
	pageW, pageH = 595.28, 841.89 // A4 in points
	margin       = 48.0
	contentW     = pageW - 2*margin
	bottomLimit  = pageH - 60
)

var (
	brand = [3]uint8{27, 58, 140} // lapis #1B3A8C, same as the web
	ink   = [3]uint8{28, 27, 41}
	muted = [3]uint8{110, 109, 128}
)

type pdfWriter struct {
	pdf  *gopdf.GoPdf
	lang string
	err  error
}

// RenderPDF writes a one-column, printable resume. Contact details appear only if the
// viewer is allowed to see them (d.Contacts != nil).
func (s *Service) RenderPDF(w io.Writer, d Detail, lang string) error {
	l, ok := labels[lang]
	if !ok {
		lang, l = "uz", labels["uz"]
	}
	p := &gopdf.GoPdf{}
	p.Start(gopdf.Config{PageSize: gopdf.Rect{W: pageW, H: pageH}})
	p.SetInfo(gopdf.PdfInfo{Title: d.Person.FullName + " — " + d.Title, Creator: "jobvacancy.uz", CreationDate: time.Now()})
	if err := p.AddTTFFontData("noto", fontRegular); err != nil {
		return err
	}
	if err := p.AddTTFFontDataWithOption("noto", fontBold, gopdf.TtfOption{Style: gopdf.Bold}); err != nil {
		return err
	}
	pw := &pdfWriter{pdf: p, lang: lang}
	p.AddPage()

	// Header band.
	p.SetFillColor(brand[0], brand[1], brand[2])
	p.RectFromUpperLeftWithStyle(0, 0, pageW, 112, "F")
	pw.text(margin, 34, "B", 22, [3]uint8{255, 255, 255}, d.Person.FullName)
	pw.text(margin, 66, "", 13, [3]uint8{214, 224, 250}, d.Title)
	var meta []string
	if d.ExperienceMonths > 0 {
		meta = append(meta, l.Total+": "+experienceText(int(d.ExperienceMonths), l))
	}
	if d.DesiredSalary != nil {
		meta = append(meta, l.Salary+": "+money(d.DesiredSalary.Amount)+" "+d.DesiredSalary.Currency)
	}
	pw.text(margin, 88, "", 10, [3]uint8{214, 224, 250}, strings.Join(meta, "   ·   "))
	p.SetY(136)

	if d.Contacts != nil {
		var parts []string
		if d.Contacts.Phone != nil {
			parts = append(parts, *d.Contacts.Phone)
		}
		if d.Contacts.Email != nil {
			parts = append(parts, *d.Contacts.Email)
		}
		if len(parts) > 0 {
			pw.section(l.Contacts)
			pw.paragraph(strings.Join(parts, "   ·   "), 10.5, ink)
		}
	}
	if d.About != "" {
		pw.section(l.About)
		pw.paragraph(d.About, 10.5, ink)
	}
	if len(d.Experiences) > 0 {
		pw.section(l.Experience)
		for _, e := range d.Experiences {
			end := l.Present
			if e.End != nil {
				end = monthName(*e.End)
			}
			pw.entry(e.Position, e.Company, monthName(e.Start)+" — "+end, e.Description)
		}
	}
	if len(d.Educations) > 0 {
		pw.section(l.Education)
		for _, e := range d.Educations {
			years := ""
			if e.StartYear != nil || e.EndYear != nil {
				years = fmt.Sprintf("%s — %s", yearStr(e.StartYear), yearStr(e.EndYear))
			}
			sub := l.Levels[e.Level]
			if e.Field != "" {
				sub += ", " + e.Field
			}
			pw.entry(e.Institution, sub, years, "")
		}
	}
	if len(d.Skills) > 0 {
		pw.section(l.Skills)
		names := make([]string, len(d.Skills))
		for i, sk := range d.Skills {
			names[i] = sk.Name
		}
		pw.paragraph(strings.Join(names, "  ·  "), 10.5, ink)
	}
	if len(d.Languages) > 0 {
		pw.section(l.Languages)
		var parts []string
		for _, lg := range d.Languages {
			name := lg.Language
			if n, ok := languageNames[lg.Language]; ok {
				name = pick(n, lang)
			}
			level := strings.ToUpper(lg.Level)
			if lg.Level == "native" {
				level = l.Levels["native"]
			}
			parts = append(parts, name+" — "+level)
		}
		pw.paragraph(strings.Join(parts, "   ·   "), 10.5, ink)
	}

	pw.text(margin, pageH-36, "", 8, muted, l.Footer)
	if pw.err != nil {
		return pw.err
	}
	_, err := p.WriteTo(w)
	return err
}

func (pw *pdfWriter) setFont(style string, size float64, c [3]uint8) {
	if pw.err == nil {
		pw.err = pw.pdf.SetFont("noto", style, size)
	}
	pw.pdf.SetTextColor(c[0], c[1], c[2])
}

func (pw *pdfWriter) text(x, y float64, style string, size float64, c [3]uint8, s string) {
	pw.setFont(style, size, c)
	pw.pdf.SetXY(x, y)
	if pw.err == nil {
		pw.err = pw.pdf.Cell(nil, s)
	}
}

// ensure starts a new page when fewer than h points remain.
func (pw *pdfWriter) ensure(h float64) {
	if pw.pdf.GetY()+h > bottomLimit {
		pw.pdf.AddPage()
		pw.pdf.SetY(margin)
	}
}

func (pw *pdfWriter) section(title string) {
	pw.ensure(48)
	y := pw.pdf.GetY() + 10
	pw.text(margin, y, "B", 12.5, brand, strings.ToUpper(title))
	pw.pdf.SetStrokeColor(226, 224, 240)
	pw.pdf.SetLineWidth(0.8)
	pw.pdf.Line(margin, y+19, pageW-margin, y+19)
	pw.pdf.SetY(y + 28)
}

// paragraph writes word-wrapped text, honouring line breaks in the source.
func (pw *pdfWriter) paragraph(s string, size float64, c [3]uint8) {
	pw.setFont("", size, c)
	lineH := size * 1.45
	for _, para := range strings.Split(strings.ReplaceAll(s, "\r\n", "\n"), "\n") {
		if strings.TrimSpace(para) == "" {
			pw.pdf.SetY(pw.pdf.GetY() + lineH/2)
			continue
		}
		lines, err := pw.pdf.SplitTextWithWordWrap(para, contentW)
		if err != nil {
			lines = []string{para}
		}
		for _, line := range lines {
			pw.ensure(lineH)
			pw.setFont("", size, c) // a new page resets nothing, but be explicit
			pw.pdf.SetX(margin)
			if pw.err == nil {
				pw.err = pw.pdf.Cell(nil, line)
			}
			pw.pdf.SetY(pw.pdf.GetY() + lineH)
		}
	}
	pw.pdf.SetY(pw.pdf.GetY() + 4)
}

func (pw *pdfWriter) entry(title, subtitle, dates, body string) {
	pw.ensure(44)
	y := pw.pdf.GetY()
	pw.text(margin, y, "B", 11, ink, title)
	if dates != "" {
		pw.setFont("", 9.5, muted)
		if w, err := pw.pdf.MeasureTextWidth(dates); err == nil {
			pw.text(pageW-margin-w, y+1, "", 9.5, muted, dates)
		}
	}
	if subtitle != "" {
		pw.text(margin, y+16, "", 10, muted, subtitle)
		pw.pdf.SetY(y + 34)
	} else {
		pw.pdf.SetY(y + 18)
	}
	if body != "" {
		pw.paragraph(body, 10, ink)
	}
	pw.pdf.SetY(pw.pdf.GetY() + 4)
}

// ---- formatting --------------------------------------------------------------------------

func experienceText(months int, l pdfLabels) string {
	y, m := months/12, months%12
	switch {
	case y == 0:
		return l.Month(m)
	case m == 0:
		return l.Year(y)
	}
	return l.Year(y) + " " + l.Month(m)
}

// monthName renders "2021-03" as "03.2021", readable in every UI language.
func monthName(ym string) string {
	t, err := time.Parse(monthLayout, ym)
	if err != nil {
		return ym
	}
	return t.Format("01.2006")
}

func yearStr(y *int16) string {
	if y == nil {
		return "…"
	}
	return fmt.Sprint(*y)
}

// money formats 15000000 as "15 000 000".
func money(n int64) string {
	s := fmt.Sprint(n)
	var b strings.Builder
	for i, r := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			b.WriteByte(' ')
		}
		b.WriteRune(r)
	}
	return b.String()
}

func plural(n int, word string) string {
	if n == 1 {
		return "1 " + word
	}
	return fmt.Sprintf("%d %ss", n, word)
}

func ruPlural(n int, one, few, many string) string {
	switch {
	case n%10 == 1 && n%100 != 11:
		return one
	case n%10 >= 2 && n%10 <= 4 && (n%100 < 10 || n%100 >= 20):
		return few
	}
	return many
}
