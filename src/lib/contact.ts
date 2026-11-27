/**
 * Public contact data of the business. Values that are not public yet stay
 * undefined and the UI hides them (e.g. Instagram, still being created).
 */
export const CONTACT = {
  /** E.164 without "+", as wa.me expects. */
  whatsappE164: '5511930546322',
  whatsappDisplay: '(11) 93054-6322',
  instagramHandle: undefined as string | undefined,
} as const

/**
 * Builds a wa.me link with a pre-filled message. The text is percent-encoded,
 * so user-provided content cannot break out of the query string.
 */
export function whatsappLink(message?: string, phoneE164: string = CONTACT.whatsappE164): string {
  if (!/^\d{12,13}$/.test(phoneE164)) {
    throw new Error('whatsappLink: phone must be E.164 digits without "+" (e.g. 5511900000000)')
  }
  const base = `https://wa.me/${phoneE164}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}
