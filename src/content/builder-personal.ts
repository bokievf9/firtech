import type {
  DiscApprover,
  DiscBase,
  DiscHeard,
  DiscHours,
  DiscLeads,
  DiscPain,
  DiscSize,
  DiscSuccess,
  PersonalChannel,
  PersonalConnect,
  PersonalHand,
  PersonalWho,
} from '../lib/builder-ids'
import type { L } from './builder-catalog'

// «Сборка проекта» v4: strings of the personal path and the discovery fields. RU and EN side by side. No em or
// en dashes, no «конструктор», prices never typed here (they come from pricing.ts).

type Named = { name: L<string>; hint: L<string> }
const n = (ru: [string, string], en: [string, string]): Named => ({
  name: { ru: ru[0], en: en[0] },
  hint: { ru: ru[1], en: en[1] },
})
const l = (ru: string, en: string): L<string> => ({ ru, en })

export const forkUi = {
  label: l('Для кого собираем', 'Who it is for'),
  business: l('Для бизнеса', 'For a business'),
  personal: l('Для себя', 'For myself'),
  businessHint: l('Агент, сайт, автоматизация для дела', 'An agent, a site, automation for your business'),
  personalHint: l('Личный ИИ-ассистент для вашей жизни', 'A personal AI assistant for your life'),
}

export const personalSteps = {
  steps: {
    ru: ['Кто вы', 'Что передать', 'Где живёт', 'Что подключить', 'Характер', 'Уровень', 'О вас', 'Ваш день'],
    en: ['Who you are', 'What to hand over', 'Where it lives', 'What to connect', 'Character', 'Tier', 'About you', 'Your day'],
  } as L<string[]>,
  titles: [
    l('Кто вы?', 'Who are you?'),
    l('Что передать ассистенту?', 'What do you hand over?'),
    l('Где он будет жить?', 'Where will it live?'),
    l('К чему подключить?', 'What should it connect to?'),
    l('Какой у него характер?', 'What is its character?'),
    l('Какой уровень нужен?', 'Which tier do you need?'),
    l('Немного о вас', 'A little about you'),
    l('Ваш день с ИИ', 'Your day with the AI'),
  ],
  subs: [
    l('Выберите ближайшее. От этого зависят подсказки дальше.', 'Pick the closest one. It sets the hints on the next screens.'),
    l('Отметьте всё, что хотите снять с себя. Список можно менять позже.', 'Tick everything you want off your plate. You can change it later.'),
    l('Каналы равноправны: можно несколько сразу.', 'Channels are equal: pick several if you like.'),
    l('Доступ даёте вы и можете отозвать в любой момент. Пока только отметьте, что у вас есть.', 'You give the access and can withdraw it at any time. For now just tick what you have.'),
    l('Три ползунка. Ассистент подстроится, это можно поменять в кабинете.', 'Three sliders. The assistant adapts, and you can change them in the cabinet.'),
    l('Рекомендуем по тому, сколько вы передали. Выбор за вами.', 'Suggested by how much you hand over. The choice is yours.'),
    l('Всё по желанию, но чем больше мы знаем, тем точнее настроим.', 'All optional, but the more we know, the better we tune it.'),
    l('Так может выглядеть обычный день. Это набросок из ваших ответов, не обещание.', 'This is how an ordinary day could look. A sketch from your answers, not a promise.'),
  ],
  issues: {
    who: l('Выберите, кто вы', 'Pick who you are'),
    hand: l('Отметьте хотя бы одно дело', 'Tick at least one thing'),
    where: l('Выберите хотя бы один канал', 'Pick at least one channel'),
  } as Record<string, L<string>>,
}

