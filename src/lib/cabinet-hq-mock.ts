import type { ChatMessage, ChatThread } from './cabinet-chat'
import { mediaHref } from './cabinet-chat'
import type { ClientDoc } from './cabinet-docs'

// Development data for the cabinet v3 (documents, messenger) so every screen works without HQ.
// The state is kept on `globalThis` so the route handlers (separate bundles in `next dev`) share it.
// Everything here follows the contract draft (`cabinet-docs-contract.md`, sections 2-5); the real HQ
// replaces it when `HQ_ADMIN_URL` is set. Nothing here ships a secret.

type MockState = {
  seq: number
  docs: ClientDoc[]
  threads: ChatThread[]
  messages: Record<string, ChatMessage[]>
  signatures: { docId: string; name: string; bytes: number }[]
  reviews: { id: number; clientId: number; client: string; projectId: number; rating: number; text: string; at: string }[]
}

// Realistic document bodies (markdown, as HQ sends them): the quote and the contract cut before «Подписи сторон».
const QUOTE_TEXT = `# Коммерческое предложение

**Автоматизация заявок из Instagram**

## Что мы сделаем

- Подключим директ Instagram к таблице заявок.
- Настроим ответ на частые вопросы и передачу заявки менеджеру.
- Добавим уведомление в Telegram о каждой новой заявке.

## Этапы и сроки

1. Разбор и настройка: 3 рабочих дня.
2. Подключение и тесты: 4 рабочих дня.
3. Запуск и передача: 2 рабочих дня.

## Стоимость

Итого **450 USD**, оплата по этапам: 30% / 40% / 30%. Каждый этап оплачивается до его начала.

## Что не входит

Платная реклама, ведение аккаунта и доработки сверх согласованного списка.

Предложение действует 14 дней.`
const CONTRACT_TEXT = `# Договор на разработку

**Д-2026-012**, исполнитель Fir Tech, заказчик указан в карточке проекта.

## 1. Предмет договора

Исполнитель разрабатывает и запускает *бота для записи в салон* в объёме, согласованном в коммерческом предложении КП-2026-012.

## 2. Стоимость и оплата

1. Стоимость работ: **340 USD**.
2. Оплата тремя этапами: 30% до начала, 40% после показа прототипа, 30% после запуска.
3. Счёт на каждый этап выставляется до его начала.

## 3. Сроки и приёмка

- Срок работ: 14 рабочих дней с момента оплаты первого этапа.
- Каждый этап принимается заказчиком в кабинете; молчание 5 рабочих дней считается приёмкой.

## 4. Права и данные

Права на результат переходят заказчику после полной оплаты. Данные клиентов заказчика обрабатываются только для работы бота.`

const day = 86_400_000
const at = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString()

