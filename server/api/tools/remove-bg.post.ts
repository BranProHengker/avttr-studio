export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const apiKey = (config.removeBgApiKey || process.env.REMOVE_BG_API_KEY || '').trim()

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Remove.bg API Key is not configured. Please set REMOVE_BG_API_KEY in .env',
      data: { isQuotaExceeded: true },
    })
  }

  const body = await readBody<{
    image_b64?: string
    image_url?: string
    size?: string
  }>(event).catch(() => null)

  if (!body || (!body.image_b64 && !body.image_url)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please provide image_b64 or image_url',
    })
  }

  try {
    const payload: Record<string, any> = {
      size: body.size || 'auto',
      format: 'png',
    }

    if (body.image_b64) {
      // Strip data:image/...;base64, prefix if present
      payload.image_file_b64 = body.image_b64.replace(/^data:image\/[a-z]+;base64,/i, '')
    } else if (body.image_url) {
      payload.image_url = body.image_url
    }

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'image/png, application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      let errorDetail = 'Background removal failed'
      try {
        const errJson = await response.json()
        errorDetail = errJson.errors?.[0]?.title || errJson.errors?.[0]?.detail || errorDetail
      } catch {
        // use default errorDetail
      }

      const isQuota = response.status === 402 || response.status === 429 || /credit|quota|limit|exceeded|insufficient/i.test(errorDetail)
      const userMessage = isQuota
        ? 'API Limit Exceeded: Remove.bg API quota/credits limit has been reached. Service is temporarily unavailable.'
        : errorDetail

      throw createError({
        statusCode: isQuota ? 429 : (response.status || 500),
        statusMessage: userMessage,
        data: {
          isQuotaExceeded: isQuota,
        },
      })
    }

    // Convert binary PNG arrayBuffer to base64 Data URL
    const buffer = await response.arrayBuffer()
    const base64Data = Buffer.from(buffer).toString('base64')
    const dataUrl = `data:image/png;base64,${base64Data}`

    return {
      success: true,
      resultUrl: dataUrl,
    }
  } catch (err: any) {
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || err.message || 'Remove.bg service error',
    })
  }
})
