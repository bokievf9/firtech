import 'server-only'
import { getDict } from '@/content'
import { formatSlot } from './booking'
import { pickLocale, type Locale } from './i18n'
import { escapeHtml, formatLead, serviceNames } from './lead'
import { siteUrl } from './site'
import {
  getLead,
  listLeads,
  unnotifiedLeads,
  updateLead,
  type LeadStatus,
  type StoredLead,
} from './store'
import {
  answerCallbackQuery,
  editMessageText,
  sendMessage,
  telegramEnv,
  verifyLeadToken,
  type InlineKeyboard,
} from './telegram'

// Everything the bot says and does with leads. Owner-facing text is Russian, like formatLead;
// client-facing text comes from the dictionaries in the lead's language.

export const statusNames: Record<LeadStatus, string> = {
  new: 'Новая',
  taken: 'Взял в работу',
  called: 'Созвонились',
  won: 'Сделка',
  lost: 'Отказ',
}
const statusButtons: [Exclude<LeadStatus, 'new'>, string][] = [
  ['taken', 'Взял'],
  ['called', 'Созвонились'],
  ['won', 'Сделка'],
  ['lost', 'Отказ'],
]
// Private owner panel (src/app/admin); the bot's /admin command links to it.
export const adminUrl = `${siteUrl}/admin`

const bookingStates = {
  pending: 'ждёт подтверждения',
  confirmed: 'подтверждён',
  released: 'перенос, время освобождено',
} as const

export const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''))

export function formatOwnerMessage(lead: StoredLead, extra?: string) {
  const lines = [formatLead(lead, `Заявка №${lead.id} с сайта Fir Tech`), '']
  if (lead.booking) {
    lines.push(
      `<b>Созвон:</b> ${formatSlot(lead.booking.slot)} - ${bookingStates[lead.booking.state]}`,
    )
  }
  lines.push(`<b>Статус:</b> ${statusNames[lead.status]}`)
  if (lead.clientChatId) lines.push('<b>Клиент в боте:</b> да, получает уведомления')
  if (lead.note) lines.push(`<i>${escapeHtml(lead.note)}</i>`)
  if (extra) lines.push(`<i>${escapeHtml(extra)}</i>`)
  return lines.join('\n')
}

// Status buttons stay on the message; the current one is marked so the owner sees it at a glance.
export function ownerKeyboard(lead: StoredLead): InlineKeyboard {
  const button = ([status, text]: (typeof statusButtons)[number]) => ({
    text: lead.status === status ? `[${text}]` : text,
    callback_data: `st:${lead.id}:${status}`,
  })
  const rows: InlineKeyboard = [
    statusButtons.slice(0, 2).map(button),
    statusButtons.slice(2).map(button),
  ]
  if (lead.booking && lead.booking.state !== 'released') {
    rows.push([
      ...(lead.booking.state === 'pending'
        ? [{ text: 'Подтвердить', callback_data: `bk:${lead.id}:ok` }]
        : []),
      { text: 'Перенести', callback_data: `bk:${lead.id}:move` },
    ])
  }
  return rows
}

function leadLine(lead: StoredLead) {
  const parts = [
    `№${lead.id}`,
    escapeHtml(lead.name),
    serviceNames[lead.service],
    statusNames[lead.status],
  ]
  if (lead.booking && lead.booking.state !== 'released') {
    parts.push(`созвон ${formatSlot(lead.booking.slot, 'ru', false)}`)
  }
  return parts.join(' · ')
}

async function refreshOwnerMessage(lead: StoredLead, messageId = lead.ownerMessageId) {
  if (!messageId) return
  await editMessageText(
    telegramEnv().ownerChatId,
    messageId,
    formatOwnerMessage(lead),
    ownerKeyboard(lead),
  )
}

async function tellClient(lead: StoredLead, key: 'confirmed' | 'moved') {
  if (!lead.clientChatId || !lead.booking) return
  const t = getDict(lead.locale).booking.bot
  const time = formatSlot(lead.booking.slot, lead.locale)
  await sendMessage(lead.clientChatId, escapeHtml(fill(t[key], { id: lead.id, time })))
}

// Sends a stored lead to the owner with its buttons. Throws when Telegram is unreachable; the lead is
// already saved then and goes out with the next successful lead (see below), so nothing is lost.
export async function notifyOwner(lead: StoredLead, extra?: string) {
  const messageId = await sendMessage(
    telegramEnv().ownerChatId,
    formatOwnerMessage(lead, extra),
    ownerKeyboard(lead),
  )
  await updateLead(lead.id, (l) => {
    l.ownerMessageId = messageId
    l.notified = true
  })
}

// Leads saved while Telegram was down, sent once it answers again. Best effort, oldest first.
export async function flushPending(exceptId?: number) {
  for (const lead of (await unnotifiedLeads(exceptId)).slice(0, 10)) {
    try {
      await notifyOwner(
        lead,
        `Отправлено с задержкой: Telegram был недоступен, заявка сохранена на сайте ${lead.createdAt.slice(0, 16).replace('T', ' ')} UTC.`,
      )
    } catch {
      return
    }
  }
}

// Minimal shape of the Telegram updates the bot reads.
export type Update = {
  message?: {
    message_id: number
    chat: { id: number }
    from?: { id: number; language_code?: string }
    text?: string
  }
  callback_query?: {
    id: string
    from: { id: number }
    data?: string
    message?: { message_id: number; chat: { id: number } }
  }
}

