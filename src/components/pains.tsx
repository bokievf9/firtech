import { ArrowRight } from '@phosphor-icons/react/ssr'
import type { Dict } from '@/content'
import { Reveal } from './reveal'

export function Pains({ dict }: { dict: Dict }) {
  const p = dict.pains
  return (
    <section className="border-y border-line bg-surface/40">
      <div className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-32">
        <Reveal>
          <h2 className="text-4xl font-semibold tracking-[-0.03em] md:text-5xl">{p.title}</h2>
          <p className="mt-4 text-lg text-muted">{p.sub}</p>
        </Reveal>
        <div className="mt-14 grid gap-x-12 md:grid-cols-2">
          {p.items.map((item, i) => (
            <Reveal key={item.pain} delay={(i % 2) * 0.06}>
              <div className="grid gap-3 border-t border-line py-7">
                <p className="flex gap-3 text-faint">
                  <span className="w-14 shrink-0 font-mono text-xs leading-6 uppercase">{p.before}</span>
                  <span className="text-lg leading-snug line-through decoration-faint/50">{item.pain}</span>
                </p>
                <p className="flex gap-3">
                  <span className="flex w-14 shrink-0 items-center gap-1 font-mono text-xs leading-6 text-accent uppercase">
                    <ArrowRight size={12} />
                    {p.after}
                  </span>
                  <span className="text-lg leading-snug">{item.fix}</span>
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
