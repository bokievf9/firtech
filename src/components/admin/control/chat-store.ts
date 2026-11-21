import { keepLast, readChat, type ChatMessage } from '@/lib/hq-admin-view'
import { storedValue } from './api'

// The last 50 messages of the Director conversation (sessionStorage of this tab), shared through
// useSyncExternalStore so the server render and the first client render agree (both empty) and the
// kept messages appear after. «Поручения» draws them in its timeline next to the tasks.
export const chat = storedValue<ChatMessage[]>('firtech-cc-chat', 'session', readChat, [])

let seq = 0
const newId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`
export const pushChat = (...messages: Omit<ChatMessage, 'id' | 'at'>[]) =>
  chat.set(keepLast([...chat.get(), ...messages.map((m) => ({ ...m, id: newId(), at: new Date().toISOString() }))]))
