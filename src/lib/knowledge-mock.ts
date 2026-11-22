// Development stand-in for HQ's Knowledge and Quality endpoints (contract `docs/briefs/fira/knowledge-quality-api.md`): the same
// shapes, kept in memory so edits behave like HQ until the dev server restarts. Documents of the package are read only.
type Reply = { ok: true; [k: string]: unknown } | { ok: false; error: string; [k: string]: unknown }
type Rec = Record<string, unknown>
type Doc = { id: string; title: string; tier: 'public' | 'internal'; source: 'site' | 'company' | 'playbook' | 'owner'; text: string; updatedAt: string }

const TIERS = ['public', 'internal']
const SOURCES = ['site', 'company', 'playbook', 'owner']

export function createKnowledgeMock(start = Date.now()) {
  const ago = (min: number) => new Date(start - min * 60_000).toISOString()
  const docs: Doc[] = [
    { id: 'site-pricing', title: 'Цены и этапы оплаты', tier: 'public', source: 'site', text: 'Цены берутся из живого прайса. Оплата по этапам, каждый этап до его начала.', updatedAt: ago(60 * 5) },
    { id: 'site-guarantee', title: 'Гарантия первого этапа', tier: 'public', source: 'site', text: 'Если первый экран или первый сценарий не понравился, возвращаем оплату первого этапа.', updatedAt: ago(60 * 5) },
    { id: 'site-products', title: 'Продукты студии', tier: 'public', source: 'site', text: 'ИИ-администратор, ИИ-менеджер заявок, автоматизация, контент, Mini App, ИИ-команда.', updatedAt: ago(60 * 26) },
    { id: 'company-about', title: 'О компании', tier: 'public', source: 'company', text: 'Fir Tech: студия ИИ-агентов и автоматизации.', updatedAt: ago(60 * 48) },
    { id: 'company-roles', title: 'Роли агентов и уровни доверия', tier: 'internal', source: 'company', text: 'Директор, маркетинг, продажи, поддержка, производство, бэк-офис.', updatedAt: ago(60 * 48) },
    { id: 'pb-sales', title: 'Плейбук продаж', tier: 'internal', source: 'playbook', text: 'Первый ответ за час. Цены только из прайса. Скидки не обещаем.', updatedAt: ago(60 * 30) },
    { id: 'pb-support', title: 'Плейбук поддержки', tier: 'internal', source: 'playbook', text: 'SLA 4 часа, эскалация владельцу.', updatedAt: ago(60 * 30) },
    { id: 'pb-content', title: 'Плейбук контента', tier: 'internal', source: 'playbook', text: 'Один материал, одна мысль. Цифры только из метрик.', updatedAt: ago(60 * 12) },
    { id: 'ow_1', title: 'Не работаем с азартными играми', tier: 'internal', source: 'owner', text: 'Заказы на казино и ставки отклоняем вежливо, без объяснений сверх одной фразы.', updatedAt: ago(60 * 3) },
    { id: 'ow_2', title: 'График созвонов', tier: 'public', source: 'owner', text: 'Созвоны по будням с 10:00 до 18:00 по Душанбе.', updatedAt: ago(60 * 2) },
  ]
  let seq = 2
  let builtAt = ago(60 * 4)
  let rebuildAt = 0

  const lessons: { id: string; question: string; bad: string; good: string; tag: string; source: string; at: string }[] = [
    { id: 'l_1', question: 'Сколько стоит сайт?', bad: 'Сайт стоит 500 долларов.', good: 'Цена зависит от сборки проекта: соберите её в «Сборке проекта», сумма посчитается сразу.', tag: 'price', source: 'review', at: ago(60 * 6) },
    { id: 'l_2', question: 'Вы делаете сайты для казино?', bad: 'Да, конечно, делаем.', good: 'Такие проекты мы не берём.', tag: 'scope', source: 'thread', at: ago(60 * 20) },
    { id: 'l_3', question: 'Когда будет готово?', bad: 'Через три дня.', good: 'Срок зависит от состава проекта, точный срок будет в смете.', tag: 'timing', source: 'rating', at: ago(60 * 40) },
  ]
  let lessonSeq = 3
  let ratingSeq = 0
  const ratings: { id: string; messageId: string; thread: string; value: number; note: string; at: string }[] = []

  const bad = (error: string, extra: Rec = {}): Reply => ({ ok: false, error, ...extra })
  const meta = (d: Doc) => ({ id: d.id, title: d.title, tier: d.tier, source: d.source, updatedAt: d.updatedAt, chars: d.text.length })
  const iso = (n: number) => new Date(n).toISOString()

  return function handle(method: string, seg: string[], body: Rec, query: Rec, now: number): Reply | null {
    if (seg[0] === 'knowledge') {
      // A rebuild takes a few seconds: `builtAt` moves once it is over.
      if (rebuildAt && now >= rebuildAt) {
        builtAt = iso(rebuildAt)
        rebuildAt = 0
      }
      if (seg.length === 1 && method === 'GET') {
        if (query.tier && !TIERS.includes(String(query.tier))) return bad('invalid')
        if (query.source && !SOURCES.includes(String(query.source))) return bad('invalid')
        const needle = String(query.q ?? '').toLowerCase()
        const rows = docs.filter((d) => (!query.tier || d.tier === query.tier) && (!query.source || d.source === query.source) && (!needle || `${d.title} ${d.text}`.toLowerCase().includes(needle)))
        const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 500)
        return { ok: true, items: rows.slice(0, limit).map(meta), total: rows.length, builtAt }
      }
      if (seg.length === 1 && method === 'POST') {
        if (typeof body.title !== 'string' || !body.title.trim() || typeof body.text !== 'string' || !body.text.trim() || !TIERS.includes(String(body.tier))) return bad('invalid')
        const d: Doc = { id: `ow_${++seq}`, title: body.title.trim().slice(0, 200), text: body.text.trim(), tier: body.tier as Doc['tier'], source: 'owner', updatedAt: iso(now) }
        docs.push(d)
        return { ok: true, item: meta(d) }
      }
      if (seg.length === 2 && seg[1] === 'rebuild' && method === 'POST') {
        rebuildAt = now + 3000
        return { ok: true, queued: true }
      }
      if (seg.length === 2) {
        const d = docs.find((x) => x.id === seg[1])
        if (!d) return bad('not_found')
        if (method === 'GET') return { ok: true, item: { id: d.id, title: d.title, tier: d.tier, source: d.source, text: d.text, updatedAt: d.updatedAt } }
        if (d.source !== 'owner') return bad('readonly_source')
        if (method === 'DELETE') {
          docs.splice(docs.indexOf(d), 1)
          return { ok: true }
        }
        if (method === 'PATCH') {
          if (body.tier !== undefined && !TIERS.includes(String(body.tier))) return bad('invalid')
          if (typeof body.title === 'string' && body.title.trim()) d.title = body.title.trim().slice(0, 200)
          if (typeof body.text === 'string' && body.text.trim()) d.text = body.text.trim()
          if (body.tier !== undefined) d.tier = body.tier as Doc['tier']
          d.updatedAt = iso(now)
          return { ok: true, item: meta(d) }
        }
      }
      return null
    }
    if (seg[0] === 'quality') {
      if (seg[1] === 'lessons' && seg.length === 2 && method === 'GET') {
        const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200)
        return { ok: true, items: lessons.slice(0, limit) }
      }
      if (seg[1] === 'lessons' && seg.length === 3 && method === 'DELETE') {
        const i = lessons.findIndex((l) => l.id === seg[2])
        if (i < 0) return bad('not_found')
        lessons.splice(i, 1)
        return { ok: true }
      }
      if (seg[1] === 'rate' && seg.length === 2 && method === 'POST') {
        if (body.value !== 1 && body.value !== -1) return bad('invalid')
        if (typeof body.messageId !== 'string' || typeof body.thread !== 'string') return bad('invalid')
        const note = typeof body.note === 'string' ? body.note.trim() : ''
        const prev = ratings.findIndex((r) => r.messageId === body.messageId && r.thread === body.thread)
        if (prev >= 0) ratings.splice(prev, 1)
        const ratingId = `r_${++ratingSeq}`
        ratings.unshift({ id: ratingId, messageId: body.messageId, thread: body.thread, value: body.value, note, at: iso(now) })
        // A thumb down with a note becomes a lesson.
        if (body.value === -1 && typeof body.note === 'string' && body.note.trim()) {
          const id = `l_${++lessonSeq}`
          lessons.unshift({ id, question: `Сообщение ${body.messageId}`, bad: '(ответ агента)', good: body.note.trim(), tag: 'rating', source: 'rating', at: iso(now) })
          return { ok: true, id: ratingId, lessonId: id }
        }
        return { ok: true, id: ratingId }
      }
      if (seg[1] === 'ratings' && seg.length === 2 && method === 'GET') {
        const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 500)
        return { ok: true, items: ratings.slice(0, limit) }
      }
      if (seg[1] === 'eval' && seg.length === 2 && method === 'GET') {
        return { ok: true, last: { at: ago(60 * 9), runtime: 'fira', lead: { passed: 18, total: 20 }, red: { passed: 14, total: 15 }, handoffRate: 0.93, toolRate: 0.88 } }
      }
    }
    return null
  }
}
