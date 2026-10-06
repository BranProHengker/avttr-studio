export interface HopItem {
  step: number
  url: string
  domain: string
  status: number
  statusText: string
  type: string
  latencyMs: number
}

export interface BypassResult {
  success: boolean
  originalUrl: string
  finalUrl: string
  cleanedUrl: string
  removedParams: string[]
  hops: HopItem[]
  isSafe: boolean
  detectedService?: string
  warning?: string
  totalTimeMs: number
  error?: string
}

const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'igsh',
  'si',
  'feature',
  'ref',
  'ref_src',
  'ref_url',
  's',
  't',
  'mc_cid',
  'mc_eid',
  'yclid',
  '_hsenc',
  '_hsmi',
]

// SSRF prevention: reject private/local IP ranges and internal hostnames
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim()
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0'
  ) {
    return true
  }

  // IPv4 regex check for private subnets: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  const match = host.match(ipv4Regex)
  if (match) {
    const oct1 = parseInt(match[1], 10)
    const oct2 = parseInt(match[2], 10)

    if (oct1 === 10) return true
    if (oct1 === 127) return true
    if (oct1 === 169 && oct2 === 254) return true
    if (oct1 === 192 && oct2 === 168) return true
    if (oct1 === 172 && oct2 >= 16 && oct2 <= 31) return true
  }

  return false
}

// Clean tracking params and return cleaned URL + removed keys
export function stripTrackingParams(rawUrl: string): { cleanedUrl: string; removedParams: string[] } {
  try {
    const urlObj = new URL(rawUrl)
    const removedParams: string[] = []

    for (const param of TRACKING_PARAMS) {
      if (urlObj.searchParams.has(param)) {
        removedParams.push(param)
        urlObj.searchParams.delete(param)
      }
    }

    // Also strip generic tracking prefix params like _utm_*
    const allKeys = Array.from(urlObj.searchParams.keys())
    for (const key of allKeys) {
      if (key.startsWith('utm_') && !removedParams.includes(key)) {
        removedParams.push(key)
        urlObj.searchParams.delete(key)
      }
    }

    return {
      cleanedUrl: urlObj.toString(),
      removedParams,
    }
  } catch {
    return {
      cleanedUrl: rawUrl,
      removedParams: [],
    }
  }
}

// Instant decoding of Link Shims and Gateway URLs
export function decodeLinkShim(rawUrl: string): { decodedUrl: string; service: string } | null {
  try {
    const urlObj = new URL(rawUrl)
    const host = urlObj.hostname.toLowerCase()

    // 1. Google Search Redirect: google.com/url?q=... or ?url=...
    if (host.includes('google.') && urlObj.pathname.startsWith('/url')) {
      const q = urlObj.searchParams.get('q') || urlObj.searchParams.get('url')
      if (q && q.startsWith('http')) {
        return { decodedUrl: q, service: 'Google Redirect Shim' }
      }
    }

    // 2. Facebook Link Shim: l.facebook.com/l.php?u=... or lm.facebook.com
    if ((host === 'l.facebook.com' || host === 'lm.facebook.com') && urlObj.pathname.startsWith('/l.php')) {
      const u = urlObj.searchParams.get('u')
      if (u && u.startsWith('http')) {
        return { decodedUrl: u, service: 'Facebook Link Shim' }
      }
    }

    // 3. Instagram Redirect: l.instagram.com/?u=...
    if (host === 'l.instagram.com') {
      const u = urlObj.searchParams.get('u')
      if (u && u.startsWith('http')) {
        return { decodedUrl: u, service: 'Instagram Redirector' }
      }
    }

    // 4. YouTube Redirect: youtube.com/redirect?q=...
    if (host.includes('youtube.com') && urlObj.pathname.startsWith('/redirect')) {
      const q = urlObj.searchParams.get('q')
      if (q && q.startsWith('http')) {
        return { decodedUrl: q, service: 'YouTube Redirect Filter' }
      }
    }

    // 5. Steam Community Link Filter: steamcommunity.com/linkfilter/?url=...
    if (host === 'steamcommunity.com' && urlObj.pathname.startsWith('/linkfilter')) {
      const u = urlObj.searchParams.get('url')
      if (u && u.startsWith('http')) {
        return { decodedUrl: u, service: 'Steam Link Filter' }
      }
    }

    // 6. Generic Base64 parameter redirect (e.g., ?url=aHR0c..., ?target=..., ?dest=...)
    const candidateKeys = ['url', 'target', 'dest', 'destination', 'link', 'redirect', 'r']
    for (const key of candidateKeys) {
      const val = urlObj.searchParams.get(key)
      if (val && val.length > 12 && /^[A-Za-z0-9+/=]+$/.test(val)) {
        try {
          const decoded = Buffer.from(val, 'base64').toString('utf-8')
          if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
            return { decodedUrl: decoded, service: `Base64 Param (${key})` }
          }
        } catch {
          // not valid base64
        }
      }
    }

    return null
  } catch {
    return null
  }
}

