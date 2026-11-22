// Tiny Telegram sender for the server cron scripts (no dependencies, Node 22).
// Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from the env file passed with --env-file.
const api = (method) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`

export function configured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
}

export async function sendText(text) {
  const res = await fetch(api('sendMessage'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
  })
  if (!res.ok) throw new Error(`sendMessage ${res.status}`)
}

export async function sendFile(name, bytes, caption) {
  const form = new FormData()
  form.set('chat_id', process.env.TELEGRAM_CHAT_ID)
  form.set('caption', caption)
  form.set('document', new Blob([bytes], { type: name.endsWith('.age') ? 'application/octet-stream' : 'application/json' }), name)
  const res = await fetch(api('sendDocument'), { method: 'POST', body: form })
  if (!res.ok) throw new Error(`sendDocument ${res.status}`)
}
