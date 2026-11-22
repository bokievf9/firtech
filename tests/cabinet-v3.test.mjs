// Cabinet v3 (2026-11-22): documents, signature payload, next action, messenger, HQ client
// functions with the dev mock and with a fake HQ. No Supabase, no network.
import assert from 'node:assert/strict'
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
        } catch {}
      }
    }
    return next(specifier, context)
  },
})

const docs = await import('../src/lib/cabinet-docs.ts')
const chat = await import('../src/lib/cabinet-chat.ts')
const data = await import('../src/lib/cabinet-data.ts')
const hq = await import('../src/lib/cabinet-hq.ts')
const mock = await import('../src/lib/cabinet-hq-mock.ts')
const view = await import('../src/lib/cabinet-view.ts')
const { default: ru } = await import('../src/content/ru.ts')
const { default: en } = await import('../src/content/en.ts')

const png = (extra = 0) => {
  const head = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return `data:image/png;base64,${Buffer.concat([head, Buffer.alloc(40 + extra, 7)]).toString('base64')}`
}
const rawDoc = (o = {}) => ({ id: 'd1', kind: 'quote', title: 'КП', state: 'awaiting_client', ...o })

// ---- documents ---------------------------------------------------------------------------------

test('documents: parse the contract shape, keep only https pay links on issued ones, drop void and unknown states', () => {
  const list = docs.parseClientDocs([
    rawDoc({ number: 'КП-1', leadId: 12, pdfUrl: '/media/a.pdf', createdAt: '2026-11-20T00:00:00Z' }),
    rawDoc({ id: 7, kind: 'invoice', state: 'issued', amountUsd: 150, stageNo: 1, payUrl: 'https://firtech.pro/pay/x' }),
    rawDoc({ id: 'i2', kind: 'invoice', state: 'paid', payUrl: 'https://firtech.pro/pay/y' }),
    rawDoc({ id: 'x', state: 'void' }),
    rawDoc({ id: 'y', state: 'weird' }),
    rawDoc({ id: 'z', kind: 'strange', state: 'accepted', pdfUrl: 'http://evil/a.pdf' }),
    { title: 'no id' },
  ])
  assert.deepEqual(list.map((d) => d.id), ['d1', '7', 'i2', 'z'])
  assert.equal(list[0].pdfUrl, '/media/a.pdf')
  assert.equal('htmlUrl' in list[0], false, 'HQ has no HTML version')
  assert.equal(list[1].payUrl, 'https://firtech.pro/pay/x')
  assert.equal(list[2].payUrl, null, 'a paid invoice has no pay link')
  assert.equal(list[3].kind, 'other')
  assert.equal(list[3].pdfUrl, null, 'http links are dropped')
  assert.deepEqual(docs.parseClientDocs({ ok: true, items: [rawDoc()] }).map((d) => d.id), ['d1'])
  assert.deepEqual(docs.parseClientDocs({ documents: [rawDoc()] }).map((d) => d.id), ['d1'])
  assert.deepEqual(docs.parseClientDocs('nope'), [])
})

test('documents: the browser copy never carries HQ links', () => {
  const [d] = docs.parseClientDocs([rawDoc({ pdfUrl: 'https://hq.firtech.pro/media/sig/a.pdf?e=1795000000' })])
  const pub = docs.publicDoc(d)
  assert.equal('pdfUrl' in pub, false)
  assert.equal(pub.hasPdf, true)
  assert.doesNotMatch(JSON.stringify(pub), /media/)
})

test('documents: states decide the buttons', () => {
  const act = (o) => docs.docActions({ kind: 'other', state: 'accepted', payUrl: null, hasPdf: false, ...o })
  assert.deepEqual(act({ kind: 'quote', state: 'awaiting_client', hasPdf: true }), ['accept', 'reject', 'download'])
  assert.deepEqual(act({ kind: 'quote', state: 'accepted', hasPdf: true }), ['download'])
  assert.deepEqual(act({ kind: 'contract', state: 'awaiting_signature', hasPdf: true }), ['sign', 'download'])
  assert.deepEqual(act({ kind: 'contract', state: 'signed', hasPdf: true }), ['download'])
  assert.deepEqual(act({ kind: 'invoice', state: 'issued', payUrl: 'https://x.test/p' }), ['pay'])
  assert.deepEqual(act({ kind: 'invoice', state: 'issued' }), [], 'no link, no pay button')
  assert.deepEqual(act({ kind: 'invoice', state: 'paid', hasPdf: true }), ['download'])
  assert.equal(docs.docNeedsClient({ kind: 'invoice', state: 'issued' }), true)
  assert.equal(docs.docNeedsClient({ kind: 'quote', state: 'accepted' }), false)
  assert.equal(docs.docsNeedingClient([{ kind: 'quote', state: 'awaiting_client' }, { kind: 'contract', state: 'signed' }, { kind: 'contract', state: 'awaiting_signature' }]), 2)
})

test('documents: the estimate (other, issued) is received, not billed; list envelope {ok, items} accepted', () => {
  assert.equal(docs.docStateKey({ kind: 'other', state: 'issued' }), 'delivered')
  assert.equal(docs.docStateKey({ kind: 'invoice', state: 'issued' }), 'issued')
  assert.equal(docs.docNeedsClient({ kind: 'other', state: 'issued' }), false)
  assert.equal(docs.parseClientDocs({ ok: true, items: [{ id: 7, kind: 'other', title: 'Смета', state: 'issued', amountUsd: 660 }] })[0].id, '7')
})

