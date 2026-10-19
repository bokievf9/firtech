'use client'

import { useId } from 'react'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import type { TaskStatus } from '@/lib/pulse-types'
import { statusCycle } from '@/lib/pulse-view'

const t = admin.pulse.tasks

// The status of a task as four segments (native radio buttons: arrow keys move the choice, a tap
// on the wrong one is one more tap away from the right one, nothing cycles by accident).
export function StatusSegments({
  value,
  disabled,
  onChange,
}: {
  value: TaskStatus
  disabled?: boolean
  onChange: (status: TaskStatus) => void
}) {
  const name = useId()
  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="sr-only">{t.statusLabel}</legend>
      <div className="grid grid-cols-4 gap-1 rounded-full bg-surface-2 p-1">
        {statusCycle.map((status) => (
          <label key={status} className="relative min-w-0">
            <input
              type="radio"
              name={name}
              value={status}
              checked={value === status}
              onChange={() => onChange(status)}
              className="peer sr-only"
            />
            <span
              className={cn(
                'flex h-11 cursor-pointer items-center justify-center rounded-full px-1 text-center text-sm leading-tight text-muted transition-colors duration-150 select-none',
                'peer-checked:bg-fg peer-checked:font-medium peer-checked:text-bg',
                'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-text',
                'peer-disabled:cursor-default peer-disabled:opacity-60',
              )}
            >
              {t.status[status]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
