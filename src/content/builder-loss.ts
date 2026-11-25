// Copy of the loss block in the agent step of «Сборка проекта» («Сколько вы теряете без агента»), RU and EN. Kept apart
// from the dictionaries on purpose. No promises: only «теряете примерно», the numbers are the visitor's own. No em or en
// dashes (use a hyphen). Prices are never typed here (they come from pricing.ts through the estimate).

type Loc = 'ru' | 'en'
const l = (ru: string, en: string): Record<Loc, string> => ({ ru, en })

export const lossUi = {
  title: l('Сколько вы теряете без агента', 'What you lose without an agent'),
  open: l('Посчитать потери', 'Count the losses'),
  close: l('Скрыть расчёт', 'Hide the count'),
  missedPerDay: l('Обращений в день', 'Inquiries a day'),
  avgCheck: l('Средний чек, USD', 'Average check, USD'),
  offHoursShare: l('Доля вне рабочего времени, %', 'Share outside working hours, %'),
  conversion: l('При конверсии, %', 'At a conversion of, %'),
  hint: l(
    'Числа ваши: мы подставили осторожные цифры для типичного бизнеса, поправьте их под себя. Это грубая оценка, не обещание.',
    'The numbers are yours: we filled in careful figures for a typical business, change them to fit. A rough estimate, not a promise.',
  ),
  result: (n: string, usd: string): Record<Loc, string> => ({
    ru: `Пропущено в месяц: ${n} обращений, это теряете примерно ${usd} USD`,
    en: `Missed a month: ${n} inquiries, you lose roughly ${usd} USD`,
  }),
  basis: (conversion: number): Record<Loc, string> => ({
    ru: `Расчёт: обращения в день x 30 x доля вне рабочего времени x средний чек x конверсия ${conversion} %.`,
    en: `Count: inquiries a day x 30 x share outside working hours x average check x conversion ${conversion} %.`,
  }),
  agent: (setup: string, monthly: string): Record<Loc, string> => ({
    ru: `Агент: ${setup} USD разово + ${monthly} USD/мес`,
    en: `Agent: ${setup} USD one-time + ${monthly} USD/mo`,
  }),
}
