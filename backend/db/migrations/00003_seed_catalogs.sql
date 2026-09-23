-- +goose Up
-- Reference data. Icons are lucide icon names (web: lucide-react, mobile maps them).

INSERT INTO categories (slug, name_uz, name_uz_cyrl, name_ru, name_en, icon, sort_order) VALUES
('it',            'IT va dasturlash',               'IT ва дастурлаш',               'IT и программирование',          'IT & Software',                 'code',           10),
('sales',         'Savdo',                          'Савдо',                          'Продажи',                        'Sales',                         'shopping-bag',   20),
('marketing',     'Marketing va reklama',           'Маркетинг ва реклама',           'Маркетинг и реклама',            'Marketing & Advertising',       'megaphone',      30),
('finance',       'Moliya va buxgalteriya',         'Молия ва бухгалтерия',           'Финансы и бухгалтерия',          'Finance & Accounting',          'landmark',       40),
('education',     'Ta''lim',                        'Таълим',                         'Образование',                    'Education',                     'graduation-cap', 50),
('medicine',      'Tibbiyot va farmatsevtika',      'Тиббиёт ва фармацевтика',        'Медицина и фармацевтика',        'Healthcare & Pharma',           'stethoscope',    60),
('construction',  'Qurilish va ta''mirlash',        'Қурилиш ва таъмирлаш',           'Строительство и ремонт',         'Construction & Repair',         'hard-hat',       70),
('manufacturing', 'Ishlab chiqarish',               'Ишлаб чиқариш',                  'Производство',                   'Manufacturing',                 'factory',        80),
('logistics',     'Transport va logistika',         'Транспорт ва логистика',         'Транспорт и логистика',          'Transport & Logistics',         'truck',          90),
('hospitality',   'Turizm, restoran va mehmonxona', 'Туризм, ресторан ва меҳмонхона', 'Туризм, рестораны и гостиницы',  'Tourism, Restaurants & Hotels', 'utensils',      100),
('beauty',        'Go''zallik va sport',            'Гўзаллик ва спорт',              'Красота и спорт',                'Beauty & Fitness',              'scissors',      110),
('office',        'Ofis va ma''muriyat',            'Офис ва маъмурият',              'Офис и администрирование',       'Office & Administration',       'briefcase',     120),
('hr',            'HR va kadrlar',                  'HR ва кадрлар',                  'HR и кадры',                     'HR & Recruiting',               'users',         130),
('legal',         'Huquq',                          'Ҳуқуқ',                          'Юриспруденция',                  'Legal',                         'scale',         140),
('security',      'Xavfsizlik va qo''riqlash',      'Хавфсизлик ва қўриқлаш',         'Безопасность и охрана',          'Security',                      'shield',        150),
('services',      'Maishiy xizmatlar',              'Маиший хизматлар',               'Бытовые услуги',                 'Household Services',            'home',          160),
('agriculture',   'Qishloq xo''jaligi',             'Қишлоқ хўжалиги',                'Сельское хозяйство',             'Agriculture',                   'sprout',        170),
('government',    'Davlat xizmati va NNT',          'Давлат хизмати ва ННТ',          'Госслужба и НКО',                'Government & NGO',              'building-2',    180),
('media',         'Media va ijod',                  'Медиа ва ижод',                  'Медиа и творчество',             'Media & Creative',              'camera',        190),
('other',         'Boshqa',                         'Бошқа',                          'Другое',                         'Other',                         'ellipsis',      900);

