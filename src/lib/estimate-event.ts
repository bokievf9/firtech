import type { LeadService, ServiceSlug } from './site'

// The calculator (and the "more services" cards) hand the visitor's choice to the contact form
// through this window event, so the visitor does not have to retype what they picked.
export const ESTIMATE_EVENT = 'firtech:estimate'

// `summary` is the calculator's result; without it the form keeps whatever estimate it already has.
export type EstimateDetail = {
  service: LeadService | 'unknown'
  summary?: string
  // Showcase card the visitor came from (see directions.ts); goes to the lead as `source`.
  source?: string
}

export function sendEstimate(detail: EstimateDetail) {
  window.dispatchEvent(new CustomEvent<EstimateDetail>(ESTIMATE_EVENT, { detail }))
}

// Service pages ask the calculator to show one format ("Estimate" on a format card).
export const PICK_EVENT = 'firtech:pick'

export type PickDetail = { service: ServiceSlug; variant: string }

export function pickInCalculator(detail: PickDetail) {
  window.dispatchEvent(new CustomEvent<PickDetail>(PICK_EVENT, { detail }))
}
