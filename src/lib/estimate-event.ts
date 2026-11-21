import type { LeadService } from './site'

// The project builder (and the showcase cards) hand the visitor's choice to the contact form
// through this window event, so the visitor does not have to retype what they picked.
export const ESTIMATE_EVENT = 'firtech:estimate'

// `summary` is the builder's result; without it the form keeps whatever estimate it already has.
export type EstimateDetail = {
  service: LeadService | 'unknown'
  summary?: string
  // Showcase card the visitor came from (see directions.ts); goes to the lead as `source`.
  source?: string
}

export function sendEstimate(detail: EstimateDetail) {
  window.dispatchEvent(new CustomEvent<EstimateDetail>(ESTIMATE_EVENT, { detail }))
}
