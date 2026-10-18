import 'server-only'
import type { IgDay, IgItem } from './pulse-types'

// STUB of the contract: the `pulse-data` branch replaces this file with the real store
// ($DATA_DIR/instagram.json, seeded from src/content/ig-schedule.json on first read).
export async function listIgItems(): Promise<IgItem[]> {
  return []
}
export async function setIgPublished(_id: string, _published: boolean): Promise<IgItem | null> {
  throw new Error('instagram-store: not implemented')
}
export async function listIgDays(): Promise<IgDay[]> {
  return []
}
export async function setIgDay(_day: IgDay): Promise<IgDay> {
  throw new Error('instagram-store: not implemented')
}
