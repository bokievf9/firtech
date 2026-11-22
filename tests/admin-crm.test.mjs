import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

const src = pathToFileURL(path.resolve('src') + '/').href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only')
      return { url: 'data:text/javascript,export{}', shortCircuit: true }
    if (specifier.startsWith('@/')) {
      const base = new URL(specifier.slice(2), src).href
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
        try {
          return next(candidate, context)
        } catch {}
      }
    }
    return next(specifier, context)
  },
})

const crm = await import('../src/lib/admin-crm.ts')

const base = {
  budget: '',
  estimate: '',
  locale: 'ru',
  page: '',
  inBot: false,
  service: 'websites',
  message: '',
  contact: '@x',
}
const lead = (id, extra = {}) => ({
  ...base,
  id,
  name: `Демо ${id}`,
  status: 'new',
  createdAt: `2026-10-${String(10 + id).padStart(2, '0')}T03:00:00Z`,
  ...extra,
})

test('leads panel: status counts, grouping and search', () => {
  const leads = [
    lead(1),
    lead(2, { status: 'taken', message: 'нужен бот для салона' }),
    lead(3, { status: 'won', notes: 'VIP клиент' }),
    lead(4, { status: 'new', contact: '+992 900 11 22 33' }),
  ]
  assert.deepEqual(crm.statusCounts(leads), { all: 4, new: 2, taken: 1, called: 0, won: 1, lost: 0 })
  assert.equal(crm.newLeadCount(leads), 2)
  const groups = crm.groupByStatus(leads)
  assert.deepEqual(groups.new.map((l) => l.id), [4, 1]) // newest first
  assert.deepEqual(groups.won.map((l) => l.id), [3])
  assert.deepEqual(groups.lost, [])
  const ids = (status, q) => crm.visibleLeads(leads, status, q).map((l) => l.id)
  assert.deepEqual(ids('all', ''), [4, 3, 2, 1])
  assert.deepEqual(ids('new', ''), [4, 1])
  assert.deepEqual(ids('all', 'БОТ'), [2])
  assert.deepEqual(ids('all', 'vip'), [3], 'private notes are searchable by the owner')
  assert.deepEqual(ids('all', '+992'), [4])
  assert.deepEqual(ids('won', 'бот'), [])
})

test('leads panel: CSV has BOM, header and one row per lead, formulas escaped', () => {
  const csv = crm.crmCsv([lead(1, { name: '=HYPERLINK("x")', message: 'a, b\nc' }), lead(2, { status: 'won' })])
  assert.equal(csv.charCodeAt(0), 0xfeff)
  const lines = csv.trim().split('\r\n')
  assert.equal(lines.length, 3, 'header and two rows; the quoted line break stays inside its cell')
  assert.match(csv, /'=HYPERLINK/)
  assert.match(csv, /"a, b\nc"/)
  assert.match(csv, /Won/)
})

test('calls panel: week grouping, today and pending', () => {
  const now = Date.parse('2026-10-16T04:00:00Z') // Friday 09:00 in Dushanbe
  const booked = [
    { id: 9, name: 'Сегодня', booking: { slot: '2026-10-16T05:00:00.000Z', state: 'pending' } },
    { id: 10, name: 'Пн', booking: { slot: '2026-10-19T09:30:00.000Z', state: 'confirmed' } },
    { id: 11, name: 'Освобождён', booking: { slot: '2026-10-19T10:00:00.000Z', state: 'released' } },
    { id: 12, name: 'Через неделю', booking: { slot: '2026-10-27T05:00:00.000Z', state: 'pending' } },
    { id: 13, name: 'Без записи' },
  ]
  assert.deepEqual(crm.allCalls(booked).map((c) => c.id), [9, 10, 12])
  assert.deepEqual(crm.callsToday(booked, now).map((c) => c.id), [9])
  assert.deepEqual(crm.pendingCalls(booked, now).map((c) => c.id), [9, 12])

  const weeks = crm.bookingWeeks(booked, now)
  assert.equal(weeks.length, 2)
  assert.deepEqual(weeks[0].days.map((d) => d.date), [
    '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16',
  ])
  assert.deepEqual(weeks[1].days.map((d) => d.date), [
    '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23',
  ])
  const [mon, tue] = weeks[1].days
  assert.deepEqual(mon.calls.map((c) => c.id), [10], 'released bookings are not shown')
  assert.equal(mon.free, 15)
  assert.equal(tue.free, 16)
  const fri = weeks[0].days[4]
  assert.equal(fri.today, true)
  assert.deepEqual(fri.calls.map((c) => c.id), [9])
  assert.equal(weeks[0].days[0].past, true)
  assert.equal(weeks[0].days[0].free, 0)
  // The booking on 27.10 is outside the two weeks shown.
  assert.equal(weeks.flatMap((w) => w.days).flatMap((d) => d.calls).some((c) => c.id === 12), false)
})

// Everything below reads the source tree: removed pages stay removed and nothing imports them.
const root = path.resolve('.')
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (name === 'node_modules' || name === '.next') return []
    return statSync(full).isDirectory() ? walk(full) : [full]
  })