// Resolver for Social Unlockers (Sub2Unlock, Boost.ink)
export async function resolveSocialUnlocker(rawUrl: string): Promise<string | null> {
  try {
    const urlObj = new URL(rawUrl)
    const host = urlObj.hostname.toLowerCase()

    if (host.includes('sub2unlock.') || host.includes('sub2get.')) {
      const res = await fetch(rawUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      })
      const html = await res.text()
      const linkMatch = html.match(/(?:var\s+targetUrl\s*=\s*['"](https?:\/\/[^'"]+)['"]|id="link"[^>]*href="([^"]+)"|data-url="([^"]+)")/i)
      if (linkMatch) {
        const found = linkMatch[1] || linkMatch[2] || linkMatch[3]
        if (found && found.startsWith('http')) return found
      }
    }

    if (host.includes('boost.ink')) {
      const res = await fetch(rawUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      })
      const html = await res.text()
      const boostMatch = html.match(/(?:target_url\s*:\s*['"](https?:\/\/[^'"]+)['"]|"target":"([^"]+)")/i)
      if (boostMatch) {
        const found = boostMatch[1] || boostMatch[2]
        if (found && found.startsWith('http')) return found
      }
    }

    return null
  } catch {
    return null
  }
}

// Decode AdFly's classic ysmm variable
export function decodeAdfly(ysmm: string): string | null {
  try {
    let left = ''
    let right = ''
    for (let i = 0; i < ysmm.length; i++) {
      if (i % 2 === 0) {
        left += ysmm.charAt(i)
      } else {
        right = ysmm.charAt(i) + right
      }
    }
    const combined = left + right
    const decoded = Buffer.from(combined, 'base64').toString('utf-8')
    const finalStr = decoded.slice(2)
    if (finalStr.startsWith('http://') || finalStr.startsWith('https://')) {
      return finalStr
    }
    return null
  } catch {
    return null
  }
}

