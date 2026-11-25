// The map of the public site for Fira (Fira nav 2.0, owner 2026-11-25): every public route and the sections she can
// walk the visitor to, with a stable key, RU/EN names, synonyms for the local intent matcher (`intents.ts`, no
// model) and her one-line description. Builder and cabinet are in, the Shell (/admin) is out on purpose.
// Keys are the contract of the deep links `?fira=go:<key>` and of the chat link cards: never rename one.
// Pure data and helpers; tested in tests/fira-nav.test.mjs (every route listed, keys unique, selectors sane).

export type Loc = 'ru' | 'en'
export type Group = 'self' | 'business' | 'teams' | 'how' | 'cabinet'
export const groupOrder: readonly Group[] = ['self', 'business', 'teams', 'how', 'cabinet']

export type SiteEntry = {
  key: string
  group: Group
  /** Path without the locale; '' is the home page. */
  path: string
  /** CSS selector of the section on that page (a stable id or data attribute); none = the top of the page. */
  selector?: string
  name: Record<Loc, string>
  syn: Record<Loc, readonly string[]>
  line: Record<Loc, string>
  /** Adds «сколько стоит X» style synonyms from the first names (products, niches, services). */
  priced?: boolean
}

const e = (
  key: string, group: Group, path: string, selector: string | undefined,
  nameRu: string, nameEn: string, synRu: string[], synEn: string[], lineRu: string, lineEn: string, priced = false,
): SiteEntry => ({ key, group, path, selector, name: { ru: nameRu, en: nameEn }, syn: { ru: synRu, en: synEn }, line: { ru: lineRu, en: lineEn }, priced })

// ---- the home page and its sections (anchors from lib/home.ts `sectionAnchor`)
const home: SiteEntry[] = [
  e('home', 'how', '', '#top', 'Главная', 'Home', ['главная', 'на главную', 'домой', 'в начало', 'наверх', 'первая страница'], ['home', 'home page', 'main page', 'go home', 'back to start', 'top of the page'],
    'Главная: что мы делаем, цены и демо в одном месте.', 'Home: what we do, prices and a demo in one place.'),
  e('demo', 'teams', '', '#demo', 'Демо', 'Demo', ['демо', 'попробовать', 'пример работы', 'посмотреть в деле', 'как это выглядит', 'живой пример', 'протестировать'], ['demo', 'try it', 'live example', 'see it working', 'how it looks', 'test it'],
    'Демо: поговорите с агентом сами, это быстрее любых слов.', 'Demo: talk to an agent yourself, it beats any description.'),
  e('products', 'business', '', '#products', 'Продукты', 'Products', ['продукты', 'что вы продаёте', 'что вы делаете', 'что у вас есть', 'каталог', 'что умеете', 'чем занимаетесь'], ['products', 'what do you sell', 'what do you do', 'what you offer', 'catalog', 'what can you do'],
    'Семь продуктов: от личного ИИ до ИИ для всей компании.', 'Seven products: from a personal AI to an AI for the whole company.'),
  e('levels', 'teams', '', '#levels', 'Три уровня', 'Three levels', ['уровни', 'агент или команда', 'от агента до отдела', 'ступени', 'автопилот'], ['levels', 'agent or team', 'from agent to department', 'tiers', 'autopilot'],
    'Три уровня: один агент, агент на автопилоте, целый отдел.', 'Three levels: one agent, an agent on autopilot, a whole department.'),
  e('prices', 'business', '', '#pricing', 'Цены', 'Prices', ['цены', 'сколько стоит', 'стоимость', 'прайс', 'прайс-лист', 'тарифы', 'сколько платить', 'почём', 'бюджет'], ['prices', 'pricing', 'how much', 'how much does it cost', 'cost', 'rates', 'price list', 'budget'],
    'Цены: от чего стартуем и как платить по этапам.', 'Prices: where we start and how payment works in stages.'),
  e('process', 'how', '', '#process', 'Как идёт работа', 'How the work goes', ['процесс', 'схема работы', 'шаги проекта', 'пять шагов'], ['process', 'workflow', 'project steps', 'five steps'],
    'Коротко о процессе: пять шагов от заявки до запуска.', 'The process in short: five steps from request to launch.'),
  e('faq', 'how', '', '#faq', 'Частые вопросы', 'FAQ', ['faq', 'частые вопросы', 'вопросы и ответы', 'остались вопросы', 'ответы на вопросы'], ['faq', 'frequent questions', 'common questions', 'questions and answers', 'still have questions'],
    'Частые вопросы: самые честные ответы в одном месте.', 'Frequent questions: the most honest answers in one place.'),
  e('office', 'teams', '', '#office', 'Офис агентов', 'The agents\' office', ['офис', 'живой офис', 'как работают агенты', 'кто сейчас работает', 'агенты за работой'], ['office', 'live office', 'how agents work', 'who is working now', 'agents at work'],
    'Офис: видно, чем сейчас заняты агенты.', 'The office: you can see what the agents are doing right now.'),
]

