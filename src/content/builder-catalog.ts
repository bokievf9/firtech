import type {
  BuildGoal,
  StyleDensity,
  StyleKit,
  StyleMood,
  StylePalette,
  StyleShape,
  StyleType,
} from '../lib/builder'

// The builder's catalogue: business kinds, products and style names, RU and EN side by side, as
// typed tables. Kept out of ru.ts / en.ts on purpose: the lists are long and grow often. Prices are
// never here: a kind's preset and a product's parts are encoded builds (`websites.landing~x.seo`)
// and every number comes from pricing.ts through quote().
// No em or en dashes in copy (use a hyphen).

export type Loc = 'ru' | 'en'
export type L<T> = Record<Loc, T>
export const pick = <T>(table: L<T>, locale: string): T => table[locale === 'ru' ? 'ru' : 'en']

// ---------------------------------------------------------------- categories

export const kindCategories = [
  'food',
  'beauty',
  'retail',
  'services',
  'education',
  'realty',
  'travel',
  'b2b',
  'health',
  'other',
] as const
export type KindCategory = (typeof kindCategories)[number]

export const categoryNames: Record<KindCategory, L<string>> = {
  food: { ru: 'Еда', en: 'Food' },
  beauty: { ru: 'Красота и здоровье', en: 'Beauty and wellness' },
  retail: { ru: 'Торговля', en: 'Retail' },
  services: { ru: 'Услуги', en: 'Services' },
  education: { ru: 'Образование', en: 'Education' },
  realty: { ru: 'Недвижимость и финансы', en: 'Real estate and finance' },
  travel: { ru: 'Туризм', en: 'Travel' },
  b2b: { ru: 'B2B', en: 'B2B' },
  health: { ru: 'Медицина и уход', en: 'Medicine and care' },
  other: { ru: 'Другое', en: 'Other' },
}

// ------------------------------------------------------------------ products

// Ids carry no hyphen: they travel in the link as `p.adminbot-site`.
export const productIds = [
  'adminbot',
  'intake',
  'automation',
  'content',
  'miniapp',
  'agent',
  'aiteam',
  'site',
  'bot',
  'app',
] as const
export type ProductId = (typeof productIds)[number]

export type ProductEntry = {
  // An encoded build that the product pre-selects (see encodeBuild). Empty = nothing is priced.
  parts: string
  // True when pricing.ts has a matching price. False products show "по смете" and are never summed.
  priced: boolean
  name: L<string>
  hint: L<string>
}

// The product line from COMPANY.md "Что продаём", then the classic site, bot and app.
export const productCatalog: Record<ProductId, ProductEntry> = {
  adminbot: {
    parts: 'bots.booking.broadcasts',
    priced: true,
    name: { ru: 'Бот-администратор', en: 'Admin bot' },
    hint: {
      ru: 'Запись, напоминания и отзывы в Telegram, без звонков администратору',
      en: 'Bookings, reminders and reviews in Telegram, no calls to the front desk',
    },
  },
  intake: {
    parts: 'bots.faq.ai',
    priced: true,
    name: { ru: 'ИИ-приёмщик заявок 24/7', en: 'AI lead intake 24/7' },
    hint: {
      ru: 'Отвечает клиентам в Telegram, WhatsApp и Instagram и собирает заявки в любое время',
      en: 'Answers customers in Telegram, WhatsApp and Instagram and collects leads around the clock',
    },
  },
  automation: {
    parts: 'automation.integration.alerts',
    priced: true,
    name: { ru: 'Автоматизация рутины', en: 'Routine automation' },
    hint: {
      ru: 'Таблицы, CRM, мессенджеры, отчёты и рассылки связаны между собой',
      en: 'Sheets, CRM, messengers, reports and mailings wired together',
    },
  },
  content: {
    parts: '',
    priced: false,
    name: { ru: 'Контент на автопилоте', en: 'Content on autopilot' },
    hint: {
      ru: 'Посты, карточки и ролики по подписке, без вашего участия',
      en: 'Posts, product cards and short videos on subscription, hands off',
    },
  },
  miniapp: {
    parts: 'bots.miniapp.payments',
    priced: true,
    name: { ru: 'Telegram Mini App', en: 'Telegram Mini App' },
    hint: {
      ru: 'Магазин, запись или лояльность внутри Telegram с оплатой',
      en: 'A shop, bookings or loyalty inside Telegram, with payments',
    },
  },
  agent: {
    parts: '',
    priced: false,
    name: { ru: 'Личный агент', en: 'Personal agent' },
    hint: {
      ru: 'Помощник владельца, студента или фрилансера, как Dono и Polly',
      en: 'An assistant for an owner, student or freelancer, like Dono and Polly',
    },
  },
  aiteam: {
    parts: '',
    priced: false,
    name: { ru: 'Внедрение ИИ в компанию', en: 'AI for your company' },
    hint: {
      ru: 'База знаний, ответы по документам и обучение команды',
      en: 'A knowledge base, answers from your documents and team training',
    },
  },
  site: {
    parts: 'websites.landing',
    priced: true,
    name: { ru: 'Сайт', en: 'Website' },
    hint: {
      ru: 'Лендинг, сайт компании или магазин как основа для всего остального',
      en: 'A landing page, company site or shop as the base for everything else',
    },
  },
  bot: {
    parts: 'bots.faq',
    priced: true,
    name: { ru: 'Telegram-бот', en: 'Telegram bot' },
    hint: {
      ru: 'Бот для ответов, заявок, записи или заказов',
      en: 'A bot for answers, leads, bookings or orders',
    },
  },
  app: {
    parts: 'apps.pwa',
    priced: true,
    name: { ru: 'Приложение', en: 'App' },
    hint: {
      ru: 'Веб-приложение, мобильное приложение или внутренняя система',
      en: 'A web app, mobile app or internal system',
    },
  },
}

// -------------------------------------------------------------------- styles

export const paletteNames: Record<StylePalette, L<string>> = {
  fir: { ru: 'Лайм на ночи', en: 'Lime night' },
  midnight: { ru: 'Полночь', en: 'Midnight' },
  noir: { ru: 'Нуар и золото', en: 'Noir gold' },
  ember: { ru: 'Угли', en: 'Ember' },
  aurora: { ru: 'Аврора', en: 'Aurora' },
  forest: { ru: 'Тёмный лес', en: 'Deep forest' },
  plum: { ru: 'Слива', en: 'Plum' },
  graphite: { ru: 'Графит', en: 'Graphite' },
  paper: { ru: 'Бумага', en: 'Paper' },
  sand: { ru: 'Песок', en: 'Sand' },
  mintlight: { ru: 'Свежая мята', en: 'Fresh mint' },
  skylight: { ru: 'Ясное небо', en: 'Clear sky' },
  blush: { ru: 'Румяна', en: 'Blush' },
  lemon: { ru: 'Лимонад', en: 'Lemonade' },
  lavender: { ru: 'Лаванда', en: 'Lavender' },
  latte: { ru: 'Латте', en: 'Latte' },
}

export const typeNames: Record<StyleType, { name: L<string>; hint: L<string> }> = {
  geometric: {
    name: { ru: 'Геометрия', en: 'Geometric' },
    hint: { ru: 'Широкие круглые буквы', en: 'Wide, round letters' },
  },
  grotesk: {
    name: { ru: 'Гротеск', en: 'Grotesk' },
    hint: { ru: 'Чёткий и современный', en: 'Sharp and modern' },
  },
  humanist: {
    name: { ru: 'Гуманистический', en: 'Humanist' },
    hint: { ru: 'Тёплый и читаемый', en: 'Warm and readable' },
  },
  serif: {
    name: { ru: 'Антиква', en: 'Serif display' },
    hint: { ru: 'С засечками, дорого', en: 'With serifs, upscale' },
  },
  mono: {
    name: { ru: 'Моно', en: 'Mono tech' },
    hint: { ru: 'Технический, как код', en: 'Technical, like code' },
  },
  rounded: {
    name: { ru: 'Округлый', en: 'Rounded' },
    hint: { ru: 'Мягкий и дружелюбный', en: 'Soft and friendly' },
  },
  condensed: {
    name: { ru: 'Узкий', en: 'Condensed' },
    hint: { ru: 'Плотный, для заголовков', en: 'Tight, made for headlines' },
  },
}

export const shapeNames: Record<StyleShape, L<string>> = {
  sharp: { ru: 'Острые углы', en: 'Sharp' },
  soft: { ru: 'Мягкие углы', en: 'Soft' },
  pill: { ru: 'Круглые', en: 'Pill' },
}
export const densityNames: Record<StyleDensity, L<string>> = {
  airy: { ru: 'Просторно', en: 'Airy' },
  compact: { ru: 'Компактно', en: 'Compact' },
}
export const moodNames: Record<StyleMood, { name: L<string>; hint: L<string> }> = {
  minimal: {
    name: { ru: 'Минимализм', en: 'Minimal' },
    hint: { ru: 'Ничего лишнего', en: 'Nothing extra' },
  },
  bold: {
    name: { ru: 'Смелый', en: 'Bold' },
    hint: { ru: 'Крупно и жирно', en: 'Big and heavy' },
  },
  playful: {
    name: { ru: 'Игривый', en: 'Playful' },
    hint: { ru: 'Стикеры и тени', en: 'Stickers and shadows' },
  },
  premium: {
    name: { ru: 'Премиум', en: 'Premium' },
    hint: { ru: 'Строго и дорого', en: 'Restrained and rich' },
  },
}

