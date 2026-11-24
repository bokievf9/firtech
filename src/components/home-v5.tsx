import type { ReactNode } from 'react'

// Design v5 helpers shared by the home sections (R1 ships the real tokens; these use only existing ones).

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

export const displayH2 = 'h-display text-[clamp(32px,3.6vw,48px)] max-w-[22ch]'

export function sectionTitle(title: string): ReactNode {
  return <DisplayTitle>{title}</DisplayTitle>
}

// Primary lime and glass buttons at the large size (56px, pill, 16px/700); R1's ui/button replaces them.
export const limeButton =
  'inline-flex h-14 items-center justify-center gap-2 rounded-full bg-accent px-7 text-base font-bold text-accent-ink shadow-[0_12px_36px_color-mix(in_srgb,var(--color-accent)_45%,transparent)] transition-[transform,background-color] duration-200 hover:bg-accent-strong active:scale-[0.98]'
export const glassButton =
  'inline-flex h-14 items-center justify-center gap-2 rounded-full border border-line bg-material-thin px-7 text-base font-bold text-fg backdrop-blur-md transition-[transform,background-color] duration-200 hover:bg-elevated active:scale-[0.98]'

// The gradient dot of the orbs as a 40px icon holder (optionally with a glyph on it).
export const dotIcon =
  'grid shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff,var(--color-accent)_45%,var(--color-accent-text))] text-accent-ink'
