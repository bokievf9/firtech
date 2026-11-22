import type { CSSProperties, ReactNode } from 'react'
import type { Emotion } from '@/lib/fira/pose'
import { EYE_HALF5, detail5, segmentGlow, targets5, tintHex, type Turtle5 } from '@/lib/fira/turtle5'
import { eyePath } from './fira-fallback3'

// Round five in flat SVG (server HTML, no WebGL, reduced motion). The same rig in front view: shell
// peeking out behind, body and belly, two legs, two arms in the pose of the emotion, a head with the
// face plate (eyes and brows from the same targets as the 3D), then the variant's detail. Every part
// carries data-part so the tests and the lab can see which detail is drawn.
const lime = 'var(--color-accent)'
const ink = 'var(--color-accent-ink)'
const cream = 'var(--color-paper)'
const shellCol = 'color-mix(in srgb, var(--color-accent) 22%, var(--color-accent-ink))'
const f1 = (n: number) => Math.round(n * 10) / 10
const X = (x: number) => f1(100 + x * 58)
const Y = (y: number) => f1(192 - y * 63)

// Lamp positions of the eleven shell segments in this view (crown, inner ring, outer ring; ids as in turtle5.ts).
const SEGPOS: [number, number][] = [[100, 74], [132, 90], [78, 104], [144, 112], [130, 140], [100, 148], [70, 140], [62, 116], [68, 134], [142, 132], [124, 100]]

type Pose = { arm: [number, number]; armB: [number, number] }
function poseOf(emotion: Emotion, v: Turtle5): Pose {
  const rest: [number, number] = [-0.66, 0.96], restB: [number, number] = [0.66, 0.96]
  switch (emotion) {
    case 'wave': return { arm: [-0.84, 2.4], armB: restB }
    case 'point': return { arm: [-1.0, 1.75], armB: restB }
    case 'thinking': return { arm: [-0.6, 2.28], armB: restB }
    case 'listening': return { arm: detail5[v].listen === 'adjust' ? [-0.34, 2.28] : detail5[v].listen === 'ear' ? [-0.66, 2.12] : rest, armB: restB }
    case 'happy': return { arm: [-0.7, 1.5], armB: [0.7, 1.5] }
    case 'surprised': return { arm: [-0.72, 1.6], armB: [0.72, 1.6] }
    default: return { arm: rest, armB: restB }
  }
}

