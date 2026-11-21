'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { allContexts, contextById, pageContexts } from '@/lib/fira/contexts'
import { emotions, type Emotion } from '@/lib/fira/pose'
import { accessories, accessoryMeta, ampAt, bubbleAt, eventKinds, eventSpec, speechTimeline, turtleInfo, turtles, type Accessory, type EventKind, type Turtle } from '@/lib/fira/turtle'
import { emotionLabel } from './fira-lab'
import { FiraTurtle, SpeechBubble, useSpeech } from './fira-turtle'

// Round four lab (?round=4): four turtles, accessories, page contexts, speech with a bubble, shell-light
// events. Views: overview, solo (?v=n), row (all emotions of one), sheet (all emotions x four), acc (every
// accessory), ctx (page contexts), talk. ?cap=1 renders the bare view for screenshots and recordings.
export type Lab4Query = {
  view: 'overview' | 'solo' | 'row' | 'sheet' | 'acc' | 'ctx' | 'talk'
  v: Turtle
  acc?: Accessory
  ctx?: string
  emotion: Emotion
  size?: number
  clock?: number
  event?: EventKind
  talk: boolean
  spin?: number
  cap: boolean
}
const SAMPLE = 'Здравствуйте, я Фира. Расскажите, что нужно вашему делу, а я соберу план и отвечу на вопросы.'

function useEventPulse(kind: EventKind | undefined, every = 5000) {
  const [ev, setEv] = useState<{ kind: EventKind; id: number } | null>(kind ? { kind, id: 1 } : null)
  useEffect(() => {
    if (!kind) return
    const id = window.setInterval(() => setEv((e) => ({ kind, id: (e?.id ?? 0) + 1 })), every)
    return () => window.clearInterval(id)
  }, [kind, every])
  return [ev, setEv] as const
}

function Card({ v, emotion, acc, size, clock, event, mouth, lights, spin, follow = true, bubble, label }: {
  v: Turtle; emotion: Emotion; acc?: Accessory; size: number; clock?: number; event?: { kind: EventKind; id: number } | null; mouth?: number; lights?: 'talk'
  spin?: number; follow?: boolean; bubble?: { text: string; shown: number; opacity: number }; label: string
}) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <FiraTurtle variant={v} emotion={emotion} acc={acc} size={size} clock={clock} event={event} mouth={mouth} lights={lights} spin={spin} lookAt={follow} label={label} />
      {bubble ? <div className="pointer-events-none absolute left-0 top-0 z-10"><SpeechBubble text={bubble.text} shown={bubble.shown} opacity={bubble.opacity} className="!max-w-[13rem] !text-[13px]" /></div> : null}
    </div>
  )
}

// A still speech frame at a fixed time (for screenshots) or a running loop.
function useTalk(text: string, on: boolean, at?: number) {
  const run = useSpeech(text, on && at === undefined)
  if (on && at !== undefined) {
    const tl = speechTimeline(text)
    const b = bubbleAt(tl, at)
    return { amp: ampAt(tl, at), words: b.words, opacity: b.opacity, talking: b.talking }
  }
  return run
}

function Overview({ q, size, emotion, acc, follow, ev }: { q: Lab4Query; size: number; emotion: Emotion; acc?: Accessory; follow: boolean; ev: { kind: EventKind; id: number } | null }) {
  const sp = useTalk(SAMPLE, q.talk, q.clock)
  return (
    <div className={cn('grid gap-4', q.cap ? 'grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4')}>
      {turtles.map((v) => (
        <section key={v} className={cn('flex flex-col items-center', !q.cap && 'rounded-card border border-line bg-surface p-4')}>
          <Card v={v} emotion={sp.talking ? 'talking' : emotion} acc={acc} size={size} clock={q.clock} event={ev} mouth={q.talk ? sp.amp : undefined} lights={sp.talking ? 'talk' : undefined} spin={q.spin} follow={follow}
            bubble={q.talk ? { text: SAMPLE, shown: sp.words, opacity: sp.opacity } : undefined} label={turtleInfo[v].name} />
          <h2 className="mt-2 font-display text-lg font-semibold">{turtleInfo[v].name}</h2>
          <p className="mt-1 max-w-[30ch] text-center text-sm text-muted">{turtleInfo[v].line}</p>
        </section>
      ))}
    </div>
  )
}

