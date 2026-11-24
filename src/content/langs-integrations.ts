// Two honest content blocks (owner audit 2026-11-24, market gaps #4 and #11): which languages the agent speaks and
// which systems we connect. Shared by the agent pages, the AI-team pages, the builder agent step, the home agents
// section and the FAQ. Components: src/components/languages-note.tsx and integrations-list.tsx.
// Rules: no «бот», no dashes, no prices, no third-party brand images.

export type Bi = { readonly ru: string; readonly en: string }

export const languagesCopy = {
  note: {
    ru: 'Агент отвечает на русском и английском. Узбекский, казахский и таджикский понимает и отвечает, качество проверяем на ваших диалогах до запуска; на смету это не влияет.',
    en: 'The agent answers in Russian and English. It also understands and answers in Uzbek, Kazakh and Tajik; we check the quality on your own dialogues before launch, and it does not change the quote.',
  },
  exampleSummary: { ru: 'Пример на узбекском', en: 'Example in Uzbek' },
  exampleHint: {
    ru: 'Условный пример записи на приём, не реальный диалог клиента.',
    en: 'An illustrative booking example, not a real client dialogue.',
  },
  roles: {
    client: { ru: 'Клиент', en: 'Client' },
    agent: { ru: 'Агент', en: 'Agent' },
  },
  // Uzbek, Latin script. Three lines: the question about a booking, the agent's answer, the confirmation.
  example: [
    { who: 'client', text: "Salom! Ertaga soat 15:00 ga yozilsam bo'ladimi? Ismim Aziza." },
    { who: 'agent', text: "Salom, Aziza! Ha, ertaga soat 15:00 bo'sh. Sizni shu vaqtga yozib qo'yaymi?" },
    { who: 'client', text: "Ha, iltimos, tasdiqlang. Rahmat!" },
  ],
} as const

export const integrationIds = ['bitrix24', 'amocrm', 'sheets', 'miniapp', 'api'] as const
export type IntegrationId = (typeof integrationIds)[number]

export const integrationsCopy = {
  title: { ru: 'Подключаем', en: 'We connect' },
  line: {
    ru: 'Подключение входит в этап запуска; если вашей системы нет в списке, напишите в сборке, скажем в смете.',
    en: 'Connecting is part of the launch stage; if your system is not on the list, tell us in the builder and we will say in the quote.',
  },
  names: {
    bitrix24: { ru: 'Bitrix24', en: 'Bitrix24' },
    amocrm: { ru: 'amoCRM', en: 'amoCRM' },
    sheets: { ru: 'Google Sheets', en: 'Google Sheets' },
    miniapp: { ru: 'Telegram Mini App', en: 'Telegram Mini App' },
    api: { ru: 'Другая CRM по API', en: 'Another CRM via API' },
  },
} as const satisfies { title: Bi; line: Bi; names: Record<IntegrationId, Bi> }

// The FAQ pair (also written into the dictionaries, a test keeps them equal).
export const languagesFaq = {
  q: { ru: 'На каких языках работает агент?', en: 'Which languages does the agent speak?' },
}

export const pickBi = (b: Bi, locale: string) => (locale === 'ru' ? b.ru : b.en)
