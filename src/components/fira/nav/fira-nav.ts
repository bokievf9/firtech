'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'
import { FALLBACK_SELECTOR, GUIDE_GO_EVENT, GUIDE_TOUR_START_EVENT, goPlan, parseFiraParam, withoutFiraParam, type GoDetail } from '@/lib/fira/nav/go'
import { RECENT_KEY, pushRecent, recentList } from '@/lib/fira/nav/recent'
import { entryByKey } from '@/lib/fira/nav/sitemap'
import { HEADER_OFFSET, scrollTopFor } from '@/lib/fira/nav/spotlight'
import { focusOf, pulseElement, scrollSettled, waitForElement } from './fira-dom'

// «Отведи меня» in the browser (Fira nav 2.0): one place that turns a request (a chat card, a map row, a chip, a
// deep link) into a trip: route with the router when the place is on another page, wait for the section, scroll to it
// under the header and pulse it once. Requests arrive as a window event, so any piece can ask without sharing state.
export function useFiraNav({ pathname, locale, reduce, startTour }: { pathname: string; locale: string; reduce: boolean; startTour: () => void }) {
  const router = useRouter()
  const pending = useRef<GoDetail | null>(null)
  const latest = useRef({ pathname, locale, reduce, startTour })
  useEffect(() => {
    latest.current = { pathname, locale, reduce, startTour }
  })

  // On the page: wait for the section, scroll, pulse. A missing section falls back to the heading of the page.
  const arrive = useCallback(async (detail: GoDetail) => {
    const entry = detail.key ? entryByKey(detail.key) : undefined
    const wanted = detail.selectors?.length ? detail.selectors : entry?.selector ? [entry.selector] : []
    let el = wanted.length ? await waitForElement(wanted, 4000) : null
    if (!el && detail.fallback) {
      const fb = entryByKey(detail.fallback)
      if (fb) {
        window.dispatchEvent(new CustomEvent(GUIDE_GO_EVENT, { detail: { key: fb.key } satisfies GoDetail }))
        return
      }
    }
    el ??= await waitForElement([FALLBACK_SELECTOR], 600)
    if (!el) return
    const focus = focusOf(el)
    const top = scrollTopFor(focus.getBoundingClientRect().top + window.scrollY, focus.getBoundingClientRect().height, window.innerHeight, HEADER_OFFSET, 0)
    window.scrollTo({ top, behavior: latest.current.reduce ? 'auto' : 'smooth' })
    await scrollSettled()
    pulseElement(el, latest.current.reduce)
  }, [])

  const go = useCallback(
    (detail: GoDetail) => {
      const entry = detail.key ? entryByKey(detail.key) : undefined
      if (entry) {
        try {
          window.sessionStorage.setItem(RECENT_KEY, JSON.stringify(pushRecent(recentList(window.sessionStorage.getItem(RECENT_KEY)), entry.key)))
        } catch {
          // Storage blocked: «недавно» stays empty, nothing else changes.
        }
        const plan = goPlan(entry, latest.current.pathname, latest.current.locale)
        if (plan.navigate) {
          pending.current = detail
          router.push(plan.to)
          return
        }
      }
      void arrive(detail)
    },
    [arrive, router],
  )

  // After a navigation the pending trip continues on the new page.
  useEffect(() => {
    const p = pending.current
    if (!p) return
    const entry = p.key ? entryByKey(p.key) : undefined
    if (entry && !goPlan(entry, pathname, locale).navigate) {
      pending.current = null
      void arrive(p)
    }
  }, [pathname, locale, arrive])

  useEffect(() => {
    const onGo = (e: Event) => go((e as CustomEvent<GoDetail>).detail ?? {})
    const onTour = () => latest.current.startTour()
    window.addEventListener(GUIDE_GO_EVENT, onGo)
    window.addEventListener(GUIDE_TOUR_START_EVENT, onTour)
    return () => {
      window.removeEventListener(GUIDE_GO_EVENT, onGo)
      window.removeEventListener(GUIDE_TOUR_START_EVENT, onTour)
    }
  }, [go])

  // Deep links: `?fira=tour` and `?fira=go:<key>`; the parameter is removed from the address right away.
  useEffect(() => {
    const p = parseFiraParam(window.location.search)
    if (!p) return
    window.history.replaceState(window.history.state, '', withoutFiraParam(window.location.pathname, window.location.search, window.location.hash))
    // No cleanup on purpose: a dev double-mount must not cancel the one trip the address asked for.
    window.setTimeout(() => {
      if (p.type === 'tour') latest.current.startTour()
      else go({ key: p.key })
    }, 500)
  }, [pathname, go])
}
