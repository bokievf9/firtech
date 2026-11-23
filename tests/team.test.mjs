// Team (2026-11-24): the contract view models, the proxy whitelist, mentions and routing, presence, the dev mock and the wiring.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

const src = pathToFileURL(path.resolve('src') + '/').href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true }
    if (specifier.startsWith('@/')) {
      const base = new URL(specifier.slice(2), src).href
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
        try {
          return next(candidate, context)
        } catch (e) {
          if (e?.code !== 'ERR_MODULE_NOT_FOUND') throw e
        }
      }
    }
    return next(specifier, context)
  },
})

const team = await import('../src/lib/team.ts')
const shell = await import('../src/lib/hq-shell.ts')
const proxy = await import('../src/lib/hq-admin.ts')
const { resolveEndpoint } = proxy
const { createTeamMock } = await import('../src/lib/team-mock.ts')
const q = (o = {}) => new URLSearchParams(o)
const NOW = Date.parse('2026-11-24T10:00:00Z')
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

test('a card leads into a fixed Shell route by its kind; HQ href is never followed', () => {
  assert.equal(team.cardHref({ kind: 'task', id: '12' }), '/admin/tasks?task=12')
  assert.equal(team.cardHref({ kind: 'lead', id: '6' }), '/admin/clients?tab=pipeline&focus=6')
  assert.equal(team.cardHref({ kind: 'client', id: '3' }), '/admin/clients?tab=clients&focus=3')
  assert.equal(team.cardHref({ kind: 'project', id: '3' }), '/admin/projects?focus=3')
  assert.equal(team.cardHref({ kind: 'invoice', id: '14' }), '/admin/finance?tab=invoices&focus=14')
  assert.equal(team.cardHref({ kind: 'document', id: 'kp_1' }), '/admin/documents?tab=documents&focus=kp_1')
  assert.equal(team.cardHref({ kind: 'order', id: 'o' }), '/admin/content?tab=orders')
  assert.equal(team.cardHref({ kind: 'plan', id: 'p' }), '/admin/calendar')
  assert.equal(team.cardHref({ kind: 'rule', id: 'r' }), '/admin/content?tab=rules')
  assert.equal(team.cardHref({ kind: 'metric', id: 'm' }), '/admin/analytics')
  assert.equal(team.cardHref({ kind: 'item', id: '41' }), '/admin/content?tab=feed&focus=41')
  assert.equal(team.CARD_KINDS.length, 11)
  assert.equal(JSON.stringify(team.parseCard({ kind: 'lead', id: '6', title: 'T', href: 'https://evil.example/x' })).includes('evil'), false)
  assert.equal(team.parseCard({ kind: 'campaign', id: 'a' }), null)
  assert.equal(team.parseCard({ kind: 'task', id: '../x' }), null)
  // A recent result keeps its href only when it is a Shell route.
  const card = team.normalizeMemberCard({ ok: true, id: 'finance', title: 'Finance', dept: 'backoffice', recent: [{ at: '2026-11-24T09:00:00Z', kind: 'task', title: 'a', href: '/admin/tasks?task=1' }, { at: '2026-11-24T09:00:00Z', kind: 'task', title: 'b', href: 'https://evil.example' }], instructions: { version: 2 } })
  assert.deepEqual(card.recent.map((r) => r.href), ['/admin/tasks?task=1', null])
})

