import type { PlatformScraper, ScraperResult, MediaItem } from '~/types'
import { resolveCobalt } from './cobaltFallback'

export const tiktokScraper: PlatformScraper = {
  name: 'tiktok',
  supports: (url: string) => /tiktok\.com/i.test(url),

  async resolve(url: string): Promise<ScraperResult> {
    try {
      const response = await fetch('https://www.tikwm.com/api/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: new URLSearchParams({
          url,
          hd: '1',
        }),
      })

      if (!response.ok) throw new Error('TikWM API request failed')

      const json = await response.json()

      if (json.code === 0 && json.data) {
        const data = json.data
        const medias: MediaItem[] = []

        // HD Video without watermark
        if (data.hdplay) {
          medias.push({
            type: 'video',
            url: data.hdplay,
            quality: '1080p HD (No WM)',
            format: 'mp4',
            size: data.hd_size,
          })
        }

        // Standard Video without watermark
        if (data.play) {
          medias.push({
            type: 'video',
            url: data.play,
            quality: 'Standard (No WM)',
            format: 'mp4',
            size: data.size,
          })
        }

        // Photo slide images if carousel
        if (Array.isArray(data.images) && data.images.length > 0) {
          for (const imgUrl of data.images) {
            medias.push({
              type: 'image',
              url: imgUrl,
              quality: 'Original',
              format: 'jpg',
              thumbnail: imgUrl,
            })
          }
        }

        // Audio MP3
        if (data.music) {
          medias.push({
            type: 'audio',
            url: data.music,
            quality: 'Audio MP3',
            format: 'mp3',
          })
        }

        return {
          success: true,
          platform: 'tiktok',
          title: data.title || 'TikTok Video',
          author: {
            name: data.author?.nickname || 'TikTok Creator',
            username: data.author?.unique_id || 'unknown',
            avatar: data.author?.avatar,
          },
          thumbnail: data.cover,
          duration: data.duration,
          medias,
        }
      }
    } catch {
      // Primary scraper failed, try fallback
    }

    return resolveCobalt(url, 'tiktok')
  },
}
