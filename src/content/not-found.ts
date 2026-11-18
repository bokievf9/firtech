// The 404 page is a client component (it reads the locale from the URL), so it imports only these
// few strings instead of both dictionaries; ru.ts and en.ts point here to keep one source.
// `pages` is the small search index of the 404 page: `path` is appended to `/<locale>`.
export const notFoundText = {
  ru: {
    title: 'Такой страницы нет',
    text: 'Возможно, ссылка устарела. Вернитесь на главную.',
    home: 'На главную',
    eyebrow: 'Ошибка 404',
    bot: 'Похоже, эта страница ушла на обед и не вернулась.',
    bot2: 'Я ИИ-приёмщик Fir Tech. Найдём, что вы искали:',
    search: 'Поиск по сайту',
    placeholder: 'Например: запись, бот, цены',
    empty: 'Ничего не нашли. Спросите приёмщика в чате, он подскажет.',
    chat: 'Спросить приёмщика',
    links: {
      home: 'Главная',
      products: 'Продукты',
      builder: 'Конструктор',
      solutions: 'Решения',
      blog: 'Блог',
      contact: 'Обсудить проект',
    },
    pages: [
      { label: 'Бот-администратор: запись и напоминания', path: '#product-admin', keys: 'бот запись салон клиника напоминания отзывы' },
      { label: 'ИИ-приёмщик заявок 24/7', path: '#product-receptionist', keys: 'приёмщик заявки чат whatsapp instagram' },
      { label: 'Автоматизация рутины', path: '#product-automation', keys: 'автоматизация отчёты таблицы crm рассылки' },
      { label: 'Контент на автопилоте', path: '#product-content', keys: 'контент посты соцсети ролики' },
      { label: 'Telegram Mini App', path: '#product-miniapp', keys: 'mini app магазин корзина доставка' },
      { label: 'Личный агент: Dono и Polly', path: '#product-agent', keys: 'личный агент dono polly учёба язык' },
      { label: 'Внедрение ИИ в компанию', path: '#product-implementation', keys: 'ии база знаний документы обучение' },
      { label: 'Сайты и лендинги', path: '/services/websites', keys: 'сайт лендинг магазин' },
      { label: 'Telegram-боты', path: '/services/bots', keys: 'бот telegram телеграм' },
      { label: 'Приложения', path: '/services/apps', keys: 'приложение ios android pwa' },
      { label: 'Автоматизация и ИИ', path: '/services/automation', keys: 'автоматизация ии интеграции' },
      { label: 'Конструктор проекта', path: '/builder', keys: 'конструктор смета цена расчёт' },
      { label: 'Цены и калькулятор', path: '#pricing', keys: 'цены стоимость калькулятор' },
      { label: 'Решения для бизнеса', path: '/solutions', keys: 'решения кафе салон магазин доставка' },
      { label: 'Блог', path: '/blog', keys: 'блог статьи' },
      { label: 'Попробовать приёмщика', path: '#demo', keys: 'демо чат попробовать' },
      { label: 'Оставить заявку', path: '#contact', keys: 'заявка контакты связаться' },
    ],
  },
  en: {
    title: 'Page not found',
    text: 'The link may be out of date. Head back to the home page.',
    home: 'Home',
    eyebrow: 'Error 404',
    bot: 'Looks like this page went out for lunch and never came back.',
    bot2: 'I am the Fir Tech AI receptionist. Let us find what you were after:',
    search: 'Search the site',
    placeholder: 'For example: booking, bot, prices',
    empty: 'Nothing found. Ask the receptionist in the chat, it will help.',
    chat: 'Ask the receptionist',
    links: {
      home: 'Home',
      products: 'Products',
      builder: 'Builder',
      solutions: 'Solutions',
      blog: 'Blog',
      contact: 'Discuss a project',
    },
    pages: [
      { label: 'Booking admin bot: bookings and reminders', path: '#product-admin', keys: 'bot booking salon clinic reminders reviews' },
      { label: 'AI lead receptionist 24/7', path: '#product-receptionist', keys: 'receptionist requests chat whatsapp instagram' },
      { label: 'Routine automation', path: '#product-automation', keys: 'automation reports sheets crm mailings' },
      { label: 'Content on autopilot', path: '#product-content', keys: 'content posts social videos' },
      { label: 'Telegram Mini App', path: '#product-miniapp', keys: 'mini app shop cart delivery' },
      { label: 'Personal agent: Dono and Polly', path: '#product-agent', keys: 'personal agent dono polly study language' },
      { label: 'AI in your company', path: '#product-implementation', keys: 'ai knowledge base documents training' },
      { label: 'Websites and landing pages', path: '/services/websites', keys: 'website landing shop' },
      { label: 'Telegram bots', path: '/services/bots', keys: 'bot telegram' },
      { label: 'Apps', path: '/services/apps', keys: 'app ios android pwa' },
      { label: 'Automation and AI', path: '/services/automation', keys: 'automation ai integrations' },
      { label: 'Project builder', path: '/builder', keys: 'builder quote price estimate' },
      { label: 'Prices and calculator', path: '#pricing', keys: 'prices cost calculator' },
      { label: 'Solutions for business', path: '/solutions', keys: 'solutions cafe salon shop delivery' },
      { label: 'Blog', path: '/blog', keys: 'blog articles' },
      { label: 'Try the receptionist', path: '#demo', keys: 'demo chat try' },
      { label: 'Send a request', path: '#contact', keys: 'request contact reach' },
    ],
  },
}

// Case-insensitive search over the 404 index: every word of the query must appear in the label or
// the keywords. An empty query returns nothing (the page shows the quick links instead).
export function searchPages<T extends { label: string; keys: string }>(pages: T[], query: string) {
  const words = query.toLowerCase().replace(/ё/g, 'е').split(/\s+/).filter(Boolean)
  if (!words.length) return []
  return pages.filter((p) => {
    const hay = `${p.label} ${p.keys}`.toLowerCase().replace(/ё/g, 'е')
    return words.every((w) => hay.includes(w))
  })
}
