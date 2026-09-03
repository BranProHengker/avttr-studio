import * as cheerio from 'cheerio'
import type { ScraperResult, PlatformScraper, MediaItem } from '../types'
import { resolveCobalt } from './cobaltFallback'

export const spotifyScraper: PlatformScraper = {
  name: 'spotify',
  supports: (url: string) => {
    return /spotify\.com|spotify\.link/i.test(url)
  },

  resolve: async (url: string): Promise<ScraperResult> => {
    try {
      let trackTitle = ''
      let trackArtist = ''
      let trackCover = ''
      let previewAudio = ''
      let albumName = ''

      // 1. Fetch Spotify oEmbed endpoint
      try {
        const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`
        const oembedRes = await fetch(oembedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(6000),
        })

        if (oembedRes.ok) {
          const oembed = await oembedRes.json()
          trackTitle = oembed.title || ''
          trackCover = oembed.thumbnail_url || ''
        }
      } catch {
        // Continue to embed page
      }

      // 2. Fetch Spotify Embed HTML for preview URL & metadata
      try {
        const cleanTrackId = url.match(/track[\/:]([a-zA-Z0-9]+)/)?.[1]
        const embedUrl = cleanTrackId
          ? `https://open.spotify.com/embed/track/${cleanTrackId}`
          : url

        const embedRes = await fetch(embedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(6000),
        })

        if (embedRes.ok) {
          const html = await embedRes.text()
          const $ = cheerio.load(html)
          const nextData = $('script#__NEXT_DATA__').text()

          if (nextData) {
            const parsed = JSON.parse(nextData)
            const entity = parsed.props?.pageProps?.state?.data?.entity
            if (entity) {
              trackTitle = trackTitle || entity.title || entity.name || ''
              trackArtist = entity.artists?.[0]?.name || ''
              albumName = entity.album?.name || ''
              trackCover = entity.visualIdentity?.image?.[0]?.url || $('meta[property="og:image"]').attr('content') || trackCover
              previewAudio = entity.audioPreview?.url || ''
            }
          }
        }
      } catch {
        // Embed failed, continue
      }

      const allMedias: MediaItem[] = []

      // Add High-Resolution Album Artwork as downloadable media
      if (trackCover) {
        allMedias.push({
          type: 'image',
          url: trackCover,
          quality: 'Ultra HD Album Artwork (640x640)',
          format: 'jpg',
          filename: `spotify_cover_${trackArtist}_${trackTitle}.jpg`.replace(/[^a-zA-Z0-9_.-]/g, '_'),
          thumbnail: trackCover,
        })
      }

      // 3. Resolve Full Audio Stream via Search / Cobalt / Audio Matcher
      try {
        if (trackTitle) {
          const searchQuery = `${trackArtist} - ${trackTitle} Audio`
          const ytRes = await fetch('https://api.siputzx.my.id/api/d/savefrom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`,
            }),
            signal: AbortSignal.timeout(6000),
          })

          if (ytRes.ok) {
            const ytJson = await ytRes.json()
            const audioItem = ytJson.data?.[0]?.data?.[0]?.url?.find(
              (m: any) => m.type?.includes('audio') || m.ext === 'm4a' || m.ext === 'mp3'
            )

            if (audioItem && audioItem.url) {
              allMedias.push({
                type: 'audio',
                url: audioItem.url,
                quality: 'Full Audio Track (320kbps MP3)',
                format: 'mp3',
                size: audioItem.filesize,
                thumbnail: trackCover,
              })
            }
          }
        }
      } catch {
        // Continue
      }

      // Append 30s Spotify HQ Preview if available
      if (previewAudio) {
        allMedias.push({
          type: 'audio',
          url: previewAudio,
          quality: 'Spotify HQ Audio Preview (160kbps MP3)',
          format: 'mp3',
          thumbnail: trackCover,
        })
      }

      if (allMedias.length > 0) {
        return {
          success: true,
          platform: 'spotify',
          title: trackArtist ? `${trackTitle} - ${trackArtist}` : trackTitle || 'Spotify Track',
          description: albumName ? `Album: ${albumName}` : undefined,
          thumbnail: trackCover,
          author: {
            name: trackArtist || 'Spotify Artist',
            username: (trackArtist || 'spotify').toLowerCase().replace(/\s+/g, ''),
            avatar: trackCover,
          },
          medias: allMedias,
        }
      }

      // Universal Cobalt fallback
      return await resolveCobalt(url, 'spotify')
    } catch (err: any) {
      return {
        success: false,
        platform: 'spotify',
        title: '',
        medias: [],
        error: err?.message || 'Failed to resolve Spotify track',
      }
    }
  },
}
