import type { ScraperResult, MediaItem, PlatformType } from '~/types'

const COBALT_INSTANCES = [
  'https://api.cobalt.tools',
  'https://lime.clxxped.lol',
  'https://melon.clxxped.lol',
  'https://kitty.tame.gg',
  'https://api.qwkuns.me',
  'https://apicobalt.mgytr.top',
  'https://api-cobalt.eversiege.network',
  'https://cobaltapi.kittycat.boo',
  'https://cobalt-api.lamps-dev.dev',
  'https://cobaltapi.squair.xyz',
  'https://nuko-c.meowing.de',
  'https://bergung-api.hoffnungfuerdiezukunft.net',
]

export async function resolveCobalt(url: string, platform: PlatformType = 'other'): Promise<ScraperResult> {
  for (const instance of COBALT_INSTANCES) {
    try {
      const response = await fetch(`${instance}/`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: JSON.stringify({
          url,
          videoQuality: 'max',
          youtubeVideoCodec: 'h264',
          audioFormat: 'mp3',
        }),
        signal: AbortSignal.timeout(4000),
      })

      if (!response.ok) continue

      const data = await response.json()
      const medias: MediaItem[] = []

      if (data.status === 'stream' || data.status === 'redirect') {
        medias.push({
          type: 'video',
          url: data.url,
          quality: 'HD',
          format: 'mp4',
        })
      } else if (data.status === 'picker' && Array.isArray(data.picker)) {
        for (const item of data.picker) {
          medias.push({
            type: item.type === 'photo' ? 'image' : 'video',
            url: item.url,
            thumbnail: item.thumb,
          })
        }
      }

      if (medias.length > 0) {
        return {
          success: true,
          platform,
          title: data.filename || `Media from ${platform}`,
          medias,
        }
      }
    } catch {
      // Try next instance
    }
  }

  return {
    success: false,
    platform,
    title: '',
    medias: [],
    error: 'All cobalt fallback instances failed',
  }
}
