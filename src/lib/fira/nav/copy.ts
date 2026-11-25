import type { Loc } from './sitemap'

// Fira nav 2.0 texts (the spotlight tour, the site map panel, the link cards, the offer). Kept here, next to the
// code that uses them, in both languages; the older guide lines stay in the dictionaries (`firaGuide`).
export type NavCopy = {
  back: string
  next: string
  stop: string
  finish: string
  tourLabel: string
  progressDots: string
  offer: string
  offerYes: string
  offerNo: string
  mapItem: string
  mapTitle: string
  mapSearch: string
  mapSearchLabel: string
  mapRecent: string
  mapNone: string
  mapClose: string
  mapGo: string
  here: string
  cardHere: string
  cardGo: string
  chipsLabel: string
  notThere: string
}

export const navCopy: Record<Loc, NavCopy> = {
  ru: {
    back: 'Назад',
    next: 'Дальше',
    stop: 'Хватит',
    finish: 'Готово',
    tourLabel: 'Экскурсия по странице',
    progressDots: 'Шаг',
    offer: 'Хотите, проведу по странице? Это займёт минуту.',
    offerYes: 'Показать',
    offerNo: 'Не сейчас',
    mapItem: 'Карта сайта',
    mapTitle: 'Куда вас отвести?',
    mapSearch: 'Например: цены, оплата, кабинет',
    mapSearchLabel: 'Что вы ищете на сайте',
    mapRecent: 'Недавно',
    mapNone: 'Не нашла такого места. Спросите меня в чате, отвечу.',
    mapClose: 'Закрыть карту',
    mapGo: 'Отвести',
    here: 'Это здесь, покажу.',
    cardHere: 'Показать здесь',
    cardGo: 'Перейти',
    chipsLabel: 'Быстрые вопросы',
    notThere: 'Этого места сейчас нет на странице, но я рядом.',
  },
  en: {
    back: 'Back',
    next: 'Next',
    stop: 'Stop',
    finish: 'Done',
    tourLabel: 'Page tour',
    progressDots: 'Step',
    offer: 'Want me to walk you through this page? It takes a minute.',
    offerYes: 'Show me',
    offerNo: 'Not now',
    mapItem: 'Site map',
    mapTitle: 'Where shall I take you?',
    mapSearch: 'For example: prices, payment, cabinet',
    mapSearchLabel: 'What are you looking for on the site',
    mapRecent: 'Recent',
    mapNone: 'I could not find that place. Ask me in the chat and I will answer.',
    mapClose: 'Close the map',
    mapGo: 'Take me',
    here: 'That is right here, let me show you.',
    cardHere: 'Show here',
    cardGo: 'Open',
    chipsLabel: 'Quick questions',
    notThere: 'That place is not on this page right now, but I am nearby.',
  },
}

export const navCopyFor = (locale: string): NavCopy => (locale === 'en' ? navCopy.en : navCopy.ru)