test('documents: those that need the client come first, then the newest', () => {
  const sorted = docs.sortDocs([
    { id: 'a', kind: 'contract', state: 'signed', createdAt: '2026-11-21T00:00:00Z' },
    { id: 'b', kind: 'invoice', state: 'paid', createdAt: '2026-11-10T00:00:00Z' },
    { id: 'c', kind: 'quote', state: 'awaiting_client', createdAt: '2026-11-01T00:00:00Z' },
  ])
  assert.deepEqual(sorted.map((d) => d.id), ['c', 'a', 'b'])
})

// ---- signature ---------------------------------------------------------------------------------

test('signature: a PNG data URL up to 200 KB with a name and the consent builds the payload', () => {
  const ok = docs.buildSignaturePayload({ png: png(), name: '  Алиса   Иванова ', consent: true })
  assert.equal(ok.ok, true)
  assert.deepEqual(Object.keys(ok.payload).sort(), ['consent', 'name', 'signaturePng'])
  assert.equal(ok.payload.name, 'Алиса Иванова')
  assert.equal(ok.payload.consent, true)
})

test('signature: every refusal has its own code', () => {
  const b = (o) => docs.buildSignaturePayload({ png: png(), name: 'Алиса', consent: true, ...o })
  assert.equal(b({ png: '' }).error, 'no_signature')
  assert.equal(b({ png: undefined }).error, 'no_signature')
  assert.equal(b({ png: 'data:image/jpeg;base64,AAAA' }).error, 'bad_signature')
  assert.equal(b({ png: 'data:image/png;base64,@@@@' }).error, 'bad_signature')
  assert.equal(b({ png: `data:image/png;base64,${Buffer.from('not a png file at all').toString('base64')}` }).error, 'bad_signature')
  assert.equal(b({ png: png(docs.SIGNATURE_MAX_BYTES) }).error, 'too_big')
  assert.equal(b({ png: 'data:image/png;base64,' + 'A'.repeat(1_000_000) }).error, 'too_big')
  assert.equal(b({ name: ' ' }).error, 'name')
  assert.equal(b({ name: 'x'.repeat(121) }).error, 'name')
  assert.equal(b({ consent: false }).error, 'consent')
  assert.equal(b({ consent: 'true' }).error, 'consent')
  // exactly at the limit still passes
  const edge = docs.checkSignaturePng(png(docs.SIGNATURE_MAX_BYTES - 48))
  assert.deepEqual(edge, { ok: true, bytes: docs.SIGNATURE_MAX_BYTES })
})

test('signature: HQ gets the signer IP and browser from the server only', () => {
  const body = docs.signBodyForHq({ signaturePng: png(), name: 'A B', consent: true }, '203.0.113.7', 'Mozilla/5.0')
  assert.equal(body.ip, '203.0.113.7')
  assert.equal(body.userAgent, 'Mozilla/5.0')
  assert.equal(docs.signBodyForHq({ signaturePng: png(), name: 'A B', consent: true }, 'local', null).ip, '')
})

// ---- next action -------------------------------------------------------------------------------

test('next action: HQ vocabulary parsed, unknown kinds dropped, only https pay links', () => {
  assert.deepEqual(docs.parseNextAction({ kind: 'pay_stage', stageNo: 2, payUrl: 'https://x.test/p', docId: 5 }), {
    kind: 'pay_stage', docId: '5', stageNo: 2, payUrl: 'https://x.test/p', text: '',
  })
  assert.equal(docs.parseNextAction({ kind: 'pay_stage', payUrl: 'http://x.test' }).payUrl, null)
  assert.equal(docs.parseNextAction({ kind: 'dance' }), null)
  assert.equal(docs.parseNextAction('Ждём вас'), null)
  assert.equal(docs.parseNextAction({ kind: 'wait', text: 'Ждём вас на созвоне' }).text, 'Ждём вас на созвоне')
})

test('next action: derived from documents and stages when HQ sends none, in the owner order', () => {
  const [quote, contract, invoice] = docs.parseClientDocs([
    rawDoc({ id: 'q', leadId: 14 }),
    rawDoc({ id: 'c', kind: 'contract', state: 'awaiting_signature', projectId: 2, leadId: 12 }),
    rawDoc({ id: 'i', kind: 'invoice', state: 'issued', projectId: 1, stageNo: 3, payUrl: 'https://p.test/3' }),
  ])
  assert.equal(docs.deriveNextAction([quote]).kind, 'accept_quote')
  assert.equal(docs.deriveNextAction([quote], [], { leadId: 14 }).docId, 'q')
  assert.equal(docs.deriveNextAction([quote], [], { leadId: 99 }).kind, 'wait', 'a document of another request is not this one')
  assert.equal(docs.deriveNextAction([contract], [], { projectId: 2 }).kind, 'sign_contract')
  const stages = [
    { stageNo: 2, state: 'awaiting_acceptance', payUrl: null },
    { stageNo: 3, state: 'awaiting_payment', payUrl: 'https://p.test/3' },
  ]
  assert.deepEqual(docs.deriveNextAction([invoice], stages, { projectId: 1 }), { kind: 'accept_stage', docId: null, stageNo: 2, payUrl: null, text: '' })
  const paid = docs.deriveNextAction([invoice], [{ stageNo: 3, state: 'awaiting_payment', payUrl: 'https://p.test/3' }], { projectId: 1 })
  assert.equal(paid.kind, 'pay_stage')
  assert.equal(paid.payUrl, 'https://p.test/3')
  assert.equal(docs.deriveNextAction([], [{ stageNo: 1, state: 'in_progress', payUrl: null }]).kind, 'wait')
  const given = { kind: 'wait', docId: null, stageNo: null, payUrl: null, text: 'Созвон завтра' }
  assert.equal(docs.resolveNextAction(given, [quote]).text, 'Созвон завтра', "HQ's own action wins")
})

