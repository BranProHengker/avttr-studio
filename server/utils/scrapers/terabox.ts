import type { PlatformScraper, ScraperResult, MediaItem } from '~/types'

function detectMediaType(fileName: string, typeHint?: string): 'video' | 'audio' | 'image' | 'file' {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (/^(mp4|mkv|mov|avi|webm|flv|wmv|m4v|3gp|ts)$/i.test(ext) || typeHint === 'video') return 'video'
  if (/^(mp3|m4a|wav|aac|flac|ogg|opus|wma|alac)$/i.test(ext) || typeHint === 'audio') return 'audio'
  if (/^(jpg|jpeg|png|webp|gif|bmp|svg|tiff|avif|heic)$/i.test(ext) || typeHint === 'image') return 'image'
  return 'file'
}

function isWebpageShareUrl(url: string): boolean {
  return /terabox\.(com|app|fun)\/(s\/|sharing\/link)/i.test(url) ||
         /1024tera\.com\/s\//i.test(url) ||
         /4funbox\.com\/s\//i.test(url) ||
         /mirrobox\.com\/s\//i.test(url) ||
         /nephobox\.com\/s\//i.test(url) ||
         /terasharelink\.com\/s\//i.test(url) ||
         /teraboxlink\.com\/s\//i.test(url)
}

function extractSurl(rawUrl: string): { surlParam: string, shortUrl: string } {
  try {
    const unquoted = decodeURIComponent(rawUrl.trim())
    const match = unquoted.match(/[?&]surl=([a-zA-Z0-9_-]+)/)
    let key = ''
    if (match && match[1]) {
      key = match[1]
    } else {
      const pathMatch = unquoted.match(/\/(?:s|share|filelist)\/([a-zA-Z0-9_-]+)/)
      key = pathMatch ? pathMatch[1] : unquoted
    }

    key = key.replace(/[^a-zA-Z0-9_-]/g, '')
    if (key.startsWith('1') && key.length > 1) {
      return { surlParam: key, shortUrl: key.slice(1) }
    }
    return { surlParam: `1${key}`, shortUrl: key }
  } catch {
    return { surlParam: '', shortUrl: '' }
  }
}

function normalizeFileItem(raw: any, shareId?: number | string, uk?: number | string): MediaItem | null {
  if (!raw || raw.isdir === '1') return null

  const fileName = raw.server_filename || raw.filename || raw.fileName || raw.name || raw.title || 'TeraBox File'
  const ext = raw.format || fileName.split('.').pop()?.toLowerCase() || 'bin'
  const mediaType = detectMediaType(fileName, raw.type)

  let downloadUrl = raw.download_url || raw.direct_link || raw.downloadLink || raw.dl_cdn || raw.dlink || raw.cdn

  if (!downloadUrl && raw.fs_id && shareId && uk) {
    downloadUrl = `https://www.1024tera.com/share/download?app_id=250528&shareid=${shareId}&uk=${uk}&fid=${raw.fs_id}`
  }

  if (!downloadUrl && raw.url && !isWebpageShareUrl(raw.url)) {
    downloadUrl = raw.url
  }

  if (!downloadUrl) return null

  return {
    type: mediaType,
    url: downloadUrl,
    filename: fileName,
    quality: raw.quality || (mediaType === 'file' ? fileName : 'Direct High-Speed'),
    format: ext,
    size: typeof raw.size === 'string' ? parseInt(raw.size, 10) : (raw.size || raw.file_size || raw.bytes),
    thumbnail: raw.thumbnail || raw.thumb || raw.cover || (raw.thumbs ? (raw.thumbs.url3 || raw.thumbs.url2 || raw.thumbs.url1) : undefined),
  }
}

