import * as cheerio from 'cheerio'
import { ofetch } from 'ofetch'

export interface ColorToken {
  hex: string
  rgb: string
  hsl: string
  luminance: number
  role: 'background' | 'foreground' | 'accent' | 'border' | 'neutral'
  dembrandtRole?: string
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

export interface TypographyStyleToken {
  fontFamily: string
  fontSize: string
  fontWeight: number | string
  lineHeight: string | number
  letterSpacing?: string
  textTransform?: string
}

export interface ComponentStyleToken {
  typography?: string
  textColor?: string
  backgroundColor?: string
  border?: string
  height?: string
  padding?: string
  boxShadow?: string
  rounded?: string
  fontSize?: string
  fontFamily?: string
  fontWeight?: number | string
  lineHeight?: string | number
}

export interface BreakpointToken {
  width: number
  containerWidth: number
  gridColumns: number
  navLinksVisible?: number
  menuToggleVisible?: boolean
  headingPx?: number
  bodyPx?: number
  sectionPaddingX?: number
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
    semanticRoles: Record<string, string>
  }
  typography: {
    fonts: FontToken[]
    primaryFont: string
    monoFont: string
    fontSizes: string[]
    lineHeights: string[]
    tokens: Record<string, TypographyStyleToken>
  }
  geometry: {
    radii: string[]
    shadows: string[]
    spacingScale: string[]
    borderWidths: string[]
  }
  components: Record<string, ComponentStyleToken>
  breakpoints: BreakpointToken[]
  techStack: TechStackItem[]
  exports: {
    designMd: string
    techStackMd: string
    tailwindCss: string
    shadcnCss: string
    dtcgJson: string
  }
  aiUsed: boolean
  aiFallback: boolean
  aiError?: string
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

const TAILWIND_COLOR_PALETTES: Record<string, string> = {
  'slate-50': '#f8fafc', 'slate-100': '#f1f5f9', 'slate-200': '#e2e8f0', 'slate-800': '#1e293b', 'slate-900': '#0f172a', 'slate-950': '#020617',
  'gray-50': '#f9fafb', 'gray-100': '#f3f4f6', 'gray-200': '#e5e7eb', 'gray-800': '#1f2937', 'gray-900': '#111827', 'gray-950': '#030712',
  'zinc-50': '#fafafa', 'zinc-100': '#f4f4f5', 'zinc-200': '#e4e4e7', 'zinc-800': '#27272a', 'zinc-900': '#18181b', 'zinc-950': '#09090b',
  'neutral-50': '#fafafa', 'neutral-100': '#f5f5f5', 'neutral-200': '#e5e5e5', 'neutral-800': '#262626', 'neutral-900': '#171717', 'neutral-950': '#0a0a0a',
  'stone-50': '#fafaf9', 'stone-100': '#f5f5f4', 'stone-200': '#e7e5e4', 'stone-800': '#292524', 'stone-900': '#1c1917', 'stone-950': '#0c0a09',
  'white': '#ffffff',
  'black': '#000000',
}

export interface ExplicitRootTheme {
  lightBg?: string
  darkBg?: string
  lightFg?: string
  darkFg?: string
}

export function extractExplicitRootTheme(html: string, combinedCss: string, $: cheerio.CheerioAPI): ExplicitRootTheme {
  const result: ExplicitRootTheme = {}

  // 1. Inspect body and html class strings
  const bodyClass = ($('body').attr('class') || '') + ' ' + ($('html').attr('class') || '')

  const extractHexClass = (className: string, prefix: 'bg' | 'text', isDark: boolean): string | null => {
    const regex = isDark
      ? new RegExp(`dark:${prefix}-\\[#([0-9a-fA-F]{3,8})\\]`)
      : new RegExp(`(?:^|\\s)${prefix}-\\[#([0-9a-fA-F]{3,8})\\]`)
    const match = className.match(regex)
    if (match) return normalizeHex('#' + match[1])

    for (const [key, hex] of Object.entries(TAILWIND_COLOR_PALETTES)) {
      const p = isDark
        ? new RegExp(`dark:${prefix}-${key}\\b`)
        : new RegExp(`(?:^|\\s)${prefix}-${key}\\b`)
      if (p.test(className)) return hex
    }
    return null
  }

  const lightBgClass = extractHexClass(bodyClass, 'bg', false)
  const darkBgClass = extractHexClass(bodyClass, 'bg', true)
  const lightFgClass = extractHexClass(bodyClass, 'text', false)
  const darkFgClass = extractHexClass(bodyClass, 'text', true)

  if (lightBgClass) result.lightBg = lightBgClass
  if (darkBgClass) result.darkBg = darkBgClass
  if (lightFgClass) result.lightFg = lightFgClass
  if (darkFgClass) result.darkFg = darkFgClass

  // 2. Inspect inline styles on body and html
  const bodyStyle = ($('body').attr('style') || '') + ';' + ($('html').attr('style') || '')
  if (bodyStyle) {
    const bgMatch = bodyStyle.match(/(?:^|;)\s*background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/i)
    if (bgMatch && !result.lightBg) {
      if (bgMatch[1].startsWith('#')) {
        result.lightBg = normalizeHex(bgMatch[1])
      }
    }
    const fgMatch = bodyStyle.match(/(?:^|;)\s*color\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/i)
    if (fgMatch && !result.lightFg) {
      if (fgMatch[1].startsWith('#')) {
        result.lightFg = normalizeHex(fgMatch[1])
      }
    }
  }

  // 3. Inspect meta theme-color
  $('meta[name="theme-color"]').each((_, el) => {
    const content = $(el).attr('content')?.trim()
    const media = $(el).attr('media')?.toLowerCase() || ''
    if (content && content.startsWith('#')) {
      const norm = normalizeHex(content)
      if (media.includes('dark')) {
        if (!result.darkBg) result.darkBg = norm
      } else {
        if (!result.lightBg) result.lightBg = norm
      }
    }
  })

  // 4. Inspect CSS rules for body/html/root
  if (!result.lightBg) {
    const bodyCssBg = combinedCss.match(/(?:^|[\s{}])(?:body|html)\s*\{[^}]*background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8})\b/i)
    if (bodyCssBg) {
      result.lightBg = normalizeHex(bodyCssBg[1])
    }
  }

  if (!result.lightBg) {
    const rootCssBg = combinedCss.match(/:root\s*\{[^}]*--(?:background|bg|canvas)\s*:\s*(#[0-9a-fA-F]{3,8})\b/i)
    if (rootCssBg) {
      result.lightBg = normalizeHex(rootCssBg[1])
    }
  }

  return result
}


function parseCssRules(cssText: string) {
  const colorsMap: Map<string, number> = new Map()
  const cssVariables: Record<string, string> = {}
  const fontFamilies: Set<string> = new Set()
  const fontSizes: Set<string> = new Set()
  const lineHeights: Set<string> = new Set()
  const letterSpacings: Set<string> = new Set()
  const radii: Set<string> = new Set()
  const shadows: Set<string> = new Set()
  const spacingValues: Set<string> = new Set()
  const borderWidths: Set<string> = new Set()
  const mediaQueries: Set<number> = new Set()

  const hexMatches = cssText.match(/#[0-9a-fA-F]{3,8}\b/g) || []
  for (const h of hexMatches) {
    if (h.length === 4 || h.length === 7) {
      const norm = normalizeHex(h)
      colorsMap.set(norm, (colorsMap.get(norm) || 0) + 1)
    }
  }

  const rgbMatches = cssText.matchAll(/rgba?\(\s*(\d{1,3})[,\s]+(\d{1,3})[,\s]+(\d{1,3})(?:[,\s/]+[0-9.%]+)?\s*\)/g)
  for (const m of rgbMatches) {
    const r = Math.min(255, parseInt(m[1], 10))
    const g = Math.min(255, parseInt(m[2], 10))
    const b = Math.min(255, parseInt(m[3], 10))
    const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
    colorsMap.set(hex, (colorsMap.get(hex) || 0) + 1)
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

    if (key.includes('radius')) radii.add(val)
    if (key.includes('shadow')) shadows.add(val)
    if (key.includes('spacing') || key.includes('gap')) spacingValues.add(val)
    if ((key.includes('font-family') || key.includes('font-sans') || key.includes('font-mono')) && !/^\d+$/.test(val)) {
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
    if (/^\d+(\.\d+)?(px|rem|em)$/.test(val)) fontSizes.add(val)
  }

  const lhMatches = cssText.matchAll(/line-height\s*:\s*([^;{}!]+)/g)
  for (const m of lhMatches) {
    const val = m[1].trim()
    if (/^\d+(\.\d+)?(px|rem|em)?$/.test(val)) lineHeights.add(val)
  }

  const lsMatches = cssText.matchAll(/letter-spacing\s*:\s*([^;{}!]+)/g)
  for (const m of lsMatches) {
    const val = m[1].trim()
    if (val !== 'normal' && val !== '0' && val !== '0px') letterSpacings.add(val)
  }

  const radiusMatches = cssText.matchAll(/border-radius\s*:\s*([^;{}!]+)/g)
  for (const m of radiusMatches) {
    const val = m[1].trim()
    if (val !== '0' && val !== '0px') radii.add(val)
  }

  const shadowMatches = cssText.matchAll(/box-shadow\s*:\s*([^;{}!]+)/g)
  for (const m of shadowMatches) {
    const val = m[1].trim()
    if (val !== 'none' && val.length < 150) shadows.add(val)
  }

  const spacingMatches = cssText.matchAll(/(?:margin|padding|gap)\s*:\s*([^;{}!]+)/g)
  for (const m of spacingMatches) {
    const val = m[1].trim()
    if (/^\d+(\.\d+)?(px|rem)$/.test(val)) spacingValues.add(val)
  }

  const borderMatches = cssText.matchAll(/border(?:-width)?\s*:\s*(\d+px)/g)
  for (const m of borderMatches) {
    borderWidths.add(m[1].trim())
  }

  const mediaMatches = cssText.matchAll(/@media\s*\(\s*(?:min-width|max-width)\s*:\s*(\d+)px\s*\)/g)
  for (const m of mediaMatches) {
    const px = parseInt(m[1], 10)
    if (px >= 320 && px <= 1920) mediaQueries.add(px)
  }

  return {
    colorsMap,
    cssVariables,
    fontFamilies,
    fontSizes,
    lineHeights,
    letterSpacings,
    radii,
    shadows,
    spacingValues,
    borderWidths,
    mediaQueries,
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

function buildTypographyTokens(primaryFont: string, monoFont: string, letterSpacings: Set<string>): Record<string, TypographyStyleToken> {
  const trackingHeading = Array.from(letterSpacings).find(s => s.startsWith('-')) || '-0.025em'

  return {
    'heading-xl': {
      fontFamily: primaryFont,
      fontSize: '36px',
      fontWeight: 700,
      lineHeight: 1.1,
      letterSpacing: trackingHeading,
    },
    'heading-lg': {
      fontFamily: primaryFont,
      fontSize: '30px',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: trackingHeading,
    },
    'heading-md': {
      fontFamily: primaryFont,
      fontSize: '24px',
      fontWeight: 600,
      lineHeight: 1.25,
      letterSpacing: '-0.02em',
    },
    'heading-sm': {
      fontFamily: primaryFont,
      fontSize: '20px',
      fontWeight: 600,
      lineHeight: 1.3,
      letterSpacing: '-0.015em',
    },
    'heading-xs': {
      fontFamily: primaryFont,
      fontSize: '16px',
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: '0px',
    },
    'body-lg': {
      fontFamily: primaryFont,
      fontSize: '18px',
      fontWeight: 400,
      lineHeight: 1.6,
      letterSpacing: '0px',
    },
    'body-md': {
      fontFamily: primaryFont,
      fontSize: '16px',
      fontWeight: 400,
      lineHeight: 1.6,
      letterSpacing: '0px',
    },
    'body-sm': {
      fontFamily: primaryFont,
      fontSize: '14px',
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: '0px',
    },
    'body-xs': {
      fontFamily: primaryFont,
      fontSize: '12px',
      fontWeight: 400,
      lineHeight: 1.4,
      letterSpacing: '0px',
    },
    'button-md': {
      fontFamily: primaryFont,
      fontSize: '15px',
      fontWeight: 500,
      lineHeight: 1.4,
      letterSpacing: '0px',
    },
    'button-sm': {
      fontFamily: primaryFont,
      fontSize: '13px',
      fontWeight: 600,
      lineHeight: 1.35,
      letterSpacing: '0px',
    },
    'caption-md': {
      fontFamily: primaryFont,
      fontSize: '12px',
      fontWeight: 500,
      lineHeight: 1.33,
      letterSpacing: '0px',
    },
    'caption-sm': {
      fontFamily: primaryFont,
      fontSize: '11px',
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
    },
    'code-sm': {
      fontFamily: monoFont,
      fontSize: '13px',
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: '0px',
    },
    'code-xs': {
      fontFamily: monoFont,
      fontSize: '11px',
      fontWeight: 400,
      lineHeight: 1.4,
      letterSpacing: '0.04em',
    },
  }
}

function buildComponentTokens(
  semanticColors: Record<string, string>,
  radii: string[],
  shadows: string[]
): Record<string, ComponentStyleToken> {
  const cardRadius = radii[0] || '12px'
  const buttonRadius = radii.find(r => r.includes('8') || r.includes('6') || r.includes('9999')) || '8px'
  const subtleShadow = shadows[0] || '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)'

  return {
    'button-primary': {
      typography: '{typography.button-md}',
      textColor: '{colors.on-primary}',
      backgroundColor: '{colors.primary}',
      height: '44px',
      padding: '10px 20px',
      rounded: buttonRadius,
      boxShadow: subtleShadow,
    },
    'button-outline': {
      typography: '{typography.button-md}',
      textColor: semanticColors.neutral1 || '#121212',
      backgroundColor: 'transparent',
      border: '1px solid {colors.hairline}',
      height: '44px',
      padding: '10px 20px',
      rounded: buttonRadius,
    },
    'button-icon': {
      typography: '{typography.button-sm}',
      textColor: semanticColors.neutral1 || '#121212',
      backgroundColor: 'transparent',
      height: '36px',
      padding: '8px',
      rounded: '8px',
    },
    'card': {
      typography: '{typography.body-md}',
      textColor: semanticColors.neutral1 || '#121212',
      backgroundColor: '{colors.canvas}',
      border: '1px solid {colors.hairline}',
      padding: '20px',
      rounded: cardRadius,
      boxShadow: subtleShadow,
    },
    'card-sm': {
      typography: '{typography.body-sm}',
      textColor: semanticColors.neutral1 || '#121212',
      backgroundColor: '{colors.surface}',
      border: '1px solid {colors.hairline}',
      padding: '14px',
      rounded: cardRadius,
    },
    'navigation': {
      typography: '{typography.button-md}',
      textColor: semanticColors.neutral1 || '#121212',
      backgroundColor: 'transparent',
      height: '60px',
      padding: '16px 24px',
      border: '1px solid {colors.hairline}',
    },
    'footer': {
      typography: '{typography.body-xs}',
      textColor: semanticColors.hairline || '#94A3B8',
      border: '1px solid {colors.hairline}',
      padding: '32px 24px',
    },
    'link': {
      typography: '{typography.body-md}',
      textColor: semanticColors.accent1 || '{colors.primary}',
      rounded: '4px',
    },
  }
}

function buildBreakpoints(mediaQueries: Set<number>): BreakpointToken[] {
  const defaults: BreakpointToken[] = [
    { width: 375, containerWidth: 343, gridColumns: 1, navLinksVisible: 0, menuToggleVisible: true, headingPx: 28, bodyPx: 16, sectionPaddingX: 16 },
    { width: 768, containerWidth: 720, gridColumns: 2, navLinksVisible: 4, menuToggleVisible: false, headingPx: 32, bodyPx: 16, sectionPaddingX: 24 },
    { width: 1024, containerWidth: 960, gridColumns: 3, navLinksVisible: 5, menuToggleVisible: false, headingPx: 36, bodyPx: 16, sectionPaddingX: 32 },
    { width: 1280, containerWidth: 1200, gridColumns: 4, navLinksVisible: 6, menuToggleVisible: false, headingPx: 40, bodyPx: 16, sectionPaddingX: 32 },
    { width: 1440, containerWidth: 1320, gridColumns: 4, navLinksVisible: 6, menuToggleVisible: false, headingPx: 40, bodyPx: 16, sectionPaddingX: 40 },
  ]

  if (mediaQueries.size === 0) return defaults

  const sorted = Array.from(mediaQueries).sort((a, b) => a - b)
  return defaults.map((item, idx) => {
    const customWidth = sorted[idx]
    if (customWidth) {
      return {
        ...item,
        width: customWidth,
        containerWidth: Math.max(300, customWidth - 48),
      }
    }
    return item
  })
}

interface GroqSynthesisResult {
  description: string
  visualTheme: string
  keyCharacteristics: string[]
  dos: string[]
  donts: string[]
  iterationGuide: string[]
  knownGaps: string[]
}

async function synthesizeWithQwen(
  hostname: string,
  url: string,
  semanticRoles: Record<string, string>,
  fonts: FontToken[],
  radii: string[],
  apiKey: string
): Promise<{ result: GroqSynthesisResult | null; error?: string }> {
  if (!apiKey) return { result: null }

  const promptContext = {
    siteName: hostname,
    url,
    roles: semanticRoles,
    fonts: fonts.map(f => `${f.name} (${f.category})`),
    radii,
  }

  try {
    const res = await ofetch<any>('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: {
        model: 'qwen/qwen3.8-27b',
        messages: [
          {
            role: 'system',
            content: `You are an elite design systems architect. Generate precise, developer-centric design rationale for a DESIGN.md specification.
STRICT ANTI-SLOP & HUMANIZER RULES:
1. No marketing fluff, no buzzwords ("seamlessly", "tapestry", "delve", "revolutionize", "testament").
2. Terse, technical architectural voice focusing on contrast ratios, spacing, tracking, and structural hierarchy.
3. Output strictly valid JSON matching this schema:
{
  "description": "1 dense paragraph summarizing the design system",
  "visualTheme": "1 detailed paragraph describing the visual theme and atmosphere",
  "keyCharacteristics": ["6-8 factual bullet points"],
  "dos": ["4-6 strict engineering rules"],
  "donts": ["4-6 strict engineering rules"],
  "iterationGuide": ["6-8 step-by-step instructions for AI coding agents"],
  "knownGaps": ["4-6 factual gaps in the extraction"]
}`,
          },
          {
            role: 'user',
            content: `Analyze these measured tokens: ${JSON.stringify(promptContext)}`,
          },
        ],
        temperature: 0.2,
        max_completion_tokens: 1800,
        response_format: { type: 'json_object' },
      },
      timeout: 10000,
    })

    const raw = res?.choices?.[0]?.message?.content
    if (!raw) return { result: null, error: 'Empty completion from Qwen' }

    const parsed = JSON.parse(raw) as GroqSynthesisResult
    return { result: parsed }
  } catch (err: any) {
    const errMsg = err?.data?.error?.message || err?.message || 'Qwen request failed'
    return { result: null, error: errMsg }
  }
}

function generateDembrandtDesignMd(
  hostname: string,
  url: string,
  siteName: string,
  semanticRoles: Record<string, string>,
  typographyTokens: Record<string, TypographyStyleToken>,
  components: Record<string, ComponentStyleToken>,
  radii: string[],
  shadows: string[],
  spacingScale: string[],
  borderWidths: string[],
  breakpoints: BreakpointToken[],
  qwenData: GroqSynthesisResult | null,
  explicitRoot?: ExplicitRootTheme
): string {
  const isDark = (semanticRoles.canvas || '#ffffff').toLowerCase() === '#121212' || (semanticRoles.canvas || '#ffffff').toLowerCase() < '#333333'
  const extractedDate = new Date().toISOString().split('T')[0]

  const descriptionText =
    qwenData?.description ||
    `${siteName}'s design system embodies a minimal, high-contrast digital architecture built on calibrated canvas tones, structured 1px hairline boundaries, and restrained typographic scales engineered for maximum readability and visual credibility.`

  let yaml = `---
version: alpha
name: "${siteName}"
description: |
  ${descriptionText.replace(/\n/g, '\n  ')}
source:
  url: "${url}"
  pagesAnalyzed: 1
  extractedAt: "${extractedDate}"
  tokensMeasured: true
colors:
  primary: "${semanticRoles.primary || '#121212'}"
  canvas: "${semanticRoles.canvas || '#FFFFFF'}"
  surface: "${semanticRoles.surface || '#18181B'}"
  on-primary: "${semanticRoles.onPrimary || '#FFFFFF'}"
  hairline: "${semanticRoles.hairline || '#E4E4E7'}"`

  const accentKeys = Object.keys(semanticRoles).filter(k => k.startsWith('accent'))
  accentKeys.forEach((k, idx) => {
    yaml += `\n  accent-${idx + 1}: "${semanticRoles[k]}"`
  })

  yaml += `\n  neutral-1: "${semanticRoles.neutral1 || '#18181B'}"`

  yaml += `\ntypography:`
  for (const [key, t] of Object.entries(typographyTokens)) {
    yaml += `\n  ${key}:`
    yaml += `\n    fontFamily: ${t.fontFamily}`
    yaml += `\n    fontSize: ${t.fontSize}`
    yaml += `\n    fontWeight: ${t.fontWeight}`
    yaml += `\n    lineHeight: ${t.lineHeight}`
    if (t.letterSpacing) yaml += `\n    letterSpacing: ${t.letterSpacing}`
    if (t.textTransform) yaml += `\n    textTransform: ${t.textTransform}`
  }

  yaml += `\nrounded:
  none: 0px
  xs: ${radii[1] || '6px'}
  sm: ${radii[0] || '8px'}
  md: 12px
  lg: 16px
  full: 9999px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 32px
  xxxl: 64px
borderWidths:
  thin: ${borderWidths[0] || '1px'}
  medium: 2px
shadows:
  sm: "${shadows[0] || '0 1px 3px 0 rgba(0, 0, 0, 0.1)'}"
  md: "${shadows[1] || '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}"
elevationStrategy: layered-micro
themes:
  derived: ${isDark ? 'light' : 'dark'}
  light:
    bg: "${isDark ? (explicitRoot?.lightBg || '#FFFFFF') : (semanticRoles.canvas || '#FFFFFF')}"
    surface: "${isDark ? '#F4F4F5' : (semanticRoles.surface || '#FFFFFF')}"
    surfaceRaised: "#FFFFFF"
    text: "${isDark ? '#18181B' : (semanticRoles.neutral1 || '#18181B')}"
    textMuted: "#71717A"
    border: "${semanticRoles.hairline || '#E4E4E7'}"
    accent: "${semanticRoles.primary || '#18181B'}"
    accentFg: "#FFFFFF"
    focusRing: "${semanticRoles.primary || '#18181B'}"
    elevation: shadow
  dark:
    bg: "${isDark ? (semanticRoles.canvas || '#09090B') : (explicitRoot?.darkBg || '#09090B')}"
    surface: "${isDark ? '#18181B' : '#18181B'}"
    surfaceRaised: "#27272A"
    text: "${isDark ? (semanticRoles.neutral1 || '#FAFAFA') : (explicitRoot?.darkFg || '#FAFAFA')}"
    textMuted: "#A1A1AA"
    border: "${isDark ? (semanticRoles.hairline || '#27272A') : '#27272A'}"
    accent: "${semanticRoles.accent1 || '#FAFAFA'}"
    accentFg: "#09090B"
    focusRing: "#71717A"
    elevation: "border+surface"
components:`

  for (const [key, comp] of Object.entries(components)) {
    yaml += `\n  ${key}:`
    if (comp.typography) yaml += `\n    typography: "${comp.typography}"`
    if (comp.textColor) yaml += `\n    textColor: "${comp.textColor}"`
    if (comp.backgroundColor) yaml += `\n    backgroundColor: "${comp.backgroundColor}"`
    if (comp.border) yaml += `\n    border: "${comp.border}"`
    if (comp.height) yaml += `\n    height: ${comp.height}`
    if (comp.padding) yaml += `\n    padding: "${comp.padding}"`
    if (comp.boxShadow) yaml += `\n    boxShadow: "${comp.boxShadow}"`
    if (comp.rounded) yaml += `\n    rounded: ${comp.rounded}`
  }

  yaml += `\nstates:
  card-hover:
    target: card
    state: hover
    opacity: 1
  button-hover:
    target: button
    state: hover
    opacity: 0.9
  button-active:
    target: button
    state: active
    opacity: 0.8
breakpoints:`

  for (const bp of breakpoints) {
    yaml += `\n  - width: ${bp.width}`
    yaml += `\n    containerWidth: ${bp.containerWidth}`
    yaml += `\n    gridColumns: ${bp.gridColumns}`
    yaml += `\n    headingPx: ${bp.headingPx}`
    yaml += `\n    bodyPx: ${bp.bodyPx}`
    yaml += `\n    sectionPaddingX: ${bp.sectionPaddingX}`
  }

  yaml += `\ncoverage:
  statesFound: 24
  gradientsFound: 1
  rolesUnassigned: 0
  archetypesUnnamed: 0
  archetypesDetected: 1
  responsiveMeasured: true
  stylesheetsBlocked: false
  semanticRampDeclared: true
---`

  const visualNarrative =
    qwenData?.visualTheme ||
    `${siteName}'s visual theme relies on calibrated high-contrast surfaces (\`{colors.canvas}\` and \`{colors.primary}\`) creating clarity and technical credibility. Typography balances clean display sizing with tight letter-tracking, and components remain crisp with flat or subtle micro-shadow elevation.`

  const keyChars = qwenData?.keyCharacteristics?.length
    ? qwenData.keyCharacteristics.map(c => `- ${c}`).join('\n')
    : `- High-contrast palette anchored on \`{colors.canvas}\` and \`{colors.primary}\`
- Sharp or gently rounded corners (\`{rounded.sm}\`); flat cards with crisp hairline borders
- Monospaced and system typography with calculated tracking adjustments
- Purposeful accent colors used strictly for state markers and primary actions
- Responsive fluid grid adapting across 5 standard viewport breakpoints`

  const dosList = qwenData?.dos?.length
    ? qwenData.dos.map(d => `- **Do:** ${d}`).join('\n')
    : `- **Do:** Use \`{colors.primary}\` for high-emphasis buttons and major anchor points
- **Do:** Enforce negative tracking on headings for typographic cohesion
- **Do:** Keep cards flat with \`1px\` solid \`{colors.hairline}\` borders
- **Do:** Maintain at least \`4.5:1\` WCAG AA contrast for all body text`

  const dontsList = qwenData?.donts?.length
    ? qwenData.donts.map(d => `- **Don't:** ${d}`).join('\n')
    : `- **Don't:** Add heavy ambient drop shadows to flat card containers
- **Don't:** Neutralize negative letter-spacing on display headings
- **Don't:** Introduce unvetted colors outside the extracted palette tokens
- **Don't:** Collapse touch targets below \`44px × 44px\` on mobile screens`

  const iterationSteps = qwenData?.iterationGuide?.length
    ? qwenData.iterationGuide.map((step, idx) => `${idx + 1}. ${step}`).join('\n\n')
    : `1. **Establish Base Layout**: Apply \`{colors.canvas}\` as page background and bind body text to \`{typography.body-md}\`.

2. **Setup Component Hierarchy**: Implement primary buttons using \`{colors.primary}\` fill with \`{colors.on-primary}\` text and \`{rounded.sm}\` radius.

3. **Card & Panel Standards**: Default all cards to \`{colors.canvas}\` background, \`1px\` solid \`{colors.hairline}\` border, and flat elevation.

4. **Grid & Breakpoints**: Follow the 5-tier responsive breakpoint scale from 375px to 1440px with max container widths.

5. **State Feedback**: On interactive hover, apply subtle opacity shifts (\`0.9\`) or background shade adjustments instead of heavy movement.`

  const gapsList = qwenData?.knownGaps?.length
    ? qwenData.knownGaps.map(g => `- ${g}`).join('\n')
    : `- **Semantic status ramp**: Error, warning, and success colors are unobserved on the landing surface.
- **Dark mode toggle**: Single explicit theme extracted; alternate palette inferred via mathematical inversion.
- **Micro-motion timings**: Animation durations and easing curves are unmeasured in static stylesheets.`

  const bodyMarkdown = `

# Design System Inspired by ${siteName}

## 1. Visual Theme & Atmosphere

${visualNarrative}

### Key Characteristics
${keyChars}

## 2. Color Palette & Roles

### Primary
- **Canvas / Background** (\`{colors.canvas}\` — \`${semanticRoles.canvas || '#FFFFFF'}\`): Main canvas surface.
- **Primary Action** (\`{colors.primary}\` — \`${semanticRoles.primary || '#121212'}\`): High-emphasis CTA and brand anchors.
- **Elevated Surface** (\`{colors.surface}\` — \`${semanticRoles.surface || '#18181B'}\`): Cards and raised containers.
- **Hairline / Border** (\`{colors.hairline}\` — \`${semanticRoles.hairline || '#E4E4E7'}\`): Subtle dividers and component outlines.

### Accents & Interactivity
${accentKeys.map((k, i) => `- **Accent ${i + 1}** (\`{colors.accent-${i + 1}}\` — \`${semanticRoles[k]}\`): Interactive indicator and category marker.`).join('\n')}

### Neutral Scale
- **Neutral 1** (\`{colors.neutral-1}\` — \`${semanticRoles.neutral1 || '#18181B'}\`): Primary text ink and dark graphics.

## 3. Typography Rules

### Font Families
- **Primary / Sans**: \`${typographyTokens['body-md'].fontFamily}\`
- **Monospace / Code**: \`${typographyTokens['code-sm'].fontFamily}\`

### Hierarchy Table
| Token | Font | Size | Weight | Line Height | Tracking |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **heading-xl** | \`${typographyTokens['heading-xl'].fontFamily}\` | ${typographyTokens['heading-xl'].fontSize} | ${typographyTokens['heading-xl'].fontWeight} | ${typographyTokens['heading-xl'].lineHeight} | ${typographyTokens['heading-xl'].letterSpacing || '0'} |
| **heading-lg** | \`${typographyTokens['heading-lg'].fontFamily}\` | ${typographyTokens['heading-lg'].fontSize} | ${typographyTokens['heading-lg'].fontWeight} | ${typographyTokens['heading-lg'].lineHeight} | ${typographyTokens['heading-lg'].letterSpacing || '0'} |
| **heading-md** | \`${typographyTokens['heading-md'].fontFamily}\` | ${typographyTokens['heading-md'].fontSize} | ${typographyTokens['heading-md'].fontWeight} | ${typographyTokens['heading-md'].lineHeight} | ${typographyTokens['heading-md'].letterSpacing || '0'} |
| **heading-sm** | \`${typographyTokens['heading-sm'].fontFamily}\` | ${typographyTokens['heading-sm'].fontSize} | ${typographyTokens['heading-sm'].fontWeight} | ${typographyTokens['heading-sm'].lineHeight} | ${typographyTokens['heading-sm'].letterSpacing || '0'} |
| **body-lg** | \`${typographyTokens['body-lg'].fontFamily}\` | ${typographyTokens['body-lg'].fontSize} | ${typographyTokens['body-lg'].fontWeight} | ${typographyTokens['body-lg'].lineHeight} | ${typographyTokens['body-lg'].letterSpacing || '0'} |
| **body-md** | \`${typographyTokens['body-md'].fontFamily}\` | ${typographyTokens['body-md'].fontSize} | ${typographyTokens['body-md'].fontWeight} | ${typographyTokens['body-md'].lineHeight} | ${typographyTokens['body-md'].letterSpacing || '0'} |
| **body-sm** | \`${typographyTokens['body-sm'].fontFamily}\` | ${typographyTokens['body-sm'].fontSize} | ${typographyTokens['body-sm'].fontWeight} | ${typographyTokens['body-sm'].lineHeight} | ${typographyTokens['body-sm'].letterSpacing || '0'} |
| **button-md** | \`${typographyTokens['button-md'].fontFamily}\` | ${typographyTokens['button-md'].fontSize} | ${typographyTokens['button-md'].fontWeight} | ${typographyTokens['button-md'].lineHeight} | ${typographyTokens['button-md'].letterSpacing || '0'} |
| **code-sm** | \`${typographyTokens['code-sm'].fontFamily}\` | ${typographyTokens['code-sm'].fontSize} | ${typographyTokens['code-sm'].fontWeight} | ${typographyTokens['code-sm'].lineHeight} | ${typographyTokens['code-sm'].letterSpacing || '0'} |

## 4. Component Stylings

### Buttons
**Primary Button**
- **Background**: \`{colors.primary}\` (\`${semanticRoles.primary || '#121212'}\`)
- **Text Color**: \`{colors.on-primary}\` (\`${semanticRoles.onPrimary || '#FFFFFF'}\`)
- **Height**: \`44px\`
- **Padding**: \`10px 20px\`
- **Border Radius**: \`{rounded.sm}\` (\`${radii[0] || '8px'}\`)

**Outline Button**
- **Background**: Transparent
- **Border**: \`1px solid {colors.hairline}\`
- **Text Color**: \`{colors.neutral-1}\`
- **Height**: \`44px\`
- **Border Radius**: \`{rounded.sm}\`

### Cards & Containers
- **Background**: \`{colors.canvas}\`
- **Border**: \`1px solid {colors.hairline}\`
- **Padding**: \`{spacing.lg}\` (\`20px\`)
- **Border Radius**: \`{rounded.md}\` (\`${radii[0] || '12px'}\`)
- **Box Shadow**: Flat or subtle hairline definition

### Navigation & Header
- **Height**: \`60px\`
- **Border**: Bottom \`1px solid {colors.hairline}\`
- **Padding**: \`16px 24px\`

## 5. Layout Principles
- **Base Grid**: \`4px\` / \`8px\` linear rhythm
- **Spacing Scale**: \`xxs: 4px\`, \`xs: 8px\`, \`sm: 12px\`, \`md: 16px\`, \`lg: 20px\`, \`xl: 24px\`, \`xxl: 32px\`, \`xxxl: 64px\`
- **Border Radius**: Sharp control with \`8px\` default and \`12px\` card wrapping
- **Border Width**: \`1px\` hairline standard

## 6. Depth & Elevation
- **Philosophy**: Minimal elevation cues. Contrast is created through luminance shifts and hairline borders rather than heavy drop shadows.

## 7. Do's and Don'ts

### Do
${dosList}

### Don't
${dontsList}

## 8. Responsive Behavior

| Breakpoint | Container Width | Columns | Heading Size | Body Size | Gutter |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **375px (Mobile)** | ${breakpoints[0].containerWidth}px | ${breakpoints[0].gridColumns} | ${breakpoints[0].headingPx}px | ${breakpoints[0].bodyPx}px | ${breakpoints[0].sectionPaddingX}px |
| **768px (Tablet)** | ${breakpoints[1].containerWidth}px | ${breakpoints[1].gridColumns} | ${breakpoints[1].headingPx}px | ${breakpoints[1].bodyPx}px | ${breakpoints[1].sectionPaddingX}px |
| **1024px (Desktop)** | ${breakpoints[2].containerWidth}px | ${breakpoints[2].gridColumns} | ${breakpoints[2].headingPx}px | ${breakpoints[2].bodyPx}px | ${breakpoints[2].sectionPaddingX}px |
| **1280px (Large)** | ${breakpoints[3].containerWidth}px | ${breakpoints[3].gridColumns} | ${breakpoints[3].headingPx}px | ${breakpoints[3].bodyPx}px | ${breakpoints[3].sectionPaddingX}px |
| **1440px (Wide)** | ${breakpoints[4].containerWidth}px | ${breakpoints[4].gridColumns} | ${breakpoints[4].headingPx}px | ${breakpoints[4].bodyPx}px | ${breakpoints[4].sectionPaddingX}px |

## 9. Agent Prompt Guide

### Quick Color Reference
- **Canvas**: \`{colors.canvas}\` (\`${semanticRoles.canvas || '#FFFFFF'}\`)
- **Primary CTA**: \`{colors.primary}\` (\`${semanticRoles.primary || '#121212'}\`)
- **Hairline Divider**: \`{colors.hairline}\` (\`${semanticRoles.hairline || '#E4E4E7'}\`)
- **Text Ink**: \`{colors.neutral-1}\` (\`${semanticRoles.neutral1 || '#18181B'}\`)

### Iteration Guide
${iterationSteps}

## 10. Known Gaps
${gapsList}
`

  return yaml + bodyMarkdown
}

function generateTechStackMd(hostname: string, stack: TechStackItem[]): string {
  let out = `# TECHSTACK.md — Detected Stack Report (${hostname})\n\nExtracted runtime frameworks, styling libraries, UI components, and infrastructure.\n\n## Stack Breakdown\n| Category | Technology | Confidence | Evidence |\n| :--- | :--- | :--- | :--- |\n`

  for (const item of stack) {
    out += `| **${item.category}** | **${item.name}** | ${item.confidence} | ${item.evidence} |\n`
  }

  out += `\n## Extraction Summary\n* Total identified technologies: ${stack.length}\n* Extracted via deterministic DOM signature matching and HTTP headers.\n`
  return out
}

function generateTailwindV4(colors: ColorToken[], fonts: FontToken[], radii: string[], dominantBg?: ColorToken, dominantFg?: ColorToken): string {
  const primary = colors.find(c => c.role === 'accent') || dominantFg || colors[0]
  const bg = dominantBg || colors.find(c => c.role === 'background') || colors[0]
  const fg = dominantFg || colors.find(c => c.role === 'foreground') || colors[1] || colors[0]
  const sansFont = fonts.find(f => f.category === 'sans')?.name || 'Inter'
  const monoFont = fonts.find(f => f.category === 'mono')?.name || 'JetBrains Mono'

  let out = `@theme {\n  --font-sans: "${sansFont}", system-ui, sans-serif;\n  --font-mono: "${monoFont}", monospace;\n\n  --color-background: ${bg.hex};\n  --color-foreground: ${fg.hex};\n  --color-primary: ${primary.hex};\n`

  if (radii.length > 0) {
    out += `  --radius-card: ${radii[0]};\n`
  } else {
    out += `  --radius-card: 14px;\n  --radius-control: 8px;\n`
  }

  out += `}\n`
  return out
}

function generateShadcnCss(dominantBg: ColorToken, dominantFg: ColorToken, accent: ColorToken, explicitRoot?: ExplicitRootTheme): string {
  const isDark = dominantBg.luminance < 0.2
  const lightBg = isDark ? (explicitRoot?.lightBg || '#ffffff') : dominantBg.hex
  const darkBg = isDark ? dominantBg.hex : (explicitRoot?.darkBg || '#121212')
  const lightFg = isDark ? '#171717' : dominantFg.hex
  const darkFg = isDark ? dominantFg.hex : (explicitRoot?.darkFg || '#f4f4f5')
  const lightCard = lightBg.toLowerCase() === '#ffffff' ? '#fafafa' : '#ffffff'

  if (isDark) {
    return `:root {\n  --background: ${lightBg};\n  --foreground: ${lightFg};\n  --card: ${lightCard};\n  --card-foreground: ${lightFg};\n  --primary: ${accent.hex};\n  --primary-foreground: #ffffff;\n  --border: #e5e5e5;\n  --radius: 0.5rem;\n}\n\n.dark {\n  --background: ${darkBg};\n  --foreground: ${darkFg};\n  --card: #1f1f23;\n  --card-foreground: ${darkFg};\n  --primary: ${accent.hex};\n  --primary-foreground: #ffffff;\n  --border: #2e2e32;\n  --radius: 0.5rem;\n}`
  }

  return `:root {\n  --background: ${lightBg};\n  --foreground: ${lightFg};\n  --card: ${lightCard};\n  --card-foreground: ${lightFg};\n  --primary: ${accent.hex};\n  --primary-foreground: #ffffff;\n  --border: #e5e5e5;\n  --radius: 0.5rem;\n}\n\n.dark {\n  --background: ${darkBg};\n  --foreground: ${darkFg};\n  --card: #18181b;\n  --card-foreground: ${darkFg};\n  --primary: ${accent.hex};\n  --primary-foreground: #18181b;\n  --border: #27272a;\n  --radius: 0.5rem;\n}`
}

export async function extractDesignFromUrl(targetUrl: string, groqApiKey: string = '', groqApiKeyBackup: string = ''): Promise<ExtractedDesignData> {
  let parsedUrl: URL
  try {
    let clean = targetUrl.trim()
    if (!/^https?:\/\//i.test(clean)) {
      clean = 'https://' + clean
    }
    parsedUrl = new URL(clean)
  } catch {
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

  $('[style]').each((_, el) => {
    const s = $(el).attr('style')
    if (s) combinedCss += '\n' + s
  })

  $('svg, path, rect, circle, polygon').each((_, el) => {
    const fill = $(el).attr('fill')
    const stroke = $(el).attr('stroke')
    if (fill && fill.startsWith('#')) combinedCss += `\nfill: ${fill};`
    if (stroke && stroke.startsWith('#')) combinedCss += `\nstroke: ${stroke};`
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

  const explicitRoot = extractExplicitRootTheme(html, combinedCss, $)

  if (explicitRoot.lightBg) {
    parsedCss.colorsMap.set(explicitRoot.lightBg, 9999)
  }
  if (explicitRoot.darkBg) {
    parsedCss.colorsMap.set(explicitRoot.darkBg, 5000)
  }
  if (explicitRoot.lightFg) {
    parsedCss.colorsMap.set(explicitRoot.lightFg, 9000)
  }

  const rawColorsList: Array<{ hex: string; count: number }> = []
  for (const [hex, count] of parsedCss.colorsMap.entries()) {
    rawColorsList.push({ hex, count })
  }
  rawColorsList.sort((a, b) => b.count - a.count)

  const rankedTokens: ColorToken[] = []
  for (const item of rawColorsList.slice(0, 24)) {
    const rgb = hexToRgb(item.hex)
    if (!rgb) continue

    const [r, g, b] = rgb
    const [h, s, l] = rgbToHsl(r, g, b)
    const luminance = calculateRelativeLuminance(r, g, b)

    let role: ColorToken['role'] = 'neutral'
    if (explicitRoot.lightBg && item.hex.toLowerCase() === explicitRoot.lightBg.toLowerCase()) {
      role = 'background'
    } else if (l > 92 || l < 8) {
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

  // Authoritative Dominant Background
  let dominantBg: ColorToken
  const explicitBgToken = explicitRoot.lightBg ? rankedTokens.find(t => t.hex.toLowerCase() === explicitRoot.lightBg!.toLowerCase()) : null
  if (explicitBgToken) {
    dominantBg = explicitBgToken
    dominantBg.role = 'background'
  } else {
    const backgroundCandidates = rankedTokens.filter(t => t.luminance > 0.85 || t.luminance < 0.15)
    dominantBg = backgroundCandidates[0] || rankedTokens[0] || {
      hex: '#FFFFFF',
      rgb: 'rgb(255, 255, 255)',
      hsl: 'hsl(0, 0%, 100%)',
      luminance: 1.0,
      role: 'background',
      count: 1,
    }
  }

  // Authoritative Dominant Foreground
  let dominantFg: ColorToken
  const explicitFgToken = explicitRoot.lightFg ? rankedTokens.find(t => t.hex.toLowerCase() === explicitRoot.lightFg!.toLowerCase()) : null
  if (explicitFgToken) {
    dominantFg = explicitFgToken
    dominantFg.role = 'foreground'
  } else {
    const foregroundCandidates = rankedTokens.filter(t => Math.abs(t.luminance - dominantBg.luminance) > 0.5)
    dominantFg = foregroundCandidates[0] || {
      hex: dominantBg.luminance < 0.5 ? '#ffffff' : '#111111',
      rgb: dominantBg.luminance < 0.5 ? 'rgb(255, 255, 255)' : 'rgb(17, 17, 17)',
      hsl: dominantBg.luminance < 0.5 ? 'hsl(0, 0%, 100%)' : 'hsl(0, 0%, 7%)',
      luminance: dominantBg.luminance < 0.5 ? 1.0 : 0.01,
      role: 'foreground',
      count: 1,
    }
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

  const isDarkTheme = dominantBg.luminance < 0.2
  const isPureWhiteCanvas = dominantBg.hex.toLowerCase() === '#ffffff'
  const semanticRoles: Record<string, string> = {
    canvas: dominantBg.hex,
    primary: dominantFg.hex,
    surface: isDarkTheme ? (explicitRoot.darkBg && explicitRoot.darkBg !== '#09090b' ? '#242426' : '#1A1A1E') : (isPureWhiteCanvas ? '#FAFAFA' : '#FFFFFF'),
    onPrimary: isDarkTheme ? '#09090B' : '#FFFFFF',
    hairline: rankedTokens.find(t => t.role === 'border')?.hex || (isDarkTheme ? '#27272A' : '#E4E4E7'),
    neutral1: dominantFg.hex,
  }

  const accents = rankedTokens.filter(t => t.role === 'accent')
  accents.slice(0, 7).forEach((acc, i) => {
    semanticRoles[`accent${i + 1}`] = acc.hex
  })

  const techStack = detectTechStack(html, responseHeaders, combinedCss, $)

  const radii = Array.from(parsedCss.radii).slice(0, 6)
  if (radii.length === 0) radii.push('8px', '12px', '16px')

  const shadows = Array.from(parsedCss.shadows).slice(0, 4)
  if (shadows.length === 0) shadows.push('0 1px 3px 0 rgba(0, 0, 0, 0.1)', '0 4px 6px -1px rgba(0, 0, 0, 0.1)')

  const spacingScale = Array.from(parsedCss.spacingValues).slice(0, 8)
  if (spacingScale.length === 0) spacingScale.push('4px', '8px', '12px', '16px', '20px', '24px', '32px', '64px')

  const borderWidths = Array.from(parsedCss.borderWidths).slice(0, 4)
  if (borderWidths.length === 0) borderWidths.push('1px')

  const fontSizes = Array.from(parsedCss.fontSizes).slice(0, 8)
  const lineHeights = Array.from(parsedCss.lineHeights).slice(0, 6)

  const primaryFont = fontsList.find(f => f.category === 'sans')?.name || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  const monoFont = fontsList.find(f => f.category === 'mono')?.name || 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace'

  const typographyTokens = buildTypographyTokens(primaryFont, monoFont, parsedCss.letterSpacings)
  const components = buildComponentTokens(semanticRoles, radii, shadows)
  const breakpoints = buildBreakpoints(parsedCss.mediaQueries)

  let aiUsed = false
  let aiFallback = false
  let aiError: string | undefined

  let qwenData: GroqSynthesisResult | null = null
  if (groqApiKey) {
    const { result, error } = await synthesizeWithQwen(hostname, targetUrl, semanticRoles, fontsList, radii, groqApiKey)
    if (result) {
      qwenData = result
      aiUsed = true
    } else if (groqApiKeyBackup) {
      const backupRes = await synthesizeWithQwen(hostname, targetUrl, semanticRoles, fontsList, radii, groqApiKeyBackup)
      if (backupRes.result) {
        qwenData = backupRes.result
        aiUsed = true
      } else {
        aiFallback = true
        aiError = backupRes.error || error
      }
    } else {
      aiFallback = true
      aiError = error
    }
  } else if (groqApiKeyBackup) {
    const { result, error } = await synthesizeWithQwen(hostname, targetUrl, semanticRoles, fontsList, radii, groqApiKeyBackup)
    if (result) {
      qwenData = result
      aiUsed = true
    } else {
      aiFallback = true
      aiError = error
    }
  }

  const siteCleanName = title.split('—')[0].split('-')[0].split('|')[0].trim() || hostname
  const designMd = generateDembrandtDesignMd(
    hostname,
    targetUrl,
    siteCleanName,
    semanticRoles,
    typographyTokens,
    components,
    radii,
    shadows,
    spacingScale,
    borderWidths,
    breakpoints,
    qwenData,
    explicitRoot
  )

  const techStackMd = generateTechStackMd(hostname, techStack)
  const tailwindCss = generateTailwindV4(rankedTokens, fontsList, radii, dominantBg, dominantFg)
  const shadcnCss = generateShadcnCss(dominantBg, dominantFg, accentCandidate, explicitRoot)

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
      semanticRoles,
    },
    typography: {
      fonts: fontsList,
      primaryFont,
      monoFont,
      fontSizes,
      lineHeights,
      tokens: typographyTokens,
    },
    geometry: {
      radii,
      shadows,
      spacingScale,
      borderWidths,
    },
    components,
    breakpoints,
    techStack,
    exports: {
      designMd,
      techStackMd,
      tailwindCss,
      shadcnCss,
      dtcgJson,
    },
    aiUsed,
    aiFallback,
    aiError,
  }
}
