// Leads only from signed-in clients (owner 2026-11-20): the gate, the identity in every payload,
// drafts across a sign-in, the chat guard, copy.
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
    if (specifier === 'next/server' || specifier === 'next/navigation' || specifier === 'next/headers') return next(`${specifier}.js`, context)
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

const { default: ru } = await import('../src/content/ru.ts')
const { default: en } = await import('../src/content/en.ts')
const gate = await import('../src/lib/lead-identity.ts')
const forward = await import('../src/lib/lead-forward.ts')
const { forwardAudit } = await import('../src/lib/audit.ts')
const { askReceptionist } = await import('../src/lib/chat-hq.ts')
const { wouldCreateLead } = await import('../src/lib/chat.ts')
const { formatLead } = await import('../src/lib/lead.ts')
const draft = await import('../src/lib/lead-draft.ts')

const on = { NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon' }
const alice = { id: '6f1c2a7e-1111-4222-8333-944455556666', email: ' Alice@Example.com ', name: 'Алиса' }
const lead = {
  name: 'Алиса', contact: '+992 900 00 00 00', service: 'websites', budget: '', message: 'Нужен сайт',
  estimate: '', locale: 'ru', page: '/ru', slot: '', source: '', website: '',
}

test('gate: signed out = 401 auth_required; signed in = identity; cabinet off = open', async () => {
  assert.deepEqual(await gate.leadGate(async () => null, on), { ok: false, status: 401, error: 'auth_required' })
  assert.deepEqual(await gate.leadGate(async () => ({ id: 'x', email: '', name: '' }), on), { ok: false, status: 401, error: 'auth_required' })
  assert.deepEqual(await gate.leadGate(async () => { throw new Error('supabase down') }, on), { ok: false, status: 401, error: 'auth_required' })
  assert.deepEqual(await gate.leadGate(async () => ({ ...alice, id: '../x' }), on), { ok: false, status: 401, error: 'auth_required' })
  const ok = await gate.leadGate(async () => alice, on)
  assert.deepEqual(ok, { ok: true, identity: { clientEmail: 'alice@example.com', cabinetId: alice.id, clientName: 'Алиса' } })
  let asked = false
  const off = await gate.leadGate(async () => { asked = true; return null }, {})
  assert.deepEqual(off, { ok: true, identity: null })
  assert.equal(asked, false)
})

test('gated routes: /api/lead and /api/audit answer 401 before anything is sent; chat guards contacts', () => {
  for (const file of ['src/app/api/lead/route.ts', 'src/app/api/audit/route.ts']) {
    const code = readFileSync(file, 'utf8').split('\n').filter((l) => !l.startsWith('import ')).join('\n')
    const at = code.indexOf('leadGate(')
    assert.ok(at > 0, file)
    assert.match(code, /if \(!gate\.ok\) return NextResponse\.json\(\{ ok: false, error: gate\.error \}, \{ status: gate\.status \}\)/, file)
    for (const later of ['createLead(', 'forwardLeadDetailed(', 'forwardAudit(', 'notifyOwner('])
      if (code.includes(later)) assert.ok(code.indexOf(later) > at, `${later} after the gate in ${file}`)
  }
  const chat = readFileSync('src/app/api/chat/route.ts', 'utf8')
  assert.match(chat, /!gate\.ok && wouldCreateLead\(parsed\.data\.message\)/)
  assert.match(chat, /authRequired: true/)
  assert.ok(chat.indexOf('wouldCreateLead(') < chat.indexOf('askReceptionist(parsed'))
  assert.equal(wouldCreateLead('@alice_b'), true)
  assert.equal(wouldCreateLead('+992 900 00 00 00'), true)
  assert.equal(wouldCreateLead('alice@example.com'), true)
  assert.equal(wouldCreateLead('Нужен сайт для салона'), false)
  assert.equal(wouldCreateLead('/start'), false)
  assert.equal(wouldCreateLead('/btn site'), false)
})

test('lead payload to HQ carries clientEmail, cabinetId, clientName; HQ id comes back', async () => {
  const identity = (await gate.leadGate(async () => alice, on)).identity
  let seen
  const r = await forward.forwardLeadDetailed(lead, undefined, { LEAD_INTAKE_URL: 'http://hq.test', LEAD_INTAKE_TOKEN: 't' }, async (url, init) => {
    seen = JSON.parse(init.body)
    return new Response(JSON.stringify({ ok: true, id: 7, leadId: 42 }), { status: 200 })
  }, undefined, identity)
  assert.deepEqual(r, { ok: true, id: 42 })
  assert.equal(seen.clientEmail, 'alice@example.com')
  assert.equal(seen.cabinetId, alice.id)
  assert.equal(seen.clientName, 'Алиса')
  assert.equal(seen.contact, lead.contact)
  assert.equal('website' in seen, false)
  // Without an account (cabinet off) nothing extra is sent.
  const plain = forward.leadBody(lead, undefined, null)
  assert.ok(!('clientEmail' in plain) && !('cabinetId' in plain))
  // An odd id is dropped, a slow HQ never holds the visitor.
  const odd = await forward.forwardLeadDetailed(lead, undefined, { LEAD_INTAKE_URL: 'http://hq.test', LEAD_INTAKE_TOKEN: 't' }, async () => new Response('{"ok":true,"id":7,"leadId":"x"}'))
  assert.deepEqual(odd, { ok: true, id: null })
  const slow = await forward.withinMs(new Promise(() => {}), 10, { ok: false, id: null })
  assert.deepEqual(slow, { ok: false, id: null })
  // The owner's Telegram card names the account.
  assert.match(formatLead({ ...lead, account: 'alice@example.com' }), /<b>Аккаунт:<\/b> alice@example\.com/)
})

test('audit and chat payloads carry the account too', async () => {
  const identity = (await gate.leadGate(async () => alice, on)).identity
  let audit
  await forwardAudit({ url: 'https://example.com', contact: '@alice_b', locale: 'ru' }, { LEAD_INTAKE_URL: 'http://hq.test', LEAD_INTAKE_TOKEN: 't' }, async (url, init) => {
    audit = JSON.parse(init.body)
    return new Response('{"ok":true}')
  }, undefined, identity)
  assert.equal(audit.clientEmail, 'alice@example.com')
  assert.equal(audit.cabinetId, alice.id)
  let chat
  await askReceptionist(
    { sessionId: '6f1c2a7e-1111-4222-8333-944455556666', locale: 'ru', message: 'hi', page: '/ru' },
    { HQ_CHAT_URL: 'http://hq.test/chat', HQ_CHAT_TOKEN: 't', NODE_ENV: 'production' },
    async (url, init) => {
      chat = JSON.parse(init.body)
      return new Response(JSON.stringify({ ok: true, reply: 'ok', state: 'chat' }))
    },
    undefined,
    identity,
  )
  assert.equal(chat.clientEmail, 'alice@example.com')
  assert.equal(chat.clientName, 'Алиса')
})

test('after a lead: the cabinet path with the HQ id, else `new`; the Telegram follow link kept', () => {
  assert.equal(gate.cabinetLeadPath('ru', 42), '/ru/cabinet?lead=42')
  assert.equal(gate.cabinetLeadPath('en', null), '/en/cabinet?lead=new')
  assert.equal(gate.cabinetLeadPath('ru', '<x>'), '/ru/cabinet?lead=new')
  assert.equal(gate.cabinetLeadPath('de', 0), '/ru/cabinet?lead=new')
  assert.equal(gate.cabinetLeadPath('ru', 7, { id: 3, token: 'abcdef123456' }), '/ru/cabinet?lead=7&follow=3.abcdef123456')
  assert.equal(gate.cabinetLeadPath('ru', 7, { id: 3, token: '' }), '/ru/cabinet?lead=7')
})

function memoryStorage() {
  const m = new Map()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }
}

