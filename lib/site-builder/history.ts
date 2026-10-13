/**
 * Histórico de edição (desfazer/refazer) do editor visual. Puro e sem React, para testar sem navegador.
 *
 * Alterações seguidas no mesmo campo (`group`) dentro de uma janela curta viram um só passo: digitar um
 * título inteiro desfaz de uma vez, não letra por letra.
 */

export const HISTORY_DEPTH = 60
export const GROUP_WINDOW_MS = 900

export type History<T> = {
  present: T
  past: T[]
  future: T[]
  lastGroup: string
  lastAt: number
}

export const createHistory = <T,>(present: T): History<T> => ({ present, past: [], future: [], lastGroup: '', lastAt: 0 })

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Registra uma alteração. Sem mudança real, devolve o mesmo objeto. */
export function pushChange<T>(history: History<T>, next: T, group = '', now = Date.now()): History<T> {
  if (same(history.present, next)) return history
  const merge = group !== '' && group === history.lastGroup && now - history.lastAt < GROUP_WINDOW_MS && history.past.length > 0
  return {
    present: next,
    // Dentro de um grupo, o ponto de retorno continua sendo o estado anterior ao primeiro toque.
    past: merge ? history.past : [...history.past, history.present].slice(-HISTORY_DEPTH),
    future: [],
    lastGroup: group,
    lastAt: now,
  }
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1)
  if (previous === undefined) return history
  return { present: previous, past: history.past.slice(0, -1), future: [history.present, ...history.future], lastGroup: '', lastAt: 0 }
}

export function redo<T>(history: History<T>): History<T> {
  const [next, ...rest] = history.future
  if (next === undefined) return history
  return { present: next, past: [...history.past, history.present].slice(-HISTORY_DEPTH), future: rest, lastGroup: '', lastAt: 0 }
}

export const canUndo = <T,>(history: History<T>) => history.past.length > 0
export const canRedo = <T,>(history: History<T>) => history.future.length > 0
