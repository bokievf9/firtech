// Round four (2026-11-23): Fira as a turtle with HQ on her shell. Pure maths and tables, free of
// three.js, so node tests cover them: the four characters, accessories, shell-light events, the
// synthetic speech envelope and the speech-bubble timeline. Emotions reuse pose3 (targets3).
import type { Emotion } from './pose'

export const turtles = ['n', 'o', 'p', 'q'] as const
export type Turtle = (typeof turtles)[number]
export const isTurtle = (v: unknown): v is Turtle => typeof v === 'string' && (turtles as readonly string[]).includes(v)

export const turtleInfo: Record<Turtle, { name: string; line: string }> = {
  n: { name: 'N «Круглая»', line: 'Купол-панцирь, большая голова, короткие лапки, три экранчика HQ на спине. Самая милая.' },
  o: { name: 'O «Техно»', line: 'Панцирь гранями-гексами, антенна с огоньком, визор-очки, лапки с манжетами. Из нашей сферы.' },
  p: { name: 'P «Курьер»', line: 'Вытянутая и шустрая: рюкзачок-сервер с огоньками, кеды, дышит и моргает чаще.' },
  q: { name: 'Q «Мудрая»', line: 'Постарше: очки на носу, панцирь с узором-платой, движения медленные. Доверие и память.' },
}

// Behaviour numbers per character: tempo multiplies the breath, blink is the range of seconds between
// blinks, double is the share of double blinks, gaze how far the head follows the pointer.
export const turtleFeel: Record<Turtle, { tempo: number; blink: [number, number]; double: number; gaze: number; fidget: [number, number] }> = {
  n: { tempo: 1, blink: [3, 6], double: 0.25, gaze: 1, fidget: [8, 14] },
  o: { tempo: 1.05, blink: [3, 5], double: 0.4, gaze: 0.9, fidget: [9, 15] },
  p: { tempo: 1.4, blink: [2, 4], double: 0.2, gaze: 1.3, fidget: [5, 9] },
  q: { tempo: 0.75, blink: [4, 7], double: 0.15, gaze: 0.7, fidget: [12, 20] },
}

// Accessories are separate meshes switched by a parameter. hold: which paws carry it.
export const accessories = [
  'laptop', 'headphones', 'phone', 'coffee', 'pen+folder', 'glasses', 'magnifier', 'backpack',
  'hairdryer', 'stethoscope', 'tray', 'wrench', 'book', 'bag',
] as const
export type Accessory = (typeof accessories)[number]
export const isAccessory = (v: unknown): v is Accessory => typeof v === 'string' && (accessories as readonly string[]).includes(v)
export const accessoryMeta: Record<Accessory, { label: string; hold: 'r' | 'l' | 'both' | 'none'; niche?: string }> = {
  laptop: { label: 'Ноутбук', hold: 'none' },
  headphones: { label: 'Наушники', hold: 'none' },
  phone: { label: 'Телефон', hold: 'r' },
  coffee: { label: 'Кофе', hold: 'none' },
  'pen+folder': { label: 'Ручка и папка', hold: 'both' },
  glasses: { label: 'Очки', hold: 'none' },
  magnifier: { label: 'Лупа', hold: 'r' },
  backpack: { label: 'Рюкзак', hold: 'none' },
  hairdryer: { label: 'Фен', hold: 'r', niche: 'салон' },
  stethoscope: { label: 'Стетоскоп', hold: 'none', niche: 'клиника' },
  tray: { label: 'Поднос', hold: 'both', niche: 'кафе' },
  wrench: { label: 'Ключ', hold: 'r', niche: 'автосервис' },
  book: { label: 'Книга', hold: 'both', niche: 'курсы' },
  bag: { label: 'Пакет', hold: 'l', niche: 'магазин' },
}

// The shell-light layer: idle (slow twinkle), event (a ring runs over the shell), talk (waves follow the voice).
export type LightMode = 'idle' | 'event' | 'talk'
export const lightModes: readonly LightMode[] = ['idle', 'event', 'talk']

