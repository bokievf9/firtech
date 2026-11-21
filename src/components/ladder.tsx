import { ArrowUpRight } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import { ladderIds, ladderLevels, ladders, rungPath } from '@/lib/ladder'
import { Reveal } from './reveal'

// The ladder graphic (owner 2026-11-22): per direction three rungs that rise from left to right, one
// agent, the autopilot product, the whole department. Each rung is a link to its page; two sentences
// under each track say what changes between the rungs. Used on the home products section and on
// /ai-team, so the same words stand in both places.
const rise = ['md:min-h-[9.5rem]', 'md:min-h-[12rem]', 'md:min-h-[14.5rem]']

export function Ladder({ locale, dict, heading = 'h3' }: { locale: string; dict: Dict; heading?: 'h2' | 'h3' }) {
  const t = dict.ladder
  const Heading = heading
  return (
    <div className="grid gap-gutter" data-ladder>
      {ladderIds.map((id, trackIndex) => {
        const track = t.tracks[id]
        return (
          <Reveal key={id} delay={trackIndex * 0.05}>
            <section
              aria-labelledby={`ladder-${id}`}
              className="rounded-card border border-line bg-surface p-4 md:p-6"
              data-ladder-track={id}
            >
              <Heading id={`ladder-${id}`} className="font-display text-xl font-semibold tracking-tight md:text-2xl">
                {track.title}
              </Heading>
              <ol className="mt-5 grid gap-3 md:grid-cols-3 md:items-end">
                {ladderLevels.map((level, i) => {
                  const rung = track.rungs[level]
                  return (
                    <li key={level} className={cn('flex', rise[i])}>
                      <Link
                        href={`/${locale}${rungPath(ladders[id][level])}`}
                        data-ladder-rung={`${id}-${level}`}
                        className={cn(
                          'group relative flex w-full flex-col justify-between gap-4 rounded-[14px] border p-4 transition-[border-color,transform] duration-300 ease-out-expo hover:-translate-y-0.5 md:p-5',
                          level === 'dept'
                            ? 'border-accent-text/40 bg-[linear-gradient(160deg,var(--color-pine),var(--color-surface)_75%)]'
                            : 'border-line bg-bg/60 hover:border-line-strong',
                        )}
                      >
                        <span>
                          <span className="font-mono text-[11px] tracking-[0.14em] text-accent-text uppercase">
                            {t.levels[level]}
                          </span>
                          <span className="mt-2 block text-lg leading-snug font-semibold">{rung.title}</span>
                          <span className="mt-2 block text-sm leading-relaxed text-muted">{rung.text}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-sm font-medium">
                          {t.open}
                          <ArrowUpRight
                            size={14}
                            aria-hidden="true"
                            className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                          />
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ol>
              <p className="mt-5 max-w-[86ch] text-sm leading-relaxed text-muted">
                <span className="font-medium text-fg">{t.changeLabel}. </span>
                {track.change}
              </p>
            </section>
          </Reveal>
        )
      })}
    </div>
  )
}
