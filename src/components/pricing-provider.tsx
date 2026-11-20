'use client'

import { createContext, useContext } from 'react'
import { defaultPricing, type Pricing } from '@/lib/pricing'

// The live prices (defaults + the owner's overrides from the Пульт), fed by the locale layout from
// `getPricing()`. Client components read them with `usePricing()` and never import the constants.
const PricingContext = createContext<Pricing>(defaultPricing)

export function PricingProvider({ pricing, children }: { pricing: Pricing; children: React.ReactNode }) {
  return <PricingContext.Provider value={pricing}>{children}</PricingContext.Provider>
}

export function usePricing(): Pricing {
  return useContext(PricingContext)
}
