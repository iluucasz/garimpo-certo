'use client'

import type { ListQuery, ListResult, PlatformRecord, Repository } from './contracts'

const canUseStorage = () => typeof window !== 'undefined'

export class LocalRepository<T extends PlatformRecord> implements Repository<T> {
  constructor(
    private readonly storageKey: string,
    private readonly seed: T[],
  ) {}

  private read(): T[] {
    if (!canUseStorage()) return this.seed
    try {
      const stored = window.localStorage.getItem(this.storageKey)
      return stored ? (JSON.parse(stored) as T[]) : this.seed
    } catch {
      return this.seed
    }
  }

  private write(records: T[]) {
    if (canUseStorage()) window.localStorage.setItem(this.storageKey, JSON.stringify(records))
  }

  async list(query: ListQuery = {}): Promise<ListResult<T>> {
    const search = query.search?.trim().toLocaleLowerCase('pt-BR') ?? ''
    const filtered = this.read().filter((record) => {
      const matchesSearch = !search || Object.values(record).some((value) =>
        String(value).toLocaleLowerCase('pt-BR').includes(search),
      )
      const matchesStatus = !query.status || query.status === 'todos' || record.status === query.status
      return matchesSearch && matchesStatus
    })
    const page = Math.max(1, query.page ?? 1)
    const pageSize = Math.max(1, query.pageSize ?? 10)
    const start = (page - 1) * pageSize
    return { items: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize }
  }

  async get(id: string) {
    return this.read().find((record) => record.id === id) ?? null
  }

  async create(input: Omit<T, 'id'>) {
    const records = this.read()
    const created = { ...input, id: `${this.storageKey.split(':').at(-1)}_${crypto.randomUUID().slice(0, 8)}` } as T
    this.write([created, ...records])
    return created
  }

  async update(id: string, patch: Partial<Omit<T, 'id'>>) {
    const records = this.read()
    const current = records.find((record) => record.id === id)
    if (!current) throw new Error('Registro não encontrado')
    const updated = { ...current, ...patch, id } as T
    this.write(records.map((record) => record.id === id ? updated : record))
    return updated
  }

  async remove(id: string) {
    this.write(this.read().filter((record) => record.id !== id))
  }
}
