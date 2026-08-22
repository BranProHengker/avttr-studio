import * as cheerio from 'cheerio'
import type { PlatformScraper, ScraperResult, MediaItem } from '~/types'
import { resolveCobalt } from './cobaltFallback'

function extractShortcode(url: string): string | null {
  const match = url.match(/(?:instagram\.com|instagr\.am)\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i)
  return match ? match[1] : null
}

export const instagramScraper: PlatformScraper = {
  name: 'instagram',
  supports: (url: string) => /instagram\.com|instagr\.am/i.test(url),

  async resolve(url: string): Promise<ScraperResult> {
    const shortcode = extractShortcode(url)

    // Strategy 1: Direct Instagram Embed Scraper (Fast & Official CDN)
    if (shortcode) {
      try {
        const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`
        const embedRes = await fetch(embedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: AbortSignal.timeout(6000),
        })

        if (embedRes.ok) {
          const html = await embedRes.text()
          const $ = cheerio.load(html)
          const medias: MediaItem[] = []

          // Check video tag
          const videoSrc = $('video').attr('src') || $('video source').attr('src')
          if (videoSrc) {
            medias.push({
              type: 'video',
              url: videoSrc,
              quality: 'HD',
              format: 'mp4',
            })
          }

          // Check embedded scripts for video_url or display_url
          const scripts = $('script').toArray()
          for (const s of scripts) {
            const text = $(s).html() || ''
            if (text.includes('video_url') || text.includes('display_url')) {
              const videoMatches = text.match(/"video_url":"([^"]+)"/g)
              if (videoMatches) {
                for (const vm of videoMatches) {
                  const cleanUrl = vm.replace(/"video_url":"|"/g, '').replace(/\\u0026/g, '&')
                  if (!medias.some(m => m.url === cleanUrl)) {
                    medias.push({
                      type: 'video',
                      url: cleanUrl,
                      quality: 'HD',
                      format: 'mp4',
                    })
                  }
                }
              }

              const displayMatches = text.match(/"display_url":"([^"]+)"/g)
              if (displayMatches && medias.length === 0) {
                for (const dm of displayMatches) {
                  const cleanUrl = dm.replace(/"display_url":"|"/g, '').replace(/\\u0026/g, '&')
                  if (!medias.some(m => m.url === cleanUrl)) {
                    medias.push({
                      type: 'image',
                      url: cleanUrl,
                      quality: 'HD',
                      format: 'jpg',
                    })
                  }
                }
              }
            }
          }

          // Check image tag
          if (medias.length === 0) {
            const imgSrc = $('img.EmbeddedMediaImage').attr('src')
            if (imgSrc && !imgSrc.startsWith('data:')) {
              medias.push({
                type: 'image',
                url: imgSrc,
                quality: 'HD',
                format: 'jpg',
              })
            }
          }

          if (medias.length > 0) {
            const caption = $('.Caption').text().trim() || 'Instagram Post'
            return {
              success: true,
              platform: 'instagram',
              title: caption.slice(0, 100),
              thumbnail: medias[0].thumbnail || medias[0].url,
              medias,
            }
          }
        }
      } catch {
        // Embed strategy failed, proceed to next strategy
      }
    }

    // Strategy 2: Multi-Provider Public API Gateways
    const gateways = [
      'https://api.siputzx.my.id/api/d/fastdl',
      'https://api.siputzx.my.id/api/d/igram',
      'https://api.siputzx.my.id/api/d/sssinstagram',
      'https://api.siputzx.my.id/api/d/savefrom',
    ]

    for (const gateway of gateways) {
      try {
        const res = await fetch(gateway, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          body: JSON.stringify({ url }),
          signal: AbortSignal.timeout(6000),
        })

        if (res.ok) {
          const json = await res.json()
          if (json.status && json.data) {
            const medias: MediaItem[] = []
            const dataArray = Array.isArray(json.data) ? json.data : [json.data]

            for (const item of dataArray) {
              const mediaUrl = item.url || item.download_url || item.video || item.link || item.media
              if (mediaUrl && typeof mediaUrl === 'string') {
                medias.push({
                  type: item.type === 'image' || mediaUrl.includes('.jpg') || mediaUrl.includes('.webp') ? 'image' : 'video',
                  url: mediaUrl,
                  quality: item.quality || 'HD',
                  format: item.type === 'image' ? 'jpg' : 'mp4',
                  thumbnail: item.thumbnail || item.thumb,
                })
              }
            }

            if (medias.length > 0) {
              return {
                success: true,
                platform: 'instagram',
                title: json.title || 'Instagram Media',
                thumbnail: medias[0]?.thumbnail || medias[0]?.url,
                medias,
              }
            }
          }
        }
      } catch {
        // Try next gateway
      }
    }

    // Strategy 3: Cobalt fallback
    const cobaltRes = await resolveCobalt(url, 'instagram')
    if (cobaltRes.success) {
      return cobaltRes
    }

    return {
      success: false,
      platform: 'instagram',
      title: '',
      medias: [],
      error: 'Unable to resolve Instagram media. The post might be private or temporarily restricted by Instagram.',
    }
  },
}
