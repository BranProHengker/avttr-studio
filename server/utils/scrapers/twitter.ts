import type { PlatformScraper, ScraperResult, MediaItem } from '~/types'
import { resolveCobalt } from './cobaltFallback'

export const twitterScraper: PlatformScraper = {
  name: 'twitter',
  supports: (url: string) => /twitter\.com|x\.com/i.test(url),

  async resolve(url: string): Promise<ScraperResult> {
    const cobaltResult = await resolveCobalt(url, 'twitter')
    if (cobaltResult.success) {
      return cobaltResult
    }

    try {
      // Secondary twitsave resolver
      const tweetMatch = url.match(/status\/(\d+)/)
      const tweetId = tweetMatch ? tweetMatch[1] : ''

      if (tweetId) {
        const response = await fetch(`https://api.vxtwitter.com/Twitter/status/${tweetId}`)
        if (response.ok) {
          const data = await response.json()
          const medias: MediaItem[] = []

          if (data.mediaURLs && Array.isArray(data.mediaURLs)) {
            for (const mediaUrl of data.mediaURLs) {
              const isVid = /mp4|webm/i.test(mediaUrl) || (data.media_extended && data.media_extended.some((m: any) => m.type === 'video'))
              medias.push({
                type: isVid ? 'video' : 'image',
                url: mediaUrl,
                quality: 'HD',
                format: isVid ? 'mp4' : 'jpg',
              })
            }
          }

          if (medias.length > 0) {
            const thumb = data.media_extended?.[0]?.thumbnail_url || data.media_extended?.[0]?.url || (data.mediaURLs?.[0] ? data.mediaURLs[0] : undefined)
            return {
              success: true,
              platform: 'twitter',
              title: data.text || 'Twitter / X Media',
              thumbnail: thumb,
              author: {
                name: data.user_name || 'Twitter User',
                username: data.user_screen_name || 'twitter',
              },
              medias,
            }
          }
        }
      }
    } catch {
      // Fallback failed
    }

    return {
      success: false,
      platform: 'twitter',
      title: '',
      medias: [],
      error: 'Failed to extract Twitter / X media.',
    }
  },
}
