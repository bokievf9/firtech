import type { CSSProperties } from 'react'
import {
  defaultStyle,
  type BuildStyle,
  type StyleAccent,
  type StyleFont,
  type StyleLook,
} from './builder'

// The builder's style step restyles the mockup only: these CSS variables override the site tokens
// (Tailwind reads colours and radii from them) inside the preview, never on the page around it.

// Accents: a bright tone for dark backgrounds and a deeper one that keeps contrast on white.
export const accentColors: Record<StyleAccent, { dark: string; light: string }> = {
  lime: { dark: '#b5eb6a', light: '#4f8a12' },
  mint: { dark: '#5fe3b0', light: '#0f8a5f' },
  sky: { dark: '#6cc8ff', light: '#1676c2' },
  violet: { dark: '#a594ff', light: '#5b45d6' },
  coral: { dark: '#ff8466', light: '#d2472a' },
  amber: { dark: '#ffc45c', light: '#a86f00' },
  rose: { dark: '#ff7eb6', light: '#c42f72' },
  mono: { dark: '#eef1ec', light: '#15181a' },
}

const themes = {
  dark: {
    '--color-bg': '#0a0d0b',
    '--color-surface': '#111512',
    '--color-surface-2': '#171c18',
    '--color-fg': '#edf2ea',
    '--color-muted': '#9ba79d',
    '--color-faint': '#7a867c',
    '--color-line': 'rgb(232 240 230 / 0.09)',
    '--color-line-strong': 'rgb(232 240 230 / 0.16)',
  },
  light: {
    '--color-bg': '#ffffff',
    '--color-surface': '#f4f6f1',
    '--color-surface-2': '#e8ebe4',
    '--color-fg': '#15181a',
    '--color-muted': '#545d55',
    '--color-faint': '#6f786f',
    '--color-line': 'rgb(21 24 26 / 0.1)',
    '--color-line-strong': 'rgb(21 24 26 / 0.2)',
  },
}

type LookTokens = {
  radius: [sm: number, md: number, lg: number, xl: number]
  button: string
  phone: number
  weight: number
  caps: boolean
  tracking: string
}

const looks: Record<StyleLook, LookTokens> = {
  minimal: { radius: [2, 4, 6, 8], button: '6px', phone: 18, weight: 500, caps: false, tracking: '-0.01em' },
  bold: { radius: [6, 10, 14, 18], button: '999px', phone: 28, weight: 800, caps: true, tracking: '-0.02em' },
  premium: { radius: [0, 1, 2, 3], button: '1px', phone: 14, weight: 400, caps: true, tracking: '0.1em' },
  friendly: { radius: [8, 12, 16, 22], button: '999px', phone: 30, weight: 700, caps: false, tracking: '-0.01em' },
  tech: { radius: [3, 6, 8, 12], button: '999px', phone: 22, weight: 600, caps: false, tracking: '-0.015em' },
}

const fonts: Record<StyleFont, { family: string; weight?: number; tracking?: string }> = {
  strict: { family: 'var(--font-onest), ui-sans-serif, system-ui, sans-serif' },
  soft: { family: "ui-serif, Georgia, 'Times New Roman', serif" },
  bold: { family: 'var(--font-unbounded), var(--font-onest), sans-serif', weight: 800, tracking: '-0.02em' },
}

export function resolveStyle(style: BuildStyle | undefined): Required<BuildStyle> {
  return { ...defaultStyle, ...style }
}

export function accentOf(style: BuildStyle | undefined) {
  const s = resolveStyle(style)
  return accentColors[s.accent][s.theme]
}

export function styleVars(style: BuildStyle | undefined): CSSProperties {
  const s = resolveStyle(style)
  const look = looks[s.look]
  const font = fonts[s.font]
  const accent = accentColors[s.accent][s.theme]
  // Dark ink on the bright accents of the dark theme, white on the deep ones of the light theme.
  const ink = s.theme === 'dark' ? '#0d1408' : '#ffffff'
  const [sm, md, lg, xl] = look.radius
  return {
    ...themes[s.theme],
    '--color-accent': accent,
    '--color-accent-strong': accent,
    '--color-accent-ink': ink,
    '--color-pine': `color-mix(in oklab, ${accent} 32%, var(--color-surface))`,
    '--radius-sm': `${sm}px`,
    '--radius-md': `${md}px`,
    '--radius-lg': `${lg}px`,
    '--radius-xl': `${xl}px`,
    '--pv-button': look.button,
    '--pv-phone': `${look.phone}px`,
    '--pv-weight': String(font.weight ?? look.weight),
    '--pv-case': look.caps ? 'uppercase' : 'none',
    '--pv-tracking': font.tracking ?? look.tracking,
    '--pv-font': font.family,
    colorScheme: s.theme,
  } as unknown as CSSProperties
}
