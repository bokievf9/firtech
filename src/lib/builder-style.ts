import type { CSSProperties } from 'react'
import {
  defaultStyle,
  styleKits,
  type Build,
  type BuildStyle,
  type StyleAccent,
  type StyleDensity,
  type StyleFont,
  type StyleKit,
  type StyleLook,
  type StyleMood,
  type StylePalette,
  type StyleShape,
  type StyleType,
} from './builder'

// The builder's style step restyles the mockup only: these CSS variables override the site tokens
// (Tailwind reads colours and radii from them) inside the preview, never on the page around it.
// Five independent axes (palette, type, shape, density, mood) plus ready looks that set all five.
// The old four fields (look, accent, theme, font) still resolve, so old links keep their look.

// ------------------------------------------------------------------ palettes

export type Palette = {
  mode: 'dark' | 'light'
  bg: string
  surface: string
  surface2: string
  fg: string
  accent: string
  // Text on the accent colour.
  ink: string
}

export const palettes: Record<StylePalette, Palette> = {
  fir: { mode: 'dark', bg: '#0a0d0b', surface: '#111512', surface2: '#171c18', fg: '#edf2ea', accent: '#b5eb6a', ink: '#0d1408' },
  midnight: { mode: 'dark', bg: '#0a1022', surface: '#101935', surface2: '#17224a', fg: '#e8eeff', accent: '#6cc8ff', ink: '#04121f' },
  noir: { mode: 'dark', bg: '#070707', surface: '#121212', surface2: '#1b1b1b', fg: '#f4efe6', accent: '#d9b45a', ink: '#1a1200' },
  ember: { mode: 'dark', bg: '#140c0a', surface: '#1e1210', surface2: '#2a1915', fg: '#f7ebe4', accent: '#ff7a55', ink: '#200800' },
  aurora: { mode: 'dark', bg: '#0e0a1f', surface: '#171030', surface2: '#211848', fg: '#efeaff', accent: '#5fe3b0', ink: '#04170f' },
  forest: { mode: 'dark', bg: '#07120d', surface: '#0d1c15', surface2: '#14291f', fg: '#e7f1e6', accent: '#e8c15a', ink: '#1c1300' },
  plum: { mode: 'dark', bg: '#150a14', surface: '#20101f', surface2: '#2d172b', fg: '#fbeaf6', accent: '#ff7eb6', ink: '#2a0516' },
  graphite: { mode: 'dark', bg: '#121314', surface: '#1b1d1f', surface2: '#25282b', fg: '#ececec', accent: '#ff9a3c', ink: '#1f1000' },
  paper: { mode: 'light', bg: '#fbfaf6', surface: '#f1efe8', surface2: '#e5e2d8', fg: '#16181a', accent: '#16181a', ink: '#ffffff' },
  sand: { mode: 'light', bg: '#f6efe4', surface: '#ece2d2', surface2: '#e0d3bd', fg: '#2a1f14', accent: '#b4532a', ink: '#ffffff' },
  mintlight: { mode: 'light', bg: '#f2fbf6', surface: '#e2f4ea', surface2: '#cfe9da', fg: '#0f2a1d', accent: '#0a7650', ink: '#ffffff' },
  skylight: { mode: 'light', bg: '#f3f8ff', surface: '#e3eefc', surface2: '#d0e2f9', fg: '#0c2340', accent: '#1676c2', ink: '#ffffff' },
  blush: { mode: 'light', bg: '#fff4f7', surface: '#fde6ed', surface2: '#f9d3df', fg: '#3a1020', accent: '#c42f72', ink: '#ffffff' },
  lemon: { mode: 'light', bg: '#fffbe8', surface: '#fff3bd', surface2: '#ffe98a', fg: '#2b2400', accent: '#a85f00', ink: '#ffffff' },
  lavender: { mode: 'light', bg: '#f7f4ff', surface: '#ebe5fb', surface2: '#dcd2f6', fg: '#20164a', accent: '#5b45d6', ink: '#ffffff' },
  latte: { mode: 'light', bg: '#f4ece3', surface: '#e9ddcf', surface2: '#dccab6', fg: '#2e2118', accent: '#7a4a2b', ink: '#ffffff' },
}

