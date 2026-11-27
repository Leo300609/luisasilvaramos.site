/**
 * Minimal structured logger (one JSON object per line).
 *
 * Rule: logs must not contain personal data (LGPD). Pass IDs, never names,
 * phones, e-mails, addresses or notes. As a safety net, keys that usually hold
 * personal or secret data are redacted, and string values are scrubbed of
 * e-mails, CPFs and Brazilian phone numbers.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogFields = Record<string, unknown>

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

const SENSITIVE_KEY =
  /(pass(word)?|secret|token|authorization|cookie|session|otp|totp|cpf|email|e-mail|phone|whats|telefone|celular|nome|name|address|endereco|endereço|cep|notes?|observa|alerg|ip)$/i

const PATTERNS: Array<[RegExp, string]> = [
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]'],
  [/(?<![\w.])\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?![\w])/g, '[cpf]'],
  [/(?<![\w+])(\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}-?\d{4}(?![\w])/g, '[phone]'],
]

export function scrubString(value: string): string {
  return PATTERNS.reduce((text, [pattern, label]) => text.replace(pattern, label), value)
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[depth]'
  if (typeof value === 'string') return scrubString(value)
  if (value instanceof Error) {
    return { name: value.name, message: scrubString(value.message), stack: value.stack }
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        SENSITIVE_KEY.test(key) ? '[redacted]' : redact(inner, depth + 1),
      ]),
    )
  }
  return value
}

type Sink = (line: string, level: LogLevel) => void

const defaultSink: Sink = (line, level) => {
  if (level === 'error' || level === 'warn') console.error(line)
  else console.log(line)
}

export function createLogger(options: { level?: LogLevel; sink?: Sink; base?: LogFields } = {}) {
  const minLevel = options.level ?? (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info'
  const sink = options.sink ?? defaultSink
  const base = options.base ?? {}

  const write = (level: LogLevel, msg: string, fields: LogFields = {}) => {
    if (LEVEL_WEIGHT[level] < (LEVEL_WEIGHT[minLevel] ?? LEVEL_WEIGHT.info)) return
    const entry = {
      time: new Date().toISOString(),
      level,
      msg: scrubString(msg),
      ...(redact({ ...base, ...fields }) as LogFields),
    }
    sink(JSON.stringify(entry), level)
  }

  return {
    debug: (msg: string, fields?: LogFields) => write('debug', msg, fields),
    info: (msg: string, fields?: LogFields) => write('info', msg, fields),
    warn: (msg: string, fields?: LogFields) => write('warn', msg, fields),
    error: (msg: string, fields?: LogFields) => write('error', msg, fields),
    child: (fields: LogFields) =>
      createLogger({ level: minLevel, sink, base: { ...base, ...fields } }),
  }
}

export const log = createLogger()
