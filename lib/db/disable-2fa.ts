import { eq, sql } from 'drizzle-orm'
import { db } from './client'
import { twoFactor, users } from './schema'

/**
 * Recuperação de acesso: `pnpm db:disable-2fa <email>` desliga a verificação em duas etapas de uma conta
 * (para quem perdeu o celular e os códigos de recuperação). Quem roda tem acesso ao banco, então é o dono.
 */
async function main() {
  const email = process.argv[2]?.trim().toLowerCase()
  if (!email) { console.error('Uso: pnpm db:disable-2fa <email>'); process.exit(1) }
  const [user] = await db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.email})`, email))
  if (!user) { console.error(`Nenhuma conta com o e-mail ${email}.`); process.exit(1) }
  await db.delete(twoFactor).where(eq(twoFactor.userId, user.id))
  await db.update(users).set({ twoFactorEnabled: false }).where(eq(users.id, user.id))
  console.log(`Verificação em duas etapas desativada para ${email}. Peça para a pessoa ativar de novo em Minha conta › Segurança.`)
  process.exit(0)
}

if (process.argv[1]?.includes('disable-2fa')) main()