test('next action: the big button follows the kind', () => {
  const a = (o) => ({ kind: 'wait', docId: null, stageNo: null, payUrl: null, text: '', ...o })
  assert.deepEqual(docs.actionControl(a({ kind: 'accept_quote', docId: 'q' })), { control: 'open_doc', docId: 'q' })
  assert.deepEqual(docs.actionControl(a({ kind: 'sign_contract', docId: 'c' })), { control: 'open_doc', docId: 'c' })
  assert.deepEqual(docs.actionControl(a({ kind: 'pay_stage', payUrl: 'https://p.test' })), { control: 'pay_link', href: 'https://p.test' })
  assert.deepEqual(docs.actionControl(a({ kind: 'pay_stage', docId: 'i' })), { control: 'open_doc', docId: 'i' })
  assert.deepEqual(docs.actionControl(a({ kind: 'accept_stage', stageNo: 2 })), { control: 'accept_stage', stageNo: 2 })
  assert.deepEqual(docs.actionControl(a({ kind: 'accept_stage' })), { control: 'none' })
  assert.deepEqual(docs.actionControl(a()), { control: 'none' })
  assert.equal(docs.actionNeedsClient(a({ kind: 'accept_quote' })), true)
  assert.equal(docs.actionNeedsClient(a()), false)
})

test('a request whose project exists is hidden by the documents link', () => {
  const leads = [{ id: 14 }, { id: 12 }, { id: 9 }]
  const shown = docs.leadsWithoutProject(leads, [{ id: 2 }, { id: 1 }], [
    { leadId: 12, projectId: 2 },
    { leadId: 14, projectId: null },
    { leadId: 9, projectId: 77 },
  ])
  assert.deepEqual(shown.map((l) => l.id), [14, 9])
})

test('projects and requests: v3 fields parsed, state falls back from the status', () => {
  const body = {
    ok: true,
    client: { id: 1, name: 'A', email: 'a@b.co', telegram: '' },
    projects: [
      { id: 1, what: 'Сайт', status: 'active', stage: 'brief', state: 'preparing', documents: ['a', 3, null], nextAction: { kind: 'sign_contract', docId: 'c' } },
      { id: 2, status: 'draft', stage: 'spec' },
      { id: 3, status: 'done' },
      { id: 4, status: 'active', state: 'paused' },
      { id: 5, status: 'active', stage: 'delivery' },
    ],
    leads: [
      { id: 7, stage: 'proposal', nextStep: { kind: 'accept_quote', docId: 'q' } },
      { id: 8, stage: 'new', nextStep: 'Ответим в течение 5 минут', nextAction: { kind: 'wait', text: 'Ждём вас на созвоне' } },
    ],
  }
  const parsed = data.parseClientBody(body)
  assert.deepEqual(parsed.projects.map((p) => p.state), ['preparing', 'preparing', 'done', 'paused', 'in_progress'])
  assert.deepEqual(parsed.projects[0].documents, ['a', '3'])
  assert.equal(parsed.projects[0].nextAction.kind, 'sign_contract')
  assert.equal(parsed.projects[1].nextAction, null)
  assert.equal(parsed.leads[0].nextAction.docId, 'q')
  assert.equal(parsed.leads[0].nextStep, '')
  assert.equal(parsed.leads[1].nextStep, 'Ответим в течение 5 минут')
  assert.equal(parsed.leads[1].nextAction.text, 'Ждём вас на созвоне')
})

// ---- messenger ---------------------------------------------------------------------------------

