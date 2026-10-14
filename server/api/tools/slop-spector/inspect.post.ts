import { defineEventHandler, readBody, createError } from 'h3'

interface Finding {
  cat: 'fingerprint' | 'copy' | 'layout' | 'visual' | 'nitpick'
  key: string
  label: string
  pts: number
  roast: string
  why: string
  quotes: string[]
}

interface Credit {
  label: string
  pts: number
  detail: string
}

const BUZZWORDS = [
  'unlock', 'unleash', 'elevate', 'empower', 'supercharge', 'seamless', 'effortless',
  'revolutioni', 'game-chang', 'cutting-edge', 'state-of-the-art', 'next-level', 'leverage',
  'streamline', 'robust', 'innovative', 'comprehensive', 'tailored', 'holistic', 'synergy',
  'world-class', 'best-in-class', 'transform your', 'take your', 'boost your', 'skyrocket',
  'harness', 'unparalleled', 'delve', 'ever-evolving', 'fast-paced', 'in today’s', "in today's",
  'peace of mind', 'top-notch', 'exceptional', 'look no further', 'dive into', 'empowering',
  'one-stop', 'hassle-free', 'stunning', 'all-in-one', 'next generation', 'like never before',
  'at your fingertips', 'reimagin'
]

const HERO_CLICHE = [
  /^(discover|unlock|elevate|transform|empower|supercharge|revolutioni[sz]e|reimagine|experience|unleash|welcome to|introducing|meet the future)\b/i,
  /\byour\s+[a-z]+,\s*our\s+[a-z]+/i,
  /\b(the future of|next[- ]generation|all[- ]in[- ]one|made (simple|easy|effortless)|at your fingertips|like never before|one platform|seamless(ly)?|effortless(ly)?|10x|ai[- ]powered|powered by ai)\b/i,
  /\b(find the perfect|we create solutions|solutions for your business|build your dream|to the next level|grow your business|everything you need|redefin(e|ing)|elevate your|your journey)\b/i
]

