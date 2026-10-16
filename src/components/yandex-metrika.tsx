'use client'

import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { useEffect, useRef } from 'react'
import { track, trackHit, ymId } from '@/lib/analytics'

const id = ymId()

// Official Metrika tag, loaded only when NEXT_PUBLIC_YM_ID is set. The first view is sent by
// "init"; later client-side route changes are sent as hits. Only the pathname is watched: the
// builder rewrites ?b= on every click and that is not a new page.
export function YandexMetrika() {
  const pathname = usePathname()
  const last = useRef<string | null>(null)

  useEffect(() => {
    if (!id) return
    const url = window.location.href
    if (last.current !== null && last.current !== url) trackHit(url, last.current)
    last.current = url
  }, [pathname])

  // Telegram links live in server components too; one listener counts them all. The link's
  // data-place says where it was (footer, contact, mobile-cta).
  useEffect(() => {
    if (!id) return
    function onClick(event: MouseEvent) {
      const target = event.target
      const link = target instanceof Element ? target.closest('a[href^="https://t.me/"]') : null
      if (link instanceof HTMLAnchorElement) {
        track('telegram_click', { place: link.dataset.place ?? 'other' })
      }
    }
    document.addEventListener('click', onClick, { capture: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [])

  if (!id) return null
  return (
    <>
      <Script id="yandex-metrika" strategy="afterInteractive">
        {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(${id},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});`}
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
