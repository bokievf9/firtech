import 'server-only'
import { cache } from 'react'
import { jsonFile } from './json-file'
import { PRICES_UPDATED_AT } from './prices-json'
import {
  applyOps,
  emptyPrices,
  resolvePricing,
  sanitizePrices,
  type ApplyResult,
  type Op,
  type PricesState,
} from './pricing-edit'
import type { Pricing } from './pricing'

// $DATA_DIR/prices.json: the owner's price overrides (a deep partial of `Pricing`), the date of the
// last edit and the last 200 changes. Same safe writes as the lead store (queue, temp file +
// rename). Back it up together with leads.json; delete it to go back to the defaults in pricing.ts.
const file = jsonFile<PricesState>('prices.json', emptyPrices)

export async function getPricesState(): Promise<PricesState> {
  try {
    return sanitizePrices(await file.load())
  } catch {
    // A broken file must never take the whole site down: fall back to the defaults.
    console.warn('prices.json unreadable, using the defaults')
    return emptyPrices()
  }
}

// The live prices: defaults with the overrides laid over them, validated; an invalid override is
// ignored with a server warning.
export const getPricing = cache(async (): Promise<Pricing> => {
  const state = await getPricesState()
  return resolvePricing(state.overrides, (m) => console.warn(m))
})

// The date for /api/prices: the last edit, else the date of the defaults.
export async function getPricesUpdatedAt(): Promise<string> {
  return (await getPricesState()).updatedAt ?? PRICES_UPDATED_AT
}

export function updatePrices(ops: Op[], now = new Date()): Promise<ApplyResult> {
  return file.serialize(async () => {
    // Refuse to overwrite a file that exists but cannot be read.
    const current = sanitizePrices(await file.load())
    const result = applyOps(current, ops, now)
    if (result.ok && result.changed > 0) {
      await file.save(result.state)
    }
    return result
  })
}
