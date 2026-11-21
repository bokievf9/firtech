import type {
  AfterStep,
  Budget,
  BuildChannel,
  ClientSource,
  ClientTool,
  ClientType,
  DeliveryChannel,
  DetailAsset,
  DetailDeadline,
  Fear,
  SiteNeed,
  ThemeId,
  ThemeMood,
} from '../lib/builder-ids'
import type { L } from './builder-catalog'

// «Сборка проекта» v2 (owner review 2026-11-22): every string of the new screens, RU and EN side by
// side. The word «конструктор» and the word «калькулятор» never appear here (a test greps for them).
// No em or en dashes in copy (use a hyphen). Prices are never typed here.

export type Named = { name: L<string>; hint: L<string> }
const n = (ru: [string, string], en: [string, string]): Named => ({
  name: { ru: ru[0], en: en[0] },
  hint: { ru: ru[1], en: en[1] },
})

// ------------------------------------------------------------------ goals

export const goalText: Record<string, Named> = {
  // the original five (old links)
  leads: n(['Заявки', 'Клиенты оставляют контакты, вы перезваниваете'], ['Leads', 'Customers leave contacts and you call back']),
  sales: n(['Продажи онлайн', 'Заказ и оплата без звонков и переписки'], ['Online sales', 'Orders and payment without calls and chats']),
  booking: n(['Запись клиентов', 'Клиент сам выбирает свободное время'], ['Bookings', 'The customer picks a free time alone']),
  routine: n(['Автоматизация рутины', 'Заявки, отчёты и напоминания без ручной работы'], ['Routine automated', 'Leads, reports and reminders without manual work']),
  brand: n(['Узнаваемость', 'Бизнес выглядит солидно, его легко найти'], ['Recognition', 'The business looks solid and is easy to find']),
  // agents
  answer24: n(['Отвечать клиентам в любое время', 'Ночью и в выходные вопрос не остаётся без ответа'], ['Answer customers at any hour', 'No question waits for the morning']),
  nocalls: n(['Запись без звонков', 'Клиент выбирает время сам, администратор не берёт трубку'], ['Booking without calls', 'The customer picks a time, the front desk stays free']),
  noshow: n(['Меньше неявок', 'Напоминание за день и за два часа до визита'], ['Fewer no-shows', 'Reminders a day and two hours ahead']),
  leadcollect: n(['Собирать заявки с контактами', 'Имя, телефон и суть вопроса в одном сообщении'], ['Collect leads with contacts', 'Name, phone and the request in one message']),
  faqoff: n(['Снять повторяющиеся вопросы', 'Цены, адрес и часы работы: отвечает агент'], ['Offload repeated questions', 'Prices, address and hours: the agent answers']),
  upsell: n(['Больше повторных визитов', 'Агент предлагает записаться снова и добавить услугу'], ['More repeat visits', 'The agent offers a new booking and an extra service']),
  reviews: n(['Получать отзывы после визита', 'Просит оценку и отправляет довольных клиентов на карту'], ['Collect reviews after a visit', 'Asks for a rating and sends happy clients to the map']),
  handover: n(['Передавать сложное человеку', 'Спорный вопрос уходит вам вместе с перепиской'], ['Hand hard cases to a person', 'A tricky question reaches you with the chat history']),
  // websites
  moreleads: n(['Больше заявок с сайта', 'Понятное предложение и короткая форма на каждом экране'], ['More leads from the site', 'A clear offer and a short form on every screen']),
  trust: n(['Выглядеть надёжно', 'Контакты, отзывы и цены, которым верят'], ['Look reliable', 'Contacts, reviews and prices people trust']),
  prices: n(['Показать цены и услуги', 'Клиент понимает стоимость до звонка'], ['Show prices and services', 'The client knows the cost before calling']),
  onlineorder: n(['Принимать заказы и оплату', 'Корзина и оплата прямо на сайте'], ['Take orders and payments', 'A cart and payment on the site']),
  search: n(['Находиться в Google и на картах', 'Клиенты находят вас, когда ищут услугу рядом'], ['Be found on Google and maps', 'Customers find you when they search nearby']),
  langs: n(['Говорить с клиентами на их языке', 'Русский, английский, таджикский или узбекский'], ['Speak the customer language', 'Russian, English, Tajik or Uzbek']),
  portfolio: n(['Показать работы и результаты', 'Примеры, до и после, отзывы клиентов'], ['Show work and results', 'Examples, before and after, client reviews']),
  offer: n(['Запускать акции и сезонные предложения', 'Обновляете баннер сами, без программиста'], ['Run offers and seasonal deals', 'Update the banner yourself']),
  // automation
  nomanual: n(['Убрать ручной ввод', 'Данные переносятся между сервисами сами'], ['Remove manual entry', 'Data moves between services alone']),
  oneplace: n(['Всё в одном месте', 'Заявки, оплаты и задачи в одной таблице или CRM'], ['Everything in one place', 'Leads, payments and tasks in one sheet or CRM']),
  reports: n(['Видеть цифры без ручных отчётов', 'Сводка по продажам приходит сама каждую неделю'], ['See numbers without manual reports', 'A sales summary arrives every week']),
  alerts: n(['Узнавать о важном сразу', 'Сообщение в Telegram, когда нужно ваше решение'], ['Hear about important things at once', 'A Telegram message when you must decide']),
  nolost: n(['Не терять заявки', 'У каждой заявки есть ответственный и срок'], ['Never lose a lead', 'Every lead has an owner and a deadline']),
  paytrack: n(['Следить за оплатами', 'Кто оплатил, кто должен, кому напомнить'], ['Track payments', 'Who paid, who owes, who to remind']),
  synctools: n(['Связать сервисы между собой', 'Сайт, CRM, мессенджеры и таблицы обмениваются данными'], ['Connect services', 'Site, CRM, messengers and sheets exchange data']),
  // content
  regular: n(['Публиковать регулярно', 'Посты выходят по плану, без пропусков'], ['Post regularly', 'Posts go out on schedule without gaps']),
  reels: n(['Выпускать короткие ролики', 'Reels и Shorts из ваших фото и видео'], ['Publish short videos', 'Reels and Shorts from your photos and clips']),
  cards: n(['Красивые карточки товаров и услуг', 'Единый вид и описания, которые продают'], ['Good product and service cards', 'One look and descriptions that sell']),
  lesstime: n(['Освободить время владельца', 'Вы только одобряете готовое'], ['Free the owner time', 'You only approve the finished post']),
  voice: n(['Держать единый голос бренда', 'Тексты звучат одинаково во всех соцсетях'], ['Keep one brand voice', 'Texts sound the same on every network']),
  stories: n(['Вести сторис без придумывания тем', 'Темы и черновики готовы заранее'], ['Run stories without topic hunting', 'Topics and drafts are ready ahead']),
  season: n(['Готовиться к сезонам и праздникам', 'Календарь акций составлен на месяц вперёд'], ['Prepare for seasons and holidays', 'A promo calendar a month ahead']),
  // Mini App
  ordertg: n(['Принимать заказы в Telegram', 'Клиенту не нужно ставить отдельное приложение'], ['Take orders in Telegram', 'No separate app to install']),
  loyalty: n(['Копить бонусы и награждать постоянных', 'Каждая десятая покупка со скидкой'], ['Build loyalty', 'A reward after every tenth purchase']),
  repeat: n(['Повторный заказ в два нажатия', 'История заказов хранится в профиле'], ['Reorder in two taps', 'Order history sits in the profile']),
  paytg: n(['Оплата прямо в Telegram', 'Клиент не уходит из чата'], ['Pay inside Telegram', 'The customer stays in the chat']),
  catalog: n(['Каталог с фото и ценами', 'Актуальные цены и наличие всегда под рукой'], ['A catalogue with photos and prices', 'Current prices and stock at hand']),
  bookingtg: n(['Запись на услугу внутри Telegram', 'Мастер, время и оплата на одном экране'], ['Booking inside Telegram', 'Master, time and payment on one screen']),
  promo: n(['Рассылать акции подписчикам', 'Новость о скидке доходит до каждого'], ['Send deals to subscribers', 'Every subscriber hears about a discount']),
  // department
  knowledge: n(['Собрать знания компании в одном месте', 'Регламенты, ответы и инструкции под рукой'], ['Gather company knowledge', 'Rules, answers and guides at hand']),
  docs: n(['Отвечать по вашим документам', 'Ответ со ссылкой на пункт договора или регламента'], ['Answer from your documents', 'Replies cite the contract or rule']),
  train: n(['Обучить команду работе с ИИ', 'Короткое обучение и памятки для сотрудников'], ['Train the team to use AI', 'Short training and cheat sheets']),
  oneassist: n(['Один ассистент для всех сотрудников', 'Вопросы к одному агенту вместо пяти коллег'], ['One assistant for everyone', 'Ask one agent instead of five colleagues']),
  onboard: n(['Быстро вводить новых сотрудников', 'Новичок получает ответы без отвлечения команды'], ['Onboard new people fast', 'Newcomers get answers without bothering the team']),
  control: n(['Видеть, что делает каждый агент', 'Отчёт о задачах и расходах в понятном виде'], ['See what each agent does', 'A clear report of tasks and costs']),
  // agent products added 2026-11-22 (administrator, lead manager, personal assistant), apps and departments
  fillslots: n(['Заполнять свободные окна', 'Освободившееся время агент предлагает тем, кто ждал'], ['Fill free slots', 'A freed time is offered to those who waited']),
  speedlead: n(['Отвечать на заявку за минуту', 'Клиент не успевает уйти к тем, кто ответил быстрее'], ['Reply to a lead within a minute', 'The client does not wander off to a faster competitor']),
  qualify: n(['Отделять горячие заявки от пустых', 'Бюджет, срок и задача выяснены до звонка менеджера'], ['Tell hot leads from idle ones', 'Budget, deadline and task are known before the manager calls']),
  followup: n(['Возвращать замолчавших клиентов', 'Агент один раз мягко напоминает о себе'], ['Bring back silent clients', 'The agent nudges once, politely']),
  deadlines: n(['Не пропускать сроки', 'Дедлайны из почты и систем собраны в один список'], ['Never miss a deadline', 'Deadlines from mail and systems sit in one list']),
  inbox: n(['Разбирать почту быстрее', 'Письма, на которые нужно ответить, выделены, черновики готовы'], ['Clear the inbox faster', 'Letters that need an answer are marked, drafts are ready']),
  planday: n(['Планировать день', 'Дела расставлены по времени в календаре'], ['Plan the day', 'Tasks are placed on the calendar']),
  remindme: n(['Получать напоминания вовремя', 'Сообщение в Telegram в нужный момент, без лишнего шума'], ['Get reminders on time', 'A Telegram message at the right moment, no extra noise']),
  calsync: n(['Держать календарь в порядке', 'Встречи, учёба и дела в одном месте'], ['Keep the calendar tidy', 'Meetings, study and tasks in one place']),
  langstudy: n(['Учить язык по расписанию', 'Короткие задания и разбор ошибок каждый день'], ['Study a language on schedule', 'Short tasks and mistake review every day']),
  focus: n(['Беречь время без отвлечений', 'Часы тишины: ассистент не пишет, пока вы заняты'], ['Protect focus time', 'Quiet hours: the assistant stays silent while you work']),
  weekly: n(['Видеть итоги недели', 'Что сделано, что горит и что перенесено'], ['See the week in one summary', 'What is done, what is urgent and what moved']),
  weeklysum: n(['Недельная сводка владельцу', 'Что сделали агенты, что ждёт решения'], ['A weekly summary for the owner', 'What the agents did and what waits for a decision']),
  approvals: n(['Одобрять решения кнопкой', 'Агенты готовят, вы решаете в Telegram'], ['Approve decisions with a button', 'Agents prepare, you decide in Telegram']),
  payinapp: n(['Принимать оплату в приложении', 'Клиент платит, не выходя из экрана'], ['Take payment in the app', 'The client pays without leaving the screen']),
  loginapp: n(['Вход и личные данные пользователей', 'Каждый видит только своё'], ['User sign-in and personal data', 'Everyone sees only their own']),
  // apps
  ownapp: n(['Своё приложение для клиентов', 'Иконка на телефоне и ваш фирменный стиль'], ['Your own client app', 'An icon on the phone in your style']),
  teamtool: n(['Внутренний инструмент для команды', 'Учёт, задачи и данные в одном окне'], ['An internal team tool', 'Records, tasks and data in one window']),
  cabinet: n(['Личный кабинет клиента', 'История заказов, оплаты и документы'], ['A client account', 'Order history, payments and documents']),
  offline: n(['Работать без интернета', 'Данные сохраняются и отправляются позже'], ['Work offline', 'Data is stored and sent later']),
  pushapp: n(['Напоминания на экране телефона', 'Статус заказа и акции приходят пушем'], ['Reminders on the phone screen', 'Order status and deals arrive as push']),
  dashboard: n(['Панель с цифрами бизнеса', 'Выручка, заказы и загрузка на одном экране'], ['A business dashboard', 'Revenue, orders and load on one screen']),
}