test('drafts: saved, restored, expired, cleaned; never the honeypot or a password', () => {
  const s = memoryStorage()
  assert.equal(draft.saveDraft(s, 'lead', { name: 'Алиса', contact: '@a', website: 'bot', password: 'x', estimate: 'Сайт', n: 5 }, 1000), true)
  assert.deepEqual(draft.loadDraft(s, 'lead', 2000), { name: 'Алиса', contact: '@a', estimate: 'Сайт' })
  assert.equal(draft.loadDraft(s, 'audit', 2000), null)
  assert.equal(draft.loadDraft(s, 'lead', 1000 + draft.DRAFT_TTL_MS + 1), null)
  assert.equal(s.m.size, 0, 'an expired draft is removed')
  draft.saveDraft(s, 'audit', { url: 'x'.repeat(5000) }, 0)
  assert.equal(draft.loadDraft(s, 'audit', 1).url.length, 2000)
  draft.clearDraft(s, 'audit')
  assert.equal(draft.loadDraft(s, 'audit', 1), null)
  s.setItem('fir-draft-chat', '{broken')
  assert.equal(draft.loadDraft(s, 'chat'), null)
  assert.equal(draft.saveDraft(null, 'lead', {}), false)
  const throwing = { getItem() { throw new Error('x') }, setItem() { throw new Error('x') }, removeItem() { throw new Error('x') } }
  assert.equal(draft.saveDraft(throwing, 'lead', { a: 'b' }), false)
  assert.equal(draft.loadDraft(throwing, 'lead'), null)
  draft.clearDraft(throwing, 'lead')
})