INSERT INTO categories (parent_id, slug, name_uz, name_uz_cyrl, name_ru, name_en, sort_order)
SELECT p.id, v.slug, v.uz, v.cyrl, v.ru, v.en, v.sort
FROM (VALUES
  ('it', 'it-backend',   'Backend dasturlash',               'Backend дастурлаш',                   'Backend-разработка',                   'Backend Development',          10),
  ('it', 'it-frontend',  'Frontend dasturlash',              'Frontend дастурлаш',                  'Frontend-разработка',                  'Frontend Development',         20),
  ('it', 'it-fullstack', 'Fullstack dasturlash',             'Fullstack дастурлаш',                 'Fullstack-разработка',                 'Full-stack Development',       30),
  ('it', 'it-mobile',    'Mobil dasturlash',                 'Мобил дастурлаш',                     'Мобильная разработка',                 'Mobile Development',           40),
  ('it', 'it-devops',    'DevOps va tizim administratorligi','DevOps ва тизим администраторлиги',   'DevOps и системное администрирование', 'DevOps & SysAdmin',            50),
  ('it', 'it-qa',        'Testlash (QA)',                    'Тестлаш (QA)',                        'Тестирование (QA)',                    'QA & Testing',                 60),
  ('it', 'it-data',      'Data va sun''iy intellekt',        'Data ва сунъий интеллект',            'Data и искусственный интеллект',       'Data & AI',                    70),
  ('it', 'it-design',    'UI/UX dizayn',                     'UI/UX дизайн',                        'UI/UX-дизайн',                         'UI/UX Design',                 80),
  ('it', 'it-pm',        'Loyiha va mahsulot boshqaruvi',    'Лойиҳа ва маҳсулот бошқаруви',        'Управление проектами и продуктом',     'Project & Product Management', 90),
  ('it', 'it-security',  'Kiberxavfsizlik',                  'Киберхавфсизлик',                     'Кибербезопасность',                    'Cybersecurity',               100),
  ('it', 'it-support',   'Texnik yordam',                    'Техник ёрдам',                        'Техническая поддержка',                'Technical Support',           110),
  ('it', 'it-1c',        '1C dasturlash',                    '1C дастурлаш',                        '1С-программирование',                  '1C Development',              120),

  ('sales', 'sales-manager',    'Savdo menejeri',     'Савдо менежери',     'Менеджер по продажам',    'Sales Manager',        10),
  ('sales', 'sales-consultant', 'Sotuvchi-konsultant','Сотувчи-консультант','Продавец-консультант',    'Sales Associate',      20),
  ('sales', 'sales-cashier',    'Kassir',             'Кассир',             'Кассир',                  'Cashier',              30),
  ('sales', 'sales-agent',      'Savdo agenti',       'Савдо агенти',       'Торговый представитель',  'Sales Representative', 40),
  ('sales', 'sales-b2b',        'B2B savdo',          'B2B савдо',          'B2B-продажи',             'B2B Sales',            50),

  ('marketing', 'mkt-smm',       'SMM',                        'SMM',                        'SMM',                                    'SMM',                  10),
  ('marketing', 'mkt-marketer',  'Marketolog',                 'Маркетолог',                 'Маркетолог',                             'Marketer',             20),
  ('marketing', 'mkt-content',   'Kontent va kopirayting',     'Контент ва копирайтинг',     'Контент и копирайтинг',                  'Content & Copywriting',30),
  ('marketing', 'mkt-graphic',   'Grafik dizayn',              'График дизайн',              'Графический дизайн',                     'Graphic Design',       40),
  ('marketing', 'mkt-ads',       'Target va kontekst reklama', 'Таргет ва контекст реклама', 'Таргетированная и контекстная реклама',  'Paid Advertising',     50),

  ('finance', 'fin-accountant', 'Buxgalter',               'Бухгалтер',               'Бухгалтер',               'Accountant',                     10),
  ('finance', 'fin-economist',  'Iqtisodchi va moliyachi', 'Иқтисодчи ва молиячи',    'Экономист и финансист',   'Economist & Financial Analyst',  20),
  ('finance', 'fin-audit',      'Audit',                   'Аудит',                   'Аудит',                   'Audit',                          30),
  ('finance', 'fin-bank',       'Bank xizmatlari',         'Банк хизматлари',         'Банковское дело',         'Banking',                        40),
  ('finance', 'fin-insurance',  'Sug''urta',               'Суғурта',                 'Страхование',             'Insurance',                      50),

  ('education', 'edu-teacher',      'O''qituvchi',       'Ўқитувчи',        'Учитель',                 'Teacher',              10),
  ('education', 'edu-tutor',        'Repetitor',         'Репетитор',       'Репетитор',               'Tutor',                20),
  ('education', 'edu-language',     'Til o''qituvchisi', 'Тил ўқитувчиси',  'Преподаватель языков',    'Language Teacher',     30),
  ('education', 'edu-kindergarten', 'Tarbiyachi',        'Тарбиячи',        'Воспитатель',             'Kindergarten Teacher', 40),
  ('education', 'edu-university',   'Oliy ta''lim',      'Олий таълим',     'Высшее образование',      'Higher Education',     50),

  ('medicine', 'med-doctor',     'Shifokor',   'Шифокор',   'Врач',        'Doctor',         10),
  ('medicine', 'med-nurse',      'Hamshira',   'Ҳамшира',   'Медсестра',   'Nurse',          20),
  ('medicine', 'med-pharmacist', 'Farmatsevt', 'Фармацевт', 'Фармацевт',   'Pharmacist',     30),
  ('medicine', 'med-dentist',    'Stomatolog', 'Стоматолог','Стоматолог',  'Dentist',        40),
  ('medicine', 'med-lab',        'Laborant',   'Лаборант',  'Лаборант',    'Lab Technician', 50),

  ('construction', 'con-builder',     'Quruvchi',          'Қурувчи',          'Строитель',          'Builder',         10),
  ('construction', 'con-electrician', 'Elektrik',          'Электрик',         'Электрик',           'Electrician',     20),
  ('construction', 'con-plumber',     'Santexnik',         'Сантехник',        'Сантехник',          'Plumber',         30),
  ('construction', 'con-engineer',    'Muhandis',          'Муҳандис',         'Инженер',            'Engineer',        40),
  ('construction', 'con-architect',   'Arxitektor',        'Архитектор',       'Архитектор',         'Architect',       50),
  ('construction', 'con-finishing',   'Pardozlash ishlari','Пардозлаш ишлари', 'Отделочные работы',  'Finishing Works', 60),

  ('manufacturing', 'mfg-operator',     'Stanok operatori', 'Станок оператори', 'Оператор станка', 'Machine Operator',     10),
  ('manufacturing', 'mfg-technologist', 'Texnolog',         'Технолог',         'Технолог',        'Process Technologist', 20),
  ('manufacturing', 'mfg-welder',       'Payvandchi',       'Пайвандчи',        'Сварщик',         'Welder',               30),
  ('manufacturing', 'mfg-sewing',       'Tikuvchi',         'Тикувчи',          'Швея',            'Tailor / Seamstress',  40),
  ('manufacturing', 'mfg-worker',       'Ishchi',           'Ишчи',             'Рабочий',         'Factory Worker',       50),

  ('logistics', 'log-driver',    'Haydovchi',     'Ҳайдовчи',     'Водитель',            'Driver',                 10),
  ('logistics', 'log-courier',   'Kuryer',        'Курьер',       'Курьер',              'Courier',                20),
  ('logistics', 'log-logist',    'Logist',        'Логист',       'Логист',              'Logistics Coordinator',  30),
  ('logistics', 'log-warehouse', 'Ombor xodimi',  'Омбор ходими', 'Складской работник', 'Warehouse Worker',       40),

  ('hospitality', 'hos-cook',    'Oshpaz',        'Ошпаз',         'Повар',          'Cook',                       10),
  ('hospitality', 'hos-waiter',  'Ofitsiant',     'Официант',      'Официант',       'Waiter',                     20),
  ('hospitality', 'hos-barista', 'Barista',       'Бариста',       'Бариста',        'Barista',                    30),
  ('hospitality', 'hos-admin',   'Administrator', 'Администратор', 'Администратор',  'Administrator / Front Desk', 40),
  ('hospitality', 'hos-tourism', 'Turizm',        'Туризм',        'Туризм',         'Tourism',                    50),

  ('beauty', 'bty-hairdresser',   'Sartarosh',       'Сартарош',       'Парикмахер',       'Hairdresser',     10),
  ('beauty', 'bty-cosmetologist', 'Kosmetolog',      'Косметолог',     'Косметолог',       'Cosmetologist',   20),
  ('beauty', 'bty-nails',         'Manikyur ustasi', 'Маникюр устаси', 'Мастер маникюра',  'Nail Technician', 30),
  ('beauty', 'bty-trainer',       'Fitnes murabbiy', 'Фитнес мураббий','Фитнес-тренер',    'Fitness Trainer', 40),

  ('office', 'off-manager',    'Ofis menejeri',          'Офис менежери',          'Офис-менеджер',           'Office Manager',        10),
  ('office', 'off-secretary',  'Kotib(a)',               'Котиб(а)',               'Секретарь',               'Secretary',             20),
  ('office', 'off-callcenter', 'Call-markaz operatori',  'Call-марказ оператори',  'Оператор колл-центра',    'Call Center Operator',  30),
  ('office', 'off-translator', 'Tarjimon',               'Таржимон',               'Переводчик',              'Translator',            40),

  ('hr', 'hr-manager',   'HR menejer', 'HR менежер', 'HR-менеджер', 'HR Manager', 10),
  ('hr', 'hr-recruiter', 'Rekruter',   'Рекрутер',   'Рекрутер',    'Recruiter',  20),

  ('legal', 'law-lawyer', 'Yurist',   'Юрист',    'Юрист',    'Lawyer', 10),
  ('legal', 'law-notary', 'Notarius', 'Нотариус', 'Нотариус', 'Notary', 20),

  ('security', 'sec-guard', 'Qo''riqchi', 'Қўриқчи', 'Охранник', 'Security Guard', 10),

  ('services', 'svc-cleaner', 'Farrosh',           'Фаррош',           'Уборщик',            'Cleaner',           10),
  ('services', 'svc-nanny',   'Enaga',             'Энага',            'Няня',               'Nanny',             20),
  ('services', 'svc-repair',  'Ta''mirlash ustasi','Таъмирлаш устаси', 'Мастер по ремонту',  'Repair Technician', 30),

  ('agriculture', 'agr-agronomist', 'Agronom',                   'Агроном',                  'Агроном',        'Agronomist',    10),
  ('agriculture', 'agr-vet',        'Veterinar',                 'Ветеринар',                'Ветеринар',      'Veterinarian',  20),
  ('agriculture', 'agr-worker',     'Fermer xo''jaligi ishchisi','Фермер хўжалиги ишчиси',   'Работник фермы', 'Farm Worker',   30),

  ('media', 'mda-journalist', 'Jurnalist',             'Журналист',             'Журналист',            'Journalist',    10),
  ('media', 'mda-photo',      'Fotograf va videograf', 'Фотограф ва видеограф', 'Фотограф и видеограф', 'Photo & Video', 20),
  ('media', 'mda-editor',     'Montajchi',             'Монтажчи',              'Видеомонтажёр',        'Video Editor',  30)
) AS v(parent, slug, uz, cyrl, ru, en, sort)
JOIN categories p ON p.slug = v.parent;

