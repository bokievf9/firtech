import { price as p } from './prices'
import type { Article } from './types'

export const stopLosingLeads: Article = {
  slug: 'stop-losing-leads',
  published: true,
  date: '2026-10-16',
  ru: {
    title: 'Как перестать терять заявки: 5 простых шагов',
    description:
      'Заявки теряются в личных сообщениях, звонках и комментариях. Пять шагов, чтобы отвечать быстрее и не забывать о клиентах, и где помогает ИИ-агент.',
    blocks: [
      {
        type: 'p',
        text: 'Представьте обычный день. Один клиент написал в Instagram, второй позвонил, пока вы были заняты, третий оставил комментарий под постом, четвёртый написал в Telegram вашему сотруднику. Вечером вы отвечаете тем, кого вспомнили. Остальные к этому времени уже договорились с кем-то другим.',
      },
      {
        type: 'p',
        text: 'Реклама при этом работала, и цена была нормальной. Заявки просто потерялись по дороге. Это можно исправить без большой системы и большого бюджета, если идти по шагам.',
      },
      {
        type: 'p',
        text: 'Ниже пять шагов. Первые три можно сделать уже на этой неделе почти без затрат, для двух последних пригодятся простые инструменты. В каждом шаге пишем, что можно сделать самим, а где помогут ИИ-агент или автоматизация.',
      },
      { type: 'h2', text: 'Шаг 1. Один канал для всех заявок' },
      {
        type: 'p',
        text: 'Пока заявки приходят в пять разных мест, какая-то обязательно потеряется. Поэтому первым делом решите, куда стекается всё. Для большинства малых бизнесов удобнее всего один рабочий мессенджер, Telegram или WhatsApp: он уже есть у вас и у сотрудников в телефоне.',
      },
      {
        type: 'p',
        text: 'Отказываться от других каналов при этом не нужно. Пусть клиенты пишут, где им удобно. Но форма на сайте, агент и, где это возможно, остальные источники должны пересылать заявку в одно место, например в общий рабочий чат.',
      },
      {
        type: 'p',
        text: 'Начните с простого упражнения: выпишите все места, куда к вам сейчас пишут и звонят. Обычно список получается длиннее, чем кажется: личный номер владельца, рабочий номер, Instagram, Telegram, форма на сайте, карты. Для каждого пункта решите, как заявка оттуда попадёт в общий чат, вручную или автоматически.',
      },
      { type: 'h2', text: 'Шаг 2. Мгновенные уведомления' },
      {
        type: 'p',
        text: 'Заявка, которую увидели через три часа, часто уже бесполезна. Поэтому каждая новая заявка должна приходить уведомлением сразу: имя, контакт, что нужно клиенту и откуда он пришёл. Тогда не приходится каждый час проверять почту и админку сайта.',
      },
      {
        type: 'p',
        text: `Технически это несложно. Подключить форму на сайте к рабочему мессенджеру у нас стоит от ${p.siteTelegram}. Если заявки приходят из разных сервисов, уведомления в мессенджер в рамках автоматизации добавляются от ${p.alerts}.`,
      },
      { type: 'h2', text: 'Шаг 3. Быстрый ответ' },
      {
        type: 'p',
        text: 'Клиент, который написал сразу нескольким исполнителям, часто выбирает того, кто ответил первым и понятно. Договоритесь в команде, кто отвечает на заявки и в какое время. Подготовьте шаблоны ответов на частые вопросы: цены, адрес, сроки, оплата. Так ответ занимает минуту, а не десять.',
      },
      {
        type: 'p',
        text: 'Если ответить по существу сразу не получается, напишите хотя бы короткое сообщение: «Здравствуйте, получили вашу заявку, перезвоним сегодня до 18:00». Клиент видит, что его услышали, и спокойно ждёт, а не пишет следующему.',
      },
      {
        type: 'p',
        text: `Если заявки приходят ночью и в выходные, часть работы может взять на себя бот. Он ответит на частые вопросы, соберёт контакты и предложит удобное время для звонка. Бот-консультант у нас стоит от ${p.botFaq}, а с ответами с помощью ИИ, который понимает вопросы, заданные своими словами, от ${p.botFaqAi}.`,
      },
      {
        type: 'callout',
        title: 'Бот не заменяет человека',
        text: 'В сложных вопросах клиенту по-прежнему нужен живой ответ. Задача бота в том, чтобы клиент не ждал в тишине и не уходил, пока вы заняты.',
      },
      { type: 'h2', text: 'Шаг 4. CRM или хотя бы таблица' },
      {
        type: 'p',
        text: 'Уведомление в чате легко пролистать. Поэтому каждая заявка должна попадать в список, где виден её статус: новая, в работе, договорились, отказ. На старте хватит Google Таблицы. Когда заявок становится много и с ними работают несколько человек, удобнее CRM, например amoCRM или Bitrix24.',
      },
      {
        type: 'p',
        text: 'Главное правило: ни одна заявка не остаётся без статуса и ответственного. Раз в неделю полезно открыть список и посмотреть, сколько заявок пришло, откуда и сколько из них стали клиентами. Так становится видно, какая реклама работает, а на какую деньги уходят зря.',
      },
      {
        type: 'p',
        text: `Связка сайта или бота с таблицей либо другим сервисом у нас стоит от ${p.integration}, настройка CRM под ваши продажи от ${p.crm}.`,
      },
      { type: 'h2', text: 'Шаг 5. Напоминания' },
      {
        type: 'p',
        text: 'Часть клиентов не говорит «нет». Они говорят «я подумаю» и забывают. Заведите правило: если клиент не ответил за два-три дня, ему пишут ещё раз, вежливо и по делу. Если он записан на визит, накануне ему приходит напоминание.',
      },
      {
        type: 'p',
        text: 'Это тоже можно автоматизировать. Бот сам напоминает о записи и даёт перенести её в пару нажатий, а CRM показывает менеджеру, кому пора перезвонить. Никто не держит это в голове.',
      },
      {
        type: 'cta',
        text: 'Сложите сайт, бота и автоматизацию в один набор и сразу увидите цену каждой части.',
      },
      { type: 'h2', text: 'С чего начать' },
      {
        type: 'list',
        ordered: true,
        items: [
          'Соберите все заявки в одно место и включите уведомления. Это быстро и недорого.',
          'Договоритесь, кто и как быстро отвечает, и подготовьте шаблоны ответов.',
          'Заведите таблицу со статусами. Когда она станет тесной, переходите на CRM.',
          'Добавьте напоминания и бота, который отвечает, пока вы заняты.',
        ],
      },
      {
        type: 'p',
        text: 'Внедрять всё сразу не обязательно. Даже первые два шага заметно меняют картину: вы видите каждую заявку в момент, когда она пришла. Если хотите разобрать, где теряются заявки именно у вас, напишите нам. На бесплатном созвоне посмотрим, откуда приходят клиенты, и предложим самый простой способ ничего не упускать.',
      },
    ],
  },
  en: {
    title: 'How to stop losing leads: 5 simple steps',
    description:
      'Requests get lost in messages, calls and comments. Five steps to answer faster and not forget customers, and where a bot and automation help.',
    blocks: [
      {
        type: 'p',
        text: 'Picture an ordinary day. One customer wrote on Instagram, another called while you were busy, a third left a comment under a post, a fourth messaged your employee on Telegram. In the evening you reply to the ones you remember. By then the rest have already agreed with someone else.',
      },
      {
        type: 'p',
        text: 'The ads were working and the price was fine. The requests simply got lost along the way. You can fix that without a big system or a big budget if you go step by step.',
      },
      {
        type: 'p',
        text: 'Below are five steps. The first three can be done this week at almost no cost, the last two need a few simple tools. For each step we say what you can do yourself and where a bot or automation helps.',
      },
      { type: 'h2', text: 'Step 1. One channel for every request' },
      {
        type: 'p',
        text: 'As long as requests arrive in five different places, some of them will get lost. So first decide where everything should end up. For most small businesses one work messenger, Telegram or WhatsApp, is the easiest choice: you and your staff already have it on your phones.',
      },
      {
        type: 'p',
        text: 'You do not have to give up other channels. Let customers write wherever they like. But the form on your website, your agent and, where possible, other sources should forward each request to one place, such as a shared work chat.',
      },
      {
        type: 'p',
        text: 'Start with a simple exercise: write down every place where people message or call you today. The list is usually longer than it seems: the owner’s personal number, the work number, Instagram, Telegram, the form on the site, maps. For each one, decide how a request from there gets into the shared chat, by hand or automatically.',
      },
      { type: 'h2', text: 'Step 2. Instant notifications' },
      {
        type: 'p',
        text: 'A request noticed three hours later is often already lost. So every new request should arrive as a notification right away: name, contact, what the customer needs and where they came from. Then nobody has to check email and the site admin every hour.',
      },
      {
        type: 'p',
        text: `Technically this is simple. Connecting the form on your site to a work messenger costs from ${p.siteTelegram} with us. If requests come from several services, messenger notifications as part of an automation are added from ${p.alerts}.`,
      },
      { type: 'h2', text: 'Step 3. A quick reply' },
      {
        type: 'p',
        text: 'A customer who wrote to several companies at once often picks the one that answered first and clearly. Agree in your team who replies to requests and when. Prepare reply templates for common questions: prices, address, timelines, payment. Then a reply takes a minute instead of ten.',
      },
      {
        type: 'p',
        text: 'If you cannot give a proper answer right away, send at least a short note: "Hello, we got your request and will call you back today before 6 pm". The customer sees they have been heard and waits calmly instead of writing to the next company.',
      },
      {
        type: 'p',
        text: `If requests come in at night and at weekends, a bot can take over part of the work. It answers common questions, collects contacts and offers a convenient time for a call. A FAQ bot starts from ${p.botFaq} with us, and with AI answers that understand questions asked in the customer’s own words, from ${p.botFaqAi}.`,
      },
      {
        type: 'callout',
        title: 'A bot does not replace a person',
        text: 'For complex questions a customer still needs a human answer. The bot is there so the customer is not left waiting in silence and does not leave while you are busy.',
      },
      { type: 'h2', text: 'Step 4. A CRM, or at least a spreadsheet' },
      {
        type: 'p',
        text: 'A notification in a chat is easy to scroll past. So every request should also land in a list that shows its status: new, in progress, agreed, declined. A Google Sheet is enough to start. When there are many requests and several people work on them, a CRM such as amoCRM or Bitrix24 is more convenient.',
      },
      {
        type: 'p',
        text: 'The main rule: no request is left without a status and a person responsible for it. Once a week, open the list and look at how many requests came in, from where, and how many became customers. That shows which ads work and which are wasting money.',
      },
      {
        type: 'p',
        text: `Connecting your site or bot to a spreadsheet or another service costs from ${p.integration} with us, and setting up a CRM around your sales from ${p.crm}.`,
      },
      { type: 'h2', text: 'Step 5. Reminders' },
      {
        type: 'p',
        text: 'Some customers never say "no". They say "I will think about it" and forget. Set a rule: if a customer has not replied in two or three days, someone writes to them again, politely and to the point. If they have booked a visit, they get a reminder the day before.',
      },
      {
        type: 'p',
        text: 'This can be automated too. A bot reminds people about their booking and lets them move it in a couple of taps, and the CRM shows a manager who is due a call back. Nobody has to keep it all in their head.',
      },
      {
        type: 'cta',
        text: 'Combine a website, a bot and automation into one set and see the price of each part right away.',
      },
      { type: 'h2', text: 'Where to start' },
      {
        type: 'list',
        ordered: true,
        items: [
          'Bring all requests into one place and turn on notifications. It is quick and inexpensive.',
          'Agree who replies and how fast, and prepare reply templates.',
          'Start a spreadsheet with statuses. When it gets crowded, move to a CRM.',
          'Add reminders and a bot that answers while you are busy.',
        ],
      },
      {
        type: 'p',
        text: 'You do not have to do everything at once. Even the first two steps change a lot: you see every request the moment it arrives. If you want to work out where requests get lost in your business, write to us. On a free call we will look at where your customers come from and suggest the simplest way not to miss anyone.',
      },
    ],
  },
}
