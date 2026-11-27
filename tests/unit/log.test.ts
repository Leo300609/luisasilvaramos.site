import { describe, expect, it } from 'vitest'

import { createLogger, redact, scrubString } from '@/lib/observability/log'

describe('scrubString', () => {
  it('removes e-mails, CPFs and Brazilian phones', () => {
    expect(scrubString('cliente maria@example.com ligou')).toBe('cliente [email] ligou')
    expect(scrubString('CPF 123.456.789-09')).toBe('CPF [cpf]')
    expect(scrubString('zap (11) 93054-6322')).toBe('zap [phone]')
    expect(scrubString('zap +55 11 930546322')).toBe('zap [phone]')
  })

  it('keeps ids, codes and timestamps intact', () => {
    expect(scrubString('booking LSR-0042 at 1795789402945')).toBe(
      'booking LSR-0042 at 1795789402945',
    )
  })
})

describe('redact', () => {
  it('hides sensitive keys at any depth', () => {
    expect(
      redact({ bookingId: 'b1', customer: { name: 'Ana', email: 'a@b.co', notes: 'alergia' } }),
    ).toEqual({
      bookingId: 'b1',
      customer: { name: '[redacted]', email: '[redacted]', notes: '[redacted]' },
    })
    expect(redact({ password: 'x', token: 'y', authorization: 'z' })).toEqual({
      password: '[redacted]',
      token: '[redacted]',
      authorization: '[redacted]',
    })
  })
})

describe('createLogger', () => {
  it('writes one JSON line per entry and respects the level', () => {
    const lines: string[] = []
    const logger = createLogger({ level: 'info', sink: (line) => lines.push(line) })
    logger.debug('hidden')
    logger.info('booking.created', { bookingId: 'b1', email: 'x@y.com' })
    expect(lines).toHaveLength(1)
    const entry = JSON.parse(lines[0] ?? '{}')
    expect(entry).toMatchObject({
      level: 'info',
      msg: 'booking.created',
      bookingId: 'b1',
      email: '[redacted]',
    })
    expect(typeof entry.time).toBe('string')
  })

  it('child loggers carry base fields', () => {
    const lines: string[] = []
    createLogger({ sink: (l) => lines.push(l) })
      .child({ requestId: 'r1' })
      .warn('slow')
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({ requestId: 'r1', level: 'warn' })
  })
})
