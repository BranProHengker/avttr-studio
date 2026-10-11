import { defineEventHandler, readBody, createError } from 'h3'
import { extractDesignFromUrl, type ExtractedDesignData } from '~/server/utils/designExtractor'

interface RequestPayload {
  url: string
}

interface ApiResponse {
  success: boolean
  data?: ExtractedDesignData
  error?: string
}

export default defineEventHandler(async (event): Promise<ApiResponse> => {
  const body = await readBody<RequestPayload>(event)

  if (!body || !body.url || typeof body.url !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'URL is required',
    })
  }

  const rawUrl = body.url.trim()
  if (!rawUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: 'URL cannot be empty',
    })
  }

  try {
    const data = await extractDesignFromUrl(rawUrl)
    return {
      success: true,
      data,
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to extract design tokens from website',
    }
  }
})