// ---- the seven products (lib/product-ids.ts) with the words people use for them
const products: SiteEntry[] = [
  e('product-personal', 'self', '/products/personal', undefined, 'Личный ИИ', 'Personal AI', ['личный ии', 'персональный ии', 'личный ассистент', 'ии для себя', 'личный помощник', 'для жизни'], ['personal ai', 'personal assistant', 'ai for me', 'assistant for myself', 'my own ai', 'private assistant'],
    'Личный ИИ: письма, дела и напоминания, как у человека рядом.', 'Personal AI: mail, tasks and reminders, like a person at your side.', true),
  e('product-company', 'business', '/products/company', undefined, 'ИИ вашей компании', 'AI for your company', ['ии компании', 'ии для компании', 'ии для всей компании', 'мозг компании', 'один мозг'], ['company ai', 'ai for my company', 'company brain', 'one brain for the company', 'ai for the whole company'],
    'ИИ вашей компании: один мозг, который знает бизнес.', 'AI for your company: one brain that knows the business.', true),
  e('product-admin', 'business', '/products/admin', undefined, 'ИИ-администратор', 'AI administrator', ['администратор', 'ии администратор', 'запись клиентов', 'записывать клиентов', 'онлайн запись', 'запись на приём'], ['administrator', 'ai administrator', 'booking agent', 'client booking', 'online booking', 'appointments'],
    'ИИ-администратор: записывает клиентов и напоминает о визите.', 'AI administrator: books clients and reminds them of the visit.', true),
  e('product-receptionist', 'business', '/products/receptionist', undefined, 'ИИ-менеджер заявок', 'AI lead manager', ['менеджер заявок', 'приём заявок', 'обработка заявок', 'заявки', 'лиды', 'отвечать клиентам'], ['lead manager', 'receptionist', 'leads', 'handle requests', 'answer customers', 'inbound requests'],
    'ИИ-менеджер заявок: отвечает клиентам сразу и передаёт горячих вам.', 'AI lead manager: answers clients at once and hands the hot ones to you.', true),
  e('product-automation', 'business', '/products/automation', undefined, 'Автоматизация процессов', 'Process automation', ['автоматизация', 'автоматизировать', 'рутина', 'интеграции', 'склеить сервисы', 'убрать рутину'], ['automation', 'automate', 'routine', 'integrations', 'connect services', 'remove routine'],
    'Автоматизация: рутина уходит агенту, сервисы работают вместе.', 'Automation: the routine goes to an agent and your tools work together.', true),
  e('product-content', 'business', '/products/content', undefined, 'Контент на автопилоте', 'Content on autopilot', ['контент', 'контент на автопилоте', 'посты', 'соцсети', 'ведение соцсетей', 'публикации'], ['content', 'content on autopilot', 'posts', 'social media', 'social networks', 'publications'],
    'Контент на автопилоте: посты и статьи выходят по плану без вас.', 'Content on autopilot: posts and articles go out on schedule without you.', true),
  e('product-miniapp', 'business', '/products/miniapp', undefined, 'Telegram Mini App', 'Telegram Mini App', ['мини апп', 'telegram mini app', 'мини приложение', 'приложение в телеграме', 'магазин в телеграме'], ['mini app', 'telegram mini app', 'app in telegram', 'store in telegram', 'telegram shop'],
    'Telegram Mini App: приложение прямо в мессенджере, без установки.', 'Telegram Mini App: an app inside the messenger, nothing to install.', true),
]

