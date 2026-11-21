import type { AgentConversation, ClientAgent } from './cabinet-agent'
import { materialsThread, unreadTotal, type ChatThread } from './cabinet-chat'
import {
  legacyDocs,
  sortProjects,
  type CabinetData,
  type CabinetLead,
  type CabinetProject,
} from './cabinet-data'
import {
  actionNeedsClient,
  docsNeedingClient,
  leadsWithoutProject,
  publicDoc,
  resolveNextAction,
  sortDocs,
  type ClientDoc,
  type NextAction,
  type PublicDoc,
} from './cabinet-docs'
import { tabCounts, visibleTabs, type CabinetTab } from './cabinet-tabs'

// The cabinet home as a view model (v3): everything the page shows, derived from HQ's by-email body and
// the v3 extras, with no rendering. Pure, so tests cover the rules (what is shown, which button, which
// badge) without a browser.
export type CabinetExtras = {
  docs: ClientDoc[]
  threads: ChatThread[]
  agents: ClientAgent[]
  conversations: AgentConversation[]
  // HQ answered the v3 endpoints (an older HQ makes the page fall back to the legacy invoices/documents).
  v3: boolean
}
export const noExtras: CabinetExtras = { docs: [], threads: [], agents: [], conversations: [], v3: false }

export type ProjectView = { project: CabinetProject; action: NextAction; threadId: string | null }
export type CabinetView = {
  docs: PublicDoc[]
  recentDocs: PublicDoc[]
  projects: ProjectView[]
  // Requests that are not projects yet (and not hidden by a project of their own).
  leads: CabinetLead[]
  leadActions: Record<number, NextAction>
  tabs: CabinetTab[]
  counts: Partial<Record<CabinetTab, number>>
  agent: ClientAgent | null
  agentThread: ChatThread | null
  materialsThread: ChatThread | null
  // Threads for the home's «Последние сообщения»: the latest three.
  recentThreads: ChatThread[]
}

export function buildCabinetView(data: CabinetData, extras: CabinetExtras): CabinetView {
  const docs = extras.v3 ? sortDocs(extras.docs.map(publicDoc)) : sortDocs(legacyDocs(data))
  const leadActions: Record<number, NextAction> = {}
  const leads = leadsWithoutProject(
    (data.leads ?? []).filter((l) => l.stage !== 'project'),
    data.projects,
    extras.docs,
  )
  for (const l of leads) leadActions[l.id] = resolveNextAction(l.nextAction, extras.docs, [], { leadId: l.id })

  const withActions = data.projects.map((project) => ({
    project,
    action: resolveNextAction(project.nextAction, extras.docs, project.milestones, { projectId: project.id }),
  }))
  const needs = new Map(withActions.map((x) => [x.project.id, actionNeedsClient(x.action)]))
  const projects: ProjectView[] = sortProjects(
    withActions.map((x) => x.project),
    (p) => needs.get(p.id) === true,
  ).map((project) => ({
    project,
    action: withActions.find((x) => x.project.id === project.id)!.action,
    threadId: extras.threads.find((t) => t.kind === 'project' && t.refId === String(project.id))?.id ?? null,
  }))

  const agent = extras.agents[0] ?? null
  const unread = unreadTotal(extras.threads)
  const byRecent = [...extras.threads].sort((a, b) => (Date.parse(b.lastAt ?? '') || 0) - (Date.parse(a.lastAt ?? '') || 0))
  return {
    docs,
    recentDocs: docs.slice(0, 3),
    projects,
    leads,
    leadActions,
    tabs: visibleTabs({ hasAgent: agent !== null }),
    counts: tabCounts({ docsNeedingClient: docsNeedingClient(docs), unread }),
    agent,
    agentThread: extras.threads.find((t) => t.kind === 'agent') ?? null,
    materialsThread: materialsThread(extras.threads),
    recentThreads: byRecent.slice(0, 3),
  }
}
