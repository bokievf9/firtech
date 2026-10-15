import type { Locale } from '@/lib/i18n'
import en from './en'
import ru, { type Dict } from './ru'

const dictionaries: Record<Locale, Dict> = { ru, en }

export function getDict(locale: Locale): Dict {
  return dictionaries[locale]
}

export type { Dict }