-- Regions of Uzbekistan. Districts are seeded for Tashkent city; the remaining ~200
-- districts are imported from the official SOATO classifier in a later migration.
INSERT INTO regions (kind, slug, name_uz, name_uz_cyrl, name_ru, name_en, sort_order) VALUES
('city',   'tashkent-city',  'Toshkent shahri',              'Тошкент шаҳри',               'г. Ташкент',                 'Tashkent City',              10),
('region', 'tashkent',       'Toshkent viloyati',            'Тошкент вилояти',             'Ташкентская область',        'Tashkent Region',            20),
('region', 'andijan',        'Andijon viloyati',             'Андижон вилояти',             'Андижанская область',        'Andijan Region',             30),
('region', 'bukhara',        'Buxoro viloyati',              'Бухоро вилояти',              'Бухарская область',          'Bukhara Region',             40),
('region', 'fergana',        'Farg''ona viloyati',           'Фарғона вилояти',             'Ферганская область',         'Fergana Region',             50),
('region', 'jizzakh',        'Jizzax viloyati',              'Жиззах вилояти',              'Джизакская область',         'Jizzakh Region',             60),
('region', 'khorezm',        'Xorazm viloyati',              'Хоразм вилояти',              'Хорезмская область',         'Khorezm Region',             70),
('region', 'namangan',       'Namangan viloyati',            'Наманган вилояти',            'Наманганская область',       'Namangan Region',            80),
('region', 'navoi',          'Navoiy viloyati',              'Навоий вилояти',              'Навоийская область',         'Navoi Region',               90),
('region', 'kashkadarya',    'Qashqadaryo viloyati',         'Қашқадарё вилояти',           'Кашкадарьинская область',    'Kashkadarya Region',        100),
('region', 'samarkand',      'Samarqand viloyati',           'Самарқанд вилояти',           'Самаркандская область',      'Samarkand Region',          110),
('region', 'syrdarya',       'Sirdaryo viloyati',            'Сирдарё вилояти',             'Сырдарьинская область',      'Syrdarya Region',           120),
('region', 'surkhandarya',   'Surxondaryo viloyati',         'Сурхондарё вилояти',          'Сурхандарьинская область',   'Surkhandarya Region',       130),
('region', 'karakalpakstan', 'Qoraqalpog''iston Respublikasi','Қорақалпоғистон Республикаси','Республика Каракалпакстан',  'Republic of Karakalpakstan',140);

