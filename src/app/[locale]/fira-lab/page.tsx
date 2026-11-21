import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FiraLab, type Capture } from '@/components/fira/fira-lab'
import { FiraLab4, type Lab4Query } from '@/components/fira/fira-lab4'
import { isEmotion, isVariant, type Emotion } from '@/lib/fira/pose'
import { isLocale } from '@/lib/i18n'
import { isAccessory, isEventKind, isTurtle } from '@/lib/fira/turtle'

// Hidden concept lab for the Fira mascot: noindex, not in the sitemap or the localePages list.
export const metadata: Metadata = {
  title: 'Fira lab',
  robots: { index: false, follow: false, nocache: true },
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

function parseCapture(sp: Record<string, string | string[] | undefined>): Capture | null {
  const solo = one(sp.solo)
  const sheet = one(sp.sheet)
  const row = one(sp.row)
  if (!isVariant(solo) && !isVariant(sheet) && !isVariant(row)) return null
  const emo = one(sp.emotion)
  const size = Math.min(1200, Math.max(120, Number(one(sp.size)) || (isVariant(row) ? 160 : 800)))
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
    row: isVariant(row) ? row : null,
    spin: Number.isFinite(spin) && spin > 0 ? Math.min(spin, 6) : undefined,
    emotion: isEmotion(emo) ? emo : 'idle',
    size,
    seq: seq.length ? seq : null,
    clock: clockRaw === undefined ? undefined : Number(clockRaw) || 0,
  }
}

// Round four (?round=4): the turtles. ?solo=n, ?row=n, ?sheet=1, ?acc=laptop, ?ctx=chat, ?talk=1, ?spin=1,
// ?event=lead; ?cap=1 draws the bare view for screenshots, &clock= fixes the time.
function parseLab4(sp: Record<string, string | string[] | undefined>): Lab4Query {
  const lower = (k: string) => one(sp[k])?.toLowerCase()
  const views = ['overview', 'solo', 'row', 'sheet', 'acc', 'ctx', 'talk'] as const
  const asView = lower('view')
  const solo = lower('solo')
  const row = lower('row')
  const acc = one(sp.acc)
  const emo = one(sp.emotion)
  const spin = Number(one(sp.spin))
  const clock = one(sp.clock)
  const size = Number(one(sp.size))
  const ev = one(sp.event)
  let view: Lab4Query['view'] = (views as readonly string[]).includes(asView ?? '') ? (asView as Lab4Query['view']) : 'overview'
  if (isTurtle(solo)) view = 'solo'
  else if (isTurtle(row)) view = 'row'
  else if (one(sp.sheet) === '1') view = 'sheet'
  else if (one(sp.talk) === '1' && view === 'overview' && isTurtle(lower('v'))) view = 'talk'
  const v = [solo, row, lower('v')].find(isTurtle) ?? 'n'
  return {
    view,
    v,
    acc: isAccessory(acc) ? acc : undefined,
    ctx: one(sp.ctx),
    emotion: isEmotion(emo) ? emo : 'idle',
    size: Number.isFinite(size) && size >= 100 ? Math.min(size, 1200) : undefined,
    clock: clock === undefined ? undefined : Number(clock) || 0,
    event: isEventKind(ev) ? ev : undefined,
    talk: one(sp.talk) === '1',
    spin: Number.isFinite(spin) && spin > 0 ? Math.min(spin, 6) : undefined,
    cap: one(sp.cap) === '1',
  }
}

export default async function FiraLabPage({ params, searchParams }: PageProps<'/[locale]/fira-lab'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const sp = await searchParams
  if (one(sp.round) === '4') return <FiraLab4 query={parseLab4(sp)} />
  return <FiraLab capture={parseCapture(sp)} all={one(sp.all) === '1'} />
}
