package main

// Content for `ctl seed-demo`: invented companies, people and job texts for showing the
// product. Uzbek first, some Russian, Uzbekistan job market. No real brands.

// Demo accounts: every demo user's email ends with demoDomain, which is how purge-demo
// finds them. The three main accounts keep the credentials of test/e2e/seed_demo.sh.
const (
	demoDomain   = "@demo.uz"
	demoPassword = "Secret123"
)

// Skills the seeder introduces that are not in the verified catalog: they fill the admin
// "new skills" queue. purge-demo removes them again when nothing else uses them.
var demoNewSkills = []string{"React.js", "1C Buxgalteriya 8.3", "Ms Excel", "Telegram botlar", "Kassa apparati", "Instagram Reels"}

// role is a job family: titles for one leaf category, the skills it asks for and its
// usual monthly pay in million UZS.
type role struct {
	titles   []string
	skills   []string
	pay      [2]int // million UZS, min..max of salary_min
	usdShare int    // percent of vacancies paid in USD (IT)
}

var roles = map[string]role{
	"it-backend":        {[]string{"Go backend dasturchi", "Python (Django) dasturchi", "Java backend dasturchi", "PHP (Laravel) dasturchi", "Senior Backend Engineer"}, []string{"Go", "Python", "Java", "PHP", "Laravel", "Django", "PostgreSQL", "Redis", "Docker", "REST API", "Git"}, [2]int{9, 30}, 35},
	"it-frontend":       {[]string{"Frontend dasturchi (React)", "Vue.js dasturchi", "Junior Frontend dasturchi"}, []string{"JavaScript", "TypeScript", "React", "React.js", "Vue.js", "Next.js", "HTML", "CSS", "Tailwind CSS"}, [2]int{7, 25}, 30},
	"it-fullstack":      {[]string{"Fullstack dasturchi", "Fullstack dasturchi (Node.js + React)"}, []string{"Node.js", "React", "TypeScript", "PostgreSQL", "MongoDB", "Docker"}, [2]int{10, 28}, 30},
	"it-mobile":         {[]string{"Flutter dasturchi", "iOS dasturchi (Swift)", "Android dasturchi (Kotlin)"}, []string{"Flutter", "Dart", "Swift", "Kotlin", "REST API", "Git"}, [2]int{9, 26}, 30},
	"it-devops":         {[]string{"DevOps muhandisi", "Tizim administratori"}, []string{"Linux", "Docker", "Kubernetes", "AWS", "PostgreSQL", "Git"}, [2]int{10, 30}, 25},
	"it-qa":             {[]string{"QA muhandisi", "Manual tester"}, []string{"SQL", "REST API", "Git"}, [2]int{6, 15}, 10},
	"it-data":           {[]string{"Data analitik", "Machine Learning muhandisi"}, []string{"Python", "SQL", "Power BI", "Machine Learning", "Ms Excel"}, [2]int{9, 28}, 25},
	"it-design":         {[]string{"UI/UX dizayner", "Mahsulot dizayneri"}, []string{"Figma", "Adobe Photoshop", "Adobe Illustrator"}, [2]int{7, 20}, 20},
	"it-pm":             {[]string{"Loyiha menejeri (IT)", "Product Manager"}, []string{"CRM", "Bitrix24", "Microsoft Excel"}, [2]int{10, 25}, 15},
	"it-security":       {[]string{"Axborot xavfsizligi mutaxassisi"}, []string{"Linux", "Docker", "Python"}, [2]int{12, 30}, 15},
	"it-support":        {[]string{"Texnik yordam mutaxassisi", "Helpdesk operatori"}, []string{"Linux", "Microsoft Word", "Microsoft Excel"}, [2]int{4, 8}, 0},
	"it-1c":             {[]string{"1C dasturchi", "1C konsultant"}, []string{"1C", "1C Buxgalteriya 8.3", "SQL"}, [2]int{8, 18}, 0},
	"sales-manager":     {[]string{"Savdo menejeri", "Sotuv bo'limi rahbari", "Менеджер по продажам"}, []string{"CRM", "amoCRM", "Bitrix24", "Microsoft Excel"}, [2]int{5, 12}, 0},
	"sales-consultant":  {[]string{"Sotuvchi-konsultant", "Maishiy texnika do'koniga sotuvchi"}, []string{"Kassa apparati", "CRM"}, [2]int{3, 6}, 0},
	"sales-cashier":     {[]string{"Kassir", "Supermarketga kassir", "Кассир"}, []string{"Kassa apparati", "Microsoft Excel"}, [2]int{3, 5}, 0},
	"sales-agent":       {[]string{"Savdo agenti", "Torgoviy agent (FMCG)"}, []string{"CRM", "Ms Excel"}, [2]int{4, 9}, 0},
	"sales-b2b":         {[]string{"B2B savdo menejeri", "Korporativ mijozlar menejeri"}, []string{"CRM", "amoCRM", "Microsoft PowerPoint"}, [2]int{7, 15}, 0},
	"mkt-smm":           {[]string{"SMM mutaxassisi", "SMM menejer"}, []string{"SMM", "Instagram Reels", "Copywriting", "Adobe Photoshop"}, [2]int{4, 10}, 0},
	"mkt-marketer":      {[]string{"Marketolog", "Marketing bo'limi rahbari"}, []string{"Google Ads", "Meta Ads", "SEO", "Google Sheets"}, [2]int{7, 18}, 0},
	"mkt-content":       {[]string{"Kopirayter", "Kontent menejer"}, []string{"Copywriting", "SMM", "SEO"}, [2]int{4, 9}, 0},
	"mkt-graphic":       {[]string{"Grafik dizayner", "Motion dizayner"}, []string{"Adobe Photoshop", "Adobe Illustrator", "CorelDRAW", "Figma"}, [2]int{5, 12}, 0},
	"mkt-ads":           {[]string{"Target reklama mutaxassisi", "Kontekst reklama mutaxassisi"}, []string{"Meta Ads", "Google Ads", "Google Sheets"}, [2]int{5, 12}, 0},
	"fin-accountant":    {[]string{"Buxgalter", "Bosh buxgalter", "Бухгалтер"}, []string{"1C", "1C Buxgalteriya 8.3", "Ms Excel", "Microsoft Excel"}, [2]int{5, 14}, 0},
	"fin-economist":     {[]string{"Iqtisodchi", "Moliyaviy tahlilchi"}, []string{"Microsoft Excel", "Power BI", "IFRS"}, [2]int{6, 15}, 0},
	"fin-audit":         {[]string{"Ichki auditor", "Auditor yordamchisi"}, []string{"IFRS", "Microsoft Excel"}, [2]int{7, 16}, 0},
	"fin-bank":          {[]string{"Bank operatsionisti", "Kredit mutaxassisi"}, []string{"Microsoft Excel", "CRM"}, [2]int{5, 10}, 0},
	"fin-insurance":     {[]string{"Sug'urta agenti"}, []string{"CRM", "Microsoft Word"}, [2]int{4, 8}, 0},
	"edu-teacher":       {[]string{"Matematika o'qituvchisi", "Boshlang'ich sinf o'qituvchisi", "Fizika o'qituvchisi"}, []string{"Microsoft PowerPoint", "Microsoft Word"}, [2]int{4, 9}, 0},
	"edu-tutor":         {[]string{"Repetitor (matematika)", "Repetitor (ingliz tili)"}, []string{"Microsoft PowerPoint"}, [2]int{3, 7}, 0},
	"edu-language":      {[]string{"Ingliz tili o'qituvchisi (IELTS)", "Rus tili o'qituvchisi", "Koreys tili o'qituvchisi"}, []string{"Microsoft PowerPoint"}, [2]int{5, 12}, 0},
	"edu-kindergarten":  {[]string{"Bog'cha tarbiyachisi", "Xususiy bog'chaga tarbiyachi"}, nil, [2]int{3, 5}, 0},
	"edu-university":    {[]string{"Universitet o'qituvchisi (iqtisodiyot)", "Kafedra assistenti"}, []string{"Microsoft PowerPoint", "Microsoft Word"}, [2]int{6, 12}, 0},
	"med-doctor":        {[]string{"Terapevt", "Pediatr", "Kardiolog", "Врач-терапевт"}, nil, [2]int{8, 20}, 0},
	"med-nurse":         {[]string{"Hamshira", "Operatsion hamshira"}, nil, [2]int{4, 7}, 0},
	"med-pharmacist":    {[]string{"Farmatsevt", "Dorixonaga provizor"}, []string{"Kassa apparati"}, [2]int{4, 8}, 0},
	"med-dentist":       {[]string{"Stomatolog-terapevt", "Ortodont"}, nil, [2]int{10, 25}, 0},
	"med-lab":           {[]string{"Laborant", "Klinik laboratoriya mutaxassisi"}, nil, [2]int{4, 7}, 0},
	"con-builder":       {[]string{"Quruvchi (g'isht teruvchi)", "Prorab"}, []string{"AutoCAD"}, [2]int{5, 12}, 0},
	"con-electrician":   {[]string{"Elektrik", "Elektromontajchi"}, nil, [2]int{5, 10}, 0},
	"con-plumber":       {[]string{"Santexnik"}, nil, [2]int{4, 9}, 0},
	"con-engineer":      {[]string{"Qurilish muhandisi", "Smetachi muhandis"}, []string{"AutoCAD", "Revit", "Microsoft Excel"}, [2]int{8, 18}, 0},
	"con-architect":     {[]string{"Arxitektor", "Interyer dizayneri"}, []string{"AutoCAD", "Revit", "Adobe Photoshop"}, [2]int{8, 20}, 0},
	"con-finishing":     {[]string{"Shtukatur", "Kafel ustasi", "Pardozlash ustasi"}, nil, [2]int{5, 10}, 0},
	"mfg-operator":      {[]string{"CNC stanok operatori", "Ishlab chiqarish liniyasi operatori"}, nil, [2]int{5, 9}, 0},
	"mfg-technologist":  {[]string{"Texnolog (oziq-ovqat)", "Tikuv texnologi"}, []string{"Microsoft Excel"}, [2]int{6, 12}, 0},
	"mfg-welder":        {[]string{"Payvandchi", "Argon payvandchi"}, nil, [2]int{6, 12}, 0},
	"mfg-sewing":        {[]string{"Tikuvchi", "Bichuvchi"}, nil, [2]int{3, 7}, 0},
	"mfg-worker":        {[]string{"Ishlab chiqarish ishchisi", "Qadoqlovchi"}, nil, [2]int{3, 5}, 0},
	"log-driver":        {[]string{"Haydovchi (B toifa)", "Yuk mashinasi haydovchisi (C toifa)", "Водитель-экспедитор"}, nil, [2]int{5, 10}, 0},
	"log-courier":       {[]string{"Kuryer (piyoda)", "Kuryer (shaxsiy avtomobil bilan)"}, nil, [2]int{3, 7}, 0},
	"log-logist":        {[]string{"Logist", "Xalqaro yuk tashish logisti"}, []string{"Microsoft Excel", "CRM"}, [2]int{7, 15}, 0},
	"log-warehouse":     {[]string{"Omborchi", "Ombor mudiri", "Yuk tashuvchi"}, []string{"1C", "Ms Excel"}, [2]int{4, 8}, 0},
	"hos-cook":          {[]string{"Oshpaz (milliy taomlar)", "Su-shef", "Konditer"}, nil, [2]int{5, 12}, 0},
	"hos-waiter":        {[]string{"Ofitsiant", "Restoranga ofitsiant"}, nil, [2]int{3, 6}, 0},
	"hos-barista":       {[]string{"Barista"}, []string{"Kassa apparati"}, [2]int{3, 6}, 0},
	"hos-admin":         {[]string{"Mehmonxona administratori", "Restoran administratori"}, []string{"Microsoft Excel"}, [2]int{4, 8}, 0},
	"hos-tourism":       {[]string{"Turizm menejeri", "Gid-tarjimon"}, []string{"CRM"}, [2]int{5, 11}, 0},
	"bty-hairdresser":   {[]string{"Sartarosh (barber)", "Ayollar sartaroshi"}, nil, [2]int{4, 10}, 0},
	"bty-cosmetologist": {[]string{"Kosmetolog"}, nil, [2]int{5, 12}, 0},
	"bty-nails":         {[]string{"Manikyur ustasi"}, nil, [2]int{3, 8}, 0},
	"bty-trainer":       {[]string{"Fitnes murabbiy", "Suzish murabbiyi"}, nil, [2]int{4, 9}, 0},
	"off-manager":       {[]string{"Ofis menejeri", "Administrator-ofis menejer"}, []string{"Microsoft Word", "Microsoft Excel", "Google Sheets"}, [2]int{4, 8}, 0},
	"off-secretary":     {[]string{"Kotiba", "Rahbar yordamchisi"}, []string{"Microsoft Word", "Microsoft Excel"}, [2]int{4, 8}, 0},
	"off-callcenter":    {[]string{"Call-markaz operatori", "Оператор call-центра"}, []string{"CRM", "Bitrix24"}, [2]int{3, 6}, 0},
	"off-translator":    {[]string{"Tarjimon (ingliz tili)", "Tarjimon (koreys tili)"}, []string{"Microsoft Word"}, [2]int{5, 12}, 0},
	"hr-manager":        {[]string{"HR menejer", "HR bo'limi rahbari"}, []string{"1C", "Microsoft Excel", "Bitrix24"}, [2]int{6, 15}, 0},
	"hr-recruiter":      {[]string{"Rekruter", "IT rekruter"}, []string{"CRM", "Google Sheets"}, [2]int{5, 12}, 0},
	"law-lawyer":        {[]string{"Yurist", "Korporativ yurist", "Юрист"}, []string{"Microsoft Word"}, [2]int{7, 18}, 0},
	"law-notary":        {[]string{"Notarius yordamchisi"}, []string{"Microsoft Word"}, [2]int{4, 8}, 0},
	"sec-guard":         {[]string{"Qo'riqchi", "Xavfsizlik xizmati xodimi"}, nil, [2]int{3, 5}, 0},
	"svc-cleaner":       {[]string{"Farrosh", "Ofisga farrosh"}, nil, [2]int{2, 4}, 0},
	"svc-nanny":         {[]string{"Enaga", "Uy yordamchisi"}, nil, [2]int{3, 6}, 0},
	"svc-repair":        {[]string{"Maishiy texnika ustasi", "Konditsioner ustasi"}, nil, [2]int{4, 9}, 0},
	"agr-agronomist":    {[]string{"Agronom", "Bosh agronom"}, []string{"Microsoft Excel"}, [2]int{5, 12}, 0},
	"agr-vet":           {[]string{"Veterinar"}, nil, [2]int{5, 10}, 0},
	"agr-worker":        {[]string{"Issiqxona ishchisi", "Fermer xo'jaligi ishchisi"}, nil, [2]int{3, 5}, 0},
	"mda-journalist":    {[]string{"Jurnalist", "Muxbir"}, []string{"Copywriting"}, [2]int{5, 10}, 0},
	"mda-photo":         {[]string{"Fotograf", "Videograf"}, []string{"Adobe Premiere Pro", "Adobe Photoshop"}, [2]int{5, 12}, 0},
	"mda-editor":        {[]string{"Video montajchi"}, []string{"Adobe Premiere Pro"}, [2]int{5, 12}, 0},
}

