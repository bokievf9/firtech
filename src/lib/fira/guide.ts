import type { Emotion } from './pose'

// Fira as the guide of the site (owner 2026-11-23): the docked presence, her speech bubble that types word by
// word, the page context that picks her accessories, the voice switch. Pure helpers, tested in node
// (tests/fira-guide.test.mjs); the components are components/fira/fira-guide.tsx and fira-typed.tsx.

/** One word every 180 ms (owner: «облако речи по словам»); reduced motion shows the whole line at once. */
export const WORD_MS = 180
export const WORD_MS_REDUCED = 0

export function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

/** The first `count` words of the line, joined; a count past the end gives the whole line. */
export function wordsShown(words: readonly string[], count: number): string {
  return words.slice(0, Math.max(0, count)).join(' ')
}

/** How many words are visible `elapsed` ms after the line started; `perWord` 0 means all at once. */
export function wordCount(total: number, elapsed: number, perWord = WORD_MS): number {
  if (perWord <= 0) return total
  return Math.min(total, Math.max(0, Math.floor(elapsed / perWord) + 1))
}

/** How long a line stays up: the typing plus time to read it. */
export const bubbleMs = (text: string, read = 6000) => splitWords(text).length * WORD_MS + read

// The accessory context of a path (without the locale): what she wears on that page. `accessoriesFor` in
// contexts.ts turns the id into glasses, headphones and laptop.
export function pageContextFor(pathname: string): string {
  const rest = pathname.replace(/^\/(ru|en)(?=\/|$)/, '').replace(/\/+$/, '')
  if (rest === '' || rest === '/') return 'home'
  if (/^\/builder(\/|$)/.test(rest)) return 'builder'
  if (/^\/cabinet(\/|$)/.test(rest)) return 'dashboard'
  if (/^\/(products|services|solutions|ai-team)(\/|$)/.test(rest)) return 'products'
  if (/^\/(pay|pay-how|compare|referral|how-we-work)(\/|$)/.test(rest)) return 'pricing'
  if (/^\/(blog|terms|privacy|audit)(\/|$)/.test(rest)) return 'docs'
  return 'landing'
}

/** Her pose on the page when she is idle: the chat puts her in listening mode, a 404 makes her sorry. */
export function guideEmotion(s: { tour: boolean; pointing: boolean; chatOpen: boolean; menu: boolean; notFound: boolean; saying: boolean }): Emotion {
  if (s.tour || s.pointing) return 'point'
  if (s.chatOpen || s.menu) return 'listening'
  if (s.notFound) return 'sorry'
  if (s.saying) return 'talking'
  return 'idle'
}

// Voice: the browser's Web Speech API, in the page language, off by default and remembered. No server TTS.
export const VOICE_KEY = 'fir-guide-voice'
export const speechLang = (locale: string) => (locale === 'en' ? 'en-US' : 'ru-RU')
export const voiceFromStorage = (raw: string | null) => raw === 'on'

// Events between the pieces (all on window): the film overlay and the launcher share one presence.
export const GUIDE_MENU_EVENT = 'firtech:guide-menu' // open the menu (the film Fira was clicked)
export const GUIDE_TOUR_EVENT = 'firtech:guide-tour' // detail { on }: a tour started or stopped
export const GUIDE_POINT_EVENT = 'firtech:guide-point' // detail { ms }: she points for a moment

export function openGuideMenu() {
  window.dispatchEvent(new CustomEvent(GUIDE_MENU_EVENT))
}
