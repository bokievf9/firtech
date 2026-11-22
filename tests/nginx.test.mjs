// Security 2026-11-23 (P1-2, P2-12, P2-15): the nginx files in infra/nginx (the owner copies them to the server).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const proxy = readFileSync('infra/nginx/firtech-proxy.conf', 'utf8')
const site = readFileSync('infra/nginx/firtech.conf', 'utf8')
const code = (text) => text.replace(/#.*$/gm, '')

test('the proxy snippet sets X-Forwarded-For to the client address and X-Forwarded-Host to $host', () => {
  assert.match(code(proxy), /proxy_set_header X-Forwarded-For \$remote_addr;/)
  assert.match(code(proxy), /proxy_set_header X-Forwarded-Host \$host;/)
  assert.doesNotMatch(code(proxy), /proxy_add_x_forwarded_for/)
  assert.doesNotMatch(code(site), /proxy_add_x_forwarded_for|X-Forwarded-For/)
})

const block = (re) => {
  const m = new RegExp(`location ${re} \\{([^}]*)\\}`).exec(code(site))
  assert.ok(m, re)
  return m[1]
}

test('rate limits: login 10 r/min, chat and demo agents, audit, csp reports; every location uses the snippet', () => {
  assert.match(code(site), /limit_req_zone \$binary_remote_addr zone=firtech_login:10m rate=10r\/m;/)
  assert.match(code(site), /limit_req_zone \$binary_remote_addr zone=firtech_chat:10m rate=30r\/m;/)
  assert.match(code(site), /limit_req_status 429;/)
  assert.match(block('= /api/admin/login'), /limit_req zone=firtech_login /)
  assert.match(block('= /api/chat'), /limit_req zone=firtech_chat /)
  assert.match(block('\\^~ /api/demo-agent/'), /limit_req zone=firtech_chat /)
  assert.match(block('= /api/audit'), /limit_req zone=firtech_api /)
  assert.match(block('= /api/csp-report'), /limit_req zone=firtech_csp /)
  assert.match(block('\\^~ /agent/'), /include \/etc\/nginx\/snippets\/firtech-proxy\.conf;/)
  const locations = code(site).match(/location [^{]+\{[^}]*\}/g)
  for (const loc of locations) assert.match(loc, /include \/etc\/nginx\/snippets\/firtech-proxy\.conf;/, loc.split('{')[0])
  // The header documents every zone.
  for (const zone of ['firtech_api', 'firtech_login', 'firtech_chat', 'firtech_csp', 'firtech_admin']) assert.match(site.split('limit_req_zone')[0], new RegExp(zone))
})
