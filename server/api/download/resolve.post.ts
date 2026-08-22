import type { ScraperResult, PlatformType } from '~/types'
import { cleanUrl, unshortenUrl, detectPlatform } from '~/server/utils/sanitizer'
import { getCachedResult, setCachedResult } from '~/server/utils/cache'
import { tiktokScraper } from '~/server/utils/scrapers/tiktok'
import { instagramScraper } from '~/server/utils/scrapers/instagram'
import { youtubeScraper } from '~/server/utils/scrapers/youtube'
import { twitterScraper } from '~/server/utils/scrapers/twitter'
import { capcutScraper } from '~/server/utils/scrapers/capcut'
import { facebookScraper, spotifyScraper } from '~/server/utils/scrapers/facebook'
import { resolveCobalt } from '~/server/utils/scrapers/cobaltFallback'

const scrapers = [
  tiktokScraper,
  instagramScraper,
  youtubeScraper,
  twitterScraper,
  capcutScraper,
  facebookScraper,
  spotifyScraper,
]

export default defineEventHandler(async (event) => {
  const body = await readBody<{ url?: string }>(event)
  const rawUrl = body?.url?.trim()

  if (!rawUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: 'URL is required',
    })
  }

  // 1. Sanitize and unshorten URL
  const targetUrl = await unshortenUrl(rawUrl)
  const platform = detectPlatform(targetUrl)

  // 2. Check in-memory cache
  const cached = getCachedResult(targetUrl)
  if (cached) {
    return cached
  }

  // 3. Find matching scraper
  const scraper = scrapers.find((s) => s.supports(targetUrl))

  let result: ScraperResult
  if (scraper) {
    result = await scraper.resolve(targetUrl)
  } else {
    // Universal fallback
    result = await resolveCobalt(targetUrl, platform)
  }

  if (result.success) {
    setCachedResult(targetUrl, result)
    return result
  }

  // If primary and initial fallback failed, return informative error
  return {
    success: false,
    platform,
    title: '',
    medias: [],
    error: result.error || 'Failed to fetch media from this link. Please check if the link is public.',
  }
})
