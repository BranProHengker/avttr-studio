import { defineEventHandler, readBody, createError } from 'h3'
import { extractDesignFromUrl, type ExtractedDesignData } from '~/server/utils/designExtractor'

interface RequestPayload {
  url: string
}

interface ApiResponse {
  success: boolean
  data?: ExtractedDesignData
  error?: string
  aiUsed?: boolean
  aiFallback?: boolean
  aiError?: string
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

  const config = useRuntimeConfig()
  const groqApiKey = (config.groqApiKey as string) || ''

  try {
    const data = await extractDesignFromUrl(rawUrl, groqApiKey)
    return {
      success: true,
      data,
      aiUsed: data.aiUsed,
      aiFallback: data.aiFallback,
      aiError: data.aiError,
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to extract design tokens from website',
    }
  }
})
