import { ofetch } from 'ofetch'
import { extractYouTubeVideoId, fetchYouTubeHeatmap, type CandidatePeak } from '~/server/utils/scrapers/youtubeHeatmap'
import { validateSafeUrl, checkRateLimit } from '~/server/utils/security'

export interface AutoClipItem {
  id: string
  hook: string
  summary: string
  viralScore: number
  startTime: number
  endTime: number
  duration: number
  framing: 'blur_padded' | 'facecam_gameplay' | 'pan_center'
  subtitles: Array<{
    start: number
    end: number
    text: string
  }>
}

function formatSec(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default defineEventHandler(async (event) => {
  // 1. IP Rate Limiting (20 requests/minute per client IP)
  const clientIp = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const rate = checkRateLimit(`autoclip:${clientIp}`, 20, 60)
  if (!rate.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Terlalu banyak permintaan analisis video. Harap tunggu sebentar.'
    })
  }

  const body = await readBody<{ url?: string; language?: 'id' | 'en' }>(event)
  const rawUrl = body?.url?.trim()
  const language = body?.language || 'id'
  const isIndo = language === 'id'

  if (!rawUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: 'URL video YouTube wajib diisi'
    })
  }

  const safeCheck = validateSafeUrl(rawUrl)
  if (!safeCheck.valid) {
    throw createError({
      statusCode: 400,
      statusMessage: safeCheck.error || 'URL tidak valid'
    })
  }

  const videoId = extractYouTubeVideoId(rawUrl)
  if (!videoId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'URL bukan video YouTube yang valid'
    })
  }

  // -------------------------------------------------------------
  // STAGE 1: Audience Engagement Heatmap (Retention Peaks Math)
  // -------------------------------------------------------------
  let heatmapData
  try {
    heatmapData = await fetchYouTubeHeatmap(videoId)
  } catch (err: any) {
    console.error('[AutoClipper:Stage1] Error fetching heatmap:', err?.message || err)
    throw createError({
      statusCode: 400,
      statusMessage: err?.message || 'Video YouTube ini tidak tersedia atau bersifat privat.'
    })
  }

  const { title, duration, author, thumbnail, heatmap, peaks, streamUrl: resolvedStreamUrl } = heatmapData

  if (!title || duration <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Video YouTube ini tidak tersedia, bersifat privat, atau dibatasi usia sehingga tidak dapat dianalisis.'
    })
  }

  const groqKey = process.env.GROQ_API_KEY || ''
  const geminiKey = process.env.GEMINI_API_KEY || ''
  const geminiBackupKey = process.env.GEMINI_API_KEY_BACKUP || ''

  const peaksInfo = peaks.map((p, idx) => ({
    id: idx + 1,
    peakAt: formatSec(p.peakSec),
    suggestedStartSec: p.suggestedStartSec,
    suggestedEndSec: p.suggestedEndSec,
    durationSec: p.suggestedEndSec - p.suggestedStartSec,
    intensity: `${Math.round(p.intensity * 100)}%`
  }))

  const systemInstruction = isIndo
    ? `Kamu adalah AI Video Editor & Copywriter Medsos spesialis Shorts, Reels, dan TikTok.
Tugasmu adalah menganalisis momen puncak retensi penonton (YouTube Audience Replay Peaks) dan memformulasikan paket klip vertikal 9:16 yang viral.
Aturan:
1. Hasilkan tepat ${peaks.length || 3} klip vertikal berdurasi 25-50 detik.
2. Setiap klip harus punya:
   - hook: judul hook tajam khas medsos (maks 8 kata, huruf kapital di awal, DILARANG EMOJI).
   - summary: 1 kalimat deskripsi inti momen (maks 15 kata).
   - viralScore: integer 85-99 berdasarkan daya tarik.
   - startTime: waktu mulai dalam detik (integer).
   - endTime: waktu selesai dalam detik (integer).
   - framing: 'blur_padded' (default podcast/wawancara), 'facecam_gameplay' (game webcam), atau 'pan_center'.
   - subtitles: 2-3 baris kutipan ucapan dengan timestamp start dan end.
3. Output WAJIB berupa JSON murni:
{
  "clips": [
    {
      "id": "clip_1",
      "hook": "Judul Hook Menarik",
      "summary": "Ringkasan adegan di klip ini",
      "viralScore": 95,
      "startTime": 30,
      "endTime": 75,
      "framing": "blur_padded",
      "subtitles": [
        { "start": 30, "end": 45, "text": "Kutipan ucapan utama" }
      ]
    }
  ]
}`
    : `You are a world-class viral video editor & copywriter specializing in YouTube Shorts, Reels, and TikTok.
Your task is to analyze YouTube Audience Replay Heatmap Peaks and craft high-converting vertical 9:16 clips.
Rules:
1. Produce exactly ${peaks.length || 3} vertical clips (25-50 seconds each).
2. For each clip include:
   - hook: punchy social media headline (max 8 words, capitalize first letter, NO EMOJIS).
   - summary: 1 clear sentence describing what happens (max 15 words).
   - viralScore: integer 85-99.
   - startTime: integer seconds.
   - endTime: integer seconds.
   - framing: 'blur_padded' | 'facecam_gameplay' | 'pan_center'.
   - subtitles: 2-3 timed subtitle lines.
3. Output MUST be strict JSON:
{
  "clips": [
    {
      "id": "clip_1",
      "hook": "Catchy Hook Title",
      "summary": "Scene highlight summary",
      "viralScore": 95,
      "startTime": 30,
      "endTime": 75,
      "framing": "blur_padded",
      "subtitles": [
        { "start": 30, "end": 45, "text": "Key spoken phrase" }
      ]
    }
  ]
}`

  const userPrompt = `Video Title: "${title}"
Channel: "${author?.name || 'YouTube Creator'}"
Total Duration: ${formatSec(duration)} (${duration}s)
Audience Replay Heatmap Retention Peaks:
${JSON.stringify(peaksInfo, null, 2)}

Craft the viral clips around these retention peaks. Output strict JSON.`

  let generatedClips: AutoClipItem[] = []
  let usedEngine = 'algorithmic'

  // -------------------------------------------------------------
  // STAGE 2: Primary Ultra-Fast Inference: Groq Qwen (~500ms)
  // -------------------------------------------------------------
  if (groqKey) {
    try {
      const groqRes = await ofetch<any>('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        body: {
          model: 'qwen/qwen3.8-27b',
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.6,
          max_completion_tokens: 1500,
          response_format: { type: 'json_object' }
        },
        timeout: 8000
      })

      const text = groqRes?.choices?.[0]?.message?.content
      if (text) {
        const cleaned = text.replace(/```json\s*|\s*```/g, '').trim()
        const parsed = JSON.parse(cleaned)
        if (Array.isArray(parsed.clips) && parsed.clips.length > 0) {
          generatedClips = parsed.clips
          usedEngine = 'qwen/qwen3.8-27b (Groq LPUs)'
        }
      }
    } catch (err: any) {
      console.warn('[AutoClipper] Groq inference error:', err?.message || err)
    }
  }

  // -------------------------------------------------------------
  // STAGE 3: Secondary Fallback Engine: Google Gemini 2.5 Flash
  // Safe timeout: 4000ms to guarantee no serverless 502/timeout
  // -------------------------------------------------------------
  if (!generatedClips.length && (geminiKey || geminiBackupKey)) {
    const tryGemini = async (key: string) => {
      try {
        const res = await ofetch<any>(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: {
              contents: [
                {
                  parts: [
                    { text: `${systemInstruction}\n\n${userPrompt}` }
                  ]
                }
              ],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.6
              }
            },
            timeout: 4000
          }
        )

        const text = res?.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) {
          const cleaned = text.replace(/```json\s*|\s*```/g, '').trim()
          const parsed = JSON.parse(cleaned)
          if (Array.isArray(parsed.clips) && parsed.clips.length > 0) {
            generatedClips = parsed.clips
            usedEngine = 'gemini-2.5-flash'
            return true
          }
        }
      } catch (err: any) {
        console.warn('[AutoClipper] Gemini fallback error:', err?.message || err)
      }
      return false
    }

    if (geminiKey) await tryGemini(geminiKey)
    if (!generatedClips.length && geminiBackupKey) await tryGemini(geminiBackupKey)
  }

  // -------------------------------------------------------------
  // STAGE 4: Safety Algorithmic Heatmap Fallback (Instant, 0s)
  // -------------------------------------------------------------
  if (!generatedClips.length) {
    usedEngine = 'heatmap-heuristic'
    generatedClips = peaks.map((p, idx) => {
      const start = Math.max(0, p.suggestedStartSec)
      const end = Math.min(duration, p.suggestedEndSec)
      const hookTitle = isIndo
        ? `Momen Viral #${idx + 1} (${formatSec(p.peakSec)})`
        : `Viral Highlight #${idx + 1} (${formatSec(p.peakSec)})`
      const summaryText = isIndo
        ? `Puncak retensi penonton YouTube pada menit ${formatSec(p.peakSec)}.`
        : `Audience retention peak detected at ${formatSec(p.peakSec)}.`

      return {
        id: `clip_${idx + 1}`,
        hook: hookTitle,
        summary: summaryText,
        viralScore: Math.min(98, Math.max(86, Math.round(88 + p.intensity * 10))),
        startTime: start,
        endTime: end,
        duration: end - start,
        framing: 'blur_padded' as const,
        subtitles: [
          {
            start,
            end,
            text: title
          }
        ]
      }
    })
  }

  // -------------------------------------------------------------
  // STAGE 5: Boundary Sanitization (Guarantee valid duration)
  // -------------------------------------------------------------
  const validatedClips: AutoClipItem[] = generatedClips.map((c, idx) => {
    let start = Math.max(0, Math.floor(Number(c.startTime) || 0))
    let end = Math.min(duration, Math.ceil(Number(c.endTime) || start + 40))
    if (end <= start) end = Math.min(duration, start + 30)

    // Ensure at least 15-30s duration if video length permits
    if (end - start < 15 && duration >= 30) {
      end = Math.min(duration, start + 30)
      if (end - start < 15) {
        start = Math.max(0, end - 30)
      }
    }
    const clipDuration = Math.max(1, end - start)

    const hookClean = (c.hook || `Highlight #${idx + 1}`)
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu, '')
      .replace(/[*_~`]/g, '')
      .trim()

    return {
      id: c.id || `clip_${idx + 1}`,
      hook: hookClean || `Highlight #${idx + 1}`,
      summary: c.summary || `Scene highlight from ${formatSec(start)} to ${formatSec(end)}`,
      viralScore: Math.min(99, Math.max(80, Math.round(Number(c.viralScore) || 90))),
      startTime: start,
      endTime: end,
      duration: clipDuration,
      framing: ['blur_padded', 'facecam_gameplay', 'pan_center'].includes(c.framing) ? c.framing : 'blur_padded',
      subtitles: Array.isArray(c.subtitles) && c.subtitles.length > 0
        ? c.subtitles
        : [{ start, end, text: hookClean }]
    }
  })

  // Resolve direct progressive stream URL for custom HTML5 player & trimming
  const directStreamUrl = resolvedStreamUrl || ''

  return {
    success: true,
    videoId,
    title,
    duration,
    author,
    thumbnail,
    heatmap,
    clips: validatedClips,
    engine: usedEngine,
    streamUrl: directStreamUrl ? `/api/proxy?url=${encodeURIComponent(directStreamUrl)}` : ''
  }
})
