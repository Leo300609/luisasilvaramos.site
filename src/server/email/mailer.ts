/**
 * E-mail transport. Production uses Resend's HTTP API directly (no SDK: one
 * endpoint, fewer dependencies). Local development and E2E tests write each
 * message to a folder instead, so links can be opened without a real inbox.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type OutgoingEmail = {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
  /** Same key → the provider sends at most once (safe retries). */
  idempotencyKey: string
}

export interface Mailer {
  send(message: OutgoingEmail): Promise<{ id: string }>
}

/** `permanent` failures (bad address, rejected payload) are not retried. */
export class MailerError extends Error {
  constructor(
    message: string,
    readonly permanent: boolean,
  ) {
    super(message)
    this.name = 'MailerError'
  }
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: OutgoingEmail): Promise<{ id: string }> {
    let response: Response
    try {
      response = await this.fetchImpl(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': message.idempotencyKey,
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      })
    } catch (error) {
      throw new MailerError(`network: ${(error as Error).name}`, false)
    }
    if (response.ok) {
      const body = (await response.json().catch(() => ({}))) as { id?: string }
      return { id: body.id ?? 'unknown' }
    }
    // Only the status code is kept: provider messages may echo the address.
    const retryable = response.status === 429 || response.status >= 500
    throw new MailerError(`resend: HTTP ${response.status}`, !retryable)
  }
}

/** Writes messages to disk (development and E2E only; refused in production by runtime.ts). */
export class FileMailer implements Mailer {
  constructor(private readonly dir: string) {}

  async send(message: OutgoingEmail): Promise<{ id: string }> {
    await mkdir(this.dir, { recursive: true })
    const id = `${Date.now()}-${message.idempotencyKey.replace(/[^\w-]/g, '_')}`
    await writeFile(path.join(this.dir, `${id}.json`), JSON.stringify(message, null, 2))
    await writeFile(path.join(this.dir, `${id}.html`), message.html)
    return { id }
  }
}

/** In-memory transport for tests. */
export class MemoryMailer implements Mailer {
  readonly sent: OutgoingEmail[] = []
  failWith: MailerError | null = null

  async send(message: OutgoingEmail): Promise<{ id: string }> {
    if (this.failWith) throw this.failWith
    this.sent.push(message)
    return { id: `mem-${this.sent.length}` }
  }
}
