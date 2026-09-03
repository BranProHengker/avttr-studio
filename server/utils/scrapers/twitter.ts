import type { PlatformScraper, ScraperResult, MediaItem } from '~/types'
import { resolveCobalt } from './cobaltFallback'

export const twitterScraper: PlatformScraper = {
  name: 'twitter',
  supports: (url: string) => /twitter\.com|(?:^|\/\/|\.)x\.com(?:[\/?]|$)/i.test(url),

  async resolve(url: string): Promise<ScraperResult> {
    const tweetMatch = url.match(/status\/(\d+)/)
    const tweetId = tweetMatch ? tweetMatch[1] : ''

    // 1. Primary Method: Fast fxtwitter API (Full support for GIFs, videos, and multi-photos)
    if (tweetId) {
      try {
        const response = await fetch(`https://api.fxtwitter.com/i/status/${tweetId}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AvttrStudioBot/1.0)',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(5000),
        })

        if (response.ok) {
          const data = await response.json()
          if (data && data.code === 200 && data.tweet) {
            const tweet = data.tweet
            const medias: MediaItem[] = []

            // Handle GIF & Video medias
            if (tweet.media?.all && Array.isArray(tweet.media.all)) {
              for (const m of tweet.media.all) {
                const isGifOrVideo = m.type === 'gif' || m.type === 'video'
                medias.push({
                  type: isGifOrVideo ? 'video' : 'image',
                  url: m.url,
                  quality: m.type === 'gif' ? 'GIF (MP4)' : 'HD',
                  format: isGifOrVideo ? 'mp4' : 'jpg',
                  thumbnail: m.thumbnail_url || tweet.author?.avatar_url,
                })
              }
            } else if (tweet.media?.videos && Array.isArray(tweet.media.videos)) {
              for (const v of tweet.media.videos) {
                medias.push({
                  type: 'video',
                  url: v.url,
                  quality: v.type === 'gif' ? 'GIF (MP4)' : 'HD',
                  format: 'mp4',
                  thumbnail: v.thumbnail_url || tweet.author?.avatar_url,
                })
              }
            } else if (tweet.media?.photos && Array.isArray(tweet.media.photos)) {
              for (const p of tweet.media.photos) {
                medias.push({
                  type: 'image',
                  url: p.url,
                  quality: 'Original',
                  format: 'jpg',
                  thumbnail: p.url,
                })
              }
            }

            if (medias.length > 0) {
              const mainThumb = tweet.media?.all?.[0]?.thumbnail_url || tweet.author?.avatar_url
              const tweetDuration = tweet.media?.all?.[0]?.duration || undefined
              return {
                success: true,
                platform: 'twitter',
                title: tweet.text || 'Twitter / X Post',
                description: tweet.text || undefined,
                thumbnail: mainThumb,
                duration: tweetDuration,
                author: {
                  name: tweet.author?.name || 'Twitter User',
                  username: tweet.author?.screen_name || 'twitter',
                  avatar: tweet.author?.avatar_url,
                },
                medias,
              }
            }
          }
        }
      } catch {
        // Fall through to secondary resolvers
      }
    }

    // 2. Secondary Fallback: vxTwitter API
    if (tweetId) {
      try {
        const response = await fetch(`https://api.vxtwitter.com/Twitter/status/${tweetId}`, {
          signal: AbortSignal.timeout(4000),
        })
        if (response.ok) {
          const data = await response.json()
          const medias: MediaItem[] = []

          if (data.media_extended && Array.isArray(data.media_extended)) {
            for (const m of data.media_extended) {
              const isVid = m.type === 'video' || m.type === 'gif' || /mp4|webm/i.test(m.url || '')
              medias.push({
                type: isVid ? 'video' : 'image',
                url: m.url,
                quality: m.type === 'gif' ? 'GIF (MP4)' : 'HD',
                format: isVid ? 'mp4' : 'jpg',
                thumbnail: m.thumbnail_url,
              })
            }
          } else if (data.mediaURLs && Array.isArray(data.mediaURLs)) {
            for (const mediaUrl of data.mediaURLs) {
              const isVid = /mp4|webm/i.test(mediaUrl)
              medias.push({
                type: isVid ? 'video' : 'image',
                url: mediaUrl,
                quality: 'HD',
                format: isVid ? 'mp4' : 'jpg',
              })
            }
          }

          if (medias.length > 0) {
            const thumb = data.media_extended?.[0]?.thumbnail_url || data.mediaURLs?.[0]
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
      } catch {
        // Fall through to Cobalt
      }
    }

    // 3. Tertiary Fallback: Cobalt Multi-Instance Resolver
    const cobaltResult = await resolveCobalt(url, 'twitter')
    if (cobaltResult.success) {
      return cobaltResult
    }

    return {
      success: false,
      platform: 'twitter',
      title: '',
      medias: [],
      error: 'Failed to extract Twitter / X media. The post might be private, deleted, or age-restricted.',
    }
  },
}
