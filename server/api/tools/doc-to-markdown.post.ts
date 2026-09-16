import { defineEventHandler, readBody, createError } from 'h3'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { fileBase64, mimeType = 'application/pdf' } = body || {}

  if (!fileBase64) {
    throw createError({
      statusCode: 400,
      statusMessage: 'File data is required (fileBase64)'
    })
  }

  const primaryKey = process.env.GEMINI_API_KEY
  const backupKey = process.env.GEMINI_API_KEY_BACKUP

  if (!primaryKey && !backupKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Gemini API key is not configured on server'
    })
  }

  // Strip data URL prefix if present
  const base64Data = fileBase64.replace(/^data:.*?;base64,/, '')

  const systemInstruction = `You are a professional document OCR and structural transcription parser. 
Convert the provided document (PDF or image) into clean, high-fidelity GitHub-Flavored Markdown.
Guidelines:
1. Preserve structure: accurately map titles to # Heading 1, sections to ## Heading 2, subsections to ### Heading 3.
2. Tables: Convert any tabular information into strict Markdown tables (| Header 1 | Header 2 |) with separator rows.
3. Math & Formulas: Transcribe mathematical expressions, fractions, and formulas using standard LaTeX ($...$ for inline, $$...$$ for display equations).
4. Code & Data: Wrap programming code, JSON, logs, or command line snippets into syntax-highlighted code blocks (\`\`\`lang).
5. Lists & Formatting: Preserve bullet lists, numbered steps, bold text, italics, blockquotes, and checkboxes faithfully.
6. Clean Output: Output ONLY the converted Markdown. Do not include conversational greetings, explanations, or wrapping markdown codeblocks.`

  const requestPayload = {
    contents: [
      {
        parts: [
          { text: 'Convert this document completely into structured Markdown according to the instructions.' },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 65536
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

  // Try primary key
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
      ? 'Batas kuota harian Gemini API telah habis. Silakan gunakan kembali besok setelah kuota di-reset.'
      : lastError?.data?.error?.message || lastError?.message || 'Failed to process document with AI'

    throw createError({
      statusCode: lastError?.statusCode || (isQuotaExhausted ? 429 : 500),
      statusMessage: errorMsg
    })
  }

  const rawCandidate = responseData.candidates?.[0]?.content?.parts?.[0]?.text || ''

  // Clean wrapping triple backticks if model wrapped everything in ```markdown ... ```
  let cleanedMarkdown = rawCandidate.trim()
  if (cleanedMarkdown.startsWith('```markdown') && cleanedMarkdown.endsWith('```')) {
    cleanedMarkdown = cleanedMarkdown.slice(11, -3).trim()
  } else if (cleanedMarkdown.startsWith('```') && cleanedMarkdown.endsWith('```')) {
    cleanedMarkdown = cleanedMarkdown.slice(3, -3).trim()
  }

  const wordCount = cleanedMarkdown.trim() ? cleanedMarkdown.trim().split(/\s+/).length : 0
  const charCount = cleanedMarkdown.length

  return {
    success: true,
    markdown: cleanedMarkdown,
    stats: {
      words: wordCount,
      characters: charCount
    }
  }
})
