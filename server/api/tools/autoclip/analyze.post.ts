import { defineEventHandler, readBody, createError } from 'h3'
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
  // 1. Rate limiting (20 requests/minute per client IP)
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

  // 2. Fetch Video Details & Engagement Heatmap
  let heatmapData
  try {
    heatmapData = await fetchYouTubeHeatmap(videoId)
  } catch (err: any) {
    console.error('[AutoClipper] Error fetching YouTube heatmap:', err?.message || err)
    throw createError({
      statusCode: 502,
      statusMessage: `Gagal memuat data video YouTube: ${err?.message || 'Video dibatasi atau tidak dapat diakses'}`
    })
  }

  const { title, duration, author, thumbnail, heatmap, peaks } = heatmapData
  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`

  // 3. AI Refinement Engine
  const geminiKey = process.env.GEMINI_API_KEY || ''
  const geminiBackupKey = process.env.GEMINI_API_KEY_BACKUP || ''
  const groqKey = process.env.GROQ_API_KEY || ''

  const peaksEvidence = peaks.map((p, idx) => ({
    clipNumber: idx + 1,
    detectedPeakAt: formatSec(p.peakSec),
    peakIntensityScore: `${Math.round(p.intensity * 100)}%`,
    suggestedWindow: `${formatSec(p.suggestedStartSec)} - ${formatSec(p.suggestedEndSec)}`
  }))

  const systemInstruction = isIndo
    ? `Kamu adalah AI Video Editor profesional spesialis Shorts, Reels, dan TikTok.
Tugasmu adalah menganalisis momen viral berdasarkan Engagement Heatmap (kurva bagian yang paling sering diputar ulang oleh penonton YouTube).
Aturan:
1. Hasilkan tepat ${peaks.length || 3} klip vertikal berdurasi 30-55 detik.
2. Setiap klip harus punya:
   - hook: judul hook tajam khas medsos (maks 8 kata, huruf kapital di awal, punchy, DILARANG EMOJI).
   - summary: 1 kalimat deskripsi inti adegan (maks 15 kata).
   - viralScore: angka integer antara 85 sampai 99 berdasarkan daya tarik momen.
   - startTime: waktu mulai dalam detik (integer).
   - endTime: waktu selesai dalam detik (integer).
   - framing: 'blur_padded' (default untuk podcast/wawancara), 'facecam_gameplay' (jika ada webcam game), atau 'pan_center' (jika aksi di tengah).
   - subtitles: 2 sampai 4 baris teks ucapan/momen penting dengan timestamp start dan end.
3. Output WAJIB berupa JSON murni tanpa markdown wrapper:
{
  "clips": [
    {
      "id": "clip_1",
      "hook": "Judul Hook Menarik",
      "summary": "Ringkasan adegan di klip ini",
      "viralScore": 94,
      "startTime": 12,
      "endTime": 48,
      "framing": "blur_padded",
      "subtitles": [
        { "start": 12, "end": 18, "text": "Kalimat penting pembuka" }
      ]
    }
  ]
}`
    : `You are a professional AI Video Editor specializing in viral Shorts, Reels, and TikTok clips.
Your task is to identify and refine viral clip candidates based on YouTube's Engagement Heatmap ('Most Replayed' audience peaks).
Rules:
1. Produce exactly ${peaks.length || 3} vertical clips (30-55 seconds each).
2. For each clip include:
   - hook: punchy social media headline (max 8 words, NO EMOJIS).
   - summary: 1 clear sentence describing what happens (max 15 words).
   - viralScore: integer between 85 and 99.
   - startTime: integer seconds.
   - endTime: integer seconds.
   - framing: 'blur_padded' | 'facecam_gameplay' | 'pan_center'.
   - subtitles: 2 to 4 timed caption lines.
3. Output MUST be strict JSON:
{
  "clips": [
    {
      "id": "clip_1",
      "hook": "Catchy Hook Headline",
      "summary": "Description of the highlight",
      "viralScore": 95,
      "startTime": 12,
      "endTime": 48,
      "framing": "blur_padded",
      "subtitles": [
        { "start": 12, "end": 18, "text": "Key spoken phrase" }
      ]
    }
  ]
}`

  const userPrompt = `Video Title: "${title}"
Total Duration: ${formatSec(duration)} (${duration}s)
YouTube Viewer Replay Heatmap Peaks:
${JSON.stringify(peaksEvidence, null, 2)}