// ----------------------------------------------------------------- channels

export const channelText: Record<BuildChannel, Named> = {
  instagram: n(['Instagram', 'Пишут в директ и смотрят ленту'], ['Instagram', 'They write in DMs and browse the feed']),
  telegram: n(['Telegram', 'Каналы, чаты и личные сообщения'], ['Telegram', 'Channels, chats and direct messages']),
  search: n(['Google и Яндекс', 'Находят вас по запросу в поиске'], ['Google and Yandex', 'They find you by a search query']),
  word: n(['Сарафанное радио', 'Приходят по рекомендации знакомых'], ['Word of mouth', 'They come on a friend recommendation']),
  maps: n(['Карты и 2ГИС', 'Ищут рядом и смотрят отзывы'], ['Maps and 2GIS', 'They look nearby and read reviews']),
  tiktok: n(['TikTok', 'Видят ролики и идут к вам'], ['TikTok', 'They see videos and come to you']),
  whatsapp: n(['WhatsApp', 'Пишут и звонят в мессенджере'], ['WhatsApp', 'They message and call in the messenger']),
  youtube: n(['YouTube', 'Смотрят обзоры и инструкции'], ['YouTube', 'They watch reviews and guides']),
  market: n(['Маркетплейсы', 'Kaspi, Wildberries, OLX и похожие'], ['Marketplaces', 'Kaspi, Wildberries, OLX and similar']),
  ads: n(['Платная реклама', 'Таргет и контекст'], ['Paid ads', 'Targeting and search ads']),
  offline: n(['Вывеска и проходимость', 'Заходят с улицы или видят рекламу рядом'], ['Signage and foot traffic', 'They walk in or see you nearby']),
  partners: n(['Партнёры и агентства', 'Вас рекомендуют коллеги по рынку'], ['Partners and agencies', 'Peers in the market refer you']),
}

