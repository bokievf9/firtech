// Demo stand: the deep link into the demo salon of @firtech_bot (contract: agents/docs/public-api.md).
// The bot puts the chat into a sandbox of the admin bot for a made-up salon; every message there is
// labelled as a demo and nothing real is created.
export const demoSalonUrl = 'https://t.me/firtech_bot?start=demo_salon'
// `data-place` of every demo link: the one t.me listener counts them as `telegram_click`.
export const demoPlace = 'demo_salon'
// The visitor's own words are never needed: the chat chip sends exactly this message and HQ answers
// with the description and the link.
export const demoChatMessage = 'demo'
