/**
 * Horários das postagens. O Brasil está sem horário de verão desde 2019, então Brasília é UTC−3 o ano todo;
 * por isso o deslocamento é fixo e testável.
 */

const BRT_OFFSET_HOURS = -3
const hourMs = 3_600_000

/** AAAA-MM-DD de Brasília para um instante. */
export function brasiliaDay(instant: number) {
  return new Date(instant + BRT_OFFSET_HOURS * hourMs).toISOString().slice(0, 10)
}

/** Instante (UTC) correspondente a `hour` (pode ter fração) de um dia de Brasília. */
export function brasiliaTime(day: string, hour: number) {
  return Date.parse(`${day}T00:00:00Z`) + (hour - BRT_OFFSET_HOURS) * hourMs
}

/** `count` horários espalhados de forma uniforme entre `startHour` e `endHour` do dia. */
export function slotsForDay(day: string, count: number, startHour: number, endHour: number) {
  if (count <= 0 || endHour <= startHour) return []
  if (count === 1) return [brasiliaTime(day, (startHour + endHour) / 2)]
  const step = (endHour - startHour) / (count - 1)
  return Array.from({ length: count }, (_, index) => brasiliaTime(day, startHour + step * index))
}

/**
 * Horários que ainda faltam hoje para fechar a cota diária: os da grade que estão no futuro e a pelo menos
 * 20 minutos de uma postagem já agendada. Nunca passa da cota (`dailyLimit` menos o que já existe hoje).
 */
export function missingSlots(input: { now: number; dailyLimit: number; startHour: number; endHour: number; existing: number[] }) {
  const day = brasiliaDay(input.now)
  const todays = input.existing.filter((instant) => brasiliaDay(instant) === day)
  const missing = input.dailyLimit - todays.length
  if (missing <= 0) return []
  const free = slotsForDay(day, input.dailyLimit, input.startHour, input.endHour)
    .filter((slot) => slot > input.now && todays.every((taken) => Math.abs(taken - slot) >= 20 * 60_000))
  return free.slice(0, missing)
}