// ------------------------------------------------------------------ details

export const clientTypeText: Record<ClientType, L<string>> = {
  private: { ru: 'Частные лица', en: 'Individuals' },
  biz: { ru: 'Компании', en: 'Businesses' },
  family: { ru: 'Семьи с детьми', en: 'Families' },
  youth: { ru: 'Молодёжь', en: 'Young people' },
  vip: { ru: 'Состоятельные клиенты', en: 'Premium clients' },
  tourist: { ru: 'Туристы и приезжие', en: 'Tourists and visitors' },
}
export const sourceText: Record<ClientSource, L<string>> = {
  calls: { ru: 'Звонки', en: 'Phone calls' },
  msgs: { ru: 'Мессенджеры', en: 'Messengers' },
  walkin: { ru: 'Заходят с улицы', en: 'Walk-ins' },
  ads: { ru: 'Реклама', en: 'Ads' },
  recs: { ru: 'Рекомендации', en: 'Referrals' },
  market: { ru: 'Маркетплейсы', en: 'Marketplaces' },
  site: { ru: 'Сайт', en: 'Website' },
  none: { ru: 'Пока почти никак', en: 'Hardly any yet' },
}
export const afterText: Record<AfterStep, L<string>> = {
  notify: { ru: 'Сообщить мне сразу', en: 'Tell me at once' },
  autoreply: { ru: 'Ответить клиенту автоматически', en: 'Reply to the client automatically' },
  slot: { ru: 'Предложить время для записи', en: 'Offer a booking slot' },
  qualify: { ru: 'Уточнить детали у клиента', en: 'Ask the client for details' },
  price: { ru: 'Прислать цену или расчёт', en: 'Send a price or an estimate' },
  crm: { ru: 'Записать в CRM или таблицу', en: 'Save to a CRM or sheet' },
  remind: { ru: 'Напомнить клиенту о визите', en: 'Remind the client of the visit' },
  followup: { ru: 'Вернуться к клиенту через пару дней', en: 'Follow up in a couple of days' },
}
export const toolText: Record<ClientTool, L<string>> = {
  crm: { ru: 'CRM', en: 'CRM' },
  onec: { ru: '1С', en: '1C' },
  sheets: { ru: 'Google Таблицы', en: 'Google Sheets' },
  amocrm: { ru: 'amoCRM', en: 'amoCRM' },
  bitrix: { ru: 'Битрикс24', en: 'Bitrix24' },
  kaspi: { ru: 'Kaspi', en: 'Kaspi' },
  payme: { ru: 'Payme', en: 'Payme' },
  none: { ru: 'Ничего пока нет', en: 'Nothing yet' },
}
export const fearText: Record<Fear, L<string>> = {
  price: { ru: 'Цена вырастет по ходу', en: 'The price will grow along the way' },
  quality: { ru: 'Результат не понравится', en: 'I will not like the result' },
  terms: { ru: 'Сорвут сроки', en: 'Deadlines will slip' },
  aimistake: { ru: 'ИИ ошибётся при клиентах', en: 'The AI will slip up in front of clients' },
  data: { ru: 'Утечка данных клиентов', en: 'A leak of client data' },
  support: { ru: 'Бросят после запуска', en: 'No help after launch' },
  hard: { ru: 'Будет слишком сложно', en: 'It will be too complicated' },
}
export const budgetText: Record<Budget, L<string>> = {
  b300: { ru: 'До $300', en: 'Up to $300' },
  b1k: { ru: '$300-1000', en: '$300-1,000' },
  b3k: { ru: '$1000-3000', en: '$1,000-3,000' },
  b3kp: { ru: 'От $3000', en: 'From $3,000' },
}
export const assetText: Record<DetailAsset, L<string>> = {
  logo: { ru: 'Логотип', en: 'Logo' },
  texts: { ru: 'Тексты', en: 'Texts' },
  photos: { ru: 'Фото', en: 'Photos' },
  domain: { ru: 'Домен', en: 'Domain' },
  hosting: { ru: 'Хостинг', en: 'Hosting' },
  access: { ru: 'Доступы к сервисам', en: 'Service access' },
}
export const deadlineText: Record<DetailDeadline, L<string>> = {
  asap: { ru: 'Как можно скорее', en: 'As soon as possible' },
  w2: { ru: 'За две недели', en: 'Within two weeks' },
  month: { ru: 'В течение месяца', en: 'Within a month' },
  quarter: { ru: 'В ближайшие три месяца', en: 'Within three months' },
  relaxed: { ru: 'Не срочно', en: 'No rush' },
}

export const detailsUi = {
  title: { ru: 'Детали, которые сэкономят нам звонок', en: 'Details that save us a call' },
  sub: {
    ru: 'Поля с «обязательно» нужны, чтобы смета сразу легла в точку. Остальное можно пропустить. На цену здесь ничего не влияет.',
    en: 'Fields marked required let us make the quote right the first time. You can skip the rest. Nothing here changes the price.',
  },
  required: { ru: 'обязательно', en: 'required' },
  optional: { ru: 'по желанию', en: 'optional' },
  company: { ru: 'Название вашего бизнеса', en: 'Your business name' },
  companyHint: { ru: 'Оно появится в превью', en: 'It appears in the preview' },
  companyPlaceholder: { ru: 'Например, «Лола»', en: 'For example, "Lola"' },
  clients: { ru: 'Кто ваши клиенты', en: 'Who your clients are' },
  clientsPlaceholder: { ru: 'Например: женщины 25-40, живут рядом, ценят время', en: 'For example: women 25-40 who live nearby' },
  sources: { ru: 'Откуда приходят клиенты сейчас', en: 'Where clients come from now' },
  after: { ru: 'Что должно происходить после заявки', en: 'What happens after a request' },
  tools: { ru: 'Какие сервисы у вас уже есть', en: 'Tools you already use' },
  toolsHint: { ru: 'Ваши собственные: мы подключимся к ним', en: 'Your own: we connect to them' },
  owner: { ru: 'Кто отвечает за проект с вашей стороны', en: 'Who owns the project on your side' },
  ownerHint: { ru: 'Имя и должность, например «Азиза, управляющая»', en: 'Name and role, for example "Aziza, manager"' },
  when: { ru: 'Когда нужен запуск', en: 'When you need it live' },
  has: { ru: 'Какие материалы есть', en: 'Materials you have' },
  fears: { ru: 'Чего вы опасаетесь', en: 'What worries you' },
  budget: { ru: 'Бюджет, если готовы назвать', en: 'Budget, if you want to name it' },
  budgetHint: { ru: 'Помогает подобрать состав. Цену не меняет', en: 'Helps us pick the set. It does not change the price' },
  langs: { ru: 'Языки', en: 'Languages' },
  examples: { ru: 'Сайты, которые вам нравятся', en: 'Sites you like' },
  examplesHint: { ru: 'До двух ссылок', en: 'Up to two links' },
  wish: { ru: 'Пожелания', en: 'Notes' },
  langsNote: {
    ru: 'Вторую языковую версию сайта оценим в смете отдельной строкой: сейчас языки идут как пожелание.',
    en: 'A second language version of the site is priced as its own line in the quote. For now languages are a note.',
  },
  langsFree: {
    ru: 'Языки пока идут как заметка и на цену не влияют.',
    en: 'Languages are a note for now and do not change the price.',
  },
}

