import type { Instrumentation } from 'next'

/** Runs once when the server boots: validate the environment and fail fast. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { env } = await import('@/env/server')
    const { log } = await import('@/lib/observability/log')
    log.info('server.boot', { appEnv: env.APP_ENV, commit: env.COMMIT_REF ?? 'local' })
  }
}

/** Server-side errors: logged without personal data (headers and query strings are dropped). */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { log } = await import('@/lib/observability/log')
  const error = err instanceof Error ? err : new Error(String(err))
  const digest =
    typeof err === 'object' && err !== null && 'digest' in err ? String(err.digest) : undefined
  log.error('request.error', {
    error,
    digest,
    method: request.method,
    path: request.path.split('?')[0],
    routePath: context.routePath,
    routeType: context.routeType,
  })
}
