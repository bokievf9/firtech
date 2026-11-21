import { safeBuilderLink, type ChatReply } from './chat'

// What a receptionist reply offers under the message (owner 2026-11-22: the chat is the second main
// entry after «Собрать проект»: push the builder, offer a call, Telegram only as the last resort).
// Pure, so tests cover it. The widget renders the actions in this order.
export type ChatAction =
  | { kind: 'builder'; href: string }
  | { kind: 'call' }
  | { kind: 'telegram'; href: string }

export function ctaActions(
  reply: Pick<ChatReply, 'builderLink' | 'cta'>,
  telegramHref: string | null,
): ChatAction[] {
  const actions: ChatAction[] = []
  // The builder button needs the link; HQ sends `cta: ['builder']` together with it.
  // Checked again here: whatever the source, only this site's builder path becomes a button.
  const builder = safeBuilderLink(reply.builderLink)
  if (builder) actions.push({ kind: 'builder', href: builder })
  if (reply.cta?.includes('call')) actions.push({ kind: 'call' })
  if (reply.cta?.includes('telegram') && telegramHref) actions.push({ kind: 'telegram', href: telegramHref })
  return actions
}

// The visitor's pick in the slot list goes to HQ as the next message.
export function slotMessage(template: string, time: string): string {
  return template.replace('{time}', time)
}