export function FiraFallback5({ variant, emotion, ctx, className, style }: { variant: Turtle5; emotion: Emotion; ctx?: string; className?: string; style?: CSSProperties }) {
  const d = detail5[variant]
  const T = targets5[emotion]
  const P = poseOf(emotion, variant)
  const headY = 2.18 + (emotion === 'sleep' || emotion === 'sorry' ? -0.06 : 0), hx = 100 + T.headRoll * -8, hy = Y(headY)
  const R = 34
  const earUp = d.headphones && emotion === 'listening'
  const lamps = d.segments ? segmentGlow(emotion, ctx) : []
  const k = 68 // head height in svg units
  const eyeY = hy + 2 - T.eyeY * EYE_HALF5 * k
  const w = EYE_HALF5 * k * 1.25 * T.eyeW, h = EYE_HALF5 * k * 1.25
  const eyes: ReactNode = [-1, 1].map((s) => (
    <path key={s} data-part="eye" d={eyePath(hx + s * 11.5 + T.lookX * 3, eyeY - T.lookY * 2, w, h * T.eyeH, T, s)} fill={lime} />
  ))
  const brows: ReactNode = [-1, 1].map((s) => {
    const yb = eyeY - h * T.eyeH - 5 - T.browY * 2.5
    const a = -s * T.browTilt * 0.5
    const dx = Math.cos(a) * 6.5, dy = Math.sin(a) * 6.5
    return <path key={s} data-part="brow" d={`M${f1(hx + s * 11.5 - dx)} ${f1(yb + dy)}L${f1(hx + s * 11.5 + dx)} ${f1(yb - dy)}`} stroke={lime} strokeWidth="2.6" strokeLinecap="round" />
  })
  const my = hy + 17, mw = 6 * T.mouthW, c = (T.smile + 0.4) * mw * 0.5
  const mouth: ReactNode = T.mouthO > 0.3 ? <ellipse data-part="mouth" cx={hx} cy={my} rx="2.6" ry="3.3" fill={lime} /> : <path data-part="mouth" d={`M${f1(hx - mw)} ${f1(my - c * 0.6)}Q${hx} ${f1(my + c * 1.4)} ${f1(hx + mw)} ${f1(my - c * 0.6)}`} fill="none" stroke={lime} strokeWidth="2.2" strokeLinecap="round" />
  const arm = (side: -1 | 1, to: [number, number], key: string) => {
    const sx = X(side * 0.46), sy = Y(1.58)
    return <path key={key} data-part="arm" d={`M${sx} ${sy}L${X(to[0])} ${Y(to[1])}`} stroke={lime} strokeWidth="15" strokeLinecap="round" />
  }
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true" data-fira-fallback={variant}>
      <ellipse cx="100" cy="190" rx="44" ry="5" fill="currentColor" opacity="0.12" />
      <g data-part="shell">
        <ellipse cx="100" cy={Y(1.28)} rx="46" ry="42" fill={shellCol} />
        <path d="M70 62Q100 52 130 62M58 100Q100 84 142 100M100 52V90" stroke={lime} strokeWidth="1.4" fill="none" opacity="0.6" />
        {SEGPOS.map(([cx, cy], i) => {
          const g = lamps.find((l) => l.seg === i)
          return g ? <ellipse key={i} data-part="lamp" data-seg={i} cx={cx} cy={cy} rx="9" ry="7" fill={g.tint === 'lime' ? lime : tintHex[g.tint]} opacity={f1(0.35 + g.amt * 0.6)} /> : null
        })}
        <circle data-part="pearl-halo" cx="68" cy="80" r="9" fill={lime} opacity="0.28" />
        <circle data-part="pearl" cx="68" cy="80" r="5" fill={lime} />
      </g>
      <g fill={lime}>
        <ellipse cx={X(-0.27)} cy={Y(0.3)} rx="12" ry="21" />
        <ellipse cx={X(0.27)} cy={Y(0.3)} rx="12" ry="21" />
        <ellipse cx={X(-0.27)} cy={Y(0.1)} rx="15" ry="7.5" />
        <ellipse cx={X(0.27)} cy={Y(0.1)} rx="15" ry="7.5" />
        <ellipse data-part="body" cx="100" cy={Y(1.1)} rx="32" ry="43" />
        <ellipse cx="100" cy={Y(0.9)} rx="33" ry="27" />
      </g>
      <ellipse cx="100" cy={Y(1.06)} rx="23" ry="34" fill={cream} />
      {arm(-1, P.arm, 'a')}
      {arm(1, P.armB, 'b')}
      <circle cx={X(P.arm[0])} cy={Y(P.arm[1])} r="9.5" fill={lime} />
      <circle cx={X(P.armB[0])} cy={Y(P.armB[1])} r="9.5" fill={lime} />
      {d.headphones ? (
        <g data-part="headphones">
          <path d={`M${X(-0.34)} ${Y(1.62)}Q100 ${Y(1.2)} ${X(0.34)} ${Y(1.62)}`} stroke={ink} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <rect data-part="cup" x={X(0.34) - 6} y={Y(1.62) - 9} width="12" height="18" rx="5" fill={ink} />
          {earUp ? <rect data-part="cup" data-up="1" x={X(-0.66) - 6} y={hy - 9} width="12" height="18" rx="5" fill={ink} /> : <rect data-part="cup" x={X(-0.34) - 6} y={Y(1.62) - 9} width="12" height="18" rx="5" fill={ink} />}
        </g>
      ) : null}
      <ellipse cx="100" cy={Y(1.84)} rx="23" ry="13" fill={lime} />
      <g data-part="head">
        <circle cx={hx} cy={hy} r={R} fill={lime} />
        <rect x={hx - 26} y={f1(hy - 16)} width="52" height="38" rx="17" fill={ink} opacity="0.92" />
        {eyes}
        {brows}
        {mouth}
        {d.glasses ? (
          <g data-part="glasses">
            {[-1, 1].map((s) => (
              <g key={s}>
                <circle data-part="lens" cx={hx + s * 11.5} cy={eyeY} r="9.6" fill={cream} fillOpacity="0.18" stroke={cream} strokeWidth="1.8" />
                <path data-part="glint" d={`M${f1(hx + s * 11.5 - 5)} ${f1(eyeY - 3)}L${f1(hx + s * 11.5 - 2)} ${f1(eyeY - 6)}`} stroke={cream} strokeWidth="1.6" strokeLinecap="round" />
              </g>
            ))}
            <path d={`M${f1(hx - 2)} ${f1(eyeY)}h4`} stroke={cream} strokeWidth="1.6" />
          </g>
        ) : null}
      </g>
    </svg>
  )
}
