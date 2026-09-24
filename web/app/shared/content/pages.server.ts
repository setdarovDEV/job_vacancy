import type { Locale } from "../i18n/config";

// Static pages. Server-only: the loader sends just the requested page in one language, so
// none of this text ships in the JavaScript bundle.
// NOTE: privacy and terms are a plain-language starting point and need a lawyer's review
// (Law of the Republic of Uzbekistan "On personal data", No. ZRU-547) before launch.
// `id` is the section's anchor (#who-sees-it): the same in every language, so a shared link
// still lands on the right section after switching languages.
export type Page = { title: string; lead: string; sections: { id: string; h: string; p: string[] }[] };
export const SLUGS = ["about", "contacts", "privacy", "terms"] as const;
export type Slug = (typeof SLUGS)[number];

const EMAIL = "hello@jobvacancy.uz";

const uz: Record<Slug, Page> = {
  about: {
    title: "Loyiha haqida",
    lead: "Job Vacancy — O'zbekistondagi har qanday kasb bo'yicha ish va xodim topish platformasi.",
    sections: [
      { id: "why", h: "Nima uchun", p: ["Ish izlash oson bo'lishi kerak: kassir ham, dasturchi ham bir necha daqiqada mos vakansiyani topib, bir bosishda ariza yubora olsin.", "Ish beruvchilar esa arizalarni bir joyda ko'rib, nomzodlar bilan saytning o'zida yozishadi."] },
      { id: "how-it-works", h: "Qanday ishlaydi", p: ["Qidiruv o'zbek (lotin va kirill), rus va ingliz tillarini tushunadi: «dasturchi», «дастурчи» va «программист» bir xil natija beradi.", "Yangi kompaniyalar vakansiyalari e'lon qilinishidan oldin moderatsiyadan o'tadi, tasdiqlangan kompaniyalar belgi bilan ajratiladi."] },
    ],
  },
  contacts: {
    title: "Aloqa",
    lead: "Savol, taklif yoki muammo bo'lsa, yozing: odatda bir ish kuni ichida javob beramiz.",
    sections: [
      { id: "email", h: "Email", p: [EMAIL] },
      { id: "report-a-scam", h: "Firibgarlik haqida xabar berish", p: ["Vakansiyada oldindan pul so'ralsa yoki shubhali shartlar bo'lsa, vakansiya havolasini emailga yuboring. Biz tekshirib, kerak bo'lsa bloklaymiz."] },
    ],
  },
  privacy: {
    title: "Maxfiylik siyosati",
    lead: "Qanday ma'lumot yig'amiz, nima uchun va kim ko'radi.",
    sections: [
      { id: "data-we-collect", h: "Yig'iladigan ma'lumotlar", p: ["Hisob: ism, email, telefon raqami (ixtiyoriy), parolning xesh ko'rinishi.", "Rezyume va arizalar: siz kiritgan tajriba, ta'lim, ko'nikmalar va xatlar.", "Texnik: IP manzil va brauzer turi, xavfsizlik va seanslarni boshqarish uchun."] },
      { id: "who-sees-it", h: "Kim ko'radi", p: ["Rezyumeni kim ko'rishini siz tanlaysiz: hamma ish beruvchilar, faqat ariza yuborgan kompaniyalaringiz yoki faqat siz.", "Telefon va email faqat siz ariza yuborgan yoki sizni taklif qilgan kompaniyaga ochiladi."] },
      { id: "storage-and-deletion", h: "Saqlash va o'chirish", p: ["Ma'lumotlar O'zbekiston hududidagi serverlarda saqlanadi.", `Hisobingizni va ma'lumotlaringizni o'chirishni ${EMAIL} orqali so'rashingiz mumkin.`] },
    ],
  },
  terms: {
    title: "Foydalanish shartlari",
    lead: "Platformadan foydalanib, quyidagi shartlarga rozilik bildirasiz.",
    sections: [
      { id: "for-job-seekers", h: "Ish izlovchilar uchun", p: ["Rezyumedagi ma'lumotlar haqiqiy bo'lishi kerak.", "Hech qachon ish uchun oldindan pul to'lamang. Bunday talablar haqida bizga xabar bering."] },
      { id: "for-employers", h: "Ish beruvchilar uchun", p: ["Vakansiya haqiqiy ish o'rni haqida bo'lishi, maosh va shartlar to'g'ri ko'rsatilishi kerak.", "Nomzodlardan pul so'rash, kamsituvchi talablar va boshqa saytlarga reklama taqiqlanadi."] },
      { id: "moderation", h: "Moderatsiya", p: ["Qoidalarni buzgan vakansiya va hisoblarni ogohlantirishsiz bloklash huquqini saqlab qolamiz."] },
    ],
  },
};

