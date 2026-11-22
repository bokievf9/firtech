'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'
import { allContexts, contextById } from '@/lib/fira/contexts'
import { emotions, type Emotion } from '@/lib/fira/pose'
import { ampAt, bubbleAt, speechTimeline } from '@/lib/fira/turtle'
import { detail5, turtles5, type Turtle5 } from '@/lib/fira/turtle5'
import { emotionLabel } from './fira-lab'
import { SpeechBubble, useSpeech } from './fira-turtle'
import { FiraTurtle5 } from './fira-turtle5'

// Round five lab (default): the standing turtle in four variants on one rig. Views: overview (R S T U side
// by side), solo (?solo=r), row (all emotions of one, ?row=r), sheet (all emotions x four). Controls: emotion
// row, page context (tints the lamps of T), turn/spin, size, talk. ?cap=1 draws the bare view for screenshots.
export type Lab5Query = {
  view: 'overview' | 'solo' | 'row' | 'sheet'
  v: Turtle5
  emotion: Emotion
  size?: number
  clock?: number
  talk: boolean
  spin?: number
  ctx?: string
  cap: boolean
}
const SAMPLE = 'Здравствуйте, я Фира. Расскажите, что нужно вашему делу, а я соберу план и отвечу на вопросы.'

function useTalk(on: boolean, at?: number) {
  const run = useSpeech(SAMPLE, on && at === undefined)
  if (on && at !== undefined) {
    const tl = speechTimeline(SAMPLE)
    const b = bubbleAt(tl, at)
    return { amp: ampAt(tl, at), words: b.words, opacity: b.opacity, talking: b.talking }
  }
  return run
}

function Overview({ q, size, emotion, follow, spin, ctx, talk }: { q: Lab5Query; size: number; emotion: Emotion; follow: boolean; spin?: number; ctx?: string; talk: boolean }) {
  const sp = useTalk(talk, q.clock)
  return (
    <div className={cn('grid gap-4', q.cap ? 'grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4')} data-fira-overview="">
      {turtles5.map((v) => (
        <section key={v} className={cn('flex flex-col items-center', !q.cap && 'rounded-card border border-line bg-surface p-4')}>
          <div className="relative" style={{ width: size, height: size }}>
            <FiraTurtle5 variant={v} emotion={sp.talking ? 'talking' : emotion} size={size} clock={q.clock} mouth={talk ? sp.amp : undefined} spin={spin} lookAt={follow} ctx={ctx} label={detail5[v].name} />
            {talk ? <div className="pointer-events-none absolute left-0 top-0 z-10"><SpeechBubble text={SAMPLE} shown={sp.words} opacity={sp.opacity} className="!max-w-[12rem] !text-[12px]" /></div> : null}
          </div>
          <h2 className="mt-2 font-display text-lg font-semibold">{detail5[v].name}</h2>
          <p className="mt-1 max-w-[32ch] text-center text-sm text-muted" data-fira-caption={v}>{detail5[v].caption}</p>
        </section>
      ))}
    </div>
  )
}

function Row({ v, size, clock, follow }: { v: Turtle5; size: number; clock?: number; follow: boolean }) {
  return (
    <div className="flex flex-nowrap gap-1" data-fira-row={v}>
      {emotions.map((e) => (
        <div key={e} className="flex flex-col items-center">
          <FiraTurtle5 variant={v} emotion={e} size={size} clock={clock ?? 0.6} mouth={e === 'talking' ? 0.55 : undefined} lookAt={follow && e !== 'sleep'} label={`${detail5[v].name}: ${emotionLabel[e]}`} />
          <span className="-mt-3 text-xs text-muted">{emotionLabel[e]}</span>
        </div>
      ))}
    </div>
  )
}

function TalkSolo({ v, size, emotion, clock, spin, follow, ctx, talk }: { v: Turtle5; size: number; emotion: Emotion; clock?: number; spin?: number; follow: boolean; ctx?: string; talk: boolean }) {
  const [ready, setReady] = useState(false)
  const sp = useTalk(talk && (ready || clock !== undefined), clock)
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <FiraTurtle5 onReady={() => setReady(true)} variant={v} emotion={sp.talking ? 'talking' : emotion} size={size} mouth={talk ? sp.amp : undefined} clock={clock} spin={spin} lookAt={follow} ctx={ctx} label={detail5[v].name} />
      {talk ? <div className="absolute left-[4%] top-[6%] z-10"><SpeechBubble text={SAMPLE} shown={sp.words} opacity={sp.opacity} /></div> : null}
    </div>
  )
}

