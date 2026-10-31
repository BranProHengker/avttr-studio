import { defineEventHandler, readBody, createError } from 'h3'
import * as cheerio from 'cheerio'
import { getGenericCache, setGenericCache } from '~/server/utils/cache'

interface Finding {
  cat: 'fingerprint' | 'copy' | 'layout' | 'visual' | 'type' | 'motion' | 'nitpick'
  key: string
  label: string
  pts: number
  roast: string
  why: string
  quotes: string[]
  fix: string
}

interface Credit {
  label: string
  pts: number
  detail: string
}

// 1. Comprehensive Buzzwords & AI Fluff Dictionary
const BUZZ = [
  'unlock', 'unleash', 'elevate', 'empower', 'supercharge', 'seamless', 'effortless',
  'revolutioni', 'game-chang', 'cutting-edge', 'state-of-the-art', 'next-level', 'leverage',
  'streamline', 'robust', 'innovative', 'comprehensive', 'tailored', 'holistic', 'synergy',
  'world-class', 'best-in-class', 'transform your', 'take your', 'boost your', 'skyrocket',
  'harness', 'unparalleled', 'delve', 'ever-evolving', 'fast-paced', 'in today’s', "in today's",
  'peace of mind', 'top-notch', 'exceptional', 'look no further', 'dive into', 'empowering',
  'one-stop', 'hassle-free', 'stunning', 'all-in-one', 'next generation', 'like never before',
  'at your fingertips', 'reimagin', 'game changer', 'paradigm shift', 'testament to'
]

