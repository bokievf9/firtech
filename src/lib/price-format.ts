// One way to show a price on every public surface (owner audit 2026-11-24): «220 USD разово + 39 USD/мес»,
// EN «220 USD setup + 39 USD/mo». A monthly figure never stands alone: it always comes with the one-time part.
// Numbers are passed in from the live pricing; nothing is typed here.
// «1 200 USD» with no-break spaces: the public price format. (`formatUsd` in pricing.ts, «$1,200», stays for the builder, the
// estimate sheet, the blog tokens and the admin.)
export const usd = (value: number) => `${Math.round(value).toLocaleString('en-US').replace(/,/g, '\u00a0')} USD`

type Loc = string

const ru = (locale: Loc) => locale === 'ru'
export const setupWord = (locale: Loc) => (ru(locale) ? 'разово' : 'setup')
export const monthWord = (locale: Loc) => (ru(locale) ? '/мес' : '/mo')
export const fromWord = (locale: Loc) => (ru(locale) ? 'от' : 'from')

// «220 USD разово + 39 USD/мес»; without a monthly part just «220 USD разово».
export function priceLine(setup: number, monthly: number, locale: Loc): string {
  const once = `${usd(setup)} ${setupWord(locale)}`
  return monthly > 0 ? `${once} + ${usd(monthly)}${monthWord(locale)}` : once
}

// The same with «от» in front: a starting price, the exact sum comes from the quote.
export function fromLine(setup: number, monthly: number, locale: Loc): string {
  return `${fromWord(locale)} ${priceLine(setup, monthly, locale)}`
}
