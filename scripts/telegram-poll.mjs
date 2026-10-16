// Local testing of the bot buttons without a public URL: long-polls Telegram and forwards every
// update to the dev server's webhook, with the same secret header Telegram would send.
//   npm run dev   (in one terminal)
//   node --env-file=.env.local scripts/telegram-poll.mjs   (in another)
// Telegram doesn't deliver getUpdates while a webhook is set: run
// `node scripts/telegram-webhook.mjs delete` first, and set it again after testing on prod.

const token = process.env.TELEGRAM_BOT_TOKEN
const secret = process.env.TELEGRAM_WEBHOOK_SECRET
const target = process.env.WEBHOOK_TARGET || 'http://localhost:3001/api/telegram'

if (!token || !secret) {
  console.error('Need TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET')
  process.exit(1)
}

let offset = 0
console.log(`Forwarding updates to ${target} (Ctrl+C to stop)`)

for (;;) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ offset, timeout: 30, allowed_updates: ['message', 'callback_query'] }),
    })
    const data = await response.json()
    if (!data.ok) throw new Error(data.description)
    for (const update of data.result) {
      offset = update.update_id + 1
      const forwarded = await fetch(target, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-telegram-bot-api-secret-token': secret,
        },
        body: JSON.stringify(update),
      }).catch((error) => ({ status: String(error) }))
      const kind = update.callback_query
        ? 'button'
        : update.message?.text?.split(' ')[0] || 'update'
      console.log(`#${update.update_id} ${kind} -> ${forwarded.status}`)
    }
  } catch (error) {
    console.error('poll failed, retrying in 3 s:', error.message)
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }
}
