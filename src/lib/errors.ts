// One map of failures for the whole site (owner review 2026-11-22: «выводить все ошибки»).
// A server code or an HTTP status becomes a human text in RU/EN, a hint on what to do and a flag
// telling whether «Повторить» makes sense. Unknown failures are still shown, with a short support
// code and the time. Pure module: used by route handlers, client components and tests.

export type ErrorLocale = 'ru' | 'en'

export type ErrorInfo = {
  // Stable machine code (`rate_limited`, `timeout`, `network`...). `unknown` when nothing matched.
  code: string
  status: number
  message: string
  // What to do next, one short sentence.
  hint: string
  retryable: boolean
  // Support reference: `E-<code>-<HHMM>`, shown for unknown errors only.
  ref?: string
}

type Entry = { ru: [string, string]; en: [string, string]; retryable: boolean; status: number }

const entries: Record<string, Entry> = {
  network: {
    ru: ['Нет связи', 'Проверьте интернет и повторите.'],
    en: ['No connection', 'Check your internet and try again.'],
    retryable: true,
    status: 0,
  },
  timeout: {
    ru: ['Сервер не ответил за 20 секунд', 'Это бывает при нагрузке. Повторите: введённое сохранено.'],
    en: ['The server did not answer in 20 seconds', 'It happens under load. Try again: what you typed is kept.'],
    retryable: true,
    status: 504,
  },
  invalid: {
    ru: ['Данные не прошли проверку', 'Проверьте поля и отправьте снова.'],
    en: ['The data did not pass validation', 'Check the fields and send again.'],
    retryable: false,
    status: 400,
  },
  invalid_email: {
    ru: ['Письмо не отправлено: проверьте адрес', 'Исправьте адрес почты и повторите.'],
    en: ['The email was not sent: check the address', 'Fix the address and try again.'],
    retryable: false,
    status: 400,
  },
  auth_required: {
    ru: ['Сессия истекла, войдите снова', 'Войдите в кабинет: введённое сохранится.'],
    en: ['Your session expired, sign in again', 'Sign in to the cabinet: what you typed is kept.'],
    retryable: false,
    status: 401,
  },
  unauthorized: {
    ru: ['Сессия истекла, войдите снова', 'Обновите страницу и войдите.'],
    en: ['Your session expired, sign in again', 'Reload the page and sign in.'],
    retryable: false,
    status: 401,
  },
  forbidden: {
    ru: ['Нет доступа', 'Этот раздел вам недоступен.'],
    en: ['No access', 'This section is not available to you.'],
    retryable: false,
    status: 403,
  },
  bad_origin: {
    ru: ['Запрос отклонён', 'Откройте сайт по основному адресу и повторите.'],
    en: ['The request was rejected', 'Open the site at its main address and try again.'],
    retryable: false,
    status: 403,
  },
  unsupported_media_type: {
    ru: ['Запрос отклонён', 'Обновите страницу и повторите.'],
    en: ['The request was rejected', 'Reload the page and try again.'],
    retryable: false,
    status: 415,
  },
  not_found: {
    ru: ['Не найдено', 'Возможно, это уже удалено. Обновите страницу.'],
    en: ['Not found', 'It may have been removed already. Reload the page.'],
    retryable: false,
    status: 404,
  },
  slot_taken: {
    ru: ['Это время уже занято', 'Выберите другое время, остальное сохранено.'],
    en: ['This time is already taken', 'Pick another time, the rest is kept.'],
    retryable: false,
    status: 409,
  },
  rate_limited: {
    ru: ['Слишком много запросов', 'Подождите минуту и повторите.'],
    en: ['Too many requests', 'Wait a minute and try again.'],
    retryable: true,
    status: 429,
  },
  too_large: {
    ru: ['Файл слишком большой', 'Выберите файл поменьше.'],
    en: ['The file is too large', 'Pick a smaller file.'],
    retryable: false,
    status: 413,
  },
  unsupported_type: {
    ru: ['Такой тип файла не подходит', 'Загрузите PDF, изображение или документ.'],
    en: ['This file type is not accepted', 'Upload a PDF, an image or a document.'],
    retryable: false,
    status: 415,
  },
  not_configured: {
    ru: ['Сервис ещё не настроен', 'Напишите нам в Telegram, мы ответим вручную.'],
    en: ['The service is not set up yet', 'Message us in Telegram, we will answer by hand.'],
    retryable: false,
    status: 503,
  },
  delivery_failed: {
    ru: ['Заявка не доставлена', 'Повторите: введённое сохранено. Если не выйдет, напишите в Telegram.'],
    en: ['The request was not delivered', 'Try again: what you typed is kept. If it fails, message us in Telegram.'],
    retryable: true,
    status: 502,
  },
  hq_unreachable: {
    ru: ['HQ недоступен', 'Заявка сохранена и уйдёт позже. Можно повторить через минуту.'],
    en: ['HQ is unreachable', 'The request is saved and will go out later. You can try again in a minute.'],
    retryable: true,
    status: 502,
  },
  hq_timeout: {
    ru: ['HQ не ответил вовремя', 'Заявка сохранена и уйдёт позже. Повторите через минуту.'],
    en: ['HQ did not answer in time', 'The request is saved and will go out later. Try again in a minute.'],
    retryable: true,
    status: 504,
  },
  hq_error: {
    ru: ['HQ вернул ошибку', 'Повторите через минуту.'],
    en: ['HQ returned an error', 'Try again in a minute.'],
    retryable: true,
    status: 502,
  },
  hq_bad_response: {
    ru: ['HQ ответил непонятно', 'Повторите через минуту.'],
    en: ['HQ gave an unreadable answer', 'Try again in a minute.'],
    retryable: true,
    status: 502,
  },
  hq_unauthorized: {
    ru: ['HQ не принял доступ', 'Это наша настройка. Напишите нам, мы исправим.'],
    en: ['HQ refused the access', 'This is on our side. Message us and we will fix it.'],
    retryable: false,
    status: 502,
  },
  unavailable: {
    ru: ['Сервис временно недоступен', 'Повторите через минуту.'],
    en: ['The service is temporarily unavailable', 'Try again in a minute.'],
    retryable: true,
    status: 503,
  },
  server_error: {
    ru: ['Ошибка на сервере', 'Повторите. Если повторяется, напишите нам и назовите код.'],
    en: ['Server error', 'Try again. If it keeps happening, message us with the code.'],
    retryable: true,
    status: 500,
  },
}

