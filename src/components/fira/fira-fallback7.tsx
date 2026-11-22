import { useId, type CSSProperties, type ReactNode } from 'react'
import type { Emotion } from '@/lib/fira/pose'
import { detail7, notesOn7, targets7, type Turtle7 } from '@/lib/fira/turtle7'

// Round seven in flat SVG (server HTML, no WebGL, reduced motion): traced from the owner's reference art
// (docs/fira-ref/ref-hero-glasses.jpg, 1080 px; the coordinates below are that image's pixels). Wide flattened
// head, half-lidded eyes with two highlights, round blush, cream plastron with 2 x 3 segments, teal shell on both
// sides, stubby arms, round feet with three pale toes, a tiny tail, a thin dark outline on every shape.
// Every part carries data-part so tests and the lab can see what is drawn.
const OUT = '#1f5a12'
const INK = '#1d2c18'
const f1 = (n: number) => Math.round(n * 10) / 10
type Pt = [number, number]
const SIDES = [-1, 1] as const
const SH: Pt[] = [[365, 535], [715, 535]]
function armEnds(emotion: Emotion, laptop: boolean): [Pt, Pt] {
  if (laptop) return [[415, 668], [665, 668]]
  switch (emotion) {
    case 'thinking': return [[445, 665], [785, 420]]
    case 'wave': return [[445, 665], [800, 400]]
    case 'point': return [[290, 455], [635, 665]]
    case 'sorry': return [[605, 700], [635, 665]]
    case 'happy': case 'listening': return [[430, 610], [650, 610]]
    case 'surprised': return [[415, 590], [665, 590]]
    default: return [[445, 665], [635, 665]]
  }
}

