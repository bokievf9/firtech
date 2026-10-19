'use client'

import { useCallback, useState } from 'react'
import { admin } from '@/content/admin'
import type { IgDay, IgItem } from '@/lib/pulse-types'
import { api, ApiError, igScope } from './api'

const e = admin.pulse.ig.errors

// Instagram week and the daily numbers, edited in place. A tick shows at once and rolls back with
// a message when the server refuses.
export function useInstagram(
  initialItems: IgItem[],
  initialDays: IgDay[],
  onError: (message: string) => void,
) {
  const [items, setItems] = useState(initialItems)
  const [days, setDays] = useState(initialDays)
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())

  const mark = useCallback(
    async (item: IgItem, published: boolean): Promise<boolean> => {
      setBusy((s) => new Set(s).add(item.id))
      setItems((list) => list.map((i) => (i.id === item.id ? { ...i, published } : i)))
      try {
        const { item: saved } = await api<{ item: IgItem }>(
          `/api/admin/instagram/items/${encodeURIComponent(item.id)}`,
          { method: 'PATCH', body: { published } },
          igScope,
          e.mark,
        )
        setItems((list) => list.map((i) => (i.id === item.id ? saved : i)))
        return true
      } catch (error) {
        setItems((list) => list.map((i) => (i.id === item.id ? item : i)))
        onError(error instanceof ApiError ? error.message : e.mark)
        return false
      } finally {
        setBusy((s) => {
          const next = new Set(s)
          next.delete(item.id)
          return next
        })
      }
    },
    [onError],
  )

  const saveDay = useCallback(
    async (day: IgDay): Promise<boolean> => {
      try {
        const { day: saved } = await api<{ day: IgDay }>(
          '/api/admin/instagram/days',
          { method: 'PUT', body: day },
          igScope,
          e.day,
        )
        setDays((list) => [...list.filter((d) => d.date !== saved.date), saved])
        return true
      } catch (error) {
        onError(error instanceof ApiError ? error.message : e.day)
        return false
      }
    },
    [onError],
  )

  return { items, days, busy, mark, saveDay }
}

export type InstagramApi = ReturnType<typeof useInstagram>
