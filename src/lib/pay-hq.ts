import 'server-only'
import { isInvoiceKey, isInvoiceNumber, parseInvoice, type Invoice, type PayResult } from './pay'

const DEFAULT_URL = 'http://127.0.0.1:8787/pay'
const TIMEOUT_MS = 4000

type Env = Record<string, string | undefined>

// Invoice data for the payment page from HQ: `GET ${HQ_PAY_URL}/<number>?k=<key>` over loopback,
// no token (the key is the secret). Never throws, never returns HQ's URL or text: a result is the
// sanitized invoice or a short code. Unknown number and wrong key are the same `not_found`.
// Development without HQ_PAY_URL serves one mock invoice (FT-2026-001, key `demo`).
export const mockInvoice: Invoice = {
  number: 'FT-2026-001',
  title: 'Website for a cafe',
  clientFirstName: 'Demo',
  amountUsd: 150,
  payAmountUsd: 150.07,
  status: 'issued',
  dueDate: '2026-12-01',
  issuedAt: '2026-11-19',
  paidAt: null,
  paidVia: null,
  txId: null,
  locale: 'ru',
  methods: [
    {
      id: 'usdt_trc20',
      network: 'TRON (TRC20)',
      address: 'TXYZabcdefghijkmnopqrstuvwxyz12345',
      note: 'Demo address, not real.',
    },
    {
      id: 'usdt_ton',
      network: 'TON',
      address: 'UQAbcdefghijklmnopqrstuvwxyz0123456789_-ABCDEFGH',
      note: 'Demo address, not real.',
    },
  ],
}

export async function fetchInvoice(
  number: string,
  key: string,
  env: Env = process.env,
  fetcher: typeof fetch = fetch,
): Promise<PayResult> {
  if (!isInvoiceNumber(number)) return { ok: false, error: 'not_found' }
  const configured = env.HQ_PAY_URL?.trim()
  if (!configured && env.NODE_ENV !== 'production') {
    return number === mockInvoice.number && key === 'demo'
      ? { ok: true, invoice: mockInvoice }
      : { ok: false, error: 'not_found' }
  }
  if (!isInvoiceKey(key)) return { ok: false, error: 'not_found' }
  try {
    const base = (configured || DEFAULT_URL).replace(/\/$/, '')
    const res = await fetcher(`${base}/${number}?k=${encodeURIComponent(key)}`, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (res.status === 404) return { ok: false, error: 'not_found' }
    if (!res.ok) return { ok: false, error: 'hq_error' }
    const body: unknown = await res.json().catch(() => null)
    if (typeof body !== 'object' || body === null || (body as { ok?: unknown }).ok !== true)
      return { ok: false, error: 'hq_error' }
    const invoice = parseInvoice((body as { invoice?: unknown }).invoice)
    // HQ answered for another invoice number: treat as broken, never show it.
    if (!invoice || invoice.number !== number) return { ok: false, error: 'hq_error' }
    return { ok: true, invoice }
  } catch (error) {
    const timeout = error instanceof Error && error.name === 'TimeoutError'
    return { ok: false, error: timeout ? 'hq_timeout' : 'hq_unreachable' }
  }
}
