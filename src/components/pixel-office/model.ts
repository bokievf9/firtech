// Flattens the HQ office JSON into the people of the scene. Pure module.

import type { AgentStatus, OfficeAgent, OfficeData } from '@/lib/office-view'

export type Role = 'director' | 'head' | 'worker'

export type Person = {
  id: string
  title: string
  status: AgentStatus
  role: Role
  // 'director' for the director, otherwise the department id.
  deptId: string
  deptTitle: string
  agent: OfficeAgent
  // In a model call right now; absent in the data counts as false.
  thinking: boolean
}

const KNOWN: readonly AgentStatus[] = ['working', 'waiting', 'blocked', 'idle', 'sleeping', 'paused', 'offline']

// An unknown status from a newer HQ counts as offline (same rule as statusChip).
export function knownStatus(status: string): AgentStatus {
  return (KNOWN as readonly string[]).includes(status) ? (status as AgentStatus) : 'offline'
}

// Director first, then every department in HQ order: head, then workers.
export function officePeople(data: OfficeData): Person[] {
  const d = data.director
  const people: Person[] = [
    {
      id: d.id,
      title: d.title,
      status: knownStatus(d.status),
      role: 'director',
      deptId: 'director',
      deptTitle: d.title,
      agent: { id: d.id, title: d.title, status: knownStatus(d.status), lastActiveAt: d.lastSummaryAt ?? undefined, thinking: d.thinking === true },
      thinking: d.thinking === true,
    },
  ]
  const seen = new Set([d.id])
  for (const dept of data.departments) {
    const all: [OfficeAgent, Role][] = [[dept.head, 'head'], ...dept.workers.map((w): [OfficeAgent, Role] => [w, 'worker'])]
    for (const [agent, role] of all) {
      if (seen.has(agent.id)) continue
      seen.add(agent.id)
      people.push({
        id: agent.id,
        title: agent.title,
        status: knownStatus(agent.status),
        role,
        deptId: dept.id,
        deptTitle: dept.title,
        agent,
        thinking: agent.thinking === true,
      })
    }
  }
  return people
}
