// HQ sometimes sends department names or status words as Russian data ('Маркетинг', 'Бэк-офис',
// 'в работе'). The Shell UI is English (owner decision), so known values map to English labels
// here by id or by the known Russian word; an unknown value is shown as received.

const DEPTS: Record<string, string> = {
  director: 'Director',
  marketing: 'Marketing',
  sales: 'Sales',
  support: 'Support',
  production: 'Production',
  'back-office': 'Back office',
  backoffice: 'Back office',
  company: 'Company',
  'маркетинг': 'Marketing', // i18n-ok: parses Russian data
  'продажи': 'Sales', // i18n-ok: parses Russian data
  'поддержка': 'Support', // i18n-ok: parses Russian data
  'сопровождение': 'Support', // i18n-ok: parses Russian data
  'производство': 'Production', // i18n-ok: parses Russian data
  'бэк-офис': 'Back office', // i18n-ok: parses Russian data
  'директор': 'Director', // i18n-ok: parses Russian data
  'компания': 'Company', // i18n-ok: parses Russian data
}

const STATUSES: Record<string, string> = {
  'работает': 'working', // i18n-ok: parses Russian data
  'в работе': 'running', // i18n-ok: parses Russian data
  'ждёт': 'waiting', // i18n-ok: parses Russian data
  'застрял': 'stuck', // i18n-ok: parses Russian data
  'застряла': 'stuck', // i18n-ok: parses Russian data
  'свободен': 'free', // i18n-ok: parses Russian data
  'спит': 'asleep', // i18n-ok: parses Russian data
  'на паузе': 'paused', // i18n-ok: parses Russian data
  'готово': 'done', // i18n-ok: parses Russian data
}

const lookup = (map: Record<string, string>, value: string) => map[value.trim().toLowerCase()] ?? value

export const deptLabel = (value: string): string => lookup(DEPTS, value)
export const statusLabel = (value: string): string => lookup(STATUSES, value)
