// The 404 page is a client component (it reads the locale from the URL), so it imports only these
// few strings instead of both dictionaries; ru.ts and en.ts point here to keep one source.
export const notFoundText = {
  ru: {
    title: 'Такой страницы нет',
    text: 'Возможно, ссылка устарела. Вернитесь на главную.',
    home: 'На главную',
  },
  en: {
    title: 'Page not found',
    text: 'The link may be out of date. Head back to the home page.',
    home: 'Home',
  },
}
