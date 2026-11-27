// Cold open (docs/motion-storyboard.md section 6): a 1.8 s opening on the very first visit to the home page.
// The gate is pure (`shouldColdOpen`, tested) and `coldOpenScript` is the same rule as plain pre-paint JS: it runs in
// <head> before the first paint and only sets `data-cold="on"` on <html>; the overlay itself is CSS (globals.css).
export const COLD_KEY = 'fir-open-seen'
export const COLD_MS = 1800 // dur.cold; the CSS timeline in globals.css (.cold-open) must end by then
export const COLD_SKIP_MS = 120

export type ColdEnv = {
  path: string
  hash: string
  scrollY: number
  hidden: boolean
  reducedMotion: boolean
  saveData: boolean
  // 'seen' = key present, 'new' = key missing, 'blocked' = storage throws (no repeat flashes: skip)
  storage: 'seen' | 'new' | 'blocked'
}

export function shouldColdOpen(e: ColdEnv): boolean {
  if (!/^\/(ru|en)\/?$/.test(e.path)) return false
  if (e.hash || e.scrollY > 0 || e.hidden || e.reducedMotion || e.saveData) return false
  return e.storage === 'new'
}

export const coldOpenScript = `(function(){try{var l=location;if(!/^\\/(ru|en)\\/?$/.test(l.pathname)||l.hash||window.scrollY>0||document.hidden)return;if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var c=navigator.connection;if(c&&c.saveData)return;if(localStorage.getItem('${COLD_KEY}'))return;localStorage.setItem('${COLD_KEY}','1');document.documentElement.dataset.cold='on'}catch(e){return}})()`
