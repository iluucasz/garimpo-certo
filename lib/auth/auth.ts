import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'

if (!process.env.BETTER_AUTH_SECRET) throw new Error('BETTER_AUTH_SECRET não configurado.')

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  advanced: {
    database: { generateId: 'uuid' },
  },
  emailAndPassword: {
    enabled: true,
    // Nenhum provedor de e-mail está configurado ainda: o link de reset só é logado no servidor.
    async sendResetPassword({ user, url }) {
      console.info(`[auth] link de redefinição de senha para ${user.email}: ${url}`)
    },
  },
  // "Continuar com o Google" só fica ativo quando as credenciais existem — sem elas o botão
  // aparece na UI mas o provedor retorna erro ao ser acionado.
  socialProviders: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  } : undefined,
  user: {
    modelName: 'users',
  },
  session: {
    modelName: 'sessions',
  },
  account: {
    modelName: 'accounts',
    fields: {
      accessToken: 'accessTokenEncrypted',
      refreshToken: 'refreshTokenEncrypted',
      password: 'passwordHash',
    },
  },
  verification: {
    modelName: 'verifications',
  },
})
