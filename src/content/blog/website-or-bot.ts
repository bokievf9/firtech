import { price as p } from './prices'
import type { Article } from './types'

export const websiteOrBot: Article = {
  slug: 'website-or-telegram-bot',
  published: true,
  date: '2026-10-16',
  ru: {
    title: 'Сайт или агент в мессенджере: что выбрать бизнесу',
    description:
      'Когда бизнесу нужен сайт, когда хватит агента в мессенджере, а когда лучше и то и другое. Разбираем на примерах кофейни, салона и магазина, с ценами.',
    blocks: [
      {
        type: 'p',
        text: 'Многие владельцы бизнеса в Таджикистане и соседних странах общаются с клиентами в основном через Telegram. Отсюда логичный вопрос: может, сайт уже не нужен и достаточно агента в мессенджере? Или наоборот, это игрушка, а серьёзному бизнесу нужен сайт?',
      },
      {
        type: 'p',
        text: 'Ответ зависит от того, откуда к вам приходят клиенты и что они должны сделать дальше. Разберём по порядку, а в конце дадим простой способ решить за пять минут.',
      },
      { type: 'h2', text: 'Чем сайт отличается от агента' },
      {
        type: 'p',
        text: 'Сайт работает как витрина. Его находят через поиск и карты, на него ведёт реклама, ссылку на него можно отправить кому угодно. Человек открывает сайт без установки чего-либо и за минуту понимает, чем вы занимаетесь, сколько это стоит и как с вами связаться.',
      },
      {
        type: 'p',
        text: 'Агент работает как администратор в мессенджере. Он отвечает на частые вопросы, записывает на удобное время, принимает заказ, напоминает о визите и присылает вам уведомление. Клиенту не нужно ничего искать: он уже в своём мессенджере, и разговор продолжается там же.',
      },
      {
        type: 'p',
        text: 'У каждого варианта есть и слабые места. Сайт сам по себе не напомнит клиенту о записи и не напишет ему об акции. Агента почти не находят через поиск, и человеку, который о вас ещё не слышал, сложно на него наткнуться. Поэтому вопрос не в том, что лучше вообще, а в том, какая задача у вас сейчас важнее.',
      },
      {
        type: 'callout',
        text: 'Если совсем коротко: сайт помогает вас найти и вам поверить, а агент помогает быстро обслужить тех, кто уже пришёл.',
      },
      { type: 'h2', text: 'Когда нужен сайт' },
      {
        type: 'list',
        items: [
          'Клиенты ищут вас в Google или Яндексе, например по запросу «ремонт кондиционеров Душанбе».',
          'Вы запускаете рекламу, и нужна страница, куда она ведёт.',
          'Вы работаете с компаниями или с клиентами из других стран, которые сначала проверяют, есть ли у вас сайт.',
          'Нужно показать много информации: примеры работ, прайс, условия, адреса филиалов.',
        ],
      },
      {
        type: 'p',
        text: `Лендинг у нас стоит от ${p.landing}, сайт компании от ${p.company}. Заявки с сайта можно сразу получать в мессенджер, это ещё от ${p.siteTelegram}.`,
      },
      { type: 'h2', text: 'Когда хватит агента' },
      {
        type: 'list',
        items: [
          'Основной поток клиентов уже идёт через Telegram: из канала, группы или по рекомендации.',
          'Вам постоянно задают одни и те же вопросы: цены, адрес, часы работы, наличие.',
          'Нужно записывать на время или принимать заказы, а администратор не успевает отвечать всем.',
          'Вы хотите писать постоянным клиентам: об акциях, новинках, свободных окнах.',
        ],
      },
      {
        type: 'p',
        text: `Агент-консультант, который отвечает на частые вопросы, стоит от ${p.botFaq}. Агент для записи и заказов от ${p.botBooking}. Рассылки по базе клиентов добавляются от ${p.broadcasts}.`,
      },
      { type: 'h2', text: 'Примеры по типам бизнеса' },
      {
        type: 'list',
        items: [
          {
            title: 'Кофейня.',
            text: 'Если гости в основном живут или работают рядом, начать стоит с агента: меню, заказ навынос к нужному времени, акции для постоянных гостей. Сайт с меню, фото и адресом пригодится, когда хочется, чтобы кофейню находили в поиске и на картах новые люди.',
          },
          {
            title: 'Салон красоты.',
            text: 'Главная задача здесь запись. Агент показывает свободное время мастеров, записывает и накануне напоминает клиенту о визите, так что меньше людей забывают прийти. Лендинг с услугами, ценами и фото работ помогает новым клиентам выбрать именно вас, особенно если вы даёте рекламу.',
          },
          {
            title: 'Магазин.',
            text: `Если товаров немного и продажи идут через Instagram или Telegram, на первых порах магазин может заменить агент с каталогом и оформлением заказа. Когда товаров становится много и нужны поиск, фильтры и оплата картой, нужен интернет-магазин: у нас от ${p.shop}. Промежуточный вариант это Telegram Mini App, магазин прямо внутри Telegram, от ${p.miniApp}.`,
          },
        ],
      },
      { type: 'h2', text: 'Когда нужны оба' },
      {
        type: 'p',
        text: 'Часто сайт и агент лучше всего работают в паре. Человек находит вас в поиске, смотрит сайт, нажимает кнопку «Записаться» и попадает к агенту, который сразу предлагает свободное время. Заявки с сайта тоже приходят туда же, поэтому все клиенты видны в одном месте, а не в пяти разных.',
      },
      {
        type: 'p',
        text: `Если заказывать сайт и агента вместе, на разовую стоимость при заказе от двух частей проекта действует скидка ${p.bundle}. Сроки при этом считаются для каждой части отдельно.`,
      },
      {
        type: 'p',
        text: 'Заказывать всё сразу не обязательно. Можно начать с одной части, а вторую добавить через пару месяцев, когда станет понятно, откуда идут клиенты. Мы с самого начала делаем так, чтобы сайт и агент потом легко соединялись.',
      },
      {
        type: 'cta',
        text: `Отметьте сайт, агента или оба, и сборка проекта покажет цену каждой части и скидку ${p.bundle} от двух частей проекта.`,
      },
      { type: 'h2', text: 'Как решить за пять минут' },
      {
        type: 'list',
        ordered: true,
        items: [
          'Вспомните, откуда пришли ваши последние 20 клиентов.',
          'Если большинство написали в Telegram или пришли по рекомендации, начните с агента.',
          'Если находят через поиск, карты или рекламу, начните с сайта.',
          'Если много времени уходит на одни и те же ответы и запись, агент снимет эту нагрузку в первую очередь.',
          'Если не уверены, начните с недорогого варианта и добавьте второе позже. Переделывать ничего не придётся: сайт и агент легко связать и потом.',
        ],
      },
      {
        type: 'p',
        text: 'Если сомневаетесь, расскажите о своём бизнесе на бесплатном созвоне. Мы честно скажем, что нужно в первую очередь, даже если это окажется самый простой и недорогой вариант.',
      },
    ],
  },
  en: {
    title: 'Website or a messenger agent: which one to choose',
    description:
      'When a business needs a website, when a messenger agent is enough and when it is better to have both. Examples for a cafe, a salon and a shop, with prices.',
    blocks: [
      {
        type: 'p',
        text: 'Many business owners in Tajikistan and nearby countries talk to customers mostly through Telegram. That raises a fair question: maybe a website is no longer needed and an agent in a messenger is enough? Or the other way round, an agent is a toy and a serious business needs a website?',
      },
      {
        type: 'p',
        text: 'The answer depends on where your customers come from and what they need to do next. We will go through it step by step and end with a simple way to decide in five minutes.',
      },
      { type: 'h2', text: 'How a website differs from an agent' },
      {
        type: 'p',
        text: 'A website works like a shop window. People find it through search and maps, ads lead to it, and you can send its link to anyone. A visitor opens it without installing anything and within a minute understands what you do, what it costs and how to reach you.',
      },
      {
        type: 'p',
        text: 'An agent works like a receptionist inside the messenger. It answers common questions, books a convenient time, takes an order, reminds about a visit and sends you a notification. The customer does not have to look for anything: they are already in their messenger, and the conversation continues there.',
      },
      {
        type: 'p',
        text: 'Each option has weak spots too. A website on its own will not remind a customer about a booking or tell them about an offer. An agent is hardly ever found through search, so someone who has never heard of you is unlikely to come across it. So the question is not which one is better in general, but which job matters more to you right now.',
      },
      {
        type: 'callout',
        text: 'In one sentence: a website helps people find you and trust you, an agent helps you serve the people who have already come.',
      },
      { type: 'h2', text: 'When you need a website' },
      {
        type: 'list',
        items: [
          'Customers look for you on Google, for example "air conditioner repair Dushanbe".',
          'You are running ads and need a page for them to lead to.',
          'You work with companies or with customers abroad who first check whether you have a website.',
          'You have a lot to show: examples of work, a price list, terms, branch addresses.',
        ],
      },
      {
        type: 'p',
        text: `A landing page with us starts from ${p.landing}, a company website from ${p.company}. Requests from the site can go straight to a messenger for another ${p.siteTelegram} and up.`,
      },
      { type: 'h2', text: 'When an agent is enough' },
      {
        type: 'list',
        items: [
          'Most of your customers already come through Telegram: from a channel, a group or word of mouth.',
          'You keep getting the same questions: prices, address, opening hours, stock.',
          'You need to book appointments or take orders, and your staff cannot keep up with every message.',
          'You want to message regular customers about offers, new products or free slots.',
        ],
      },
      {
        type: 'p',
        text: `A FAQ agent that answers common questions starts from ${p.botFaq}. A booking and orders agent starts from ${p.botBooking}. Broadcasts to your customer base are added from ${p.broadcasts}.`,
      },
      { type: 'h2', text: 'Examples by type of business' },
      {
        type: 'list',
        items: [
          {
            title: 'Cafe.',
            text: 'If most guests live or work nearby, start with an agent: the menu, takeaway orders for a set time, offers for regulars. A website with the menu, photos and address helps when you want new people to find the cafe in search and on maps.',
          },
          {
            title: 'Beauty salon.',
            text: 'The main job here is booking. An agent shows the masters’ free slots, books the customer and reminds them the day before, so fewer people forget to come. A landing page with services, prices and photos of work helps new customers pick you, especially if you run ads.',
          },
          {
            title: 'Shop.',
            text: `If you have a small range and sell through Instagram or Telegram, an agent with a catalogue and checkout can replace a shop at first. When the range grows and you need search, filters and card payments, you need an online store: from ${p.shop} with us. A middle option is a Telegram Mini App, a shop right inside Telegram, from ${p.miniApp}.`,
          },
        ],
      },
      { type: 'h2', text: 'When you need both' },
      {
        type: 'p',
        text: 'Often a website and an agent work best as a pair. Someone finds you in search, looks at the site, taps "Book a visit" and lands with the agent, which offers free slots right away. Requests from the site arrive in the same place, so every customer is in one place instead of five.',
      },
      {
        type: 'p',
        text: `If you order a website and an agent together, an order from two parts of the project gets ${p.bundle} off the one-time price. Timelines are still counted for each part separately.`,
      },
      {
        type: 'p',
        text: 'You do not have to order everything at once. You can start with one part and add the other a couple of months later, once it is clear where customers come from. We build from the start so that the site and the agent are easy to connect later.',
      },
      {
        type: 'cta',
        text: `Pick a website, an agent or both, and the project builder shows the price of each part and the ${p.bundle} discount from two parts of the project.`,
      },
      { type: 'h2', text: 'How to decide in five minutes' },
      {
        type: 'list',
        ordered: true,
        items: [
          'Think about where your last 20 customers came from.',
          'If most of them wrote in Telegram or came by recommendation, start with an agent.',
          'If they found you through search, maps or ads, start with a website.',
          'If a lot of time goes into the same answers and bookings, an agent takes that load off first.',
          'If you are not sure, start with the cheaper option and add the other later. Nothing has to be redone: a site and an agent are easy to connect afterwards.',
        ],
      },
      {
        type: 'p',
        text: 'If you are still unsure, tell us about your business on a free call. We will honestly say what you need first, even if it turns out to be the simplest and cheapest option.',
      },
    ],
  },
}
