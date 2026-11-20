import type { CSSProperties, ReactNode } from 'react'
import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import type { ProductId } from '@/lib/products'

type DemoCopy = Dict['products']['demo']

// Small animated interfaces, one per product: a booking confirmed, a bot replying, a report
// filling, a post approved, a mini-app cart, a reminder answered, an answer with its source.
// Plain markup and CSS (`.pd` in globals.css): at rest it shows the final state; when it plays
// (`play`, or the card is hovered or focused) the steps replay one by one. No JavaScript, so the
// same component works in server cards and in the hero's client stage. Decorative: aria-hidden.
export function ProductDemo({
  id,
  copy,
  play = false,
  className,
}: {
  id: ProductId
  copy: DemoCopy
  play?: boolean
  className?: string
}) {
  return (
    <div aria-hidden="true" className={cn('pd', play && 'pd-play', className)}>
      {demos[id](copy)}
    </div>
  )
}

// One step of the sequence: appears `ms` after the demo starts playing.
function Step({
  ms,
  className,
  children,
  as: Tag = 'div',
  style,
}: {
  ms: number
  className?: string
  children?: ReactNode
  as?: 'div' | 'span' | 'li'
  style?: CSSProperties
}) {
  return (
    <Tag data-step className={className} style={{ ...style, '--d': `${ms}ms` } as CSSProperties}>
      {children}
    </Tag>
  )
}

const bubbleIn = 'max-w-[88%] rounded-2xl rounded-bl-md bg-surface-2 px-3 py-2 text-[12.5px] leading-snug'
const bubbleOut =
  'ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-accent px-3 py-2 text-[12.5px] leading-snug text-accent-ink'
const chip = 'rounded-full border border-line-strong px-2.5 py-1 font-mono text-[11px]'
const ok = 'flex items-center gap-1.5 text-[12px] text-accent-text'

function Tick() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none">
      <circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.8 8.2l2.1 2.1 4.3-4.6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function Typing({ ms }: { ms: number }) {
  return (
    <Step
      ms={ms}
      className="pd-typing absolute top-0 left-0 flex w-12 gap-1 rounded-2xl rounded-bl-md bg-surface-2 px-3 py-2.5"
    >
      <span className="typing-dot size-1.5 rounded-full bg-muted" />
      <span className="typing-dot size-1.5 rounded-full bg-muted [animation-delay:0.15s]" />
      <span className="typing-dot size-1.5 rounded-full bg-muted [animation-delay:0.3s]" />
    </Step>
  )
}

