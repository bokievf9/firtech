'use client'

import { Moon, Sun } from '@phosphor-icons/react'
import { useSyncExternalStore } from 'react'
import { cn } from '@/lib/cn'
import { THEME_KEY, themeColor, type SiteTheme } from '@/lib/site-theme'

const read = (): SiteTheme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

function subscribe(onChange: () => void) {
  // <html data-theme> changes from the switch and from the init script following the system.
  const obs = new MutationObserver(onChange)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => obs.disconnect()
}

export type ThemeSwitchCopy = { light: string; dark: string; toggle: string }

// Sun/moon button. The inline script in the locale layout applies the stored choice (else the system
// scheme) before the first paint; this only changes it afterwards. The label names the theme the click switches to.
export function ThemeSwitch({ copy, className }: { copy: ThemeSwitchCopy; className?: string }) {
  const theme = useSyncExternalStore(subscribe, read, () => 'light' as SiteTheme)
  const dark = theme === 'dark'
  const label = `${copy.toggle}: ${dark ? copy.light : copy.dark}`

  function toggle() {
    const next: SiteTheme = dark ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // Storage blocked: the choice lasts for this page view only.
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor[next])
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      data-theme-switch
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-line-strong hover:text-fg',
        className,
      )}
    >
      {dark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
    </button>
  )
}