test('threads and messages: contract shapes parsed, attachments go through the proxy', () => {
  const threads = chat.parseThreads({ ok: true, threads: [
    { id: 't1', kind: 'lead', refId: 12, title: 'Заявка', unread: 2, lastAt: '2026-11-21T10:00:00Z' },
    { id: 'x', kind: 'weird' },
    { id: 9, kind: 'support', unread: -4 },
  ] })
  assert.deepEqual(threads.map((t) => [t.id, t.kind, t.refId, t.unread]), [['t1', 'lead', '12', 2], ['9', 'support', null, 0]])
  const rows = chat.parseMessages([
    { id: 1, at: '2026-11-21T10:00:00Z', from: 'client', text: 'Привет', attachments: [{ name: 'logo.png', url: '/media/u/logo.png', size: 2048, label: 'logo' }, { name: '', url: 'x' }, { name: 'nolink.pdf', url: null, size: 5 }], readAt: '2026-11-21T10:05:00Z' },
    { id: 2, from: 'agent', text: 'Здравствуйте' },
    { id: 3, from: 'firtech', text: '' },
    { id: 4, from: 'firtech', text: '', attachments: [{ name: 'КП.pdf', url: 'https://hq.test/media/kp.pdf', size: 1 }] },
  ])
  assert.deepEqual(rows.map((m) => [m.id, m.from]), [['1', 'client'], ['2', 'agent'], ['4', 'firtech']])
  assert.equal(rows[0].attachments.length, 2, 'a file without a signed link is listed without a link')
  assert.equal(rows[0].attachments[1].href, '')
  assert.equal(rows[0].attachments[0].href, '/api/cabinet/media?u=%2Fmedia%2Fu%2Flogo.png&name=logo.png')
  assert.equal(rows[0].readAt, '2026-11-21T10:05:00Z')
  assert.equal(chat.parseMessageItem({ ok: true, item: { id: 9, from: 'client', text: 'x' } }).id, '9')
  const tagged = chat.parseMessage({ id: 3, from: 'client', text: '[logo]', attachments: [{ name: 'l.png', url: '/media/x/l.png' }] })
  assert.equal(tagged.text, '')
  assert.equal(tagged.attachments[0].label, 'logo')
  assert.equal(chat.parseMessage({ id: 4, from: 'client', text: '(вложение)', attachments: [{ name: 'a.pdf', url: '/media/x/a.pdf' }] }).text, '')
  assert.equal(chat.parseMessage({ id: 5, from: 'client', text: '[nonsense] hi' }).text, '[nonsense] hi')
  assert.equal(chat.parseMessageItem({ ok: true }), null)
})

test('messages: merge by id (read marks arrive), oldest first, the last real id for ?after=', () => {
  const a = { id: '1', at: '2026-11-21T10:00:00Z', from: 'client', text: 'a', attachments: [], readAt: null }
  const b = { id: '2', at: '2026-11-21T10:01:00Z', from: 'firtech', text: 'b', attachments: [], readAt: null }
  const local = { id: 'local:1', at: '2026-11-21T10:02:00Z', from: 'client', text: 'c', attachments: [], readAt: null, state: 'sending' }
  const merged = chat.mergeMessages([b, a, local], [{ ...a, readAt: '2026-11-21T10:03:00Z' }])
  assert.deepEqual(merged.map((m) => m.id), ['1', '2', 'local:1'])
  assert.equal(merged[0].readAt, '2026-11-21T10:03:00Z')
  assert.equal(chat.lastServerId(merged), '2')
  assert.equal(chat.lastServerId([local]), null)
  assert.equal(chat.mergeMessages([], [b, b]).length, 1)
})

test('threads: unread total, unread first, links by kind and ref', () => {
  const t = (id, kind, refId, unread, lastAt) => ({ id, kind, refId, title: id, unread, lastAt })
  const list = [t('a', 'lead', '12', 0, '2026-11-21T12:00:00Z'), t('b', 'project', '1', 3, '2026-11-20T12:00:00Z'), t('c', 'support', null, 0, '2026-11-22T12:00:00Z')]
  assert.equal(chat.unreadTotal(list), 3)
  assert.deepEqual(chat.sortThreads(list).map((x) => x.id), ['b', 'c', 'a'])
  assert.equal(chat.threadFor(list, 'lead-12').id, 'a')
  assert.equal(chat.threadFor(list, 'project').id, 'b')
  assert.equal(chat.threadFor(list, 'lead-99'), null)
  assert.equal(chat.threadFor(list, '../x'), null)
  assert.equal(chat.threadFor(list, null), null)
})

test('composer: Enter sends, Shift+Enter breaks the line, composing is left alone', () => {
  assert.equal(chat.composerKey({ key: 'Enter', shiftKey: false }), 'send')
  assert.equal(chat.composerKey({ key: 'Enter', shiftKey: true }), 'newline')
  assert.equal(chat.composerKey({ key: 'Enter', shiftKey: false, isComposing: true }), null)
  assert.equal(chat.composerKey({ key: 'a', shiftKey: false }), null)
  assert.equal(chat.cleanMessage('  hi\r\n\r\n\r\n\r\n\r\nthere  '), 'hi\n\n\nthere')
  assert.equal(chat.cleanMessage('x'.repeat(3000)).length, chat.MESSAGE_MAX)
})

test('uploads: images, PDF, DOCX and ZIP up to 10 MB; the extension decides, a given type must match', () => {
  const ok = (o) => chat.checkUpload({ name: 'a.png', size: 1000, type: 'image/png', ...o })
  assert.equal(ok({}).ok, true)
  assert.equal(ok({ name: 'LOGO.JPG', type: 'image/jpeg' }).ok, true)
  assert.equal(ok({ name: 'brief.docx', type: '' }).ok, true)
  assert.equal(ok({ name: 'a.zip', type: 'application/zip' }).ok, true)
  assert.equal(ok({ name: 'notes.txt', type: 'text/plain' }).ok, true)
  assert.equal(ok({ name: 'a.gif', type: 'image/gif' }).error, 'type', 'HQ does not accept gif')
  assert.equal(ok({ name: 'a.exe', type: 'application/octet-stream' }).error, 'type')
  assert.equal(ok({ name: 'a.svg', type: 'image/svg+xml' }).error, 'type')
  assert.equal(ok({ name: 'noext' }).error, 'type')
  assert.equal(ok({ name: 'a.png', type: 'application/pdf' }).error, 'type')
  assert.equal(ok({ size: chat.UPLOAD_MAX_BYTES + 1 }).error, 'size')
  assert.equal(ok({ size: chat.UPLOAD_MAX_BYTES }).ok, true)
  assert.equal(ok({ size: 0 }).error, 'empty')
  assert.equal(chat.formatSize(512), '512 B')
  assert.equal(chat.formatSize(2048), '2 KB')
  assert.equal(chat.formatSize(5 * 1024 * 1024), '5.0 MB')
})

