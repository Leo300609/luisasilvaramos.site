/**
 * Sets the Luísa's departure address (encrypted), used to compute travel.
 * Until the admin panel (Phase 5) exists, run:
 *   npm run db:set-base -- --cep 01310-100 --number 1000
 * The CEP is looked up on BrasilAPI; coordinates and address are stored encrypted.
 * For tests only: --lat -23.56 --lng -46.65 skips the lookup.
 */
import { eq } from 'drizzle-orm'

import { lookupCep } from '../src/server/booking/quote'
import { encryptField, parseKeyRing } from '../src/server/crypto/fields'
import { createDatabase } from '../src/server/db/create'
import * as schema from '../src/server/db/schema'

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}

const url = process.env.DATABASE_URL
if (!url) throw new Error('Set DATABASE_URL')
const ring = parseKeyRing(process.env.ENC_KEYS, process.env.ENC_ACTIVE_KEY)

let location: { lat: number; lng: number }
let address: string
if (arg('lat') && arg('lng')) {
  location = { lat: Number(arg('lat')), lng: Number(arg('lng')) }
  address = arg('address') ?? 'Endereço-base (teste)'
} else {
  const cep = arg('cep')
  if (!cep) throw new Error('Use --cep <CEP> --number <número>')
  const found = await lookupCep(cep)
  if (!found?.location) throw new Error('CEP sem coordenadas na BrasilAPI. Use --lat/--lng.')
  location = found.location
  address = `${found.street}, ${arg('number') ?? 's/n'} · ${found.neighborhood} · ${found.city}/${found.state}`
}

const db = createDatabase(url, 1)
try {
  await db
    .update(schema.scheduleSettings)
    .set({
      baseAddressEnc: encryptField(address, ring, 'schedule_settings.base_address'),
      baseLocationEnc: encryptField(
        JSON.stringify(location),
        ring,
        'schedule_settings.base_location',
      ),
    })
    .where(eq(schema.scheduleSettings.id, 1))
  console.log('Endereço-base salvo (cifrado).')
} finally {
  await db.$pool.end()
}
