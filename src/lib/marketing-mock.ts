// Development stand-in for HQ's marketing chat and rules (contract «Маркетинг-чат», 2026-11-24). In memory, scripted:
// the three chips and «Новая тема: …» get a fixed reply with cards (a plan, a rule, a metric, an order); a text with
// «медленно» answers 202 pending and the reply shows up in GET three seconds later. Nothing is ever published.
import { MAX_RULES, NEW_TOPIC_PREFIX } from './marketing-chat'

type Reply = { ok: true; [k: string]: unknown } | { ok: false; error: string }
type Rec = Record<string, unknown>
type Card = { kind: string; id: string; title: string; href: string; meta?: Record<string, string | number> }
type Msg = { id: string; role: 'owner' | 'fira'; text: string; at: string; cards?: Card[] }
type Version = { version: number; at: string; note: string; text: string }

const RULES_V1 = `# Правила маркетинга Fir Tech

## Голос
- Пишем по-человечески, коротко, без канцелярита и без обещаний, которые нельзя проверить.
- Цены только те, что в каталоге на сайте.

## Площадки
- Instagram: клипы и карусели, 3 публикации в неделю.
- Публикует только владелец через Согласования.

## Запреты
- Не менять цены и не обещать скидки.
- Не использовать чужие бренды и лица.`

export function createMarketingMock() {
  let msgs: Msg[] | null = null
  let versions: Version[] | null = null
  let pending: { id: string; readyAt: number; msg: Msg } | null = null
  let seq = 100

  const seed = (now: number) => {
    const at = (ago: number) => new Date(now - ago).toISOString()
    msgs = [
      { id: 'm1', role: 'owner', text: 'Привет, что в планах по маркетингу?', at: at(3_600_000) },
      {
        id: 'm2',
        role: 'fira',
        text: 'Привет. Правила на месте, в календаре пусто. Скажи «План на неделю», и я предложу слоты.',
        at: at(3_590_000),
        cards: [{ kind: 'rule', id: 'rules', title: 'Правила маркетинга, версия 1', href: '/admin/content?tab=rules', meta: { version: 1 } }],
      },
    ]
    versions = [{ version: 1, at: at(86_400_000), note: 'Первая версия', text: RULES_V1 }]
  }

  const scripted = (text: string): { text: string; cards: Card[]; actions: { type: string; ref?: string }[] } => {
    const t = text.toLowerCase()
    const id = ++seq
    if (t.includes('план на неделю'))
      return {
        text: 'Предлагаю три слота: вторник клип про ночные заявки, четверг карусель про цены, суббота история с отзывом. Ничего не уйдёт без твоего одобрения.',
        cards: [{ kind: 'plan', id: `plan_${id}`, title: 'План на неделю: 3 публикации', href: '/admin/calendar', meta: { slots: 3, orders: 2 } }],
        actions: [{ type: 'plan_proposed', ref: `plan_${id}` }],
      }
    if (t.includes('покажи правила'))
      return {
        text: `Сейчас действует версия ${versions![0]!.version}: голос, площадки и запреты. Открой карточку, чтобы поправить.`,
        cards: [{ kind: 'rule', id: 'rules', title: `Правила маркетинга, версия ${versions![0]!.version}`, href: '/admin/content?tab=rules', meta: { version: versions![0]!.version } }],
        actions: [{ type: 'none' }],
      }
    if (t.includes('что зашло'))
      return {
        text: 'За неделю лучше всех вышел клип про ночные заявки: 4 200 просмотров и 6 переходов на сайт. Карусель про цены слабее.',
        cards: [
          { kind: 'metric', id: 'week', title: 'Неделя: просмотры и переходы', href: '/admin/analytics', meta: { views: 4200, clicks: 6 } },
          { kind: 'item', id: '1', title: 'Клип: ночные заявки', href: '/admin/content?tab=feed&focus=1' },
        ],
        actions: [{ type: 'none' }],
      }
    if (text.startsWith(NEW_TOPIC_PREFIX) || t.includes('новая тема'))
      return {
        text: `Принято. Content Maker готовит материал на тему «${text.replace(NEW_TOPIC_PREFIX, '').slice(0, 80)}». Он придёт в Согласования.`,
        cards: [{ kind: 'order', id: `order_${id}`, title: 'Заказ материала', href: '/admin/content?tab=orders', meta: { state: 'working' } }],
        actions: [{ type: 'order_created', ref: `order_${id}` }],
      }
    return { text: 'Поняла. Могу составить план недели, показать правила или разобрать, что зашло.', cards: [], actions: [{ type: 'none' }] }
  }

  const rulesView = () => {
    const cur = versions![0]!
    return { ok: true as const, text: cur.text, version: cur.version, history: versions!.map(({ version, at, note }) => ({ version, at, note })) }
  }
  const addVersion = (text: string, note: string, now: number) => {
    versions!.unshift({ version: versions![0]!.version + 1, at: new Date(now).toISOString(), note, text })
  }

  return function handle(method: string, seg: string[], query: Rec, body: Rec, now: number): Reply | null {
    if (seg[0] !== 'marketing') return null
    if (!msgs) seed(now)
    if (pending && now >= pending.readyAt) {
      msgs!.push(pending.msg)
      pending = null
    }
    const path = seg.join('/')
    if (path === 'marketing/chat' && method === 'GET') {
      const limit = Math.min(Number(query.limit) || 50, 200)
      return { ok: true, items: msgs!.slice(-limit), rules: { version: versions![0]!.version, updatedAt: versions![0]!.at } }
    }
    if (path === 'marketing/chat' && method === 'POST') {
      const text = typeof body.text === 'string' ? body.text.trim() : ''
      if (!text) return { ok: false, error: 'invalid' }
      msgs!.push({ id: `m${++seq}`, role: 'owner', text, at: new Date(now).toISOString() })
      const r = scripted(text)
      const msg: Msg = { id: `m${++seq}`, role: 'fira', text: r.text, at: new Date(now + 3000).toISOString(), cards: r.cards }
      if (text.toLowerCase().includes('медленно')) {
        pending = { id: msg.id, readyAt: now + 3500, msg }
        return { ok: true, pending: msg.id }
      }
      msgs!.push(msg)
      return { ok: true, reply: { id: msg.id, text: msg.text, cards: r.cards }, actions: r.actions }
    }
    if (path === 'marketing/rules' && method === 'GET') return rulesView()
    if (path === 'marketing/rules' && method === 'PUT') {
      const text = typeof body.text === 'string' ? body.text : ''
      if (!text.trim() || text.length > MAX_RULES) return { ok: false, error: 'invalid' }
      if (text === versions![0]!.text) return { ok: false, error: 'unchanged' }
      addVersion(text, typeof body.note === 'string' && body.note ? body.note : 'Правка владельца', now)
      return rulesView()
    }
    if (path === 'marketing/rules/rollback' && method === 'POST') {
      const old = versions!.find((v) => v.version === body.version)
      if (!old) return { ok: false, error: 'not_found' }
      addVersion(old.text, `Откат к версии ${old.version}`, now)
      return rulesView()
    }
    if (path === 'marketing/plan/accept' && method === 'POST') return { ok: true, slots: 3, orders: 2 }
    return { ok: false, error: 'not_found' }
  }
}
