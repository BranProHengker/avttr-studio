import * as cheerio from 'cheerio'
import { ofetch } from 'ofetch'

export interface ColorToken {
  hex: string
  rgb: string
  hsl: string
  luminance: number
  role: 'background' | 'foreground' | 'accent' | 'border' | 'neutral'
  count: number
  contrastWithBg?: {
    ratio: number
    passesAA: boolean
    passesAALarge: boolean
    passesAAA: boolean
  }
}

export interface FontToken {
  name: string
  category: 'sans' | 'serif' | 'mono' | 'display'
  source: 'google-fonts' | 'local' | 'system'
  weights: number[]
}

export interface TechStackItem {
  name: string
  category: 'framework' | 'styling' | 'ui-library' | 'icons' | 'infrastructure' | 'cms'
  confidence: 'high' | 'medium'
  version?: string
  evidence: string
}

export interface ExtractedDesignData {
  metadata: {
    url: string
    hostname: string
    title: string
    description: string
    favicon?: string
    ogImage?: string
  }
  colors: {
    palette: ColorToken[]
    dominantBackground: string
    dominantForeground: string
    accentColor: string
    cssVariables: Record<string, string>
  }
  typography: {
    fonts: FontToken[]
    primaryFont: string
    monoFont: string
    fontSizes: string[]
    lineHeights: string[]
  }
  geometry: {
    radii: string[]
    shadows: string[]
    spacingScale: string[]
  }
  techStack: TechStackItem[]
  exports: {
    designMd: string
    techStackMd: string
    tailwindCss: string
    shadcnCss: string
    dtcgJson: string
  }
}

function hexToRgb(hex: string): [number, number, number] | null {
  let clean = hex.replace('#', '').trim()
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('')
  } else if (clean.length === 4) {
    clean = clean.slice(0, 3).split('').map(c => c + c).join('')
  } else if (clean.length === 8) {
    clean = clean.slice(0, 6)
  }

  if (clean.length !== 6) return null

  const num = parseInt(clean, 16)
  if (isNaN(num)) return null

  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const normR = r / 255
  const normG = g / 255
  const normB = b / 255

  const max = Math.max(normR, normG, normB)
  const min = Math.min(normR, normG, normB)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case normR:
        h = (normG - normB) / d + (normG < normB ? 6 : 0)
        break
      case normG:
        h = (normB - normR) / d + 2
        break
      case normB:
        h = (normR - normG) / d + 4
        break
    }
    h /= 6
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

