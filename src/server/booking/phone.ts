/** Normalizes a Brazilian phone to E.164 digits without "+" (e.g. 5511912345678). */
export function normalizeBrazilianPhone(value: string): string | null {
  let digits = value.replace(/\D/g, '')
  if (/^55\d{10,11}$/.test(digits)) digits = digits.slice(2)
  if (!/^[1-9]{2}9?\d{8}$/.test(digits)) return null
  return `55${digits}`
}
