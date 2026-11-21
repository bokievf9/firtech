import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FiraLab, type Capture } from '@/components/fira/fira-lab'
import { isEmotion, isVariant, type Emotion } from '@/lib/fira/pose'
import { isLocale } from '@/lib/i18n'

// Hidden concept lab for the Fira mascot: noindex, not in the sitemap or the localePages list.
export const metadata: Metadata = {
  title: 'Fira lab',
  robots: { index: false, follow: false, nocache: true },
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

function parseCapture(sp: Record<string, string | string[] | undefined>): Capture | null {
  const solo = one(sp.solo)
  const sheet = one(sp.sheet)
  if (!isVariant(solo) && !isVariant(sheet)) return null
  const emo = one(sp.emotion)
  const size = Math.min(1200, Math.max(120, Number(one(sp.size)) || 800))
  const clockRaw = one(sp.clock)
  const seq = (one(sp.seq) ?? '')
    .split(',')
    .map((p) => p.split(':'))
    .filter((p): p is [Emotion, string] => isEmotion(p[0]))
    .map(([emotion, sec]) => ({ emotion, sec: Math.min(10, Math.max(0.2, Number(sec) || 1)) }))
  const spin = Number(one(sp.spin))
  return {
    solo: isVariant(solo) ? solo : null,
    sheet: isVariant(sheet) ? sheet : null,
    spin: Number.isFinite(spin) && spin > 0 ? Math.min(spin, 6) : undefined,
    emotion: isEmotion(emo) ? emo : 'idle',
    size,
    seq: seq.length ? seq : null,
    clock: clockRaw === undefined ? undefined : Number(clockRaw) || 0,
  }
}

export default async function FiraLabPage({ params, searchParams }: PageProps<'/[locale]/fira-lab'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const sp = await searchParams
  return <FiraLab capture={parseCapture(sp)} all={one(sp.all) === '1'} />
}
