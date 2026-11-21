import { plainBotText, type Id } from '@/lib/hq-admin-view'
import type { Send } from '@/lib/orders'
import { errText, hq } from './api'
import { pushChat } from './chat-store'

export type OrderResult = { ok: true; taskId: Id | null; replies: string[] } | { ok: false; error: string }

// One line to the Director, written into the «Поручения» timeline: the owner's line first (`shownAs`
// when the text differs from what was sent, like «/status»), then HQ's replies as the Director's
// entries, or an error entry. A reply that created a task carries its id, so the timeline draws that
// task's card with the reply inside. Used by the composer, the card buttons «Напомнить» and «Отменить»
// and the ⌘K Director commands, so all of them leave the same trail.
export async function runOrder(plan: Send, shownAs?: string): Promise<OrderResult> {
  pushChat({ role: 'me', text: shownAs ?? (plan.kind === 'command' ? `/${plan.name}${plan.arg ? ` ${plan.arg}` : ''}` : plan.text) })
  const res =
    plan.kind === 'command'
      ? await hq<{ replies: string[] }>('command', { name: plan.name, arg: plan.arg || undefined })
      : await hq<{ replies: string[]; taskId?: Id }>('say', { text: plan.text })
  if (!res.ok) {
    pushChat({ role: 'error', text: errText(res.error) })
    return { ok: false, error: res.error }
  }
  const replies = Array.isArray(res.replies) ? res.replies.map(String) : []
  const taskId = 'taskId' in res && res.taskId !== undefined && res.taskId !== null ? (res.taskId as Id) : null
  if (!replies.length && taskId === null) pushChat({ role: 'director', text: '…' })
  replies.forEach((r, i) => pushChat({ role: 'director', text: plainBotText(r), taskId: i === replies.length - 1 ? taskId : null }))
  if (!replies.length && taskId !== null) pushChat({ role: 'director', text: '', taskId })
  return { ok: true, taskId, replies }
}
