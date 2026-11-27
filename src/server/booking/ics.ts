/**
 * iCalendar (RFC 5545) file for "Adicionar ao meu calendário" (Apple, Outlook,
 * Google import) plus a Google Calendar template link.
 */

export type CalendarEvent = {
  uid: string
  title: string
  description: string
  location: string
  start: Date
  end: Date
  url?: string
}

const stamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

/** Escapes TEXT values (RFC 5545 §3.3.11). */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Folds lines longer than 75 octets (RFC 5545 §3.1). */
export function foldLine(line: string): string {
  const bytes = Buffer.from(line, 'utf8')
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let current = ''
  for (const char of line) {
    if (Buffer.byteLength(current + char, 'utf8') > (parts.length ? 74 : 75)) {
      parts.push(current)
      current = char
    } else current += char
  }
  parts.push(current)
  return parts.join('\r\n ')
}

export function buildIcs(event: CalendarEvent, now: Date = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Luisa Silva Ramos//Agendamento//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(event.start)}`,
    `DTEND:${stamp(event.end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    `LOCATION:${escapeIcsText(event.location)}`,
    ...(event.url ? [`URL:${event.url}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Lembrete: maquiagem amanhã',
    'TRIGGER:-PT24H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

export function googleCalendarLink(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${stamp(event.start)}/${stamp(event.end)}`,
    details: event.description,
    location: event.location,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
