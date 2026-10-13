import { eq } from 'drizzle-orm'
import { recordAudit } from '@/lib/admin/audit'
import { isSettingKey, settingDefinitions } from '@/lib/admin/settings-defs'
import { db } from '@/lib/db/client'
import { invalidate } from '@/lib/db/invalidate'
import { globalSettings } from '@/lib/db/schema'
import { authorize, fail, jsonBody, ok } from '@/lib/server/api'
import { readStoredSetting, saveSetting } from '@/lib/settings'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ key: string }> }

function refresh() {
  invalidate('settings', 'catalog')
}

export async function GET(request: Request, { params }: Context) {
  const { key } = await params
  if (!isSettingKey(key)) return fail('Configuração desconhecida.', 404)
  const { blocked } = await authorize(request, 'catalog:read')
  if (blocked) return blocked
  const stored = await readStoredSetting(key)
  return ok({ key, value: { ...settingDefinitions[key].defaults, ...(stored?.value ?? {}) }, updatedAt: stored?.updatedAt ?? null, isDefault: !stored })
}

export async function PUT(request: Request, { params }: Context) {
  const { key } = await params
  if (!isSettingKey(key)) return fail('Configuração desconhecida.', 404)
  const { blocked, userId } = await authorize(request, settingDefinitions[key].permission)
  if (blocked) return blocked
  const body = await jsonBody<unknown>(request)
  if (body === null) return fail('Corpo da requisição inválido.', 400)
  const before = await readStoredSetting(key)
  const result = await saveSetting(key, body)
  if ('errors' in result) return fail('Revise os campos destacados.', 422, result.errors)
  await recordAudit({ actorUserId: userId, action: `settings.${key}.update`, entityType: 'configuração', entityId: key, before: before?.value ?? settingDefinitions[key].defaults, after: result.value })
  refresh()
  return ok({ key, value: result.value })
}

/** Volta a configuração aos padrões (apaga a linha gravada). */
export async function DELETE(request: Request, { params }: Context) {
  const { key } = await params
  if (!isSettingKey(key)) return fail('Configuração desconhecida.', 404)
  const { blocked, userId } = await authorize(request, settingDefinitions[key].permission)
  if (blocked) return blocked
  const before = await readStoredSetting(key)
  await db.delete(globalSettings).where(eq(globalSettings.key, key))
  await recordAudit({ actorUserId: userId, action: `settings.${key}.reset`, entityType: 'configuração', entityId: key, before: before?.value })
  refresh()
  return ok({ key, value: settingDefinitions[key].defaults })
}
