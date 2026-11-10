import type { Locale } from "../i18n/config";

// Static pages. Server-only: the loader sends just the requested page in one language, so
// none of this text ships in the JavaScript bundle.
// NOTE: these are a plain-language starting point and need a lawyer's review
// (Law of the Republic of Uzbekistan "On personal data", No. ZRU-547) before launch.
export type Page = { title: string; lead: string; sections: { h: string; p: string[] }[] };
export const SLUGS = ["about", "contacts", "privacy", "terms", "cookie-policy", "public-offer", "content-rules"] as const;
export type Slug = (typeof SLUGS)[number];

const EMAIL = "hello@jobvacancy.uz";

const uz: Record<Slug, Page> = {
  about: {
    title: "Loyiha haqida",
    lead: "Job Vacancy — O'zbekistondagi har qanday kasb bo'yicha ish va xodim topish platformasi.",
    sections: [
      { h: "Nima uchun", p: ["Ish izlash oson bo'lishi kerak: kassir ham, dasturchi ham bir necha daqiqada mos vakansiyani topib, bir bosishda ariza yubora olsin.", "Ish beruvchilar esa arizalarni bir joyda ko'rib, nomzodlar bilan saytning o'zida yozishadi."] },
      { h: "Qanday ishlaydi", p: ["Qidiruv o'zbek (lotin va kirill), rus va ingliz tillarini tushunadi: «dasturchi», «дастурчи» va «программист» bir xil natija beradi.", "Yangi kompaniyalar vakansiyalari e'lon qilinishidan oldin moderatsiyadan o'tadi, tasdiqlangan kompaniyalar belgi bilan ajratiladi."] },
    ],
  },
  contacts: {
    title: "Aloqa",
    lead: "Savol, taklif yoki muammo bo'lsa, yozing: odatda bir ish kuni ichida javob beramiz.",
    sections: [
      { h: "Email", p: [EMAIL] },
      { h: "Firibgarlik haqida xabar berish", p: ["Vakansiyada oldindan pul so'ralsa yoki shubhali shartlar bo'lsa, vakansiya havolasini emailga yuboring. Biz tekshirib, kerak bo'lsa bloklaymiz."] },
    ],
  },
  privacy: {
    title: "Maxfiylik siyosati",
    lead: "Qanday ma'lumot yig'amiz, nima uchun va kim ko'radi.",
    sections: [
      { h: "Yig'iladigan ma'lumotlar", p: ["Hisob: ism, email, telefon raqami (ixtiyoriy), parolning xesh ko'rinishi.", "Rezyume va arizalar: siz kiritgan tajriba, ta'lim, ko'nikmalar va xatlar.", "Texnik: IP manzil va brauzer turi, xavfsizlik va seanslarni boshqarish uchun."] },
      { h: "Kim ko'radi", p: ["Rezyumeni kim ko'rishini siz tanlaysiz: hamma ish beruvchilar, faqat ariza yuborgan kompaniyalaringiz yoki faqat siz.", "Telefon va email faqat siz ariza yuborgan yoki sizni taklif qilgan kompaniyaga ochiladi."] },
      { h: "Saqlash va o'chirish", p: ["Ma'lumotlar O'zbekiston hududidagi serverlarda saqlanadi.", `Hisobingizni va ma'lumotlaringizni o'chirishni ${EMAIL} orqali so'rashingiz mumkin.`] },
    ],
  },
  terms: {
    title: "Foydalanish shartlari",
    lead: "Platformadan foydalanib, quyidagi shartlarga rozilik bildirasiz.",
    sections: [
      { h: "Ish izlovchilar uchun", p: ["Rezyumedagi ma'lumotlar haqiqiy bo'lishi kerak.", "Hech qachon ish uchun oldindan pul to'lamang. Bunday talablar haqida bizga xabar bering."] },
      { h: "Ish beruvchilar uchun", p: ["Vakansiya haqiqiy ish o'rni haqida bo'lishi, maosh va shartlar to'g'ri ko'rsatilishi kerak.", "Nomzodlardan pul so'rash, kamsituvchi talablar va boshqa saytlarga reklama taqiqlanadi."] },
      { h: "Moderatsiya", p: ["Qoidalarni buzgan vakansiya va hisoblarni ogohlantirishsiz bloklash huquqini saqlab qolamiz."] },
    ],
  },
  "cookie-policy": {
    title: "Cookie siyosati",
    lead: "Saytimiz qanday cookie va shunga o'xshash texnologiyalardan foydalanadi.",
    sections: [
      { h: "Cookie nima", p: ["Cookie — bu brauzeringiz saqlab qo'yadigan va saytga qayta kirganda uni tanish uchun ishlatiladigan kichik matn fayllari. Ular sayt xavfsizligi, til va sozlamalar uchun zarur."] },
      { h: "Qanday cookie ishlatamiz", p: ["Zaruriy cookie: tizimga kirish, xavfsizlik va saytning asosiy ishlashi uchun. Bu cookie'lar o'chirilmaydi.", "Analitik cookie: qaysi sahifalar ko'rilayotganini va xatolarini tushunish uchun. Faqat siz rozilik bildirganingizdan keyin yoqiladi.", "Reklama cookie: hozircha ishlatilmaydi. Agar kelajakda qo'shilsa, alohida rozilik so'raladi."] },
      { h: "Boshqarish", p: ["Brauzer sozlamalaridan cookie'larni istalgan vaqtida o'chirib tashlashingiz mumkin. Biroq zaruriy cookie'lar o'chirilsa, saytning ba'zi funksiyalari ishlamasligi mumkin.", `Savollar bo'lsa ${EMAIL} orqali yozing.`] },
    ],
  },
  "public-offer": {
    title: "Ommaviy oferta",
    lead: "Platformaning pullik xizmatlarini sotib olish shartlari.",
    sections: [
      { h: "Tomonlar", p: ["Xizmat ko'rsatuvchi: Job Vacancy platformasi.", "Xaridor: saytda ro'yxatdan o'tgan va pullik xizmatlarni sotib olgan yuridik yoki jismoniy shaxs."] },
      { h: "Xizmatlar va to'lov", p: ["Pullik xizmatlar (masalan, TOP vakansiya, nomzodlar bazasiga kirish) akkauntga ulangan tarifda ko'rsatiladi.", "To'lov elektron hamyonlar yoki bank kartalari orqali onlayn amalga oshiriladi."] },
      { h: "Qaytarib olish", p: ["Xizmat ko'rsatilganidan keyin pul qaytarilmaydi. Agar xizmat texnik sabablar bilan ko'rsatilmagan bo'lsa, keyingi davrga o'tkaziladi yoki pul qaytariladi.", `Nizolarni ${EMAIL} orqali hal qilamiz.`] },
    ],
  },
  "content-rules": {
    title: "Foydalanuvchi kontenti qoidalari",
    lead: "Vakansiya, rezyume, xabar va boshqa kontentga qo'yiladigan talablar.",
    sections: [
      { h: "Taqiqlangan kontent", p: ["Yolg'on ma'lumot, firibgarlik, oldindan pul talab qilish, kamsituvchi til va noqonuniy ish takliflari.", "Boshqa saytlarga reklama, spam, takroriy e'lonlar va haqoratli matnlar."] },
      { h: "Huquqlar", p: ["Joylangan matn va rasmlar uchinchi tomon huquqlarini buzmasligi kerak. Agar shikoyat kelib tushsa, kontent olib tashlanishi mumkin.", "Platforma qoidalarni buzgan kontentni ogohlantirishsiz o'chirish huquqini o'zida saqlaydi."] },
      { h: "Shikoyat", p: ["Har qanday kontentga «Shikoyat qilish» tugmasi orqali murojaat qilishingiz mumkin. Administratorlar uni ko'rib chiqadi va natijani bildirishnoma bilan xabar qiladi."] },
    ],
  },
};

