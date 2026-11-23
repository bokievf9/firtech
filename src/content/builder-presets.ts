import type { L } from './builder-catalog'

// Niche presets of the builder (builder v6 wave 2): eight ready sets by business, the copy and the matcher words.
// Prices are never written here: lib/builder-presets.ts counts them from the live pricing.
export const presetIds = ['cafe', 'salon', 'shop', 'delivery', 'services', 'clinic', 'auto', 'school'] as const
export type PresetId = (typeof presetIds)[number]

export type PresetCopy = {
  name: L<string>
  // One line: what the owner gets.
  promise: L<string>
  // «Что внутри», three bullets.
  inside: L<[string, string, string]>
  // «похоже на салон: запись и напоминания»: the short tail after the niche.
  reason: L<string>
  // Regex fragments (matched at the start of a word, lower case, «ё» = «е») that point to this niche.
  words: string[]
  emoji: string
}

export const presetCopy: Record<PresetId, PresetCopy> = {
  cafe: {
    emoji: '☕',
    name: { ru: 'Кафе и ресторан', en: 'Cafe or restaurant' },
    promise: { ru: 'Бронь столов и меню в Telegram, пока вы на кухне', en: 'Table booking and a live menu in Telegram while you are in the kitchen' },
    inside: {
      ru: ['Сайт с меню и часами работы', 'ИИ-администратор: бронь и напоминания гостям', 'Агенты: контент-мейкер для соцсетей и менеджер заявок'],
      en: ['A site with the menu and opening hours', 'An AI booking assistant: tables and guest reminders', 'Agents: a content maker for social media and a lead manager'],
    },
    reason: { ru: 'бронь столов, меню и посты', en: 'table booking, menu and posts' },
    words: ['кафе', 'ресторан', 'кофейн', 'пекарн', 'столовая', 'бар\\b', 'бронь стол', 'меню', 'cafe', 'restaurant', 'coffee', 'bakery', 'menu', 'table'],
  },
  salon: {
    emoji: '💇',
    name: { ru: 'Салон красоты', en: 'Beauty salon' },
    promise: { ru: 'Запись и напоминания без звонков администратору', en: 'Bookings and reminders without calls to the front desk' },
    inside: {
      ru: ['ИИ-администратор: запись, напоминания, отзывы', 'Сайт с услугами и ценами', 'Агент: менеджер заявок отвечает в мессенджерах'],
      en: ['An AI booking assistant: bookings, reminders, reviews', 'A site with services and prices', 'An agent: a lead manager answering in messengers'],
    },
    reason: { ru: 'запись и напоминания', en: 'bookings and reminders' },
    words: ['салон', 'парикмахер', 'барбер', 'маникюр', 'ногт', 'бровист', 'косметолог', 'стриж', 'массаж', 'салон красот', 'salon', 'barber', 'hair', 'nail', 'beauty', 'manicure', 'spa\\b'],
  },
  shop: {
    emoji: '🛍️',
    name: { ru: 'Магазин', en: 'Shop' },
    promise: { ru: 'Каталог и заказы в Telegram, ответы покупателям круглые сутки', en: 'A catalogue and orders in Telegram, buyers answered around the clock' },
    inside: {
      ru: ['Сайт-каталог', 'Telegram Mini App: корзина и оплата', 'Агенты: менеджер заявок и поддержка'],
      en: ['A catalogue site', 'A Telegram Mini App: cart and payment', 'Agents: a lead manager and support'],
    },
    reason: { ru: 'каталог, заказы и ответы покупателям', en: 'catalogue, orders and buyer answers' },
    words: ['магазин', 'интернет-магазин', 'товар', 'каталог', 'одежд', 'цветы', 'цветов', 'подарк', 'электроник', 'мебел', 'запчаст', 'маркетплейс', 'shop', 'store', 'catalog', 'products', 'retail', 'ecommerce'],
  },
  delivery: {
    emoji: '🛵',
    name: { ru: 'Доставка еды', en: 'Food delivery' },
    promise: { ru: 'Приём заказов и статусы доставки без диспетчера', en: 'Taking orders and delivery statuses without a dispatcher' },
    inside: {
      ru: ['Telegram Mini App: меню, заказ, оплата', 'Автоматизация: заказ уходит на кухню и курьеру', 'Агенты: менеджер заявок и поддержка'],
      en: ['A Telegram Mini App: menu, order, payment', 'Automation: an order goes to the kitchen and the courier', 'Agents: a lead manager and support'],
    },
    reason: { ru: 'приём заказов и статусы доставки', en: 'taking orders and delivery statuses' },
    words: ['доставк', 'курьер', 'суши', 'пицц', 'заказ еды', 'на вынос', 'delivery', 'courier', 'sushi', 'pizza', 'takeaway', 'food order'],
  },
  services: {
    emoji: '🧰',
    name: { ru: 'Услуги и B2B', en: 'Services and B2B' },
    promise: { ru: 'Заявки от клиентов собираются сами, счета не теряются', en: 'Client requests collect themselves and invoices do not get lost' },
    inside: {
      ru: ['Сайт компании с формой заявки', 'Автоматизация: заявки в CRM и таблицу', 'Агенты: менеджер заявок и биллинг'],
      en: ['A company site with a request form', 'Automation: requests into the CRM and a sheet', 'Agents: a lead manager and billing'],
    },
    reason: { ru: 'заявки клиентов, CRM и счета', en: 'client requests, CRM and invoices' },
    words: ['услуг', 'агентств', 'консалтинг', 'юрист', 'бухгалтер', 'crm', 'b2b', 'ремонт', 'клининг', 'строит', 'agency', 'consult', 'lawyer', 'accountant', 'service', 'leads', 'clients', 'invoice', 'счет'],
  },
  clinic: {
    emoji: '🏥',
    name: { ru: 'Клиника и стоматология', en: 'Clinic or dentist' },
    promise: { ru: 'Запись к врачу и напоминания о приёме, пациенты не теряются', en: 'Doctor appointments and visit reminders, no patient gets lost' },
    inside: {
      ru: ['ИИ-администратор: запись и напоминания о приёме', 'Автоматизация: карточки пациентов в таблицу или CRM', 'Агенты: менеджер заявок и поддержка'],
      en: ['An AI booking assistant: appointments and visit reminders', 'Automation: patient cards into a sheet or CRM', 'Agents: a lead manager and support'],
    },
    reason: { ru: 'запись к врачу и напоминания о приёме', en: 'doctor appointments and visit reminders' },
    words: ['клиник', 'стоматолог', 'зубн', 'врач', 'медцентр', 'поликлиник', 'пациент', 'ветеринар', 'clinic', 'dentist', 'dental', 'doctor', 'patient', 'medical', 'vet\\b'],
  },
  auto: {
    emoji: '🚗',
    name: { ru: 'Автосервис', en: 'Car service' },
    promise: { ru: 'Запись на сервис и напоминания о ТО, клиенты возвращаются сами', en: 'Service bookings and maintenance reminders, clients come back on their own' },
    inside: {
      ru: ['ИИ-администратор: запись на сервис и напоминания о ТО', 'Сайт с услугами и ценами', 'Агенты: менеджер заявок и биллинг'],
      en: ['An AI booking assistant: service bookings and maintenance reminders', 'A site with services and prices', 'Agents: a lead manager and billing'],
    },
    reason: { ru: 'запись на сервис и напоминания о ТО', en: 'service bookings and maintenance reminders' },
    words: ['автосервис', 'автомойк', 'автомобил', 'машин', 'сто\\b', 'шиномонтаж', 'автозапчаст', 'детейлинг', 'car service', 'car wash', 'garage', 'auto repair', 'mechanic', 'tire', 'detailing', 'cars?\\b'],
  },
  school: {
    emoji: '🎓',
    name: { ru: 'Школа и курсы', en: 'School or courses' },
    promise: { ru: 'Заявки на пробный урок и ответы ученикам без администратора', en: 'Trial lesson requests and student answers without an admin' },
    inside: {
      ru: ['Сайт с программой и расписанием', 'Агент: поддержка отвечает ученикам и родителям', 'Агент: онбординг новых учеников'],
      en: ['A site with the programme and schedule', 'An agent: support answering students and parents', 'An agent: onboarding of new students'],
    },
    reason: { ru: 'пробные уроки, расписание и ответы ученикам', en: 'trial lessons, schedule and student answers' },
    words: ['школ', 'курс', 'репетитор', 'ученик', 'студент', 'обучени', 'урок', 'язык', 'детский центр', 'автошкол', 'school', 'course', 'tutor', 'student', 'lesson', 'learning', 'education', 'language'],
  },
}