// Main multi-hop tracer & bypass resolver
export async function traceAndBypassUrl(startUrl: string): Promise<BypassResult> {
  const startTime = Date.now()
  let currentUrl = startUrl.trim()

  if (!currentUrl.startsWith('http://') && !currentUrl.startsWith('https://')) {
    currentUrl = 'https://' + currentUrl
  }

  const hops: HopItem[] = []
  let detectedService: string | undefined
  const visited = new Set<string>()
  const maxHops = 10
  let step = 0

  while (step < maxHops) {
    step++
    let urlObj: URL
    try {
      urlObj = new URL(currentUrl)
    } catch {
      break
    }

    if (isPrivateHost(urlObj.hostname)) {
      return {
        success: false,
        originalUrl: startUrl,
        finalUrl: currentUrl,
        cleanedUrl: currentUrl,
        removedParams: [],
        hops,
        isSafe: false,
        totalTimeMs: Date.now() - startTime,
        error: 'Target URL resolves to a protected/private IP address (SSRF blocked).',
      }
    }

    // Check for Link Shim first (instant parameter decode)
    const shimResult = decodeLinkShim(currentUrl)
    if (shimResult && !visited.has(shimResult.decodedUrl)) {
      detectedService = shimResult.service
      hops.push({
        step,
        url: currentUrl,
        domain: urlObj.hostname,
        status: 200,
        statusText: 'Shim Decoded',
        type: `${shimResult.service} (Instant Extraction)`,
        latencyMs: 1,
      })
      visited.add(currentUrl)
      currentUrl = shimResult.decodedUrl
      continue
    }

    // Check for known social unlockers
    const unlockerTarget = await resolveSocialUnlocker(currentUrl)
    if (unlockerTarget && !visited.has(unlockerTarget)) {
      detectedService = 'Social Unlocker Bypass'
      hops.push({
        step,
        url: currentUrl,
        domain: urlObj.hostname,
        status: 200,
        statusText: 'Unlocked',
        type: 'Social Unlocker Extracted',
        latencyMs: 50,
      })
      visited.add(currentUrl)
      currentUrl = unlockerTarget
      continue
    }

    if (visited.has(currentUrl)) {
      break
    }
    visited.add(currentUrl)

    const hopStart = Date.now()
    let nextUrl: string | null = null
    let responseStatus = 0
    let responseStatusText = 'OK'
    let redirectType = 'Direct Endpoint'

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 7000)

      let res = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      })
      clearTimeout(timeoutId)

      if (res.status === 405 || res.status === 403) {
        const getController = new AbortController()
        const getTimeoutId = setTimeout(() => getController.abort(), 7000)
        res = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual',
          signal: getController.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
        })
        clearTimeout(getTimeoutId)
      }

      responseStatus = res.status
      responseStatusText = res.statusText || `${res.status}`
      const latencyMs = Date.now() - hopStart

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get('location')
        if (loc) {
          nextUrl = new URL(loc, currentUrl).toString()
          redirectType = `HTTP ${res.status} Redirect`
        }
      } else if (res.status === 200) {
        const contentType = res.headers.get('content-type') || ''
        if (contentType.includes('text/html')) {
          try {
            // HEAD responses do not contain bodies in HTTP. Fetch with GET to inspect HTML redirects.
            let html = ''
            try {
              const getRes = await fetch(currentUrl, {
                method: 'GET',
                redirect: 'manual',
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
              })
              html = await getRes.text()
            } catch {
              html = await res.text()
            }

            const metaMatch = html.match(/<meta[^>]*http-equiv=["']?refresh["']?[^>]*content=["']?\d+;\s*url=([^"'>\s]+)["']?/i)
            if (metaMatch && metaMatch[1]) {
              nextUrl = new URL(metaMatch[1], currentUrl).toString()
              redirectType = 'HTML Meta Refresh'
            }

            if (!nextUrl) {
              const jsMatch = html.match(/(?:window\.location(?:\.href)?|location\.replace)\s*=\s*['"](https?:\/\/[^'"]+)['"]/i)
              if (jsMatch && jsMatch[1]) {
                nextUrl = jsMatch[1]
                redirectType = 'JavaScript Location Redirect'
              }
            }

            if (!nextUrl && (urlObj.hostname.includes('adf.ly') || urlObj.hostname.includes('ay.gy'))) {
              const ysmmMatch = html.match(/var\s+ysmm\s*=\s*['"]([^'"]+)['"]/i)
              if (ysmmMatch && ysmmMatch[1]) {
                const decoded = decodeAdfly(ysmmMatch[1])
                if (decoded) {
                  nextUrl = decoded
                  redirectType = 'Adfly Decoded'
                  detectedService = 'Adfly Bypass'
                }
              }
            }

            // 4. Auto-submitting HTML form check (e.g. sfl.gl / Safelinku)
            if (!nextUrl && html.includes('.submit()')) {
              const formMatch = html.match(/<form[^>]*action=["']([^"']+)["'][^>]*method=["']?(GET|POST)?["']?[^>]*>([\s\S]*?)<\/form>/i)
              if (formMatch && formMatch[1]) {
                const actionUrl = formMatch[1]
                const method = (formMatch[2] || 'GET').toUpperCase()
                const formBody = formMatch[3]

                const params = new URLSearchParams()
                const inputRegex = /<input[^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["'][^>]*>/gi
                let m: RegExpExecArray | null
                while ((m = inputRegex.exec(formBody)) !== null) {
                  params.append(m[1], m[2])
                }

                try {
                  const resolvedAction = new URL(actionUrl, currentUrl)
                  if (method === 'GET') {
                    for (const [k, v] of params.entries()) {
                      resolvedAction.searchParams.set(k, v)
                    }
                  }
                  nextUrl = resolvedAction.toString()
                  redirectType = 'HTML Form Auto-Redirect'
                } catch {
                  // ignore
                }
              }
            }
          } catch {
            // ignore
          }
        }
      }

      hops.push({
        step,
        url: currentUrl,
        domain: urlObj.hostname,
        status: responseStatus,
        statusText: responseStatusText,
        type: redirectType,
        latencyMs,
      })

      if (nextUrl && nextUrl !== currentUrl) {
        currentUrl = nextUrl
      } else {
        break
      }
    } catch (err: any) {
      hops.push({
        step,
        url: currentUrl,
        domain: urlObj.hostname,
        status: 0,
        statusText: 'Fetch Error',
        type: err.message || 'Network Timeout',
        latencyMs: Date.now() - hopStart,
      })
      break
    }
  }

  const { cleanedUrl, removedParams } = stripTrackingParams(currentUrl)
  const isSuspicious = /\.(exe|scr|bat|vbs|apk)$/i.test(cleanedUrl)

  // Detect multi-step ad shorteners / paywalls in the hops chain
  let warning: string | undefined
  const hasAdShortener = hops.some((h) => {
    const d = h.domain.toLowerCase()
    return (
      d.includes('sfl.gl') ||
      d.includes('safelinku') ||
      d.includes('khaddavi.net') ||
      d.includes('semawur.com') ||
      d.includes('duit.cc') ||
      d.includes('linkvertise.com') ||
      d.includes('ouo.io') ||
      d.includes('ouo.press')
    )
  })

  if (hasAdShortener) {
    if (!detectedService) {
      const d = hops.map((h) => h.domain.toLowerCase()).join(' ')
      if (d.includes('sfl.gl') || d.includes('safelinku') || d.includes('khaddavi.net')) {
        detectedService = 'SafeLinkU (sfl.gl)'
      } else if (d.includes('semawur')) {
        detectedService = 'Semawur'
      } else if (d.includes('linkvertise')) {
        detectedService = 'Linkvertise'
      } else if (d.includes('ouo')) {
        detectedService = 'Ouo.io'
      } else {
        detectedService = 'Ad Shortener / Paywall'
      }
    }
    warning =
      'Tautan ini menggunakan sistem shortener iklan bertingkat yang dilindungi countdown timer dan Cloudflare CAPTCHA interaktif. URL unduhan akhir dikunci di database server dan hanya dirilis setelah pengguna menyelesaikan verifikasi langsung di browser.'
  }

  return {
    success: true,
    originalUrl: startUrl,
    finalUrl: currentUrl,
    cleanedUrl,
    removedParams,
    hops,
    isSafe: !isSuspicious,
    detectedService,
    warning,
    totalTimeMs: Date.now() - startTime,
  }
}
