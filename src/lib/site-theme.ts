// Public site theme (owner 2026-11-21): follows the visitor's system colour scheme until they pick
// one with the header switch; the pick is stored in localStorage under `fir-theme` and wins.
// The pre-paint script lives in components/theme-init.tsx, the choice rule in lib/theme.ts.

export const THEME_KEY = 'fir-theme'
export type SiteTheme = 'light' | 'dark'
export const themeColor: Record<SiteTheme, string> = { light: '#ffffff', dark: '#0a0d0b' }
