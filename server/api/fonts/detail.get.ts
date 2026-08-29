import { defineEventHandler, getQuery } from 'h3'
import * as cheerio from 'cheerio'

export interface FontDetailResponse {
  success: boolean
  id: string
  name: string
  author?: string
  designer?: string
  authorNote?: string
  category?: string
  license?: string
  downloads?: string
  downloadUrl: string
  previewUrl?: string
  previewUrls?: string[]
  illustrations: string[]
  charmaps: string[]
  source: 'dafont' | 'google' | 'fontshare' | 'custom'
  weights?: number[]
  fontshareName?: string
}

export default defineEventHandler(async (event): Promise<FontDetailResponse | { success: false; error: string }> => {
  const query = getQuery(event)
  const slug = (query.slug as string || '').trim()
  const source = (query.source as string || 'dafont').trim()
  const customText = (query.text as string || '').trim()

  if (!slug) {
    return { success: false, error: 'Font slug is required' }
  }

  if (source === 'dafont') {
    try {
      const url = customText
        ? `https://www.dafont.com/${slug}.font?text=${encodeURIComponent(customText)}`
        : `https://www.dafont.com/${slug}.font`

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(8000),
      })

      if (!res.ok) {
        throw new Error(`DaFont HTTP ${res.status}`)
      }

      const html = await res.text()
      const $ = cheerio.load(html)

      // 1. Font Name
      const header = $('div.lv1left').first()
      let name = ''
      const titleLink = header.find("a[href*='.font']").first()
      if (titleLink.length) {
        name = titleLink.text().trim()
      }
      if (!name) {
        name = slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
      }

      // 2. Author
      const authorLink = header.find("a[href*='author.php'], a[href*='.d']").first()
      const author = authorLink.text().trim() || 'DaFont Designer'

      // 3. Category & License & Downloads
      const rightInfo = $('div.lv2right, div.lv1right').text().trim()
      const category = $('div.lv1right').text().replace(/\s+/g, ' ').trim()
      const licenseMatch = rightInfo.match(/(Free for personal use|100% Free|Public domain|Donationware|Shareware|Demo)/i)
      const license = licenseMatch ? licenseMatch[0] : 'Free for personal use'

      const downloadsMatch = rightInfo.match(/([0-9,]+)\s+downloads/i)
      const downloads = downloadsMatch ? downloadsMatch[1] : undefined

      // 4. Note of the author
      let authorNote = ''
      const noteHeading = $("b:contains('Note of the author')").first()
      if (noteHeading.length > 0) {
        const noteParent = noteHeading.parent().parent()
        authorNote = noteParent.next().text().trim()
      }

      // 5. Dynamic Preview Images rendered with custom text
      const previewUrls: string[] = []
      $('div.preview, div.dfpreview').each((i, el) => {
        const style = $(el).attr('style') || ''
        const bgMatch = style.match(/url\(([^)]+)\)/i)
        if (bgMatch) {
          let pUrl = bgMatch[1].replace(/['"]/g, '')
          if (pUrl.startsWith('//')) pUrl = `https:${pUrl}`
          else if (pUrl && !pUrl.startsWith('http')) pUrl = `https://www.dafont.com${pUrl.startsWith('/') ? '' : '/'}${pUrl}`
          if (!previewUrls.includes(pUrl)) {
            previewUrls.push(pUrl)
          }
        }
      })

      // 6. Illustration / Mockup Poster Images
      const illustrations: string[] = []
      $("img[src*='/illustration/'], img[src*='/preview/']").each((i, el) => {
        const src = $(el).attr('src')
        if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('out3.gif')) {
          const fullSrc = src.startsWith('//') ? `https:${src}` : src.startsWith('http') ? src : `https://www.dafont.com${src.startsWith('/') ? '' : '/'}${src}`
          if (!illustrations.includes(fullSrc)) {
            illustrations.push(fullSrc)
          }
        }
      })

      // 7. Character Map / Glyphs Matrix Images
      const charmaps: string[] = []
      $("img[src*='/charmap/'], img[src*='charmap.php']").each((i, el) => {
        const src = $(el).attr('src')
        if (src) {
          const fullSrc = src.startsWith('//') ? `https:${src}` : src.startsWith('http') ? src : `https://www.dafont.com${src.startsWith('/') ? '' : '/'}${src}`
          if (!charmaps.includes(fullSrc)) {
            charmaps.push(fullSrc)
          }
        }
      })

      // 8. Direct Download Link
      const dlSlug = slug.replace(/-/g, '_')
      const downloadUrl = `https://dl.dafont.com/dl/?f=${dlSlug}`

      return {
        success: true,
        id: slug,
        name,
        author,
        authorNote,
        category,
        license,
        downloads,
        downloadUrl,
        previewUrl: previewUrls[0] || `https://img.dafont.com/preview.php?font=${dlSlug}&size=50`,
        previewUrls,
        illustrations,
        charmaps,
        source: 'dafont',
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to fetch font detail from DaFont',
      }
    }
  }

  return {
    success: false,
    error: 'Unsupported font source',
  }
})