// Weights for picking a leaf category: the market leans to sales, service and IT.
var familyWeight = map[string]int{
	"it": 7, "sales": 6, "marketing": 3, "finance": 3, "education": 3, "medicine": 3, "construction": 3,
	"manufacturing": 3, "logistics": 4, "hospitality": 4, "beauty": 2, "office": 3, "hr": 2, "legal": 1,
	"security": 1, "services": 2, "agriculture": 1, "media": 1,
}

var duties = map[string][]string{
	"it":            {"Yangi funksiyalarni loyihalash va ishlab chiqish", "Kod sifatini nazorat qilish va code review", "Jamoa bilan sprint rejalashtirish", "Mavjud tizimni optimallashtirish va xatolarni tuzatish"},
	"sales":         {"Mijozlar bilan muloqot va ehtiyojini aniqlash", "Savdo rejasini bajarish", "CRM tizimida bitimlarni yuritish", "Mahsulot haqida maslahat berish"},
	"marketing":     {"Kontent reja tuzish va bajarish", "Reklama kampaniyalarini yuritish", "Natijalarni tahlil qilish va hisobot tayyorlash", "Brend uslubini saqlash"},
	"finance":       {"Buxgalteriya hisobini yuritish", "Soliq hisobotlarini o'z vaqtida topshirish", "Bank operatsiyalarini nazorat qilish", "Oylik hisobotlarni tayyorlash"},
	"education":     {"Darslarni o'quv dasturi asosida o'tish", "O'quvchilar natijasini kuzatish", "Ota-onalar bilan muloqot", "Dars materiallarini tayyorlash"},
	"medicine":      {"Bemorlarni qabul qilish va ko'rikdan o'tkazish", "Tibbiy hujjatlarni yuritish", "Sanitariya qoidalariga rioya qilish", "Hamkasblar bilan maslahatlashish"},
	"construction":  {"Obyektda ishlarni bajarish", "Chizmalar asosida ishlash", "Xavfsizlik texnikasiga rioya qilish", "Materiallar sarfini nazorat qilish"},
	"manufacturing": {"Uskunada belgilangan reja bo'yicha ishlash", "Mahsulot sifatini tekshirish", "Ish joyini tartibda saqlash", "Smena hisobotini topshirish"},
	"logistics":     {"Yuklarni o'z vaqtida yetkazib berish", "Hujjatlarni rasmiylashtirish", "Marshrutni rejalashtirish", "Ombor qoldiqlarini nazorat qilish"},
	"hospitality":   {"Mehmonlarni xushmuomalalik bilan kutib olish", "Buyurtmalarni qabul qilish va berish", "Sanitariya me'yorlariga rioya qilish", "Jamoa bilan hamkorlik"},
	"beauty":        {"Mijozlarga sifatli xizmat ko'rsatish", "Asbob-uskunalarni sterilizatsiya qilish", "Mijozlar bazasini kengaytirish", "Yangi trendlarni o'rganish"},
	"office":        {"Hujjat aylanishini yuritish", "Qo'ng'iroqlarga javob berish", "Uchrashuvlarni tashkil qilish", "Ofis xo'jaligini nazorat qilish"},
	"hr":            {"Nomzodlarni izlash va suhbat o'tkazish", "Yangi xodimlarni moslashtirish", "Kadrlar hujjatlarini yuritish", "Korporativ tadbirlarni tashkil qilish"},
	"legal":         {"Shartnomalarni tayyorlash va ekspertiza qilish", "Kompaniya manfaatlarini himoya qilish", "Huquqiy maslahat berish", "Hujjatlarni rasmiylashtirish"},
	"security":      {"Obyekt xavfsizligini ta'minlash", "Kirish-chiqishni nazorat qilish", "Videokuzatuvni kuzatish", "Navbatchilik jurnalini yuritish"},
	"services":      {"Topshiriqlarni sifatli bajarish", "Mijoz bilan muloqot", "Ish vaqtiga rioya qilish", "Asbob-uskunaga ehtiyotkorlik bilan munosabat"},
	"agriculture":   {"Dala ishlarini rejalashtirish", "Ekinlar holatini kuzatish", "O'g'it va himoya vositalarini qo'llash", "Hisobot yuritish"},
	"media":         {"Material tayyorlash va tahrirlash", "Suratga olish va montaj", "Ijtimoiy tarmoqlar uchun kontent", "Muddatlarga rioya qilish"},
}

