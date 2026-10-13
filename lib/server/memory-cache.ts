type Entry<T> = { value:T; expiresAt:number }
declare global { var __garimpoCache: Map<string,Entry<unknown>> | undefined }
const cache = globalThis.__garimpoCache ?? new Map<string,Entry<unknown>>()
globalThis.__garimpoCache = cache
export const mockCache = {
  get<T>(key:string):T|undefined { const entry=cache.get(key); if(!entry)return undefined; if(entry.expiresAt<Date.now()){cache.delete(key);return undefined} return entry.value as T },
  set<T>(key:string,value:T,ttlSeconds=60){cache.set(key,{value,expiresAt:Date.now()+ttlSeconds*1000});return value},
  invalidate(prefix:string){let count=0;for(const key of cache.keys())if(key.startsWith(prefix)){cache.delete(key);count++}return count},
  stats(){return {entries:cache.size,keys:[...cache.keys()]}}
}
