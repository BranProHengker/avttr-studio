import { Readable } from 'node:stream'
import { spawn } from 'node:child_process'

let cachedAndroidYt: any = null

async function getAndroidInnertube() {
  if (!cachedAndroidYt) {
    const { Innertube, ClientType } = await import('youtubei.js')
    cachedAndroidYt = await Innertube.create({ client_type: ClientType.ANDROID })
  }
  return cachedAndroidYt
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const videoId = typeof query.videoId === 'string' ? query.videoId.trim() : ''
  const isDownload = query.download === '1'
  const filename = typeof query.filename === 'string' ? query.filename.trim() : `${videoId || 'autoclip'}.mp4`

  if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Parameter videoId YouTube tidak valid.'
    })
  }

  const startSec = query.start != null && query.start !== '' ? Number(query.start) : NaN
  const endSec = query.end != null && query.end !== '' ? Number(query.end) : NaN
  const hasTrim = !isNaN(startSec) && startSec >= 0 && !isNaN(endSec) && endSec > startSec

  try {
    const yt = await getAndroidInnertube()
    const info = await yt.getBasicInfo(videoId)

    if (!info?.streaming_data) {
      throw new Error('Streaming data video tidak tersedia.')
    }

    // Prefer progressive format with both video and audio
    const progressiveFormat =
      info.streaming_data.formats?.find((f: any) => f.has_video && f.has_audio && f.url) ||
      info.streaming_data.formats?.[0]

    let directUrl = progressiveFormat?.url

    // Fallback: search in adaptive formats if progressive is missing
    if (!directUrl && Array.isArray(info.streaming_data.adaptive_formats)) {
      const candidate = info.streaming_data.adaptive_formats.find((f: any) => f.has_video && f.url)
      directUrl = candidate?.url
    }

    if (!directUrl) {
      throw new Error('URL streaming video tidak dapat ditemukan.')
    }

    const cleanFilename = filename.replace(/[^\w\s.-]/gi, '_')

    // Case 1: Trimmed Clip Download via FFmpeg
    if (hasTrim) {
      const durationSec = Math.max(1, endSec - startSec)
      const headers: Record<string, string> = {
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*'
      }

      if (isDownload) {
        headers['Content-Disposition'] = `attachment; filename="${cleanFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
      }

      setResponseStatus(event, 200)
      setResponseHeaders(event, headers)

      const ffmpeg = spawn('ffmpeg', [
        '-nostdin',
        '-hide_banner',
        '-loglevel', 'error',
        '-ss', startSec.toString(),
        '-i', directUrl,
        '-t', durationSec.toString(),
        '-c', 'copy',
        '-movflags', 'frag_keyframe+empty_moov',
        '-f', 'mp4',
        'pipe:1'
      ])

      event.node.req.on('close', () => {
        try {
          ffmpeg.kill('SIGKILL')
        } catch {}
      })

      return sendStream(event, ffmpeg.stdout)
    }

    // Case 2: Direct Video Streaming with HTTP 206 Range Support for Custom HTML5 Player
    const reqRange = getHeader(event, 'range')
    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'com.google.android.youtube/19.29.37 (Linux; U; Android 14; US) gzip'
    }

    if (reqRange) {
      fetchHeaders['Range'] = reqRange
    }

    const upstreamRes = await fetch(directUrl, {
      headers: fetchHeaders
    })

    setResponseStatus(event, upstreamRes.status)

    const forwardHeaders = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'cache-control',
      'etag',
      'last-modified'
    ]

    for (const h of forwardHeaders) {
      const val = upstreamRes.headers.get(h)
      if (val) {
        setHeader(event, h, val)
      }
    }

    setHeader(event, 'Access-Control-Allow-Origin', '*')

    if (isDownload) {
      setHeader(event, 'Content-Disposition', `attachment; filename="${cleanFilename}"`)
    }

    if (!upstreamRes.body) {
      return ''
    }

    const nodeStream = Readable.fromWeb(upstreamRes.body as any)
    return sendStream(event, nodeStream)
  } catch (err: any) {
    console.error('[AutoClipper Stream] Error:', err?.message || err)
    throw createError({
      statusCode: 502,
      statusMessage: `Gagal mengolah stream video: ${err?.message || 'Server YouTube menolak permintaan stream'}`
    })
  }
})