var requirements = []string{
	"Mas'uliyatli va puxta bo'lish", "Jamoada ishlay olish", "O'zbek va rus tillarini bilish",
	"Shu sohada tajriba afzallik beradi", "Tez o'rganish va rivojlanishga intilish", "Muloqotga ochiq bo'lish",
	"Ingliz tilini bilish afzallik", "Kompyuter savodxonligi",
}

var conditions = []string{
	"Rasmiy ishga joylashish (TK bo'yicha)", "Oylik o'z vaqtida, oyiga ikki marta", "Bepul tushlik",
	"Zamonaviy ofis va qulay ish joyi", "Malaka oshirish uchun kurslar", "Yillik bonus",
	"Tibbiy sug'urta", "Yo'l kira kompensatsiyasi", "Do'stona jamoa", "Sinov muddati 1 oy",
}

var companyNames = []string{
	"Demo Texnologiyalari", "Samo Soft", "Zarafshon Agro Invest", "Navro'z Tekstil", "Oqsaroy Savdo",
	"Turon Logistik", "Bilim Nuri Akademiyasi", "Shifo Plus Klinikasi", "Yangi Shahar Qurilish", "Ziyo Media",
	"Lazzat Restoranlar Guruhi", "Sharq Moliya Servis", "Orzu Mebel", "Baraka Market", "Ustoz Til Markazi",
	"Kamalak Bolalar Bog'chasi", "Mehr Dorixonalari", "Afrosiyob Mehmonxonasi", "Qo'qon Gilam", "Nur Elektro",
	"Tez Yetkaz Kuryer", "Oltin Vodiy Fermer", "Doston Avto Servis", "Ipakchi Fashion", "Sayqal Go'zallik Saloni",
	"Pixel Studio", "DataBek Analytics", "Kodla IT Akademiyasi", "Mustahkam Qurilish Materiallari", "Sog'lom Hayot Fitnes",
	"Bayram Event", "Hamkor Kadrlar", "Adolat Yuridik Xizmatlar", "Qalqon Xavfsizlik", "Toza Uy Servis",
	"Yashil Bog' Agro", "Aloqa Call Center", "Marvarid Stomatologiya", "Shahar Taksi Park", "Kitobxon Nashriyoti",
}

