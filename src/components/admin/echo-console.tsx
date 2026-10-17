'use client'

import {
  Microphone,
  PaperPlaneRight,
  SpeakerHigh,
  SpeakerSlash,
  Stop,
  Waveform,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Hologram } from '@/components/admin/hologram'
import { Sparkline } from '@/components/admin/sparkline'
import type { Goal, Project, Task } from '@/content/control'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import {
  focusOf,
  visibleText,
  type ChatMessage,
  type FocusTarget,
  type Health,
  type EchoState,
  type LeadSummary,
} from '@/lib/echo'

const t = admin.echo

// The browser's speech recognition is still prefixed in Chrome and missing from the DOM types.
type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type RecognitionCtor = new () => Recognition
const recognitionCtor = (): RecognitionCtor | null => {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const statusTone: Record<Task['status'], string> = {
  decide: 'bg-accent shadow-[0_0_10px_var(--color-accent)]',
  check: 'bg-danger',
  todo: 'bg-fg/60',
  ongoing: 'bg-muted',
  later: 'bg-faint/50',
}
const statusOrder: Record<Task['status'], number> = { decide: 0, check: 1, todo: 2, ongoing: 3, later: 4 }

type Line = { role: 'user' | 'assistant' | 'system'; text: string }

const loadPref = (key: string, fallback: boolean) => {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}
// Per-browser switches (voice, dialog mode), read without a hydration mismatch: the server and the
// first render use the default, the saved choice applies right after.
const prefListeners = new Set<() => void>()
function usePref(key: string, fallback: boolean) {
  const value = useSyncExternalStore(
    (onChange) => {
      prefListeners.add(onChange)
      return () => prefListeners.delete(onChange)
    },
    () => loadPref(key, fallback),
    () => fallback,
  )
  const set = (next: boolean) => {
    try {
      localStorage.setItem(key, next ? '1' : '0')
    } catch {}
    prefListeners.forEach((l) => l())
  }
  return [value, set] as const
}

export function EchoConsole({
  projects,
  health,
  tasks,
  goals,
  leads,
  series,
}: {
  projects: Project[]
  health: Health[]
  tasks: Task[]
  goals: Goal[]
  leads: LeadSummary
  series: number[]
}) {
  const [state, setState] = useState<EchoState>('idle')
  const [lines, setLines] = useState<Line[]>([{ role: 'assistant', text: t.greeting }])
  const [draft, setDraft] = useState('')
  const [interim, setInterim] = useState('')
  const [voiceOn, setVoiceOn] = usePref('echo-voice', true)
  const [dialog, setDialog] = usePref('echo-dialog', false)
  const [focused, setFocused] = useState<FocusTarget[]>([])
  const [clock, setClock] = useState('')

  const level = useRef({ current: 0 }).current
  const history = useRef<ChatMessage[]>([])
  const abort = useRef<AbortController | null>(null)
  const recognition = useRef<Recognition | null>(null)
  const audio = useRef<{ stream: MediaStream; ctx: AudioContext; frame: number } | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef(dialog)
  const listenRef = useRef<() => void>(() => {})

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString('ru-RU', { timeZone: 'Asia/Dushanbe' }))
    const first = setTimeout(tick, 0)
    const id = setInterval(tick, 1000)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [])
  useEffect(() => {
    dialogRef.current = dialog
  }, [dialog])
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [lines, interim])
  useEffect(() => {
    if (!focused.length) return
    const id = setTimeout(() => setFocused([]), 6000)
    return () => clearTimeout(id)
  }, [focused])

  const stopMicLevel = useCallback(() => {
    if (!audio.current) return
    cancelAnimationFrame(audio.current.frame)
    audio.current.stream.getTracks().forEach((track) => track.stop())
    void audio.current.ctx.close()
    audio.current = null
    level.current = 0
  }, [level])

  // Microphone loudness drives the hologram while listening.
  const startMicLevel = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)
      const data = new Uint8Array(analyser.fftSize)
      const read = () => {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (const v of data) sum += ((v - 128) / 128) ** 2
        level.current = Math.min(1, Math.sqrt(sum / data.length) * 6)
        if (audio.current) audio.current.frame = requestAnimationFrame(read)
      }
      audio.current = { stream, ctx, frame: requestAnimationFrame(read) }
    } catch {
      // Recognition may still work without the level meter; the hologram just stays calm.
    }
  }, [level])

  const speak = useCallback(
    (text: string) => {
      const done = () => {
        level.current = 0
        setState('idle')
        if (dialogRef.current) listenRef.current()
      }
      if (!voiceOn || !('speechSynthesis' in window) || !text) return done()
      speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'ru-RU'
      u.rate = 1.04
      u.pitch = 0.92
      const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('ru'))
      u.voice =
        voices.find((v) => /Yuri|Dmitri|Pavel|Maxim|male|муж/i.test(v.name)) ?? voices[0] ?? null
      // Speech has no loudness to read, so each word gives the hologram a pulse that fades out.
      let fade = 0
      u.onstart = () => {
        setState('speaking')
        fade = window.setInterval(() => (level.current = Math.max(0.18, level.current * 0.86)), 50)
      }
      u.onboundary = () => (level.current = 0.85)
      u.onend = u.onerror = () => {
        clearInterval(fade)
        done()
      }
      speechSynthesis.speak(u)
    },
    [voiceOn, level],
  )

  const ask = useCallback(
    async (raw: string) => {
      const text = raw.trim()
      if (!text || state === 'thinking') return
      speechSynthesis?.cancel()
      setDraft('')
      setInterim('')
      history.current = [...history.current, { role: 'user' as const, content: text }].slice(-20)
      while (history.current[0]?.role === 'assistant') history.current.shift()
      setLines((l) => [...l, { role: 'user', text }, { role: 'assistant', text: '' }])
      setState('thinking')
      const ctl = new AbortController()
      abort.current = ctl
      const show = (value: string) =>
        setLines((l) => [...l.slice(0, -1), { role: 'assistant', text: value }])
      let answer = ''
      let failure: string | null = null
      try {
        const res = await fetch('/api/admin/echo', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messages: history.current }),
          signal: ctl.signal,
        })
        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          failure = body?.error ?? 'upstream_error'
        } else {
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          for (;;) {
            const { value, done } = await reader.read()
            if (done) break
            answer += decoder.decode(value, { stream: true })
            const cut = answer.indexOf('\u0000')
            if (cut >= 0) {
              failure = answer.slice(cut + 1) || 'upstream_error'
              answer = answer.slice(0, cut)
            }
            show(visibleText(answer))
          }
        }
      } catch {
        if (ctl.signal.aborted) failure = null
        else failure = 'network'
      }
      abort.current = null
      const said = visibleText(answer)
      if (said) {
        history.current.push({ role: 'assistant', content: answer })
        setFocused(focusOf(answer))
      } else {
        setLines((l) => l.slice(0, -1))
        history.current.pop()
      }
      if (failure) {
        const message = t.errors[failure as keyof typeof t.errors] ?? t.errors.upstream_error
        setLines((l) => [...l, { role: 'system', text: message }])
      }
      if (said && !failure && !ctl.signal.aborted) speak(said)
      else setState('idle')
    },
    [state, speak],
  )

  const stopListening = useCallback(() => {
    recognition.current?.stop()
  }, [])

  const listen = useCallback(() => {
    const Ctor = recognitionCtor()
    if (!Ctor) {
      setLines((l) => [...l, { role: 'system', text: t.errors.noSpeech }])
      return
    }
    speechSynthesis?.cancel()
    const rec = new Ctor()
    rec.lang = 'ru-RU'
    rec.interimResults = true
    rec.continuous = false
    let finalText = ''
    rec.onresult = (e) => {
      let all = ''
      for (const result of Array.from(e.results)) {
        all += result[0]?.transcript ?? ''
        if (result.isFinal) finalText = all
      }
      setInterim(all)
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed')
        setLines((l) => [...l, { role: 'system', text: t.errors.mic }])
    }
    rec.onend = () => {
      recognition.current = null
      stopMicLevel()
      setInterim('')
      if (finalText.trim()) void ask(finalText)
      else setState((s) => (s === 'listening' ? 'idle' : s))
    }
    recognition.current = rec
    setState('listening')
    void startMicLevel()
    try {
      rec.start()
    } catch {
      rec.onend?.()
    }
  }, [ask, startMicLevel, stopMicLevel])

  useEffect(() => {
    listenRef.current = listen
  }, [listen])

  useEffect(
    () => () => {
      abort.current?.abort()
      recognition.current?.abort()
      stopMicLevel()
      if ('speechSynthesis' in window) speechSynthesis.cancel()
    },
    [stopMicLevel],
  )

  const busy = state === 'thinking'
  const decide = tasks.filter((x) => x.status === 'decide').length
  const isFocused = (id: FocusTarget) => focused.includes(id)
  const panel = (id: FocusTarget) =>
    cn(
      'hud-panel relative rounded-card border bg-surface/80 p-5 transition-[border-color,box-shadow] duration-500',
      isFocused(id)
        ? 'border-accent/70 shadow-[0_0_0_1px_var(--color-accent),0_0_40px_-8px_var(--color-accent)]'
        : 'border-line',
    )

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="order-2 grid content-start gap-4 lg:order-1 lg:col-span-3">
        {projects.map((p, i) => {
          const h = health.find((x) => x.id === p.id)
          return (
            <section key={p.id} className={panel(p.id)}>
              <div className="flex items-baseline justify-between gap-3 font-mono text-[10.5px] tracking-[0.16em] text-faint uppercase">
                <span>{`${t.projects} 0${i + 1}`}</span>
                <span className={cn('flex items-center gap-1.5', h?.ok ? 'text-accent' : 'text-danger')}>
                  <span
                    aria-hidden="true"
                    className={cn('size-1.5 rounded-full', h?.ok ? 'bg-accent' : 'bg-danger')}
                  />
                  {h?.ok ? `${t.online} · ${h.ms} мс` : t.offline}
                </span>
              </div>
              <h2 className="mt-3 font-brand text-xl font-bold tracking-tight">{p.name}</h2>
              <p className="mt-1 text-sm text-muted">{p.about}</p>
              <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 font-mono text-xs">
                {p.facts.map((f) => (
                  <div key={f.label} className="min-w-0">
                    <dt className="text-faint">{f.label}</dt>
                    <dd className="truncate text-fg">{f.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 font-mono text-xs text-faint">{p.domain}</p>
            </section>
          )
        })}
        <section className={panel('leads')}>
          <div className="flex items-baseline justify-between font-mono text-[10.5px] tracking-[0.16em] text-faint uppercase">
            <span>{t.leads}</span>
            <span className="text-accent">{leads.conversion}%</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              [t.leadsToday, leads.today],
              [t.leadsWeek, leads.week],
              [t.leadsStale, leads.stale],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <div
                  className={cn(
                    'font-mono text-2xl tabular-nums',
                    label === t.leadsStale && Number(value) > 0 && 'text-danger',
                  )}
                >
                  {value}
                </div>
                <div className="text-xs text-faint">{label}</div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Sparkline values={series} label={admin.overview.sparkHint} />
          </div>
        </section>
      </div>

      <div className="order-1 grid content-start gap-4 lg:order-2 lg:col-span-6">
        <section className="hud-stage relative overflow-hidden rounded-card border border-line bg-[radial-gradient(ellipse_at_50%_40%,rgb(181_235_106/0.07),transparent_65%)]">
          <Hologram state={state} level={level} className="block aspect-[5/4] w-full sm:aspect-[4/3]" />
          <div className="pointer-events-none absolute inset-0 p-7 sm:p-8">
            <span className="hud-corner left-3 top-3" />
            <span className="hud-corner right-3 top-3 rotate-90" />
            <span className="hud-corner bottom-3 right-3 rotate-180" />
            <span className="hud-corner bottom-3 left-3 -rotate-90" />
            <div className="flex items-start justify-between font-mono text-[10.5px] tracking-[0.18em] text-faint uppercase">
              <span>
                <span className="text-accent">ECHO</span>
                <br />
                fir.tech / admin
              </span>
              <span className="text-right tabular-nums">
                {clock}
                <br />
                Душанбе
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-2 px-6 text-center">
              <span
                role="status"
                className="rounded-full border border-accent/30 bg-bg/70 px-3 py-1 font-mono text-[11px] tracking-[0.2em] text-accent uppercase backdrop-blur"
              >
                {t.states[state]}
              </span>
              {interim ? <p className="max-w-md text-sm text-fg/90">{interim}</p> : null}
            </div>
          </div>
        </section>

        <section className="rounded-card border border-line bg-surface/80 p-4 sm:p-5">
          <div
            ref={logRef}
            aria-live="polite"
            className="grid max-h-72 min-h-28 content-start gap-3 overflow-y-auto pr-1"
          >
            {lines.map((line, i) => (
              <div
                key={i}
                className={cn(
                  'max-w-[85%] text-[15px] leading-relaxed whitespace-pre-wrap',
                  line.role === 'user' && 'justify-self-end text-right text-muted',
                  line.role === 'system' && 'font-mono text-xs text-danger',
                )}
              >
                {line.role !== 'system' ? (
                  <span
                    className={cn(
                      'mb-0.5 block font-mono text-[10px] tracking-[0.18em] uppercase',
                      line.role === 'assistant' ? 'text-accent' : 'text-faint',
                    )}
                  >
                    {line.role === 'assistant' ? t.me : t.you}
                  </span>
                ) : null}
                {line.text || (busy && i === lines.length - 1 ? <span className="hud-dots" /> : null)}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {t.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => ask(s)}
                className="rounded-full border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent/50 hover:text-fg disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => (state === 'listening' ? stopListening() : listen())}
              disabled={busy}
              aria-pressed={state === 'listening'}
              aria-label={state === 'listening' ? t.listening : t.talk}
              className={cn(
                'relative grid size-12 shrink-0 place-items-center rounded-full border transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.96] disabled:opacity-40',
                state === 'listening'
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-line-strong text-accent hover:border-accent',
              )}
            >
              {state === 'listening' ? <Waveform size={20} weight="bold" /> : <Microphone size={20} weight="bold" />}
              {state === 'listening' ? <span aria-hidden="true" className="hud-ping" /> : null}
            </button>
            <form
              className="flex min-w-0 flex-1 items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void ask(draft)
              }}
            >
              <input
                id="echo-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t.placeholder}
                aria-label={t.placeholder}
                autoComplete="off"
                className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-bg/60 px-4 text-[15px] outline-none placeholder:text-faint focus:border-accent/60"
              />
              {busy ? (
                <button
                  type="button"
                  onClick={() => abort.current?.abort()}
                  aria-label={t.stop}
                  className="grid size-12 shrink-0 place-items-center rounded-full border border-line-strong text-fg hover:border-accent"
                >
                  <Stop size={18} weight="fill" />
                </button>
              ) : (
                <button
                  type="submit"
                  aria-label={t.send}
                  disabled={!draft.trim()}
                  className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition-transform duration-150 active:scale-[0.96] disabled:opacity-40"
                >
                  <PaperPlaneRight size={18} weight="fill" />
                </button>
              )}
            </form>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                id="echo-voice"
                type="checkbox"
                checked={voiceOn}
                onChange={(e) => {
                  setVoiceOn(e.target.checked)
                  if (!e.target.checked) speechSynthesis?.cancel()
                }}
                className="accent-[var(--color-accent)]"
              />
              {voiceOn ? <SpeakerHigh size={16} aria-hidden="true" /> : <SpeakerSlash size={16} aria-hidden="true" />}
              {t.voiceOn}
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                id="echo-dialog"
                type="checkbox"
                checked={dialog}
                onChange={(e) => {
                  setDialog(e.target.checked)
                }}
                className="accent-[var(--color-accent)]"
              />
              {t.dialog}
            </label>
          </div>
        </section>
      </div>

      <div className="order-3 grid content-start gap-4 lg:col-span-3">
        <section className={panel('tasks')}>
          <div className="flex items-baseline justify-between font-mono text-[10.5px] tracking-[0.16em] text-faint uppercase">
            <span>{t.tasks}</span>
            <span className="text-accent">{`${decide} · ${t.taskStatus.decide}`}</span>
          </div>
          <ul className="mt-3 max-h-[26rem] divide-y divide-line overflow-y-auto pr-1 pb-6 [mask-image:linear-gradient(to_bottom,black_calc(100%-2.5rem),transparent)]">
            {[...tasks]
              .sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.priority - b.priority)
              .map((task) => (
                <li key={task.id} className="grid grid-cols-[10px_1fr] gap-3 py-2.5">
                  <span
                    aria-hidden="true"
                    className={cn('mt-1.5 size-2 rotate-45', statusTone[task.status])}
                  />
                  <div className="min-w-0">
                    <p className={cn('text-sm', task.status === 'later' && 'text-muted')}>{task.title}</p>
                    <p className="mt-0.5 font-mono text-[10.5px] tracking-wide text-faint uppercase">
                      {`${task.id} · ${t.taskStatus[task.status]} · ${t.owner[task.owner]}`}
                    </p>
                  </div>
                </li>
              ))}
          </ul>
        </section>
        <section className={panel('goals')}>
          <div className="flex items-baseline justify-between font-mono text-[10.5px] tracking-[0.16em] text-faint uppercase">
            <span>{t.goals}</span>
            <span>{t.goalsNote}</span>
          </div>
          <ul className="mt-4 grid gap-4">
            {goals.map((g) => (
              <li key={g.title}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>{g.title}</span>
                  <span className="font-mono text-accent tabular-nums">{g.progress}%</span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]"
                    style={{ width: `${g.progress}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-faint">{g.next}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
