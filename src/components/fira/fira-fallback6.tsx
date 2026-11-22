import type { CSSProperties, ReactNode } from 'react'
import type { Emotion } from '@/lib/fira/pose'
import { EYE_HALF6, detail6, laptopOpen6, rig6, screenHex6, targets6, type Turtle6 } from '@/lib/fira/turtle6'
import { eyePath } from './fira-fallback3'

// Round six in flat SVG (server HTML, no WebGL, reduced motion): the same rig in front view. Thin shell plate
// behind a one-colour body, tapered limbs with three claws each, blush, ink eyes with two highlights, the
// variant's accessories. Every part carries data-part so tests and the lab can see what is drawn.
const lime = 'var(--color-accent)'
const ink = 'var(--color-accent-ink)'
const cream = 'var(--color-paper)'
const pad = 'color-mix(in srgb, var(--color-accent-ink) 78%, var(--color-paper))'
const shellCol = 'color-mix(in srgb, var(--color-accent) 22%, var(--color-accent-ink))'
const f1 = (n: number) => Math.round(n * 10) / 10
const X = (x: number) => f1(100 + x * 58)
const Y = (y: number) => f1(190 - y * 70)

type Pose = { arm: [number, number]; armB: [number, number] }
function poseOf(emotion: Emotion, v: Turtle6): Pose {
  const d = detail6[v]
  const rest: [number, number] = [-0.6, 0.8], restB: [number, number] = [0.6, 0.8]
  if (laptopOpen6(v, emotion)) return { arm: [-0.4, 0.9], armB: [0.4, 0.9] }
  switch (emotion) {
    case 'wave': return { arm: [-0.85, 2.35], armB: restB }
    case 'point': return { arm: [-0.95, 1.75], armB: restB }
    case 'thinking': return { arm: [-0.2, 1.62], armB: restB }
    case 'listening': return { arm: d.headphones === 'head' ? [-0.54, 1.95] : d.headphones === 'neck' ? [-0.5, 1.95] : rest, armB: restB }
    case 'happy': return { arm: [-0.7, 1.5], armB: [0.7, 1.5] }
    case 'surprised': return { arm: [-0.72, 1.6], armB: [0.72, 1.6] }
    default: return { arm: rest, armB: restB }
  }
}

const claws = (x: number, y: number, dx: number, dy: number, key: string) =>
  [-1, 0, 1].map((c) => <circle key={`${key}${c}`} data-part="claw" cx={f1(x + c * dx)} cy={f1(y + dy + (c === 0 ? 1.2 : 0))} r="1.9" fill={cream} />)

