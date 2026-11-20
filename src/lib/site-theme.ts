// Public site theme (owner 2026-11-21): light on white by default, dark behind a switch. The
// choice lives in localStorage under `fir-theme`; the inline script below applies it to <html>
// before the first paint (no flash). the system colour scheme is deliberately NOT used: white is the
// default whatever the visitor's system says.

export const THEME_KEY = 'fir-theme'
export type SiteTheme = 'light' | 'dark'
export const themeColor: Record<SiteTheme, string> = { light: '#ffffff', dark: '#0a0d0b' }

export const themeScript = `try{var t=localStorage.getItem('${THEME_KEY}');t=t==='dark'?'dark':'light';var d=document.documentElement;d.dataset.theme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='dark'?'${themeColor.dark}':'${themeColor.light}')}catch(e){document.documentElement.dataset.theme='light'}`
