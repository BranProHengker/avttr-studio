import { defineEventHandler, readBody, createError } from 'h3'
import type { TraceMoeResponse } from '~/types/anime'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { url, imageBase64, cutBorders = true } = body || {}

  if (!url && !imageBase64) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Either image URL or imageBase64 must be provided'
    })
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
