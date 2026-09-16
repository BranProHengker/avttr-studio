export interface LrcTrackItem {
  id: number
  trackName: string
  artistName: string
  albumName?: string
  duration?: number
  instrumental: boolean
  plainLyrics?: string
  syncedLyrics?: string
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const q = (query.q as string)?.trim() || ''
  const track = (query.track as string)?.trim() || ''
  const artist = (query.artist as string)?.trim() || ''

  if (!q && !track) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please provide a search query (q) or track name.'
    })
  }

  const searchTerm = q || `${track} ${artist}`.trim()

  try {
    const url = `https://lrclib.net/api/search?q=${encodeURIComponent(searchTerm)}`
    const data = await $fetch<LrcTrackItem[]>(url, {
      headers: {
        'User-Agent': 'AvttrStudio/1.0 (https://studio.avttr.my.id)'
      },
      timeout: 10000
    })

    if (!Array.isArray(data)) {
      return {
        success: true,
        count: 0,
        data: []
      }
    }

    // Prioritize results that have syncedLyrics
    const sorted = [...data].sort((a, b) => {
      const aHas = a.syncedLyrics ? 1 : 0
      const bHas = b.syncedLyrics ? 1 : 0
      return bHas - aHas
    })

    return {
      success: true,
      count: sorted.length,
      data: sorted
    }
  } catch (err: any) {
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || err.message || 'Failed to fetch lyrics from LRCLIB'
    })
  }
})
