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

let cachedYt: any = null

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

async function getInnertube() {
  const { Innertube, Platform, Log } = await import('youtubei.js')

  // Silence verbose parser warnings
  Log.setLevel(Log.Level.NONE)

  if (!Platform.shim.eval) {
    Platform.shim.eval = (data: any, env: any) => {
      const code = typeof data === 'string' ? data : (data?.output || '')
      return vm.runInNewContext(`(function() {\n${code}\n})()`, env)
    }
  }

  if (!cachedYt) {
    cachedYt = await Innertube.create()
  }
  return cachedYt
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
  let info: any = null

  // 1. Try Innertube
  try {
    const yt = await getInnertube()
    info = await yt.getInfo(videoId)
  } catch (err: any) {
    console.warn('[AutoClipper] Innertube getInfo error:', err?.message || err)
  }

  let title = info?.basic_info?.title || ''
  let duration = Number(info?.basic_info?.duration) || 0
  let authorName = info?.basic_info?.author || ''
  const thumbnail = info?.basic_info?.thumbnail?.[0]?.url || fallbackThumb

  // 2. If title or duration missing, fetch oEmbed metadata
  if (!title || duration <= 0) {
    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { signal: AbortSignal.timeout(4000) }
      )
      if (oembedRes.ok) {
        const oembed = await oembedRes.json()
        if (oembed.title) title = oembed.title
        if (oembed.author_name && !authorName) authorName = oembed.author_name
      }
    } catch {}
  }

  // 3. If duration still missing, scrape YouTube watch page
  if (duration <= 0) {
    try {
      const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        signal: AbortSignal.timeout(5000)
      })
      if (pageRes.ok) {
        const html = await pageRes.text()
        if (html.includes('Video tidak tersedia') || html.includes('This video is unavailable') || html.includes('Private video')) {
          throw new Error('Video YouTube ini tidak tersedia atau bersifat privat. Pastikan link video dapat diputar secara publik.')
        }

        const durMatch = html.match(/\"lengthSeconds\":\"(\d+)\"/)
        if (durMatch && durMatch[1]) {
          duration = parseInt(durMatch[1], 10)
        }
        if (!title) {
          const titleMatch = html.match(/<title>(.*?)<\/title>/)
          if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].replace('- YouTube', '').trim()
          }
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('tidak tersedia')) throw err
    }
  }

  // 4. Strict Validation: Video MUST have valid duration and title
  if (!title || duration <= 0) {
    throw new Error('Video YouTube ini tidak tersedia, bersifat privat, atau dibatasi usia sehingga tidak dapat dianalisis.')
  }

  // 5. Extract Heatmap markers
  const rawMarkers = info?.heat_map?.heat_markers || []
  let heatmap: HeatmapPoint[] = rawMarkers.map((m: any) => ({
    timeSec: Math.round(m.time_range_start_millis / 1000),
    intensity: m.heat_marker_intensity_score_normalized || 0
  }))

  // If no heatmap markers from YouTube, generate smooth synthetic curve for visualization
  if (heatmap.length === 0 && duration > 0) {
    const pointsCount = 40
    const step = duration / pointsCount
    for (let i = 0; i <= pointsCount; i++) {
      const t = Math.round(i * step)
      // Natural retention curve (higher at start, drops, small peaks at middle)
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
