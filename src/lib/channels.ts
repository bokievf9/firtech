import type { Locale } from './i18n'

// The channels an AI product of Fir Tech can live in (owner 2026-11-22: Telegram is ONE channel among many, never the
// default or the only place). Listed as equals, no channel is the default. Used by the
// «Где живёт» strip of the product pages and later by the builder. Each channel has a name and one line in both
// languages; the quote says which of them a project includes.
export const channelIds = ['telegram', 'whatsapp', 'web', 'cabinet', 'voice', 'email', 'desktop'] as const
export type ChannelId = (typeof channelIds)[number]

type Text = { ru: string; en: string }

export const channels: Record<ChannelId, { name: Text; line: Text }> = {
  telegram: {
    name: { ru: 'Telegram', en: 'Telegram' },
    line: { ru: 'Сводки, ответы и кнопки одобрения в чате', en: 'Briefs, answers and approval buttons in a chat' },
  },
  whatsapp: {
    name: { ru: 'WhatsApp', en: 'WhatsApp' },
    line: { ru: 'Там, где клиенты уже пишут бизнесу', en: 'Where clients already message businesses' },
  },
  web: {
    name: { ru: 'Чат на сайте', en: 'Site chat' },
    line: { ru: 'Виджет на вашем сайте, отвечает без регистрации', en: 'A widget on your site that answers without signing up' },
  },
  cabinet: {
    name: { ru: 'Личный кабинет', en: 'Personal cabinet' },
    line: { ru: 'Свой веб-кабинет с историей, файлами и задачами', en: 'Your own web cabinet with history, files and tasks' },
  },
  voice: {
    name: { ru: 'Голос', en: 'Voice' },
    line: { ru: 'Звонки и голосовые сообщения, ИИ понимает и отвечает', en: 'Calls and voice messages, the AI listens and answers' },
  },
  email: {
    name: { ru: 'Почта', en: 'Email' },
    line: { ru: 'Читает письма, готовит ответы, отправляет после вашего да', en: 'Reads mail, drafts replies, sends after your yes' },
  },
  desktop: {
    name: { ru: 'Рабочий стол', en: 'Desktop' },
    line: { ru: 'Приложение для Mac и Windows всегда под рукой', en: 'A Mac and Windows app always at hand' },
  },
}

export const channelName = (id: ChannelId, locale: Locale | string) => channels[id].name[locale === 'en' ? 'en' : 'ru']
export const channelLine = (id: ChannelId, locale: Locale | string) => channels[id].line[locale === 'en' ? 'en' : 'ru']