// ---- the four classic services (lib/site.ts `serviceSlugs`)
const services: SiteEntry[] = [
  e('service-websites', 'business', '/services/websites', undefined, 'Сайты', 'Websites', ['сайт', 'сайты', 'сделать сайт', 'создать сайт', 'заказать сайт', 'лендинг', 'веб сайт', 'разработка сайта'], ['website', 'websites', 'build a website', 'landing page', 'web site', 'site development'],
    'Сайты: быстрые, понятные и с заявками в Telegram.', 'Websites: fast, clear and with requests going to Telegram.', true),
  e('service-bots', 'business', '/services/bots', undefined, 'Агенты в мессенджерах', 'Agents in messengers', ['бот', 'боты', 'телеграм бот', 'чат бот', 'агент в мессенджере', 'бот в телеграм', 'бот для бизнеса'], ['bot', 'bots', 'telegram bot', 'chatbot', 'messenger agent', 'bot for business'],
    'Агенты в мессенджерах: отвечают, записывают и принимают оплату.', 'Messenger agents: they answer, book and take payments.', true),
  e('service-apps', 'business', '/services/apps', undefined, 'Приложения', 'Apps', ['приложение', 'приложения', 'мобильное приложение', 'ios', 'android', 'свое приложение'], ['app', 'apps', 'mobile app', 'ios app', 'android app', 'application', 'my own app'],
    'Приложения: мобильные и веб, под ваш процесс.', 'Apps: mobile and web, built around your process.', true),
  e('service-automation', 'business', '/services/automation', undefined, 'Автоматизация под ключ', 'Turnkey automation', ['автоматизация под ключ', 'автоматизация бизнеса', 'автоматизация учёта', 'кастомная автоматизация'], ['turnkey automation', 'business automation', 'custom automation', 'automation project'],
    'Автоматизация под ключ: разберём процесс и соберём решение.', 'Turnkey automation: we map the process and build the solution.', true),
]

// ---- AI teams (lib/ai-teams.ts)
const teams: SiteEntry[] = [
  e('ai-team', 'teams', '/ai-team', undefined, 'ИИ-команды', 'AI teams', ['команды', 'ии команды', 'ии отделы', 'ии отдел', 'нужна команда', 'целый отдел', 'команда агентов'], ['teams', 'ai teams', 'ai departments', 'ai department', 'team of agents', 'whole department'],
    'ИИ-команды: целые отделы агентов, которые работают вместе.', 'AI teams: whole departments of agents working together.'),
  e('ai-agents', 'teams', '/ai-team', '#agents', 'Все агенты', 'All agents', ['агенты', 'все агенты', 'список агентов', 'какие есть агенты', 'готовые агенты', 'каталог агентов'], ['agents', 'all agents', 'list of agents', 'which agents', 'ready made agents', 'agent catalog'],
    'Все агенты: готовые роли, которые можно подключить по одной.', 'All agents: ready roles you can plug in one at a time.'),
  e('team-marketing', 'teams', '/ai-team/marketing', undefined, 'Отдел маркетинга', 'Marketing team', ['маркетинг', 'отдел маркетинга', 'реклама', 'продвижение', 'маркетолог'], ['marketing', 'marketing team', 'advertising', 'promotion', 'marketer'],
    'Отдел маркетинга: контент, реклама и аналитика одной командой.', 'Marketing team: content, ads and analytics as one team.', true),
  e('team-sales', 'teams', '/ai-team/sales', undefined, 'Отдел продаж', 'Sales team', ['продажи', 'отдел продаж', 'продавать', 'продажник', 'больше клиентов'], ['sales', 'sales team', 'sell more', 'salesperson', 'more customers'],
    'Отдел продаж: ищет клиентов, ведёт переписку и греет сделки.', 'Sales team: finds clients, handles the chat and warms the deals.', true),
  e('team-support', 'teams', '/ai-team/support', undefined, 'Служба поддержки', 'Support team', ['поддержка', 'служба поддержки', 'отдел поддержки', 'клиентский сервис', 'помощь клиентам'], ['support', 'support team', 'customer support', 'customer service', 'help clients'],
    'Служба поддержки: отвечает по базе знаний и зовёт человека, когда нужно.', 'Support team: answers from the knowledge base and calls a human when needed.', true),
  e('team-production', 'teams', '/ai-team/production', undefined, 'Отдел производства', 'Production team', ['производство', 'отдел производства', 'заказы и выпуск', 'выпуск продукции'], ['production', 'production team', 'orders and output', 'manufacturing'],
    'Отдел производства: заказы, сроки и контроль выпуска.', 'Production team: orders, deadlines and output control.', true),
  e('team-backoffice', 'teams', '/ai-team/backoffice', undefined, 'Бэк-офис', 'Back office', ['бэк офис', 'бухгалтерия', 'учёт', 'документооборот', 'внутренние процессы'], ['back office', 'bookkeeping', 'accounting team', 'paperwork', 'internal processes'],
    'Бэк-офис: документы, учёт и внутренние дела без ручной работы.', 'Back office: documents, bookkeeping and internal tasks without manual work.', true),
  e('team-company', 'teams', '/ai-team/company', undefined, 'ИИ-команда компании', 'Company AI team', ['команда компании', 'вся компания', 'ии компания целиком', 'управление компанией'], ['company team', 'whole company', 'run the company', 'company wide'],
    'ИИ-команда компании: все отделы под одним мозгом.', 'Company AI team: every department under one brain.'),
]

