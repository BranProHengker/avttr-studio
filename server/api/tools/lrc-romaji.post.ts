export interface RomajiLineItem {
  time: string
  seconds: number
  original: string
  romaji: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const lyrics = (body?.lyrics as string)?.trim() || ''

  if (!lyrics) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Lyrics content is required.'
    })
  }

  const config = useRuntimeConfig()
  const primaryKey = process.env.GEMINI_API_KEY || (config.geminiApiKey as string) || ''
  const backupKey = process.env.GEMINI_API_KEY_BACKUP || ''

  if (!primaryKey && !backupKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Gemini API key is not configured.'
    })
  }

  // Parse lines with timestamps
  const rawLines = lyrics.split('\n').map((l) => l.trim()).filter(Boolean)
  const timeRegex = /^\[(\d{2}):(\d{2}\.\d{2,3})\](.*)$/

  // Extract lines that actually contain Japanese characters
  const jpRegex = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/
  const hasJapanese = rawLines.some((l) => jpRegex.test(l))

  if (!hasJapanese) {
    return {
      success: true,
      isJapanese: false,
      message: 'No Japanese Kanji/Kana detected in lyrics.',
      romajiLrc: lyrics,
      dualLrc: lyrics,
      lines: []
    }
  }

  const systemInstruction = `You are an expert Japanese lyric transliterator. Your job is to convert Japanese lyrics (Kanji, Hiragana, Katakana) into accurate, natural Hepburn Romaji.
RULES:
1. Every line begins with a timestamp in square brackets like [mm:ss.xx]. You MUST PRESERVE the exact timestamp [mm:ss.xx] at the start of each line without changing numbers or formatting!
2. Transcribe only the Japanese text to Hepburn Romaji. If words are already in English or numbers, leave them exactly as they are.
3. Use natural word separation for Romaji (e.g. "Natsu ni naru mae ni kono mune ni chiru hanabi o kaita").
4. Output ONLY the lines with [mm:ss.xx] Romaji text. Do not add markdown fences, conversational text, explanations, or notes.`

  const prompt = `Transcribe the following Japanese synced lyrics into Romaji while strictly keeping each [mm:ss.xx] timestamp:\n\n${lyrics}`

  const requestPayload = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192
    }
  }

  const callGemini = async (apiKey: string) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
    return await $fetch<any>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestPayload,
      timeout: 60000
    })
  }

  let responseData: any
  let lastError: any

  if (primaryKey) {
    try {
      responseData = await callGemini(primaryKey)
    } catch (err: any) {
      lastError = err
      // Automatic seamless failover to backup key on any error
      if (backupKey) {
        try {
          responseData = await callGemini(backupKey)
        } catch (backupErr: any) {
          lastError = backupErr
        }
      }
    }
  } else if (backupKey) {
    try {
      responseData = await callGemini(backupKey)
    } catch (err: any) {
      lastError = err
    }
  }

  if (!responseData) {
    const isQuotaExhausted =
      lastError?.statusCode === 429 ||
      lastError?.response?.status === 429 ||
      lastError?.data?.error?.code === 429 ||
      lastError?.message?.includes('RESOURCE_EXHAUSTED') ||
      lastError?.data?.error?.message?.includes('RESOURCE_EXHAUSTED') ||
      lastError?.data?.error?.message?.includes('quota')

    const errorMsg = isQuotaExhausted
      ? 'Batas kuota harian Gemini API telah habis. Silakan coba kembali besok setelah kuota di-reset.'
      : lastError?.data?.error?.message || lastError?.message || 'Failed to convert lyrics to Romaji'

    throw createError({
      statusCode: lastError?.statusCode || (isQuotaExhausted ? 429 : 500),
      statusMessage: errorMsg
    })
  }

  const rawCandidate = responseData.candidates?.[0]?.content?.parts?.[0]?.text || ''
  let cleanedRomajiLrc = rawCandidate.trim()

  if (cleanedRomajiLrc.startsWith('```markdown') && cleanedRomajiLrc.endsWith('```')) {
    cleanedRomajiLrc = cleanedRomajiLrc.slice(11, -3).trim()
  } else if (cleanedRomajiLrc.startsWith('```') && cleanedRomajiLrc.endsWith('```')) {
    cleanedRomajiLrc = cleanedRomajiLrc.slice(3, -3).trim()
  }

  // Parse lines to build dual-line and line items
  const romajiLines = cleanedRomajiLrc.split('\n').map((l: string) => l.trim()).filter(Boolean)
  const romajiMap = new Map<string, string>()

  for (const rLine of romajiLines) {
    const match = rLine.match(timeRegex)
    if (match) {
      const timeTag = `[${match[1]}:${match[2]}]`
      romajiMap.set(timeTag, match[3].trim())
    }
  }

  const lineItems: RomajiLineItem[] = []
  const dualLrcLines: string[] = []

  for (const origLine of rawLines) {
    const match = origLine.match(timeRegex)
    if (match) {
      const min = parseInt(match[1], 10)
      const sec = parseFloat(match[2])
      const totalSeconds = min * 60 + sec
      const timeTag = `[${match[1]}:${match[2]}]`
      const origText = match[3].trim()
      const romajiText = romajiMap.get(timeTag) || origText

      lineItems.push({
        time: `${match[1]}:${match[2]}`,
        seconds: totalSeconds,
        original: origText,
        romaji: romajiText
      })

      // Standard dual-line repeated timestamp
      dualLrcLines.push(`${timeTag} ${origText}`)
      if (romajiText && romajiText !== origText) {
        dualLrcLines.push(`${timeTag} ${romajiText}`)
      }
    } else {
      // Header tag or empty line
      dualLrcLines.push(origLine)
    }
  }

  return {
    success: true,
    isJapanese: true,
    romajiLrc: cleanedRomajiLrc,
    dualLrc: dualLrcLines.join('\n'),
    lines: lineItems
  }
})
