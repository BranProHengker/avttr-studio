import type { PlatformScraper, ScraperResult, MediaItem } from '~/types'

function unwrapCdnUrl(urlStr: string): string {
  if (!urlStr) return ''
  if (urlStr.includes('uri=')) {
    try {
      const parsed = new URL(urlStr)
      const direct = parsed.searchParams.get('uri')
      if (direct && direct.startsWith('http')) {
        return direct
      }
    } catch {
      // return original fallback
    }
  }
  return urlStr
}

function parseMediaItems(dataObj: any, meta: any): MediaItem[] {
  const medias: MediaItem[] = []
  let itemsToParse: any[] = []

  if (Array.isArray(dataObj)) {
    itemsToParse = dataObj
  } else if (Array.isArray(dataObj?.url)) {
    itemsToParse = dataObj.url
  } else if (Array.isArray(dataObj?.data)) {
    itemsToParse = dataObj.data
  } else if (dataObj?.url && typeof dataObj.url === 'string') {
    itemsToParse = [dataObj]
  } else {
    itemsToParse = [dataObj]
  }

  for (const item of itemsToParse) {
    if (!item) continue

    // If item is direct string URL
    if (typeof item === 'string' && item.startsWith('http')) {
      const directUrl = unwrapCdnUrl(item)
      const isImage = directUrl.includes('.jpg') || directUrl.includes('.jpeg') || directUrl.includes('.webp') || directUrl.includes('.png')
      medias.push({
        type: isImage ? 'image' : 'video',
        url: directUrl,
        quality: 'HD',
        format: isImage ? 'jpg' : 'mp4',
        thumbnail: unwrapCdnUrl(dataObj?.thumb || meta?.thumb || directUrl),
      })
      continue
    }

    // If item is object
    if (typeof item === 'object') {
      const rawMediaUrl = item.url || item.download_url || item.download || item.video || item.link || item.media || item.src
      if (rawMediaUrl && typeof rawMediaUrl === 'string' && rawMediaUrl.startsWith('http')) {
        const directUrl = unwrapCdnUrl(rawMediaUrl)
        const isImage = item.type === 'image' || directUrl.includes('.jpg') || directUrl.includes('.jpeg') || directUrl.includes('.webp') || directUrl.includes('.png')
        medias.push({
          type: isImage ? 'image' : 'video',
          url: directUrl,
          quality: item.subname || (item.quality ? `${item.quality}p` : 'HD'),
          format: item.ext || (isImage ? 'jpg' : 'mp4'),
          thumbnail: unwrapCdnUrl(item.thumb || item.thumbnail || dataObj?.thumb || meta?.thumb || directUrl),
        })
      }
    }
  }

  return medias
}

export const instagramScraper: PlatformScraper = {
  name: 'instagram',
  supports: (url: string) => /instagram\.com|instagr\.am/i.test(url),

  async resolve(url: string): Promise<ScraperResult> {
    const cleanUrl = url.trim()

    // Strategy 1: Siputzx SSSInstagram Engine (Primary - Ultra Fast for Reels & Videos)
    try {
      const apiUrl = `https://api.siputzx.my.id/api/d/sssinstagram?url=${encodeURIComponent(cleanUrl)}`
      const res = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(8000),
      })

      if (res.ok) {
        const json = await res.json()
        if (json?.status && json?.data && json.data.response !== 4 && json.data.success !== false) {
          const dataObj = json.data
          const meta = dataObj?.meta || {}
          const medias = parseMediaItems(dataObj, meta)

          if (medias.length > 0) {
            const title = meta.title || dataObj?.title || json?.title || 'Instagram Reel'
            const thumbnail = unwrapCdnUrl(dataObj?.thumb || meta.thumb || medias[0]?.thumbnail || medias[0]?.url)
            const author = meta.username
              ? {
                  name: meta.username,
                  username: meta.username,
                  avatar: unwrapCdnUrl(dataObj?.thumb || meta?.thumb),
                }
              : undefined

            return {
              success: true,
              platform: 'instagram',
              title,
              thumbnail,
              author,
              medias,
            }
          }
        }
      }
    } catch {
      // Primary SSSInstagram failed, proceed to fallback
    }

    // Strategy 2: Multi-Method Fallback for Posts & Photos
    try {
      const savefromRes = await fetch('https://api.siputzx.my.id/api/d/savefrom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({ url: cleanUrl }),
        signal: AbortSignal.timeout(8000),
      })

      if (savefromRes.ok) {
        const sfJson = await savefromRes.json()
        const first = sfJson.data?.[0]
        const item = Array.isArray(first?.data) ? first.data[0] : (first?.data || first)

        if (item && item.response !== 4 && item.success !== false) {
          const medias = parseMediaItems(item, item.meta || {})
          if (medias.length > 0) {
            return {
              success: true,
              platform: 'instagram',
              title: item.meta?.title || 'Instagram Media',
              thumbnail: unwrapCdnUrl(item.thumb || medias[0]?.thumbnail || medias[0]?.url),
              medias,
            }
          }
        }
      }
    } catch {
      // SaveFrom fallback failed
    }

    return {
      success: false,
      platform: 'instagram',
      title: 'Instagram Post',
      medias: [],
      error: 'Download link tidak ditemukan. Postingan mungkin privat atau merupakan jenis postingan yang dibatasi.',
    }
  },
}
