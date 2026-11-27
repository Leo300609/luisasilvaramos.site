/** Business errors with stable codes the UI maps to the design's states. */
export type BookingErrorCode =
  | 'invalid-input'
  | 'service-unavailable'
  /** Design state: "Esse horário acabou de ser reservado" (form data is kept). */
  | 'slot-taken'
  | 'event-too-early'
  | 'too-many-pending'
  | 'consent-required'

export class BookingError extends Error {
  constructor(
    readonly code: BookingErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'BookingError'
  }
}
