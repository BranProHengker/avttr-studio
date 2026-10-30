import type { ScraperResult } from '~/types'

interface CacheEntry {
  data: ScraperResult
  expiresAt: number
}

const memoryCache = new Map<string, CacheEntry>()
const TTL_MS = 10 * 60 * 1000

export function getCachedResult(key: string): ScraperResult | null {
  const entry = memoryCache.get(key)
  if (!entry) return null

  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key)
    return null
  }

  return { ...entry.data, cached: true }
}

export function setCachedResult(key: string, data: ScraperResult): void {
  if (!data.success) return

  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + TTL_MS,
  })

  // Evict old entries if cache grows large
  if (memoryCache.size > 500) {
    const now = Date.now()
    for (const [k, v] of memoryCache.entries()) {
      if (now > v.expiresAt) {
        memoryCache.delete(k)
      }
    }
  }
}

interface GenericCacheEntry<T> {
  data: T
  expiresAt: number
}

const genericCache = new Map<string, GenericCacheEntry<any>>()
export const DEFAULT_AI_CACHE_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours default for AI responses

export function getGenericCache<T>(key: string): T | null {
  const entry = genericCache.get(key)
  if (!entry) return null

  if (Date.now() > entry.expiresAt) {
    genericCache.delete(key)
    return null
  }

  return entry.data
}

export function setGenericCache<T>(key: string, data: T, ttlMs = DEFAULT_AI_CACHE_TTL_MS): void {
  if (!data) return

  genericCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  })

  // Evict old entries if generic cache grows large
  if (genericCache.size > 1000) {
    const now = Date.now()
    for (const [k, v] of genericCache.entries()) {
      if (now > v.expiresAt) {
        genericCache.delete(k)
      }
    }
  }
}