const cyrl: Record<Slug, Page> = {
  about: {
    title: "Лойиҳа ҳақида",
    lead: "Job Vacancy — Ўзбекистондаги ҳар қандай касб бўйича иш ва ходим топиш платформаси.",
    sections: [
      { id: "why", h: "Нима учун", p: ["Иш излаш осон бўлиши керак: кассир ҳам, дастурчи ҳам бир неча дақиқада мос вакансияни топиб, бир босишда ариза юбора олсин.", "Иш берувчилар эса аризаларни бир жойда кўриб, номзодлар билан сайтнинг ўзида ёзишади."] },
      { id: "how-it-works", h: "Қандай ишлайди", p: ["Қидирув ўзбек (лотин ва кирилл), рус ва инглиз тилларини тушунади: «dasturchi», «дастурчи» ва «программист» бир хил натижа беради.", "Янги компаниялар вакансиялари эълон қилинишидан олдин модерациядан ўтади, тасдиқланган компаниялар белги билан ажратилади."] },
    ],
  },
  contacts: {
    title: "Алоқа",
    lead: "Савол, таклиф ёки муаммо бўлса, ёзинг: одатда бир иш куни ичида жавоб берамиз.",
    sections: [
      { id: "email", h: "Email", p: [EMAIL] },
      { id: "report-a-scam", h: "Фирибгарлик ҳақида хабар бериш", p: ["Вакансияда олдиндан пул сўралса ёки шубҳали шартлар бўлса, вакансия ҳаволасини эмаилга юборинг. Биз текшириб, керак бўлса блоклаймиз."] },
    ],
  },
  privacy: {
    title: "Махфийлик сиёсати",
    lead: "Қандай маълумот йиғамиз, нима учун ва ким кўради.",
    sections: [
      { id: "data-we-collect", h: "Йиғиладиган маълумотлар", p: ["Ҳисоб: исм, email, телефон рақами (ихтиёрий), паролнинг хеш кўриниши.", "Резюме ва аризалар: сиз киритган тажриба, таълим, кўникмалар ва хатлар.", "Техник: IP манзил ва браузер тури, хавфсизлик ва сеансларни бошқариш учун."] },
      { id: "who-sees-it", h: "Ким кўради", p: ["Резюмени ким кўришини сиз танлайсиз: ҳамма иш берувчилар, фақат ариза юборган компанияларингиз ёки фақат сиз.", "Телефон ва email фақат сиз ариза юборган ёки сизни таклиф қилган компанияга очилади."] },
      { id: "storage-and-deletion", h: "Сақлаш ва ўчириш", p: ["Маълумотлар Ўзбекистон ҳудудидаги серверларда сақланади.", `Ҳисобингизни ва маълумотларингизни ўчиришни ${EMAIL} орқали сўрашингиз мумкин.`] },
    ],
  },
  terms: {
    title: "Фойдаланиш шартлари",
    lead: "Платформадан фойдаланиб, қуйидаги шартларга розилик билдирасиз.",
    sections: [
      { id: "for-job-seekers", h: "Иш изловчилар учун", p: ["Резюмедаги маълумотлар ҳақиқий бўлиши керак.", "Ҳеч қачон иш учун олдиндан пул тўламанг. Бундай талаблар ҳақида бизга хабар беринг."] },
      { id: "for-employers", h: "Иш берувчилар учун", p: ["Вакансия ҳақиқий иш ўрни ҳақида бўлиши, маош ва шартлар тўғри кўрсатилиши керак.", "Номзодлардан пул сўраш, камситувчи талаблар ва бошқа сайтларга реклама тақиқланади."] },
      { id: "moderation", h: "Модерация", p: ["Қоидаларни бузган вакансия ва ҳисобларни огоҳлантиришсиз блоклаш ҳуқуқини сақлаб қоламиз."] },
    ],
  },
};

