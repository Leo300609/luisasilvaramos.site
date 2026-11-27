import 'server-only'

import { after } from 'next/server'

import { log } from '@/lib/observability/log'

import { getDb } from '../db/client'
import { emailDeliveryDeps } from '../runtime'
import { deliverDueEmails } from './outbox'

/**
 * Sends queued e-mails right after the response, so the visitor never waits on
 * the provider. Anything that fails here stays in the outbox for the next run
 * (the next request, or the scheduled sweep in Phase 6).
 */
export function deliverEmailsAfterResponse(): void {
  after(async () => {
    try {
      const report = await deliverDueEmails(getDb(), emailDeliveryDeps(new Date()))
      if (report.sent || report.retried || report.failed || report.discarded) {
        log.info('email.delivery', report)
      }
    } catch (error) {
      log.error('email.delivery_failed', { error })
    }
  })
}
