// Weather, the lounge TV and the wall clocks (Office v2). Pure module: particle positions are
// functions of time and a seed, so every frame is reproducible and nothing is stored. Covered by
// tests/pixel-office.test.mjs ("weather", "TV rotation order").

import type { NormalScene } from '@/lib/office-view'
import type { WeatherKind } from '@/lib/office-weather'
import { hashId, mix } from './palette'
import type { Sky } from './sun'

export type Weather = { kind: WeatherKind; tempC: number | null }

export const CLEAR: Weather = { kind: 'clear', tempC: null }

// How grey the sky gets.
export const OVERCAST: Record<WeatherKind, number> = { clear: 0, clouds: 0.35, rain: 0.55, snow: 0.4, fog: 0.55, thunder: 0.72 }

// The sky under the weather: greyer, and no sun behind thick clouds.
export function weatherSky(sky: Sky, kind: WeatherKind): Sky {
  const k = OVERCAST[kind]
  if (!k) return sky
  const grey = mix('#1b1e2b', kind === 'snow' ? '#b9c2cf' : '#8a93a6', sky.daylight)
  return {
    ...sky,
    top: mix(sky.top, grey, k),
    bottom: mix(sky.bottom, grey, k * 0.85),
    sun: k >= 0.5 ? null : sky.sun,
  }
}

export const animatedWeather = (kind: WeatherKind) => kind === 'rain' || kind === 'snow' || kind === 'thunder' || kind === 'clouds'

// Rain streaks inside a w x h box: [x, y] of the top pixel of each 1 x 2 streak.
export function rainDrops(seed: number, w: number, h: number, time: number, reduced: boolean, count = 4): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < count; i++) {
    const s = hashId(`${seed}:r${i}`)
    const x = s % Math.max(1, w)
    const speed = 40 + (s % 23)
    const y = reduced ? (s >>> 8) % Math.max(1, h) : Math.floor(((time / 1000) * speed + (s >>> 8)) % (h + 3)) - 2
    out.push([x, y])
  }
  return out
}

// Snowflakes drifting down and sideways.
export function snowFlakes(seed: number, w: number, h: number, time: number, reduced: boolean, count = 4): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i < count; i++) {
    const s = hashId(`${seed}:s${i}`)
    const t = reduced ? 0 : time / 1000
    const fall = (t * (6 + (s % 5)) + (s >>> 8)) % (h + 1)
    const sway = reduced ? 0 : Math.round(Math.sin(t * 1.3 + (s % 7)) * 1.5)
    out.push([(((s >>> 3) % Math.max(1, w)) + sway + w) % Math.max(1, w), Math.floor(fall)])
  }
  return out
}

// Clouds passing a window (or the open sky): x of each cloud's left edge, its width and row.
export function cloudsAt(seed: number, w: number, time: number, reduced: boolean, count = 1): { x: number; w: number; y: number }[] {
  const out: { x: number; w: number; y: number }[] = []
  for (let i = 0; i < count; i++) {
    const s = hashId(`${seed}:c${i}`)
    const cw = 4 + (s % 5)
    const span = w + cw * 2
    const speed = 1.5 + (s % 3) * 0.5
    const x = reduced ? (s >>> 4) % Math.max(1, w) : Math.floor((((time / 1000) * speed + (s >>> 4)) % span)) - cw
    out.push({ x, w: cw, y: (s >>> 12) % 3 })
  }
  return out
}

// Lightning: a flash about every 9 to 12 s, a short double flicker (never more than 2 a second).
// 0 means no flash; up to 0.55. Reduced motion never flashes.
export function lightning(time: number, reduced: boolean): number {
  if (reduced) return 0
  const period = 10_500
  const cycle = Math.floor(time / period)
  const at = time % period
  const offset = hashId(`bolt${cycle}`) % 1500
  const t = at - offset
  if (t >= 0 && t < 90) return 0.55
  if (t >= 260 && t < 330) return 0.3
  return 0
}

// ---- Lounge TV -----------------------------------------------------------------------------------

export const TV_SLIDE_MS = 8000

export type TvSlide = { id: 'leads' | 'published' | 'approved' | 'visitors' | 'weather' | 'done'; label: string; value: string }

export function formatTemp(c: number | null): string {
  if (c === null) return '--'
  return `${c > 0 ? '+' : ''}${c}°`
}

// Today's numbers in a fixed order: leads, published, approved, visitors, then the weather when
// known. Without the scene block (public hero) the TV shows done tasks and the weather.
export function tvSlides(scene: NormalScene | null, visitorsActive: number, doneToday: number, weather: Weather): TvSlide[] {
  const slides: TvSlide[] = scene
    ? [
        { id: 'leads', label: 'ЛИДЫ', value: String(scene.leadsToday) },
        { id: 'published', label: 'ПОСТЫ', value: String(scene.publishedToday) },
        { id: 'approved', label: 'ОДОБР', value: String(scene.approvedToday) },
        { id: 'visitors', label: 'ГОСТИ', value: String(visitorsActive) },
      ]
    : [{ id: 'done', label: 'ЗАДАЧИ', value: String(doneToday) }]
  if (weather.tempC !== null) slides.push({ id: 'weather', label: 'ПОГОДА', value: formatTemp(weather.tempC) })
  return slides
}

export function tvSlideAt(slides: readonly TvSlide[], time: number): { slide: TvSlide | null; index: number } {
  if (!slides.length) return { slide: null, index: -1 }
  const index = Math.floor(time / TV_SLIDE_MS) % slides.length
  return { slide: slides[index]!, index }
}

// ---- Clocks ----------------------------------------------------------------------------------

// End points of the hands of a clock face of radius r (logical px) for a local hour (13.5 = 13:30).
export function clockHands(hour: number, r: number): { hx: number; hy: number; mx: number; my: number } {
  const h = ((hour % 12) + 12) % 12
  const m = (hour % 1) * 60
  const ha = (h / 12) * Math.PI * 2
  const ma = (m / 60) * Math.PI * 2
  return {
    hx: Math.round(Math.sin(ha) * r * 0.55),
    hy: -Math.round(Math.cos(ha) * r * 0.55),
    mx: Math.round(Math.sin(ma) * r * 0.9),
    my: -Math.round(Math.cos(ma) * r * 0.9),
  }
}
