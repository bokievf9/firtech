import { JetBrains_Mono, Manrope } from 'next/font/google'

// Design v5 (docs/design-system-v5.md): one family for text, display and the wordmark. Manrope is a
// variable font with Cyrillic, so the headline pattern can run at weight 300 next to 800.
export const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
})

export const jetbrains = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500'],
  display: 'swap',
})
