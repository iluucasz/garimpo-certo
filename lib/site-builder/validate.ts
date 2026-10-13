/** Pequenas validações compartilhadas pelo documento da página e pelo design global. Isomórfico. */

export const safeLink = (value: string) => !/[\s\\]/.test(value) && (/^https:\/\/[^/\s]+/i.test(value) || /^\/(?!\/)/.test(value) || /^#[a-z][\w-]*$/i.test(value))
export const safeImage = (value: string) => !/[\s\\]/.test(value) && (/^https:\/\/[^/\s]+/i.test(value) || /^\/(?!\/)/.test(value))

export const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim().slice(0, max) : '')

export const isHex = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)

export const newId = () => `s_${Math.random().toString(36).slice(2, 10)}`

export type DocumentErrors = Record<string, string>