test('materials: the project thread first, then the request; own uploads newest first', () => {
  const t = (id, kind) => ({ id, kind, refId: null, title: id, unread: 0, lastAt: null })
  assert.equal(chat.materialsThread([t('s', 'support'), t('l', 'lead'), t('p', 'project')]).id, 'p')
  assert.equal(chat.materialsThread([t('s', 'support'), t('l', 'lead')]).id, 'l')
  assert.equal(chat.materialsThread([t('s', 'support')]), null)
  const att = (name) => ({ name, href: '/x', size: 1, label: 'logo' })
  const files = chat.materialFiles([
    { id: '1', at: '2026-11-20T10:00:00Z', from: 'client', text: '', attachments: [att('old.png')], readAt: null },
    { id: '2', at: '2026-11-21T10:00:00Z', from: 'firtech', text: '', attachments: [att('kp.pdf')], readAt: null },
    { id: '3', at: '2026-11-22T10:00:00Z', from: 'client', text: '', attachments: [att('new.png')], readAt: null },
  ])
  assert.deepEqual(files.map((f) => f.name), ['new.png', 'old.png'])
  assert.equal(chat.isMaterialLabel('logo'), true)
  assert.equal(chat.isMaterialLabel('virus'), false)
  assert.deepEqual(chat.groupByDay([
    { id: '1', at: '2026-11-20T10:00:00Z' }, { id: '2', at: '2026-11-20T23:00:00Z' }, { id: '3', at: '2026-11-21T01:00:00Z' },
  ]).map((g) => [g.day, g.items.length]), [['2026-11-20', 2], ['2026-11-21', 1]])
})

// ---- HQ client: the dev mock and a fake HQ ----------------------------------------------------

const dev = { NODE_ENV: 'development' }
const prod = { HQ_ADMIN_URL: 'http://hq.test/admin', HQ_ADMIN_TOKEN: 'tok', NODE_ENV: 'production' }

test('dev mock: quote accepted, contract delivered, signed, invoice issued; the second accept is refused', async () => {
  mock.resetMockState()
  const before = await hq.fetchClientDocuments(1, dev)
  assert.equal(before.data.find((d) => d.id === 'q-14').state, 'awaiting_client')
  assert.deepEqual(await hq.acceptClientDocument(1, 'q-14', dev), { ok: true, data: { next: 'contract' } })
  assert.deepEqual(await hq.acceptClientDocument(1, 'q-14', dev), { ok: false, error: 'not_awaiting' })
  const mid = (await hq.fetchClientDocuments(1, dev)).data
  assert.equal(mid.find((d) => d.id === 'q-14').state, 'accepted')
  const contract = mid.find((d) => d.id === 'c-q-14')
  assert.equal(contract.state, 'awaiting_signature')
  const payload = docs.buildSignaturePayload({ png: png(), name: 'Тест', consent: true }).payload
  assert.deepEqual(await hq.signClientDocument(1, contract.id, payload, {}, dev), { ok: true, data: { signed: true } })
  assert.deepEqual(await hq.signClientDocument(1, contract.id, payload, {}, dev), { ok: false, error: 'not_awaiting' })
  const after = (await hq.fetchClientDocuments(1, dev)).data
  assert.equal(after.find((d) => d.id === contract.id).state, 'signed')
  assert.equal(after.find((d) => d.kind === 'invoice' && d.state === 'issued' && d.id === `i-${contract.id}`).payUrl.startsWith('https://'), true)
  assert.deepEqual(await hq.acceptClientDocument(1, 'nope', dev), { ok: false, error: 'not_found' })
  mock.resetMockState()
})

test('dev mock: the cabinet data carries the v3 states and the derived actions point at real documents', async () => {
  mock.resetMockState()
  const client = (await hq.fetchClientByEmail('a@b.co', dev)).data
  const docsList = (await hq.fetchClientDocuments(1, dev)).data
  assert.deepEqual(client.projects.map((p) => [p.id, p.state]), [[1, 'in_progress'], [2, 'preparing']])
  const p1 = client.projects.find((p) => p.id === 1)
  const p2 = client.projects.find((p) => p.id === 2)
  assert.equal(docs.deriveNextAction(docsList, p1.milestones, { projectId: 1 }).kind, 'accept_stage')
  const sign = docs.deriveNextAction(docsList, p2.milestones, { projectId: 2 })
  assert.equal(sign.kind, 'sign_contract')
  assert.equal(docsList.find((d) => d.id === sign.docId).kind, 'contract')
  const shown = docs.leadsWithoutProject(client.leads, client.projects, docsList)
  assert.deepEqual(shown.map((l) => l.id), [14], 'leads 12 and 9 are projects 2 and 1 now')
  assert.equal(docs.deriveNextAction(docsList, [], { leadId: 14 }).kind, 'accept_quote')
})

