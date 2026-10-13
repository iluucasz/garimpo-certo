import { headers } from 'next/headers'
import { auth } from '@/lib/auth/auth'
import { userHasPermission } from '@/lib/auth/permissions'

/** `?preview=1` mostra o rascunho do editor, só para quem pode editar conteúdo; para os demais é ignorado. */
export async function canPreviewDrafts() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    return Boolean(session && await userHasPermission(session.user.id, 'content:write'))
  } catch {
    return false
  }
}
