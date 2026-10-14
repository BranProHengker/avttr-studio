import { defineEventHandler, readBody, createError } from 'h3'

interface RoastRequest {
  siteName: string
  score: number
  verdictLabel: string
  findings: Array<{
    label: string
    pts: number
    quotes: string[]
    why: string
  }>
  language?: 'id' | 'en'
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RoastRequest>(event)
  const { siteName, score, verdictLabel, findings = [], language = 'id' } = body || {}

  if (!siteName) {
    throw createError({ statusCode: 400, statusMessage: 'Site name is required' })
  }

  const primaryKey = process.env.GEMINI_API_KEY
  const backupKey = process.env.GEMINI_API_KEY_BACKUP

  if (!primaryKey && !backupKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Gemini API key is not configured on server'
    })
  }

  const isIndo = language === 'id'

  const systemInstruction = isIndo
    ? `Kamu adalah "SlopSpector", seorang juri desain & senior developer yang sangat sinis, sarkastik, dan deadpan terhadap website buatan generator AI murahan ("AI Slop").
Gaya bahasa: santai, gaul, dingin, sarkas dev lokal Indonesia, huruf kecil di awal atau gaya chat. Kalimat padat dan lucu karena akurat.
Aturan:
1. Setiap roasting HARUS menunjuk langsung pada bukti temuan (kata klise, font, CSS class, statistik halu, dsb). Jangan mengarang fitur yang tidak ada di bukti.
2. Skor bersifat mutlak: di bawah 25% agak terkesan enggan, 25-50% curiga dan menyindir, di atas 50% bantai tanpa ampun.
3. verdict: tepat 1 baris singkat (maksimal 8 kata), tanpa tanda titik di akhir.
4. roasts: tepat 3 poin roasting. Setiap poin berisi:
   - line: kalimat roasting pedas dan sarkas (maksimal 20 kata).
   - evidence: kutipan bukti singkat atau nama pola (maksimal 10 kata).
5. fix: 1 kalimat saran perbaikan paling praktis dan berdampak besar (maksimal 20 kata).
6. DILARANG menggunakan emoji, dilarang em-dash, dilarang hashtag. Sindir websitenya, bukan orangnya.
Output WAJIB berupa JSON murni tanpa markdown wrapper.`
    : `You are "SlopSpector", a deadpan critic that roasts websites for looking AI generated ("AI slop").
House voice: lowercase, dry, specific, like a friend who designs for a living. Short sentences. Funny because it is accurate.
Rules:
1. Every roast points at something in the evidence: a quoted phrase, a class name, a color, a pattern. Never invent quotes or features.
2. The score is final. Match it: under 25 be grudgingly impressed, 25 to 50 smug and suspicious, over 50 merciless.
3. verdict: one line, at most 8 words, no full stop at the end.
4. roasts: exactly 3. Each item has:
   - line: at most 20 words.
   - evidence: exact short quote or pattern, at most 10 words.
5. fix: one practical sentence, at most 20 words, the single change that would help most.
6. No emoji, no em dashes, no hashtags. Punch at the website, never at people.
Output MUST be strict JSON only.`

  const promptEvidence = {
    website: siteName,
    slop_score: `${score}%`,
    verdict_level: verdictLabel,
    top_findings: findings.slice(0, 8).map((f) => ({
      issue: f.label,
      evidence: f.quotes.join(', '),
      detail: f.why
    }))
  }

  const requestPayload = {
    contents: [
      {
        parts: [
          {
            text: isIndo
              ? `Tulis roasting untuk website ini berdasarkan bukti temuan berikut:\n\n${JSON.stringify(promptEvidence, null, 2)}`
              : `Write a deadpan roast for this website based on the following audit evidence. All text fields (verdict, roasts, fix) MUST be strictly in English:\n\n${JSON.stringify(promptEvidence, null, 2)}`
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json'
    }
  }

  const callGemini = async (apiKey: string, model: string = 'gemini-2.5-flash-lite') => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    return await $fetch<any>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestPayload,
      timeout: 30000
    })
  }

  let responseData: any
  let usedModel = 'gemini-2.5-flash-lite'

  const tryCall = async (key: string) => {
    try {
      return await callGemini(key, 'gemini-2.5-flash-lite')
    } catch {
      usedModel = 'gemini-2.5-flash'
      return await callGemini(key, 'gemini-2.5-flash')
    }
  }

  if (primaryKey) {
    try {
      responseData = await tryCall(primaryKey)
    } catch {
      if (backupKey) {
        try {
          responseData = await tryCall(backupKey)
        } catch {}
      }
    }
  } else if (backupKey) {
    try {
      responseData = await tryCall(backupKey)
    } catch {}
  }

  const defaultFix = isIndo
    ? 'Ganti kata-kata klise dengan bukti produk nyata dan ubah font default template lu.'
    : 'Swap out marketing filler with concrete product facts and custom typography.'

  if (!responseData) {
    // Graceful offline fallback roast if API quota exhausted
    return {
      success: true,
      model: 'deterministic-fallback',
      verdict: isIndo
        ? (score > 60 ? 'kebanyakan prompt dikit mikir' : 'masih ada aroma template')
        : (score > 60 ? 'bro just prompted and prayed' : 'prompt residue detected'),
      roasts: findings.slice(0, 3).map((f) => ({
        line: f.label,
        evidence: f.quotes[0] || f.label
      })),
      fix: defaultFix
    }
  }

  try {
    const textOut = responseData?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const cleanJson = textOut.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
    const parsed = JSON.parse(cleanJson)

    return {
      success: true,
      model: usedModel,
      verdict: parsed.verdict || verdictLabel,
      roasts: Array.isArray(parsed.roasts) ? parsed.roasts.slice(0, 3) : [],
      fix: parsed.fix || defaultFix
    }
  } catch {
    return {
      success: true,
      model: usedModel,
      verdict: verdictLabel,
      roasts: findings.slice(0, 3).map((f) => ({
        line: f.label,
        evidence: f.quotes[0] || f.label
      })),
      fix: defaultFix
    }
  }
})
