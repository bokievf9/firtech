import type {
  DiscApprover,
  DiscBase,
  DiscChan,
  DiscDev,
  DiscHeard,
  DiscHours,
  DiscLang,
  DiscLeads,
  DiscPain,
  DiscRhythm,
  DiscRole,
  DiscSize,
  DiscSrc,
  DiscSuccess,
  DiscTool,
  DiscWhen,
  PersonalChannel,
  PersonalConnect,
  PersonalHand,
  PersonalWho,
  PersonalWhoAny,
} from '../lib/builder-ids'
import type { L } from './builder-catalog'
import { personaMore } from './capabilities'

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
  // v5: the other sixteen of the 25 connections
  slack: l('Slack', 'Slack'),
  todoist: l('Todoist', 'Todoist'),
  trello: l('Trello', 'Trello'),
  obsidian: l('Obsidian', 'Obsidian'),
  github: l('GitHub', 'GitHub'),
  dropbox: l('Dropbox', 'Dropbox'),
  zoom: l('Zoom', 'Zoom'),
  evernote: l('Evernote', 'Evernote'),
  applehealth: l('Apple Здоровье', 'Apple Health'),
  strava: l('Strava', 'Strava'),
  linkedin: l('LinkedIn', 'LinkedIn'),
  instagram: l('Instagram', 'Instagram'),
  youtube: l('YouTube', 'YouTube'),
  canvas: l('Canvas', 'Canvas'),
  anki: l('Anki', 'Anki'),
  kaspi: l('Kaspi', 'Kaspi'),
}

export const toneUi = {
  axes: [
    { id: 'formality', name: l('Обращение', 'Address'), options: [l('На «ты», тепло', 'Casual and warm'), l('Ровно', 'Even'), l('На «вы», строго', 'Formal')] },
    { id: 'brevity', name: l('Длина ответов', 'Answer length'), options: [l('Коротко', 'Short'), l('Средне', 'Medium'), l('Подробно', 'Detailed')] },
    { id: 'initiative', name: l('Инициатива', 'Initiative'), options: [l('Ждёт просьбы', 'Waits for you'), l('Иногда напоминает', 'Nudges sometimes'), l('Предлагает сам', 'Proposes things')] },
    // v5: two more axes (five in all)
    { id: 'humor', name: l('Юмор', 'Humour'), options: [l('Серьёзно', 'Serious'), l('Иногда шутит', 'A joke now and then'), l('С юмором', 'Playful')] },
    { id: 'firmness', name: l('Напоминания', 'Reminders'), options: [l('Мягко', 'Soft'), l('Настойчиво', 'Persistent'), l('Строго', 'Strict')] },
  ],
}

export const tierText: Record<'basic' | 'plus' | 'max', Named> = {
  basic: n(['Спутник', 'Помнит, напоминает, отвечает по двум-трём делам'], ['Companion', 'Remembers, reminds, covers two or three areas']),
  plus: n(['Второй пилот', 'Ведёт несколько дел сразу'], ['Co-pilot', 'Runs several areas at once']),
  max: n(['Второе я', 'Берёт на себя почти всё и долго помнит'], ['Second self', 'Takes on almost everything and remembers long']),
}
export const tierUi = {
  setup: l('настройка', 'setup'),
  perMonth: l('в месяц', 'a month'),
  suggested: l('Подходит вам', 'Fits you'),
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
  label: l('Смета по вашим ответам; итог фиксируем перед стартом', 'An estimate from your answers; we fix the total before the start'),
}