export function FiraLab5({ query: q }: { query: Lab5Query }) {
  const [emotion, setEmotion] = useState<Emotion>(q.emotion)
  const [ctx, setCtx] = useState<string | undefined>(q.ctx)
  const [follow, setFollow] = useState(true)
  const [spin, setSpin] = useState<number | undefined>(q.spin)
  const [size, setSize] = useState(q.size ?? 320)
  const [view, setView] = useState<Lab5Query['view']>(q.view)
  const [v, setV] = useState<Turtle5>(q.v)
  const [talk, setTalk] = useState(q.talk)
  const sz = q.size ?? size

  const body =
    view === 'row' ? <Row v={v} size={q.cap ? sz : 150} clock={q.clock} follow={follow && !q.cap} />
    : view === 'sheet' ? <div className="flex flex-col gap-1">{turtles5.map((t) => <Row key={t} v={t} size={q.cap ? sz : 110} clock={q.clock} follow={false} />)}</div>
    : view === 'solo' ? <TalkSolo v={v} size={sz} emotion={emotion} clock={q.clock} spin={spin} follow={follow && !q.cap} ctx={ctx} talk={talk} />
    : <Overview q={q} size={q.cap ? sz : size} emotion={emotion} follow={follow && !q.cap} spin={spin} ctx={ctx} talk={talk} />

  if (q.cap) return <div className="fixed inset-0 z-[200] grid place-items-center overflow-hidden bg-bg" data-fira-capture="">{body}</div>

  const views: [Lab5Query['view'], string][] = [['overview', 'Четыре рядом'], ['solo', 'Одна'], ['row', 'Ряд эмоций'], ['sheet', 'Все эмоции']]
  const pill = (on: boolean) => cn('rounded-full border px-4 py-2 text-sm transition-colors duration-150 ease-out', on ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-fg hover:bg-surface-2')
  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pt-28 pb-24 sm:px-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Фира: раунд 5, стоящая черепашка</h1>
      <p className="mt-2 max-w-[70ch] text-muted">
        Один скелет, четыре изюминки: R очки, S наушники, T светящиеся секции панциря, U очки с наушниками. Везде салатовая жемчужина на панцире.
        Глаза и брови играют эмоцию, поза спокойная. Светлая и тёмная тема в шапке сайта. Прежние раунды: <a className="underline" href="?round=4">раунд 4</a>, <a className="underline" href="?round=3">раунд 3</a>.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-2" role="group" aria-label="Вид">
        {views.map(([k, l]) => <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)} className={pill(view === k)}>{l}</button>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Эмоция">
        {emotions.map((e) => <button key={e} type="button" aria-pressed={emotion === e} onClick={() => setEmotion(e)} className={pill(emotion === e)}>{emotionLabel[e]}</button>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={ctx ?? ''} aria-label="Контекст страницы" onChange={(e) => { const c = contextById(e.target.value); setCtx(c?.id); if (c) setEmotion(c.emotion) }} className="rounded-full border border-line-strong bg-bg px-4 py-2 text-sm">
          <option value="">Контекст страницы (красит лампы T)</option>
          {allContexts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <label className="flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm"><input type="checkbox" checked={talk} onChange={(e) => setTalk(e.target.checked)} />Говорит</label>
        <label className="flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm"><input type="checkbox" checked={spin !== undefined} onChange={(e) => setSpin(e.target.checked ? 0.6 : undefined)} />Вращать</label>
        <label className="flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm"><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />Следит за курсором</label>
        <label className="flex items-center gap-3 text-sm">Размер<input type="range" min={180} max={560} step={10} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Размер" /><span className="font-mono text-xs text-muted tabular-nums">{size}</span></label>
      </div>
      {view === 'solo' || view === 'row' ? (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Черепашка">
          {turtles5.map((t) => <button key={t} type="button" aria-pressed={v === t} onClick={() => setV(t)} className={pill(v === t)}>{detail5[t].name}</button>)}
        </div>
      ) : null}
      {view === 'solo' ? <p className="mt-3 max-w-[70ch] text-sm text-muted">{detail5[v].caption}</p> : null}
      <div className="mt-8 overflow-x-auto"><div className={cn(view === 'solo' ? 'mx-auto w-fit' : '')}>{body}</div></div>
    </div>
  )
}
