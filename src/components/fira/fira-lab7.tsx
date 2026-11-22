'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'
import { emotions, type Emotion } from '@/lib/fira/pose'
import { ampAt, bubbleAt, speechTimeline } from '@/lib/fira/turtle'
import { detail7, sheetName7, sheetOrder7, turtles7, type Turtle7 } from '@/lib/fira/turtle7'
import { SpeechBubble, useSpeech } from './fira-turtle'
import { FiraTurtle7 } from './fira-turtle7'

// Round seven lab (default): the owner's reference turtle in four variants on one rig. Views: overview (A B C D
// with captions), solo (?solo=a), row (the emotions of one, ?row=a), sheet (all emotions x four). Controls: emotion
// row named as the owner's sheet, theme, turn/spin, size, talk. ?cap=1 draws the bare view for screenshots.
export type Lab7Query = {
  view: 'overview' | 'solo' | 'row' | 'sheet'
  v: Turtle7
  emotion: Emotion
  size?: number
  clock?: number
  talk: boolean
  spin?: number
  cap: boolean
}
const SAMPLE = 'Здравствуйте, я Фира. Расскажите, что нужно вашему делу, а я соберу план и отвечу на вопросы.'
const order: Emotion[] = [...sheetOrder7, ...emotions.filter((e) => !sheetOrder7.includes(e))]

function useTalk(on: boolean, at?: number) {
  const run = useSpeech(SAMPLE, on && at === undefined)
  if (on && at !== undefined) {
    const tl = speechTimeline(SAMPLE)
    const b = bubbleAt(tl, at)
    return { amp: ampAt(tl, at), words: b.words, opacity: b.opacity, talking: b.talking }
  }
  return run
}

function Overview({ q, size, emotion, follow, spin, talk }: { q: Lab7Query; size: number; emotion: Emotion; follow: boolean; spin?: number; talk: boolean }) {
  const sp = useTalk(talk, q.clock)
  return (
    <div className={cn('grid gap-4', q.cap ? 'grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4')} data-fira-overview="">
      {turtles7.map((v) => (
        <section key={v} className={cn('flex flex-col items-center', !q.cap && 'rounded-card border border-line bg-surface p-4')}>
          <div className="relative" style={{ width: size, height: size }}>
            <FiraTurtle7 variant={v} emotion={sp.talking ? 'talking' : emotion} size={size} clock={q.clock} mouth={talk ? sp.amp : undefined} spin={spin} lookAt={follow} label={detail7[v].name} />
            {talk ? <div className="pointer-events-none absolute left-0 top-0 z-10"><SpeechBubble text={SAMPLE} shown={sp.words} opacity={sp.opacity} className="!max-w-[12rem] !text-[12px]" /></div> : null}
          </div>
          <h2 className="mt-2 font-display text-lg font-semibold">{detail7[v].name}</h2>
          <p className="mt-1 max-w-[32ch] text-center text-sm text-muted" data-fira-caption={v}>{detail7[v].caption}</p>
        </section>
      ))}
    </div>
  )
}

function Row({ v, size, clock, follow }: { v: Turtle7; size: number; clock?: number; follow: boolean }) {
  return (
    <div className="flex flex-nowrap gap-1" data-fira-row={v}>
      {order.map((e) => (
        <div key={e} className="flex flex-col items-center">
          <FiraTurtle7 variant={v} emotion={e} size={size} clock={clock ?? 0.6} mouth={e === 'talking' ? 0.55 : undefined} lookAt={follow && e !== 'sleep'} label={`${detail7[v].name}: ${sheetName7[e]}`} />
          <span className="-mt-3 text-xs text-muted" data-fira-emotion={e}>{sheetName7[e]}</span>
        </div>
      ))}
    </div>
  )
}

function TalkSolo({ v, size, emotion, clock, spin, follow, talk }: { v: Turtle7; size: number; emotion: Emotion; clock?: number; spin?: number; follow: boolean; talk: boolean }) {
  const [ready, setReady] = useState(false)
  const sp = useTalk(talk && (ready || clock !== undefined), clock)
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <FiraTurtle7 onReady={() => setReady(true)} variant={v} emotion={sp.talking ? 'talking' : emotion} size={size} mouth={talk ? sp.amp : undefined} clock={clock} spin={spin} lookAt={follow} label={detail7[v].name} />
      {talk ? <div className="absolute left-[4%] top-[6%] z-10"><SpeechBubble text={SAMPLE} shown={sp.words} opacity={sp.opacity} /></div> : null}
    </div>
  )
}

