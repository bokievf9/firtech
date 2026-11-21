'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './spinner'

// A button that waits for something: spinner, `aria-busy`, a repeat click does nothing (the button
// is `aria-disabled`, not `disabled`, so it keeps focus and screen readers keep reading it) and the
// label switches to `pendingLabel` («Отправляем…»).
export function Pending({
  pending,
  pendingLabel,
  children,
  className,
  onClick,
  type = 'button',
  ...rest
}: {
  pending: boolean
  pendingLabel: ReactNode
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      type={type}
      aria-busy={pending}
      aria-disabled={pending || rest.disabled ? true : undefined}
      onClick={(event) => {
        if (pending) {
          event.preventDefault()
          return
        }
        onClick?.(event)
      }}
      className={cn(className, pending && 'cursor-progress opacity-80')}
    >
      {pending ? <Spinner /> : null}
      {pending ? pendingLabel : children}
    </button>
  )
}
