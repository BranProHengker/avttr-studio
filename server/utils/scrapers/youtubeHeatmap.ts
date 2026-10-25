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
  if (!points || points.length === 0) {
    // Fallback: Segment video into 3-4 evenly spaced clips
    const fallbackDuration = Math.min(45, Math.max(20, Math.floor(totalDuration / 4)))
    const step = Math.floor(totalDuration / (maxPeaks + 1))
    const peaks: CandidatePeak[] = []
    for (let i = 1; i <= maxPeaks; i++) {
      const center = step * i
      peaks.push({
        peakSec: center,
        intensity: 0.8,
        suggestedStartSec: Math.max(0, center - Math.floor(fallbackDuration / 2)),
        suggestedEndSec: Math.min(totalDuration, center + Math.ceil(fallbackDuration / 2))
      })
    }
    return peaks
  }

  // 1. Identify local maxima
  const rawPeaks: HeatmapPoint[] = []
  
  // Include initial hook if intensity is high
  if (points[0] && points[0].intensity >= 0.35) {
    rawPeaks.push({ timeSec: points[0].timeSec, intensity: points[0].intensity })
  }

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1].intensity
    const curr = points[i].intensity
    const next = points[i + 1].intensity

    if (curr > prev && curr > next && curr >= 0.2) {
      rawPeaks.push(points[i])
    }
  }

  // Sort peaks by intensity descending
  rawPeaks.sort((a, b) => b.intensity - a.intensity)

  // 2. Filter peaks that are too close to each other (min 35 seconds gap)
  const selectedPeaks: CandidatePeak[] = []
  const minGapSec = 35
  const clipLengthSec = 45

  for (const p of rawPeaks) {
    const tooClose = selectedPeaks.some(sp => Math.abs(sp.peakSec - p.timeSec) < minGapSec)
    if (!tooClose) {
      // Calculate start and end centered around peak, biased towards buildup (15s before, 30s after)
      let start = Math.max(0, p.timeSec - 15)
      let end = Math.min(totalDuration, start + clipLengthSec)
      if (end - start < 30 && totalDuration >= 30) {
        start = Math.max(0, end - 30)
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

  // If we couldn't find enough local maxima, fill with highest remaining points
  if (selectedPeaks.length < Math.min(3, maxPeaks)) {
    const sortedPoints = [...points].sort((a, b) => b.intensity - a.intensity)
    for (const p of sortedPoints) {
      const tooClose = selectedPeaks.some(sp => Math.abs(sp.peakSec - p.timeSec) < minGapSec)
      if (!tooClose) {
        const start = Math.max(0, p.timeSec - 15)
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

  // Sort chronologically by start time for natural flow
  selectedPeaks.sort((a, b) => a.suggestedStartSec - b.suggestedStartSec)
  return selectedPeaks
}

export async function fetchYouTubeHeatmap(videoId: string): Promise<YouTubeHeatmapResult> {
  const yt = await getInnertube()
  const info = await yt.getInfo(videoId)

  const title = info.basic_info?.title || 'YouTube Video'
  const duration = info.basic_info?.duration || 0
  const authorName = info.basic_info?.author || ''
  const thumbnail = info.basic_info?.thumbnail?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`

  const rawMarkers = info.heat_map?.heat_markers || []
  const heatmap: HeatmapPoint[] = rawMarkers.map((m: any) => ({
    timeSec: Math.round(m.time_range_start_millis / 1000),
    intensity: m.heat_marker_intensity_score_normalized || 0
  }))

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