const cyrl: Record<Slug, Page> = {
  about: {
    title: "Лойиҳа ҳақида",
    lead: "Job Vacancy — Ўзбекистондаги ҳар қандай касб бўйича иш ва ходим топиш платформаси.",
    sections: [
      { h: "Нима учун", p: ["Иш излаш осон бўлиши керак: кассир ҳам, дастурчи ҳам бир неча дақиқада мос вакансияни топиб, бир босишда ариза юбора олсин.", "Иш берувчилар эса аризаларни бир жойда кўриб, номзодлар билан сайтнинг ўзида ёзишади."] },
      { h: "Қандай ишлайди", p: ["Қидирув ўзбек (лотин ва кирилл), рус ва инглиз тилларини тушунади: «dasturchi», «дастурчи» ва «программист» бир хил натижа беради.", "Янги компаниялар вакансиялари эълон қилинишидан олдин модерациядан ўтади, тасдиқланган компаниялар белги билан ажратилади."] },
    ],
  },
  contacts: {
    title: "Алоқа",
    lead: "Савол, таклиф ёки муаммо бўлса, ёзинг: одатда бир иш куни ичида жавоб берамиз.",
    sections: [
      { h: "Email", p: [EMAIL] },
      { h: "Фирибгарлик ҳақида хабар бериш", p: ["Вакансияда олдиндан пул сўралса ёки шубҳали шартлар бўлса, вакансия ҳаволасини эмаилга юборинг. Биз текшириб, керак бўлса блоклаймиз."] },
    ],
  },
  privacy: {
    title: "Махфийлик сиёсати",
    lead: "Қандай маълумот йиғамиз, нима учун ва ким кўради.",
    sections: [
      { h: "Йиғиладиган маълумотлар", p: ["Ҳисоб: исм, email, телефон рақами (ихтиёрий), паролнинг хеш кўриниши.", "Резюме ва аризалар: сиз киритган тажриба, таълим, кўникмалар ва хатлар.", "Техник: IP манзил ва браузер тури, хавфсизлик ва сеансларни бошқариш учун."] },
      { h: "Ким кўради", p: ["Резюмени ким кўришини сиз танлайсиз: ҳамма иш берувчилар, фақат ариза юборган компанияларингиз ёки фақат сиз.", "Телефон ва email фақат сиз ариза юборган ёки сизни таклиф қилган компанияга очилади."] },
      { h: "Сақлаш ва ўчириш", p: ["Маълумотлар Ўзбекистон ҳудудидаги серверларда сақланади.", `Ҳисобингизни ва маълумотларингизни ўчиришни ${EMAIL} орқали сўрашингиз мумкин.`] },
    ],
  },
  terms: {
    title: "Фойдаланиш шартлари",
    lead: "Платформадан фойдаланиб, қуйидаги шартларга розилик билдирасиз.",
    sections: [
      { h: "Иш изловчилар учун", p: ["Резюмедаги маълумотлар ҳақиқий бўлиши керак.", "Ҳеч қачон иш учун олдиндан пул тўламанг. Бундай талаблар ҳақида бизга хабар беринг."] },
      { h: "Иш берувчилар учун", p: ["Вакансия ҳақиқий иш ўрни ҳақида бўлиши, маош ва шартлар тўғри кўрсатилиши керак.", "Номзодлардан пул сўраш, камситувчи талаблар ва бошқа сайтларга реклама тақиқланади."] },
      { h: "Модерация", p: ["Қоидаларни бузган вакансия ва ҳисобларни огоҳлантиришсиз блоклаш ҳуқуқини сақлаб қоламиз."] },
    ],
  },
  "cookie-policy": {
    title: "Cookie сиёсати",
    lead: "Сайтимиз қандай cookie ва шунга ўхшаш технологиялардан фойдаланади.",
    sections: [
      { h: "Cookie нима", p: ["Cookie — бу браузерингиз сақлаб қоладиган ва сайтга қайта кирганда уни таниш учун ишлатиладиган кичик матн файллари. Улар сайт хавфсизлиги, тил ва созламалар учун зарур."] },
      { h: "Қандай cookie ишлатамиз", p: ["Зарурий cookie: тизимга кириш, хавфсизлик ва сайтнинг асосий ишлаши учун. Бу cookie'лар ўчирилмайди.", "Аналитик cookie: қайси саҳифалар кўрилаётганини ва хатоларини тушуниш учун. Фақат сиз розилик билдирганингиздан кейин ёқилади.", "Реклама cookie: ҳозирча ишлатилмайди. Агар келажакда қўшилса, алоҳида розилик сўралади."] },
      { h: "Бошқариш", p: ["Браузер созламаларидан cookie'ларни исталган вақтида ўчириб ташлашингиз мумкин. Бироқ зарурий cookie'лар ўчирилса, сайтнинг баъзи функциялари ишламаслиги мумкин.", `Саволлар бўлса ${EMAIL} орқали ёзинг.`] },
    ],
  },
  "public-offer": {
    title: "Оммавий оферта",
    lead: "Платманинг пуллик хизматларини сотиб олиш шартлари.",
    sections: [
      { h: "Томонлар", p: ["Хизмат кўрсатувчи: Job Vacancy платформаси.", "Харидор: сайтда рўйхатдан ўтган ва пуллик хизматларни сотиб олган юридик ёки жисмоний шахс."] },
      { h: "Хизматлар ва тўлов", p: ["Пуллик хизматлар (масалан, TOP вакансия, номзодлар базасига кириш) аккаунтга уланган тарифда кўрсатилади.", "Тўлов электрон ҳамёнлар ёки банк карталари орқали онлайн амалга оширилади."] },
      { h: "Қайтариб олиш", p: ["Хизмат кўрсатилгандан кейин пул қайтарилмайди. Агар хизмат техник сабаблар билан кўрсатилмаган бўлса, кейинги даврга ўтказилади ёки пул қайтарилади.", `Низоларни ${EMAIL} орқали ҳал қиламиз.`] },
    ],
  },
  "content-rules": {
    title: "Фойдаланувчи контенти қоидалари",
    lead: "Вакансия, резюме, хabar ва бошқа контентга қўйиладиган талаблар.",
    sections: [
      { h: "Тақиқланган контент", p: ["Ёлғон маълумот, фирибгарлик, олдиндан пул талаб қилиш, камситувчи тил ва ноқонуний иш таклифлари.", "Бошқа сайтларга реклама, спам, такрорий эълонлар ва ҳақоратли матнлар."] },
      { h: "Huquqlar", p: ["Жойланган матн ва расмлар учинчи томон ҳуқуқларини бузмаслиги керак. Агар шикоят келиб тушса, контент олиб ташланиши мумкин.", "Платформа қоидаларни бузган контентни огоҳлантиришсиз ўчириш ҳуқуқини ўзида сақлайди."] },
      { h: "Шикоят", p: ["Ҳар қандай контентга «Шикоят қилиш» тугмаси орқали мурожаат қилишингиз мумкин. Администраторлар уни кўриб чиқади ва натижани билдиришнома билан хабар қилади."] },
    ],
  },
};

