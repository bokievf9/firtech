'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { emotions, roundTwo, variants, type Emotion, type Variant } from '@/lib/fira/pose'
import { Fira } from './fira'

// Internal concept lab (hidden, noindex): the five round-two Fira characters side by side (?all=1
// adds round one). Modes: compare, a 3 x 3 sticker sheet of one character, a turntable. The theme is
// the site's own switch in the header. Capture mode renders bare figures for screenshots and loops:
// ?solo=d&emotion=happy&size=800&clock=1.4, &seq=idle:1.3,happy:1.4 (a loop), &spin=1.26 (turntable),
// ?sheet=d&size=980&clock=0.5 (the sticker sheet).
export const characters: Record<Variant, { name: string; line: string }> = {
  d: { name: 'D «Огонёк»', line: 'Бойкая и тёплая: круглое тельце, голова-язычок пламени, на кончике светится точка, большие глаза с бровями.' },
  e: { name: 'E «Зёрнышко»', line: 'Сонная и добрая: зерно с листиками и почкой-точкой, веки наполовину, коротенькие ножки, переваливается.' },
  f: { name: 'F «Шарик-с-телом»', line: 'Как глиняная фигурка: большая круглая голова на маленьком теле, ручки и ножки, на груди горит точка.' },
  g: { name: 'G «Каплюшка-кот»', line: 'Хитрая и ласковая: капля с ушками, хвост закручивается, когда рада, точка на лбу.' },
  h: { name: 'H «Пузырёк»', line: 'Застенчивая: прозрачная оболочка-пузырь, внутри ядро-точка с лицом, оболочка пружинит, ядро запаздывает.' },
  a: { name: 'A «Капля»', line: 'Раунд 1: спокойная и прыгучая капля с точкой-антенной.' },
  b: { name: 'B «Светлячок»', line: 'Раунд 1: шар с внутренним свечением и ушками.' },
  c: { name: 'C «Пушинка»', line: 'Раунд 1: пушистый шар, глаза-дуги, румянец.' },
}

const emotionLabel: Record<Emotion, string> = {
  idle: 'Покой', thinking: 'Думает', happy: 'Рада', talking: 'Говорит', point: 'Показывает', sleep: 'Спит', wave: 'Машет', surprised: 'Удивлена',
}

// Sticker sheet: 3 x 3 emotions of one character (talking twice: a small and a wide open mouth).
export const sheetTiles: { emotion: Emotion; mouth?: number; label: string }[] = [
  { emotion: 'idle', label: 'Покой' },
  { emotion: 'happy', label: 'Рада' },
  { emotion: 'thinking', label: 'Думает' },
  { emotion: 'talking', mouth: 0.42, label: 'Говорит' },
  { emotion: 'wave', label: 'Машет' },
  { emotion: 'surprised', label: 'Удивлена' },
  { emotion: 'point', label: 'Показывает' },
  { emotion: 'sleep', label: 'Спит' },
  { emotion: 'talking', mouth: 1, label: 'Кричит' },
]

export type Capture = {
  solo: Variant | null
  sheet: Variant | null
  emotion: Emotion
  size: number
  seq: { emotion: Emotion; sec: number }[] | null
  clock?: number
  spin?: number
}

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

function SheetGrid({ variant, size, clock, follow }: { variant: Variant; size: number; clock?: number; follow: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-3" data-fira-sheet={variant}>
      {sheetTiles.map((t, i) => (
        <div key={i} className="flex flex-col items-center rounded-card border border-line bg-surface p-2">
          <Fira variant={variant} emotion={t.emotion} mouth={t.mouth} size={size} clock={clock} lookAt={follow && t.emotion !== 'sleep'} label={`${characters[variant].name}: ${t.label}`} />
          <span className="mt-1 text-sm text-muted">{t.label}</span>
        </div>
      ))}
    </div>
  )
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
      {capture.sheet ? (
        <div className="w-full max-w-[1180px] p-4"><SheetGrid variant={capture.sheet} size={Math.floor((capture.size - 80) / 3)} clock={capture.clock} follow={false} /></div>
      ) : (
        <Fira variant={capture.solo!} emotion={emotion} size={capture.size} clock={capture.clock} spin={capture.spin} lookAt={false} />
      )}
    </div>
  )
}

type Mode = 'compare' | 'sheet' | 'turn'
const modeLabel: Record<Mode, string> = { compare: 'Сравнение', sheet: 'Лист стикеров', turn: 'Поворот' }
const TURN_SPEED = 0.9

export function FiraLab({ capture, all = false }: { capture?: Capture | null; all?: boolean }) {
  const [emotion, setEmotion] = useState<Emotion>('idle')
  const [follow, setFollow] = useState(true)
  const [size, setSize] = useState(250)
  const [mode, setMode] = useState<Mode>('compare')
  const [sheetOf, setSheetOf] = useState<Variant>('d')
  if (capture) return <CaptureView capture={capture} />
  const shown: readonly Variant[] = all ? variants : roundTwo
  const turn = mode === 'turn'
  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pt-28 pb-24 sm:px-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Фира: раунд 2</h1>
      <p className="mt-2 max-w-[66ch] text-muted">
        Пять новых характеров на улучшенном скелете. Светлая и тёмная тема переключаются в шапке сайта.
        {all ? ' Показаны все восемь (раунд 1 и 2).' : ' Раунд 1 (A, B, C) открывается добавкой ?all=1 к адресу.'}
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-full border border-line-strong p-1" role="group" aria-label="Режим">
          {(Object.keys(modeLabel) as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn('rounded-full px-4 py-1.5 text-sm transition-colors duration-150 ease-out', mode === m ? 'bg-accent text-accent-ink' : 'text-fg hover:bg-surface-2')}
            >
              {modeLabel[m]}
            </button>
          ))}
        </div>
        {mode !== 'sheet' ? (
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
        ) : (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Персонаж">
            {shown.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={sheetOf === v}
                onClick={() => setSheetOf(v)}
                className={cn('rounded-full border px-4 py-2 text-sm transition-colors duration-150 ease-out', sheetOf === v ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-fg hover:bg-surface-2')}
              >
                {characters[v].name}
              </button>
            ))}
          </div>
        )}
        {!turn ? (
          <label className="flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm">
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
            Следит за курсором
          </label>
        ) : null}
        <label className="flex items-center gap-3 text-sm">
          Размер
          <input type="range" min={120} max={440} step={10} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Размер" />
          <span className="font-mono text-xs text-muted tabular-nums">{size}</span>
        </label>
        {process.env.NODE_ENV !== 'production' ? <Fps /> : null}
      </div>

      {mode === 'sheet' ? (
        <div className="mx-auto mt-8 w-fit">
          <h2 className="mb-3 font-display text-xl font-semibold">{characters[sheetOf].name}</h2>
          <SheetGrid variant={sheetOf} size={Math.min(size, 280)} follow={follow} />
        </div>
      ) : (
        <div className={cn('mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2', all ? 'md:grid-cols-3 xl:grid-cols-4' : 'md:grid-cols-3 xl:grid-cols-5')}>
          {shown.map((v) => (
            <section key={v} className="flex flex-col items-center rounded-card border border-line bg-surface p-4">
              <div className="flex w-full justify-center overflow-hidden" style={{ minHeight: size }}>
                <Fira variant={v} emotion={emotion} size={size} lookAt={follow && !turn} spin={turn ? TURN_SPEED : undefined} label={characters[v].name} />
              </div>
              <h2 className="mt-3 font-display text-lg font-semibold">{characters[v].name}</h2>
              <p className="mt-1 text-center text-sm text-muted">{characters[v].line}</p>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
