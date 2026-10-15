import { JetBrains_Mono, Onest } from 'next/font/google'

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