// ---- niche pages /solutions/<kind> (lib/builder-catalog `kindIds` except `other`): first word is the name
const kinds: Record<string, [string, string]> = {
  cafe: ['кафе|столовая|общепит', 'cafe|diner|eatery'], restaurant: ['ресторан|банкет', 'restaurant|banquet'], coffee: ['кофейня|кофе с собой', 'coffee shop|takeaway coffee'],
  bakery: ['пекарня|кондитерская|выпечка', 'bakery|pastry shop|baking'], delivery: ['доставка|курьер|доставка еды', 'delivery|courier|food delivery'], catering: ['кейтеринг|выездной банкет', 'catering|event food'],
  barber: ['барбершоп|мужская стрижка', 'barbershop|mens haircut'], salon: ['салон|салон красоты|парикмахерская', 'salon|beauty salon|hair salon'], nails: ['маникюр|ногтевая студия|ногти', 'nails|nail studio|manicure'],
  spa: ['спа|релакс центр', 'spa|relax center'], cosmetology: ['косметолог|косметология', 'cosmetologist|cosmetology'], dentist: ['стоматология|зубной|дантист', 'dentist|dental|dental clinic'],
  clinic: ['клиника|медцентр|врач', 'clinic|medical center|doctor'], fitness: ['фитнес|спортзал|тренажёрный зал', 'fitness|gym|fitness club'], yoga: ['йога|студия йоги', 'yoga|yoga studio'], massage: ['массаж|массажист', 'massage|masseur'],
  shop: ['магазин|розница|торговая точка', 'shop|store|retail'], webshop: ['интернет магазин|онлайн магазин', 'online shop|web store|ecommerce'], flowers: ['цветы|цветочный магазин|флорист', 'flowers|flower shop|florist'],
  gifts: ['подарки|сувениры', 'gifts|souvenirs'], clothing: ['одежда|обувь|бутик', 'clothing|shoes|boutique'], electronics: ['электроника|техника|гаджеты', 'electronics|gadgets|appliances'],
  furniture: ['мебель|мебельный', 'furniture|furniture store'], autoparts: ['автозапчасти|запчасти', 'auto parts|car parts'], carservice: ['автосервис|сто|ремонт авто', 'car service|garage|car repair'],
  carwash: ['автомойка|мойка', 'car wash|carwash'], drycleaning: ['химчистка|прачечная', 'dry cleaning|laundry'], cleaning: ['клининг|уборка', 'cleaning|cleaning service'],
  repair: ['ремонт техники|сервисный центр', 'appliance repair|repair shop'], renovation: ['ремонт квартир|строительная бригада|отделка', 'renovation|home repair|finishing'], photo: ['фотостудия|фотограф', 'photo studio|photographer'],
  events: ['свадьбы|мероприятия|ивенты', 'weddings|events|event agency'], printing: ['типография|печать', 'printing|print shop'], tutor: ['репетитор|частный преподаватель', 'tutor|private teacher'],
  languages: ['языковые курсы|английский', 'language courses|english lessons'], kidscenter: ['детский центр|детский сад|развивашки', 'kids center|kindergarten|child center'], drivingschool: ['автошкола|права', 'driving school|driving lessons'],
  onlineschool: ['онлайн школа|курсы|обучение', 'online school|courses|training'], realty: ['недвижимость|риелтор|агентство недвижимости', 'real estate|realtor|property agency'], lawyers: ['юрист|адвокат|юридические услуги', 'lawyer|attorney|legal services'],
  accounting: ['бухгалтер|бухгалтерия', 'accountant|accounting firm'], insurance: ['страхование|страховка', 'insurance|insurance agency'], travel: ['турагентство|путешествия|туры', 'travel agency|trips|travel'],
  hotel: ['отель|гостиница', 'hotel|inn'], guesthouse: ['гостевой дом|хостел|посуточно', 'guesthouse|hostel|short term rental'], tours: ['экскурсии|гид', 'tours|guide|sightseeing'],
  services: ['услуги|b2b|сфера услуг', 'services|b2b|service business'], logistics: ['логистика|перевозки|грузоперевозки', 'logistics|freight|transport'], wholesale: ['опт|оптовая торговля|оптовик', 'wholesale|wholesaler|bulk trade'],
  itservices: ['it услуги|айти компания|разработка софта', 'it services|software company|dev shop'], marketing: ['маркетинговое агентство|рекламное агентство', 'marketing agency|ad agency'], coworking: ['коворкинг|аренда офиса', 'coworking|office rental'],
  pharmacy: ['аптека|лекарства', 'pharmacy|drugstore'], vet: ['ветклиника|ветеринар', 'vet clinic|veterinarian'], petshop: ['зоомагазин|товары для животных', 'pet shop|pet store'],
}
export const solutionKindKeys = Object.keys(kinds)
const kindSolutions: SiteEntry[] = solutionKindKeys.map((id) => {
  const [ru, en] = kinds[id]!
  const r = ru.split('|')
  const n = en.split('|')
  return e(`solution-${id}`, 'business', `/solutions/${id}`, undefined, cap(r[0]!), cap(n[0]!), r, n,
    `${cap(r[0]!)}: готовый набор, цена и первые этапы.`, `${cap(n[0]!)}: a ready set, the price and the first stages.`, true)
})
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const solutions: SiteEntry[] = [
  e('solutions', 'business', '/solutions', undefined, 'Решения по нишам', 'Solutions by niche', ['решения', 'для моей ниши', 'для моего бизнеса', 'ниши', 'отрасли', 'мой бизнес'], ['solutions', 'for my niche', 'for my business', 'industries', 'niches', 'my business'],
    'Решения по нишам: найдите свой бизнес и увидите готовый набор.', 'Solutions by niche: find your business and see a ready set.'),
  ...kindSolutions,
]

