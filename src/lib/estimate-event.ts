import type { ServiceSlug } from './site'

// The calculator hands its result to the contact form through this window event, so the
// visitor does not have to retype what they picked.
export const ESTIMATE_EVENT = 'firtech:estimate'

export type EstimateDetail = { service: ServiceSlug; summary: string }

export function sendEstimate(detail: EstimateDetail) {
  window.dispatchEvent(new CustomEvent<EstimateDetail>(ESTIMATE_EVENT, { detail }))
}
