import 'server-only'
import { z } from 'zod'
import schedule from '../content/ig-schedule.json' with { type: 'json' }
import { jsonFile } from './json-file'
import type { IgDay, IgItem } from './pulse-types'

// Instagram calendar and daily numbers: $DATA_DIR/instagram.json. A missing file is seeded from
// the committed schedule (src/content/ig-schedule.json, see scripts/instagram-seed.mjs).

type Db = { items: IgItem[]; days: IgDay[] }

const seed = (): Db => ({
  items: (schedule as Omit<IgItem, 'published' | 'publishedAt'>[]).map((item) => ({
    ...item,
    published: false,
    publishedAt: null,
  })),
  days: [],
})
const file = jsonFile<Db>('instagram.json', seed)

const count = z.number().int().min(0).max(1_000_000_000).nullable()
export const igDaySchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => {
        const date = new Date(`${value}T00:00:00Z`)
        return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
      }),
    followers: count,
    reach: count,
  })
  .strict()
export const igPublishedSchema = z.object({ published: z.boolean() }).strict()

export async function listIgItems(): Promise<IgItem[]> {
  return (await file.load()).items
}

export function setIgPublished(id: string, published: boolean): Promise<IgItem | null> {
  return file.serialize(async () => {
    const db = await file.load()
    const item = db.items.find((i) => i.id === id)
    if (!item) return null
    if (item.published !== published) {
      item.published = published
      item.publishedAt = published ? new Date().toISOString() : null
    }
    await file.save(db)
    return item
  })
}

export async function listIgDays(): Promise<IgDay[]> {
  return (await file.load()).days
}

export async function setIgDay(input: IgDay): Promise<IgDay> {
  const day = igDaySchema.parse(input)
  return file.serialize(async () => {
    const db = await file.load()
    const at = db.days.findIndex((d) => d.date === day.date)
    if (at >= 0) db.days[at] = day
    else db.days.push(day)
    db.days.sort((a, b) => a.date.localeCompare(b.date))
    await file.save(db)
    return day
  })
}