const how: SiteEntry[] = [
  e('builder', 'business', '/builder', undefined, 'Сборка проекта', 'Project builder', ['собрать проект', 'сборка проекта', 'сборка', 'с чего начать', 'как заказать', 'заказать', 'начать проект', 'смета', 'рассчитать', 'калькулятор', 'конструктор'], ['build a project', 'project builder', 'builder', 'where to start', 'how to order', 'order', 'start a project', 'estimate', 'get a quote', 'calculator'],
    'Сборка проекта: отвечаете на вопросы, а смета считается сразу.', 'Project builder: you answer questions and the estimate updates live.'),
  e('how-we-work', 'how', '/how-we-work', undefined, 'Как мы работаем', 'How we work', ['как мы работаем', 'как вы работаете', 'что после заявки', 'что будет после заявки', 'этапы работы', 'сроки', 'как проходит проект', 'что дальше после заявки', 'как это работает'], ['how we work', 'how do you work', 'how it works', 'what happens after the request', 'what happens next', 'project stages', 'timeline', 'how long'],
    'Как мы работаем: этапы, приёмка, оплата и что видно в кабинете.', 'How we work: stages, acceptance, payment and what you see in the cabinet.'),
  e('pay-how', 'how', '/pay-how', undefined, 'Как оплатить', 'How to pay', ['как оплатить', 'оплата', 'способы оплаты', 'как платить', 'счёт', 'оплатить картой', 'заплатить'], ['how to pay', 'payment', 'payment methods', 'pay', 'invoice', 'pay by card', 'payment options'],
    'Как оплатить: смета, счёт, карта или перевод, и всё по этапам.', 'How to pay: estimate, invoice, card or transfer, all in stages.'),
  e('pay-stages', 'how', '/pay-how', '#stages', 'Оплата по этапам', 'Payment in stages', ['оплата по этапам', 'этапы оплаты', 'можно позже', 'можно частями', 'рассрочка', 'предоплата', 'платить частями'], ['pay in stages', 'payment stages', 'can i pay later', 'installments', 'prepayment', 'pay in parts'],
    'Оплата по этапам: вы платите перед каждым этапом, не за всё сразу.', 'Payment in stages: you pay before each stage, not for everything at once.'),
  e('pay-guarantee', 'how', '/pay-how', '#guarantee', 'Гарантия', 'Guarantee', ['гарантия', 'вернуть деньги', 'возврат', 'что если не понравится', 'гарантии'], ['guarantee', 'refund', 'money back', 'what if i dont like it', 'warranty'],
    'Гарантия: что мы обещаем и что будет, если результат не подошёл.', 'Guarantee: what we promise and what happens if the result does not fit.'),
  e('compare', 'how', '/compare', undefined, 'Сравнение', 'Comparison', ['сравнение', 'чем вы лучше', 'чем вы отличаетесь', 'конкуренты', 'фрилансер', 'агентство или вы'], ['compare', 'comparison', 'why you', 'how are you different', 'competitors', 'freelancer', 'agency or you'],
    'Сравнение: мы, фрилансер и обычная студия бок о бок.', 'Comparison: us, a freelancer and a typical studio side by side.'),
  e('referral', 'how', '/referral', undefined, 'Рефералы', 'Referrals', ['реферал', 'реферальная программа', 'партнёрка', 'приведи друга', 'заработать', 'скидка за друга', 'бонус за друга', 'партнёрская программа'], ['referral', 'affiliate', 'invite a friend', 'earn', 'friend discount', 'partner program'],
    'Рефералы: 10% с каждого этапа друга, которого вы привели.', 'Referrals: 10% of every stage of a friend you brought.'),
  e('security', 'how', '/security', undefined, 'Безопасность', 'Security', ['безопасность', 'защита данных', 'данные', 'надёжно ли', 'где хранятся данные', 'безопасно ли', 'хранение данных'], ['security', 'data protection', 'safety', 'is it safe', 'where is data stored', 'data storage', 'secure'],
    'Безопасность: где лежат данные, кто имеет доступ и как это проверить.', 'Security: where the data lives, who has access and how to check.'),
  e('audit', 'how', '/audit', undefined, 'Аудит сайта', 'Website audit', ['аудит', 'бесплатный аудит', 'аудит сайта', 'проверить сайт', 'разбор сайта', 'что не так с сайтом'], ['audit', 'free audit', 'website audit', 'check my site', 'review my website', 'what is wrong with my site'],
    'Аудит сайта: бесплатный разбор за рабочий день.', 'Website audit: a free review within a working day.'),
  e('status', 'how', '/status', undefined, 'Статус сервисов', 'Service status', ['статус', 'статус сервисов', 'работает ли сайт', 'сбои', 'всё ли работает'], ['status', 'service status', 'is it down', 'outage', 'is everything working'],
    'Статус сервисов: всё ли работает прямо сейчас.', 'Service status: whether everything works right now.'),
  e('blog', 'how', '/blog', undefined, 'Блог', 'Blog', ['блог', 'статьи', 'почитать', 'новости', 'полезные материалы'], ['blog', 'articles', 'read', 'news', 'useful reading'],
    'Блог: разборы, цены и советы без воды.', 'Blog: breakdowns, prices and advice without fluff.'),
  e('terms', 'how', '/terms', undefined, 'Условия', 'Terms', ['условия', 'договор', 'оферта', 'пользовательское соглашение', 'условия работы'], ['terms', 'contract', 'offer', 'user agreement', 'terms of service'],
    'Условия: оферта и правила работы простыми словами.', 'Terms: the offer and the rules of work in plain words.'),
  e('privacy', 'how', '/privacy', undefined, 'Конфиденциальность', 'Privacy', ['политика конфиденциальности', 'персональные данные', 'конфиденциальность', 'cookie', 'куки'], ['privacy policy', 'personal data', 'privacy', 'cookies'],
    'Конфиденциальность: какие данные мы берём и зачем.', 'Privacy: which data we take and why.'),
]

