import vm from 'node:vm'

export interface HeatmapPoint {
  timeSec: number
  intensity: number
}

export interface CandidatePeak {
  peakSec: number
  intensity: number
  suggestedStartSec: number
  suggestedEndSec: number
}

export interface YouTubeHeatmapResult {
  videoId: string
  title: string
  duration: number
  author?: {
    name: string
    username?: string
  }
  thumbnail: string
  heatmap: HeatmapPoint[]
  peaks: CandidatePeak[]
}

export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null
  const trimmed = url.trim()

  try {
    const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const vParam = urlObj.searchParams.get('v')
    if (vParam && /^[\w-]{11}$/.test(vParam)) {
      return vParam
    }
  } catch {}

  const regex = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/i
  const match = trimmed.match(regex)
  if (match && match[1]) {
    return match[1]
  }

  if (/^[\w-]{11}$/.test(trimmed)) {
    return trimmed
  }

  return null
}

let cachedAndroidYt: any = null
let cachedIosYt: any = null
let cachedWebYt: any = null

export async function getInnertube(clientType: 'ANDROID' | 'IOS' | 'WEB' = 'ANDROID') {
  const { Innertube, Platform, Log, ClientType } = await import('youtubei.js')

  // Silence verbose parser warnings
  Log.setLevel(Log.Level.NONE)

  Platform.shim.eval = (data: any, env: any) => {
    const code = typeof data === 'string' ? data : (data?.output || '')
    return vm.runInNewContext(`(function() { ${code} })()`, env)
  }

  if (clientType === 'ANDROID') {
    if (!cachedAndroidYt) {
      cachedAndroidYt = await Innertube.create({ client_type: ClientType.ANDROID })
    }
    return cachedAndroidYt
  }

  if (clientType === 'IOS') {
    if (!cachedIosYt) {
      cachedIosYt = await Innertube.create({ client_type: ClientType.IOS })
    }
    return cachedIosYt
  }

  if (!cachedWebYt) {
    cachedWebYt = await Innertube.create()
  }
  return cachedWebYt
}

export function detectPeaks(points: HeatmapPoint[], totalDuration: number, maxPeaks: number = 4): CandidatePeak[] {
  if (totalDuration <= 0) {
    return []
  }

  const clipLengthSec = Math.min(45, Math.max(25, Math.floor(totalDuration / 4)))

  if (!points || points.length === 0) {
    // If no heatmap markers exist (new video / low views): segment video evenly
    const step = Math.floor(totalDuration / (maxPeaks + 1))
    const peaks: CandidatePeak[] = []
    for (let i = 1; i <= maxPeaks; i++) {
      const center = step * i
      const start = Math.max(0, center - Math.floor(clipLengthSec / 2))
      const end = Math.min(totalDuration, start + clipLengthSec)
      peaks.push({
        peakSec: center,
        intensity: 0.75,
        suggestedStartSec: Math.round(start),
        suggestedEndSec: Math.round(end)
      })
    }
    return peaks
  }

  // 1. Identify local maxima from heatmap
  const rawPeaks: HeatmapPoint[] = []
  
  if (points[0] && points[0].intensity >= 0.35) {
    rawPeaks.push({ timeSec: points[0].timeSec, intensity: points[0].intensity })
  }

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1].intensity
    const curr = points[i].intensity
    const next = points[i + 1].intensity

    if (curr > prev && curr > next && curr >= 0.15) {
      rawPeaks.push(points[i])
    }
  }

  // Sort peaks by intensity descending
  rawPeaks.sort((a, b) => b.intensity - a.intensity)

  // 2. Filter peaks that are too close (min 30 seconds gap)
  const selectedPeaks: CandidatePeak[] = []
  const minGapSec = 30

  for (const p of rawPeaks) {
    const tooClose = selectedPeaks.some(sp => Math.abs(sp.peakSec - p.timeSec) < minGapSec)
    if (!tooClose) {
      let start = Math.max(0, p.timeSec - 12)
      let end = Math.min(totalDuration, start + clipLengthSec)
      if (end - start < 20 && totalDuration >= 20) {
        start = Math.max(0, end - 20)
      }

      selectedPeaks.push({
        peakSec: p.timeSec,
        intensity: Math.round(p.intensity * 100) / 100,
        suggestedStartSec: Math.round(start),
        suggestedEndSec: Math.round(end)
      })

      if (selectedPeaks.length >= maxPeaks) break
    }
  }

  // If fewer than requested, fill with highest remaining points or timeline steps
  if (selectedPeaks.length < Math.min(3, maxPeaks)) {
    const sortedPoints = [...points].sort((a, b) => b.intensity - a.intensity)
    for (const p of sortedPoints) {
      const tooClose = selectedPeaks.some(sp => Math.abs(sp.peakSec - p.timeSec) < minGapSec)
      if (!tooClose) {
        const start = Math.max(0, p.timeSec - 12)
        const end = Math.min(totalDuration, start + clipLengthSec)
        selectedPeaks.push({
          peakSec: p.timeSec,
          intensity: Math.round(p.intensity * 100) / 100,
          suggestedStartSec: Math.round(start),
          suggestedEndSec: Math.round(end)
        })
        if (selectedPeaks.length >= maxPeaks) break
      }
    }
  }

  selectedPeaks.sort((a, b) => a.suggestedStartSec - b.suggestedStartSec)
  return selectedPeaks
}

