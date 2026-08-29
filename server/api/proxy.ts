import { spawn } from 'node:child_process'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const targetUrl = typeof query.url === 'string' ? query.url : ''
  const filename = typeof query.filename === 'string' ? query.filename : 'media_download.mp4'
  const isDownload = query.download === '1'

  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Valid target URL is required',
    })
  }

  try {
    const clientRange = getHeader(event, 'range')

    // Determine platform-specific referer for CDN bypass
    let referer = 'https://www.google.com/'
    if (/tiktokcdn|tiktok\.com/i.test(targetUrl)) {
      referer = 'https://www.tiktok.com/'
    } else if (/twimg|twitter\.com|(?:^|\/\/|\.)x\.com(?:[\/?]|$)/i.test(targetUrl)) {
      referer = 'https://twitter.com/'
    } else if (/googlevideo|youtube\.com|youtu\.be/i.test(targetUrl)) {
      referer = 'https://www.youtube.com/'
    } else if (/fbcdn|facebook\.com/i.test(targetUrl)) {
      referer = 'https://www.facebook.com/'
    } else if (/cdninstagram|instagram\.com/i.test(targetUrl)) {
      referer = 'https://www.instagram.com/'
    } else if (/terabox|1024tera|baidupcs|terasharelink/i.test(targetUrl)) {
      referer = 'https://www.1024tera.com/'
    }

    // 1. If real MP3 conversion is requested (e.g. for YouTube video/audio streams to genuine MP3)
    if (/\.mp3$/i.test(filename)) {
      const cleanAsciiFilename = filename.replace(/[^\w\s.-]/gi, '_')
      const mp3Headers: Record<string, string> = {
        'Content-Type': 'audio/mpeg',
        'Accept-Ranges': 'none',
        'Access-Control-Allow-Origin': '*',
      }

      if (isDownload) {
        mp3Headers['Content-Disposition'] = `attachment; filename="${cleanAsciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
      }

      setResponseStatus(event, 200)
      setResponseHeaders(event, mp3Headers)

      const ffmpegArgs = ['-hide_banner', '-loglevel', 'error']

      if (/googlevideo\.com/i.test(targetUrl)) {
        ffmpegArgs.push('-user_agent', 'com.google.android.youtube/19.29.37 (Linux; U; Android 11) gzip')
      } else if (referer) {
        ffmpegArgs.push('-referer', referer)
      }

      ffmpegArgs.push(
        '-i', targetUrl,
        '-vn',
        '-acodec', 'libmp3lame',
        '-b:a', '192k',
        '-f', 'mp3',
        'pipe:1'
      )

      const ffmpeg = spawn('ffmpeg', ffmpegArgs)

      event.node.req.on('close', () => {
        try {
          ffmpeg.kill('SIGKILL')
        } catch {}
      })

      return sendStream(event, ffmpeg.stdout)
    }

    // 2. Direct streaming proxy for Video, Images, and other files
    const upstreamHeaders: Record<string, string> = {
      'Accept': '*/*',
    }

    if (/googlevideo\.com/i.test(targetUrl)) {
      upstreamHeaders['User-Agent'] = 'com.google.android.youtube/19.29.37 (Linux; U; Android 11) gzip'
    } else {
      upstreamHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      if (referer) {
        upstreamHeaders['Referer'] = referer
      }
    }

    if (/terabox|1024tera|baidupcs|terasharelink/i.test(targetUrl)) {
      const userCookie = process.env.TERABOX_COOKIE || process.env.COOKIE_JSON || process.env.NDUS_COOKIE || ''
      if (userCookie) {
        upstreamHeaders['Cookie'] = userCookie.includes('=') ? userCookie : `ndus=${userCookie}`
      }
    }

    if (clientRange) {
      upstreamHeaders['Range'] = clientRange
    }

    const upstream = await fetch(targetUrl, {
      headers: upstreamHeaders,
      signal: AbortSignal.timeout(300000),
    })

    if (!upstream.ok && upstream.status !== 206) {
      if (/googlevideo\.com/i.test(targetUrl)) {
        return sendRedirect(event, targetUrl)
      }
      throw createError({
        statusCode: upstream.status || 502,
        statusMessage: `Upstream media fetch failed (${upstream.status})`,
      })
    }

    let defaultType = 'application/octet-stream'
    if (/\.mp4/i.test(targetUrl) || /\.mp4/i.test(filename)) defaultType = 'video/mp4'
    else if (/\.mkv/i.test(targetUrl) || /\.mkv/i.test(filename)) defaultType = 'video/x-matroska'
    else if (/\.mp3/i.test(targetUrl) || /\.mp3/i.test(filename)) defaultType = 'audio/mpeg'
    else if (/\.m4a/i.test(targetUrl) || /\.m4a/i.test(filename) || /mime=audio/i.test(targetUrl)) defaultType = 'audio/mp4'
    else if (/\.opus/i.test(targetUrl) || /\.opus/i.test(filename)) defaultType = 'audio/opus'
    else if (/\.zip/i.test(targetUrl) || /\.zip/i.test(filename)) defaultType = 'application/zip'
    else if (/\.rar/i.test(targetUrl) || /\.rar/i.test(filename)) defaultType = 'application/vnd.rar'
    else if (/\.pdf/i.test(targetUrl) || /\.pdf/i.test(filename)) defaultType = 'application/pdf'
    else if (/\.apk/i.test(targetUrl) || /\.apk/i.test(filename)) defaultType = 'application/vnd.android.package-archive'
    else if (/\.(jpg|jpeg)/i.test(targetUrl) || /\.(jpg|jpeg)/i.test(filename)) defaultType = 'image/jpeg'
    else if (/\.png/i.test(targetUrl) || /\.png/i.test(filename)) defaultType = 'image/png'

    let contentType = upstream.headers.get('content-type') || defaultType
    if (/\.m4a$/i.test(filename)) contentType = 'audio/mp4'
    else if (/\.opus$/i.test(filename)) contentType = 'audio/opus'
    else if (/\.mp4$/i.test(filename)) contentType = 'video/mp4'
    else if (/\.(jpg|jpeg)$/i.test(filename)) contentType = 'image/jpeg'
    else if (/\.png$/i.test(filename)) contentType = 'image/png'

    if (contentType.includes('text/html') && !filename.endsWith('.html')) {
      throw createError({
        statusCode: 502,
        statusMessage: 'Upstream server returned an HTML webpage instead of a media file. Link may be protected or expired.',
      })
    }

    const contentLength = upstream.headers.get('content-length')
    const contentRange = upstream.headers.get('content-range')
    const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes'

    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Accept-Ranges': acceptRanges,
      'Access-Control-Allow-Origin': '*',
    }

    if (contentLength) responseHeaders['Content-Length'] = contentLength
    if (contentRange) responseHeaders['Content-Range'] = contentRange

    if (isDownload) {
      const cleanAsciiFilename = filename.replace(/[^\w\s.-]/gi, '_')
      responseHeaders['Content-Disposition'] = `attachment; filename="${cleanAsciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    }

    setResponseStatus(event, upstream.status)
    setResponseHeaders(event, responseHeaders)

    if (upstream.body) {
      return sendStream(event, upstream.body)
    }

    return null
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Streaming proxy failed',
    })
  }
})
