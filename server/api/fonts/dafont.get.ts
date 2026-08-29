import { defineEventHandler, getQuery } from 'h3'
import * as cheerio from 'cheerio'

export interface DaFontItem {
  id: string
  name: string
  author: string
  license: string
  previewUrl: string
  downloadUrl: string
  source: 'dafont'
  category?: string
  totalDownloads?: string
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const searchQuery = (query.q as string || '').trim()
  const cat = (query.cat as string || '').trim()
  const customText = (query.text as string || '').trim()
  const page = (query.page as string || '1').trim()

  try {
    let url = ''
    const params = new URLSearchParams()
    
    if (customText) {
      params.set('text', customText)
    }
    if (page && page !== '1') {
      params.set('page', page)
    }

    if (cat) {
      url = `https://www.dafont.com/theme.php?cat=${cat}&${params.toString()}`
    } else if (searchQuery) {
      params.set('q', searchQuery)
      url = `https://www.dafont.com/search.php?${params.toString()}`
    } else {
      // Default to top / new popular fonts
      url = `https://www.dafont.com/new.php?${params.toString()}`
    }

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
    const fonts: DaFontItem[] = []

    // Parse each font card in DaFont
    $('div.preview, div.dfpreview').each((i, el) => {
      const style = $(el).attr('style') || ''
      const bgMatch = style.match(/url\(([^)]+)\)/i)
      let previewUrl = bgMatch ? bgMatch[1].replace(/['"]/g, '') : ''

      if (previewUrl.startsWith('//')) {
        previewUrl = `https:${previewUrl}`
      } else if (previewUrl && !previewUrl.startsWith('http')) {
        previewUrl = `https://www.dafont.com${previewUrl.startsWith('/') ? '' : '/'}${previewUrl}`
      }

      // Title & slug from link inside preview or surrounding elements
      const fontLink = $(el).find('a').first().attr('href') || ''
      const slugMatch = fontLink.match(/([a-zA-Z0-9_-]+)\.font/i)
      const slug = slugMatch ? slugMatch[1] : (previewUrl.match(/ttf=([a-zA-Z0-9_-]+)/)?.[1] || `font_${i}`)

      // Title from previous lv1left
      const prevHeader = $(el).prevAll('div.lv1left').first()
      const nextHeader = $(el).parent().find('div.lv1left').first()
      const titleEl = prevHeader.find('a').first().length ? prevHeader.find('a').first() : nextHeader.find('a').first()
      
      let title = titleEl.text().trim()
      if (!title) {
        title = slug.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
      }

      // Author from lv1left
      const authorEl = prevHeader.find("a[href*='author.php'], a[href*='.d']").first()
      const author = authorEl.text().trim() || 'DaFont Creator'

      // License from surrounding text
      const surroundingText = $(el).parent().text()
      const licenseMatch = surroundingText.match(/(Free for personal use|100% Free|Public domain|Donationware|Shareware|Demo)/i)
      const license = licenseMatch ? licenseMatch[0] : 'Free for personal use'

      // Download Link
      const dlLink = `https://dl.dafont.com/dl/?f=${slug}`

      if (slug && (previewUrl || title)) {
        fonts.push({
          id: slug,
          name: title,
          author,
          license,
          previewUrl: previewUrl || `https://img.dafont.com/preview.php?font=${slug}&size=50`,
          downloadUrl: dlLink,
          source: 'dafont',
        })
      }
    })

    return {
      success: true,
      query: searchQuery,
      category: cat,
      count: fonts.length,
      fonts,
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to fetch fonts from DaFont',
      fonts: [],
    }
  }
})
