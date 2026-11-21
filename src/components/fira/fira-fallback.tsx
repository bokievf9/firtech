import type { CSSProperties } from 'react'
import { isRoundTwo, type Emotion, type Variant } from '@/lib/fira/pose'

// The 2D Fira: plain SVG, no hooks, so it renders on the server, without WebGL and under reduced
// motion. Colours are the site tokens (CSS variables), so it follows the theme with no JavaScript.
const ink = 'var(--color-accent-ink)'
const body = 'var(--color-accent)'
const cream = 'var(--color-paper)'
const strong = 'var(--color-accent-strong)'

const bodyPath: Record<'a' | 'b' | 'c', string> = {
  a: 'M100 36C116 36 122 56 132 80C144 106 158 126 154 150C149 176 126 188 100 188C74 188 51 176 46 150C42 126 56 106 68 80C78 56 84 36 100 36Z',
  b: 'M100 56A62 62 0 1 1 99.9 56Z',
  c: 'M100 60A60 58 0 1 1 99.9 60Z',
}

function RoundOne({ variant, emotion, className, style }: { variant: 'a' | 'b' | 'c'; emotion: Emotion; className?: string; style?: CSSProperties }) {
  const happy = emotion === 'happy'
  const sleep = emotion === 'sleep'
  const think = emotion === 'thinking'
  const talk = emotion === 'talking' || emotion === 'surprised'
  const point = emotion === 'point' || emotion === 'wave'
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

// ---- Round two (d to h): five silhouettes, one face routine. Arms are round-capped lines from the
// shoulder to a hand point that depends on the emotion; eyes are dark ovals with a highlight, arches
// when happy or asleep, wide when surprised; brows lift, tilt and (thinking) one goes up.
type Rig = {
  ex: number; ey: number; rx: number; ry: number; my: number; sh: [number, number]; arm: number
  lid?: number; ground: number
}
const rigs: Record<'d' | 'e' | 'f' | 'g' | 'h', Rig> = {
  d: { ex: 12, ey: 92, rx: 8, ry: 10, my: 112, sh: [52, 140], arm: 12, ground: 188 },
  e: { ex: 18, ey: 112, rx: 10, ry: 11, my: 138, sh: [48, 140], arm: 11, lid: 0.32, ground: 188 },
  f: { ex: 17, ey: 78, rx: 9.5, ry: 10.5, my: 104, sh: [70, 148], arm: 11, ground: 188 },
  g: { ex: 18, ey: 116, rx: 10, ry: 11, my: 140, sh: [50, 142], arm: 10, ground: 188 },
  h: { ex: 12, ey: 108, rx: 7.5, ry: 8.5, my: 128, sh: [60, 118], arm: 9, ground: 188 },
}

function RoundTwo({ variant, emotion, className, style }: { variant: 'd' | 'e' | 'f' | 'g' | 'h'; emotion: Emotion; className?: string; style?: CSSProperties }) {
  const r = rigs[variant]
  const happy = emotion === 'happy', sleep = emotion === 'sleep', think = emotion === 'thinking'
  const talk = emotion === 'talking', point = emotion === 'point', wave = emotion === 'wave', wow = emotion === 'surprised'
  const look = think ? { x: -4, y: -5 } : point ? { x: 5, y: 0 } : { x: 0, y: 0 }
  const rx = wow ? r.rx * 1.22 : r.rx, ry = wow ? r.ry * 1.25 : r.ry
  const eye = (side: -1 | 1) => {
    const x = 100 + side * r.ex + look.x, y = r.ey + look.y
    if (happy) return <path key={`e${side}`} d={`M${x - 10} ${y + 4}Q${x} ${y - 12} ${x + 10} ${y + 4}`} fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
    if (sleep) return <path key={`e${side}`} d={`M${x - 9} ${y - 2}Q${x} ${y + 8} ${x + 9} ${y - 2}`} fill="none" stroke={ink} strokeWidth="4.2" strokeLinecap="round" />
    const lid = r.lid ? (
      <path d={`M${x - rx - 1} ${y - ry * (1 - 2 * r.lid) + side * -1.5}H${x + rx + 1}V${y - ry - 2}H${x - rx - 1}Z`} fill={body} />
    ) : null
    return (
      <g key={`e${side}`}>
        <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={ink} />
        <circle cx={x - rx * 0.3} cy={y - ry * 0.34} r={rx * 0.3} fill={cream} />
        <circle cx={x + rx * 0.32} cy={y + ry * 0.36} r={rx * 0.14} fill={cream} />
        {lid}
      </g>
    )
  }
  const brow = (side: -1 | 1) => {
    const x = 100 + side * r.ex + look.x * 0.6
    const up = (wow ? 9 : happy || wave ? 5 : 2) + (think && side < 0 ? 5 : 0)
    const y = r.ey - ry - 5 - up
    const tilt = (think && side > 0 ? 7 : 0) * -side * 0.3 + (sleep ? 6 * side : 0)
    return <path key={`b${side}`} d={`M${x - 8} ${y + 2}Q${x} ${y - 3} ${x + 8} ${y + 2}`} fill="none" stroke={ink} strokeWidth="3.2" strokeLinecap="round" transform={`rotate(${tilt} ${x} ${y})`} />
  }
  const my = r.my
  const mouth = wow ? (
    <ellipse cx="100" cy={my + 3} rx="5" ry="7" fill={ink} />
  ) : talk ? (
    <ellipse cx="100" cy={my + 2} rx="7" ry="8" fill={ink} />
  ) : happy || wave ? (
    <path d={`M88 ${my - 3}H112Q110 ${my + 13} 100 ${my + 13}Q90 ${my + 13} 88 ${my - 3}Z`} fill={ink} />
  ) : sleep ? (
    <path d={`M95 ${my}Q100 ${my + 3} 105 ${my}`} fill="none" stroke={ink} strokeWidth="3.4" strokeLinecap="round" />
  ) : (
    <path d={`M91 ${my - 2}Q100 ${my + 7} 109 ${my - 2}`} fill="none" stroke={ink} strokeWidth="3.8" strokeLinecap="round" />
  )
  const [sx, sy] = r.sh
  const hand = (side: -1 | 1): [number, number] => {
    if (side > 0) {
      if (wave) return [sx + 22, sy - 62]
      if (point) return [sx + 54, sy - 18]
      if (happy) return [sx + 16, sy - 50]
      if (wow) return [sx + 20, sy - 8]
      return [sx + 12, sy + 16]
    }
    if (happy) return [sx - 16, sy - 50]
    if (wow) return [sx - 20, sy - 8]
    return [sx - 12, sy + 16]
  }
  const arms = ([1, -1] as const).map((side) => {
    const [hx, hy] = hand(side)
    const x0 = side > 0 ? 200 - sx : sx
    const x1 = side > 0 ? 200 - sx + (hx - sx) : sx + (hx - sx)
    return <line key={side} x1={x0} y1={sy} x2={x1} y2={hy} stroke={body} strokeWidth={r.arm * 2} strokeLinecap="round" />
  })
  const tilt = think ? -5 : point ? 4 : 0
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} data-fira-svg={`${variant}-${emotion}`} aria-hidden="true" focusable="false">
      <ellipse cx="100" cy="191" rx={variant === 'h' ? 56 : 50} ry="6" fill={ink} opacity="0.16" />
      <g transform={`rotate(${tilt} 100 188)`}>
        {variant === 'd' ? (
          <>
            {arms}
            <ellipse cx="82" cy="186" rx="13" ry="6" fill={strong} /><ellipse cx="118" cy="186" rx="13" ry="6" fill={strong} />
            <ellipse cx="100" cy="148" rx="52" ry="42" fill={body} />
            <ellipse cx="100" cy="156" rx="19" ry="14" fill={cream} opacity="0.6" />
            <path d="M66 92C66 70 84 60 94 44C99 36 104 30 114 20C112 40 134 62 134 92C134 112 118 124 100 124C82 124 66 112 66 92Z" fill={body} />
            <circle cx="114" cy="18" r="14" fill={strong} opacity="0.35" /><circle cx="114" cy="18" r="7" fill={cream} />
          </>
        ) : null}
        {variant === 'e' ? (
          <>
            {arms}
            <ellipse cx="78" cy="185" rx="15" ry="7" fill={strong} /><ellipse cx="122" cy="185" rx="15" ry="7" fill={strong} />
            <path d="M100 46C140 46 156 94 152 138C150 168 128 182 100 182C72 182 50 168 48 138C44 94 60 46 100 46Z" fill={body} />
            <ellipse cx="86" cy="36" rx="9" ry="17" fill="var(--color-accent-text)" opacity="0.8" transform="rotate(-48 86 44)" />
            <ellipse cx="114" cy="36" rx="9" ry="17" fill="var(--color-accent-text)" opacity="0.8" transform="rotate(48 114 44)" />
            <circle cx="100" cy="40" r="11" fill={strong} opacity="0.35" /><circle cx="100" cy="40" r="5.5" fill={cream} />
          </>
        ) : null}
        {variant === 'f' ? (
          <>
            <ellipse cx="82" cy="185" rx="12" ry="6" fill={strong} /><ellipse cx="118" cy="185" rx="12" ry="6" fill={strong} />
            {arms}
            <ellipse cx="100" cy="150" rx="30" ry="34" fill={body} />
            <circle cx="100" cy="150" r="12" fill={strong} opacity="0.35" /><circle cx="100" cy="150" r="7" fill={cream} />
            <circle cx="100" cy="78" r="52" fill={body} />
          </>
        ) : null}
        {variant === 'g' ? (
          <>
            <path d="M150 168C180 168 188 138 172 124" fill="none" stroke={body} strokeWidth="13" strokeLinecap="round" />
            {arms}
            <ellipse cx="80" cy="186" rx="13" ry="6" fill={strong} /><ellipse cx="120" cy="186" rx="13" ry="6" fill={strong} />
            <path d="M62 76L56 36L92 56Z" fill={body} stroke={body} strokeWidth="9" strokeLinejoin="round" />
            <path d="M138 76L144 36L108 56Z" fill={body} stroke={body} strokeWidth="9" strokeLinejoin="round" />
            <path d="M64 66L61 46L80 57Z" fill={ink} opacity="0.4" /><path d="M136 66L139 46L120 57Z" fill={ink} opacity="0.4" />
            <path d="M100 50C130 50 152 100 152 142C152 172 128 186 100 186C72 186 48 172 48 142C48 100 70 50 100 50Z" fill={body} />
            <circle cx="100" cy="74" r="9" fill={strong} opacity="0.35" /><circle cx="100" cy="74" r="5" fill={cream} />
          </>
        ) : null}
        {variant === 'h' ? (
          <>
            <circle cx="100" cy="110" r="78" fill={body} opacity="0.2" />
            <circle cx="100" cy="110" r="78" fill="none" stroke={body} strokeWidth="4" opacity="0.8" />
            <path d="M52 76Q62 54 84 48" fill="none" stroke={cream} strokeWidth="6" strokeLinecap="round" opacity="0.85" />
            {arms}
            <circle cx="100" cy="116" r="44" fill={body} />
          </>
        ) : null}
        {eye(-1)}
        {eye(1)}
        {brow(-1)}
        {brow(1)}
        <ellipse cx={100 - r.ex - 13} cy={r.ey + 17} rx="9" ry="5.5" fill="#ff9a8a" opacity={happy || wave ? 0.5 : 0.28} />
        <ellipse cx={100 + r.ex + 13} cy={r.ey + 17} rx="9" ry="5.5" fill="#ff9a8a" opacity={happy || wave ? 0.5 : 0.28} />
        {mouth}
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

// The 2D Fira: plain SVG, no hooks, so it renders on the server, without WebGL and under reduced
// motion. Every variant (a to h) and every emotion has one.
export function FiraFallback({ variant, emotion, className, style }: { variant: Variant; emotion: Emotion; className?: string; style?: CSSProperties }) {
  return isRoundTwo(variant) ? (
    <RoundTwo variant={variant as 'd' | 'e' | 'f' | 'g' | 'h'} emotion={emotion} className={className} style={style} />
  ) : (
    <RoundOne variant={variant as 'a' | 'b' | 'c'} emotion={emotion} className={className} style={style} />
  )
}
