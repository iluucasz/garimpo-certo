import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { cachedQuery } from '@/lib/db/cached'
import { globalSettings } from '@/lib/db/schema'
import { normalizeSetting, settingDefinitions, type SettingKey, type SettingValue } from '@/lib/admin/settings-defs'

/** Linha gravada ou null. Sempre completa com os padrões na saída de `getSetting`. */
async function loadAll(): Promise<Record<string, unknown>> {
  const rows = await db.select().from(globalSettings)
  return Object.fromEntries(rows.map((row) => [row.key, row.value]))
}

const readAll = cachedQuery(loadAll, ['global-settings-v1'], ['settings'])

/** Valor efetivo de uma configuração: o gravado por cima dos padrões. Nunca lança por dado ruim. */
export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue> {
  const defaults = settingDefinitions[key].defaults
  try {
    const stored = (await readAll())[key]
    if (!stored || typeof stored !== 'object') return { ...defaults }
    return { ...defaults, ...(stored as SettingValue) }
  } catch {
    return { ...defaults }
  }
}

/** Grava (já validado). A chamada de quem altera deve invalidar a tag `settings`. */
export async function saveSetting(key: SettingKey, input: unknown) {
  const result = normalizeSetting(key, input)
  if ('errors' in result) return result
  const now = new Date().toISOString()
  await db.insert(globalSettings).values({ key, value: result.value, updatedAt: now })
    .onConflictDoUpdate({ target: globalSettings.key, set: { value: result.value, updatedAt: now } })
  return { value: result.value }
}

export async function readStoredSetting(key: SettingKey) {
  const [row] = await db.select().from(globalSettings).where(eq(globalSettings.key, key)).limit(1)
  return row ? { value: row.value as SettingValue, updatedAt: row.updatedAt } : null
}
