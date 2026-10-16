import { businessKinds, encodeBuild, presets, type BusinessKind } from './builder'

// Niche landing pages ("solutions"): one per business kind from the builder, except "other". Each
// page shows the kind's builder preset, so its price and contents always match the builder.
export const solutionKinds = businessKinds.filter(
  (kind): kind is Exclude<BusinessKind, 'other'> => kind !== 'other',
)
export type SolutionKind = (typeof solutionKinds)[number]

export function isSolutionKind(value: string): value is SolutionKind {
  return (solutionKinds as readonly string[]).includes(value)
}

// Opens the builder with this kind's starting set already picked.
export function solutionBuilderHref(locale: string, kind: SolutionKind) {
  return `/${locale}/builder?b=${encodeBuild(presets[kind])}`
}
