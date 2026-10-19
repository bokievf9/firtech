'use client'

import { Moon, Sun } from '@phosphor-icons/react'
import { useSyncExternalStore } from 'react'
import { admin } from '@/content/admin'

const KEY = 'firtech-admin-theme'
const listeners = new Set<() => void>()
const read = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => void listeners.delete(onChange)
}

// Dark by default; the choice is stored in this browser only. The inline script in the admin
// layout applies it before the first paint, this button only changes it afterwards.
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => 'dark')
  const light = theme === 'light'

  function toggle() {
    const next = light ? 'dark' : 'light'
    if (next === 'light') document.documentElement.dataset.theme = 'light'
    else delete document.documentElement.dataset.theme
    try {
      localStorage.setItem(KEY, next)
    } catch {}
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', next === 'light' ? '#eef1ea' : '#0a0d0b')
    listeners.forEach((l) => l())
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={light ? admin.pulse.theme.toDark : admin.pulse.theme.toLight}
      title={light ? admin.pulse.theme.toDark : admin.pulse.theme.toLight}
      className="grid size-11 shrink-0 place-items-center rounded-full border border-line text-muted transition-colors hover:text-fg"
    >
      {light ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
    </button>
  )
}
