'use client'

import { CloudSlash, Lightning, SealCheck, WarningCircle } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { errText, usePoll } from '@/components/admin/control/api'
import { GoliveChip, useGolive } from '@/components/admin/hub/golive'
import { Offline, useHqView, useHub } from '@/components/admin/hub/ui'
import { PixelOffice, type OfficePeople, type OfficeZones } from '@/components/admin/office/pixel-office'
import { useOffice } from '@/components/admin/office/use-office'
import { admin } from '@/content/admin'
import { ZONE_SECTION } from '@/lib/hq-shell'
import { normalizeMembers, teamIdOf } from '@/lib/team'
import { presenceView, type HqState } from '@/lib/hq-admin-view'
import type { OfficeData } from '@/lib/office-view'
import { HUB_DEPTS, normalizeHub, roomPanel, zoneGlow, type DeptCounts, type HubDept, type PanelId } from '@/lib/shell'

const h = admin.hub
const cc = admin.cc

const roomIds = (deptIds: string[]) => ['director', 'meeting', 'lobby', 'builders', 'servers', ...deptIds]

// The room a department's counter and lamp sit on: its own room (the director's office for the Director).
const homeRoom = (room: string, panel: PanelId) => room !== 'meeting' && room !== 'lobby' && room !== 'builders' && panel !== 'company'

// Names, counters and lamp levels of the rooms (layout.ts room ids). A click goes to the Shell section.
function buildZones(data: OfficeData | null, hubDepts: Record<HubDept, DeptCounts> | null, go: (href: string) => void): OfficeZones | null {
  if (!data) return null
  const glowByDept = zoneGlow(hubDepts)
  const names: OfficeZones['names'] = {}
  const badges: OfficeZones['badges'] = {}
  const glow: OfficeZones['glow'] = {}
  const depts: OfficeZones['depts'] = {}
  for (const room of roomIds(data.departments.map((d) => d.id))) {
    const panel = roomPanel(room)
    if (!panel) continue
    const key = room.toLowerCase().replace(/[^a-z]/g, '')
    depts[room] = panel
    names[room] = (h.zones as Record<string, string>)[key] ?? h.panels[panel]
    if (!homeRoom(room, panel)) continue
    const c = hubDepts?.[panel as HubDept]
    if (c) badges[room] = { approvals: c.approvals, alerts: c.alerts, running: c.running }
    glow[room] = glowByDept[panel as HubDept]
  }
  return {
    names,
    badges,
    glow,
    depts,
    onZone: (room) => {
      const panel = roomPanel(room)
      const section = panel ? ZONE_SECTION[panel] : null
      if (section) go(`/admin/${section}`)
    },
  }
}

function useNow(step = 15_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), step)
    return () => clearInterval(id)
  }, [step])
  return now
}

// The Office section of the Shell: the live pixel office fills the work area, with one slim info strip
// above it (HQ link, presence, counters). Information only: no panels, no actions; a zone is a link
// to its Shell section, a person shows name and role on hover.
export function OfficeView() {
  const router = useRouter()
  const { notify } = useHub()
  const golive = useGolive(notify)
  const now = useNow()
  const office = useOffice()
  const hub = useHqView('hub', normalizeHub, { visible: 15_000, hidden: 60_000 })
  const state = usePoll<HqState>('state', { visible: 30_000, hidden: 120_000 })
  const team = useHqView('team', normalizeMembers, { visible: 30_000, hidden: 120_000 })
  const data = office.data
  const hubDepts = hub.view?.departments ?? null
  const zones = useMemo(() => buildZones(data, hubDepts, (href) => router.push(href)), [data, hubDepts, router])
  // Hovering a person shows what they are on (Team `now`); a click opens their card in Team.
  const people = useMemo<OfficePeople>(() => {
    const byId: Record<string, string | undefined> = {}
    for (const m of team.view ?? []) if (m.now) byId[m.id] = m.now
    return {
      nowOf: (id) => byId[teamIdOf(id)],
      onPerson: (id) => router.push(`/admin/team/${teamIdOf(id)}`),
    }
  }, [team.view, router])
  const hqDown = state.error ?? office.error
  const view = presenceView(state.data, now)
  const totals = HUB_DEPTS.reduce(
    (acc, d) => {
      const c = hubDepts?.[d]
      return c ? { approvals: acc.approvals + c.approvals, alerts: acc.alerts + c.alerts, running: acc.running + c.running } : acc
    },
    { approvals: 0, alerts: 0, running: 0 },
  )
  const chips = [
    { id: 'approvals', icon: SealCheck, n: totals.approvals, label: h.counters.approvals },
    { id: 'alerts', icon: WarningCircle, n: totals.alerts, label: admin.office.zones.alertsLabel },
    { id: 'running', icon: Lightning, n: totals.running, label: admin.office.zones.runningLabel },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col" data-office-page>
      <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-3 py-1 text-xs text-muted" data-office-strip>
        <span className="font-medium text-fg">{h.title}</span>
        {hqDown ? (
          <span role="alert" title={errText(hqDown)} className="inline-flex items-center gap-1 text-danger">
            <CloudSlash size={14} weight="duotone" aria-hidden="true" />
            {h.offline}
          </span>
        ) : state.data?.mock ? (
          <span className="rounded-full border border-dashed border-line-strong px-2 py-0.5 text-faint">{cc.link.mock}</span>
        ) : null}
        <GoliveChip state={golive.data?.state ?? null} />
        {view ? (
          <span data-office-presence title={view.autoAway ? cc.presence.autoNote : undefined}>
            {cc.presence.label}: {view.mode === 'desk' ? cc.presence.desk : cc.presence.away}
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-2 tabular-nums" aria-label={h.counters.label}>
          {chips.map(({ id, icon: Ico, n, label }) => (
            <span key={id} data-office-counter={id} title={label} aria-label={`${label}: ${hubDepts ? n : '?'}`} className="inline-flex items-center gap-1">
              <Ico size={14} weight={n ? 'fill' : 'regular'} aria-hidden="true" />
              {hubDepts ? n : '·'}
            </span>
          ))}
        </span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {data && zones ? (
          <div className={office.error ? 'h-full opacity-60 transition-opacity duration-300' : 'h-full transition-opacity duration-300'}>
            <PixelOffice data={data} now={now} zones={zones} people={people} fill />
          </div>
        ) : office.error ? (
          <div className="grid h-full place-items-center p-4">
            <div className="w-full max-w-md">
              <Offline error={office.error} onRetry={() => void office.retry()} />
            </div>
          </div>
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted" role="status">
            {h.loading}
          </div>
        )}
      </div>
    </div>
  )
}
