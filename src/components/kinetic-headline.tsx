import { Fragment } from 'react'

// The hero headline, word by word from under a mask (`.kinetic-*` in globals.css). CSS only: it
// runs on first paint before hydration, only transform moves, so the text is painted at once and
// counts for LCP. Decorative copy: the h1 also carries the plain sentence (`title`) for search
// engines and screen readers. The accent line gets the lime fill and one light sweep.
export function KineticHeadline({
  title,
  lines,
  accent,
  className,
}: {
  title: string
  lines: string[]
  accent: number
  className?: string
}) {
  let index = 0
  return (
    <h1 className={className}>
      <span className="sr-only">{title}</span>
      <span aria-hidden="true" className="block">
        {lines.map((line, i) => (
          <span key={line} className={i === accent ? 'kinetic-accent block' : 'block'}>
            {line.split(' ').map((word, w, all) => {
              const delay = 0.06 + index++ * 0.065
              // The accent line runs two animations (rise, then sweep); each gets its own delay.
              const animationDelay =
                i === accent
                  ? `${delay.toFixed(3)}s, ${(delay + 1.1).toFixed(3)}s`
                  : `${delay.toFixed(3)}s`
              return (
                <Fragment key={`${word}-${w}`}>
                  <span className="kinetic-mask">
                    <span className="kinetic-word" style={{ animationDelay }}>
                      {word}
                    </span>
                  </span>
                  {w < all.length - 1 ? ' ' : null}
                </Fragment>
              )
            })}
          </span>
        ))}
      </span>
    </h1>
  )
}