export function FiraLab7({ query: q }: { query: Lab7Query }) {
  const [emotion, setEmotion] = useState<Emotion>(q.emotion)
  const [follow, setFollow] = useState(true)
  const [spin, setSpin] = useState<number | undefined>(q.spin)
  const [size, setSize] = useState(q.size ?? 320)
  const [view, setView] = useState<Lab7Query['view']>(q.view)
  const [v, setV] = useState<Turtle7>(q.v)
  const [talk, setTalk] = useState(q.talk)
  const sz = q.size ?? size
  const setTheme = (t: 'light' | 'dark') => {
    document.documentElement.dataset.theme = t
    document.documentElement.style.colorScheme = t
  }

  const body =
    view === 'row' ? <Row v={v} size={q.cap ? sz : 150} clock={q.clock} follow={follow && !q.cap} />
    : view === 'sheet' ? <div className="flex flex-col gap-1">{turtles7.map((t) => <Row key={t} v={t} size={q.cap ? sz : 110} clock={q.clock} follow={false} />)}</div>
    : view === 'solo' ? <TalkSolo v={v} size={sz} emotion={emotion} clock={q.clock} spin={spin} follow={follow && !q.cap} talk={talk} />
    : <Overview q={q} size={q.cap ? sz : size} emotion={emotion} follow={follow && !q.cap} spin={spin} talk={talk} />

  if (q.cap) return <div className="fixed inset-0 z-[200] grid place-items-center overflow-hidden bg-bg" data-fira-capture="">{body}</div>

  const views: [Lab7Query['view'], string][] = [['overview', 'Четыре рядом'], ['solo', 'Одна'], ['row', 'Ряд эмоций'], ['sheet', 'Все эмоции']]
  const pill = (on: boolean) => cn('rounded-full border px-4 py-2 text-sm transition-colors duration-150 ease-out', on ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-fg hover:bg-surface-2')
  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pt-28 pb-24 sm:px-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Фира: раунд 7, по референсам владельца</h1>
      <p className="mt-2 max-w-[70ch] text-muted">
        Один скелет, четыре набора с листа аксессуаров: A базовая, B наушники, C очки, D ноутбук и очки. Широкая приплюснутая голова,
        полуприкрытые глаза, кремовое брюшко с шестью сегментами, бирюзовый панцирь по бокам, короткие руки, тонкий тёмный контур.
        Лицом к вам, дышит, моргает, тело поворачивается к курсору. Прежние раунды:{' '}
        <a className="underline" href="?round=6">6</a>, <a className="underline" href="?round=5">5</a>, <a className="underline" href="?round=4">4</a>, <a className="underline" href="?round=3">3</a>.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-2" role="group" aria-label="Вид">
        {views.map(([k, l]) => <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)} className={pill(view === k)}>{l}</button>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Эмоция">
        {order.map((e) => <button key={e} type="button" aria-pressed={emotion === e} onClick={() => setEmotion(e)} className={pill(emotion === e)}>{sheetName7[e]}</button>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setTheme('light')} className={pill(false)}>Светлая</button>
        <button type="button" onClick={() => setTheme('dark')} className={pill(false)}>Тёмная</button>
        <label className="flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm"><input type="checkbox" checked={talk} onChange={(e) => setTalk(e.target.checked)} />Говорит</label>
        <label className="flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm"><input type="checkbox" checked={spin !== undefined} onChange={(e) => setSpin(e.target.checked ? 0.6 : undefined)} />Вращать</label>
        <label className="flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm"><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />Следит за курсором</label>
        <label className="flex items-center gap-3 text-sm">Размер<input type="range" min={180} max={560} step={10} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Размер" /><span className="font-mono text-xs text-muted tabular-nums">{size}</span></label>
      </div>
      {view === 'solo' || view === 'row' ? (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Черепашка">
          {turtles7.map((t) => <button key={t} type="button" aria-pressed={v === t} onClick={() => setV(t)} className={pill(v === t)}>{detail7[t].name}</button>)}
        </div>
      ) : null}
      {view === 'solo' ? <p className="mt-3 max-w-[70ch] text-sm text-muted">{detail7[v].caption}</p> : null}
      <div className="mt-8 overflow-x-auto"><div className={cn(view === 'solo' ? 'mx-auto w-fit' : '')}>{body}</div></div>
    </div>
  )
}
