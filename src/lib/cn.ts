import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Tailwind v4 `--text-*` theme tokens from globals.css. Without this, tailwind-merge reads them as
// text colours and drops them next to `text-muted`/`text-fg`, or fails to merge them with `text-sm`.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: ['display', 'title', 'title-2', 'title-3', 'headline', 'lead', 'body', 'callout', 'footnote', 'caption', 'micro'],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Buttons (design system v4, sizes and glow from v5: lg 56px, md 44px, docs/design-system-v4.md «Кнопки»): pills, one line, feedback on press
// (`.pressable` in globals.css: scale 0.97 in 80 ms, released in 160 ms), hover only with a real pointer.
// `buttonStyles.*` stays for the 140 call sites; new code uses `buttonClass(variant, size)` or
// <Button>/<ButtonLink> from components/ui/button.tsx.
const buttonBase =
  'pressable inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium select-none disabled:pointer-events-none disabled:opacity-50 aria-disabled:opacity-60'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'glass'
export type ButtonSize = 'sm' | 'md' | 'lg'

const variants: Record<ButtonVariant, string> = {
  primary: 'btn-glow bg-accent text-accent-ink hover:bg-accent-strong',
  secondary: 'border border-line-strong text-fg hover:border-fg/35 hover:bg-fill',
  ghost: 'text-fg hover:bg-fill-strong',
  glass: 'btn-glass',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-sm font-semibold',
  md: 'h-11 px-5 text-[15px] font-bold',
  lg: 'h-14 px-7 text-base font-bold',
}

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md') {
  return cn(buttonBase, variants[variant], sizes[size])
}

export const buttonStyles = {
  primary: buttonClass('primary', 'md'),
  secondary: buttonClass('secondary', 'md'),
  ghost: buttonClass('ghost', 'md'),
  glass: buttonClass('glass', 'md'),
  small: buttonClass('primary', 'sm'),
}

// Long-form path to an anchor on the home page, so links work from service pages too.
export function homeAnchor(locale: string, id: string) {
  return `/${locale}#${id}`
}
