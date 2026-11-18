import { Geologica, JetBrains_Mono, Onest, Unbounded } from 'next/font/google'

// Onest was drawn for Cyrillic first, so Russian text looks as good as English.
export const onest = Onest({
  variable: '--font-onest',
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
})

export const jetbrains = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500'],
  display: 'swap',
})

// Brand face: only the "fir.tech" wordmark (Fir from the founder's name, lime dot).
export const unbounded = Unbounded({
  variable: '--font-unbounded',
  subsets: ['latin', 'cyrillic'],
  weight: '700',
  display: 'swap',
})

// Display face (stage A of the site refresh, 2026-11): the hero headline and section titles.
// Geologica is a variable grotesk drawn with Cyrillic in mind; its sharpness axis (SHRP) gives the
// headline a cut, technical edge without a second family. Onest stays the text face.
export const geologica = Geologica({
  variable: '--font-geologica',
  subsets: ['latin', 'cyrillic'],
  axes: ['SHRP'],
  display: 'swap',
})
