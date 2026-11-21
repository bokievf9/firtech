// Types and tiny helpers of the price editor, light enough for the Пульт client bundle.

export type PriceUnit = 'usd' | 'usd_month' | 'percent'
export type PriceGroup = 'start' | 'kinds' | 'options' | 'extras' | 'plans' | 'discounts' | 'stages'

export type PriceField = {
  path: string
  label: string
  group: PriceGroup
  // Sub-heading inside a group (a service, a template), for the tables.
  section: string
  unit: PriceUnit
  min: number
  max: number
  step: number
  def: number
}

export type HistoryEntry = { at: string; path: string; from: number; to: number; by: string }
export const groupTitles: Record<PriceGroup, string> = {
  start: 'Старт-цены',
  kinds: 'Сборка по видам',
  options: 'Опции',
  extras: 'Допы',
  plans: 'Подписки',
  discounts: 'Скидки и реферал',
  stages: 'Этапы оплаты',
}

export function getAt(obj: unknown, path: string): unknown {
  let node = obj
  for (const key of path.split('.')) {
    if (!node || typeof node !== 'object' || !Object.hasOwn(node, key)) return undefined
    node = (node as Record<string, unknown>)[key]
  }
  return node
}