const ru: Record<Slug, Page> = {
  about: {
    title: "О проекте",
    lead: "Job Vacancy — платформа для поиска работы и сотрудников любой профессии в Узбекистане.",
    sections: [
      { h: "Зачем", p: ["Искать работу должно быть просто: и кассир, и программист за пару минут находят подходящую вакансию и откликаются в один клик.", "Работодатели видят все отклики в одном месте и переписываются с кандидатами прямо на сайте."] },
      { h: "Как это работает", p: ["Поиск понимает узбекский (латиница и кириллица), русский и английский: «dasturchi», «дастурчи» и «программист» дают одинаковый результат.", "Вакансии новых компаний проходят модерацию, проверенные компании отмечены значком."] },
    ],
  },
  contacts: {
    title: "Контакты",
    lead: "Вопрос, предложение или проблема — напишите нам, обычно отвечаем в течение рабочего дня.",
    sections: [
      { h: "Email", p: [EMAIL] },
      { h: "Сообщить о мошенничестве", p: ["Если в вакансии просят заплатить заранее или условия выглядят подозрительно, пришлите ссылку на вакансию. Мы проверим и при необходимости заблокируем её."] },
    ],
  },
  privacy: {
    title: "Политика конфиденциальности",
    lead: "Какие данные мы собираем, зачем и кто их видит.",
    sections: [
      { h: "Какие данные", p: ["Аккаунт: имя, email, номер телефона (по желанию), хеш пароля.", "Резюме и отклики: опыт, образование, навыки и письма, которые вы указали.", "Технические: IP-адрес и тип браузера — для безопасности и управления сеансами."] },
      { h: "Кто видит", p: ["Вы сами выбираете, кто видит резюме: все работодатели, только компании, куда вы откликнулись, или только вы.", "Телефон и email открываются только компании, куда вы откликнулись или которая вас пригласила."] },
      { h: "Хранение и удаление", p: ["Данные хранятся на серверах на территории Узбекистана.", `Удалить аккаунт и данные можно по запросу на ${EMAIL}.`] },
    ],
  },
  terms: {
    title: "Условия использования",
    lead: "Пользуясь платформой, вы соглашаетесь с этими условиями.",
    sections: [
      { h: "Соискателям", p: ["Данные в резюме должны быть достоверными.", "Никогда не платите заранее за трудоустройство и сообщайте нам о таких требованиях."] },
      { h: "Работодателям", p: ["Вакансия должна описывать реальное рабочее место с верными условиями и зарплатой.", "Запрещено брать деньги с кандидатов, дискриминационные требования и реклама сторонних сайтов."] },
      { h: "Модерация", p: ["Мы оставляем за собой право блокировать вакансии и аккаунты, нарушающие правила, без предупреждения."] },
    ],
  },
  "cookie-policy": {
    title: "Политика использования cookie",
    lead: "Какие cookie и похожие технологии использует наш сайт.",
    sections: [
      { h: "Что такое cookie", p: ["Cookie — это небольшие текстовые файлы, которые сохраняет ваш браузер и которые сайт использует, чтобы узнать вас при повторном визите. Они нужны для безопасности, языка и настроек."] },
      { h: "Какие cookie мы используем", p: ["Необходимые cookie: для входа, безопасности и базовой работы сайта. Их нельзя отключить.", "Аналитические cookie: чтобы понимать, какие страницы просматривают, и находить ошибки. Включаются только после вашего согласия.", "Рекламные cookie: сейчас не используются. Если появятся в будущем, будет запрошено отдельное согласие."] },
      { h: "Управление", p: ["Вы можете удалить cookie в настройках браузера в любое время. Однако при отключении необходимых cookie часть функций сайта может перестать работать.", `Вопросы — ${EMAIL}.`] },
    ],
  },
  "public-offer": {
    title: "Публичная оферта",
    lead: "Условия приобретения платных услуг платформы.",
    sections: [
      { h: "Стороны", p: ["Исполнитель: платформа Job Vacancy.", "Заказчик: юридическое или физическое лицо, зарегистрированное на сайте и приобретшее платную услугу."] },
      { h: "Услуги и оплата", p: ["Платные услуги (например, TOP-вакансия, доступ к базе кандидатов) предоставляются в рамках тарифа, подключённого к аккаунту.", "Оплата производится онлайн через электронные кошельки или банковские карты."] },
      { h: "Возврат", p: ["После оказания услуги деньги не возвращаются. Если услуга не была оказана по техническим причинам, она переносится на следующий период или возвращается оплата.", `Споры решаем через ${EMAIL}.`] },
    ],
  },
  "content-rules": {
    title: "Правила пользовательского контента",
    lead: "Требования к вакансиям, резюме, сообщениям и другому контенту.",
    sections: [
      { h: "Запрещённый контент", p: ["Ложная информация, мошенничество, требование предоплаты, дискриминационная речь и незаконные предложения работы.", "Реклама других сайтов, спам, повторяющиеся объявления и оскорбительные тексты."] },
      { h: "Права", p: ["Размещённые тексты и изображения не должны нарушать права третьих лиц. При поступлении жалобы контент может быть удалён.", "Платформа оставляет за собой право удалять контент, нарушающий правила, без предупреждения."] },
      { h: "Жалоба", p: ["На любой контент можно пожаловаться кнопкой «Пожаловаться». Администраторы рассмотрят жалобу и сообщат результат уведомлением."] },
    ],
  },
};

