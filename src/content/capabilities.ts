import type { KindId, L, ProductId } from './builder-catalog'
import type { PersonalWhoMore } from '../lib/builder-ids'

// «Сборка проекта» v5: ONE catalogue of what a project can do (owner 2026-11-23: «в сборке нужно увеличить
// количество деталей к каждому вопросу ×5–×10, максимально увеличить детализацию возможностей»).
// Typed, RU and EN side by side, ids stable: ids only ever get APPENDED, they travel in the `?b=` link
// (chunk `x.<base64url JSON>`, see lib/builder-capabilities.ts) and in the lead brief for HQ.
// Rows are compact tuples so the lists stay readable; `table()` turns them into typed objects.
// Prices are never here: a capability is provided by priced products (`by`), when none of the picked
// products provides it the builder flags it «по смете» and never shows a number.
// No em or en dashes in copy (use a hyphen).

export type Item = { id: string; group: string; name: L<string>; hint: L<string> }
export type Provider = ProductId | 'sales' | 'marketing' | 'support' | 'production' | 'backoffice'
export type Capability = Item & { by: readonly Provider[] }
export type Group = { id: string; name: L<string> }

const l = (ru: string, en: string): L<string> => ({ ru, en })
const groups = (rows: readonly (readonly [string, string, string])[]): Group[] =>
  rows.map(([id, ru, en]) => ({ id, name: l(ru, en) }))

// [id, ru name, ru hint, en name, en hint]
type Row = readonly [string, string, string, string, string]
const table = (group: string, rows: readonly Row[]): Item[] =>
  rows.map(([id, ru, ruHint, en, enHint]) => ({ id, group, name: l(ru, en), hint: l(ruHint, enHint) }))

// ----------------------------------------------------------------- UI strings

export const catalogUi = {
  search: l('Найти по слову', 'Search by word'),
  all: l('Все', 'All'),
  selected: l('Выбрано', 'Selected'),
  showMore: l('Показать ещё', 'Show more'),
  showLess: l('Свернуть', 'Show less'),
  nothing: l('Ничего не нашлось, попробуйте другое слово', 'Nothing found, try another word'),
  clear: l('Сбросить', 'Clear'),
  included: l('входит в состав', 'in your set'),
  quote: l('по смете', 'on quote'),
  quoteNote: l(
    'Пункты с пометкой «по смете» не входят в цену выбранных продуктов: назовём цену после разговора, числа тут не печатаем.',
    'Items marked «on quote» are not in the price of the picked products: we name the price after a call, no number is printed here.',
  ),
  noPrice: l('Без доплаты в сборке: уточним на звонке', 'No price here: we settle it on the call'),
  subniche: l('Уточните нишу', 'Narrow the niche'),
  subnicheHint: l('Можно несколько', 'Several are fine'),
  pains: l('Что болит чаще всего', 'What hurts most'),
  results: l('Какого результата вы ждёте', 'Which results you expect'),
  resultsHint: l('Отметьте всё, что хотите получить', 'Tick everything you want to get'),
  caps: l('Что ещё должен уметь агент', 'What else the agent should do'),
  capsHint: l('Более ста возможностей по группам, поиск и вкладки', 'Over a hundred abilities in groups, with search and tabs'),
  channelOpts: l('Каналы подробно', 'Channels in detail'),
  channelOptsHint: l('Где именно и как агент общается с клиентами', 'Where exactly and how the agent talks to customers'),
  integrations: l('С чем соединить', 'What to connect'),
  integrationsHint: l('Сервисы, которые у вас уже есть', 'The services you already use'),
  content: l('Контент: форматы и частота', 'Content: formats and frequency'),
  contentHint: l('Отметьте формат и как часто он нужен', 'Pick a format and how often you need it'),
  frequency: l('Как часто', 'How often'),
  skills: l('Ещё умения по сферам жизни', 'More skills by life area'),
  skillsHint: l('Больше сорока умений, ничего не обязательно', 'Over forty skills, none required'),
  connections: l('Подключения подробно', 'Connections in detail'),
  moreRoles: l('Ещё роли', 'More roles'),
  fewerRoles: l('Свернуть роли', 'Fewer roles'),
  more: l('ещё', 'more'),
}

// ------------------------------------------------------- niches: sub-niches