var companyAbout = []string{
	"%s — %s sohasida %d yildan beri faoliyat yuritadi. Mijozlarimiz uchun sifat va ishonch birinchi o'rinda.",
	"Biz %s. %s yo'nalishida O'zbekiston bo'ylab xizmat ko'rsatamiz va jamoamizni kengaytiryapmiz. %d yilda tashkil topganmiz.",
	"%s — %s bo'yicha tez rivojlanayotgan kompaniya. %d yildan buyon yuzlab mijozlarga xizmat qilmoqdamiz.",
}

var maleFirst = []string{"Jasur", "Bekzod", "Sardor", "Aziz", "Javohir", "Rustam", "Sherzod", "Doniyor", "Otabek", "Jahongir", "Alisher", "Ulug'bek", "Farrux", "Shoxrux", "Islom", "Akmal", "Bobur", "Diyor", "Temur", "Eldor", "Nodir", "Sanjar", "Behruz", "Mirjalol", "Asadbek"}
var femaleFirst = []string{"Madina", "Dilnoza", "Nilufar", "Gulnora", "Sevara", "Malika", "Zarina", "Shahnoza", "Kamola", "Nodira", "Feruza", "Mohira", "Dilfuza", "Barno", "Laylo", "Sabina", "Mohinur", "Zilola", "Munisa", "Iroda"}
var lastNames = []string{"Aliyev", "Karimov", "Rahimov", "Toshmatov", "Yusupov", "Ergashev", "Nazarov", "Abdullayev", "Sobirov", "Qodirov", "Xolmatov", "Mirzayev", "Rasulov", "Saidov", "Umarov", "Ismoilov", "Jo'rayev", "Hasanov", "Tursunov", "Murodov", "Haydarov", "Valiyev", "Normatov", "Sultonov"}

