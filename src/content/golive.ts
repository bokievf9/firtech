// The go-live checklist of the owner panel (owner 2026-11-21: «когда проект на 100% готов»). Typed
// data: the owner edits this list later. `owner` = the owner ticks it, `claude` = a Claude session
// verifies it. Item ids are stored in golive.json, so never rename an id that has been ticked.

export type GoliveOwner = 'owner' | 'claude'
export type GoliveItem = {
  id: string
  block: string
  title: string
  hint: string
  owner: GoliveOwner
  link?: string
}

export const goliveBlocks = [
  { id: 'site', title: 'Сайт' },
  { id: 'cab', title: 'Кабинет и заявки' },
  { id: 'pay', title: 'Оплата' },
  { id: 'hq', title: 'HQ и процессы' },
  { id: 'mk', title: 'Маркетинг' },
  { id: 'ops', title: 'Связь и ops' },
  { id: 'launch', title: 'Запуск' },
  { id: 'market', title: 'Рынок' },
] as const

export const goliveItems: GoliveItem[] = [
  { id: 'site-theme-review', block: 'site', title: 'Белая и тёмная тема проверены на всех страницах', hint: 'Переключатель в шапке, главная, услуги, сборка проекта, блог, кабинет.', owner: 'owner' },
  { id: 'site-copy', block: 'site', title: 'Тексты, цены и условия вычитаны', hint: 'Цены только из сборки проекта, без опечаток, RU и EN.', owner: 'owner' },
  { id: 'site-seo', block: 'site', title: 'Sitemap, robots, Search Console и Яндекс Вебмастер подключены', hint: 'Сайт добавлен в обе консоли, sitemap принят без ошибок.', owner: 'owner', link: 'https://search.google.com/search-console' },
  { id: 'site-speed', block: 'site', title: 'Главная и сборка проекта: Lighthouse 90+ на мобильном', hint: 'Замер на проде, не на локальной сборке.', owner: 'claude' },
  { id: 'site-legal', block: 'site', title: 'Политика и условия в финальной редакции', hint: 'Условия и политика конфиденциальности прочитаны владельцем.', owner: 'owner', link: '/ru/terms' },

  { id: 'cab-google', block: 'cab', title: 'Вход через Google работает', hint: 'Новый аккаунт входит и попадает в кабинет.', owner: 'owner' },
  { id: 'cab-email', block: 'cab', title: 'Регистрация по почте: письмо приходит (Resend SMTP)', hint: 'Письмо подтверждения доходит во входящие, не в спам.', owner: 'owner' },
  { id: 'cab-lead-e2e', block: 'cab', title: 'Сквозная проверка: заявка, HQ, КП, договор, счёт, оплата, проект в кабинете', hint: 'Один тестовый клиент проходит весь путь, потом чистится.', owner: 'claude' },
  { id: 'cab-messages', block: 'cab', title: 'Переписка клиент и менеджер в обе стороны', hint: 'Клиент пишет из кабинета, владелец отвечает из HQ, и наоборот.', owner: 'claude' },
  { id: 'cab-review', block: 'cab', title: 'Кабинет просмотрен владельцем, табы и предложения ок', hint: 'Обзор, Заявки, проекты, счета, документы.', owner: 'owner' },

  { id: 'pay-wallets', block: 'pay', title: 'Кошельки USDT TRC20 и TON проверены переводом на 1 USDT', hint: 'Перевод дошёл, сеть и адрес совпадают со счётом.', owner: 'owner' },
  { id: 'pay-watch', block: 'pay', title: 'Сторож оплат засёк тестовый перевод и провёл счёт', hint: 'Счёт сменил статус сам, без ручной отметки.', owner: 'claude' },
  { id: 'pay-docs', block: 'pay', title: 'КП, договор, счёт, смета: шаблоны проверены', hint: 'Реквизиты, сроки, счёт за этап 1, следующие после приёмки, гарантия.', owner: 'owner' },

  { id: 'hq-routines', block: 'hq', title: 'Все рутины отработали по расписанию без ошибок 24 ч', hint: 'Панель Компания, вкладка рутин.', owner: 'claude' },
  { id: 'hq-approvals', block: 'hq', title: 'Карточки одобрений в Telegram и HQ работают', hint: 'Одобрить, править, отклонить: результат виден в обоих местах.', owner: 'owner' },
  { id: 'hq-backup', block: 'hq', title: 'Ночной бэкап пришёл в Telegram', hint: 'Файл пришёл и открывается.', owner: 'claude' },
  { id: 'hq-monitoring', block: 'hq', title: 'Внешний монитор (UptimeRobot) и алерты', hint: 'Сайт и HQ под наблюдением, алерт приходит владельцу.', owner: 'owner' },
  { id: 'hq-instructions', block: 'hq', title: 'Инструкции голов перезагружены, плейбуки на месте', hint: 'Панель Компания, плейбуки: у каждой роли свежая дата.', owner: 'claude' },

  { id: 'mk-profiles', block: 'mk', title: 'Профили: YouTube, Instagram, TikTok (/profile all), Дзен руками', hint: 'Аватар, шапка, описание и ссылка на сайт везде.', owner: 'owner' },
  { id: 'mk-week', block: 'mk', title: 'Пакет недели одобрен', hint: 'Панель Маркетинг, вкладка Контент.', owner: 'owner' },
  { id: 'mk-youtube', block: 'mk', title: 'Первый Short загружен (unlisted до слова владельца)', hint: 'Видео загружено как unlisted, публикуется только после слова владельца; ссылка в профиле работает.', owner: 'claude' },
  { id: 'mk-instagram', block: 'mk', title: 'Публикатор на Маке: вход, проба, launchd', hint: 'Пробная публикация прошла, агент запускается сам.', owner: 'owner' },
  { id: 'mk-blog', block: 'mk', title: 'Блог: 7+ статей, RSS подключён к Дзену', hint: 'Лента /rss.xml принята Дзеном.', owner: 'owner' },
  { id: 'mk-analytics', block: 'mk', title: 'Цифры недели в HQ показывают сайт, блог, YouTube', hint: 'Панель Маркетинг, вкладка Цифры.', owner: 'claude' },

  { id: 'ops-mail', block: 'ops', title: 'Почта hello@firtech.pro принимает письма', hint: 'Тестовое письмо с чужого адреса дошло.', owner: 'owner' },
  { id: 'ops-telegram', block: 'ops', title: '@firtech_bot: анкета, демо, «позвать человека» проверены', hint: 'Все три сценария пройдены с телефона.', owner: 'owner' },
  { id: 'ops-cron', block: 'ops', title: 'Cron watch и backup сайта на новом сервере', hint: 'Задания есть в crontab пользователя deploy и срабатывают.', owner: 'claude' },
  { id: 'ops-rollback', block: 'ops', title: 'Откат деплоя проверен', hint: 'Откат на прошлый релиз и возврат вперёд без потери данных.', owner: 'claude' },

  { id: 'launch-first-clients', block: 'launch', title: 'План первых 10 клиентов: 100 бизнесов от Разведчика, 10 знакомых, 2GIS и Google Карты, партнёры 10%', hint: 'Список составлен, первые контакты назначены.', owner: 'owner' },
  { id: 'launch-demo-client', block: 'launch', title: 'Демо-клиент с полным проектом в кабинете для показов', hint: 'Тестовый клиент с заявкой, проектом, счётом и документами, помечен как демо.', owner: 'claude' },
  { id: 'launch-sla', block: 'launch', title: 'SLA на сайте: первый ответ за 5 минут круглосуточно, цены после владельца', hint: 'На сайте, в чате и в боте одно обещание.', owner: 'claude' },
  { id: 'launch-film', block: 'launch', title: 'Launch-фильм и серия постов запуска', hint: 'Ролик и посты готовы и одобрены.', owner: 'claude' },
  { id: 'launch-stoplist', block: 'launch', title: 'Стоп-лист соблюдён: без TikTok API, Telegram-канала, Meta API, валют', hint: 'Нигде не подключены и не обещаны.', owner: 'owner' },

  { id: 'proof-pilot-case', block: 'market', title: 'Сделать 1-2 пилота и опубликовать кейс с цифрами', hint: 'Бесплатно или по себестоимости под письменный отзыв; у конкурентов есть кейсы и отзывы, у нас нет ни одного', owner: 'owner' },
  { id: 'proof-reviews-platforms', block: 'market', title: 'Завести профили на FL.ru, Kwork, Upwork и собрать первые отзывы', hint: 'Независимые рейтинги есть у ближайших конкурентов (FL.ru, 2ГИС, Upwork)', owner: 'owner' },
  { id: 'offer-demo-24h', block: 'market', title: 'Добавить предложение: демо на ваших данных за 24 часа до оплаты', hint: 'Крючок у PapAI Soft; формулировка и форма на сайте на стороне claude, обещание на стороне владельца', owner: 'owner' },
  { id: 'guarantee-first-screen', block: 'market', title: 'Вынести гарантию «возвращаем оплату первого этапа» в первый экран главной', hint: 'У большинства конкурентов гарантии не найдено; ссылка на оферту /terms', owner: 'claude' },
  { id: 'legal-executor-data', block: 'market', title: 'Опубликовать данные исполнителя и вычитанную юристом оферту', hint: 'У конкурентов видны адрес, телефон, ИНН ИП; у нас на /terms оговорка про проверку юристом', owner: 'owner' },
  { id: 'channels-whatsapp-phone', block: 'market', title: 'Добавить WhatsApp и телефон как каналы ответа', hint: 'У большинства студий СНГ есть WhatsApp и телефон; у нас Telegram и Instagram', owner: 'owner' },
  { id: 'seo-city-niche-pages', block: 'market', title: 'Сделать страницы по городам и нишам с демо под нишу', hint: 'Душанбе, Ташкент, Алматы, Бишкек; салон, клиника, автосервис', owner: 'claude' },
  { id: 'howto-usdt-pay', block: 'market', title: 'Страница «Как оплатить» USDT за 3 шага', hint: 'Построена на /pay-how: проверь тексты и шаги, отметь пункт сам. USDT не найдена ни у одного конкурента; снимает страх первой оплаты', owner: 'owner', link: '/ru/pay-how' },
]