// Per kind 2-5 sub-niches, [ru, en]. Ids are generated from the position (`cafe1`, `cafe2`...): only append.
// The three pains of a niche are in `kindCatalog[kind].ru|en[3]` (see `nichePains`), not copied here.
const subRows: Record<KindId, readonly (readonly [string, string])[]> = {
  cafe: [['Кофейня с едой', 'Cafe with food'], ['Завтраки и бранчи', 'Breakfast and brunch'], ['Семейное кафе', 'Family cafe'], ['Кафе при бизнес-центре', 'Office-block cafe']],
  restaurant: [['Ресторан с банкетами', 'Restaurant with banquets'], ['Авторская кухня', 'Chef cuisine'], ['Национальная кухня', 'National cuisine'], ['Бар и лаунж', 'Bar and lounge'], ['Сеть ресторанов', 'Restaurant chain']],
  coffee: [['Кофе с собой', 'Takeaway coffee'], ['Спешелти-кофейня', 'Specialty coffee shop'], ['Кофейня с зерном на продажу', 'Coffee shop selling beans'], ['Кофе-точка в ТЦ', 'Mall coffee kiosk']],
  bakery: [['Пекарня с доставкой', 'Bakery with delivery'], ['Торты на заказ', 'Custom cakes'], ['Кондитерская', 'Pastry shop'], ['Хлеб и выпечка оптом', 'Wholesale bread and pastry']],
  delivery: [['Доставка еды из кухни', 'Cloud kitchen delivery'], ['Доставка суши и пиццы', 'Sushi and pizza delivery'], ['Доставка продуктов', 'Grocery delivery'], ['Курьерская служба', 'Courier service']],
  catering: [['Банкеты и свадьбы', 'Banquets and weddings'], ['Корпоративное питание', 'Corporate meals'], ['Фуршеты и кофе-брейки', 'Buffets and coffee breaks'], ['Детские праздники', 'Kids parties']],
  barber: [['Барбершоп сети', 'Barbershop chain'], ['Мужской зал в салоне', "Men's room in a salon"], ['Мастер-одиночка', 'Solo barber'], ['Детские стрижки', 'Kids haircuts']],
  salon: [['Салон полного цикла', 'Full-service salon'], ['Студия окрашивания', 'Colour studio'], ['Мастера в аренду кресла', 'Chair-rental stylists'], ['Свадебные причёски', 'Bridal styling'], ['Салон на дому', 'Home salon']],
  nails: [['Маникюрная студия', 'Nail studio'], ['Мастер на дому', 'Home nail tech'], ['Экспресс-маникюр в ТЦ', 'Mall express manicure'], ['Обучение мастеров', 'Nail tech training']],
  spa: [['Спа-центр', 'Spa centre'], ['Спа при отеле', 'Hotel spa'], ['Бани и сауны', 'Baths and saunas'], ['Подарочные сертификаты спа', 'Spa gift certificates']],
  cosmetology: [['Косметолог-эстетист', 'Aesthetician'], ['Инъекционная косметология', 'Injection cosmetology'], ['Аппаратные процедуры', 'Device treatments'], ['Эпиляция', 'Hair removal']],
  dentist: [['Семейная стоматология', 'Family dentistry'], ['Имплантация', 'Implants'], ['Ортодонтия', 'Orthodontics'], ['Детская стоматология', 'Pediatric dentistry'], ['Эстетика улыбки', 'Smile aesthetics']],
  clinic: [['Многопрофильная клиника', 'Multi-specialty clinic'], ['Частный кабинет врача', 'Private doctor office'], ['Диагностический центр', 'Diagnostic centre'], ['Женское здоровье', "Women's health"], ['Детская клиника', "Children's clinic"]],
  fitness: [['Фитнес-клуб', 'Fitness club'], ['Персональные тренировки', 'Personal training'], ['Групповые программы', 'Group programmes'], ['Кроссфит и функционал', 'CrossFit and functional'], ['Бассейн', 'Swimming pool']],
  yoga: [['Йога-студия', 'Yoga studio'], ['Пилатес и растяжка', 'Pilates and stretching'], ['Ретриты и интенсивы', 'Retreats and intensives'], ['Онлайн-занятия', 'Online classes']],
  massage: [['Массажный кабинет', 'Massage room'], ['Спортивный и лечебный массаж', 'Sports and medical massage'], ['Выездной массаж', 'Mobile massage'], ['Массаж для детей', 'Kids massage']],
  shop: [['Магазин у дома', 'Neighbourhood shop'], ['Магазин в ТЦ', 'Mall shop'], ['Бутик', 'Boutique'], ['Магазин с розницей и оптом', 'Retail and wholesale shop']],
  webshop: [['Интернет-магазин на своём сайте', 'Own-site webshop'], ['Магазин в Telegram', 'Telegram shop'], ['Товары с маркетплейсов', 'Marketplace sellers'], ['Дропшиппинг', 'Dropshipping'], ['Подписка на товары', 'Product subscriptions']],
  flowers: [['Цветочный салон', 'Flower shop'], ['Букеты с доставкой', 'Bouquets with delivery'], ['Свадебная флористика', 'Wedding floristry'], ['Оформление залов', 'Venue decoration']],
  gifts: [['Подарочные наборы', 'Gift sets'], ['Подарки с гравировкой', 'Engraved gifts'], ['Корпоративные подарки', 'Corporate gifts'], ['Сувениры для туристов', 'Tourist souvenirs']],
  clothing: [['Одежда и обувь', 'Clothes and shoes'], ['Детская одежда', 'Kids clothes'], ['Национальная одежда', 'National wear'], ['Пошив на заказ', 'Made to order']],
  electronics: [['Смартфоны и гаджеты', 'Phones and gadgets'], ['Бытовая техника', 'Home appliances'], ['Компьютеры и комплектующие', 'Computers and parts'], ['Ремонт и сервис техники', 'Repair and service']],
  furniture: [['Мебель в наличии', 'Ready furniture'], ['Мебель на заказ', 'Custom furniture'], ['Кухни и шкафы', 'Kitchens and wardrobes'], ['Матрасы и текстиль', 'Mattresses and textiles']],
  autoparts: [['Запчасти в магазине', 'Parts shop'], ['Запчасти под заказ', 'Parts on order'], ['Шины и диски', 'Tyres and wheels'], ['Масла и автохимия', 'Oils and car chemicals']],
  carservice: [['Автосервис полного цикла', 'Full car service'], ['Шиномонтаж', 'Tyre fitting'], ['Кузовной ремонт', 'Body repair'], ['Диагностика и электрика', 'Diagnostics and electrics'], ['Детейлинг', 'Detailing']],
  carwash: [['Автомойка самообслуживания', 'Self-service car wash'], ['Мойка с ручной работой', 'Hand car wash'], ['Химчистка салона', 'Interior cleaning'], ['Выездная мойка', 'Mobile car wash']],
  drycleaning: [['Химчистка одежды', 'Garment dry cleaning'], ['Чистка ковров и мебели', 'Carpet and furniture cleaning'], ['Стирка и глажка', 'Laundry and ironing'], ['Приём через пункты', 'Drop-off points']],
  cleaning: [['Уборка квартир', 'Home cleaning'], ['Уборка офисов', 'Office cleaning'], ['После ремонта', 'Post-renovation cleaning'], ['Клининг для бизнеса по контракту', 'Contract business cleaning']],
  repair: [['Ремонт бытовой техники', 'Appliance repair'], ['Сантехника и электрика', 'Plumbing and electrics'], ['Муж на час', 'Handyman'], ['Ремонт телефонов', 'Phone repair']],
  renovation: [['Ремонт квартир под ключ', 'Turnkey flat renovation'], ['Отделочные работы', 'Finishing works'], ['Дизайн интерьера', 'Interior design'], ['Строительство домов', 'House building'], ['Ремонт офисов', 'Office renovation']],
  photo: [['Свадебная съёмка', 'Wedding shoots'], ['Предметная и каталожная съёмка', 'Product shoots'], ['Семейная и детская съёмка', 'Family and kids shoots'], ['Видеосъёмка', 'Video production'], ['Фотостудия в аренду', 'Studio rental']],
  events: [['Свадьбы', 'Weddings'], ['Корпоративы', 'Corporate events'], ['Детские праздники', 'Kids parties'], ['Организация конференций', 'Conference organising'], ['Аренда декора и техники', 'Decor and equipment rental']],
  printing: [['Визитки и полиграфия', 'Cards and print'], ['Печать на одежде', 'Apparel printing'], ['Наружная реклама', 'Outdoor advertising'], ['Сувенирная продукция', 'Branded souvenirs']],
  tutor: [['Репетитор по школьным предметам', 'School subjects tutor'], ['Подготовка к экзаменам', 'Exam preparation'], ['Репетитор для детей', 'Tutor for kids'], ['Онлайн-репетитор', 'Online tutor']],
  languages: [['Языковая школа', 'Language school'], ['Подготовка к IELTS и TOEFL', 'IELTS and TOEFL prep'], ['Разговорные клубы', 'Speaking clubs'], ['Языки для детей', 'Languages for kids'], ['Корпоративное обучение', 'Corporate training']],
  kidscenter: [['Детский сад и ясли', 'Kindergarten and nursery'], ['Развивающие занятия', 'Early development classes'], ['Кружки и секции', 'Clubs and sections'], ['Летний лагерь', 'Summer camp']],
  drivingschool: [['Автошкола с теорией', 'Driving school with theory'], ['Индивидуальные занятия вождения', 'Private driving lessons'], ['Категории B и C', 'Categories B and C'], ['Мотошкола', 'Motorcycle school']],
  onlineschool: [['Курсы с кураторами', 'Courses with mentors'], ['Записанные уроки', 'Recorded lessons'], ['Вебинары и марафоны', 'Webinars and marathons'], ['Корпоративное обучение', 'Corporate learning'], ['Сообщество и клуб', 'Community and club']],
  realty: [['Агентство недвижимости', 'Real estate agency'], ['Риелтор-одиночка', 'Solo realtor'], ['Новостройки застройщика', 'Developer new builds'], ['Аренда квартир', 'Flat rentals'], ['Коммерческая недвижимость', 'Commercial property']],
  lawyers: [['Юридическая фирма', 'Law firm'], ['Частный юрист', 'Private lawyer'], ['Регистрация бизнеса', 'Business registration'], ['Семейные и наследственные дела', 'Family and estate cases'], ['Миграционные услуги', 'Migration services']],
  accounting: [['Бухгалтерское сопровождение', 'Bookkeeping service'], ['Налоговая отчётность', 'Tax reporting'], ['Аудит', 'Audit'], ['Бухгалтерия для ИП', 'Bookkeeping for sole traders']],
  insurance: [['Страховой агент', 'Insurance agent'], ['Страхование авто', 'Car insurance'], ['Страхование жизни и здоровья', 'Life and health insurance'], ['Страхование бизнеса', 'Business insurance']],
  travel: [['Турагентство', 'Travel agency'], ['Индивидуальные туры', 'Tailor-made tours'], ['Визы и документы', 'Visas and documents'], ['Корпоративные поездки', 'Corporate trips']],
  hotel: [['Городской отель', 'City hotel'], ['Курортный отель', 'Resort hotel'], ['Хостел', 'Hostel'], ['Апарт-отель', 'Aparthotel'], ['Отель с конференц-залом', 'Hotel with a conference room']],
  guesthouse: [['Гостевой дом', 'Guesthouse'], ['Семейный дом у гор', 'Family house in the mountains'], ['Посуточная аренда', 'Daily rentals'], ['Эко-кемпинг', 'Eco camping']],
  tours: [['Экскурсии по городу', 'City tours'], ['Горные туры и треккинг', 'Mountain tours and trekking'], ['Групповые туры', 'Group tours'], ['Трансферы и гиды', 'Transfers and guides']],
  services: [['Консалтинг', 'Consulting'], ['Аутсорс-услуги для бизнеса', 'Business outsourcing'], ['Агентство под ключ', 'Turnkey agency'], ['Сервис по подписке', 'Subscription service']],
  logistics: [['Грузоперевозки по стране', 'Domestic freight'], ['Международная логистика', 'International logistics'], ['Склад и фулфилмент', 'Warehouse and fulfilment'], ['Курьерская доставка', 'Courier delivery'], ['Таможенное оформление', 'Customs clearance']],
  wholesale: [['Оптовая торговля продуктами', 'Wholesale food'], ['Оптовая торговля товарами', 'Wholesale goods'], ['Дистрибуция', 'Distribution'], ['B2B-каталог с заказами', 'B2B catalogue with orders']],
  itservices: [['Разработка на заказ', 'Custom development'], ['Поддержка и администрирование', 'Support and administration'], ['Продуктовая студия', 'Product studio'], ['Внедрение CRM и ИИ', 'CRM and AI rollout']],
  marketing: [['Digital-агентство', 'Digital agency'], ['Таргет и реклама', 'Targeting and ads'], ['SEO-студия', 'SEO studio'], ['SMM и контент', 'SMM and content'], ['Фрилансер-маркетолог', 'Freelance marketer']],
  coworking: [['Коворкинг с гибкими местами', 'Flexible-desk coworking'], ['Офисы в аренду', 'Office rental'], ['Переговорные и события', 'Meeting rooms and events'], ['Студия подкастов', 'Podcast studio']],
  pharmacy: [['Аптека у дома', 'Neighbourhood pharmacy'], ['Сеть аптек', 'Pharmacy chain'], ['Аптека с доставкой', 'Pharmacy with delivery'], ['Оптика и товары для здоровья', 'Optics and health goods']],
  vet: [['Ветклиника', 'Vet clinic'], ['Выезд ветеринара', 'Vet home visits'], ['Груминг', 'Grooming'], ['Передержка животных', 'Pet boarding']],
  petshop: [['Зоомагазин', 'Pet shop'], ['Корма и аксессуары онлайн', 'Pet food and accessories online'], ['Питомник', 'Kennel or cattery'], ['Аквариумистика', 'Aquariums']],
  other: [['Малый бизнес', 'Small business'], ['Личный бренд', 'Personal brand'], ['Некоммерческая организация', 'Non-profit'], ['Новый проект с нуля', 'A new project from scratch']],
}

export type SubNiche = { id: string; kind: KindId; name: L<string> }
export const subNiches: Record<KindId, SubNiche[]> = Object.fromEntries(
  (Object.keys(subRows) as KindId[]).map((kind) => [
    kind,
    subRows[kind].map(([ru, en], i) => ({ id: `${kind}${i + 1}`, kind, name: l(ru, en) })),
  ]),
) as Record<KindId, SubNiche[]>
export const allSubNicheIds: readonly string[] = Object.values(subNiches).flatMap((list) => list.map((s) => s.id))

// ------------------------------------------------------------- results (goals)

// Outcome goals with a one-line result. They sit next to the product-family goals of `builder-v2.ts`
// (those stay as they are, old links keep them); ids `rs01...`, travel as `rs` in the catalogue chunk.
export const resultGroups: Group[] = groups([
  ['sales', 'Заявки и продажи', 'Leads and sales'],
  ['service', 'Сервис и клиенты', 'Service and customers'],
  ['ops', 'Порядок в делах', 'Order in the work'],
  ['money', 'Деньги и учёт', 'Money and accounting'],
  ['growth', 'Рост и бренд', 'Growth and brand'],
  ['team', 'Команда', 'Team'],
])

