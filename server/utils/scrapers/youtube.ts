import type { PlatformScraper, ScraperResult, MediaItem } from '~/types'
import { resolveCobalt } from './cobaltFallback'
import vm from 'node:vm'

const INVIDIOUS_INSTANCES = [
  'https://invidious.flokinet.to',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.perennialte.ch',
  'https://invidious.private.coffee',
]

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
        signal: AbortSignal.timeout(5000),
      })

      if (!res.ok) continue
      const data: any = await res.json()
      if (!data || !data.title) continue

      const medias: MediaItem[] = []
      const seen = new Set<string>()
      let primaryStreamUrl = ''
      let primarySize: number | undefined

      // 1. Progressive Video Streams
      if (Array.isArray(data.formatStreams)) {
        for (const f of data.formatStreams) {
          if (!f || !f.url) continue
          const q = f.qualityLabel || f.quality || '360p'
          if (!seen.has(q)) {
            seen.add(q)
            if (!primaryStreamUrl) {
              primaryStreamUrl = f.url
              primarySize = f.size ? parseInt(f.size, 10) : undefined
            }
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

      // 2. Adaptive Audio Streams
      let hasAudio = false
      if (Array.isArray(data.adaptiveFormats)) {
        const audios = data.adaptiveFormats.filter((f: any) => f.type?.includes('audio') && f.url)
        for (const a of audios) {
          const isM4a = a.container === 'm4a' || a.type?.includes('mp4')
          const qualityName = isM4a ? 'Audio MP3 (M4A High)' : 'Audio (Opus)'
          if (!seen.has(qualityName)) {
            seen.add(qualityName)
            hasAudio = true
            medias.push({
              type: 'audio',
              quality: qualityName,
              format: isM4a ? 'mp3' : 'opus',
              size: a.bitrate ? parseInt(a.bitrate, 10) : undefined,
              url: a.url,
            })
          }
        }
      }

      // If no dedicated audio format was found, create an MP3 audio option from the progressive stream
      if (!hasAudio && primaryStreamUrl) {
        medias.push({
          type: 'audio',
          quality: 'Audio MP3 (128 kbps)',
          format: 'mp3',
          size: primarySize ? Math.round(primarySize * 0.28) : undefined,
          url: primaryStreamUrl,
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

async function fetchInnertubeVideo(videoId: string): Promise<ScraperResult | null> {
  try {
    const { Innertube, Platform, ClientType } = await import('youtubei.js')

    if (!Platform.shim.eval) {
      Platform.shim.eval = (data: any, env: any) => {
        const code = typeof data === 'string' ? data : (data?.output || '')
        return vm.runInNewContext(`(function() {\n${code}\n})()`, env)
      }
    }

    const yt = await Innertube.create({
      client_type: ClientType.ANDROID,
    })
    const info = await yt.getBasicInfo(videoId)

    if (!info || !info.basic_info) return null

    const medias: MediaItem[] = []
    const formats = info.streaming_data?.formats || []

    for (const f of formats) {
      let directUrl = f.url
      if (!directUrl && typeof (f as any).decipher === 'function') {
        try {
          directUrl = await (f as any).decipher(yt.session.player)
        } catch {}
      }

      if (directUrl && f.has_video) {
        // Video Option (MP4)
        medias.push({
          type: 'video',
          quality: f.quality_label || '360p',
          format: 'mp4',
          size: f.content_length ?? undefined,
          url: directUrl,
        })

        // Audio Option (MP3 128 kbps extracted from progressive stream)
        medias.push({
          type: 'audio',
          quality: 'Audio MP3 (128 kbps)',
          format: 'mp3',
          size: f.content_length ? Math.round(f.content_length * 0.28) : undefined,
          url: directUrl,
        })
      }
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

    // Strategy 1: Invidious Resolver Cluster
    if (videoId) {
      const invidiousResult = await fetchInvidiousVideo(videoId)
      if (invidiousResult && invidiousResult.success) {
        if (!invidiousResult.author && metaAuthor) invidiousResult.author = metaAuthor
        return invidiousResult
      }
    }

    // Strategy 2: Innertube YouTube Resolver Engine (Android Client)
    if (videoId) {
      const innertubeResult = await fetchInnertubeVideo(videoId)
      if (innertubeResult && innertubeResult.success) {
        if (!innertubeResult.author && metaAuthor) innertubeResult.author = metaAuthor
        return innertubeResult
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
