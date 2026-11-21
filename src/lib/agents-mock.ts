// Development stand-in for HQ's `/admin/agents*` (contract `agents/docs/admin-crm-api.md` «Agents»): a small org with versioned
// instructions kept in memory, so an edit and a rollback behave like HQ until the dev server restarts.

type Reply = { ok: true; [k: string]: unknown } | { ok: false; error: string; [k: string]: unknown }
type Ver = { version: number; text: string; actor: string; note: string; at: string }

const ORG: { id: string; title: string; gloss: string | null; dept: string; role: 'director' | 'head' | 'worker'; boss: string | null; text: string; fira?: string }[] = [
  { id: 'director', title: 'Director', gloss: 'единый голос компании для владельца', dept: 'hq', role: 'director', boss: null, text: 'Ты Директор Fir Tech.\nОтвечай владельцу коротко.\n\n## Правила владельца\n- Цены только из прайса.', fira: 'executive-assistant' },
  { id: 'marketing-head', title: 'Head of Marketing', gloss: 'руководит маркетингом', dept: 'marketing', role: 'head', boss: 'director', text: 'Ты голова Маркетинга.\nГотовь пакет недели.\nНичего не публикуй без одобрения.' },
  { id: 'content-maker', title: 'Content Maker', gloss: 'клипы, посты, карусели и статьи', dept: 'marketing', role: 'worker', boss: 'marketing-head', text: '' },
  { id: 'publisher', title: 'Publisher', gloss: 'расписание и публикация', dept: 'marketing', role: 'worker', boss: 'marketing-head', text: '' },
  { id: 'sales-head', title: 'Head of Sales', gloss: 'руководит продажами', dept: 'sales', role: 'head', boss: 'director', text: 'Ты голова Продаж.\nПервый ответ лиду в течение минуты.' },
  { id: 'lead-intake', title: 'Lead Handler', gloss: 'принимает заявки, отвечает за минуту', dept: 'sales', role: 'worker', boss: 'sales-head', text: '' },
  { id: 'client-bot', title: 'Client Assistant', gloss: 'отвечает клиентам в Telegram и на сайте', dept: 'sales', role: 'worker', boss: 'sales-head', text: 'Отвечай клиентам коротко.', fira: 'lead-manager' },
  { id: 'support-head', title: 'Head of Support', gloss: 'руководит сопровождением', dept: 'support', role: 'head', boss: 'director', text: 'Ты голова Сопровождения.' },
  { id: 'production-head', title: 'Head of Production', gloss: 'руководит производством', dept: 'production', role: 'head', boss: 'director', text: 'Ты голова Производства.' },
  { id: 'backoffice-head', title: 'Head of Back Office', gloss: 'руководит бэк-офисом', dept: 'backoffice', role: 'head', boss: 'director', text: 'Ты голова Бэк-офиса.' },
]
const BUDGET: Record<string, number> = { hq: 5, marketing: 25, sales: 20, support: 15, production: 15, backoffice: 10 }
const TOOLS = [
  { name: 'web.search', summary: 'search the web through the listed provider', configured: true, callsToday: 14, errorsToday: 0 },
  { name: 'knowledge.add', summary: 'add a lesson (exported weekly)', configured: true, callsToday: 1, errorsToday: 0 },
  { name: 'email.send', summary: 'send an email through Resend', configured: false, callsToday: 0, errorsToday: 0 },
]
const iso = (t: number) => new Date(t).toISOString()

