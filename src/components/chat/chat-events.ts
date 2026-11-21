// Any part of the page can open the chat widget (hero button, #demo section) without sharing
// React state with it: a window event the widget listens for.
export const CHAT_OPEN_EVENT = 'firtech:chat-open'

export function openChat(source: string) {
  window.dispatchEvent(new CustomEvent(CHAT_OPEN_EVENT, { detail: { source } }))
}

// The builder tells the launcher whether the visitor is on its last step (detail.last): on /builder
// and /cabinet the floating button stays hidden until then or until the visitor is idle.
export const BUILDER_STEP_EVENT = 'firtech:builder-step'

// The home film (components/film/) tells the launcher when its WebGL Fira is on screen: she is the
// launcher then (a click on her opens the chat), so the floating button steps aside. The same state is
// on <html data-film="on"> for a launcher that mounts later.
export const FILM_EVENT = 'firtech:film'

export function filmOn(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.film === 'on'
}
