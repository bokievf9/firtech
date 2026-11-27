import type { Dict } from '@/content'
import type { Locale } from '@/lib/i18n'
import { Palette } from './palette'
import { ProgressLine } from './progress-line'
import { SectionRail } from './section-rail'
import { SectionSheet } from './section-sheet'
import { SectionTracker } from './section-tracker'

// The navigation layer, mounted once in the locale layout next to the Header (docs/motion-storyboard.md §3):
// the tracker (one writer of the section store), the desktop rail, the phone progress line with its
// section sheet, and the palette. Only the small `rail` and `palette` dictionary slices cross to the client.
export function NavLayer({ locale, dict }: { locale: Locale; dict: Dict }) {
  return (
    <>
      <SectionTracker locale={locale} rail={dict.rail} />
      <SectionRail rail={dict.rail} />
      <ProgressLine rail={dict.rail} />
      <SectionSheet rail={dict.rail} />
      <Palette locale={locale} copy={dict.palette} rail={dict.rail} />
    </>
  )
}
