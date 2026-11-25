import type { Loc } from './sitemap'

// The three chips above the chat input, by page context (`pageContextFor` in guide.ts). Each chip is a tour,
// a trip to a place of the site map, a jump to a section of this page, or a prepared question for the chat.
export type ChipAction =
  | { type: 'tour' }
  | { type: 'go'; key: string }
  | { type: 'section'; selectors: readonly string[]; fallbackKey: string }
  | { type: 'chat'; text: Record<Loc, string> }

export type Chip = { id: string; label: Record<Loc, string>; action: ChipAction }

const c = (id: string, ru: string, en: string, action: ChipAction): Chip => ({ id, label: { ru, en }, action })

const homeChips: Chip[] = [
  c('home-what', 'Что здесь?', 'What is here?', { type: 'tour' }),
  c('home-price', 'Сколько стоит?', 'How much?', { type: 'go', key: 'prices' }),
  c('home-start', 'С чего начать?', 'Where to start?', { type: 'go', key: 'builder' }),
]

export const chipsByContext: Record<string, Chip[]> = {
  home: homeChips,
  products: [
    c('prod-can', 'Что умеет?', 'What can it do?', { type: 'section', selectors: ['[data-tour="capabilities"]', '[data-tour="skills"]', '[data-tour="brain"]', '[data-tour="demo"]'], fallbackKey: 'products' }),
    c('prod-price', 'Цена', 'Price', { type: 'section', selectors: ['[data-tour="price"]', '[data-tour="plans"]'], fallbackKey: 'prices' }),
    c('prod-order', 'Как заказать', 'How to order', { type: 'go', key: 'builder' }),
  ],
  builder: [
    c('b-next', 'Что спросят дальше?', 'What will you ask next?', { type: 'chat', text: { ru: 'Что вы спросите у меня дальше, чтобы собрать проект?', en: 'What will you ask me next to put the project together?' } }),
    c('b-now', 'Сколько сейчас?', 'How much now?', { type: 'chat', text: { ru: 'Сколько сейчас выходит по моей сборке?', en: 'How much does my build come to right now?' } }),
    c('b-later', 'Можно позже?', 'Can I pay later?', { type: 'go', key: 'pay-stages' }),
  ],
  dashboard: [
    c('c-estimate', 'Где моя смета?', 'Where is my estimate?', { type: 'go', key: 'cabinet-docs' }),
    c('c-next', 'Что дальше?', 'What is next?', { type: 'chat', text: { ru: 'Что дальше по моему проекту?', en: 'What is next for my project?' } }),
    c('c-manager', 'Написать менеджеру', 'Write to the manager', { type: 'chat', text: { ru: 'Хочу написать менеджеру проекта.', en: 'I want to write to the project manager.' } }),
  ],
  pricing: [
    c('pr-pay', 'Как оплатить?', 'How to pay?', { type: 'go', key: 'pay-how' }),
    c('pr-guarantee', 'Есть гарантия?', 'Is there a guarantee?', { type: 'go', key: 'pay-guarantee' }),
    c('pr-stages', 'Можно частями?', 'Can I pay in parts?', { type: 'go', key: 'pay-stages' }),
  ],
}

/** The chips of a page context; a context without its own set (the blog, legal pages, a 404) gets the home set. */
export function chipsFor(context: string): Chip[] {
  return chipsByContext[context] ?? homeChips
}
