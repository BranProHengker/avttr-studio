import { defineEventHandler, readBody, createError } from 'h3'
import dns from 'node:dns/promises'
import { isPrivateHost } from '~/server/utils/security'
import { evaluateSecurityHeaders, type SecurityAuditResult } from '~/server/utils/securityAudit'

interface RequestPayload {
  url: string
  lang?: 'en' | 'id'
}

export default defineEventHandler(async (event): Promise<SecurityAuditResult> => {
  const body = await readBody<RequestPayload>(event)

  if (!body || !body.url || typeof body.url !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'URL is required',
    })
  }

  let raw = body.url.trim()
  if (!raw) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid or empty URL provided',
    })
  }

  // Prepend protocol if user entered bare domain
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    raw = 'https://' + raw
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(raw)
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid URL format',
    })
  }

  // SSRF check
  if (isPrivateHost(parsedUrl.hostname)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Scanning private or local network IP addresses is prohibited',
    })
  }

  const startTime = Date.now()
  let resolvedIp: string | undefined

  try {
    const lookup = await dns.lookup(parsedUrl.hostname)
    resolvedIp = lookup.address
    if (isPrivateHost(resolvedIp)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Resolved IP address belongs to a private network',
      })
    }
  } catch (err: any) {
    if (err?.statusCode === 403) throw err
    // DNS resolution failure will be caught by fetch
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(raw, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 AvttrSecurityAudit/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    clearTimeout(timeoutId)

    const responseTimeMs = Date.now() - startTime
    const finalUrl = response.url || raw

    const rawHeaders: Record<string, string> = {}
    response.headers.forEach((val, key) => {
      rawHeaders[key] = val
    })

    return evaluateSecurityHeaders(rawHeaders, raw, finalUrl, responseTimeMs, resolvedIp, body.lang || 'en')
  } catch (err: any) {
    clearTimeout(timeoutId)
    const responseTimeMs = Date.now() - startTime

    if (err.name === 'AbortError') {
      throw createError({
        statusCode: 504,
        statusMessage: 'Target server took longer than 10 seconds to respond',
      })
    }

    throw createError({
      statusCode: 502,
      statusMessage: err.message || 'Failed to connect to target host',
    })
  }
})
