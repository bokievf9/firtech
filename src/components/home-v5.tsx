import type { ReactNode } from 'react'

// Design v5 helpers shared by the home sections (tokens and primitives come from the v5 foundation).

// Section h2: `.h-display` (light 300 with a black 800 part). Plain dictionary titles are split in half by
// words, so the second half is the strong one; a one-word title is strong as a whole.
export function DisplayTitle({ children }: { children: string }) {
  const words = children.trim().split(/\s+/)
  if (words.length < 2) return <strong>{children}</strong>
  const at = Math.ceil(words.length / 2)
  return (
    <>
      {words.slice(0, at).join(' ')} <strong>{words.slice(at).join(' ')}</strong>
    </>
  )
}

export const displayH2 = 'h-display h-display-section max-w-[22ch]'

export function sectionTitle(title: string): ReactNode {
  return <DisplayTitle>{title}</DisplayTitle>
}

// The gradient dot of the orbs as a 40px icon holder (optionally with a glyph on it).
export const dotIcon =
  'grid shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff,var(--color-accent)_45%,var(--color-accent-text))] text-accent-ink'
