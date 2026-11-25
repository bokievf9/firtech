// «Сколько вы теряете без агента» (builder, agent step, owner audit 2026-11-24 item H): the visitor's own three numbers
// and a conversion rate give a rough monthly loss. Pure, no imports. Nothing here is a promise: the numbers are the
// visitor's inputs, the defaults are conservative guesses per niche that the visitor edits.

export type LossInputs = {
  // Inquiries per day (all of them), the share that arrives outside working hours (percent), the average check (USD).
  missedPerDay: number
  avgCheck: number
  offHoursShare: number
}
// What the visitor typed, with the conversion («при конверсии 30 %»), stored in the draft.
export type LossBrief = LossInputs & { conversion: number }

export const lossDays = 30
export const lossDefaultConversion = 30
export const lossLimits = { missedPerDay: 1000, avgCheck: 100000, offHoursShare: 100, conversion: 100 } as const

const clamp = (value: unknown, max: number): number | null => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n))) : null
}

// A stored or decoded loss object to a clean `LossBrief`, or null when a number is missing.
export function cleanLoss(raw: unknown): LossBrief | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const missedPerDay = clamp(o.missedPerDay, lossLimits.missedPerDay)
  const avgCheck = clamp(o.avgCheck, lossLimits.avgCheck)
  const offHoursShare = clamp(o.offHoursShare, lossLimits.offHoursShare)
  const conversion = clamp(o.conversion ?? lossDefaultConversion, lossLimits.conversion)
  if (missedPerDay === null || avgCheck === null || offHoursShare === null || conversion === null) return null
  return { missedPerDay, avgCheck, offHoursShare, conversion }
}

export type LossResult = { missedPerMonth: number; monthlyLossUsd: number }
// Inquiries outside working hours per month, and what they are worth at the conversion:
// missedPerDay x 30 x offHoursShare x avgCheck x conversion.
export function lossMath(input: LossInputs & { conversion?: number }): LossResult {
  const conversion = (input.conversion ?? lossDefaultConversion) / 100
  const missed = input.missedPerDay * lossDays * (input.offHoursShare / 100)
  return { missedPerMonth: Math.round(missed), monthlyLossUsd: Math.round(missed * input.avgCheck * conversion) }
}
