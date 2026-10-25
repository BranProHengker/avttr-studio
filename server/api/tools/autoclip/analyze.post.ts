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

interface SceneInspection {
  peakSec: number
  exactStartSec: number
  exactEndSec: number
  visualType: 'facecam_gameplay' | 'talking_head' | 'action_scene'
  sceneSummary: string
  spokenKeyQuotes?: string[]
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
      statusCode: 502,
      statusMessage: `Gagal memuat data video YouTube: ${err?.message || 'Video dibatasi atau tidak dapat diakses'}`
    })
  }

  const { title, duration, author, thumbnail, heatmap, peaks } = heatmapData
  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`

  const geminiKey = process.env.GEMINI_API_KEY || ''
  const geminiBackupKey = process.env.GEMINI_API_KEY_BACKUP || ''
  const groqKey = process.env.GROQ_API_KEY || ''

  const peaksInfo = peaks.map((p, idx) => ({
    id: idx + 1,
    peakAt: formatSec(p.peakSec),
    peakSec: p.peakSec,
    suggestedStartSec: p.suggestedStartSec,
    suggestedEndSec: p.suggestedEndSec,
    intensity: `${Math.round(p.intensity * 100)}%`
  }))

  let inspectedScenes: SceneInspection[] = []
  let stage2Engine = 'skipped'

  // -------------------------------------------------------------
  // STAGE 2: Video & Audio Context Inspector (Google Gemini)
  // Role: "Eyes & Ears" (Inspect scenes at audience peaks, boundary alignment)
  // -------------------------------------------------------------
  const geminiInspectionPrompt = `You are a precision video scene inspector.
Analyze this video at these specific viewer retention peaks:
${JSON.stringify(peaksInfo, null, 2)}

For each peak, inspect what happens in the video and audio. Return strict JSON:
{
  "scenes": [
    {
      "peakSec": 45,
      "exactStartSec": 35,
      "exactEndSec": 75,
      "visualType": "talking_head",
      "sceneSummary": "Factual 1-sentence description of what happens or what is discussed.",
      "spokenKeyQuotes": ["Important spoken sentence or lyric 1", "Sentence 2"]
    }
  ]
}
visualType must be one of: "facecam_gameplay" (webcam gamer corner present), "talking_head" (podcast/interview/speech), or "action_scene" (widescreen b-roll/movement).`

  const callGeminiInspector = async (key: string) => {
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
            { type: 'text', text: geminiInspectionPrompt },
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
        if (Array.isArray(parsed.scenes) && parsed.scenes.length > 0) {
          inspectedScenes = parsed.scenes
          stage2Engine = 'gemini-2.5-flash (Visual & Audio Inspector)'
          return true
        }
      }
    } catch (err: any) {
      console.warn('[AutoClipper:Stage2] Gemini inspection error:', err?.message || err)
    }
    return false
  }

  if (geminiKey) {
    await callGeminiInspector(geminiKey)
  }
  if (!inspectedScenes.length && geminiBackupKey) {
    await callGeminiInspector(geminiBackupKey)
  }

  // Fallback for Stage 2 if Gemini was unavailable: construct baseline scene contexts from Heatmap
  if (!inspectedScenes.length) {
    stage2Engine = 'heatmap-heuristic (Baseline Inspector)'
    inspectedScenes = peaks.map((p) => ({
      peakSec: p.peakSec,
      exactStartSec: p.suggestedStartSec,
      exactEndSec: p.suggestedEndSec,
      visualType: 'talking_head',
      sceneSummary: `Audience retention peak around ${formatSec(p.peakSec)} in "${title}".`,
      spokenKeyQuotes: [title]
    }))
  }

  // -------------------------------------------------------------
  // STAGE 3: Viral Copywriter & Subtitle Crafter (Groq Qwen LPU)
  // Role: "Social Media Editor & Copywriter" (Craft punchy hooks, virality score, SRT cues)
  // -------------------------------------------------------------
  let generatedClips: AutoClipItem[] = []
  let stage3Engine = 'fallback'

  const copywriterPrompt = isIndo
    ? `Kamu adalah editor medsos & copywriter viral kelas dunia untuk TikTok, Reels, dan Shorts.
Berdasarkan hasil inspeksi adegan video berikut:
Judul Video: "${title}"
Durasi Total: ${formatSec(duration)}
Hasil Inspeksi Adegan:
${JSON.stringify(inspectedScenes, null, 2)}

