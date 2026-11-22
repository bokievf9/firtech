'use client'

import { ArrowRight, PaperPlaneRight, ShoppingBag, UserCircle } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { Dict } from '@/content'
import { kindCatalog, kindName, pick, previewCopy, productCatalog } from '@/content/builder-catalog'
import {
  deliveryText,
  detailLabels,
  flagshipText,
  previewUi,
  scripted,
  siteSteps,
} from '@/content/builder-v2'
import type { Build, BuildStyle } from '@/lib/builder'
import { motionOf, styleVars } from '@/lib/builder-style'
import { kindTheme } from '@/lib/builder-themes'
import { agentProducts, demoNicheOf, departmentOf, effectiveDelivery, previewModes, type PreviewMode } from '@/lib/builder-v2'
import { Card, TabList, tabId, tabPanelId } from '@/components/ui'
import { cn } from '@/lib/cn'
import { optionsOf, personalLevel } from '@/lib/flagships'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { useSiteTheme } from '@/lib/use-site-theme'
import { useCabinetUser } from '@/components/cabinet/use-cabinet-user'
import { demoLoginHref } from '@/lib/demo-gate'
import { DemoGateBar, DemoLeft, DemoLimitPlate } from './demo/demo-gate-ui'
import { usePathname } from 'next/navigation'
import { Cta, Reveal, RevealGroup, ThemedSite } from './builder-motion'

const HEAD = 'pv-head [font-family:var(--pv-head-font)] [font-stretch:var(--pv-stretch)]'
const BORDER = 'border [border-width:var(--pv-border)]'
const SHADOW = '[box-shadow:var(--pv-shadow)]'
const TILE = 'bg-[linear-gradient(135deg,var(--color-pine),var(--color-surface))]'

// The final screen's preview: built from the answers and the theme, not a stock picture. A site gets
// a prototype hero and two sections in the niche's words; an agent gets a chat window with the
// client's name where a demo persona of the niche answers (HQ through /api/agent-demo, scripted lines
// when it is unreachable); a department gets a scheme of who does what; a Mini App a phone frame; the
// playground the window the client would get in the cabinet. Always labelled as an example.
export function LivePreview({
  build,
  dict,
  locale,
  className,
}: {
  build: Build
  dict: Dict
  locale: string
  className?: string
}) {
  const loc = locale === 'ru' ? 'ru' : 'en'
  const siteTheme = useSiteTheme()
  const modes = useMemo(() => previewModes(build), [build])
  const [picked, setPicked] = useState<PreviewMode | null>(null)
  const mode = picked && modes.includes(picked) ? picked : (modes[0] ?? 'site')
  // The look the visitor chose; without a choice, the niche's own theme so the screen is never bare.
  const style: BuildStyle | undefined = useMemo(() => {
    if (build.style && Object.keys(build.style).length) return build.style
    return { themeId: kindTheme[build.kind ?? 'other'], themeMood: 'calm' }
  }, [build.style, build.kind])
  const preset = motionOf(style)
  const themeKey = `${style.themeId ?? style.kit ?? 'n'}-${style.themeMood ?? ''}`
  const company = build.details?.company?.trim() || (build.kind && build.kind !== 'other' ? kindName(build.kind, locale) : dict.builder.preview.brand)
  const delivery = effectiveDelivery(build)

  return (
    <div className={cn('grid gap-3', className)}>
      {modes.length > 1 && (
        <TabList
          base="live-preview"
          label={pick(previewUi.concept, locale)}
          items={modes.map((id) => ({ id, label: previewUi.tabs[id][loc] }))}
          value={mode}
          onChange={setPicked}
        />
      )}
      <Card
        role={modes.length > 1 ? 'tabpanel' : undefined}
        id={modes.length > 1 ? tabPanelId('live-preview', mode) : undefined}
        aria-labelledby={modes.length > 1 ? tabId('live-preview', mode) : undefined}
        data-live-preview={mode}
        style={styleVars(style, siteTheme)}
        className="pv-root relative overflow-hidden -2 p-3 transition-[background-color,border-color] duration-300 md:p-5"
      >
        {mode === 'site' && <SitePreview build={build} dict={dict} locale={locale} company={company} preset={preset} themeKey={themeKey} />}
        {mode === 'agent' && <AgentWindow build={build} locale={locale} company={company} preset={preset} gate={dict.demoGate} variant="chat" />}
        {mode === 'playground' && <PlaygroundPreview build={build} locale={locale} company={company} preset={preset} gate={dict.demoGate} />}
        {mode === 'department' && <DepartmentPreview build={build} dict={dict} locale={locale} preset={preset} themeKey={themeKey} />}
        {mode === 'miniapp' && <MiniAppPreview build={build} locale={locale} company={company} preset={preset} themeKey={themeKey} />}
        {mode === 'content' && <ContentPreview build={build} locale={locale} company={company} preset={preset} themeKey={themeKey} />}
        {mode === 'automation' && <AutomationPreview locale={locale} preset={preset} themeKey={themeKey} />}
        {mode === 'personal' && <PersonalPreview build={build} locale={locale} />}
      </Card>
      <p className="text-footnote leading-relaxed text-faint">
        {pick(previewUi.concept, locale)}
        {delivery.length > 0 && (
          <>
            {'. '}
            {detailLabels.delivery[loc]}: {delivery.map((id) => deliveryText[id].name[loc]).join(', ')}
          </>
        )}
      </p>
    </div>
  )
}