var universities = []string{
	"Toshkent davlat iqtisodiyot universiteti", "Mirzo Ulug'bek nomidagi O'zbekiston Milliy universiteti",
	"Toshkent axborot texnologiyalari universiteti", "Samarqand davlat universiteti", "Toshkent tibbiyot akademiyasi",
	"Farg'ona davlat universiteti", "Toshkent arxitektura-qurilish universiteti", "O'zbekiston davlat jahon tillari universiteti",
	"Buxoro davlat universiteti", "Toshkent kimyo-texnologiya instituti",
}

var coverLetters = []string{
	"Assalomu alaykum! Vakansiyangiz menga juda qiziq. Tajribam va bilimlarim jamoangizga foyda keltiradi deb o'ylayman. Suhbatga tayyorman.",
	"Salom! Shu yo'nalishda bir necha yil ishlaganman va rivojlanishni davom ettirmoqchiman. Rezyumemni ko'rib chiqishingizni so'rayman.",
	"Здравствуйте! Заинтересовала ваша вакансия. Готов(а) приступить к работе в ближайшее время.",
	"Assalomu alaykum. Kompaniyangiz haqida yaxshi fikrlar eshitganman, sizlar bilan ishlashni xohlayman.",
	"",
}

var employerNotes = []string{"Kuchli nomzod, texnik suhbatga chaqirish kerak", "Maosh talabi biroz yuqori", "Portfoliosi yaxshi", "Tajribasi kam, lekin o'rganishga tayyor", "Ingliz tili yaxshi", ""}