INSERT INTO regions (parent_id, kind, slug, name_uz, name_uz_cyrl, name_ru, name_en, sort_order)
SELECT p.id, 'district', v.slug, v.uz || ' tumani', v.cyrl || ' тумани', v.ru || ' район', v.en || ' District', v.sort
FROM (VALUES
  ('tashkent-city-bektemir',      'Bektemir',        'Бектемир',        'Бектемирский',        'Bektemir',        10),
  ('tashkent-city-chilanzar',     'Chilonzor',       'Чилонзор',        'Чиланзарский',        'Chilanzar',       20),
  ('tashkent-city-mirabad',       'Mirobod',         'Миробод',         'Мирабадский',         'Mirabad',         30),
  ('tashkent-city-mirzo-ulugbek', 'Mirzo Ulug''bek', 'Мирзо Улуғбек',   'Мирзо-Улугбекский',   'Mirzo Ulugbek',   40),
  ('tashkent-city-almazar',       'Olmazor',         'Олмазор',         'Алмазарский',         'Almazar',         50),
  ('tashkent-city-sergeli',       'Sergeli',         'Сергели',         'Сергелийский',        'Sergeli',         60),
  ('tashkent-city-shaykhantakhur','Shayxontohur',    'Шайхонтоҳур',     'Шайхантахурский',     'Shaykhantakhur',  70),
  ('tashkent-city-uchtepa',       'Uchtepa',         'Учтепа',          'Учтепинский',         'Uchtepa',         80),
  ('tashkent-city-yakkasaray',    'Yakkasaroy',      'Яккасарой',       'Яккасарайский',       'Yakkasaray',      90),
  ('tashkent-city-yashnabad',     'Yashnobod',       'Яшнобод',         'Яшнабадский',         'Yashnabad',      100),
  ('tashkent-city-yangihayot',    'Yangihayot',      'Янгиҳаёт',        'Янгихаётский',        'Yangihayot',     110),
  ('tashkent-city-yunusabad',     'Yunusobod',       'Юнусобод',        'Юнусабадский',        'Yunusabad',      120)
) AS v(slug, uz, cyrl, ru, en, sort)
JOIN regions p ON p.slug = 'tashkent-city';