export const results: Item[] = [
  ...table('sales', [
    ['rs01', 'Больше заявок с сайта и из мессенджеров', 'Каждый запрос получает ответ и попадает в список', 'More leads from site and messengers', 'Every request gets an answer and lands in a list'],
    ['rs02', 'Ответ за минуту, а не за час', 'Клиент не уходит к тем, кто ответил быстрее', 'Answer in a minute, not an hour', 'The customer does not leave for a faster rival'],
    ['rs03', 'Ни одной потерянной заявки', 'Всё, что пришло, видно и закреплено за человеком', 'Not a single lost lead', 'Everything that arrived is visible and has an owner'],
    ['rs04', 'Горячие клиенты отделены от случайных', 'Агент задаёт вопросы и ставит оценку заявке', 'Hot leads apart from casual ones', 'The agent asks questions and scores the lead'],
    ['rs05', 'Вернуть тех, кто пропал после первого разговора', 'Мягкие напоминания в нужный день', 'Win back those who went silent', 'Gentle follow-ups on the right day'],
    ['rs06', 'Рост среднего чека', 'К заказу предлагают подходящее дополнение', 'A higher average bill', 'A fitting add-on is offered with the order'],
    ['rs07', 'Продажи без звонков', 'Выбор, оплата и подтверждение в одном чате', 'Sales without calls', 'Choice, payment and confirmation in one chat'],
    ['rs08', 'Повторные покупки по расписанию', 'Клиенты возвращаются, когда пора', 'Repeat purchases on schedule', 'Customers come back when it is time'],
    ['rs09', 'Предзаказы и список ожидания', 'Спрос виден раньше, чем товар пришёл', 'Pre-orders and a waiting list', 'Demand is visible before the goods arrive'],
    ['rs10', 'Больше клиентов из карт и поиска', 'Карточка, отзывы и сайт работают вместе', 'More customers from maps and search', 'The card, reviews and site work together'],
  ]),
  ...table('service', [
    ['rs11', 'Реже срываются визиты', 'Напоминания и перенос в один тап', 'Fewer missed visits', 'Reminders and a one-tap reschedule'],
    ['rs12', 'Заполненный график без дыр', 'Освободившиеся окна предлагают ожидающим', 'A full schedule without gaps', 'Freed slots go to those waiting'],
    ['rs13', 'Ответы на частые вопросы без вас', 'Цены, адрес, часы и условия знает агент', 'Common questions answered without you', 'Prices, address, hours and terms are known to the agent'],
    ['rs14', 'Клиент всегда знает статус заказа', 'Сообщение на каждом шаге, без звонков «где мой заказ»', 'Customers always know the order status', 'A message at every step, no «where is my order» calls'],
    ['rs15', 'Меньше жалоб и быстрее решение', 'Жалоба сразу попадает к ответственному', 'Fewer complaints, faster fixes', 'A complaint goes straight to the right person'],
    ['rs16', 'Больше хороших отзывов', 'Просьба об отзыве в нужный момент', 'More good reviews', 'A request for a review at the right moment'],
    ['rs17', 'Клиентская база с историей', 'Кто, когда и что покупал, видно в одном месте', 'A customer base with history', 'Who bought what and when, in one place'],
    ['rs18', 'Программа лояльности без карточек', 'Баллы, скидки и подарки в чате', 'Loyalty without cards', 'Points, discounts and gifts in the chat'],
    ['rs19', 'Поддержка на двух языках и больше', 'Агент отвечает на языке клиента', 'Support in two languages and more', 'The agent answers in the customer language'],
    ['rs20', 'Передача сложного вопроса человеку без потерь', 'Контекст разговора уходит вместе с клиентом', 'Hard questions passed to a person without loss', 'The context goes along with the customer'],
  ]),
  ...table('ops', [
    ['rs21', 'Меньше ручной рутины', 'Заявки, письма и таблицы заполняются сами', 'Less manual routine', 'Requests, mail and sheets fill themselves'],
    ['rs22', 'Всё в одном месте вместо десяти', 'Заказы, клиенты и задачи в одной системе', 'Everything in one place instead of ten', 'Orders, customers and tasks in one system'],
    ['rs23', 'Автоматические отчёты по расписанию', 'Сводка за день и неделю приходит сама', 'Automatic scheduled reports', 'A daily and weekly summary arrives on its own'],
    ['rs24', 'Предупреждения о проблемах до жалоб', 'Сбой, просрочка и пропуск видны сразу', 'Warnings before complaints', 'A failure, delay or gap shows up at once'],
    ['rs25', 'Склад без сюрпризов', 'Остатки обновляются, заканчивающееся видно заранее', 'A warehouse without surprises', 'Stock updates and shortages are seen early'],
    ['rs26', 'Документы готовы за минуты', 'Счета, акты и договоры собираются по шаблону', 'Documents ready in minutes', 'Invoices, acts and contracts built from a template'],
    ['rs27', 'Понятные согласования', 'Решает человек, остальное делает агент', 'Clear approvals', 'A person decides, the agent does the rest'],
    ['rs28', 'Связка с вашими сервисами без переписывания', 'Данные ходят между CRM, таблицами и почтой', 'Your services connected without rewriting', 'Data flows between CRM, sheets and mail'],
  ]),
  ...table('money', [
    ['rs29', 'Оплата сразу в чате или на сайте', 'Ссылка на оплату и подтверждение без вашей работы', 'Payment right in chat or on the site', 'A pay link and confirmation without your work'],
    ['rs30', 'Счета и напоминания о долгах', 'Должники получают вежливые напоминания', 'Invoices and debt reminders', 'Debtors get polite reminders'],
    ['rs31', 'Понятная картина по деньгам', 'Выручка, расходы и остатки на одном экране', 'A clear picture of money', 'Revenue, costs and balances on one screen'],
    ['rs32', 'Меньше расходов на ручной труд', 'Часы сотрудников уходят на более важное', 'Lower cost of manual work', 'Staff hours go to more important things'],
    ['rs33', 'Предоплата и депозиты', 'Бронь держится, пока клиент не оплатил', 'Prepayments and deposits', 'A booking holds until the customer pays'],
    ['rs34', 'Возвраты и споры без нервов', 'Правила и шаги описаны, агент ведёт клиента', 'Refunds and disputes without stress', 'The rules and steps are set, the agent guides the customer'],
  ]),
  ...table('growth', [
    ['rs35', 'Регулярные посты без вашего времени', 'Темы, тексты и картинки по плану', 'Regular posts without your time', 'Topics, texts and images on a plan'],
    ['rs36', 'Короткие видео для соцсетей', 'Рилс и сторис из ваших материалов', 'Short videos for social media', 'Reels and stories from your material'],
    ['rs37', 'Узнаваемый стиль везде', 'Один тон и вид на сайте, в чате и в соцсетях', 'A recognisable style everywhere', 'One tone and look on site, chat and socials'],
    ['rs38', 'Понятно, откуда идут клиенты', 'Каналы и реклама сравниваются по заявкам', 'Clear where customers come from', 'Channels and ads compared by requests'],
    ['rs39', 'Сайт, который объясняет и продаёт', 'Страницы отвечают на вопросы клиента по шагам', 'A site that explains and sells', 'Pages answer the customer questions step by step'],
    ['rs40', 'Выход на новый язык или рынок', 'Тексты и ответы на нужных языках', 'Entering a new language or market', 'Texts and answers in the languages you need'],
  ]),
  ...table('team', [
    ['rs41', 'Новички входят в дело быстрее', 'Инструкции и подсказки под рукой в чате', 'Newcomers get up to speed faster', 'Guides and hints at hand in the chat'],
    ['rs42', 'Смены и задачи без путаницы', 'Кто и когда работает, видно всем', 'Shifts and tasks without confusion', 'Everyone sees who works and when'],
    ['rs43', 'Знания компании в одном месте', 'Ответ на вопрос сотрудника находится за секунды', 'Company knowledge in one place', 'An employee question is answered in seconds'],
    ['rs44', 'Контроль без микроменеджмента', 'Вы видите итоги, а не следите за каждым шагом', 'Control without micromanagement', 'You see outcomes instead of watching every step'],
  ]),
]

// ------------------------------------------------------- agent capabilities

// Provider letters: a adminbot (ИИ-администратор), i intake (ИИ-менеджер заявок), m automation, c content,
// p miniapp, t aiteam, s site, b bot (Agents in Telegram), x app, P personal, C company; teams: S sales,
// M marketing, U support, R production, B backoffice.
const providerOf: Record<string, Provider> = {
  a: 'adminbot', i: 'intake', m: 'automation', c: 'content', p: 'miniapp', t: 'aiteam', s: 'site', b: 'bot', x: 'app', P: 'personal', C: 'company',
  S: 'sales', M: 'marketing', U: 'support', R: 'production', B: 'backoffice',
}
type CapRow = readonly [...Row, string]
const capTable = (group: string, rows: readonly CapRow[]): Capability[] =>
  rows.map(([id, ru, ruHint, en, enHint, by]) => ({
    id,
    group,
    name: l(ru, en),
    hint: l(ruHint, enHint),
    by: [...by].map((ch) => providerOf[ch]!),
  }))

export const capabilityGroups: Group[] = groups([
  ['intake', 'Приём заявок', 'Request intake'],
  ['booking', 'Запись и календарь', 'Booking and calendar'],
  ['pay', 'Оплата и счета', 'Payment and invoices'],
  ['remind', 'Напоминания', 'Reminders'],
  ['reviews', 'Отзывы и репутация', 'Reviews and reputation'],
  ['reports', 'Отчёты', 'Reports'],
  ['stock', 'Склад и каталог', 'Stock and catalogue'],
  ['delivery', 'Доставка', 'Delivery'],
  ['staff', 'Персонал и смены', 'Staff and shifts'],
  ['docs', 'Документы', 'Documents'],
  ['calls', 'Звонки', 'Calls'],
  ['social', 'Соцсети и контент', 'Socials and content'],
  ['analytics', 'Аналитика', 'Analytics'],
  ['security', 'Безопасность', 'Security'],
])

