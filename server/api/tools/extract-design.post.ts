import { defineEventHandler, readBody, createError } from 'h3'
import { extractDesignFromUrl, type ExtractedDesignData } from '~/server/utils/designExtractor'
import { getGenericCache, setGenericCache } from '~/server/utils/cache'

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
  cached?: boolean
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

  // 0. Cache check: return existing design tokens if URL was already analyzed
  const cacheKey = `design:extract:${rawUrl.toLowerCase()}`
  const cachedData = getGenericCache<ExtractedDesignData>(cacheKey)
  if (cachedData) {
    return {
      success: true,
      data: cachedData,
      aiUsed: cachedData.aiUsed,
      aiFallback: cachedData.aiFallback,
      aiError: cachedData.aiError,
      cached: true,
    }
  }

  const config = useRuntimeConfig()
  const groqApiKey = (config.groqApiKey as string) || ''
  const groqApiKeyBackup = (config.groqApiKeyBackup as string) || ''

  try {
    const data = await extractDesignFromUrl(rawUrl, groqApiKey, groqApiKeyBackup)
    setGenericCache(cacheKey, data)
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
