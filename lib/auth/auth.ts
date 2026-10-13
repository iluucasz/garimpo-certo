import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { siteUrl } from '@/lib/site'
import { buildPasswordResetEmail, emailEnabled, sendEmail } from './email'

if (!process.env.BETTER_AUTH_SECRET) throw new Error('BETTER_AUTH_SECRET não configurado.')

// Links de e-mail e callbacks usam esta URL. Sem BETTER_AUTH_URL, vale o endereço público do site.
const baseURL = process.env.BETTER_AUTH_URL ?? siteUrl
if (process.env.NODE_ENV === 'production' && /localhost|127\.0\.0\.1/.test(baseURL)) {
  console.error(`[auth] BETTER_AUTH_URL aponta para ${baseURL} em produção: links de redefinição e logins sociais vão falhar.`)
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  advanced: {
    database: { generateId: 'uuid' },
  },
  emailAndPassword: {
    enabled: true,
    // Com BREVO_API_KEY e EMAIL_FROM o link é enviado por e-mail (Brevo). Sem eles, cai no log do servidor
    // (único jeito de recuperar o acesso nesse caso) e a tela avisa a pessoa de que o envio não está ativo.
    async sendResetPassword({ user, url }) {
      if (emailEnabled()) {
        const sent = await sendEmail({ to: user.email, ...buildPasswordResetEmail({ name: user.name, url }) })
        if (!sent) console.warn(`[auth] não foi possível enviar o e-mail de redefinição para ${user.email}`)
        return
      }
      console.info(`[auth] e-mail não configurado; link de redefinição para ${user.email}: ${url}`)
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
    // Exclusão pela própria pessoa (LGPD). Quem tem senha precisa confirmá-la; as FKs do banco fazem o cascade.
    deleteUser: { enabled: true },
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