export const capabilities: Capability[] = [
  ...capTable('intake', [
    ['in01', 'Ответ на первое сообщение за секунды', 'Клиент сразу получает ответ, а не тишину', 'First reply in seconds', 'The customer gets an answer at once, not silence', 'aibtC'],
    ['in02', 'Сбор имени, телефона и запроса', 'Контакты и суть обращения без анкеты на десять полей', 'Name, phone and request captured', 'Contacts and the point of the request, no ten-field form', 'aibsS'],
    ['in03', 'Уточняющие вопросы под вашу услугу', 'Агент спрашивает то, что нужно вам для расчёта', 'Clarifying questions for your service', 'The agent asks what you need to quote', 'aitS'],
    ['in04', 'Оценка заявки: горячая, тёплая, холодная', 'Вы видите, кому звонить первым', 'Lead score: hot, warm, cold', 'You see who to call first', 'itS'],
    ['in05', 'Назначение ответственного', 'Заявка сама находит нужного менеджера', 'Owner assignment', 'The request finds the right manager on its own', 'imtS'],
    ['in06', 'Передача человеку с контекстом', 'Сотрудник видит весь разговор, клиент не повторяется', 'Hand-off to a person with context', 'The employee sees the whole chat, the customer does not repeat', 'aibtU'],
    ['in07', 'Форма заявки на сайте', 'Короткая форма, которая попадает в ваш список', 'A request form on the site', 'A short form that lands in your list', 'sS'],
    ['in08', 'Приём заявок из нескольких каналов в один список', 'Telegram, WhatsApp, сайт и почта в одном месте', 'Requests from many channels in one list', 'Telegram, WhatsApp, site and mail in one place', 'imtC'],
    ['in09', 'Фильтр спама и повторов', 'Лишнее не доходит до вашей команды', 'Spam and duplicate filter', 'Noise never reaches your team', 'imB'],
  ]),
  ...capTable('booking', [
    ['bk01', 'Запись на услугу в чате', 'Клиент выбирает услугу, мастера и время сам', 'Booking a service in the chat', 'The customer picks service, specialist and time alone', 'apb'],
    ['bk02', 'Свободные окна в реальном времени', 'Агент показывает только то, что действительно свободно', 'Live free slots', 'The agent shows only what is really free', 'apbm'],
    ['bk03', 'Перенос и отмена записи в один тап', 'Меньше звонков администратору', 'Reschedule and cancel in one tap', 'Fewer calls to the front desk', 'apb'],
    ['bk04', 'Синхронизация с вашим календарём', 'Google, Outlook или Apple: запись видна везде', 'Sync with your calendar', 'Google, Outlook or Apple: the booking is visible everywhere', 'amt'],
    ['bk05', 'Список ожидания', 'Освободившееся окно уходит тем, кто ждал', 'Waiting list', 'A freed slot goes to those who waited', 'apbS'],
    ['bk06', 'Запись группы и мероприятия', 'Места, лимиты и подтверждение участников', 'Group and event booking', 'Seats, limits and attendee confirmation', 'pbm'],
    ['bk07', 'Бронь столов и ресурсов', 'Столик, переговорная, зал или оборудование', 'Tables and resources booking', 'A table, meeting room, hall or equipment', 'apbs'],
    ['bk08', 'Повторная запись по расписанию', 'Постоянные клиенты записываются на цикл заранее', 'Recurring bookings', 'Regulars book a cycle in advance', 'apb'],
    ['bk09', 'Заявка на звонок в удобное время', 'Клиент выбирает окно, менеджер звонит вовремя', 'Callback at a chosen time', 'The customer picks a window, the manager calls on time', 'isS'],
  ]),
  ...capTable('pay', [
    ['py01', 'Ссылка на оплату в чате', 'Клиент платит, не выходя из разговора', 'A payment link in the chat', 'The customer pays without leaving the conversation', 'apbs'],
    ['py02', 'Предоплата и депозит', 'Бронь подтверждается после оплаты', 'Prepayment and deposit', 'A booking is confirmed after payment', 'apb'],
    ['py03', 'Счета и акты клиентам', 'Документы создаются по шаблону и уходят сами', 'Invoices and acts for customers', 'Documents are made from a template and sent on their own', 'mtB'],
    ['py04', 'Напоминание о неоплаченном счёте', 'Вежливо, по расписанию, без вашего звонка', 'Unpaid invoice reminder', 'Polite, on schedule, no call from you', 'mtB'],
    ['py05', 'Сверка оплат с заказами', 'Видно, какой заказ оплачен, а какой нет', 'Payments matched to orders', 'You see which order is paid and which is not', 'mxB'],
    ['py06', 'Возвраты по вашим правилам', 'Агент ведёт клиента по шагам, решение за вами', 'Refunds by your rules', 'The agent guides the customer, the decision is yours', 'iUB'],
    ['py07', 'Рассрочка и частичная оплата', 'Этапы оплаты для крупных заказов', 'Instalments and partial payment', 'Payment stages for bigger orders', 'mB'],
    ['py08', 'Местные способы оплаты', 'Карты и кошельки, привычные вашим клиентам', 'Local payment methods', 'Cards and wallets your customers already use', 'psm'],
    ['py09', 'Чеки и подтверждения клиенту', 'Квитанция приходит в тот же чат', 'Receipts and confirmations', 'The receipt arrives in the same chat', 'apbm'],
  ]),
  ...capTable('remind', [
    ['rm01', 'Напоминание о записи за день', 'Клиент подтверждает или переносит', 'Reminder a day before', 'The customer confirms or moves it', 'apb'],
    ['rm02', 'Напоминание за два часа', 'Последний толчок, чтобы не забыли', 'Reminder two hours before', 'A last nudge so no one forgets', 'apb'],
    ['rm03', 'Напоминание о повторном визите', 'Через нужный срок: пора на стрижку, осмотр, чистку', 'Return visit reminder', 'After the right interval: time for a haircut, check-up, cleaning', 'apbm'],
    ['rm04', 'Поздравления и поводы', 'День рождения, годовщина, акция для своих', 'Greetings and occasions', 'Birthday, anniversary, an offer for regulars', 'apc'],
    ['rm05', 'Напоминания сотрудникам', 'Задачи, сроки и собрания в вашем чате', 'Staff reminders', 'Tasks, deadlines and meetings in your chat', 'mtB'],
    ['rm06', 'Напоминание о брошенной корзине', 'Клиент возвращается к заказу', 'Abandoned cart reminder', 'The customer comes back to the order', 'psm'],
    ['rm07', 'Напоминание о сроках документов и оплат', 'Ничего не пропускается', 'Document and payment deadline reminders', 'Nothing is missed', 'mB'],
    ['rm08', 'Рассылка по списку клиентов', 'Акции и новости тем, кто согласился', 'Mailing to a customer list', 'Offers and news to those who agreed', 'apcM'],
    ['rm09', 'Тихие часы и частота', 'Клиентам не пишут ночью и не спамят', 'Quiet hours and frequency', 'No messages at night and no spam', 'aimb'],
  ]),
  ...capTable('reviews', [
    ['rv01', 'Просьба об отзыве после визита', 'В нужный момент и одним тапом', 'A review request after the visit', 'At the right moment and in one tap', 'apb'],
    ['rv02', 'Ссылки на карты и площадки', 'Яндекс, 2ГИС, Google Maps, где вас ищут', 'Links to maps and platforms', 'Yandex, 2GIS, Google Maps, where people look for you', 'apM'],
    ['rv03', 'Фильтр: недовольных к вам, довольных на площадку', 'Плохая оценка сначала попадает к вам, не в публичный отзыв', 'Filter: unhappy to you, happy to the platform', 'A bad score reaches you first, not a public review', 'apU'],
    ['rv04', 'Черновики ответов на отзывы', 'Вежливый ответ готов, вы нажимаете «отправить»', 'Draft replies to reviews', 'A polite answer is ready, you press send', 'cMU'],
    ['rv05', 'Сбор отзывов для сайта', 'Живые слова клиентов с разрешения', 'Collecting reviews for the site', "Customers' own words, with permission", 'sc'],
    ['rv06', 'Мониторинг упоминаний', 'Видно, где о вас пишут', 'Mention monitoring', 'You see where people write about you', 'MR'],
    ['rv07', 'Опросы удовлетворённости', 'Короткие вопросы после услуги', 'Satisfaction surveys', 'Short questions after a service', 'apbU'],
    ['rv08', 'Работа с жалобами', 'Жалоба сразу у ответственного с историей', 'Complaint handling', 'A complaint goes to the owner with its history', 'iUB'],
    ['rv09', 'Рейтинг по сотрудникам', 'Видно, кого клиенты хвалят', 'Rating per employee', 'You see who customers praise', 'mB'],
  ]),
  ...capTable('reports', [
    ['rp01', 'Утренняя сводка владельцу', 'Вчера, сегодня и что требует внимания', "Owner's morning brief", 'Yesterday, today and what needs attention', 'mtCB'],
    ['rp02', 'Недельный отчёт по заявкам', 'Сколько пришло, сколько закрыто, где просело', 'Weekly requests report', 'How many came, how many closed, where it dipped', 'imtS'],
    ['rp03', 'Отчёт по записям и загрузке', 'Видно пустые часы и перегруженные дни', 'Bookings and load report', 'Empty hours and overloaded days are visible', 'amt'],
    ['rp04', 'Отчёт по выручке', 'Деньги по дням, услугам и сотрудникам', 'Revenue report', 'Money by day, service and employee', 'mxB'],
    ['rp05', 'Отчёт по рекламе и каналам', 'Откуда пришли клиенты и сколько это стоило', 'Ads and channels report', 'Where customers came from and what it cost', 'mM'],
    ['rp06', 'Сводка по задачам команды', 'Что сделано, что висит, что горит', 'Team task summary', 'What is done, pending and burning', 'mtC'],
    ['rp07', 'Отчёт в таблицу', 'Данные уходят в Google Sheets сами', 'Report to a spreadsheet', 'Data flows into Google Sheets by itself', 'mB'],
    ['rp08', 'Вопрос по данным обычным языком', '«Сколько заказов было в прошлую пятницу?» и ответ', 'A question about data in plain words', '«How many orders last Friday?» and an answer', 'mtP'],
    ['rp09', 'Отчёт для инвестора или партнёра', 'Показатели в одном документе', 'Report for an investor or partner', 'Key figures in one document', 'tCB'],
  ]),
  ...capTable('stock', [
    ['st01', 'Каталог товаров и услуг в чате', 'Клиент листает, выбирает и спрашивает', 'Catalogue in the chat', 'The customer browses, picks and asks', 'psb'],
    ['st02', 'Остатки и наличие', 'Агент не обещает того, чего нет', 'Stock and availability', 'The agent never promises what is not there', 'pmx'],
    ['st03', 'Загрузка каталога из таблицы', 'Вы ведёте Excel, мы показываем клиентам', 'Catalogue from a spreadsheet', 'You keep the Excel, we show it to customers', 'pmB'],
    ['st04', 'Предупреждение о минимальном остатке', 'Закупка не застаёт врасплох', 'Low-stock warning', 'Purchasing is never caught off guard', 'mB'],
    ['st05', 'Подбор товара по запросу', 'Клиент описывает, агент находит подходящее', 'Matching a product to a request', 'The customer describes, the agent finds a fit', 'pib'],
    ['st06', 'Сопутствующие товары', 'К заказу предлагают то, что берут вместе', 'Related products', 'What is usually bought together is offered', 'pS'],
    ['st07', 'Предзаказ и ожидание поставки', 'Спрос собирается заранее', 'Pre-order and waiting for stock', 'Demand is collected ahead of time', 'pm'],
    ['st08', 'Карточки товаров с фото и описанием', 'Тексты и подборки готовит агент', 'Product cards with photos and text', 'The agent prepares texts and selections', 'cs'],
    ['st09', 'Учёт материалов и запчастей', 'Что и сколько ушло на заказ', 'Materials and parts tracking', 'What and how much went into an order', 'mxR'],
  ]),
  ...capTable('delivery', [
    ['dl01', 'Оформление доставки в чате', 'Адрес, время и способ без звонка', 'Delivery set up in the chat', 'Address, time and method without a call', 'pb'],
    ['dl02', 'Расчёт стоимости и зон', 'Клиент сразу видит, сколько и когда', 'Cost and zone calculation', 'The customer sees at once how much and when', 'pm'],
    ['dl03', 'Статус заказа клиенту', 'Принят, собран, в пути, доставлен', 'Order status to the customer', 'Accepted, packed, on the way, delivered', 'apm'],
    ['dl04', 'Уведомление курьеру', 'Заказ с адресом и телефоном уходит сразу', 'Courier notification', 'The order with address and phone goes out at once', 'mR'],
    ['dl05', 'Самовывоз и точки выдачи', 'Выбор пункта и времени', 'Pickup and pickup points', 'Choose a point and a time', 'pb'],
    ['dl06', 'Отслеживание посылки', 'Трек-номер и статус в одном чате', 'Parcel tracking', 'Tracking number and status in one chat', 'mp'],
    ['dl07', 'Окна доставки и загрузка курьеров', 'Заказы не копятся в один час', 'Delivery windows and courier load', 'Orders do not pile into one hour', 'mR'],
    ['dl08', 'Проблемы с доставкой', 'Опоздание и недовоз сразу видны и объяснены клиенту', 'Delivery problems', 'A delay or shortfall is seen at once and explained', 'mU'],
    ['dl09', 'Межгород и международная доставка', 'Тарифы и сроки перевозчиков', 'Intercity and international shipping', 'Carrier rates and terms', 'mx'],
  ]),
  ...capTable('staff', [
    ['sf01', 'График смен', 'Кто и когда работает, видно всем', 'Shift schedule', 'Everyone sees who works and when', 'mxB'],
    ['sf02', 'Замена и обмен сменами', 'Сотрудники договариваются в чате, вы одобряете', 'Shift swaps', 'Staff agree in the chat, you approve', 'mB'],
    ['sf03', 'Задачи сотрудникам', 'Поставить, напомнить, закрыть', 'Tasks for staff', 'Assign, remind, close', 'mtB'],
    ['sf04', 'Онбординг новичка', 'Инструкции и проверка по шагам', 'New hire onboarding', 'Guides and checks step by step', 'tCB'],
    ['sf05', 'База знаний для команды', 'Ответ на рабочий вопрос находится за секунды', 'Team knowledge base', 'An answer to a work question is found in seconds', 'tCB'],
    ['sf06', 'Учёт часов и выходов', 'Табель без бумаги', 'Hours and attendance', 'A timesheet without paper', 'mxB'],
    ['sf07', 'Заявки на отпуск и больничный', 'Запрос, одобрение и запись в график', 'Leave requests', 'Request, approval and a schedule entry', 'mB'],
    ['sf08', 'Обучение и проверка знаний', 'Короткие тесты по стандартам сервиса', 'Training and quizzes', 'Short quizzes on service standards', 'tC'],
    ['sf09', 'Мотивация и бонусы по данным', 'Расчёт по понятным правилам', 'Incentives by data', 'Calculated by clear rules', 'mB'],
  ]),
  ...capTable('docs', [
    ['dc01', 'Договор по шаблону', 'Данные клиента подставляются сами', 'Contract from a template', 'Customer data fills itself in', 'mtB'],
    ['dc02', 'Коммерческое предложение', 'КП за минуты по вашим ценам', 'Commercial proposal', 'A proposal in minutes at your prices', 'itSB'],
    ['dc03', 'Сбор документов у клиента', 'Агент просит нужное и проверяет полноту', 'Collecting customer documents', 'The agent asks for what is needed and checks completeness', 'imB'],
    ['dc04', 'Распознавание сканов и фото', 'Текст из паспорта, чека или накладной', 'Scan and photo recognition', 'Text from a passport, receipt or waybill', 'mB'],
    ['dc05', 'Подписание и согласование', 'Документ уходит на подпись, статус виден', 'Signing and approval', 'A document goes for signature, status visible', 'mtB'],
    ['dc06', 'Архив с поиском', 'Любой документ находится по смыслу', 'Searchable archive', 'Any document found by meaning', 'tCB'],
    ['dc07', 'Выписка и справки', 'Типовые документы выдаются по запросу', 'Statements and certificates', 'Standard documents issued on request', 'mB'],
    ['dc08', 'Перевод и проверка текстов', 'Документы на нужном языке', 'Translation and proofreading', 'Documents in the language you need', 'cm'],
    ['dc09', 'Напоминание о сроках бумаг', 'Лицензии, страховки, договоры', 'Paper expiry reminders', 'Licences, insurance, contracts', 'mB'],
  ]),
  ...capTable('calls', [
    ['cl01', 'Ответ на входящий звонок голосом', 'Агент берёт трубку и решает типовой вопрос', 'Answering inbound calls by voice', 'The agent picks up and settles a typical question', 'aitU'],
    ['cl02', 'Запись на услугу по телефону', 'Клиент называет время, агент записывает', 'Booking by phone', 'The customer names a time, the agent books it', 'ai'],
    ['cl03', 'Исходящий обзвон по списку', 'Подтверждение записей и опросы', 'Outbound calls from a list', 'Booking confirmations and surveys', 'itS'],
    ['cl04', 'Расшифровка звонков', 'Текст и итог каждого разговора', 'Call transcripts', 'Text and the outcome of every call', 'mtU'],
    ['cl05', 'Оценка качества звонков', 'Видно, где менеджеры теряют клиента', 'Call quality review', 'You see where managers lose a customer', 'tS'],
    ['cl06', 'Переключение на человека', 'Сложный разговор идёт сотруднику без потери', 'Switch to a person', 'A hard call goes to staff with nothing lost', 'aitU'],
    ['cl07', 'Звонок вне рабочих часов', 'Ночью отвечает агент, утром у вас итог', 'Out-of-hours calls', 'The agent answers at night, you get a summary in the morning', 'ai'],
    ['cl08', 'Голосовые сообщения в чате', 'Агент понимает и отвечает голосом', 'Voice messages in chat', 'The agent understands and answers by voice', 'abP'],
    ['cl09', 'Заявка из пропущенного звонка', 'Пропущенный номер получает сообщение с предложением', 'Lead from a missed call', 'A missed number gets a message offering help', 'imS'],
  ]),
  ...capTable('social', [
    ['sm01', 'Контент-план на месяц', 'Темы, форматы и даты в одном плане', 'A monthly content plan', 'Topics, formats and dates in one plan', 'cM'],
    ['sm02', 'Тексты постов в вашем тоне', 'Черновики, которые вы правите и публикуете', 'Posts in your tone', 'Drafts you edit and publish', 'cM'],
    ['sm03', 'Сценарии коротких видео', 'Идея, текст, кадры и подписи', 'Short video scripts', 'Idea, text, shots and captions', 'cM'],
    ['sm04', 'Рилс и сторис из ваших материалов', 'Монтаж по шаблонам бренда', 'Reels and stories from your material', 'Edits from brand templates', 'cMR'],
    ['sm05', 'Карусели и картинки', 'Единый стиль и подписи', 'Carousels and images', 'One style and captions', 'cMR'],
    ['sm06', 'Ответы на комментарии и сообщения', 'Агент отвечает и зовёт в личные', 'Replies to comments and messages', 'The agent answers and invites to private chat', 'cMU'],
    ['sm07', 'Идеи по трендам вашей ниши', 'Что обсуждают сейчас и как это использовать', 'Ideas from niche trends', 'What people talk about now and how to use it', 'cM'],
    ['sm08', 'Публикация по расписанию', 'Посты выходят в лучшее время', 'Scheduled publishing', 'Posts go out at the best time', 'cM'],
    ['sm09', 'Статьи и рассылки', 'Длинные тексты для сайта и клиентов', 'Articles and newsletters', 'Long texts for the site and customers', 'csM'],
  ]),
  ...capTable('analytics', [
    ['an01', 'Откуда приходят клиенты', 'Каналы, кампании и ссылки сравниваются по заявкам', 'Where customers come from', 'Channels, campaigns and links compared by requests', 'smM'],
    ['an02', 'Воронка от обращения до оплаты', 'Видно, где клиент отваливается', 'Funnel from request to payment', 'You see where the customer drops off', 'imS'],
    ['an03', 'Частые вопросы клиентов', 'Список тем, что спрашивают чаще всего', 'Top customer questions', 'A list of what people ask most', 'aibU'],
    ['an04', 'Причины отказов', 'Почему уходят и что стоит поправить', 'Reasons for drop-off', 'Why people leave and what to fix', 'iS'],
    ['an05', 'Загрузка и пики спроса', 'Часы и дни, когда нужно больше рук', 'Load and demand peaks', 'Hours and days that need more hands', 'amB'],
    ['an06', 'Сравнение периодов', 'Эта неделя против прошлой, месяц к месяцу', 'Period comparison', 'This week versus last, month on month', 'mB'],
    ['an07', 'Оценка эффективности рекламы', 'Цена заявки и цена клиента по каналам', 'Ad effectiveness', 'Cost per request and per customer by channel', 'mM'],
    ['an08', 'Прогноз на следующую неделю', 'Простая оценка по вашей истории, без обещаний', 'Next-week outlook', 'A simple estimate from your history, no promises', 'tB'],
    ['an09', 'Дашборд для владельца', 'Главное на одном экране', "Owner's dashboard", 'The essentials on one screen', 'mtxC'],
  ]),
  ...capTable('security', [
    ['sc01', 'Доступ по ролям', 'Каждый видит только своё', 'Role-based access', 'Everyone sees only their own part', 'xmtC'],
    ['sc02', 'Вход по коду и без паролей в чате', 'Безопасный вход в кабинет', 'Code sign-in, no passwords in chat', 'A safe sign-in to the cabinet', 'xmtC'],
    ['sc03', 'Одобрение опасных действий человеком', 'Платёж, удаление и рассылка идут только после вашего да', 'Human approval for risky actions', 'Payment, deletion and mailing only after your yes', 'imtCP'],
    ['sc04', 'Журнал действий агента', 'Что агент сделал, когда и почему', 'Agent action log', 'What the agent did, when and why', 'mtC'],
    ['sc05', 'Запрет на разглашение данных', 'Агент не показывает чужие данные в чате', 'No data disclosure', 'The agent never shows other people data in chat', 'aibt'],
    ['sc06', 'Хранение и удаление данных по запросу', 'Клиент может попросить удалить свои данные', 'Data retention and deletion on request', 'A customer can ask to delete their data', 'mtB'],
    ['sc07', 'Резервные копии', 'Данные восстанавливаются после сбоя', 'Backups', 'Data can be restored after a failure', 'mxC'],
    ['sc08', 'Защита от подмены и мошенников', 'Подозрительные просьбы помечаются', 'Protection from impostors', 'Suspicious requests are flagged', 'aitU'],
    ['sc09', 'Свой ключ модели', 'Расходы и данные под вашим контролем', 'Your own model key', 'Costs and data under your control', 'Pt'],
  ]),
]
export const capabilityById: Record<string, Capability> = Object.fromEntries(capabilities.map((c) => [c.id, c]))

