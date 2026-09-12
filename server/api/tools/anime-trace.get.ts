import { defineEventHandler, createError, getRequestIP } from 'h3'
import type { TraceMoeMeResponse } from '~/types/anime'

export default defineEventHandler(async (event) => {
  try {
    const clientIp = getRequestIP(event, { xForwardedFor: true })
    const res = await $fetch<TraceMoeMeResponse>('https://api.trace.moe/me', {
      method: 'GET',
      headers: {
        'User-Agent': 'AvttrStudio/1.0',
        ...(clientIp ? { 'X-Forwarded-For': clientIp } : {})
      },
      timeout: 15000
    })
    return res
  } catch (err: any) {
    const status = err.statusCode || err.response?.status || 500
    throw createError({
      statusCode: status,
      statusMessage: err.message || 'Failed to fetch trace.moe quota'
    })
  }
})