const cabinet: SiteEntry[] = [
  e('cabinet', 'cabinet', '/cabinet', undefined, 'Личный кабинет', 'Client cabinet', ['кабинет', 'личный кабинет', 'мои проекты', 'мой проект', 'где мой проект', 'статус проекта'], ['cabinet', 'my account', 'client area', 'my projects', 'project status', 'where is my project'],
    'Личный кабинет: проект, документы, оплата и чат с менеджером.', 'Client cabinet: the project, documents, payment and a chat with a manager.'),
  e('cabinet-docs', 'cabinet', '/cabinet', '#cabinet-tabs', 'Документы и смета', 'Documents and estimate', ['где моя смета', 'мои документы', 'договор в кабинете', 'документы', 'акты', 'моя смета'], ['where is my estimate', 'my documents', 'contract in the cabinet', 'documents', 'my estimate'],
    'Документы и смета: всё по проекту в одном месте кабинета.', 'Documents and estimate: everything about the project in one place.'),
  e('cabinet-login', 'cabinet', '/cabinet/login', undefined, 'Вход', 'Sign in', ['войти', 'вход', 'авторизация', 'зарегистрироваться', 'регистрация', 'забыл пароль', 'создать аккаунт'], ['sign in', 'login', 'log in', 'sign up', 'register', 'forgot password', 'create account'],
    'Вход: по почте и паролю, регистрация занимает минуту.', 'Sign in: with email and password, sign-up takes a minute.'),
]

