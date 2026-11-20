'use client'

import { useServerInsertedHTML } from 'next/navigation'
import { useEffect } from 'react'
import { THEME_KEY, themeColor } from '@/lib/site-theme'

// Same rule as resolveTheme in lib/theme.ts: the stored choice (read first) wins, else the system
// scheme. It also follows system changes while nothing is stored.
export const themeScript = `(function(){var d=document.documentElement,K='${THEME_KEY}';function s(){try{var v=localStorage.getItem(K);return v==='dark'||v==='light'?v:null}catch(e){return null}}function q(){try{return window.matchMedia('(prefers-color-scheme: dark)')}catch(e){return null}}function a(){var t=s(),m=q();if(!t)t=m&&m.matches?'dark':'light';d.dataset.theme=t;var c=document.querySelector('meta[name="theme-color"]');if(c)c.setAttribute('content',t==='dark'?'${themeColor.dark}':'${themeColor.light}')}a();var m=q();if(m&&m.addEventListener)m.addEventListener('change',function(){if(!s())a()})})()`

// Puts the theme script into the server HTML only (it never re-renders on the client, so React
// does not warn about a script tag). It runs before the first paint, so there is no flash.
//
// When a page answers with notFound() after its data is fetched (the payment page, a wrong invoice),
// Next renders an error shell first and the client takes over without the server-inserted script,
// so `<html>` ended up with no data-theme (a dark visitor saw the light page, tests/e2e). The effect
// runs the same script once when the attribute is missing.
export function ThemeInit() {
  useServerInsertedHTML(() => <script dangerouslySetInnerHTML={{ __html: themeScript }} />)
  useEffect(() => {
    if (!document.documentElement.dataset.theme) new Function(themeScript)()
  }, [])
  return null
}
