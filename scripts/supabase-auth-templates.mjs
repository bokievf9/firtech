#!/usr/bin/env node
// Uploads the four Fir Tech auth emails (supabase/templates/*.html + subjects.json) to the Supabase project.
//   SUPABASE_ACCESS_TOKEN=... node scripts/supabase-auth-templates.mjs [--dry-run] [--ref <project-ref>]
// The token comes only from the environment (never from a file of the repo, never printed). `--dry-run`
// reads the files and prints the field names and lengths, no network. Details: docs/cabinet.md «Письма и код».
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'templates')
const kinds = ['confirmation', 'magic_link', 'recovery', 'email_change']
const argv = process.argv.slice(2)
const dry = argv.includes('--dry-run')
const refIndex = argv.indexOf('--ref')
const ref = refIndex >= 0 ? argv[refIndex + 1] : 'lxuigwowgxzjadtenpyk'

if (!/^[a-z0-9]{20}$/.test(ref ?? '')) {
  console.error('Bad project ref.')
  process.exit(2)
}

const subjects = JSON.parse(readFileSync(path.join(root, 'subjects.json'), 'utf8'))
const body = {}
for (const kind of kinds) {
  const html = readFileSync(path.join(root, `${kind}.html`), 'utf8')
  if (!html.includes('{{ .Token }}') || !html.includes('{{ .ConfirmationURL }}')) {
    console.error(`${kind}.html lacks {{ .Token }} or {{ .ConfirmationURL }}`)
    process.exit(2)
  }
  if (typeof subjects[kind] !== 'string' || !subjects[kind].trim()) {
    console.error(`subjects.json has no subject for ${kind}`)
    process.exit(2)
  }
  body[`mailer_templates_${kind}_content`] = html
  body[`mailer_subjects_${kind}`] = subjects[kind]
}

if (dry) {
  console.log(`dry run, project ${ref}, PATCH /v1/projects/${ref}/config/auth`)
  for (const [key, value] of Object.entries(body)) console.log(`  ${key}: ${value.length} chars`)
  process.exit(0)
}

const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) {
  console.error('Set SUPABASE_ACCESS_TOKEN in the environment (not in the command line, not in a file).')
  process.exit(2)
}
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: 'PATCH',
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(30_000),
})
if (!res.ok) {
  // The status only: the answer body can echo settings.
  console.error(`Supabase answered ${res.status}. Nothing printed from the body.`)
  process.exit(1)
}
console.log(`Uploaded ${kinds.length} templates and subjects to ${ref}.`)
