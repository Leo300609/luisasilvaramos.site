/**
 * Travel fee and travel time (Phase 0, R4). All appointments happen at the
 * client's address; the Luísa leaves from her base address and comes back.
 */

export type TravelRules = {
  minFeeCents: number
  perKmCents: number
  maxRadiusKm: number
  /** Multiplier over the routing time (São Paulo traffic). */
  safetyFactor: number
}

export type Route = { distanceKm: number; durationMin: number }

export type TravelQuote =
  | { withinRadius: true; feeCents: number; toMin: number; backMin: number; distanceKm: number }
  | { withinRadius: false; distanceKm: number }

const FEE_ROUNDING_CENTS = 500
const TIME_ROUNDING_MIN = 15

/** Quote for a one-way route. Round trip is assumed symmetric. */
export function quoteTravel(route: Route, rules: TravelRules): TravelQuote {
  if (!(route.distanceKm >= 0) || !(route.durationMin >= 0)) {
    throw new Error('Invalid route')
  }
  const distanceKm = Math.round(route.distanceKm * 10) / 10
  if (distanceKm > rules.maxRadiusKm) return { withinRadius: false, distanceKm }

  const roundTripCents = Math.ceil(distanceKm * 2 * rules.perKmCents)
  const raw = Math.max(rules.minFeeCents, roundTripCents)
  const feeCents = Math.ceil(raw / FEE_ROUNDING_CENTS) * FEE_ROUNDING_CENTS

  const oneWay = Math.ceil((route.durationMin * rules.safetyFactor) / TIME_ROUNDING_MIN)
  const minutes = Math.max(1, oneWay) * TIME_ROUNDING_MIN
  return { withinRadius: true, feeCents, toMin: minutes, backMin: minutes, distanceKm }
}

export type GeoPoint = { lat: number; lng: number }

/** Source of routes (Google Routes / OpenRouteService in production; fake in tests). */
export interface RouteProvider {
  route(from: GeoPoint, to: GeoPoint): Promise<Route>
}

/**
 * Offline estimate: great-circle distance × 1.35 road factor at 22 km/h average
 * (urban São Paulo). Used in development/tests and as a fallback if the routing
 * API is down: it errs on the side of more time, never less.
 */
export class EstimatedRouteProvider implements RouteProvider {
  async route(from: GeoPoint, to: GeoPoint): Promise<Route> {
    const distanceKm = haversineKm(from, to) * 1.35
    return { distanceKm, durationMin: (distanceKm / 22) * 60 }
  }
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371
  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