export const whoText: Record<PersonalWho, Named> = {
  student: n(['Студент', 'Сроки, пары, экзамены'], ['Student', 'Deadlines, classes, exams']),
  founder: n(['Предприниматель', 'Дела, люди, деньги'], ['Entrepreneur', 'Tasks, people, money']),
  doctor: n(['Врач', 'Приём, записи, документы'], ['Doctor', 'Appointments, records, paperwork']),
  freelancer: n(['Фрилансер', 'Проекты, клиенты, счета'], ['Freelancer', 'Projects, clients, invoices']),
  manager: n(['Руководитель', 'Встречи, письма, решения'], ['Manager', 'Meetings, mail, decisions']),
  parent: n(['Родитель', 'Дом, дети, расписание'], ['Parent', 'Home, kids, schedule']),
  blogger: n(['Блогер', 'Контент, комментарии, план'], ['Blogger', 'Content, comments, plan']),
  teacher: n(['Учитель', 'Уроки, проверка, родители'], ['Teacher', 'Lessons, grading, parents']),
  other: n(['Другое', 'Расскажем о себе дальше'], ['Other', 'You tell us more later']),
}

export const handText: Record<PersonalHand, Named> = {
  mail: n(['Почта', 'Разобрать письма, набросать ответы'], ['Mail', 'Sort emails, draft replies']),
  calendar: n(['Календарь', 'Встречи, окна, напоминания'], ['Calendar', 'Meetings, free slots, reminders']),
  study: n(['Учёба', 'Сроки и задания из учебной системы'], ['Study', 'Deadlines and assignments']),
  money: n(['Финансы', 'Траты, счета, платежи по срокам'], ['Money', 'Spending, bills, payment dates']),
  health: n(['Здоровье', 'Лекарства, визиты, привычки'], ['Health', 'Medication, visits, habits']),
  languages: n(['Языки', 'Слова и разговорная практика'], ['Languages', 'Words and speaking practice']),
  content: n(['Контент', 'Идеи, черновики, план постов'], ['Content', 'Ideas, drafts, a posting plan']),
  home: n(['Дом и покупки', 'Списки, заказы, ремонт'], ['Home and shopping', 'Lists, orders, repairs']),
  docs: n(['Документы', 'Найти, сложить, напомнить о сроке'], ['Documents', 'Find, file, remind of a deadline']),
  reminders: n(['Напоминания', 'Дела, которые нельзя забыть'], ['Reminders', 'Things you must not forget']),
  calls: n(['Звонки', 'Принять, записать, пересказать'], ['Calls', 'Answer, record, summarise']),
  search: n(['Поиск', 'Найти и коротко рассказать'], ['Research', 'Find it and tell you in short']),
}

export const channelNames: Record<PersonalChannel, Named> = {
  telegram: n(['Telegram', 'Чат в мессенджере'], ['Telegram', 'A messenger chat']),
  whatsapp: n(['WhatsApp', 'Чат в мессенджере'], ['WhatsApp', 'A messenger chat']),
  webchat: n(['Веб-чат на сайте', 'Окно чата в браузере'], ['Web chat', 'A chat window in the browser']),
  cabinet: n(['Личный веб-кабинет', 'Всё в одном месте на сайте'], ['Personal web cabinet', 'Everything in one place']),
  voice: n(['Голос', 'Звонки и голосовые сообщения'], ['Voice', 'Calls and voice messages']),
  email: n(['Почта', 'Письма с ассистентом'], ['Email', 'Letters with the assistant']),
  desktop: n(['Рабочий стол', 'Mac и Windows'], ['Desktop', 'Mac and Windows']),
}

export const connectText: Record<PersonalConnect, L<string>> = {
  google: l('Google', 'Google'),
  microsoft: l('Outlook и Microsoft', 'Outlook and Microsoft'),
  apple: l('Apple', 'Apple'),
  moodle: l('Moodle', 'Moodle'),
  notion: l('Notion', 'Notion'),
  telegram: l('Telegram', 'Telegram'),
  whatsapp: l('WhatsApp', 'WhatsApp'),
  bank: l('Банковские выписки', 'Bank statements'),
  other: l('Другое', 'Other'),
}

export const toneUi = {
  axes: [
    { id: 'formality', name: l('Обращение', 'Address'), options: [l('На «ты», тепло', 'Casual and warm'), l('Ровно', 'Even'), l('На «вы», строго', 'Formal')] },
    { id: 'brevity', name: l('Длина ответов', 'Answer length'), options: [l('Коротко', 'Short'), l('Средне', 'Medium'), l('Подробно', 'Detailed')] },
    { id: 'initiative', name: l('Инициатива', 'Initiative'), options: [l('Ждёт просьбы', 'Waits for you'), l('Иногда напоминает', 'Nudges sometimes'), l('Предлагает сам', 'Proposes things')] },
  ],
}

