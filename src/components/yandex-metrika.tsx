'use client'

import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { useEffect, useRef } from 'react'
import { hitUrl, metrikaAllowed, metrikaInitScript, track, trackHit, ymId } from '@/lib/analytics'

const id = ymId()

// Official Metrika tag, loaded only when NEXT_PUBLIC_YM_ID is set and only on public pages
// (`metrikaAllowed`: never the cabinet, payment, demo or unsubscribe pages, security 2026-11-23 P1-7).
// The first view is sent by the init script without the query; later client-side route changes are sent
// as hits, also without the query. Only the pathname is watched: the builder rewrites ?b= on every
// click and that is not a new page. Moving into a private page sets `disableYaCounter<id>`, so the
// already loaded tag sends nothing there (clicks, links) until the visitor is back on a public page.
export function YandexMetrika() {
  const pathname = usePathname()
  const allowed = metrikaAllowed(pathname)
  const last = useRef<string | null>(null)

  useEffect(() => {
    if (!id) return
    ;(window as unknown as Record<string, unknown>)[`disableYaCounter${id}`] = !allowed
    if (!allowed) return
    const url = hitUrl(window.location.href)
    if (last.current !== null && last.current !== url) trackHit(url, last.current)
    last.current = url
  }, [pathname, allowed])

  // Telegram links and the main buttons live in server components too; one listener counts them
  // all. A Telegram link's data-place says where it was (footer, contact, mobile-cta); a button's
  // data-cta names it.
  useEffect(() => {
    if (!id) return
    function onClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element) || !metrikaAllowed(window.location.pathname)) return
      const link = target.closest('a[href^="https://t.me/"]')
      if (link instanceof HTMLAnchorElement) {
        track('telegram_click', { place: link.dataset.place ?? 'other' })
      }
      const cta = target.closest<HTMLElement>('[data-cta]')
      if (cta?.dataset.cta) track('cta_click', { place: cta.dataset.cta })
    }
    document.addEventListener('click', onClick, { capture: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [])

  if (!id || !allowed) return null
  return (
    <>
      <Script id="yandex-metrika" strategy="afterInteractive">
        {metrikaInitScript(id)}
      </Script>
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- tracking pixel, not content */}
          <img
            src={`https://mc.yandex.ru/watch/${id}`}
            style={{ position: 'absolute', left: '-9999px' }}
            alt=""
          />
        </div>
      </noscript>
    </>
  )
}