// Aliases: the many codes the existing routes and HQ already use.
const alias: Record<string, string> = {
  bad_request: 'invalid',
  invalid_status: 'invalid',
  email_invalid: 'invalid_email',
  upstream: 'hq_error',
  upstream_error: 'hq_error',
  bad_gateway: 'hq_error',
  hq_down: 'hq_unreachable',
  unreachable: 'hq_unreachable',
  aborted: 'timeout',
  TimeoutError: 'timeout',
  AbortError: 'timeout',
  busy: 'rate_limited',
  too_many_requests: 'rate_limited',
  payload_too_large: 'too_large',
  file_too_large: 'too_large',
  session_expired: 'auth_required',
}

const byStatus: Record<number, string> = {
  400: 'invalid',
  401: 'auth_required',
  403: 'forbidden',
  404: 'not_found',
  408: 'timeout',
  409: 'slot_taken',
  413: 'too_large',
  415: 'unsupported_type',
  429: 'rate_limited',
  500: 'server_error',
  502: 'hq_error',
  503: 'unavailable',
  504: 'timeout',
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// `E-<code>-<HHMM>`: short enough to read aloud to support.
export function supportRef(code: string, now: Date = new Date()): string {
  const short = code.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase() || 'ERR'
  return `E-${short}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

// The code inside a server body: `{error:{code}}` (new), `{error:'code'}` (old routes and HQ) or
// `{code}`. Undefined when the body carries none.
export function codeFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined
  const b = body as { error?: unknown; code?: unknown }
  if (typeof b.error === 'string') return b.error.slice(0, 60)
  if (b.error && typeof b.error === 'object' && typeof (b.error as { code?: unknown }).code === 'string') {
    return ((b.error as { code: string }).code).slice(0, 60)
  }
  if (typeof b.code === 'string') return b.code.slice(0, 60)
  return undefined
}

export type DescribeInput = {
  code?: string | null
  status?: number
  // A fetch that threw: `network` unless it was a timeout or abort.
  thrown?: unknown
  locale?: ErrorLocale
  now?: Date
}

export function isTimeout(thrown: unknown): boolean {
  return thrown instanceof Error && (thrown.name === 'TimeoutError' || thrown.name === 'AbortError')
}

// Any failure -> text. Never returns an empty message.
export function describeError(input: DescribeInput): ErrorInfo {
  const locale = input.locale ?? 'ru'
  const status = input.status ?? 0
  let code = input.code ? (alias[input.code] ?? input.code) : undefined
  if (!code && input.thrown !== undefined) code = isTimeout(input.thrown) ? 'timeout' : 'network'
  if (!code || !entries[code]) {
    const fromStatus = byStatus[status]
    if (fromStatus && (!code || !entries[code])) {
      const raw = code
      code = fromStatus
      // Keep the unknown server code in the reference so support can find it.
      if (raw) return build(code, status, locale, input.now, raw)
    }
  }
  if (!code || !entries[code]) {
    const raw = code || (status ? `http${status}` : 'unknown')
    const text = locale === 'ru'
      ? ['Что-то пошло не так', 'Повторите. Если повторяется, напишите нам и назовите код.']
      : ['Something went wrong', 'Try again. If it keeps happening, message us with the code.']
    return {
      code: 'unknown',
      status,
      message: text[0]!,
      hint: text[1]!,
      retryable: true,
      ref: supportRef(raw, input.now),
    }
  }
  return build(code, status, locale, input.now)
}

function build(code: string, status: number, locale: ErrorLocale, now?: Date, rawCode?: string): ErrorInfo {
  const e = entries[code]!
  const [message, hint] = e[locale]
  return {
    code,
    status: status || e.status,
    message,
    hint,
    retryable: e.retryable,
    // A server code we do not know keeps a reference even when the status gave a known text.
    ...(rawCode ? { ref: supportRef(rawCode, now) } : code === 'server_error' ? { ref: supportRef(code, now) } : {}),
  }
}

// Human line for one failure: message plus hint (and the reference when there is one).
export function errorLine(info: ErrorInfo): string {
  return `${info.message}. ${info.hint}${info.ref ? ` (${info.ref})` : ''}`
}

export function errorStatusFor(code: string): number {
  const c = alias[code] ?? code
  return entries[c]?.status ?? 500
}

export function errorMessageFor(code: string, locale: ErrorLocale = 'ru'): string {
  return describeError({ code, locale }).message
}

// Server body: the status picks itself from the code unless given.
export function errorBody(code: string, message?: string, locale: ErrorLocale = 'ru') {
  return { ok: false as const, error: { code, message: message ?? errorMessageFor(code, locale) } }
}

export type FetchResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: ErrorInfo }

export const FETCH_TIMEOUT_MS = 20_000

// fetch + 20 s timeout + JSON + the error map. Never throws.
export async function fetchJson<T = Record<string, unknown>>(
  url: string,
  init: RequestInit & { timeoutMs?: number; locale?: ErrorLocale } = {},
  doFetch: typeof fetch = fetch,
): Promise<FetchResult<T>> {
  const { timeoutMs = FETCH_TIMEOUT_MS, locale, ...rest } = init
  let res: Response
  try {
    res = await doFetch(url, { ...rest, signal: rest.signal ?? AbortSignal.timeout(timeoutMs) })
  } catch (thrown) {
    return { ok: false, status: 0, error: describeError({ thrown, locale }) }
  }
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok || (body && typeof body === 'object' && (body as { ok?: unknown }).ok === false)) {
    return {
      ok: false,
      status: res.status,
      error: describeError({ code: codeFromBody(body), status: res.status, locale }),
    }
  }
  return { ok: true, status: res.status, data: (body ?? {}) as T }
}
