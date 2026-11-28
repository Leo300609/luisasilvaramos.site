import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import * as schema from '@/server/db/schema'
import { hit } from '@/server/http/rate-limit'

import { NOW, openDb, resetData } from './helpers'

const db = openDb()
afterAll(() => db.$pool.end())
beforeEach(() => resetData(db))

const limit = { name: 'test', max: 3, windowSec: 600 }
const SECRET = 'secret-for-rate-limit-tests-0123456789'

describe('rate limit', () => {
  it('allows up to the limit per window and per IP, then asks to wait', async () => {
    for (let i = 0; i < 3; i++)
      await expect(hit(db, limit, '203.0.113.9', SECRET, NOW)).resolves.toEqual({ ok: true })
    const blocked = await hit(db, limit, '203.0.113.9', SECRET, NOW)
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0)
    await expect(hit(db, limit, '198.51.100.1', SECRET, NOW)).resolves.toEqual({ ok: true })
    await expect(
      hit(db, limit, '203.0.113.9', SECRET, new Date(NOW.getTime() + 600_000)),
    ).resolves.toEqual({ ok: true })
  })

  it('counts concurrent requests exactly and never stores the IP', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => hit(db, limit, '203.0.113.10', SECRET, NOW)),
    )
    expect(results.filter((r) => r.ok)).toHaveLength(3)
    const rows = await db.select().from(schema.rateLimits)
    expect(JSON.stringify(rows)).not.toContain('203.0.113')
  })
})
