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
  const pageNum = parseInt(page, 10) || 1

  try {
    let url = ''
    const params = new URLSearchParams()
    
    if (customText) {
      params.set('text', customText)
    }
    if (pageNum > 1) {
      params.set('page', pageNum.toString())
    }

    if (cat) {
      url = `https://www.dafont.com/theme.php?cat=${cat}&${params.toString()}`
    } else if (searchQuery) {
      params.set('q', searchQuery)
      url = `https://www.dafont.com/search.php?${params.toString()}`
    } else {
      // Default to popular / new fonts
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

    // Calculate maximum available pages
    let maxPage = pageNum
    $("a[href*='page=']").each((i, el) => {
      const href = $(el).attr('href') || ''
      const m = href.match(/page=(\d+)/)
      if (m) {
        const p = parseInt(m[1], 10)
        if (p > maxPage) maxPage = p
      }
    })

    // Parse all matching font preview cards
    $('div.preview').each((i, el) => {
      const slugHref = $(el).find("a[href*='.font']").attr('href') || ''
      if (!slugHref) return

      const slug = slugHref.replace(/\.font.*$/, '')
      const style = $(el).attr('style') || ''
      const bgMatch = style.match(/url\(([^)]+)\)/i)
      let previewUrl = bgMatch ? bgMatch[1].replace(/['"]/g, '') : ''

      if (previewUrl.startsWith('//')) {
        previewUrl = `https:${previewUrl}`
      } else if (previewUrl && !previewUrl.startsWith('http')) {
        previewUrl = `https://www.dafont.com${previewUrl.startsWith('/') ? '' : '/'}${previewUrl}`
      }

      // Extract header details (Title & Author)
      const header = $(el).prevAll('div.lv1left').first()
      const right = $(el).prevAll('div.lv2right, div.lv1right').first()

      let fontTitle = ''
      if (header.length > 0) {
        // Priority 1: Link pointing to .font
        const titleLink = header.find("a[href*='.font']").first()
        if (titleLink.length) {
          fontTitle = titleLink.text().trim()
        }

        // Priority 2: Extract text before ' by ' while removing accent indicators
        if (!fontTitle) {
          const headerHtml = header.html() || ''
          const beforeBy = headerHtml.split(/\s+by\s+/i)[0] || ''
          const cleanBeforeBy = cheerio.load(`<div>${beforeBy}</div>`)('div')
          cleanBeforeBy.find('span.contain, img').remove()
          fontTitle = cleanBeforeBy.text().replace(/€/g, '').trim()
        }
      }

      // Fallback clean title from slug if title is empty or single character
      if (!fontTitle || fontTitle === 'à' || fontTitle.length <= 1) {
        fontTitle = slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
      }

      const author = header.find("a[href*='author.php'], a[href*='.d']").first().text().trim() || 'DaFont Designer'
      const licenseMatch = right.text().match(/(Free for personal use|100% Free|Public domain|Donationware|Shareware|Demo)/i)
      const license = licenseMatch ? licenseMatch[0] : 'Free for personal use'

      const dlSlug = slug.replace(/-/g, '_')
      fonts.push({
        id: slug,
        name: fontTitle,
        author,
        license,
        previewUrl: previewUrl || `https://img.dafont.com/preview.php?font=${dlSlug}&size=50`,
        downloadUrl: `https://dl.dafont.com/dl/?f=${dlSlug}`,
        source: 'dafont',
      })
    })

    return {
      success: true,
      query: searchQuery,
      category: cat,
      page: pageNum,
      totalPages: Math.max(maxPage, 1),
      count: fonts.length,
      fonts,
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to fetch fonts from DaFont',
      page: 1,
      totalPages: 1,
      fonts: [],
    }
  }
})