export async function fetchYouTubeHeatmap(videoId: string): Promise<YouTubeHeatmapResult> {
  const fallbackThumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  let title = ''
  let duration = 0
  let authorName = ''
  let thumbnail = fallbackThumb
  let rawMarkers: any[] = []

  // Tier 1: Fast & Ultra-Reliable Innertube getBasicInfo (Android -> iOS)
  try {
    let yt = await getInnertube('ANDROID')
    let basic = await yt.getBasicInfo(videoId).catch(() => null)
    if (!basic?.basic_info?.title) {
      yt = await getInnertube('IOS')
      basic = await yt.getBasicInfo(videoId).catch(() => null)
    }
    if (basic?.basic_info) {
      if (basic.basic_info.title) title = basic.basic_info.title
      if (basic.basic_info.duration) duration = Number(basic.basic_info.duration)
      if (basic.basic_info.author) authorName = basic.basic_info.author
      if (basic.basic_info.thumbnail?.[0]?.url) thumbnail = basic.basic_info.thumbnail[0].url
    }
  } catch (err: any) {
    console.warn('[AutoClipper:Tier1] Innertube getBasicInfo error:', err?.message || err)
  }

  // Tier 2: Try to extract viewer engagement replay heatmap curve (with 4s timeout)
  try {
    const yt = await getInnertube('ANDROID')
    const fullInfo = await Promise.race([
      yt.getInfo(videoId),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Heatmap fetch timeout')), 4000))
    ])
    if (fullInfo) {
      if (!title && fullInfo.basic_info?.title) title = fullInfo.basic_info.title
      if (duration <= 0 && fullInfo.basic_info?.duration) duration = Number(fullInfo.basic_info.duration)
      if (!authorName && fullInfo.basic_info?.author) authorName = fullInfo.basic_info.author
      if (fullInfo.heat_map?.heat_markers?.length) {
        rawMarkers = fullInfo.heat_map.heat_markers
      }
    }
  } catch (err: any) {
    // Expected on long podcasts or when YouTube doesn't publish replay markers
  }

  // Tier 3: play-dl Fallback (Fast & resilient on cloud datacenters)
  if (!title || duration <= 0) {
    try {
      const play = await import('play-dl')
      const pInfo = await play.video_basic_info(videoId)
      if (pInfo?.video_details) {
        if (!title && pInfo.video_details.title) title = pInfo.video_details.title
        if (duration <= 0 && pInfo.video_details.durationInSec) duration = pInfo.video_details.durationInSec
        if (!authorName && pInfo.video_details.channel?.name) authorName = pInfo.video_details.channel.name
        if (pInfo.video_details.thumbnails?.[0]?.url && thumbnail === fallbackThumb) {
          thumbnail = pInfo.video_details.thumbnails[0].url
        }
      }
    } catch {}
  }

  // Tier 4: @distube/ytdl-core Fallback
  if (!title || duration <= 0) {
    try {
      const ytdl = (await import('@distube/ytdl-core')).default
      const yInfo = await ytdl.getBasicInfo(videoId)
      if (yInfo?.videoDetails) {
        if (!title && yInfo.videoDetails.title) title = yInfo.videoDetails.title
        if (duration <= 0 && yInfo.videoDetails.lengthSeconds) duration = parseInt(yInfo.videoDetails.lengthSeconds, 10)
        if (!authorName && yInfo.videoDetails.author?.name) authorName = yInfo.videoDetails.author.name
        if (yInfo.videoDetails.thumbnails?.[0]?.url && thumbnail === fallbackThumb) {
          thumbnail = yInfo.videoDetails.thumbnails[0].url
        }
      }
    } catch {}
  }

  // Tier 5: Mobile Watch Page Scraping (Bypasses desktop datacenter botwalls)
  if (duration <= 0 || !title) {
    try {
      const pageRes = await fetch(`https://m.youtube.com/watch?v=${videoId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        signal: AbortSignal.timeout(4000)
      })
      if (pageRes.ok) {
        const html = await pageRes.text()
        const durMatch = html.match(/"lengthSeconds":"(\d+)"/)
        if (durMatch && durMatch[1] && duration <= 0) {
          duration = parseInt(durMatch[1], 10)
        }
        if (!title) {
          const titleMatch = html.match(/<title>(.*?)<\/title>/)
          if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].replace('- YouTube', '').trim()
          }
        }
      }
    } catch {}
  }

  // Tier 6: Official YouTube oEmbed API Fallback (Guaranteed 200 on any public video)
  if (!title || !authorName) {
    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { signal: AbortSignal.timeout(3000) }
      )
      if (oembedRes.ok) {
        const oembed = await oembedRes.json()
        if (oembed.title && !title) title = oembed.title
        if (oembed.author_name && !authorName) authorName = oembed.author_name
      }
    } catch {}
  }

  // Tier 7: Invidious Instances Fallback if title/duration still missing
  if (!title || duration <= 0) {
    const INVIDIOUS_INSTANCES = [
      'https://invidious.flokinet.to',
      'https://invidious.f5.si',
      'https://invidious.nerdvpn.de',
      'https://inv.nadeko.net'
    ]
    for (const inst of INVIDIOUS_INSTANCES) {
      if (title && duration > 0) break
      try {
        const res = await fetch(`${inst}/api/v1/videos/${videoId}`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(3000)
        })
        if (res.ok) {
          const d: any = await res.json()
          if (d?.title && !title) title = d.title
          if (d?.lengthSeconds && duration <= 0) duration = parseInt(d.lengthSeconds, 10)
          if (d?.author && !authorName) authorName = d.author
        }
      } catch {}
    }
  }

  // Final Validation: If title is missing across all 7 tiers, the video is genuinely unavailable/private
  if (!title) {
    throw new Error('Video YouTube ini tidak tersedia, bersifat privat, atau dibatasi usia sehingga tidak dapat dianalisis.')
  }

  // Safe duration fallback: if duration was unparsed but title is verified, default to 180s
  if (duration <= 0) {
    duration = 180
  }

  // Extract Heatmap markers
  let heatmap: HeatmapPoint[] = rawMarkers.map((m: any) => ({
    timeSec: Math.round(m.time_range_start_millis / 1000),
    intensity: m.heat_marker_intensity_score_normalized || 0
  }))

  // If no heatmap markers from YouTube, generate natural smooth distribution curve
  if (heatmap.length === 0 && duration > 0) {
    const pointsCount = 40
    const step = duration / pointsCount
    for (let i = 0; i <= pointsCount; i++) {
      const t = Math.round(i * step)
      const base = Math.max(0.2, 1 - (t / duration) * 0.6)
      const bump = Math.sin((t / duration) * Math.PI * 3) * 0.15
      heatmap.push({
        timeSec: t,
        intensity: Math.min(1, Math.max(0.1, base + bump))
      })
    }
  }

  const peaks = detectPeaks(heatmap, duration, 4)

  return {
    videoId,
    title,
    duration,
    author: authorName ? { name: authorName } : undefined,
    thumbnail,
    heatmap,
    peaks
  }
}
