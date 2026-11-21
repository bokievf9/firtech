import type { CSSProperties, ReactNode } from 'react'
import type { Emotion, RoundThree } from '@/lib/fira/pose'
import { eyeSpec, target3, type T3 } from '@/lib/fira/pose3'

// Round three in flat SVG (server HTML, no WebGL, reduced motion, favicons and stickers). The eyes
// come from the same targets as the 3D (pose3.ts): an ellipse or rounded rectangle cut by the lids,
// so every emotion keeps its shape here too. Colours are the site tokens only.
const lime = 'var(--color-accent)'
const ink = 'var(--color-accent-ink)'
const cream = 'var(--color-paper)'
const f1 = (n: number) => Math.round(n * 10) / 10

// One eye as a polygon: the outline sampled and clamped between the top lid line (with its slant)
// and the bottom cut (which bends into a ∩ arc). side -1 is the eye on the viewer's left.
export function eyePath(cx: number, cy: number, w: number, h0: number, T: Pick<T3, 'lidTop' | 'lidBot' | 'bend' | 'slant' | 'asym'>, side: number, round = 0, n = 32): string {
  let h = h0, lt = T.lidTop
  if (side > 0) {
    h *= 1 - 0.32 * T.asym
    lt += 0.2 * T.asym
  } else if (side < 0) h *= 1 + 0.08 * T.asym
  h = Math.max(h, 0.6)
  const pts: string[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const c = Math.cos(a), s = Math.sin(a)
    const e = round ? 0.35 : 1
    const x = w * Math.sign(c) * Math.pow(Math.abs(c), e)
    let y = h * Math.sign(s) * Math.pow(Math.abs(s), e)
    const xn = Math.max(-1, Math.min(1, x / w))
    const top = h * (1 - 2 * lt) - T.slant * x * side * 0.8
    const bot = -h + 2 * h * T.lidBot + T.bend * 0.55 * h * (1 - xn * xn)
    y = Math.max(Math.min(y, top), Math.min(bot, top))
    pts.push(`${f1(cx + x)} ${f1(cy - y)}`)
  }
  return `M${pts.join('L')}Z`
}

type Face = { cx: number; cy: number; sep: number; w: number; h: number; k: number; round?: number; mark?: boolean; mouth?: [number, number]; brow?: [number, number]; ring?: boolean }

function eyes(f: Face, T: T3): ReactNode {
  const w = f.w * T.eyeW, h = f.h * T.eyeH, y = f.cy - T.eyeY * f.h + -T.lookY * f.k * 0.06
  const x0 = f.cx + T.lookX * f.k * 0.1
  const fill = f.mark ? ink : lime
  const sides = f.sep ? [-1, 1] : [0]
  return sides.map((side) => {
    const d = eyePath(x0 + side * f.sep, y, w, h, T, side, f.round)
    if (f.ring && T.ring > 0.5) return <path key={side} d={d} fill="none" stroke={fill} strokeWidth={f1(Math.min(w, h) * 0.5)} />
    return (
      <g key={side}>
        {f.mark ? null : <path d={d} fill="none" stroke={lime} strokeWidth={f1(h * 0.9 + 2)} strokeLinejoin="round" opacity={f1(0.12 + T.glow * 0.2)} />}
        <path d={d} fill={fill} opacity={f.mark ? 1 : f1(0.55 + T.glow * 0.45)} />
      </g>
    )
  })
}

function mouth(f: Face, T: T3, sw: number): ReactNode {
  if (!f.mouth) return null
  const [my, mw0] = f.mouth
  const x0 = f.cx + T.lookX * f.k * 0.05, y = f.cy + my
  const mw = mw0 * T.mouthW
  if (T.mouthO > 0.3) return <ellipse cx={x0} cy={y} rx={f1(mw * 0.34)} ry={f1(mw * 0.42)} fill={ink} />
  const c = T.smile * mw * 0.5
  return <path d={`M${f1(x0 - mw)} ${f1(y - c * 0.6)}Q${f1(x0)} ${f1(y + c * 1.4)} ${f1(x0 + mw)} ${f1(y - c * 0.6)}`} fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />
}

function brows(f: Face, T: T3, sw: number): ReactNode {
  if (!f.brow) return null
  const [gap, len] = f.brow
  return [-1, 1].map((side) => {
    const x = f.cx + side * f.sep, y = f.cy - T.eyeY * f.h - f.h * T.eyeH - gap - T.browY * f.k * 0.05
    const a = -side * T.browTilt * 0.5
    const dx = Math.cos(a) * len, dy = Math.sin(a) * len
    return <path key={side} d={`M${f1(x - dx)} ${f1(y + dy)}L${f1(x + dx)} ${f1(y - dy)}`} stroke={ink} strokeWidth={sw} strokeLinecap="round" />
  })
}

const deg = (r: number) => f1((r * 180) / Math.PI)