const ru: Record<Slug, Page> = {
  about: {
    title: "О проекте",
    lead: "Job Vacancy — платформа для поиска работы и сотрудников любой профессии в Узбекистане.",
    sections: [
      { id: "why", h: "Зачем", p: ["Искать работу должно быть просто: и кассир, и программист за пару минут находят подходящую вакансию и откликаются в один клик.", "Работодатели видят все отклики в одном месте и переписываются с кандидатами прямо на сайте."] },
      { id: "how-it-works", h: "Как это работает", p: ["Поиск понимает узбекский (латиница и кириллица), русский и английский: «dasturchi», «дастурчи» и «программист» дают одинаковый результат.", "Вакансии новых компаний проходят модерацию, проверенные компании отмечены значком."] },
    ],
  },
  contacts: {
    title: "Контакты",
    lead: "Вопрос, предложение или проблема — напишите нам, обычно отвечаем в течение рабочего дня.",
    sections: [
      { id: "email", h: "Email", p: [EMAIL] },
      { id: "report-a-scam", h: "Сообщить о мошенничестве", p: ["Если в вакансии просят заплатить заранее или условия выглядят подозрительно, пришлите ссылку на вакансию. Мы проверим и при необходимости заблокируем её."] },
    ],
  },
  privacy: {
    title: "Политика конфиденциальности",
    lead: "Какие данные мы собираем, зачем и кто их видит.",
    sections: [
      { id: "data-we-collect", h: "Какие данные", p: ["Аккаунт: имя, email, номер телефона (по желанию), хеш пароля.", "Резюме и отклики: опыт, образование, навыки и письма, которые вы указали.", "Технические: IP-адрес и тип браузера — для безопасности и управления сеансами."] },
      { id: "who-sees-it", h: "Кто видит", p: ["Вы сами выбираете, кто видит резюме: все работодатели, только компании, куда вы откликнулись, или только вы.", "Телефон и email открываются только компании, куда вы откликнулись или которая вас пригласила."] },
      { id: "storage-and-deletion", h: "Хранение и удаление", p: ["Данные хранятся на серверах на территории Узбекистана.", `Удалить аккаунт и данные можно по запросу на ${EMAIL}.`] },
    ],
  },
  terms: {
    title: "Условия использования",
    lead: "Пользуясь платформой, вы соглашаетесь с этими условиями.",
    sections: [
      { id: "for-job-seekers", h: "Соискателям", p: ["Данные в резюме должны быть достоверными.", "Никогда не платите заранее за трудоустройство и сообщайте нам о таких требованиях."] },
      { id: "for-employers", h: "Работодателям", p: ["Вакансия должна описывать реальное рабочее место с верными условиями и зарплатой.", "Запрещено брать деньги с кандидатов, дискриминационные требования и реклама сторонних сайтов."] },
      { id: "moderation", h: "Модерация", p: ["Мы оставляем за собой право блокировать вакансии и аккаунты, нарушающие правила, без предупреждения."] },
    ],
  },
};

const en: Record<Slug, Page> = {
  about: {
    title: "About",
    lead: "Job Vacancy is a platform for finding jobs and hiring people in any profession in Uzbekistan.",
    sections: [
      { id: "why", h: "Why", p: ["Looking for work should be simple: a cashier or a developer finds a fitting job in minutes and applies in one click.", "Employers see every application in one place and message candidates right on the site."] },
      { id: "how-it-works", h: "How it works", p: ["Search understands Uzbek (Latin and Cyrillic), Russian and English: \"dasturchi\", \"дастурчи\" and \"программист\" find the same jobs.", "Jobs from new companies are reviewed before they go live; verified companies carry a badge."] },
    ],
  },
  contacts: {
    title: "Contacts",
    lead: "Questions, ideas or problems: write to us. We usually reply within a working day.",
    sections: [
      { id: "email", h: "Email", p: [EMAIL] },
      { id: "report-a-scam", h: "Report a scam", p: ["If a job asks for money upfront or looks suspicious, send us its link. We'll check it and block it if needed."] },
    ],
  },
  privacy: {
    title: "Privacy policy",
    lead: "What we collect, why, and who can see it.",
    sections: [
      { id: "data-we-collect", h: "What we collect", p: ["Account: name, email, phone number (optional), a hash of your password.", "Resumes and applications: the experience, education, skills and letters you enter.", "Technical: IP address and browser type, for security and session management."] },
      { id: "who-sees-it", h: "Who sees it", p: ["You choose who sees your resume: all employers, only companies you applied to, or only you.", "Your phone and email are shared only with companies you apply to or that invite you."] },
      { id: "storage-and-deletion", h: "Storage and deletion", p: ["Data is stored on servers located in Uzbekistan.", `You can ask us to delete your account and data at ${EMAIL}.`] },
    ],
  },
  terms: {
    title: "Terms of use",
    lead: "By using the platform you agree to these terms.",
    sections: [
      { id: "for-job-seekers", h: "For job seekers", p: ["Information in your resume must be truthful.", "Never pay upfront for a job, and tell us about anyone who asks you to."] },
      { id: "for-employers", h: "For employers", p: ["A job must describe a real position with accurate pay and conditions.", "Charging candidates, discriminatory requirements and advertising other sites are not allowed."] },
      { id: "moderation", h: "Moderation", p: ["We may block jobs and accounts that break these rules without notice."] },
    ],
  },
};

// When each legal text last changed (YYYY-MM-DD), shown as "Last updated". Bump it with every
// wording change of privacy or terms.
const UPDATED: Partial<Record<Slug, string>> = { privacy: "2026-09-24", terms: "2026-09-24" };

const all: Record<Locale, Record<Slug, Page>> = { uz, "uz-Cyrl": cyrl, ru, en };
export const getPage = (slug: Slug, locale: Locale): Page & { updated?: string } => ({ ...all[locale][slug], updated: UPDATED[slug] });
