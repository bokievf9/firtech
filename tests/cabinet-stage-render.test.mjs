// The cabinet as the client sees it (2026-11-21 stage track, 2026-11-22 v3): the real components rendered to
// static markup with the dev mock data (a 3-stage project, a project waiting for a signature, a request with
// a proposal to accept, documents, threads, an agent).
// The cabinet page needs a Supabase session, which the e2e run does not have, so the components
// are rendered here; .tsx is transpiled with TypeScript by a load hook (no new dependency).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const src = pathToFileURL(path.resolve('src') + '/').href
const stubs = {
  'server-only': 'export {}',
  'next/navigation': 'export const useRouter = () => ({ refresh() {}, push() {} }); export const useSearchParams = () => new URLSearchParams()',
}
registerHooks({
  resolve(specifier, context, next) {
    if (specifier in stubs) return { url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`, shortCircuit: true }
    if (specifier === 'next/link') return next('next/link.js', context)
    // Server actions pull in cookies and Supabase; the cards under test never call them.
    if (specifier.startsWith('@/app/') && specifier.endsWith('/actions')) {
      const stub = ['deleteAccountAction', 'changePasswordAction', 'changeEmailAction', 'signOutEverywhereAction', 'unsubscribeAction'].map((n) => `export const ${n} = async () => ({});`).join(' ')
      return { url: `data:text/javascript,${encodeURIComponent(stub)}`, shortCircuit: true }
    }
    if (specifier.startsWith('@/')) {
      const base = new URL(specifier.slice(2), src).href
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
        try {
          return next(candidate, context)
        } catch {}
      }
    }
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      for (const ext of ['.ts', '.tsx']) {
        try {
          return next(`${specifier}${ext}`, context)
        } catch {}
      }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (!url.endsWith('.tsx')) return next(url, context)
    const out = ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      fileName: fileURLToPath(url),
    })
    return { format: 'module', source: out.outputText, shortCircuit: true }
  },
})

const { renderToStaticMarkup } = await import('react-dom/server')
const { createElement } = await import('react')
const { default: ru } = await import('../src/content/ru.ts')
const { default: en } = await import('../src/content/en.ts')
const hq = await import('../src/lib/cabinet-hq.ts')
const mock = await import('../src/lib/cabinet-hq-mock.ts')
const { buildCabinetView, noExtras } = await import('../src/lib/cabinet-view.ts')
const { ProjectCard, EmptyProjects, RecentBlock } = await import('../src/components/cabinet/projects-home.tsx')
const { LeadsSection } = await import('../src/components/cabinet/leads-section.tsx')
const { NextActionBlock } = await import('../src/components/cabinet/next-action.tsx')
const { DocumentsPanel } = await import('../src/components/cabinet/documents-panel.tsx')
const { SignaturePad } = await import('../src/components/cabinet/signature-pad.tsx')
const { MessagesPanel } = await import('../src/components/cabinet/messages-panel.tsx')
const { AgentPanel } = await import('../src/components/cabinet/agent-panel.tsx')
const { MaterialsPanel } = await import('../src/components/cabinet/materials-panel.tsx')
const { ProfilePanel } = await import('../src/components/cabinet/profile-panel.tsx')

const dev = { NODE_ENV: 'development' }
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
const h = (C, props) => renderToStaticMarkup(createElement(C, props))

async function load() {
  mock.resetMockState()
  const data = hq.cabinetMock('a@b.co')
  const extras = {
    docs: (await hq.fetchClientDocuments(1, dev)).data,
    threads: (await hq.fetchThreads(1, dev)).data,
    agents: (await hq.fetchClientAgents(1, dev)).data,
    conversations: (await hq.fetchAgentConversations(1, 'pg-1', dev)).data,
    v3: true,
  }
  return { data, extras, view: buildCabinetView(data, extras) }
}
const card = (view, id, dict, locale) => {
  const p = view.projects.find((x) => x.project.id === id)
  return h(ProjectCard, { project: p.project, action: p.action, dict, locale, threadId: p.threadId })
}

test('Проекты: the project with stages: status in words, ONE big accept button, three stages in order, pay link on stage 3', async () => {
  const { view } = await load()
  const html = card(view, 1, ru, 'ru')
  const rows = [...html.matchAll(/<li[^>]*data-stage="(\d)"[^>]*data-step="(\w+)"/g)].map((m) => `${m[1]}:${m[2]}`)
  assert.deepEqual(rows, ['1:accepted', '2:accept', '3:pay'])
  const flat = text(html)
  assert.match(flat, /Этап сдан, ждём вашей приёмки\./)
  assert.match(flat, /Этап 1: принят/)
  assert.match(flat, /Этап 2: приёмка/)
  assert.match(flat, /Этап 3: оплата/)
  assert.equal((html.match(/data-accept-stage="2"/g) ?? []).length, 1, 'one accept button: the big one, not another in the row')
  assert.match(flat, /Принять этап 2/)
  assert.equal((html.match(/data-next-action="accept_stage"/g) ?? []).length, 1)
  const pay = /<a[^>]*data-pay-stage="3"[^>]*>/.exec(html)?.[0] ?? ''
  assert.match(pay, /href="https:\/\/firtech\.pro\/ru\/pay\/FT-2026-004/)
  assert.equal(pay.includes('_blank'), false, 'the pay link opens in the same window')
  assert.equal(/data-pay-stage="2"/.test(html), false, 'no pay link once the stage is paid')
  assert.doesNotMatch(flat, /статус работ|офис/i, 'our own status is not part of the client cabinet')
  assert.match(html, /data-project-state="in_progress"/)
})

test('Проекты: a project before payment shows the road to the start and the sign button', async () => {
  const { view } = await load()
  const html = card(view, 2, ru, 'ru')
  assert.match(html, /data-project-state="preparing"/)
  const flat = text(html)
  assert.match(flat, /Договор готов, ждём вашу подпись\./)
  const big = /<a[^>]*data-big-action[^>]*>/.exec(html)?.[0] ?? ''
  assert.match(big, /href="\?tab=documents&amp;doc=c-2"/)
  assert.match(flat, /Подписать договор/)
  const prep = [...html.matchAll(/data-prep="(\w+)"[^>]*|aria-current="step"[^>]*data-prep="(\w+)"/g)].map((m) => m[1] ?? m[2])
  assert.deepEqual(prep, ['quote', 'contract', 'sign', 'pay', 'work'])
  assert.match(html, /aria-current="step"[^>]*data-prep="sign"|data-prep="sign"[^>]*aria-current="step"/)
  assert.equal(html.includes('data-stage-track'), false)
  assert.match(html, /\?tab=messages&amp;ref=project-2/)
  assert.match(text(card(view, 2, en, 'en')), /The contract is ready and waits for your signature\./)
})

test('Проекты: the big button follows the next action, a wait is a calm line', () => {
  const act = (o) => ({ kind: 'wait', docId: null, stageNo: null, payUrl: null, text: '', ...o })
  const view = (a, projectId) => h(NextActionBlock, { action: a, dict: ru, projectId })
  const quote = view(act({ kind: 'accept_quote', docId: 'q-14' }))
  assert.match(text(quote), /Принять КП/)
  assert.match(quote, /href="\?tab=documents&amp;doc=q-14"/)
  const pay = view(act({ kind: 'pay_stage', stageNo: 3, payUrl: 'https://firtech.pro/pay/x' }))
  assert.match(text(pay), /Оплатить этап 3/)
  assert.equal(pay.includes('_blank'), false)
  assert.match(pay, /href="https:\/\/firtech\.pro\/pay\/x"/)
  const payNoLink = view(act({ kind: 'pay_stage', docId: 'i-1' }))
  assert.match(payNoLink, /doc=i-1/)
  assert.match(text(payNoLink), /Оплатить этап/)
  const wait = view(act({ text: 'Ждём вас на созвоне' }))
  assert.match(text(wait), /Ждём вас на созвоне/)
  assert.equal(wait.includes('data-big-action'), false)
  assert.match(text(view(act())), /От вас сейчас ничего не нужно/)
  assert.match(text(h(NextActionBlock, { action: act({ kind: 'sign_contract', docId: 'c-2' }), dict: en })), /Sign the contract/)
})

test('Заявки: a request with a proposal shows the accept button and a link to its thread; no reply box', async () => {
  const { view } = await load()
  assert.deepEqual(view.leads.map((l) => l.id), [14], 'the request that became a project and the running one are not listed again')
  const html = h(LeadsSection, { dict: ru, locale: 'ru', leads: view.leads, actions: view.leadActions, focus: null, fresh: false, follow: null })
  assert.equal((html.match(/data-lead="/g) ?? []).length, 1)
  const flat = text(html)
  assert.match(flat, /КП готово, ждём вашего решения/)
  assert.match(flat, /Принять КП/)
  assert.match(html, /data-lead-thread="14"/)
  assert.match(html, /\?tab=messages&amp;ref=lead-14/)
  assert.equal(/<textarea/.test(html), false, 'the reply box moved to the messenger')
  const none = h(LeadsSection, { dict: ru, locale: 'ru', leads: [], actions: {}, focus: null, fresh: false, follow: null })
  assert.equal(none, '')
  const fresh = h(LeadsSection, { dict: ru, locale: 'ru', leads: [], actions: {}, focus: null, fresh: true, follow: null })
  assert.match(fresh, /data-lead-pending/)
})

test('Проекты: no project and no request shows the empty state with the builder and the audit', () => {
  const html = h(EmptyProjects, { dict: ru, locale: 'ru' })
  assert.match(html, /data-projects-empty/)
  assert.match(html, /href="\/ru\/builder"/)
  assert.match(html, /href="\/ru\/audit"/)
  const view = buildCabinetView({ client: { id: 0, name: '', email: 'x@y.co', telegram: '', createdAt: null }, leads: null, projects: [], invoices: [], documents: [], tickets: [], referrals: [], referralSlug: null }, noExtras)
  assert.deepEqual([view.projects.length, view.leads.length, view.docs.length], [0, 0, 0])
  assert.equal(view.tabs.includes('agent'), false)
})

test('Главная: recent documents and the latest threads with unread badges', async () => {
  const { view, extras } = await load()
  const messages = view.recentThreads.map((thread) => ({ thread, last: { id: '1', at: null, from: 'firtech', text: 'Готово, посмотрите', attachments: [], readAt: null } }))
  const html = h(RecentBlock, { docs: view.recentDocs, messages, dict: ru, locale: 'ru' })
  assert.equal((html.match(/doc=/g) ?? []).length, 3)
  assert.match(text(html), /Ждёт вас/)
  assert.match(html, /\?tab=messages&amp;ref=/)
  assert.match(text(html), /Готово, посмотрите/)
  assert.equal(view.recentThreads.length, 3)
  assert.equal(extras.threads.length, 5)
})

test('Документы: states and order, those waiting for the client first, the badge count', async () => {
  const { view } = await load()
  const html = h(DocumentsPanel, { dict: ru, locale: 'ru', initial: view.docs, defaultName: 'Алиса' })
  const states = [...html.matchAll(/data-doc-state="(\w+)"/g)].map((m) => m[1])
  assert.deepEqual(states.slice(0, 3).sort(), ['awaiting_client', 'awaiting_signature', 'issued'])
  for (const label of ['Ждёт вас', 'Ждёт подписи', 'Выставлен', 'Оплачен', 'Подписано', 'Принято']) assert.match(text(html), new RegExp(label), label)
  assert.match(text(html), /Ждут вас: 3/)
  assert.equal(view.counts.documents, 3)
  assert.match(text(h(DocumentsPanel, { dict: en, locale: 'en', initial: view.docs, defaultName: '' })), /Waiting for you/)
  const empty = text(h(DocumentsPanel, { dict: ru, locale: 'ru', initial: [], defaultName: '' }))
  assert.match(empty, /Документов пока нет/)
})

test('Подпись: the pad has a canvas for pointers, a prefilled name, the consent sentence and a disabled button', () => {
  const html = h(SignaturePad, { dict: ru, defaultName: 'Алиса Иванова', onSubmit() {}, onCancel() {}, error: '', busy: false })
  assert.match(html, /<canvas[^>]*data-signature-canvas/)
  assert.match(html, /touch-action:none/)
  assert.match(html, /value="Алиса Иванова"/)
  assert.match(html, /type="checkbox"/)
  assert.match(text(html), /простой электронной подписью/)
  assert.match(/<button[^>]*disabled[^>]*>\s*Подписать договор/.exec(html)?.[0] ?? '', /disabled/)
  assert.match(text(html), /Очистить/)
  assert.match(text(h(SignaturePad, { dict: ru, defaultName: '', onSubmit() {}, onCancel() {}, error: 'bad_signature', busy: false })), /Подпись не принята/)
  assert.match(text(h(SignaturePad, { dict: en, defaultName: '', onSubmit() {}, onCancel() {}, error: '', busy: false })), /simple electronic signature/)
})

test('Сообщения: threads of every kind with unread badges, no support button while a support thread exists', async () => {
  const { extras } = await load()
  const html = h(MessagesPanel, { dict: ru, locale: 'ru', initial: extras.threads, tickets: [] })
  assert.equal((html.match(/data-thread-item=/g) ?? []).length, 5)
  for (const kind of ['Заявка', 'Проект', 'Агент', 'Поддержка']) assert.match(text(html), new RegExp(kind), kind)
  assert.match(html, /aria-label="Новых: 2"/)
  assert.equal(html.includes('data-support-cta'), false)
  const noSupport = h(MessagesPanel, { dict: ru, locale: 'ru', initial: extras.threads.filter((t) => t.kind !== 'support'), tickets: [] })
  assert.match(noSupport, /data-support-cta/)
  assert.match(text(h(MessagesPanel, { dict: ru, locale: 'ru', initial: [], tickets: [] })), /Диалогов пока нет/)
  assert.match(text(html), /Обновляется сама/)
})

test('Ваш агент: chat, settings, masked Telegram token field, usage and conversations', async () => {
  const { view, extras } = await load()
  const html = h(AgentPanel, { dict: ru, locale: 'ru', agent: view.agent, conversations: extras.conversations, thread: view.agentThread })
  const flat = text(html)
  assert.match(flat, /Ваш агент: Мила/)
  assert.match(flat, /Работает/)
  assert.match(html, /data-thread-kind="agent"/)
  assert.match(html, /data-agent-settings/)
  assert.match(html, /<input[^>]*type="password"[^>]*data-bot-token|<input[^>]*data-bot-token[^>]*type="password"/)
  assert.match(html, /autoComplete="off"|autocomplete="off"/i)
  assert.match(flat, /Подключить Telegram/)
  assert.match(flat, /Не подключён/)
  assert.match(flat, /из 200/)
  assert.equal((html.match(/data-conversations/g) ?? []).length, 1)
  assert.match(flat, /Виджет, 6 сообщ\./)
  assert.match(flat, /Собрано контактов: 2/)
  assert.doesNotMatch(flat, /За месяц/, 'HQ reports only today')
  assert.doesNotMatch(html, /AAH/, 'no token anywhere')
  const noThread = text(h(AgentPanel, { dict: en, locale: 'en', agent: view.agent, conversations: [], thread: null }))
  assert.match(noThread, /No conversations yet/)
  assert.match(noThread, /opens as soon as we connect it/)
})

test('Материалы: labels, upload form into the project thread, a note without any thread', async () => {
  const { view } = await load()
  assert.equal(view.materialsThread.kind, 'project')
  const html = h(MaterialsPanel, { dict: ru, locale: 'ru', thread: view.materialsThread })
  assert.equal((html.match(/type="radio"/g) ?? []).length, 5)
  for (const label of ['Логотип', 'Тексты', 'Доступы', 'Фото', 'Другое']) assert.match(text(html), new RegExp(label), label)
  assert.match(html, /data-upload/)
  assert.match(text(html), /до 10 МБ/)
  assert.match(text(h(MaterialsPanel, { dict: ru, locale: 'ru', thread: null })), /Загрузка откроется/)
})

test('profile (2026-11-22): five sections, switches as role=switch with the stored state, Telegram channel locked without a nick', () => {
  const base = {
    name: 'Анна', email: 'anna@example.com', telegram: '', phone: '', locale: 'ru', company: '', niche: 'salon', website: '', city: '',
    legalName: '', legalAddress: '', refundWallet: '', marketing: true, recommendations: false, notifyChannel: 'email', updatedAt: null,
  }
  const niches = [{ label: 'Красота и здоровье', options: [{ id: 'salon', name: 'Салон красоты' }] }]
  const html = h(ProfilePanel, { dict: ru, locale: 'ru', initial: base, legacy: false, niches, hasPassword: true })
  const t = text(html)
  for (const title of ['Вы', 'Компания', 'Для документов', 'Уведомления', 'Безопасность']) assert.match(t, new RegExp(title))
  assert.match(t, /Используется в договоре и счёте/)
  assert.match(t, /Всегда включено/)
  assert.match(html, /data-pref="marketing"[\s\S]*?role="switch" aria-checked="true"/)
  assert.match(html, /data-pref="recommendations"[\s\S]*?role="switch" aria-checked="false"/)
  const radio = (markup, v) => markup.match(new RegExp(`<input[^>]*type="radio"[^>]*value="${v}"[^>]*>`))?.[0] ?? ''
  assert.match(radio(html, 'telegram'), /disabled=""/)
  assert.match(radio(html, 'email'), /checked=""/)
  assert.match(t, /укажите ник в разделе «Вы»/)
  assert.match(html, /<option value="salon" selected="">/)
  assert.match(t, /Текущий пароль/)
  assert.doesNotMatch(html, /<form[^>]*data-profile/)
  const withTg = h(ProfilePanel, { dict: en, locale: 'en', initial: { ...base, telegram: '@anna_salon', notifyChannel: 'both' }, legacy: true, niches, hasPassword: false })
  assert.doesNotMatch(radio(withTg, 'telegram'), /disabled/)
  assert.match(radio(withTg, 'both'), /checked=""/)
  assert.match(text(withTg), /after a database update/)
  assert.doesNotMatch(text(withTg), /Current password/)
})