export const personalLabels = {
  who: l('Вы', 'You'),
  hand: l('Передаёте', 'Hands over'),
  where: l('Где живёт', 'Lives in'),
  connect: l('Подключить', 'Connect'),
  tone: l('Характер', 'Character'),
  tier: l('Уровень', 'Tier'),
  byok: l('Свой ключ', 'Own key'),
  yes: l('да', 'yes'),
  no: l('нет', 'no'),
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
  src: l('Откуда приходят клиенты', 'Where your clients come from'),
  tools: l('Чем пользуетесь сейчас', 'What you use now'),
  langs: l('На каких языках общаетесь', 'Languages you use'),
  when: l('Когда нужен результат', 'When you need it'),
  role: l('Как устроена ваша работа', 'How your work is set up'),
  rhythm: l('Ритм вашего дня', 'Your day rhythm'),
  chan: l('Где вы общаетесь', 'Where you chat'),
  first: l('Что передать первым', 'What to hand over first'),
  dev: l('С каких устройств', 'Your devices'),
  note: l('Своими словами', 'In your own words'),
  notePlaceholder: l('Например: что у нас особенного, что не должен делать агент, чего боитесь', 'For example: what is special about you, what the agent must not do, what worries you'),
  noteHint: l('Не больше 500 символов. Пароли и коды сюда не пишите.', 'Up to 500 characters. Please do not put passwords or codes here.'),
  chosen: l('Ваши ответы', 'Your answers'),
  more: l('Рассказать подробнее', 'Tell us more'),
  less: l('Свернуть', 'Collapse'),
  optional: l('по желанию', 'optional'),
  invalidLink: l('Похоже на ошибку в ссылке', 'That link looks wrong'),
}

