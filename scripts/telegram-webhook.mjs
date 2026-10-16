// Points the bot at the deployed site (run once after deploy, on a machine with the prod env):
//   node scripts/telegram-webhook.mjs set     -> webhook = $NEXT_PUBLIC_SITE_URL/api/telegram
//   node scripts/telegram-webhook.mjs delete  -> back to no webhook (needed for telegram-poll.mjs)
//   node scripts/telegram-webhook.mjs info    -> what Telegram currently has
// Reads TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and NEXT_PUBLIC_SITE_URL from the process env,
// e.g. `node --env-file=.env.local scripts/telegram-webhook.mjs set`.

const action = process.argv[2] ?? 'info'
const token = process.env.TELEGRAM_BOT_TOKEN
const secret = process.env.TELEGRAM_WEBHOOK_SECRET
const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is missing')
  process.exit(1)
}

async function call(method, body = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!data.ok) throw new Error(`${method}: ${data.description}`)
  return data.result
}

if (action === 'set') {
  if (!secret || !site.startsWith('https://')) {
    console.error('Need TELEGRAM_WEBHOOK_SECRET and an https NEXT_PUBLIC_SITE_URL')
    process.exit(1)
  }
  await call('setWebhook', {
    url: `${site}/api/telegram`,
    secret_token: secret,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: false,
  })
  // The command menu the owner and clients see in the bot.
  await call('setMyCommands', { commands: [{ command: 'leads', description: 'Последние заявки' }] })
  console.log(`Webhook set to ${site}/api/telegram`)
} else if (action === 'delete') {
  await call('deleteWebhook')
  console.log('Webhook deleted')
} else {
  const info = await call('getWebhookInfo')
  // The URL is public anyway; no secrets in this output.
  console.log({
    url: info.url,
    pending: info.pending_update_count,
    lastError: info.last_error_message,
  })
}
