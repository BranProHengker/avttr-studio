import type { PlatformScraper, ScraperResult, MediaItem } from '~/types'
import { resolveCobalt } from './cobaltFallback'

export const capcutScraper: PlatformScraper = {
  name: 'capcut',
  supports: (url: string) => /capcut\.com/i.test(url),

  async resolve(url: string): Promise<ScraperResult> {
    try {
      // Primary: siputzx CapCut API
      const res = await fetch('https://api.siputzx.my.id/api/d/capcut', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(6000),
      })

      if (res.ok) {
        const json = await res.json()
        if (json.status && json.data) {
          const videoUrl = json.data.video_url || json.data.url || json.data.download_url
          if (videoUrl) {
            return {
              success: true,
              platform: 'capcut',
              title: json.data.title || 'CapCut Template Video',
              thumbnail: json.data.thumbnail || json.data.cover,
              medias: [
                {
                  type: 'video',
                  url: videoUrl,
                  quality: 'HD (No Watermark)',
                  format: 'mp4',
                },
              ],
            }
          }
        }
      }
    } catch {
      // Try next
    }

    try {
      // Secondary: CapCut API extraction
      const templateMatch = url.match(/\/template-detail\/(\d+)|t\/([a-zA-Z0-9]+)/)
      if (templateMatch) {
        const response = await fetch(`https://api.vkrdown.com/api/v1/capcut?url=${encodeURIComponent(url)}`, {
          signal: AbortSignal.timeout(5000),
        })
        if (response.ok) {
          const data = await response.json()
          if (data.data?.video_url) {
            const medias: MediaItem[] = [
              {
                type: 'video',
                url: data.data.video_url,
                quality: 'HD (No WM)',
                format: 'mp4',
              },
            ]
            return {
              success: true,
              platform: 'capcut',
              title: data.data.title || 'CapCut Template',
              thumbnail: data.data.cover_url,
              medias,
            }
          }
        }
      }
    } catch {
      // Fallback
    }

    return resolveCobalt(url, 'capcut')
  },
}