function calculateRelativeLuminance(r: number, g: number, b: number): number {
  const linearize = (val: number) => {
    const c = val / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

export function calculateContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  const ratio = (lighter + 0.05) / (darker + 0.05)
  return Math.round(ratio * 100) / 100
}

function normalizeHex(hex: string): string {
  let val = hex.toLowerCase().trim()
  if (!val.startsWith('#')) val = '#' + val
  if (val.length === 4) {
    return `#${val[1]}${val[1]}${val[2]}${val[2]}${val[3]}${val[3]}`
  }
  if (val.length === 9) {
    return val.slice(0, 7)
  }
  return val
}

function parseCssRules(cssText: string) {
  const colorsMap: Map<string, number> = new Map()
  const cssVariables: Record<string, string> = {}
  const fontFamilies: Set<string> = new Set()
  const fontSizes: Set<string> = new Set()
  const lineHeights: Set<string> = new Set()
  const radii: Set<string> = new Set()
  const shadows: Set<string> = new Set()
  const spacingValues: Set<string> = new Set()

  const hexMatches = cssText.match(/#[0-9a-fA-F]{3,8}\b/g) || []
  for (const h of hexMatches) {
    if (h.length === 4 || h.length === 7) {
      const norm = normalizeHex(h)
      colorsMap.set(norm, (colorsMap.get(norm) || 0) + 1)
    }
  }

  const rgbMatches = cssText.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g) || []
  for (const m of rgbMatches) {
    const nums = m.match(/\d{1,3}/g)
    if (nums && nums.length >= 3) {
      const r = Math.min(255, parseInt(nums[0], 10))
      const g = Math.min(255, parseInt(nums[1], 10))
      const b = Math.min(255, parseInt(nums[2], 10))
      const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
      colorsMap.set(hex, (colorsMap.get(hex) || 0) + 1)
    }
  }

  const varMatches = cssText.matchAll(/--([a-zA-Z0-9_-]+)\s*:\s*([^;{}]+);/g)
  for (const m of varMatches) {
    const key = `--${m[1]}`
    const val = m[2].trim()
    cssVariables[key] = val

    if (val.startsWith('#') || val.startsWith('rgb') || val.startsWith('hsl') || val.startsWith('oklch')) {
      if (val.startsWith('#') && (val.length === 4 || val.length === 7)) {
        const norm = normalizeHex(val)
        colorsMap.set(norm, (colorsMap.get(norm) || 0) + 5)
      }
    }

    if (key.includes('radius')) {
      radii.add(val)
    }
    if (key.includes('shadow')) {
      shadows.add(val)
    }
    if ((key.includes('font-family') || key.includes('font-sans') || key.includes('font-mono') || key.includes('font-serif')) && !/^\d+$/.test(val)) {
      const cleanVal = val.replace(/['"]/g, '').split(',')[0].trim()
      if (cleanVal && !cleanVal.startsWith('var(') && !['initial', 'inherit', 'unset', 'normal'].includes(cleanVal.toLowerCase())) {
        fontFamilies.add(cleanVal.split(':')[0].trim())
      }
    }
  }

  const fontMatches = cssText.matchAll(/font-family\s*:\s*([^;{}!]+)/g)
  for (const m of fontMatches) {
    const clean = m[1].replace(/['"]/g, '').trim()
    if (clean && !clean.startsWith('inherit') && !clean.startsWith('var(')) {
      const primary = clean.split(',')[0].trim().split(':')[0].trim()
      if (primary && !['initial', 'inherit', 'unset', 'normal'].includes(primary.toLowerCase()) && !/^\d+$/.test(primary)) {
        fontFamilies.add(primary)
      }
    }
  }

  const sizeMatches = cssText.matchAll(/font-size\s*:\s*([^;{}!]+)/g)
  for (const m of sizeMatches) {
    const val = m[1].trim()
    if (/^\d+(\.\d+)?(px|rem|em)$/.test(val)) {
      fontSizes.add(val)
    }
  }

  const lhMatches = cssText.matchAll(/line-height\s*:\s*([^;{}!]+)/g)
  for (const m of lhMatches) {
    const val = m[1].trim()
    if (/^\d+(\.\d+)?(px|rem|em)?$/.test(val)) {
      lineHeights.add(val)
    }
  }

  const radiusMatches = cssText.matchAll(/border-radius\s*:\s*([^;{}!]+)/g)
  for (const m of radiusMatches) {
    const val = m[1].trim()
    if (val !== '0' && val !== '0px') {
      radii.add(val)
    }
  }

  const shadowMatches = cssText.matchAll(/box-shadow\s*:\s*([^;{}!]+)/g)
  for (const m of shadowMatches) {
    const val = m[1].trim()
    if (val !== 'none' && val.length < 100) {
      shadows.add(val)
    }
  }

  const spacingMatches = cssText.matchAll(/(?:margin|padding|gap)\s*:\s*([^;{}!]+)/g)
  for (const m of spacingMatches) {
    const val = m[1].trim()
    if (/^\d+(\.\d+)?(px|rem)$/.test(val)) {
      spacingValues.add(val)
    }
  }

  return {
    colorsMap,
    cssVariables,
    fontFamilies,
    fontSizes,
    lineHeights,
    radii,
    shadows,
    spacingValues,
  }
}

function detectTechStack(html: string, headers: Headers, cssText: string, $: cheerio.CheerioAPI): TechStackItem[] {
  const stack: TechStackItem[] = []
  const recorded = new Set<string>()

  const add = (item: TechStackItem) => {
    if (!recorded.has(item.name)) {
      recorded.add(item.name)
      stack.push(item)
    }
  }

  if (html.includes('__NEXT_DATA__') || html.includes('/_next/static')) {
    add({
      name: 'Next.js',
      category: 'framework',
      confidence: 'high',
      evidence: 'Detected __NEXT_DATA__ script payload and /_next/static asset paths.',
    })
  }

  if (html.includes('__NUXT__') || html.includes('/_nuxt/') || html.includes('id="__nuxt"')) {
    add({
      name: 'Nuxt',
      category: 'framework',
      confidence: 'high',
      evidence: 'Detected __NUXT__ hydration object and /_nuxt/ runtime bundles.',
    })
  }

  if (html.includes('data-reactroot') || html.includes('react-dom') || html.includes('_reactListening')) {
    add({
      name: 'React',
      category: 'framework',
      confidence: 'high',
      evidence: 'Found React DOM root markers and hydration indicators.',
    })
  }

  if (html.includes('data-v-') || $('[data-v-]').length > 0 || html.includes('vue-app')) {
    add({
      name: 'Vue.js',
      category: 'framework',
      confidence: 'high',
      evidence: 'Identified scoped CSS data-v-* attributes on HTML elements.',
    })
  }

  if (html.includes('class="svelte-') || html.includes('__svelte__') || /svelte-[a-z0-9]+/i.test(html)) {
    add({
      name: 'Svelte',
      category: 'framework',
      confidence: 'high',
      evidence: 'Found compiled svelte-* scoped class selectors in DOM.',
    })
  }

  if (html.includes('astro-island') || html.includes('class="astro-') || $('astro-island').length > 0) {
    add({
      name: 'Astro',
      category: 'framework',
      confidence: 'high',
      evidence: 'Detected <astro-island> component tags in HTML markup.',
    })
  }

  if (html.includes('window.__remixContext') || html.includes('/_remix/')) {
    add({
      name: 'Remix',
      category: 'framework',
      confidence: 'high',
      evidence: 'Found window.__remixContext routing and loader state.',
    })
  }

  const hasTailwindClasses = /(?:flex|grid|items-center|justify-between|rounded-[a-z0-9]+|bg-[a-z]+-[0-9]+|text-[a-z]+-[0-9]+)\b/.test(html)
  const hasTailwindV4 = cssText.includes('@theme') || cssText.includes('--color-') || html.includes('@tailwindcss')
  if (hasTailwindClasses || hasTailwindV4 || cssText.includes('tailwindcss')) {
    add({
      name: 'Tailwind CSS',
      category: 'styling',
      confidence: 'high',
      evidence: hasTailwindV4 ? 'Detected Tailwind CSS v4 @theme variables and utilities.' : 'Detected canonical Tailwind CSS utility classes in DOM.',
    })
  }

  if (html.includes('data-radix-') || (cssText.includes('--card') && cssText.includes('--popover') && cssText.includes('--primary-foreground'))) {
    add({
      name: 'shadcn/ui',
      category: 'ui-library',
      confidence: 'high',
      evidence: 'Detected Radix UI primitives and shadcn semantic token variables.',
    })
  }

  if (html.includes('data-radix-') || $('[data-radix-popper-content-wrapper]').length > 0) {
    add({
      name: 'Radix UI',
      category: 'ui-library',
      confidence: 'high',
      evidence: 'Found data-radix-* accessibility attributes and portal mount points.',
    })
  }

  if (html.includes('lucide') || $('svg.lucide').length > 0 || html.includes('lucide-')) {
    add({
      name: 'Lucide Icons',
      category: 'icons',
      confidence: 'high',
      evidence: 'Detected Lucide SVG icons with standard stroke and geometry attributes.',
    })
  }

  if (html.includes('fa-solid') || html.includes('fa-brands') || html.includes('fontawesome')) {
    add({
      name: 'Font Awesome',
      category: 'icons',
      confidence: 'high',
      evidence: 'Found Font Awesome icon classes and font references.',
    })
  }

  const cfRay = headers.get('cf-ray')
  const serverHeader = headers.get('server')?.toLowerCase() || ''
  if (cfRay || serverHeader.includes('cloudflare')) {
    add({
      name: 'Cloudflare',
      category: 'infrastructure',
      confidence: 'high',
      evidence: 'Detected cf-ray header and Cloudflare edge proxy signature.',
    })
  }

  const vercelId = headers.get('x-vercel-id')
  if (vercelId || html.includes('_vercel')) {
    add({
      name: 'Vercel',
      category: 'infrastructure',
      confidence: 'high',
      evidence: 'Detected x-vercel-id edge deployment header.',
    })
  }

  const netlifyId = headers.get('x-nf-request-id')
  if (netlifyId) {
    add({
      name: 'Netlify',
      category: 'infrastructure',
      confidence: 'high',
      evidence: 'Detected Netlify x-nf-request-id infrastructure header.',
    })
  }

  if (html.includes('wp-content') || html.includes('wp-includes')) {
    add({
      name: 'WordPress',
      category: 'cms',
      confidence: 'high',
      evidence: 'Found standard wp-content directory assets.',
    })
  }

  return stack
}

function generateDesignMd(
  hostname: string,
  colors: ColorToken[],
  dominantBg: ColorToken,
  dominantFg: ColorToken,
  fonts: FontToken[],
  radii: string[],
  shadows: string[]
): string {
  const isDark = dominantBg.luminance < 0.2
  const modeName = isDark ? 'Dark Mode First' : 'Light Mode Standard'

  let out = `# DESIGN.md — Design Tokens & Visual Guidelines (${hostname})

## 1. Visual Atmosphere & Principles
* **Theme Archetype:** ${modeName}
* **Dominant Background:** \`${dominantBg.hex}\`
* **Dominant Foreground:** \`${dominantFg.hex}\`
* **Philosophy:** Minimalist interface with structured 1px boundaries, calibrated neutral scales, and intentional contrast.

---

## 2. Color Palette & Semantic Tokens

### Primary Scales
| Role | HEX | RGB | HSL | Relative Luminance | WCAG Contrast (vs Background) |
| :--- | :--- | :--- | :--- | :--- | :--- |
`

  for (const c of colors.slice(0, 8)) {
    const contrast = c.contrastWithBg?.ratio ? `${c.contrastWithBg.ratio}:1 (${c.contrastWithBg.passesAA ? 'Pass AA' : 'Fail'})` : 'Baseline'
    out += `| **${c.role}** | \`${c.hex}\` | \`${c.rgb}\` | \`${c.hsl}\` | ${c.luminance.toFixed(3)} | ${contrast} |\n`
  }

  out += `\n### Accessibility Guidance
* All body text must maintain a minimum contrast ratio of 4.5:1 against the background.
* Interactive components and borders require at least 3:1 contrast against adjacent surfaces.

---

## 3. Typography Hierarchy

### Font Families
`
  if (fonts.length > 0) {
    for (const f of fonts) {
      out += `* **${f.category.toUpperCase()}:** \`${f.name}\` (${f.source})\n`
    }
  } else {
    out += `* **SANS:** \`Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif\`\n`
    out += `* **MONO:** \`JetBrains Mono, Menlo, Monaco, monospace\`\n`
  }

  out += `\n---

## 4. Geometry & Elevation

### Border Radii
`
  if (radii.length > 0) {
    for (const r of radii.slice(0, 5)) {
      out += `* \`${r}\`\n`
    }
  } else {
    out += `* Default Card Radius: \`14px\`\n* Control Radius: \`8px\`\n* Badge Radius: \`9999px\`\n`
  }

  out += `\n### Box Shadows\n`
  if (shadows.length > 0) {
    for (const s of shadows.slice(0, 4)) {
      out += `* \`${s}\`\n`
    }
  } else {
    out += `* Flat crisp 1px borders preferred over heavy ambient drop shadows.\n`
  }

  return out
}

function generateTechStackMd(hostname: string, stack: TechStackItem[]): string {
  let out = `# TECHSTACK.md — Detected Stack Report (${hostname})

Extracted runtime frameworks, styling libraries, UI components, and infrastructure.

## Stack Breakdown
| Category | Technology | Confidence | Evidence |
| :--- | :--- | :--- | :--- |
`

  for (const item of stack) {
    out += `| **${item.category}** | **${item.name}** | ${item.confidence} | ${item.evidence} |\n`
  }

  out += `\n## Extraction Summary\n* Total identified technologies: ${stack.length}\n* Extracted via deterministic DOM signature matching and HTTP headers.\n`
  return out
}

function generateTailwindV4(colors: ColorToken[], fonts: FontToken[], radii: string[]): string {
  const primary = colors.find(c => c.role === 'accent') || colors[0]
  const bg = colors.find(c => c.role === 'background') || colors[0]
  const fg = colors.find(c => c.role === 'foreground') || colors[1] || colors[0]
  const sansFont = fonts.find(f => f.category === 'sans')?.name || 'Inter'
  const monoFont = fonts.find(f => f.category === 'mono')?.name || 'JetBrains Mono'

  let out = `@theme {
  --font-sans: "${sansFont}", system-ui, sans-serif;
  --font-mono: "${monoFont}", monospace;

  --color-background: ${bg.hex};
  --color-foreground: ${fg.hex};
  --color-primary: ${primary.hex};
`

  if (radii.length > 0) {
    out += `  --radius-card: ${radii[0]};\n`
  } else {
    out += `  --radius-card: 14px;\n`
    out += `  --radius-control: 8px;\n`
  }

  out += `}\n`
  return out
}

function generateShadcnCss(dominantBg: ColorToken, dominantFg: ColorToken, accent: ColorToken): string {
  const isDark = dominantBg.luminance < 0.2

  if (isDark) {
    return `:root {
  --background: #ffffff;
  --foreground: #171717;
  --card: #ffffff;
  --card-foreground: #171717;
  --primary: ${accent.hex};
  --primary-foreground: #ffffff;
  --border: #e5e5e5;
  --radius: 0.5rem;
}

.dark {
  --background: ${dominantBg.hex};
  --foreground: ${dominantFg.hex};
  --card: #1f1f23;
  --card-foreground: ${dominantFg.hex};
  --primary: ${accent.hex};
  --primary-foreground: #ffffff;
  --border: #2e2e32;
  --radius: 0.5rem;
}`
  }

  return `:root {
  --background: ${dominantBg.hex};
  --foreground: ${dominantFg.hex};
  --card: #ffffff;
  --card-foreground: ${dominantFg.hex};
  --primary: ${accent.hex};
  --primary-foreground: #ffffff;
  --border: #e5e5e5;
  --radius: 0.5rem;
}

.dark {
  --background: #121214;
  --foreground: #f4f4f5;
  --card: #18181b;
  --card-foreground: #f4f4f5;
  --primary: ${accent.hex};
  --primary-foreground: #18181b;
  --border: #27272a;
  --radius: 0.5rem;
}`
}

export async function extractDesignFromUrl(targetUrl: string): Promise<ExtractedDesignData> {
  let parsedUrl: URL
  try {
    let clean = targetUrl.trim()
    if (!/^https?:\/\//i.test(clean)) {
      clean = 'https://' + clean
    }
    parsedUrl = new URL(clean)
  } catch (err: any) {
    throw new Error('Invalid URL format.')
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Only HTTP and HTTPS protocols are allowed.')
  }

  const hostname = parsedUrl.hostname.toLowerCase()
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new Error('Access to private or local network hosts is prohibited.')
  }

  let html = ''
  let responseHeaders = new Headers()

  try {
    const res = await ofetch.raw(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
      redirect: 'follow',
    })
    html = typeof res._data === 'string' ? res._data : String(res._data || '')
    responseHeaders = res.headers
  } catch (err: any) {
    throw new Error(`Failed to fetch website (${err.message || 'Network error'}).`)
  }

  const $ = cheerio.load(html)
  const title = $('title').first().text().trim() || $('meta[property="og:title"]').attr('content') || hostname
  const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || ''
  const ogImage = $('meta[property="og:image"]').attr('content') || ''
  let favicon = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href') || ''
  if (favicon && !favicon.startsWith('http')) {
    favicon = new URL(favicon, parsedUrl.origin).toString()
  }

  let combinedCss = ''
  $('style').each((_, el) => {
    combinedCss += '\n' + $(el).text()
  })

  const stylesheetUrls: string[] = []
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href')
    if (href && stylesheetUrls.length < 5) {
      try {
        const full = new URL(href, parsedUrl.origin).toString()
        stylesheetUrls.push(full)
      } catch {}
    }
  })

  if (stylesheetUrls.length > 0) {
    const fetchedStyles = await Promise.allSettled(
      stylesheetUrls.map(u =>
        ofetch(u, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          },
          timeout: 4000,
        }).catch(() => '')
      )
    )

    for (const res of fetchedStyles) {
      if (res.status === 'fulfilled' && typeof res.value === 'string') {
        combinedCss += '\n' + res.value
      }
    }
  }

  const parsedCss = parseCssRules(combinedCss)

  const fontsList: FontToken[] = []
  const recordedFonts = new Set<string>()

  $('link[href*="fonts.googleapis.com"]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const match = href.match(/family=([^&:]+)/)
    if (match && match[1]) {
      const decoded = decodeURIComponent(match[1]).replace(/\+/g, ' ')
      if (!recordedFonts.has(decoded)) {
        recordedFonts.add(decoded)
        fontsList.push({
          name: decoded,
          category: decoded.toLowerCase().includes('mono') ? 'mono' : 'sans',
          source: 'google-fonts',
          weights: [400, 500, 600, 700],
        })
      }
    }
  })

  for (const f of parsedCss.fontFamilies) {
    if (!recordedFonts.has(f) && fontsList.length < 5) {
      recordedFonts.add(f)
      const cat = f.toLowerCase().includes('mono') ? 'mono' : f.toLowerCase().includes('serif') ? 'serif' : 'sans'
      fontsList.push({
        name: f,
        category: cat,
        source: 'local',
        weights: [400, 600],
      })
    }
  }

  const rawColorsList: Array<{ hex: string; count: number }> = []
  for (const [hex, count] of parsedCss.colorsMap.entries()) {
    rawColorsList.push({ hex, count })
  }
  rawColorsList.sort((a, b) => b.count - a.count)

  const rankedTokens: ColorToken[] = []
  for (const item of rawColorsList.slice(0, 16)) {
    const rgb = hexToRgb(item.hex)
    if (!rgb) continue

    const [r, g, b] = rgb
    const [h, s, l] = rgbToHsl(r, g, b)
    const luminance = calculateRelativeLuminance(r, g, b)

    let role: ColorToken['role'] = 'neutral'
    if (l > 92 || l < 8) {
      role = l > 92 ? 'background' : 'foreground'
    } else if (s > 45) {
      role = 'accent'
    } else if (l > 75 || l < 25) {
      role = 'border'
    }

    rankedTokens.push({
      hex: item.hex,
      rgb: `rgb(${r}, ${g}, ${b})`,
      hsl: `hsl(${h}, ${s}%, ${l}%)`,
      luminance,
      role,
      count: item.count,
    })
  }

  const backgroundCandidates = rankedTokens.filter(t => t.luminance > 0.85 || t.luminance < 0.15)
  const dominantBg = backgroundCandidates[0] || rankedTokens[0] || {
    hex: '#171717',
    rgb: 'rgb(23, 23, 23)',
    hsl: 'hsl(0, 0%, 9%)',
    luminance: 0.015,
    role: 'background',
    count: 1,
  }

  const foregroundCandidates = rankedTokens.filter(t => Math.abs(t.luminance - dominantBg.luminance) > 0.5)
  const dominantFg = foregroundCandidates[0] || {
    hex: dominantBg.luminance < 0.5 ? '#ffffff' : '#111111',
    rgb: dominantBg.luminance < 0.5 ? 'rgb(255, 255, 255)' : 'rgb(17, 17, 17)',
    hsl: dominantBg.luminance < 0.5 ? 'hsl(0, 0%, 100%)' : 'hsl(0, 0%, 7%)',
    luminance: dominantBg.luminance < 0.5 ? 1.0 : 0.01,
    role: 'foreground',
    count: 1,
  }

  const accentCandidate = rankedTokens.find(t => t.role === 'accent') || dominantFg

  for (const token of rankedTokens) {
    const ratio = calculateContrastRatio(token.luminance, dominantBg.luminance)
    token.contrastWithBg = {
      ratio,
      passesAA: ratio >= 4.5,
      passesAALarge: ratio >= 3.0,
      passesAAA: ratio >= 7.0,
    }
  }

  const techStack = detectTechStack(html, responseHeaders, combinedCss, $)

  const radii = Array.from(parsedCss.radii).slice(0, 6)
  const shadows = Array.from(parsedCss.shadows).slice(0, 4)
  const spacingScale = Array.from(parsedCss.spacingValues).slice(0, 8)
  const fontSizes = Array.from(parsedCss.fontSizes).slice(0, 8)
  const lineHeights = Array.from(parsedCss.lineHeights).slice(0, 6)

  const primaryFont = fontsList.find(f => f.category === 'sans')?.name || 'Inter'
  const monoFont = fontsList.find(f => f.category === 'mono')?.name || 'JetBrains Mono'

  const designMd = generateDesignMd(hostname, rankedTokens, dominantBg, dominantFg, fontsList, radii, shadows)
  const techStackMd = generateTechStackMd(hostname, techStack)
  const tailwindCss = generateTailwindV4(rankedTokens, fontsList, radii)
  const shadcnCss = generateShadcnCss(dominantBg, dominantFg, accentCandidate)

  const dtcgJson = JSON.stringify(
    {
      $schema: 'https://design-tokens.github.io/community-group/format/',
      color: Object.fromEntries(
        rankedTokens.map((t, idx) => [
          `color-${idx + 1}`,
          {
            $value: t.hex,
            $type: 'color',
            role: t.role,
            luminance: t.luminance,
          },
        ])
      ),
      typography: {
        fontFamily: {
          sans: { $value: primaryFont, $type: 'fontFamily' },
          mono: { $value: monoFont, $type: 'fontFamily' },
        },
      },
      border: {
        radius: Object.fromEntries(radii.map((r, i) => [`radius-${i + 1}`, { $value: r, $type: 'dimension' }])),
      },
    },
    null,
    2
  )

  return {
    metadata: {
      url: targetUrl,
      hostname,
      title,
      description,
      favicon,
      ogImage,
    },
    colors: {
      palette: rankedTokens,
      dominantBackground: dominantBg.hex,
      dominantForeground: dominantFg.hex,
      accentColor: accentCandidate.hex,
      cssVariables: parsedCss.cssVariables,
    },
    typography: {
      fonts: fontsList,
      primaryFont,
      monoFont,
      fontSizes,
      lineHeights,
    },
    geometry: {
      radii,
      shadows,
      spacingScale,
    },
    techStack,
    exports: {
      designMd,
      techStackMd,
      tailwindCss,
      shadcnCss,
      dtcgJson,
    },
  }
}