export function FiraFallback6({ variant, emotion, ctx, className, style }: { variant: Turtle6; emotion: Emotion; ctx?: string; className?: string; style?: CSSProperties }) {
  const d = detail6[variant]
  const T = targets6[emotion]
  const P = poseOf(emotion, variant)
  const open = laptopOpen6(variant, emotion) > 0
  const hy = Y(rig6.head.y + (emotion === 'sleep' || emotion === 'sorry' ? -0.05 : 0)), hx = 100 + T.headRoll * -8
  const R = rig6.head.r * 70
  const earUp = d.headphones === 'neck' && emotion === 'listening'
  const k = R * 2
  const eyeY = hy + 1.5 - T.eyeY * EYE_HALF6 * k
  const w = EYE_HALF6 * k * 1.2 * T.eyeW, h = EYE_HALF6 * k * 1.2
  const sep = 11.2
  const eyes: ReactNode = [-1, 1].map((s) => {
    const cx = hx + s * sep + T.lookX * 3, cy = eyeY - T.lookY * 2
    return (
      <g key={s}>
        <path data-part="eye" d={eyePath(cx, cy, w, h * T.eyeH, T, s)} fill={ink} />
        <circle data-part="hl" cx={f1(cx - w * 0.3)} cy={f1(cy - h * T.eyeH * 0.34)} r={f1(w * 0.27)} fill={cream} />
        <circle data-part="hl" cx={f1(cx + w * 0.36)} cy={f1(cy + h * T.eyeH * 0.3)} r={f1(w * 0.12)} fill={cream} />
      </g>
    )
  })
  const brows: ReactNode = [-1, 1].map((s) => {
    const yb = eyeY - h * T.eyeH - 4.5 - T.browY * 2.5
    const a = -s * T.browTilt * 0.5
    const dx = Math.cos(a) * 5.5, dy = Math.sin(a) * 5.5
    return <path key={s} data-part="brow" d={`M${f1(hx + s * sep - dx)} ${f1(yb + dy)}L${f1(hx + s * sep + dx)} ${f1(yb - dy)}`} stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
  })
  const my = hy + 12, mw = 5.2 * T.mouthW, c = (T.smile + 0.4) * mw * 0.5
  const mouth: ReactNode = T.mouthO > 0.3 ? <ellipse data-part="mouth" cx={hx} cy={my} rx="2.4" ry="3" fill={ink} /> : <path data-part="mouth" d={`M${f1(hx - mw)} ${f1(my - c * 0.6)}Q${hx} ${f1(my + c * 1.4)} ${f1(hx + mw)} ${f1(my - c * 0.6)}`} fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" />
  const arm = (side: -1 | 1, to: [number, number], key: string) => {
    const sx = X(side * 0.47), sy = Y(1.46)
    return <path key={key} data-part="arm" d={`M${sx} ${sy}L${X(to[0])} ${Y(to[1])}`} stroke={lime} strokeWidth="13" strokeLinecap="round" />
  }
  const screen = screenHex6(ctx, 'var(--color-accent)')
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true" data-fira-fallback={variant}>
      <ellipse cx="100" cy="188" rx="44" ry="5" fill="currentColor" opacity="0.12" />
      <g data-part="shell">
        <ellipse cx="100" cy={Y(1.2)} rx="50" ry="44" fill={shellCol} />
        <path d="M62 70Q100 58 138 70M54 104Q100 90 146 104M100 52V94" stroke={lime} strokeWidth="1.4" fill="none" opacity="0.6" />
        <circle data-part="pearl-halo" cx="58" cy="82" r="8" fill={lime} opacity="0.28" />
        <circle data-part="pearl" cx="58" cy="82" r="4.6" fill={lime} />
      </g>
      <g fill={lime}>
        <path data-part="leg" d={`M${X(-0.5)} ${Y(0.8)}L${X(-0.12)} ${Y(0.8)}L${X(-0.1)} ${Y(0.1)}L${X(-0.44)} ${Y(0.1)}Z`} />
        <path data-part="leg" d={`M${X(0.5)} ${Y(0.8)}L${X(0.12)} ${Y(0.8)}L${X(0.1)} ${Y(0.1)}L${X(0.44)} ${Y(0.1)}Z`} />
        <ellipse cx={X(-0.28)} cy={Y(0.1)} rx="15" ry="7" />
        <ellipse cx={X(0.28)} cy={Y(0.1)} rx="15" ry="7" />
        <ellipse data-part="tail" cx="100" cy={Y(0.34)} rx="6" ry="4.5" />
        <ellipse data-part="body" cx="100" cy={Y(0.98)} rx="35" ry="50" />
        <ellipse cx="100" cy={Y(0.7)} rx="35" ry="27" />
      </g>
      {claws(X(-0.28), Y(0.02), 5.5, 0, 'lf')}
      {claws(X(0.28), Y(0.02), 5.5, 0, 'rf')}
      {d.headphones === 'neck' ? (
        <g data-part="headphones">
          <path d={`M${X(-0.3)} ${Y(1.3)}Q100 ${Y(1.08)} ${X(0.34)} ${Y(1.3)}`} stroke={ink} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <rect data-part="cup" x={X(0.34) - 6} y={Y(1.3) - 8} width="12" height="17" rx="5" fill={ink} />
          {earUp ? <rect data-part="cup" data-up="1" x={X(-0.5) - 6} y={hy - 8} width="12" height="17" rx="5" fill={ink} /> : <rect data-part="cup" x={X(-0.34) - 6} y={Y(1.3) - 8} width="12" height="17" rx="5" fill={ink} />}
        </g>
      ) : null}
      {d.laptop ? (
        <g data-part="laptop" data-open={open ? '1' : '0'}>
          {open ? (
            <>
              <rect x="74" y={Y(1.22)} width="52" height="32" rx="3" fill={pad} />
              <rect data-part="screen" x="77" y={Y(1.22) + 3} width="46" height="26" rx="1.5" fill={screen} opacity="0.9" />
              <path d={`M70 ${f1(Y(1.22) + 33)}L130 ${f1(Y(1.22) + 33)}L126 ${f1(Y(1.22) + 42)}L74 ${f1(Y(1.22) + 42)}Z`} fill={pad} />
            </>
          ) : (
            <rect x={X(0.7) - 3} y={Y(1.2)} width="7" height="30" rx="2" fill={pad} />
          )}
        </g>
      ) : null}
      {arm(-1, P.arm, 'a')}
      {arm(1, P.armB, 'b')}
      <circle cx={X(P.arm[0])} cy={Y(P.arm[1])} r="8.5" fill={lime} />
      <circle cx={X(P.armB[0])} cy={Y(P.armB[1])} r="8.5" fill={lime} />
      {claws(X(P.arm[0]), Y(P.arm[1]), 3.6, 8, 'la')}
      {claws(X(P.armB[0]), Y(P.armB[1]), 3.6, 8, 'ra')}
      <ellipse cx="100" cy={Y(1.68)} rx="17" ry="10" fill={lime} />
      <g data-part="head">
        {d.headphones === 'head' ? (
          <g data-part="headphones">
            <path d={`M${f1(hx - R * 1.1)} ${f1(hy)}A${f1(R * 1.1)} ${f1(R * 1.2)} 0 0 1 ${f1(hx + R * 1.1)} ${f1(hy)}`} stroke={ink} strokeWidth="3.6" fill="none" />
            {[-1, 1].map((s) => <rect key={s} data-part="cup" data-up={s < 0 && emotion === 'listening' ? '1' : undefined} x={f1(hx + s * R * 1.1 - 5.5)} y={f1(hy - 9)} width="11" height="20" rx="5" fill={ink} />)}
          </g>
        ) : null}
        <circle cx={hx} cy={hy} r={R} fill={lime} />
        {[-1, 1].map((s) => <ellipse key={s} data-part="blush" cx={f1(hx + s * R * 0.62)} cy={f1(hy + R * 0.22)} rx="5.6" ry="3.4" fill="#ff9a8a" opacity="0.6" />)}
        {eyes}
        {brows}
        {mouth}
        {d.glasses ? (
          <g data-part="glasses">
            {[-1, 1].map((s) => (
              <g key={s}>
                <circle data-part="lens" cx={hx + s * sep} cy={eyeY} r="8.4" fill={cream} fillOpacity="0.18" stroke={ink} strokeWidth="1.6" />
                <path data-part="glint" d={`M${f1(hx + s * sep - 5)} ${f1(eyeY - 3)}L${f1(hx + s * sep - 2)} ${f1(eyeY - 6)}`} stroke={cream} strokeWidth="1.5" strokeLinecap="round" />
              </g>
            ))}
            <path d={`M${f1(hx - 2)} ${f1(eyeY)}h4`} stroke={ink} strokeWidth="1.6" />
          </g>
        ) : null}
      </g>
    </svg>
  )
}
