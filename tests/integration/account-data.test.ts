import { afterAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth/auth'
import { db } from '@/lib/db/client'
import { products, users, wishlistItems, wishlists } from '@/lib/db/schema'
import { GET as exportAccount } from '@/app/api/v1/me/export/route'

const createdUserIds: string[] = []

afterAll(async () => {
  if (createdUserIds.length) await db.delete(users).where(inArray(users.id, createdUserIds))
})

async function signUpWithCookie() {
  const email = `lgpd-${crypto.randomUUID()}@example.com`
  const password = 'senha-teste-123'
  const response = await auth.api.signUpEmail({ body: { email, password, name: 'Teste LGPD' }, asResponse: true })
  const cookie = response.headers.get('set-cookie')?.split(';')[0]
  if (!cookie) throw new Error('Cadastro de teste não retornou sessão.')
  const userId = (await response.clone().json()).user.id as string
  createdUserIds.push(userId)
  return { email, password, cookie, userId }
}

describe('dados da conta (LGPD)', () => {
  it('exportação exige sessão', async () => {
    const response = await exportAccount(new Request('http://localhost/api/v1/me/export'))
    expect(response.status).toBe(401)
  })

  it('exportação devolve só os dados da própria conta, incluindo favoritos', async () => {
    const { cookie, userId, email } = await signUpWithCookie()
    const [product] = await db.select({ id: products.id, slug: products.slug }).from(products).limit(1)
    const [list] = await db.insert(wishlists).values({ userId }).returning({ id: wishlists.id })
    await db.insert(wishlistItems).values({ wishlistId: list.id, productId: product.id })

    const response = await exportAccount(new Request('http://localhost/api/v1/me/export', { headers: { cookie } }))
    expect(response.status).toBe(200)
    const { data } = await response.json()
    expect(data.user).toMatchObject({ id: userId, email })
    expect(data.favorites).toEqual([expect.objectContaining({ productSlug: product.slug })])
    expect(JSON.stringify(data)).not.toMatch(/password|token/i)
  })

  it('excluir a conta exige a senha e apaga a conta e os favoritos', async () => {
    const { cookie, password, userId } = await signUpWithCookie()
    const [product] = await db.select({ id: products.id }).from(products).limit(1)
    const [list] = await db.insert(wishlists).values({ userId }).returning({ id: wishlists.id })
    await db.insert(wishlistItems).values({ wishlistId: list.id, productId: product.id })

    await expect(auth.api.deleteUser({ headers: { cookie }, body: { password: 'senha-errada-999' } })).rejects.toBeTruthy()
    expect((await db.select().from(users).where(eq(users.id, userId))).length).toBe(1)

    await auth.api.deleteUser({ headers: { cookie }, body: { password } })
    expect(await db.select().from(users).where(eq(users.id, userId))).toHaveLength(0)
    expect(await db.select().from(wishlists).where(eq(wishlists.userId, userId))).toHaveLength(0)
    expect(await db.select().from(wishlistItems).where(eq(wishlistItems.wishlistId, list.id))).toHaveLength(0)
  })
})
