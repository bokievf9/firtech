'use client'

import { CaretUp } from '@phosphor-icons/react'
import { useState, useSyncExternalStore, type ComponentProps } from 'react'
import { EchoConsole } from '@/components/admin/echo-console'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'

const t = admin.pulse

// Squeezes the full Echo console into one column: no side panels, a lower orb, so the orb and the
// input fit the middle of the one-screen layout. Only wrapper classes; the console is not changed.
const fit = [
  '[&>div>div]:!grid-cols-1',
  '[&>div>div>div:first-child]:hidden',
  '[&>div>div>div:last-child]:hidden',
  '[&>div>div>div:nth-child(2)]:!col-span-1',
  '[&_.hud-stage>canvas]:!aspect-auto',
  '[&_.hud-stage>canvas]:!h-[clamp(7rem,19dvh,15rem)]',
].join(' ')

const desktopQuery = '(min-width: 1024px)'
function useDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(desktopQuery)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    () => window.matchMedia(desktopQuery).matches,
    () => false,
  )
}

// Desktop: the console sits in the middle column and scrolls inside it if the screen is short.
// Phone: a bar fixed to the bottom that expands into a sheet; the console stays mounted, so a
// conversation in progress survives collapsing.
export function EchoDock(props: ComponentProps<typeof EchoConsole>) {
  const [open, setOpen] = useState(false)
  const desktop = useDesktop()
  return (
    <div
      className={cn(
        'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:rounded-t-card max-lg:border-t max-lg:border-line-strong max-lg:bg-surface max-lg:shadow-[0_-12px_40px_rgb(0_0_0/0.5)]',
        'lg:h-full lg:min-h-0',
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="pulse-echo"
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-full items-center justify-between gap-3 px-5 text-left lg:hidden"
      >
        <span className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]"
          />
          <span className="font-brand text-sm font-bold tracking-tight">Echo</span>
          <span className="text-sm text-muted">{open ? t.echoClose : t.echoHint}</span>
        </span>
        <CaretUp
          size={18}
          aria-hidden="true"
          className={cn(
            'text-muted transition-transform duration-200 motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
      </button>
      <div
        id="pulse-echo"
        inert={!open && !desktop ? true : undefined}
        className={cn(
          'grid duration-300 ease-[var(--ease-out-expo)] motion-reduce:transition-none',
          'max-lg:overflow-hidden max-lg:transition-[grid-template-rows,visibility]',
          !open && 'max-lg:invisible',
          open ? 'max-lg:grid-rows-[1fr]' : 'max-lg:grid-rows-[0fr]',
          'lg:h-full lg:grid-rows-[1fr]',
        )}
      >
        <div
          className={cn(
            'min-h-0 max-lg:max-h-[calc(82dvh-3.5rem)] max-lg:overflow-y-auto',
            'lg:overflow-y-auto',
            fit,
          )}
        >
          <div className="max-lg:px-3 max-lg:pb-4">
            <EchoConsole {...props} />
          </div>
        </div>
      </div>
    </div>
  )
}