// Ready looks: each one sets every axis at once. The axes themselves live in builder-style.ts.
export const kitNames: Record<StyleKit, { name: L<string>; hint: L<string> }> = {
  fir: { name: { ru: 'Fir Tech', en: 'Fir Tech' }, hint: { ru: 'Лайм на тёмном, чётко', en: 'Lime on dark, crisp' } },
  nocturne: { name: { ru: 'Ночной клуб', en: 'Nightclub' }, hint: { ru: 'Чёрный, узкие буквы', en: 'Black, tight type' } },
  atelier: { name: { ru: 'Ателье', en: 'Atelier' }, hint: { ru: 'Антиква на бумаге', en: 'Serif on paper' } },
  sunny: { name: { ru: 'Солнечный', en: 'Sunny' }, hint: { ru: 'Лимонный и круглый', en: 'Lemon and round' } },
  candy: { name: { ru: 'Конфетти', en: 'Candy' }, hint: { ru: 'Розовый, стикеры', en: 'Pink, stickers' } },
  brutal: { name: { ru: 'Брутализм', en: 'Brutalist' }, hint: { ru: 'Моно и толстые рамки', en: 'Mono and thick borders' } },
  luxe: { name: { ru: 'Люкс', en: 'Luxe' }, hint: { ru: 'Золото на чёрном', en: 'Gold on black' } },
  clinic: { name: { ru: 'Клиника', en: 'Clinic' }, hint: { ru: 'Чисто, спокойно', en: 'Clean and calm' } },
  eco: { name: { ru: 'Эко', en: 'Eco' }, hint: { ru: 'Мята и воздух', en: 'Mint and air' } },
  bistro: { name: { ru: 'Бистро', en: 'Bistro' }, hint: { ru: 'Песок, антиква, тепло', en: 'Sand, serif, warm' } },
  barber: { name: { ru: 'Барбершоп', en: 'Barbershop' }, hint: { ru: 'Графит и оранжевый', en: 'Graphite and orange' } },
  techy: { name: { ru: 'Технологичный', en: 'Techy' }, hint: { ru: 'Полночь и моно', en: 'Midnight and mono' } },
  aurora: { name: { ru: 'Аврора', en: 'Aurora' }, hint: { ru: 'Фиолетовый и мята', en: 'Violet and mint' } },
  journal: { name: { ru: 'Журнал', en: 'Journal' }, hint: { ru: 'Лаванда, строгая сетка', en: 'Lavender, strict grid' } },
  kids: { name: { ru: 'Детский', en: 'Kids' }, hint: { ru: 'Небо и круглые формы', en: 'Sky and round shapes' } },
  forest: { name: { ru: 'Лесной', en: 'Forest' }, hint: { ru: 'Тёмная зелень, премиум', en: 'Deep green, premium' } },
  wine: { name: { ru: 'Винный', en: 'Wine' }, hint: { ru: 'Слива и антиква', en: 'Plum and serif' } },
  coffee: { name: { ru: 'Кофейня', en: 'Coffee house' }, hint: { ru: 'Латте, уютно', en: 'Latte, cosy' } },
  ember: { name: { ru: 'Огонь', en: 'Ember' }, hint: { ru: 'Угли и крупный шрифт', en: 'Coals and big type' } },
}

// -------------------------------------------------------------------- screens

export const builderUi = {
  steps: {
    ru: ['Бизнес', 'Что собираем', 'Цель', 'Что делаем', 'Функции', 'Стиль', 'Детали', 'Итог'],
    en: ['Business', 'Products', 'Goal', 'Parts', 'Features', 'Style', 'Details', 'Summary'],
  } as L<string[]>,
  intro: {
    ru: 'Восемь коротких шагов. Цена и макет обновляются сразу.',
    en: 'Eight short steps. The price and the mockup update as you go.',
  },
  kindTitle: { ru: 'Чем занимается ваш бизнес?', en: 'What does your business do?' },
  kindSub: {
    ru: 'Больше 50 ниш. Подберём стартовый набор и продукты, дальше всё можно поменять.',
    en: '50+ niches. We pick a starting set and products, then you can change everything.',
  },
  kindMore: { ru: 'Показать все ниши', en: 'Show all niches' },
  kindFewer: { ru: 'Свернуть', en: 'Show fewer' },
  kindFilterAll: { ru: 'Все', en: 'All' },
  kindOtherHint: { ru: 'Соберём состав с нуля', en: 'We build from scratch' },
  productsTitle: { ru: 'Что собираем', en: 'What are we building?' },
  productsSub: {
    ru: 'Выберите продукты. Каждый сам отмечает нужные части и функции. Можно пропустить и собрать вручную на следующих шагах.',
    en: 'Pick products. Each one pre-selects the parts and features it needs. You can skip this and build by hand in the next steps.',
  },
  productsRecommended: { ru: 'Обычно для вашего бизнеса', en: 'Usually for your business' },
  productsRecommendedFor: { ru: 'Обычно для', en: 'Usually for' },
  productsMore: { ru: 'Остальные продукты', en: 'More products' },
  productPriced: { ru: 'Цена из конструктора', en: 'Priced in the builder' },
  onRequest: { ru: 'по смете', en: 'on quote' },
  onRequestNote: {
    ru: 'Продукты «по смете» не входят в сумму: цену назовём после короткого созвона.',
    en: 'Products "on quote" are not in the total: we name the price after a short call.',
  },
  onRequestLabel: { ru: 'По смете, без цены', en: 'On quote, no price' },
  onRequestShort: { ru: 'без цены', en: 'no price' },
  kindLabel: { ru: 'Бизнес', en: 'Business' },
  productsLabel: { ru: 'Продукты', en: 'Products' },
  customStyle: { ru: 'Свой стиль', en: 'Custom style' },
  styleTitle: { ru: 'Выберите образ', en: 'Pick a look' },
  styleSub: {
    ru: 'Готовые образы меняют макет целиком. Потом можно настроить каждую деталь. Стиль меняет только макет и никогда не меняет цену.',
    en: 'Ready looks restyle the whole mockup. Then tune every detail. Style only restyles the mockup and never changes the price.',
  },
  looksTitle: { ru: 'Готовые образы', en: 'Ready looks' },
  tune: { ru: 'Настроить', en: 'Customize' },
  tuneHide: { ru: 'Скрыть настройки', en: 'Hide settings' },
  tuneTitle: { ru: 'Настройте вручную', en: 'Tune by hand' },
  axes: {
    palette: { ru: 'Палитра', en: 'Palette' },
    type: { ru: 'Шрифты', en: 'Typography' },
    shape: { ru: 'Форма', en: 'Shape' },
    density: { ru: 'Плотность', en: 'Density' },
    mood: { ru: 'Настроение', en: 'Mood' },
  },
  reset: { ru: 'Сбросить', en: 'Reset' },
  sampleCta: { ru: 'Записаться', en: 'Book' },
  dark: { ru: 'тёмная', en: 'dark' },
  light: { ru: 'светлая', en: 'light' },
  solutionsLinkAll: { ru: 'Все 50+ решений по нишам', en: 'All 50+ niche solutions' },
  recommendedProducts: { ru: 'Обычно берут', en: 'Usually chosen' },
  noPriceInQuote: { ru: 'по смете', en: 'on quote' },
  totalOnRequest: { ru: 'по смете', en: 'on quote' },
}

// What the mockup shows inside: generic copy per block, so every kind and product renders.
export type PreviewCopy = {
  menu: [string, [string, string], [string, string], [string, string]]
  book: string
  services: string[]
  catalog: string
  lesson: [string, string]
  listing: string[]
  trip: string[]
  quote: [string, string]
  chatQ: string
  chatA: string
  content: string[]
  contentTitle: string
  agentTitle: string
  agentTasks: string[]
  teamTitle: string
  teamQ: string
  teamA: string
  leadNew: string
  cart: string
  cta: string
  headline: string
}
export const previewCopy: L<PreviewCopy> = {
  ru: {
    menu: ['Меню', ['Капучино', '$3'], ['Завтрак', '$6'], ['Десерт дня', '$4']],
    book: 'Запись',
    services: ['Услуга 1', 'Услуга 2', 'Услуга 3'],
    catalog: 'Каталог',
    lesson: ['Урок 3 из 12', 'Грамматика: прошедшее время'],
    listing: ['2 комнаты, центр', '3 комнаты, парк'],
    trip: ['Дубай, 7 ночей', 'Стамбул, 5 ночей'],
    quote: ['Рассчитать стоимость', 'Тариф "Бизнес"'],
    chatQ: 'Есть свободное время на субботу?',
    chatA: 'Да, 11:00 и 14:30. Записать вас?',
    content: ['Пн', 'Ср', 'Пт', 'Сб'],
    contentTitle: 'План постов',
    agentTitle: 'Личный агент',
    agentTasks: ['Утренняя сводка', 'Дедлайн в пятницу', 'Напомнить про оплату'],
    teamTitle: 'База знаний',
    teamQ: 'Какой срок возврата?',
    teamA: '14 дней, п. 3.2 договора',
    leadNew: 'Новая заявка',
    cart: 'Корзина',
    cta: 'Оставить заявку',
    headline: 'Всё для ваших клиентов в одном месте',
  },
  en: {
    menu: ['Menu', ['Cappuccino', '$3'], ['Breakfast', '$6'], ['Dessert of the day', '$4']],
    book: 'Book',
    services: ['Service 1', 'Service 2', 'Service 3'],
    catalog: 'Catalogue',
    lesson: ['Lesson 3 of 12', 'Grammar: past tense'],
    listing: ['2 rooms, downtown', '3 rooms, by the park'],
    trip: ['Dubai, 7 nights', 'Istanbul, 5 nights'],
    quote: ['Get a quote', '"Business" plan'],
    chatQ: 'Any free time on Saturday?',
    chatA: 'Yes, 11:00 and 14:30. Book you in?',
    content: ['Mon', 'Wed', 'Fri', 'Sat'],
    contentTitle: 'Post plan',
    agentTitle: 'Personal agent',
    agentTasks: ['Morning brief', 'Deadline on Friday', 'Remind about payment'],
    teamTitle: 'Knowledge base',
    teamQ: 'What is the return period?',
    teamA: '14 days, contract clause 3.2',
    leadNew: 'New lead',
    cart: 'Cart',
    cta: 'Get in touch',
    headline: 'Everything for your customers in one place',
  },
}

