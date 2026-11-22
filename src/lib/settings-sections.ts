// The sections of the Settings screen and the settings entries of ⌘K. Pure: the screen, the palette and the
// tests read the same map, so a field can never be searchable without a place on the page.
import { admin } from '@/content/admin'
import { FIELD_GROUPS, type GroupId } from '@/lib/settings-hq'

export type SettingsSectionId = 'general' | 'notifications' | 'autopilot' | 'agents' | 'prices' | 'integrations' | 'journal'
export type SettingsBlockId = GroupId | 'autopilot' | 'trust' | 'prices' | 'journal'

// Every existing block of the screen sits in exactly one section (no new settings).
export const SETTINGS_SECTIONS: { id: SettingsSectionId; blocks: SettingsBlockId[] }[] = [
  { id: 'general', blocks: ['schedule', 'calls', 'kp'] },
  { id: 'notifications', blocks: ['notices', 'alerts'] },
  { id: 'autopilot', blocks: ['autopilot', 'trust'] },
  { id: 'agents', blocks: ['limits', 'playground'] },
  { id: 'prices', blocks: ['prices'] },
  { id: 'integrations', blocks: ['service'] },
  { id: 'journal', blocks: ['journal'] },
]

export const sectionAnchor = (id: SettingsSectionId) => `settings-${id}`
export const sectionFocus = (id: SettingsSectionId) => `section-${id}`
export const sectionOfBlock = (block: SettingsBlockId): SettingsSectionId => SETTINGS_SECTIONS.find((s) => s.blocks.includes(block))!.id

export type SettingsEntry = { id: string; focus: string; title: string; hint: string; keywords: string; section: SettingsSectionId }

// One entry per section and per editable field (time, number, switch, trust default, autopilot rows).
export function settingsEntries(): SettingsEntry[] {
  const t = admin.hq.settings
  const out: SettingsEntry[] = []
  for (const s of SETTINGS_SECTIONS) out.push({ id: `settings:${s.id}`, focus: sectionFocus(s.id), title: t.sections[s.id].title, hint: 'Settings', keywords: t.sections[s.id].hint, section: s.id })
  const add = (path: string, title: string, block: SettingsBlockId, keywords = '') => {
    const section = sectionOfBlock(block)
    out.push({ id: `settings:field:${path}`, focus: path, title, hint: `Settings · ${t.sections[section].title}`, keywords: `${t.groups[block as GroupId]?.title ?? ''} ${keywords}`.trim(), section })
  }
  add('autopilot.leadManager', t.autopilot.rows.leadManager.title, 'autopilot', t.autopilot.rows.leadManager.hint)
  add('autopilot.support', t.autopilot.rows.support.title, 'autopilot', t.autopilot.rows.support.hint)
  add('trust.defaultThreshold', t.trust.default, 'trust', 'trust level approvals')
  for (const [group, specs] of Object.entries(FIELD_GROUPS) as [GroupId, (typeof FIELD_GROUPS)[GroupId]][])
    for (const spec of specs) add(spec.path, (t.fields as Record<string, string>)[spec.path] ?? spec.path, group)
  return out
}
