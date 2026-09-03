import * as cheerio from 'cheerio'
import type { ScraperResult, PlatformScraper, MediaItem } from '../types'
import { resolveCobalt } from './cobaltFallback'

export const soundcloudScraper: PlatformScraper = {
  name: 'soundcloud',
  supports: (url: string) => {
    return /soundcloud\.com/i.test(url)
  },

  resolve: async (url: string): Promise<ScraperResult> => {
    try {
      // 1. Fetch official SoundCloud oEmbed data
      const oembedUrl = `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`
      const oembedRes = await fetch(oembedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(7000),
      })

      let title = 'SoundCloud Track'
      let authorName = 'SoundCloud Artist'
      let coverArt = ''
      let description = ''

      if (oembedRes.ok) {
        const oembed = await oembedRes.json()
        title = oembed.title || title
        authorName = oembed.author_name || authorName
        description = oembed.description || ''
        
        // Upgrade thumbnail to 500x500 high-resolution artwork
        if (oembed.thumbnail_url) {
          coverArt = oembed.thumbnail_url
            .replace('-large.jpg', '-t500x500.jpg')
            .replace('-t120x120.jpg', '-t500x500.jpg')
            .replace('-small.jpg', '-t500x500.jpg')
        }
      }

      // 2. Resolve Audio Stream via Cobalt Fallback or Secondary Audio Provider
      let audioMedias: MediaItem[] = []
      try {
        const cobaltResult = await resolveCobalt(url, 'soundcloud')
        if (cobaltResult.success && cobaltResult.medias.length > 0) {
          audioMedias = cobaltResult.medias.map(m => ({
            ...m,
            type: 'audio' as const,
            format: 'mp3',
            quality: m.quality || 'SoundCloud HQ Audio (MP3)',
            thumbnail: coverArt || m.thumbnail
          }))
        }
      } catch {
        // Fallback to audio search matcher
      }

      // If cobalt stream not available, search matching high quality track
      if (audioMedias.length === 0) {
        try {
          const searchQuery = `${authorName} - ${title} Audio`
          const searchRes = await fetch('https://api.siputzx.my.id/api/d/savefrom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`,
            }),
            signal: AbortSignal.timeout(6000),
          })

          if (searchRes.ok) {
            const json = await searchRes.json()
            const item = json.data?.[0]?.data?.[0]?.url?.find(
              (m: any) => m.type?.includes('audio') || m.ext === 'mp3' || m.ext === 'm4a'
            )
            if (item && item.url) {
              audioMedias.push({
                type: 'audio',
                url: item.url,
                quality: 'Full Audio Track (320kbps MP3)',
                format: 'mp3',
                size: item.filesize,
                thumbnail: coverArt,
              })
            }
          }
        } catch {
          // Continue with artwork
        }
      }

      const allMedias: MediaItem[] = []

      // Add High-Resolution Album Artwork as downloadable media
      if (coverArt) {
        allMedias.push({
          type: 'image',
          url: coverArt,
          quality: 'Ultra HD Artwork (500x500)',
          format: 'jpg',
          filename: `soundcloud_artwork_${authorName}_${title}.jpg`.replace(/[^a-zA-Z0-9_.-]/g, '_'),
          thumbnail: coverArt,
        })
      }

      // Append audio streams
      allMedias.push(...audioMedias)

      if (allMedias.length > 0) {
        return {
          success: true,
          platform: 'soundcloud',
          title: `${title} - ${authorName}`,
          description,
          thumbnail: coverArt,
          author: {
            name: authorName,
            username: authorName.toLowerCase().replace(/\s+/g, ''),
            avatar: coverArt,
          },
          medias: allMedias,
        }
      }

      return {
        success: false,
        platform: 'soundcloud',
        title: '',
        medias: [],
        error: 'Unable to extract SoundCloud audio. Please check if the track is public.',
      }
    } catch (err: any) {
      return {
        success: false,
        platform: 'soundcloud',
        title: '',
        medias: [],
        error: err?.message || 'Failed to resolve SoundCloud track',
      }
    }
  },
}
