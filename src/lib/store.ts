import 'server-only'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Lead } from './lead'

// Leads live in one JSON file on the VPS. The site runs as a single long-lived Node process (PM2),
// so a write queue in memory is enough to keep writes from overlapping; no database needed.

export const leadStatuses = ['new', 'taken', 'called', 'won', 'lost'] as const
export type LeadStatus = (typeof leadStatuses)[number]

export type Booking = {
  // Slot start, UTC ISO string (see booking.ts).
  slot: string
  // pending: chosen by the visitor; confirmed: by the owner; released: owner asked to move it, so
  // the slot is free again.
  state: 'pending' | 'confirmed' | 'released'
}

export type StoredLead = Omit<Lead, 'website' | 'slot'> & {
  id: number
  createdAt: string
  status: LeadStatus
  clientChatId?: number
  booking?: Booking
  // Owner's Telegram message for this lead, so it can be edited when something changes.
  ownerMessageId?: number
  // False until the owner message went through; used to resend leads saved while Telegram was down.
  notified: boolean
  note?: string
  // Owner's private notes from the admin panel; never sent anywhere. Older leads simply lack it.
  notes?: string
  // Email of the cabinet account that sent the lead (since 2026-11-20); older leads lack it.
  account?: string
  // P-01: the copy for HQ (Lead Intake). `false` until HQ confirmed it; undelivered leads are retried
  // (`lead-retry.ts`). Older leads lack the field and are never retried.
  hqForwarded?: boolean
  hqAttempts?: number
  hqLastAttemptAt?: string
  // HQ's lead id once confirmed; the cabinet link uses it.
  hqLeadId?: number
  // Who sent it (cabinet account), kept so a retry carries the same identity as the first try.
  hqIdentity?: { clientEmail: string; cabinetId: string; clientName: string }
}

type Db = { nextId: number; leads: StoredLead[] }

export class SlotTakenError extends Error {
  constructor() {
    super('slot_taken')
  }
}

export function dataDir() {
  // Runtime folder, not part of the build: the ignore comment keeps Turbopack from tracing it.
  return path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || './data')
}

const fileName = () => path.join(dataDir(), 'leads.json')

async function load(): Promise<Db> {
  try {
    return JSON.parse(await readFile(fileName(), 'utf8')) as Db
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { nextId: 1, leads: [] }
    // A broken file must not be overwritten with an empty list: fail loudly instead.
    throw error
  }
}

// Temp file + rename: a crash mid-write leaves the old file intact, never half a JSON.
async function save(db: Db) {
  await mkdir(dataDir(), { recursive: true })
  const tmp = `${fileName()}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(db, null, 2))
  await rename(tmp, fileName())
}

let queue: Promise<unknown> = Promise.resolve()

// Every read-modify-write goes through this chain, one at a time.
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task)
  queue = run.catch(() => {})
  return run
}

const activeSlot = (lead: StoredLead) =>
  lead.booking && lead.booking.state !== 'released' ? lead.booking.slot : null

export function createLead(
  lead: Lead & { account?: string },
  slot?: string,
  identity?: StoredLead['hqIdentity'] | null,
): Promise<StoredLead> {
  return serialize(async () => {
    const db = await load()
    // Checked inside the queue, so two visitors can't take the same slot at the same moment.
    if (slot && db.leads.some((l) => activeSlot(l) === slot)) throw new SlotTakenError()
    const { website: _website, slot: _slot, ...fields } = lead
    void _website
    void _slot
    const stored: StoredLead = {
      ...fields,
      id: db.nextId,
      createdAt: new Date().toISOString(),
      status: 'new',
      notified: false,
      hqForwarded: false,
      ...(identity ? { hqIdentity: identity } : {}),
      ...(slot ? { booking: { slot, state: 'pending' as const } } : {}),
    }
    db.nextId += 1
    db.leads.push(stored)
    await save(db)
    return stored
  })
}

export function updateLead(
  id: number,
  change: (lead: StoredLead) => void,
): Promise<StoredLead | null> {
  return serialize(async () => {
    const db = await load()
    const lead = db.leads.find((l) => l.id === id)
    if (!lead) return null
    change(lead)
    await save(db)
    return lead
  })
}

export async function getLead(id: number) {
  return (await load()).leads.find((l) => l.id === id) ?? null
}

// Newest first.
export async function listLeads(limit = 10) {
  return (await load()).leads.slice(-limit).reverse()
}

// Every lead, oldest first (the admin panel filters and sorts on its own).
export async function allLeads() {
  return (await load()).leads
}

export async function bookedSlots() {
  return (await load()).leads.map(activeSlot).filter((s): s is string => Boolean(s))
}

// P-01: leads HQ has not confirmed yet (explicit `false`, so leads from before the field are skipped).
export async function unforwardedLeads() {
  return (await load()).leads.filter((l) => l.hqForwarded === false)
}

export async function unnotifiedLeads(exceptId?: number) {
  return (await load()).leads.filter((l) => !l.notified && l.id !== exceptId)
}
