import { defineEventHandler, getQuery } from 'h3'
import fallbackFonts from '../../utils/uncutFonts.json'

export interface UncutFontItem {
  id: string
  name: string
  slug: string
  category: 'sans-serif' | 'serif' | 'display' | 'monospace'
  authors: string
  date: string
  previewUrl: string
  downloadUrl: string
  pageUrl: string
  source: 'uncut'
  license: string
}

let cachedFonts: UncutFontItem[] = fallbackFonts as UncutFontItem[]
let lastFetchTime = 0
const CACHE_TTL_MS = 1000 * 60 * 60

async function getOrFetchUncutFonts(): Promise<UncutFontItem[]> {
  const now = Date.now()
  if (cachedFonts.length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedFonts
  }

  try {
    const res = await fetch('https://uncut.wtf/fonts.json', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(4000),
    })

    if (res.ok) {
      const data = await res.json()
      if (data && data.categories) {
        const flat: UncutFontItem[] = []
        for (const [category, val] of Object.entries<any>(data.categories)) {
          if (Array.isArray(val.fonts)) {
            for (const font of val.fonts) {
              flat.push({
                id: `uncut-${font.slug}`,
                name: font.name,
                slug: font.slug,
                category: category as any,
                authors:
                  font.authors && font.authors.length > 0
                    ? font.authors.map((a: any) => a.name).join(', ')
                    : 'Independent Designer',
                date: font.date || '',
                previewUrl: `https://uncut.wtf/assets/images/${font.slug}.svg`,
                downloadUrl:
                  font.dl && font.dl.startsWith('http')
                    ? font.dl
                    : `https://uncut.wtf${font.dl || ''}`,
                pageUrl: `https://uncut.wtf/${category}/${font.slug}/`,
                source: 'uncut',
                license: 'SIL Open Font License / Free for Commercial Use',
              })
            }
          }
        }
        if (flat.length > 0) {
          cachedFonts = flat
          lastFetchTime = now
          return cachedFonts
        }
      }
    }
  } catch {
    // Fall back to local snapshot
  }

  return cachedFonts
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const searchQuery = ((query.q as string) || '').trim().toLowerCase()
  const cat = ((query.cat as string) || 'all').trim().toLowerCase()
  const page = Math.max(1, parseInt((query.page as string) || '1', 10) || 1)
  const limit = Math.max(1, Math.min(48, parseInt((query.limit as string) || '12', 10) || 12))

  const allFonts = await getOrFetchUncutFonts()

  let filtered = allFonts

  if (cat && cat !== 'all') {
    filtered = filtered.filter((f) => f.category.toLowerCase() === cat)
  }

  if (searchQuery) {
    filtered = filtered.filter(
      (f) =>
        f.name.toLowerCase().includes(searchQuery) ||
        f.authors.toLowerCase().includes(searchQuery) ||
        f.category.toLowerCase().includes(searchQuery) ||
        f.slug.toLowerCase().includes(searchQuery)
    )
  }

  const total = filtered.length
  const totalPages = Math.ceil(total / limit) || 1
  const startIndex = (page - 1) * limit
  const paginated = filtered.slice(startIndex, startIndex + limit)

  return {
    success: true,
    total,
    page,
    totalPages,
    limit,
    fonts: paginated,
  }
})
