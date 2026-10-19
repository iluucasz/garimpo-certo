'use client'

import { createAuthClient } from 'better-auth/react'
import { twoFactorClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  plugins: [twoFactorClient()],
  // No navegador, sempre o endereço em que a pessoa está: uma URL fixa em outro domínio (ex.: o .vercel.app com o site
  // aberto em www.garimpoucerto.com.br) vira chamada entre origens, que o navegador bloqueia sem avisar e o botão "não faz nada".
  baseURL: typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? 'http://localhost:3000'),
})

export const { useSession, signIn, signUp, signOut, requestPasswordReset, resetPassword, updateUser, deleteUser, twoFactor } = authClient
