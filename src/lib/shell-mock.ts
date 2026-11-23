import type { Approval } from './hq-admin-view'
import { createAgentsMock } from './agents-mock'
import { createKnowledgeMock } from './knowledge-mock'
import { createClientKnowledgeMock } from './client-knowledge-mock'
import { createCampaignsMock } from './campaigns-mock'
import { createMarketingMock } from './marketing-mock'
import { createSettingsMock } from './settings-mock'
import { HUB_DEPTS, isoWeek, shiftWeek, weekDates } from './shell'

// Development stand-in for the пульт v3 part of HQ's admin API (hub, leads funnel, client 360,
// project details, invoices, content, metrics, company), in the contract's shapes. In memory, so
// moving a lead, completing a milestone or approving a clip behaves like HQ until the dev server
// restarts. Returns null for paths it does not know; hq-admin-mock.ts then answers.

type Json = Record<string, unknown>
type Reply = { ok: true; [k: string]: unknown } | { ok: false; error: string; [k: string]: unknown }
type Row = Record<string, unknown>

const iso = (t: number) => new Date(t).toISOString()

// A few 1x1-free sample renders: the file proxy draws a labelled placeholder for any png path in dev.
const png = (name: string) => ({ path: `content/2026-w47/${name}.png`, type: 'png', w: 1080, h: 1350 })

// Builder links the dev leads came with (the lead's own words ride in the `w.` chunk as base64url).
// `leadBreakdown` reads them in «Разбор заявки»; lead 5 has an old link (parts only), the rest none.
const b64 = (t: string) => Buffer.from(t, 'utf8').toString('base64url')
export const MOCK_BUILDS = {
  7: `bots.booking.payments-broadcasts~x.support~k.salon~p.adminbot~g.booking-routine~c.instagram-telegram~y.blush.rounded.pill.airy.playful.candy~d._.ru._.month~w.${b64('Нужна запись по мастерам и напоминания за день. Салон на 4 кресла.')}`,
  6: `websites.company.telegram-cms~x.seo~k.carservice~p.site~g.leads-booking~c.search-word~y.graphite.grotesk.soft.compact.bold~d.6.ru-tj.logo-photos.asap~u.${b64('https://example-auto.tj')}~w.${b64('Хочу как у конкурента, но с онлайн-записью на диагностику.')}`,
  4: `websites.company.telegram-cms-language~bots.booking.payments~x.seo-support~k.clinic~p.site-adminbot~g.leads-brand~c.instagram-search~y.mintlight.serif.soft.airy.premium.clinic~d.8.ru-en-tj.logo-texts-photos-domain-hosting.month~w.${b64('Клиника, 6 врачей, нужен каталог услуг и запись.')}`,
  5: 'bots.faq',
} as const
export const mockBuilderUrl = (id: keyof typeof MOCK_BUILDS) => `https://firtech.pro/ru/builder?b=${MOCK_BUILDS[id]}`
export const MOCK_ESTIMATES: Record<number, string> = {
  7: 'Тип бизнеса: Салон и запись\nПродукты: ИИ-администратор\nTelegram-боты: Запись и заказы + Оплата в боте + Рассылки ($350)\nИтого: $350\nПоддержка: $20/мес\nЭтапы: 1. $105 (30%), 2. $140 (40%), 3. $105 (30%)\nЦели: Записи, Рутина; Каналы: Instagram, Telegram',
  6: 'Тип бизнеса: Автосервис\nПродукты: Сайт\nСайты и лендинги: Сайт компании + Заявки в Telegram + Панель для правок ($470)\nКарты, SEO и аналитика ($50)\nСкидка за набор: $520 -> $470\nИтого: $470\nЭтапы: 1. $141 (30%), 2. $188 (40%), 3. $141 (30%)\nЦели: Заявки, Записи',
  4: 'Тип бизнеса: Клиника и медцентр\nПродукты: Сайт, ИИ-администратор\nСайты и лендинги: Сайт компании + Заявки в Telegram + Панель для правок + Второй язык ($510)\nTelegram-боты: Запись и заказы + Оплата в боте ($310)\nСкидка за набор: $870 -> $780\nИтого: $780\nПоддержка: $20/мес',
}
export const MOCK_MESSAGES: Record<number, string> = {
  7: 'Здравствуйте! Хотим бота для записи в салон: 4 мастера, напоминания клиентам за день, предоплата в боте. Когда сможете начать?',
  6: 'Нужен сайт автосервиса с записью на диагностику. Есть логотип и фото, домена нет.',
  4: 'Новый сайт клиники и бот для записи. Нужны страницы врачей и услуги с ценами.',
  5: 'Бот для записи клиентов',
  3: 'Сайт для студии йоги, расписание и запись.',
}

