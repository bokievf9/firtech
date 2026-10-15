'use client'

import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/cn'

// Card whose border lights up where the pointer is (styles in globals.css, `.spotlight`).
// Writes CSS variables straight to the element, so hovering costs no React renders.
export function SpotlightCard({ className, children, ...rest }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...rest}
      className={cn('spotlight', className)}
      onPointerMove={(e) => {
        const el = e.currentTarget
        const r = el.getBoundingClientRect()
        el.style.setProperty('--mx', `${e.clientX - r.left}px`)
        el.style.setProperty('--my', `${e.clientY - r.top}px`)
        el.style.setProperty('--spot', '1')
      }}
      onPointerLeave={(e) => e.currentTarget.style.setProperty('--spot', '0')}
    >
      {children}
    </div>
  )
}
