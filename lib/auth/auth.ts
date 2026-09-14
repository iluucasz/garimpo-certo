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
    // Mesmo e-mail = mesma conta: entrar com o Google vincula à conta de e-mail/senha existente
    // (e vice-versa), e a pessoa pode usar os dois métodos. Como ainda não há envio de e-mail de
    // verificação, as contas de senha nunca ficam com emailVerified=true — sem desligar
    // requireLocalEmailVerified o Better Auth recusaria o vínculo com "account_not_linked".
    accountLinking: {
      enabled: true,
      trustedProviders: ['google'],
      requireLocalEmailVerified: false,
    },
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
