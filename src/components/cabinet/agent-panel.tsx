'use client'

import { Robot } from '@phosphor-icons/react'
import { useId, useState, type ReactNode } from 'react'
import type { Dict } from '@/content'
import { agentLanguages, agentTones, checkBotToken, usageShare, type AgentConversation, type ClientAgent } from '@/lib/cabinet-agent'
import type { ChatThread } from '@/lib/cabinet-chat'
import { formatDate } from '@/lib/cabinet-data'
import { buttonStyles, cn } from '@/lib/cn'
import { Chip, Empty, Field, FormMessage, fill, inputClass } from './ui'
import { ThreadPane } from './thread-pane'

// «Ваш агент» (cabinet v3, owner 2026-11-22: «площадка агента для тех, кому не нужен сайт»): shown only
// when HQ has a playground agent for the client. A chat with the agent (its own `agent` thread, the
// same messenger as «Сообщения»), the settings the client may change (name, tone, languages, channels),
// «Подключить Telegram» with a masked token field (the token goes to HQ only and is never shown again),
// the usage and the latest conversations.
type Saved = Pick<ClientAgent, 'name' | 'tone' | 'languages' | 'channels'>

async function send(method: 'PATCH' | 'POST', path: string, body: unknown) {
  const res = await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; agent?: ClientAgent } | null
  return res.ok && data?.ok ? { ok: true as const, agent: data.agent ?? null } : { ok: false as const, error: data?.error ?? 'hq' }
}