const TEMPLATE_HEADINGS = [
  /^(our )?services$/, /^why choose\b/, /^what (our )?(clients|customers|users|people|students|members) (say|are saying)/,
  /^how it works$/, /^(our |key |powerful |amazing )?features$/, /^testimonials$/,
  /^ready to (get started|transform|take|start|join|elevate|boost|begin|experience)/, /^get in touch$/,
  /^(contact us|about us)$/, /^meet (our|the) (team|experts)/, /^(our )?mission$/, /^join (thousands|our community|the)/,
  /^trusted by/, /^(simple|transparent|simple, transparent|flexible) pricing/, /^we provide the best/,
  /^our (story|values|process|clients|partners|team|work)$/, /^(everything|all) you need/,
  /^(choose|pick|find) (the|your) (right |perfect )?plan/, /^start your .{0,30} today/,
  /^(join|subscribe to) our newsletter/, /^why us\??$/, /^stay (updated|in the loop)/, /^(get|let’s get|let's get) started/
]

const STOCK_DOMAINS = /images\.unsplash\.com|plus\.unsplash\.com|source\.unsplash\.com|images\.pexels\.com|cdn\.pixabay\.com|placeholder\.svg|via\.placeholder\.com|placehold\.(co|it)|picsum\.photos|randomuser\.me|i\.pravatar\.cc|ui-avatars\.com|dummyimage\.com|loremflickr/

const clip = (s: string, max = 110) => {
  const clean = (s || '').replace(/\s+/g, ' ').trim()
  return clean.length > max ? clean.slice(0, max - 1).trim() + '…' : clean
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  let { url, language = 'en' } = body || {}

  if (!url || typeof url !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Valid URL is required' })
  }

  const isIndo = language === 'id'

  url = url.trim()
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`
  }

  let host = ''
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes('.')) throw new Error('Invalid host')
    host = parsed.hostname.replace(/^www\./, '')
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid URL hostname' })
  }

  let html = ''
  let rawText = ''
  let source = 'direct'

  // Fetch HTML directly via ofetch
  try {
    html = await $fetch<string>(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 10000,
      redirect: 'follow'
    })
  } catch (err: any) {
    try {
      html = await $fetch<string>(`https://r.jina.ai/${url}`, {
        headers: { 'X-Return-Format': 'html' },
        timeout: 12000
      })
      source = 'jina-reader'
    } catch {
      throw createError({
        statusCode: 502,
        statusMessage: `Could not fetch ${host}. Make sure the site is publicly accessible.`
      })
    }
  }

  // Extract clean text from HTML
  const bodyContent = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')

  rawText = bodyContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const lowText = rawText.toLowerCase()
  const words = rawText ? rawText.split(' ').filter(Boolean).length : 0

  const findings: Finding[] = []
  const credits: Credit[] = []

  const add = (cat: Finding['cat'], key: string, label: string, pts: number, roast: string, why: string, quotes: string[] = []) => {
    findings.push({ cat, key, label, pts: Math.round(pts), roast, why, quotes: quotes.filter(Boolean).slice(0, 3) })
  }

  // 1. AI Builder Fingerprints
  const metaAuthor = (html.match(/<meta[^>]+name=["'](?:author|generator)["'][^>]+content=["']([^"']+)/i)?.[1] || '').toLowerCase()
  const lowerHtml = html.toLowerCase()

  const fpMarkers = [
    { re: /id=["']lovable-badge|edit with lovable|lovable generated project|lovable-tagger|data-lov-id|gpteng\.co|\/lovable-uploads\//, name: 'Lovable' },
    { re: /data-v0-t|built with v0/, name: 'v0 by Vercel' },
    { re: /bolt-preview|made with bolt/, name: 'Bolt.new' },
    { re: /create\.xyz\/|same\.new\//, name: 'Create.xyz' }
  ]

  for (const fp of fpMarkers) {
    if (fp.re.test(lowerHtml) || metaAuthor.includes(fp.name.toLowerCase())) {
      add(
        'fingerprint',
        'builder',
        `${fp.name} Signature`,
        30,
        isIndo
          ? `Tanda tangan ${fp.name} masih nempel di source code. Ketahuan minta dibikinin robot.`
          : `We found the receipt. It carries unmistakable markers from ${fp.name}.`,
        isIndo
          ? `Website masih memuat atribut pelacak bawaan dari generator ${fp.name}.`
          : `The site retains unmistakable builder metadata and tracking attributes generated by ${fp.name}.`,
        [`Builder: ${fp.name}`]
      )
      break
    }
  }

  // 2. Default Starter Titles
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const title = (titleMatch ? titleMatch[1] : '').trim()
  if (/^(vite \+ react( \+ ts)?|create next app|react app|my v0 project|lovable app|vite app|next\.js app)$/i.test(title)) {
    add(
      'fingerprint',
      'title',
      isIndo ? 'Judul Starter Default' : 'Default Starter Title',
      14,
      isIndo
        ? `Judul tab masih "${title}". Lupa diganti apa emang belum selesai?`
        : `The browser tab still says "${title}". Nobody bothered to finish the page.`,
      isIndo
        ? 'Title halaman masih menggunakan template bawaan framework.'
        : 'The page title still carries the framework starter template default name.',
      [`<title>${title}</title>`]
    )
  }

  // 3. Hero Cliché Headline
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const h1Text = h1Match ? clip(h1Match[1].replace(/<[^>]+>/g, ' ')) : ''
  if (h1Text && HERO_CLICHE.some((re) => re.test(h1Text))) {
    add(
      'copy',
      'hero',
      isIndo ? 'Headline Hero Klise' : 'Stock Hero Cliché',
      14,
      isIndo
        ? `Headline "${h1Text}" bisa dipakai buat jualan apa aja dari martabak sampai SaaS AI.`
        : `Your headline could sell literally anything. A generic promise without naming the actual product.`,
      isIndo
        ? 'Formula janji muluk khas template AI yang tidak spesifik menyebut fitur.'
        : 'Vague promise headline formula typical of one-shot prompt templates.',
      [h1Text]
    )
  }

  // 4. Marketing Buzzwords / Filler Words
  const buzzHits: Array<[string, number]> = []
  for (const b of BUZZWORDS) {
    const count = lowText.split(b).length - 1
    if (count > 0) buzzHits.push([b, count])
  }
  buzzHits.sort((a, b) => b[1] - a[1])
  const totalBuzz = buzzHits.reduce((acc, [, n]) => acc + n, 0)
  const buzzDensity = words ? (totalBuzz / words) * 1000 : 0

  if (totalBuzz >= 3 && buzzDensity >= 3.5) {
    const topWords = buzzHits.slice(0, 3).map(([w, n]) => `"${w}" (${n}x)`).join(', ')
    add(
      'copy',
      'buzz',
      isIndo ? 'Overdosis Buzzwords AI' : 'Marketing Filler Overdose',
      Math.min(18, 5 + buzzDensity * 1.2),
      isIndo
        ? `${totalBuzz} kata klise terdeteksi (${topWords}). Kosakata standar brosur AI.`
        : `${totalBuzz} buzzwords found (${topWords}). The copy sounds like an automated pitch deck.`,
      isIndo
        ? `${totalBuzz} kata sampah generic. Gantilah dengan angka nyata dan langkah kerja konkret.`
        : `${totalBuzz} generic filler buzzwords detected. Replace empty promises with concrete numbers and features.`,
      buzzHits.slice(0, 3).map(([w]) => `Word: ${w}`)
    )
  } else if (words > 120 && totalBuzz <= 1) {
    credits.push({
      label: isIndo ? 'Bebas Buzzword Murahan' : 'Clean Copywriting',
      pts: 6,
      detail: isIndo
        ? `${words} kata di halaman tanpa spam 'seamless' atau 'unlock'. Bersih dan grounded.`
        : `${words} words of copy without stuffing 'seamless' or 'unlock'. Refreshingly clean.`
    })
  }

  // 5. Template Section Names
  const headings = [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, '').trim())
    .filter((t) => t.length > 2 && t.length < 50)

  const templateHeadingHits = headings.filter((t) =>
    TEMPLATE_HEADINGS.some((re) => re.test(t.toLowerCase().replace(/[?!.]+$/, '')))
  )

  if (templateHeadingHits.length >= 2) {
    add(
      'copy',
      'sections',
      isIndo ? 'Daftar Isi Template Standar' : 'Template Section Names',
      Math.min(14, templateHeadingHits.length * 3.5),
      isIndo
        ? `${templateHeadingHits.slice(0, 2).map((h) => `"${h}"`).join(' & ')}. Judul section bawaan template sejuta umat.`
        : `"${templateHeadingHits[0]}" and "${templateHeadingHits[1]}". The classic template table of contents.`,
      isIndo
        ? 'Nama-nama section generic yang cuma melabeli struktur halaman alih-alih nilai produk.'
        : 'Generic section names that describe page structure instead of your unique value proposition.',
      templateHeadingHits.slice(0, 3)
    )
  }

  // 6. Fake Brag Stats (Numbers with '+')
  const statsMatches = [...rawText.matchAll(/\b(\d+[\d,.]*\s?[kKmMbB]?\s?\+)\b/g)].map((m) => m[1])
  if (statsMatches.length >= 3) {
    add(
      'copy',
      'stats',
      isIndo ? 'Deretan Angka Bulat + Halu' : 'Round-Number Brag Row',
      9,
      isIndo
        ? `${statsMatches.slice(0, 3).join(', ')}. Angka bulat plus tanpa sumber audit jelas.`
        : `${statsMatches.slice(0, 3).join(', ')}. Round numbers with plus signs, sourced from nowhere.`,
      isIndo
        ? 'Deretan angka bulat dengan tanda plus tanpa link atau bukti verifikasi.'
        : 'Round numbers with plus signs placed in a row without verification links.',
      [statsMatches.slice(0, 4).join('  |  ')]
    )
  }

  // 7. Em-Dash Overdose (Penyakit Tanda Baca AI)
  const emDashes = (html.match(/\u2014|&mdash;|--/g) || []).length
  if (emDashes >= 3 && (emDashes / Math.max(words, 1)) * 1000 >= 4) {
    add(
      'copy',
      'dash',
      isIndo ? 'Kecanduan Em-Dash (—)' : 'Em Dash Habit',
      10,
      isIndo
        ? `${emDashes} em-dash terdeteksi. AI nggak bisa nahan diri buat nggak pake tanda pisah panjang.`
        : `${emDashes} em dashes detected. The model left punctuation fingerprints on the copy.`,
      isIndo
        ? 'Penggunaan em-dash berlebihan pada teks pendek merupakan ciri kuat hasil LLM mentah.'
        : 'Excessive em dashes in short marketing copy is a prime indicator of raw LLM outputs.',
      [`Total em-dashes: ${emDashes}`]
    )
  }

  // 8. Untouched Shadcn CSS Tokens
  const shadcnDefaultColors = [
    '222.2 84% 4.9%', '222.2 47.4% 11.2%', '215.4 16.3% 46.9%', '214.3 31.8% 91.4%',
    'oklch(0.145 0 0)', 'oklch(0.205 0 0)', 'oklch(0.922 0 0)'
  ]
  const matchedTokens = shadcnDefaultColors.filter((tok) => html.includes(tok))
  if (matchedTokens.length >= 2) {
    add(
      'layout',
      'shadcn',
      isIndo ? 'Shadcn/UI Default Tokens' : 'Untouched Shadcn Theme',
      12,
      isIndo
        ? 'Palette Shadcn masih bawaan pabrik, belum pernah disentuh atau disesuaikan branding-nya.'
        : 'Shadcn default tokens untouched. A rental car with the plastic still on the seats.',
      isIndo
        ? 'Token warna bawaan shadcn terdeteksi sampai ke angka desimalnya.'
        : 'Raw uncustomized Shadcn CSS tokens detected to the exact decimals.',
      matchedTokens.slice(0, 2)
    )
  }

  // 9. Floating Blurred Orbs (Div blur-3xl melayang)
  const orbMatches = [...html.matchAll(/class=["'][^"']*\bblur-(?:2xl|3xl|\[\d+px\])[^"']*\brounded-full[^"']*\b(?:bg|from)-[a-z]+-\d+[^"']*["']/gi)]
  if (orbMatches.length >= 1) {
    add(
      'layout',
      'orbs',
      isIndo ? 'Glowing Blurred Blobs' : 'Glowing Blurred Orbs',
      Math.min(13, 6 + orbMatches.length * 3),
      isIndo
        ? `${orbMatches.length} orb ungu/biru blur melayang di background tanpa faedah jelas.`
        : `There is a glowing blurred orb behind your hero and it has no job.`,
      isIndo
        ? 'Blob warna kabur melayang di belakang konten adalah ciri wajib template AI.'
        : 'Blurred color blobs floating behind content are the universal hallmark of AI design templates.',
      [`${orbMatches.length} glowing orb elements`]
    )
  }

  // 10. Gradient Text
  const gradientTextMatches = [...html.matchAll(/class=["'][^"']*(?:bg-clip-text|text-transparent)[^"']*["']/gi)]
  if (gradientTextMatches.length >= 1) {
    add(
      'layout',
      'gradient-text',
      isIndo ? 'Gradient Text Headline' : 'Gradient Text Headline',
      10,
      isIndo
        ? 'Headline teks warna-warni gradien. Ciri khas web template AI sejak 2023.'
        : 'Gradient text headings. Wearing tie-dye to a corporate interview.',
      isIndo
        ? 'Teks judul dengan isian gradien warna-warni.'
        : 'Gradient text fill on primary headlines.',
      [`${gradientTextMatches.length} gradient text instances`]
    )
  }

  // 11. Stock Photos
  const stockImages = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
    .map((m) => m[1])
    .filter((src) => STOCK_DOMAINS.test(src))

  if (stockImages.length >= 1) {
    add(
      'layout',
      'stock',
      isIndo ? 'Stock Photos / Fake Avatars' : 'Stock Photos & Fake Avatars',
      Math.min(16, 8 + stockImages.length * 2),
      isIndo
        ? `${stockImages.length} foto stock (Unsplash/Pexels/fake avatar). Kurang foto produk aslinya ya?`
        : `${stockImages.length} stock photos detected. Handshake photo not found, but close.`,
      isIndo
        ? 'Gambar placeholder dan foto stock dari pustaka gratisan.'
        : 'Placeholders and stock photography sourced from default libraries.',
      stockImages.slice(0, 3)
    )
  } else if (html.includes('<img')) {
    credits.push({
      label: isIndo ? 'Foto Produk Asli' : 'Real Imagery',
      pts: 4,
      detail: isIndo
        ? 'Tidak ditemukan foto stock gratisan Unsplash/Pexels di halaman.'
        : 'No stock photography placeholders detected on the page.'
    })
  }

  // 12. Lucide Icon Overdose
  const lucideCount = (html.match(/lucide-[a-z0-9-]+|class="[^"]*lucide\b/g) || []).length
  if (lucideCount >= 10) {
    add(
      'layout',
      'lucide',
      isIndo ? 'Lucide Icon Overdose' : 'Lucide Icon Overload',
      7,
      isIndo
        ? `${lucideCount} icon Lucide bertebaran di setiap kata benda. Pengunjung bisa baca kok tanpa gambar.`
        : `${lucideCount} lucide icons scattered across every noun. We can read, we promise.`,
      isIndo
        ? 'Ikon Lucide di setiap item menambahkan visual noise.'
        : 'Default Lucide icon pack deployed on every item creates visual clutter.',
      [`${lucideCount} Lucide icons`]
    )
  }

  // Calculate exponential Slop Score
  const CAPS: Record<string, number> = { fingerprint: 34, copy: 40, layout: 36, visual: 18, nitpick: 18 }
  const byCategory: Record<string, number> = {}
  for (const f of findings) {
    byCategory[f.cat] = (byCategory[f.cat] || 0) + f.pts
  }

  const rawPoints = Object.entries(byCategory).reduce((sum, [cat, val]) => sum + Math.min(CAPS[cat] || 20, val), 0)
  const creditPoints = credits.reduce((sum, c) => sum + c.pts, 0)
  const finalScore = Math.max(2, Math.min(99, Math.round(100 * (1 - Math.exp(-Math.max(0, rawPoints + 5 - creditPoints) / 32)))))

  let verdictId = 'clean'
  let verdictLabel = isIndo ? 'Suspiciously Clean. Desainernya beneran ngopi.' : 'Suspiciously Clean. A human was here.'
  if (finalScore > 75) {
    verdictId = 'slop-terminal'
    verdictLabel = isIndo ? 'Bro Just Prompted & Prayed' : 'Bro Just Prompted and Prayed'
  } else if (finalScore > 50) {
    verdictId = 'ai-residue'
    verdictLabel = isIndo ? 'Prompt Residue Terdeteksi' : 'Prompt Residue Detected'
  } else if (finalScore > 25) {
    verdictId = 'mostly-human'
    verdictLabel = isIndo ? 'Mostly Human, Agak Mencurigakan' : 'Mostly Human, Mildly Suspicious'
  }

  return {
    success: true,
    host,
    url,
    source,
    score: finalScore,
    verdictId,
    verdictLabel,
    findings: findings.sort((a, b) => b.pts - a.pts),
    credits,
    stats: {
      words,
      headingsCount: headings.length,
      buzzCount: totalBuzz,
      emDashes
    }
  }
})
