// Light that follows the real sun in the company's time zone. A cheap model that is right for
// Tashkent in late autumn: sunrise ~06:30, sunset ~17:30, twilight about an hour either side.
// Pure module, covered by tests/pixel-office.test.mjs.

import { mix } from './palette'

export const SUNRISE = 6.5
export const SUNSET = 17.5
const TWILIGHT = 1

export type SkyPhase = 'night' | 'dawn' | 'day' | 'dusk'

export type Sky = {
  phase: SkyPhase
  top: string
  bottom: string
  // 0 at night, 1 in full day.
  daylight: number
  // Lit windows in the city outside.
  cityLights: boolean
  // Sun position across the window (0..1 left to right) and height (0..1), null when down.
  sun: { x: number; y: number } | null
}

// Local wall-clock hour as a fraction (13.5 = 13:30) in a time zone; UTC when the zone is unknown.
export function localHour(now: number, tz: string): number {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now)
  } catch {
    const d = new Date(now)
    return d.getUTCHours() + d.getUTCMinutes() / 60
  }
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return (get('hour') % 24) + get('minute') / 60
}

type Key = { h: number; top: string; bottom: string }

const NIGHT = { top: '#0b1030', bottom: '#1d2350' }
const DAWN = { top: '#3a4a8a', bottom: '#f2a46b' }
const DAY = { top: '#4fa3e8', bottom: '#b4e0ff' }
const DUSK = { top: '#43306e', bottom: '#f08a5d' }

const KEYS: readonly Key[] = [
  { h: 0, ...NIGHT },
  { h: SUNRISE - TWILIGHT, ...NIGHT },
  { h: SUNRISE, ...DAWN },
  { h: SUNRISE + TWILIGHT, ...DAY },
  { h: SUNSET - TWILIGHT, ...DAY },
  { h: SUNSET, ...DUSK },
  { h: SUNSET + TWILIGHT, ...NIGHT },
  { h: 24, ...NIGHT },
]

export function skyAt(hour: number): Sky {
  const h = ((hour % 24) + 24) % 24
  let i = 0
  while (i < KEYS.length - 2 && KEYS[i + 1]!.h <= h) i++
  const a = KEYS[i]!
  const b = KEYS[i + 1]!
  const t = b.h === a.h ? 0 : (h - a.h) / (b.h - a.h)

  const phase: SkyPhase =
    h < SUNRISE - TWILIGHT || h >= SUNSET + TWILIGHT
      ? 'night'
      : h < SUNRISE + TWILIGHT
        ? 'dawn'
        : h < SUNSET - TWILIGHT
          ? 'day'
          : 'dusk'

  const ramp = (from: number, to: number) => Math.min(1, Math.max(0, (h - from) / (to - from)))
  const daylight =
    h < SUNSET - TWILIGHT
      ? ramp(SUNRISE - TWILIGHT, SUNRISE + TWILIGHT)
      : 1 - ramp(SUNSET - TWILIGHT, SUNSET + TWILIGHT)

  const across = (h - SUNRISE) / (SUNSET - SUNRISE)
  const sun = across >= 0 && across <= 1 ? { x: across, y: Math.sin(Math.PI * across) } : null

  return {
    phase,
    top: mix(a.top, b.top, t),
    bottom: mix(a.bottom, b.bottom, t),
    daylight: Math.round(daylight * 100) / 100,
    cityLights: daylight < 0.5,
    sun,
  }
}