function Row({ v, size, clock, follow }: { v: Turtle; size: number; clock?: number; follow: boolean }) {
  return (
    <div className="flex flex-nowrap gap-1" data-fira-row={v}>
      {emotions.map((e) => (
        <div key={e} className="flex flex-col items-center">
          <Card v={v} emotion={e} size={size} clock={clock ?? 0.6} mouth={e === 'talking' ? 0.55 : undefined} follow={follow && e !== 'sleep'} label={`${turtleInfo[v].name}: ${emotionLabel[e]}`} />
          <span className="-mt-3 text-xs text-muted">{emotionLabel[e]}</span>
        </div>
      ))}
    </div>
  )
}

function AccGrid({ v, size, clock, follow }: { v: Turtle; size: number; clock?: number; follow: boolean }) {
  return (
    <div className="grid grid-cols-5 gap-2" data-fira-acc={v}>
      {accessories.map((a) => (
        <div key={a} className="flex flex-col items-center">
          <Card v={v} emotion="happy" acc={a} size={size} clock={clock ?? 0.7} follow={follow} label={accessoryMeta[a].label} />
          <span className="-mt-4 text-sm text-muted">{accessoryMeta[a].label}{accessoryMeta[a].niche ? ` (${accessoryMeta[a].niche})` : ''}</span>
        </div>
      ))}
    </div>
  )
}

function CtxGrid({ size, clock, follow, v }: { size: number; clock?: number; follow: boolean; v: Turtle }) {
  return (
    <div className="grid grid-cols-4 gap-3" data-fira-ctx="">
      {pageContexts.map((c) => (
        <div key={c.id} className="flex flex-col items-center rounded-card border border-line bg-surface p-2">
          <Card v={c.turtle ?? v} emotion={c.emotion} acc={c.acc} size={size} clock={clock ?? 0.9} event={c.event ? { kind: c.event, id: 1 } : null} follow={follow} label={c.label}
            bubble={{ text: c.line, shown: 999, opacity: 1 }} />
          <span className="mt-1 text-sm font-medium">{c.label}</span>
          <span className="text-xs text-muted">{c.emotion} + {c.acc ?? 'без аксессуара'}</span>
        </div>
      ))}
    </div>
  )
}

function TalkStage({ v, size, emotion, acc, clock, spin }: { v: Turtle; size: number; emotion: Emotion; acc?: Accessory; clock?: number; spin?: number }) {
  const [ready, setReady] = useState(false)
  const sp = useTalk(SAMPLE, ready || clock !== undefined, clock)
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <FiraTurtle onReady={() => setReady(true)} variant={v} emotion={sp.talking ? 'talking' : emotion} acc={acc} size={size} mouth={sp.amp} lights={sp.talking ? 'talk' : undefined} clock={clock} spin={spin} label="Фира говорит" />
      <div className="absolute left-[8%] top-[10%] z-10"><SpeechBubble text={SAMPLE} shown={sp.words} opacity={sp.opacity} /></div>
    </div>
  )
}