export const teraboxScraper: PlatformScraper = {
  name: 'terabox',
  supports: (url: string) => {
    return /terabox\.com|terabox\.app|terasharelink\.com|teraboxlink\.com|1024tera\.com|freeterabox\.com|mirrobox\.com|nephobox\.com|4funbox\.com|terabox\.fun|tibibox\.com/i.test(url)
  },

  async resolve(url: string): Promise<ScraperResult> {
    const { shortUrl } = extractSurl(url)
    const userCookie = process.env.TERABOX_COOKIE || process.env.COOKIE_JSON || process.env.NDUS_COOKIE || ''

    // ENGINE 1: Native TeraBox / 1024tera Recursive Share Resolver
    if (shortUrl) {
      try {
        const headers: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://www.1024tera.com/',
        }
        if (userCookie) {
          headers['Cookie'] = userCookie.includes('=') ? userCookie : `ndus=${userCookie}`
        }

        const listRes = await fetch(`https://www.1024tera.com/share/list?app_id=250528&shorturl=${shortUrl}&root=1`, {
          headers,
          signal: AbortSignal.timeout(8000),
        })

        if (listRes.ok) {
          const data: any = await listRes.json()
          if (data && data.errno === 0 && Array.isArray(data.list) && data.list.length > 0) {
            const shareId = data.share_id
            const uk = data.uk
            const medias: MediaItem[] = []
            const folderQueue: string[] = []

            for (const item of data.list) {
              if (item.isdir === '1' && item.path) {
                folderQueue.push(item.path)
              } else {
                const norm = normalizeFileItem(item, shareId, uk)
                if (norm) medias.push(norm)
              }
            }

            // Recurse into subfolders (up to 3 levels)
            const visited = new Set<string>()
            while (folderQueue.length > 0 && visited.size < 5) {
              const currentDir = folderQueue.shift()!
              if (visited.has(currentDir)) continue
              visited.add(currentDir)

              try {
                const subRes = await fetch(`https://www.1024tera.com/share/list?app_id=250528&shorturl=${shortUrl}&dir=${encodeURIComponent(currentDir)}`, {
                  headers,
                  signal: AbortSignal.timeout(6000),
                })
                if (subRes.ok) {
                  const subData: any = await subRes.json()
                  if (subData && subData.errno === 0 && Array.isArray(subData.list)) {
                    for (const subItem of subData.list) {
                      if (subItem.isdir === '1' && subItem.path) {
                        folderQueue.push(subItem.path)
                      } else {
                        const subNorm = normalizeFileItem(subItem, shareId, uk)
                        if (subNorm && !medias.some(m => m.filename === subNorm.filename)) {
                          medias.push(subNorm)
                        }
                      }
                    }
                  }
                }
              } catch {}
            }

            if (medias.length > 0) {
              return {
                success: true,
                platform: 'terabox',
                title: data.title || `TeraBox Shared Content (${medias.length} items)`,
                description: `${medias.length} file(s) available for download`,
                thumbnail: medias[0]?.thumbnail,
                medias,
              }
            }
          }
        }
      } catch (err: any) {
        console.warn('Native TeraBox API list failed:', err.message)
      }
    }

    // ENGINE 2: Public Multi-Resolver Gateways
    try {
      const res = await fetch(`https://api.vkrdown.com/api/v1/terabox?url=${encodeURIComponent(url)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      })

      if (res.ok) {
        const json = await res.json()
        const medias: MediaItem[] = []

        if (json.data) {
          const list = Array.isArray(json.data.list) ? json.data.list : [json.data]
          for (const item of list) {
            const normalized = normalizeFileItem(item)
            if (normalized) medias.push(normalized)
          }

          if (medias.length > 0) {
            return {
              success: true,
              platform: 'terabox',
              title: json.data.title || json.data.file_name || 'TeraBox Shared Content',
              thumbnail: json.data.thumbnail || medias[0]?.thumbnail,
              medias,
            }
          }
        }
      }
    } catch {
      // Continue to final error
    }

    // Final clean informative error result
    return {
      success: false,
      platform: 'terabox',
      title: '',
      medias: [],
      error: 'Tidak dapat mengambil link unduhan langsung dari TeraBox. Pastikan link bersifat publik atau perbarui cookie di konfigurasi.',
    }
  },
}
