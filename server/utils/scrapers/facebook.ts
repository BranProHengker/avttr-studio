import * as cheerio from 'cheerio'
import type { PlatformScraper, ScraperResult, MediaItem } from '~/types'
import { resolveCobalt } from './cobaltFallback'

export const facebookScraper: PlatformScraper = {
  name: 'facebook',
  supports: (url: string) => /facebook\.com|fb\.watch/i.test(url),

  async resolve(url: string): Promise<ScraperResult> {
    try {
      const res = await fetch('https://api.siputzx.my.id/api/d/facebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(6000),
      })

      if (res.ok) {
        const json = await res.json()
        if (json.status && json.data) {
          const medias: MediaItem[] = []
          const videoHd = json.data.hd || json.data.video_hd || json.data.video
          const videoSd = json.data.sd || json.data.video_sd

          if (videoHd) {
            medias.push({
              type: 'video',
              url: videoHd,
              quality: 'HD (720p/1080p)',
              format: 'mp4',
            })
          }
          if (videoSd && videoSd !== videoHd) {
            medias.push({
              type: 'video',
              url: videoSd,
              quality: 'SD (360p/480p)',
              format: 'mp4',
            })
          }

          if (medias.length > 0) {
            return {
              success: true,
              platform: 'facebook',
              title: json.data.title || 'Facebook Video',
              thumbnail: json.data.thumbnail || json.data.cover,
              medias,
            }
          }
        }
      }
    } catch {
      // Proceed to fallback
    }

    return resolveCobalt(url, 'facebook')
  },
}