export const detailLabels = {
  company: { ru: 'Бизнес', en: 'Business' },
  clients: { ru: 'Клиенты', en: 'Clients' },
  sources: { ru: 'Приходят сейчас', en: 'Come from now' },
  after: { ru: 'После заявки', en: 'After a request' },
  tools: { ru: 'Уже есть', en: 'In use' },
  owner: { ru: 'Отвечает у вас', en: 'Owner on your side' },
  fears: { ru: 'Опасения', en: 'Worries' },
  budget: { ru: 'Бюджет', en: 'Budget' },
  delivery: { ru: 'Где живёт', en: 'Where it lives' },
  site: { ru: 'Сайт', en: 'Website' },
  theme: { ru: 'Тема', en: 'Theme' },
}

// -------------------------------------------------------- delivery and site

export const deliveryText: Record<DeliveryChannel, Named & { soon?: boolean }> = {
  telegram: n(
    ['Telegram', 'Клиенты пишут агенту в привычном мессенджере, заявки приходят вам туда же'],
    ['Telegram', 'Clients message an agent in a messenger they use, requests reach you there'],
  ),
  widget: n(
    ['Виджет на сайте', 'Окно чата на вашем сайте, сайт у вас уже есть или входит в сборку'],
    ['Site widget', 'A chat window on your site, which you already have or add to the build'],
  ),
  whatsapp: { ...n(['WhatsApp', 'Подключим позже'], ['WhatsApp', 'We will connect it later']), soon: true },
  playground: n(
    ['Площадка Fir Tech', 'Окно агента у нас, в вашем кабинете, и ссылка, чтобы показать его гостям. Встроить на сайт можно позже'],
    ['Fir Tech playground', 'The agent window on our side, in your cabinet, plus a link to show guests. You can embed it on a site later'],
  ),
}

export const deliveryUi = {
  title: { ru: 'Где живёт агент', en: 'Where the agent lives' },
  sub: {
    ru: 'Что делает агент, мы выбрали выше. Здесь выбираете, где клиенты с ним общаются.',
    en: 'What the agent does is set above. Here you choose where clients talk to it.',
  },
  noSiteDiff: {
    ru: 'Telegram: клиенты пишут агенту в мессенджере, заявки приходят вам туда же. Площадка Fir Tech: агент отвечает в окне в вашем кабинете у нас, подходит, если сайта нет и вы хотите сначала увидеть агента в деле.',
    en: 'Telegram: clients message an agent in a messenger and requests reach you there. Fir Tech playground: the agent answers in a window in your cabinet on our side, a fit when you have no site and want to see the agent working first.',
  },
  pickOne: { ru: 'Выберите хотя бы один способ общения', en: 'Pick at least one way to talk to clients' },
}

export const siteNeedText: Record<SiteNeed, Named> = {
  need: n(['Сайт нужен', 'Добавим сайт к агенту: на нём же окно чата'], ['A site is needed', 'We add a site to the agent, with a chat window on it']),
  no: n(['Сайт не нужен', 'Только агент, без сайта'], ['No site needed', 'Just the agent, no site']),
  have: n(['Сайт уже есть', 'Подключим агента к вашему сайту'], ['I have a site', 'We connect the agent to your site']),
}
export const siteNeedUi = {
  title: { ru: 'Нужен ли вам сайт?', en: 'Do you need a website?' },
  sub: {
    ru: 'Агент работает и без сайта. Скажите, как вам удобнее, остальное подстроим.',
    en: 'An agent works without a site. Tell us what suits you and we adapt the rest.',
  },
}

// What each product brings with it: shown pre-selected on the «Состав» step.
export const productIncludes: Record<string, L<string[]>> = {
  adminbot: {
    ru: ['Запись: клиент выбирает услугу, мастера и время', 'Напоминания о визите и рассылка на свободные окна', 'Вопросы об услугах, ценах и адресе без вас'],
    en: ['Booking: the client picks service, master and time', 'Visit reminders and a broadcast for free slots', 'Questions about services, prices and address, answered without you'],
  },
  intake: {
    ru: ['Отвечает на вопросы в любое время', 'Понимает свободные вопросы, а не только кнопки', 'Собирает имя, контакт и суть заявки и передаёт вам'],
    en: ['Answers questions at any hour', 'Understands free-form questions, not only buttons', 'Collects name, contact and the request, then hands it to you'],
  },
  automation: {
    ru: ['Заявки из разных мест попадают в одну таблицу', 'Важные события приходят вам в Telegram', 'Сервисы обмениваются данными без ручного ввода'],
    en: ['Requests from different places land in one sheet', 'Important events reach you in Telegram', 'Services exchange data without manual entry'],
  },
  content: {
    ru: ['План постов на месяц по вашей нише', 'Тексты и картинки готовит агент, вы одобряете', 'Публикация по расписанию, цену называем по смете'],
    en: ['A monthly post plan for your niche', 'The agent drafts texts and images, you approve', 'Scheduled publishing, priced in the quote'],
  },
  miniapp: {
    ru: ['Каталог или запись внутри Telegram', 'Корзина и оплата без выхода из чата', 'Бонусы и повторный заказ в два нажатия'],
    en: ['A catalogue or booking inside Telegram', 'A cart and payment without leaving the chat', 'Bonuses and a reorder in two taps'],
  },
  personal: {
    ru: ['Утренняя сводка, напоминания и вечерний итог в Telegram', 'Помнит людей, привычки и обещания', 'Уровень и цена зависят от сервисов ниже'],
    en: ['Morning brief, reminders and an evening summary in Telegram', 'Remembers people, habits and promises', 'The level and price follow the services below'],
  },
  company: {
    ru: ['Фира-Директор и одна очередь решений для вас', 'Отделы из агентов под ваш бизнес', 'Цена «от», точную сумму фиксируем в смете'],
    en: ['Fira as the Director and one queue of decisions for you', 'Departments of agents for your business', 'A starting price, the exact sum is fixed in the quote'],
  },
  aiteam: {
    ru: ['База знаний из ваших документов', 'Ответы сотрудникам со ссылкой на источник', 'Обучение команды работе с агентами'],
    en: ['A knowledge base from your documents', 'Answers for staff with a source link', 'Team training to work with the agents'],
  },
  site: {
    ru: ['Лендинг: предложение, преимущества, форма заявки', 'Адаптация под телефон и быстрая загрузка', 'Формат можно усилить ниже: сайт компании или магазин'],
    en: ['A landing page: offer, benefits and a request form', 'Phone-friendly and fast', 'You can upgrade the format below to a company site or a shop'],
  },
  bot: {
    ru: ['Агент отвечает на частые вопросы', 'Собирает заявки в чате', 'Передаёт контакты вам'],
    en: ['The agent answers common questions', 'Collects requests in chat', 'Hands the contacts to you'],
  },
  app: {
    ru: ['Веб-приложение, которое ставится на телефон', 'Вход, данные и экраны под вашу задачу', 'Формат можно усилить ниже'],
    en: ['A web app you can install on the phone', 'Login, data and screens for your task', 'You can upgrade the format below'],
  },
}

