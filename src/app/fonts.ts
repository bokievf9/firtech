import { JetBrains_Mono, Onest, Unbounded } from 'next/font/google'

// Onest was drawn for Cyrillic first, so Russian headlines look as good as English ones.
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

// Brand wordmark only ("fir.tech"): Fir from the founder's name, set in Unbounded with a lime dot.
export const unbounded = Unbounded({
  variable: '--font-unbounded',
  subsets: ['latin'],
  weight: '700',
  display: 'swap',
})