// Legacy accents: a bright tone for dark backgrounds and a deeper one that keeps contrast on white.
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

const legacyThemes = {
  dark: { bg: '#0a0d0b', surface: '#111512', surface2: '#171c18', fg: '#edf2ea' },
  light: { bg: '#ffffff', surface: '#f4f6f1', surface2: '#e8ebe4', fg: '#15181a' },
}

// ---------------------------------------------------------------------- axes

type TypeTokens = { head: string; body: string; tracking: string; stretch: string }

const SANS = 'var(--font-onest), ui-sans-serif, system-ui, sans-serif'
export const typeTokens: Record<StyleType, TypeTokens> = {
  geometric: { head: 'var(--font-unbounded), var(--font-onest), sans-serif', body: SANS, tracking: '-0.02em', stretch: 'normal' },
  grotesk: { head: 'var(--font-geologica), var(--font-onest), sans-serif', body: SANS, tracking: '-0.03em', stretch: 'normal' },
  humanist: { head: SANS, body: SANS, tracking: '-0.015em', stretch: 'normal' },
  serif: {
    head: "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, ui-serif, serif",
    body: SANS,
    tracking: '-0.01em',
    stretch: 'normal',
  },
  mono: {
    head: 'var(--font-jetbrains), ui-monospace, monospace',
    body: 'var(--font-jetbrains), ui-monospace, monospace',
    tracking: '-0.02em',
    stretch: 'normal',
  },
  rounded: {
    head: "ui-rounded, 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', 'Arial Rounded MT Bold', Nunito, var(--font-onest), sans-serif",
    body: "ui-rounded, 'SF Pro Rounded', Nunito, var(--font-onest), sans-serif",
    tracking: '0',
    stretch: 'normal',
  },
  condensed: {
    head: "'Avenir Next Condensed', 'Arial Narrow', 'Roboto Condensed', 'Franklin Gothic Medium Cond', var(--font-onest), sans-serif",
    body: SANS,
    tracking: '0.01em',
    stretch: 'condensed',
  },
}

type ShapeTokens = { radius: [number, number, number, number]; button: string; phone: number }
export const shapeTokens: Record<StyleShape, ShapeTokens> = {
  sharp: { radius: [0, 0, 0, 0], button: '0px', phone: 6 },
  soft: { radius: [4, 8, 12, 18], button: '8px', phone: 20 },
  pill: { radius: [8, 14, 20, 28], button: '999px', phone: 32 },
}

// Padding and gap multipliers: the mockup's inner spacing in px.
export const densityTokens: Record<StyleDensity, { pad: number; gap: number }> = {
  airy: { pad: 18, gap: 14 },
  compact: { pad: 8, gap: 6 },
}
const mediumDensity = { pad: 13, gap: 10 }

type MoodTokens = {
  weight: number
  caps: boolean
  tracking: string | null
  border: number
  shadow: string
  hero: number
}
export const moodTokens: Record<StyleMood, MoodTokens> = {
  minimal: { weight: 500, caps: false, tracking: null, border: 1, shadow: 'none', hero: 1 },
  bold: { weight: 800, caps: true, tracking: null, border: 2, shadow: 'none', hero: 1.18 },
  playful: {
    weight: 700,
    caps: false,
    tracking: null,
    border: 2,
    shadow: '3px 3px 0 var(--color-accent)',
    hero: 1.06,
  },
  premium: {
    weight: 400,
    caps: true,
    tracking: '0.14em',
    border: 1,
    shadow: '0 18px 36px -18px rgb(0 0 0 / 0.55)',
    hero: 0.9,
  },
}

export type StyleAxes = {
  palette: StylePalette
  type: StyleType
  shape: StyleShape
  density: StyleDensity
  mood: StyleMood
}

