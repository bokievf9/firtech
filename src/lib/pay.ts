// Payment page data: the invoice shape from HQ, validation, sanitizing and small helpers. No server
// code here, so the client island can use the types and formatters too.

export type PayMethodId = 'usdt_trc20' | 'usdt_ton'
export type PayStatus = 'issued' | 'paid' | 'void' | 'expired'
export type PaidVia = PayMethodId | 'manual'
export type PayError = 'not_found' | 'hq_unreachable' | 'hq_timeout' | 'hq_error'

export type PayMethod = { id: PayMethodId; network: string; address: string; note: string }
export type Invoice = {
  number: string
  title: string
  clientFirstName: string
  amountUsd: number
  payAmountUsd: number
  status: PayStatus
  dueDate: string | null
  issuedAt: string | null
  paidAt: string | null
  paidVia: PaidVia | null
  txId: string | null
  locale: 'ru' | 'en'
  methods: PayMethod[]
}
export type PayResult = { ok: true; invoice: Invoice } | { ok: false; error: PayError }

export const NUMBER_RE = /^FT-\d{4}-\d{3,}$/
export const KEY_RE = /^[A-Za-z0-9_-]{16,128}$/
const ADDRESS_RE: Record<PayMethodId, RegExp> = {
  usdt_trc20: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  usdt_ton: /^(UQ|EQ)[A-Za-z0-9_-]{46}$/,
}
const TX_RE = /^[A-Za-z0-9+/_=-]{8,128}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/

export const isInvoiceNumber = (value: unknown): value is string =>
  typeof value === 'string' && NUMBER_RE.test(value)
export const isInvoiceKey = (value: unknown): value is string =>
  typeof value === 'string' && KEY_RE.test(value)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const str = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max ? value.trim() : null

const date = (value: unknown): string | null =>
  typeof value === 'string' && DATE_RE.test(value) && !Number.isNaN(Date.parse(value)) ? value : null

const money = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 10_000_000 ? value : null

const statuses: PayStatus[] = ['issued', 'paid', 'void', 'expired']
const vias: PaidVia[] = ['usdt_trc20', 'usdt_ton', 'manual']
const methodIds: PayMethodId[] = ['usdt_trc20', 'usdt_ton']

function parseMethod(value: unknown): PayMethod | null {
  if (!isRecord(value)) return null
  const id = methodIds.find((m) => m === value.id)
  const network = str(value.network, 60)
  const address = typeof value.address === 'string' ? value.address.trim() : ''
  if (!id || !network || !ADDRESS_RE[id].test(address)) return null
  return { id, network, address, note: str(value.note, 500) ?? '' }
}

// An unknown HQ value as an Invoice, or null. Rebuilt from known fields only; unknown methods and
// bad addresses are dropped, and an issued invoice with no usable method is rejected.
export function parseInvoice(value: unknown): Invoice | null {
  if (!isRecord(value)) return null
  const number = value.number
  const status = statuses.find((s) => s === value.status)
  const title = str(value.title, 200)
  const amountUsd = money(value.amountUsd)
  const payAmountUsd = money(value.payAmountUsd)
  if (!isInvoiceNumber(number) || !status || !title || !amountUsd || !payAmountUsd) return null
  const seen = new Set<PayMethodId>()
  const methods: PayMethod[] = []
  if (Array.isArray(value.methods))
    for (const raw of value.methods.slice(0, 10)) {
      const method = parseMethod(raw)
      if (method && !seen.has(method.id)) {
        seen.add(method.id)
        methods.push(method)
      }
    }
  if (status === 'issued' && methods.length === 0) return null
  const txId = typeof value.txId === 'string' && TX_RE.test(value.txId) ? value.txId : null
  return {
    number,
    title,
    clientFirstName: str(value.clientFirstName, 80) ?? '',
    amountUsd,
    payAmountUsd,
    status,
    dueDate: date(value.dueDate),
    issuedAt: date(value.issuedAt),
    paidAt: date(value.paidAt),
    paidVia: vias.find((v) => v === value.paidVia) ?? null,
    txId,
    locale: value.locale === 'en' ? 'en' : 'ru',
    methods,
  }
}

// 150.07 and 300.00: always two decimals, dot separator, no currency sign.
export const formatAmount = (value: number): string => value.toFixed(2)

// The exact amount differs from the estimate total (cents added to recognize the transfer).
export const hasCents = (invoice: Pick<Invoice, 'amountUsd' | 'payAmountUsd'>): boolean =>
  formatAmount(invoice.amountUsd) !== formatAmount(invoice.payAmountUsd)

export function explorerUrl(via: PaidVia | null, txId: string | null): string | null {
  if (!txId || !TX_RE.test(txId)) return null
  if (via === 'usdt_trc20') return `https://tronscan.org/#/transaction/${encodeURIComponent(txId)}`
  if (via === 'usdt_ton') return `https://tonviewer.com/transaction/${encodeURIComponent(txId)}`
  return null
}

export const shortTx = (txId: string): string =>
  txId.length > 16 ? `${txId.slice(0, 8)}...${txId.slice(-6)}` : txId

// Date only (YYYY-MM-DD from an ISO string) shown in the locale's long form, in UTC.
export function formatPayDate(value: string, locale: 'ru' | 'en'): string {
  const time = Date.parse(value)
  if (Number.isNaN(time)) return value
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(time)
}

export const payPath = (locale: string, number: string, key: string): string =>
  `/${locale}/pay/${number}?k=${encodeURIComponent(key)}`
