import type { PlatformScraper, ScraperResult, MediaItem } from '~/types'
import { resolveCobalt } from './cobaltFallback'

function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null
  const trimmed = url.trim()

  // 1. Direct query param ?v= or &v=
  try {
    const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const vParam = urlObj.searchParams.get('v')
    if (vParam && /^[\w-]{11}$/.test(vParam)) {
      return vParam
    }
  } catch {}

  // 2. Comprehensive Regex for youtu.be, shorts, live, embed, v, etc.
  const regex = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/i
  const match = trimmed.match(regex)
  if (match && match[1]) {
    return match[1]
  }

  // 3. Fallback: If string is exactly 11 alphanumeric characters
  if (/^[\w-]{11}$/.test(trimmed)) {
    return trimmed
  }

  return null
}

async function fetchSaveFromData(targetUrl: string) {
  // 1. Try GET method
  try {
    const getRes = await fetch(`https://api.siputzx.my.id/api/d/savefrom?url=${encodeURIComponent(targetUrl)}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (getRes.ok) {
      const json = await getRes.json()
      if (json.status && json.data) return json
    }
  } catch {}

  // 2. Try POST method
  try {
    const postRes = await fetch('https://api.siputzx.my.id/api/d/savefrom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({ url: targetUrl }),
      signal: AbortSignal.timeout(8000),
    })
    if (postRes.ok) {
      const json = await postRes.json()
      if (json.status && json.data) return json
    }
  } catch {}

  return null
}

export const youtubeScraper: PlatformScraper = {
  name: 'youtube',
  supports: (url: string) => /youtube\.com|youtu\.be/i.test(url) || /^[\w-]{11}$/.test(url.trim()),

  async resolve(url: string): Promise<ScraperResult> {
    const videoId = extractYouTubeVideoId(url)
    const fallbackThumb = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined
    let metaTitle = 'YouTube Video'
    let metaAuthor: { name: string; username: string } | undefined

    // Fetch official oEmbed metadata for title & author
    if (videoId) {
      try {
        const oembedRes = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
          { signal: AbortSignal.timeout(4000) }
        )
        if (oembedRes.ok) {
          const oembed = await oembedRes.json()
          if (oembed.title) metaTitle = oembed.title
          if (oembed.author_name) {
            metaAuthor = {
              name: oembed.author_name,
              username: oembed.author_name.toLowerCase().replace(/\s+/g, ''),
            }
          }
        }
      } catch {
        // oEmbed failed, continue
      }
    }

    // Strategy 1: SaveFrom Engine via Siputzx API (GET & POST)
    try {
      const canonicalYtUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : url
      const json = await fetchSaveFromData(canonicalYtUrl)

      if (json && json.data) {
        const first = json.data?.[0]
        const item = Array.isArray(first?.data) ? first.data[0] : (first?.data || first)
        const mediaList = item?.url || first?.url || json.data?.url
        const videoMeta = item?.meta || first?.meta || json.data?.meta

        if (Array.isArray(mediaList) && mediaList.length > 0) {
          const medias: MediaItem[] = []
          const seenQualities = new Set<string>()

          // Filter only valid media URLs
          const validMediaList = mediaList.filter((m: any) => {
            if (!m || typeof m.url !== 'string' || !m.url.startsWith('http')) return false
            return true
          })

          // 1. Separate all video streams and qualities
          const candidateVideos = validMediaList.filter(
            (m: any) => !m.type?.includes('audio') && (m.ext === 'mp4' || m.ext === 'webm')
          )

          for (const vid of candidateVideos) {
            const qNum = parseInt(vid.quality || vid.subname || '0', 10)
            if (!qNum || qNum < 144) continue
            const qKey = `${qNum}p`
            if (seenQualities.has(qKey)) continue
            seenQualities.add(qKey)

            medias.push({
              type: 'video',
              url: vid.url,
              quality: `${qNum}p`,
              format: vid.ext || 'mp4',
              size: vid.filesize || vid.contentLength,
            })
          }

          // Sort video qualities descending (2160p, 1440p, 1080p, 720p, 480p, 360p)
          medias.sort((a, b) => {
            const qa = parseInt(a.quality || '0', 10) || 0
            const qb = parseInt(b.quality || '0', 10) || 0
            return qb - qa
          })

          // 2. Add Valid Direct Audio Streams (Prioritize universal M4A/AAC for 100% compatibility)
          const m4aAudio = validMediaList.filter((m: any) => m.ext === 'm4a' || m.type?.includes('m4a'))
          const allAudio = validMediaList.filter(
            (m: any) => m.type?.includes('audio') || m.ext === 'm4a' || m.ext === 'mp3' || m.ext === 'opus'
          )
          const preferredAudioList = m4aAudio.length > 0 ? m4aAudio : allAudio

          if (preferredAudioList.length > 0) {
            preferredAudioList.sort((a: any, b: any) => {
              const ba = parseInt(b.quality || b.subname || '0', 10)
              const aa = parseInt(a.quality || a.subname || '0', 10)
              return ba - aa
            })

            const bestAudio = preferredAudioList[0]
            const format = bestAudio.ext === 'opus' ? 'opus' : 'm4a'
            medias.push({
              type: 'audio',
              url: bestAudio.url,
              quality: format === 'm4a' ? 'Audio (M4A)' : 'Audio',
              format,
              size: bestAudio.filesize || bestAudio.contentLength,
            })
          } else if (candidateVideos.length > 0) {
            const bestProgressive = candidateVideos[0]
            medias.push({
              type: 'audio',
              url: bestProgressive.url,
              quality: 'Audio (M4A)',
              format: 'm4a',
              size: bestProgressive.filesize,
            })
          }

          if (medias.length > 0) {
            return {
              success: true,
              platform: 'youtube',
              title: videoMeta?.title || metaTitle,
              thumbnail: fallbackThumb,
              author: metaAuthor,
              duration: videoMeta?.duration,
              medias,
            }
          }
        }
      }
    } catch {
      // SaveFrom failed, proceed to Cobalt
    }

    // Strategy 2: Cobalt fallback
    const canonicalUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : url
    const cobaltRes = await resolveCobalt(canonicalUrl, 'youtube')
    if (cobaltRes.success) {
      if (!cobaltRes.thumbnail && fallbackThumb) {
        cobaltRes.thumbnail = fallbackThumb
      }
      if (!cobaltRes.title || cobaltRes.title === 'Media from youtube') {
        cobaltRes.title = metaTitle
      }
      if (metaAuthor) {
        cobaltRes.author = metaAuthor
      }
      return cobaltRes
    }

    return {
      success: false,
      platform: 'youtube',
      title: metaTitle,
      thumbnail: fallbackThumb,
      medias: [],
      error: 'Failed to extract YouTube video streams. The video might be age-restricted or private.',
    }
  },
}
