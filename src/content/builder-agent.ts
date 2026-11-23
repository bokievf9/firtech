import type { AiTeamId } from '../lib/ai-teams'
import type { AgentAddonId, AgentConnectId, AgentVolumeId } from '../lib/agent-ids'

// Copy of the agent path of «Сборка проекта» (builder v6): one agent as a product, RU and EN side by side. Prices are
// never typed here (they come from pricing.ts). No em or en dashes in copy (use a hyphen); «бот» is not a product word.

type Loc = 'ru' | 'en'
type L<T> = Record<Loc, T>
const l = (ru: string, en: string): L<string> => ({ ru, en })

export const agentUi = {
  // The third choice of the fork on the first screen, and the card on the «Что делаем» step.
  fork: l('Один агент', 'One agent'),
  forkHint: l('Один ИИ-сотрудник под конкретное дело', 'One AI employee for one job'),
  card: {
    name: l('Один агент', 'One agent'),
    hint: l(
      'Берёте одного ИИ-сотрудника под своё дело: менеджера заявок, поддержку, контент или другого. Подписка, без сайта и лишнего.',
      'Take one AI employee for your job: a lead manager, support, content or another. A subscription, no site and no extras.',
    ),
    worksIn: l('Работает в', 'Works in'),
    perMonth: l('/мес', '/mo'),
    from: l('от', 'from'),
  },
  steps: {
    ru: ['Агент', 'Где работает', 'Что подключить', 'Объём', 'Знания', 'Оценка'],
    en: ['Agent', 'Where it works', 'What to connect', 'Volume', 'Knowledge', 'Estimate'],
  } as L<string[]>,
  titles: [
    l('Какой агент вам нужен?', 'Which agent do you need?'),
    l('Где он будет работать?', 'Where will it work?'),
    l('Что подключить?', 'What should it connect to?'),
    l('Сколько работы?', 'How much work?'),
    l('Знания и обучение', 'Knowledge and training'),
    l('Оценка и этапы', 'Estimate and stages'),
  ],
  subs: [
    l('Выберите одного. Остальных можно добавить на последнем шаге.', 'Pick one. You can add more on the last step.'),
    l('Каналы равноправны: можно несколько сразу.', 'Channels are equal: pick several if you like.'),
    l('Отметьте, что у вас есть. Доступы даёте вы и можете отозвать.', 'Tick what you have. You give the access and can withdraw it.'),
    l('Примерно, чтобы мы подобрали нагрузку.', 'Roughly, so we can size the load.'),
    l('Два необязательных пункта. Цена каждого указана рядом.', 'Two optional items. The price of each is shown next to it.'),
    l('Подключение, подписка и этапы оплаты. Это оценка, не договор.', 'Setup, subscription and payment stages. An estimate, not a contract.'),
  ],
  issues: {
    agent: l('Выберите агента', 'Pick an agent'),
    where: l('Выберите хотя бы один канал', 'Pick at least one channel'),
    volume: l('Выберите объём', 'Pick a volume'),
  } as Record<string, L<string>>,
  grid: {
    search: l('Найти агента', 'Find an agent'),
    none: l('Такого агента нет. Попробуйте другое слово.', 'No such agent. Try another word.'),
    chosen: l('Выбран', 'Chosen'),
  },
  // The three questions follow the department of the chosen agent.
  questions: {
    sales: {
      where: l('Где клиенты пишут вам?', 'Where do clients write to you?'),
      connect: l('Куда складывать заявки и записи?', 'Where should leads and bookings go?'),
      volume: l('Сколько заявок в месяц?', 'How many leads a month?'),
    },
    marketing: {
      where: l('Где публиковать и согласовывать материалы?', 'Where do you publish and approve posts?'),
      connect: l('С чем связать работу?', 'What should the work connect to?'),
      volume: l('Сколько материалов в месяц?', 'How many pieces a month?'),
    },
    support: {
      where: l('Где клиенты задают вопросы?', 'Where do clients ask questions?'),
      connect: l('Откуда брать ответы и кому передавать сложное?', 'Where do answers come from and who gets the hard ones?'),
      volume: l('Сколько обращений в месяц?', 'How many requests a month?'),
    },
    production: {
      where: l('Где команда ставит задачи?', 'Where does the team set tasks?'),
      connect: l('Что подключить к работе?', 'What should it connect to?'),
      volume: l('Сколько задач в месяц?', 'How many tasks a month?'),
    },
    backoffice: {
      where: l('Где сотрудники обращаются к агенту?', 'Where do staff talk to the agent?'),
      connect: l('Откуда брать документы и данные?', 'Where do documents and data live?'),
      volume: l('Сколько документов или запросов в месяц?', 'How many documents or requests a month?'),
    },
    company: {
      where: l('Где он будет работать?', 'Where will it work?'),
      connect: l('Что подключить?', 'What should it connect to?'),
      volume: l('Сколько работы в месяц?', 'How much work a month?'),
    },
  } as Record<AiTeamId, { where: L<string>; connect: L<string>; volume: L<string> }>,
  connect: {
    crm: { name: l('CRM', 'CRM'), hint: l('Клиенты и сделки', 'Clients and deals') },
    calendar: { name: l('Календарь', 'Calendar'), hint: l('Записи и встречи', 'Bookings and meetings') },
    site: { name: l('Сайт', 'Website'), hint: l('Формы и страницы', 'Forms and pages') },
    payments: { name: l('Платежи', 'Payments'), hint: l('Счета и оплаты', 'Invoices and payments') },
    sheets: { name: l('Таблицы', 'Sheets'), hint: l('Данные и отчёты', 'Data and reports') },
  } as Record<AgentConnectId, { name: L<string>; hint: L<string> }>,
  volume: {
    s: l('До 50', 'Up to 50'),
    m: l('50-300', '50-300'),
    l: l('300-1000', '300-1000'),
    xl: l('Больше 1000', 'Over 1000'),
  } as Record<AgentVolumeId, L<string>>,
  addons: {
    knowledge: {
      name: l('Импорт знаний', 'Knowledge import'),
      hint: l('Загрузим ваши документы, сайт и частые ответы, чтобы агент отвечал по ним', 'We load your documents, site and common answers so the agent answers from them'),
    },
    training: {
      name: l('Обучение команды', 'Team training'),
      hint: l('Короткое занятие и памятка, как работать с агентом', 'A short session and a cheat sheet on working with the agent'),
    },
  } as Record<AgentAddonId, { name: L<string>; hint: L<string> }>,
  addonOptional: l('По желанию', 'Optional'),
  labels: {
    agent: l('Агент', 'Agent'),
    agents: l('Агенты', 'Agents'),
    where: l('Где работает', 'Where it works'),
    connect: l('Что подключить', 'What to connect'),
    volume: l('Объём в месяц', 'Volume a month'),
    options: l('Дополнительно', 'Extras'),
    subscription: l('Подписка на агентов', 'Agent subscription'),
    setupWord: l('подключение', 'setup'),
    teamDiscount: l('Скидка за команду', 'Team discount'),
    monthly: l('Подписка в месяц', 'Subscription per month'),
    sheet: l('Агент', 'Agent'),
  },
  // Agents added to any build (summary).
  lines: {
    title: l('Агенты в проекте', 'Agents in the project'),
    add: l('Добавить агента', 'Add an agent'),
    close: l('Готово', 'Done'),
    remove: l('Убрать', 'Remove'),
    team: l('Со второго агента считаем по цене команды.', 'From the second agent we price it as a team.'),
    empty: l('Агентов пока нет. Добавьте одного к проекту.', 'No agents yet. Add one to the project.'),
  },
  extrasOn: l('включено', 'included'),
}
