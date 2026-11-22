import { mockBuilderUrl, MOCK_ESTIMATES, MOCK_MESSAGES } from './pult-mock'
import { REVIEW_DEPT_IDS, TREND_STATUSES, trendUrlProblem } from './review'

// Dev stand-in for HQ's review centre, chats and trend links (contract «Ревью-центр», 2026-11-21).
// Same shapes as HQ, state in memory (wired into hq-admin-mock.ts). Media paths are real-looking
// `/admin/files/...` paths: in development the file proxy answers PNG with an SVG placeholder and
// has no MP4, so the video items carry a PNG `poster` the player falls back to.

type Row = Record<string, unknown>
type Json = Record<string, unknown>
export type ReviewMockReply = { ok: true; [k: string]: unknown } | { ok: false; error: string; [k: string]: unknown }

const bad = (error: string, extra: Row = {}): ReviewMockReply => ({ ok: false, error, ...extra })
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const str = (v: unknown) => (typeof v === 'string' ? v : '')

type Item = {
  id: string
  kind: string
  dept: string
  createdAt: string
  status: 'pending' | 'approved' | 'rejected' | 'published' | 'failed'
  title: string
  summary: string
  media: Row[]
  text: Row
  meta: Row
  versions: Row[]
  currentVersion: number
  parentId: string | null
  taskId: number | null
  error: string | null
}

const EDITABLE = ['content_item', 'lead_reply', 'lead_price', 'support_answer', 'support_money', 'bo_document', 'billing_invoice', 'billing_reminder', 'onboarding_guide', 'pm_spec', 'pm_client_status']
const SENDABLE = ['lead_reply', 'lead_price', 'support_answer', 'support_money', 'audit']

// The `actions` rules of the contract, in its order.
export function mockActions(it: Pick<Item, 'kind' | 'status' | 'media' | 'meta'>): string[] {
  const pending = it.status === 'pending'
  const out: string[] = []
  const isItem = it.kind === 'content_item'
  const profile = it.meta.format === 'profile'
  if (pending) out.push('approve')
  // Pending items with a text, and approved documents the client has not acted on yet (HQ's `editApproved`).
  if ((pending && (EDITABLE.includes(it.kind) || it.kind === 'presales_pack')) || (it.status === 'approved' && it.meta.editApproved === true)) out.push('edit')
  if (pending && ((isItem && !profile) || it.kind === 'article')) out.push('revise')
  if (pending) out.push('reject')
  const reel = it.meta.format === 'reel'
  if (!profile && (it.kind === 'article' ? pending : isItem && ((pending && !reel) || (['approved', 'failed'].includes(it.status) && it.media.length)))) out.push('publish_now')
  if (isItem && ['pending', 'approved', 'failed'].includes(it.status)) out.push('reschedule')
  if (pending && SENDABLE.includes(it.kind)) out.push('send')
  if (it.meta.lead) out.push('call')
  return out
}

const PACK_KP = '## Коммерческое предложение\n\nTelegram-бот для записи клиентов: меню, напоминания, оплата. Срок 10 дней, стоимость **$600** в два этапа.'