// ------------------------------------------------------------------- themes

export const themeText: Record<ThemeId, Named> = {
  clinic: n(['Клиника', 'Чисто и спокойно, воздуха много'], ['Clinic', 'Clean, calm and airy']),
  salon: n(['Салон', 'Мягко, красиво, акцент на фото'], ['Salon', 'Soft, pretty, photo first']),
  coffee: n(['Кофейня', 'Тепло и уютно, как у стойки'], ['Coffee shop', 'Warm and cosy, like at the counter']),
  shop: n(['Магазин', 'Карточки товаров и быстрый выбор'], ['Shop', 'Product cards and quick choice']),
  legal: n(['Юристы', 'Строго и надёжно, текст на первом месте'], ['Legal', 'Strict and reliable, text first']),
  it: n(['IT-сервис', 'Сетка, моно и движение, как в продукте'], ['IT service', 'Grid, mono and motion, like a product']),
  fitness: n(['Фитнес', 'Крупно, энергично, ритм движения'], ['Fitness', 'Big, energetic, rhythmic']),
  edu: n(['Образование', 'Дружелюбно, карточки курсов'], ['Education', 'Friendly, course cards']),
  realty: n(['Недвижимость', 'Поиск и объекты, спокойные тона'], ['Real estate', 'Search and listings, calm tones']),
  repair: n(['Ремонт и услуги', 'Прямо и понятно: что, за сколько, когда'], ['Repair and services', 'Plain: what, how much, when']),
}
export const moodText: Record<ThemeMood, Named> = {
  calm: n(['Спокойный', 'Мало движения, много воздуха'], ['Calm', 'Little motion, lots of air']),
  vivid: n(['Яркий', 'Насыщенные цвета и живые кнопки'], ['Vivid', 'Rich colours and lively buttons']),
  premium: n(['Премиум', 'Тёмные тона и плавное появление'], ['Premium', 'Deep tones and slow reveals']),
}
export const motionText = {
  reveal: { fade: { ru: 'проявление', en: 'fade' }, rise: { ru: 'подъём', en: 'rise' }, slide: { ru: 'выезд', en: 'slide' }, scale: { ru: 'масштаб', en: 'scale' } },
  parallax: { none: { ru: 'без параллакса', en: 'no parallax' }, soft: { ru: 'лёгкий параллакс', en: 'soft parallax' }, deep: { ru: 'глубокий параллакс', en: 'deep parallax' } },
  micro: { lift: { ru: 'кнопки поднимаются', en: 'buttons lift' }, press: { ru: 'кнопки нажимаются', en: 'buttons press' }, glow: { ru: 'кнопки светятся', en: 'buttons glow' }, wiggle: { ru: 'кнопки играют', en: 'buttons wiggle' }, none: { ru: 'без эффектов', en: 'no effects' } },
  hero: { photo: { ru: 'первый экран с фото', en: 'photo hero' }, split: { ru: 'текст и картинка', en: 'split hero' }, type: { ru: 'крупный заголовок', en: 'type hero' }, grid: { ru: 'сетка блоков', en: 'grid hero' }, cards: { ru: 'карточки', en: 'cards hero' }, search: { ru: 'поиск', en: 'search hero' } },
}

export const themeUi = {
  title: { ru: 'Какая тема вам ближе?', en: 'Which theme fits you?' },
  sub: {
    ru: 'Тема задаёт цвета, шрифты, форму и движение. Макет рядом меняется сразу. Цену тема не меняет.',
    en: 'A theme sets colours, fonts, shape and motion. The mockup next to it changes at once. A theme never changes the price.',
  },
  moodTitle: { ru: 'Настроение', en: 'Mood' },
  fitsYou: { ru: 'Подходит вам', en: 'Fits you' },
  tune: { ru: 'Тонкая настройка', en: 'Fine tuning' },
  tuneHide: { ru: 'Скрыть тонкую настройку', en: 'Hide fine tuning' },
  tuneSub: { ru: 'Палитра и шрифты внутри выбранной темы', en: 'Palette and fonts inside the chosen theme' },
  reset: { ru: 'Сбросить настройку', en: 'Reset tuning' },
  none: { ru: 'Пока тема не выбрана. Макет показывает нейтральный вид.', en: 'No theme yet. The mockup shows a neutral look.' },
  motion: { ru: 'Движение', en: 'Motion' },
  nearest: { ru: 'ближайшая тема', en: 'closest theme' },
  fontsLabel: { ru: 'Шрифты', en: 'Fonts' },
  paletteLabel: { ru: 'Палитра', en: 'Palette' },
}

// -------------------------------------------------------------- face and steps

export const faceUi = {
  steps: {
    ru: ['Ниша', 'Что делаем', 'Цели', 'Состав', 'Функции', 'Тема', 'Детали', 'Превью'],
    en: ['Niche', 'What we build', 'Goals', 'Set', 'Features', 'Theme', 'Details', 'Preview'],
  } as L<string[]>,
  explainTitle: { ru: 'Соберите проект за пять минут', en: 'Build your project in five minutes' },
  explain: {
    ru: 'За пять минут вы соберёте проект, увидите цену и этапы, получите превью. Дальше мы зададим не больше трёх уточняющих вопросов.',
    en: 'In five minutes you will build a project, see the price and stages, and get a preview. After that we will ask no more than three follow-up questions.',
  },
  nichesTitle: { ru: 'Чем занимается ваш бизнес?', en: 'What does your business do?' },
  popular: { ru: 'Самые частые', en: 'Most common' },
  more: { ru: 'Ещё ниши', en: 'More niches' },
  lessNiches: { ru: 'Свернуть', en: 'Show fewer' },
  moreInCategory: { ru: 'ещё', en: 'more' },
  lessInCategory: { ru: 'меньше', en: 'less' },
  productsTitle: { ru: 'Что делаем', en: 'What we build' },
  productsSub: {
    ru: 'Выберите продукт: что он умеет, зависит от него, а где живёт, выберем на шаге «Состав». Подсказки ниже подобраны под вашу нишу.',
    en: 'Pick a product: what it does comes from it, and where it lives is set on the Set step. Hints below follow your niche.',
  },
  goalsTitle: { ru: 'Чего вы хотите добиться?', en: 'What do you want to achieve?' },
  goalsSub: {
    ru: 'Отметьте результаты, которые важны. Список подобран под ваш продукт и нишу. На цену не влияет.',
    en: 'Tick the outcomes that matter. The list follows your product and niche. It never changes the price.',
  },
  channelsTitle: { ru: 'Где вас ищут клиенты', en: 'Where customers look for you' },
  partsTitle: { ru: 'Что войдёт в проект', en: 'What goes into the project' },
  partsSub: {
    ru: 'Ниже то, что уже входит в выбранные продукты. Отдельные части можно добавить в самом низу.',
    en: 'Below is what the chosen products already include. Extra parts can be added at the very bottom.',
  },
  includedTitle: { ru: 'Уже входит', en: 'Already included' },
  includedNote: { ru: 'Отмечено заранее, снимать не нужно', en: 'Pre-selected, nothing to untick' },
  addPartsTitle: { ru: 'Добавить отдельную часть', en: 'Add a separate part' },
  addPartsOpen: { ru: 'Показать отдельные части', en: 'Show separate parts' },
  addPartsHide: { ru: 'Скрыть отдельные части', en: 'Hide separate parts' },
  featuresTitle: { ru: 'Что ещё добавить', en: 'What else to add' },
  featuresSub: {
    ru: 'Только то, чего ещё нет в составе. Цена каждой функции рядом.',
    en: 'Only what is not in the set yet. The price of each is next to it.',
  },
  featuresEmpty: { ru: 'Для выбранных продуктов дополнительных функций нет: всё нужное уже входит.', en: 'No extra features for the chosen products: everything needed is included.' },
  previewTitle: { ru: 'Ваш проект, каким мы его видим', en: 'Your project as we see it' },
  previewSub: {
    ru: 'Превью собрано из ваших ответов и темы. Если всё так, отправьте проект: мы вернёмся со сметой.',
    en: 'The preview is built from your answers and theme. If it looks right, send the project and we come back with a quote.',
  },
  send: { ru: 'Отправить проект в работу', en: 'Send the project to work' },
  sendDraft: {
    ru: 'Вы вошли, проект на месте. Нажмите «Отправить проект в работу».',
    en: 'You are signed in and the project is here. Press «Send the project to work».',
  },
  sendHint: { ru: 'Нужен вход в аккаунт: так заявка попадёт в ваш кабинет', en: 'Sign-in is needed so the request lands in your cabinet' },
  quoteMore: { ru: 'Смета и этапы оплаты', en: 'Quote and payment stages' },
  required: { ru: 'Обязательно', en: 'Required' },
  next: { ru: 'Дальше', en: 'Next' },
}

