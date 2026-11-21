'use client'

import { useFormStatus } from 'react-dom'
import { Pending } from '@/components/ui/pending'
import { buttonStyles } from '@/lib/cn'

export function UnsubscribeButton({ label, pending: pendingLabel }: { label: string; pending: string }) {
  const { pending } = useFormStatus()
  return (
    <Pending type="submit" pending={pending} pendingLabel={pendingLabel} className={buttonStyles.primary}>
      {label}
    </Pending>
  )
}