export async function handleUpdate(update: Update) {
  const { ownerChatId } = telegramEnv()
  const isOwner = (chatId?: number) => chatId !== undefined && String(chatId) === ownerChatId

  if (update.callback_query) {
    const query = update.callback_query
    // Buttons only work in the owner's chat; anyone else gets a polite no and nothing changes.
    if (!isOwner(query.message?.chat.id)) {
      await answerCallbackQuery(query.id, 'Нет доступа')
      return
    }
    // Always answered, even on failure, or the button keeps spinning in the owner's app.
    let reply: string
    try {
      reply = await handleButton(query.data ?? '', query.message?.message_id)
    } catch (error) {
      console.error('[bot] button failed', error)
      reply = 'Не получилось, попробуйте ещё раз'
    }
    await answerCallbackQuery(query.id, reply)
    return
  }

  const message = update.message
  const text = message?.text?.trim()
  if (!message || !text) return

  const start = text.match(/^\/start(?:@\w+)?(?:\s+(\S+))?$/)
  if (start) {
    await handleStart(message.chat.id, start[1] ?? '', message.from?.language_code)
    return
  }
  if (isOwner(message.chat.id) && /^\/leads(@\w+)?$/.test(text)) {
    const leads = await listLeads(10)
    await sendMessage(
      message.chat.id,
      leads.length
        ? `<b>Последние заявки</b>\n\n${leads.map(leadLine).join('\n')}`
        : 'Заявок пока нет.',
    )
    return
  }
  if (isOwner(message.chat.id) && /^\/admin(@\w+)?$/.test(text)) {
    await sendMessage(message.chat.id, `Панель заявок: ${adminUrl}`)
  }
}

async function handleButton(data: string, messageId?: number): Promise<string> {
  const match = data.match(/^(st|bk):(\d+):(\w+)$/)
  if (!match) return 'Неизвестная кнопка'
  const [, kind, rawId, action] = match
  const id = Number(rawId)

  if (kind === 'st') {
    const status = statusButtons.find(([s]) => s === action)?.[0]
    if (!status) return 'Неизвестный статус'
    return (await setLeadStatus(id, status, messageId)).reply
  }
  if (action !== 'ok' && action !== 'move') return 'Неизвестная кнопка'
  return (await bookingAction(id, action, messageId)).reply
}

export type LeadChange = { lead: StoredLead | null; reply: string }

// Status change shared by the bot buttons and the admin panel: the store first, then the owner's
// Telegram message, so both always show the same status.
export async function setLeadStatus(
  id: number,
  status: LeadStatus,
  messageId?: number,
): Promise<LeadChange> {
  const lead = await updateLead(id, (l) => {
    l.status = status
  })
  if (!lead) return { lead, reply: `Заявка №${id} не найдена` }
  await refreshOwnerMessage(lead, messageId)
  return { lead, reply: `Статус: ${statusNames[status]}` }
}

// Booking confirm ("ok") or reschedule ("move"), same effect from the bot and the admin panel.
export async function bookingAction(
  id: number,
  action: 'ok' | 'move',
  messageId?: number,
): Promise<LeadChange> {
  let changed = false
  const lead = await updateLead(id, (l) => {
    if (!l.booking || l.booking.state === 'released') return
    if (action === 'ok' && l.booking.state === 'pending') {
      l.booking.state = 'confirmed'
      changed = true
    }
    if (action === 'move') {
      // The slot goes back to the free list right away; the owner agrees a new time directly.
      l.booking.state = 'released'
      l.note = 'Созвон нужно перенести: время освобождено, договоритесь с клиентом о новом.'
      changed = true
    }
  })
  if (!lead) return { lead, reply: `Заявка №${id} не найдена` }
  if (!changed) return { lead, reply: 'Уже обработано' }
  await refreshOwnerMessage(lead, messageId)
  try {
    await tellClient(lead, action === 'ok' ? 'confirmed' : 'moved')
  } catch (error) {
    console.error('[bot] could not notify the client', error)
    return { lead, reply: 'Готово, но клиенту написать не удалось' }
  }
  if (!lead.clientChatId)
    return {
      lead,
      reply:
        action === 'ok'
          ? 'Подтверждено. Клиент не в боте, сообщите ему сами'
          : 'Время освобождено. Клиент не в боте, сообщите ему сами',
    }
  return {
    lead,
    reply:
      action === 'ok' ? 'Подтверждено, клиент уведомлён' : 'Время освобождено, клиент уведомлён',
  }
}

async function handleStart(chatId: number, payload: string, languageCode?: string) {
  const fallback: Locale = pickLocale(languageCode ?? null)
  const match = payload.match(/^lead_(\d+)_([0-9a-f]+)$/)
  if (!match) {
    await sendMessage(
      chatId,
      escapeHtml(getDict(fallback).booking.bot[payload ? 'badLink' : 'hello']),
    )
    return
  }
  const id = Number(match[1])
  const known = verifyLeadToken(id, match[2] ?? '') ? await getLead(id) : null
  if (!known) {
    await sendMessage(chatId, escapeHtml(getDict(fallback).booking.bot.badLink))
    return
  }

  const lead = await updateLead(id, (l) => {
    l.clientChatId = chatId
  })
  if (!lead) return
  const t = getDict(lead.locale).booking.bot
  const lines = [fill(t.received, { id })]
  if (lead.booking && lead.booking.state !== 'released') {
    const time = formatSlot(lead.booking.slot, lead.locale)
    lines.push(fill(lead.booking.state === 'confirmed' ? t.bookingConfirmed : t.booking, { time }))
  }
  await sendMessage(chatId, escapeHtml(lines.join('\n')))

  const { ownerChatId } = telegramEnv()
  // Owner side is best effort: the client already got their answer.
  try {
    if (String(chatId) !== ownerChatId) {
      await sendMessage(ownerChatId, `Клиент по заявке №${id} подключился к боту`)
    }
    await refreshOwnerMessage(lead)
  } catch (error) {
    console.error('[bot] could not update the owner', error)
  }
}