// Ready looks: each sets every axis at once.
export const kits: Record<StyleKit, StyleAxes> = {
  fir: { palette: 'fir', type: 'grotesk', shape: 'soft', density: 'compact', mood: 'minimal' },
  nocturne: { palette: 'noir', type: 'condensed', shape: 'sharp', density: 'compact', mood: 'bold' },
  atelier: { palette: 'paper', type: 'serif', shape: 'sharp', density: 'airy', mood: 'premium' },
  sunny: { palette: 'lemon', type: 'rounded', shape: 'pill', density: 'airy', mood: 'playful' },
  candy: { palette: 'blush', type: 'rounded', shape: 'pill', density: 'compact', mood: 'playful' },
  brutal: { palette: 'paper', type: 'mono', shape: 'sharp', density: 'compact', mood: 'bold' },
  luxe: { palette: 'noir', type: 'serif', shape: 'sharp', density: 'airy', mood: 'premium' },
  clinic: { palette: 'skylight', type: 'humanist', shape: 'soft', density: 'airy', mood: 'minimal' },
  eco: { palette: 'mintlight', type: 'humanist', shape: 'soft', density: 'airy', mood: 'minimal' },
  bistro: { palette: 'sand', type: 'serif', shape: 'soft', density: 'compact', mood: 'playful' },
  barber: { palette: 'graphite', type: 'condensed', shape: 'sharp', density: 'compact', mood: 'bold' },
  techy: { palette: 'midnight', type: 'mono', shape: 'soft', density: 'compact', mood: 'minimal' },
  aurora: { palette: 'aurora', type: 'geometric', shape: 'pill', density: 'airy', mood: 'bold' },
  journal: { palette: 'lavender', type: 'geometric', shape: 'sharp', density: 'airy', mood: 'premium' },
  kids: { palette: 'skylight', type: 'rounded', shape: 'pill', density: 'compact', mood: 'playful' },
  forest: { palette: 'forest', type: 'humanist', shape: 'soft', density: 'airy', mood: 'premium' },
  wine: { palette: 'plum', type: 'serif', shape: 'soft', density: 'airy', mood: 'premium' },
  coffee: { palette: 'latte', type: 'humanist', shape: 'soft', density: 'compact', mood: 'playful' },
  ember: { palette: 'ember', type: 'geometric', shape: 'soft', density: 'compact', mood: 'bold' },
}

// -------------------------------------------------------------------- resolve

const legacyLook: Record<StyleLook, { shape: StyleShape; mood: StyleMood }> = {
  minimal: { shape: 'soft', mood: 'minimal' },
  bold: { shape: 'pill', mood: 'bold' },
  premium: { shape: 'sharp', mood: 'premium' },
  friendly: { shape: 'pill', mood: 'playful' },
  tech: { shape: 'soft', mood: 'minimal' },
}
const legacyFont: Record<StyleFont, StyleType> = {
  strict: 'humanist',
  soft: 'serif',
  bold: 'geometric',
}

export type ResolvedStyle = {
  // null while the old accent and theme drive the colours.
  palette: StylePalette | null
  type: StyleType
  shape: StyleShape
  density: StyleDensity | null
  mood: StyleMood
  kit: StyleKit | null
  colors: Palette
}

// The old four fields only, filled with defaults (kept for the brief and old callers).
export function resolveStyle(style: BuildStyle | undefined) {
  return { ...defaultStyle, ...pickLegacy(style) }
}

function pickLegacy(style: BuildStyle | undefined): BuildStyle {
  const out: BuildStyle = {}
  if (style?.look) out.look = style.look
  if (style?.accent) out.accent = style.accent
  if (style?.theme) out.theme = style.theme
  if (style?.font) out.font = style.font
  return out
}

// Order: defaults, then the old fields, then the ready look, then the axes set one by one.
export function resolveLook(style: BuildStyle | undefined): ResolvedStyle {
  const legacy = resolveStyle(style)
  const kit = style?.kit ? kits[style.kit] : undefined
  const paletteId = style?.palette ?? kit?.palette ?? null
  let colors: Palette
  if (paletteId) colors = palettes[paletteId]
  else {
    const theme = legacyThemes[legacy.theme]
    const accent = accentColors[legacy.accent][legacy.theme]
    colors = {
      mode: legacy.theme,
      ...theme,
      accent,
      ink: legacy.theme === 'dark' ? '#0d1408' : '#ffffff',
    }
  }
  const look = legacyLook[legacy.look]
  return {
    palette: paletteId,
    type: style?.type ?? kit?.type ?? legacyFont[legacy.font],
    shape: style?.shape ?? kit?.shape ?? look.shape,
    density: style?.density ?? kit?.density ?? null,
    mood: style?.mood ?? kit?.mood ?? look.mood,
    kit: style?.kit ?? null,
    colors,
  }
}

