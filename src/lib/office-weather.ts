// Real weather outside the pixel office: Dushanbe (the owner's choice; the company time zone
// stays Asia/Tashkent in the office data). Open-Meteo needs no key. The route
// /api/office/weather serves `weatherSource().get()`: one upstream call per 10 minutes, shared by
// concurrent requests, and any failure answers «clear» (ok: false) so the office never breaks.
// No server-only imports, so tests can drive it with a fake fetch and clock.

export type WeatherKind = 'clear' | 'clouds' | 'rain' | 'snow' | 'fog' | 'thunder'

export type OfficeWeather = {
  ok: boolean
  kind: WeatherKind
  tempC: number | null
  isDay: boolean | null
  windKmh: number | null
  code: number | null
  city: 'Dushanbe'
  fetchedAt: string
}

export const WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=38.56&longitude=68.79&current=temperature_2m,weather_code,is_day,wind_speed_10m&timezone=Asia/Dushanbe'
export const WEATHER_TTL_MS = 10 * 60_000
// A failed call is retried after a minute, not after ten.
export const WEATHER_FAIL_TTL_MS = 60_000
const TIMEOUT_MS = 4000

export const WEATHER_KINDS: readonly WeatherKind[] = ['clear', 'clouds', 'rain', 'snow', 'fog', 'thunder']

// WMO weather interpretation codes (Open-Meteo `weather_code`) to the six looks of the office.
export function weatherKind(code: unknown): WeatherKind {
  if (typeof code !== 'number' || !Number.isFinite(code)) return 'clear'
  const c = Math.round(code)
  if (c <= 1) return 'clear'
  if (c <= 3) return 'clouds'
  if (c === 45 || c === 48) return 'fog'
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 'rain'
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow'
  if (c >= 95 && c <= 99) return 'thunder'
  return 'clear'
}

export function clearWeather(now = Date.now()): OfficeWeather {
  return { ok: false, kind: 'clear', tempC: null, isDay: null, windKmh: null, code: null, city: 'Dushanbe', fetchedAt: new Date(now).toISOString() }
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

// Open-Meteo's JSON to the office's shape; anything unexpected gives «clear».
export function parseOpenMeteo(body: unknown, now = Date.now()): OfficeWeather {
  const cur = body && typeof body === 'object' ? (body as { current?: unknown }).current : null
  if (!cur || typeof cur !== 'object') return clearWeather(now)
  const c = cur as Record<string, unknown>
  const code = num(c.weather_code)
  if (code === null) return clearWeather(now)
  const temp = num(c.temperature_2m)
  const wind = num(c.wind_speed_10m)
  const day = num(c.is_day)
  return {
    ok: true,
    kind: weatherKind(code),
    tempC: temp === null ? null : Math.round(temp),
    isDay: day === null ? null : day === 1,
    windKmh: wind === null ? null : Math.round(wind),
    code,
    city: 'Dushanbe',
    fetchedAt: new Date(now).toISOString(),
  }
}

// Light check for the client (a proxy error page must not reach the canvas).
export function looksLikeWeather(v: unknown): v is OfficeWeather {
  return !!v && typeof v === 'object' && WEATHER_KINDS.includes((v as { kind?: WeatherKind }).kind as WeatherKind)
}

export function weatherSource({
  fetcher = fetch,
  clock = Date.now,
}: { fetcher?: typeof fetch; clock?: () => number } = {}) {
  let cached: { value: OfficeWeather; until: number } | null = null
  let inflight: Promise<OfficeWeather> | null = null

  async function load(): Promise<OfficeWeather> {
    try {
      const res = await fetcher(WEATHER_URL, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (!res.ok) return clearWeather(clock())
      return parseOpenMeteo(await res.json(), clock())
    } catch {
      return clearWeather(clock())
    }
  }

  return {
    async get(): Promise<OfficeWeather> {
      const now = clock()
      if (cached && now < cached.until) return cached.value
      if (!inflight) {
        inflight = load().then((value) => {
          cached = { value, until: clock() + (value.ok ? WEATHER_TTL_MS : WEATHER_FAIL_TTL_MS) }
          inflight = null
          return value
        })
      }
      return inflight
    },
  }
}