export function FiraFallback7({ variant, emotion, dark = false, className, style }: { variant: Turtle7; emotion: Emotion; dark?: boolean; className?: string; style?: CSSProperties }) {
  const d = detail7[variant]
  const T = targets7[emotion]
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [A, B] = armEnds(emotion, d.laptop)
  const roll = f1(-T.headRoll * 5)
  const lx = T.lookX * 9, ly = -T.lookY * 6
  const happy = T.bend > 0.5 && T.lidBot > 0.3
  const sleep = emotion === 'sleep'

  const eye = (s: -1 | 1): ReactNode => {
    const cx = 540 + s * 83, cy = 328 - T.eyeY * 8
    const w = 38 * T.eyeW, h = 48 * T.eyeH
    if (happy || sleep) {
      return <path key={s} data-part="eye" data-closed="1" d={`M${cx - 36} ${cy + 8}Q${cx} ${cy - 30} ${cx + 36} ${cy + 8}`} fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
    }
    const cp = `${id}e${s < 0 ? 'l' : 'r'}`
    const px = cx + lx, py = cy + ly + 6
    const lt = Math.min(0.85, T.lidTop + (s > 0 ? T.asym * 0.16 : 0)), lb = T.lidBot
    const yt = cy - h + 2 * h * lt, yb = cy + h - 2 * h * lb
    const tilt = T.slant * 8 * s
    const ell = `M${f1(cx - w)} ${cy}A${f1(w)} ${f1(h)} 0 1 1 ${f1(cx + w)} ${cy}A${f1(w)} ${f1(h)} 0 1 1 ${f1(cx - w)} ${cy}Z`
    const lidTop = `M${f1(cx - w - 6)} ${f1(cy - h - 8)}H${f1(cx + w + 6)}V${f1(yt + tilt)}Q${f1(cx)} ${f1(yt + h * 0.2)} ${f1(cx - w - 6)} ${f1(yt - tilt)}Z`
    const lidLow = `M${f1(cx - w - 6)} ${f1(cy + h + 8)}H${f1(cx + w + 6)}V${f1(yb)}Q${f1(cx)} ${f1(yb - h * 0.14)} ${f1(cx - w - 6)} ${f1(yb)}Z`
    return (
      <g key={s}>
        <clipPath id={cp}><path d={ell} /></clipPath>
        <path data-part="eye" d={ell} fill="#eef8cf" />
        <g clipPath={`url(#${cp})`}>
          <ellipse cx={f1(px)} cy={f1(py)} rx={f1(w * 0.82)} ry={f1(h * 0.8)} fill="#3a4638" />
          <circle cx={f1(px)} cy={f1(py)} r={f1(w * 0.47)} fill="#17231a" />
          <circle data-part="hl" cx={f1(px - w * 0.27)} cy={f1(py - h * 0.28)} r={f1(w * 0.28)} fill="#fff" />
          <circle data-part="hl" cx={f1(px + w * 0.36)} cy={f1(py + h * 0.14)} r={f1(w * 0.12)} fill="#fff" />
          {lt > 0.01 ? <path data-part="lid" d={lidTop} fill="#94de3c" stroke={INK} strokeWidth="4" strokeLinejoin="round" /> : null}
          {lb > 0.01 ? <path d={lidLow} fill="#94de3c" stroke={INK} strokeWidth="3" /> : null}
        </g>
        <path d={ell} fill="none" stroke={OUT} strokeWidth="3.5" />
      </g>
    )
  }
  const brow = (s: -1 | 1): ReactNode => {
    const cx = 540 + s * 83 + lx * 0.5
    const raise = T.browY * 9 + (s > 0 ? T.asym * 16 : 0)
    const y = (d.glasses ? 246 : 262) - raise - T.eyeY * 6
    const a = -s * T.browTilt * 0.28
    const dx = Math.cos(a) * 21, dy = Math.sin(a) * 21
    return <path key={s} data-part="brow" d={`M${f1(cx - dx)} ${f1(y + dy + 4)}Q${f1(cx)} ${f1(y - 5)} ${f1(cx + dx)} ${f1(y - dy + 4)}`} fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
  }
  const my = 424
  const mouth: ReactNode = T.mouthO > 0.4
    ? <ellipse data-part="mouth" cx={540 + lx * 0.4} cy={my + 8} rx="12" ry="17" fill="#e8707e" stroke={INK} strokeWidth="4" />
    : emotion === 'talking'
      ? <ellipse data-part="mouth" cx="540" cy={my + 6} rx="26" ry="14" fill="#7d2230" stroke={INK} strokeWidth="4" />
      : T.smile > 0.85
        ? <g data-part="mouth"><path d="M484 412Q540 474 598 412Q540 424 484 412Z" fill="#8a1f2a" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" /><ellipse cx="545" cy="436" rx="20" ry="8" fill="#e8707e" /></g>
        : <path data-part="mouth" d={`M${f1(482 + lx * 0.4)} ${f1(my + 4 - T.smile * 6)}Q${f1(540 + lx * 0.4)} ${f1(my + 4 + T.smile * 28 + 2)} ${f1(600 + lx * 0.4)} ${f1(my - T.smile * 6)}`} fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />

  const arm = (k: number, to: Pt) => {
    const [sx, sy] = SH[k]!
    return (
      <g key={k} data-part="arm">
        <path d={`M${sx} ${sy}L${to[0]} ${to[1]}`} stroke={OUT} strokeWidth="76" strokeLinecap="round" />
        <path d={`M${sx} ${sy}L${to[0]} ${to[1]}`} stroke={`url(#${id}a)`} strokeWidth="64" strokeLinecap="round" />
        <circle cx={f1(sx + (to[0] - sx) * 0.1 + (k ? 12 : -12))} cy={f1(sy + (to[1] - sy) * 0.14 + 8)} r="10" fill="#fff" opacity="0.5" />
      </g>
    )
  }
  const cup = (s: -1 | 1) => (
    <g key={s} data-part="cup">
      <rect x={540 + s * 230 - 30} y="278" width="60" height="108" rx="28" fill="#2b3a2b" stroke="#0f170f" strokeWidth="6" />
      <circle data-part="ring" cx={540 + s * 230} cy="332" r="21" fill="none" stroke="#c6ff3d" strokeWidth="8" filter={dark ? `url(#${id}g)` : undefined} />
    </g>
  )
  const lens = (s: -1 | 1): ReactNode => (
    <g key={s}>
      <circle data-part="lens" cx={540 + s * 83} cy="326" r="68" fill="#fff" fillOpacity="0.16" stroke="#161b16" strokeWidth="11" />
      <path data-part="glint" d={`M${540 + s * 83 - 44} ${300}Q${540 + s * 83 - 36} ${280} ${540 + s * 83 - 18} ${272}`} fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity="0.8" />
    </g>
  )
  return (
    <svg viewBox="80 70 920 920" className={className} style={style} aria-hidden="true" data-fira-fallback={variant} data-outline="1">
      <defs>
        <radialGradient id={`${id}h`} cx="0.5" cy="0.3" r="0.75"><stop offset="0" stopColor="#c8fb6c" /><stop offset="0.6" stopColor="#9fe93c" /><stop offset="1" stopColor="#82d92d" /></radialGradient>
        <radialGradient id={`${id}b`} cx="0.5" cy="0.4" r="0.8"><stop offset="0" stopColor="#b6f352" /><stop offset="1" stopColor="#86de2e" /></radialGradient>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c5fa62" /><stop offset="1" stopColor="#93e535" /></linearGradient>
        <radialGradient id={`${id}p`} cx="0.5" cy="0.35" r="0.8"><stop offset="0" stopColor="#fff3c4" /><stop offset="1" stopColor="#f6e2a0" /></radialGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3cb577" /><stop offset="1" stopColor="#20805a" /></linearGradient>
        <filter id={`${id}g`} x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="7" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <ellipse data-part="shadow" cx="540" cy="962" rx="245" ry="22" fill="currentColor" opacity="0.13" />
      <g data-part="shell" stroke={OUT} strokeWidth="6" strokeLinejoin="round">
        <ellipse cx="540" cy="632" rx="268" ry="250" fill={`url(#${id}s)`} />
        {[[[292, 505], [345, 468], [398, 495], [405, 555], [350, 590], [296, 560]], [[275, 650], [330, 622], [345, 690], [330, 735], [280, 722]], [[788, 505], [735, 468], [682, 495], [675, 555], [730, 590], [784, 560]], [[805, 650], [750, 622], [735, 690], [750, 735], [800, 722]]].map((pts, i) => (
          <polygon key={i} data-part="scute" points={pts.map((p) => p.join(',')).join(' ')} fill="#62d999" />
        ))}
        <path d="M312 600L330 700M768 600L750 700" fill="none" strokeWidth="4" opacity="0.6" />
      </g>
      <path data-part="tail" d="M688 836L744 850L742 858L722 874L690 868Z" fill="#a7f339" stroke={OUT} strokeWidth="5" strokeLinejoin="round" />
      <g stroke={OUT} strokeWidth="6">
        {[-1, 1].map((s) => (
          <g key={s} data-part="foot">
            <ellipse cx={540 + s * 107} cy="915" rx="85" ry="50" fill="#7ed32d" />
            {[-1, 0, 1].map((c) => <ellipse key={c} data-part="toe" cx={540 + s * 107 + c * 34} cy={945 - (c === 0 ? 0 : 2)} rx="13" ry="10" fill="#dcf892" strokeWidth="4" />)}
          </g>
        ))}
        <path data-part="body" d="M540 470C690 470 756 565 756 700C756 830 668 912 540 912C412 912 325 830 325 700C325 565 392 470 540 470Z" fill={`url(#${id}b)`} />
      </g>
      <g data-part="plastron">
        <ellipse cx="540" cy="678" rx="155" ry="188" fill={`url(#${id}p)`} stroke="#e8c870" strokeWidth="5" />
        <g stroke="#eacf80" strokeWidth="4.5" fill="none" strokeLinecap="round">
          <path data-part="seg" d="M540 492V864" />
          <path data-part="seg" d="M388 624Q540 634 692 620" />
          <path data-part="seg" d="M390 745Q540 755 690 741" />
        </g>
      </g>
      {d.laptop ? (
        <g data-part="laptop" stroke="#0f170f" strokeWidth="6">
          <rect x="352" y="650" width="376" height="208" rx="16" fill="#243224" />
          <rect x="330" y="852" width="420" height="30" rx="10" fill="#33433a" />
          <path data-part="logo" d="M540 712l32 18v38l-32 18l-32-18v-38z" fill="none" stroke="#c6ff3d" strokeWidth="10" strokeLinejoin="round" filter={dark ? `url(#${id}g)` : undefined} />
        </g>
      ) : null}
      {d.headphones ? <g data-part="band"><path d="M312 300C296 30 784 30 768 300" fill="none" stroke="#0f170f" strokeWidth="30" strokeLinecap="round" /><path d="M312 300C296 30 784 30 768 300" fill="none" stroke="#2b3a2b" strokeWidth="19" strokeLinecap="round" /></g> : null}
      <g data-part="head" transform={`rotate(${roll} 540 317)`}>
        <path d="M324 330C324 200 420 140 540 140C660 140 756 200 756 330C756 430 660 497 540 497C420 497 324 430 324 330Z" fill={`url(#${id}h)`} stroke={OUT} strokeWidth="7" strokeLinejoin="round" />
        <ellipse cx="540" cy="440" rx="112" ry="44" fill="#c4f77a" opacity="0.45" />
        <path d="M395 196Q430 168 492 160" fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" opacity="0.5" />
        <circle cx="630" cy="190" r="12" fill="#fff" opacity="0.5" /><circle cx="660" cy="212" r="7" fill="#fff" opacity="0.45" />
        {[-1, 1].map((s) => <ellipse key={s} data-part="blush" cx={540 + s * 125 + lx * 0.3} cy="412" rx="42" ry="25" fill="#c8a257" opacity="0.5" />)}
        {SIDES.map(eye)}
        <circle cx={f1(522 + lx * 0.5)} cy="384" r="4.5" fill={INK} /><circle cx={f1(558 + lx * 0.5)} cy="384" r="4.5" fill={INK} />
        {mouth}
        {d.glasses ? (
          <g data-part="glasses">
            {SIDES.map(lens)}
            <path d="M522 318Q540 308 558 318" fill="none" stroke="#161b16" strokeWidth="9" />
            <path d="M392 302L326 298M688 302L754 298" stroke="#161b16" strokeWidth="9" strokeLinecap="round" />
          </g>
        ) : null}
        {SIDES.map(brow)}
        {d.headphones ? SIDES.map(cup) : null}
      </g>
      {arm(0, A)}
      {arm(1, B)}
      {notesOn7(variant, emotion, dark)
        ? [[225, 250, 74], [845, 190, 64], [770, 110, 54]].map(([x, y, fs], i) => <text key={i} data-part="note" x={x} y={y} fontSize={fs} fill="#c6ff3d" filter={`url(#${id}g)`}>{i === 1 ? '♫' : '♪'}</text>)
        : null}
    </svg>
  )
}
