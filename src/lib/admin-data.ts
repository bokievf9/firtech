import { bookingConfig, formatSlot, generateSlots, zonedParts } from './booking'
import type { Lead } from './lead'
import { siteUrl } from './site'
import type { LeadStatus, StoredLead } from './store'

// Pure helpers behind the owner panel: stats, filters, calendar and CSV. No I/O here, so they are
// tested directly and the client components can use them too.

export const adminStatuses = [
  'new',
  'taken',
  'called',
  'won',
  'lost',
] as const satisfies readonly LeadStatus[]

// What the browser gets: the stored lead without bot internals.
export type AdminLead = Omit<StoredLead, 'clientChatId' | 'ownerMessageId' | 'notified'> & {
  inBot: boolean
}

export function toAdminLead(lead: StoredLead): AdminLead {
  const { clientChatId, ownerMessageId: _m, notified: _n, ...rest } = lead
  void _m
  void _n
  return { ...rest, inBot: Boolean(clientChatId) }
}

const DAY = 24 * 60 * 60_000
const pad = (n: number) => String(n).padStart(2, '0')

// Calendar day in the booking zone (Dushanbe), so "today" means the owner's today.
export function dayKey(time: number | string | Date) {
  const p = zonedParts(new Date(time))
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

// Day keys of the last `count` days, oldest first, today last.
export function lastDays(now: number, count: number) {
  return Array.from({ length: count }, (_, i) => dayKey(now - (count - 1 - i) * DAY))
}

const activeBooking = (lead: Pick<StoredLead, 'booking'>) =>
  lead.booking && lead.booking.state !== 'released' ? lead.booking : null

export type Stats = {
  today: number
  week: number
  month: number
  // Leads per day for the last 30 days, oldest first.
  series: number[]
  funnel: { status: LeadStatus; count: number }[]
  total: number
  // Share of all leads that became a deal, 0..1.
  conversion: number
  byService: { service: Lead['service']; count: number }[]
  upcoming: { id: number; name: string; slot: string; state: 'pending' | 'confirmed' }[]
  stale: { id: number; name: string; createdAt: string; contact: string }[]
}

export function computeStats(
  leads: Pick<
    StoredLead,
    'id' | 'name' | 'contact' | 'createdAt' | 'status' | 'service' | 'booking'
  >[],
  now: number,
): Stats {
  const days = lastDays(now, 30)
  const perDay = new Map(days.map((d) => [d, 0]))
  for (const lead of leads) {
    const key = dayKey(lead.createdAt)
    if (perDay.has(key)) perDay.set(key, (perDay.get(key) ?? 0) + 1)
  }
  const series = days.map((d) => perDay.get(d) ?? 0)
  const sum = (from: number) => series.slice(from).reduce((a, b) => a + b, 0)

  const funnel = adminStatuses.map((status) => ({
    status,
    count: leads.filter((l) => l.status === status).length,
  }))
  const won = funnel.find((f) => f.status === 'won')?.count ?? 0

  const services = new Map<Lead['service'], number>()
  for (const lead of leads) services.set(lead.service, (services.get(lead.service) ?? 0) + 1)
  const byService = [...services]
    .map(([service, count]) => ({ service, count }))
    .sort((a, b) => b.count - a.count || a.service.localeCompare(b.service))

  const upcoming = leads
    .flatMap((lead) => {
      const booking = activeBooking(lead)
      if (!booking) return []
      const at = Date.parse(booking.slot)
      if (at < now || at > now + 7 * DAY) return []
      return [
        {
          id: lead.id,
          name: lead.name,
          slot: booking.slot,
          state: booking.state as 'pending' | 'confirmed',
        },
      ]
    })
    .sort((a, b) => a.slot.localeCompare(b.slot))

  const stale = leads
    .filter((l) => l.status === 'new' && now - Date.parse(l.createdAt) > DAY)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(({ id, name, createdAt, contact }) => ({ id, name, createdAt, contact }))

  return {
    today: sum(29),
    week: sum(23),
    month: sum(0),
    series,
    funnel,
    total: leads.length,
    conversion: leads.length ? won / leads.length : 0,
    byService,
    upcoming,
    stale,
  }
}

export type Period = 'all' | 'today' | '7' | '30'
export type LeadFilter = {
  q?: string
  status?: LeadStatus | 'all'
  service?: Lead['service'] | 'all'
  period?: Period
  sort?: 'new' | 'old'
}

export function filterLeads<T extends AdminLead>(leads: T[], filter: LeadFilter, now: number): T[] {
  const q = (filter.q ?? '').trim().toLowerCase()
  const periodDays = { all: 0, today: 1, '7': 7, '30': 30 }[filter.period ?? 'all']
  const allowedDays = periodDays ? new Set(lastDays(now, periodDays)) : null
  const result = leads.filter((lead) => {
    if (filter.status && filter.status !== 'all' && lead.status !== filter.status) return false
    if (filter.service && filter.service !== 'all' && lead.service !== filter.service) return false
    if (allowedDays && !allowedDays.has(dayKey(lead.createdAt))) return false
    if (q) {
      const haystack = [
        lead.name,
        lead.contact,
        lead.message,
        lead.estimate,
        lead.notes ?? '',
        `№${lead.id}`,
      ]
        .join('\n')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
  const dir = filter.sort === 'old' ? 1 : -1
  return result.sort((a, b) => dir * (a.createdAt.localeCompare(b.createdAt) || a.id - b.id))
}

export type CalendarSlot = {
  slot: string
  state: 'free' | 'pending' | 'confirmed'
  leadId?: number
  name?: string
}
export type CalendarDay = { date: string; slots: CalendarSlot[] }

// The next working days with every slot, free or taken. Same rules as the booking form; slots of
// today that are still ahead are shown even inside the form's 2-hour notice window.
export function calendarDays(
  leads: Pick<StoredLead, 'id' | 'name' | 'booking'>[],
  now: number,
): CalendarDay[] {
  const booked = new Map<string, { id: number; name: string; state: 'pending' | 'confirmed' }>()
  for (const lead of leads) {
    const booking = activeBooking(lead)
    if (booking)
      booked.set(booking.slot, {
        id: lead.id,
        name: lead.name,
        state: booking.state as 'pending' | 'confirmed',
      })
  }
  const from = new Date(now - bookingConfig.minLeadMinutes * 60_000)
  return generateSlots(from)
    .map((day) => ({
      date: day.date,
      slots: day.slots
        .filter((slot) => Date.parse(slot) + bookingConfig.slotMinutes * 60_000 > now)
        .map((slot) => {
          const lead = booked.get(slot)
          return lead
            ? { slot, state: lead.state, leadId: lead.id, name: lead.name }
            : { slot, state: 'free' as const }
        }),
    }))
    .filter((day) => day.slots.length)
}

// Quick actions for a contact: t.me for an @username, tel: for a phone number.
export function contactLinks(contact: string) {
  const value = contact.trim()
  const username = value.match(/^(?:@|(?:https?:\/\/)?t\.me\/)([A-Za-z][A-Za-z0-9_]{3,31})$/)
  if (username) return { telegram: `https://t.me/${username[1]}` }
  const digits = value.replace(/\D/g, '')
  if (/^\+?[\d\s().-]+$/.test(value) && digits.length >= 7 && digits.length <= 15) {
    return { phone: `tel:${value.startsWith('+') ? '+' : ''}${digits}` }
  }
  return {}
}

// The page the lead was sent from; a builder page carries the whole build in ?b=.
export function leadPageLink(page: string) {
  if (!page || !page.startsWith('/')) return null
  return { url: `${siteUrl}${page}`, builder: /^\/(ru|en)\/builder(\/|\?|$)/.test(page) }
}

// "16.10.2026 14:05" in Dushanbe time.
export function formatDateTime(iso: string) {
  const p = zonedParts(new Date(iso))
  return `${pad(p.day)}.${pad(p.month)}.${p.year} ${pad(p.hour)}:${pad(p.minute)}`
}

export { formatSlot }

// CSV for Excel: a cell that could start a formula gets a leading quote, and any cell with a quote,
// comma or line break is wrapped in quotes with inner quotes doubled.
export function csvCell(value: unknown) {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

export function toCsv(rows: unknown[][]) {
  // BOM first, so Excel reads the file as UTF-8 and Cyrillic stays readable.
  return '﻿' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export function leadsCsv(
  leads: AdminLead[],
  names: {
    statuses: Record<LeadStatus, string>
    services: Record<Lead['service'], string>
    bookings: Record<string, string>
    header: string[]
  },
) {
  const rows = leads.map((l) => [
    l.id,
    formatDateTime(l.createdAt),
    names.statuses[l.status],
    l.name,
    l.contact,
    names.services[l.service],
    l.budget,
    l.message,
    l.estimate,
    l.page ? `${siteUrl}${l.page}` : '',
    l.locale.toUpperCase(),
    l.booking ? formatSlot(l.booking.slot, 'ru', false) : '',
    l.booking ? names.bookings[l.booking.state] : '',
    l.notes ?? '',
  ])
  return toCsv([names.header, ...rows])
}