test('/admin redirects to HQ (/admin/inbox); login lands there too', () => {
  const page = readFileSync(path.join(root, 'src/app/admin/page.tsx'), 'utf8')
  assert.match(page, /redirect\('\/admin\/inbox'\)/)
  assert.doesNotMatch(page, /AdminShell|Pulse/)
  assert.match(readFileSync(path.join(root, 'src/app/admin/login/page.tsx'), 'utf8'), /redirect\('\/admin\/inbox'\)/)
  assert.match(readFileSync(path.join(root, 'src/components/admin/login-form.tsx'), 'utf8'), /replace\('\/admin\/inbox'\)/)
})

test('removed admin routes have no page (Next answers 404); the kept ones exist', () => {
  for (const gone of ['leads', 'calendar']) {
    assert.equal(existsSync(path.join(root, 'src/app/admin', gone, 'page.tsx')), false, gone)
  }
  for (const kept of ['(hq)/office/page.tsx', 'login/page.tsx', 'page.tsx']) {
    assert.equal(existsSync(path.join(root, 'src/app/admin', kept)), true, kept)
  }
  // Office is a Shell section now: no page outside the frame, and Echo is gone with its route.
  for (const gone of ['office/page.tsx', 'echo/page.tsx']) assert.equal(existsSync(path.join(root, 'src/app/admin', gone)), false, gone)
  for (const api of ['leads/route.ts', 'leads/[id]/route.ts', 'hq/[...path]/route.ts', 'office/route.ts', 'export/route.ts']) {
    assert.equal(existsSync(path.join(root, 'src/app/api/admin', api)), true, api)
  }
})

test('the admin nav shows only the office; removed components and models are gone and unused', () => {
  const shell = readFileSync(path.join(root, 'src/components/admin/admin-shell.tsx'), 'utf8')
  const links = shell.match(/const links = \[([\s\S]*?)\] as const/)?.[1] ?? ''
  assert.equal((links.match(/href:/g) ?? []).length, 1)
  assert.match(links, /\/admin\/office/)

  const gone = [
    'src/components/admin/pulse',
    'src/components/admin/leads-board.tsx',
    'src/lib/pulse-data.ts',
    'src/lib/pulse-demo.ts',
    'src/lib/pulse-today.ts',
    'src/lib/pulse-view.ts',
    'src/lib/vibely-metrics.ts',
    'src/lib/metrika.ts',
    'src/app/api/admin/stats',
    'src/app/api/admin/tasks',
    'src/app/api/admin/instagram',
  ]
  for (const p of gone) assert.equal(existsSync(path.join(root, p)), false, p)

  const needles = [
    'admin/pulse/', 'leads-board', 'pulse-data', 'pulse-demo', 'pulse-today', 'pulse-view',
    'vibely-metrics', 'lib/metrika', "'./metrika'", 'traffic-types', '/api/admin/stats',
  ]
  const files = [...walk(path.join(root, 'src')), ...walk(path.join(root, 'tests'))].filter(
    (f) => /\.(ts|tsx|mjs)$/.test(f) && !f.endsWith('admin-crm.test.mjs'),
  )
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const needle of needles) assert.equal(text.includes(needle), false, `${path.relative(root, file)} mentions ${needle}`)
  }
})

test('Shell Clients mounts both site panels (tabs site and calls)', () => {
  const sections = readFileSync(path.join(root, 'src/components/admin/hq/sections.tsx'), 'utf8')
  assert.match(sections, /<LeadsPanel crm=\{crm\}/)
  assert.match(sections, /<CallsPanel crm=\{crm\}/)
  assert.match(sections, /tab === 'site'/)
  assert.match(sections, /tab === 'calls'/)
})
