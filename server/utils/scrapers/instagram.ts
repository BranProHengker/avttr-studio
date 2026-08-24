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
    const cleanUrl = url.split('?')[0].replace(/\/$/, '')
    const shortcode = extractShortcode(cleanUrl)

    // Strategy 1: FastDL & SSSInstagram Multi-Node Engine
    const fastDlGateways = [
      {
        url: 'https://sssinstagram.com/api/convert',
        body: JSON.stringify({ target_url: cleanUrl }),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://sssinstagram.com/',
          'Origin': 'https://sssinstagram.com',
        },
      },
      {
        url: 'https://igram.world/api/convert',
        body: JSON.stringify({ target_url: cleanUrl }),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://igram.world/',
          'Origin': 'https://igram.world',
        },
      },
    ]

    for (const gw of fastDlGateways) {
      try {
        const res = await fetch(gw.url, {
          method: 'POST',
          headers: gw.headers,
          body: gw.body,
          signal: AbortSignal.timeout(5000),
        })

        if (res.ok) {
          const json = await res.json()
          if (json.data && Array.isArray(json.data) && json.data.length > 0) {
            const medias: MediaItem[] = []
            for (const item of json.data) {
              const mediaUrl = item.url || item.download_url || item.media || item.video
              if (mediaUrl && typeof mediaUrl === 'string') {
                const isImage = item.type === 'image' || mediaUrl.includes('.jpg') || mediaUrl.includes('.webp') || mediaUrl.includes('.jpeg')
                medias.push({
                  type: isImage ? 'image' : 'video',
                  url: mediaUrl,
                  quality: item.quality || 'HD',
                  format: isImage ? 'jpg' : 'mp4',
                  thumbnail: item.thumb || item.thumbnail,
                })
              }
            }

            if (medias.length > 0) {
              return {
                success: true,
                platform: 'instagram',
                title: json.title || 'Instagram Post',
                thumbnail: medias[0]?.thumbnail || medias[0]?.url,
                medias,
              }
            }
          }
        }
      } catch {
        // Continue to next fallback
      }
    }

    // Strategy 2: Direct Instagram Embed Scraper (Official CDN)
    if (shortcode) {
      try {
        const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`
        const embedRes = await fetch(embedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: AbortSignal.timeout(5000),
        })

        if (embedRes.ok) {
          const html = await embedRes.text()
          const $ = cheerio.load(html)
          const medias: MediaItem[] = []

          // 1. Direct Video tag
          const videoSrc = $('video').attr('src') || $('video source').attr('src')
          if (videoSrc) {
            medias.push({
              type: 'video',
              url: videoSrc,
              quality: 'HD',
              format: 'mp4',
            })
          }

          // 2. Direct embedded script JSON extraction
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

          // 3. Fallback EmbeddedMediaImage
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
        // Embed fallback failed
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
      title: 'Instagram Post',
      medias: [],
      error: 'Unable to resolve Instagram media. The post might be private or temporarily restricted by Instagram.',
    }
  },
}

