import { notFoundText } from './not-found'
import type { Dict } from './ru'

const en: Dict = {
  langName: 'English',
  meta: {
    title: 'Fir Tech: AI agents for business, Telegram bots and websites',
    description:
      'AI agents for business: a Telegram booking bot, lead intake 24/7, automation for small business and websites. We work with companies in Tashkent, Almaty, Dushanbe and Bishkek. Prices in US dollars, fixed before we start.',
  },
  nav: {
    services: 'Services',
    examples: 'Examples',
    pricing: 'Pricing',
    process: 'Process',
    faq: 'FAQ',
    builder: 'Builder',
    cta: 'Discuss a project',
    menu: 'Menu',
    close: 'Close',
    home: 'Home',
  },
  hero: {
    title: 'AI agents that work 24/7 in place of an employee',
    // The h1 in three lines; the middle one is the accent.
    lines: ['AI agents', 'that work 24/7', 'in place of an employee'],
    sub: 'They take leads, book clients and keep reports. We build agents, bots and websites for small business.',
    primary: 'Estimate the cost',
    telegram: 'Message on Telegram',
    trust: ['Price fixed in the quote', 'Pay in stages', 'Code and access are yours'],
    scroll: 'Scroll',
    picker: {
      title: 'What does your business need?',
      hint: 'Pick one or several',
      total: 'Price guide',
      bundle: '-10% for a bundle',
      empty: 'Pick at least one and we will show the price and timeline',
      build: 'Build it in full',
      concept: 'Example mockup',
    },
    demo: {
      caption: 'Lead automation in action: your website, Telegram and CRM working together.',
      site: 'Website',
      siteTitle: 'Website enquiry',
      name: 'Madina Rakhimova',
      task: 'Need a website for a coffee shop',
      send: 'Send',
      sent: 'Sent',
      bot: 'Fir Tech Bot',
      botNew: 'New lead',
      botName: 'Name',
      botTask: 'Request',
      botTime: 'just now',
      crm: 'CRM',
      crmLead: 'Coffee shop website',
      crmNew: 'New',
      crmWork: 'In progress',
      crmManager: 'Manager assigned',
    },
  },
  services: {
    title: 'Websites, bots and apps',
    sub: 'The foundation the agents run on. Order one, or connect them all.',
    from: 'from',
    more: 'Learn more',
    items: {
      websites: {
        name: 'Websites',
        short:
          'Landing pages, company websites and online stores. Fast, easy to use on a phone, with an enquiry form.',
        tags: ['Landing page', 'Company site', 'Store'],
      },
      bots: {
        name: 'Telegram bots',
        short: 'Take orders, book clients and answer questions while you focus on other work.',
        tags: ['Bookings', 'Orders', 'Mini App'],
      },
      apps: {
        name: 'Apps',
        short: 'Web and mobile apps, customer accounts and internal tools for your team.',
        tags: ['iOS and Android', 'PWA', 'Accounts'],
      },
      automation: {
        name: 'Automation and AI',
        short:
          'We connect your website, Telegram, CRM and spreadsheets so routine work runs itself.',
        tags: ['CRM', 'Integrations', 'AI assistant'],
      },
    },
    chat: {
      user: "I'd like a haircut on Saturday",
      bot: 'Free slots: 11:00, 14:30 and 17:00. Which works for you?',
      pick: '14:30',
      done: 'Booked. See you on Saturday at 14:30',
    },
  },
  directions: {
    title: 'Agents and bots that take the routine off your hands',
    sub: 'Pick a direction. We show how it would work for you and name the price and deadline before we start.',
    from: 'from',
    perMonth: 'per month',
    perPerson: 'per person',
    team: 'per team',
    support: 'support per month',
    before: 'Before',
    after: 'After',
    discuss: 'Discuss',
    more: 'Learn more',
    items: {
      admin: {
        title: 'Booking bot',
        lines: [
          'Books clients in Telegram, reminds them about the visit and asks for a review afterwards.',
          'You stop answering "do you have time on Friday?" by hand.',
        ],
        before: 'Bookings in a notebook, some clients forget to come',
        after: 'The bot books and reminds a day and an hour ahead',
      },
      receptionist: {
        title: 'AI lead receptionist',
        lines: [
          'Answers in Telegram, WhatsApp and Instagram at any hour of the day.',
          'Clarifies the request with the client and hands the manager a ready lead with contacts.',
        ],
        before: 'Night messages wait until morning and go cold',
        after: 'The client gets an answer in a minute, the manager sees the lead',
      },
      automation: {
        title: 'Routine automation',
        lines: [
          'We connect Google Sheets, your CRM and messengers so data moves by itself.',
          'Reports and mailings go out on a schedule.',
        ],
        before: 'The weekly report is assembled by hand on Friday evening',
        after: 'The report arrives in your chat on its own, on time',
      },
      content: {
        title: 'Content by subscription',
        lines: [
          'Posts, product cards and short videos come out on an agreed plan.',
          'You approve the material in Telegram, we do the rest.',
        ],
        before: 'The page is silent for weeks, nobody has time for topics',
        after: 'Content goes out on plan, you only approve it',
      },
      miniapp: {
        title: 'Telegram Mini App',
        lines: [
          'A shop, booking or loyalty program right inside Telegram.',
          'The client does not install an app or sign up.',
        ],
        before: 'A catalog of photos and orders through direct messages',
        after: 'Catalog, cart and payment in one Telegram window',
      },
      agent: {
        title: 'Personal agent',
        lines: [
          'Your own AI assistant in the spirit of Dono: it tracks tasks, deadlines and email.',
          'Fits students, freelancers and business owners.',
        ],
        before: 'Deadlines and emails are scattered across five places',
        after: 'The agent puts everything in one list and reminds you in Telegram',
      },
      implementation: {
        title: 'AI rollout in your company',
        lines: [
          'We build a knowledge base from your documents, and AI answers staff and clients from it.',
          'We show the team how to use it every day.',
        ],
        before: 'A newcomer spends a week searching chats and folders',
        after: 'They ask the AI and get an answer with a link to the document',
      },
      training: {
        title: 'Training',
        lines: [
          'A workshop on putting agents into your business, built on your real tasks.',
          'Available for one person or for a whole team.',
        ],
        before: 'You have heard a lot about AI and have no idea where to start',
        after: 'By the end you have a working agent for your task',
      },
      site: {
        title: 'Websites and landing pages',
        lines: [
          'The base for everything above: a page that ads point to and leads come from.',
          'Fast, comfortable on a phone, with an enquiry form straight into Telegram.',
        ],
        before: 'Ads lead to Instagram, where there is no price or booking',
        after: 'A landing page with prices and a form, leads go straight to Telegram',
      },
    },
  },
  dono: {
    title: 'How we build agents',
    sub: 'An example: Dono, a study assistant for students. The same principle works for your leads, bookings and reports.',
    steps: [
      {
        title: 'Connect the sources',
        text: 'Dono watches deadlines in Moodle and messages in email.',
      },
      {
        title: 'Put it in the calendar',
        text: 'Every task gets a date in the calendar, and clashes are visible at once.',
      },
      {
        title: 'Remind in Telegram',
        text: 'A reminder arrives in advance and again on the day it is time to start.',
      },
      {
        title: 'Prepare for exams',
        text: 'Builds a summary of the topic and quizzes you while you revise.',
      },
    ],
    flow: { sources: 'Moodle and email', agent: 'Dono', outputs: 'Calendar and Telegram' },
    exampleLabel: 'Sample reminder',
    example:
      'Tomorrow at 10:00 the economics essay is due. The draft is there, the conclusion is missing. Block an hour tonight?',
    note: 'A schematic and a neutral example: we do not show students’ personal data on the site.',
    ctaTitle: 'Need an agent like this?',
    agentLink: 'Personal agent',
    receptionistLink: 'AI lead receptionist for business',
  },
  region: {
    title: 'We work with companies in Tashkent, Almaty, Dushanbe and Bishkek',
    sub: 'We communicate in Russian or English and take payment the way that suits you. All prices on the site are in US dollars.',
    cities: ['Tashkent', 'Almaty', 'Dushanbe', 'Bishkek'],
    payTitle: 'Ways to pay',
    pay: ['Bank cards', 'Kaspi', 'Payme and Click', 'USDT'],
  },
  extras: {
    title: 'We also do',
    sub: 'Smaller jobs, and the things that help an existing website or bot bring in more leads and money.',
    group: 'Other services',
    onCall: 'Priced after a call',
    perMonth: '/mo',
    discuss: 'Discuss',
    more: 'Details',
    items: {
      ai: {
        name: 'AI assistant for customers',
        short:
          'Answers customers on Telegram, Instagram and WhatsApp around the clock, takes requests and hands them to a manager. Speaks Russian, Tajik and English.',
      },
      support: {
        name: 'Support subscription',
        short:
          'Hosting, backups, updates and small edits every month. Your website or bot just works, and you never hunt for someone to fix it.',
      },
      payments: {
        name: 'Online payments',
        short:
          'We add payments to your website and bot: local payment systems and bank cards, and Stripe for customers abroad.',
      },
      seo: {
        name: 'Maps, SEO and analytics',
        short:
          'We put your business on Google Maps and Yandex Maps and set up search and analytics, so you can see where customers come from.',
      },
      crm: {
        name: 'CRM setup',
        short:
          'We set up amoCRM or Bitrix24 around your sales, move your customer base over and train your team.',
      },
      design: {
        name: 'Design and brand identity',
        short:
          'Logo, colours, fonts and layouts, so your business looks the same on the website, in social media and on the sign.',
      },
      rescue: {
        name: 'Fixing other teams’ projects',
        short:
          'Website broken and the previous developer gone? We will dig into the code, fix it and finish the job.',
      },
      internal: {
        name: 'Internal systems',
        short:
          'Stock, order tracking, a staff portal. Everything in one place instead of a dozen spreadsheets and chats.',
      },
    },
  },
  builder: {
    metaTitle: 'Project builder: put together a website, bot and automation',
    metaDescription:
      'Build your project from ready blocks and see the price and timeline right away. 10% off any bundle of two parts or more.',
    eyebrow: 'Builder',
    title: 'Build your project',
    sub: 'Pick what your business needs and see right away how it could look and what it costs. 10% off any bundle of two parts or more.',
    steps: ['Business', 'Goal', 'What we build', 'Features', 'Style', 'Details', 'Summary'],
    back: 'Back',
    next: 'Next',
    kindTitle: 'What does your business do?',
    kindSub: 'We will suggest a starting set. You can change it any way you like.',
    kindOther: 'We start from a blank page',
    kinds: {
      cafe: 'Cafe or restaurant',
      salon: 'Salon or bookings',
      shop: 'Shop',
      delivery: 'Delivery',
      services: 'Services and B2B',
      other: 'Something else',
    },
    partsTitle: 'What we build',
    partsSub: 'Pick one or several. Choose a format for each part.',
    featuresTitle: 'Features',
    featuresSub: 'Tick what each part should be able to do.',
    extrasTitle: 'Extras',
    summaryTitle: 'Your build',
    pickOne: 'Pick at least one part',
    subtotal: 'Subtotal',
    discount: 'Bundle discount 10%',
    total: 'Total',
    perMonth: '/mo',
    monthlyNote: 'Support is paid separately, every month.',
    termsNote:
      'Timelines are per part. We will give the exact overall timeline in the quote: some work can run in parallel.',
    payNote: 'You pay in stages, for each stage separately.',
    note: 'This is a rough estimate. We fix the exact price in the quote after a short call.',
    send: 'Send my build',
    copy: 'Copy link',
    copied: 'Link copied',
    leadService: 'Bundle project',
    previewLabel: 'How it could look',
    empty: 'Pick what to build and the mockup will start coming together',
    entry: 'Need several services at once? Put your project together in the builder',
    download: 'Download estimate (PDF)',
    pdf: {
      title: 'Estimate as PDF',
      text: 'Leave your name and a contact and the estimate opens right away. You can save it and show it to a partner. If you have questions about it, we will answer, and the decision stays yours.',
      submit: 'Get the estimate',
      ready: 'Your estimate is ready',
      open: 'Open the estimate',
      free: 'The builder and the build link work without any contacts.',
      // Goes into the owner's Telegram message, which is always in Russian.
      leadNote: 'Запросил смету в PDF из конструктора',
    },
    stepLabel: 'Step',
    of: 'of',
    intro: 'Seven short steps. The price and the mockup update as you go.',
    enterHint: 'Enter for next',
    showPreview: 'Show mockup',
    hidePreview: 'Hide mockup',
    close: 'Close',
    optional: 'Optional',
    noPrice: 'Does not change the price',
    goalsTitle: 'What should the project achieve?',
    goalsSub:
      'Pick as many as you like. It tells us where to put the focus. The price stays the same.',
    goals: {
      leads: { name: 'Leads', hint: 'Customers leave their contacts, you call back' },
      sales: { name: 'Online sales', hint: 'Order and pay without calls or chats' },
      booking: { name: 'Bookings', hint: 'Customers pick a free slot themselves' },
      routine: {
        name: 'Less routine',
        hint: 'Requests, reports and reminders without manual work',
      },
      brand: { name: 'Awareness', hint: 'The business looks solid and is easy to find' },
    },
    channelsTitle: 'Where customers look for you',
    channels: {
      instagram: 'Instagram',
      telegram: 'Telegram',
      search: 'Google and Yandex',
      word: 'Word of mouth',
    },
    partInside: 'Inside',
    partTerm: 'Timeline',
    formatTitle: 'Format',
    variantHints: {
      websites: {
        landing: 'One page: the offer, the benefits and a request form',
        company: 'Several pages: services, about, contacts',
        shop: 'Catalog, cart and checkout',
      },
      bots: {
        faq: 'Answers common questions and collects requests',
        booking: 'Bookings and orders right in the chat',
        miniapp: 'A storefront or menu inside Telegram',
      },
      apps: {
        pwa: 'Opens in the browser and installs on the phone',
        internal: 'Records, tasks and data for your team',
        mobile: 'An app in the App Store and Google Play',
      },
      automation: {
        integration: 'For example, website requests straight to Telegram and a sheet',
        crm: 'Sales pipeline, customer base and manager tasks',
        assistant: 'Answers customers and passes requests to a manager',
      },
    },
    addonHints: {
      websites: {
        language: 'A second language version of every page',
        telegram: 'Every request from the site lands in your Telegram',
        payments: 'Card payments right on the site',
        cms: 'Change texts, prices and photos yourself',
      },
      bots: {
        payments: 'Customers pay without leaving the chat',
        broadcasts: 'Deals and news to every subscriber',
        admin: 'Orders, bookings and customers in one panel',
        ai: 'The bot understands free-form questions and replies',
      },
      apps: {
        accounts: 'Sign-in, order history and customer data',
        payments: 'Card payments inside the app',
        push: 'Reminders and order status on the lock screen',
        admin: 'Manage content, orders and users',
      },
      automation: {
        sheets: 'Numbers fill a spreadsheet by themselves',
        alerts: 'Important events arrive in Telegram at once',
        training: 'We show your team how to use it all',
        support: 'Three months of keeping it all running',
      },
    },
    extraHints: {
      support: 'Hosting, backups and small edits every month',
      seo: 'Google and Yandex Maps, search and analytics',
      design: 'Logo, colours and fonts for every channel',
    },
    styleTitle: 'Which style feels right?',
    styleSub:
      'The mockup changes right away. It is a starting point for the designer and does not change the price.',
    looksTitle: 'Mood',
    looks: {
      minimal: { name: 'Minimal', hint: 'Lots of air, thin lines' },
      bold: { name: 'Bold', hint: 'Big type, bright accents' },
      premium: { name: 'Premium', hint: 'Restrained, precise, upscale' },
      friendly: { name: 'Friendly', hint: 'Soft shapes, warm tone' },
      tech: { name: 'Tech', hint: 'Clear grid, precise details' },
    },
    accentTitle: 'Accent colour',
    accents: {
      lime: 'Lime',
      mint: 'Mint',
      sky: 'Sky',
      violet: 'Violet',
      coral: 'Coral',
      amber: 'Amber',
      rose: 'Rose',
      mono: 'Mono',
    },
    themeTitle: 'Theme',
    themes: { dark: 'Dark', light: 'Light' },
    fontTitle: 'Type',
    fonts: {
      strict: { name: 'Strict', hint: 'Clean sans serif' },
      soft: { name: 'Soft', hint: 'Calm serif' },
      bold: { name: 'Expressive', hint: 'Dense and large' },
    },
    sampleTitle: 'Your business',
    sampleCta: 'Contact',
    detailsTitle: 'Project details',
    detailsSub:
      'All optional, but it makes the quote more precise. Only the website languages change the price here.',
    pagesTitle: 'How many pages or sections',
    pagesHint: 'A rough number, for reference. Does not change the price.',
    pagesUnit: 'pages',
    pagesUnset: 'Not set',
    langsTitle: 'Languages',
    langs: { ru: 'Русский', en: 'English', tj: 'Тоҷикӣ', uz: 'Oʻzbekcha' },
    langsPaid: 'Two or more languages add the website option "Second language" to the quote',
    langsMore:
      'A third language and more we discuss on the call, they are not in the quote yet.',
    langsFree:
      'There is no website in the build, so languages are a note and do not change the price.',
    hasTitle: 'What you already have',
    has: { logo: 'Logo', texts: 'Texts', photos: 'Photos', domain: 'Domain', hosting: 'Hosting' },
    examplesTitle: 'Websites you like',
    examplesHint: 'Up to two links',
    examplePlaceholder: 'example.com',
    exampleInvalid: 'This does not look like a link',
    deadlineTitle: 'When you need it',
    deadlines: { asap: 'As soon as possible', month: 'Within a month', relaxed: 'No rush' },
    deadlineNote: 'Timelines in the quote are still per part.',
    wishTitle: 'Wishes',
    wishPlaceholder: 'For example: we need a menu section with city delivery',
    summarySub:
      'Check that everything is right and send the build. We will come back with a quote.',
    quoteTitle: 'Price',
    styleLabel: 'Style',
    goalsLabel: 'Goals',
    channelsLabel: 'Customers look in',
    detailsLabel: 'Details',
    pagesLabel: 'Pages',
    langsLabel: 'Languages',
    hasLabel: 'Already have',
    examplesLabel: 'Examples',
    deadlineLabel: 'Deadline',
    wishLabel: 'Wishes',
    edit: 'Edit',
    nothingYet: 'Not set yet',
    actionsTitle: 'What next',
    estimate: {
      metaTitle: 'Project estimate | Fir Tech',
      title: 'Project estimate',
      date: 'Date',
      save: 'Save as PDF',
      saveHint: 'In the print dialog, choose "Save as PDF".',
      back: 'Back to the builder',
      service: 'Service',
      format: 'Format and features',
      term: 'Timeline',
      price: 'Price',
      extras: 'Extras',
      support: 'Support',
      notesTitle: 'Terms',
      link: 'Build online',
      linkHint: 'Open the link to change the build or send it to us.',
      contacts: 'Contacts',
      site: 'Website',
      telegram: 'Telegram',
      emptyTitle: 'Build not found',
      emptyText:
        'The link is empty or out of date. Put your project together in the builder, it takes a couple of minutes, and download the estimate from there.',
      emptyCta: 'Open the builder',
    },
    preview: {
      headline: 'Everything your customers need',
      url: 'your-business.com',
      brand: 'Your business',
      cta: 'Get in touch',
      buy: 'Add to cart',
      pay: 'Pay',
      toTelegram: 'Request sent to Telegram',
      edit: 'Edit',
      bot: 'Bot',
      botFaq: 'How much is delivery?',
      botFaqAnswer: 'Free in the city from $15',
      botBook: 'Book for Saturday',
      botMenu: 'Menu',
      ai: 'AI replies',
      broadcast: 'Broadcast: deal of the week',
      admin: 'Admin',
      app: 'App',
      push: 'Your order is on its way',
      account: 'Your account',
      crm: ['New', 'In progress', 'Done'],
      sheets: 'Report in Sheets',
      alerts: 'Alert in Telegram',
      assistant: 'AI answers customers',
      training: 'Team training',
      support: 'On support',
      seo: 'On maps and in search',
      design: 'Brand identity',
    },
  },
  stack: {
    label: 'We work with the services and technologies your business already runs on',
  },
  solutions: {
    metaTitle: 'Solutions for small business: cafes, salons, shops, delivery and services',
    metaDescription:
      'Ready starting sets for your kind of business: website, Telegram bot, online booking, online store, Mini App and CRM. Contents, price and timing on one page.',
    eyebrow: 'Solutions',
    title: 'Solutions for your business',
    sub: 'Starting sets for the businesses that come to us most often. Each one shows the problems it solves, what is included, what it costs and how it could look.',
    nav: 'Solutions',
    all: 'All solutions',
    more: 'Learn more',
    from: 'from',
    startSet: 'Starting set',
    otherTitle: 'Your business is not listed?',
    otherText:
      'Put a project together from any parts in the builder, or describe the task and we will suggest the set.',
    otherCta: 'Open the builder',
    builderLink: 'Ready solutions for cafes, salons, shops, delivery and services',
    cta: 'Build this project',
    discuss: 'Discuss',
    problemsTitle: 'What usually gets in the way, and how we solve it',
    problemLabel: 'Now',
    fixLabel: 'How we solve it',
    setTitle: 'What the starting set includes',
    setSub:
      'This is a starting point. In the builder you can remove what you do not need or add more, and the price updates right away.',
    term: 'Timing',
    previewLabel: 'How it could look',
    concept: 'Concept',
    previewNote:
      'This is a concept for illustration, not client work. The design is made for your business.',
    faqTitle: 'FAQ',
    othersTitle: 'Other solutions',
    items: {
      cafe: {
        metaTitle: 'Website and Telegram bot for a cafe or restaurant',
        metaDescription:
          'A website with the menu, table bookings and orders in a Telegram bot, payment in the bot and a place on the maps. Price and timing of the starting set for a cafe or restaurant.',
        title: 'Website and Telegram bot for a cafe or restaurant',
        sub: 'The menu and contacts on the website, table bookings and orders in a Telegram bot, and you are easy to find on the maps. Guests handle it themselves, and the staff sees every request.',
        card: 'Menu, table bookings and orders in one bot, plus a website and a place on the maps.',
        problems: [
          {
            pain: 'Bookings come by phone, and at rush hour nobody can pick up',
            fix: 'Guests book a table in the bot themselves: date, time, number of guests. The request goes straight to the manager.',
          },
          {
            pain: 'The menu and prices on Instagram are out of date, guests keep asking the same things',
            fix: 'An up to date menu, opening hours and address on the website and in the bot. No more answering the same questions.',
          },
          {
            pain: 'Takeaway orders get lost in chats',
            fix: 'Orders are placed and paid in the bot, and every order has a clear status.',
          },
          {
            pain: 'New guests cannot find you on the maps',
            fix: 'We add your place to Google Maps and Yandex Maps with photos, opening hours and a link to the website.',
          },
        ],
        faq: [
          {
            q: 'Can we change the menu and prices ourselves?',
            a: 'Yes. The bot menu is edited in a simple spreadsheet or admin panel, no developer needed. The website can get an editing panel too.',
          },
          {
            q: 'How does a guest pay in the bot?',
            a: 'We connect card payments and the local payment systems your bank supports. We will confirm which ones on a call.',
          },
          {
            q: 'Does a guest need to install anything?',
            a: 'No. The bot opens in Telegram, which the guest already has, and the website opens in any browser.',
          },
          {
            q: 'Where do bookings and orders arrive?',
            a: 'In Telegram, to the manager or a staff group, with the name, phone number and order details.',
          },
          {
            q: 'Can we start with the website only?',
            a: 'Yes. Remove the bot in the builder and the price updates. The bot can be added later when you need it.',
          },
        ],
      },
      salon: {
        metaTitle: 'Online booking and Telegram bot for a beauty salon',
        metaDescription:
          'Online booking in a Telegram bot with reminders and broadcasts, and a website with services and prices. Price and timing of the starting set for a beauty salon or barbershop.',
        title: 'Online booking and a bot for a beauty salon',
        sub: 'Clients book a stylist in the bot at any time, get a reminder and do not forget the visit. The website shows services and prices, and its requests arrive in Telegram.',
        card: 'Booking in a bot, reminders, broadcasts and a website with services.',
        problems: [
          {
            pain: 'Bookings live in a notebook and the receptionist is on the phone all day',
            fix: 'Clients pick the service, the stylist and a free slot in the bot. Two bookings never land on the same time.',
          },
          {
            pain: 'Clients forget their appointment and do not show up',
            fix: 'The bot reminds them ahead of the visit and lets them reschedule in a couple of taps.',
          },
          {
            pain: 'Regular clients disappear for months',
            fix: 'Broadcasts to your client base: offers, free slots, greetings.',
          },
          {
            pain: 'Prices have to be explained in every chat',
            fix: 'A website with services, prices and stylists, and its requests go straight to Telegram.',
          },
        ],
        faq: [
          {
            q: 'Will stylists see their own bookings?',
            a: 'Yes. Each stylist can get their bookings in Telegram, and the manager sees the whole picture.',
          },
          {
            q: 'Can we move our client base from a notebook or spreadsheet?',
            a: 'Yes, we import from Excel or Google Sheets. If the base is in a notebook, we will help you put it into a sheet.',
          },
          {
            q: 'Will the broadcasts feel like spam?',
            a: 'They only go to people who already use the bot, and anyone can unsubscribe. You choose how often and what to send.',
          },
          {
            q: 'Does it fit a barbershop or a nail studio?',
            a: 'Yes. The set fits anyone who works by appointment: salons, barbershops, studios, massage, independent specialists.',
          },
        ],
      },
      shop: {
        metaTitle: 'Turnkey online store: catalog, cart and payments',
        metaDescription:
          'An online store with a catalog, cart, online payments and an editing panel, a place on the maps and support. Price and timing of the starting set.',
        title: 'Turnkey online store',
        sub: 'A catalog, a cart and online payments, and you change products and prices yourself in the panel. The store shows up in search and on the maps, and we keep it running.',
        card: 'Catalog, cart, online payments and a panel where you edit products yourself.',
        problems: [
          {
            pain: 'Sales only happen in direct messages, every order by hand',
            fix: 'Buyers pick a product, add it to the cart and pay. You get a finished order.',
          },
          {
            pain: 'Changing a price or adding a product needs a developer',
            fix: 'An editing panel: you change products, prices, photos and stock yourself.',
          },
          {
            pain: 'Nobody finds the store in search',
            fix: 'We set up search, maps and analytics, so you can see where buyers come from.',
          },
          {
            pain: 'The site was built and abandoned, now it breaks',
            fix: 'Support by subscription: hosting, backups, updates and small edits every month.',
          },
        ],
        faq: [
          {
            q: 'Which payment methods can be connected?',
            a: 'Bank cards and local payment systems, and Stripe for buyers abroad. The list depends on your bank, we will confirm it on a call.',
          },
          {
            q: 'How many products can we add?',
            a: 'As many as your catalog needs. If there are a lot, we import them from a spreadsheet.',
          },
          {
            q: 'Can the store be connected to Telegram?',
            a: 'Yes. Requests and orders in Telegram are an option in the builder, and a shop bot can come later.',
          },
          {
            q: 'Is the support subscription required?',
            a: 'No. It is a separate monthly service, you can remove it in the builder and add it later.',
          },
          {
            q: 'Who owns the store?',
            a: 'You do. The code, domain and access are yours from day one, you are not tied to us.',
          },
        ],
      },
      delivery: {
        metaTitle: 'Telegram Mini App for food and goods delivery',
        metaDescription:
          'A Telegram Mini App for delivery: catalog, cart, payments and an admin panel, orders go straight to your system and alerts arrive in Telegram. Price and timing.',
        title: 'Telegram Mini App for delivery',
        sub: 'An app right inside Telegram: catalog, cart and payment with nothing to install. Orders land in the admin panel and your system, and the team gets an alert right away.',
        card: 'Catalog, cart and payment inside Telegram, orders straight to the team.',
        problems: [
          {
            pain: 'Orders come through chats, addresses and items get mixed up',
            fix: 'Clients build the order in the Mini App: items, address, time. The operator gets it all in one message.',
          },
          {
            pain: 'A store app is expensive, and clients do not want to install anything',
            fix: 'A Mini App opens in Telegram with no install and looks like an app.',
          },
          {
            pain: 'Orders have to be copied into the books by hand',
            fix: 'We connect the Mini App to your spreadsheet or accounting system, and orders get there by themselves.',
          },
          {
            pain: 'The courier and the kitchen hear about an order late',
            fix: 'An alert about each new order goes to the right people in Telegram right away.',
          },
        ],
        faq: [
          {
            q: 'How is a Mini App different from a regular bot?',
            a: 'A regular bot works through buttons and messages. A Mini App opens a full screen inside Telegram with a catalog, cart and payment.',
          },
          {
            q: 'Do we need to publish it in the App Store and Google Play?',
            a: 'No. A Mini App lives inside Telegram, no store publishing needed.',
          },
          {
            q: 'Which systems can orders be connected to?',
            a: 'Google Sheets, a CRM or your accounting system if it has an API. We will work out what fits you on a call.',
          },
          {
            q: 'Who changes products and prices?',
            a: 'You do, in the admin panel: products, prices, availability and order statuses.',
          },
        ],
      },
      services: {
        metaTitle: 'Website and CRM for a service company or B2B',
        metaDescription:
          'A company website with requests to Telegram and a CRM setup with staff training. Price and timing of the starting set for a service company or B2B.',
        title: 'Website and CRM for a service company',
        sub: 'A website that explains how you help and collects requests. Every request lands in the CRM, and the team knows whom to call back and when.',
        card: 'A company website with requests and a CRM where no client gets lost.',
        problems: [
          {
            pain: 'Requests come by email, messengers and calls, some get lost',
            fix: 'Website requests go straight to Telegram and the CRM, each with an owner.',
          },
          {
            pain: 'Nobody knows which stage each client is at',
            fix: 'A pipeline in the CRM: new, in progress, done. You can see who needs a call back.',
          },
          {
            pain: 'The website is outdated and does not explain what you do',
            fix: 'A company website with your services, how you work and a clear request form.',
          },
          {
            pain: 'You bought a CRM, but the team does not use it',
            fix: 'We set the CRM up around your process and train the team to work in it.',
          },
        ],
        faq: [
          {
            q: 'Which CRM do you set up?',
            a: 'Most often amoCRM or Bitrix24. If you already have a CRM, we work with it.',
          },
          {
            q: 'Is the CRM subscription included in the price?',
            a: 'No. The price covers setup and training, the CRM subscription itself you pay to the CRM directly.',
          },
          {
            q: 'Can you move our current client base?',
            a: 'Yes, we import it from spreadsheets or another CRM.',
          },
          {
            q: 'Can the website be in two languages?',
            a: 'If you need it. A second language is an option in the builder, and the price updates right away.',
          },
        ],
      },
    },
  },
  pains: {
    title: 'Sound familiar?',
    sub: 'Flip the switch to see what changes after launch.',
    before: 'Now',
    after: 'With Fir Tech',
    toggle: 'Show what it looks like after launch',
    items: [
      {
        pain: 'Leads get lost in private messages',
        fix: 'A bot collects every request and sends it to a manager with the phone number and details.',
      },
      {
        pain: 'Clients call just to ask about prices and opening hours',
        fix: 'Your website and bot answer common questions at any hour.',
      },
      {
        pain: 'Bookings live in a notebook or a spreadsheet',
        fix: 'Online booking with reminders sent a day and an hour before the visit.',
      },
      {
        pain: 'Monthly reports are put together by hand',
        fix: 'Sales and expenses flow into a spreadsheet or CRM on their own.',
      },
      {
        pain: 'You have a website, but it brings almost no leads',
        fix: 'We build the new site around one action: a call, an enquiry or an order.',
      },
      {
        pain: 'You want your own app, but the budget is scary',
        fix: 'We start with a minimal version and grow it with your business.',
      },
    ],
  },
  showcase: {
    title: 'What it could look like for you',
    sub: 'The four solutions we are asked to build most often. These are concepts, but the prices and timelines are real.',
    concept: 'Concept',
    task: 'Problem',
    result: 'What the business gets',
    from: 'from',
    cta: 'I want this',
    items: {
      cafe: {
        business: 'Coffee shop',
        title: 'Landing page with Telegram orders',
        task: 'Guests ask for the menu in DMs, and orders get lost.',
        result:
          'Guests order from their phone, and the barista gets the order in Telegram right away.',
        term: '5-7 days',
      },
      salon: {
        business: 'Beauty salon',
        title: 'Booking bot with reminders',
        task: 'The front desk spends all day answering "any slots on Saturday?".',
        result:
          'Clients pick a stylist and a time themselves, and the bot reminds them a day and an hour before.',
        term: '1-2 weeks',
      },
      delivery: {
        business: 'Food delivery',
        title: 'Telegram Mini App with payments',
        task: 'Orders by phone, mixed-up addresses and change.',
        result: 'Catalog, cart and payment right inside Telegram, with nothing to download.',
        term: '3-4 weeks',
      },
      sales: {
        business: 'Sales team',
        title: 'CRM and AI assistant',
        task: 'Leads from the website, Instagram and Telegram live in different places.',
        result:
          'Every lead in one pipeline, AI answers routine questions, and managers see every client.',
        term: '2-3 weeks',
      },
    },
    demo: {
      menu: 'Menu',
      order: 'Order',
      cart: 'In cart',
      latte: 'Latte',
      cappuccino: 'Cappuccino',
      croissant: 'Croissant',
      orderAlert: 'New order: latte and croissant, for 9:30',
      master: 'Stylist',
      masterName: 'Nigina',
      booked: 'Booked for Saturday, 14:30',
      reminder: 'Reminder: your haircut is tomorrow at 14:30',
      plov: 'Plov',
      samsa: 'Samsa',
      lagman: 'Lagman',
      pay: 'Pay',
      paid: 'Paid, the courier is on the way',
      colNew: 'New',
      colWork: 'In progress',
      colDone: 'Paid',
      leadA: 'Website lead',
      leadB: 'Instagram',
      leadC: 'Telegram',
      days: ['Thu', 'Fri', 'Sat', 'Sun'],
      tea: 'Tea',
      aiReply: 'AI: free delivery in town from $20',
    },
  },
  compare: {
    title: 'Freelancer, agency or Fir Tech',
    sub: 'Each option has its strengths. We kept what usually matters most to a small business: a clear price, deadlines and control over the project.',
    criteria: 'What matters',
    columns: ['Freelancer', 'Big agency', 'Fir Tech'],
    rows: [
      {
        label: 'Price',
        values: ['Usually affordable', 'Above average', 'Affordable and written in the quote'],
      },
      {
        label: 'Deadlines',
        values: [
          'Depend on their workload',
          'More approval steps',
          'Fixed in the quote, progress every week',
        ],
      },
      {
        label: 'Payment',
        values: [
          'Whatever you agree',
          'Usually with prepayment',
          'In stages, each paid separately',
        ],
      },
      {
        label: 'Who is responsible',
        values: [
          'One person',
          'A team and a manager',
          'We do, by the quote, and the code and access are yours from day one',
        ],
      },
      {
        label: 'After launch',
        values: ['By agreement', 'Usually a separate contract', 'A month of free fixes'],
      },
    ],
  },
  estimator: {
    eyebrow: 'Calculator',
    title: 'Estimate the cost in a minute',
    sub: 'Pick what you need and see an approximate price and timeline.',
    service: 'What we build',
    variant: 'Format',
    addons: 'Extras',
    total: 'Approximate cost',
    term: 'Timeline',
    note: 'This is a rough estimate. We confirm the exact price after a short call and fix it in the quote.',
    cta: 'Discuss a project',
    catalog: {
      websites: {
        variants: {
          landing: { name: 'Landing page', term: '5-7 days' },
          company: { name: 'Company website', term: '2-3 weeks' },
          shop: { name: 'Online store', term: '3-5 weeks' },
        },
        addons: {
          language: 'Second language',
          telegram: 'Leads to Telegram',
          payments: 'Online payments',
          cms: 'Content editor',
        },
      },
      bots: {
        variants: {
          faq: { name: 'Q&A bot', term: '3-5 days' },
          booking: { name: 'Bookings and orders', term: '1-2 weeks' },
          miniapp: { name: 'Telegram Mini App', term: '3-4 weeks' },
        },
        addons: {
          payments: 'In-bot payments',
          broadcasts: 'Broadcasts',
          admin: 'Admin panel',
          ai: 'AI answers',
        },
      },
      apps: {
        variants: {
          pwa: { name: 'Web app', term: '4-6 weeks' },
          internal: { name: 'Internal tool', term: '5-8 weeks' },
          mobile: { name: 'iOS and Android', term: '6-10 weeks' },
        },
        addons: {
          accounts: 'User accounts',
          payments: 'Online payments',
          push: 'Push notifications',
          admin: 'Admin panel',
        },
      },
      automation: {
        variants: {
          integration: { name: 'Connect two services', term: '3-7 days' },
          crm: { name: 'CRM setup', term: '2-3 weeks' },
          assistant: { name: 'AI assistant', term: '2-4 weeks' },
        },
        addons: {
          sheets: 'Reports in Google Sheets',
          alerts: 'Telegram alerts',
          training: 'Team training',
          support: '3 months of support',
        },
      },
    },
  },
  process: {
    title: 'How we work',
    steps: [
      {
        title: 'Call',
        text: '30 minutes, free. We look at your task and suggest a solution, even if you end up working with someone else.',
      },
      {
        title: 'Quote',
        text: 'We fix the price, deadline and scope. Everything in the quote is done for that amount.',
      },
      {
        title: 'Build',
        text: 'You see progress every week and pay in stages, for each one separately.',
      },
      {
        title: 'Launch',
        text: 'We go live, show your team how everything works and fix any bugs free for a month.',
      },
    ],
  },
  trust: {
    title: 'Why working with us is low-risk',
    sub: "We're a young studio and know trust has to be earned. So the rules are simple and written into the quote.",
    stats: [
      { value: 0, prefix: '$', suffix: '', label: 'extra charges beyond the quote' },
      { value: 100, prefix: '', suffix: '%', label: 'of the code, domain and access are yours' },
      { value: 30, prefix: '', suffix: ' min', label: "free call, even if you don't hire us" },
      { value: 1, prefix: '', suffix: ' month', label: 'of free fixes after launch' },
    ],
    items: [
      {
        title: 'The price does not grow',
        text: 'Everything in the quote is done for the agreed amount. New ideas are priced separately and only with your approval.',
      },
      {
        title: 'Code, domain and access are yours',
        text: 'Everything is registered in your name. If you decide to leave, you take the whole project with you.',
      },
      {
        title: 'Pay for what you see',
        text: 'The work is split into stages, and you pay for each one separately. We start the next stage once you have accepted the previous one.',
      },
      {
        title: 'Plain language',
        text: 'We write in Telegram without jargon and reply the same working day.',
      },
    ],
  },
  blog: {
    metaTitle: 'Fir Tech blog: websites, bots and automation in plain words',
    metaDescription:
      'Practical articles for small business owners: what a website costs, website or Telegram bot, how to stop losing leads.',
    eyebrow: 'Blog',
    title: 'Websites, bots and leads in plain words',
    sub: 'Practical advice for small business owners: what to order, what it costs and how not to overpay.',
    empty: 'Articles are coming soon',
    emptyText:
      'We are preparing the first pieces. Meanwhile you can put your project together in the builder or ask us directly.',
    draft: 'Draft',
    draftNote: 'Drafts are visible in local development only. Production hides them until published: true.',
    minutes: 'min read',
    read: 'Read',
    back: 'All articles',
    more: 'More articles',
    ctaTitle: 'Put your project together in the builder',
    ctaText: 'Pick a website, a bot or automation and see the price and timeline right away. You can get the estimate as a PDF.',
    ctaButton: 'Open the builder',
  },
  faq: {
    title: 'Questions',
    items: [
      {
        q: 'Why are your prices lower than other studios?',
        a: 'No office and no account managers in the middle: you talk to us directly. Where it does not hurt quality, we use proven ready-made components. Complex projects cost more, and you know the price before we start.',
      },
      {
        q: 'How long does it take?',
        a: 'A landing page usually takes 5-7 days, a bot from 3 days, an app from 4 weeks. The exact deadline is in the quote.',
      },
      {
        q: 'Do I need to prepare texts and photos?',
        a: 'If you have them, we use them. If not, we help write the copy and find images.',
      },
      {
        q: 'How do payments work?',
        a: 'In stages: the work is split into stages and you pay for each one separately. The quote lists the stages and what each includes. We agree on the payment method together.',
      },
      {
        q: 'Do you work with clients abroad?',
        a: 'Yes. We work remotely and talk in Telegram or on video calls, in English or Russian.',
      },
      {
        q: 'Can I edit texts and prices myself?',
        a: 'Yes, with a content editor. We show you how to change texts, prices and photos without a developer.',
      },
      {
        q: 'What happens after launch?',
        a: 'We fix bugs free for a month. After that you can take a support plan or come to us with one-off tasks.',
      },
    ],
  },
  booking: {
    toggle: 'Pick a call time',
    toggleHint: 'Optional. 30 minutes, Dushanbe time',
    remove: 'No time',
    loading: 'Loading free times...',
    failed: "Couldn't load the times. You can send the request without one.",
    retry: 'Try again',
    empty: "No free times right now. Send the request and we'll suggest a time.",
    days: 'Call day',
    times: 'Call time',
    selected: 'Call',
    taken: 'Someone just took this time. Please pick another one.',
    successBooked: "Call: {time}. We'll confirm the time when we reply.",
    telegramCta: 'Get replies in Telegram',
    telegramHint: 'The bot sends your request number and tells you when we confirm the call.',
    bot: {
      received: "Request #{id} received, we'll get back to you within one working day.",
      booking: 'Call: {time}, waiting for confirmation.',
      bookingConfirmed: 'Call confirmed: {time}.',
      confirmed: 'Your call for request #{id} is confirmed: {time}.',
      moved: "Request #{id}: {time} doesn't work for us. We'll suggest another time.",
      badLink: "This link didn't work. Send a request on the site and we'll get in touch.",
      hello:
        'This is the Fir Tech studio bot. Send a request on the site and replies will show up here.',
    },
  },
  contact: {
    title: 'Tell us about your project',
    sub: "We'll reply within one working day with a solution and a price.",
    name: 'Name',
    namePlaceholder: 'What should we call you',
    contactField: 'Telegram or phone',
    contactPlaceholder: '@username or +1 ...',
    contactHelp: "We'll reply here.",
    service: 'What you need',
    serviceUnknown: 'Not sure yet, I need advice',
    budget: 'Budget',
    budgets: ['Under $300', '$300-1000', '$1000-3000', 'Over $3000', 'Not sure yet'],
    message: 'Project',
    messagePlaceholder: 'A couple of sentences about your business and what you want to build',
    estimateLabel: 'Calculator estimate',
    submit: 'Send request',
    sending: 'Sending...',
    consent:
      'By sending this form you agree that we use these details only to reply to your request, as described in the [privacy policy].',
    successTitle: 'Request received',
    successText:
      "We'll get back to you within one working day. If it's urgent, message us on Telegram.",
    again: 'Send another one',
    error: "Couldn't send the form. Try again or message us on Telegram.",
    errors: {
      name: 'Tell us what to call you',
      contact: 'Leave a Telegram username or phone so we can reply',
    },
    nextTitle: 'What happens after you send it',
    next: [
      'We reply in Telegram or call you within one business day',
      'A 30-minute call to go through your task',
      'You get a quote with the price and timeline. The decision is yours',
    ],
    telegramTitle: 'Prefer to message right away?',
    telegramText: "Write to us on Telegram and we'll reply there.",
    telegramCta: 'Message on Telegram',
  },
  privacy: {
    metaTitle: 'Privacy policy | Fir Tech',
    metaDescription:
      'What data the Fir Tech contact form collects, why, where it is kept and how to ask us to delete it.',
    eyebrow: 'Document',
    title: 'Privacy policy',
    updated: 'Version of 18 October 2026',
    intro:
      'In short and in plain words: what data you leave on this site, what we do with it and how to ask us to delete it. The data is handled by the Fir Tech studio.',
    sections: [
      {
        id: 'collect',
        title: 'What data we receive',
        text: ['When you send a request, we receive what you entered in the form:'],
        list: [
          'your name',
          'Telegram or phone',
          'budget',
          'the task description',
          'the estimate from the calculator or the builder, if you added it',
          'a convenient time for a call, if you chose one',
          'the page the request was sent from and the site language',
        ],
      },
      {
        id: 'purpose',
        title: 'Why',
        text: [
          'Only to reply to your request and prepare a quote with a price and a timeline. We do not send newsletters based on this data or add you to any advertising lists.',
        ],
        list: [],
      },
      {
        id: 'storage',
        title: 'Where it is kept',
        text: [
          'The request arrives in our Telegram bot and is saved to a file on our server, so it is not lost if Telegram is briefly unavailable.',
        ],
        list: [],
      },
      {
        id: 'retention',
        title: 'How long it is kept',
        text: [
          'Up to 1 year after our last contact with you, then it is deleted. Earlier, if you ask us to.',
        ],
        list: [],
      },
      {
        id: 'sharing',
        title: 'Who we share it with',
        text: [
          'We do not sell your data or share it with third parties. The only exception is the technical services the site cannot work without: Telegram (requests arrive through it) and the hosting the site runs on.',
        ],
        list: [],
      },
      {
        id: 'analytics',
        title: 'Analytics',
        text: [
          'We use Yandex Metrica to see which pages help and which do not. Metrica sets cookies and collects anonymised visit data: pages opened, transitions, clicks and scrolling, device and browser type, approximate region. Metrica also records actions on the page (Webvisor), but not what you type into form fields. This data does not tell us who you are.',
          'You can turn this off in your browser settings (block cookies or turn on tracking protection) or with the Yandex add-on that blocks Metrica on all sites.',
        ],
        list: [],
      },
      {
        id: 'rights',
        title: 'Your rights',
        text: [
          'At any time you can ask what data we have about you, ask us to correct it or delete it. We will reply and do it.',
        ],
        list: [],
      },
      {
        id: 'changes',
        title: 'Changes',
        text: ['If this policy changes, the new version will appear on this page with a new date.'],
        list: [],
      },
    ],
    optOut: 'Add-on that blocks Yandex Metrica',
    contactTelegram: 'To make a request, message us on Telegram:',
    contactForm: 'To make a request, write to us through the form on the site:',
    contactFormLink: 'Go to the form',
    footerLink: 'Privacy policy',
  },
  footer: {
    tagline: 'Development studio. Websites, Telegram bots, apps and automation for business.',
    ctaTitle: 'Got a task? Let’s talk it through in 30 minutes',
    top: 'Back to top',
    services: 'Services',
    company: 'Studio',
    rights: 'All rights reserved.',
    language: 'Русский',
  },
  servicePage: {
    included: "What's included",
    variants: 'Formats and prices',
    fits: 'Good fit for',
    faq: 'Questions',
    others: 'Other services',
    term: 'Timeline',
    estimate: 'Get a closer estimate',
    calc: 'Estimate',
    calcLabel: 'Estimate in the calculator:',
    steps: 'How the work goes',
    concepts: 'What it could look like',
    conceptsSub:
      'A concept for illustration, not client work. The price comes from our calculator, and the timeline is real.',
    conceptCta: 'I want this too',
  },
  serviceDetails: {
    websites: {
      metaTitle: 'Website and landing page development from $200 | Fir Tech',
      metaDescription:
        'Landing pages from $200, company websites and online stores. Mobile-friendly design, leads to Telegram, content editor. Price and deadline up front.',
      title: 'A website that brings in leads',
      sub: 'A landing page in 5-7 days or a company website in 2-3 weeks. Looks right on a phone and sends every enquiry to your Telegram.',
      included: [
        'Structure and copy that lead to an enquiry',
        'Design in your brand, built for phones first',
        'Enquiry form that sends to Telegram or email',
        'SEO basics: titles, descriptions, sitemap',
        'Domain and SSL certificate setup',
        'Analytics that show where clients come from',
      ],
      steps: [
        {
          title: 'Structure',
          text: 'We talk through who your customers are and what they should do on the site, then put together the structure and copy.',
        },
        {
          title: 'Design',
          text: 'We show the first screen and the overall style, revise it until you like it, then design the rest.',
        },
        {
          title: 'Build',
          text: 'We build the site, check it on phones and connect the form so enquiries arrive in your Telegram.',
        },
        {
          title: 'Launch',
          text: 'We connect the domain, SSL and analytics, hand over every access and show you how to make edits.',
        },
      ],
      fits: [
        'Cafes, salons and clinics',
        'Online schools and experts',
        'Construction and renovation',
        'Shops and manufacturers',
      ],
      faq: [
        {
          q: "What's the difference between a landing page and a company website?",
          a: 'A landing page is one page built for one action, such as an enquiry. A company website has several sections: services, prices, about, contacts.',
        },
        {
          q: 'Who hosts the website?',
          a: 'We do the setup. We help you buy the domain and hosting in your name and configure everything.',
        },
        {
          q: 'Can I add pages later?',
          a: 'Yes. We build the site so it can grow without a rebuild.',
        },
      ],
    },
    bots: {
      metaTitle: 'Telegram bot development from $100 | Fir Tech',
      metaDescription:
        'Telegram bots for bookings, orders and customer questions, Telegram Mini Apps, in-bot payments and AI answers. From $100, from 3 days.',
      title: 'A Telegram bot that works for you',
      sub: 'Takes orders, books clients and answers common questions around the clock. A simple bot is ready in 3-5 days.',
      included: [
        'A conversation flow designed for your business',
        'Buttons and menus that are clear at first glance',
        'Lead alerts for you or your managers',
        'Clients and orders saved to a spreadsheet or CRM',
        'Server hosting and launch',
        'A short guide to how the bot works',
      ],
      steps: [
        {
          title: 'Script',
          text: 'We write out what the customer types and what the bot answers: buttons, menus, where requests go.',
        },
        {
          title: 'Build',
          text: 'We build the bot and connect it to a spreadsheet or CRM so customers and orders are saved.',
        },
        {
          title: 'Review',
          text: 'You try the bot in your own Telegram before launch, and we adjust texts and buttons to your notes.',
        },
        {
          title: 'Launch',
          text: 'We host the bot, switch on notifications and give you a short guide to how it works.',
        },
      ],
      fits: [
        'Salon and clinic bookings',
        'Food orders and delivery',
        'Shops inside Telegram',
        'Customer support',
      ],
      faq: [
        {
          q: 'What is a Telegram Mini App?',
          a: 'A full app inside Telegram: catalogue, cart, payment. Clients do not need to download anything.',
        },
        {
          q: 'Can the bot reply on its own, like a person?',
          a: 'Yes, with AI answers. The bot learns from your materials (price list, terms, FAQ) and replies politely and to the point. Tricky questions are passed to you.',
        },
        {
          q: 'How much does it cost to run a bot?',
          a: 'Usually $5-10 a month for the server. With AI, there is also a per-request cost, which we estimate up front.',
        },
      ],
    },
    apps: {
      metaTitle: 'App development from $1000 | Fir Tech',
      metaDescription:
        'Web apps, iOS and Android apps, customer accounts and internal tools for your team. From $1000, paid in stages.',
      title: 'An app without wasted budget',
      sub: 'We start with a minimal version that solves the main problem and grow it as you grow. Paid in stages.',
      included: [
        'Task breakdown and screen prototype',
        'Interface design',
        'App and server development',
        'Testing on real devices',
        'Publishing to the App Store and Google Play',
        'A month of free fixes after launch',
      ],
      steps: [
        {
          title: 'Discovery',
          text: 'We pin down the main job of the app and what goes into the first version, then sketch the screens.',
        },
        {
          title: 'Design',
          text: 'We design the interface from the prototype and agree it with you before development starts.',
        },
        {
          title: 'Development',
          text: 'We build the app and its backend in stages. You see each stage, and payment goes in stages too.',
        },
        {
          title: 'Launch',
          text: 'We test on real devices, publish, and fix bugs for free for a month.',
        },
      ],
      fits: [
        'Services with customer accounts',
        'Loyalty programmes',
        'Order and stock tracking',
        'Apps for your staff',
      ],
      faq: [
        {
          q: "What's the difference between a web app and a mobile app?",
          a: 'A web app opens in the browser and installs on a phone without an app store. It is cheaper and faster to build. A mobile app is published in the App Store and Google Play.',
        },
        {
          q: 'What is a minimal version?',
          a: 'An app with only the core features. It launches sooner, you test it with real clients, then keep improving it.',
        },
        {
          q: 'Who owns the code?',
          a: 'You do. We hand over the source code and all access.',
        },
      ],
    },
    automation: {
      metaTitle: 'Business automation and AI assistants from $300 | Fir Tech',
      metaDescription:
        'We connect your website, Telegram, CRM and Google Sheets, set up CRM and AI assistants. Less manual work, from $300.',
      title: 'Let routine work run itself',
      sub: 'We connect your tools: leads land in the CRM, reports fill a spreadsheet, clients get answers and reminders.',
      included: [
        'Process review: where time is lost',
        'Website, Telegram, CRM and spreadsheets connected',
        'Automatic alerts and reminders',
        'Reports that build themselves',
        'AI assistant for clients and staff',
        'Team training',
      ],
      steps: [
        {
          title: 'Audit',
          text: 'We look at what your team does by hand every day and where enquiries and time get lost.',
        },
        {
          title: 'Plan',
          text: 'We map which services to connect and what will happen on its own, and agree it before any work.',
        },
        {
          title: 'Setup',
          text: 'We connect the services and test the flow on sample enquiries before switching it on for customers.',
        },
        {
          title: 'Training',
          text: 'We show your team how to use it and stay in touch if something goes wrong.',
        },
      ],
      fits: [
        'Sales teams',
        'Booking-based services',
        'Online stores',
        'Businesses with manual reporting',
      ],
      faq: [
        {
          q: 'Which tools do you work with?',
          a: 'Telegram, WhatsApp, Google Sheets, amoCRM, Bitrix24, 1C and any service with an API. If unsure, ask on the call.',
        },
        {
          q: 'What can the AI assistant do?',
          a: 'Answer clients using your materials, help staff find information and sort incoming requests.',
        },
        {
          q: 'How do I know what to automate?',
          a: 'Start with what your team does by hand every day. On the free call we point out what will make the biggest difference.',
        },
      ],
    },
  },
  notFound: notFoundText.en,
}

export default en