test('mentions: parsing, routing to an assignment, the autocomplete token', () => {
  assert.deepEqual(team.parseMentions('привет @finance и @nobody, @lead-intake').map((m) => m.id), ['finance', 'lead-intake'])
  assert.deepEqual(team.parseMentions('mail a@finance.com'), [])
  assert.deepEqual(team.routeMessage('@finance сверь счета за ноябрь', 'director'), { kind: 'assign', agent: 'finance', text: 'сверь счета за ноябрь' })
  assert.deepEqual(team.routeMessage('@finance', 'director'), { kind: 'chat', text: '@finance' })
  assert.deepEqual(team.routeMessage('@director что нового', 'director'), { kind: 'chat', text: 'что нового' })
  assert.deepEqual(team.routeMessage('@ghost задача', 'director'), { kind: 'chat', text: '@ghost задача' })
  assert.deepEqual(team.routeMessage('просто вопрос @finance', 'director'), { kind: 'chat', text: 'просто вопрос @finance' })
  assert.deepEqual(team.activeMention('сделай @fin', 11), { query: 'fin', start: 7 })
  assert.equal(team.activeMention('сделай @fin ', 12), null)
  assert.equal(team.activeMention('a@fin', 5), null)
  const list = [{ id: 'finance', title: 'Finance' }, { id: 'documents', title: 'Documents' }, { id: 'billing', title: 'Billing' }]
  assert.deepEqual(team.suggestMembers(list, 'fin').map((m) => m.id), ['finance'])
  assert.deepEqual(team.suggestMembers(list, 'DOC').map((m) => m.id), ['documents'])
  assert.equal(team.suggestMembers(list, '').length, 3)
  assert.deepEqual(team.applyMention('сделай @fin', 11, 7, 'finance'), { text: 'сделай @finance ', caret: 16 })
})

test('presence badge: four states with words, unknown values count as off', () => {
  assert.deepEqual(team.presenceBadge('working'), { label: 'Working', tone: 'ok' })
  assert.deepEqual(team.presenceBadge('waiting'), { label: 'Waiting for you', tone: 'warn' })
  assert.deepEqual(team.presenceBadge('idle'), { label: 'Idle', tone: 'muted' })
  assert.deepEqual(team.presenceBadge('off'), { label: 'Off', tone: 'off' })
  assert.equal(team.parseMember({ id: 'finance', presence: 'bogus' }).presence, 'off')
  assert.equal(team.parseMember({ id: 'Bad Id' }), null)
  assert.equal(team.initials('Head of Back Office'), 'HO')
  assert.equal(team.initials('Finance'), 'FI')
})

test('chips by role and the marketing chat is reused', () => {
  const ids = (m) => team.chipsFor(m).map((c) => c.id)
  assert.deepEqual(ids({ id: 'sales-head', dept: 'sales' }), ['leads', 'kp', 'now'])
  assert.equal(team.chipsFor({ id: 'presales', dept: 'sales' })[0].text, 'Что с лидами')
  assert.equal(team.chipsFor({ id: 'presales', dept: 'sales' })[1].fill, true)
  assert.equal(team.chipsFor({ id: 'customer-support', dept: 'support' })[0].text, 'Открытые тикеты')
  assert.equal(team.chipsFor({ id: 'project-manager', dept: 'production' })[0].text, 'Статус проектов')
  assert.equal(team.chipsFor({ id: 'finance', dept: 'backoffice' })[0].text, 'Кто не оплатил')
  assert.equal(team.usesMarketingChat('marketing-head'), true)
  assert.equal(team.usesMarketingChat('content-maker'), false)
  assert.equal(team.teamIdOf('lead-handler'), 'lead-intake')
  assert.equal(team.teamIdOf('finance'), 'finance')
})

test('the members are grouped by department in the fixed order, the head first', () => {
  const mk = (id, dept) => team.parseMember({ id, title: id, dept, presence: 'idle' })
  const groups = team.groupMembers([mk('finance', 'backoffice'), mk('content-maker', 'marketing'), mk('marketing-head', 'marketing'), mk('director', 'hq')])
  assert.deepEqual(groups.map((g) => g.dept), ['hq', 'marketing', 'backoffice'])
  assert.deepEqual(groups[1].members.map((m) => m.id), ['marketing-head', 'content-maker'])
})

test('standup: view model, dates and the Inbox lines', () => {
  const s = team.normalizeStandup({ ok: true, date: '2026-11-24', postedToInboxAt: '2026-11-24T04:00:00Z', entries: [{ agent: 'finance', did: ['a'], plan: ['b'], need: ['c'] }, { agent: 'Bad Id', did: [] }] })
  assert.equal(s.entries.length, 1)
  assert.deepEqual(team.standupLines(s.entries[0]), ['Did: a', 'Plan: b', 'Needs: c'])
  assert.equal(team.standupLines({ agent: 'x', did: ['1', '2'], plan: ['3', '4'], need: [] }).length, 3)
  assert.equal(team.shiftDate('2026-12-01', -1), '2026-11-30')
  assert.equal(team.shiftDate('2026-12-31', 1), '2027-01-01')
  assert.equal(team.standupPath(), 'team/standup')
  assert.equal(team.standupPath('2026-11-23'), 'team/standup?date=2026-11-23')
  assert.equal(team.standupPath('x'), 'team/standup')
})