test('dev mock: messenger sends, reads and refreshes after an id; a missing thread is refused', async () => {
  mock.resetMockState()
  const threads = (await hq.fetchThreads(1, dev)).data
  assert.deepEqual(threads.map((t) => t.kind).sort(), ['lead', 'project', 'project', 'support'])
  assert.equal(chat.unreadTotal(threads), 3)
  const before = (await hq.fetchThreadMessages(1, 'lead-14', null, dev)).data
  const sent = await hq.postThreadMessage(1, 'lead-14', 'Спасибо!', [], dev)
  assert.equal(sent.ok, true)
  const fresh = (await hq.fetchThreadMessages(1, 'lead-14', before.at(-1).id, dev)).data
  assert.deepEqual(fresh.map((m) => m.text), ['Спасибо!'])
  assert.equal((await hq.markThreadRead(1, 'lead-14', dev)).ok, true)
  assert.equal((await hq.fetchThreads(1, dev)).data.find((t) => t.id === 'lead-14').unread, 0)
  assert.deepEqual(await hq.fetchThreadMessages(1, 'zzz', null, dev), { ok: false, error: 'not_found' })
  assert.equal((await hq.postThreadMessage(1, 'zzz', 'x', [], dev)).error, 'not_found')
  const file = new File(['x'], 'logo.png', { type: 'image/png' })
  const up = await hq.uploadThreadFile(1, 'project-1', file, 'logo', dev)
  assert.equal(up.ok, true)
  assert.equal(up.data.attachments[0].label, 'logo')
  assert.match(up.data.attachments[0].href, /^\/api\/cabinet\/media\?u=/)
  mock.resetMockState()
})