Buat ${inspectedScenes.length} klip vertikal 9:16 yang siap viral.
Aturan:
1. hook: judul hook tajam khas medsos (maks 8 kata, huruf kapital di awal, DILARANG EMOJI).
2. summary: 1 kalimat penjelasan isi klip (maks 15 kata).
3. viralScore: angka integer 85-99 berdasarkan daya tarik.
4. framing: jika visualType "facecam_gameplay" gunakan "facecam_gameplay", jika "action_scene" gunakan "pan_center", selain itu gunakan "blur_padded".
5. subtitles: 2-3 baris kutipan ucapan dengan timestamp start dan end.
Output WAJIB berupa JSON murni:
{
  "clips": [
    {
      "id": "clip_1",
      "hook": "Judul Hook Menarik",
      "summary": "Ringkasan adegan di klip ini",
      "viralScore": 96,
      "startTime": 30,
      "endTime": 75,
      "framing": "blur_padded",
      "subtitles": [
        { "start": 30, "end": 45, "text": "Kutipan ucapan utama" }
      ]
    }
  ]
}`
    : `You are a world-class social media viral copywriter for TikTok, Reels, and YouTube Shorts.
Based on the following inspected scene data:
Video Title: "${title}"
Total Duration: ${formatSec(duration)}
Inspected Scene Data:
${JSON.stringify(inspectedScenes, null, 2)}

Create ${inspectedScenes.length} vertical 9:16 viral clip packages.
Rules:
1. hook: punchy social media headline (max 8 words, capitalize first letter, NO EMOJIS).
2. summary: 1 clear sentence describing what happens (max 15 words).
3. viralScore: integer 85-99 based on virality.
4. framing: if visualType is "facecam_gameplay" use "facecam_gameplay", if "action_scene" use "pan_center", otherwise "blur_padded".
5. subtitles: 2-3 timed subtitle lines with start and end seconds.
Output strict JSON:
{
  "clips": [
    {
      "id": "clip_1",
      "hook": "Catchy Hook Title",
      "summary": "Scene highlight summary",
      "viralScore": 96,
      "startTime": 30,
      "endTime": 75,
      "framing": "blur_padded",
      "subtitles": [
        { "start": 30, "end": 45, "text": "Key spoken phrase" }
      ]
    }
  ]
}`

  // Call Groq Qwen (Stage 3 Primary Copywriter)
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
            { role: 'system', content: 'You are an expert viral video copywriter. Output strict JSON only.' },
            { role: 'user', content: copywriterPrompt }
          ],
          temperature: 0.6,
          max_completion_tokens: 1500,
          response_format: { type: 'json_object' }
        },
        timeout: 12000
      })

      const text = groqRes?.choices?.[0]?.message?.content
      if (text) {
        const cleaned = text.replace(/```json\s*|\s*```/g, '').trim()
        const parsed = JSON.parse(cleaned)
        if (Array.isArray(parsed.clips) && parsed.clips.length > 0) {
          generatedClips = parsed.clips
          stage3Engine = 'qwen/qwen3.8-27b (Groq LPUs)'
        }
      }
    } catch (err: any) {
      console.warn('[AutoClipper:Stage3] Groq copywriter error:', err?.message || err)
    }
  }

  // Fallback for Stage 3: Direct construction from Stage 2 Scene Inspection
  if (!generatedClips.length) {
    stage3Engine = 'heuristic-formatter'
    generatedClips = inspectedScenes.map((scene, idx) => {
      const start = Math.max(0, scene.exactStartSec)
      const end = Math.min(duration, scene.exactEndSec)
      const hookTitle = isIndo
        ? `Sorotan Viral #${idx + 1} (${formatSec(scene.peakSec)})`
        : `Viral Highlight #${idx + 1} (${formatSec(scene.peakSec)})`

      return {
        id: `clip_${idx + 1}`,
        hook: hookTitle,
        summary: scene.sceneSummary,
        viralScore: Math.min(98, Math.max(86, 90 + idx)),
        startTime: start,
        endTime: end,
        duration: end - start,
        framing: scene.visualType === 'facecam_gameplay'
          ? 'facecam_gameplay'
          : scene.visualType === 'action_scene'
            ? 'pan_center'
            : 'blur_padded',
        subtitles: (scene.spokenKeyQuotes || [title]).map(q => ({
          start,
          end,
          text: q
        }))
      }
    })
  }

  // -------------------------------------------------------------
  // STAGE 4: Boundary Sanitization & Quality Verification
  // -------------------------------------------------------------
  const validatedClips: AutoClipItem[] = generatedClips.map((c, idx) => {
    let start = Math.max(0, Math.floor(Number(c.startTime) || 0))
    let end = Math.min(duration, Math.ceil(Number(c.endTime) || start + 45))
    if (end <= start) end = Math.min(duration, start + 30)
    const clipDuration = end - start

    // Clean any unwanted emojis or markdown
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

  const orchestratedEngineLabel = `${stage2Engine} + ${stage3Engine}`

  return {
    success: true,
    videoId,
    title,
    duration,
    author,
    thumbnail,
    heatmap,
    clips: validatedClips,
    engine: orchestratedEngineLabel
  }
})