type Common = { build: Build; locale: string; company: string; preset: ReturnType<typeof motionOf> }
type Gated = Common & { gate: Dict['demoGate'] }

// ------------------------------------------------------------------- site

function SitePreview({
  build,
  dict,
  locale,
  company,
  preset,
  themeKey,
}: Common & { dict: Dict; themeKey: string }) {
  const loc = locale === 'ru' ? 'ru' : 'en'
  const entry = kindCatalog[build.kind ?? 'other']
  const copy = entry[loc]
  const c = pick(previewCopy, locale)
  const steps = siteSteps[entry.mock]?.[loc] ?? siteSteps.services![loc]
  const cta = entry.mock === 'booking' ? c.book : c.cta
  const shop = build.parts.websites?.variant === 'shop'
  return (
    <div className={cn('overflow-hidden rounded-xl bg-bg', BORDER, 'border-line-strong', SHADOW)}>
      <div className="flex items-center gap-1.5 border-b border-b-hairline border-line px-3 py-2">
        <span className="size-2 rounded-full bg-fg/15" />
        <span className="size-2 rounded-full bg-fg/15" />
        <span className="size-2 rounded-full bg-fg/15" />
        <span className="ml-2 truncate rounded-full bg-fg/5 px-2.5 py-0.5 font-mono text-[10px] text-faint">
          {dict.builder.preview.url}
        </span>
      </div>
      <div className="p-(--pv-pad) md:p-5">
        <ThemedSite
          preset={preset}
          themeKey={themeKey}
          brand={company}
          menu={previewUi.siteMenu[loc]}
          headline={copy[4][0]}
          sub={copy[2]}
          cta={cta}
          headClass={HEAD}
          heroClass="[font-size:calc(19px*var(--pv-hero))] md:[font-size:calc(24px*var(--pv-hero))]"
          block={
            shop && preset.hero !== 'cards' ? (
              <span className="grid grid-cols-3 gap-1.5">
                {copy[4].map((name) => (
                  <span key={name} className={cn('grid gap-1 rounded-md p-1.5', BORDER, 'border-line')}>
                    <span className={cn('h-10 rounded-sm', TILE)} />
                    <span className="text-[9px] leading-snug">{name}</span>
                    <span className="rounded-sm bg-fg/10 py-0.5 text-center text-[8px] text-muted">{dict.builder.preview.buy}</span>
                  </span>
                ))}
              </span>
            ) : undefined
          }
          sections={[
            { title: previewUi.siteSections[loc][0] ?? '', items: [...copy[4]] },
            { title: previewUi.siteSections[loc][1] ?? '', items: [...steps] },
          ]}
        />
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ agent

type Msg = { from: 'bot' | 'me'; text: string }

// The chat of a demo persona. First tries HQ through the same-origin proxy; on any failure it answers
// from the scripted lines of the niche, and says so.
function AgentWindow({
  build,
  locale,
  company,
  gate,
  variant,
}: Gated & { variant: 'chat' | 'playground' }) {
  const loc = locale === 'ru' ? 'ru' : 'en'
  const reduce = useReducedMotion()
  const niche = demoNicheOf(build.kind)
  // The label follows the chosen agent product (administrator, lead manager, personal assistant).
  const agentId = (build.products ?? []).find((id) => agentProducts.includes(id))
  const agentLabel = agentId ? pick(productCatalog[agentId].name, locale) : pick(previewUi.agentOf, locale)
  const script = scripted[niche][loc]
  const greeting = script.greeting.replace('{company}', company)
  const [msgs, setMsgs] = useState<Msg[]>([{ from: 'bot', text: greeting }])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState<boolean | null>(null)
  // Only a signed-in client reaches the live persona (owner 2026-11-23, item 15); a visitor gets the scripted
  // lines (a chip answers, labelled «Пример») and the sign-in prompt instead of the input.
  const { state: me, refresh } = useCabinetUser()
  const scriptMode = me.status === 'out' || me.status === 'loading'
  const pathname = usePathname()
  const [left, setLeft] = useState<number | null>(null)
  const [limitHit, setLimitHit] = useState(false)
  const session = useRef('')
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    session.current = `b${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`.slice(0, 40)
  }, [])
  // The first message follows the company name and niche when they change.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the greeting is derived from the answers
    setMsgs((m) => (m.length === 1 ? [{ from: 'bot', text: greeting }] : m))
  }, [greeting])
  useEffect(() => {
    const el = list.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' })
  }, [msgs, busy, reduce])

  async function send(raw: string) {
    const value = raw.trim().slice(0, 500)
    if (!value || busy || limitHit) return
    setMsgs((m) => [...m, { from: 'me', text: value }])
    setText('')
    setBusy(true)
    let reply: string | null = null
    if (scriptMode) {
      const i = script.chips.indexOf(value)
      setMsgs((m) => [...m, { from: 'bot', text: i >= 0 ? (script.answers[i] ?? script.fallback) : script.fallback }])
      setBusy(false)
      return
    }
    try {
      const res = await fetch('/api/agent-demo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ niche, sessionId: session.current, text: value }),
        signal: AbortSignal.timeout(15_000),
      })
      const body = (await res.json().catch(() => null)) as { ok?: boolean; reply?: string; usage?: { left?: unknown }; error?: { code?: string } | string } | null
      if (res.ok && body?.ok && typeof body.reply === 'string') {
        reply = body.reply
        if (typeof body.usage?.left === 'number') setLeft(body.usage.left)
      } else {
        const code = typeof body?.error === 'string' ? body.error : body?.error?.code
        if (code === 'demo_limit') {
          setLimitHit(true)
          setLeft(0)
          setBusy(false)
          return
        }
        if (code === 'auth_required') {
          void refresh()
          setBusy(false)
          return
        }
      }
    } catch {
      // HQ is unreachable: the scripted lines answer
    }
    if (reply) setLive(true)
    else {
      setLive(false)
      const i = script.chips.indexOf(value)
      reply = i >= 0 ? (script.answers[i] ?? script.fallback) : script.fallback
    }
    setMsgs((m) => [...m, { from: 'bot', text: reply! }])
    setBusy(false)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void send(text)
  }

  return (
    <div className={cn('grid overflow-hidden rounded-xl bg-bg', BORDER, 'border-line-strong', SHADOW)}>
      <div className="flex items-center gap-3 border-b border-b-hairline border-line px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-callout font-bold text-accent-ink">
          {company.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn(HEAD, 'block truncate text-callout')}>{company}</span>
          <span className="block truncate text-caption text-muted">
            {agentLabel}
            {build.kind && build.kind !== 'other' ? `, ${kindName(build.kind, locale).toLowerCase()}` : ''} · {pick(previewUi.online, locale)}
          </span>
        </span>
        <span className="hidden rounded-full border border-hairline border-line-strong px-2.5 py-1 text-caption text-faint sm:block">
          {scriptMode ? pick(previewUi.scripted, locale) : live === null ? pick(previewUi.live, locale) : live ? pick(previewUi.live, locale) : pick(previewUi.scripted, locale)}
        </span>
      </div>
      <div
        ref={list}
        role="log"
        aria-live="polite"
        aria-label={company}
        className={cn('grid max-h-[22rem] content-start gap-2.5 overflow-y-auto px-4 py-4', variant === 'playground' ? 'min-h-[16rem]' : 'min-h-[18rem]')}
      >
        {msgs.map((m, i) => (
          <Bubble key={i} mine={m.from === 'me'}>
            {m.text}
          </Bubble>
        ))}
        {busy && (
          <span className="w-fit rounded-[var(--radius-lg)] bg-surface-2 px-3.5 py-2 text-footnote text-muted">
            {pick(previewUi.typing, locale)}...
          </span>
        )}
      </div>
      <div className="grid gap-2.5 border-t border-t-hairline border-line px-4 py-3">
        <div className="flex flex-wrap gap-1.5" aria-label={pick(previewUi.suggested, locale)}>
          {script.chips.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={busy}
              onClick={() => void send(chip)}
              className="rounded-[var(--pv-button)] border border-hairline border-line-strong px-3 py-1.5 text-caption text-muted transition-colors hover:border-accent-text hover:text-fg disabled:opacity-50"
            >
              {chip}
            </button>
          ))}
        </div>
        {scriptMode ? (
          <DemoGateBar gate={gate} href={demoLoginHref(loc, pathname ?? `/${loc}/builder`)} locked={me.status === 'loading'} />
        ) : limitHit ? (
          <DemoLimitPlate gate={gate} locale={loc} />
        ) : (
          <>
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <input
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
            placeholder={pick(previewUi.chatPlaceholder, locale)}
            aria-label={pick(previewUi.chatPlaceholder, locale)}
            className="ym-disable-keys min-w-0 flex-1 rounded-[var(--pv-button)] border border-hairline border-line-strong bg-surface px-4 py-2.5 text-body text-fg placeholder:text-faint focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text md:text-callout"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            aria-label={pick(previewUi.chatSend, locale)}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition-transform active:scale-95 disabled:opacity-40"
          >
            <PaperPlaneRight size={16} weight="fill" />
          </button>
        </form>
            <DemoLeft gate={gate} left={left} />
          </>
        )}
      </div>
    </div>
  )
}

