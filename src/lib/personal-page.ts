import { personalHand, personalWho, type PersonalHand, type PersonalWho } from './builder-ids'
import { encodeBuild } from './builder'
import type { ChannelId } from './channels'
import { productBuild } from './products'

// Data of the «Персональный ИИ» page (front v4, owner 2026-11-22). Pure, tested in tests/personal-page.test.mjs.
// The ids are the builder's own (`personalWho`, `personalHand` in builder-ids.ts), so the page, the builder and HQ
// speak about the same people and skills; names and short hints come from `content/builder-personal.ts`.

// The people the page speaks to: every builder persona except «other».
export type PersonaKind = Exclude<PersonalWho, 'other'>
export const personaKinds = personalWho.filter((w): w is PersonaKind => w !== 'other')

// The twelve skills, grouped by area of life (three groups of four). Together they are exactly `personalHand`.
export const skillGroupIds = ['work', 'growth', 'life'] as const
export type SkillGroupId = (typeof skillGroupIds)[number]
export const skillGroups: Record<SkillGroupId, readonly PersonalHand[]> = {
  work: ['mail', 'calendar', 'calls', 'docs'],
  growth: ['study', 'languages', 'content', 'search'],
  life: ['money', 'health', 'home', 'reminders'],
}
export const allSkillIds: readonly PersonalHand[] = skillGroupIds.flatMap((g) => skillGroups[g])
export const isSkillSet = () => allSkillIds.length === personalHand.length && personalHand.every((h) => allSkillIds.includes(h))

// «Где живёт»: the seven channels as equals; Telegram is deliberately not the first (owner 2026-11-22).
export const personalChannelOrder: readonly ChannelId[] = ['web', 'cabinet', 'voice', 'email', 'telegram', 'whatsapp', 'desktop']

// «Собрать для себя»: the builder opened on the personal path (the Personal AI product picked, the personal brief
// started, the persona filled in when one is chosen).
export function personalBuilderHref(locale: string, who?: PersonaKind): string {
  const build = { ...productBuild('personal'), personal: who ? { who } : {} }
  return `/${locale}/builder?b=${encodeBuild(build)}`
}