// 2. Hero Cliché Headline Regexes (Termasuk Superlative Clichés)
const HERO_CLICHE = [
  /^(discover|unlock|elevate|transform|empower|supercharge|revolutioni[sz]e|reimagine|experience|unleash|welcome to|introducing|meet the future)\b/i,
  /\b(the most|the best|the ultimate|the #1|the only)\s+(advanced|powerful|comprehensive|popular|modern|fastest|complete|scalable|flexible|trusted|support)?\b/i,
  /\byour\s+[a-z]+,\s*our\s+[a-z]+/i,
  /\b(the future of|next[- ]generation|all[- ]in[- ]one|made (simple|easy|effortless)|at your fingertips|like never before|one platform|seamless(ly)?|effortless(ly)?|10x|ai[- ]powered|powered by ai)\b/i,
  /\b(find the perfect|we create solutions|solutions for your business|build your dream|to the next level|grow your business|everything you need|redefin(e|ing)|elevate your|your journey)\b/i
]

// 3. Template Headings
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

// 4. Stock Domains & Fake Avatars
const STOCK_DOMAINS = /images\.unsplash\.com|plus\.unsplash\.com|source\.unsplash\.com|images\.pexels\.com|cdn\.pixabay\.com|placeholder\.svg|via\.placeholder\.com|placehold\.(co|it)|picsum\.photos|randomuser\.me|i\.pravatar\.cc|ui-avatars\.com|dummyimage\.com|loremflickr/

// 5. Common Standard Fonts (Termasuk JetBrains Mono & Plus Jakarta Sans)
const COMMON_FONTS = /^(inter|inter var|inter tight|geist|geist sans|geist mono|poppins|roboto|open sans|montserrat|lato|plus jakarta sans|dm sans|manrope|nunito|raleway|playfair display|space grotesk|outfit|system-ui|sans-serif|serif|monospace|arial|helvetica|helvetica neue|-apple-system|blinkmacsystemfont|segoe ui|ui-sans-serif|ui-serif|ui-monospace|apple color emoji|segoe ui emoji|segoe ui symbol|noto color emoji|noto sans|times|times new roman|georgia|menlo|monaco|consolas|courier|courier new|sf mono|sfmono-regular|liberation mono|cambria|jetbrains mono|fira code|cascadia code|syne|sora|inherit|initial|emoji|math|fangsong|cursive)$/

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

  // 0. Cache check: return existing audit result if identical host was already audited
  const cacheKey = `slop:inspect:${host}:${language}`
  const cachedInspect = getGenericCache<any>(cacheKey)
  if (cachedInspect) {
    return { ...cachedInspect, cached: true }
  }

  let html = ''
  let source = 'direct'

  // Fetch HTML directly with backup to Jina Reader
  try {
    html = await $fetch<string>(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 10000,
      redirect: 'follow'
    })
  } catch {
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

  const lowerHtml = html.toLowerCase()

  // 1. Ekstrak seluruh isi CSS dari tag <style> sebelum dihapus dari DOM!
  const internalStyles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((m) => m[1])
    .join('\n')
  const fullCssAndHtml = (internalStyles + '\n' + html).toLowerCase()

  // Load into Cheerio for DOM inspection
  const $ = cheerio.load(html)

  // Extract open graph or twitter card hero image if available
  const rawOgImage = $('meta[property="og:image"]').attr('content') ||
                     $('meta[name="twitter:image"]').attr('content') ||
                     $('meta[property="og:image:url"]').attr('content') || ''
  let heroImage = ''
  if (rawOgImage) {
    try {
      heroImage = new URL(rawOgImage, url).href
    } catch {
      heroImage = rawOgImage
    }
  }

  // Remove script and style tags from text extraction
  $('script, style, noscript, template, iframe').remove()

  const rawText = $('body').text().replace(/\s+/g, ' ').trim()
  const lowText = rawText.toLowerCase()
  const words = rawText ? rawText.split(' ').filter(Boolean).length : 0

  const findings: Finding[] = []
  const credits: Credit[] = []

  const add = (
    cat: Finding['cat'],
    key: string,
    label: string,
    pts: number,
    roast: string,
    why: string,
    quotes: string[] = [],
    fix: string = ''
  ) => {
    findings.push({
      cat,
      key,
      label,
      pts: Math.round(pts),
      roast,
      why,
      quotes: quotes.filter(Boolean).slice(0, 3),
      fix
    })
  }

  const credit = (label: string, pts: number, detail: string) => {
    credits.push({ label, pts, detail })
  }

  // Snippet helper
  const findQuoteAround = (pattern: RegExp | string): string => {
    const re = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern
    const match = rawText.match(re)
    if (!match || match.index === undefined) return ''
    const start = Math.max(0, match.index - 35)
    const end = Math.min(rawText.length, match.index + match[0].length + 45)
    return clip(rawText.slice(start, end))
  }

  // =========================================================================
  // 1. FINGERPRINTS: Hard Generator Signatures
  // =========================================================================
  const metaAuthor = (
    html.match(/<meta[^>]+name=["'](?:author|generator)["'][^>]+content=["']([^"']+)/i)?.[1] || ''
  ).toLowerCase()

  const fpMarkers = [
    {
      re: /id=["']lovable-badge|edit with lovable|lovable generated project|lovable-tagger|data-lov-id|gpteng\.co|\/lovable-uploads\//,
      name: 'Lovable'
    },
    { re: /data-v0-t|built with v0/, name: 'v0 by Vercel' },
    { re: /bolt-preview|made with bolt/, name: 'Bolt.new' },
    { re: /create\.xyz\/|same\.new\//, name: 'Create.xyz' }
  ]

  for (const fp of fpMarkers) {
    if (fp.re.test(lowerHtml) || metaAuthor.includes(fp.name.toLowerCase())) {
      add(
        'fingerprint',
        'gen',
        isIndo ? `Jejak ${fp.name}` : `${fp.name} Signature`,
        30,
        isIndo
          ? `Kuitansi ketahuan. Website ini membawa tanda tangan ${fp.name}.`
          : `We found the receipt. It carries unmistakable markers from ${fp.name}.`,
        isIndo
          ? `Bukan tebakan. Halaman memuat atribut pelacak langsung bawaan generator ${fp.name}.`
          : `This is not a pattern guess. The site carries the builder's own markers, left in the shipped page.`,
        [`Builder: ${fp.name}`],
        isIndo
          ? `Bersihkan tag meta dan class bawaan ${fp.name} biar nggak kelihatan langsung dari template.`
          : `Remove builder meta tags and tracking attributes left by ${fp.name}.`
      )
      break
    }
  }

  // Default Title Check
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const title = (titleMatch ? titleMatch[1] : '').trim()
  if (/^(vite \+ react( \+ ts)?|create next app|react app|my v0 project|lovable app|vite app|next\.js app)$/i.test(title)) {
    add(
      'fingerprint',
      'title',
      isIndo ? 'Judul Starter Default' : 'Default Page Title',
      14,
      isIndo
        ? `Judul tab masih "${title}". Lupa diganti apa emang belum selesai?`
        : `The browser tab still says "${title}". Nobody bothered to finish the page.`,
      isIndo
        ? 'Title halaman masih menggunakan starter template default framework.'
        : 'The page title is still the starter template’s default, so the page shipped without anyone finishing it.',
      [`<title>${title}</title>`],
      isIndo
        ? 'Ganti title tab browser pakai nama produk dan fungsinya.'
        : 'Replace default starter title with your real product name and what it does.'
    )
  }

  // =========================================================================
  // 2. COPYWRITING TELLS
  // =========================================================================
  const h1El = $('h1').first().length ? $('h1').first() : $('h2').first()
  const h1Text = clip(h1El.text())

  // Hero Headline Cliché (Termasuk Superlative "The Most Advanced...")
  if (h1Text && HERO_CLICHE.some((re) => re.test(h1Text))) {
    add(
      'copy',
      'hero',
      isIndo ? 'Headline Hero Klise' : 'Stock Hero Headline',
      14,
      isIndo
        ? `Headline "${h1Text}" berasa jualan template brosur. Janji muluk tanpa menyebut wujud produk konkret.`
        : `Your headline "${h1Text}" could sell literally anything. A generic promise without naming the actual product.`,
      isIndo
        ? 'Formula janji muluk atau klaim superlatif khas pembuka landing page template AI.'
        : 'Generators open with a vague promise or superlative boast because they don’t know what you actually built.',
      [h1Text],
      isIndo
        ? 'Tulis langsung apa fungsi produk lu, hindari kata-kata klise kayak "unlock" atau "elevate".'
        : 'State directly what your product solves without marketing superlatives.'
    )
  }

  // Buzzwords Density
  const buzzHits: Array<[string, number]> = []
  for (const b of BUZZ) {
    const count = lowText.split(b).length - 1
    if (count > 0) buzzHits.push([b, count])
  }
  buzzHits.sort((a, b) => b[1] - a[1])
  const totalBuzz = buzzHits.reduce((acc, [, n]) => acc + n, 0)
  const density = words ? (totalBuzz / words) * 1000 : 0

  if (totalBuzz >= 3 && density >= 3.5) {
    const top = buzzHits[0][0]
    add(
      'copy',
      'buzz',
      isIndo ? 'Overdosis Buzzwords AI' : 'Marketing Filler',
      Math.min(16, 4 + density * 1.2),
      isIndo
        ? `Kata "${top}" diulang berkali-kali. Naskah disetujui oleh dewan komite robot.`
        : `"${top}" and "${buzzHits[1]?.[0] || top}". The copy was written by a pitch deck.`,
      isIndo
        ? `${totalBuzz} kata sampah generic dalam ${words} kata. Tanda khas LLM ketika tidak punya data spesifik.`
        : `${totalBuzz} filler words in ${words} words of copy. These are what a model writes when it has no specific fact to offer.`,
      buzzHits.slice(0, 3).map(([w]) => `"${w}" (${findQuoteAround(w) || w})`),
      isIndo
        ? 'Hapus kata-kata klise (seamless, unlock, elevate), ganti pakai fakta atau angka nyata.'
        : 'Cut marketing buzzwords (seamless, unlock); state concrete facts instead.'
    )
  } else if (words > 180 && density < 1.0 && !lowText.includes('atmin') && !lowText.includes('cuan')) {
    // Hanya beri credit bersih jika bahasa Inggris formal asli tanpa filler, bukan slang lokal
    credit(
      isIndo ? 'Bebas Buzzword Murahan' : 'No Filler Words',
      4,
      isIndo
        ? `${words} kata copy tanpa spam 'seamless' atau 'unlock'. Bersih dan membumi.`
        : `${words} words of copy and not one “seamless” or “unlock”. Refreshingly clean.`
    )
  }

  // Template Headings
  const headings = $('h1, h2, h3')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t.length > 2 && t.length < 60)

  const templateHeadingsFound = headings.slice(1).filter((t) =>
    TEMPLATE_HEADINGS.some((re) => re.test(t.toLowerCase().replace(/[?!.]+$/, '')))
  )

  if (templateHeadingsFound.length >= 2) {
    add(
      'copy',
      'sections',
      isIndo ? 'Daftar Isi Template Standar' : 'Template Section Names',
      Math.min(15, templateHeadingsFound.length * 3.5),
      isIndo
        ? `"${templateHeadingsFound[0]}", "${templateHeadingsFound[1]}". Daftar isi standar template sejuta umat.`
        : `“${templateHeadingsFound[0]}”, “${templateHeadingsFound[1]}”. The landing page template’s table of contents.`,
      isIndo
        ? 'Nama section bawaan template yang cuma melabeli struktur alih-alih menjelaskan esensi produk.'
        : 'These are the default section names of every landing page template. They label the section instead of saying anything about you.',
      templateHeadingsFound.slice(0, 3),
      isIndo
        ? 'Ganti judul section "Features" / "How it works" jadi nama fitur aslinya.'
        : 'Replace generic "Features" / "How it works" headers with actual feature names.'
    )
  }

  // Brag Stats (Numbers with '+')
  const statsMatches = [...rawText.matchAll(/\b(\d+[\d,.]*\s?[kKmMbB]?\s?\+)\b/g)].map((m) => m[1])
  if (statsMatches.length >= 3) {
    add(
      'copy',
      'stats',
      isIndo ? 'Deretan Angka Bulat + Halu' : 'Round-Number Brag Row',
      Math.min(10, 5 + statsMatches.length),
      isIndo
        ? `${statsMatches.slice(0, 3).join(', ')}. Angka bulat plus dari antah berantah.`
        : `${statsMatches.slice(0, 3).join(', ')}. Numbers with a plus sign, sourced from nowhere.`,
      isIndo
        ? 'Deretan angka bulat dengan tanda plus tanpa unit audit atau link verifikasi adalah elemen paling banyak di-generate di internet.'
        : 'A row of round numbers with plus signs is the most generated element on the internet. Real proof has units, dates and somewhere to check it.',
      [statsMatches.slice(0, 4).join('   ')],
      isIndo
        ? 'Ganti angka bulat "10k+" pakai data riil yang bisa dicek sumbernya.'
        : 'Replace arbitrary rounded stats with verifiable numbers and sources.'
    )
  }

  // Testimonials Stars (5 stars)
  const starIcons = (rawText.match(/★/g) || []).length + $('svg[class*="star"], [class*="lucide-star"]').length
  if (starIcons >= 5) {
    const testimonialQuote = findQuoteAround(/^[“"][^"”]{30,200}[”"]/)
    add(
      'copy',
      'testimonials',
      isIndo ? 'Testimoni Bintang 5 Dummy' : 'Five-Star Testimonials',
      9,
      isIndo
        ? 'Rating bintang 5 dari "Sarah M., Marketing Director". Ya ya ya, percaya deh.'
        : 'Five stars from “Sarah M., Marketing Director”. Sure.',
      isIndo
        ? 'Kutipan testimoni bintang lima dengan nama depan dan jabatan generik khas buatan bot.'
        : 'Star ratings over quotes from first names and job titles read as placeholders, because generators write them for every site.',
      [testimonialQuote || `${starIcons} star icons`],
      isIndo
        ? 'Pakai testimoni asli yang ada tautan profilnya, bukan kutipan dummy.'
        : 'Use real customer quotes with verifiable links, not generic first-name quotes.'
    )
  }

  // Emoji as Icons/Bullets (R-36, R-04)
  const emojiMatches = (rawText.match(/\p{Extended_Pictographic}/gu) || []).filter(
    (e) => !/[©®™❤]/.test(e)
  )
  if (emojiMatches.length >= 3) {
    add(
      'copy',
      'emoji',
      isIndo ? 'Emoji Menyamar Jadi Icon' : 'Emoji as Icons',
      Math.min(10, 4 + emojiMatches.length),
      isIndo
        ? `${emojiMatches.length} emoji menggantikan icon. Desainernya kayak lagi ngechat grup WA.`
        : `${emojiMatches.length} emoji doing an icon’s job. The designer was a group chat.`,
      isIndo
        ? 'Emoji di awal judul card atau bullet point adalah ciri khas halaman hasil satu prompt kilat.'
        : 'Emoji standing in for icons and bullets, at the start of card titles and list items, is a hallmark of one-shot generated pages.',
      [[...new Set(emojiMatches)].slice(0, 6).join(' ')],
      isIndo
        ? 'Ganti emoji pakai icon SVG beneran.'
        : 'Replace emoji bullets with clean SVG icons.'
    )
  }

  // Em Dash Habit (R-02) - Hanya pindai teks asli naskah (bukan komentar HTML atau CSS variables!)
  const emDashes = (rawText.match(/\u2014/g) || []).length
  if (emDashes >= 3 && (emDashes / Math.max(words, 1)) * 1000 >= 4) {
    add(
      'copy',
      'dash',
      isIndo ? 'Kecanduan Em-Dash (—)' : 'Em Dash Habit',
      Math.min(12, 4 + emDashes),
      isIndo
        ? `${emDashes} em-dash terdeteksi di teks. Model LLM sangat sering meninggalkan tanda pisah panjang.`
        : `${emDashes} em dashes detected. The model left fingerprints on the copy.`,
      isIndo
        ? 'Penggunaan em-dash (—) berulang dalam teks pendek adalah salah satu tanda paling khas teks hasil generate LLM.'
        : 'Models reach for the em dash constantly. Three or more in short copy is one of the strongest text tells there is.',
      [findQuoteAround(/\u2014/) || `${emDashes} em dashes`],
      isIndo
        ? 'Ganti tanda pisah em-dash (—) jadi titik atau koma biasa.'
        : 'Replace em dashes (—) with simple periods or commas.'
    )
  }

  // "Not Just X, It's Y" Formula (antislop-copywriting)
  const notJustMatch = findQuoteAround(/\b(?:not just|isn['’]t just|more than just)\b/i)
  if (notJustMatch) {
    add(
      'copy',
      'notjust',
      isIndo ? 'Rumus Kalimat “Not Just X”' : '“Not Just X” Line',
      6,
      isIndo
        ? '“Bukan sekadar tool, ini adalah revolusi.” Alah, emang cuma tool biasa kok.'
        : '“It’s not just a tool, it’s a movement.” It’s a tool.',
      isIndo
        ? 'Pola kalimat "Bukan sekadar X, tapi Y" adalah formula kalimat AI paling klise di jagat raya.'
        : '“Not just X, it’s Y” is the single most common AI sentence shape.',
      [notJustMatch],
      isIndo
        ? 'Hapus retorika "Bukan sekadar X, tapi Y", langsung sebut aja fungsinya.'
        : 'Drop "Not just X, but Y" rhetoric; state what the product actually does.'
    )
  }

  // Three-Beat Slogan Formula
  const beatMatch = rawText.match(/\b([A-Z][a-z]{2,9}\. [A-Z][a-z]{2,9}\. [A-Z][a-z]{2,9}\.)/)
  if (beatMatch) {
    add(
      'copy',
      'beat',
      isIndo ? 'Slogan Tiga Ketukan' : 'Three-Beat Slogan',
      7,
      isIndo
        ? `“${beatMatch[1]}”. Slogan 3 kata titik titik titik, berasa baca puisi bikinan robot.`
        : `“${beatMatch[1]}”. A haiku written by a landing page template.`,
      isIndo
        ? 'Tiga kalimat satu kata berturut-turut adalah rumus slogan instan, bukan suara brand yang orisinal.'
        : 'Three one-word sentences in a row is a slogan formula, not an authentic brand voice.',
      [beatMatch[1]],
      isIndo
        ? 'Hapus slogan 3 kata bertitik (Cepat. Andal. Modern.), ganti satu kalimat lugas.'
        : 'Drop staccato 3-word slogans ("Fast. Reliable. Modern."); write one natural sentence.'
    )
  }

  // Template Navigation
  const navLinks = $('nav a, header a, nav button, header button')
    .map((_, el) => $(el).text().trim().toLowerCase())
    .get()

  if (
    navLinks.includes('home') &&
    navLinks.filter((t) => /^(about|about us|services|contact|contact us|testimonials)$/.test(t)).length >= 2
  ) {
    add(
      'copy',
      'nav',
      isIndo ? 'Navigasi Template Usang' : 'Template Navigation',
      6,
      isIndo
        ? 'Home, About Us, Services, Contact Us. Navigasi era 2009 hasil generate 2026.'
        : 'Home, About Us, Services, Contact Us. A nav from 2009, generated in 2026.',
      isIndo
        ? 'Menu Home ditambah About dan Contact adalah menu bawaan template yang malas diedit. Pengunjung sudah tahu tombol home adalah logo.'
        : 'A “Home” link plus About, Services and Contact is the nav of a template nobody edited. Visitors know where home is: it’s the logo.',
      [navLinks.filter((t) => t.length < 20).slice(0, 5).join('  |  ')],
      isIndo
        ? 'Hapus menu "Home" di navbar (klik logo udah cukup), sisain menu penting aja.'
        : 'Remove "Home" from nav (the logo already links home); keep only essential links.'
    )
  }

  // Default CTAs Pair (Get Started + Learn More)
  const buttonsText = $('a, button')
    .map((_, el) => $(el).text().trim().toLowerCase())
    .get()

  if (
    buttonsText.some((t) => /^get started/.test(t)) &&
    buttonsText.some((t) => /^learn more/.test(t))
  ) {
    add(
      'copy',
      'ctas',
      isIndo ? 'Dua Tombol Kiamat' : 'Default Buttons',
      5,
      isIndo
        ? '“Get Started” dan “Learn More.” Dua tombol sejuta umat penanda template.'
        : '“Get Started” and “Learn More.” The two default buttons of the apocalypse.',
      isIndo
        ? 'Dua CTA paling pasif di dunia. Sebutkan tindakan nyata yang terjadi saat tombol diklik.'
        : 'The two default calls to action. Name the action instead: what actually happens when clicked?',
      ['Get Started   |   Learn More'],
      isIndo
        ? 'Ganti tombol "Get Started" dan "Learn More" pakai kata kerja nyata (kayak "Mulai Gratis" atau "Buka Studio").'
        : 'Replace "Get Started" and "Learn More" with concrete action verbs ("Start Free", "Open Studio").'
    )
  }

  // Chatbot Text Leak (humanizer §20, antislop-copywriting R-36)
  const chatbotRegex = /\b(?:i hope this helps|hope this helps|certainly!|certainly,|here is an overview|as of my last (?:knowledge )?update|as an ai language model|as a large language model)\b/i
  const chatbotMatch = findQuoteAround(chatbotRegex)
  if (chatbotMatch) {
    add(
      'copy',
      'chatbot',
      isIndo ? 'Potongan Chatbot Tertinggal' : 'Chatbot Output Leak',
      16,
      isIndo
        ? `Teks chatbot tertinggal di halaman: "${chatbotMatch}". Ketahuan copy-paste mentah dari prompt ChatGPT.`
        : `Chatbot conversational scrap detected: "${chatbotMatch}". Pasted straight from an LLM prompt.`,
      isIndo
        ? 'Kalimat basa-basi khas AI chatbot yang lupa dihapus saat memindahkan teks hasil generate ke website.'
        : 'Conversational filler phrases that occur when LLM chat output is copied wholesale into production code.',
      [chatbotMatch],
      isIndo
        ? 'Hapus sisa teks chat AI yang ketinggalan di halaman.'
        : 'Delete leftover LLM chat artifacts like "Here is an overview" or "As an AI".'
    )
  }

  // Signposting Announcements & Fake-Candid Openers (humanizer §28, §33, antislop-copywriting R-36)
  const signpostRegex = /\b(?:let['’]s dive in|here['’]s what you need to know|without further ado|at its core|the real question is|what really matters is|the heart of the matter|let['’]s be honest|real talk)\b/i
  const signpostMatch = findQuoteAround(signpostRegex)
  if (signpostMatch) {
    add(
      'copy',
      'signpost',
      isIndo ? 'Kalimat Pembuka Klise / Sok Akrab' : 'Signposting & Theatrical Opener',
      6,
      isIndo
        ? `"${signpostMatch}". Kalimat pengantar teaterik yang sering dipakai model AI sebelum poin inti.`
        : `"${signpostMatch}". A theatrical pause or signpost sentence straight out of an AI prompt.`,
      isIndo
        ? 'Frasa jeda teaterik ("Let\'s be honest", "At its core") adalah pengisi kalimat yang sering disuntikkan AI.'
        : 'Manufactured intimacy phrases and meta-announcements before an ordinary point are classic LLM tells.',
      [signpostMatch],
      isIndo
        ? 'Hapus kalimat pembuka basa-basi ("Let\'s dive in", "Pada dasarnya"), langsung ke poin inti.'
        : 'Cut conversational throat-clearing ("Let\'s dive in", "At its core"); get straight to the point.'
    )
  }

  // =========================================================================
  // 3. TYPOGRAPHY & TEXT STYLING TELLS (/unslop Type Pass)
  // =========================================================================
  // Tipografi Serba Tebal (Hanya jika >60% dari seluruh heading dipaksa font-bold/black)
  const allHeadings = $('h1, h2, h3').toArray()
  const boldHeadings = allHeadings.filter((el) => {
    const cls = $(el).attr('class') || ''
    const st = $(el).attr('style') || ''
    return /\bfont-(bold|extrabold|black)\b/.test(cls) || /font-weight:\s*(7|8|9)00/.test(st)
  })

  if (allHeadings.length >= 3 && boldHeadings.length / allHeadings.length > 0.6) {
    add(
      'type',
      'bold',
      isIndo ? 'Tipografi Serba Tebal' : 'Bold Everything',
      7,
      isIndo
        ? 'Semua judul seragam font-bold. Variasi bobot font membuat visual lebih bernafas.'
        : 'Every headline is shouting. Studio sites usually set display type lighter and let space do the work.',
      isIndo
        ? 'Lebih dari 60% judul halaman menggunakan font-bold tebal secara monoton.'
        : 'Over 60% of headings across the page are uniformly styled with heavy font-bold weights.',
      [`${boldHeadings.length} of ${allHeadings.length} headings are bold`],
      isIndo
        ? 'Campur bobot font: jangan semua judul dipaksa tebal (bold).'
        : 'Mix font weights: stop making every headline bold.'
    )
  }

  // Uppercase Tracked Labels (/unslop Type Pass)
  const uppercaseTracked = $('[class*="uppercase"]').filter((_, el) => {
    const cls = $(el).attr('class') || ''
    return /tracking-(?:wider|widest|\[0\.[1-3]em\])/.test(cls)
  }).length + (html.match(/text-transform:\s*uppercase;?[^}]*letter-spacing:\s*(?:0\.[1-3]em|[1-3]px)/gi) || []).length

  if (uppercaseTracked >= 3) {
    add(
      'type',
      'uppercase',
      isIndo ? 'Label Huruf Besar Renggang (UPPERCASE TRACKED)' : 'Uppercase Tracked Labels',
      6,
      isIndo
        ? `${uppercaseTracked} label memakai huruf kapital bertrack lebar. Resep instan biar kelihatan "editorial".`
        : `${uppercaseTracked} uppercase tracked labels. The standard recipe for pretending to be an editorial magazine.`,
      isIndo
        ? 'Memaksakan huruf kapital dengan letter-spacing renggang pada tombol atau badge adalah kebiasaan kaku template AI.'
        : 'All-caps labels with wide tracking are a repeated AI template reflex to make ordinary UI feel elevated.',
      [`${uppercaseTracked} uppercase tracked elements`],
      isIndo
        ? 'Pakai huruf kecil/kapital normal aja, jangan dipaksa UPPERCASE berjarak renggang.'
        : 'Use normal lower/title case with standard tracking instead of forced uppercase.'
    )
  }

  // Pseudo-Code Comment Eyebrows & UI Labels ("// 162 INTERFACE ANIMATIONS")
  const commentEyebrows = $('h1, h2, h3, h4, [class*="eyebrow"], [class*="badge"], span, p, div')
    .filter((_, el) => {
      const t = $(el).children().length === 0 ? $(el).text().trim() : ''
      return /^\/\/\s*(?:\d+[\s.-]*)?[A-Za-z\s_-]{3,50}$/.test(t)
    })
    .map((_, el) => $(el).text().trim())
    .get()

  const codeCommentMatch =
    commentEyebrows[0] ||
    internalStyles.match(/\/\/\s*\d{1,4}\s+[A-Z\s]{4,40}/)?.[0] ||
    html.match(/<!--\s*={4,}.*?-->/)?.[0] ||
    internalStyles.match(/\/\/\s*={4,}/)?.[0]

  if (commentEyebrows.length >= 1 || codeCommentMatch) {
    add(
      'type',
      'codecomment',
      isIndo ? 'Komentar Kode di Teks UI ("// SECTION")' : 'Pseudo-Code Comments in UI ("// SECTION")',
      6,
      isIndo
        ? `Teks UI memakai gaya komentar kode "${codeCommentMatch || commentEyebrows[0]}". Biar dikira hacker padahal cuma landing page biasa.`
        : `UI text styled as pseudo-code comments "${codeCommentMatch || commentEyebrows[0]}". Dressing up marketing copy as terminal code.`,
      isIndo
        ? 'Menaruh double-slash "//" di depan judul atau label adalah kebiasaan kaku template AI untuk memalsukan kesan "technical".'
        : 'Prefacing UI labels with "//" is a classic AI template affectation to fake a technical developer aesthetic.',
      commentEyebrows.length ? commentEyebrows.slice(0, 3) : [codeCommentMatch || '// 01 SECTION'],
      isIndo
        ? 'Hapus tanda // di judul atau badge, tulis langsung nama fiturnya.'
        : 'Remove the // prefix from titles; write the actual feature name.'
    )
  }

  // =========================================================================
  // 4. MOTION & INTERACTION TELLS (/unslop Motion Pass)
  // =========================================================================
  // Fade-in / Reveal on Scroll (R-19)
  const hasRevealAnimation =
    /reveal-on-scroll|opacity:\s*0.*transform.*translateY/i.test(fullCssAndHtml) ||
    $('[style*="opacity: 0"], [style*="opacity:0"]').length >= 3

  if (hasRevealAnimation) {
    add(
      'motion',
      'fade',
      isIndo ? 'Animasi Reveal on Scroll' : 'Fade-in on Scroll',
      5,
      isIndo
        ? 'Semua section meluncur naik pelan-pelan saat di-scroll. Halamannya kayak lagi ngasih hormat.'
        : 'Everything fades and translates up on scroll. The site does a little curtsy.',
      isIndo
        ? 'Animasi staggered translateY + opacity: 0 adalah gerakan bawaan template UI modern yang repetitif.'
        : 'Staggered fade-ups on every section is the default motion wallpaper of AI templates.',
      ['.reveal-on-scroll: opacity: 0; translateY(20px)'],
      isIndo
        ? 'Matiin animasi scroll delay, biar konten langsung kebaca tanpa nunggu gerak.'
        : 'Turn off scroll-reveal delay so content appears immediately.'
    )
  }

  // Pulsing Buttons & Badges (animate-pulse / animate-ping)
  const pulsingElements = $('a, button, [class*="btn"], [class*="badge"]').filter((_, el) => {
    const cls = $(el).attr('class') || ''
    return /\banimate-pulse\b|\banimate-ping\b/.test(cls)
  }).length

  if (pulsingElements >= 1) {
    add(
      'motion',
      'pulse',
      isIndo ? 'Tombol/Badge Berdenyut (animate-pulse)' : 'Pulsing Button / Badge',
      6,
      isIndo
        ? 'Tombol atau badge berkedip-kedip (animate-pulse). Kayak sirine darurat yang memohon diklik.'
        : 'Pulsing CTA button or badge (animate-pulse). Like an emergency siren begging for clicks.',
      isIndo
        ? 'Animasi berdenyut pada tombol statis mengganggu konsentrasi visual dan merupakan tanda template putus asa.'
        : 'Pulsing animations on static buttons create visual fatigue and signal desperate CTA tactics.',
      [`${pulsingElements} pulsing element(s)`],
      isIndo
        ? 'Matiin tombol kedip-kedip (animate-pulse), cukup pakai hover biasa.'
        : 'Remove animate-pulse from buttons; a standard hover state is enough.'
    )
  }

  // Card Hover Scale & Bounce (hover:scale-105, hover:scale-110, hover:-translate-y-2)
  const bouncyCards = $('[class*="hover:scale-105"], [class*="hover:scale-110"], [class*="hover:-translate-y-2"], [class*="hover:-translate-y-1"]').length
  if (bouncyCards >= 3) {
    add(
      'motion',
      'bouncyscale',
      isIndo ? 'Kartu Membesar Saat Dihover (scale-105)' : 'Card Hover Scale & Lift',
      6,
      isIndo
        ? `${bouncyCards} kartu membesar atau melayang saat di-hover. Efek gerak paling klise di Tailwind.`
        : `${bouncyCards} cards lift or scale on hover. The most ubiquitous Tailwind hover trope.`,
      isIndo
        ? 'Membesarkan kartu pada hover tanpa membawa informasi baru membuat halaman terasa seperti mainan.'
        : 'Lifting or scaling whole cards on hover adds distracting motion without conveying functional state.',
      [`${bouncyCards} bouncy hover elements`],
      isIndo
        ? 'Hapus hover:scale-105 pada kartu, cukup ubah warna border atau background tipis.'
        : 'Drop hover:scale-105; use a subtle border or background highlight instead.'
    )
  }

  // Indiscriminate transition-all
  const transitionAllCount = $('[class*="transition-all"]').length
  if (transitionAllCount >= 6) {
    add(
      'motion',
      'transitionall',
      isIndo ? 'Kecanduan transition-all' : 'Indiscriminate transition-all',
      5,
      isIndo
        ? `${transitionAllCount} elemen memakai 'transition-all'. Memboroskan frame GPU dan bikin transisi terasa lembek.`
        : `'transition-all' on ${transitionAllCount} elements. Wastes GPU compositor frames and muddies transitions.`,
      isIndo
        ? 'Menganimasikan seluruh properti sekaligus menurunkan performa browser; hanya animasikan properti spesifik.'
        : 'Transitioning all CSS properties wastes compositor frames; animate only specific target properties.',
      [`${transitionAllCount} elements with transition-all`],
      isIndo
        ? 'Ganti transition-all ke properti spesifik (kayak transition-colors atau transition-transform).'
        : 'Replace transition-all with specific properties like transition-colors.'
    )
  }

  // =========================================================================
  // 5. LAYOUT, COLOR & ARCHITECTURE TELLS (HTML + VANILLA CSS SCAN)
  // =========================================================================
  // Gradient Text Headings (Hanya jika benar-benar dipakai pada elemen judul/heading di DOM)
  const gradientHeadings = $('h1, h2, h3, .section-title, [class*="headline"]').filter((_, el) => {
    const cls = $(el).attr('class') || ''
    const st = $(el).attr('style') || ''
    const innerSpans = $(el).find('[class*="bg-clip-text"], [style*="background-clip"]').map((_, c) => ($(c).attr('class') || '') + ' ' + ($(c).attr('style') || '')).get().join(' ')
    const combined = cls + ' ' + st + ' ' + innerSpans
    return /bg-clip-text|background-clip:\s*text/i.test(combined) && /(?:bg|from|to|via)-|linear-gradient/i.test(combined)
  }).length

  if (gradientHeadings >= 1) {
    add(
      'layout',
      'gtext',
      isIndo ? 'Teks Gradien Murahan' : 'Gradient Text Headline',
      10,
      isIndo
        ? 'Headline gradien warna-warni. Gaya template AI yang belum move-on dari 2023.'
        : 'Gradient text headings. A classic signature move of generated landing pages.',
      isIndo
        ? 'Teks judul dengan isian gradien warna-warni adalah signature khas ribuan template AI instan.'
        : 'Gradient-filled headings have been the signature move of AI landing pages since 2023.',
      ['background-clip: text; fill: linear-gradient'],
      isIndo
        ? 'Ganti warna gradien judul pakai warna solid (putih atau zinc-900), biar gampang dibaca.'
        : 'Use a solid text color (white or dark zinc) instead of gradient fills on headings.'
    )
  }

  // Glowing Blurred Orbs & Glow Dividers (Tailwind + CSS)
  const orbCount = $('[class*="blur-2xl"], [class*="blur-3xl"], [class*="blur-["]')
    .filter((_, el) => {
      const cls = $(el).attr('class') || ''
      return /rounded-full/.test(cls) && /(bg|from)-[a-z]+-\d00/.test(cls)
    }).length

  const hasGlowDivider =
    $('.glow-divider, [class*="glow-divider"], [class*="neon-divider"]').length > 0 ||
    $('[style*="box-shadow"]').filter((_, el) => /box-shadow:\s*0\s+0\s+(?:2[0-9]|[3-9]\d)px\s*(?:rgb|#)/i.test($(el).attr('style') || '')).length > 0

  if (orbCount >= 1 || hasGlowDivider) {
    add(
      'layout',
      'orbs',
      isIndo ? 'Glowing Orbs & Divider Neon' : 'Glowing Orbs & Neon Dividers',
      Math.min(10, 5 + (orbCount * 2 || 3)),
      isIndo
        ? 'Glow divider dan blob warna kabur melayang di background tanpa faedah kerjaan.'
        : 'There is a glowing orb or neon divider behind content and it has no job.',
      isIndo
        ? 'Pendaran neon dan blob warna kabur melayang di belakang konten adalah trik dekoratif template generik.'
        : 'Blurred colour blobs and neon glowing divider lines are decoration with no job, a default of AI templates.',
      [hasGlowDivider ? '.glow-divider { box-shadow: neon-glow }' : `${orbCount} blurred glowing blobs`],
      isIndo
        ? 'Hapus bola blur neon di background, biarin latarnya polos dan bersih.'
        : 'Delete floating blur orbs; keep the canvas clean.'
    )
  }

  // Colored Left Stripe on Cards / Section Headers (antislop-ui R-01 & R-31)
  const hasLeftStripe = $('div, article, section, [class*="card"]').filter((_, el) => {
    if ($(el).is('blockquote') || $(el).parents('blockquote').length > 0) return false
    const cls = $(el).attr('class') || ''
    const st = $(el).attr('style') || ''
    const hasThickBorder = /\bborder-l-[3456]\b|\bborder-l-\[/.test(cls) || /border-left:\s*[3-6]px\s*solid/i.test(st)
    const hasAccentColor = /\b(?:border-(?:indigo|purple|violet|pink|blue|emerald|green|cyan|sky|teal|rose|red|amber|orange)-\d00)\b/i.test(cls) ||
      /border-left-color:\s*(?:#[0-9a-f]{3,8}|rgba?\([^)]+\)|var\(--(?:accent|primary|color))/i.test(st)
    return hasThickBorder && hasAccentColor
  }).length > 0

  if (hasLeftStripe) {
    add(
      'layout',
      'stripe',
      isIndo ? 'Garis Warna di Pinggir Kiri (Left Stripe)' : 'Colored Left Stripe',
      6,
      isIndo
        ? 'Garis warna vertikal di tepi kiri section/card. Trik termurah biar layout kelihatan "didesain".'
        : 'A thin colored vertical bar on the left edge of cards or headers. The cheapest way to make a box "look designed".',
      isIndo
        ? 'Garis vertikal warna-warni di sisi kiri adalah dekorasi kaku yang tidak membawa fungsi status nyata.'
        : 'A colored left border used purely as decoration adds visual noise without carrying real semantic information.',
      ['border-left: 4px solid var(--accent)'],
      isIndo
        ? 'Hapus garis border kiri di kartu, nggak perlu ada garis vertikal warna-warni.'
        : 'Remove the colored left border from cards; let spacing and hierarchy do the work.'
    )
  }

  // Stock Indigo / Pink / Violet / Neon Palette (Hanya jika terbukti template bot seragam)
  const hasTemplateAccentVars =
    /--p-accent:\s*#6366f1/i.test(internalStyles) && /--s-accent:\s*#ec4899/i.test(internalStyles)

  const buttonTailwindClasses = $('a, button')
    .map((_, el) => ($(el).attr('class') || '').match(/\b(?:bg|from)-(blue|indigo|purple|violet|green|emerald|teal|cyan|sky|orange|amber|pink|rose|red)-(400|500|600|700)\b/)?.[0])
    .get()
    .filter(Boolean)

  if (hasTemplateAccentVars || buttonTailwindClasses.length >= 3) {
    add(
      'layout',
      'palette',
      isIndo ? 'Palet Warna Seragam Indigo/Neon' : 'Stock Indigo & Neon Palette',
      7,
      isIndo
        ? 'Aksen ungu indigo (#6366f1) dipadu pink (#ec4899). Palet seragam wajib template seed-round.'
        : 'Stock indigo (#6366f1) and pink (#ec4899). The default uniform of seed-funded AI templates.',
      isIndo
        ? 'Warna brand tidak pernah dirancang otentik; langsung menjiplak palet hex default Tailwind dan neon glowing pills.'
        : 'Buttons and variables use Tailwind’s stock indigo/pink hex palette rather than a considered brand identity.',
      ['#6366f1 (Indigo) + #ec4899 (Pink)'],
      isIndo
        ? 'Ganti warna ungu indigo dan pink bawaan template pakai satu warna brand pilihan sendiri.'
        : 'Replace default template indigo and pink accents with a single deliberate brand color.'
    )
  }

  // Frosted Glass / Backdrop Blur Overdose (Hanya jika >= 3 elemen agar navbar tidak difitnah!)
  const glassCount =
    $('[class*="backdrop-blur"]').length +
    (internalStyles.match(/backdrop-filter:\s*blur/gi) || []).length

  if (glassCount >= 3) {
    add(
      'nitpick',
      'glass',
      isIndo ? 'Kecanduan Frosted Glass' : 'Frosted Glass Overdose',
      Math.min(6, 3 + glassCount),
      isIndo
        ? `Backdrop-blur pada ${glassCount} elemen sekaligus. Efek kaca buram paling banyak di-copy selama 5 tahun terakhir.`
        : `Backdrop blur used on ${glassCount} surfaces simultaneously. Tasteful in moderation, a tell in bulk.`,
      isIndo
        ? 'Menggunakan backdrop-filter blur pada navbar, kartu, dan modal sekaligus meratakan hierarki visual.'
        : 'Backdrop blur on cards, modals, and nav simultaneously flattens hierarchy into a single frosted layer.',
      [`backdrop-filter: blur on ${glassCount} elements`],
      isIndo
        ? 'Kurangi pemakaian backdrop-blur biar nggak semua komponen berasa kaca buram.'
        : 'Dial back backdrop-blur so the whole page doesn’t feel like frosted glass.'
    )
  }

  // Announcement Pill / Status Dot Badge (R-09)
  const hasStatusDot = /status-dot|status-badge|btn-status/.test(lowerHtml)
  const prevPill = h1El.prev('[class*="rounded-full"], div, span')
  const parentPrevPill = h1El.parent().prev('[class*="rounded-full"], div, span')
  const pillCandidate = prevPill.length ? prevPill : parentPrevPill
  const pillText = clip(pillCandidate.text(), 50)
  const hasPillBadge = pillText && pillText.length > 2 && pillText.length < 50 && (pillCandidate.attr('class') || '').includes('rounded-full')

  if (hasStatusDot || hasPillBadge) {
    add(
      'layout',
      'badge',
      isIndo ? 'Kapsul Status / Pill Announcement' : 'Announcement & Status Pill',
      7,
      isIndo
        ? 'Kapsul lonjong dengan titik status hijau ("System Online" / "New"). Klise wajib startup modern.'
        : 'A status pill capsule with a glowing green dot. The AI startup’s universal signature.',
      isIndo
        ? 'Badge lonjong dengan titik bersinar di atas hero atau navbar adalah dekorasi template yang minim nilai informasi.'
        : 'Pill capsule plus status dot combination is self-referential decoration typical of one-shot templates.',
      [pillText || 'status-dot: System Online'],
      isIndo
        ? 'Hapus badge lonjong berkedip di atas hero, tulis infonya langsung di teks utama.'
        : 'Remove decorative status pills from above the hero; integrate updates into the copy.'
    )
  }

  // Soft Corners Overdose (Tailwind + CSS 14px-24px)
  const softCornersCount =
    $('[class*="rounded-xl"], [class*="rounded-2xl"], [class*="rounded-3xl"]').length +
    (fullCssAndHtml.match(/border-radius:\s*(1[4-9]|2[0-9]|3[0-9])px/g) || []).length

  if (softCornersCount >= 6 && !findings.some((f) => f.key === 'cards')) {
    add(
      'nitpick',
      'round',
      isIndo ? 'Sudut Serba Bulat Lembek' : 'Soft Corners Overdose',
      4,
      isIndo
        ? `Border-radius 16px empuk di mana-mana. Sudut elemennya nggak pernah seempuk ini.`
        : `Generous 16px border-radius everywhere. The corners have never been softer.`,
      isIndo
        ? 'Border radius empuk di setiap card dan button adalah seragam bawaan template UI modern.'
        : 'Uniform rounded corners applied across all surfaces erase hierarchy and read as a template default.',
      [`${softCornersCount} elements with border-radius >= 14px`],
      isIndo
        ? 'Kecilin border-radius, jangan semua sudut dibuat melengkung 16px-24px.'
        : 'Tighten border radii; avoid 16-24px rounded corners on everything.'
    )
  }

  // Icon Card Grids (3 or 4 cols)
  let iconCardGrids = 0
  $('[class*="grid-cols-3"], [class*="grid-cols-4"], .platforms-grid, .info-grid').each((_, el) => {
    const children = $(el).children()
    if (children.length >= 3) {
      iconCardGrids++
    }
  })

  if (iconCardGrids >= 1) {
    add(
      'layout',
      'cards',
      isIndo ? 'Grid Kartu Berjejer Monoton' : 'Icon Card Grids',
      Math.min(12, 6 + iconCardGrids * 2),
      isIndo
        ? 'Kartu-kartu berjejer dengan icon dan teks seragam. Pola standar mengisi kekosongan halaman.'
        : 'Uniform cards in an even grid. How a builder fills space when it has nothing unique to show.',
      isIndo
        ? 'Grid kartu berjejer dengan layout identik meratakan konten dan membuat halaman terasa seperti katalog generic.'
        : 'Uniform card mosaics flatten content hierarchy into identical repeated tiles.',
      [`${iconCardGrids} card grid section(s)`],
      isIndo
        ? 'Jangan bikin kartu berjejer 3 kotak seragam; pakai layout asimetris atau demo langsung.'
        : 'Break uniform 3-card grids with an asymmetric layout or a live preview.'
    )
  }

  // Background Dot Matrix & Blueprint Grids (antislop-ui R-07)
  const hasDotGridCss =
    /radial-gradient\([^)]*1px[^)]*transparent/i.test(fullCssAndHtml) ||
    /linear-gradient\(to\s+right,[^)]*1px[^)]*transparent/i.test(fullCssAndHtml) ||
    /bg-(?:grid|dot)(?:-[a-z0-9]+)?/i.test(lowerHtml) ||
    $('[class*="bg-grid"], [class*="bg-dot"], [class*="pattern-grid"]').length > 0

  if (hasDotGridCss) {
    add(
      'layout',
      'dotgrid',
      isIndo ? 'Background Dot Matrix / Grid Blueprint' : 'Dot Matrix & Blueprint Grid',
      8,
      isIndo
        ? 'Background dot-matrix atau blueprint grid. Trik paling klise biar halaman kosong kelihatan "technical".'
        : 'Dot matrix or blueprint grid background. The default costume to make empty space look technical.',
      isIndo
        ? 'Pola titik-titik berulang atau grid tipis di background adalah seragam bawaan template AI (Aceternity UI, v0).'
        : 'Repeating dot patterns and blueprint grids are the default AI method to add fake technical texture.',
      ['radial-gradient(dot-grid 1px) or .bg-grid'],
      isIndo
        ? 'Hapus pola titik-titik (dot grid) atau garis blueprint di background.'
        : 'Remove background dot matrices and blueprint grids; use a clean solid canvas.'
    )
  }

  // Fake Terminal Window / Traffic Light Dots (antislop-ui R-06, C-5)
  const hasTerminalDots =
    /(?:#ff5f56.*#ffbd2e.*#27c93f|#ff5f56.*#27c93f)/i.test(fullCssAndHtml) ||
    $('[class*="terminal-dots"], [class*="window-dots"], [class*="mac-dots"]').length > 0 ||
    $('.flex, .inline-flex').filter((_, el) => {
      const children = $(el).children('[class*="rounded-full"]')
      if (children.length !== 3) return false
      const text = children.map((_, c) => $(c).attr('class') || '').get().join(' ')
      return /red/i.test(text) && /yellow|amber/i.test(text) && /green|emerald/i.test(text)
    }).length > 0

  if (hasTerminalDots) {
    add(
      'layout',
      'terminal',
      isIndo ? 'Jendela Terminal Mac Palsu' : 'Fake Terminal Window',
      8,
      isIndo
        ? 'Mockup jendela terminal Mac dengan titik merah-kuning-hijau. Kostum wajib biar dikira dev tool.'
        : 'A mock Mac terminal with red, yellow, and green dots. The universal costume for pretending to be a CLI tool.',
      isIndo
        ? 'Jendela terminal dekoratif dengan perintah shell statis adalah gimmick visual generik landing page AI.'
        : 'A styled terminal window with traffic-light dots is generic costume decoration for developer landing pages.',
      ['terminal-dots: red, yellow, green window controls'],
      isIndo
        ? 'Hapus jendela terminal Mac hiasan, ganti dengan kode beneran atau widget yang bisa dicoba.'
        : 'Drop decorative Mac terminal mockups; show real code or an actual interactive demo.'
    )
  }

  // "How It Works" Always 3 Steps (antislop-ui R-05)
  const stepSection = $('section, div').filter((_, el) => {
    const heading = $(el).find('h2, h3').first().text().toLowerCase()
    return /how it works|our process|cara kerja|3 easy steps|simple steps|how to start/i.test(heading)
  })

  if (stepSection.length > 0) {
    const stepCards = stepSection.find('[class*="step"], [class*="card"], li, [class*="col"]').filter((_, el) => {
      const text = $(el).text()
      return /\b(step\s*1|step\s*2|step\s*3|01|02|03)\b/i.test(text) || $(el).find('[class*="rounded-full"]').filter((_, c) => /^[123]$/.test($(c).text().trim())).length > 0
    })

    if (stepCards.length === 3) {
      add(
        'layout',
        'threesteps',
        isIndo ? 'Alur "How It Works" Wajib 3 Langkah' : 'Mandatory 3-Step Workflow',
        6,
        isIndo
          ? 'Proses kerja dipaksa persis 3 langkah berjejer (1, 2, 3). Rumus sakral template sejuta umat.'
          : 'Process forced into exactly 3 round-step icons (1, 2, 3). The template’s sacred workflow geometry.',
        isIndo
          ? 'Hampir semua generator AI memaksakan alur kerja produk ke format 3 langkah bulat yang seragam.'
          : 'Generators routinely force every process into an identical 3-step numbered sequence.',
        ['3 steps: 01, 02, 03'],
        isIndo
          ? 'Tulis alur pemakaian sebenarnya, jangan dipaksakan persis 3 langkah (01-02-03).'
          : 'Describe your actual workflow instead of forcing a 3-step (01-02-03) sequence.'
      )
    }
  }

  // Stock Photos Check
  const images = $('img[src], img[srcset]')
    .map((_, el) => ($(el).attr('src') || '') + ' ' + ($(el).attr('srcset') || ''))
    .get()

  const stockHits = images.filter((src) => STOCK_DOMAINS.test(src))
  if (stockHits.length >= 1) {
    add(
      'layout',
      'stock',
      isIndo ? 'Foto Stock / Avatar Palsu' : 'Stock Photos',
      Math.min(18, 9 + stockHits.length * 1.5),
      isIndo
        ? `${stockHits.length} foto stock gratisan (Unsplash/Pexels/fake avatar). Foto jabat tangan belum ketemu tapi udah deket.`
        : `${stockHits.length} stock photo(s). Handshake not found, but close.`,
      isIndo
        ? 'Foto Unsplash, avatar bot, dan mockup placeholder adalah pelarian ketika pembuatnya tidak punya dokumentasi produk asli.'
        : 'Unsplash shots, placeholder images and generated avatars are what a builder grabs when it has no real pictures of your product.',
      stockHits.slice(0, 3),
      isIndo
        ? 'Ganti foto stock Unsplash dengan screenshot asli produk atau UI buatan sendiri.'
        : 'Replace Unsplash stock shots with real product UI screenshots.'
    )
  }

  // Untouched Shadcn CSS Tokens
  const shadcnDefaultTokens = [
    '222.2 84% 4.9%', '222.2 47.4% 11.2%', '215.4 16.3% 46.9%', '214.3 31.8% 91.4%',
    'oklch(0.145 0 0)', 'oklch(0.205 0 0)', 'oklch(0.556 0 0)', 'oklch(0.922 0 0)'
  ]
  const matchedShadcnTokens = shadcnDefaultTokens.filter((tok) => html.includes(tok))
  if (matchedShadcnTokens.length >= 2) {
    add(
      'layout',
      'shadcn',
      isIndo ? 'Tema Shadcn Tanpa Sentuhan' : 'Untouched Shadcn Theme',
      11,
      isIndo
        ? 'Palette Shadcn masih bawaan pabrik. Kayak mobil rental yang plastiknya belum dicopot dari jok.'
        : 'Shadcn defaults, untouched. A rental car with the plastic still on the seats.',
      isIndo
        ? 'Token warna masih sama persis sampai angka desimalnya: komponen di-install dan tidak pernah di-styling ulang.'
        : 'The colour tokens still match shadcn’s defaults to the decimal: the components were installed and never styled.',
      matchedShadcnTokens.slice(0, 2),
      isIndo
        ? 'Ubah token warna bawaan Shadcn, jangan biarin nilai hex/oklch default pabrik.'
        : 'Tweak Shadcn’s default color tokens so it doesn’t look like an unstyled starter.'
    )
  }

  // Fonts Inspection (Termasuk Google Fonts Link & CSS declarations)
  const fontFamilies = new Set<string>()
  for (const m of html.matchAll(/font-family\s*:\s*([^;}{"'>]+)/gi)) {
    m[1].split(',').forEach((f) => fontFamilies.add(f.replace(/["'()!]|important/g, '').trim().toLowerCase()))
  }
  for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?family=([^"'&]+)/gi)) {
    decodeURIComponent(m[1]).split('|').forEach((f) => {
      const familyName = f.split(':')[0].replace(/\+/g, ' ').trim().toLowerCase()
      fontFamilies.add(familyName)
    })
  }

  const realFonts = [...fontFamilies].filter(
    (f) => f && f.length < 40 && !f.startsWith('var(') && !f.startsWith('__') && !/fallback|icon|awesome|symbols|katex/.test(f)
  )

  const customFonts = realFonts.filter((f) => {
    const squashed = f.replace(/[\s_-]+/g, '').toLowerCase()
    return !COMMON_FONTS.test(f) && !COMMON_FONTS.test(squashed)
  })

  if (customFonts.length > 0) {
    credit(
      isIndo ? 'Tipografi Pilihan Berkarakter' : 'Chosen Typeface',
      5,
      isIndo
        ? `Font kustom: ${customFonts.slice(0, 2).join(', ')}. Terlihat ada keputusan desain nyata.`
        : `Custom type: ${customFonts.slice(0, 2).join(', ')}. Someone made a real decision.`
    )
  } else {
    const defaultFontFound = realFonts.find((f) =>
      /^(inter|poppins|montserrat|plus jakarta sans|dm sans|roboto|open sans|playfair display|jetbrains mono|fira code)$/i.test(f)
    )
    if (defaultFontFound) {
      add(
        'type',
        'font',
        isIndo ? 'Font Bawaan Template' : 'Default Starter Font',
        4,
        isIndo
          ? `${defaultFontFound}. Font sejuta umat developer. Sama persis kayak ratusan ribu template lain.`
          : `${defaultFontFound}. A fine font. So are the other 400,000 developer templates using it.`,
        isIndo
          ? 'Bukan bukti kejahatan mutlak, tapi setiap generator dan starter kit selalu default ke font ini.'
          : 'Not proof on its own, but every generator defaults to the same developer font stack.',
        [`font-family: ${defaultFontFound}`],
        isIndo
          ? 'Ganti font template (Inter/Poppins) dengan font yang cocok sama jenis produk lu.'
          : 'Pick a typeface suited to your product rather than default Inter or Roboto.'
      )
    }
  }

  // =========================================================================
  // 4. NITPICKS (Pelanggaran Ringan Tapi Sangat Akurat & Kumulatif)
  // =========================================================================
  const nit = (
    key: string,
    label: string,
    pts: number,
    roast: string,
    why: string,
    quotes: string[] = [],
    fix: string = ''
  ) => {
    if (!findings.some((f) => f.key === key)) {
      add('nitpick', key, label, pts, roast, why, quotes, fix)
    }
  }

  // Next.js & Vercel
  if (/\/_next\//.test(lowerHtml)) {
    nit(
      'next',
      'Next.js on Vercel',
      3,
      isIndo
        ? 'Next.js, kemungkinan besar deploy di Vercel. Lu dan seisi internet.'
        : 'Next.js, probably on Vercel. You and every other developer alive.',
      isIndo
        ? 'Bukan dosa, tapi ini tech-stack paling lazim di jagat raya sekarang, jadi look-nya seragam.'
        : 'Not a crime. Just the most common stack on the internet right now, which makes it the default look too.',
      ['/_next/ assets detected'],
      isIndo
        ? 'Ganti favicon dan title default Next.js/Vercel dengan aset produk lu sendiri.'
        : 'Replace default Next.js/Vercel favicon and metadata with your own brand assets.'
    )
  }

  // GitHub Contribution Graph Wall
  if (/\bcontributions?\b/i.test(rawText) || $('[class*="contribution"], [id*="contribution"]').length > 0) {
    nit(
      'contrib',
      isIndo ? 'Grafik Kontribusi GitHub' : 'Contribution Graph',
      4,
      isIndo
        ? 'Dinding kotak-kotak hijau GitHub. Iya paham, lu rajin nge-commit.'
        : 'A github contribution graph. We get it, you commit.',
      isIndo
        ? 'Tembok kotak hijau adalah versi portofolio dev dari deretan angka pamer.'
        : 'A wall of little green squares is the developer portfolio’s version of a stat row.',
      ['GitHub contribution graph'],
      isIndo
        ? 'Tampilkan hasil karya dan studi kasus nyata, bukan tembok kotak hijau GitHub.'
        : 'Showcase actual project case studies instead of a wall of GitHub green squares.'
    )
  }

  // Tech Stack Wall
  const stackHeading = headings.find((t) =>
    /^(tech(nology)? stack|my stack|stack|tools i use|technologies|skills|tools & technologies)$/i.test(t)
  )
  if (stackHeading) {
    nit(
      'stack',
      isIndo ? 'Tembok Logo Tech Stack' : 'Tech Stack Wall',
      4,
      isIndo
        ? 'Tembok deretan logo framework. Lemari piala kebanggaan programmer.'
        : 'A tech stack logo wall. The developer’s trophy cabinet.',
      isIndo
        ? 'Grid logo framework memberi tahu pengunjung apa yang lu pakai, bukan apa solusi berharga yang lu buat.'
        : 'A grid of framework logos tells visitors what you used, not what you made.',
      [stackHeading],
      isIndo
        ? 'Hapus deretan logo framework, ceritakan masalah teknis nyata yang berhasil lu bereskan.'
        : 'Drop framework logo walls; explain the real problems you solved.'
    )
  }

  // Bio Line Cliché
  const bioMatch = findQuoteAround(
    /\b(obsess(ing|ed)? over (the )?(small |little )?details|pixel[- ]perfect|passionate about|i love building|crafting (beautiful|delightful|digital)|turning ideas into|tinkerer|i build (things|products|stuff) for the web)\b/i
  )
  if (bioMatch) {
    nit(
      'bio',
      isIndo ? 'Bio Portofolio Klise' : 'Portfolio Bio Line',
      4,
      isIndo
        ? '“Obsessing over small details”. Kalimat yang diucapkan oleh semua portofolio di dunia.'
        : '“Obsessing over small details”. Said every developer portfolio, ever.',
      isIndo
        ? 'Gantilah kalimat template ini dengan satu karya konkret yang pernah lu selesaikan.'
        : 'A line every developer portfolio shares. Swap it for one specific thing you did.',
      [bioMatch],
      isIndo
        ? 'Ganti bio klise \'obsessed with details\' dengan apa yang beneran lu bangun.'
        : 'Swap the cliché \'obsessed with details\' bio for what you actually build.'
    )
  }

  // Standalone "AI-Powered"
  const aiPoweredMatch = findQuoteAround(/\bai[- ]powered\b/i)
  if (aiPoweredMatch && !findings.some((f) => f.key === 'hero')) {
    nit(
      'aipow',
      '“AI-Powered” Mention',
      3,
      isIndo
        ? '“AI-powered”. Bang, ini cuma website biasa.'
        : '“AI-powered”. Sir, this is a website.',
      isIndo
        ? 'Di tahun sekarang semua hal diklaim AI-powered, jadi nulis itu nggak ngasih info baru apa pun.'
        : 'In 2026 everything claims to be AI-powered, so saying so tells the visitor nothing.',
      [aiPoweredMatch],
      isIndo
        ? 'Jelasin fitur nyatanya, nggak usah nempel label \'AI-powered\' di mana-mana.'
        : 'Describe what the feature actually does instead of labeling it \'AI-powered\'.'
    )
  }

  // Prompt Box Hero
  const promptPlaceholder = $('textarea[placeholder], input[placeholder]')
    .map((_, el) => $(el).attr('placeholder') || '')
    .get()
    .find((t) => /describe|what do you want|what are you|ask (me )?anything|build|prompt|imagine|idea/i.test(t))

  if (promptPlaceholder) {
    nit(
      'prompt',
      isIndo ? 'Prompt Box Hero' : 'Prompt Box Hero',
      4,
      isIndo
        ? 'Input prompt box di hero. “Hello world”-nya startup AI.'
        : 'A prompt box hero. The AI startup’s “hello world”.',
      isIndo
        ? 'Kotak teks raksasa yang menanyakan "Kamu mau bikin apa hari ini?" adalah adegan pembuka wajib setiap produk AI.'
        : 'A big text box asking what you want to build is the opening scene of every AI product launched since 2024.',
      [`Placeholder: "${promptPlaceholder}"`],
      isIndo
        ? 'Kasih lihat contoh hasil jadi dulu sebelum nyuruh user ngetik di kotak prompt.'
        : 'Show output examples before asking the user to type in a prompt box.'
    )
  }

  // Single Centered Column (max-w-2xl mx-auto)
  const narrowColumns = $('[class*="max-w-xl"], [class*="max-w-2xl"], [class*="max-w-3xl"]')
    .filter((_, el) => ($(el).attr('class') || '').includes('mx-auto')).length

  if (narrowColumns >= 2) {
    nit(
      'column',
      isIndo ? 'Satu Kolom Tengah Sempit' : 'One Centered Column',
      3,
      isIndo
        ? 'Satu kolom mx-auto max-w-2xl di tengah. Seragam resmi developer portofolio.'
        : 'One centered narrow column. The developer portfolio uniform.',
      isIndo
        ? 'Satu kolom sempit di tengah adalah tata letak teraman. Terbaca sih, tapi identik dengan 10 website terakhir yang kamu lihat.'
        : 'A single narrow centred column is the default shape of a developer site. Safe, readable, and identical to the last ten.',
      [`${narrowColumns} narrow centered column containers`],
      isIndo
        ? 'Jangan cuma bikin 1 kolom sempit di tengah (max-w-2xl), manfaatkan lebar layar.'
        : 'Use the full viewport width instead of trapping content in a narrow 600px column.'
    )
  }

  // Lucide Icons (Tiers)
  const lucideIconsCount = (html.match(/lucide-[a-z0-9-]+|class="[^"]*lucide\b/g) || []).length
  if (lucideIconsCount >= 12) {
    add(
      'layout',
      'lucide',
      isIndo ? 'Ikon Lucide di Setiap Kata' : 'Lucide Icon on Every Noun',
      7,
      isIndo
        ? `${lucideIconsCount} ikon Lucide. Kami bisa membaca kok, beneran sumpah.`
        : `${lucideIconsCount} lucide icons. We can read, we promise.`,
      isIndo
        ? 'Lucide adalah pustaka icon default shadcn dan semua generator AI. Menaruh satu di setiap item cuma bikin visual semrawut.'
        : 'Lucide is the default icon set of shadcn and every AI builder. One on every item adds noise, not meaning.',
      [`${lucideIconsCount} Lucide icons`],
      isIndo
        ? 'Kurangi tempelan icon Lucide, biarin teksnya yang bicara.'
        : 'Cut back on Lucide icons; let the copy carry meaning.'
    )
  } else if (lucideIconsCount >= 3) {
    nit(
      'lucidelite',
      'Lucide Starter Pack',
      2,
      isIndo
        ? `${lucideIconsCount} icon Lucide. Starter pack shadcn-nya mulai kelihatan.`
        : `${lucideIconsCount} lucide icons. The shadcn starter pack is showing.`,
      isIndo
        ? 'Lucide adalah pustaka icon bawaan setiap starter kit modern.'
        : 'Lucide is the default icon set of every modern starter.',
      [`${lucideIconsCount} Lucide icons`],
      isIndo
        ? 'Pakai icon seperlunya buat aksi penting aja, bukan ditempel di tiap kata.'
        : 'Use icons sparingly for primary actions, not on every single word.'
    )
  }

  // Seasoned Shadcn (data-slot attribute)
  if (html.includes('data-slot') && !findings.some((f) => f.key === 'shadcn')) {
    nit(
      'shadcnlite',
      'Shadcn, Seasoned',
      3,
      isIndo
        ? 'Komponen Shadcn versi modern dengan bumbu sedikit.'
        : 'Shadcn components, lightly seasoned.',
      isIndo
        ? 'Sudah di-style ulang, itu bagus. Tapi pondasi bawaannya masih shadcn tulen.'
        : 'Restyled, which is good. Still shadcn underneath, which we can detect.',
      ['data-slot attributes in markup'],
      isIndo
        ? 'Style ulang komponen Shadcn biar nggak kelihatan langsung copas dari dokumentasi.'
        : 'Style default Shadcn components so they don’t look copy-pasted.'
    )
  }

  // Stray Em-Dash (1-2)
  if (emDashes >= 1 && emDashes < 3 && !findings.some((f) => f.key === 'dash')) {
    nit(
      'dashlite',
      'Stray Em Dash',
      2,
      isIndo ? `${emDashes} em-dash. Tetap kami perhatikan lho.` : `${emDashes} em dash(es). We saw that.`,
      isIndo
        ? 'Mungkin ditulis manusia. Tapi em-dash tetap tanda baca kesayangan LLM.'
        : 'Probably human. Still, the em dash is the model’s favourite punctuation.',
      [findQuoteAround(/\u2014|&mdash;/) || '1 stray em dash'],
      isIndo
        ? 'Ganti tanda pisah em-dash (—) jadi titik atau koma biasa.'
        : 'Replace em dashes with simple periods or commas.'
    )
  }

  // Small Arrows on Buttons (antislop-ui R-08)
  const buttonsWithArrows = $('button, a').filter((_, el) => {
    const t = $(el).text()
    return /→|↗|->/.test(t)
  }).length

  if (buttonsWithArrows >= 2) {
    nit(
      'arrow',
      isIndo ? 'Panah Kecil di Setiap Tombol (→)' : 'Small Arrows on Every Button',
      3,
      isIndo
        ? `${buttonsWithArrows} tombol berujung panah '→'. Semua tombol berasa pengen buru-buru pergi.`
        : `${buttonsWithArrows} buttons with decorative arrows. Every button is in a hurry to leave.`,
      isIndo
        ? 'Panah panah kecil dekoratif di setiap tombol adalah kebiasaan kaku template UI modern.'
        : 'Small arrows placed on buttons as pure decoration become visual noise instead of real directional cues.',
      [`${buttonsWithArrows} buttons with arrows`],
      isIndo
        ? 'Hapus tanda panah \'→\' di tombol, teks tombolnya udah cukup jelas.'
        : 'Remove decorative arrows (→) from buttons; clear labels don’t need them.'
    )
  }

  // "Most Popular" Middle Pricing Tier Badge (antislop-ui R-31, R-05)
  const pricingContainers = $('[class*="pricing"], [id*="pricing"]').filter((_, el) => {
    return $(el).find('[class*="card"], [class*="tier"], [class*="plan"]').length >= 3
  })

  if (pricingContainers.length > 0) {
    const plans = pricingContainers.first().find('[class*="card"], [class*="tier"], [class*="plan"]')
    if (plans.length === 3) {
      const middlePlan = $(plans[1])
      const middleText = middlePlan.text().toLowerCase()
      const middleClass = middlePlan.attr('class') || ''
      if (
        /most popular|best value|recommended|paling populer|populer/i.test(middleText) ||
        /scale-105|border-primary|border-indigo|ring-2/i.test(middleClass)
      ) {
        nit(
          'popularpricing',
          isIndo ? 'Kartu Pricing "Most Popular" di Tengah' : 'Middle Tier "Most Popular"',
          4,
          isIndo
            ? 'Paket tengah otomatis dilabeli "Most Popular". Pola psikologi marketing bawaan template.'
            : 'Middle pricing tier automatically stamped “Most Popular”. The default template upsell trick.',
          isIndo
            ? 'Menonjolkan tier tengah dengan badge "Most Popular" adalah trik bawaan template pricing 3 kolom.'
            : 'Always highlighting the middle pricing card in a 3-tier grid is an unconsidered template default.',
          ['Middle tier: "Most Popular" / scale-105'],
          isIndo
            ? 'Jangan otomatis tempel badge \'Most Popular\' di paket tengah; kelompokkan paket berdasarkan kebutuhan user.'
            : 'Stop automatically slapping \'Most Popular\' on the middle pricing tier.'
        )
      }
    }
  }

  // Generic AI Feature Glyphs (antislop-ui R-04)
  const sparkleGlyphsCount =
    (html.match(/lucide-(?:sparkles?|wand(?:-2)?|bot|brain|zap)\b/gi) || []).length +
    (html.match(/(?:Sparkles|Wand2|Bot|Brain)\s*from\s*['"]@iconoir/gi) || []).length

  if (sparkleGlyphsCount >= 3) {
    nit(
      'sparkles',
      isIndo ? 'Taburan Ikon Bintang Ajaib (Sparkles)' : 'Sparkles & Magic Wand Overdose',
      4,
      isIndo
        ? `${sparkleGlyphsCount} icon bintang ajaib / wand. Shorthand visual kalau fiturnya cuma manggil LLM.`
        : `${sparkleGlyphsCount} sparkle & magic wand glyphs. The visual shorthand for "we wrapped an LLM call".`,
      isIndo
        ? 'Ikon bintang ajaib / wand adalah default generik yang dipakai generator AI untuk melabeli fitur apa pun.'
        : 'Sparkle and wand glyphs are the generic AI default icon when a builder has no specific visual metaphor.',
      [`${sparkleGlyphsCount} sparkle / wand glyphs`],
      isIndo
        ? 'Ganti icon bintang ajaib atau tongkat sihir dengan icon yang beneran nyambung sama fungsinya.'
        : 'Replace sparkle/wand glyphs with icons that match the actual feature.'
    )
  }

  // =========================================================================
  // 5. EXPONENTIAL SCORING & VERDICT (Direct Reference Formula)
  // =========================================================================
  const CAPS: Record<string, number> = {
    fingerprint: 34,
    copy: 40,
    layout: 36,
    type: 18,
    motion: 16,
    visual: 18,
    nitpick: 18
  }

  // Merge unique findings by key (highest pts wins)
  const mergedFindings = new Map<string, Finding>()
  for (const f of findings) {
    const existing = mergedFindings.get(f.key)
    if (!existing || f.pts > existing.pts) {
      mergedFindings.set(f.key, f)
    }
  }

  const finalFindings = [...mergedFindings.values()].sort((a, b) => b.pts - a.pts)

  const byCategory: Record<string, number> = {}
  for (const f of finalFindings) {
    byCategory[f.cat] = (byCategory[f.cat] || 0) + f.pts
  }

  const rawPts = Object.entries(byCategory).reduce(
    (sum, [cat, val]) => sum + Math.min(CAPS[cat] || 20, val),
    0
  )

  // Plafon kredit diskon proporsional (maksimal 8 poin)
  const minus = Math.min(8, credits.reduce((sum, c) => sum + c.pts, 0))

  // Kurva eksponensial netral dan terkalibrasi proporsional
  const finalScore = Math.max(
    2,
    Math.min(99, Math.round(100 * (1 - Math.exp(-Math.max(0, rawPts + 4 - minus) / 36))))
  )

  const VERDICTS = [
    { max: 12, id: 'clean', en: 'Okay, you actually have taste', idLabel: 'Oke, lu emang beneran punya taste' },
    { max: 25, id: 'mostly-human', en: 'A human was here. We can smell the coffee.', idLabel: 'Beneran dibikin manusia. Aroma kopinya kecium.' },
    { max: 40, id: 'suspicious', en: 'Mostly human. Mildly suspicious.', idLabel: 'Mayoritas karya manusia. Agak mencurigakan dikit.' },
    { max: 55, id: 'ai-residue', en: 'The AI is starting to show', idLabel: 'Aroma AI mulai tercium pekat' },
    { max: 70, id: 'prompt-residue', en: 'Prompt residue detected', idLabel: 'Residu prompt terdeteksi di mana-mana' },
    { max: 85, id: 'vercel-cousins', en: 'This site has 200 cousins on Vercel', idLabel: 'Website ini punya 200 sepupu kembar di Vercel' },
    { max: 101, id: 'slop-terminal', en: 'Bro just prompted and prayed', idLabel: 'Beneran cuma modal prompt terus pasrah' }
  ]

  const matchedVerdict = VERDICTS.find((v) => finalScore <= v.max) || VERDICTS[VERDICTS.length - 1]

  const result = {
    success: true,
    host,
    url,
    source,
    heroImage,
    score: finalScore,
    verdictId: matchedVerdict.id,
    verdictLabel: isIndo ? matchedVerdict.idLabel : matchedVerdict.en,
    findings: finalFindings,
    credits,
    stats: {
      words,
      headingsCount: headings.length,
      buzzCount: totalBuzz,
      emDashes
    }
  }
  setGenericCache(cacheKey, result)
  return result
})
