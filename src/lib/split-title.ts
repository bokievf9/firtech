// Splits a headline into the light half and the black half for the v5 `.h-display` pattern. Static pages
// have hand-picked `titleLight` / `titleStrong` dictionary keys; headlines that come from content files
// (products, agents, teams, niches) use this: the first sentence or clause that ends between a quarter
// and three quarters of the text, else the word boundary nearest to the middle. The two halves joined
// with one space are always the original text.
export function splitTitle(text: string): [string, string] {
  const s = text.trim()
  const words = s.split(/\s+/)
  if (words.length < 2) return [s, '']
  const min = s.length * 0.25
  const max = s.length * 0.75
  let best = -1
  let bestScore = Infinity
  let offset = 0
  for (let i = 0; i < words.length - 1; i++) {
    offset += (words[i] ?? '').length + 1
    const w = words[i] ?? ''
    const strongStop = /[.?!:]$/.test(w) ? 0 : /[,;-]$/.test(w) ? 1 : 2
    const pos = offset
    if (strongStop < 2 && (pos < min || pos > max)) continue
    const score = strongStop * s.length + Math.abs(pos - s.length / 2)
    if (score < bestScore) {
      bestScore = score
      best = i
    }
  }
  if (best < 0) best = Math.max(0, Math.round(words.length / 2) - 1)
  return [words.slice(0, best + 1).join(' '), words.slice(best + 1).join(' ')]
}