// Words that point at a product or path instead of a niche (RU + EN), same format as `words` above.
export type NeedId = 'adminbot' | 'intake' | 'automation' | 'content' | 'miniapp' | 'personal'
export const needWords: Record<NeedId, { words: string[]; reason: L<string> }> = {
  adminbot: {
    words: ['запис', 'бронь', 'бронир', 'напомин', 'расписани', 'booking', 'appointment', 'reminder', 'reserv', 'schedul'],
    reason: { ru: 'запись, бронь и напоминания', en: 'bookings and reminders' },
  },
  intake: {
    words: ['заявк', 'лид', 'отвеча', 'переписк', 'вопрос', 'whatsapp', 'ватсап', 'lead', 'inquir', 'answer', 'reply', 'chat'],
    reason: { ru: 'ответы клиентам и сбор заявок', en: 'answers to clients and lead capture' },
  },
  automation: {
    words: ['таблиц', 'excel', 'эксель', 'отчет', 'рутин', 'автоматиз', 'интеграц', 'spreadsheet', 'report', 'automat', 'integrat', 'routine', 'sheets'],
    reason: { ru: 'рутина, таблицы и отчёты', en: 'routine, sheets and reports' },
  },
  content: {
    words: ['пост', 'контент', 'соцсет', 'instagram', 'инстаграм', 'reels', 'рилс', 'видео', 'блог', 'content', 'social', 'video', 'blog', 'posts?\\b'],
    reason: { ru: 'посты и контент для соцсетей', en: 'posts and content for social media' },
  },
  miniapp: {
    words: ['мини-апп', 'mini app', 'miniapp', 'приложени', 'лояльн', 'лояльност', 'бонус', 'loyalty', 'app\\b'],
    reason: { ru: 'приложение внутри Telegram', en: 'an app inside Telegram' },
  },
  personal: {
    words: ['для себя', 'личн', 'ассистент', 'почт', 'календар', 'учеб', 'задач', 'мои дела', 'personal', 'assistant', 'my mail', 'my calendar', 'for myself', 'study'],
    reason: { ru: 'личный ИИ для ваших дел', en: 'a personal AI for your own tasks' },
  },
}