export const goliveText = {
  title: 'Go-live',
  chipOff: 'Go-live: не запущен',
  chipOn: 'До go-live',
  chipOver: 'Go-live: время вышло',
  open: 'Открыть план go-live',
  units: ['часов', 'минут', 'секунд'],
  deadline: 'Срок',
  over: 'Время вышло',
  overAgo: 'прошло {t}',
  notStarted: 'Таймер не запущен',
  notStartedHint: 'Запусти его, когда начнёшь последний рывок.',
  start: 'Запустить {h} часа',
  startConfirm: 'Запустить таймер на {h} часа? Срок встанет на {d}.',
  restart: 'Перезапустить',
  reset: 'Сбросить',
  resetConfirm: 'Сбросить таймер? Отметки в списке останутся.',
  yes: 'Да',
  progress: 'Готово {n} из {m} ({p}%)',
  ticked: 'Отмечено {t}',
  you: 'ты',
  claude: 'Claude',
  noteLabel: 'Заметка',
  notePlaceholder: 'Заметка',
  link: 'Открыть ссылку',
  saved: 'Не удалось сохранить: {e}',
  loadFailed: 'Не удалось загрузить план go-live',
  retry: 'Повторить',
  loading: 'Загружаем план',
  allDone: 'Всё готово к первому заказчику',
  back: 'Офис',
  backLabel: 'Назад в офис',
  tz: 'Куала-Лумпур',
  checklist: 'Чеклист запуска',
  blocksNav: 'Блоки чеклиста',
  top: 'Наверх',
  openNote: 'Показать заметку',
  hasNote: 'Есть заметка',
  labels: ['часов', 'минут', 'секунд'],
} as const