// What the picked products already provide: a capability counts as «in your set» when any picked product (or
// the team its product brings) is in its `by`. Anything else is «по смете» (never a number).
export function capabilityCovered(cap: Capability, picked: readonly string[], teams: readonly string[] = []): boolean {
  return cap.by.some((p) => picked.includes(p) || teams.includes(p))
}

// ------------------------------------------------- channels with sub-options

// Seven channels, listed as equals (owner 2026-11-22: Telegram is ONE channel among many). Each has 3-5
// sub-options: how exactly the agent lives there. Ids `ch01...`, group = the channel.
export const channelGroups: Group[] = groups([
  ['telegram', 'Telegram бот', 'Telegram bot'],
  ['whatsapp', 'WhatsApp Business', 'WhatsApp Business'],
  ['widget', 'Виджет на сайте', 'Site widget'],
  ['voice', 'Голос: входящие и исходящие', 'Voice: inbound and outbound'],
  ['email', 'Почта', 'Email'],
  ['miniapp', 'Mini App', 'Mini App'],
  ['desktop', 'Рабочий стол', 'Desktop'],
])
export const channelOptions: Item[] = [
  ...table('telegram', [
    ['ch01', 'Чат с клиентами', 'Агент отвечает и записывает в личных сообщениях', 'Customer chat', 'The agent answers and books in direct messages'],
    ['ch02', 'Кнопки и быстрые ответы', 'Меню услуг и подтверждение одним тапом', 'Buttons and quick replies', 'A service menu and one-tap confirmation'],
    ['ch03', 'Уведомления команде в группу', 'Новые заявки и сводки в рабочем чате', 'Team notifications in a group', 'New requests and summaries in a work chat'],
    ['ch04', 'Рассылки подписчикам', 'Новости и акции по согласию', 'Subscriber mailings', 'News and offers with consent'],
    ['ch05', 'Одобрение действий кнопкой', 'Владелец подтверждает платёж или рассылку в чате', 'Approve actions with a button', 'The owner confirms a payment or mailing in chat'],
  ]),
  ...table('whatsapp', [
    ['ch06', 'Ответы клиентам', 'Агент принимает вопросы и заявки', 'Customer replies', 'The agent takes questions and requests'],
    ['ch07', 'Каталог товаров и услуг', 'Витрина внутри чата', 'Product and service catalogue', 'A showcase inside the chat'],
    ['ch08', 'Шаблонные сообщения', 'Подтверждения и напоминания по правилам WhatsApp', 'Template messages', 'Confirmations and reminders under WhatsApp rules'],
    ['ch09', 'Передача оператору', 'Сложный вопрос идёт человеку с историей', 'Hand-off to an operator', 'A hard question goes to a person with the history'],
  ]),
  ...table('widget', [
    ['ch10', 'Чат в углу страницы', 'Отвечает посетителю, не уходя с сайта', 'Chat in the page corner', 'Answers the visitor without leaving the site'],
    ['ch11', 'Запись и заявка прямо в виджете', 'Выбор времени и контактов без формы', 'Booking and request inside the widget', 'Time and contacts without a form'],
    ['ch12', 'Подсказки по странице', 'Агент предлагает вопросы под контекст', 'Page-aware hints', 'The agent suggests questions for the context'],
    ['ch13', 'Несколько языков', 'Ответ на языке посетителя', 'Several languages', 'Answers in the visitor language'],
    ['ch14', 'Оформление под ваш сайт', 'Цвета, имя и аватар агента', 'Styled to your site', 'Colours, name and avatar of the agent'],
  ]),
  ...table('voice', [
    ['ch15', 'Входящие звонки', 'Агент берёт трубку и решает типовой вопрос', 'Inbound calls', 'The agent picks up and settles a typical question'],
    ['ch16', 'Исходящие звонки', 'Подтверждения, напоминания и опросы по списку', 'Outbound calls', 'Confirmations, reminders and surveys from a list'],
    ['ch17', 'Голосовые сообщения', 'Понимает голосовые в чатах и отвечает', 'Voice messages', 'Understands voice notes in chats and answers'],
    ['ch18', 'Запись и расшифровка разговоров', 'Текст и итог по каждому звонку', 'Call recording and transcripts', 'Text and the outcome of every call'],
  ]),
  ...table('email', [
    ['ch19', 'Разбор входящих писем', 'Письма сортируются, срочное наверх', 'Inbox triage', 'Mail is sorted, urgent on top'],
    ['ch20', 'Черновики ответов', 'Вы читаете и отправляете одним нажатием', 'Reply drafts', 'You read and send with one click'],
    ['ch21', 'Рассылки по базе', 'Письма клиентам по сегментам', 'Newsletters to the base', 'Emails to customers by segment'],
    ['ch22', 'Заявки из почты в список', 'Письма с запросами попадают в общий список', 'Requests from mail into a list', 'Request emails land in the shared list'],
  ]),
  ...table('miniapp', [
    ['ch23', 'Каталог и заказ в Telegram', 'Витрина и корзина внутри мессенджера', 'Catalogue and order in Telegram', 'A showcase and cart inside the messenger'],
    ['ch24', 'Запись и расписание', 'Календарь услуг с выбором мастера', 'Booking and schedule', 'A service calendar with a specialist choice'],
    ['ch25', 'Личный кабинет клиента', 'История, баллы, заказы', 'Customer cabinet', 'History, points, orders'],
    ['ch26', 'Оплата внутри приложения', 'Платёж без перехода на другие страницы', 'In-app payment', 'Pay without leaving for other pages'],
  ]),
  ...table('desktop', [
    ['ch27', 'Приложение для Mac и Windows', 'Агент всегда под рукой в панели меню', 'Mac and Windows app', 'The agent always at hand in the menu bar'],
    ['ch28', 'Работа с файлами и почтой на компьютере', 'Разобрать папку, подготовить документ', 'Files and mail on your computer', 'Sort a folder, prepare a document'],
    ['ch29', 'Горячая клавиша', 'Вызов агента из любого окна', 'Global shortcut', 'Call the agent from any window'],
  ]),
]

