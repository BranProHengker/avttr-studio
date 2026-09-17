import { defineEventHandler, readBody, createError } from 'h3'
import type { TraceMoeResponse } from '~/types/anime'
import { validateSafeUrl, checkRateLimit } from '~/server/utils/security'

export default defineEventHandler(async (event) => {
  // 1. IP Rate Limiting (20 requests / minute)
  const clientIp = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const rate = checkRateLimit(`anime-trace:${clientIp}`, 20, 60)
  if (!rate.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Rate limit exceeded. Please wait a moment before searching again.',
    })
  }

  const body = await readBody(event)
  const { url, imageBase64, cutBorders = true } = body || {}

  if (!url && !imageBase64) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Either image URL or imageBase64 must be provided'
    })
  }

  // 2. SSRF Protection on image URL
  if (url) {
    const safeCheck = validateSafeUrl(url)
    if (!safeCheck.valid) {
      throw createError({
        statusCode: 400,
        statusMessage: safeCheck.error || 'Invalid or forbidden image URL'
      })
    }
  }

  const queryParams = new URLSearchParams()
  queryParams.set('anilistInfo', '')
  if (cutBorders) {
    queryParams.set('cutBorders', '')
  }

  try {
    if (url) {
      queryParams.set('url', url)
      const res = await $fetch<TraceMoeResponse>(`https://api.trace.moe/search?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'AvttrStudio/1.0'
        },
        timeout: 25000
      })
      return res
    }

    if (imageBase64) {
      // Decode data URL if present
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')

      const res = await $fetch<TraceMoeResponse>(`https://api.trace.moe/search?${queryParams.toString()}`, {
        method: 'POST',
        body: buffer,
        headers: {
          'Content-Type': 'image/jpeg',
          'User-Agent': 'AvttrStudio/1.0'
        },
        timeout: 25000
      })
      return res
    }
  } catch (err: any) {
    const status = err.statusCode || err.response?.status || 500
    const msg = err.data?.error || err.message || 'Failed to search anime scene'
    throw createError({
      statusCode: status,
      statusMessage: msg
    })
  }
})
