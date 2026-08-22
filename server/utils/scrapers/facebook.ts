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

export const spotifyScraper: PlatformScraper = {
  name: 'spotify',
  supports: (url: string) => /spotify\.com|soundcloud\.com/i.test(url),

  async resolve(url: string): Promise<ScraperResult> {
    const isSoundCloud = /soundcloud\.com/i.test(url)
    if (isSoundCloud) {
      return resolveCobalt(url, 'soundcloud')
    }

    // Extract Spotify track ID
    const trackMatch = url.match(/(?:track|album|playlist|episode)\/([A-Za-z0-9]+)/i)
    const trackId = trackMatch ? trackMatch[1] : ''

    let trackTitle = ''
    let trackArtist = ''
    let trackCover = ''
    let previewAudio = ''

    // Strategy 1: Direct Spotify Embed Entity Extraction
    if (trackId) {
      try {
        const embedRes = await fetch(`https://open.spotify.com/embed/track/${trackId}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(5000),
        })

        if (embedRes.ok) {
          const html = await embedRes.text()
          const $ = cheerio.load(html)
          const nextDataScript = $('script[id="__NEXT_DATA__"]').html()

          if (nextDataScript) {
            const nextJson = JSON.parse(nextDataScript)
            const entity = nextJson.props?.pageProps?.state?.data?.entity

            if (entity) {
              trackTitle = entity.title || entity.name || ''
              trackArtist = entity.artists?.[0]?.name || ''
              trackCover = entity.visualIdentity?.image?.[0]?.url || $('meta[property="og:image"]').attr('content') || ''
              previewAudio = entity.audioPreview?.url || ''
            }
          }
        }
      } catch {
        // Embed failed, continue
      }
    }

    // Strategy 2: Match Audio Stream from YouTube if Track Info is available
    if (trackTitle) {
      try {
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
            return {
              success: true,
              platform: 'spotify',
              title: `${trackTitle} - ${trackArtist}`,
              thumbnail: trackCover,
              author: {
                name: trackArtist,
                username: trackArtist.toLowerCase().replace(/\s+/g, ''),
                avatar: trackCover,
              },
              medias: [
                {
                  type: 'audio',
                  url: audioItem.url,
                  quality: 'Full Audio Track (320kbps MP3)',
                  format: 'mp3',
                  size: audioItem.filesize,
                },
                ...(previewAudio
                  ? [
                      {
                        type: 'audio' as const,
                        url: previewAudio,
                        quality: 'Spotify HQ Audio Preview',
                        format: 'mp3',
                      },
                    ]
                  : []),
              ],
            }
          }
        }
      } catch {
        // Continue
      }

      // If full stream search failed but previewAudio is available
      if (previewAudio) {
        return {
          success: true,
          platform: 'spotify',
          title: `${trackTitle} - ${trackArtist}`,
          thumbnail: trackCover,
          author: {
            name: trackArtist,
            username: trackArtist.toLowerCase().replace(/\s+/g, ''),
            avatar: trackCover,
          },
          medias: [
            {
              type: 'audio',
              url: previewAudio,
              quality: 'Spotify Audio Preview (MP3)',
              format: 'mp3',
            },
          ],
        }
      }
    }

    // Strategy 3: Direct siputzx Spotify API
    try {
      const res = await fetch('https://api.siputzx.my.id/api/d/spotify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(6000),
      })

      if (res.ok) {
        const json = await res.json()
        if (json.status && json.data) {
          const downloadUrl = json.data.download || json.data.url || json.data.audio
          if (downloadUrl) {
            return {
              success: true,
              platform: 'spotify',
              title: `${json.data.title || 'Track'} - ${json.data.artist || 'Artist'}`,
              thumbnail: json.data.image || json.data.thumbnail,
              medias: [
                {
                  type: 'audio',
                  url: downloadUrl,
                  quality: '320kbps MP3',
                  format: 'mp3',
                },
              ],
            }
          }
        }
      }
    } catch {
      // Fallback to cobalt
    }

    return resolveCobalt(url, 'spotify')
  },
}
