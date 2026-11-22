'use client'

import { Moon, Sun } from '@phosphor-icons/react'
import { useSyncExternalStore } from 'react'
import { iconBtn } from '@/components/admin/kit'
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
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Storage blocked: the choice lasts for this page view only.
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', next === 'light' ? '#d9dfd0' : '#0a0d0b')
    listeners.forEach((l) => l())
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={light ? admin.pulse.theme.toDark : admin.pulse.theme.toLight}
      title={light ? admin.pulse.theme.toDark : admin.pulse.theme.toLight}
      className={iconBtn}
    >
      {light ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
    </button>
  )
}
