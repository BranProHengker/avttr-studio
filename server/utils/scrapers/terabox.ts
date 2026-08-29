import type { PlatformScraper, ScraperResult, MediaItem } from '~/types'
import { resolveCobalt } from './cobaltFallback'
import { ApifyClient } from 'apify-client'

export const teraboxScraper: PlatformScraper = {
  name: 'terabox',
  supports: (url: string) => {
    return /terabox\.com|terabox\.app|terasharelink\.com|teraboxlink\.com|1024tera\.com|freeterabox\.com|mirrobox\.com|nephobox\.com|4funbox\.com|terabox\.fun|tibibox\.com/i.test(url)
  },

  async resolve(url: string): Promise<ScraperResult> {
    const apifyToken = process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN || ''
    const actorId = process.env.APIFY_TERABOX_ACTOR_ID || process.env.APIFY_ACTOR_ID || ''

    // ENGINE 1: Apify Actor Client (if token and actorId are provided in environment)
    if (apifyToken && actorId) {
      try {
        const client = new ApifyClient({
          token: apifyToken,
        })

        const run = await client.actor(actorId).call(
          {
            startUrls: [{ url }],
            url,
            link: url,
          },
          {
            waitSecs: 35,
          }
        )

        if (run && run.defaultDatasetId) {
          const { items } = await client.dataset(run.defaultDatasetId).listItems()

          if (Array.isArray(items) && items.length > 0) {
            const item: any = items[0]
            const medias: MediaItem[] = []

            // Extract direct download link or video URL
            const directUrl = item.download_url || item.direct_link || item.downloadLink || item.dlink || item.url || item.video_url
            const streamUrl = item.stream_url || item.fast_download_url || item.play_url

            if (directUrl) {
              medias.push({
                type: (item.type === 'video' || (item.file_name && /\.(mp4|mkv|mov|webm)$/i.test(item.file_name))) ? 'video' : 'image',
                url: directUrl,
                quality: item.quality || 'Fast Direct Download',
                format: item.format || (item.file_name?.split('.').pop()) || 'mp4',
                size: item.size || item.file_size,
              })
            }

            if (streamUrl && streamUrl !== directUrl) {
              medias.push({
                type: 'video',
                url: streamUrl,
                quality: 'HD Stream URL',
                format: 'mp4',
              })
            }

            // Also check nested list if folder
            if (Array.isArray(item.list) && item.list.length > 0) {
              for (const file of item.list) {
                const fUrl = file.download_url || file.direct_link || file.dlink
                if (fUrl) {
                  medias.push({
                    type: (file.type === 'video' || /\.(mp4|mkv|mov|webm)$/i.test(file.file_name || file.name)) ? 'video' : 'image',
                    url: fUrl,
                    quality: file.quality || file.file_name || 'Direct File',
                    format: file.file_name?.split('.').pop() || 'mp4',
                    size: file.size,
                  })
                }
              }
            }

            if (medias.length > 0) {
              return {
                success: true,
                platform: 'terabox',
                title: item.title || item.file_name || item.name || 'TeraBox Shared File',
                description: item.description || (item.size_formatted ? `Size: ${item.size_formatted}` : undefined),
                thumbnail: item.thumbnail || item.thumb || item.cover,
                medias,
              }
            }
          }
        }
      } catch (err: any) {
        console.warn('Apify Terabox Actor failed, trying public fallback resolver:', err.message)
      }
    }

    // ENGINE 2: Public Multi-Engine Resolvers
    try {
      const res = await fetch(`https://api.vkrdown.com/api/v1/terabox?url=${encodeURIComponent(url)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      })

      if (res.ok) {
        const json = await res.json()
        if (json.data && (json.data.download_url || json.data.dlink || json.data.url)) {
          const dlUrl = json.data.download_url || json.data.dlink || json.data.url
          return {
            success: true,
            platform: 'terabox',
            title: json.data.file_name || json.data.title || 'TeraBox File',
            thumbnail: json.data.thumbnail || json.data.thumb,
            medias: [
              {
                type: 'video',
                url: dlUrl,
                quality: 'Original Quality',
                format: json.data.file_name?.split('.').pop() || 'mp4',
                size: json.data.size,
              },
            ],
          }
        }
      }
    } catch {
      // Continue to next fallback
    }

    // ENGINE 3: Secondary Public Workers Gateway
    try {
      const surlMatch = url.match(/s\/(?:1)?([a-zA-Z0-9_-]+)/)
      const shorturl = surlMatch ? surlMatch[1] : ''
      if (shorturl) {
        const res = await fetch(`https://terabox-dl.qtcloud.workers.dev/api/get-info?shorturl=${shorturl}`, {
          signal: AbortSignal.timeout(6000),
        })
        if (res.ok) {
          const data = await res.json()
          if (data && data.downloadLink) {
            return {
              success: true,
              platform: 'terabox',
              title: data.fileName || 'TeraBox File',
              thumbnail: data.thumbnail,
              medias: [
                {
                  type: 'video',
                  url: data.downloadLink,
                  quality: 'High Speed Direct',
                  format: data.fileName?.split('.').pop() || 'mp4',
                  size: data.size,
                },
              ],
            }
          }
        }
      }
    } catch {
      // Continue to universal fallback
    }

    // ENGINE 4: Universal Cobalt Fallback
    return resolveCobalt(url, 'terabox')
  },
}