test('the proxy whitelist: every route of the contract, strict bodies, `standup` is never an employee', () => {
  assert.equal(resolveEndpoint('GET', ['team'], q(), undefined).ok, true)
  assert.equal(resolveEndpoint('GET', ['team', 'finance'], q(), undefined).ok, true)
  assert.equal(resolveEndpoint('GET', ['team', 'standup'], q(), undefined).ok, true)
  assert.deepEqual(resolveEndpoint('GET', ['team', 'standup'], q({ date: '2026-11-23', x: '1' }), undefined).query, { date: '2026-11-23' })
  assert.deepEqual(resolveEndpoint('GET', ['team', 'finance', 'chat'], q({ limit: '50', before: 'm1', x: '1' }), undefined).query, { limit: '50', before: 'm1' })
  assert.equal(resolveEndpoint('GET', ['team', 'standup', 'chat'], q(), undefined).ok, false)
  assert.equal(resolveEndpoint('POST', ['team', 'standup', 'assign'], q(), { text: 'x' }).ok, false)
  assert.equal(resolveEndpoint('POST', ['team', 'standup', 'chat'], q(), { text: 'x' }).ok, false)
  assert.equal(resolveEndpoint('POST', ['team', 'finance', 'chat'], q(), { text: 'Кто не оплатил' }).ok, true)
  for (const body of [{}, { text: ' ' }, { text: 'a', extra: 1 }, { text: 'a'.repeat(2001) }]) assert.equal(resolveEndpoint('POST', ['team', 'finance', 'chat'], q(), body).ok, false, JSON.stringify(body))
  const ok = resolveEndpoint('POST', ['team', 'finance', 'assign'], q(), { text: 'Сверь счета', dueAt: '2026-11-30T12:00:00Z', refs: [{ kind: 'invoice', id: '14' }] })
  assert.equal(ok.ok, true)
  for (const body of [{}, { text: 'a', dueAt: 'tomorrow' }, { text: 'a', refs: [{ kind: 'nope', id: '1' }] }, { text: 'a', refs: [{ kind: 'task', id: '1', x: 1 }] }, { text: 'a', extra: 1 }]) assert.equal(resolveEndpoint('POST', ['team', 'finance', 'assign'], q(), body).ok, false, JSON.stringify(body))
  assert.equal(resolveEndpoint('POST', ['team', 'standup', 'reply'], q(), { agent: 'finance', text: 'Ок' }).ok, true)
  for (const body of [{ agent: 'finance' }, { text: 'x' }, { agent: 'Bad Id', text: 'x' }, { agent: 'finance', text: 'x', extra: 1 }]) assert.equal(resolveEndpoint('POST', ['team', 'standup', 'reply'], q(), body).ok, false, JSON.stringify(body))
  // Other methods and deeper paths are not on the list.
  assert.equal(resolveEndpoint('DELETE', ['team', 'finance'], q(), {}).ok, false)
  assert.equal(resolveEndpoint('PUT', ['team', 'finance', 'chat'], q(), { text: 'x' }).ok, false)
  assert.equal(resolveEndpoint('GET', ['team', 'finance', 'assign'], q(), undefined).ok, false)
  assert.equal(resolveEndpoint('GET', ['team', 'a', 'b', 'c'], q(), undefined).ok, false)
})