// Why «Дальше» is blocked, per reason.
export const issueText: Record<string, L<string>> = {
  kind: { ru: 'Выберите нишу, чтобы продолжить', en: 'Pick a niche to continue' },
  products: { ru: 'Выберите хотя бы один продукт', en: 'Pick at least one product' },
  site: { ru: 'Ответьте, нужен ли вам сайт', en: 'Say whether you need a website' },
  goals: { ru: 'Отметьте хотя бы одну цель', en: 'Tick at least one goal' },
  delivery: { ru: 'Выберите, где клиенты будут общаться с агентом', en: 'Choose where clients will talk to the agent' },
  parts: { ru: 'Выберите хотя бы одну часть', en: 'Pick at least one part' },
  company: { ru: 'Укажите название бизнеса', en: 'Enter the business name' },
  clients: { ru: 'Расскажите, кто ваши клиенты: словами или выберите из списка', en: 'Tell us who your clients are, in words or from the list' },
  owner: { ru: 'Укажите, кто отвечает за проект с вашей стороны', en: 'Say who owns the project on your side' },
  deadline: { ru: 'Выберите, когда нужен запуск', en: 'Choose when you need it live' },
  after: { ru: 'Отметьте, что должно происходить после заявки', en: 'Tick what happens after a request' },
}

// ----------------------------------------------------------------- preview

export const previewUi = {
  tabs: {
    site: { ru: 'Сайт', en: 'Website' },
    agent: { ru: 'Агент', en: 'Agent' },
    playground: { ru: 'Площадка', en: 'Playground' },
    department: { ru: 'Отдел', en: 'Department' },
    miniapp: { ru: 'Mini App', en: 'Mini App' },
    content: { ru: 'Контент', en: 'Content' },
    automation: { ru: 'Процессы', en: 'Processes' },
    personal: { ru: 'Ваш ИИ', en: 'Your AI' },
  },
  concept: { ru: 'Пример по вашим ответам, не финальный дизайн', en: 'An example from your answers, not the final design' },
  live: { ru: 'Отвечает демо-агент для вашей ниши', en: 'A demo agent for your niche is answering' },
  scripted: { ru: 'Демо-ответы по сценарию', en: 'Scripted demo answers' },
  chatPlaceholder: { ru: 'Напишите вопрос клиента', en: 'Type a customer question' },
  chatSend: { ru: 'Отправить', en: 'Send' },
  suggested: { ru: 'Спросите, как клиент', en: 'Ask like a client' },
  typing: { ru: 'печатает', en: 'typing' },
  online: { ru: 'на связи', en: 'online' },
  agentOf: { ru: 'ИИ-администратор', en: 'AI assistant' },
  playgroundTitle: { ru: 'Площадка Fir Tech', en: 'Fir Tech playground' },
  playgroundNote: {
    ru: 'Агент живёт у нас: окно в вашем кабинете и ссылка, чтобы показать гостям. Встроить на сайт можно позже.',
    en: 'The agent lives with us: a window in your cabinet and a link to show guests. You can embed it on a site later.',
  },
  deptTitle: { ru: 'Кто что делает в вашей компании', en: 'Who does what in your company' },
  deptNote: { ru: 'Отдел из агентов: каждый ведёт свой кусок работы, важное согласуют с вами', en: 'A department of agents: each owns a piece of work and important things go through you' },
  you: { ru: 'Вы', en: 'You' },
  youDoes: { ru: 'Одобряете важное и видите отчёт', en: 'Approve what matters and read the report' },
  trust: { propose: { ru: 'готовит, вы решаете', en: 'drafts, you decide' }, auto: { ru: 'делает сам и сообщает', en: 'acts and reports' }, both: { ru: 'рутину сам, деньги с вами', en: 'routine alone, money with you' } },
  miniTitle: { ru: 'Telegram Mini App', en: 'Telegram Mini App' },
  miniAdd: { ru: 'В корзину', en: 'Add' },
  contentTitle: { ru: 'План публикаций на неделю', en: 'Publishing plan for the week' },
  flowTitle: { ru: 'Как данные ходят у вас', en: 'How data moves for you' },
  flow: {
    ru: ['Заявка с сайта или мессенджера', 'Таблица или CRM', 'Сообщение вам в Telegram', 'Сводка в конце недели'],
    en: ['A request from the site or messenger', 'A sheet or CRM', 'A message to you in Telegram', 'A weekly summary'],
  },
  siteSections: { ru: ['Почему выбирают нас', 'Как это работает'], en: ['Why people choose us', 'How it works'] },
  siteMenu: { ru: ['Услуги', 'О нас', 'Контакты'], en: ['Services', 'About', 'Contacts'] },
  delivery: { ru: 'Где живёт', en: 'Where it lives' },
}

// A scripted conversation per demo niche, used when HQ is not reachable. Chips are what a client
// might ask, answers are what the demo persona would say (no prices, nothing the studio promises).
export type DemoNiche = 'salon' | 'clinic' | 'shop' | 'cafe' | 'service' | 'courses'
export const demoNiches: readonly DemoNiche[] = ['salon', 'clinic', 'shop', 'cafe', 'service', 'courses']

