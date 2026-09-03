import type { PlatformScraper, ScraperResult, MediaItem } from '~/types'

export const tenorScraper: PlatformScraper = {
  name: 'tenor',
  supports: (url: string) => /tenor\.com/i.test(url),

  async resolve(url: string): Promise<ScraperResult> {
    try {
      // 1. If it's already a direct media file from tenor (media.tenor.com)
      if (/media\d*\.tenor\.com|c\.tenor\.com/i.test(url)) {
        const isMp4 = /\.mp4/i.test(url)
        return {
          success: true,
          platform: 'other',
          title: 'Tenor GIF',
          thumbnail: isMp4 ? url.replace(/\.mp4/i, '.png') : url,
          medias: [
            {
              type: isMp4 ? 'video' : 'image',
              url,
              quality: isMp4 ? 'MP4 (Video)' : 'GIF (Animated)',
              format: isMp4 ? 'mp4' : 'gif',
            },
          ],
        }
      }

      // 2. Fetch Tenor webpage metadata
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(6000),
      })

      if (!response.ok) {
        throw new Error(`Tenor responded with HTTP ${response.status}`)
      }

      const html = await response.text()

      // Extract og:video, og:image, and og:title
      const videoMatch =
        html.match(/<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video["']/i) ||
        html.match(/<meta[^>]+property=["']twitter:player:stream["'][^>]+content=["']([^"']+)["']/i)

      const imageMatch =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
        html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)

      const titleMatch =
        html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<title>([^<]+)<\/title>/i)

      const rawTitle = titleMatch ? titleMatch[1].replace(/ - Discover &amp; Share GIFs.*/i, '').replace(/&amp;/g, '&').trim() : 'Tenor GIF'
      const videoUrl = videoMatch ? videoMatch[1] : null
      const imageUrl = imageMatch ? imageMatch[1] : null

      const medias: MediaItem[] = []

      if (videoUrl) {
        medias.push({
          type: 'video',
          url: videoUrl,
          quality: 'MP4 (Video)',
          format: 'mp4',
          thumbnail: imageUrl || undefined,
        })
      }

      if (imageUrl) {
        medias.push({
          type: 'image',
          url: imageUrl,
          quality: 'Original GIF',
          format: 'gif',
          thumbnail: imageUrl,
        })
      }

      if (medias.length > 0) {
        return {
          success: true,
          platform: 'other',
          title: rawTitle,
          thumbnail: imageUrl || undefined,
          medias,
        }
      }

      throw new Error('No media found on Tenor page')
    } catch (err: any) {
      return {
        success: false,
        platform: 'other',
        title: '',
        medias: [],
        error: err.message || 'Failed to extract Tenor GIF',
      }
    }
  },
}