export const eventKinds = ['lead', 'message', 'payment', 'error', 'done'] as const
export type EventKind = (typeof eventKinds)[number]
export const isEventKind = (v: unknown): v is EventKind => typeof v === 'string' && (eventKinds as readonly string[]).includes(v)
export const eventSpec: Record<EventKind, { label: string; color: 'lime' | 'amber' | 'mint'; dur: number; pulses: number }> = {
  lead: { label: 'Новая заявка', color: 'amber', dur: 2.6, pulses: 2 },
  message: { label: 'Сообщение', color: 'mint', dur: 1.4, pulses: 1 },
  payment: { label: 'Оплата', color: 'lime', dur: 2.2, pulses: 3 },
  error: { label: 'Ошибка', color: 'amber', dur: 1.8, pulses: 2 },
  done: { label: 'Этап готов', color: 'lime', dur: 2.0, pulses: 1 },
}
// Strength 0..1 of the lamps and screens `age` seconds after an event; 0 before and after it.
export function eventLevel(kind: EventKind, age: number): number {
  const s = eventSpec[kind]
  if (age < 0 || age > s.dur) return 0
  const u = age / s.dur
  const pulse = 0.5 + 0.5 * Math.cos(u * s.pulses * Math.PI * 2 - Math.PI)
  return Math.min(1, Math.max(0, (1 - u) * (0.35 + 0.65 * pulse) + 0.25 * Math.exp(-age * 6)))
}
// Sound is a stub for now: every cue is null while sfx is 'off'.
export const sfx: 'off' | 'on' = 'off'
export const sfxCue = (kind: EventKind): string | null => (sfx === 'off' ? null : `fira-${kind}`)

// Per emotion, what the turtle does on top of the pose3 channels.
export const extras4: Record<Emotion, { retract: number; scratch: number }> = {
  idle: { retract: 0, scratch: 0 }, listening: { retract: 0, scratch: 0 }, thinking: { retract: 0, scratch: 1 },
  happy: { retract: 0, scratch: 0 }, talking: { retract: 0, scratch: 0 }, surprised: { retract: -0.25, scratch: 0 },
  sorry: { retract: 0.7, scratch: 0 }, sleep: { retract: 0.55, scratch: 0 }, point: { retract: 0, scratch: 0 }, wave: { retract: 0, scratch: 0 },
}

// Face: the full height of one eye stays under 12% of the head height (brief of round four).
export const EYE_HALF4 = 0.045
export const HEAD_H4 = 1.0
export const eyeShare4 = (maxEyeH: number) => (2 * EYE_HALF4 * maxEyeH) / HEAD_H4

// Fidgets: every few seconds an idle turtle does a small thing. r in [0, 1).
export const fidgets = ['look', 'tap', 'shift', 'tail'] as const
export type Fidget = (typeof fidgets)[number]
export const nextFidget = (t: Turtle, r1: number, r2: number): { delay: number; kind: Fidget } => {
  const [lo, hi] = turtleFeel[t].fidget
  return { delay: lo + (hi - lo) * Math.min(Math.max(r1, 0), 0.999), kind: fidgets[Math.floor(Math.min(Math.max(r2, 0), 0.999) * fidgets.length)]! }
}

// ---- Speech: a synthetic envelope that stands in for the Piper audio amplitude ----
export type SpeechWord = { text: string; start: number; end: number }
export type SpeechTimeline = { words: SpeechWord[]; total: number }
const LEAD = 0.45
export function speechTimeline(text: string, rate = 1): SpeechTimeline {
  const words: SpeechWord[] = []
  let t = LEAD
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const dur = (0.14 + 0.05 * w.replace(/[^\p{L}\p{N}]/gu, '').length) / rate
    words.push({ text: w, start: t, end: t + dur })
    t += dur + (0.06 + (/[.!?]$/.test(w) ? 0.3 : /[,:;]$/.test(w) ? 0.16 : 0)) / rate
  }
  return { words, total: words.length ? words[words.length - 1]!.end : LEAD }
}
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}
// Mouth amplitude 0..1 at time t: syllable pulses inside a word, silence between words.
export function ampAt(tl: SpeechTimeline, t: number): number {
  for (let i = 0; i < tl.words.length; i++) {
    const w = tl.words[i]!
    if (t < w.start || t > w.end) continue
    const u = (t - w.start) / (w.end - w.start)
    const syl = Math.max(1, Math.round((w.text.length - 1) / 2.6))
    const env = Math.pow(Math.abs(Math.sin(Math.PI * syl * u)), 0.7) * Math.min(1, u * 9, (1 - u) * 9)
    return Math.min(1, Math.max(0, env * (0.55 + 0.45 * hash(i * 7 + Math.floor(u * syl)))))
  }
  return 0
}
export const BUBBLE_HOLD = 3
export const BUBBLE_FADE = 0.5
// What the bubble shows at time t: how many words are revealed, its opacity, whether she is speaking.
export function bubbleAt(tl: SpeechTimeline, t: number): { words: number; opacity: number; talking: boolean; done: boolean } {
  const words = tl.words.filter((w) => t >= w.start).length
  const rise = Math.min(1, Math.max(0, t / 0.22))
  const fall = Math.min(1, Math.max(0, 1 - (t - tl.total - BUBBLE_HOLD) / BUBBLE_FADE))
  const talking = t >= LEAD && t <= tl.total
  return { words, opacity: Math.min(rise, fall), talking, done: t > tl.total + BUBBLE_HOLD + BUBBLE_FADE }
}