export function FiraLab4({ query: q }: { query: Lab4Query }) {
  const ctx = q.ctx ? contextById(q.ctx) : undefined
  const [emotion, setEmotion] = useState<Emotion>(ctx?.emotion ?? q.emotion)
  const [acc, setAcc] = useState<Accessory | undefined>(ctx?.acc ?? q.acc)
  const [follow, setFollow] = useState(true)
  const [size, setSize] = useState(q.size ?? 300)
  const [view, setView] = useState<Lab4Query['view']>(ctx ? 'solo' : q.view)
  const [v, setV] = useState<Turtle>(ctx?.turtle ?? q.v)
  const [talk, setTalk] = useState(q.talk)
  const [ev, setEv] = useEventPulse(q.cap ? undefined : q.event)
  const evStill = q.cap && q.event ? { kind: q.event, id: 1 } : ev
  const qq = { ...q, talk, view }
  const sz = q.size ?? size

  const body =
    view === 'row' ? <Row v={v} size={q.cap ? sz : 150} clock={q.clock} follow={follow && !q.cap} />
    : view === 'sheet' ? (
      <div className="flex flex-col gap-1">{turtles.map((t) => <Row key={t} v={t} size={q.cap ? sz : 120} clock={q.clock} follow={false} />)}</div>
    )
    : view === 'acc' ? <AccGrid v={v} size={q.cap ? sz : 190} clock={q.clock} follow={follow && !q.cap} />
    : view === 'ctx' ? <CtxGrid v={v} size={q.cap ? sz : 260} clock={q.clock} follow={follow && !q.cap} />
    : view === 'talk' ? <TalkStage v={v} size={sz} emotion={emotion} acc={acc} clock={q.clock} spin={q.spin} />
    : view === 'solo' ? (
      <div className="relative">
        <Card v={v} emotion={emotion} acc={acc} size={sz} clock={q.clock} event={evStill} spin={q.spin} follow={follow && !q.cap} label={turtleInfo[v].name}
          bubble={ctx ? { text: ctx.line, shown: 999, opacity: 1 } : undefined} />
      </div>
    )
    : <Overview q={qq} size={q.cap ? sz : size} emotion={emotion} acc={acc} follow={follow && !q.cap} ev={evStill} />

  if (q.cap) {
    return <div className="fixed inset-0 z-[200] grid place-items-center overflow-hidden bg-bg" data-fira-capture="">{body}</div>
  }
  const views: [Lab4Query['view'], string][] = [['overview', 'Четыре рядом'], ['solo', 'Одна'], ['row', 'Ряд эмоций'], ['sheet', 'Все эмоции'], ['acc', 'Аксессуары'], ['ctx', 'Страницы'], ['talk', 'Речь']]
  const pill = (on: boolean) => cn('rounded-full border px-4 py-2 text-sm transition-colors duration-150 ease-out', on ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-fg hover:bg-surface-2')
  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pt-28 pb-24 sm:px-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Фира: раунд 4, черепашка с HQ на панцире</h1>
      <p className="mt-2 max-w-[70ch] text-muted">
        Четыре черепашки: у каждой на панцире экранчики, антенна и огоньки, которые отвечают на события и на голос. Аксессуары, страницы и речь с облачком
        переключаются кнопками. Звука пока нет. Светлая и тёмная тема в шапке сайта. Прежние раунды: <a className="underline" href="?">раунд 3</a>.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-2" role="group" aria-label="Вид">
        {views.map(([k, l]) => <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)} className={pill(view === k)}>{l}</button>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Эмоция">
        {emotions.map((e) => <button key={e} type="button" aria-pressed={emotion === e} onClick={() => setEmotion(e)} className={pill(emotion === e)}>{emotionLabel[e]}</button>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={acc ?? ''} onChange={(e) => setAcc((e.target.value || undefined) as Accessory | undefined)} aria-label="Аксессуар" className="rounded-full border border-line-strong bg-bg px-4 py-2 text-sm">
          <option value="">Без аксессуара</option>
          {accessories.map((a) => <option key={a} value={a}>{accessoryMeta[a].label}</option>)}
        </select>
        <select value={q.ctx ?? ''} aria-label="Контекст страницы" onChange={(e) => { const c = contextById(e.target.value); if (c) { setEmotion(c.emotion); setAcc(c.acc); setView('solo'); if (c.turtle) setV(c.turtle) } }} className="rounded-full border border-line-strong bg-bg px-4 py-2 text-sm">
          <option value="">Контекст страницы</option>
          {allContexts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        {eventKinds.map((k) => <button key={k} type="button" onClick={() => setEv((e) => ({ kind: k, id: (e?.id ?? 0) + 1 }))} className={pill(false)}>{eventSpec[k].label}</button>)}
        <label className="flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm"><input type="checkbox" checked={talk} onChange={(e) => setTalk(e.target.checked)} />Говорит</label>
        <label className="flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm"><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />Следит за курсором</label>
        <label className="flex items-center gap-3 text-sm">Размер<input type="range" min={160} max={520} step={10} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Размер" /><span className="font-mono text-xs text-muted tabular-nums">{size}</span></label>
      </div>
      {view === 'solo' || view === 'talk' || view === 'row' ? (
        <div className="mt-3 flex gap-2" role="group" aria-label="Черепашка">
          {turtles.map((t) => <button key={t} type="button" aria-pressed={v === t} onClick={() => setV(t)} className={pill(v === t)}>{turtleInfo[t].name}</button>)}
        </div>
      ) : null}
      <div className="mt-8 overflow-x-auto"><div className={cn(view === 'solo' || view === 'talk' ? 'mx-auto w-fit' : '')}>{body}</div></div>
    </div>
  )
}