// -------------------------------------------------------------- integrations

export const integrationGroups: Group[] = groups([
  ['crm', 'CRM и продажи', 'CRM and sales'],
  ['booking', 'Запись и расписание', 'Booking and schedule'],
  ['pay', 'Оплата', 'Payments'],
  ['maps', 'Карты и отзывы', 'Maps and reviews'],
  ['social', 'Соцсети и мессенджеры', 'Socials and messengers'],
  ['office', 'Почта, календарь, офис', 'Mail, calendar, office'],
  ['acc', 'Учёт и склад', 'Accounting and stock'],
  ['shop', 'Магазины и маркетплейсы', 'Shops and marketplaces'],
  ['learn', 'Обучение и знания', 'Learning and knowledge'],
  ['other', 'Другое', 'Other'],
])
// [id, brand, ru hint, en hint]; brands are the same in both languages.
type IntRow = readonly [string, string, string, string]
const intTable = (group: string, rows: readonly IntRow[]): Item[] =>
  rows.map(([id, brand, ru, en]) => ({ id, group, name: l(brand, brand), hint: l(ru, en) }))
export const integrations: Item[] = [
  ...intTable('crm', [
    ['amocrm', 'amoCRM', 'Сделки и контакты', 'Deals and contacts'],
    ['bitrix24', 'Bitrix24', 'CRM и задачи', 'CRM and tasks'],
    ['hubspot', 'HubSpot', 'Клиенты и воронка', 'Customers and pipeline'],
    ['pipedrive', 'Pipedrive', 'Воронка продаж', 'Sales pipeline'],
    ['zoho', 'Zoho CRM', 'Клиенты и сделки', 'Customers and deals'],
    ['salesforce', 'Salesforce', 'Крупная CRM', 'Enterprise CRM'],
    ['kommo', 'Kommo', 'Мессенджеры и сделки', 'Messengers and deals'],
  ]),
  ...intTable('booking', [
    ['yclients', 'YCLIENTS', 'Запись и записи салонов', 'Salon booking system'],
    ['dikidi', 'DIKIDI', 'Онлайн-запись', 'Online booking'],
    ['calendly', 'Calendly', 'Выбор времени для встреч', 'Meeting scheduler'],
    ['gcalendar', 'Google Calendar', 'Календарь записей', 'Booking calendar'],
    ['clinicsys', 'МИС клиники', 'Расписание врачей', 'Clinic schedule system'],
  ]),
  ...intTable('pay', [
    ['kaspi', 'Kaspi', 'Оплата и рассрочка', 'Payment and instalments'],
    ['payme', 'Payme', 'Оплата по ссылке', 'Pay by link'],
    ['click', 'Click', 'Оплата в приложении', 'In-app payment'],
    ['stripe', 'Stripe', 'Карты по всему миру', 'Cards worldwide'],
    ['paypal', 'PayPal', 'Платежи из-за рубежа', 'International payments'],
    ['yookassa', 'ЮKassa', 'Приём платежей', 'Payment acceptance'],
    ['alif', 'Alif', 'Платежи в Таджикистане', 'Payments in Tajikistan'],
  ]),
  ...intTable('maps', [
    ['yandexmaps', 'Яндекс Карты', 'Карточка и отзывы', 'Card and reviews'],
    ['2gis', '2ГИС', 'Карточка и отзывы', 'Card and reviews'],
    ['googlemaps', 'Google Maps', 'Профиль компании', 'Business profile'],
    ['tripadvisor', 'Tripadvisor', 'Отзывы путешественников', 'Traveller reviews'],
    ['booking', 'Booking.com', 'Бронь и отзывы гостей', 'Bookings and guest reviews'],
  ]),
  ...intTable('social', [
    ['instagram', 'Instagram', 'Сообщения и комментарии', 'Messages and comments'],
    ['facebook', 'Facebook', 'Страница и сообщения', 'Page and messages'],
    ['telegram', 'Telegram', 'Чат и каналы', 'Chat and channels'],
    ['whatsapp', 'WhatsApp', 'Чат с клиентами', 'Customer chat'],
    ['tiktok', 'TikTok', 'Короткие видео', 'Short videos'],
    ['youtube', 'YouTube', 'Видео и комментарии', 'Video and comments'],
    ['vk', 'VK', 'Сообщество и сообщения', 'Community and messages'],
    ['linkedin', 'LinkedIn', 'B2B-контакты', 'B2B contacts'],
  ]),
  ...intTable('office', [
    ['gsheets', 'Google Sheets', 'Таблицы и отчёты', 'Sheets and reports'],
    ['gmail', 'Gmail', 'Почта', 'Mail'],
    ['outlook', 'Outlook', 'Почта и календарь', 'Mail and calendar'],
    ['gdrive', 'Google Drive', 'Файлы и документы', 'Files and documents'],
    ['onedrive', 'OneDrive', 'Файлы Microsoft', 'Microsoft files'],
    ['excel', 'Excel', 'Каталоги и учёт в таблицах', 'Catalogues and tracking in sheets'],
  ]),
  ...intTable('acc', [
    ['onec', '1С', 'Учёт, склад, касса', 'Accounting, stock, till'],
    ['moysklad', 'МойСклад', 'Склад и продажи', 'Stock and sales'],
    ['quickbooks', 'QuickBooks', 'Бухгалтерия', 'Bookkeeping'],
    ['iiko', 'iiko', 'Кафе и рестораны', 'Cafes and restaurants'],
    ['poster', 'Poster', 'Касса и заведения', 'Till and venues'],
  ]),
  ...intTable('shop', [
    ['woocommerce', 'WooCommerce', 'Магазин на WordPress', 'WordPress shop'],
    ['shopify', 'Shopify', 'Интернет-магазин', 'Webshop'],
    ['tilda', 'Tilda', 'Сайты и формы', 'Sites and forms'],
    ['wildberries', 'Wildberries', 'Маркетплейс', 'Marketplace'],
    ['ozon', 'Ozon', 'Маркетплейс', 'Marketplace'],
    ['uzum', 'Uzum', 'Маркетплейс региона', 'Regional marketplace'],
  ]),
  ...intTable('learn', [
    ['notion', 'Notion', 'База знаний и задачи', 'Knowledge base and tasks'],
    ['moodle', 'Moodle', 'Курсы и задания', 'Courses and assignments'],
    ['gclassroom', 'Google Classroom', 'Занятия и работы', 'Classes and work'],
    ['getcourse', 'GetCourse', 'Онлайн-школа', 'Online school'],
    ['confluence', 'Confluence', 'Документация', 'Documentation'],
  ]),
  ...intTable('other', [
    ['zapier', 'Zapier', 'Связь сервисов без кода', 'No-code service links'],
    ['n8n', 'n8n', 'Свои сценарии автоматизации', 'Own automation flows'],
    ['webhook', 'Webhook и API', 'Ваша система, любой сервис с API', 'Your system or any service with an API'],
    ['slack', 'Slack', 'Рабочие чаты', 'Work chats'],
    ['zoom', 'Zoom', 'Встречи', 'Meetings'],
    ['trello', 'Trello', 'Задачи на досках', 'Tasks on boards'],
    ['jira', 'Jira', 'Задачи разработки', 'Development tasks'],
  ]),
]

