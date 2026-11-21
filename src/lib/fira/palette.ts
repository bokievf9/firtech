// Fira's colours come from the site tokens (globals.css): lime body, dark green details, cream.
// Live pages read the CSS variables; a forced theme uses this table (kept equal to the CSS by
// tests/fira.test.mjs).
export type Palette = {
  accent: string
  strong: string
  ink: string
  cream: string
  blush: string
  mark: string
  dark: boolean
}

export const palettes: Record<'light' | 'dark', Palette> = {
  light: { accent: '#c6ff3d', strong: '#b4f021', ink: '#0d1408', cream: '#f4f1ea', blush: '#ff9a8a', mark: '#0d1408', dark: false },
  dark: { accent: '#b5eb6a', strong: '#c9f58c', ink: '#0d1408', cream: '#f4f1ea', blush: '#ff9a8a', mark: '#f4f1ea', dark: true },
}

export function readPalette(el: Element = document.documentElement): Palette {
  const css = getComputedStyle(el)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  const dark = document.documentElement.dataset.theme === 'dark'
  const base = palettes[dark ? 'dark' : 'light']
  return {
    accent: v('--color-accent', base.accent),
    strong: v('--color-accent-strong', base.strong),
    ink: v('--color-accent-ink', base.ink),
    cream: v('--color-paper', base.cream),
    blush: base.blush,
    dark,
    mark: dark ? v('--color-paper', base.cream) : v('--color-accent-ink', base.ink),
  }
}
