'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { emotions, variants, type Emotion, type Variant } from '@/lib/fira/pose'
import { Fira } from './fira'

// Internal concept lab (hidden, noindex): the three Fira characters side by side. The theme is the
// site's own switch in the header. Capture mode (?solo=a&emotion=happy&size=800&clock=1.4, or
// &seq=idle:1.3,happy:1.4,thinking:1.3) renders one bare figure for screenshots and loops.
export const characters: Record<Variant, { name: string; line: string }> = {
  a: { name: 'A «Капля»', line: 'Спокойная и прыгучая: мягкая капля, два больших глаза, светящаяся точка-антенна.' },
  b: { name: 'B «Светлячок»', line: 'Любопытная и лёгкая: шар с внутренним свечением, овальные глаза, ушки реагируют.' },
  c: { name: 'C «Пушинка»', line: 'Самая мягкая: пушистый шар, глаза прикрыты от удовольствия, румянец.' },
}

const emotionLabel: Record<Emotion, string> = {
  idle: 'Покой', thinking: 'Думает', happy: 'Рада', talking: 'Говорит', point: 'Показывает', sleep: 'Спит',
}

export type Capture = { solo: Variant; emotion: Emotion; size: number; seq: { emotion: Emotion; sec: number }[] | null; clock?: number }

function Fps() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let raf = 0
    let n = 0
    let last = performance.now()
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      n++
      if (now - last >= 500) {
        if (ref.current) ref.current.textContent = `${Math.round((n * 1000) / (now - last))} fps`
        n = 0
        last = now
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <span ref={ref} className="font-mono text-xs text-muted tabular-nums">- fps</span>
}

function CaptureView({ capture }: { capture: Capture }) {
  const [emotion, setEmotion] = useState<Emotion>(capture.seq?.[0]?.emotion ?? capture.emotion)
  const box = useRef<HTMLDivElement>(null)
  // A loop starts when the figure has drawn its first frame, so a recording begins on its first step.
  useEffect(() => {
    const seq = capture.seq
    if (!seq?.length) return
    let i = 0
    let id = 0
    const step = () => {
      setEmotion(seq[i]!.emotion)
      id = window.setTimeout(() => {
        i = (i + 1) % seq.length
        step()
      }, seq[i]!.sec * 1000)
    }
    const wait = () => {
      if (box.current?.querySelector('[data-fira-ready="1"]')) step()
      else id = window.setTimeout(wait, 40)
    }
    wait()
    return () => window.clearTimeout(id)
  }, [capture.seq])
  return (
    <div ref={box} className="fixed inset-0 z-[200] grid place-items-center bg-bg" data-fira-capture="">
      <Fira variant={capture.solo} emotion={emotion} size={capture.size} clock={capture.clock} lookAt={false} />
    </div>
  )
}

export function FiraLab({ capture }: { capture?: Capture | null }) {
  const [emotion, setEmotion] = useState<Emotion>('idle')
  const [follow, setFollow] = useState(true)
  const [size, setSize] = useState(300)
  if (capture) return <CaptureView capture={capture} />
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-28 pb-24 sm:px-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Фира: концепт</h1>
      <p className="mt-2 max-w-[62ch] text-muted">Три варианта на одном скелете. Светлая и тёмная тема переключаются в шапке сайта.</p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Эмоция">
          {emotions.map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={emotion === e}
              onClick={() => setEmotion(e)}
              className={cn(
                'rounded-full border px-4 py-2 text-sm transition-colors duration-150 ease-out',
                emotion === e ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-fg hover:bg-surface-2',
              )}
            >
              {emotionLabel[e]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
          Следит за курсором
        </label>
        <label className="flex items-center gap-3 text-sm">
          Размер
          <input type="range" min={160} max={440} step={10} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Размер" />
          <span className="font-mono text-xs text-muted tabular-nums">{size}</span>
        </label>
        {process.env.NODE_ENV !== 'production' ? <Fps /> : null}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        {variants.map((v) => (
          <section key={v} className="flex flex-col items-center rounded-card border border-line bg-surface p-6">
            <div className="flex w-full justify-center overflow-hidden" style={{ minHeight: size }}>
              <Fira variant={v} emotion={emotion} size={size} lookAt={follow} label={characters[v].name} />
            </div>
            <h2 className="mt-4 font-display text-xl font-semibold">{characters[v].name}</h2>
            <p className="mt-1 text-center text-sm text-muted">{characters[v].line}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
