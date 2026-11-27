import { useSyncExternalStore } from 'react'

// Sound (docs/motion-storyboard.md §7): off by default, one toggle, the choice in localStorage['fir-sound'].
// T1 owns the toggle state; T4 adds the cues behind `playCue`.
export const SOUND_KEY = 'fir-sound'

export type CueName = 'on' | 'tick' | 'page' | 'pageBack' | 'palette' | 'paletteOut' | 'cta' | 'cold'

const listeners = new Set<() => void>()
let cached: boolean | null = null

function read(): boolean {
  if (cached !== null) return cached
  try {
    cached = localStorage.getItem(SOUND_KEY) === 'on'
  } catch {
    cached = false
  }
  return cached
}

export function soundOn(): boolean {
  return typeof window !== 'undefined' && read()
}

export function setSound(on: boolean): void {
  cached = on
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    // Storage blocked: the choice lasts for this page view only.
  }
  for (const l of listeners) l()
  if (on) {
    gestured = true // the toggle press is the gesture
    playCue('on')
  }
}

export function toggleSound(): void {
  setSound(!read())
}

// --- the six cues (docs/motion-storyboard.md section 7), synthesised with WebAudio -------------------------
// T4 could not fetch licensed recordings (the CDN refused automated downloads), so nothing is downloaded: every cue is
// a few oscillators and filtered noise made here, which also means no sprite, no request and no licence to credit.
// Rules: nothing plays while the toggle is off, before the first user gesture, or on /pay/** and /cabinet/**;
// the AudioContext is created on the first cue after a gesture; master peak is about -12 dBFS.
export type CueOptions = { index?: number }

const GESTURE_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const
const SILENT_ROUTE = /^\/(?:(?:ru|en)\/)?(?:pay|cabinet)(?:\/|$)/
export const TICK_MIN_GAP_MS = 120

let gestured = false
let ctx: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null
let lastTick = 0

export function cueAllowed(path: string, on: boolean, hadGesture: boolean): boolean {
  return on && hadGesture && !SILENT_ROUTE.test(path)
}

// Called once from the app shell: records the first gesture (which unlocks audio) and plays the CTA cue from one
// delegated listener (pointer press, or a keyboard-made click).
export function initSound(): () => void {
  const mark = () => {
    gestured = true
  }
  const press = (e: Event) => {
    if (e.type === 'click' && (e as MouseEvent).detail !== 0) return
    if ((e.target as Element | null)?.closest?.('[data-cta]')) playCue('cta')
  }
  for (const t of GESTURE_EVENTS) window.addEventListener(t, mark, { capture: true, passive: true })
  document.addEventListener('pointerdown', press, true)
  document.addEventListener('click', press, true)
  return () => {
    for (const t of GESTURE_EVENTS) window.removeEventListener(t, mark, true)
    document.removeEventListener('pointerdown', press, true)
    document.removeEventListener('click', press, true)
  }
}

function engine(): AudioContext | null {
  if (ctx) return ctx
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = 0.25
    master.connect(ctx.destination)
  } catch {
    ctx = null
  }
  return ctx
}

// One tone: a sine/triangle that glides from `f0` to `f1`, soft attack, exponential decay.
function tone(c: AudioContext, at: number, f0: number, f1: number, len: number, gain: number, type: OscillatorType = 'sine') {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, at)
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at + len)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, at + len)
  o.connect(g).connect(master as GainNode)
  o.start(at)
  o.stop(at + len + 0.02)
}

// A band-passed noise swish whose centre glides from `f0` to `f1`.
function swish(c: AudioContext, at: number, f0: number, f1: number, len: number, gain: number) {
  if (!noise) {
    noise = c.createBuffer(1, Math.ceil(c.sampleRate * 0.4), c.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const src = c.createBufferSource()
  src.buffer = noise
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = 1.2
  f.frequency.setValueAtTime(f0, at)
  f.frequency.exponentialRampToValueAtTime(f1, at + len)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + len * 0.4)
  g.gain.exponentialRampToValueAtTime(0.0001, at + len)
  src.connect(f).connect(g).connect(master as GainNode)
  src.start(at)
  src.stop(at + len + 0.02)
}

const voices: Record<CueName, (c: AudioContext, t: number, o: CueOptions) => void> = {
  // soft two-note rise, 250 ms
  on: (c, t) => {
    tone(c, t, 523.25, 523.25, 0.13, 0.5)
    tone(c, t + 0.11, 783.99, 783.99, 0.14, 0.5)
  },
  // very quiet wooden tick, +1 semitone per section, 40 ms
  tick: (c, t, o) => {
    const k = 2 ** (Math.min(Math.max(o.index ?? 0, 0), 11) / 12)
    tone(c, t, 1300 * k, 800 * k, 0.04, 0.22, 'triangle')
  },
  // low airy swish, forward up / back down, 280 ms
  page: (c, t) => swish(c, t, 500, 1500, 0.28, 0.5),
  pageBack: (c, t) => swish(c, t, 1500, 500, 0.28, 0.5),
  // glassy pop / reverse pop, 120 ms
  palette: (c, t) => tone(c, t, 620, 1180, 0.12, 0.45),
  paletteOut: (c, t) => tone(c, t, 1180, 620, 0.12, 0.35),
  // warm click with a short tail, 150 ms
  cta: (c, t) => {
    tone(c, t, 420, 300, 0.15, 0.5, 'triangle')
    tone(c, t, 1260, 900, 0.05, 0.2)
  },
  // single resonant tone, the lime dot, 600 ms
  cold: (c, t) => {
    tone(c, t, 392, 392, 0.6, 0.45)
    tone(c, t, 784, 784, 0.35, 0.12)
  },
}

// Callers may call it freely; it never throws and never plays while off, before a gesture or on a silent route.
export function playCue(name: CueName, opts: CueOptions = {}): void {
  try {
    if (typeof window === 'undefined' || !cueAllowed(location.pathname, read(), gestured)) return
    if (name === 'tick') {
      const now = performance.now()
      if (now - lastTick < TICK_MIN_GAP_MS) return
      lastTick = now
    }
    const c = engine()
    if (!c) return
    if (c.state === 'suspended') void c.resume()
    voices[name](c, c.currentTime + 0.005, opts)
  } catch {
    // Audio is a nicety: any failure is silent.
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

export function useSound(): boolean {
  return useSyncExternalStore(subscribe, read, () => false)
}