export const tierText: Record<'basic' | 'plus' | 'max', Named> = {
  basic: n(['Спутник', 'Помнит, напоминает, отвечает по двум-трём делам'], ['Companion', 'Remembers, reminds, covers two or three areas']),
  plus: n(['Второй пилот', 'Ведёт несколько дел, понимает голос'], ['Co-pilot', 'Runs several areas and understands voice']),
  max: n(['Второе я', 'Берёт на себя почти всё и долго помнит'], ['Second self', 'Takes on almost everything and remembers long']),
}
export const tierUi = {
  setup: l('настройка', 'setup'),
  perMonth: l('в месяц', 'a month'),
  suggested: l('Подходит вам', 'Fits you'),
  byok: l(
    'Свой ключ ИИ-модели (BYOK) можно принести: подключим. Условия назовём в смете.',
    'You can bring your own AI model key (BYOK) and we connect it. Terms come in the quote.',
  ),
  // Amounts are never typed here: setup, monthly and own-key monthly come from `pricing.personalPlans` (src/lib/pricing.ts).
}

export const dayUi = {
  start: l('Утренняя сводка: что важно сегодня', 'Morning brief: what matters today'),
  end: l('Вечерний итог и план на завтра', 'Evening wrap-up and tomorrow’s plan'),
  rows: {
    mail: l('Разобрал письма, ответы ждут вашего «да»', 'Sorted the mail, replies wait for your yes'),
    calendar: l('Проверил календарь и предложил окна', 'Checked the calendar and proposed slots'),
    study: l('Напомнил про ближайшие сроки учёбы', 'Reminded you of the nearest study deadlines'),
    money: l('Свёл траты и платежи на ближайшие дни', 'Totalled spending and upcoming payments'),
    health: l('Напомнил про лекарства и визиты', 'Reminded you of medication and visits'),
    languages: l('Короткая практика языка', 'A short language practice'),
    content: l('Набросал черновик поста по вашему плану', 'Drafted a post from your plan'),
    home: l('Обновил список покупок и дел по дому', 'Updated the shopping and home list'),
    docs: l('Нашёл нужный документ и сверил срок', 'Found the document you need and checked its date'),
    reminders: l('Напомнил про то, что нельзя забыть', 'Reminded you of what you must not forget'),
    calls: l('Принял звонок и прислал краткое содержание', 'Took a call and sent a short summary'),
    search: l('Нашёл ответ на ваш вопрос и дал выжимку', 'Found an answer and gave a digest'),
  } as Record<PersonalHand, L<string>>,
  // The greeting follows the formality slider.
  greetings: [
    l('Привет! Вот что у нас на сегодня', 'Hi! Here is our day'),
    l('Доброе утро. План на сегодня', 'Good morning. Today’s plan'),
    l('Доброе утро. Сводка на сегодня готова', 'Good morning. Your brief for today is ready'),
  ],
  label: l('Набросок по вашим ответам', 'A sketch from your answers'),
}

export const personalLabels = {
  who: l('Вы', 'You'),
  hand: l('Передаёте', 'Hands over'),
  where: l('Где живёт', 'Lives in'),
  connect: l('Подключить', 'Connect'),
  tone: l('Характер', 'Character'),
  tier: l('Уровень', 'Tier'),
}

// ------------------------------------------------------------------ discovery

export const discUi = {
  title: l('Расскажите о себе подробнее', 'Tell us more'),
  sub: l('Всё по желанию. Это сэкономит нам звонок и поможет точнее настроить Фиру.', 'All optional. It saves us a call and helps tune Fira.'),
  size: l('Размер команды', 'Team size'),
  leads: l('Заявок в день', 'Requests a day'),
  base: l('Клиентов в базе', 'Clients in your base'),
  hours: l('Рабочие часы', 'Working hours'),
  tz: l('Часовой пояс', 'Time zone'),
  tzPlaceholder: l('Например, UTC+5', 'For example, UTC+5'),
  approver: l('Кто одобряет решения', 'Who approves'),
  site: l('Ваш сайт', 'Your site'),
  instagram: l('Ваш Instagram', 'Your Instagram'),
  linkPlaceholder: l('Ссылка или @имя', 'Link or @name'),
  pains: l('Что болит сейчас', 'What hurts now'),
  success: l('Как поймём, что получилось', 'How we will know it worked'),
  heard: l('Как узнали о нас', 'How you heard of us'),
  more: l('Рассказать подробнее', 'Tell us more'),
  less: l('Свернуть', 'Collapse'),
  optional: l('по желанию', 'optional'),
  invalidLink: l('Похоже на ошибку в ссылке', 'That link looks wrong'),
}

