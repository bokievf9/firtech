'use client'

import { useState } from 'react'
import { CallsPanel } from './calls-panel'
import type { CrmData } from './crm-data'
import { LeadsPanel } from './leads-panel'

// «Лиды» and «Созвоны» of the пульт, mounted in the panel grid. On ≥1920 px they sit side by side
// (8 + 6 of 14 columns); below, each takes the full row. Clicking a call opens that lead's drawer.
export function CrmPanels({ crm }: { crm: CrmData }) {
  const [openId, setOpenId] = useState<number | null>(null)
  return (
    <>
      <LeadsPanel
        crm={crm}
        openId={openId}
        onOpen={setOpenId}
        className="lg:order-3 lg:col-span-12 min-[120rem]:order-none min-[120rem]:col-span-8"
      />
      <CallsPanel
        crm={crm}
        onOpen={setOpenId}
        className="lg:order-3 lg:col-span-12 min-[120rem]:order-none min-[120rem]:col-span-6"
      />
    </>
  )
}
