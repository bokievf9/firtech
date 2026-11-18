// Any part of the page can open the chat widget (hero button, #demo section) without sharing
// React state with it: a window event the widget listens for.
export const CHAT_OPEN_EVENT = 'firtech:chat-open'

export function openChat(source: string) {
  window.dispatchEvent(new CustomEvent(CHAT_OPEN_EVENT, { detail: { source } }))
}
