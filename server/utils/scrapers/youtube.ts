import type { PlatformScraper, ScraperResult, MediaItem } from '~/types'
import { resolveCobalt } from './cobaltFallback'
import vm from 'node:vm'

const INVIDIOUS_INSTANCES = [
  'https://invidious.flokinet.to',
  'https://invidious.f5.si',
  'https://invidious.perennialte.ch',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
]

function parseQualityHeight(label?: string): number {
  if (!label) return 0
  const match = label.match(/(\d+)p/i)
  return match ? parseInt(match[1], 10) : 0
}

function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null
  const trimmed = url.trim()

  try {
    const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const vParam = urlObj.searchParams.get('v')
    if (vParam && /^[\w-]{11}$/.test(vParam)) {
      return vParam
    }
  } catch {}

  const regex = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/i
  const match = trimmed.match(regex)
  if (match && match[1]) {
    return match[1]
  }

  if (/^[\w-]{11}$/.test(trimmed)) {
    return trimmed
  }

  return null
}

async function fetchInvidiousVideo(videoId: string): Promise<ScraperResult | null> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      })

      if (!res.ok) continue
      const data: any = await res.json()
      if (!data || !data.title) continue

      const medias: MediaItem[] = []
      const seen = new Set<string>()

      // 1. Adaptive Audio Streams (find best audio stream)
      let bestAudioUrl = ''
      let bestAudioSize: number | undefined
      if (Array.isArray(data.adaptiveFormats)) {
        const audios = data.adaptiveFormats.filter((f: any) => f.type?.includes('audio') && f.url)
        const bestM4a = audios.find((f: any) => f.container === 'm4a' || f.type?.includes('mp4')) || audios[0]
        if (bestM4a) {
          bestAudioUrl = bestM4a.url
          bestAudioSize = bestM4a.bitrate ? parseInt(bestM4a.bitrate, 10) : undefined
        }
      }

      // 2. Adaptive Video Streams (1080p, 1440p, 2160p, 720p, etc.)
      if (Array.isArray(data.adaptiveFormats)) {
        const videos = data.adaptiveFormats.filter((f: any) => (f.type?.includes('video') || f.qualityLabel) && f.url)
        videos.sort((a: any, b: any) => parseQualityHeight(b.qualityLabel || b.resolution) - parseQualityHeight(a.qualityLabel || a.resolution))

        for (const f of videos) {
          const q = f.qualityLabel || f.resolution
          if (!q || seen.has(q)) continue
          seen.add(q)

          medias.push({
            type: 'video',
            quality: q,
            format: f.container || 'mp4',
            size: f.size ? parseInt(f.size, 10) : undefined,
            url: f.url,
            audioUrl: bestAudioUrl || undefined,
          })
        }
      }

      // 3. Progressive Video Streams
      if (Array.isArray(data.formatStreams)) {
        for (const f of data.formatStreams) {
          if (!f || !f.url) continue
          const q = f.qualityLabel || f.quality || '360p'
          if (!seen.has(q)) {
            seen.add(q)
            medias.push({
              type: 'video',
              quality: q,
              format: f.container || 'mp4',
              size: f.size ? parseInt(f.size, 10) : undefined,
              url: f.url,
            })
          }
        }
      }

      // 4. Audio Streams
      if (bestAudioUrl) {
        medias.push({
          type: 'audio',
          quality: 'Audio MP3 (320 kbps)',
          format: 'mp3',
          size: bestAudioSize ? Math.round(bestAudioSize * 1.1) : undefined,
          url: bestAudioUrl,
        })
        medias.push({
          type: 'audio',
          quality: 'Audio M4A (Original AAC)',
          format: 'm4a',
          size: bestAudioSize,
          url: bestAudioUrl,
        })
      }

      if (medias.length > 0) {
        return {
          success: true,
          platform: 'youtube',
          title: data.title,
          author: data.author ? { name: data.author, username: data.author.toLowerCase().replace(/\s+/g, '') } : undefined,
          thumbnail: data.videoThumbnails?.[0]?.url?.startsWith('http')
            ? data.videoThumbnails[0].url
            : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          duration: data.lengthSeconds ? parseInt(data.lengthSeconds, 10) : undefined,
          medias,
        }
      }
    } catch {
      // Continue to next instance
    }
  }
  return null
}

let cachedYt: any = null

async function getInnertube() {
  const { Innertube, Platform, ClientType } = await import('youtubei.js')

  if (!Platform.shim.eval) {
    Platform.shim.eval = (data: any, env: any) => {
      const code = typeof data === 'string' ? data : (data?.output || '')
      return vm.runInNewContext(`(function() {\n${code}\n})()`, env)
    }
  }

  if (!cachedYt) {
    cachedYt = await Innertube.create({
      client_type: ClientType.IOS,
    })
  }
  return cachedYt
}