export function createAgentsMock(start = Date.now()) {
  const versions = new Map<string, Ver[]>()
  const texts = new Map(ORG.map((a) => [a.id, a.text]))
  const find = (id: string) => ORG.find((a) => a.id === id)
  const ok = (extra: Record<string, unknown> = {}): Reply => ({ ok: true, ...extra })
  const bad = (error: string, extra: Record<string, unknown> = {}): Reply => ({ ok: false, error, ...extra })
  const vs = (id: string) => versions.get(id) ?? []

  function card(id: string): Reply {
    const a = find(id)
    if (!a) return bad('not_found')
    const text = texts.get(id) ?? ''
    const list = vs(id)
    const dept = a.dept
    return ok({
      agent: { id, title: a.title, gloss: a.gloss, dept, role: a.role, bossId: a.boss, status: 'active', bot: null },
      instructions: {
        text, version: list.at(-1)?.version ?? 0, chars: text.length, maxChars: 20000,
        versions: [...list].reverse().map((v) => ({ version: v.version, actor: v.actor, note: v.note, at: v.at, chars: v.text.length })),
      },
      trust: { level: a.role === 'worker' ? 0 : 1, kinds: [{ kind: `${dept}_reply`, level: 0, locked: false, streak: 3, threshold: 20 }, { kind: `${dept}_price`, level: 0, locked: true, streak: 0, threshold: 20 }] },
      tools: TOOLS,
      budget: { dept, deptLimitUsd: BUDGET[dept] ?? 0, deptMonthUsd: 4.2, limitOwnerId: `${dept}-head`, agentMonthUsd: a.role === 'worker' ? 1.3 : 0.6, agentTodayUsd: 0.08, agentMonthCalls: 41 },
      fira: a.fira
        ? { pack: a.fira, title: a.fira === 'lead-manager' ? 'ИИ-менеджер заявок' : 'ИИ-ассистент владельца', goal: 'Понять бизнес человека и довести до следующего шага.', tier: 'sonnet', tools: ['knowledge_search', 'price_list'], duties: 8, boundaries: 6, handoff: 3 }
        : null,
      history: {
        tasksByStatus: { done: 18, running: 1, assigned: 2 },
        decisionsByKind: { approve: 24, edit: 3, reject: 1 },
        recentTasks: [{ id: 412, status: 'done', at: iso(start - 3_600_000) }, { id: 409, status: 'done', at: iso(start - 7_200_000) }],
        recentDecisions: [{ approvalId: 88, kind: `${dept}_reply`, decision: 'approve', at: iso(start - 5_400_000) }],
      },
    })
  }

  function save(id: string, text: string, note: string, now: number): Reply {
    const prev = texts.get(id) ?? ''
    if (prev === text) return bad('unchanged')
    const list = versions.get(id) ?? []
    if (!list.length && prev) list.push({ version: 1, text: prev, actor: 'seed', note: '', at: iso(start) })
    list.push({ version: (list.at(-1)?.version ?? 0) + 1, text, actor: 'owner', note, at: iso(now) })
    versions.set(id, list)
    texts.set(id, text)
    return card(id)
  }

  return function handle(method: string, seg: string[], body: Record<string, unknown>, now: number): Reply | null {
    if (seg[0] !== 'agents') return null
    if (method === 'GET' && seg.length === 1) {
      return ok({
        departments: Object.entries(BUDGET).map(([id, budgetUsd]) => ({ id, budgetUsd, monthUsd: id === 'marketing' ? 6.8 : 1.1 })),
        agents: ORG.map((a) => ({
          id: a.id, title: a.title, gloss: a.gloss, dept: a.dept, role: a.role, bossId: a.boss, status: 'active', trustLevel: a.role === 'worker' ? 0 : 1,
          monthUsd: a.role === 'worker' ? 1.3 : 0.6, openTasks: a.role === 'worker' ? 1 : 0, instructionVersion: vs(a.id).at(-1)?.version ?? 0, hasFira: Boolean(a.fira),
        })),
      })
    }
    const id = seg[1]
    if (!id || !find(id)) return bad('not_found')
    if (method === 'GET' && seg.length === 2) return card(id)
    if (method === 'GET' && seg[2] === 'instructions' && seg.length === 4) {
      const v = vs(id).find((x) => x.version === Number(seg[3]))
      return v ? ok({ ...v }) : bad('not_found')
    }
    if (method === 'POST' && seg[2] === 'instructions' && seg.length === 3) {
      const text = typeof body.text === 'string' ? body.text.replace(/\r\n/g, '\n').trim() : ''
      return text ? save(id, text, typeof body.note === 'string' ? body.note : '', now) : bad('invalid')
    }
    if (method === 'POST' && seg[2] === 'instructions' && seg[3] === 'rollback') {
      const v = vs(id).find((x) => x.version === Number(body.version))
      if (!v) return bad('unknown_version')
      return save(id, v.text, typeof body.note === 'string' && body.note ? body.note : `rollback to v${v.version}`, now)
    }
    return bad('not_found')
  }
}
