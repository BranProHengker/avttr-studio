import { defineEventHandler, readBody, createError } from 'h3'
import { ofetch } from 'ofetch'

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

  const primaryGroqKey = process.env.GROQ_API_KEY || (useRuntimeConfig().groqApiKey as string) || ''
  const backupGroqKey = process.env.GROQ_API_KEY_BACKUP || (useRuntimeConfig().groqApiKeyBackup as string) || ''
  const primaryGeminiKey = process.env.GEMINI_API_KEY || ''
  const backupGeminiKey = process.env.GEMINI_API_KEY_BACKUP || ''

  if (!primaryGroqKey && !backupGroqKey && !primaryGeminiKey && !backupGeminiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'AI API keys (GROQ_API_KEY or GEMINI_API_KEY) are not configured on server'
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
7. DILARANG mengutip key JSON teknis internal (seperti 'top_findings: []', 'slop_score', atau tanda kurung kosong) sebagai evidence. Jika bukti temuan kosong atau bersih, tulis evidence seperti 'clean scan' atau 'tidak ada kata klise'.
Output WAJIB berupa JSON murni tanpa markdown wrapper:
{
  "verdict": "string",
  "roasts": [
    { "line": "string", "evidence": "string" },
    { "line": "string", "evidence": "string" },
    { "line": "string", "evidence": "string" }
  ],
  "fix": "string"
}`
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
7. NEVER quote internal JSON keys (like 'top_findings: []', 'slop_score', or empty brackets) as evidence. If evidence is empty, write 'clean scan' or 'zero buzzwords found'.
Output MUST be strict JSON matching this schema:
{
  "verdict": "string",
  "roasts": [
    { "line": "string", "evidence": "string" },
    { "line": "string", "evidence": "string" },
    { "line": "string", "evidence": "string" }
  ],
  "fix": "string"
}`

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

  const userPrompt = isIndo
    ? `Tulis roasting untuk website ini berdasarkan bukti temuan berikut:\n\n${JSON.stringify(promptEvidence, null, 2)}`
    : `Write a deadpan roast for this website based on the following audit evidence. All text fields (verdict, roasts, fix) MUST be strictly in English:\n\n${JSON.stringify(promptEvidence, null, 2)}`

  let usedModel = 'qwen/qwen3.8-27b (Groq)'
  let parsedResult: any = null

  const callGroq = async (apiKey: string) => {
    const groqRes = await ofetch<any>('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: {
        model: 'qwen/qwen3.8-27b',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_completion_tokens: 1024,
        response_format: { type: 'json_object' }
      },
      timeout: 15000
    })

    const content = groqRes?.choices?.[0]?.message?.content
    if (content) {
      return JSON.parse(content)
    }
    return null
  }

  // 1. Primary Engine: Qwen 3.8-27B via Groq LPUs (with auto-fallback to backup Groq key)
  if (primaryGroqKey) {
    try {
      parsedResult = await callGroq(primaryGroqKey)
      if (parsedResult) usedModel = 'qwen/qwen3.8-27b (Groq Primary)'
    } catch (err: any) {
      console.warn('[SlopSpector] Groq primary key failed, attempting backup key:', err?.message || err)
    }
  }

  if (!parsedResult && backupGroqKey) {
    try {
      parsedResult = await callGroq(backupGroqKey)
      if (parsedResult) usedModel = 'qwen/qwen3.8-27b (Groq Backup)'
    } catch (err: any) {
      console.warn('[SlopSpector] Groq backup key failed, falling back to Gemini:', err?.message || err)
    }
  }

  // 2. Secondary Fallback Engine: Google Gemini
  if (!parsedResult && (primaryGeminiKey || backupGeminiKey)) {
    const callGemini = async (apiKey: string, model: string = 'gemini-2.5-flash-lite') => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
      return await ofetch<any>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          contents: [
            {
              parts: [{ text: userPrompt }]
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
        },
        timeout: 20000
      })
    }

    const tryGemini = async (key: string) => {
      try {
        usedModel = 'gemini-2.5-flash-lite'
        return await callGemini(key, 'gemini-2.5-flash-lite')
      } catch {
        usedModel = 'gemini-2.5-flash'
        return await callGemini(key, 'gemini-2.5-flash')
      }
    }

    let geminiRes: any = null
    if (primaryGeminiKey) {
      try {
        geminiRes = await tryGemini(primaryGeminiKey)
      } catch {
        if (backupGeminiKey) {
          try {
            geminiRes = await tryGemini(backupGeminiKey)
          } catch {}
        }
      }
    } else if (backupGeminiKey) {
      try {
        geminiRes = await tryGemini(backupGeminiKey)
      } catch {}
    }

    if (geminiRes) {
      try {
        const textOut = geminiRes?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
        const cleanJson = textOut.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
        parsedResult = JSON.parse(cleanJson)
      } catch {}
    }
  }

  const defaultFix = isIndo
    ? 'Ganti kata-kata klise dengan bukti produk nyata dan ubah font default template lu.'
    : 'Swap out marketing filler with concrete product facts and custom typography.'

  if (parsedResult) {
    const rawRoasts = Array.isArray(parsedResult.roasts) ? parsedResult.roasts.slice(0, 3) : []
    const cleanedRoasts = rawRoasts.map((r: any) => {
      let ev = String(r?.evidence || '').trim()
      if (/top_findings|slop_score|\[\s*\]/i.test(ev)) {
        ev = ''
      }
      return {
        line: String(r?.line || '').trim(),
        evidence: ev
      }
    })

    return {
      success: true,
      model: usedModel,
      verdict: parsedResult.verdict || verdictLabel,
      roasts: cleanedRoasts,
      fix: parsedResult.fix || defaultFix
    }
  }

  // 3. Graceful deterministic fallback
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
})
