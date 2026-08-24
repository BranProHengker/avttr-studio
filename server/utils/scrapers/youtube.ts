import type { PlatformScraper, ScraperResult, MediaItem } from '~/types'
import { resolveCobalt } from './cobaltFallback'

function extractYouTubeVideoId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i)
  return match ? match[1] : null
}

export const youtubeScraper: PlatformScraper = {
  name: 'youtube',
  supports: (url: string) => /youtube\.com|youtu\.be/i.test(url),

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
        // oEmbed failed, keep default
      }
    }

    // Strategy 1: SaveFrom Direct High-Speed Streams
    try {
      const cleanYtUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : url
      const res = await fetch('https://api.siputzx.my.id/api/d/savefrom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanYtUrl }),
        signal: AbortSignal.timeout(7000),
      })

      if (res.ok) {
        const json = await res.json()
        const mediaList = json.data?.[0]?.data?.[0]?.url
        const videoMeta = json.data?.[0]?.data?.[0]?.meta

        if (Array.isArray(mediaList) && mediaList.length > 0) {
          const medias: MediaItem[] = []
          const seenQualities = new Set<string>()

          // Filter only valid, direct media URLs (discard HTML converters / broken payloads)
          const validMediaList = mediaList.filter((m: any) => {
            if (!m || typeof m.url !== 'string' || !m.url.startsWith('http')) return false
            if (m.url.includes('sf-converter.com') || m.url.includes('convert?payload=')) return false
            return true
          })

          // 1. Separate all video streams and qualities
          const candidateVideos = validMediaList.filter(
            (m: any) => !m.type?.includes('audio') && (m.ext === 'mp4' || m.ext === 'webm')
          )

          for (const item of candidateVideos) {
            const qNum = parseInt(item.quality || item.subname || '0', 10)
            if (!qNum || qNum < 144) continue // skip invalid bitrate labels
            const qKey = `${qNum}p`
            if (seenQualities.has(qKey)) continue
            seenQualities.add(qKey)

            medias.push({
              type: 'video',
              url: item.url,
              quality: `${qNum}p`,
              format: item.ext || 'mp4',
              size: item.filesize,
            })
          }

          // Sort video qualities descending (1080p, 720p, 480p, 360p)
          medias.sort((a, b) => {
            const qa = parseInt(a.quality || '0', 10) || 0
            const qb = parseInt(b.quality || '0', 10) || 0
            return qb - qa
          })

          // 2. Add Valid Direct Audio Streams (Prioritize universal M4A/AAC for 100% device compatibility)
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
              size: bestAudio.filesize,
            })
          } else if (candidateVideos.length > 0) {
            // Fallback audio from direct progressive video stream
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
    const cobaltRes = await resolveCobalt(url, 'youtube')
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
