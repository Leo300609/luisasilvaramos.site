import { describe, expect, it } from 'vitest'

import { EstimatedRouteProvider, haversineKm, quoteTravel } from '@/server/scheduling/travel'

const rules = { minFeeCents: 3000, perKmCents: 250, maxRadiusKm: 40, safetyFactor: 1.3 }

describe('quoteTravel', () => {
  it('charges the minimum fee for short trips', () => {
    expect(quoteTravel({ distanceKm: 3, durationMin: 10 }, rules)).toEqual({
      withinRadius: true,
      feeCents: 3000,
      toMin: 15,
      backMin: 15,
      distanceKm: 3,
    })
  })

  it('charges per km of the round trip, rounded up to R$ 5', () => {
    // 12.3 km × 2 × R$ 2,50 = R$ 61,50 → R$ 65,00; 32 min × 1.3 = 41.6 → 45 min
    expect(quoteTravel({ distanceKm: 12.3, durationMin: 32 }, rules)).toMatchObject({
      feeCents: 6500,
      toMin: 45,
      backMin: 45,
    })
  })

  it('refuses addresses beyond the service radius', () => {
    expect(quoteTravel({ distanceKm: 40.1, durationMin: 60 }, rules)).toEqual({
      withinRadius: false,
      distanceKm: 40.1,
    })
  })

  it('never returns zero travel time', () => {
    expect(quoteTravel({ distanceKm: 0, durationMin: 0 }, rules)).toMatchObject({ toMin: 15 })
  })

  it('rejects invalid routes', () => {
    expect(() => quoteTravel({ distanceKm: Number.NaN, durationMin: 1 }, rules)).toThrow()
  })
})

describe('route estimation', () => {
  it('haversine: Praça da Sé → Av. Paulista ≈ 2.6 km', () => {
    const km = haversineKm({ lat: -23.5503, lng: -46.6339 }, { lat: -23.5614, lng: -46.6559 })
    expect(km).toBeGreaterThan(2.4)
    expect(km).toBeLessThan(2.8)
  })

  it('estimated provider is conservative (road factor and slow urban speed)', async () => {
    const route = await new EstimatedRouteProvider().route(
      { lat: -23.5503, lng: -46.6339 },
      { lat: -23.5614, lng: -46.6559 },
    )
    expect(route.distanceKm).toBeGreaterThan(3.3)
    expect(route.durationMin).toBeGreaterThan(9)
  })
})
