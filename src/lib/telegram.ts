import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

// Thin wrapper over the Bot API: only the calls the lead bot needs.

export type InlineButton = { text: string; callback_data: string }
export type InlineKeyboard = InlineButton[][]

export function telegramEnv() {
  return {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    ownerChatId: process.env.TELEGRAM_CHAT_ID || '',
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  }
}

async function call<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const { token } = telegramEnv()
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is missing')
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  })
  const data = (await response.json().catch(() => null)) as {
    ok: boolean
    result?: T
    description?: string
  } | null
  if (!response.ok || !data?.ok) {
    throw new Error(`Telegram ${method} failed: ${response.status} ${data?.description ?? ''}`)
  }
  return data.result as T
}

export async function sendMessage(
  chatId: string | number,
  text: string,
  keyboard?: InlineKeyboard,
) {
  const result = await call<{ message_id: number }>('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  })
  return result.message_id
}

export async function editMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
  keyboard?: InlineKeyboard,
) {
  try {
    await call('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
    })
  } catch (error) {
    // Pressing the button of the status that is already set is not an error worth reporting.
    if (!String(error).includes('message is not modified')) throw error
  }
}

export async function answerCallbackQuery(id: string, text?: string) {
  await call('answerCallbackQuery', { callback_query_id: id, ...(text ? { text } : {}) })
}

// Start link token: a short HMAC of the lead id, so nobody can attach to someone else's lead by
// guessing ids. Empty without a webhook secret (then the site hides the "follow in Telegram" link).
export function leadToken(id: number, secret = telegramEnv().webhookSecret) {
  if (!secret) return ''
  return createHmac('sha256', secret).update(`lead:${id}`).digest('hex').slice(0, 12)
}

// Constant-time compare; byte lengths are checked first because timingSafeEqual requires equal sizes.
function sameSecret(given: string, expected: string) {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function verifyLeadToken(id: number, token: string, secret = telegramEnv().webhookSecret) {
  const expected = leadToken(id, secret)
  return Boolean(expected) && sameSecret(token, expected)
}

export function verifyWebhookSecret(header: string | null, secret = telegramEnv().webhookSecret) {
  return Boolean(secret && header) && sameSecret(header ?? '', secret)
}