var chatLines = [][2]string{
	{"Assalomu alaykum! Rezyumengizni ko'rib chiqdik, suhbatga taklif qilmoqchimiz.", "Va alaykum assalom! Rahmat, qachon qulay bo'ladi?"},
	{"Ertaga soat 11:00 da ofisimizga kela olasizmi? Manzil: Amir Temur ko'chasi, 15.", "Ha, albatta kelaman. Pasport olib kelishim kerakmi?"},
	{"Pasport va diplom nusxasini olib keling. Kutamiz!", "Yaxshi, ertaga ko'rishguncha!"},
	{"Suhbat uchun rahmat! Natijani ertaga xabar qilamiz.", "Rahmat, javobingizni kutaman."},
	{"Здравствуйте! Можете рассказать о вашем последнем опыте работы?", "Здравствуйте! Последние 2 года работал(а) в торговой компании, вёл(а) крупных клиентов."},
}

var reportTexts = map[string][]string{
	"fraud":      {"Ishga olishdan oldin 300 ming so'm to'lov so'rashdi", "Telefon qilganda hujjatlar uchun pul talab qilishdi"},
	"misleading": {"Maosh e'londagidan ancha past ekan", "Manzil noto'g'ri ko'rsatilgan"},
	"offensive":  {"E'londa yosh va jins bo'yicha kamsitish bor"},
	"spam":       {"Bir xil e'lon har kuni qayta joylanmoqda", "Boshqa saytga reklama"},
	"other":      {"Kompaniya bilan bog'lanib bo'lmayapti", "Vakansiya allaqachon yopilgan, lekin e'lon turibdi"},
}
