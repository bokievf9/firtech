import en from '../en'
import ru from '../ru'
import { price as p } from './prices'
import type { Article } from './types'

const ruTerm = ru.estimator.catalog.websites.variants
const enTerm = en.estimator.catalog.websites.variants

export const websiteCost2026: Article = {
  slug: 'website-cost-2026',
  published: false,
  date: '2026-10-16',
  ru: {
    title: 'Сколько стоит сайт для малого бизнеса в 2026 году',
    description:
      'Из чего складывается цена сайта, сколько у нас стоят лендинг, сайт компании и магазин, как работают фиксированная смета и оплата по этапам и как не переплатить.',
    blocks: [
      {
        type: 'p',
        text: 'Вопрос «сколько стоит сайт» похож на вопрос «сколько стоит ремонт». Ответ зависит от того, что именно нужно сделать. Одному бизнесу хватит страницы с ценами и кнопкой «Записаться», другому нужен каталог на сотни товаров с оплатой картой. Цена этих двух проектов может отличаться в разы, и это нормально.',
      },
      {
        type: 'p',
        text: 'Ниже разберём, из чего складывается стоимость, сколько стоят разные форматы у нас в Fir Tech и как заказать сайт так, чтобы не платить за лишнее.',
      },
      { type: 'h2', text: 'Что влияет на цену' },
      {
        type: 'p',
        text: 'Почти всегда стоимость определяют пять вещей. Если понимать их заранее, разговор с любым исполнителем будет короче и честнее.',
      },
      {
        type: 'list',
        items: [
          {
            title: 'Тип сайта.',
            text: 'Лендинг, сайт компании и интернет-магазин требуют разного объёма работы. Лендинг это одна страница, которая рассказывает об услуге и собирает заявки. Сайт компании состоит из нескольких разделов: услуги, цены, о компании, контакты. Магазину нужны каталог, корзина и оформление заказа.',
          },
          {
            title: 'Количество страниц.',
            text: 'Каждую страницу нужно продумать, сверстать и проверить на телефоне. Десять одинаковых карточек услуг делаются быстрее, чем десять разных страниц со своей структурой.',
          },
          {
            title: 'Языки.',
            text: 'Второй язык это не только перевод текстов. Нужны переключатель, отдельные адреса страниц для поисковиков и проверка, что длинные слова не ломают вёрстку.',
          },
          {
            title: 'Онлайн-оплата.',
            text: 'Подключение платёжной системы, обработка успешных и неудачных платежей, уведомления о заказе. Это отдельная работа, и в ней важна аккуратность.',
          },
          {
            title: 'Панель для правок.',
            text: 'Если вы хотите сами менять цены, тексты и фото, нужна админ-панель. Без неё каждое изменение идёт через разработчика.',
          },
        ],
      },
      {
        type: 'p',
        text: 'Дизайн тоже влияет на цену, но меньше, чем кажется. Аккуратный современный дизайн на продуманной сетке стоит разумно. Дорого становится, когда для каждого блока рисуют уникальные иллюстрации и сложные анимации. Малому бизнесу это нужно редко: клиенту важнее быстро понять, что вы предлагаете, и связаться с вами.',
      },
      { type: 'h2', text: 'Наши стартовые цены' },
      {
        type: 'p',
        text: 'Цены у нас открытые и одинаковые для всех. Вот с чего начинаются основные форматы:',
      },
      {
        type: 'list',
        items: [
          { title: `Лендинг: от ${p.landing}.`, text: `Срок обычно ${ruTerm.landing.term}.` },
          { title: `Сайт компании: от ${p.company}.`, text: `Срок ${ruTerm.company.term}.` },
          { title: `Интернет-магазин: от ${p.shop}.`, text: `Срок ${ruTerm.shop.term}.` },
        ],
      },
      { type: 'p', text: 'Дополнительные функции добавляются к базовой цене:' },
      {
        type: 'list',
        items: [
          `Второй язык: от ${p.language}.`,
          `Заявки в Telegram: от ${p.siteTelegram}.`,
          `Онлайн-оплата: от ${p.sitePayments}.`,
          `Панель для правок: от ${p.cms}.`,
        ],
      },
      {
        type: 'p',
        text: `Например, лендинг для салона на двух языках, где заявки сразу приходят в Telegram, начинается от ${p.landingTwoLangTelegram}. Слово «от» здесь важно: это нижняя граница. Если в проекте есть сложные детали, например нестандартный расчёт стоимости или связь с вашей учётной программой, цена будет выше. Насколько выше, вы узнаете до начала работы, а не в процессе.`,
      },
      {
        type: 'cta',
        text: 'Отметьте нужный формат и функции, и конструктор сразу покажет примерную цену и срок.',
      },
      { type: 'h2', text: 'Как работает фиксированная смета' },
      {
        type: 'p',
        text: 'Самый неприятный сценарий при заказе сайта такой: договорились об одной сумме, а в конце выясняется, что «это не входило» и нужно доплатить. Чтобы так не было, мы работаем по смете.',
      },
      {
        type: 'p',
        text: 'Сначала короткий бесплатный созвон на 30 минут: разбираемся, что нужно бизнесу. Потом пишем смету, где указаны цена, срок и полный список работ. Всё, что попало в смету, делаем за эту сумму. Если по ходу появляется новая идея, оцениваем её отдельно, и в работу она идёт только с вашего согласия.',
      },
      { type: 'h2', text: 'Оплата по этапам' },
      {
        type: 'p',
        text: 'Платить всю сумму вперёд незнакомому исполнителю рискованно, и мы это понимаем. Поэтому работа делится на этапы. Первый платёж после подписания сметы, следующий после того, как вы посмотрели и приняли этап. Каждую неделю мы показываем, что уже сделано, так что вы платите за то, что видите.',
      },
      {
        type: 'callout',
        title: 'Проект остаётся вашим',
        text: 'Код, домен и доступы оформляем на вас. Если решите перейти к другому исполнителю, заберёте проект целиком.',
      },
      { type: 'h2', text: 'Как не переплатить' },
      {
        type: 'list',
        ordered: true,
        items: [
          {
            title: 'Начните с малого.',
            text: 'Если вы не уверены, что сайт принесёт клиентов, начните с лендинга. Позже его можно расширить до полноценного сайта, и сделанная работа не пропадёт.',
          },
          {
            title: 'Не заказывайте функции «на будущее».',
            text: 'Личный кабинет, блог и онлайн-оплата нужны не всем. Добавьте их, когда появится реальная потребность.',
          },
          {
            title: 'Подготовьте материалы.',
            text: 'Тексты, фото, цены и контакты, собранные заранее, экономят время. Если чего-то нет, поможем, но лучше обсудить это сразу.',
          },
          {
            title: 'Просите смету письменно.',
            text: 'Устная договорённость «примерно столько-то» ничего не гарантирует. В смете должен быть список работ, а не только итоговая сумма.',
          },
          {
            title: 'Спросите, что будет после запуска.',
            text: `Кто исправляет ошибки, сколько стоит поддержка, на кого оформлен домен. У нас первый месяц исправления бесплатные, дальше поддержка по подписке от ${p.support} в месяц или разовые задачи.`,
          },
        ],
      },
      { type: 'h2', text: 'Коротко' },
      {
        type: 'p',
        text: `Цена сайта зависит от типа, количества страниц, языков, оплаты и панели для правок. У нас лендинг стоит от ${p.landing}, сайт компании от ${p.company}, интернет-магазин от ${p.shop}. Цену и срок фиксируем в смете до старта, а платите вы по этапам. Если вместе с сайтом нужен Telegram-бот или автоматизация, на комплекс из двух частей и больше действует скидка ${p.bundle}.`,
      },
      {
        type: 'p',
        text: 'Чтобы прикинуть стоимость своего проекта, соберите его в конструкторе или напишите нам: на созвоне подскажем, какой формат подойдёт именно вам.',
      },
    ],
  },
  en: {
    title: 'How much does a small business website cost in 2026',
    description:
      'What drives the price of a website, what a landing page, a company site and an online store cost with us, how a fixed quote and staged payment work, and how not to overpay.',
    blocks: [
      {
        type: 'p',
        text: 'Asking "how much does a website cost" is a lot like asking "how much does a renovation cost". The answer depends on what needs to be done. One business is fine with a single page of prices and a "Book now" button, another needs a catalogue of hundreds of products with card payments. Those two projects can differ in price several times over, and that is normal.',
      },
      {
        type: 'p',
        text: 'Below we go through what the price is made of, what the different formats cost at Fir Tech and how to order a website without paying for things you do not need.',
      },
      { type: 'h2', text: 'What drives the price' },
      {
        type: 'p',
        text: 'Almost always, five things decide the cost. If you know them in advance, the conversation with any developer gets shorter and more honest.',
      },
      {
        type: 'list',
        items: [
          {
            title: 'Type of site.',
            text: 'A landing page, a company website and an online store take different amounts of work. A landing page is one page that explains your service and collects requests. A company site has several sections: services, prices, about, contacts. A shop needs a catalogue, a cart and a checkout.',
          },
          {
            title: 'Number of pages.',
            text: 'Every page has to be planned, built and checked on a phone. Ten similar service cards are quicker to make than ten different pages, each with its own structure.',
          },
          {
            title: 'Languages.',
            text: 'A second language is more than translated text. It needs a switcher, separate page addresses for search engines and a check that long words do not break the layout.',
          },
          {
            title: 'Online payments.',
            text: 'Connecting a payment provider, handling successful and failed payments, order notifications. This is separate work, and it has to be done carefully.',
          },
          {
            title: 'Editing panel.',
            text: 'If you want to change prices, texts and photos yourself, you need an admin panel. Without one, every change goes through a developer.',
          },
        ],
      },
      {
        type: 'p',
        text: 'Design affects the price too, but less than people expect. A clean, modern design on a well planned grid costs a reasonable amount. It gets expensive when every block gets unique illustrations and complex animations. A small business rarely needs that: what matters more is that a customer quickly understands what you offer and can contact you.',
      },
      { type: 'h2', text: 'Our starting prices' },
      {
        type: 'p',
        text: 'Our prices are public and the same for everyone. This is where the main formats start:',
      },
      {
        type: 'list',
        items: [
          { title: `Landing page: from ${p.landing}.`, text: `Usually ${enTerm.landing.term}.` },
          { title: `Company website: from ${p.company}.`, text: `${enTerm.company.term}.` },
          { title: `Online store: from ${p.shop}.`, text: `${enTerm.shop.term}.` },
        ],
      },
      { type: 'p', text: 'Extra features are added to the base price:' },
      {
        type: 'list',
        items: [
          `Second language: from ${p.language}.`,
          `Requests sent to Telegram: from ${p.siteTelegram}.`,
          `Online payments: from ${p.sitePayments}.`,
          `Editing panel: from ${p.cms}.`,
        ],
      },
      {
        type: 'p',
        text: `For example, a landing page for a salon in two languages, with requests going straight to Telegram, starts from ${p.landingTwoLangTelegram}. The word "from" matters here: it is the lower bound. If a project has complex parts, such as a custom price calculation or a link to your accounting software, the price will be higher. You will know how much higher before work starts, not halfway through.`,
      },
      {
        type: 'cta',
        text: 'Pick the format and features you need, and the builder shows an approximate price and timeline right away.',
      },
      { type: 'h2', text: 'How a fixed quote works' },
      {
        type: 'p',
        text: 'The worst way to order a website goes like this: you agree on one amount, and at the end it turns out that "this was not included" and you have to pay more. To avoid that, we work from a written quote.',
      },
      {
        type: 'p',
        text: 'First comes a short free 30 minute call where we work out what the business needs. Then we write a quote with the price, the timeline and the full list of work. Everything in the quote is done for that amount. If a new idea comes up along the way, we price it separately, and it goes ahead only with your agreement.',
      },
      { type: 'h2', text: 'Paying in stages' },
      {
        type: 'p',
        text: 'Paying the full amount upfront to a developer you do not know yet is risky, and we understand that. So the work is split into stages. The first payment comes after you sign the quote, the next one after you have reviewed and accepted a stage. We show progress every week, so you pay for what you can see.',
      },
      {
        type: 'callout',
        title: 'The project stays yours',
        text: 'Code, domain and accounts are registered in your name. If you decide to move to another developer, you take the whole project with you.',
      },
      { type: 'h2', text: 'How not to overpay' },
      {
        type: 'list',
        ordered: true,
        items: [
          {
            title: 'Start small.',
            text: 'If you are not sure a website will bring customers, start with a landing page. It can grow into a full site later, and the work already done is not wasted.',
          },
          {
            title: 'Do not order features "for the future".',
            text: 'Customer accounts, a blog and online payments are not for everyone. Add them when there is a real need.',
          },
          {
            title: 'Prepare your materials.',
            text: 'Texts, photos, prices and contacts gathered in advance save time. If something is missing we can help, but it is better to discuss it early.',
          },
          {
            title: 'Ask for the quote in writing.',
            text: 'A spoken "roughly this much" guarantees nothing. A quote should list the work, not only the total.',
          },
          {
            title: 'Ask what happens after launch.',
            text: `Who fixes bugs, what support costs, whose name the domain is in. With us, fixes are free for the first month, then there is monthly support from ${p.support} a month or one-off tasks.`,
          },
        ],
      },
      { type: 'h2', text: 'In short' },
      {
        type: 'p',
        text: `The price of a website depends on its type, the number of pages, languages, payments and an editing panel. With us a landing page starts from ${p.landing}, a company website from ${p.company} and an online store from ${p.shop}. We fix the price and timeline in the quote before we start, and you pay in stages. If you need a Telegram bot or automation along with the site, a bundle of two parts or more gets ${p.bundle} off.`,
      },
      {
        type: 'p',
        text: 'To get a feel for what your project costs, put it together in the builder or write to us: on a call we will suggest the format that fits you.',
      },
    ],
  },
}