test('drafts: return path carries draft=1 and the builder build; the flag goes after sending', () => {
  assert.equal(draft.draftReturnPath('/ru/builder', '?b=abc&step=8', '#contact'), '/ru/builder?b=abc&step=8&draft=1#contact')
  assert.equal(draft.draftReturnPath('/en/audit', '', ''), '/en/audit?draft=1')
  assert.equal(draft.hasDraftFlag('?b=1&draft=1'), true)
  assert.equal(draft.hasDraftFlag('?draft=0'), false)
  assert.equal(draft.withoutDraftFlag('/ru/builder', '?b=abc&draft=1', '#contact'), '/ru/builder?b=abc#contact')
  assert.equal(draft.withoutDraftFlag('/ru', '?draft=1'), '/ru')
  const local = memoryStorage()
  assert.equal(draft.draftStorage({ localStorage: local, sessionStorage: memoryStorage() }), local)
  const session = memoryStorage()
  const broken = { setItem() { throw new Error('quota') }, removeItem() {}, getItem() { return null } }
  assert.equal(draft.draftStorage({ localStorage: broken, sessionStorage: session }), session)
  assert.equal(draft.draftStorage(undefined), null)
})

test('forms: every lead path checks the account and keeps a draft', () => {
  const read = (f) => readFileSync(f, 'utf8')
  for (const [file, kind] of [['src/components/contact-form.tsx', 'lead'], ['src/components/audit-form.tsx', 'audit'], ['src/components/estimate-gate.tsx', 'estimate']]) {
    const code = read(file)
    assert.match(code, /useCabinetUser\(\)/, file)
    assert.match(code, /<LeadAuthStep/, file)
    assert.match(code, new RegExp(`saveDraft\\(draftStorage\\(window\\), '${kind}'`), file)
    assert.match(code, new RegExp(`clearDraft\\(draftStorage\\(window\\), '${kind}'\\)`), file)
    assert.match(code, /status === 401/, file)
    assert.match(code, /<LeadAccountNote/, file)
  }
  assert.match(read('src/components/contact-form.tsx'), /window\.location\.assign\(answer\.cabinet!\)/)
  assert.match(read('src/components/audit-form.tsx'), /window\.location\.assign\(body\.cabinet!\)/)
  const panel = read('src/components/chat/chat-panel.tsx')
  assert.match(panel, /<AuthForms\s+compact/)
  assert.match(panel, /copy\.sendAs/)
  assert.match(panel, /answer\.ownerReplies/)
  // The Telegram deep links stay as they are.
  assert.match(read('src/components/contact-form.tsx'), /start=lead_\$\{sent\.id\}_\$\{sent\.token\}/)
})

test('copy: the why sentence, same shape in ru and en, no long dashes or dollar amounts', () => {
  assert.equal(ru.leadAuth.why, 'Заявка создаёт личный кабинет: там будут этапы, документы, счёт и переписка.')
  const shape = (v) => (v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v)
  assert.deepEqual(shape(ru.leadAuth), shape(en.leadAuth))
  const pieces = [ru.leadAuth, en.leadAuth, ru.chat.signInFirst, en.chat.signInFirst, ru.chat.sendAs, en.chat.sendAs, ru.chat.leadInCabinet, en.chat.leadInCabinet]
  const texts = pieces.flatMap((p) => (typeof p === 'string' ? [p] : Object.values(p)))
  for (const text of texts) {
    assert.doesNotMatch(text, /[–—]/, text)
    assert.doesNotMatch(text, /\$\s?\d/, text)
    assert.doesNotMatch(text, /, (позволяя|делая|помогая|allowing|making|helping)\b/i, text)
  }
  for (const d of [ru, en]) {
    assert.match(d.leadAuth.signedInAs, /\{email\}/)
    assert.match(d.chat.sendAs, /\{email\}/)
  }
})

test('audit route: with the cabinet on, a signed-out request gets 401 and HQ is never called', async () => {
  const auditRoute = await import('../src/app/api/audit/route.ts')
  const env = { ...process.env }
  Object.assign(process.env, on, { LEAD_INTAKE_URL: 'http://hq.invalid', LEAD_INTAKE_TOKEN: 't' })
  const realFetch = globalThis.fetch
  let called = false
  globalThis.fetch = async () => { called = true; return new Response('{"ok":true}') }
  try {
    const res = await auditRoute.POST(new Request('http://localhost/api/audit', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': '10.9.9.9' },
      body: JSON.stringify({ url: 'https://example.com', contact: '@alice_b', locale: 'ru' }),
    }))
    assert.equal(res.status, 401)
    assert.deepEqual(await res.json(), { ok: false, error: 'auth_required' })
    assert.equal(called, false)
  } finally {
    globalThis.fetch = realFetch
    for (const k of Object.keys(process.env)) if (!(k in env)) delete process.env[k]
  }
})
