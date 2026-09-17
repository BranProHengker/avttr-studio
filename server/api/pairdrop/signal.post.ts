import { pairdropHub } from '~/server/utils/pairdropHub'
import { checkRateLimit } from '~/server/utils/security'

interface SignalBody {
  from: string
  to: string
  payload: any
}

const PEER_ID_REGEX = /^[a-zA-Z0-9_-]{3,64}$/
const MAX_PAYLOAD_SIZE = 256 * 1024 // 256 KB max for SDP/ICE signals or text snippets

export default defineEventHandler(async (event) => {
  // 1. IP Rate Limiting (180 signals / minute for WebRTC handshakes)
  const clientIp = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const rate = checkRateLimit(`signal:${clientIp}`, 180, 60)
  if (!rate.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Rate limit exceeded for signaling. Please slow down.',
    })
  }

  const body = await readBody<SignalBody>(event)

  if (!body || !body.from || !body.to || !body.payload) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required signal fields (from, to, payload)',
    })
  }

  // 2. Validate Peer ID structure
  if (!PEER_ID_REGEX.test(body.from) || !PEER_ID_REGEX.test(body.to)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid peer ID format',
    })
  }

  // 3. Prevent memory exhaustion via oversized payloads
  try {
    const serialized = typeof body.payload === 'string' ? body.payload : JSON.stringify(body.payload)
    if (serialized.length > MAX_PAYLOAD_SIZE) {
      throw createError({
        statusCode: 413,
        statusMessage: 'Signal payload exceeds maximum allowed size (256 KB)',
      })
    }
  } catch (err: any) {
    if (err.statusCode === 413) throw err
    throw createError({
      statusCode: 400,
      statusMessage: 'Malformed signal payload',
    })
  }

  const success = pairdropHub.sendSignal(body.from, body.to, body.payload)

  return {
    success,
    deliveredAt: Date.now(),
  }
})

