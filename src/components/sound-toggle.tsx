'use client'

import { SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'
import { toggleSound, useSound } from '@/lib/sound'

export type SoundCopy = { label: string; on: string; off: string }

// Speaker button (header right group on lg+, item in the phone menu). Off by default; turning it on
// is the user gesture that will unlock audio. The label names the state the click switches to.
export function SoundToggle({ copy, className, withLabel = false }: { copy: SoundCopy; className?: string; withLabel?: boolean }) {
  const on = useSound()
  return (
    <button
      type="button"
      onClick={toggleSound}
      aria-pressed={on}
      aria-label={copy.label}
      title={`${copy.label}: ${on ? copy.on : copy.off}`}
      data-sound-toggle
      className={cn(
        'pressable inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-fill text-muted hover:bg-fill-strong hover:text-fg',
        withLabel ? 'h-11 px-4 text-callout' : 'size-9',
        on && 'text-accent-text',
        className,
      )}
    >
      {on ? <SpeakerHigh size={17} aria-hidden="true" /> : <SpeakerSlash size={17} aria-hidden="true" />}
      {withLabel ? <span>{on ? copy.on : copy.off}</span> : null}
    </button>
  )
}
