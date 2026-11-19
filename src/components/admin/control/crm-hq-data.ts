'use client'

import { useCallback, useMemo } from 'react'
import {
  normalizeClients,
  normalizeDocuments,
  normalizeProjects,
  normalizeProspects,
  normalizeReferrals,
  normalizeReviews,
  normalizeSummary,
  normalizeTickets,
  summaryBadges,
  type Client,
  type CrmDocument,
  type CrmList,
  type CrmSummary,
  type Project,
  type Prospect,
  type Referral,
  type Ticket,
} from '@/lib/admin-crm-hq'
import { usePoll } from './api'

export const POLL = { visible: 30_000, hidden: 120_000 }
const SLOW = { visible: 300_000, hidden: 600_000 }
export const LIST_LIMIT = 200

export type CrmFeed<T> = {
  list: CrmList<T> | null
  // Only while there is nothing to show; a failed poll after a good one keeps the old rows.
  error: string | null
  reload: () => void
  // Swaps one row for the one HQ answered with after a write.
  replace: (raw: unknown) => void
}

type Raw = Record<string, unknown>

export function useFeed<T>(path: string, normalize: (body: unknown) => CrmList<T> | null, opts = POLL): CrmFeed<T> {
  const poll = usePoll<Raw>(path, opts)
  const { data, error, reload, mutate } = poll
  const list = useMemo(() => (data ? normalize(data) : null), [data, normalize])
  const replace = useCallback(
    (raw: unknown) => {
      const id = raw && typeof raw === 'object' ? String((raw as Raw).id) : ''
      if (!id) return
      mutate((d) => ({
        ...d,
        items: Array.isArray(d.items) ? d.items.map((i) => (i && typeof i === 'object' && String((i as Raw).id) === id ? raw : i)) : d.items,
      }))
    },
    [mutate],
  )
  return { list, error: list ? null : (error ?? (data ? 'hq_bad_response' : null)), reload: () => void reload(), replace }
}

export type CrmHq = {
  summary: CrmSummary | null
  badges: Record<string, string | null>
  prospects: CrmFeed<Prospect>
  clients: CrmFeed<Client>
  tickets: CrmFeed<Ticket>
  documents: CrmFeed<CrmDocument>
  projects: CrmFeed<Project>
  referrals: CrmFeed<Referral>
  reviews: CrmFeed<never>
}

// The data of the seven CRM panels: HQ's /admin/crm/* lists (newest first, up to 200 rows, filtered
// in the browser) and `summary` for the badges, all polled every 30 s (every 2 min on a hidden tab).
export function useCrmHq(): CrmHq {
  const summaryPoll = usePoll<Raw>('crm/summary', POLL)
  const summary = useMemo(() => (summaryPoll.data ? normalizeSummary(summaryPoll.data) : null), [summaryPoll.data])
  const q = `?limit=${LIST_LIMIT}`
  return {
    summary,
    badges: summaryBadges(summary),
    prospects: useFeed(`crm/prospects${q}`, normalizeProspects),
    clients: useFeed(`crm/clients${q}`, normalizeClients),
    tickets: useFeed(`crm/tickets${q}`, normalizeTickets),
    documents: useFeed(`crm/documents${q}`, normalizeDocuments),
    projects: useFeed(`crm/projects${q}`, normalizeProjects),
    referrals: useFeed(`crm/referrals${q}`, normalizeReferrals),
    reviews: useFeed('crm/reviews', normalizeReviews, SLOW),
  }
}