export function accentOf(style: BuildStyle | undefined) {
  return resolveLook(style).colors.accent
}

export function styleVars(style: BuildStyle | undefined): CSSProperties {
  const s = resolveLook(style)
  const c = s.colors
  const type = typeTokens[s.type]
  const shape = shapeTokens[s.shape]
  const mood = moodTokens[s.mood]
  const density = s.density ? densityTokens[s.density] : mediumDensity
  const [sm, md, lg, xl] = shape.radius
  return {
    '--color-bg': c.bg,
    '--color-surface': c.surface,
    '--color-surface-2': c.surface2,
    '--color-fg': c.fg,
    '--color-muted': `color-mix(in oklab, ${c.fg} 66%, ${c.bg})`,
    '--color-faint': `color-mix(in oklab, ${c.fg} 50%, ${c.bg})`,
    '--color-line': `color-mix(in oklab, ${c.fg} 11%, transparent)`,
    '--color-line-strong': `color-mix(in oklab, ${c.fg} 20%, transparent)`,
    '--color-accent': c.accent,
    '--color-accent-strong': c.accent,
    '--color-accent-ink': c.ink,
    '--color-pine': `color-mix(in oklab, ${c.accent} 32%, var(--color-surface))`,
    '--radius-sm': `${sm}px`,
    '--radius-md': `${md}px`,
    '--radius-lg': `${lg}px`,
    '--radius-xl': `${xl}px`,
    '--pv-button': shape.button,
    '--pv-phone': `${shape.phone}px`,
    '--pv-font': type.body,
    '--pv-head-font': type.head,
    '--pv-stretch': type.stretch,
    '--pv-weight': String(mood.weight),
    '--pv-case': mood.caps ? 'uppercase' : 'none',
    '--pv-tracking': mood.tracking ?? type.tracking,
    '--pv-border': `${mood.border}px`,
    '--pv-shadow': mood.shadow,
    '--pv-hero': String(mood.hero),
    '--pv-pad': `${density.pad}px`,
    '--pv-gap': `${density.gap}px`,
    colorScheme: c.mode,
  } as unknown as CSSProperties
}

// ------------------------------------------------------------ build helpers

// The axes as currently shown (a ready look, old fields or defaults), all five filled.
export function currentAxes(style: BuildStyle | undefined): StyleAxes {
  const s = resolveLook(style)
  return {
    palette: s.palette ?? 'fir',
    type: s.type,
    shape: s.shape,
    density: s.density ?? 'compact',
    mood: s.mood,
  }
}

const sameAxes = (a: StyleAxes, b: StyleAxes) =>
  a.palette === b.palette &&
  a.type === b.type &&
  a.shape === b.shape &&
  a.density === b.density &&
  a.mood === b.mood

// A ready look replaces the whole style (old fields included).
export function applyKit(build: Build, kit: StyleKit): Build {
  return { ...build, style: { kit, ...kits[kit] } }
}

// One axis changes; the rest of what is shown is kept as explicit axes. If the result is exactly a
// ready look it keeps that look's name.
export function setAxis(build: Build, patch: Partial<StyleAxes>): Build {
  const axes = { ...currentAxes(build.style), ...patch }
  const kit = styleKits.find((id) => sameAxes(kits[id], axes))
  return { ...build, style: { ...axes, ...(kit ? { kit } : {}) } }
}

export function clearStyle(build: Build): Build {
  const next = { ...build }
  delete next.style
  return next
}

// True when the visitor picked anything about the style.
export const hasStyle = (style: BuildStyle | undefined) => Boolean(style && Object.keys(style).length)
// True when the new axes (not the old four) drive the look.
export const usesAxes = (style: BuildStyle | undefined) =>
  Boolean(style && (style.palette || style.type || style.shape || style.density || style.mood || style.kit))
