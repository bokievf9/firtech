import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const buttonBase =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background-color,color,border-color,transform] duration-300 ease-out-expo active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60'

export const buttonStyles = {
  primary: cn(
    buttonBase,
    'bg-accent px-6 py-3.5 text-[15px] text-accent-ink hover:bg-accent-strong',
  ),
  secondary: cn(
    buttonBase,
    'border border-line-strong px-6 py-3.5 text-[15px] text-fg hover:border-fg/40 hover:bg-fg/5',
  ),
  small: cn(buttonBase, 'bg-accent px-4 py-2 text-sm text-accent-ink hover:bg-accent-strong'),
}

// Long-form path to an anchor on the home page, so links work from service pages too.
export function homeAnchor(locale: string, id: string) {
  return `/${locale}#${id}`
}
