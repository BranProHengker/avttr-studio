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

function parseMediaItems(dataObj: any, fallbackThumb?: string): MediaItem[] {
  const medias: MediaItem[] = []
  const seenUrls = new Set<string>()

  const collectMedia = (item: any) => {
    if (!item) return

    // If item is direct string URL
    if (typeof item === 'string' && item.startsWith('http')) {
      const directUrl = unwrapCdnUrl(item)
      if (seenUrls.has(directUrl)) return
      seenUrls.add(directUrl)

      const isImage = directUrl.includes('.jpg') || directUrl.includes('.jpeg') || directUrl.includes('.webp') || directUrl.includes('.png')
      medias.push({
        type: isImage ? 'image' : 'video',
        url: directUrl,
        quality: 'HD',
        format: isImage ? 'jpg' : 'mp4',
        thumbnail: unwrapCdnUrl(fallbackThumb || directUrl),
      })
      return
    }

    // If item is object
    if (typeof item === 'object') {
      const rawMediaUrl = item.url || item.download_url || item.download || item.video || item.link || item.media || item.src
      if (rawMediaUrl && typeof rawMediaUrl === 'string' && rawMediaUrl.startsWith('http')) {
        const directUrl = unwrapCdnUrl(rawMediaUrl)
        if (seenUrls.has(directUrl)) return
        seenUrls.add(directUrl)

        const isImage = item.type === 'image' || directUrl.includes('.jpg') || directUrl.includes('.jpeg') || directUrl.includes('.webp') || directUrl.includes('.png')
        medias.push({
          type: isImage ? 'image' : 'video',
          url: directUrl,
          quality: item.subname || (item.quality ? `${item.quality}p` : 'HD'),
          format: item.ext || (isImage ? 'jpg' : 'mp4'),
          thumbnail: unwrapCdnUrl(item.thumb || item.thumbnail || fallbackThumb || directUrl),
        })
      }
    }
  }

  const unpack = (target: any) => {
    if (!target) return

    if (Array.isArray(target)) {
      for (const el of target) {
        unpack(el)
      }
      return
    }

    if (typeof target === 'object') {
      // If target has an array of urls or items
      if (Array.isArray(target.url)) {
        for (const u of target.url) collectMedia(u)
      } else if (Array.isArray(target.data)) {
        for (const d of target.data) unpack(d)
      } else if (Array.isArray(target.medias)) {
        for (const m of target.medias) collectMedia(m)
      } else if (Array.isArray(target.images)) {
        for (const im of target.images) collectMedia(im)
      } else if (Array.isArray(target.picker)) {
        for (const p of target.picker) collectMedia(p)
      } else {
        collectMedia(target)
      }
    }
  }

  unpack(dataObj)
  return medias
}

export const instagramScraper: PlatformScraper = {
  name: 'instagram',
  supports: (url: string) => /instagram\.com|instagr\.am/i.test(url),

  async resolve(url: string): Promise<ScraperResult> {
    const cleanUrl = url.trim()

    // Strategy 1: Siputzx SSSInstagram Engine (Primary - Fast for Reels & Multi-Slide Media)
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
          const medias = parseMediaItems(dataObj, dataObj?.thumb || meta?.thumb)

          if (medias.length > 0) {
            const title = meta.title || dataObj?.title || json?.title || 'Instagram Post'
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

    // Strategy 2: Multi-Item Fallback for Posts, Carousel & Photos (SaveFrom)
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
        if (sfJson?.status && sfJson?.data) {
          const medias = parseMediaItems(sfJson.data)

          if (medias.length > 0) {
            const first = Array.isArray(sfJson.data) ? sfJson.data[0] : sfJson.data
            const item = Array.isArray(first?.data) ? first.data[0] : (first?.data || first)
            const meta = item?.meta || first?.meta || {}

            return {
              success: true,
              platform: 'instagram',
              title: meta.title || item?.title || 'Instagram Carousel',
              thumbnail: unwrapCdnUrl(item?.thumb || medias[0]?.thumbnail || medias[0]?.url),
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