export const sizeText: Record<DiscSize, L<string>> = {
  solo: l('Только я', 'Just me'),
  s5: l('2-5 человек', '2-5 people'),
  s10: l('6-10 человек', '6-10 people'),
  s20: l('11-20 человек', '11-20 people'),
  s50: l('21-50 человек', '21-50 people'),
  s50p: l('Больше 50', 'Over 50'),
  s20p: l('Больше 20', 'Over 20'),
}
export const leadsText: Record<DiscLeads, L<string>> = {
  dnone: l('Пока почти нет', 'Hardly any yet'),
  d5: l('До 5', 'Up to 5'),
  d20: l('6-20', '6-20'),
  d50: l('21-50', '21-50'),
  d100: l('51-100', '51-100'),
  d100p: l('Больше 100', 'Over 100'),
  d50p: l('Больше 50', 'Over 50'),
}
export const baseText: Record<DiscBase, L<string>> = {
  k0: l('Пока нет базы', 'No base yet'),
  k100: l('До 100', 'Up to 100'),
  k500: l('100-500', '100-500'),
  k1k: l('500-1 000', '500-1,000'),
  k5k: l('1 000-5 000', '1,000-5,000'),
  k10k: l('5 000-10 000', '5,000-10,000'),
  k10kp: l('Больше 10 000', 'Over 10,000'),
}
export const hoursText: Record<DiscHours, L<string>> = {
  h9: l('С 9 до 18', '9 to 6'),
  h24: l('Круглосуточно', 'Around the clock'),
  hshift: l('Посменно', 'In shifts'),
  hflex: l('Гибко', 'Flexible'),
  hlate: l('С 10 до 20', '10 to 8'),
  hweekend: l('Включая выходные', 'Weekends too'),
  hseason: l('По сезону', 'Seasonal'),
}
export const approverText: Record<DiscApprover, L<string>> = {
  owner: l('Я сам', 'I do'),
  manager: l('Руководитель', 'A manager'),
  team: l('Команда', 'The team'),
  auto: l('Пусть ИИ решает простое', 'Let the AI decide simple things'),
  partners: l('Партнёры вместе', 'The partners together'),
  admin: l('Администратор', 'An administrator'),
  client: l('Клиент подтверждает сам', 'The client confirms'),
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
  other: l('Другое', 'Other'),
}
export const successText: Record<DiscSuccess, L<string>> = {
  leads: l('Больше заявок', 'More requests'),
  time: l('Больше свободного времени', 'More free time'),
  lost: l('Ничего не теряется', 'Nothing gets lost'),
  revenue: l('Больше выручки', 'More revenue'),
  calm: l('Спокойнее голова', 'A calmer mind'),
  control: l('Всё под контролем', 'Everything under control'),
  speed: l('Быстрее отвечаем', 'We answer faster'),
  quality: l('Выше качество сервиса', 'Better service'),
  growth: l('Растём без найма', 'Growth without hiring'),
  other: l('Другое', 'Other'),
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
const other = l('Другое', 'Other')
export const srcText: Record<DiscSrc, L<string>> = {
  instagram: l('Instagram', 'Instagram'), telegram: l('Telegram', 'Telegram'), whatsapp: l('WhatsApp', 'WhatsApp'),
  search: l('Поиск', 'Search'), ads: l('Реклама', 'Ads'), friends: l('Рекомендации', 'Referrals'),
  offline: l('Офлайн, с улицы', 'Offline, walk-ins'), other,
}
export const discToolText: Record<DiscTool, L<string>> = {
  sheets: l('Google Таблицы', 'Google Sheets'), excel: l('Excel', 'Excel'), amocrm: l('amoCRM', 'amoCRM'),
  bitrix: l('Битрикс24', 'Bitrix24'), onec: l('1С', '1C'),
  messengers: l('Только мессенджеры', 'Messengers only'),
  none: l('Ничего не используем', 'Nothing yet'), other,
}
export const langText: Record<DiscLang, L<string>> = {
  ru: l('Русский', 'Russian'), tj: l('Таджикский', 'Tajik'), en: l('Английский', 'English'),
  uz: l('Узбекский', 'Uzbek'), kz: l('Казахский', 'Kazakh'), other,
}
export const whenText: Record<DiscWhen, L<string>> = {
  asap: l('Как можно скорее', 'As soon as possible'), month: l('В течение месяца', 'Within a month'),
  quarter: l('За 2-3 месяца', 'In 2-3 months'), half: l('В течение полугода', 'Within six months'),
  norush: l('Не торопимся', 'No rush'), date: l('К конкретной дате', 'By a set date'),
}
export const roleText: Record<DiscRole, L<string>> = {
  employed: l('Работаю по найму', 'Employed'), business: l('Свой бизнес', 'My own business'),
  freelance: l('Фриланс', 'Freelance'), study: l('Учусь', 'Studying'),
  creative: l('Творческая работа', 'Creative work'), mixed: l('Совмещаю несколько', 'A mix of several'), other,
}
export const rhythmText: Record<DiscRhythm, L<string>> = {
  early: l('Встаю рано', 'Early riser'), owl: l('Сова', 'Night owl'), evening: l('Вечером свободнее', 'Freer in the evening'),
  shifts: l('Посменно', 'In shifts'), travel: l('Часто в разъездах', 'Often travelling'),
  weekends: l('Работаю и в выходные', 'Work on weekends too'), irregular: l('Без режима', 'No fixed rhythm'),
}
export const chanText: Record<DiscChan, L<string>> = {
  telegram: l('Telegram', 'Telegram'), whatsapp: l('WhatsApp', 'WhatsApp'), instagram: l('Instagram', 'Instagram'),
  email: l('Почта', 'Email'), imessage: l('iMessage', 'iMessage'), slack: l('Slack', 'Slack'),
  phone: l('Звонки', 'Calls'), other,
}
export const devText: Record<DiscDev, L<string>> = {
  iphone: l('iPhone', 'iPhone'), android: l('Android', 'Android'), mac: l('Mac', 'Mac'), windows: l('Windows', 'Windows'),
  ipad: l('iPad', 'iPad'), web: l('Только браузер', 'Browser only'), watch: l('Часы', 'Watch'), linux: l('Linux', 'Linux'),
}
export const discLabels = {
  src: l('Откуда клиенты', 'Where clients come from'),
  tools: l('Чем пользуетесь', 'Current tools'),
  langs: l('Языки', 'Languages'),
  when: l('Когда нужно', 'Deadline'),
  role: l('Занятость', 'Work'),
  rhythm: l('Ритм дня', 'Day rhythm'),
  chan: l('Где общаетесь', 'Channels used'),
  first: l('Передать первым', 'Hand over first'),
  dev: l('Устройства', 'Devices'),
  note: l('Своими словами', 'In your words'),
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
export const detailsSummary = {
  title: l('Подробности', 'Details'),
  answers: (n: number, ru: boolean) =>
    ru ? `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'ответ' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'ответа' : 'ответов'}` : `${n} ${n === 1 ? 'answer' : 'answers'}`,
  note: l('заметка', 'a note'),
}

// v5: the nine people plus six more (15), for the builder; the Personal AI page keeps `whoText` (first eight).
export const whoTextAll: Record<PersonalWhoAny, Named> = { ...whoText, ...personaMore }