export function FiraFallback3({ variant, emotion, className, style }: { variant: RoundThree; emotion: Emotion; className?: string; style?: CSSProperties }) {
  const T = target3(variant, emotion)
  const roll = deg(-(T.roll + T.headRoll * 0.5 + T.wave * 0.06))
  const glow = f1(0.15 + T.glow * 0.3)
  let fig: ReactNode
  if (variant === 'i') {
    const k = 140 / 2.2, top = 32 - T.lift * 120 + T.lean * 10
    const face: Face = { cx: 100, cy: top + 140 - 1.5 * k, sep: 0.2 * k, w: 0.14 * k, h: eyeSpec.i.eyeHalf * k, k }
    fig = (
      <g transform={`rotate(${roll} 100 120)`}>
        <path d={`M100 ${top}C130 ${top} 144 ${top + 50} 144 ${top + 86}C144 ${top + 122} 124 ${top + 140} 100 ${top + 140}C76 ${top + 140} 56 ${top + 122} 56 ${top + 86}C56 ${top + 50} 70 ${top} 100 ${top}Z`} fill={lime} />
        <rect x="60" y={f1(face.cy - 17)} width="80" height="34" rx="15" fill={ink} />
        {eyes(face, T)}
      </g>
    )
  } else if (variant === 'j') {
    const k = 76, hy = 73 + T.head * 20
    const face: Face = { cx: 100 + T.yaw * 20, cy: hy, sep: 0, w: eyeSpec.j.eyeHalf * k, h: eyeSpec.j.eyeHalf * k, k, round: 0, ring: true }
    fig = (
      <g transform={`rotate(${roll} 100 160)`}>
        <path d="M53 188A47 32 0 0 1 147 188Z" fill={cream} stroke={ink} strokeOpacity="0.12" />
        <path d="M77 162L85 108H115L123 162Z" fill={lime} />
        <g transform={`rotate(${deg(-T.headRoll)} 100 ${hy})`}>
          <circle cx="100" cy={hy} r="40" fill={lime} />
          <circle cx={face.cx} cy={hy} r="22" fill={ink} />
          <circle cx={f1(face.cx + T.lookX * 7)} cy={f1(hy - T.lookY * 6)} r="9" fill={lime} opacity={f1(glow * 0.6)} />
          {eyes(face, T)}
        </g>
      </g>
    )
  } else if (variant === 'k') {
    const k = 76
    const face: Face = { cx: 100, cy: 121, sep: 0.3 * k, w: 0.11 * k, h: eyeSpec.k.eyeHalf * k, k, round: 1 }
    const ax = 132 - T.arm * 6 - T.roll * 20
    fig = (
      <g transform={`rotate(${roll} 100 188)`}>
        <path d={`M132 60L${f1(ax)} 39`} stroke={ink} strokeWidth="3.4" strokeLinecap="round" />
        <circle cx={f1(ax)} cy="36" r="11" fill={lime} opacity={glow} />
        <circle cx={f1(ax)} cy="36" r="5.8" fill={lime} />
        <rect x="30" y="59" width="140" height="129" rx="24" fill={lime} />
        <rect x="55" y="82" width="90" height="78" rx="15" fill={ink} />
        {eyes(face, T)}
      </g>
    )
  } else if (variant === 'l') {
    const k = 66, hy = 52 + T.head * 18 + T.lean * 10 - T.lift * 80
    const face: Face = { cx: 100 + T.yaw * 14, cy: hy - 0.06 * k, sep: 0.15 * k, w: eyeSpec.l.eyeHalf * k, h: eyeSpec.l.eyeHalf * k, k, mark: true, mouth: [0.19 * k, 0.085 * k] }
    const arm = Math.max(T.arm, T.wave)
    fig = (
      <g transform={`rotate(${roll} 100 188)`}>
        {arm > 0.5 ? <path d={T.arm > 0.5 ? 'M112 104L146 92' : 'M112 104L134 74'} stroke={cream} strokeWidth="6" strokeLinecap="round" /> : null}
        <path d="M100 81C110 81 113 86 113 96C113 124 128 150 128 172C128 184 118 188 100 188C82 188 72 184 72 172C72 150 87 124 87 96C87 86 90 81 100 81Z" fill={cream} stroke={ink} strokeOpacity="0.14" />
        <g transform={`rotate(${deg(-T.headRoll)} 100 ${f1(hy + 30)})`}>
          <circle cx="100" cy={f1(hy)} r="30" fill={lime} />
          {eyes(face, T)}
          {mouth(face, T, 1.6)}
        </g>
      </g>
    )
  } else {
    const k = 80, cy = 96 - T.lift * 100
    const face: Face = { cx: 100 + T.yaw * 18, cy: cy - 0.1 * k, sep: 0.3 * k, w: 0.12 * k, h: eyeSpec.m.eyeHalf * k, k, round: 1, mark: true, mouth: [0.42 * k, 0.17 * k], brow: [0.22 * k, 0.075 * k] }
    fig = (
      <g transform={`rotate(${roll} 100 ${cy})`}>
        <ellipse cx="100" cy={f1(cy)} rx={f1(76 * Math.cos(T.yaw))} ry={f1(76 * (1 - Math.abs(T.lean) * 0.25))} fill={lime} />
        {eyes(face, T)}
        {brows(face, T, 2.8)}
        {mouth(face, T, 2.8)}
      </g>
    )
  }
  const hover = variant === 'i' || variant === 'm'
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} data-fira-svg={`${variant}-${emotion}`} aria-hidden="true" focusable="false">
      <ellipse cx="100" cy="191" rx={hover ? 36 : 50} ry="5.5" fill={ink} opacity={hover ? 0.1 : 0.15} />
      {fig}
      {emotion === 'sleep' ? (
        <g fill="none" stroke={ink} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.45">
          <path d="M150 52h14l-14 16h14" />
          <path d="M170 28h10l-10 12h10" />
        </g>
      ) : null}
    </svg>
  )
}
