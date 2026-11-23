import type { Dict } from '@/content'
import { START_IN_DAYS } from './pricing'

// «Старт через 3 рабочих дня после оплаты первого этапа».
export function startLine(dict: Dict, days: number = START_IN_DAYS): string {
  const e = dict.builder.estimate
  const [one, few, many] = e.workdays
  const mod10 = days % 10
  const mod100 = days % 100
  // Russian plural; the English list repeats the plural form for «few» and «many».
  const word = mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many
  return e.startTemplate.replace('{days}', `${days} ${word}`)
}