export function AgentPanel({
  dict,
  locale,
  agent: initial,
  conversations,
  thread,
}: {
  dict: Dict
  locale: string
  agent: ClientAgent
  conversations: AgentConversation[]
  thread: ChatThread | null
}) {
  const t = dict.cabinet.v3.agent
  const errors = t.errors as Record<string, string>
  const uid = useId()
  const [agent, setAgent] = useState(initial)
  const [form, setForm] = useState<Saved>({ name: initial.name, tone: initial.tone, languages: initial.languages, channels: initial.channels })
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState('')
  const [token, setToken] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [tgError, setTgError] = useState('')
  const [tgDone, setTgDone] = useState(false)
  const share = usageShare(agent.usage, agent.limits.msgsPerDay)
  const toneOptions = agentTones.includes(form.tone as (typeof agentTones)[number]) || !form.tone ? [...agentTones] : [...agentTones, form.tone]

  function apply(next: ClientAgent | null) {
    if (!next) return
    setAgent(next)
    setForm({ name: next.name, tone: next.tone, languages: next.languages, channels: next.channels })
  }

  async function save() {
    setState('saving')
    setError('')
    try {
      const out = await send('PATCH', '/api/cabinet/agent', {
        name: form.name,
        tone: form.tone || undefined,
        languages: form.languages,
      })
      if (out.ok) {
        apply(out.agent)
        setState('saved')
        return
      }
      setError(errors[out.error] ?? errors.hq ?? '')
    } catch {
      setError(errors.network ?? '')
    }
    setState('idle')
  }

  async function connect() {
    setTgError('')
    setTgDone(false)
    if (!checkBotToken(token)) {
      setTgError(errors.bad_token ?? '')
      return
    }
    setConnecting(true)
    try {
      const out = await send('POST', '/api/cabinet/agent/telegram', { botToken: token.trim() })
      if (out.ok) {
        apply(out.agent)
        setToken('')
        setTgDone(true)
      } else setTgError(errors[out.error === 'bad_token' ? 'bad_token' : out.error] ?? errors.hq ?? '')
    } catch {
      setTgError(errors.network ?? '')
    }
    setConnecting(false)
  }

  async function disconnect() {
    setTgError('')
    setTgDone(false)
    setConnecting(true)
    try {
      const out = await send('PATCH', '/api/cabinet/agent', { channels: { telegram: false } })
      if (out.ok) apply(out.agent)
      else setTgError(errors[out.error] ?? errors.hq ?? '')
    } catch {
      setTgError(errors.network ?? '')
    }
    setConnecting(false)
  }

  const card = 'rounded-card border border-line bg-surface p-5 md:p-6'
  const h = 'font-display text-lg font-semibold tracking-tight'

  return (
    <section aria-labelledby="cabinet-agent-title" data-cabinet-agent>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="cabinet-agent-title" className="font-display text-2xl font-semibold tracking-tight">
            {t.title}: {agent.name}
          </h2>
          <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted">{t.sub}</p>
        </div>
        <Chip tone={agent.state === 'live' ? 'accent' : 'muted'}>{agent.state === 'live' ? t.live : t.draft}</Chip>
      </div>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="grid gap-5">
          <div className="flex h-[min(70dvh,620px)] min-h-[460px] flex-col overflow-hidden rounded-card border border-line bg-surface">
            <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
              <span className="grid size-9 place-items-center rounded-full bg-accent text-accent-ink">
                <Robot size={20} weight="fill" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[15px] font-medium">{t.chatTitle}</p>
                <p className="text-[12px] text-faint">{t.chatHint}</p>
              </div>
            </div>
            {thread ? (
              <ThreadPane key={thread.id} thread={thread} dict={dict} locale={locale} agentReply chrome={false} className="min-h-0 flex-1" />
            ) : (
              <div className="grid flex-1 place-items-center p-8 text-center text-sm text-muted">{t.noThread}</div>
            )}
          </div>

          <div className={card}>
            <h3 className={h}>{t.conversationsTitle}</h3>
            {conversations.length === 0 ? (
              <div className="mt-3">
                <Empty>{t.noConversations}</Empty>
              </div>
            ) : (
              <ul className="mt-3 grid gap-2" data-conversations>
                {conversations.map((c) => (
                  <li key={c.id} className="rounded-xl border border-line px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm text-fg">
                        {(t.channel as Record<string, string>)[c.channel] ?? c.channel}, {fill(t.messagesCount, { n: String(c.messages) })}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-faint">{formatDate(c.lastAt, locale)}</span>
                    </div>
                    {c.leadsCaptured > 0 && (
                      <p className="mt-1 font-mono text-[11px] tracking-[0.06em] text-faint uppercase">{fill(t.leadsCaptured, { n: String(c.leadsCaptured) })}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="grid gap-5">
          <div className={card} data-agent-usage>
            <h3 className={h}>{t.usageTitle}</h3>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[12px] text-faint">{t.today}</dt>
                <dd className="mt-1 font-mono text-xl">{agent.usage.msgsToday}</dd>
                {agent.limits.msgsPerDay && <dd className="font-mono text-[11px] text-faint">{fill(t.limit, { n: String(agent.limits.msgsPerDay) })}</dd>}
              </div>
              <div>
                <dt className="text-[12px] text-faint">{t.conversations}</dt>
                <dd className="mt-1 font-mono text-xl">{agent.usage.conversations || conversations.length}</dd>
              </div>
            </dl>
            {share !== null && (
              <div
                role="progressbar"
                aria-label={t.today}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={share}
                className="mt-4 h-1.5 overflow-hidden rounded-full bg-fg/10"
              >
                <div className="h-full rounded-full bg-accent" style={{ width: `${share}%` }} />
              </div>
            )}
          </div>

          <form
            className={cn(card, 'grid gap-4')}
            onSubmit={(e) => {
              e.preventDefault()
              void save()
            }}
            data-agent-settings
          >
            <h3 className={h}>{t.settingsTitle}</h3>
            <Field id={`${uid}-name`} label={t.name}>
              <input
                id={`${uid}-name`}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                maxLength={40}
                className={inputClass}
              />
            </Field>
            <Field id={`${uid}-tone`} label={t.tone}>
              <select id={`${uid}-tone`} value={form.tone} onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))} className={inputClass}>
                {toneOptions.map((v) => (
                  <option key={v} value={v}>
                    {(t.tones as Record<string, string>)[v] ?? v}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm text-muted">{t.languages}</legend>
              <div className="flex flex-wrap gap-2">
                {agentLanguages.map((l) => {
                  const on = form.languages.includes(l)
                  return (
                    <label
                      key={l}
                      className={cn(
                        'cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-text',
                        on ? 'border-accent-text bg-accent/10 text-fg' : 'border-line-strong text-muted hover:text-fg',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setForm((f) => ({ ...f, languages: on ? f.languages.filter((x) => x !== l) : [...f.languages, l] }))}
                        className="sr-only"
                      />
                      {t.langs[l]}
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <div className="grid gap-2">
              <p className="text-sm text-muted">{t.channels}</p>
              <ChannelRow label={t.web}>
                <Chip tone="accent">{t.on}</Chip>
              </ChannelRow>
              <ChannelRow label={t.telegram}>
                <Chip tone={agent.channels.telegram ? 'accent' : 'muted'}>{agent.channels.telegram ? t.connected : t.notConnected}</Chip>
              </ChannelRow>
              <ChannelRow label={t.siteWidget}>
                <Chip tone={agent.channels.siteWidget ? 'accent' : 'muted'}>{agent.channels.siteWidget ?? t.notConnected}</Chip>
              </ChannelRow>
            </div>

            {error && <FormMessage kind="error">{error}</FormMessage>}
            {state === 'saved' && <FormMessage kind="ok">{t.saved}</FormMessage>}
            <button type="submit" disabled={state === 'saving'} className={cn(buttonStyles.primary, 'justify-self-start')}>
              {state === 'saving' ? t.saving : t.save}
            </button>
          </form>

          <div className={card} data-agent-telegram>
            <h3 className={h}>{t.connectTitle}</h3>
            {agent.channels.telegram ? (
              <div className="mt-3 grid justify-items-start gap-3">
                <Chip tone="accent">{t.connected}</Chip>
                <button type="button" onClick={() => void disconnect()} disabled={connecting} className={buttonStyles.secondary}>
                  {t.disconnect}
                </button>
              </div>
            ) : (
              <form
                className="mt-3 grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  void connect()
                }}
              >
                <p className="text-sm leading-relaxed text-muted">{t.connectText}</p>
                <Field id={`${uid}-token`} label={t.token} help={t.tokenHint}>
                  <input
                    id={`${uid}-token`}
                    name="bot-token"
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-describedby={`${uid}-token-help`}
                    className={cn(inputClass, 'font-mono')}
                    data-bot-token
                  />
                </Field>
                {tgError && <FormMessage kind="error">{tgError}</FormMessage>}
                <button type="submit" disabled={connecting || token.trim().length === 0} className={cn(buttonStyles.primary, 'justify-self-start')}>
                  {connecting ? t.connecting : t.connect}
                </button>
              </form>
            )}
            {tgDone && (
              <div className="mt-3">
                <FormMessage kind="ok">{t.connectDone}</FormMessage>
              </div>
            )}
            {agent.channels.telegram && tgError && (
              <div className="mt-3">
                <FormMessage kind="error">{tgError}</FormMessage>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function ChannelRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-2.5 text-sm">
      <span>{label}</span>
      {children}
    </div>
  )
}