// --------------------------------------------------------------------- content

// Formats times frequency: pick a format, then how often. Frequency ids are stable.
export const contentFormats: Item[] = table('format', [
  ['f01', 'Короткие видео (рилс, шортс)', 'Сценарий, монтаж, подпись', 'Short videos (reels, shorts)', 'Script, edit, caption'],
  ['f02', 'Посты с картинкой', 'Текст и изображение в стиле бренда', 'Image posts', 'Text and an image in the brand style'],
  ['f03', 'Карусели', 'Несколько слайдов с одной мыслью', 'Carousels', 'Several slides, one idea'],
  ['f04', 'Сторис', 'Ежедневные короткие кадры', 'Stories', 'Daily short frames'],
  ['f05', 'Статьи для сайта', 'Длинные тексты под поиск', 'Site articles', 'Long texts for search'],
  ['f06', 'Рассылка по почте', 'Письма подписчикам', 'Email newsletter', 'Emails to subscribers'],
  ['f07', 'Длинное видео', 'Сценарий и нарезка для YouTube', 'Long video', 'Script and cuts for YouTube'],
  ['f08', 'Подкаст', 'Темы, вопросы и расшифровка', 'Podcast', 'Topics, questions and transcript'],
  ['f09', 'Посты в Telegram-канал', 'Новости и полезное подписчикам', 'Telegram channel posts', 'News and useful notes for subscribers'],
  ['f10', 'Описания товаров и услуг', 'Тексты для карточек и каталога', 'Product and service descriptions', 'Texts for cards and catalogue'],
])
export const contentFrequencies: Item[] = table('freq', [
  ['q1', 'Каждый день', 'Ежедневно', 'Every day', 'Daily'],
  ['q2', '3 раза в неделю', 'Через день', 'Three times a week', 'Every other day'],
  ['q3', 'Раз в неделю', 'Одно в неделю', 'Once a week', 'One a week'],
  ['q4', 'Два раза в месяц', 'Раз в две недели', 'Twice a month', 'Every two weeks'],
  ['q5', 'Раз в месяц', 'Одно в месяц', 'Once a month', 'One a month'],
])

// ------------------------------------------------------------ personal path

// Six more people on top of the nine of `personalWho` (builder-ids.ts), ids appended: `personalWhoMore`.
export const personaMore: Record<PersonalWhoMore, { name: L<string>; hint: L<string> }> = {
  engineer: { name: l('Инженер или разработчик', 'Engineer or developer'), hint: l('Код, задачи, созвоны', 'Code, tasks, calls') },
  researcher: { name: l('Исследователь', 'Researcher'), hint: l('Статьи, данные, заметки', 'Papers, data, notes') },
  lawyer: { name: l('Юрист или бухгалтер', 'Lawyer or accountant'), hint: l('Сроки, документы, клиенты', 'Deadlines, documents, clients') },
  retiree: { name: l('Человек на пенсии', 'Retired person'), hint: l('Здоровье, семья, досуг', 'Health, family, leisure') },
  traveler: { name: l('Путешественник', 'Traveller'), hint: l('Маршруты, билеты, визы', 'Routes, tickets, visas') },
  athlete: { name: l('Спортсмен', 'Athlete'), hint: l('Тренировки, питание, восстановление', 'Training, food, recovery') },
}