test('real HQ: paths, methods, the token header and the error codes of the v3 calls', async () => {
  const calls = []
  const fake = (status, body) => async (url, init) => {
    calls.push({ url, method: init.method, token: init.headers['x-admin-token'], body: init.body })
    return new Response(JSON.stringify(body), { status })
  }
  await hq.fetchClientDocuments(7, prod, fake(200, { ok: true, items: [rawDoc()] }))
  await hq.acceptClientDocument(7, 'bo:1', prod, fake(200, { ok: true, next: 'contract' }))
  await hq.signClientDocument(7, 'c1', { signaturePng: png(), name: 'A B', consent: true }, { ip: '1.2.3.4', userAgent: 'UA' }, prod, fake(200, { ok: true, pdfUrl: '/media/x.pdf' }))
  await hq.fetchThreads(7, prod, fake(200, { ok: true, items: [] }))
  await hq.fetchThreadMessages(7, 'lead-12', '41', prod, fake(200, { ok: true, items: [] }))
  await hq.postThreadMessage(7, 'lead-12', 'hi', [], prod, fake(200, { ok: true, item: { id: 1, from: 'client', text: 'hi' } }))
  await hq.markThreadRead(7, 'lead-12', prod, fake(200, { ok: true, unread: 0 }))
  await hq.patchClientProfile(7, { name: 'Алиса', telegram: '@alice_1', locale: 'ru' }, prod, fake(200, { ok: true, client: {} }))
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url.replace('http://hq.test/admin', '')}`), [
    'GET /clients/7/documents',
    'POST /clients/7/documents/bo%3A1/accept',
    'POST /clients/7/documents/c1/sign',
    'GET /clients/7/threads',
    'GET /clients/7/threads/lead-12/messages?after=41',
    'POST /clients/7/threads/lead-12/messages',
    'POST /clients/7/threads/lead-12/read',
    'POST /clients/7',
  ])
  assert.ok(calls.every((c) => c.token === 'tok'))
  assert.deepEqual(JSON.parse(calls[7].body), { name: 'Алиса', telegram: '@alice_1', locale: 'ru' }, 'the profile patch, never the registration upsert POST /clients')
  const signBody = JSON.parse(calls[2].body)
  assert.deepEqual(Object.keys(signBody).sort(), ['consent', 'ip', 'name', 'signaturePng', 'userAgent'])
  assert.equal(signBody.ip, '1.2.3.4')
  const err = async (status, body, fn) => (await fn(fake(status, body))).error
  assert.equal(await err(409, { error: 'not_awaiting' }, (f) => hq.acceptClientDocument(7, 'd', prod, f)), 'not_awaiting')
  assert.equal(await err(409, { error: 'other' }, (f) => hq.acceptClientDocument(7, 'd', prod, f)), 'hq_error')
  const sign = (f) => hq.signClientDocument(7, 'd', { signaturePng: png(), name: 'A B', consent: true }, {}, prod, f)
  assert.equal(await err(422, { error: 'bad_signature', reason: 'not_png' }, sign), 'bad_signature')
  assert.equal(await err(422, { error: 'bad_signature', reason: 'blank' }, sign), 'no_signature')
  assert.equal(await err(422, { error: 'bad_signature', reason: 'too_large' }, sign), 'too_big')
  assert.equal(await err(409, { error: 'not_awaiting', state: 'signed' }, sign), 'not_awaiting')
  assert.equal(await err(404, {}, (f) => hq.fetchThreads(7, prod, f)), 'not_found')
  assert.equal(await err(429, { error: 'rate_limited' }, (f) => hq.postThreadMessage(7, 't', 'x', [], prod, f)), 'rate_limited')
  assert.equal(await err(429, { error: 'limit_reached' }, (f) => hq.postThreadMessage(7, 't', 'x', [], prod, f)), 'limit_reached')
  assert.equal(await err(500, {}, (f) => hq.fetchThreads(7, prod, f)), 'hq_error')
  const boom = async () => { throw new Error('down') }
  assert.equal((await hq.fetchThreads(7, prod, boom)).error, 'hq_unreachable')
  assert.equal((await hq.fetchClientDocuments(0, prod)).error, 'not_found')
  // an older HQ without v3: the extras fail softly
  const extras = await hq.fetchCabinetExtras(7, prod, fake(404, {}))
  assert.deepEqual([extras.docs.length, extras.threads.length, extras.v3], [0, 0, false])
})

test('real HQ: an agent thread message returns the agent reply with the item', async () => {
  const fetcher = async () => new Response(JSON.stringify({ ok: true, item: { id: 5, from: 'client', text: 'Привет' }, reply: { id: 6, from: 'agent', text: 'Здравствуйте!' } }), { status: 200 })
  const r = await hq.postThreadMessage(7, 'agent-5', 'Привет', [], prod, fetcher)
  assert.equal(r.data.item.id, '5')
  assert.equal(r.data.reply.from, 'agent')
})

test('real HQ: the upload is base64 JSON, then its id is attached to a message with the label tag (no multipart)', async () => {
  const calls = []
  const fetcher = async (url, init) => {
    calls.push({ url, type: init.headers['content-type'], body: JSON.parse(init.body) })
    return new Response(
      JSON.stringify(calls.length === 1
        ? { ok: true, item: { id: 'u9', name: 'a.png', type: 'image/png', size: 3, url: 'https://hq.test/media/s/a.png?e=1' } }
        : { ok: true, item: { id: 5, from: 'client', text: '[logo]', attachments: [{ name: 'a.png', url: 'https://hq.test/media/s/a.png?e=1', size: 3 }] } }),
      { status: 200 },
    )
  }
  const file = new File(['abc'], 'a.png', { type: 'image/png' })
  const r = await hq.uploadThreadFile(7, 'project-4', file, 'logo', prod, fetcher)
  assert.equal(r.ok, true)
  assert.equal(calls[0].url, 'http://hq.test/admin/clients/7/uploads')
  assert.equal(calls[0].type, 'application/json')
  assert.deepEqual(calls[0].body, { name: 'a.png', dataBase64: Buffer.from('abc').toString('base64') })
  assert.equal(calls[1].url, 'http://hq.test/admin/clients/7/threads/project-4/messages')
  assert.deepEqual(calls[1].body, { text: '[logo]', attachments: ['u9'] })
  assert.equal(r.data.text, '', 'the tag is read back as a label')
  assert.equal(r.data.attachments[0].label, 'logo')
  const unsupported = await hq.uploadThreadFile(7, 't', file, '', prod, async () => new Response('{}', { status: 415 }))
  assert.equal(unsupported.error, 'unsupported_type')
  const big = await hq.uploadThreadFile(7, 't', file, '', prod, async () => new Response('{}', { status: 413 }))
  assert.equal(big.error, 'too_large')
})

test('media links: only the /media path of a link is used, always on HQ\'s own origin', () => {
  const r = (u, env = prod) => hq.resolveMediaUrl(u, env)
  assert.equal(r('/media/signed/a.pdf?e=1'), 'http://hq.test/media/signed/a.pdf?e=1')
  assert.equal(r('https://hq.firtech.pro/media/sig/cabinet/c1/contract-7.pdf?e=1795000000'), 'http://hq.test/media/sig/cabinet/c1/contract-7.pdf?e=1795000000', 'the public host is replaced by HQ itself')
  assert.equal(r('https://evil.test/media/a.pdf'), 'http://hq.test/media/a.pdf', 'a foreign host is never requested')
  assert.equal(r('/media/../admin/clients'), null)
  assert.equal(r('/media//evil.test/x'), null)
  assert.equal(r('/admin/clients'), null)
  assert.equal(r('file:///etc/passwd'), null)
  assert.equal(r('https://hq.test/etc/passwd'), null)
  assert.equal(r('/media/a.pdf', dev), null, 'no real HQ, no fetch')
})

test('the mock PDF is a real PDF', () => {
  const pdf = Buffer.from(mock.mockPdf('Document q-14')).toString('latin1')
  assert.match(pdf, /^%PDF-1\.4/)
  assert.match(pdf, /%%EOF$/)
  assert.match(pdf, /startxref\n\d+\n%%EOF/)
})

// ---- view model --------------------------------------------------------------------------------

test('project status words follow the state and what the client has to do', () => {
  const k = data.projectStatusKey
  assert.equal(k('preparing', 'wait'), 'preparing')
  assert.equal(k('preparing', 'accept_quote'), 'preparing_accept')
  assert.equal(k('preparing', 'sign_contract'), 'preparing_sign')
  assert.equal(k('preparing', 'pay_stage'), 'preparing_pay')
  assert.equal(k('in_progress', 'wait'), 'in_progress')
  assert.equal(k('in_progress', 'accept_stage'), 'in_progress_accept')
  assert.equal(k('in_progress', 'pay_stage'), 'in_progress_pay')
  assert.equal(k('paused', 'accept_stage'), 'paused')
  assert.equal(k('done', 'pay_stage'), 'done')
  for (const dict of [ru, en]) for (const key of ['preparing', 'preparing_accept', 'preparing_sign', 'preparing_pay', 'in_progress', 'in_progress_accept', 'in_progress_pay', 'paused', 'done']) assert.ok(dict.cabinet.v3.status[key], key)
})

test('the road to the start: the current step follows the next action', () => {
  const now = (kind) => data.prepSteps(kind).find((s) => s.state === 'now').id
  assert.equal(now('accept_quote'), 'quote')
  assert.equal(now('wait'), 'contract')
  assert.equal(now('sign_contract'), 'sign')
  assert.equal(now('pay_stage'), 'pay')
  assert.deepEqual(data.prepSteps('pay_stage').map((s) => s.state), ['done', 'done', 'done', 'now', 'next'])
})

test('projects: the ones that wait for the client first, then running, preparing, paused, done', () => {
  const ps = [
    { id: 1, state: 'done' }, { id: 2, state: 'paused' }, { id: 3, state: 'preparing' }, { id: 4, state: 'in_progress' }, { id: 5, state: 'preparing' },
  ]
  assert.deepEqual(data.sortProjects(ps, (p) => p.id === 5).map((p) => p.id), [5, 4, 3, 2, 1])
})

test('old HQ without v3: invoices and documents become simple documents without files', () => {
  const list = data.legacyDocs({
    invoices: [{ id: 'bl:1', status: 'issued', title: 'Сайт', amountUsd: 150, number: 'FT-1', createdAt: null }, { id: 'bl:2', status: 'void', title: 'x', amountUsd: 1, number: null, createdAt: null }],
    documents: [{ id: 'bo:1', kind: 'contract', status: 'approved', title: 'Договор', createdAt: null }, { id: 'bo:2', kind: 'contract', status: 'pending', title: 'Черновик', createdAt: null }, { id: 'bo:3', kind: 'invoice', status: 'approved', title: 'dup', createdAt: null }],
  })
  assert.deepEqual(list.map((d) => [d.id, d.kind, d.state]), [['inv:bl:1', 'invoice', 'issued'], ['doc:bo:1', 'contract', 'accepted']])
  assert.ok(list.every((d) => !d.hasPdf && !d.hasHtml && d.payUrl === null))
})

test('cabinet view: the mock client gets documents, actions, badges and the project thread', async () => {
  mock.resetMockState()
  const client = hq.cabinetMock('a@b.co')
  const extras = {
    docs: (await hq.fetchClientDocuments(1, dev)).data,
    threads: (await hq.fetchThreads(1, dev)).data,
    v3: true,
  }
  const v = view.buildCabinetView(client, extras)
  assert.deepEqual(v.projects.map((p) => [p.project.id, p.action.kind]), [[1, 'accept_stage'], [2, 'sign_contract']], 'both wait for the client, the running one first')
  assert.equal(v.projects.find((p) => p.project.id === 1).threadId, 'project-1')
  assert.deepEqual(v.leads.map((l) => l.id), [14])
  assert.equal(v.leadActions[14].kind, 'accept_quote')
  assert.equal(v.leadActions[14].docId, 'q-14')
  assert.deepEqual(v.counts, { documents: 3, messages: 3 })
  assert.equal(v.tabs.includes('agent'), false)
  assert.equal(v.materialsThread.kind, 'project')
  assert.equal(v.recentDocs.length, 3)
  assert.ok(v.docs.every((d) => !('pdfUrl' in d)), 'no HQ links reach the browser')
  // an old HQ: legacy documents
  const old = view.buildCabinetView(client, view.noExtras)
  assert.ok(old.docs.length > 0)
  assert.ok(old.docs.every((d) => d.id.startsWith('inv:') || d.id.startsWith('doc:')))
  mock.resetMockState()
})

test('terms carry the simple e-signature section after the guarantee, in both languages, hyphens only', () => {
  for (const dict of [ru, en]) {
    const ids = dict.terms.sections.map((x) => x.id)
    assert.equal(ids[ids.indexOf('guarantee') + 1], 'esign')
    const sec = dict.terms.sections.find((x) => x.id === 'esign')
    assert.ok(sec.title.length > 0 && sec.text.length >= 2 && sec.list.length >= 4)
    assert.doesNotMatch(JSON.stringify(sec), /[–—]/)
  }
  assert.match(ru.cabinet.v3.docs.signPad.consent, /простой электронной подписью/)
})

// ---- copy --------------------------------------------------------------------------------------

const shape = (v) => (v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v)

test('copy: the cabinet dictionaries have one shape, no long dashes, no typed prices', () => {
  assert.deepEqual(shape(en.cabinet), shape(ru.cabinet))
  for (const dict of [ru, en]) {
    const text = JSON.stringify(dict.cabinet)
    assert.doesNotMatch(text, /[–—]/)
    assert.doesNotMatch(text, /\$\s?\d|\d\s?\$|\d\s?USD|\d\s?%/)
  }
})
