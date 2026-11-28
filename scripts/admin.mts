/**
 * Admin accounts of the panel (there is no sign-up page on purpose).
 *
 *   npm run admin -- criar --email luisa@exemplo.com --nome "Luísa Silva Ramos"
 *   npm run admin -- resetar-2fa --email luisa@exemplo.com
 *   npm run admin -- desativar --email ex-admin@exemplo.com
 *
 * The password is typed without echo (or read from ADMIN_PASSWORD in CI). On the
 * first login the user scans the QR code to set up the authenticator app.
 * Needs DATABASE_URL (or DATABASE_MIGRATION_URL) pointing at the target database.
 */
import { createInterface } from 'node:readline'

import { eq } from 'drizzle-orm'

import { createAdminUser, resetTwoFactor, revokeAllSessions } from '../src/server/auth/service'
import { passwordProblem } from '../src/server/auth/password'
import { createDatabase } from '../src/server/db/create'
import * as schema from '../src/server/db/schema'

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}
const command = process.argv[2]
const email = arg('email')?.trim().toLowerCase()

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    const output = rl as unknown as {
      _writeToOutput: (s: string) => void
      output: NodeJS.WriteStream
    }
    let prompted = false
    output._writeToOutput = (s: string) => {
      if (!prompted) {
        process.stdout.write(s)
        prompted = true
      }
    }
    rl.question(question, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
  })
}

async function readPassword(): Promise<string> {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD
  for (;;) {
    const first = await askHidden('Senha (mínimo 12 caracteres): ')
    const problem = passwordProblem(first, email ?? '')
    if (problem) {
      console.log(`  ${problem}`)
      continue
    }
    if ((await askHidden('Repita a senha: ')) === first) return first
    console.log('  As senhas não conferem.')
  }
}

const url = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL
if (!url) throw new Error('Defina DATABASE_URL (ou DATABASE_MIGRATION_URL).')
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Use --email <e-mail>.')

const db = createDatabase(url, 1)
const now = new Date()
try {
  switch (command) {
    case 'criar': {
      const name = arg('nome')
      if (!name) throw new Error('Use --nome "Nome completo".')
      const password = await readPassword()
      await createAdminUser(db, { email, name, password }, now)
      console.log(`Conta criada para ${email}. No primeiro login, configure o app autenticador.`)
      break
    }
    case 'resetar-2fa': {
      const ok = await resetTwoFactor(db, email, now)
      console.log(
        ok
          ? '2FA zerado. No próximo login a pessoa configura o app de novo.'
          : 'Conta não encontrada.',
      )
      break
    }
    case 'desativar': {
      const [user] = await db
        .update(schema.adminUsers)
        .set({ disabledAt: now })
        .where(eq(schema.adminUsers.email, email))
        .returning({ id: schema.adminUsers.id })
      if (user) await revokeAllSessions(db, user.id, now)
      console.log(
        user
          ? 'Conta desativada e desconectada de todos os dispositivos.'
          : 'Conta não encontrada.',
      )
      break
    }
    default:
      throw new Error('Comandos: criar | resetar-2fa | desativar')
  }
} finally {
  await db.$pool.end()
}
