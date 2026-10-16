// Call booking rules. Owner settings: edit these constants to change when calls can be booked.
export const bookingConfig = {
  timeZone: 'Asia/Dushanbe',
  // 1 = Monday ... 5 = Friday (0 is Sunday, 6 is Saturday).
  workDays: [1, 2, 3, 4, 5],
  // Local time of the first slot and of the end of the working day, in minutes from midnight.
  dayStart: 10 * 60,
  dayEnd: 18 * 60,
  slotMinutes: 30,
  // How many working days ahead the picker shows.
  daysAhead: 10,
  // A visitor can't book a call that starts sooner than this.
  minLeadMinutes: 120,
}

// Same zone names as the dictionaries would use; kept here so the owner message and the form agree.
const zoneLabel = { ru: 'Душанбе', en: 'Dushanbe' } as const
const weekdays = {
  ru: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
} as const

type BookingLocale = keyof typeof zoneLabel

export type SlotDay = {
  // Local calendar date in the booking time zone, YYYY-MM-DD.
  date: string
  // Slot start times as UTC ISO strings: the same value travels from the API to the form and back.
  slots: string[]
}

type Parts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekday: number
}

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: bookingConfig.timeZone,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
  weekday: 'short',
})
const weekdayIndex: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

// Wall-clock parts of an instant in the booking zone (Intl handles offsets and any DST rules).
export function zonedParts(date: Date): Parts {
  const map: Record<string, string> = {}
  for (const part of partsFormatter.formatToParts(date)) map[part.type] = part.value
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    weekday: weekdayIndex[map.weekday ?? ''] ?? 0,
  }
}

// UTC instant for a wall-clock time in the booking zone. Two passes settle the offset even on a
// day when it changes (Dushanbe has no DST today, but the rule could change).
function zonedTime(year: number, month: number, day: number, minutes: number) {
  const target = Date.UTC(year, month - 1, day, 0, minutes)
  let guess = target
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess))
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
    guess += target - asUtc
  }
  return new Date(guess)
}

const pad = (n: number) => String(n).padStart(2, '0')

// Free slots for the next working days. `taken` holds the slots already booked by other leads.
export function generateSlots(now: Date, taken: Iterable<string> = []): SlotDay[] {
  const booked = new Set(taken)
  const earliest = now.getTime() + bookingConfig.minLeadMinutes * 60_000
  const today = zonedParts(now)
  const days: SlotDay[] = []
  let counted = 0

  // Walk calendar days from today; 31 is a safe upper bound for 10 working days plus holidays.
  for (let offset = 0; counted < bookingConfig.daysAhead && offset < 31; offset++) {
    const noon = zonedTime(today.year, today.month, today.day + offset, 12 * 60)
    const day = zonedParts(noon)
    if (!bookingConfig.workDays.includes(day.weekday)) continue

    const all: string[] = []
    for (
      let m = bookingConfig.dayStart;
      m + bookingConfig.slotMinutes <= bookingConfig.dayEnd;
      m += bookingConfig.slotMinutes
    ) {
      const start = zonedTime(day.year, day.month, day.day, m)
      if (start.getTime() >= earliest) all.push(start.toISOString())
    }
    // Today counts as one of the working days only if some of it is still bookable.
    if (!all.length) continue
    counted++
    const free = all.filter((slot) => !booked.has(slot))
    if (free.length)
      days.push({ date: `${day.year}-${pad(day.month)}-${pad(day.day)}`, slots: free })
  }
  return days
}

export function isFreeSlot(slot: string, now: Date, taken: Iterable<string> = []) {
  return generateSlots(now, taken).some((day) => day.slots.includes(slot))
}

// "пт 18.10, 14:30 (Душанбе)" / "Fri 18.10, 14:30 (Dushanbe)".
export function formatSlot(slot: string, locale: BookingLocale = 'ru', withZone = true) {
  const p = zonedParts(new Date(slot))
  const text = `${formatDay(p, locale)}, ${pad(p.hour)}:${pad(p.minute)}`
  return withZone ? `${text} (${zoneLabel[locale]})` : text
}

export function formatSlotTime(slot: string) {
  const p = zonedParts(new Date(slot))
  return `${pad(p.hour)}:${pad(p.minute)}`
}

// Day chip label from a YYYY-MM-DD date: "пт 18.10".
export function formatSlotDate(date: string, locale: BookingLocale = 'ru') {
  const [year, month, day] = date.split('-').map(Number)
  const weekday = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)).getUTCDay()
  return formatDay({ month: month ?? 1, day: day ?? 1, weekday }, locale)
}

function formatDay(p: Pick<Parts, 'month' | 'day' | 'weekday'>, locale: BookingLocale) {
  return `${weekdays[locale][p.weekday]} ${pad(p.day)}.${pad(p.month)}`
}
