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
