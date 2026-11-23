import type { Emotion } from './pose'

// Fira live 1.1: the contract between the chat (F1: stream, state) and the presence (F2: animation).
// F1 owns this module; F2 only adds fields here. FiraState maps 1:1 to the rig's Emotion.
export type FiraState = Emotion
export type FiraBubble = { text: string; dots: boolean; wordsShown: number }
export type FiraLive = { state: FiraState; since: number; bubble: FiraBubble | null; pointTo?: string /* data-fira-target id */ }

/** `window.dispatchEvent(new CustomEvent('fira', { detail: { type: 'open-chat' | 'hint' | 'reaction', ... } }))` */
export const FIRA_EVENT = 'fira'
export type FiraEventDetail = { type: 'open-chat' | 'hint' | 'reaction'; [k: string]: unknown }

export function firaEvent(detail: FiraEventDetail) {
  window.dispatchEvent(new CustomEvent(FIRA_EVENT, { detail }))
}

/** Rules of the contract as numbers (ms). */
export const THINK_MIN_MS = 600
export const HAPPY_MS = 1200
export const SORRY_MS = 2000
export const SLEEP_AFTER_MS = 120_000
