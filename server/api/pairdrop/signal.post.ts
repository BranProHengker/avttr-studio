import { pairdropHub } from '~/server/utils/pairdropHub'

interface SignalBody {
  from: string
  to: string
  payload: any
}

export default defineEventHandler(async (event) => {
  const body = await readBody<SignalBody>(event)

  if (!body || !body.from || !body.to || !body.payload) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required signal fields (from, to, payload)',
    })
  }

  const success = pairdropHub.sendSignal(body.from, body.to, body.payload)

  return {
    success,
    deliveredAt: Date.now(),
  }
})
