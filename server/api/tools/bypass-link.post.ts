import { defineEventHandler, readBody, createError } from 'h3'
import { traceAndBypassUrl, type BypassResult } from '~/server/utils/bypasser'

interface RequestPayload {
  url: string
}

export default defineEventHandler(async (event): Promise<BypassResult> => {
  const body = await readBody<RequestPayload>(event)

  if (!body || !body.url || typeof body.url !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'URL is required',
    })
  }

  const raw = body.url.trim()
  if (!raw) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid or empty URL provided',
    })
  }

  try {
    const result = await traceAndBypassUrl(raw)
    return result
  } catch (error: any) {
    return {
      success: false,
      originalUrl: raw,
      finalUrl: raw,
      cleanedUrl: raw,
      removedParams: [],
      hops: [],
      isSafe: false,
      totalTimeMs: 0,
      error: error.message || 'Failed to trace and bypass URL',
    }
  }
})
