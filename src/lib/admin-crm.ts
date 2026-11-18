import { admin } from '@/content/admin'
import {
  adminStatuses,
  calendarDays,
  dayKey,
  filterLeads,
  leadsCsv,
  type AdminLead,
} from './admin-data'
import type { LeadStatus } from './store'

// View models of the control center panels «Лиды» and «Созвоны». Pure: no I/O and no React, so the
// tests call them directly.

export type StatusFilter = LeadStatus | 'all'

// Lead counts per status, for the chips. `all` is every lead.
export function statusCounts(leads: Pick<AdminLead, 'status'>[]): Record<StatusFilter, number> {
  const counts = { all: leads.length } as Record<StatusFilter, number>
  for (const status of adminStatuses) counts[status] = 0
  for (const lead of leads) counts[lead.status] += 1
  return counts
}

// Leads grouped by status, newest first inside a group.
export function groupByStatus<T extends AdminLead>(leads: T[]): Record<LeadStatus, T[]> {
  const groups = Object.fromEntries(adminStatuses.map((s) => [s, [] as T[]])) as Record<LeadStatus, T[]>
  const newestFirst = [...leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
  for (const lead of newestFirst) groups[lead.status].push(lead)
  return groups
}

// The list the panel shows: status chip and search box, newest first.
export function visibleLeads<T extends AdminLead>(leads: T[], status: StatusFilter, q: string): T[] {
  return filterLeads(leads, { status, q }, Date.now())
}

// «New» leads are the ones nobody has taken yet.
export const newLeadCount = (leads: Pick<AdminLead, 'status'>[]) =>
  leads.filter((l) => l.status === 'new').length

const activeBooking = (lead: Pick<AdminLead, 'booking'>) =>
  lead.booking && lead.booking.state !== 'released' ? lead.booking : null

export type Call = {
  id: number
  name: string
  slot: string
  state: 'pending' | 'confirmed'
}

// Every live (not released) booking, soonest first.
export function allCalls(leads: Pick<AdminLead, 'id' | 'name' | 'booking'>[]): Call[] {
  return leads
    .flatMap((lead) => {
      const booking = activeBooking(lead)
      return booking
        ? [{ id: lead.id, name: lead.name, slot: booking.slot, state: booking.state as Call['state'] }]
        : []
    })
    .sort((a, b) => a.slot.localeCompare(b.slot))
}

// Calls on the owner's today (Dushanbe), counting the ones already past.
export function callsToday(leads: Pick<AdminLead, 'id' | 'name' | 'booking'>[], now: number) {
  const today = dayKey(now)
  return allCalls(leads).filter((c) => dayKey(c.slot) === today)
}

// Calls that still wait for the owner's confirmation and have not started yet.
export function pendingCalls(leads: Pick<AdminLead, 'id' | 'name' | 'booking'>[], now: number) {
  return allCalls(leads).filter((c) => c.state === 'pending' && Date.parse(c.slot) >= now - 30 * 60_000)
}

export type WeekDay = { date: string; today: boolean; past: boolean; calls: Call[]; free: number }
export type Week = { start: string; days: WeekDay[] }


// «2026-10-16» plus n days, as a day key (calendar arithmetic in UTC, so no zone surprises).
function addDays(key: string, n: number) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10)
}

// Monday of the week that holds the day key.
function mondayOf(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  const weekday = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() // 0 = Sunday
  return addDays(key, -((weekday + 6) % 7))
}

// The current and the next `weeks - 1` weeks, Monday to Friday, each day with its live calls and
// the number of free slots (same rules as the booking form, from calendarDays).
export function bookingWeeks(
  leads: Pick<AdminLead, 'id' | 'name' | 'booking'>[],
  now: number,
  weeks = 2,
): Week[] {
  const today = dayKey(now)
  const calls = allCalls(leads)
  const free = new Map<string, number>()
  for (const day of calendarDays(leads, now)) {
    free.set(day.date, day.slots.filter((s) => s.state === 'free').length)
  }
  const first = mondayOf(today)
  return Array.from({ length: weeks }, (_, w) => {
    const start = addDays(first, w * 7)
    return {
      start,
      days: Array.from({ length: 5 }, (_, i) => {
        const date = addDays(start, i)
        return {
          date,
          today: date === today,
          past: date < today,
          calls: calls.filter((c) => dayKey(c.slot) === date),
          free: free.get(date) ?? 0,
        }
      }),
    }
  })
}

// CSV of the leads the panel shows (or all of them), with the panel's own names.
export function crmCsv(leads: AdminLead[]) {
  return leadsCsv(leads, {
    statuses: admin.statuses,
    services: admin.services,
    bookings: admin.bookings,
    header: admin.csvHeader,
  })
}