function Bubble({ mine, children }: { mine?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'max-w-[85%] rounded-[var(--radius-lg)] px-3.5 py-2.5 text-callout leading-snug [overflow-wrap:anywhere]',
        mine ? 'ml-auto bg-accent text-accent-ink' : 'bg-surface-2 text-fg',
      )}
    >
      {children}
    </span>
  )
}

// The playground: the window the client gets in the cabinet, with the chat in it.
function PlaygroundPreview(props: Gated) {
  const loc = props.locale === 'ru' ? 'ru' : 'en'
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-hairline border-line-strong bg-bg px-4 py-3">
        <span className={cn(HEAD, 'text-callout')}>{previewUi.playgroundTitle[loc]}</span>
        <span className="rounded-full bg-fg/5 px-2.5 py-1 font-mono text-caption text-faint">
          firtech.pro/agent/{props.company.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 24) || 'demo'}
        </span>
      </div>
      <AgentWindow {...props} variant="playground" />
      <p className="text-footnote leading-relaxed text-muted">{previewUi.playgroundNote[loc]}</p>
    </div>
  )
}

// -------------------------------------------------------------- department

function DepartmentPreview({
  build,
  dict,
  locale,
  preset,
  themeKey,
}: Omit<Common, 'company'> & { dict: Dict; themeKey: string }) {
  const loc = locale === 'ru' ? 'ru' : 'en'
  const dept = departmentOf(build)
  const item = dict.aiTeams.items[dept]
  return (
    <RevealGroup preset={preset} themeKey={themeKey} className="grid gap-3">
      <Reveal className={cn('rounded-xl bg-bg p-4', BORDER, 'border-line-strong', SHADOW)}>
        <p className={cn(HEAD, 'text-body')}>{previewUi.deptTitle[loc]}</p>
        <p className="mt-1 text-footnote leading-snug text-muted">{previewUi.deptNote[loc]}</p>
      </Reveal>
      <Reveal className="grid justify-items-center gap-0">
        <span className="flex items-center gap-3 rounded-full bg-accent px-5 py-2.5 text-accent-ink">
          <UserCircle size={20} weight="fill" />
          <span className="text-left">
            <span className="block text-callout leading-tight font-medium">{previewUi.you[loc]}</span>
            <span className="block text-caption leading-tight opacity-80">{previewUi.youDoes[loc]}</span>
          </span>
        </span>
        <span aria-hidden="true" className="h-5 w-px bg-line-strong" />
        <span aria-hidden="true" className="h-px w-[78%] bg-line-strong" />
      </Reveal>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <span className="sr-only">{item.title}</span>
        {item.agents.slice(0, 6).map((agent) => (
          <Reveal key={agent.name} className={cn('grid content-start gap-1.5 rounded-xl bg-bg p-3.5', BORDER, 'border-line')}>
            <span className={cn(HEAD, 'text-callout')}>{agent.name}</span>
            <span className="text-caption leading-snug text-muted">{agent.does}</span>
            <span className="w-fit rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent-text">
              {previewUi.trust[agent.trust as 'propose' | 'auto' | 'both'][loc]}
            </span>
          </Reveal>
        ))}
      </div>
    </RevealGroup>
  )
}