// Solutions pages for kinds without hand-written copy: the same four questions for every niche,
// the prices filled in from the preset's quote.
export function genericFaq(
  locale: string,
  name: string,
  from: string,
): { q: string; a: string }[] {
  return pick(
    {
      ru: [
        {
          q: `Сколько стоит решение для ниши «${name}»?`,
          a: `Стартовый набор от ${from}. Точную цену закрепим в смете после короткого созвона: в конструкторе можно убрать лишнее или добавить нужное.`,
        },
        {
          q: 'За какое время это можно запустить?',
          a: 'Сроки указаны по каждой части набора. Часть работ ведётся параллельно, общий срок назовём в смете.',
        },
        {
          q: 'У меня уже есть сайт или бот. Нужно начинать с нуля?',
          a: 'Нет. Подключим то, что есть, и добавим недостающее: например, запись, оплату или приём заявок.',
        },
        {
          q: 'Можно ли потом изменить состав?',
          a: 'Да. Набор можно расширять по частям: добавлять функции, продукты и поддержку без переделки готового.',
        },
      ],
      en: [
        {
          q: `How much does a solution for "${name}" cost?`,
          a: `The starting set is from ${from}. We fix the exact price in the quote after a short call: in the builder you can remove what you do not need or add more.`,
        },
        {
          q: 'How fast can this launch?',
          a: 'Terms are listed per part of the set. Some work runs in parallel, and we name the overall term in the quote.',
        },
        {
          q: 'I already have a site or a bot. Do I start from scratch?',
          a: 'No. We connect what you have and add what is missing: bookings, payments or lead intake, for example.',
        },
        {
          q: 'Can I change the set later?',
          a: 'Yes. The set grows part by part: add features, products and support without redoing what is built.',
        },
      ],
    },
    locale,
  )
}

// ---------------------------------------------------------------------- kinds

export const kindIds = [
  // food
  'cafe', 'restaurant', 'coffee', 'bakery', 'delivery', 'catering',
  // beauty and wellness
  'barber', 'salon', 'nails', 'spa', 'cosmetology', 'dentist', 'clinic', 'fitness', 'yoga', 'massage',
  // retail
  'shop', 'webshop', 'flowers', 'gifts', 'clothing', 'electronics', 'furniture', 'autoparts',
  // services
  'carservice', 'carwash', 'drycleaning', 'cleaning', 'repair', 'renovation', 'photo', 'events', 'printing',
  // education
  'tutor', 'languages', 'kidscenter', 'drivingschool', 'onlineschool',
  // real estate and finance
  'realty', 'lawyers', 'accounting', 'insurance',
  // travel
  'travel', 'hotel', 'guesthouse', 'tours',
  // b2b
  'services', 'logistics', 'wholesale', 'itservices', 'marketing', 'coworking',
  // medicine and care
  'pharmacy', 'vet', 'petshop',
  // other
  'other',
] as const
export type KindId = (typeof kindIds)[number]

export type KindMock =
  | 'menu'
  | 'booking'
  | 'catalog'
  | 'lesson'
  | 'listing'
  | 'trip'
  | 'services'
  | 'quote'
  | 'chat'

// name, page headline, one-sentence lead (also the card and the meta description), three pains,
// three things the visitor gets (each "get" answers the pain at the same position).
export type KindCopy = readonly [
  name: string,
  title: string,
  sub: string,
  pains: readonly [string, string, string],
  gets: readonly [string, string, string],
]

export type KindEntry = {
  category: KindCategory
  emoji: string
  mock: KindMock
  goals: readonly BuildGoal[]
  // One or two products that usually fit this niche (pre-selected when the kind is picked).
  products: readonly ProductId[]
  // The starting set as an encoded build: parts and extras only.
  preset: string
  ru: KindCopy
  en: KindCopy
}

// Starting sets reused across niches. Kinds can differ in products and copy while sharing a set.
const CAFE = 'websites.landing.telegram~bots.booking.payments~x.seo'
const BOOK = 'bots.booking.broadcasts~websites.landing.telegram~x.seo'
const SHOP = 'websites.shop.payments-cms~x.seo-support'
const TGSHOP = 'bots.miniapp.payments~websites.landing.telegram~x.seo'
const DELIV = 'bots.miniapp.payments-admin~automation.integration.alerts~x.support'
const SERV = 'websites.company.telegram~automation.crm.training'
const LEADS = 'websites.landing.telegram~bots.faq.ai~x.seo'
const CLINIC = 'websites.company.telegram~bots.booking.broadcasts~x.seo'
const EDU = 'websites.landing.telegram~bots.booking.broadcasts~automation.crm'
const ONLINE = 'websites.company.payments~bots.faq.ai~automation.crm'
const TRAVEL = 'websites.company.language-telegram~bots.faq.ai~automation.crm'
const HOTEL = 'websites.company.language-telegram~bots.booking.payments~x.seo'
const REAL = 'websites.company.cms~bots.faq.ai~automation.crm~x.seo'

const k = (
  category: KindCategory,
  emoji: string,
  mock: KindMock,
  goals: readonly BuildGoal[],
  products: readonly ProductId[],
  preset: string,
  ru: KindCopy,
  en: KindCopy,
): KindEntry => ({ category, emoji, mock, goals, products, preset, ru, en })