const en: Record<Slug, Page> = {
  about: {
    title: "About",
    lead: "Job Vacancy is a platform for finding jobs and hiring people in any profession in Uzbekistan.",
    sections: [
      { h: "Why", p: ["Looking for work should be simple: a cashier or a developer finds a fitting job in minutes and applies in one click.", "Employers see every application in one place and message candidates right on the site."] },
      { h: "How it works", p: ["Search understands Uzbek (Latin and Cyrillic), Russian and English: \"dasturchi\", \"дастурчи\" and \"программист\" find the same jobs.", "Jobs from new companies are reviewed before they go live; verified companies carry a badge."] },
    ],
  },
  contacts: {
    title: "Contacts",
    lead: "Questions, ideas or problems: write to us. We usually reply within a working day.",
    sections: [
      { h: "Email", p: [EMAIL] },
      { h: "Report a scam", p: ["If a job asks for money upfront or looks suspicious, send us its link. We'll check it and block it if needed."] },
    ],
  },
  privacy: {
    title: "Privacy policy",
    lead: "What we collect, why, and who can see it.",
    sections: [
      { h: "What we collect", p: ["Account: name, email, phone number (optional), a hash of your password.", "Resumes and applications: the experience, education, skills and letters you enter.", "Technical: IP address and browser type, for security and session management."] },
      { h: "Who sees it", p: ["You choose who sees your resume: all employers, only companies you applied to, or only you.", "Your phone and email are shared only with companies you apply to or that invite you."] },
      { h: "Storage and deletion", p: ["Data is stored on servers located in Uzbekistan.", `You can ask us to delete your account and data at ${EMAIL}.`] },
    ],
  },
  terms: {
    title: "Terms of use",
    lead: "By using the platform you agree to these terms.",
    sections: [
      { h: "For job seekers", p: ["Information in your resume must be truthful.", "Never pay upfront for a job, and tell us about anyone who asks you to."] },
      { h: "For employers", p: ["A job must describe a real position with accurate pay and conditions.", "Charging candidates, discriminatory requirements and advertising other sites are not allowed."] },
      { h: "Moderation", p: ["We may block jobs and accounts that break these rules without notice."] },
    ],
  },
  "cookie-policy": {
    title: "Cookie policy",
    lead: "What cookies and similar technologies our site uses.",
    sections: [
      { h: "What cookies are", p: ["Cookies are small text files saved by your browser that a site uses to recognize you when you return. They are needed for security, language and settings."] },
      { h: "Cookies we use", p: ["Essential cookies: for sign-in, security and the site's basic operation. These cannot be turned off.", "Analytics cookies: to understand which pages are viewed and to find errors. Enabled only after you consent.", "Advertising cookies: not used at the moment. If we add them in the future, we will ask for separate consent."] },
      { h: "Managing cookies", p: ["You can delete cookies in your browser settings at any time. However, disabling essential cookies may break some site features.", `Questions? Write to ${EMAIL}.`] },
    ],
  },
  "public-offer": {
    title: "Public offer",
    lead: "Terms for purchasing paid services on the platform.",
    sections: [
      { h: "Parties", p: ["Provider: the Job Vacancy platform.", "Customer: a legal entity or individual registered on the site and purchasing a paid service."] },
      { h: "Services and payment", p: ["Paid services (for example, TOP job posting, candidate database access) are provided under the tariff connected to the account.", "Payment is made online via e-wallets or bank cards."] },
      { h: "Refund", p: ["No refund is given after the service has been rendered. If a service could not be provided for technical reasons, it is moved to the next period or refunded.", `Disputes are resolved via ${EMAIL}.`] },
    ],
  },
  "content-rules": {
    title: "User content rules",
    lead: "Requirements for jobs, resumes, messages and other content.",
    sections: [
      { h: "Prohibited content", p: ["False information, fraud, requests for upfront payment, discriminatory language and illegal job offers.", "Advertising other sites, spam, repeated postings and abusive text."] },
      { h: "Rights", p: ["Posted text and images must not infringe third-party rights. If a complaint is received, the content may be removed.", "The platform reserves the right to remove content that violates the rules without notice."] },
      { h: "Reporting", p: ["You can report any content using the \"Report\" button. Administrators will review it and notify you of the outcome."] },
    ],
  },
};

const all: Record<Locale, Record<Slug, Page>> = { uz, "uz-Cyrl": cyrl, ru, en };
export const getPage = (slug: Slug, locale: Locale) => all[locale][slug];