// ----------------------------------------------------------------- Mini App

function MiniAppPreview({ build, locale, company, preset, themeKey }: Common & { themeKey: string }) {
  const loc = locale === 'ru' ? 'ru' : 'en'
  const entry = kindCatalog[build.kind ?? 'other']
  const copy = entry[loc]
  return (
    <div className="grid justify-items-center py-2">
      <div
        className={cn('w-[min(100%,17rem)] overflow-hidden bg-bg', BORDER, 'border-line-strong', SHADOW)}
        style={{ borderRadius: 'var(--pv-phone)' }}
      >
        <div className="flex items-center justify-between gap-2 bg-surface px-4 py-3 text-caption">
          <span className="text-muted">{previewUi.miniTitle[loc]}</span>
          <span className={cn(HEAD, 'truncate')}>{company}</span>
        </div>
        <RevealGroup preset={preset} themeKey={themeKey} className="grid gap-2.5 p-3.5">
          <Reveal className={cn('grid min-h-24 content-end rounded-[var(--radius-lg)] p-3', TILE)}>
            <span className={cn(HEAD, 'text-callout leading-tight')}>{copy[4][0]}</span>
          </Reveal>
          {copy[4].map((name) => (
            <Reveal key={name} className={cn('flex items-center gap-2.5 rounded-[var(--radius-md)] p-2', BORDER, 'border-line')}>
              <span className={cn('size-10 shrink-0 rounded-[var(--radius-sm)]', TILE)} />
              <span className="min-w-0 flex-1 text-caption leading-snug">{name}</span>
              <Cta preset={preset} className="px-2.5 py-1 text-[10px] font-medium">
                {previewUi.miniAdd[loc]}
              </Cta>
            </Reveal>
          ))}
          <Reveal className="flex items-center justify-between rounded-[var(--pv-button)] bg-accent px-4 py-2.5 text-caption font-medium text-accent-ink">
            <span className="inline-flex items-center gap-2">
              <ShoppingBag size={14} weight="fill" />
              {pick(previewCopy, locale).cart}
            </span>
            <ArrowRight size={14} />
          </Reveal>
        </RevealGroup>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ content

function ContentPreview({ build, locale, company, preset, themeKey }: Common & { themeKey: string }) {
  const loc = locale === 'ru' ? 'ru' : 'en'
  const c = pick(previewCopy, locale)
  const copy = kindCatalog[build.kind ?? 'other'][loc]
  return (
    <RevealGroup preset={preset} themeKey={themeKey} className="grid gap-3">
      <Reveal className={cn('rounded-xl bg-bg p-4', BORDER, 'border-line-strong', SHADOW)}>
        <p className={cn(HEAD, 'text-body')}>{previewUi.contentTitle[loc]}</p>
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {c.content.map((day, i) => (
            <span
              key={day}
              className={cn(
                'rounded-[var(--radius-sm)] py-2 text-center font-mono text-caption',
                i === 1 ? 'bg-accent text-accent-ink' : 'bg-fg/10 text-muted',
              )}
            >
              {day}
            </span>
          ))}
        </div>
      </Reveal>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {copy[4].map((line) => (
          <Reveal key={line} className={cn('grid gap-2 rounded-xl bg-bg p-3', BORDER, 'border-line')}>
            <span className={cn('h-20 rounded-[var(--radius-md)]', TILE)} />
            <span className="text-caption leading-snug">{line}</span>
            <span className="font-mono text-[10px] text-faint">{company}</span>
          </Reveal>
        ))}
      </div>
    </RevealGroup>
  )
}

// --------------------------------------------------------------- automation

function AutomationPreview({ locale, preset, themeKey }: { locale: string; preset: ReturnType<typeof motionOf>; themeKey: string }) {
  const loc = locale === 'ru' ? 'ru' : 'en'
  return (
    <RevealGroup preset={preset} themeKey={themeKey} className="grid gap-2.5">
      <p className={cn(HEAD, 'text-body')}>{previewUi.flowTitle[loc]}</p>
      {previewUi.flow[loc].map((step, i) => (
        <Reveal key={step} className={cn('flex items-center gap-3 rounded-xl bg-bg p-3.5', BORDER, 'border-line')}>
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent font-mono text-caption text-accent-ink">{i + 1}</span>
          <span className="text-callout">{step}</span>
        </Reveal>
      ))}
    </RevealGroup>
  )
}

// ------------------------------------------------------------------- personal AI

// The Personal AI: its morning brief in Telegram, one line per service picked, and the level they make.
function PersonalPreview({ build, locale }: { build: Build; locale: string }) {
  const loc = locale === 'ru' ? 'ru' : 'en'
  const picked = optionsOf(build, 'personal')
  const rows = picked.map((id) => flagshipText.previewRows[id as keyof typeof flagshipText.previewRows]?.[loc]).filter(Boolean)
  return (
    <div className={cn('mx-auto grid max-w-md gap-3 rounded-xl bg-bg p-4', BORDER, 'border-line-strong', SHADOW)} data-personal-preview>
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-full bg-accent text-accent-ink">
          <UserCircle size={18} weight="fill" />
        </span>
        <div className="min-w-0">
          <p className={cn(HEAD, 'text-callout')}>{flagshipText.previewTitle[loc]}</p>
          <p className="font-mono text-caption text-muted">
            {flagshipText.personal.level[loc]}: {flagshipText.levels[personalLevel(picked)][loc]}
          </p>
        </div>
        <span className="ml-auto font-mono text-caption text-faint">07:30</span>
      </div>
      <ul className="grid gap-1.5 rounded-xl bg-surface-2 p-3 text-footnote">
        {rows.map((row) => (
          <li key={row} className="flex items-center gap-2">
            <span className="size-1.5 shrink-0 rounded-full bg-accent" />
            {row}
          </li>
        ))}
      </ul>
    </div>
  )
}