type Scripted = { chips: string[]; answers: string[]; fallback: string; greeting: string }
export const scripted: Record<DemoNiche, L<Scripted>> = {
  salon: {
    ru: {
      greeting: 'Здравствуйте! Я ИИ-администратор «{company}». Помогу записаться и отвечу на вопросы.',
      chips: ['Есть окно на субботу?', 'Сколько длится маникюр?', 'Где вы находитесь?'],
      answers: ['В субботу свободно 11:00 и 14:30. Записать вас? Назовите имя и услугу.', 'Классический маникюр занимает около часа. Точное время подскажет мастер при записи.', 'Адрес и карту проезда отправлю сразу после записи. Удобнее утро или вечер?'],
      fallback: 'Хороший вопрос. Уточню у администратора и вернусь с ответом. Оставьте имя и телефон, чтобы мы связались.',
    },
    en: {
      greeting: 'Hello! I am the AI assistant of "{company}". I help with bookings and questions.',
      chips: ['Any slot on Saturday?', 'How long does a manicure take?', 'Where are you?'],
      answers: ['Saturday has 11:00 and 14:30 free. Shall I book you? Tell me your name and the service.', 'A classic manicure takes about an hour. The master confirms the exact time when booking.', 'I will send the address and a map right after booking. Morning or evening works better?'],
      fallback: 'Good question. I will check with the administrator and come back. Leave your name and phone so we can reach you.',
    },
  },
  clinic: {
    ru: {
      greeting: 'Здравствуйте! Я ИИ-администратор «{company}». Помогу записаться на приём.',
      chips: ['Хочу записаться к врачу', 'Нужна ли подготовка?', 'Как добраться?'],
      answers: ['Подскажите, к какому специалисту и в какой день удобно. Предложу свободное время.', 'Подготовка зависит от приёма. Назовите услугу, и я пришлю памятку.', 'Отправлю адрес и ориентиры. Если нужно, напомню о приёме за день.'],
      fallback: 'Этот вопрос лучше задать врачу. Оставьте телефон, и администратор перезвонит.',
    },
    en: {
      greeting: 'Hello! I am the AI assistant of "{company}". I help book appointments.',
      chips: ['I want to book a doctor', 'Is any preparation needed?', 'How do I get there?'],
      answers: ['Tell me the specialist and a convenient day, and I will offer free times.', 'Preparation depends on the visit. Name the service and I will send a leaflet.', 'I will send the address and landmarks, and a reminder a day before.'],
      fallback: 'A doctor is the best person for that. Leave a phone number and the administrator will call back.',
    },
  },
  shop: {
    ru: {
      greeting: 'Здравствуйте! Я ИИ-помощник магазина «{company}». Подскажу по товарам и заказу.',
      chips: ['Есть ли это в наличии?', 'Как оформить доставку?', 'Можно вернуть товар?'],
      answers: ['Назовите товар или пришлите фото, проверю наличие и размеры.', 'Доставка по городу оформляется в заказе. Срок и стоимость покажу до оплаты.', 'Условия возврата зависят от товара. Расскажу, как оформить, и передам менеджеру.'],
      fallback: 'Передам менеджеру, он ответит точнее. Оставьте контакт для связи.',
    },
    en: {
      greeting: 'Hello! I am the shop assistant of "{company}". I help with products and orders.',
      chips: ['Is this in stock?', 'How do I arrange delivery?', 'Can I return an item?'],
      answers: ['Name the item or send a photo and I will check stock and sizes.', 'City delivery is set in the order. I show the term and cost before payment.', 'Return terms depend on the item. I will explain the steps and pass it to a manager.'],
      fallback: 'I will pass this to a manager for a precise answer. Leave a contact so we can reach you.',
    },
  },
  cafe: {
    ru: {
      greeting: 'Здравствуйте! Я ИИ-администратор «{company}». Забронирую стол и расскажу про меню.',
      chips: ['Забронировать стол на вечер', 'Есть ли вегетарианское меню?', 'Во сколько вы работаете?'],
      answers: ['На сколько человек и во сколько? Проверю свободные столы и подтвержу бронь.', 'Да, в меню есть вегетарианские блюда. Могу прислать меню и отметить подходящие.', 'Часы работы отправлю сообщением. Хотите, забронирую столик заранее?'],
      fallback: 'Уточню у администратора. Оставьте телефон, и мы подтвердим всё лично.',
    },
    en: {
      greeting: 'Hello! I am the AI assistant of "{company}". I book tables and tell about the menu.',
      chips: ['Book a table tonight', 'Is there a vegetarian menu?', 'What are your opening hours?'],
      answers: ['For how many people and at what time? I will check free tables and confirm.', 'Yes, the menu has vegetarian dishes. I can send the menu and mark the suitable ones.', 'I will send the hours as a message. Shall I book a table ahead?'],
      fallback: 'I will check with the administrator. Leave a phone number and we confirm in person.',
    },
  },
  service: {
    ru: {
      greeting: 'Здравствуйте! Я ИИ-помощник «{company}». Отвечу на вопросы и приму заявку.',
      chips: ['Сколько это стоит?', 'Когда сможете приехать?', 'Какие у вас гарантии?'],
      answers: ['Цена зависит от задачи. Опишите, что нужно, и я передам расчёт специалисту.', 'Подскажите адрес и удобный день, предложу ближайшее время.', 'Условия гарантии зависят от вида работ. Расскажу, как они прописываются в договоре.'],
      fallback: 'Передам заявку специалисту. Оставьте имя и телефон.',
    },
    en: {
      greeting: 'Hello! I am the assistant of "{company}". I answer questions and take requests.',
      chips: ['How much does it cost?', 'When can you come?', 'What guarantees do you give?'],
      answers: ['The price depends on the task. Describe what you need and I pass it to a specialist for an estimate.', 'Tell me the address and a convenient day and I will offer the nearest time.', 'Warranty terms depend on the work. I will explain how they appear in the contract.'],
      fallback: 'I will pass the request to a specialist. Leave your name and phone.',
    },
  },
  courses: {
    ru: {
      greeting: 'Здравствуйте! Я ИИ-помощник «{company}». Расскажу о занятиях и запишу на пробный урок.',
      chips: ['Есть ли пробный урок?', 'Для какого уровня группа?', 'Как проходят занятия?'],
      answers: ['Да, можно прийти на пробное занятие. Назовите удобный день, предложу время.', 'Подберу группу по уровню. Напишите, чем уже занимались.', 'Занятия идут по расписанию, расскажу формат и длительность перед записью.'],
      fallback: 'Передам менеджеру, он уточнит. Оставьте контакт.',
    },
    en: {
      greeting: 'Hello! I am the assistant of "{company}". I tell about classes and book a trial lesson.',
      chips: ['Is there a trial lesson?', 'What level is the group?', 'How do classes run?'],
      answers: ['Yes, you can attend a trial lesson. Name a day and I will offer a time.', 'I pick a group by level. Tell me what you have studied.', 'Classes follow a schedule. I explain the format and length before you sign up.'],
      fallback: 'I will pass this to a manager to confirm. Leave a contact.',
    },
  },
}