async function fetchInnertubeVideo(videoId: string): Promise<ScraperResult | null> {
  try {
    const yt = await getInnertube()
    const info = await yt.getBasicInfo(videoId)

    if (!info || !info.basic_info) return null

    const medias: MediaItem[] = []
    const seen = new Set<string>()

    const adaptive = info.streaming_data?.adaptive_formats || []
    const progressive = info.streaming_data?.formats || []

    // 1. Extract best audio format (prefer MP4/M4A AAC)
    const audioFormats = adaptive.filter((f: any) => f.has_audio && !f.has_video && f.url)
    const bestAudio = audioFormats.find((f: any) => f.mime_type?.includes('mp4')) || audioFormats[0]

    // 2. Extract adaptive video formats (1080p, 1440p, 2160p, 720p, etc.)
    const videoFormats = adaptive.filter((f: any) => f.has_video && f.url)
    const mp4Videos = videoFormats.filter((f: any) => f.mime_type?.includes('mp4'))
    const otherVideos = videoFormats.filter((f: any) => !f.mime_type?.includes('mp4'))
    const candidateVideos = [...mp4Videos, ...otherVideos]

    candidateVideos.sort((a: any, b: any) => parseQualityHeight(b.quality_label) - parseQualityHeight(a.quality_label))

    for (const f of candidateVideos) {
      const q = f.quality_label
      if (!q || seen.has(q)) continue
      seen.add(q)

      medias.push({
        type: 'video',
        quality: q,
        format: 'mp4',
        size: f.content_length ?? undefined,
        url: f.url,
        audioUrl: f.has_audio ? undefined : bestAudio?.url,
      })
    }

    // 3. Fallback to progressive formats if any quality was not captured
    for (const f of progressive) {
      let directUrl = f.url
      if (!directUrl && typeof (f as any).decipher === 'function') {
        try {
          directUrl = await (f as any).decipher(yt.session.player)
        } catch {}
      }

      if (directUrl && f.has_video) {
        const q = f.quality_label || '360p'
        if (!seen.has(q)) {
          seen.add(q)
          medias.push({
            type: 'video',
            quality: q,
            format: 'mp4',
            size: f.content_length ?? undefined,
            url: directUrl,
          })
        }
      }
    }

    // 4. Dedicated Audio Formats
    if (bestAudio?.url) {
      medias.push({
        type: 'audio',
        quality: 'Audio MP3 (320 kbps)',
        format: 'mp3',
        size: bestAudio.content_length ? Math.round(bestAudio.content_length * 1.1) : undefined,
        url: bestAudio.url,
      })
      medias.push({
        type: 'audio',
        quality: 'Audio M4A (Original AAC)',
        format: 'm4a',
        size: bestAudio.content_length ?? undefined,
        url: bestAudio.url,
      })
    }

    if (medias.length > 0) {
      return {
        success: true,
        platform: 'youtube',
        title: info.basic_info.title || 'YouTube Video',
        author: info.basic_info.author ? { name: info.basic_info.author, username: info.basic_info.author.toLowerCase().replace(/\s+/g, '') } : undefined,
        thumbnail: info.basic_info.thumbnail?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: info.basic_info.duration,
        medias,
      }
    }
  } catch (err: any) {
    cachedYt = null
    console.warn('Innertube YouTube resolve failed:', err.message)
  }
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
      } catch {}
    }

    // Strategy 1: Innertube YouTube Engine (iOS Native Client with 1080p+ Full HD)
    if (videoId) {
      const innertubeResult = await fetchInnertubeVideo(videoId)
      if (innertubeResult && innertubeResult.success) {
        if (!innertubeResult.author && metaAuthor) innertubeResult.author = metaAuthor
        return innertubeResult
      }
    }

    // Strategy 2: Invidious Resolver Cluster
    if (videoId) {
      const invidiousResult = await fetchInvidiousVideo(videoId)
      if (invidiousResult && invidiousResult.success) {
        if (!invidiousResult.author && metaAuthor) invidiousResult.author = metaAuthor
        return invidiousResult
      }
    }

    // Strategy 3: Cobalt fallback
    const canonicalUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : url
    const cobaltRes = await resolveCobalt(canonicalUrl, 'youtube')
    if (cobaltRes.success) {
      if (!cobaltRes.thumbnail && fallbackThumb) cobaltRes.thumbnail = fallbackThumb
      if (!cobaltRes.title || cobaltRes.title === 'Media from youtube') cobaltRes.title = metaTitle
      if (metaAuthor) cobaltRes.author = metaAuthor
      return cobaltRes
    }

    return {
      success: false,
      platform: 'youtube',
      title: metaTitle,
      thumbnail: fallbackThumb,
      medias: [],
      error: 'Gagal mengekstrak video YouTube. Video mungkin dibatasi usia, bersifat privat, atau server YouTube sedang throttling.',
    }
  },
}