// Connections: 25 services in groups. The first nine are the original `personalConnect` ids.
export const connectionGroups: Group[] = groups([
  ['office', 'Почта, календарь, файлы', 'Mail, calendar, files'],
  ['notes', 'Заметки и задачи', 'Notes and tasks'],
  ['study', 'Учёба', 'Study'],
  ['chat', 'Мессенджеры и работа', 'Messengers and work'],
  ['social', 'Соцсети', 'Socials'],
  ['health', 'Здоровье и спорт', 'Health and sport'],
  ['money', 'Деньги', 'Money'],
  ['other', 'Другое', 'Other'],
])
export const connectionGroupOf: Record<string, string> = {
  google: 'office', microsoft: 'office', apple: 'office', dropbox: 'office', zoom: 'chat',
  notion: 'notes', obsidian: 'notes', todoist: 'notes', trello: 'notes', evernote: 'notes',
  moodle: 'study', anki: 'study', canvas: 'study',
  telegram: 'chat', whatsapp: 'chat', slack: 'chat', github: 'chat',
  linkedin: 'social', instagram: 'social', youtube: 'social',
  applehealth: 'health', strava: 'health',
  bank: 'money', kaspi: 'money',
  other: 'other',
}

// Personal skills by area of life: more than forty, none required. Ids `sk01...`.
export const skillGroups: Group[] = groups([
  ['work', 'Работа', 'Work'],
  ['study', 'Учёба', 'Study'],
  ['money', 'Деньги', 'Money'],
  ['health', 'Здоровье и спорт', 'Health and sport'],
  ['home', 'Дом и быт', 'Home'],
  ['family', 'Семья и люди', 'Family and people'],
  ['travel', 'Путешествия', 'Travel'],
  ['create', 'Творчество и контент', 'Creative and content'],
  ['digital', 'Цифровой порядок', 'Digital order'],
])
export const personalSkills: Item[] = [
  ...table('work', [
    ['sk01', 'Утренняя сводка дел', 'Письма, встречи и задачи на день', 'Morning brief', 'Mail, meetings and tasks for the day'],
    ['sk02', 'Разбор входящих писем', 'Срочное наверх, лишнее в архив', 'Inbox triage', 'Urgent on top, noise archived'],
    ['sk03', 'Ответы на письма от вашего имени', 'Черновик готов, отправка после вашего да', 'Replies in your voice', 'A draft is ready, sent after your yes'],
    ['sk04', 'Подготовка к встрече', 'Кто придёт, о чём говорили в прошлый раз', 'Meeting prep', 'Who comes and what was said last time'],
    ['sk05', 'Протокол и итоги встречи', 'Решения и задачи из записи или заметок', 'Meeting minutes', 'Decisions and tasks from a recording or notes'],
    ['sk06', 'Поиск времени для встречи', 'Свободные окна и приглашение', 'Finding a meeting time', 'Free slots and an invitation'],
  ]),
  ...table('study', [
    ['sk07', 'Сроки и дедлайны', 'Задания, экзамены и защиты в одном списке', 'Deadlines', 'Assignments, exams and defences in one list'],
    ['sk08', 'Конспекты и карточки', 'Из лекции получается краткий конспект и вопросы', 'Notes and flashcards', 'A lecture becomes short notes and questions'],
    ['sk09', 'План подготовки к экзамену', 'Что учить в какой день', 'Exam study plan', 'What to study on which day'],
    ['sk10', 'Проверка эссе и работ', 'Замечания и идеи без готового ответа', 'Essay feedback', 'Remarks and ideas without a ready answer'],
    ['sk11', 'Практика иностранного языка', 'Диалоги и разбор ошибок каждый день', 'Foreign language practice', 'Dialogues and mistake review every day'],
    ['sk12', 'Поиск источников и цитат', 'Статьи по теме со ссылками', 'Sources and citations', 'Papers on the topic with links'],
  ]),
  ...table('money', [
    ['sk13', 'Учёт расходов и доходов', 'Траты по категориям из выписок', 'Income and expense tracking', 'Spending by category from statements'],
    ['sk14', 'Напоминания о платежах', 'Аренда, кредиты, подписки', 'Payment reminders', 'Rent, loans, subscriptions'],
    ['sk15', 'Бюджет на месяц', 'Сколько можно потратить на что', 'Monthly budget', 'How much you can spend on what'],
    ['sk16', 'Контроль подписок', 'Что списывается и от чего можно отказаться', 'Subscription control', 'What is charged and what you can cancel'],
    ['sk17', 'Счета и чеки для налогов', 'Документы собираются за год', 'Invoices and receipts for taxes', 'Documents collected over the year'],
    ['sk18', 'Сравнение цен и предложений', 'Где выгоднее купить', 'Price and offer comparison', 'Where it is cheaper to buy'],
  ]),
  ...table('health', [
    ['sk19', 'План тренировок', 'Нагрузка под вашу цель и график', 'Training plan', 'Load for your goal and schedule'],
    ['sk20', 'Напоминание о лекарствах и витаминах', 'По расписанию, без пропусков', 'Medicine and vitamin reminders', 'On schedule, no misses'],
    ['sk21', 'Дневник питания и воды', 'Быстрые отметки в чате', 'Food and water diary', 'Quick entries in chat'],
    ['sk22', 'Запись к врачу и анализы', 'Напомнить о визите и о подготовке', 'Doctor visits and tests', 'A reminder of the visit and its preparation'],
    ['sk23', 'Сон и режим', 'Мягкие напоминания о времени отхода ко сну', 'Sleep and routine', 'Gentle bedtime reminders'],
    ['sk24', 'История болезней и документы', 'Справки и выписки в одном месте', 'Health records and documents', 'Certificates and statements in one place'],
  ]),
  ...table('home', [
    ['sk25', 'Список покупок', 'Собирается в разговоре, делится с семьёй', 'Shopping list', 'Built in conversation, shared with family'],
    ['sk26', 'Меню на неделю', 'Рецепты и продукты под ваши вкусы', 'Weekly menu', 'Recipes and groceries to your taste'],
    ['sk27', 'Коммунальные платежи и показания', 'Сроки и напоминания', 'Utilities and meter readings', 'Deadlines and reminders'],
    ['sk28', 'Вызов мастера и ремонт', 'Найти, договориться, записать время', 'Calling a repair person', 'Find, agree, book a time'],
    ['sk29', 'Гарантии и чеки на технику', 'Где лежит документ и когда кончается гарантия', 'Warranties and receipts', 'Where the document is and when the warranty ends'],
    ['sk30', 'Домашние дела по графику', 'Уборка, полив, смена фильтров', 'Chores on a schedule', 'Cleaning, watering, filter changes'],
  ]),
  ...table('family', [
    ['sk31', 'Расписание семьи', 'У каждого свои дела на одном календаре', 'Family schedule', 'Everyone own plans on one calendar'],
    ['sk32', 'Дни рождения и подарки', 'Напомнить заранее и подсказать идею', 'Birthdays and gifts', 'A reminder ahead and an idea'],
    ['sk33', 'Школа и кружки детей', 'Расписание, сборы, родительские чаты', 'School and kids activities', 'Timetables, packing, parent chats'],
    ['sk34', 'Связь с близкими', 'Напоминание позвонить родителям или друзьям', 'Staying in touch', 'A nudge to call parents or friends'],
    ['sk35', 'Забота о пожилых родителях', 'Лекарства, визиты и звонки', 'Caring for older parents', 'Medicine, visits and calls'],
  ]),
  ...table('travel', [
    ['sk36', 'Маршрут и билеты', 'Варианты, время и цена в одном месте', 'Route and tickets', 'Options, time and price in one place'],
    ['sk37', 'Визы и документы для поездки', 'Что нужно и когда подавать', 'Visas and travel documents', 'What you need and when to apply'],
    ['sk38', 'Бронь жилья', 'Подбор по вашим условиям', 'Accommodation booking', 'A pick by your conditions'],
    ['sk39', 'План по дням в городе', 'Места, время в пути, перерывы', 'Day-by-day city plan', 'Places, travel time, breaks'],
    ['sk40', 'Чек-лист вещей', 'Что взять в зависимости от погоды и срока', 'Packing checklist', 'What to take by weather and length'],
  ]),
  ...table('create', [
    ['sk41', 'Идеи и черновики постов', 'Для блога, канала или соцсетей', 'Post ideas and drafts', 'For a blog, channel or socials'],
    ['sk42', 'Контент-план', 'Темы и даты на месяц', 'Content plan', 'Topics and dates for the month'],
    ['sk43', 'Сценарии коротких видео', 'Идея, текст и подпись', 'Short video scripts', 'Idea, text and caption'],
    ['sk44', 'Ответы на комментарии', 'Черновики для вашего одобрения', 'Replies to comments', 'Drafts for your approval'],
    ['sk45', 'Дневник и заметки голосом', 'Наговорили, получили аккуратную запись', 'Voice diary and notes', 'You speak, you get a neat entry'],
  ]),
  ...table('digital', [
    ['sk46', 'Порядок в файлах и фото', 'Разобрать папки и найти нужное', 'Order in files and photos', 'Sort folders and find what you need'],
    ['sk47', 'Пароли и безопасность аккаунтов', 'Подсказки, без хранения паролей в чате', 'Passwords and account safety', 'Tips, no passwords stored in chat'],
    ['sk48', 'Отписка от лишнего', 'Рассылки и подписки, которые не нужны', 'Unsubscribe from clutter', 'Mailings and subscriptions you do not need'],
    ['sk49', 'Поиск по вашим заметкам и письмам', 'Ответ из ваших же материалов', 'Search across your notes and mail', 'An answer from your own material'],
    ['sk50', 'Резервные копии', 'Напомнить и проверить, что всё сохранено', 'Backups', 'A reminder and a check that all is saved'],
  ]),
]

// The five character axes of the personal agent are in `toneUi` (content/builder-personal.ts).