// Preview copy for a department scheme when no better text exists.
export const deptForGoal: Record<string, 'marketing' | 'sales' | 'support' | 'production' | 'backoffice'> = {
  leads: 'sales',
  sales: 'sales',
  moreleads: 'sales',
  leadcollect: 'sales',
  speedlead: 'sales',
  qualify: 'sales',
  followup: 'sales',
  brand: 'marketing',
  regular: 'marketing',
  reels: 'marketing',
  routine: 'backoffice',
  reports: 'backoffice',
  docs: 'backoffice',
  knowledge: 'backoffice',
  weeklysum: 'backoffice',
}

// Three plain steps of "how it works" on the prototype site, per niche block of the catalogue.
export const siteSteps: Record<string, L<[string, string, string]>> = {
  menu: { ru: ['Выбираете блюда', 'Оформляете заказ или бронь', 'Получаете подтверждение'], en: ['Pick dishes', 'Order or book a table', 'Get a confirmation'] },
  booking: { ru: ['Выбираете услугу', 'Выбираете время', 'Получаете напоминание'], en: ['Pick a service', 'Pick a time', 'Get a reminder'] },
  catalog: { ru: ['Выбираете товар', 'Оформляете заказ', 'Получаете доставку'], en: ['Pick an item', 'Place an order', 'Get delivery'] },
  lesson: { ru: ['Оставляете заявку', 'Приходите на пробное занятие', 'Начинаете учиться'], en: ['Leave a request', 'Attend a trial lesson', 'Start learning'] },
  listing: { ru: ['Выбираете объект', 'Смотрите детали', 'Записываетесь на показ'], en: ['Pick a property', 'See the details', 'Book a viewing'] },
  trip: { ru: ['Выбираете направление', 'Согласуете даты', 'Получаете документы'], en: ['Pick a destination', 'Agree on dates', 'Get your documents'] },
  services: { ru: ['Оставляете заявку', 'Получаете расчёт', 'Согласуете и начинаете'], en: ['Leave a request', 'Get an estimate', 'Agree and start'] },
  quote: { ru: ['Описываете задачу', 'Получаете расчёт', 'Подтверждаете заказ'], en: ['Describe the task', 'Get an estimate', 'Confirm the order'] },
  chat: { ru: ['Задаёте вопрос', 'Получаете ответ', 'Оставляете контакт'], en: ['Ask a question', 'Get an answer', 'Leave a contact'] },
}

// ---------------------------------------------------------------- flagships

// Options of the two flagships on the «Состав» step (owner 2026-11-22); ids in lib/builder-ids.ts, rules and
// prices in lib/flagships.ts. Never a typed price here.
export const flagshipText = {
  personal: {
    title: { ru: 'Что подключить к вашему ИИ', en: 'What to connect to your AI' },
    sub: {
      ru: 'Уровень считается сам: до двух сервисов «Старт», три-четыре или голос «Плюс», пять и больше или долгая память «Максимум».',
      en: 'The level follows your picks: up to two services is Start, three or four or the voice is Plus, five or more or the long memory is Max.',
    },
    services: { ru: 'Сервисы', en: 'Services' },
    extras: { ru: 'Возможности', en: 'Abilities' },
    level: { ru: 'Ваш уровень', en: 'Your level' },
  },
  company: {
    title: { ru: 'Из чего собрать вашу ИИ-компанию', en: 'What your AI company is made of' },
    sub: {
      ru: 'Отделы и части записываем в смету. Здесь видна цена «от», точную сумму назовём после разбора.',
      en: 'Departments and parts go into the quote. Here you see the starting price, the exact sum comes after a review.',
    },
    depts: { ru: 'Отделы', en: 'Departments' },
    parts: { ru: 'Части', en: 'Parts' },
    from: { ru: 'Цена от', en: 'Price from' },
  },
  options: {
    mail: n(['Почта', 'Разбор писем и черновики ответов'], ['Mail', 'Sorting emails and reply drafts']),
    calendar: n(['Календарь', 'Встречи, окна и напоминания'], ['Calendar', 'Meetings, free slots and reminders']),
    tasks: n(['Задачи', 'Дела и обещания в одном списке'], ['Tasks', 'To-dos and promises in one list']),
    study: n(['Учёба', 'Сроки из учебной системы и уроки языка'], ['Study', 'Deadlines from the study system and language lessons']),
    notes: n(['Заметки', 'Идеи и записи по команде'], ['Notes', 'Ideas and notes on command']),
    messengers: n(['Мессенджеры', 'Сообщения, на которые нужно ответить'], ['Messengers', 'Messages that need a reply']),
    voice: n(['Голос', 'Голосовые сообщения и ответы голосом'], ['Voice', 'Voice messages and spoken replies']),
    memory: n(['Долгая память', 'Помнит людей, привычки и обещания месяцами'], ['Long memory', 'Remembers people, habits and promises for months']),
    sales: n(['Продажи', 'Заявки, КП и напоминания клиентам'], ['Sales', 'Leads, proposals and client reminders']),
    marketing: n(['Маркетинг', 'Контент по плану и аналитика'], ['Marketing', 'Planned content and analytics']),
    support: n(['Поддержка', 'Ответы клиентам по базе знаний'], ['Support', 'Answers to clients from the knowledge base']),
    production: n(['Производство', 'Проекты, этапы и сроки'], ['Production', 'Projects, stages and deadlines']),
    backoffice: n(['Бэк-офис', 'Счета, документы и отчёты'], ['Back office', 'Invoices, documents and reports']),
    pult: n(['Пульт', 'Офис, ревью-центр и поручения'], ['Control room', 'Office, review centre and assignments']),
    knowledge: n(['База знаний', 'Из ваших документов, сайта и переписок'], ['Knowledge base', 'From your documents, site and chats']),
    channels: n(['Клиентские каналы', 'Telegram и чат на сайте, другие по смете'], ['Client channels', 'Telegram and the site chat, others in the quote']),
    training: n(['Обучение команды', 'Занятия и регламенты для сотрудников'], ['Team training', 'Sessions and rules for your staff']),
  } satisfies Record<string, Named>,
  levels: {
    basic: { ru: 'Старт', en: 'Start' },
    plus: { ru: 'Плюс', en: 'Plus' },
    max: { ru: 'Максимум', en: 'Max' },
  },
  perMonth: { ru: '/мес', en: '/mo' },
  byQuote: { ru: 'точная сумма по смете', en: 'exact sum in the quote' },
  previewTitle: { ru: 'Утренняя сводка вашего ИИ', en: 'Your AI’s morning brief' },
  previewRows: {
    mail: { ru: 'Два письма ждут ответа', en: 'Two emails wait for a reply' },
    calendar: { ru: 'Созвон в 11:00', en: 'Call at 11:00' },
    tasks: { ru: 'Три дела на сегодня', en: 'Three tasks for today' },
    study: { ru: 'Задание сдать в среду', en: 'Assignment due on Wednesday' },
    notes: { ru: 'Идея из вчерашней заметки', en: 'An idea from yesterday’s note' },
    messengers: { ru: 'Четыре сообщения ждут вас', en: 'Four messages wait for you' },
    voice: { ru: 'Можно ответить голосом', en: 'You can reply by voice' },
    memory: { ru: 'Вы обещали Азизу прайс до среды', en: 'You promised Aziz the price list by Wednesday' },
  },
} as const