export const kindCatalog: Record<KindId, KindEntry> = {
  // ------------------------------------------------------------------- food
  cafe: k('food', '☕', 'menu', ['booking', 'sales'], ['adminbot', 'site'], CAFE,
    ['Кафе и ресторан', 'Сайт и Telegram-бот для кафе и ресторана', 'Меню на сайте, бронь столов и заказы в Telegram-боте.',
      ['Бронь по телефону, трубку некому взять', 'Меню в Instagram устарело', 'Заказы на вынос теряются в переписке'],
      ['Бронь стола в боте за минуту', 'Актуальное меню и часы работы', 'Заказ и оплата в одном чате']],
    ['Cafe or restaurant', 'A website and Telegram bot for a cafe or restaurant', 'Menu on the site, table booking and orders in a Telegram bot.',
      ['Bookings by phone and nobody to answer', 'The Instagram menu is out of date', 'Takeaway orders get lost in chats'],
      ['Table booking in a bot within a minute', 'A current menu and opening hours', 'Order and payment in one chat']]),
  restaurant: k('food', '🍽️', 'menu', ['booking', 'brand'], ['adminbot', 'site'], 'websites.company.language-telegram~bots.booking.payments~x.seo',
    ['Ресторан и банкеты', 'Сайт ресторана с бронью столов и банкетов', 'Меню, бронь зала и заявки на банкет с предоплатой в одном месте.',
      ['Банкеты согласуют днями в мессенджерах', 'Туристы не находят меню на английском', 'Столы пустуют в будни, а гости не знают об акциях'],
      ['Заявка на банкет с датой и гостями', 'Сайт на двух языках с меню', 'Рассылка акций гостям в Telegram']],
    ['Restaurant and banquets', 'A restaurant website with table and banquet booking', 'Menu, hall booking and banquet requests with a prepayment in one place.',
      ['Banquets take days of messaging to agree', 'Tourists cannot find an English menu', 'Tables sit empty on weekdays and guests miss the deals'],
      ['A banquet request with date and guests', 'A two-language site with the menu', 'Deals sent to guests in Telegram']]),
  coffee: k('food', '🥐', 'menu', ['sales', 'brand'], ['miniapp', 'content'], TGSHOP,
    ['Кофейня', 'Mini App для кофейни: заказ заранее и лояльность', 'Заказ кофе заранее, бонусные баллы и страница на картах.',
      ['Очередь в час пик, люди уходят', 'Постоянных гостей никак не отмечаем', 'Соцсети ведутся от случая к случаю'],
      ['Заказ заранее и забрать без очереди', 'Бонусы за каждую десятую чашку', 'Регулярные посты без вашего участия']],
    ['Coffee shop', 'A Mini App for a coffee shop: pre-orders and loyalty', 'Pre-order coffee, loyalty points and a page on the maps.',
      ['Rush-hour queues send people away', 'Regulars are not rewarded in any way', 'Social media is updated at random'],
      ['Order ahead and pick up without a queue', 'A free drink after every tenth cup', 'Regular posts without your effort']]),
  bakery: k('food', '🍞', 'catalog', ['sales', 'routine'], ['miniapp', 'content'], 'bots.miniapp.payments~websites.landing.telegram~x.seo',
    ['Пекарня и кондитерская', 'Сайт и бот для пекарни: заказ тортов и выпечки', 'Каталог выпечки, предзаказ на дату и оплата в Telegram.',
      ['Торты на заказ принимают в переписке и путают даты', 'Свежая выпечка раскупается, а о ней знают не все', 'Нет каталога с ценами и фото'],
      ['Предзаказ торта с датой и надписью', 'Рассылка «сегодня свежее»', 'Каталог с фото и ценами']],
    ['Bakery and pastry shop', 'A site and bot for a bakery: cake and pastry orders', 'A pastry catalogue, pre-orders for a date and payment in Telegram.',
      ['Custom cakes are taken in chats and dates get mixed up', 'Fresh pastry sells out and few people know', 'There is no catalogue with prices and photos'],
      ['A cake pre-order with date and inscription', 'A "fresh today" broadcast', 'A catalogue with photos and prices']]),
  delivery: k('food', '🛵', 'menu', ['sales', 'routine'], ['miniapp', 'automation'], DELIV,
    ['Доставка', 'Mini App и учёт заказов для доставки еды', 'Заказ и оплата в Telegram, админка и уведомления курьерам.',
      ['Заказы приходят из пяти мессенджеров и теряются', 'Агрегаторы берут большую комиссию', 'Курьеры не знают, что менять в заказе'],
      ['Один каталог и корзина в Telegram', 'Свои клиенты без комиссии агрегатора', 'Уведомления курьеру и менеджеру']],
    ['Delivery', 'A Mini App and order tracking for food delivery', 'Ordering and payment in Telegram, an admin panel and courier alerts.',
      ['Orders arrive from five messengers and get lost', 'Aggregators take a big commission', 'Couriers do not see order changes'],
      ['One catalogue and cart in Telegram', 'Your own customers without a commission', 'Alerts to the courier and the manager']]),
  catering: k('food', '🍱', 'quote', ['leads', 'routine'], ['intake', 'automation'], 'websites.company.telegram~bots.faq.ai~automation.crm',
    ['Кейтеринг', 'Сайт и ИИ-приёмщик заявок для кейтеринга', 'Меню, расчёт на количество гостей и заявки без долгой переписки.',
      ['Каждую заявку считают вручную в переписке', 'Клиенты уходят, пока вы готовите расчёт', 'Нет портфолио и отзывов в одном месте'],
      ['Предварительный расчёт на количество гостей', 'Ответ на заявку в любое время', 'Сайт с меню и примерами мероприятий']],
    ['Catering', 'A site and AI lead intake for a catering company', 'A menu, a per-guest estimate and leads without long chats.',
      ['Every request is priced by hand in chats', 'Clients leave while you prepare a quote', 'No portfolio and reviews in one place'],
      ['A preliminary estimate per number of guests', 'A reply to every request at any hour', 'A site with a menu and event examples']]),

  // ---------------------------------------------------------------- beauty
  barber: k('beauty', '💈', 'booking', ['booking', 'brand'], ['adminbot', 'site'], BOOK,
    ['Барбершоп', 'Запись в барбершоп через Telegram-бота', 'Клиент выбирает мастера и время сам, вы видите расписание.',
      ['Мастера отвечают клиентам вместо стрижки', 'Окна в расписании остаются пустыми', 'Клиенты забывают о записи'],
      ['Запись к мастеру на удобное время', 'Рассылка на свободные окна', 'Напоминание за день и за два часа']],
    ['Barbershop', 'Barbershop booking through a Telegram bot', 'Clients pick the barber and the time, you see the schedule.',
      ['Barbers answer messages instead of cutting hair', 'Gaps stay empty in the schedule', 'Clients forget their appointment'],
      ['Booking with a barber at a good time', 'A broadcast for free slots', 'Reminders a day and two hours ahead']]),
  salon: k('beauty', '💇', 'booking', ['booking', 'brand'], ['adminbot', 'site'], BOOK,
    ['Салон и запись', 'Сайт и онлайн-запись для салона красоты', 'Запись к мастеру 24/7, напоминания и рассылки постоянным клиентам.',
      ['Администратор не успевает отвечать в Instagram', 'Клиенты не приходят без напоминания', 'Нет способа вернуть давних клиентов'],
      ['Онлайн-запись в Telegram и на сайте', 'Напоминания, которые снижают неявки', 'Рассылки с акциями и возвратом клиентов']],
    ['Salon and bookings', 'A website and online booking for a beauty salon', 'Booking with a stylist around the clock, reminders and mailings to regulars.',
      ['The front desk cannot keep up with Instagram', 'Clients skip visits without a reminder', 'No way to win back lapsed clients'],
      ['Online booking in Telegram and on the site', 'Reminders that cut no-shows', 'Mailings with deals to bring clients back']]),
  nails: k('beauty', '💅', 'booking', ['booking', 'brand'], ['adminbot', 'content'], BOOK,
    ['Ногтевая студия', 'Онлайн-запись для ногтевой студии', 'Запись на маникюр с выбором дизайна, мастера и времени.',
      ['Запись идёт в личные сообщения мастера', 'Клиенты опаздывают или не приходят', 'Фото работ лежат в галерее телефона'],
      ['Запись на маникюр и снятие в боте', 'Напоминание с адресом и временем', 'Галерея работ на сайте и в соцсетях']],
    ['Nail studio', 'Online booking for a nail studio', 'Manicure booking with design, technician and time.',
      ['Bookings land in the technician\'s private messages', 'Clients run late or do not show up', 'Photos of work sit in a phone gallery'],
      ['Manicure and removal booking in a bot', 'A reminder with the address and time', 'A work gallery on the site and in socials']]),
  spa: k('beauty', '🧖', 'booking', ['booking', 'brand'], ['adminbot', 'site'], 'websites.company.telegram~bots.booking.payments~x.seo',
    ['Спа и релакс-центр', 'Сайт спа с записью на процедуры и подарочными картами', 'Программы, запись и предоплата, а гость сразу видит, что входит.',
      ['Программы описаны в разных местах', 'Предоплату собирают вручную', 'Сертификаты продаются только лично'],
      ['Программы и цены на одной странице', 'Запись с предоплатой в боте', 'Подарочные сертификаты онлайн']],
    ['Spa and relaxation centre', 'A spa website with booking and gift cards', 'Programs, booking and prepayment, and the guest sees what is included.',
      ['Programs are described in different places', 'Prepayments are collected by hand', 'Gift certificates are sold in person only'],
      ['Programs and prices on one page', 'Booking with prepayment in a bot', 'Gift certificates online']]),
  cosmetology: k('beauty', '✨', 'booking', ['booking', 'leads'], ['adminbot', 'intake'], CLINIC,
    ['Косметолог', 'Сайт и бот для косметолога с онлайн-записью', 'Процедуры, цены, запись и напоминания о повторном визите.',
      ['Клиенты спрашивают одно и то же по процедурам', 'Повторные визиты никто не отслеживает', 'Нет места, где видны результаты и отзывы'],
      ['Ответы на частые вопросы по процедурам', 'Напоминание о повторном визите', 'Страница с результатами и отзывами']],
    ['Cosmetologist', 'A site and bot for a cosmetologist with online booking', 'Procedures, prices, booking and follow-up visit reminders.',
      ['Clients ask the same questions about procedures', 'Repeat visits are not tracked by anyone', 'No place to show results and reviews'],
      ['Answers to common questions on procedures', 'A reminder for the next visit', 'A page with results and reviews']]),
  dentist: k('beauty', '🦷', 'booking', ['booking', 'leads'], ['adminbot', 'intake'], CLINIC,
    ['Стоматология', 'Запись в стоматологию через сайт и Telegram', 'Запись на приём и первичная консультация, а напоминания снижают неявки.',
      ['Пациенты звонят в нерабочее время и не дозваниваются', 'Неявки оставляют кресло пустым', 'Цены и врачи описаны в разных местах'],
      ['Запись на приём 24/7 в боте', 'Напоминание о приёме и профилактике', 'Страницы врачей, услуг и цен']],
    ['Dental clinic', 'Dentist booking through a site and Telegram', 'Booking an appointment and a first consultation, with reminders that cut no-shows.',
      ['Patients call after hours and cannot get through', 'No-shows leave the chair empty', 'Prices and doctors are described in different places'],
      ['Appointment booking around the clock in a bot', 'Reminders for the visit and check-ups', 'Pages for doctors, services and prices']]),
  clinic: k('beauty', '🏥', 'booking', ['booking', 'routine'], ['adminbot', 'automation'], 'websites.company.language-telegram~bots.booking.broadcasts~automation.crm~x.seo',
    ['Клиника и медцентр', 'Сайт и запись для частной клиники', 'Врачи, услуги, запись к специалисту и учёт обращений в одной системе.',
      ['Регистратура перегружена звонками', 'Обращения теряются между мессенджерами', 'Пациенту сложно выбрать врача'],
      ['Запись к врачу в боте и на сайте', 'Единая база обращений', 'Страницы врачей с графиком и отзывами']],
    ['Clinic and medical centre', 'A site and booking for a private clinic', 'Doctors, services, specialist booking and inquiry tracking in one system.',
      ['The front desk is swamped with calls', 'Inquiries get lost between messengers', 'Patients struggle to pick a doctor'],
      ['Booking a doctor in a bot and on the site', 'One database of inquiries', 'Doctor pages with schedule and reviews']]),
  fitness: k('beauty', '🏋️', 'booking', ['booking', 'sales'], ['adminbot', 'miniapp'], 'bots.miniapp.payments~websites.landing.telegram~x.seo',
    ['Фитнес-клуб', 'Сайт и Mini App для фитнес-клуба', 'Расписание занятий, запись на тренировки и абонементы в Telegram.',
      ['Расписание меняется, а гости видят старое', 'Абонементы продлевают по звонку менеджера', 'Клиенты пропадают после пробного занятия'],
      ['Живое расписание и запись на занятие', 'Продление абонемента с оплатой онлайн', 'Рассылка после пробного визита']],
    ['Fitness club', 'A site and Mini App for a fitness club', 'Class schedule, workout booking and memberships in Telegram.',
      ['The schedule changes and guests see the old one', 'Memberships are renewed by a manager\'s call', 'Clients vanish after a trial session'],
      ['A live schedule and class booking', 'Membership renewal with online payment', 'A follow-up after the trial visit']]),
  yoga: k('beauty', '🧘', 'booking', ['booking', 'brand'], ['adminbot', 'content'], BOOK,
    ['Йога-студия', 'Запись на занятия для йога-студии', 'Расписание групп, запись, абонементы и спокойный сайт студии.',
      ['Группы заполняются неравномерно', 'Запись идёт в личных сообщениях', 'Новичкам непонятно, с чего начать'],
      ['Запись в группу и лист ожидания', 'Абонементы и разовые визиты онлайн', 'Страница для новичков с ответами']],
    ['Yoga studio', 'Class booking for a yoga studio', 'Group schedule, booking, memberships and a calm studio site.',
      ['Classes fill unevenly', 'Booking goes through private messages', 'Beginners do not know where to start'],
      ['Class booking with a waiting list', 'Memberships and drop-ins online', 'A beginners page with answers']]),
  massage: k('beauty', '💆', 'booking', ['booking', 'routine'], ['adminbot', 'site'], BOOK,
    ['Массаж', 'Онлайн-запись для массажиста и кабинета', 'Запись на сеанс, напоминания и рассылка для постоянных клиентов.',
      ['Приходится отвечать на сообщения между сеансами', 'Клиенты отменяют в последний момент', 'Нет простого способа вернуть постоянных'],
      ['Запись на свободное время без переписки', 'Напоминание и подтверждение сеанса', 'Рассылка постоянным клиентам']],
    ['Massage', 'Online booking for a massage therapist or room', 'Session booking, reminders and a mailing to regulars.',
      ['You answer messages between sessions', 'Clients cancel at the last minute', 'No simple way to bring regulars back'],
      ['Booking a free slot without chatting', 'Reminders and session confirmation', 'A mailing to regular clients']]),

  // ---------------------------------------------------------------- retail
  shop: k('retail', '🛍️', 'catalog', ['sales', 'brand'], ['site', 'miniapp'], SHOP,
    ['Магазин', 'Интернет-магазин с оплатой и каталогом', 'Каталог, корзина, оплата и управление товарами без программиста.',
      ['Заказы принимают в директе и теряют', 'Остатки и цены обновляют вручную в трёх местах', 'Нет онлайн-оплаты'],
      ['Каталог, корзина и оформление заказа', 'Панель управления товарами', 'Оплата картой и в Telegram']],
    ['Shop', 'An online store with payment and a catalogue', 'Catalogue, cart, payment and product management without a programmer.',
      ['Orders arrive in DMs and get lost', 'Stock and prices are updated by hand in three places', 'No online payment'],
      ['Catalogue, cart and checkout', 'A product management panel', 'Card and Telegram payments']]),
  webshop: k('retail', '🛒', 'catalog', ['sales', 'routine'], ['site', 'automation'], 'websites.shop.language-payments-cms~automation.integration.sheets~x.seo-support',
    ['Интернет-магазин', 'Интернет-магазин под ключ с учётом заказов', 'Каталог, оплата, уведомления о заказах и выгрузка в таблицу.',
      ['Заказы собирают из почты, чатов и звонков', 'Нет единой выгрузки для склада', 'Конкуренты выше в поиске'],
      ['Заказы в одном списке с уведомлениями', 'Выгрузка в Google Таблицы для склада', 'Настройка для поиска по товарам']],
    ['Online store', 'A turnkey online store with order tracking', 'Catalogue, payment, order alerts and a spreadsheet export.',
      ['Orders are pulled from email, chats and calls', 'No single export for the warehouse', 'Competitors rank higher in search'],
      ['Orders in one list with alerts', 'Google Sheets export for the warehouse', 'Setup for product search']]),
  flowers: k('retail', '💐', 'catalog', ['sales', 'brand'], ['miniapp', 'content'], TGSHOP,
    ['Цветы', 'Mini App для цветочного магазина с заказом и доставкой', 'Букеты с фото, заказ на дату и оплата в Telegram.',
      ['Заказы к празднику приходят волной и путаются', 'Клиенты просят фото и цены каждый раз', 'Нет предзаказа на 8 марта и другие даты'],
      ['Каталог букетов с фото и ценой', 'Предзаказ на дату и время доставки', 'Напоминание о важных датах клиентов']],
    ['Flowers', 'A Mini App for a flower shop with ordering and delivery', 'Bouquets with photos, orders for a date and payment in Telegram.',
      ['Holiday orders come in waves and get mixed up', 'Customers ask for photos and prices every time', 'No pre-orders for peak holidays'],
      ['A bouquet catalogue with photos and prices', 'Pre-orders for a delivery date and time', 'Reminders of customers\' important dates']]),
  gifts: k('retail', '🎁', 'catalog', ['sales', 'brand'], ['site', 'content'], 'websites.shop.payments~x.seo',
    ['Подарки и сувениры', 'Магазин подарков с каталогом и оплатой', 'Подборки по поводу и бюджету, оплата и доставка.',
      ['Покупателю сложно выбрать подарок', 'Товары описаны только в сторис', 'Нет сезонных подборок'],
      ['Подборки по поводу и цене', 'Карточки товаров с фото', 'Сезонные страницы к праздникам']],
    ['Gifts and souvenirs', 'A gift shop with a catalogue and payment', 'Collections by occasion and budget, payment and delivery.',
      ['Buyers struggle to choose a gift', 'Products are described only in stories', 'No seasonal collections'],
      ['Collections by occasion and price', 'Product cards with photos', 'Seasonal pages for holidays']]),
  clothing: k('retail', '👗', 'catalog', ['sales', 'brand'], ['site', 'content'], SHOP,
    ['Одежда и обувь', 'Интернет-магазин одежды с размерами и оплатой', 'Каталог с размерами, корзина, оплата и поддержка в Telegram.',
      ['Размеры и наличие уточняют в переписке', 'Фото в соцсетях, а купить негде', 'Возвраты и обмены никто не отслеживает'],
      ['Карточки с размерами и наличием', 'Корзина и оплата в одном месте', 'Рассылка о новых коллекциях']],
    ['Clothing and shoes', 'A clothing store with sizes and payment', 'A catalogue with sizes, a cart, payment and Telegram support.',
      ['Sizes and availability are asked in chats', 'Photos in socials but nowhere to buy', 'Returns and exchanges are not tracked'],
      ['Cards with sizes and availability', 'A cart and payment in one place', 'A broadcast about new collections']]),
  electronics: k('retail', '📱', 'catalog', ['sales', 'routine'], ['site', 'intake'], 'websites.shop.payments-cms~bots.faq.ai~x.seo',
    ['Электроника и техника', 'Магазин электроники с каталогом и консультантом', 'Фильтры, характеристики и ИИ-консультант, который подскажет модель.',
      ['Покупатели сравнивают десятки моделей и уходят', 'Консультанты отвечают одно и то же', 'Остатки не совпадают с сайтом'],
      ['Каталог с характеристиками и сравнением', 'Консультант отвечает по моделям в чате', 'Остатки обновляются из таблицы']],
    ['Electronics and appliances', 'An electronics store with a catalogue and an advisor', 'Filters, specs and an AI advisor that suggests a model.',
      ['Buyers compare dozens of models and leave', 'Sales staff repeat the same answers', 'Stock differs from the site'],
      ['A catalogue with specs and comparison', 'An advisor answers about models in chat', 'Stock updated from a spreadsheet']]),
  furniture: k('retail', '🛋️', 'catalog', ['leads', 'brand'], ['site', 'intake'], 'websites.shop.cms~bots.faq.ai~x.seo-design',
    ['Мебель', 'Сайт мебельного магазина с каталогом и расчётом', 'Каталог, фото в интерьере и заявка на расчёт или замер.',
      ['Дорогой выбор требует много вопросов', 'Заявки на замер приходят без деталей', 'Фото в интерьере нигде не собраны'],
      ['Каталог с фото в интерьере', 'Заявка на замер с размерами', 'Ответы на вопросы по срокам и материалам']],
    ['Furniture', 'A furniture store site with a catalogue and quotes', 'A catalogue, interior photos and a request for a quote or measurement.',
      ['An expensive choice raises many questions', 'Measurement requests arrive without details', 'Interior photos are not collected anywhere'],
      ['A catalogue with interior photos', 'A measurement request with dimensions', 'Answers on lead times and materials']]),
  autoparts: k('retail', '🔧', 'catalog', ['sales', 'routine'], ['intake', 'automation'], 'websites.shop.cms~bots.faq.ai~automation.integration.sheets',
    ['Автозапчасти', 'Магазин автозапчастей с подбором по марке', 'Подбор по VIN или марке, наличие из таблицы и заказ в боте.',
      ['Клиент пишет VIN, а менеджер ищет вручную', 'Наличие и цены меняются каждый день', 'Звонки отвлекают от продаж'],
      ['Подбор запчасти по марке и модели', 'Цены и наличие из вашей таблицы', 'Заказ и статус в Telegram']],
    ['Auto parts', 'An auto parts store with lookup by make', 'Lookup by VIN or make, stock from a spreadsheet and ordering in a bot.',
      ['The client sends a VIN and a manager searches by hand', 'Stock and prices change every day', 'Calls distract from selling'],
      ['A part lookup by make and model', 'Prices and stock from your spreadsheet', 'Order and status in Telegram']]),

  // -------------------------------------------------------------- services
  carservice: k('services', '🚗', 'booking', ['booking', 'routine'], ['adminbot', 'automation'], 'websites.company.telegram~bots.booking.broadcasts~automation.crm',
    ['Автосервис', 'Запись в автосервис и учёт заказ-нарядов', 'Запись на ремонт, статус заказа и напоминание о ТО.',
      ['Клиенты звонят узнать, готова ли машина', 'Заявки записаны в тетради', 'О ТО никто не напоминает'],
      ['Запись и статус ремонта в Telegram', 'Заказы в CRM вместо тетради', 'Напоминание о плановом ТО']],
    ['Car service', 'Car service booking and job tracking', 'Repair booking, order status and maintenance reminders.',
      ['Clients call to ask if the car is ready', 'Requests are written in a notebook', 'Nobody reminds about maintenance'],
      ['Booking and repair status in Telegram', 'Orders in a CRM instead of a notebook', 'A planned maintenance reminder']]),
  carwash: k('services', '🧼', 'booking', ['booking', 'sales'], ['adminbot', 'miniapp'], BOOK,
    ['Автомойка', 'Онлайн-запись на автомойку без очередей', 'Запись на время, выбор услуг и абонементы на мойку.',
      ['Очередь в выходные, а в будни пусто', 'Услуги и цены объясняют на месте', 'Постоянных клиентов не отмечают'],
      ['Запись на свободный бокс', 'Прайс услуг с выбором в боте', 'Абонемент на мойку онлайн']],
    ['Car wash', 'Online booking for a car wash without queues', 'Slot booking, service choice and wash subscriptions.',
      ['Queues on weekends and an empty lot on weekdays', 'Services and prices are explained on site', 'Regulars are not rewarded'],
      ['Booking a free bay', 'A price list with choice in a bot', 'A wash subscription online']]),
  drycleaning: k('services', '👔', 'services', ['booking', 'routine'], ['adminbot', 'automation'], BOOK,
    ['Химчистка и прачечная', 'Бот для химчистки: приём, статус и доставка', 'Вызов курьера, статус заказа и уведомление, что вещи готовы.',
      ['Клиенты звонят узнать, готов ли заказ', 'Курьерам не хватает адресов и времени', 'Квитанции только на бумаге'],
      ['Вызов курьера в боте', 'Статус и уведомление «готово»', 'Электронная квитанция заказа']],
    ['Dry cleaning and laundry', 'A bot for dry cleaning: drop-off, status and delivery', 'Courier pickup, order status and a notice when items are ready.',
      ['Clients call to ask if the order is ready', 'Couriers lack addresses and times', 'Receipts exist only on paper'],
      ['A courier pickup request in a bot', 'Status and a "ready" notification', 'An electronic order receipt']]),
  cleaning: k('services', '🧹', 'quote', ['leads', 'booking'], ['intake', 'adminbot'], 'websites.landing.telegram~bots.booking.broadcasts~x.seo',
    ['Клининг', 'Сайт клининговой компании с расчётом цены', 'Калькулятор уборки, запись на дату и напоминание перед визитом.',
      ['Цену называют по телефону, и клиент уходит', 'Бригады путаются в адресах и времени', 'Нет повторных заказов'],
      ['Калькулятор стоимости уборки', 'Запись на дату и время', 'Напоминание о повторной уборке']],
    ['Cleaning', 'A cleaning company site with instant pricing', 'A cleaning calculator, date booking and a reminder before the visit.',
      ['Prices are quoted by phone and clients leave', 'Crews mix up addresses and times', 'No repeat orders'],
      ['A cleaning price calculator', 'Date and time booking', 'A reminder for the next cleaning']]),
  repair: k('services', '🛠️', 'quote', ['leads', 'routine'], ['intake', 'automation'], LEADS,
    ['Ремонт техники', 'Сайт и бот для сервиса по ремонту техники', 'Заявка на ремонт с описанием поломки, статус и гарантия.',
      ['Клиент описывает поломку в трёх сообщениях', 'Статус ремонта приходится сообщать по звонку', 'Гарантия хранится в тетради'],
      ['Заявка с типом техники и поломкой', 'Статус ремонта в Telegram', 'Гарантийный талон в электронном виде']],
    ['Appliance repair', 'A site and bot for a repair service', 'A repair request with a fault description, status and warranty.',
      ['A client describes the fault across three messages', 'Repair status has to be given by phone', 'Warranty is kept in a notebook'],
      ['A request with device type and fault', 'Repair status in Telegram', 'An electronic warranty slip']]),
  renovation: k('services', '🏗️', 'quote', ['leads', 'brand'], ['site', 'intake'], 'websites.company.cms~bots.faq.ai~x.seo-design',
    ['Ремонт квартир', 'Сайт бригады по ремонту с калькулятором и портфолио', 'Портфолио объектов, расчёт сметы и заявка на замер.',
      ['Клиенту нечем проверить качество работ', 'Расчёт сметы занимает дни', 'Заказы идут только по знакомым'],
      ['Портфолио до и после', 'Предварительный расчёт онлайн', 'Заявка на замер за минуту']],
    ['Home renovation', 'A renovation crew site with a calculator and portfolio', 'A project portfolio, quote calculation and a measurement request.',
      ['Clients cannot verify the quality of work', 'Calculating a quote takes days', 'Orders come only from acquaintances'],
      ['A before and after portfolio', 'A preliminary estimate online', 'A measurement request in a minute']]),
  photo: k('services', '📸', 'booking', ['booking', 'brand'], ['adminbot', 'site'], BOOK,
    ['Фото-студия', 'Сайт и запись в фото-студию', 'Залы, свободные часы, запись с предоплатой и портфолио.',
      ['Свободное время уточняют в переписке', 'Предоплату забывают внести', 'Портфолио разбросано по ссылкам'],
      ['Календарь свободных залов и часов', 'Предоплата при записи', 'Портфолио на сайте']],
    ['Photo studio', 'A site and booking for a photo studio', 'Halls, free hours, booking with a prepayment and a portfolio.',
      ['Free time is clarified in chats', 'Prepayments get forgotten', 'The portfolio is scattered across links'],
      ['A calendar of free halls and hours', 'A prepayment at booking', 'A portfolio on the site']]),
  events: k('services', '🎉', 'quote', ['leads', 'brand'], ['site', 'intake'], 'websites.company.telegram~bots.faq.ai~automation.crm',
    ['Свадьбы и события', 'Сайт для организатора свадеб и мероприятий', 'Форматы, портфолио и заявка на дату с предварительным расчётом.',
      ['Клиент не может представить, что получит', 'Заявки на дату сталкиваются', 'Отзывы и фото не собраны'],
      ['Форматы и пакеты с примерами', 'Заявка на дату в одном месте', 'Фото и отзывы с прошлых событий']],
    ['Weddings and events', 'A site for a wedding and event planner', 'Formats, a portfolio and a date request with a preliminary estimate.',
      ['A client cannot picture what they will get', 'Date requests collide', 'Reviews and photos are not collected'],
      ['Formats and packages with examples', 'Date requests in one place', 'Photos and reviews from past events']]),
  printing: k('services', '🖨️', 'quote', ['sales', 'routine'], ['site', 'automation'], 'websites.company.payments~automation.integration.alerts~x.seo',
    ['Типография', 'Сайт типографии с онлайн-заказом и расчётом', 'Расчёт тиража, загрузка макета и статус заказа.',
      ['Макеты присылают в мессенджеры и теряют', 'Цену считают по запросу каждый раз', 'Клиенты звонят узнать статус'],
      ['Калькулятор тиража', 'Загрузка макета в заказ', 'Статус заказа в уведомлениях']],
    ['Print shop', 'A print shop site with online ordering and pricing', 'Run pricing, artwork upload and order status.',
      ['Artwork is sent to messengers and lost', 'Prices are calculated on request each time', 'Clients call to ask for status'],
      ['A print run calculator', 'Artwork upload inside the order', 'Order status in notifications']]),

  // ------------------------------------------------------------- education
  tutor: k('education', '📚', 'lesson', ['booking', 'brand'], ['adminbot', 'agent'], 'websites.landing.telegram~bots.booking.payments',
    ['Репетитор', 'Сайт и запись на уроки для репетитора', 'Расписание, запись на пробный урок, оплата и напоминания ученикам.',
      ['Расписание ведётся в голове и в чатах', 'Родители забывают оплатить', 'Новых учеников приводит только знакомство'],
      ['Запись на пробный и обычный урок', 'Оплата и напоминания в Telegram', 'Страница репетитора с отзывами']],
    ['Tutor', 'A site and lesson booking for a tutor', 'A schedule, trial lesson booking, payment and student reminders.',
      ['The schedule lives in your head and chats', 'Parents forget to pay', 'New students come only through acquaintances'],
      ['Trial and regular lesson booking', 'Payment and reminders in Telegram', 'A tutor page with reviews']]),
  languages: k('education', '🗣️', 'lesson', ['leads', 'booking'], ['intake', 'adminbot'], EDU,
    ['Языковые курсы', 'Сайт и бот для языковых курсов с записью', 'Группы, уровни, пробный урок и запись в один клик.',
      ['Заявки на пробный урок остывают без ответа', 'Уровень студента узнают на месте', 'Группы собираются долго'],
      ['Заявка на пробный урок с ответом сразу', 'Тест на уровень в боте', 'Запись в группу и лист ожидания']],
    ['Language courses', 'A site and bot for language courses with booking', 'Groups, levels, a trial lesson and one-click enrollment.',
      ['Trial lesson requests go cold without a reply', 'A student\'s level is learned on site', 'Groups take long to fill'],
      ['A trial lesson request with an instant reply', 'A level test in a bot', 'Group enrollment and a waiting list']]),
  kidscenter: k('education', '🧸', 'lesson', ['leads', 'brand'], ['intake', 'content'], EDU,
    ['Детский центр', 'Сайт детского центра с записью на занятия', 'Кружки, расписание, запись и общение с родителями в Telegram.',
      ['Родители задают одни и те же вопросы', 'Расписание кружков меняется', 'Пробные занятия не доходят до записи'],
      ['Каталог кружков по возрасту', 'Расписание и запись в боте', 'Объявления родителям в один клик']],
    ['Kids centre', 'A kids centre site with class booking', 'Clubs, a schedule, booking and parent communication in Telegram.',
      ['Parents ask the same questions', 'Club schedules change', 'Trial classes do not turn into enrollments'],
      ['A club catalogue by age', 'A schedule and booking in a bot', 'Announcements to parents in one click']]),
  drivingschool: k('education', '🚦', 'lesson', ['leads', 'booking'], ['adminbot', 'intake'], EDU,
    ['Автошкола', 'Сайт и запись на вождение для автошколы', 'Группы, расписание занятий, запись на вождение и тесты.',
      ['Запись на вождение ведут в таблицах', 'Ученики пропускают занятия', 'Заявки теряются между звонками'],
      ['Запись на вождение к инструктору', 'Напоминание о занятии', 'Заявки в одной системе']],
    ['Driving school', 'A site and driving lesson booking for a driving school', 'Groups, a lesson schedule, driving booking and tests.',
      ['Driving lessons are tracked in spreadsheets', 'Students skip lessons', 'Leads get lost between calls'],
      ['Driving lesson booking with an instructor', 'A lesson reminder', 'Leads in one system']]),
  onlineschool: k('education', '🎓', 'lesson', ['sales', 'routine'], ['miniapp', 'automation'], ONLINE,
    ['Онлайн-школа', 'Платформа и бот для онлайн-школы', 'Продажа курсов, доступ к урокам и поддержка учеников в Telegram.',
      ['Доступы к урокам выдают вручную', 'Ученики теряются после оплаты', 'Вопросы учеников тонут в чатах'],
      ['Оплата и автоматический доступ', 'Напоминания об уроках и домашних заданиях', 'ИИ-помощник отвечает по материалам']],
    ['Online school', 'A platform and bot for an online school', 'Course sales, lesson access and student support in Telegram.',
      ['Lesson access is granted by hand', 'Students drop off after paying', 'Student questions drown in chats'],
      ['Payment and automatic access', 'Lesson and homework reminders', 'An AI helper answers from the materials']]),

  // ----------------------------------------------- real estate and finance
  realty: k('realty', '🏠', 'listing', ['leads', 'routine'], ['intake', 'site'], REAL,
    ['Агентство недвижимости', 'Сайт агентства недвижимости с каталогом объектов', 'Объекты с фильтрами, заявка на показ и ответы 24/7.',
      ['Объекты в разных чатах, а покупатель ищет по ним', 'Звонки в нерабочее время остаются без ответа', 'Заявки не попадают в CRM'],
      ['Каталог объектов с фильтрами', 'ИИ-приёмщик отвечает и записывает на показ', 'Заявки в CRM автоматически']],
    ['Real estate agency', 'A real estate agency site with a property catalogue', 'Listings with filters, a viewing request and answers around the clock.',
      ['Listings sit in different chats and buyers search through them', 'After-hours calls go unanswered', 'Leads do not reach the CRM'],
      ['A catalogue of listings with filters', 'An AI intake answers and books viewings', 'Leads flow into the CRM automatically']]),
  lawyers: k('realty', '⚖️', 'quote', ['leads', 'brand'], ['intake', 'site'], 'websites.company.telegram~bots.faq.ai~x.seo',
    ['Юристы', 'Сайт юридической фирмы с заявкой на консультацию', 'Практики, кейсы и запись на консультацию, а бот отвечает вне рабочих часов.',
      ['Клиент не понимает, к кому и с чем обращаться', 'Первичные вопросы забирают часы юриста', 'Нет доверия без кейсов и отзывов'],
      ['Страницы практик с понятными задачами', 'Бот собирает суть вопроса до консультации', 'Кейсы и отзывы на сайте']],
    ['Lawyers', 'A law firm site with a consultation request', 'Practice areas, cases and consultation booking, and a bot that answers off hours.',
      ['Clients do not know whom to contact and about what', 'Initial questions eat the lawyer\'s hours', 'No trust without cases and reviews'],
      ['Practice pages with clear tasks', 'A bot gathers the question before the consultation', 'Cases and reviews on the site']]),
  accounting: k('realty', '🧾', 'services', ['leads', 'routine'], ['automation', 'agent'], 'websites.company.telegram~automation.crm.sheets',
    ['Бухгалтерия', 'Сайт бухгалтерской компании и напоминания клиентам', 'Тарифы, заявка и напоминания о сроках отчётности в Telegram.',
      ['Клиенты забывают сроки и документы', 'Тарифы объясняют каждому отдельно', 'Данные клиентов лежат в разных таблицах'],
      ['Напоминания о сроках в Telegram', 'Страница с тарифами и заявкой', 'Клиенты и сроки в одной таблице']],
    ['Accounting', 'An accounting firm site and client reminders', 'Plans, a request form and reporting deadline reminders in Telegram.',
      ['Clients forget deadlines and documents', 'Plans are explained to everyone separately', 'Client data lies in different spreadsheets'],
      ['Deadline reminders in Telegram', 'A plans page with a request form', 'Clients and deadlines in one sheet']]),
  insurance: k('realty', '🛡️', 'quote', ['leads', 'routine'], ['intake', 'automation'], 'websites.company.telegram~bots.faq.ai~automation.crm',
    ['Страхование', 'Сайт страхового агента с расчётом и заявкой', 'Расчёт полиса, заявка и напоминание о продлении.',
      ['Клиент уходит, не дождавшись расчёта', 'О продлении полиса никто не напоминает', 'Заявки хранятся в блокноте'],
      ['Предварительный расчёт онлайн', 'Напоминание о продлении полиса', 'База клиентов и заявок в CRM']],
    ['Insurance', 'An insurance agent site with a quote and a request', 'A policy quote, a request and a renewal reminder.',
      ['The client leaves before getting a quote', 'Nobody reminds about policy renewal', 'Leads are stored in a notebook'],
      ['A preliminary quote online', 'A policy renewal reminder', 'A client and lead base in a CRM']]),

  // ---------------------------------------------------------------- travel
  travel: k('travel', '✈️', 'trip', ['leads', 'brand'], ['intake', 'site'], TRAVEL,
    ['Турагентство', 'Сайт и ИИ-приёмщик заявок для турагентства', 'Направления, подбор тура по бюджету и ответы клиентам в любое время.',
      ['Клиенты ищут тур ночью, а ответ приходит утром', 'Заявки без бюджета и дат', 'Горящие туры нигде не собраны'],
      ['ИИ-приёмщик уточняет даты и бюджет', 'Подборки направлений на сайте', 'Рассылка горящих туров в Telegram']],
    ['Travel agency', 'A site and AI lead intake for a travel agency', 'Destinations, tour search by budget and replies to clients at any hour.',
      ['Clients search for a tour at night and get a reply in the morning', 'Requests come without budget and dates', 'Last-minute deals are not collected anywhere'],
      ['An AI intake asks for dates and budget', 'Destination collections on the site', 'A last-minute deals broadcast in Telegram']]),
  hotel: k('travel', '🏨', 'booking', ['booking', 'brand'], ['adminbot', 'site'], HOTEL,
    ['Отель', 'Сайт отеля с онлайн-бронированием', 'Номера, цены на даты, бронь с предоплатой и сайт на двух языках.',
      ['Бронь по телефону и в почте путается', 'Гости ищут отель на английском', 'Комиссия площадок съедает прибыль'],
      ['Номера и бронь с предоплатой', 'Сайт на русском и английском', 'Прямые брони без комиссии']],
    ['Hotel', 'A hotel site with online booking', 'Rooms, prices by date, booking with a prepayment and a two-language site.',
      ['Bookings by phone and email get mixed up', 'Guests search for the hotel in English', 'Platform commissions eat the profit'],
      ['Rooms and booking with a prepayment', 'A Russian and English site', 'Direct bookings without commission']]),
  guesthouse: k('travel', '🏡', 'booking', ['booking', 'brand'], ['adminbot', 'site'], 'websites.landing.language-telegram~bots.booking.payments',
    ['Гостевой дом', 'Сайт гостевого дома с бронью и картой', 'Номера с фото, бронь на даты и подсказки гостю в боте.',
      ['Гости бронируют через агрегаторы с комиссией', 'Вопросы про дорогу и заселение повторяются', 'Нет страницы с фото и отзывами'],
      ['Бронь на даты с предоплатой', 'Бот с подсказками по заселению', 'Страница с фото и отзывами']],
    ['Guesthouse', 'A guesthouse site with booking and a map', 'Rooms with photos, date booking and guest tips in a bot.',
      ['Guests book through commission aggregators', 'Questions about directions and check-in repeat', 'No page with photos and reviews'],
      ['Date booking with a prepayment', 'A bot with check-in tips', 'A page with photos and reviews']]),
  tours: k('travel', '🗺️', 'trip', ['booking', 'sales'], ['adminbot', 'miniapp'], 'websites.company.language-telegram~bots.booking.payments~x.seo',
    ['Экскурсии и гиды', 'Сайт и запись на экскурсии с оплатой', 'Маршруты, даты, места в группе и оплата в Telegram.',
      ['Места в группе считают вручную', 'Туристы пишут в мессенджеры на разных языках', 'Оплата только наличными на месте'],
      ['Запись на дату с оставшимися местами', 'Сайт и бот на двух языках', 'Предоплата онлайн']],
    ['Tours and guides', 'A site and booking for tours with payment', 'Routes, dates, seats in a group and payment in Telegram.',
      ['Seats in a group are counted by hand', 'Tourists write in messengers in different languages', 'Payment is only cash on site'],
      ['Booking a date with seats left shown', 'A two-language site and bot', 'Prepayment online']]),

  // ------------------------------------------------------------------- b2b
  services: k('b2b', '💼', 'services', ['leads', 'routine'], ['intake', 'automation'], SERV,
    ['Услуги и B2B', 'Сайт и CRM для компании, которая работает с бизнесом', 'Сайт компании, заявки в CRM и обучение команды работе с системой.',
      ['Заявки приходят из разных каналов и теряются', 'Менеджеры не видят историю клиента', 'Каждый отчёт собирают вручную'],
      ['Сайт компании с формой заявки', 'CRM с воронкой и историей клиента', 'Обучение команды']],
    ['Services and B2B', 'A site and CRM for a company that serves businesses', 'A company site, leads in a CRM and team training on the system.',
      ['Leads arrive from different channels and get lost', 'Managers do not see the client history', 'Every report is compiled by hand'],
      ['A company site with a request form', 'A CRM with a funnel and client history', 'Team training']]),
  logistics: k('b2b', '🚚', 'quote', ['leads', 'routine'], ['automation', 'intake'], 'websites.company.language~automation.integration.sheets-alerts~bots.faq',
    ['Логистика и перевозки', 'Сайт перевозчика с расчётом и отслеживанием', 'Расчёт перевозки, заявка и уведомления о статусе груза.',
      ['Ставки считают в переписке', 'Клиенты спрашивают, где груз', 'Данные о рейсах в таблицах без порядка'],
      ['Калькулятор перевозки', 'Статус груза в Telegram', 'Рейсы в одной таблице с оповещениями']],
    ['Logistics and freight', 'A carrier site with pricing and tracking', 'A freight calculator, a request and cargo status alerts.',
      ['Rates are calculated in chats', 'Clients ask where the cargo is', 'Trip data sits in messy spreadsheets'],
      ['A freight calculator', 'Cargo status in Telegram', 'Trips in one sheet with alerts']]),
  wholesale: k('b2b', '📦', 'catalog', ['sales', 'routine'], ['miniapp', 'automation'], 'websites.shop.payments-cms~automation.crm.sheets~x.seo',
    ['Оптовая торговля', 'Оптовый каталог с заказом для постоянных клиентов', 'Прайс для оптовиков, повторный заказ в пару нажатий и учёт в таблице.',
      ['Прайсы рассылают файлами и они устаревают', 'Повторный заказ повторяют заново', 'Менеджеры принимают заказы вручную'],
      ['Актуальный каталог с оптовыми ценами', 'Повторный заказ в два нажатия', 'Заказы в таблице и CRM']],
    ['Wholesale', 'A wholesale catalogue with ordering for regular clients', 'A trade price list, repeat orders in a few taps and tracking in a sheet.',
      ['Price lists are sent as files and go stale', 'Repeat orders are typed again', 'Managers take orders by hand'],
      ['A current catalogue with trade prices', 'A repeat order in two taps', 'Orders in a sheet and CRM']]),
  itservices: k('b2b', '💻', 'services', ['leads', 'brand'], ['intake', 'site'], 'websites.company.language~bots.faq.ai~x.seo',
    ['IT-услуги', 'Сайт IT-компании с кейсами и заявкой на проект', 'Услуги, кейсы и бриф, а бот собирает требования до созвона.',
      ['Заказчик не понимает, как вы работаете', 'Бриф собирается неделями', 'Кейсы лежат в презентациях'],
      ['Страницы услуг с этапами работы', 'Бот собирает бриф', 'Кейсы с результатами на сайте']],
    ['IT services', 'An IT company site with cases and a project request', 'Services, cases and a brief, with a bot that collects requirements before the call.',
      ['Clients do not understand how you work', 'A brief takes weeks to collect', 'Cases sit in presentations'],
      ['Service pages with project stages', 'A bot collects the brief', 'Cases with results on the site']]),
  marketing: k('b2b', '📣', 'services', ['leads', 'brand'], ['content', 'site'], 'websites.company.language~automation.crm.sheets~x.seo',
    ['Маркетинговое агентство', 'Сайт агентства с кейсами и воронкой заявок', 'Услуги, кейсы с цифрами и CRM, в которой видна воронка.',
      ['Заявки приходят из разных каналов без меток', 'Отчёты клиентам собирают вручную', 'Кейсы не продают сами'],
      ['Заявки с источником в CRM', 'Отчёты в таблице автоматически', 'Кейсы с цифрами на сайте']],
    ['Marketing agency', 'An agency site with cases and a lead funnel', 'Services, cases with numbers and a CRM that shows the funnel.',
      ['Leads come from different channels without tags', 'Client reports are compiled by hand', 'Cases do not sell themselves'],
      ['Leads with their source in the CRM', 'Reports in a sheet automatically', 'Cases with numbers on the site']]),
  coworking: k('b2b', '🪑', 'booking', ['booking', 'brand'], ['adminbot', 'miniapp'], 'websites.company.telegram~bots.booking.payments~x.seo',
    ['Коворкинг', 'Сайт коворкинга с бронью мест и переговорных', 'Места, переговорные, тарифы и оплата в боте.',
      ['Переговорные бронируют в чате и они пересекаются', 'Тарифы объясняют каждому по отдельности', 'Резиденты платят вручную'],
      ['Бронь места и переговорной онлайн', 'Тарифы на одной странице', 'Оплата и продление в боте']],
    ['Coworking', 'A coworking site with desk and meeting room booking', 'Desks, meeting rooms, plans and payment in a bot.',
      ['Meeting rooms are booked in chats and overlap', 'Plans are explained to everyone separately', 'Residents pay by hand'],
      ['Desk and meeting room booking online', 'Plans on one page', 'Payment and renewal in a bot']]),

  // ----------------------------------------------------------- medicine/care
  pharmacy: k('health', '💊', 'catalog', ['sales', 'routine'], ['miniapp', 'automation'], 'bots.miniapp.payments-admin~automation.integration.sheets~x.seo',
    ['Аптека', 'Mini App для аптеки: наличие, бронь и доставка', 'Поиск лекарства, наличие в аптеке и бронь с самовывозом.',
      ['Покупатели звонят узнать, есть ли лекарство', 'Наличие меняется в течение дня', 'Доставка принимается вручную'],
      ['Поиск и наличие в Telegram', 'Бронь с самовывозом или доставкой', 'Остатки из вашей таблицы']],
    ['Pharmacy', 'A Mini App for a pharmacy: stock, reservation and delivery', 'Medicine search, in-store stock and reservation with pickup.',
      ['Buyers call to ask if a medicine is in stock', 'Stock changes during the day', 'Delivery is accepted by hand'],
      ['Search and availability in Telegram', 'Reservation with pickup or delivery', 'Stock from your spreadsheet']]),
  vet: k('health', '🐾', 'booking', ['booking', 'leads'], ['adminbot', 'intake'], CLINIC,
    ['Ветклиника', 'Запись в ветклинику через сайт и Telegram', 'Запись на приём, напоминания о прививках и ответы владельцам.',
      ['О прививках и осмотрах питомцев забывают', 'Владельцы пишут срочные вопросы вне часов приёма', 'Запись идёт по телефону'],
      ['Напоминания о прививках', 'Бот отвечает и направляет срочные случаи', 'Запись на приём в боте']],
    ['Vet clinic', 'Vet clinic booking through a site and Telegram', 'Appointment booking, vaccination reminders and answers to pet owners.',
      ['Pet vaccinations and check-ups are forgotten', 'Owners send urgent questions after hours', 'Booking goes by phone'],
      ['Vaccination reminders', 'A bot answers and routes urgent cases', 'Appointment booking in a bot']]),
  petshop: k('health', '🐶', 'catalog', ['sales', 'brand'], ['miniapp', 'content'], TGSHOP,
    ['Зоомагазин', 'Mini App для зоомагазина с доставкой и повторным заказом', 'Каталог кормов и товаров, подписка на корм и доставка.',
      ['Корм заканчивается, а о заказе забывают', 'Подбор корма требует консультации', 'Нет каталога с ценами'],
      ['Повторный заказ корма в два нажатия', 'Подбор по питомцу и весу', 'Каталог с ценами и доставкой']],
    ['Pet shop', 'A Mini App for a pet shop with delivery and reorders', 'A food and supplies catalogue, food subscription and delivery.',
      ['Food runs out and the reorder is forgotten', 'Choosing food needs advice', 'No catalogue with prices'],
      ['A food reorder in two taps', 'A choice by pet and weight', 'A catalogue with prices and delivery']]),

  // ----------------------------------------------------------------- other
  other: k('other', '✨', 'services', ['leads'], [], 'websites.landing',
    ['Другое', 'Соберём проект под ваш бизнес', 'Выберите нужные части сами или опишите задачу, и мы предложим состав.',
      ['Нет готового набора под вашу нишу', 'Непонятно, с чего начать', 'Нужна консультация по составу'],
      ['Конструктор собирает нужное', 'Цена и сроки видны сразу', 'Смета после короткого созвона']],
    ['Something else', 'We build a project around your business', 'Pick the parts yourself or describe the task, and we suggest a set.',
      ['There is no ready set for your niche', 'It is unclear where to start', 'You need advice on the set'],
      ['The builder assembles what you need', 'Price and terms are visible at once', 'A quote after a short call']]),
}

export const kindsByCategory = kindCategories
  .map((category) => ({
    category,
    kinds: kindIds.filter((id) => kindCatalog[id].category === category),
  }))
  .filter((group) => group.kinds.length > 0)

export const kindName = (id: KindId, locale: string) => pick({ ru: kindCatalog[id].ru[0], en: kindCatalog[id].en[0] }, locale)