export const sizeText: Record<DiscSize, L<string>> = {
  solo: l('Только я', 'Just me'),
  s5: l('2-5 человек', '2-5 people'),
  s20: l('6-20 человек', '6-20 people'),
  s20p: l('Больше 20', 'Over 20'),
}
export const leadsText: Record<DiscLeads, L<string>> = {
  d5: l('До 5', 'Up to 5'),
  d20: l('6-20', '6-20'),
  d50: l('21-50', '21-50'),
  d50p: l('Больше 50', 'Over 50'),
}
export const baseText: Record<DiscBase, L<string>> = {
  k100: l('До 100', 'Up to 100'),
  k1k: l('До 1 000', 'Up to 1,000'),
  k10k: l('До 10 000', 'Up to 10,000'),
  k10kp: l('Больше 10 000', 'Over 10,000'),
}
export const hoursText: Record<DiscHours, L<string>> = {
  h9: l('С 9 до 18', '9 to 6'),
  h24: l('Круглосуточно', 'Around the clock'),
  hshift: l('Посменно', 'In shifts'),
  hflex: l('Гибко', 'Flexible'),
}
export const approverText: Record<DiscApprover, L<string>> = {
  owner: l('Я сам', 'I do'),
  manager: l('Руководитель', 'A manager'),
  team: l('Команда', 'The team'),
  auto: l('Пусть ИИ решает простое', 'Let the AI decide simple things'),
}
export const painText: Record<DiscPain, L<string>> = {
  calls: l('Звонки отвлекают', 'Calls interrupt'),
  lost: l('Теряются заявки', 'Requests get lost'),
  slow: l('Долго отвечаем', 'We answer slowly'),
  manual: l('Много ручной работы', 'Too much manual work'),
  noshow: l('Неявки', 'No-shows'),
  reports: l('Нет цифр и отчётов', 'No numbers or reports'),
  chaos: l('Всё в разных местах', 'Everything is scattered'),
  time: l('Не хватает времени', 'Not enough time'),
  content: l('Некогда вести соцсети', 'No time for social media'),
  money: l('Деньги и счета путаются', 'Money and bills get tangled'),
}
export const successText: Record<DiscSuccess, L<string>> = {
  leads: l('Больше заявок', 'More requests'),
  time: l('Больше свободного времени', 'More free time'),
  lost: l('Ничего не теряется', 'Nothing gets lost'),
  revenue: l('Больше выручки', 'More revenue'),
  calm: l('Спокойнее голова', 'A calmer mind'),
  control: l('Всё под контролем', 'Everything under control'),
}
export const heardText: Record<DiscHeard, L<string>> = {
  search: l('Поиск', 'Search'),
  instagram: l('Instagram', 'Instagram'),
  friend: l('Посоветовали', 'A recommendation'),
  telegram: l('Telegram', 'Telegram'),
  ai: l('Спросил(а) у ИИ', 'Asked an AI'),
  ads: l('Реклама', 'Ads'),
  other: l('Другое', 'Other'),
}
export const discLabels = {
  size: l('Команда', 'Team'),
  leads: l('Заявок в день', 'Requests a day'),
  base: l('Клиентов в базе', 'Clients in base'),
  hours: l('Рабочие часы', 'Working hours'),
  tz: l('Часовой пояс', 'Time zone'),
  approver: l('Одобряет', 'Approves'),
  site: l('Сайт', 'Site'),
  instagram: l('Instagram', 'Instagram'),
  pains: l('Болит', 'Pains'),
  success: l('Успех', 'Success'),
  heard: l('Узнали о нас', 'Heard of us'),
}