test('the dev mock: 23 employees with presence and `now`, chips answer with cards, a slow reply is pending, assign makes a task', () => {
  const tasks = []
  const mock = createTeamMock(NOW - 3_600_000, { addTask: (t) => (tasks.push(t), 70 + tasks.length) })
  const list = mock('GET', ['team'], {}, {}, NOW)
  assert.equal(list.members.length, 23)
  assert.deepEqual(list.members.map((m) => m.id), [...team.TEAM_IDS])
  assert.deepEqual(team.normalizeMembers(list).length, 23)
  assert.ok(list.members.some((m) => m.presence === 'working' && m.now))
  assert.ok(['working', 'waiting', 'idle', 'off'].every((p) => list.members.some((m) => m.presence === p)))
  const one = mock('GET', ['team', 'presales'], {}, {}, NOW)
  assert.equal(team.normalizeMemberCard(one).instructions.version, 3)
  assert.equal(mock('GET', ['team', 'ghost'], {}, {}, NOW).ok, false)

  const leads = mock('POST', ['team', 'presales', 'chat'], {}, { text: 'Что с лидами' }, NOW)
  assert.equal(team.normalizeReply(leads).reply.cards[0].kind, 'lead')
  assert.equal(team.normalizeReply(mock('POST', ['team', 'finance', 'chat'], {}, { text: 'Кто не оплатил' }, NOW)).reply.cards[0].kind, 'invoice')
  const chat = team.normalizeChat(mock('GET', ['team', 'presales', 'chat'], {}, {}, NOW))
  assert.deepEqual(chat.items.map((i) => i.role), ['agent', 'owner', 'agent'])

  const slow = mock('POST', ['team', 'finance', 'chat'], {}, { text: 'медленно' }, NOW)
  assert.ok(slow.pending)
  assert.equal(team.pendingDone(team.normalizeChat(mock('GET', ['team', 'finance', 'chat'], {}, {}, NOW + 1000)), slow.pending), false)
  assert.equal(team.pendingDone(team.normalizeChat(mock('GET', ['team', 'finance', 'chat'], {}, {}, NOW + 5000)), slow.pending), true)

  const before = list.members.find((m) => m.id === 'finance').queue
  const made = mock('POST', ['team', 'finance', 'assign'], {}, { text: 'Сверь счета' }, NOW)
  assert.deepEqual(made.task, { id: 71, href: '/admin/tasks?task=71' })
  assert.equal(tasks[0].assigneeId, 'finance')
  assert.equal(mock('GET', ['team'], {}, {}, NOW).members.find((m) => m.id === 'finance').queue, before + 1)

  const today = team.normalizeStandup(mock('GET', ['team', 'standup'], {}, {}, NOW))
  assert.ok(today.entries.length >= 5 && today.entries.every((e) => e.did.length + e.plan.length + e.need.length >= 2))
  assert.equal(mock('GET', ['team', 'standup'], { date: '2026-12-30' }, {}, NOW).entries.length, 0)
  assert.equal(mock('GET', ['team', 'standup'], { date: 'bad' }, {}, NOW).ok, false)
  const replied = mock('POST', ['team', 'standup', 'reply'], {}, { agent: 'lead-intake', text: 'Дожми оба диалога' }, NOW)
  assert.equal(replied.ok, true)
  const log = team.normalizeChat(mock('GET', ['team', 'lead-intake', 'chat'], {}, {}, NOW))
  assert.ok(log.items.some((i) => i.role === 'owner' && i.text === 'Дожми оба диалога'))
})

test('wiring: Team is the first of Company, with pages, a hint, the Inbox block, the office click and the slow chat path', () => {
  const byGroup = shell.HQ_SECTIONS.filter((x) => x.group === 'company').map((x) => x.id)
  assert.equal(byGroup[0], 'team')
  assert.equal(shell.sectionById('team').href, '/admin/team')
  assert.equal(shell.sectionOfPath('/admin/team/finance').id, 'team')
  assert.equal(shell.sectionOfPath('/admin/teams'), undefined)
  assert.equal(shell.sectionOfPath('/admin/office').id, 'office')
  assert.ok(read('src/content/admin.ts').includes("team: '"))
  assert.ok(read('src/app/admin/(hq)/team/page.tsx').includes('TeamSection'))
  assert.ok(read('src/app/admin/(hq)/team/[id]/page.tsx').includes('TeamMemberView'))
  assert.ok(read('src/components/admin/hq/sections.tsx').includes('<StandupInbox />'))
  assert.ok(read('src/components/admin/office/office-view.tsx').includes('/admin/team/'))
  assert.ok(read('src/app/api/admin/hq/[...path]/route.ts').includes('TEAM_CHAT_PATH'))
  assert.match('team/finance/chat', proxy.TEAM_CHAT_PATH)
  assert.doesNotMatch('team/standup/reply', proxy.TEAM_CHAT_PATH)
})