export const siteMap: readonly SiteEntry[] = [...home, ...products, ...services, ...teams, ...solutions, ...how, ...cabinet]

const byKey = new Map(siteMap.map((s) => [s.key, s]))
export const entryByKey = (key: string): SiteEntry | undefined => byKey.get(key)

/** Words people use for «price of X» next to the first names of an entry. */
const priceFrames: Record<Loc, readonly string[]> = {
  ru: ['сколько стоит {n}', 'цена {n}', 'стоимость {n}', '{n} цена', '{n} сколько стоит'],
  en: ['how much {n}', '{n} price', 'price of {n}', '{n} cost', 'cost of {n}'],
}

/** All synonyms of an entry in a language, price frames included. */
export function synonymsOf(entry: SiteEntry, loc: Loc): string[] {
  const out = [...entry.syn[loc], entry.name[loc]]
  if (entry.priced) {
    for (const noun of entry.syn[loc].slice(0, 3)) for (const f of priceFrames[loc]) out.push(f.replace('{n}', noun))
  }
  return out
}

/** `/ru/products/admin` + the entry: the href with the deep link, so it works even without JavaScript. */
export function entryHref(entry: SiteEntry, locale: Loc): string {
  const base = `/${locale}${entry.path}`
  return `${base}?fira=go:${entry.key}`
}

/** The page of an entry without the query, for «am I already there». */
export function entryPath(entry: SiteEntry, locale: Loc): string {
  return `/${locale}${entry.path}`
}

/** Is the pathname (any locale, with or without a trailing slash) the page of this entry? */
export function onEntryPage(entry: SiteEntry, pathname: string): boolean {
  const rest = pathname.split(/[?#]/)[0]!.replace(/^\/(ru|en)(?=\/|$)/, '').replace(/\/+$/, '')
  return rest === entry.path
}

export const groupNames: Record<Group, Record<Loc, string>> = {
  self: { ru: 'Для себя', en: 'For yourself' },
  business: { ru: 'Для бизнеса', en: 'For business' },
  teams: { ru: 'Команды и агенты', en: 'Teams and agents' },
  how: { ru: 'Как работаем', en: 'How we work' },
  cabinet: { ru: 'Кабинет', en: 'Cabinet' },
}

/** The entries of a group in map order, niche pages folded behind their index page (`solutions`). */
export function groupEntries(group: Group, opts: { niches?: boolean } = {}): SiteEntry[] {
  return siteMap.filter((s) => s.group === group && (opts.niches || !s.key.startsWith('solution-')))
}

/** Her one-liner without the name she starts with («Цены: от чего стартуем» -> «От чего стартуем»), for lists that show the name above. */
export function shortLine(entry: SiteEntry, loc: Loc): string {
  const line = entry.line[loc]
  const head = `${entry.name[loc]}: `
  if (!line.startsWith(head)) return line
  const rest = line.slice(head.length)
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}