-- Popular, language-neutral skills. Users add the rest; new ones start unverified.
INSERT INTO skills (name, slug, is_verified) VALUES
('Go','go',true), ('Python','python',true), ('Java','java',true), ('JavaScript','javascript',true),
('TypeScript','typescript',true), ('React','react',true), ('Vue.js','vue-js',true), ('Angular','angular',true),
('Next.js','next-js',true), ('Node.js','node-js',true), ('PHP','php',true), ('Laravel','laravel',true),
('C#','c-sharp',true), ('.NET','dotnet',true), ('C++','c-plus-plus',true), ('Kotlin','kotlin',true),
('Swift','swift',true), ('Flutter','flutter',true), ('Dart','dart',true), ('Django','django',true),
('FastAPI','fastapi',true), ('Spring','spring',true), ('SQL','sql',true), ('PostgreSQL','postgresql',true),
('MySQL','mysql',true), ('MongoDB','mongodb',true), ('Redis','redis',true), ('Docker','docker',true),
('Kubernetes','kubernetes',true), ('Linux','linux',true), ('Git','git',true), ('AWS','aws',true),
('HTML','html',true), ('CSS','css',true), ('Tailwind CSS','tailwind-css',true), ('REST API','rest-api',true),
('GraphQL','graphql',true), ('Machine Learning','machine-learning',true), ('Power BI','power-bi',true),
('Figma','figma',true), ('Adobe Photoshop','adobe-photoshop',true), ('Adobe Illustrator','adobe-illustrator',true),
('Adobe Premiere Pro','adobe-premiere-pro',true), ('CorelDRAW','coreldraw',true), ('AutoCAD','autocad',true),
('Revit','revit',true), ('1C','1c',true), ('Microsoft Excel','microsoft-excel',true), ('Microsoft Word','microsoft-word',true),
('Microsoft PowerPoint','microsoft-powerpoint',true), ('Google Sheets','google-sheets',true), ('SMM','smm',true),
('SEO','seo',true), ('Google Ads','google-ads',true), ('Meta Ads','meta-ads',true), ('Copywriting','copywriting',true),
('CRM','crm',true), ('Bitrix24','bitrix24',true), ('amoCRM','amocrm',true), ('IFRS','ifrs',true);

-- +goose Down
DELETE FROM skills;
DELETE FROM regions WHERE parent_id IS NOT NULL;
DELETE FROM regions;
DELETE FROM categories WHERE parent_id IS NOT NULL;
DELETE FROM categories;