export function createReviewMock(start = Date.now()) {
  const iso = (t: number) => new Date(t).toISOString()
  const ago = (min: number) => iso(start - min * 60_000)
  const day = (d: number) => iso(start + d * 86_400_000).slice(0, 10)
  const png = (path: string, w = 1080, h = 1350): Row => ({ type: 'image', url: `/admin/files/${path}`, poster: null, w, h, durationS: null })

  const ver = (v: number, minutes: number, text: Row, note: string, author: 'owner' | 'worker', media: Row[] = []): Row => ({ v, createdAt: ago(minutes), text, media, note, author })

  const reelText = {
    body: 'Хук: «2 ночи, клиент пишет, а бот молчит».\nКадр 1: телефон на тумбочке, приходит сообщение.\nКадр 2: бот отвечает за 3 секунды и записывает на утро.\nФиналка: «Бот на связи, пока вы спите».',
    draft: 'Instagram: Запись ночью. Клиент пишет в 2:00, бот отвечает и записывает.\nTikTok: Бот записывает клиентов, пока вы спите.\nShorts: Ночной бот для записи.',
    caption: 'Клиент пишет в 2 ночи. Бот отвечает за 3 секунды и записывает на утро. Утром вы просто открываете расписание.',
    hashtags: ['#fir', '#телеграмбот', '#автоматизация'],
    captions: { instagram: 'Клиент пишет в 2 ночи. Бот отвечает за 3 секунды.\n\n#fir #телеграмбот #автоматизация', tiktok: 'Бот записывает клиентов, пока вы спите #бот #бизнес', shorts: 'Ночной бот для записи клиентов #shorts' },
  }
  const reelV1 = { ...reelText, caption: 'Клиент пишет в 2 ночи, а бот отвечает за 3 секунды.' }

  const items: Item[] = [
    {
      id: 'ap_201', kind: 'content_item', dept: 'marketing', createdAt: ago(35), status: 'pending',
      title: 'Запись ночью', summary: 'Клиент пишет в 2 ночи, а бот отвечает',
      media: [{ type: 'video', url: '/admin/files/41/reel.mp4', poster: '/admin/files/41/cover.png', w: 1080, h: 1920, durationS: 28 }],
      text: reelText,
      meta: { slot: day(2), plannedDate: day(2), platform: 'instagram', platforms: ['instagram', 'tiktok', 'shorts'], format: 'reel', itemId: 41, source: 'routine', render: { state: 'ready' } },
      versions: [ver(1, 35, reelV1, '', 'worker'), ver(2, 20, reelText, 'владелец', 'owner')],
      currentVersion: 2, parentId: null, taskId: 77, error: null,
    },
    {
      id: 'ap_202', kind: 'content_item', dept: 'marketing', createdAt: ago(80), status: 'pending',
      title: 'Три ошибки сайта барбершопа', summary: 'Карусель: что отпугивает клиентов',
      media: [png('42/slide-1.png'), png('42/slide-2.png'), png('42/slide-3.png')],
      text: {
        body: 'Слайд 1: Три ошибки сайта барбершопа.\nСлайд 2: Нет кнопки записи на первом экране.\nСлайд 3: Цены только на фото.',
        draft: 'Instagram: Три ошибки сайта барбершопа...',
        caption: 'Три ошибки, из-за которых барбершопу не пишут с сайта. Сохраните, чтобы проверить свой.',
        hashtags: ['#fir', '#сайт', '#барбершоп'],
        captions: { instagram: 'Три ошибки, из-за которых барбершопу не пишут с сайта.\n\n#fir #сайт #барбершоп' },
      },
      meta: { slot: day(3), plannedDate: day(3), platform: 'instagram', platforms: ['instagram'], format: 'carousel', itemId: 42, source: 'routine', render: { state: 'ready' } },
      versions: [
        ver(1, 80, { caption: 'Три ошибки сайта барбершопа.', hashtags: ['#fir'], body: 'Слайд 1: Три ошибки.\nСлайд 2: Нет кнопки записи.' }, '', 'worker'),
        ver(2, 50, { caption: 'Три ошибки, из-за которых барбершопу не пишут с сайта. Сохраните, чтобы проверить свой.', hashtags: ['#fir', '#сайт', '#барбершоп'], body: 'Слайд 1: Три ошибки сайта барбершопа.\nСлайд 2: Нет кнопки записи на первом экране.\nСлайд 3: Цены только на фото.' }, 'владелец: добавь третий слайд', 'owner'),
      ],
      currentVersion: 2, parentId: null, taskId: 78, error: null,
    },
    {
      id: 'ap_203', kind: 'content_item', dept: 'marketing', createdAt: ago(130), status: 'pending',
      title: 'Бот вместо администратора', summary: 'По ссылке владельца: рилс про ответ за секунды',
      media: [],
      text: {
        body: 'Хук: «Администратор спит, а запись идёт».\nСтруктура: проблема, 3 секунды ответа, результат.',
        draft: 'Instagram: Администратор спит, а запись идёт.',
        caption: 'Администратор спит, а запись идёт. Бот отвечает за 3 секунды.',
        hashtags: ['#fir', '#бот'],
        captions: { instagram: 'Администратор спит, а запись идёт.\n\n#fir #бот', tiktok: 'Администратор спит, а запись идёт #бот', shorts: 'Бот вместо администратора #shorts' },
      },
      meta: { slot: day(4), plannedDate: day(4), platform: 'instagram', platforms: ['instagram', 'tiktok', 'shorts'], format: 'reel', itemId: 57, source: 'owner_link', render: { state: 'none' }, link: { id: 3, url: 'https://www.youtube.com/shorts/xyz789', note: 'такой темп монтажа' } },
      versions: [ver(1, 130, { caption: 'Администратор спит, а запись идёт. Бот отвечает за 3 секунды.' }, 'Формат: вертикальный рилс 25 секунд. Хук: контраст «спит / запись идёт». Структура: проблема, ответ за 3 секунды, результат. Почему работает: узнаваемая боль и быстрый ритм. Аналог для Fir Tech: бот вместо ночного администратора.', 'worker')],
      currentVersion: 1, parentId: null, taskId: 91, error: null,
    },
    {
      id: 'ap_204', kind: 'lead_reply', dept: 'sales', createdAt: ago(25), status: 'pending',
      title: 'Ответ Нигине', summary: 'Бот для записи в салон: сроки и вопросы',
      media: [],
      text: { draft: 'Здравствуйте, Нигина! Бот для записи в салон делаем за 5-7 дней. Чтобы назвать точную цену, уточню два момента: сколько мастеров и нужны ли напоминания клиентам за день? Если удобно, созвонимся завтра.', body: 'Здравствуйте, Нигина! Бот для записи в салон делаем за 5-7 дней. Чтобы назвать точную цену, уточню два момента: сколько мастеров и нужны ли напоминания клиентам за день? Если удобно, созвонимся завтра.' },
      meta: { lead: { id: 7, name: 'Нигина', contact: '@nigina_beauty', service: 'bot', budget: '300-500', stage: 'new', source: 'site', temperature: 'hot', taskId: 90, callAt: null, cabinet: false, message: MOCK_MESSAGES[7], estimate: MOCK_ESTIMATES[7], builderUrl: mockBuilderUrl(7) }, client: { id: null, email: null, cabinet: false }, delivery: 'telegram' },
      versions: [ver(1, 25, { draft: 'Здравствуйте, Нигина! Бот делаем за 5-7 дней. Уточню детали.' }, '', 'worker')],
      currentVersion: 1, parentId: null, taskId: 90, error: null,
    },
    {
      id: 'ap_205', kind: 'lead_price', dept: 'sales', createdAt: ago(200), status: 'pending',
      title: 'Цена для Фарруха', summary: 'Сайт автосервиса с записью',
      media: [],
      text: { draft: 'Фаррух, сайт автосервиса с онлайн-записью выйдет от $650. Срок 10 дней. Счёт за этап 1 [сумма этапа], следующие после приёмки.', body: 'Фаррух, сайт автосервиса с онлайн-записью выйдет от $650. Срок 10 дней. Счёт за этап 1 [сумма этапа], следующие после приёмки.' },
      meta: { lead: { id: 6, name: 'Фаррух', contact: '+992 90 111 22 33', service: 'site', budget: '', stage: 'qualified', source: 'telegram', temperature: 'warm', taskId: 80, callAt: null, cabinet: false, message: MOCK_MESSAGES[6], estimate: MOCK_ESTIMATES[6], builderUrl: mockBuilderUrl(6) }, client: { id: null, email: null, cabinet: false }, delivery: 'owner' },
      versions: [ver(1, 200, { draft: 'Фаррух, сайт автосервиса от $650.' }, '', 'worker')],
      currentVersion: 1, parentId: null, taskId: 80, error: null,
    },
    {
      id: 'ap_206', kind: 'support_answer', dept: 'support', createdAt: ago(45), status: 'pending',
      title: 'Ответ на тикет: как поменять тексты', summary: 'Клиент просит поменять часы работы на сайте',
      media: [],
      text: { draft: 'Здравствуйте! Часы работы поменяли, обновление появится на сайте в течение пяти минут. Если что-то осталось прежним, очистите кэш браузера и напишите нам.', body: 'Здравствуйте! Часы работы поменяли, обновление появится на сайте в течение пяти минут. Если что-то осталось прежним, очистите кэш браузера и напишите нам.' },
      meta: { ticket: { id: 4, clientName: 'Алиса', contact: '@alice', status: 'open', money: false, question: 'Поменяйте часы работы: теперь с 9 до 21.', createdAt: ago(300), answeredAt: null }, lead: null, client: { id: 1, email: 'alice@example.com', cabinet: true }, delivery: 'telegram' },
      versions: [ver(1, 45, { draft: 'Часы работы поменяли.' }, '', 'worker')],
      currentVersion: 1, parentId: null, taskId: 85, error: null,
    },
    {
      id: 'ap_207', kind: 'billing_invoice', dept: 'backoffice', createdAt: ago(300), status: 'pending',
      title: 'Счёт Sadaf Clinic', summary: 'Сайт и бот, этап 1',
      media: [],
      text: { draft: 'Счёт FT-2026-007\nКлиент: Sadaf Clinic\nЗа что: сайт и бот, этап 1\nСумма: $600\nСрок оплаты: через 3 дня\nОплата: USDT (TRC20 или TON).', body: 'Счёт FT-2026-007\nКлиент: Sadaf Clinic\nЗа что: сайт и бот, этап 1\nСумма: $600\nСрок оплаты: через 3 дня\nОплата: USDT (TRC20 или TON).' },
      meta: { invoice: { id: 7, number: 'FT-2026-007', client: 'Sadaf Clinic', amountUsd: 600, dueDate: day(3), status: 'draft', what: 'Сайт и бот, этап 1', leadId: 4, projectId: 4 }, lead: { id: 4, name: 'Sadaf Clinic', contact: 'hello@sadaf.example', service: 'site', budget: '1000+', stage: 'contract', source: 'ref', temperature: 'warm', taskId: 70, callAt: null, cabinet: false, message: MOCK_MESSAGES[4], estimate: MOCK_ESTIMATES[4], builderUrl: mockBuilderUrl(4) }, client: { id: null, email: null, cabinet: false } },
      versions: [ver(1, 300, { draft: 'Счёт FT-2026-007, $600.' }, '', 'worker')],
      currentVersion: 1, parentId: null, taskId: 70, error: null,
    },
    {
      id: 'ap_208', kind: 'article', dept: 'marketing', createdAt: ago(400), status: 'pending',
      title: 'Бот для записи: что он берёт на себя', summary: 'Статья в блог, ниша салонов красоты',
      media: [],
      text: {
        subject: 'Бот для записи: что он берёт на себя',
        body: '## Зачем салону бот\n\nАдминистратор не отвечает ночью и в выходные. Бот отвечает **за 3 секунды** и записывает на свободное время.\n\n### Что он делает\n\n- принимает запись и переносы\n- напоминает клиенту за день\n- передаёт сложные вопросы администратору\n\n> Бот не заменяет человека, он забирает рутину.\n\n| Задача | Бот | Человек |\n|---|---|---|\n| Запись | да | по желанию |\n| Скидки | нет | да |',
        draft: 'Администратор не отвечает ночью и в выходные. Бот отвечает за 3 секунды и записывает на свободное время.',
      },
      meta: { platform: 'blog', article: { id: 5, niche: 'beauty', line: 'niche', slug: 'bot-dlya-zapisi' }, url: null, source: 'routine' },
      versions: [ver(1, 400, { subject: 'Бот для записи', body: 'Черновик.' }, '', 'worker')],
      currentVersion: 1, parentId: null, taskId: 60, error: null,
    },
    {
      id: 'ap_209', kind: 'presales_pack', dept: 'sales', createdAt: ago(70), status: 'pending',
      title: 'КП: Боб, Telegram-бот для записи', summary: 'Пакет: КП, смета, договор (черновик)',
      media: [],
      text: {
        body: PACK_KP,
        documents: [
          { id: 31, key: 'kp', title: 'Коммерческое предложение', body: PACK_KP },
          { id: 32, key: 'estimate', title: 'Смета', body: '## Смета\n\n| Этап | Что входит | Сумма |\n|---|---|---|\n| 1 | Меню и запись | $300 |\n| 2 | Напоминания и оплата | $300 |\n\nИтого: **$600**.' },
          { id: 33, key: 'contract', title: 'Договор (черновик)', body: '## Договор на разработку Telegram-бота\n\n1. Предмет договора.\n2. Стоимость и порядок оплаты по этапам.\n3. Сроки и приёмка этапов.\n4. Ответственность сторон.' },
        ],
      },
      meta: { lead: { id: 2, name: 'Боб', contact: '@bob', service: 'bot', budget: '600', stage: 'proposal', source: 'telegram', temperature: 'warm', taskId: 42, callAt: null, cabinet: false, message: MOCK_MESSAGES[5], estimate: MOCK_ESTIMATES[5], builderUrl: mockBuilderUrl(5) }, client: { id: null, email: null, cabinet: false }, pack: { id: 4, documentIds: [31, 32, 33], direction: 'bot', totalUsd: 600, prepayUsd: 180, prepayPercent: 30, stages: null, timeline: '10 дней' } },
      versions: [ver(1, 70, { body: PACK_KP }, '', 'worker')],
      currentVersion: 1, parentId: null, taskId: 42, error: null,
    },
    {
      id: 'ap_210', kind: 'bo_document', dept: 'backoffice', createdAt: ago(60 * 50), status: 'approved',
      title: 'Документ contract: Алиса, версия 1', summary: 'Договор на разработку сайта (одобрен, клиент ещё не подписал)',
      media: [],
      text: { draft: '## Договор на разработку сайта\n\n1. Исполнитель обязуется разработать сайт для Заказчика.\n2. Оплата по этапам: 30 / 40 / 30.\n3. Срок: 10 рабочих дней с оплаты первого этапа.', body: '## Договор на разработку сайта\n\n1. Исполнитель обязуется разработать сайт для Заказчика.\n2. Оплата по этапам: 30 / 40 / 30.\n3. Срок: 10 рабочих дней с оплаты первого этапа.' },
      meta: { document: { id: 2, type: 'contract', client: 'Алиса', version: 1, projectId: 2 }, editApproved: true },
      versions: [ver(1, 60 * 50, { draft: 'Договор на разработку сайта.' }, '', 'worker')],
      currentVersion: 1, parentId: null, taskId: 71, error: null,
    },
    {
      id: 'ap_199', kind: 'content_item', dept: 'marketing', createdAt: ago(60 * 26), status: 'published',
      title: 'Сайт за 10 дней', summary: 'Пост: как проходит работа над сайтом',
      media: [png('39/post.png')],
      text: { caption: 'Сайт за 10 дней: бриф, прототип, сдача.', hashtags: ['#fir'], body: 'Пост.' },
      meta: { slot: day(-1), platform: 'instagram', platforms: ['instagram'], format: 'post', itemId: 39, source: 'routine', render: { state: 'ready' }, publishedOn: ['instagram'], publishedUrl: 'https://www.instagram.com/p/demo/' },
      versions: [ver(1, 60 * 26, { caption: 'Сайт за 10 дней: бриф, прототип, сдача.' }, '', 'worker')],
      currentVersion: 1, parentId: null, taskId: 50, error: null,
    },
  ]

  const view = (it: Item): Row => ({ ...clone(it), actions: mockActions(it) })
  const counts = () => Object.fromEntries(REVIEW_DEPT_IDS.map((d) => [d, items.filter((i) => i.dept === d && i.status === 'pending').length]))
  const find = (id: string) => items.find((i) => i.id === id)

  // ---- trends ----
  const trends: Row[] = [
    { id: 3, url: 'https://www.youtube.com/shorts/xyz789', host: 'www.youtube.com', platform: 'youtube', note: 'такой темп монтажа', status: 'proposed', error: null, createdAt: ago(140), updatedAt: ago(130), taskId: 91, analysis: { format: 'вертикальный рилс', hook: 'контраст', structure: ['проблема', 'ответ', 'результат'], whyItWorks: 'узнаваемая боль', numbers: null, analogue: { type: 'clip', topic: 'бот вместо администратора', angle: 'ночь' } }, reviewId: 'ap_203', itemId: 57 },
    { id: 4, url: 'https://www.tiktok.com/@demo/video/7301', host: 'www.tiktok.com', platform: 'tiktok', note: '', status: 'analysing', error: null, createdAt: ago(6), updatedAt: ago(6), taskId: 95, analysis: null, reviewId: null, itemId: null },
  ]

  // ---- chats ----
  type Msg = { id: string; at: string; from: 'client' | 'hq' | 'owner'; channel: string; thread: string; text: string; attachments: Row[] }
  const threads: Row[] = [
    { id: 'c3', client: { id: 3, name: 'Анна', email: 'anna@example.com', contact: '@anna' }, channels: ['cabinet', 'telegram'], lastAt: ago(12), unread: 1, preview: 'Когда будет готов макет?', leadId: 12, ticketId: null, textsStored: true, openTicket: false },
    { id: 't4', client: { id: null, name: 'Фаррух', email: null, contact: '+992 90 111 22 33' }, channels: ['telegram'], lastAt: ago(60 * 5), unread: 0, preview: 'Спасибо, вижу обновление.', leadId: 6, ticketId: 4, textsStored: true, openTicket: true },
    { id: 'w7f3', client: { id: null, name: 'Посетитель сайта', email: null, contact: '' }, channels: ['web'], lastAt: ago(60 * 30), unread: 0, preview: 'Спрашивал про цену бота и сроки (сводка)', leadId: null, ticketId: null, textsStored: false, openTicket: false },
  ]
  const messages = new Map<string, Msg[]>([
    ['c3', [
      { id: 'lead_12', at: ago(60 * 48), from: 'client', channel: 'web', thread: 'lead', text: 'Здравствуйте! Нужен сайт для студии йоги, есть логотип и фото.', attachments: [] },
      { id: 'rp_4', at: ago(60 * 47), from: 'hq', channel: 'telegram', thread: 'lead', text: 'Здравствуйте, Анна! Сайт для студии делаем за 10 дней. Пришлите, пожалуйста, ссылки на фото.', attachments: [] },
      { id: 'cab_21', at: ago(60 * 20), from: 'client', channel: 'cabinet', thread: 'lead', text: 'Фото загрузила в кабинет. Нужно ли расписание на сайте?', attachments: [] },
      { id: 'ow_3', at: ago(60 * 19), from: 'owner', channel: 'cabinet', thread: 'lead', text: 'Да, добавим расписание с записью на занятия.', attachments: [] },
      { id: 'cab_22', at: ago(12), from: 'client', channel: 'cabinet', thread: 'project-4', text: 'Когда будет готов макет?', attachments: [] },
    ]],
    ['t4', [
      { id: 'tk_4_q', at: ago(300), from: 'client', channel: 'telegram', thread: 'lead', text: 'Поменяйте часы работы: теперь с 9 до 21.', attachments: [] },
      { id: 'tk_4_a', at: ago(240), from: 'hq', channel: 'telegram', thread: 'lead', text: 'Готово, обновление на сайте через пять минут.', attachments: [] },
      { id: 'cab_30', at: ago(60 * 5), from: 'client', channel: 'telegram', thread: 'lead', text: 'Спасибо, вижу обновление.', attachments: [] },
    ]],
    ['w7f3', []],
  ])
  const thread = (id: string): Row | undefined => {
    const alias = /^l(\d+)$/.exec(id)
    if (alias) return threads.find((t) => String(t.leadId) === alias[1])
    return threads.find((t) => t.id === id)
  }
  // The cabinet threads a reply can land in (the mock's client 3 has a lead thread, support and a project).
  const replyThreads = (t: Row): string[] => (t.id === 'c3' ? ['lead', 'support', 'project-4'] : [])
  let nextMsg = 100
  let nextTrend = 5

  return function handle(method: 'GET' | 'POST', seg: string[], q: Record<string, string>, body: Json, now: number): ReviewMockReply | null {
    // ---- review ----
    if (seg[0] === 'review') {
      if (method === 'GET' && seg.length === 1) {
        const dept = q.dept ?? 'all'
        const status = q.status ?? 'pending'
        if (![...REVIEW_DEPT_IDS, 'all'].includes(dept as never)) return bad('invalid', { hint: 'dept', allowed: [...REVIEW_DEPT_IDS, 'all'] })
        if (!['pending', 'decided', 'all'].includes(status)) return bad('invalid', { hint: 'status', allowed: ['pending', 'decided', 'all'] })
        const limit = Math.min(200, Math.max(1, Number(q.limit) || 50))
        let list = [...items].sort((a, b) => Number(b.id.slice(3)) - Number(a.id.slice(3)))
        if (dept !== 'all') list = list.filter((i) => i.dept === dept)
        if (status === 'pending') list = list.filter((i) => i.status === 'pending')
        if (status === 'decided') list = list.filter((i) => i.status !== 'pending')
        return { ok: true, items: list.slice(0, limit).map(view), counts: counts(), nextCursor: null }
      }
      if (method === 'POST' && seg.length === 2) {
        const it = find(seg[1]!)
        if (!it) return bad('not_found')
        const action = str(body.action)
        const allowed = mockActions(it)
        const text = (body.text ?? null) as Row | null
        if (action === 'edit' && (!text || !Object.keys(text).length)) return bad('invalid', { allowed: ['text'] })
        if (action === 'revise' && !str(body.note).trim()) return bad('invalid', { allowed: ['note'] })
        if (['reschedule', 'call'].includes(action) && !str(body.slot).trim()) return bad('invalid', { hint: 'slot' })
        if (action === 'approve' && ['approved', 'published'].includes(it.status)) return { ok: true, item: view(it) }
        if (action === 'reject' && it.status === 'rejected') return { ok: true, item: view(it) }
        if (['approve', 'reject'].includes(action) && it.status === 'failed') return bad('not_pending', { status: it.status })
        if (['approve', 'reject'].includes(action) && it.status !== 'pending') return bad('already_decided', { status: it.status })
        if (['edit', 'revise', 'send'].includes(action) && it.status !== 'pending' && !(action === 'edit' && it.meta.editApproved === true && it.status === 'approved')) return bad('not_pending', { status: it.status })
        if (!allowed.includes(action)) return bad('not_applicable', { status: it.status, actions: allowed })
        switch (action) {
          case 'approve':
            it.status = 'approved'
            if (it.kind === 'content_item') it.meta.render = { state: 'rendering' }
            return { ok: true, item: view(it) }
          case 'reject':
            it.status = 'rejected'
            return { ok: true, item: view(it) }
          case 'edit': {
            const t = text as Row
            // A КП pack edits one document at a time: `doc` names it, `text.draft` is the new text.
            if (it.kind === 'presales_pack') {
              const docKey = str(body.doc)
              if (!['kp', 'estimate', 'contract'].includes(docKey) || typeof t.draft !== 'string' || !t.draft.trim()) return bad('invalid', { hint: 'doc is required for a КП pack: kp, estimate or contract' })
              const docs = (it.text.documents as Row[] | undefined) ?? []
              const target = docs.find((d) => d.key === docKey)
              if (!target || target.body === t.draft) return bad('not_applied', { reason: 'текст не изменился' })
              const beforePack = clone(it.text)
              target.body = t.draft
              if (docKey === 'kp') it.text.body = t.draft
              const vp = it.currentVersion + 1
              if (it.versions.length === 1 && it.versions[0]!.v === 1) it.versions[0]!.text = beforePack
              it.versions.push({ v: vp, createdAt: iso(now), text: clone(it.text), media: [], note: `владелец (${docKey})`, author: 'owner' })
              it.currentVersion = vp
              return { ok: true, item: view(it) }
            }
            const before = clone(it.text)
            const next = { ...it.text }
            for (const k of ['draft', 'body', 'caption', 'hashtags'] as const) if (t[k] !== undefined) next[k] = t[k]
            if (t.captions) next.captions = { ...(it.text.captions as Row | undefined), ...(t.captions as Row) }
            if (it.kind !== 'content_item' && t.draft !== undefined) next.body = t.draft
            if (JSON.stringify(next) === JSON.stringify(before)) return bad('not_applied', { reason: 'текст не изменился' })
            it.text = next
            const v = it.currentVersion + 1
            if (it.versions.length === 1 && it.versions[0]!.v === 1) it.versions[0]!.text = before
            it.versions.push({ v, createdAt: iso(now), text: clone(next), media: [], note: body.note ? `владелец: ${str(body.note)}` : 'владелец', author: 'owner' })
            it.currentVersion = v
            return { ok: true, item: view(it) }
          }
          case 'revise':
            if (it.kind === 'article') {
              it.status = 'rejected'
              return { ok: true, state: 'revising', item: view(it) }
            }
            it.meta.revision = { taskId: 300 + Math.floor(now / 1000) % 100, state: 'working', reviewId: null }
            return { ok: true, state: 'revising', taskId: (it.meta.revision as Row).taskId, item: view(it) }
          case 'reschedule': {
            const day10 = str(body.slot).slice(0, 10)
            if (!/^\d{4}-\d{2}-\d{2}$/.test(day10)) return bad('invalid', { hint: 'slot: YYYY-MM-DD' })
            it.meta.slot = day10
            it.meta.plannedDate = day10
            return { ok: true, item: view(it) }
          }
          case 'send': {
            const draft = typeof text?.draft === 'string' ? text.draft : str(it.text.draft)
            const holes = draft.match(/\[[^\]]{1,60}\]/g)
            if (holes && ['lead_price', 'support_money', 'support_answer'].includes(it.kind)) return bad('placeholder', { placeholders: holes })
            if (text?.draft && text.draft !== it.text.draft) {
              it.text = { ...it.text, draft: text.draft, body: text.draft }
              it.versions.push({ v: it.currentVersion + 1, createdAt: iso(now), text: clone(it.text), media: [], note: 'владелец', author: 'owner' })
              it.currentVersion += 1
            }
            it.status = 'approved'
            const via = it.meta.delivery === 'owner' ? 'owner' : 'telegram'
            return { ok: true, state: via === 'owner' ? 'handed_off' : 'sent', via, item: view(it) }
          }
          case 'call': {
            const slot = str(body.slot)
            if (Number.isNaN(Date.parse(slot)) || !slot.includes('T')) return bad('invalid', { hint: 'ISO дата со временем' })
            return { ok: true, callAt: slot, item: view(it) }
          }
          case 'publish_now': {
            if (it.status === 'pending') it.status = 'approved'
            if (it.kind === 'article') {
              it.status = 'published'
              it.meta.url = `/blog/${str((it.meta.article as Row).slug)}`
              return { ok: true, state: 'published', url: it.meta.url, item: view(it) }
            }
            const platforms = body.platform ? [str(body.platform) === 'youtube' ? 'shorts' : str(body.platform)] : ((it.meta.platforms as string[] | undefined) ?? ['instagram'])
            const results = platforms.map((platform) =>
              platform === 'shorts' ? { platform, state: 'manual', reason: 'YouTube без автопубликации в этом Shell, выложите вручную' } : { platform, state: 'queued' },
            )
            it.meta.macQueued = platforms.filter((p) => p !== 'shorts')
            return { ok: true, state: 'queued', results, item: view(it) }
          }
        }
        return bad('invalid')
      }
      return null
    }

    // ---- a cabinet client's threads (clients/:id/threads) ----
    if (method === 'GET' && seg[0] === 'clients' && seg[2] === 'threads' && seg.length === 3) {
      if (seg[1] !== '3') return { ok: true, items: [] }
      return {
        ok: true,
        items: [
          { id: 'lead-12', kind: 'lead', refId: 12, title: 'Заявка #12: сайт для студии', unread: 0, lastAt: ago(12) },
          { id: 'project-4', kind: 'project', refId: 4, title: 'Проект #4: сайт студии', unread: 1, lastAt: ago(60 * 3) },
          { id: 'support', kind: 'support', refId: null, title: 'Поддержка', unread: 0, lastAt: null },
          { id: 'agent-1', kind: 'agent', refId: 1, title: 'Лина', unread: 0, lastAt: null },
        ],
      }
    }

    // ---- chats ----
    if (seg[0] === 'chats') {
      if (method === 'GET' && seg.length === 1) {
        if (q.status && !['open', 'all'].includes(q.status)) return bad('invalid', { allowed: ['open', 'all'] })
        const list = threads.map((t) => clone(t))
        return { ok: true, unread: list.filter((t) => Number(t.unread) > 0).length, nextCursor: null, items: list }
      }
      const t = seg[1] ? thread(seg[1]) : undefined
      if (!t) return bad('not_found')
      if (method === 'GET' && seg.length === 2) return { ok: true, thread: clone(t), messages: clone(messages.get(String(t.id)) ?? []) }
      if (method === 'POST' && seg[2] === 'reply') {
        const text = str(body.text).trim()
        if (!text || text.length > 2000) return bad('invalid')
        // Cabinet thread (contract 2026-11-22): with several threads and no hint the answer is 422 thread_required.
        const names = replyThreads(t)
        const wanted = typeof body.thread === 'string' ? body.thread : null
        if (wanted && !names.includes(wanted)) return bad('not_found')
        const list = messages.get(String(t.id)) ?? []
        // No `thread`, no `replyTo`: HQ answers into the thread of the client's last message (contract 2026-11-22);
        // 422 thread_required only when it cannot tell (several threads, the client wrote nowhere).
        const lastClient = [...list].reverse().find((m) => m.from === 'client')
        if (names.length > 1 && !wanted && !body.replyTo && !lastClient) return { ok: false, error: 'thread_required', threads: names }
        const replyThread = wanted ?? (body.replyTo ? (/^ct_/.test(String(body.replyTo)) ? 'project-4' : 'lead') : (lastClient?.thread ?? 'lead'))
        const cabinet = (t.channels as string[]).includes('cabinet')
        const via = t.textsStored === false ? 'none' : cabinet ? 'cabinet' : 'telegram'
        const message: Msg = { id: `ow_${nextMsg++}`, at: iso(now), from: 'owner', channel: cabinet ? 'cabinet' : 'telegram', thread: replyThread, text, attachments: [] }
        list.push(message)
        messages.set(String(t.id), list)
        t.unread = 0
        t.lastAt = message.at
        t.preview = text.slice(0, 120)
        t.textsStored = true
        return { ok: true, sent: via !== 'none', via, message: clone(message), thread: clone(t) }
      }
      // The owner marks the client unread again: a thread with everything answered gets 1, one with unread stays.
      if (method === 'POST' && seg[2] === 'unread' && seg.length === 3) {
        if (Number(t.unread) === 0) t.unread = 1
        return { ok: true, thread: clone(t) }
      }
      return null
    }

    // ---- trends ----
    if (seg[0] === 'trends' && seg.length === 1) {
      if (method === 'GET') return { ok: true, items: clone(trends), nextCursor: null, statuses: [...TREND_STATUSES] }
      const url = str(body.url).trim()
      const problem = trendUrlProblem(url)
      if (problem) return bad('invalid_link', { reason: problem })
      const same = trends.find((x) => x.url === url && x.status !== 'failed')
      if (same) return { ok: true, already: true, item: clone(same) }
      const host = new URL(url).hostname
      const item: Row = { id: nextTrend++, url, host, platform: host.includes('tiktok') ? 'tiktok' : host.includes('instagram') ? 'instagram' : 'youtube', note: str(body.note), status: 'analysing', error: null, createdAt: iso(now), updatedAt: iso(now), taskId: null, analysis: null, reviewId: null, itemId: null }
      trends.unshift(item)
      return { ok: true, already: false, item: clone(item) }
    }
    return null
  }
}
