import Link from 'next/link'
import type { Dict } from '@/content'
import type { ChatMessage, ChatThread } from '@/lib/cabinet-chat'
import {
  formatDate,
  prepSteps,
  projectStatusKey,
  stageRows,
  stageTemplate,
  type CabinetProject,
} from '@/lib/cabinet-data'
import { docStateKey, type NextAction, type PublicDoc } from '@/lib/cabinet-docs'
import { buttonStyles, cn } from '@/lib/cn'
import type { Locale } from '@/lib/i18n'
import { stageTrackLabel } from '@/lib/payment-stages'
import { NextActionBlock } from './next-action'
import { TabLink } from './tab-link'
import { Chip, Empty, fill } from './ui'

// The home of the cabinet (v3, owner 2026-11-22: «лучше статус его проекта, а не наш статус работ»):
// each project in the client's words (the state as a sentence, the ONE big button of what is needed
// from them, the stage track), then recent documents and messages. Server components; the controls
// are small client islands (next-action.tsx, tab-link.tsx).
export function ProjectCard({
  project,
  action,
  dict,
  locale,
  threadId,
}: {
  project: CabinetProject
  action: NextAction
  dict: Dict
  locale: Locale
  // Whether the project has a conversation to link to.
  threadId: string | null
}) {
  const v = dict.cabinet.v3
  const c = dict.cabinet.cards
  const status = v.status[projectStatusKey(project.state, action.kind)]
  const rows = stageRows(project.milestones, locale)
  const tone = project.state === 'done' ? 'accent' : project.state === 'paused' ? 'warn' : 'muted'
  const showAction = project.state !== 'done'
  return (
    <article
      id={`project-${project.id}`}
      data-project={project.id}
      data-project-state={project.state}
      className="rounded-card border border-line bg-surface p-6 md:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="font-display text-xl font-semibold tracking-tight">{project.what || `#${project.id}`}</h3>
        <Chip tone={tone}>{v.state[project.state]}</Chip>
      </div>
      <p className="mt-3 max-w-[60ch] text-lg leading-snug text-fg" data-project-status>
        {status}
      </p>

      {showAction && (
        <div className="mt-5">
          <NextActionBlock action={action} dict={dict} projectId={project.id} />
        </div>
      )}

      {rows.length > 0 ? (
        <div className="mt-6" data-stage-track>
          <p className="text-[13px] text-muted">{v.home.stagesTitle}</p>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => {
              const handled = (action.kind === 'accept_stage' || action.kind === 'pay_stage') && action.stageNo === row.n
              return (
                <li
                  key={row.n}
                  data-stage={row.n}
                  data-step={row.step}
                  className={cn('rounded-xl border p-3.5 text-sm', row.step === 'accept' ? 'border-accent-text/50 bg-accent/[0.06]' : 'border-line')}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={row.step === 'accepted' ? 'text-fg' : row.step === 'work' ? 'text-accent-text' : 'text-muted'}>
                      <span aria-hidden="true">{row.step === 'accepted' ? '● ' : row.step === 'work' || row.step === 'accept' ? '◉ ' : '○ '}</span>
                      {stageTrackLabel(stageTemplate(row.step, c.stageTrack, c.milestones.accepted), row.n)}
                    </span>
                    {row.amount && <span className="font-mono text-[12px] text-faint">{row.amount}</span>}
                  </div>
                  {row.title && <p className="mt-1 text-[13px] text-muted">{row.title}</p>}
                  {row.date && <p className="mt-1 font-mono text-[12px] text-faint">{c.milestones.acceptedOn.replace('{date}', row.date)}</p>}
                  {row.payUrl && !handled && (
                    <a
                      href={row.payUrl}
                      data-pay-stage={row.n}
                      className={`${buttonStyles.secondary} mt-3`}
                    >
                      {c.milestones.pay}
                    </a>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      ) : project.state === 'preparing' ? (
        <div className="mt-6" data-prep-track>
          <p className="text-[13px] text-muted">{v.prep.label}</p>
          <ol className="mt-3 grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-5">
            {prepSteps(action.kind).map((step) => (
              <li
                key={step.id}
                data-prep={step.id}
                aria-current={step.state === 'now' ? 'step' : undefined}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-center',
                  step.state === 'now' && 'border-accent-text bg-accent/10 text-accent-text',
                  step.state === 'done' && 'border-line-strong text-fg',
                  step.state === 'next' && 'border-line text-faint',
                )}
              >
                {v.prep[step.id]}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-5 text-sm">
        {project.deadline && (
          <span className="text-muted">
            {v.home.deadline}: <span className="text-fg">{formatDate(project.deadline, locale)}</span>
          </span>
        )}
        {threadId && (
          <TabLink
            tab="messages"
            extra={{ ref: `project-${project.id}` }}
            className="text-fg underline decoration-line-strong underline-offset-4 hover:text-accent-text"
          >
            {v.home.openThread}
          </TabLink>
        )}
        <TabLink tab="documents" className="text-fg underline decoration-line-strong underline-offset-4 hover:text-accent-text">
          {v.home.projectDocs}
        </TabLink>
      </div>
    </article>
  )
}

export function EmptyProjects({ dict, locale }: { dict: Dict; locale: Locale }) {
  const v = dict.cabinet.v3.home
  return (
    <div className="grid justify-items-start gap-4 rounded-card border border-line bg-surface p-6 md:p-8" data-projects-empty>
      <p className="font-display text-xl font-semibold tracking-tight">{v.emptyTitle}</p>
      <p className="max-w-[56ch] text-sm leading-relaxed text-muted">{v.emptyText}</p>
      <div className="flex flex-wrap gap-3">
        <Link href={`/${locale}/builder`} className={buttonStyles.primary}>
          {v.builder}
        </Link>
        <Link href={`/${locale}/audit`} className={buttonStyles.secondary}>
          {v.audit}
        </Link>
      </div>
    </div>
  )
}

// Recent documents and the latest messages under the project cards.
export function RecentBlock({
  docs,
  messages,
  dict,
  locale,
}: {
  docs: PublicDoc[]
  messages: { thread: ChatThread; last: ChatMessage | null }[]
  dict: Dict
  locale: Locale
}) {
  const v = dict.cabinet.v3
  const d = v.docs
  return (
    <div className="grid gap-5 lg:grid-cols-2" data-recent>
      <section aria-labelledby="cabinet-recent-docs" className="rounded-card border border-line bg-surface p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="cabinet-recent-docs" className="font-display text-lg font-semibold tracking-tight">
            {v.home.recentDocsTitle}
          </h2>
          <TabLink tab="documents" className="text-sm text-muted underline decoration-line-strong underline-offset-4 hover:text-fg">
            {v.home.allDocs}
          </TabLink>
        </div>
        {docs.length === 0 ? (
          <div className="mt-4">
            <Empty>{v.home.noDocs}</Empty>
          </div>
        ) : (
          <ul className="mt-4 grid gap-2">
            {docs.map((doc) => (
              <li key={doc.id}>
                <TabLink
                  tab="documents"
                  extra={{ doc: doc.id }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 transition-colors hover:border-line-strong"
                >
                  <span className="min-w-0">
                    <span className="block font-mono text-[11px] tracking-[0.1em] text-faint uppercase">{d.kind[doc.kind]}</span>
                    <span className="mt-0.5 block truncate text-sm text-fg">{doc.title}</span>
                  </span>
                  <Chip tone={doc.state === 'awaiting_client' || doc.state === 'awaiting_signature' || (doc.state === 'issued' && doc.kind === 'invoice') ? 'warn' : doc.state === 'void' || doc.state === 'issued' ? 'muted' : 'accent'}>
                    {d.state[docStateKey(doc)]}
                  </Chip>
                </TabLink>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="cabinet-recent-messages" className="rounded-card border border-line bg-surface p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="cabinet-recent-messages" className="font-display text-lg font-semibold tracking-tight">
            {v.home.recentMessagesTitle}
          </h2>
          <TabLink tab="messages" className="text-sm text-muted underline decoration-line-strong underline-offset-4 hover:text-fg">
            {v.home.allMessages}
          </TabLink>
        </div>
        {messages.length === 0 ? (
          <div className="mt-4">
            <Empty>{v.home.noMessages}</Empty>
          </div>
        ) : (
          <ul className="mt-4 grid gap-2">
            {messages.map(({ thread, last }) => (
              <li key={thread.id}>
                <TabLink
                  tab="messages"
                  extra={{ ref: thread.refId ? `${thread.kind}-${thread.refId}` : thread.kind }}
                  className="block rounded-xl border border-line px-4 py-3 transition-colors hover:border-line-strong"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-fg">{thread.title || v.messages.kind[thread.kind]}</span>
                    {thread.unread > 0 && (
                      <span
                        aria-label={fill(v.home.unread, { n: String(thread.unread) })}
                        className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 font-mono text-[11px] leading-5 text-accent-ink"
                      >
                        {thread.unread}
                      </span>
                    )}
                  </span>
                  {last && (
                    <span className="mt-1 block truncate text-[13px] text-muted">
                      {last.from === 'client' ? `${v.home.you}: ` : ''}
                      {last.text || last.attachments[0]?.name}
                    </span>
                  )}
                  {thread.lastAt && <span className="mt-1 block font-mono text-[11px] text-faint">{formatDate(thread.lastAt, locale)}</span>}
                </TabLink>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