function seed(): MockState {
  const doc = (d: Partial<ClientDoc> & Pick<ClientDoc, 'id' | 'kind' | 'title' | 'state'>): ClientDoc => ({
    number: null,
    leadId: null,
    projectId: null,
    createdAt: at(-1),
    deliveredAt: at(-1),
    acceptedAt: null,
    signedAt: null,
    pdfUrl: `/media/mock/${d.id}.pdf`,
    amountUsd: null,
    stageNo: null,
    payUrl: null,
    text: null,
    ...d,
  })
  const docs: ClientDoc[] = [
    doc({ id: 'q-14', kind: 'quote', title: 'Коммерческое предложение: автоматизация заявок', number: 'КП-2026-014', leadId: 14, state: 'awaiting_client', createdAt: at(-0.3), amountUsd: 450, text: QUOTE_TEXT }),
    doc({ id: 'q-7', kind: 'quote', title: 'Коммерческое предложение: сайт-визитка', number: 'КП-2026-007', leadId: 7, state: 'declined', createdAt: at(-9), amountUsd: 300, pdfUrl: null }),
    doc({ id: 'q-6', kind: 'quote', title: 'Коммерческое предложение: чат-бот', number: 'КП-2026-006', leadId: 6, state: 'expired', createdAt: at(-20), amountUsd: 280 }),
    doc({ id: 'c-2', kind: 'contract', title: 'Договор: бот для записи в салон', number: 'Д-2026-012', leadId: 12, projectId: 2, state: 'awaiting_signature', createdAt: at(-0.6), amountUsd: 340, text: CONTRACT_TEXT }),
    doc({ id: 'q-12', kind: 'quote', title: 'Коммерческое предложение: бот для записи', number: 'КП-2026-012', leadId: 12, projectId: 2, state: 'accepted', createdAt: at(-1.6), acceptedAt: at(-1.2), amountUsd: 340 }),
    doc({ id: 'c-1', kind: 'contract', title: 'Договор: сайт для барбершопа', number: 'Д-2026-009', leadId: 9, projectId: 1, state: 'signed', createdAt: at(-14), signedAt: at(-13.5), amountUsd: 400 }),
    doc({ id: 'i-1-3', kind: 'invoice', title: 'Счёт, этап 3: запуск и передача', number: 'FT-2026-004', leadId: 9, projectId: 1, state: 'issued', createdAt: at(-1), amountUsd: 100, stageNo: 3, payUrl: 'https://firtech.pro/ru/pay/FT-2026-004?k=mock' }),
    doc({ id: 'i-1-2', kind: 'invoice', title: 'Счёт, этап 2: вёрстка и страницы', number: 'FT-2026-003', leadId: 9, projectId: 1, state: 'paid', createdAt: at(-8), amountUsd: 150, stageNo: 2 }),
    doc({ id: 'i-1-1', kind: 'invoice', title: 'Счёт, этап 1: дизайн и прототип', number: 'FT-2026-001', leadId: 9, projectId: 1, state: 'paid', createdAt: at(-14), amountUsd: 150, stageNo: 1 }),
  ]
  const threads: ChatThread[] = [
    { id: 'lead-14', kind: 'lead', refId: '14', title: 'Заявка: автоматизация заявок', unread: 1, lastAt: at(-0.3) },
    { id: 'project-2', kind: 'project', refId: '2', title: 'Проект: бот для записи в салон', unread: 0, lastAt: at(-0.5) },
    { id: 'project-1', kind: 'project', refId: '1', title: 'Проект: сайт для барбершопа', unread: 2, lastAt: at(-0.1) },
    { id: 'support', kind: 'support', refId: null, title: 'Поддержка', unread: 0, lastAt: at(-5) },
  ]
  const m = (id: string, offset: number, from: ChatMessage['from'], text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
    id,
    at: at(offset),
    from,
    text,
    attachments: [],
    readAt: from === 'client' ? at(offset + 0.01) : null,
    ...extra,
  })
  const messages: Record<string, ChatMessage[]> = {
    'lead-14': [
      m('1', -1, 'client', 'Нужно, чтобы заявки из Instagram сами попадали в таблицу.'),
      m('2', -0.9, 'firtech', 'Здравствуйте! Поняли задачу. Уточните, пожалуйста: заявки приходят в директ или в комментариях?'),
      m('3', -0.8, 'client', 'В директ, около двадцати в день.'),
      m('4', -0.3, 'firtech', 'Спасибо. Коммерческое предложение готово, оно в разделе «Документы». Посмотрите и примите, если всё подходит.'),
    ],
    'project-1': [
      m('1', -9, 'firtech', 'Прототип главной страницы готов, ссылка в этапе 1.'),
      m('2', -8, 'client', 'Выглядит отлично, принимаю.'),
      m('3', -0.4, 'firtech', 'Страницы собраны, этап 2 ждёт вашей приёмки.'),
      m('4', -0.1, 'firtech', 'Если есть правки по тексту, напишите здесь.'),
    ],
    'project-2': [m('1', -0.5, 'firtech', 'Договор готов. Подпишите его в разделе «Документы», и мы выставим счёт на первый этап.')],
    support: [m('1', -5, 'client', 'Можно ли добавить страницу с ценами?', { readAt: at(-4.9) }), m('2', -4.9, 'firtech', 'Да, добавим в рамках этапа 2.')],
  }
  return { seq: 100, docs, threads, messages, signatures: [], reviews: [] }
}

type G = typeof globalThis & { __firtechCabinetMock?: MockState }
export function mockState(): MockState {
  const g = globalThis as G
  g.__firtechCabinetMock ??= seed()
  return g.__firtechCabinetMock
}
export const resetMockState = () => {
  ;(globalThis as G).__firtechCabinetMock = seed()
}
const nextId = () => String(++mockState().seq)

// ---- documents -------------------------------------------------------------------------------

export function mockAcceptQuote(docId: string): 'ok' | 'not_found' | 'not_awaiting' {
  const s = mockState()
  const d = s.docs.find((x) => x.id === docId)
  if (!d) return 'not_found'
  if (d.kind !== 'quote' || d.state !== 'awaiting_client') return 'not_awaiting'
  d.state = 'accepted'
  d.acceptedAt = new Date().toISOString()
  // HQ would propose the contract and the owner approve it; the mock delivers it at once.
  s.docs.unshift({
    ...d,
    id: `c-${d.id}`,
    kind: 'contract',
    title: d.title.replace(/^Коммерческое предложение/, 'Договор'),
    number: d.number ? d.number.replace('КП', 'Д') : null,
    state: 'awaiting_signature',
    createdAt: new Date().toISOString(),
    acceptedAt: null,
  })
  postMock('lead-14', 'firtech', 'Спасибо, КП принято. Договор уже в разделе «Документы», подпишите его там.')
  return 'ok'
}

