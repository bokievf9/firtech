'use client'

import { useId, useState } from 'react'
import { TabList, tabId, tabPanelId } from '../ui'
import type { ReactNode } from 'react'

// «Каждый агент отдельно»: a segmented filter over the agent cards (all, or one team). The cards are rendered by the
// server and passed in with their team id, so the client only hides the ones of other teams.
export function AgentExplorer({
  label,
  allLabel,
  teams,
  cards,
}: {
  label: string
  allLabel: string
  teams: { id: string; name: string }[]
  cards: { id: string; team: string; node: ReactNode }[]
}) {
  const base = useId()
  const [team, setTeam] = useState('all')
  const shown = team === 'all' ? cards : cards.filter((c) => c.team === team)
  return (
    <div data-agent-explorer>
      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        <TabList
          base={base}
          label={label}
          items={[{ id: 'all', label: allLabel }, ...teams.map((t) => ({ id: t.id, label: t.name }))]}
          value={team}
          onChange={setTeam}
          itemProps={(id) => ({ 'data-agents-team': id })}
        />
      </div>
      <ul
        role="tabpanel"
        id={tabPanelId(base, team)}
        aria-labelledby={tabId(base, team)}
        className="mt-6 grid grid-cols-1 gap-gutter sm:grid-cols-2 xl:grid-cols-3"
      >
        {shown.map((c) => (
          <li key={c.id}>{c.node}</li>
        ))}
      </ul>
    </div>
  )
}
