import type { PlatformType } from '~/types'

const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'igsh',
  'fbclid',
  'si',
  'feature',
  'ref',
  's',
  't',
]

export function cleanUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim())
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param)
    }
    return parsed.toString()
  } catch {
    return rawUrl.trim()
  }
}

export async function unshortenUrl(url: string): Promise<string> {
  const isShortlink = /vt\.tiktok\.com|vm\.tiktok\.com|t\.co|bit\.ly|tinyurl\.com|fb\.watch|capcut\.com\/t\//i.test(url)
  
  if (!isShortlink) {
    return cleanUrl(url)
  }

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    return cleanUrl(response.url || url)
  } catch {
    return cleanUrl(url)
  }
}

export function detectPlatform(url: string): PlatformType {
  const lower = url.toLowerCase()
  if (/tiktok\.com/i.test(lower)) return 'tiktok'
  if (/instagram\.com/i.test(lower)) return 'instagram'
  if (/youtube\.com|youtu\.be/i.test(lower)) return 'youtube'
  if (/twitter\.com|(?:^|\/\/|\.)x\.com(?:[\/?]|$)/i.test(lower)) return 'twitter'
  if (/facebook\.com|fb\.watch/i.test(lower)) return 'facebook'
  if (/capcut\.com/i.test(lower)) return 'capcut'
  if (/spotify\.com/i.test(lower)) return 'spotify'
  if (/soundcloud\.com/i.test(lower)) return 'soundcloud'
  if (/pinterest\.com|pin\.it/i.test(lower)) return 'pinterest'
  if (/threads\.net/i.test(lower)) return 'threads'
  if (/terabox\.com|terabox\.app|terasharelink\.com|teraboxlink\.com|1024tera\.com|freeterabox\.com|mirrobox\.com|nephobox\.com|4funbox\.com|terabox\.fun|tibibox\.com/i.test(lower)) return 'terabox'
  return 'other'
}