const demos: Record<ProductId, (t: DemoCopy) => ReactNode> = {
  admin: (t) => (
    <div className="grid gap-2.5">
      <div className="flex items-center justify-between text-[12px] text-muted">
        <span className="font-medium text-fg">{t.admin.title}</span>
        <span className="font-mono">{t.admin.day}</span>
      </div>
      <div className="flex gap-2">
        {t.admin.slots.map((slot, i) => (
          <Step
            key={slot}
            ms={150 + i * 120}
            className={cn(
              chip,
              'flex-1 text-center',
              i === 1 && 'pd-pick border-accent-text bg-accent/15 text-accent-text',
            )}
          >
            {slot}
          </Step>
        ))}
      </div>
      <Step ms={900} className={cn(ok, 'pd-pop rounded-xl border border-accent-text/30 bg-accent/10 px-3 py-2')}>
        <Tick />
        {t.admin.confirmed}
      </Step>
      <Step ms={1250} className="text-[11.5px] text-faint">
        {t.admin.reminder}
      </Step>
    </div>
  ),
  receptionist: (t) => (
    <div className="grid gap-2">
      <div className="flex gap-1.5">
        {t.receptionist.channels.map((c, i) => (
          <span key={c} className={cn(chip, i === 1 && 'border-accent-text/50 text-accent-text')}>
            {c}
          </span>
        ))}
      </div>
      <Step ms={150} className={bubbleOut}>
        {t.receptionist.user}
      </Step>
      <div className="relative">
        <Typing ms={550} />
        <Step ms={1300} className={bubbleIn}>
          {t.receptionist.bot}
        </Step>
      </div>
      <Step ms={1750} className={ok}>
        <Tick />
        {t.receptionist.lead}
      </Step>
    </div>
  ),
  automation: (t) => (
    <div className="grid gap-2">
      <p className="text-[12px] font-medium">{t.automation.title}</p>
      {t.automation.rows.map((row, i) => (
        <div key={row} className="grid grid-cols-[5.5rem_1fr] items-center gap-2 text-[11.5px] text-muted">
          <span className="truncate">{row}</span>
          <span className="h-2 overflow-hidden rounded-full bg-surface-2">
            <Step
              as="span"
              ms={150 + i * 160}
              className="pd-bar block h-full rounded-full bg-accent/80"
              style={{ width: `${88 - i * 19}%` }}
            />
          </span>
        </div>
      ))}
      <Step ms={1100} className={cn(ok, 'mt-0.5')}>
        <Tick />
        {t.automation.sent}
      </Step>
    </div>
  ),
  content: (t) => (
    <div className="grid gap-2.5">
      <p className="text-[12px] font-medium">{t.content.title}</p>
      <div className="grid grid-cols-4 gap-1.5">
        {t.content.days.map((day, i) => (
          <Step
            key={day}
            ms={120 + i * 110}
            className={cn(
              'grid aspect-square place-items-end rounded-lg border border-line p-1.5 font-mono text-[10px] text-faint',
              i === 1 && 'border-accent-text/50 bg-[linear-gradient(150deg,var(--color-pine),transparent)]',
            )}
          >
            {day}
          </Step>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-[12px]">
        <span className="truncate">{t.content.post}</span>
        <span className="relative shrink-0">
          <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-ink">
            {t.content.approve}
          </span>
          <Step
            as="span"
            ms={1000}
            className="absolute inset-0 flex items-center justify-center rounded-full border border-accent-text/50 bg-bg text-[11px] text-accent-text"
          >
            {t.content.approved}
          </Step>
        </span>
      </div>
    </div>
  ),
  miniapp: (t) => (
    <div className="mx-auto grid w-full max-w-[13rem] gap-2 rounded-[18px] border border-line-strong bg-bg/70 p-2.5">
      <p className="text-center text-[11.5px] font-medium">{t.miniapp.title}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {t.miniapp.items.map((item, i) => (
          <div key={item} className="grid gap-1 rounded-lg bg-surface-2 p-1.5 text-center">
            <span
              className={cn(
                'mx-auto size-6 rounded-full',
                i === 0 ? 'bg-[#c9a27a]' : i === 1 ? 'bg-[#e0b45e]' : 'bg-[#efe2c4]',
              )}
            />
            <span className="truncate text-[10px] text-muted">{item}</span>
            <Step as="span" ms={200 + i * 220} className="pd-pop text-[10px] text-accent-text">
              +1
            </Step>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-full bg-accent px-3 py-1.5 text-[11px] font-medium text-accent-ink">
        <span>
          {t.miniapp.cart}{' '}
          <span className="pd-count font-mono" data-step style={{ '--d': '850ms' } as CSSProperties}>
            3
          </span>
        </span>
        <span>{t.miniapp.pay}</span>
      </div>
    </div>
  ),
  agent: (t) => (
    <div className="grid gap-2">
      <div className="flex items-center gap-2 text-[12px]">
        <span className="grid size-6 place-items-center rounded-full bg-pine font-brand text-[10px] text-accent-text">
          D
        </span>
        <span className="font-medium">{t.agent.name}</span>
        <span className="ml-auto size-1.5 rounded-full bg-accent" />
      </div>
      <Step ms={150} className={bubbleIn}>
        {t.agent.text}
      </Step>
      <Step ms={800} className={bubbleOut}>
        {t.agent.yes}
      </Step>
      <Step ms={1250} className={ok}>
        <Tick />
        {t.agent.done}
      </Step>
    </div>
  ),
  implementation: (t) => (
    <div className="grid gap-2">
      <Step ms={100} className={bubbleOut}>
        {t.implementation.q}
      </Step>
      <div className="relative">
        <Typing ms={450} />
        <Step ms={1150} className={bubbleIn}>
          {t.implementation.a}
        </Step>
      </div>
      <Step
        ms={1500}
        className="flex items-center gap-1.5 self-start rounded-full border border-line-strong px-2.5 py-1 text-[11px] text-muted"
      >
        <svg viewBox="0 0 16 16" className="size-3 text-accent-text" fill="none">
          <path d="M4 1.75h5.5L12.25 4.5v9.75H4z" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        {t.implementation.source}
      </Step>
    </div>
  ),
}
