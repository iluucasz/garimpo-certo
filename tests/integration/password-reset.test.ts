import { afterAll, describe, expect, it } from 'vitest'
import { and, eq, inArray, like } from 'drizzle-orm'
import { auth } from '@/lib/auth/auth'
import { db } from '@/lib/db/client'
import { users, verifications } from '@/lib/db/schema'

const createdUserIds: string[] = []

afterAll(async () => {
  if (createdUserIds.length) {
    await db.delete(verifications).where(inArray(verifications.value, createdUserIds))
    await db.delete(users).where(inArray(users.id, createdUserIds))
  }
})

describe('redefinição de senha', () => {
  it('pedido → token → nova senha → login com a nova e recusa da antiga', async () => {
    const email = `reset-${crypto.randomUUID()}@example.com`
    const oldPassword = 'senha-antiga-123'
    const newPassword = 'senha-nova-456'

    const signUp = await auth.api.signUpEmail({ body: { email, password: oldPassword, name: 'Teste Reset' } })
    createdUserIds.push(signUp.user.id)

    await auth.api.requestPasswordReset({ body: { email, redirectTo: '/redefinir-senha' } })

    // O token fica na tabela de verificações como "reset-password:<token>" com o id do usuário como valor.
    const [row] = await db.select().from(verifications).where(and(like(verifications.identifier, 'reset-password:%'), eq(verifications.value, signUp.user.id)))
    expect(row, 'pedido deveria gerar um token de redefinição').toBeTruthy()
    const token = row.identifier.replace('reset-password:', '')

    const reset = await auth.api.resetPassword({ body: { newPassword, token } })
    expect(reset.status).toBe(true)

    const signedIn = await auth.api.signInEmail({ body: { email, password: newPassword } })
    expect(signedIn.user.id).toBe(signUp.user.id)
    await expect(auth.api.signInEmail({ body: { email, password: oldPassword } })).rejects.toBeTruthy()
  })

  it('token inválido é recusado', async () => {
    await expect(auth.api.resetPassword({ body: { newPassword: 'qualquer-senha-123', token: 'token-inexistente' } })).rejects.toBeTruthy()
  })
})
