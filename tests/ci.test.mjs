// Security 2026-11-23, P1-5: CI actions pinned by SHA; the restricted CI user's forced command and the
// activator refuse anything but one clean release tarball.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

test('every GitHub action is pinned by a full commit SHA', () => {
  for (const file of readdirSync('.github/workflows')) {
    const yml = readFileSync(join('.github/workflows', file), 'utf8')
    const uses = [...yml.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)].map((m) => m[1])
    assert.ok(uses.length > 0, file)
    for (const u of uses) assert.match(u, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, `${file}: ${u}`)
  }
})

test('the receive path is behind DEPLOY_RECEIVE and sends only the release id and the tarball', () => {
  const yml = readFileSync('.github/workflows/deploy.yml', 'utf8')
  assert.match(yml, /if: vars\.DEPLOY_RECEIVE == '1'/)
  assert.match(yml, /"\$VPS_USER@\$VPS_HOST" "\$RELEASE" < release\.tgz/)
  const setup = readFileSync('scripts/deploy/ci-user-setup.sh', 'utf8')
  assert.match(setup, /command="\/usr\/local\/bin\/firtech-receive\.sh",restrict/)
  assert.doesNotMatch(setup, /usermod -aG [^\n]*(sudo|docker)[^\n]*firtech-ci/)
  assert.match(setup, /gpasswd -d firtech-ci sudo/)
  assert.match(setup, /gpasswd -d firtech-ci docker/)
  assert.match(setup, /chown root:root \/home\/firtech-ci\/\.ssh\/authorized_keys/)
})

test('receive.sh refuses a command that is not a release id', () => {
  for (const cmd of ['', 'whoami', 'rm -rf /', '20261123101500-abcdef0; id', '../20261123101500-abcdef0']) {
    const r = spawnSync('bash', ['scripts/deploy/receive.sh'], { env: { PATH: process.env.PATH, SSH_ORIGINAL_COMMAND: cmd }, input: '' })
    assert.equal(r.status, 2, cmd)
    assert.match(r.stderr.toString(), /refused/)
  }
})

const ID = '20261123101500-abcdef0'

function sandbox() {
  const app = mkdtempSync(join(tmpdir(), 'ci-act-'))
  for (const d of ['incoming/ready', 'ci-status', 'releases']) mkdirSync(join(app, d), { recursive: true })
  const activate = join(app, 'fake-activate.sh')
  writeFileSync(activate, '#!/usr/bin/env bash\necho "activated $1"\ntest -f "$FIRTECH_APP/releases/$1/server.js"\n', { mode: 0o755 })
  return { app, activate }
}

function run({ app, activate }) {
  return spawnSync('bash', [resolve('scripts/deploy/activate-incoming.sh')], {
    env: { PATH: process.env.PATH, FIRTECH_APP: app, FIRTECH_ACTIVATE: activate },
  })
}

function tarball(app, top, build) {
  const work = mkdtempSync(join(tmpdir(), 'ci-src-'))
  build(work)
  execFileSync('tar', ['-czf', join(app, 'incoming', `${ID}.tgz`), '-C', work, top])
  rmSync(work, { recursive: true, force: true })
  writeFileSync(join(app, 'incoming', 'ready', ID), '')
}

test('activator: a clean release is unpacked and activated, the marker and tarball are gone', () => {
  const s = sandbox()
  tarball(s.app, ID, (w) => {
    mkdirSync(join(w, ID))
    writeFileSync(join(w, ID, 'server.js'), '')
  })
  assert.equal(run(s).status, 0)
  assert.match(readFileSync(join(s.app, 'ci-status', `${ID}.ok`), 'utf8'), new RegExp(`activated ${ID}`))
  assert.ok(!existsSync(join(s.app, 'incoming', `${ID}.tgz`)))
  assert.ok(!existsSync(join(s.app, 'incoming', 'ready', ID)))
  rmSync(s.app, { recursive: true, force: true })
})

test('activator: entries outside <id>/ or symlinks are refused and nothing is activated', () => {
  const outside = sandbox()
  tarball(outside.app, 'other', (w) => {
    mkdirSync(join(w, 'other'))
    writeFileSync(join(w, 'other', 'server.js'), '')
  })
  run(outside)
  assert.match(readFileSync(join(outside.app, 'ci-status', `${ID}.fail`), 'utf8'), /refused/)
  assert.ok(!existsSync(join(outside.app, 'releases', 'other')))
  rmSync(outside.app, { recursive: true, force: true })

  const linked = sandbox()
  tarball(linked.app, ID, (w) => {
    mkdirSync(join(w, ID))
    writeFileSync(join(w, ID, 'server.js'), '')
    symlinkSync('/etc/passwd', join(w, ID, 'passwd'))
  })
  run(linked)
  assert.match(readFileSync(join(linked.app, 'ci-status', `${ID}.fail`), 'utf8'), /refused: links/)
  assert.ok(!existsSync(join(linked.app, 'releases', ID)))
  rmSync(linked.app, { recursive: true, force: true })
})