Refine each peak into a viral vertical clip.`

  let generatedClips: AutoClipItem[] = []
  let usedEngine = 'algorithmic'

  // Strategy 1: Google Gemini Interactions API (natively inspects video & audio)
  const tryGemini = async (key: string) => {
    try {
      const res = await ofetch<any>('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: {
          'x-goog-api-key': key,
          'Content-Type': 'application/json'
        },
        body: {
          model: 'gemini-2.5-flash',
          input: [
            { type: 'text', text: `${systemInstruction}\n\n${userPrompt}` },
            { type: 'video', uri: canonicalUrl }
          ],
          response_format: { type: 'json_object' }
        },
        timeout: 25000
      })

      const modelStep = res?.steps?.find((s: any) => s.type === 'model_output')
      const text = modelStep?.content?.[0]?.text
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
      console.warn('[AutoClipper] Gemini Interactions API error:', err?.message || err)
    }
    return false
  }

  if (geminiKey) {
    await tryGemini(geminiKey)
  }
  if (!generatedClips.length && geminiBackupKey) {
    await tryGemini(geminiBackupKey)
  }

  // Strategy 2: Groq Qwen Fallback
  if (!generatedClips.length && groqKey) {
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
        timeout: 15000
      })

      const text = groqRes?.choices?.[0]?.message?.content
      if (text) {
        const cleaned = text.replace(/```json\s*|\s*```/g, '').trim()
        const parsed = JSON.parse(cleaned)
        if (Array.isArray(parsed.clips) && parsed.clips.length > 0) {
          generatedClips = parsed.clips
          usedEngine = 'qwen/qwen3.8-27b (Groq)'
        }
      }
    } catch (err: any) {
      console.warn('[AutoClipper] Groq fallback error:', err?.message || err)
    }
  }

  // Strategy 3: Algorithmic Fallback from Real Heatmap Peaks
  if (!generatedClips.length) {
    usedEngine = 'heatmap-heuristic'
    generatedClips = peaks.map((p, idx) => {
      const hookTitle = isIndo
        ? `Sorotan Viral #${idx + 1} (${formatSec(p.peakSec)})`
        : `Viral Highlight #${idx + 1} (${formatSec(p.peakSec)})`
      const summaryText = isIndo
        ? `Puncak interaksi penonton terbanyak pada menit ${formatSec(p.peakSec)}.`
        : `Highest viewer rewind peak detected around ${formatSec(p.peakSec)}.`

      return {
        id: `clip_${idx + 1}`,
        hook: hookTitle,
        summary: summaryText,
        viralScore: Math.min(98, Math.max(85, Math.round(85 + p.intensity * 13))),
        startTime: p.suggestedStartSec,
        endTime: p.suggestedEndSec,
        duration: p.suggestedEndSec - p.suggestedStartSec,
        framing: 'blur_padded' as const,
        subtitles: [
          {
            start: p.suggestedStartSec,
            end: p.suggestedEndSec,
            text: title
          }
        ]
      }
    })
  }

  // Sanitize clip timestamps to guarantee valid bounds
  const validatedClips: AutoClipItem[] = generatedClips.map((c, idx) => {
    let start = Math.max(0, Math.floor(Number(c.startTime) || 0))
    let end = Math.min(duration, Math.ceil(Number(c.endTime) || start + 45))
    if (end <= start) end = Math.min(duration, start + 30)
    const clipDuration = end - start

    return {
      id: c.id || `clip_${idx + 1}`,
      hook: (c.hook || `Highlight #${idx + 1}`).replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu, '').trim(),
      summary: c.summary || `Scene highlight from ${formatSec(start)} to ${formatSec(end)}`,
      viralScore: Math.min(99, Math.max(80, Math.round(Number(c.viralScore) || 90))),
      startTime: start,
      endTime: end,
      duration: clipDuration,
      framing: ['blur_padded', 'facecam_gameplay', 'pan_center'].includes(c.framing) ? c.framing : 'blur_padded',
      subtitles: Array.isArray(c.subtitles) ? c.subtitles : []
    }
  })

  return {
    success: true,
    videoId,
    title,
    duration,
    author,
    thumbnail,
    heatmap,
    clips: validatedClips,
    engine: usedEngine
  }
})