export const presetUi = {
  title: { ru: 'Готовые наборы по нишам', en: 'Ready sets by niche' },
  sub: { ru: 'Выберите свой бизнес: набор откроется на итоговом шаге, дальше его можно менять.', en: 'Pick your business: the set opens on the summary, and you can change it from there.' },
  inside: { ru: 'Что внутри', en: 'What is inside' },
  from: { ru: 'Набор от', en: 'Set from' },
  perMonth: { ru: '/мес', en: '/mo' },
  pick: { ru: 'Открыть набор', en: 'Open this set' },
  taskTitle: { ru: 'Или начните с задачи', en: 'Or start with a task' },
  taskLabel: { ru: 'Опишите задачу своими словами', en: 'Describe the task in your own words' },
  taskPlaceholder: { ru: 'Например: салон, клиенты звонят за записью, а я не успеваю отвечать', en: 'For example: a salon, clients call to book and I cannot keep up with answering' },
  taskSubmit: { ru: 'Подобрать', en: 'Find a fit' },
  apply: { ru: 'Собрать так', en: 'Build it this way' },
  looksLike: { ru: 'Похоже на', en: 'Looks like' },
  noMatch: { ru: 'Не нашла точного совпадения. Выберите один из трёх путей выше или готовый набор: их можно менять.', en: 'No exact match found. Pick one of the three paths above or a ready set: you can change them.' },
  firaOffer: { ru: 'Расскажите, что болит, я подберу', en: 'Tell me what hurts and I will find a fit' },
  firaFound: { ru: 'Похоже на', en: 'Looks like' },
  firaNone: { ru: 'Тут я не угадала. Выберите путь сами, это быстро.', en: 'I could not guess this one. Pick a path yourself, it is quick.' },
  asProduct: { ru: 'Продукт', en: 'Product' },
  asPath: { ru: 'Путь', en: 'Path' },
  personalName: { ru: 'Персональный ИИ', en: 'Personal AI' },
} as const