// «Отклонить / обсудить»: the quote becomes `declined`, the client's words go to the request's thread.
export function mockRejectQuote(docId: string, reason: string, mode: 'decline' | 'discuss'): 'ok' | 'not_found' | 'not_awaiting' {
  const s = mockState()
  const d = s.docs.find((x) => x.id === docId)
  if (!d) return 'not_found'
  if (d.kind !== 'quote' || d.state !== 'awaiting_client') return 'not_awaiting'
  d.state = 'declined'
  const thread = d.leadId ? `lead-${d.leadId}` : 'support'
  postMock(thread, 'client', `${mode === 'discuss' ? 'Хочу обсудить КП: ' : 'Не подходит: '}${reason}`)
  postMock(thread, 'firtech', 'Ваш ответ у менеджера, он ответит в сообщениях.')
  return 'ok'
}

// One review per project (the mock has projects 1 and 2).
const reviewed = new Set<number>()
export function mockReview(projectId: number, rating: number, text: string): 'ok' | 'not_found' | 'exists' | 'invalid' {
  if (projectId !== 1 && projectId !== 2) return 'not_found'
  if (rating < 1 || rating > 5 || !text.trim()) return 'invalid'
  if (reviewed.has(projectId)) return 'exists'
  reviewed.add(projectId)
  mockState().reviews.push({ id: mockState().reviews.length + 1, clientId: 1, client: 'Тестовый клиент', projectId, rating, text, at: new Date().toISOString() })
  return 'ok'
}

export function mockSign(docId: string, name: string, bytes: number): 'ok' | 'not_found' | 'not_awaiting' {
  const s = mockState()
  const d = s.docs.find((x) => x.id === docId)
  if (!d) return 'not_found'
  if (d.kind !== 'contract' || d.state !== 'awaiting_signature') return 'not_awaiting'
  d.state = 'signed'
  d.signedAt = new Date().toISOString()
  s.signatures.push({ docId, name, bytes })
  s.docs.unshift({
    ...d,
    id: `i-${d.id}`,
    kind: 'invoice',
    title: 'Счёт, этап 1',
    number: `FT-2026-${String(s.seq).padStart(3, '0')}`,
    state: 'issued',
    signedAt: null,
    createdAt: new Date().toISOString(),
    stageNo: 1,
    amountUsd: d.amountUsd ? Math.round(d.amountUsd / 2) : 100,
    payUrl: `https://firtech.pro/ru/pay/FT-MOCK-${d.id}?k=mock`,
  })
  return 'ok'
}

// A tiny valid one-page PDF (Helvetica, ASCII only) standing in for HQ's rendered document.
export function mockPdf(title: string): Uint8Array {
  const text = title.replace(/[^\x20-\x7e]/g, '').replace(/[()\\]/g, '') || 'Fir Tech document'
  const stream = `BT /F1 22 Tf 72 740 Td (Fir Tech) Tj ET\nBT /F1 14 Tf 72 700 Td (${text}) Tj ET\nBT /F1 11 Tf 72 660 Td (Demo document for the cabinet. HQ renders the real one.) Tj ET\n0.78 0.96 0.2 rg 72 620 120 4 re f`
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new TextEncoder().encode(out)
}

// ---- messenger -------------------------------------------------------------------------------

export function postMock(threadId: string, from: ChatMessage['from'], text: string, attachments: ChatMessage['attachments'] = []): ChatMessage {
  const s = mockState()
  const msg: ChatMessage = { id: nextId(), at: new Date().toISOString(), from, text, attachments, readAt: null }
  ;(s.messages[threadId] ??= []).push(msg)
  const t = s.threads.find((x) => x.id === threadId)
  if (t) {
    t.lastAt = msg.at
    if (from !== 'client') t.unread += 1
  }
  return msg
}

export function mockSend(threadId: string, text: string, attachments: ChatMessage['attachments']): ChatMessage | null {
  const s = mockState()
  const t = s.threads.find((x) => x.id === threadId)
  if (!t) return null
  const sent = postMock(threadId, 'client', text, attachments)
  // The earlier firtech messages count as read once the client writes in the thread.
  return sent
}

export function mockMessages(threadId: string, after: string | null): ChatMessage[] | null {
  const s = mockState()
  if (!s.threads.some((t) => t.id === threadId)) return null
  const all = s.messages[threadId] ?? []
  if (!after) return all
  const i = all.findIndex((m) => m.id === after)
  return i >= 0 ? all.slice(i + 1) : all
}

export function mockRead(threadId: string): boolean {
  const s = mockState()
  const t = s.threads.find((x) => x.id === threadId)
  if (!t) return false
  t.unread = 0
  const now = new Date().toISOString()
  for (const m of s.messages[threadId] ?? []) if (m.from !== 'client' && !m.readAt) m.readAt = now
  return true
}

export function mockUpload(threadId: string, name: string, size: number, label: string): ChatMessage | null {
  const url = `/media/mock/upload/${nextId()}/${encodeURIComponent(name)}`
  const attachment = { name, href: mediaHref(url, name), size, label }
  return mockSend(threadId, label ? `[${label}]` : '', [attachment])
}
