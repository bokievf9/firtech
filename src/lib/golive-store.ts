import 'server-only'
import { applyAction, emptyGolive, sanitize, type GoliveAction, type GoliveState } from './golive'
import { jsonFile } from './json-file'

// $DATA_DIR/golive.json: the go-live timer, ticked items and the owner's short notes. Same safe
// writes as the lead store (queue, temp file + rename). Back it up together with leads.json.
const file = jsonFile<GoliveState>('golive.json', emptyGolive)

export async function getGolive(): Promise<GoliveState> {
  return sanitize(await file.load())
}

export function updateGolive(action: GoliveAction, now = Date.now()): Promise<GoliveState> {
  return file.serialize(async () => {
    const next = applyAction(sanitize(await file.load()), action, now)
    await file.save(next)
    return next
  })
}