export function createPultMock(start = Date.now(), deps: { approvals: () => Approval[] } = { approvals: () => [] }) {
  const ago = (min: number) => iso(start - min * 60_000)
  const ahead = (days: number) => iso(start + days * 86_400_000)

  const leads: Row[] = [
    { id: 7, name: 'Нигина', contact: '@nigina_beauty', service: 'bot', niche: 'beauty', brief: 'Бот для записи в салон, напоминания клиентам за день.', budget: '300-500', source: 'site', temperature: 'hot', stage: 'new', nextAction: 'Ответить и уточнить сроки', estimateUsd: 350, hasDomain: false, hasHosting: false, notes: [], clientId: null, callAt: null, createdAt: ago(25), message: MOCK_MESSAGES[7], estimate: MOCK_ESTIMATES[7], builderUrl: mockBuilderUrl(7) },
    { id: 6, name: 'Фаррух', contact: '+992 90 111 22 33', service: 'site', niche: 'auto', brief: 'Сайт автосервиса с онлайн-записью.', budget: '', source: 'telegram', temperature: 'warm', stage: 'qualified', nextAction: 'Назначить созвон', estimateUsd: 470, hasDomain: true, hasHosting: false, notes: [{ at: ago(300), text: 'Хочет запуск до Нового года.' }], clientId: null, callAt: null, createdAt: ago(60 * 9), message: MOCK_MESSAGES[6], estimate: MOCK_ESTIMATES[6], builderUrl: mockBuilderUrl(6) },
    { id: 5, name: 'Боб', contact: '@bob', service: 'bot', niche: '', brief: 'Бот для записи клиентов', budget: '', source: 'telegram', temperature: 'warm', stage: 'proposal', nextAction: 'КП отправлено, ждём ответа', estimateUsd: 100, hasDomain: null, hasHosting: null, notes: [], clientId: 'c:Боб', callAt: ahead(1), booking: { id: 5, at: ahead(1), state: 'pending', site: 'booked' }, createdAt: ago(60 * 26), message: MOCK_MESSAGES[5], builderUrl: mockBuilderUrl(5) },
    { id: 4, name: 'Sadaf Clinic', contact: 'hello@sadaf.example', service: 'site', niche: 'clinic', brief: 'Новый сайт клиники и бот для записи.', budget: '1000+', source: 'ref:c1a1b2c3', temperature: 'warm', stage: 'contract', nextAction: 'Договор на подписи', estimateUsd: 780, hasDomain: true, hasHosting: true, notes: [], clientId: null, callAt: null, createdAt: ago(60 * 50), message: MOCK_MESSAGES[4], estimate: MOCK_ESTIMATES[4], builderUrl: mockBuilderUrl(4) },
    { id: 3, name: 'Алиса', contact: '@alice', service: 'site', niche: 'studio', brief: 'Сайт для студии', budget: '', source: 'site', temperature: 'hot', stage: 'paid', nextAction: null, estimateUsd: 600, hasDomain: false, hasHosting: false, notes: [], clientId: '1', callAt: null, createdAt: ago(60 * 70), message: MOCK_MESSAGES[3], estimate: 'Итого: $600' },
    { id: 2, name: 'Pulse Gym', contact: '@pulse.gym', service: 'automation', niche: 'gym', brief: 'Автоматизация абонементов.', budget: '', source: 'site', temperature: 'warm', stage: 'project', nextAction: null, estimateUsd: 900, hasDomain: true, hasHosting: true, notes: [], clientId: null, callAt: null, createdAt: ago(60 * 24 * 6) },
    { id: 1, name: 'Old Cafe', contact: '@oldcafe', service: 'site', niche: 'cafe', brief: 'Меню на сайте.', budget: '50', source: 'site', temperature: 'cold', stage: 'lost', nextAction: null, estimateUsd: null, hasDomain: null, hasHosting: null, notes: [], clientId: null, callAt: null, lostReason: 'Бюджет меньше минимального', createdAt: ago(60 * 24 * 9) },
  ]

  const invoices: Row[] = [
    { id: 5, number: 'FT-2026-005', client: 'Алиса', title: 'Сайт, этап 1', amountUsd: 300, payAmountUsd: 300.01, status: 'paid', dueDate: ago(60 * 24), issuedAt: ago(60 * 24 * 3), paidAt: ago(60 * 20), paidVia: 'usdt_ton', txId: 'vQ5Dkc0z9xV7S8q6A1n8Kp3wJ2gYH0dQx1iZp9lXc4E=', payUrl: 'https://firtech.pro/ru/pay/FT-2026-005?k=demo', remindedAt: null },
    { id: 6, number: 'FT-2026-006', client: 'Sadaf Clinic', title: 'Сайт и бот, этап 1', amountUsd: 600, payAmountUsd: 600, status: 'issued', dueDate: ahead(2), issuedAt: ago(60 * 10), paidAt: null, paidVia: '', txId: '', payUrl: 'https://firtech.pro/ru/pay/FT-2026-006?k=demo', remindedAt: null },
    { id: 4, number: 'FT-2026-004', client: 'Pulse Gym', title: 'Автоматизация, финальный платёж', amountUsd: 450, payAmountUsd: 450, status: 'issued', dueDate: ago(60 * 24 * 2), issuedAt: ago(60 * 24 * 9), paidAt: null, paidVia: '', txId: '', payUrl: 'https://firtech.pro/ru/pay/FT-2026-004?k=demo', remindedAt: ago(60 * 24) },
    { id: 3, number: 'FT-2026-003', client: 'Pulse Gym', title: 'Автоматизация, этап 1', amountUsd: 450, payAmountUsd: 450, status: 'paid', dueDate: ago(60 * 24 * 12), issuedAt: ago(60 * 24 * 14), paidAt: ago(60 * 24 * 12), paidVia: 'usdt_trc20', txId: '4f1c2b0a9e8d7c6b5a49382716051f2e3d4c5b6a79881726354a5b6c7d8e9f00', payUrl: null, remindedAt: null },
    { id: 2, number: 'FT-2026-002', client: 'Old Cafe', title: 'Меню', amountUsd: 50, payAmountUsd: null, status: 'void', dueDate: null, issuedAt: ago(60 * 24 * 20), paidAt: null, paidVia: '', txId: '', payUrl: null, remindedAt: null },
  ]

  const projects: Row[] = [
    { id: 2, client: 'Алиса', what: 'Сайт студии', product: 'site', status: 'active', source: 'owner', taskId: null, stage: 'prototype', deadline: ahead(3), nextMilestone: { kind: 'prototype', title: 'Прототип', dueAt: ahead(3) }, tasksTotal: 4, tasksDone: 1, createdAt: ago(60 * 60) },
    { id: 3, client: 'Pulse Gym', what: 'Автоматизация абонементов', product: 'automation', status: 'active', source: 'invoice', taskId: null, stage: 'delivery', deadline: ahead(6), nextMilestone: { kind: 'delivery', title: 'Сдача', dueAt: ahead(6) }, tasksTotal: 4, tasksDone: 3, createdAt: ago(60 * 24 * 6) },
    { id: 4, client: 'Sadaf Clinic', what: 'Сайт и бот', product: 'site', status: 'draft', source: 'presales', taskId: null, stage: 'spec', deadline: null, nextMilestone: null, tasksTotal: 0, tasksDone: 0, createdAt: ago(60 * 10) },
    { id: 1, client: 'Zebo Beauty', what: 'Лендинг', product: 'site', status: 'done', source: 'owner', taskId: null, stage: 'done', deadline: ago(60 * 24 * 4), nextMilestone: null, tasksTotal: 4, tasksDone: 4, createdAt: ago(60 * 24 * 30) },
  ]
  const milestones = new Map<string, Row[]>([
    ['2', [
      { id: 21, kind: 'brief', title: 'Бриф', dueAt: ago(60 * 24), doneAt: ago(60 * 26) },
      { id: 22, kind: 'prototype', title: 'Прототип', dueAt: ahead(3), doneAt: null },
      { id: 23, kind: 'delivery', title: 'Сдача', dueAt: ahead(10), doneAt: null },
      { id: 24, kind: 'payment', title: 'Финальный платёж', dueAt: ahead(12), doneAt: null },
      { id: 25, kind: 'stage', title: 'Этап 1: дизайн и прототип', dueAt: ahead(3), doneAt: null, stageNo: 1, amountUsd: 300, state: 'awaiting_acceptance', paidAt: ago(60 * 20), acceptedAt: null },
      { id: 26, kind: 'stage', title: 'Этап 2: запуск и передача', dueAt: ahead(12), doneAt: null, stageNo: 2, amountUsd: 300, state: 'awaiting_payment', paidAt: null, acceptedAt: null },
    ]],
    ['3', [
      { id: 31, kind: 'brief', title: 'Бриф', dueAt: ago(60 * 24 * 5), doneAt: ago(60 * 24 * 5) },
      { id: 32, kind: 'prototype', title: 'Прототип', dueAt: ago(60 * 24 * 3), doneAt: ago(60 * 24 * 3) },
      { id: 33, kind: 'delivery', title: 'Сдача', dueAt: ahead(6), doneAt: ago(60) },
      { id: 34, kind: 'payment', title: 'Финальный платёж', dueAt: ahead(8), doneAt: null },
      { id: 35, kind: 'stage', title: 'Этап 1: настройка и запуск', dueAt: ahead(6), doneAt: null, stageNo: 1, amountUsd: 400, state: 'in_progress', paidAt: ago(60 * 24 * 5), acceptedAt: null },
    ]],
  ])
  const projectNotes = new Map<string, string[]>()
  const callBookings = new Map<string, { at: string; state: string; site: string }>()

  const tickets: Row[] = [
    { id: 3, clientName: 'Алиса', contact: '@alice', text: 'Бот не отвечает с утра, клиенты жалуются.', clientId: 1, status: 'open', money: true, slaAlerted: true, answer: null, createdAt: ago(250) },
    { id: 4, clientName: 'Pulse Gym', contact: '@pulse.gym', text: 'Как добавить новый тариф абонемента?', status: 'open', money: false, slaAlerted: false, answer: null, createdAt: ago(70) },
    { id: 2, clientName: 'Боб', contact: '@bob', text: 'Можно поменять цвет кнопки на сайте?', status: 'answered', money: false, slaAlerted: false, answer: 'Да, поменяем сегодня, пришлите цвет.', createdAt: ago(60 * 7), answeredAt: ago(60 * 6) },
  ]

  const clients: Row[] = [
    { id: '1', name: 'Алиса', contact: '@alice', sources: ['cabinet', 'billing', 'project', 'site', 'support'], firstTouchAt: ago(60 * 70), lastTouchAt: ago(95), counts: { leads: 1, tickets: 1, projects: 1, invoices: 1, documents: 1 } },
    { id: 'c:Боб', name: 'Боб', contact: '@bob', sources: ['documents', 'support', 'telegram'], firstTouchAt: ago(60 * 26), lastTouchAt: ago(60 * 7), counts: { leads: 1, tickets: 1, projects: 0, invoices: 0, documents: 1 } },
    { id: 'c:Pulse Gym', name: 'Pulse Gym', contact: '@pulse.gym', sources: ['billing', 'project', 'site', 'support'], firstTouchAt: ago(60 * 24 * 6), lastTouchAt: ago(70), counts: { leads: 1, tickets: 1, projects: 1, invoices: 2, documents: 0 } },
  ]

  // Content: the current week gets a full pack; other weeks only a couple of published items.
  const currentWeek = isoWeek(start)
  const items = new Map<string, Row>()
  const orders: Row[] = []
  let purged = false
  const content = (week: string) => {
    const dates = weekDates(week)
    const full = week === currentWeek
    return dates.map((date, i) => {
      const day: Row[] = []
      const add = (n: number, over: Row) => {
        const id = `${week}-${i}-${n}`.replace(/\D/g, '').slice(-9)
        const row = items.get(id) ?? {
          id: Number(id),
          kind: 'post',
          platform: 'instagram',
          status: 'pending',
          title: '',
          hook: '',
          caption: { instagram: '', tiktok: '', shorts: '', dzen: '' },
          files: [],
          sourceSlug: null,
          approvalId: null,
          publishedUrl: null,
          error: null,
          kit: null,
          ...over,
        }
        items.set(id, row)
        day.push(row)
      }
      if (full || i % 3 === 0) {
        add(1, {
          kind: 'clip',
          platform: 'instagram',
          status: full ? (['pending', 'approved', 'rendering', 'ready', 'published', 'pending', 'draft'] as const)[i]! : 'published',
          title: ['Бот, который записывает клиентов ночью', 'Сайт за 7 дней: как мы это делаем', 'ИИ-менеджер отвечает за 3 секунды', 'Почему клиенты не дозваниваются', 'Автоматизация абонементов', 'Три ошибки лендинга', 'Как работает наш офис агентов'][i]!,
          hook: 'Ваш администратор спит, а запись идёт.',
          caption: {
            instagram: 'Бот записывает клиентов, пока вы спите. Пишите в директ слово «бот».',
            tiktok: 'Бот записывает клиентов ночью #бизнес #бот',
            shorts: 'Бот записывает клиентов ночью',
            dzen: 'Как бот для записи экономит администратору два часа в день.',
          },
          // Like HQ: a reel is drawn after approval (files only once ready or published); a waiting one shows the card's media.
          files: !full || i === 3 || i === 4 ? [{ path: `content/2026-w47/clip-${i}.mp4`, type: 'mp4', w: 1080, h: 1920 }, png(`clip-${i}-cover`)] : [],
          sourceSlug: i === 1 ? 'sajt-za-7-dnej' : null,
          approvalId: i === 0 ? 91 : null,
          publishedUrl: !full || i === 4 ? 'https://www.instagram.com/p/demo/' : null,
          error: null,
        })
      }
      if (full && i % 2 === 0) {
        add(2, {
          kind: 'carousel',
          platform: 'instagram',
          status: i === 2 ? 'rejected' : 'pending',
          title: 'Пять признаков, что вам нужен бот',
          hook: 'Если клиенты пишут в 23:00, это вам.',
          caption: { instagram: 'Сохраните, чтобы не потерять. Пять признаков, что пора автоматизировать запись.', tiktok: '', shorts: '', dzen: '' },
          files: [png(`car-${i}-1`), png(`car-${i}-2`), png(`car-${i}-3`)],
          sourceSlug: 'bot-dlya-zapisi',
          approvalId: null,
          publishedUrl: null,
          error: i === 2 ? 'Отклонено: слишком много текста на слайде' : null,
        })
      }
      if (full && i === 3) {
        add(4, {
          kind: 'profile',
          platform: 'all',
          status: 'pending',
          title: 'Старт-кит профилей',
          kit: {
            instagram: 'Профиль Instagram: настройка (био 118 знаков)\nБио: Сайты, боты и автоматизация для бизнеса. Работаем из Таджикистана.\nСсылка в шапке: https://firtech.pro\n\nАктуальное (название, обложка 1080x1920):\n1. Кейсы. Обложка: зелёная\n2. Цены. Обложка: тёмная\n\nЗакреплённые посты:\n1) Что мы делаем\n2) Сколько это стоит',
            youtube: 'Профиль YouTube: настройка канала\nНазвание: Fir Tech\nХэндл: @firtech\nБаннер: 2560x1440, текст внутри безопасной зоны 1546x423 по центру\n\nОписание канала (212 знаков):\nДелаем сайты, Telegram-боты и автоматизацию для малого бизнеса. Подробности на firtech.pro.\n\nПлейлисты:\n1) Кейсы. Что получилось\n2) Разборы. Как это устроено',
            tiktok: 'Профиль TikTok: настройка (био 61 знак)\nИмя: Fir Tech\nБио: Сайты и боты для бизнеса. firtech.pro\n\nПервые 3 видео:\n1) Хук: Клиенты пишут ночью. Текст на экране: Бот отвечает за вас',
          },
          files: [{ path: 'content/2026-w47/profile-youtube-banner.png', type: 'png', w: 2560, h: 1440 }],
        })
      }
      if (full && i === 5) add(3, { kind: 'story', status: 'draft', title: 'Опрос: что автоматизировать первым?', files: [png('story-5')] })
      return { date, items: day }
    })
  }
  const summaryOf = (days: { items: Row[] }[]) => {
    const all = days.flatMap((d) => d.items)
    const n = (s: string) => all.filter((i) => i.status === s).length
    return { pending: n('pending'), approved: n('approved'), published: n('published'), rendering: n('rendering') }
  }

  const routines: Row[] = [
    { name: 'marketing-article-daily', dept: 'marketing', title: 'Статья дня', cron: '30 7 * * *', tz: 'Asia/Kuala_Lumpur', enabled: true, lastRunAt: ago(60 * 3), lastStatus: 'done', nextRunAt: ahead(0.85) },
    { name: 'marketing-weekly-pack', dept: 'marketing', title: 'Пакет недели', cron: '0 9 * * 1', tz: 'Asia/Kuala_Lumpur', enabled: true, lastRunAt: ago(60 * 24 * 2), lastStatus: 'done', nextRunAt: ahead(5) },
    { name: 'sales-prospector-cards', dept: 'sales', title: 'Карточки Разведчика', cron: '30 7 * * *', tz: 'Asia/Kuala_Lumpur', enabled: true, lastRunAt: ago(60 * 3), lastStatus: 'done', nextRunAt: ahead(0.85) },
    { name: 'billing-payment-watch', dept: 'backoffice', title: 'Проверка оплат USDT', cron: '*/2 * * * *', tz: 'Asia/Dushanbe', enabled: true, lastRunAt: ago(1), lastStatus: 'done', nextRunAt: ahead(0.001) },
    { name: 'support-sla-watch', dept: 'support', title: 'SLA тикетов', cron: '*/15 * * * *', tz: 'Asia/Dushanbe', enabled: false, lastRunAt: ago(60 * 24), lastStatus: 'failed', nextRunAt: null },
  ]
  const trust: Row[] = [
    { kind: 'content_item', level: 0, locked: false, approvals: 14 },
    { kind: 'lead_first_reply', level: 1, locked: false, approvals: 23 },
    { kind: 'presales_pack', level: 0, locked: true, approvals: 6 },
    { kind: 'billing_invoice', level: 0, locked: true, approvals: 3 },
    { kind: 'ticket_reply', level: 0, locked: true, approvals: 9 },
  ]
  const playbooks: Row[] = [
    { role: 'content-maker', updatedAt: ago(60 * 20), lines: 84, sourceSkills: ['copywriting', 'social'] },
    { role: 'trend-scout', updatedAt: ago(60 * 20), lines: 61, sourceSkills: ['content-strategy'] },
    { role: 'seo', updatedAt: ago(60 * 20), lines: 48, sourceSkills: ['seo-audit', 'ai-seo'] },
    { role: 'analyst', updatedAt: ago(60 * 20), lines: 40, sourceSkills: [] },
  ]
  const playbookText = (role: string) =>
    `# Плейбук: ${role}\n\nИсточники: seo-audit, ai-seo\n\n## Правила\n\n- Один материал, одна мысль.\n- Цифры только из \`metrics/week\`, **без выдумок**.\n- Цены не пишем.\n\n## Порядок\n\n1. Прочитать задачу.\n2. Собрать черновик.\n3. Отправить на одобрение.\n\n## Площадки\n\n| Площадка | Длина | Формат |\n|---|---|---|\n| Instagram | 2200 | карусель |\n| YouTube | 100 | Shorts |\n\n\`\`\`\n/playbook ${role}\n\`\`\`\n\n<script>alert(1)</script>\n`

  let drillStartedAt: number | null = null
  let drillRows: Row[] = []
  const ok = (extra: Json = {}): Reply => ({ ok: true, ...extra })
  const bad = (error: string, extra: Json = {}): Reply => ({ ok: false, error, ...extra })
  const byId = (list: Row[], id: string) => list.find((r) => String(r.id) === id)
  const search = (list: Row[], q: Json, fields: string[], filter?: string) => {
    const needle = String(q.q ?? '').toLowerCase()
    return list.filter(
      (r) =>
        (!filter || !q[filter] || String(r[filter]) === q[filter]) &&
        (!needle || fields.some((f) => String(r[f] ?? '').toLowerCase().includes(needle))),
    )
  }

  const hub = (now: number) => {
    if (!items.size && !purged) content(currentWeek)
    const counts = Object.fromEntries(HUB_DEPTS.map((d) => [d, { pending: 0, approvals: 0, alerts: 0, running: 0, lastActivityAt: ago(5) }]))
    for (const a of deps.approvals()) {
      const d = a.dept === 'back-office' ? 'backoffice' : a.dept
      const c = (counts[d] ?? counts.director) as Row
      c.approvals = Number(c.approvals) + 1
    }
    const bump = (d: string, key: string, n: number) => {
      const c = counts[d] as Row
      c[key] = Number(c[key]) + n
    }
    bump('sales', 'pending', leads.filter((l) => l.stage === 'new').length)
    bump('support', 'alerts', tickets.filter((t) => t.status === 'open' && t.slaAlerted).length)
    bump('support', 'pending', tickets.filter((t) => t.status === 'open').length)
    bump('backoffice', 'pending', invoices.filter((i) => i.status === 'issued').length)
    bump('backoffice', 'alerts', invoices.filter((i) => i.status === 'issued' && Date.parse(String(i.dueDate)) < now).length)
    bump('marketing', 'running', 2)
    bump('production', 'running', projects.filter((p) => p.status === 'active').length)
    bump('marketing', 'pending', [...items.values()].filter((i) => i.status === 'pending').length)
    return ok({
      generatedAt: iso(now),
      departments: counts,
      inbox: [
        { id: 'n12', at: ago(4), dept: 'sales', kind: 'lead', title: 'Новый лид: Нигина, бот для записи', link: 'leads:7' },
        { id: 'n11', at: ago(20), dept: 'backoffice', kind: 'payment', title: 'Оплата FT-2026-005: 300 USDT (TON)', link: 'invoices:5' },
        { id: 'n10', at: ago(35), dept: 'marketing', kind: 'content', title: 'Клип ждёт одобрения: «Бот, который записывает клиентов ночью»', link: `content:item:${[...items.keys()][0] ?? '1'}` },
        { id: 'n9', at: ago(70), dept: 'support', kind: 'ticket', title: 'Тикет от Pulse Gym: новый тариф', link: 'tickets:4' },
        { id: 'n8', at: ago(95), dept: 'support', kind: 'alert', title: 'SLA: тикет Алисы без ответа больше 4 часов', link: 'tickets:3' },
        { id: 'n7', at: ago(130), dept: 'director', kind: 'approval', title: 'КП для Sadaf Clinic ждёт решения', link: 'approvals:91' },
        { id: 'n6', at: ago(240), dept: 'production', kind: 'info', title: 'Pulse Gym: веха «Сдача» закрыта', link: 'projects:3' },
        { id: 'n5', at: ago(60 * 9), dept: 'sales', kind: 'lead', title: 'Лид Фаррух квалифицирован', link: 'leads:6' },
        { id: 'n4', at: ago(60 * 26), dept: 'sales', kind: 'info', title: 'Новый аккаунт в кабинете: Алиса, лидов привязано 1', link: 'clients:1' },
      ],
    })
  }

  const agentsMock = createAgentsMock(start)
  const settingsMock = createSettingsMock()
  const knowledgeMock = createKnowledgeMock(start)
  const clientKnowledgeMock = createClientKnowledgeMock({ pending: process.env.HQ_MOCK_KNOWLEDGE_PENDING === '1' })
  const campaignsMock = createCampaignsMock()
  const marketingMock = createMarketingMock()

  return function handle(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', seg: string[], query: Json, body: Json, now: number): Reply | null {
    const settings = settingsMock(method, seg, body, query, now)
    if (settings) return settings
    const clientKnowledge = clientKnowledgeMock(method, seg, body, now)
    if (clientKnowledge) return clientKnowledge
    const knowledge = knowledgeMock(method, seg, body, query, now)
    if (knowledge) return knowledge
    const marketing = marketingMock(method, seg, query, body, now)
    if (marketing) return marketing
    const campaigns = campaignsMock(method, seg, body, now)
    if (campaigns) return campaigns
    const agents = agentsMock(method, seg, body, now)
    if (agents) return agents
    const path = seg.join('/')
    if (method === 'GET' && path === 'hub') return hub(now)

    // ---- leads
    if (seg[0] === 'crm' && seg[1] === 'leads') {
      if (method === 'GET' && seg.length === 2) {
        return ok({ available: true, nextCursor: null, items: search(leads, query, ['name', 'contact', 'service', 'source', 'brief']) })
      }
      const lead = seg[2] ? byId(leads, seg[2]) : undefined
      if (method !== 'POST' || !lead) return bad('not_found')
      if (seg.length === 3) {
        if (body.stage !== undefined) {
          if (lead.stage === 'paid' && body.stage === 'new') return bad('illegal_transition', { from: 'paid' })
          lead.stage = body.stage
          if (body.stage === 'lost' && typeof body.lost_reason === 'string') lead.lostReason = body.lost_reason
        }
        if (typeof body.note === 'string' && body.note.trim()) lead.notes = [...(lead.notes as Row[]), { at: iso(now), text: body.note.trim() }]
        return ok({ item: lead })
      }
      if (seg[3] === 'reply') {
        const via = String(lead.contact).startsWith('@') ? 'telegram' : lead.source === 'site' ? 'web' : 'none'
        return ok({ sent: via !== 'none', via })
      }
      if (seg[3] === 'call') {
        // P-18/P-19: one living booking per lead; confirm and cancel need one (409 `no_call`), a repeat of the same time tells nobody.
        const action = String(body.action ?? 'book')
        const current = callBookings.get(String(lead.id)) ?? (lead.callAt ? { at: String(lead.callAt), state: 'pending', site: 'booked' } : null)
        const told = ['cabinet', 'email']
        if ((action === 'confirm' || action === 'cancel') && (!current || current.state === 'cancelled')) return bad('no_call')
        if (action === 'confirm') callBookings.set(String(lead.id), { ...current!, state: 'confirmed' })
        else if (action === 'cancel') {
          callBookings.set(String(lead.id), { ...current!, state: 'cancelled' })
          lead.callAt = null
        } else {
          const at = String(body.at)
          const same = current && current.state !== 'cancelled' && current.at === at
          callBookings.set(String(lead.id), { at, state: 'pending', site: 'booked' })
          lead.callAt = at
          if (same) told.length = 0
        }
        const booking = { id: Number(lead.id), ...callBookings.get(String(lead.id))! }
        lead.booking = booking
        return ok({ item: lead, booking, told })
      }
      return bad('not_found')
    }

    // ---- clients
    if (seg[0] === 'crm' && seg[1] === 'clients') {
      if (method === 'GET' && seg.length === 2) {
        return ok({ available: true, chats: { web: 12, telegram: 3 }, nextCursor: null, items: search(clients, query, ['name', 'contact']) })
      }
      if (method === 'GET' && seg.length === 3) {
        const c = byId(clients, seg[2]!)
        if (!c) return bad('not_found')
        const name = String(c.name)
        const mine = (rows: Row[], key: string) => rows.filter((r) => r[key] === name)
        return ok({
          client: { id: c.id, name, email: c.id === '1' ? 'alice@example.com' : '', telegram: String(c.contact), cabinet: c.id === '1', createdAt: c.firstTouchAt },
          leads: mine(leads, 'name'),
          projects: mine(projects, 'client'),
          invoices: mine(invoices, 'client'),
          documents: name === 'Алиса' ? [{ id: 'bo:2', source: 'back_office', kind: 'contract', status: 'approved', client: name, title: 'Договор на разработку сайта', excerpt: '', amountUsd: null, number: null, createdAt: ago(60 * 50), link: null }] : [],
          tickets: mine(tickets, 'clientName'),
          referrals: name === 'Алиса' ? [{ id: 1, referrer: 'Алиса', referred: 'Боб', leadId: 5, source: 'owner', status: 'proposed', reward: '10%', rewardRequested: false, createdAt: ago(60 * 48), paidAt: null, rewardedAt: null }] : [],
          touches: [
            { at: ago(95), kind: 'ticket', title: 'Тикет: бот не отвечает' },
            { at: ago(60 * 20), kind: 'payment', title: 'Оплата 300 USDT' },
            { at: ago(60 * 24 * 2), kind: 'invoice', title: 'Счёт FT-2026-005' },
            { at: ago(60 * 24 * 3), kind: 'kp', title: 'КП одобрено' },
            { at: ago(60 * 70), kind: 'lead', title: 'Заявка с сайта' },
          ],
        })
      }
      return null
    }

    // ---- accept a client's stage (clients/:id/projects/:pid/milestones/:no/accept)
    if (method === 'POST' && seg[0] === 'clients' && seg[2] === 'projects' && seg[4] === 'milestones' && seg[6] === 'accept') {
      const m = (milestones.get(seg[3] ?? '') ?? []).find((x) => String(x.stageNo) === seg[5])
      if (!m) return bad('not_found')
      if (m.state === 'accepted') return ok({ already: true, milestone: m })
      if (m.state === 'awaiting_payment') return bad('not_paid')
      if (m.state === 'in_progress') return bad('not_ready')
      m.state = 'accepted'
      m.acceptedAt = iso(now)
      return ok({ already: false, milestone: m })
    }

    // ---- projects
    if (seg[0] === 'crm' && seg[1] === 'projects') {
      if (method === 'GET' && seg.length === 2) {
        return ok({ available: true, nextCursor: null, items: search(projects, query, ['client', 'what', 'product'], 'status') })
      }
      const p = seg[2] ? byId(projects, seg[2]) : undefined
      if (!p) return bad('not_found')
      const detail = () =>
        ok({
          item: p,
          milestones: milestones.get(String(p.id)) ?? [],
          tasks: [
            { id: 51, title: `Макет главной: ${p.client}`, status: 'running', assignee: 'Builder' },
            { id: 52, title: 'Тексты страниц', status: 'done', assignee: 'Content Maker' },
          ],
          issues: [{ number: 12, title: `${p.what}: адаптив меню`, state: 'open', url: 'https://github.com/bokievf9/agents/issues/12' }],
          notes: projectNotes.get(String(p.id)) ?? [],
        })
      if (method === 'GET' && seg.length === 3) return detail()
      if (method === 'POST' && seg.length === 3) {
        const ms = milestones.get(String(p.id)) ?? []
        const m = ms.find((x) => String(x.id) === String(body.milestoneId))
        switch (body.action) {
          case 'complete_milestone':
            if (!m) return bad('not_found')
            m.doneAt = m.doneAt ? null : iso(now)
            p.tasksDone = ms.filter((x) => x.doneAt).length
            break
          case 'ready_milestone': {
            // P-14: an unpaid stage is refused with a hint, a repeat is a success.
            if (!m) return bad('not_found')
            if (m.state === 'awaiting_payment') return bad('not_paid', { hint: `Этап ${m.stageNo} ещё не оплачен: сначала счёт этапа, потом отметка «готов».` })
            if (m.state === 'in_progress') m.state = 'awaiting_acceptance'
            break
          }
          case 'set_deadline':
            if (!m) return bad('not_found')
            m.dueAt = String(body.dueAt)
            break
          case 'set_status':
            p.status = body.status
            break
          case 'note':
            projectNotes.set(String(p.id), [...(projectNotes.get(String(p.id)) ?? []), String(body.text)])
            break
          default:
            return bad('invalid')
        }
        return ok({ item: p })
      }
      return null
    }

    // ---- invoices
    if (seg[0] === 'crm' && seg[1] === 'invoices') {
      if (method === 'GET' && seg.length === 2) {
        return ok({ available: true, nextCursor: null, items: search(invoices, query, ['client', 'number', 'title'], 'status') })
      }
      const inv = seg[2] ? byId(invoices, seg[2]) : undefined
      if (method !== 'POST' || !inv) return bad('not_found')
      if (body.action === 'remind') {
        inv.remindedAt = iso(now)
        return ok({ item: inv, remindedVia: String(inv.client) === 'Pulse Gym' ? 'telegram' : 'owner' })
      }
      else if (body.action === 'mark_paid') {
        if (inv.status !== 'issued') return bad('illegal_transition', { from: inv.status })
        inv.status = 'paid'
        inv.paidAt = iso(now)
        inv.paidVia = 'manual'
      } else if (body.action === 'void') {
        if (inv.status === 'paid') return bad('illegal_transition', { from: inv.status })
        inv.status = 'void'
      } else return bad('invalid')
      return ok({ item: inv })
    }

    // The approval card a feed row points to: the mock review has cards for the waiting reel and carousel and for one decided
    // material per status; every other row is an «older material» (a card id nothing answers), shown read only.
    const mockReviewId = (i: Row) =>
      orders.some((o) => o.itemId === i.id) ? `ap_${i.id}` : i.status === 'pending' && i.kind === 'clip' ? 'ap_201' : i.status === 'pending' && i.kind === 'carousel' ? 'ap_202' : i.status === 'published' ? 'ap_199' : i.status === 'approved' ? 'ap_198' : i.status === 'rejected' ? 'ap_197' : `ap_${i.id}`
    // ---- content studio: the feed of everything and the orders (a working order is delivered on the next read)
    if (seg[0] === 'content' && seg[1] === 'feed' && method === 'GET' && seg.length === 2) {
      if (!items.size && !purged) content(currentWeek)
      const all = [...items.values()].reverse().filter((i) => (!query.status || i.status === query.status) && (!query.kind || i.kind === query.kind))
      const offset = /^\d{1,6}$/.test(String(query.cursor ?? '')) ? Number(query.cursor) : 0
      const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200)
      const origin = (id: unknown) => {
        const o = orders.find((x) => x.itemId === id)
        return o ? { orderId: o.id, mode: o.mode, fromItemId: o.fromItemId } : null
      }
      return ok({
        items: all.slice(offset, offset + limit).map((i) => ({ ...i, reviewId: mockReviewId(i), origin: origin(i.id) })),
        nextCursor: all.length > offset + limit ? String(offset + limit) : null,
        total: all.length,
      })
    }
    if (seg[0] === 'content' && seg[1] === 'purge' && seg.length === 2 && method === 'POST') {
      const allowed = ['draft', 'approved', 'rendering', 'ready', 'published', 'rejected']
      const keys = Object.keys(body)
      const statuses = Array.isArray(body.statuses) ? (body.statuses as unknown[]) : null
      if (keys.some((x) => x !== 'dryRun' && x !== 'statuses') || typeof body.dryRun !== 'boolean' || !statuses || statuses.some((x) => !allowed.includes(String(x)))) return bad('invalid', { allowed })
      if (!items.size && !purged) content(currentWeek)
      const gone = [...items.entries()].filter(([, i]) => i.status !== 'pending' && statuses.includes(i.status))
      const ids = new Set(gone.map(([, i]) => i.id))
      const goneOrders = orders.filter((o) => ids.has(o.itemId))
      const files = gone.reduce((n, [, i]) => n + (Array.isArray(i.files) ? i.files.length : 0), 0)
      const counts = { materials: gone.length, approvals: gone.filter(([, i]) => i.approvalId !== null).length, reviews: 0, files, orders: goneOrders.length, bytes: files * 120_000 }
      if (body.dryRun === false) {
        for (const [key] of gone) items.delete(key)
        for (const o of goneOrders) orders.splice(orders.indexOf(o), 1)
        purged = true
      }
      return ok({ dryRun: body.dryRun, counts })
    }
    if (seg[0] === 'content' && seg[1] === 'orders' && seg.length === 2) {
      if (method === 'GET') {
        if (!items.size && !purged) content(currentWeek)
        for (const o of orders.filter((x) => x.state === 'working')) {
          const from = o.fromItemId !== null ? [...items.values()].find((i) => i.id === o.fromItemId) : undefined
          const id = 900000 + Number(o.id)
          items.set(String(id), {
            id,
            kind: from?.kind ?? o.type ?? 'post',
            platform: 'instagram',
            status: 'pending',
            title: o.mode === 'prompt' ? String(o.prompt).slice(0, 80) : `${from?.title ?? 'Материал'} (${o.mode === 'niche' ? `под нишу: ${o.niche}` : 'ещё вариант'})`,
            hook: 'Новый хук от Content Maker.',
            caption: { instagram: 'Пример подписи от Content Maker.', tiktok: '', shorts: '', dzen: '' },
            files: [png(`order-${o.id}`)],
            sourceSlug: null,
            approvalId: null,
            publishedUrl: null,
            error: null,
            kit: null,
          })
          o.state = 'delivered'
          o.itemId = id
          o.reviewId = `ap_${id}`
          o.itemStatus = 'pending'
        }
        return ok({ items: [...orders].reverse() })
      }
      if (method === 'POST') {
        const mode = String(body.mode)
        if (mode === 'prompt' && String(body.prompt ?? '').trim().length < 3) return bad('invalid')
        if (mode !== 'prompt' && !Number.isInteger(body.fromItemId)) return bad('invalid')
        if (mode === 'niche' && !String(body.niche ?? '').trim()) return bad('invalid')
        if (!['prompt', 'variant', 'niche'].includes(mode)) return bad('invalid')
        const order: Row = {
          id: 700 + orders.length,
          mode,
          prompt: mode === 'prompt' ? String(body.prompt).trim() : String(body.note ?? ''),
          type: mode === 'prompt' ? String(body.type ?? 'clip') : null,
          niche: mode === 'niche' ? String(body.niche) : null,
          fromItemId: mode === 'prompt' ? null : Number(body.fromItemId),
          state: 'working',
          error: null,
          createdAt: iso(Date.now()),
          itemId: null,
          reviewId: null,
          itemStatus: null,
        }
        orders.push(order)
        return ok({ order })
      }
      return null
    }
    // ---- content
    if (seg[0] === 'content') {
      if (method === 'GET' && seg.length === 1) {
        const week = typeof query.week === 'string' && /^\d{4}-W\d{2}$/.test(query.week) ? query.week : currentWeek
        const days = content(week)
        return ok({ week, days, summary: summaryOf(days) })
      }
      if (method === 'POST' && seg.length === 2) {
        if (!items.size && !purged) content(currentWeek)
        const item = items.get(seg[1]!) ?? [...items.values()].find((i) => String(i.id) === seg[1])
        if (!item) return bad('not_found')
        const next: Record<string, string> = { approve: 'approved', reject: 'rejected', revise: 'draft', published: 'published', rerender: 'rendering' }
        const status = next[String(body.action)]
        if (!status) return bad('invalid')
        item.status = status
        item.error = body.action === 'revise' ? `Правки: ${String(body.note ?? '').slice(0, 200)}` : null
        if (body.action === 'published') item.publishedUrl = 'https://www.instagram.com/p/demo/'
        return ok({ item })
      }
      return null
    }

    // ---- metrics
    if (method === 'GET' && path === 'metrics/week') {
      const week = typeof query.week === 'string' && /^\d{4}-W\d{2}$/.test(query.week) ? query.week : currentWeek
      const seed = Number(week.slice(-2)) || 1
      const block = (s: number) => ({
        site: { chat_open: 40 + s * 3, builder_done: 9 + (s % 5), estimate_pdf: 5 + (s % 4), lead_sent: 6 + (s % 3), audit_sent: 2 + (s % 2), ref_click: 3 + (s % 4), cabinet_signup: 1 + (s % 3), pay_view: 4 + (s % 2), blog_view: 120 + s * 7 },
        blog: { hits: 120 + s * 7, published: 5 + (s % 3) },
        youtube: { shorts: 4 + (s % 3), views: 900 + s * 41, subscribers: 37 + s, delta: 3 + (s % 4) },
        funnel: { leads: 11 + (s % 4), qualified: 7 + (s % 3), proposals: 4 + (s % 2), contracts: 2 + (s % 2), paid: 1 + (s % 2), projects: 1 },
        money: { invoicedUsd: 900 + (s % 5) * 150, paidUsd: 600 + (s % 4) * 150 },
      })
      const cur = block(seed)
      const dates = weekDates(week)
      const days = dates.map((date, i) => {
        const w = 0.4 + ((i * 5 + seed) % 7) / 7
        const part = (n: number) => Math.round((n / 7) * w * (i === 6 ? 0.4 : 1))
        return { date, site: Object.fromEntries(Object.entries(cur.site).map(([k, v]) => [k, part(v)])), blog: { hits: part(cur.blog.hits) }, leads: part(cur.funnel.leads) }
      })
      return ok({ week, ...cur, days, prevWeek: block(Number(shiftWeek(week, -1).slice(-2)) || 1) })
    }

    // ---- calendar (read only): calls, milestones, routine runs and planned content of a range
    if (seg[0] === 'calendar' && method === 'GET' && seg.length === 1) {
      const dateOk = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
      if (!dateOk(query.from) || !dateOk(query.to)) return bad('invalid')
      const from = Date.parse(`${query.from}T00:00:00Z`)
      const to = Date.parse(`${query.to}T00:00:00Z`) + 86_400_000
      if (!(to > from) || to - from > 62 * 86_400_000) return bad('range_too_long')
      const events: Row[] = []
      const day = 86_400_000
      const at = (d: number, h: number, m = 0) => d * day + h * 3_600_000 + m * 60_000
      for (let d = Math.floor(from / day); d < to / day; d++) {
        const wd = new Date(d * day).getUTCDay()
        // a daily routine at 09:00 and a weekly pack on Monday 06:00
        events.push({ id: `routine:marketing-daily-today:${at(d, 9)}`, kind: 'routine', at: iso(at(d, 9)), allDay: false, title: 'Контент на сегодня', detail: '0 9 * * *', dept: 'marketing', status: 'scheduled', link: 'routines:marketing-daily-today' })
        if (wd === 1) events.push({ id: `routine:marketing-weekly-pack:${at(d, 6)}`, kind: 'routine', at: iso(at(d, 6)), allDay: false, title: 'Недельный пакет контента', detail: '0 6 * * 1', dept: 'marketing', status: 'scheduled', link: 'routines:marketing-weekly-pack' })
        // content planned every second day, a call every third, a milestone every fifth (days counted from the epoch, stable between requests)
        if (d % 2 === 0) events.push({ id: `content:${d}`, kind: 'content', at: iso(at(d, 0)), allDay: true, title: d % 4 === 0 ? 'Рилс: запись без звонков' : 'Пост: ИИ-администратор', detail: d % 4 === 0 ? 'clip' : 'post', dept: 'marketing', status: d % 4 === 0 ? 'approved' : 'pending', link: `content:item:${(d % 7) + 1}` })
        if (d % 3 === 0) events.push({ id: `call:${d}`, kind: 'call', at: iso(at(d, 11, 30)), allDay: false, title: d % 6 === 0 ? 'Мадина' : 'Pulse Gym', detail: d % 6 === 0 ? 'bots' : 'automation', dept: 'sales', status: d % 6 === 0 ? 'confirmed' : 'pending', link: `calls:${(d % 5) + 3}` })
        if (d % 5 === 0) events.push({ id: `milestone:${d}`, kind: 'milestone', at: iso(at(d, 15)), allDay: false, title: d % 10 === 0 ? 'Прототип' : 'Сдача', detail: 'Алиса', dept: 'production', status: 'open', link: 'projects:2' })
      }
      events.sort((a, b) => String(a.at).localeCompare(String(b.at)) || String(a.id).localeCompare(String(b.id)))
      const counts = { call: 0, milestone: 0, routine: 0, content: 0 } as Record<string, number>
      for (const e of events) counts[String(e.kind)] = (counts[String(e.kind)] ?? 0) + 1
      return ok({ from: query.from, to: query.to, tz: 'Asia/Tashkent', today: iso(now).slice(0, 10), counts, events })
    }

    // ---- audit log (read only): decisions, settings, instructions, trust levels and owner actions, newest first, paged by cursor
    if (seg[0] === 'audit' && method === 'GET' && seg.length === 1) {
      const kinds = ['decision', 'setting', 'instruction', 'trust', 'owner']
      if (query.kind && !kinds.includes(String(query.kind))) return bad('invalid')
      const entries: Row[] = []
      const actions: [string, string, string, string, string][] = [
        ['decision', 'owner', 'decision', 'approval', 'lead_reply approve'],
        ['setting', 'owner', 'setting_changed', 'setting', 'quiet_hours'],
        ['instruction', 'owner', 'instructions_changed', 'agent', 'v2'],
        ['trust', 'owner', 'level_set', 'kind', '1'],
        ['owner', 'owner', 'chat_reply', 'chat', 'web:sent'],
        ['decision', 'system', 'decision', 'approval', 'content_item auto'],
      ]
      for (let i = 0; i < 60; i++) {
        const [kind, actor, action, objectType, detail] = actions[i % actions.length]!
        const objectId = kind === 'instruction' ? 'marketing-head' : kind === 'setting' ? 'quiet_hours' : String(100 - i)
        entries.push({ id: `${kind.slice(0, 3)}:${100 - i}`, kind, at: iso(now - (i + 1) * 47 * 60_000), actor, action, objectType, objectId, detail })
      }
      const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? Date.parse(`${v}T00:00:00Z`) : null)
      const lo = day(query.from)
      const hi = day(query.to)
      const keep = (e: Row) => (!query.kind || e.kind === query.kind) && (!query.actor || e.actor === query.actor) && (lo === null || Date.parse(String(e.at)) >= lo) && (hi === null || Date.parse(String(e.at)) < hi + 86_400_000)
      const rows = entries.filter(keep)
      const offset = /^\d{1,6}_0_0$/.test(String(query.cursor ?? '')) ? Number(String(query.cursor).split('_')[0]) : 0
      const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200)
      const page = rows.slice(offset, offset + limit)
      const counts = Object.fromEntries(kinds.map((k) => [k, entries.filter((e) => e.kind === k && (!query.actor || e.actor === query.actor)).length]))
      return ok({ tz: 'Asia/Tashkent', kinds, counts, total: rows.length, actors: ['owner', 'system'], nextCursor: offset + limit < rows.length ? `${offset + limit}_0_0` : null, entries: page })
    }

    // ---- analytics (read only): the funnel and site events of «Цифры» for a week and the previous one, first answer time, sources
    if (seg[0] === 'analytics' && method === 'GET' && seg.length === 1) {
      const week = typeof query.week === 'string' && /^\d{4}-W\d{2}$/.test(query.week) ? query.week : isoWeek(now)
      if (query.week && week !== query.week) return bad('invalid')
      const cur = ((): Row => ({ leads: 14, qualified: 9, proposals: 5, contracts: 3, paid: 2, projects: 2 }))()
      const prev: Row = { leads: 11, qualified: 6, proposals: 4, contracts: 2, paid: 1, projects: 1 }
      const site = { chat_open: 63, builder_done: 18, estimate_pdf: 7, lead_sent: 14, audit_sent: 3, ref_click: 9, cabinet_signup: 5, pay_view: 4, blog_view: 120, cabinet_offer_click: 2 }
      const prevSite = { chat_open: 48, builder_done: 21, estimate_pdf: 5, lead_sent: 11, audit_sent: 4, ref_click: 6, cabinet_signup: 3, pay_view: 2, blog_view: 96, cabinet_offer_click: 0 }
      const from = weekDates(week)[0] ?? ''
      const to = weekDates(week)[6] ?? ''
      return ok({
        week, from, to, prevWeek: shiftWeek(week, -1), tz: 'Asia/Tashkent', funnel: cur, prevFunnel: prev, site, prevSite,
        firstResponse: { leads: 14, answered: 12, avgMinutes: 18.5, medianMinutes: 9, within1hShare: 0.83 },
        prevFirstResponse: { leads: 11, answered: 9, avgMinutes: 41, medianMinutes: 22, within1hShare: 0.56 },
        sources: [{ source: 'site', leads: 9, qualified: 6, paid: 1 }, { source: 'bot', leads: 3, qualified: 2, paid: 1 }, { source: 'ref', leads: 2, qualified: 1, paid: 0 }],
      })
    }

    // ---- processes
    if (seg[0] === 'processes') {
      const step = (id: string, title: string, hint: string, health: string, lastMin: number | null, failures = 0, stuck = 0, failure: string | null = null) => ({
        id, title, hint, health, lastOkAt: lastMin === null ? null : ago(lastMin), failures7d: failures, stuck, lastFailure: failure ? { at: ago(90), text: failure } : null,
      })
      const view = () => {
        const chains = [
          { id: 'client', title: 'Заявка, КП, договор, оплата, производство, приёмка', health: 'fail', steps: [
            step('lead', 'Заявка принята', 'Сайт, чат или Telegram: лид и задача Продаж', 'ok', 12),
            step('quote', 'КП у клиента', 'Одобрено владельцем, ушло в кабинет и на почту', 'warn', 300, 1, 0, 'письмо не ушло: timeout'),
            step('accept', 'КП принято', 'Клиент нажал «Принять»', 'ok', 60 * 26),
            step('contract', 'Договор у клиента', 'Черновик одобрен, ушёл на подпись', 'ok', 60 * 30),
            step('sign', 'Договор подписан', 'Подпись мышью и подписанный PDF', 'fail', 60 * 50, 1, 0, 'подписан, но PDF не собран'),
            step('invoice', 'Счёт выставлен', 'Счёт этапа, ссылка на оплату, письмо', 'ok', 60 * 10),
            step('paid', 'Оплата получена', 'Сеть или вручную', 'warn', 60 * 20, 0, 1),
            step('project', 'Проект в работе', 'Проект и вехи, ТЗ, строитель', 'ok', 60 * 24 * 2),
            step('stage', 'Этап принят', 'Готов этап, клиент принял', 'idle', null),
            step('act', 'Акт выдан', 'Последний этап принят, акт в документах', 'idle', null),
          ] },
          { id: 'support', title: 'Поддержка', health: 'ok', steps: [
            step('ticket', 'Тикет принят', 'Кабинет, Telegram или чат агента', 'ok', 60 * 3),
            step('answer', 'Ответ клиенту', 'SLA 4 часа', 'ok', 60 * 4),
          ] },
          { id: 'content', title: 'Контент-конвейер', health: 'ok', steps: [
            step('trends', 'Тренды', 'Разведка трендов дня и недели', 'ok', 60 * 7),
            step('make', 'Материал недели', 'Тексты и визуал, затем ревью', 'ok', 60 * 9),
            step('publish', 'Публикация', 'Пакет публикации только из одобренного', 'idle', null),
          ] },
          { id: 'letters', title: 'Письма и уведомления клиентам', health: 'ok', steps: [step('mail', 'Письма ушли', 'Сбои пишутся в журнал и раз в час владельцу', 'ok', 40)] },
          { id: 'infra', title: 'Рутины, одобрения, учёт', health: 'ok', steps: [
            step('routines', 'Рутины по расписанию', 'Каждая включённая рутина отрабатывает и не зависает', 'ok', 15),
            step('approvals', 'Одобрения исполняются', 'Решение владельца доходит до действия', 'ok', 130),
          ] },
        ]
        const counts: Record<string, number> = { ok: 0, warn: 0, fail: 0, idle: 0 }
        for (const c of chains) for (const s of c.steps) counts[s.health] = (counts[s.health] ?? 0) + 1
        const rows = drillRows
        const c = { ok: 0, wait: 0, fail: 0, run: 0 } as Record<string, number>
        for (const r of rows) c[String(r.state)] = (c[String(r.state)] ?? 0) + 1
        const state = drillStartedAt === null ? 'none' : c.run ? 'running' : 'done'
        return { generatedAt: iso(now), windowDays: 7, counts, chains, drill: { state, startedAt: drillStartedAt === null ? null : iso(drillStartedAt), elapsedMs: drillStartedAt === null ? 0 : now - drillStartedAt, openApprovals: 0, counts: c, rows } }
      }
      if (method === 'GET' && seg.length === 1) {
        // the mock drill finishes by itself 20 s after the start
        if (drillStartedAt !== null && now - drillStartedAt > 20_000) drillRows = drillRows.map((r) => (r.state === 'run' ? { ...r, state: 'ok', ms: 4000, text: 'готово' } : r))
        return ok(view())
      }
      if (method === 'POST' && seg[1] === 'drill') {
        if (body.action === 'clear') {
          drillStartedAt = null
          drillRows = []
          return ok({ action: 'clear', text: 'Учения очищены: задач 17, неотвеченных одобрений отклонено 0. Данные, помеченные «Тест учения», удалены.', drill: view().drill })
        }
        if (body.action !== 'start') return bad('bad_request')
        if (drillStartedAt === null) {
          drillStartedAt = now
          drillRows = [
            { worker: 'trend-scout', title: 'Trend Scout', state: 'run', ms: -1, text: 'ещё не начато' },
            { worker: 'lead-intake', title: 'Lead manager', state: 'run', ms: -1, text: 'ещё не начато' },
            { worker: 'customer-support', title: 'Support agent', state: 'run', ms: -1, text: 'ещё не начато' },
            { worker: 'monitoring', title: 'Monitor', state: 'ok', ms: 1200, text: 'проверки выполнены, всё в норме' },
          ]
        }
        return ok({ action: 'start', text: 'Учения начались: задач 17, до 30 секунд на первые результаты.', drill: view().drill })
      }
      return bad('not_found')
    }

    // ---- company
    if (seg[0] === 'company') {
      if (method === 'GET' && seg.length === 1) {
        return ok({
          routines,
          tools: [
            { name: 'web.search', departments: ['marketing', 'sales', 'director'], configured: true, callsToday: 14, errorsToday: 0, limits: { timeoutMs: 8000, minGapMs: 1000, cacheTtlMs: 3_600_000, maxResults: 10 }, env: ['BRAVE_SEARCH_KEY'] },
            { name: 'web.readable', departments: ['marketing', 'sales', 'director'], configured: true, callsToday: 9, errorsToday: 2, limits: { timeoutMs: 8000 }, env: [] },
            { name: 'media.png', departments: ['marketing'], configured: true, callsToday: 21, errorsToday: 0, limits: { timeoutMs: 20000 }, env: [] },
            { name: 'media.pdf', departments: ['sales', 'backoffice'], configured: false, callsToday: 0, errorsToday: 0, limits: {}, env: [] },
            { name: 'google.youtube.channel', departments: ['marketing', 'director'], configured: false, callsToday: 0, errorsToday: 1, limits: { timeoutMs: 10000 }, env: ['YT_OAUTH_CLIENT_JSON', 'YT_REFRESH_TOKEN', 'YOUTUBE_API_KEY'] },
            { name: 'google.trends', departments: ['marketing', 'director'], configured: true, callsToday: 3, errorsToday: 0, limits: { cacheTtlMs: 3_600_000 }, env: [] },
            { name: 'email.send', departments: ['support', 'sales', 'backoffice'], configured: false, callsToday: 0, errorsToday: 0, limits: {}, env: ['RESEND_API_KEY', 'RESEND_FROM'] },
          ],
          costs: {
            byDept: {
              marketing: { todayUsd: 0.42, monthUsd: 6.8, limitUsd: 15 },
              sales: { todayUsd: 0.18, monthUsd: 3.1, limitUsd: 10 },
              support: { todayUsd: 0.05, monthUsd: 0.9, limitUsd: 5 },
              production: { todayUsd: 0, monthUsd: 0.4, limitUsd: 5 },
              backoffice: { todayUsd: 0.02, monthUsd: 0.3, limitUsd: 3 },
              director: { todayUsd: 0.11, monthUsd: 2.2, limitUsd: 0 },
            },
            byDay: Array.from({ length: 14 }, (_, i) => ({ date: iso(now - (13 - i) * 86_400_000).slice(0, 10), usd: Math.round((0.4 + ((i * 7) % 5) * 0.15) * 100) / 100 })),
          },
          trust,
          playbooks,
          workers: [
            { id: 'content-maker', dept: 'marketing', title: 'Content Maker', state: 'working' },
            { id: 'publisher', dept: 'marketing', title: 'Publisher', state: 'idle' },
            { id: 'renderer', dept: 'marketing', title: 'Renderer', state: 'working' },
            { id: 'lead-intake', dept: 'sales', title: 'Lead manager', state: 'idle' },
            { id: 'prospector', dept: 'sales', title: 'Prospector', state: 'sleeping' },
            { id: 'billing', dept: 'backoffice', title: 'Finance', state: 'idle' },
            { id: 'project-manager', dept: 'production', title: 'Project Manager', state: 'paused' },
          ],
        })
      }
      if (method === 'GET' && seg[1] === 'playbooks' && seg.length === 3) {
        return playbooks.some((x) => x.role === seg[2]) ? ok({ role: seg[2], text: playbookText(seg[2]!) }) : bad('not_found')
      }
      if (method === 'POST' && seg[1] === 'routines' && seg[2]) {
        const r = routines.find((x) => x.name === seg[2])
        if (!r) return bad('not_found')
        if (seg[3] === 'run') {
          if (!r.enabled) return bad('not_started', { reason: 'disabled' })
          r.lastRunAt = iso(now)
          r.lastStatus = 'running'
          return ok({ taskId: 700 + Math.floor(now / 1000) % 100 })
        }
        r.enabled = body.enabled === true
        return ok({ item: r })
      }
      if (method === 'POST' && seg[1] === 'trust' && seg[2]) {
        const t = trust.find((x) => x.kind === seg[2])
        if (!t) return bad('not_found')
        t.level = body.level === 1 ? 1 : 0
        return ok({ item: t })
      }
      return null
    }
    return null
  }
}
