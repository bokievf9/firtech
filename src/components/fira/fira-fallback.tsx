import type { CSSProperties } from 'react'
import type { Emotion, Variant } from '@/lib/fira/pose'

// The 2D Fira: plain SVG, no hooks, so it renders on the server, without WebGL and under reduced
// motion. Colours are the site tokens (CSS variables), so it follows the theme with no JavaScript.
const ink = 'var(--color-accent-ink)'
const body = 'var(--color-accent)'
const cream = 'var(--color-paper)'
const strong = 'var(--color-accent-strong)'

const bodyPath: Record<Variant, string> = {
  a: 'M100 36C116 36 122 56 132 80C144 106 158 126 154 150C149 176 126 188 100 188C74 188 51 176 46 150C42 126 56 106 68 80C78 56 84 36 100 36Z',
  b: 'M100 56A62 62 0 1 1 99.9 56Z',
  c: 'M100 60A60 58 0 1 1 99.9 60Z',
}

export function FiraFallback({ variant, emotion, className, style }: { variant: Variant; emotion: Emotion; className?: string; style?: CSSProperties }) {
  const happy = emotion === 'happy'
  const sleep = emotion === 'sleep'
  const think = emotion === 'thinking'
  const talk = emotion === 'talking'
  const point = emotion === 'point'
  const ex = variant === 'a' ? 30 : 28
  const ey = variant === 'a' ? 118 : 120
  const look = think ? { x: -5, y: -6 } : point ? { x: 6, y: 0 } : { x: 0, y: 0 }
  const rx = variant === 'b' ? 9.5 : variant === 'c' ? 13 : 14
  const ry = variant === 'b' ? 14 : variant === 'c' ? 13 : 14
  const eye = (cx: number) => {
    const x = cx + look.x
    const y = ey + look.y
    if (happy) return <path key={cx} d={`M${x - 12} ${y + 5}Q${x} ${y - 13} ${x + 12} ${y + 5}`} fill="none" stroke={ink} strokeWidth="5.5" strokeLinecap="round" />
    if (sleep) return <path key={cx} d={`M${x - 11} ${y - 2}Q${x} ${y + 9} ${x + 11} ${y - 2}`} fill="none" stroke={ink} strokeWidth="4.5" strokeLinecap="round" />
    if (variant === 'c') {
      return (
        <g key={cx}>
          <path d={`M${x - rx} ${y - 1}A${rx} ${ry} 0 0 0 ${x + rx} ${y - 1}Z`} fill={ink} />
        </g>
      )
    }
    return (
      <g key={cx}>
        <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={ink} />
        <circle cx={x - rx * 0.32} cy={y - ry * 0.34} r={rx * 0.28} fill={cream} />
      </g>
    )
  }
  const mouthY = ey + 30
  const tilt = think ? -7 : point ? 5 : 0
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} data-fira-svg={`${variant}-${emotion}`} aria-hidden="true" focusable="false">
      <ellipse cx="100" cy="190" rx="52" ry="7" fill={ink} opacity="0.16" />
      <g transform={`rotate(${tilt} 100 188)`}>
        {point ? <rect x="148" y="112" width="46" height="18" rx="9" fill={body} transform="rotate(-14 150 121)" /> : <circle cx="152" cy="140" r="11" fill={body} />}
        <circle cx="48" cy="140" r="11" fill={body} />
        {happy ? <circle cx="42" cy="104" r="11" fill={body} /> : null}
        {variant === 'b' ? (
          <>
            <rect x="48" y="40" width="26" height="36" rx="13" fill={strong} transform="rotate(-24 61 62)" />
            <rect x="126" y="40" width="26" height="36" rx="13" fill={strong} transform="rotate(24 139 62)" />
          </>
        ) : null}
        <path d={bodyPath[variant]} fill={body} />
        {variant === 'b' ? <circle cx="100" cy="118" r="46" fill={cream} opacity="0.32" /> : null}
        {variant === 'c' ? <path d={bodyPath.c} fill="none" stroke={cream} strokeWidth="5" opacity="0.55" strokeDasharray="1 7" strokeLinecap="round" /> : null}
        {variant === 'a' ? (
          <>
            <path d="M100 36V22" stroke={ink} strokeWidth="3" strokeLinecap="round" />
            <circle cx="100" cy="16" r="7.5" fill={strong} />
          </>
        ) : null}
        {variant === 'c' ? <ellipse cx="100" cy="62" rx="13" ry="10" fill={body} /> : null}
        {eye(100 - ex)}
        {eye(100 + ex)}
        {variant !== 'b' || happy ? (
          <>
            <ellipse cx={100 - ex - 14} cy={ey + 18} rx="10" ry="6" fill="#ff9a8a" opacity={variant === 'c' || happy ? 0.5 : 0.28} />
            <ellipse cx={100 + ex + 14} cy={ey + 18} rx="10" ry="6" fill="#ff9a8a" opacity={variant === 'c' || happy ? 0.5 : 0.28} />
          </>
        ) : null}
        {talk ? (
          <ellipse cx="100" cy={mouthY + 2} rx="8" ry="10" fill={ink} />
        ) : (
          <path d={happy ? `M86 ${mouthY - 4}Q100 ${mouthY + 16} 114 ${mouthY - 4}` : sleep ? `M94 ${mouthY}Q100 ${mouthY + 3} 106 ${mouthY}` : `M89 ${mouthY - 2}Q100 ${mouthY + 8} 111 ${mouthY - 2}`} fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
        )}
      </g>
      {sleep ? (
        <g fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
          <path d="M150 52h14l-14 16h14" />
          <path d="M170 28h10l-10 12h10" />
        </g>
      ) : null}
    </svg>
  )
}
