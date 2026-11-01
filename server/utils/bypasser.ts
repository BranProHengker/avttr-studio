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

// Resolver for Social Unlockers (Sub2Unlock, Boost.ink, Rekonise)
export interface SocialUnlockerResult {
  targetUrl: string
  serviceName: string
}

export async function resolveSocialUnlocker(rawUrl: string): Promise<SocialUnlockerResult | null> {
  try {
    const urlObj = new URL(rawUrl)
    const host = urlObj.hostname.toLowerCase()

    // 1. Sub2Unlock.com (Internal API Sinks + Next.js SSR Fallback)
    if (host.includes('sub2unlock.com')) {
      const slug = urlObj.pathname.replace(/^\/(link\/|p\/)?/, '').replace(/\/$/, '')
      if (slug) {
        try {
          const apiRes = await fetch(`https://api.sub2unlock.com/api/sinks/${slug}`, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              Accept: 'application/json, text/plain, */*',
              Referer: rawUrl,
            },
          })
          if (apiRes.ok) {
            const json: any = await apiRes.json()
            const link = json?.data?.unlocked_link
            if (link && typeof link === 'string') {
              const cleaned = link.replace(/\\\//g, '/')
              if (cleaned.startsWith('http')) {
                return { targetUrl: cleaned, serviceName: 'Sub2Unlock.com (API)' }
              }
            }
          }
        } catch {
          // ignore API error, try SSR next
        }
      }

      // Next.js SSR HTML fallback
      try {
        const pageRes = await fetch(rawUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        })
        const html = await pageRes.text()
        const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
        if (nextMatch && nextMatch[1]) {
          const nextJson = JSON.parse(nextMatch[1])
          const pageProps = nextJson?.props?.pageProps
          const unlocked = pageProps?.sink?.unlocked_link || pageProps?.unlocked_link
          if (unlocked && typeof unlocked === 'string' && unlocked.startsWith('http')) {
            return { targetUrl: unlocked.replace(/\\\//g, '/'), serviceName: 'Sub2Unlock.com (Next.js Data)' }
          }
        }
      } catch {
        // ignore
      }
    }

    // 2. Sub2Unlock.id (JSON in Textarea with Base64 Params)
    if (host.includes('sub2unlock.id')) {
      try {
        const pageRes = await fetch(rawUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        })
        const html = await pageRes.text()
        const textareaMatch = html.match(/<textarea[^>]*name=["']link["'][^>]*>([\s\S]*?)<\/textarea>/i)
        if (textareaMatch && textareaMatch[1]) {
          const data = JSON.parse(textareaMatch[1])
          if (data?.original) {
            const params = new URLSearchParams(data.original)
            for (const [key, value] of params.entries()) {
              if (key.startsWith('lnk')) {
                const decoded = decodeURIComponent(Buffer.from(value, 'base64').toString('utf-8'))
                if (decoded && decoded.startsWith('http')) {
                  return { targetUrl: decoded, serviceName: 'Sub2Unlock.id' }
                }
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // 3. Sub2Unlock.io / Sub4Unlock.io / Sub2Unlock.net / Sub2Unlock.top / Subtounlock
    if (
      host.includes('sub2unlock.') ||
      host.includes('sub4unlock.') ||
      host.includes('subtounlock.') ||
      host.includes('sub2get.')
    ) {
      try {
        const pageRes = await fetch(rawUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        })
        const html = await pageRes.text()

        // Match a.get-link or a#updateHiddenUnlocks or data-url attributes
        const linkMatch =
          html.match(/<a[^>]*class=["'][^"']*get-link[^"']*["'][^>]*href=["']([^"']+)["']/i) ||
          html.match(/<a[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*get-link/i) ||
          html.match(/<a[^>]*id=["']updateHiddenUnlocks["'][^>]*href=["']([^"']+)["']/i) ||
          html.match(/(?:var\s+targetUrl\s*=\s*['"](https?:\/\/[^'"]+)['"]|id="link"[^>]*href="([^"]+)"|data-url="([^"]+)")/i)

        if (linkMatch) {
          const found = linkMatch[1] || linkMatch[2] || linkMatch[3]
          if (found && found.startsWith('http')) {
            return { targetUrl: found, serviceName: 'Sub2Unlock / Sub4Unlock' }
          }
        }
      } catch {
        // ignore
      }
    }

    // 4. Boost.ink and variants (bst.gg, bst.wtf, booo.st)
    if (host.includes('boost.ink') || host.includes('bst.gg') || host.includes('bst.wtf') || host.includes('booo.st')) {
      try {
        const res = await fetch(rawUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        })
        const html = await res.text()

        // Modern Boost.ink stores target base64 in custom script attribute bufpsvdhmjybvgfncqfa
        const modernMatch = html.match(/<script[^>]*bufpsvdhmjybvgfncqfa=["']([A-Za-z0-9+/=]+)["']/i)
        if (modernMatch && modernMatch[1]) {
          try {
            const decoded = Buffer.from(modernMatch[1], 'base64').toString('utf-8')
            if (decoded && decoded.startsWith('http')) {
              return { targetUrl: decoded, serviceName: 'Boost.ink' }
            }
          } catch {
            // ignore
          }
        }

        // Legacy Boost.ink regex fallback
        const boostMatch = html.match(/(?:target_url\s*:\s*['"](https?:\/\/[^'"]+)['"]|"target":"([^"]+)")/i)
        if (boostMatch) {
          const found = boostMatch[1] || boostMatch[2]
          if (found && found.startsWith('http')) {
            return { targetUrl: found, serviceName: 'Boost.ink' }
          }
        }
      } catch {
        // ignore
      }
    }

    // 5. Rekonise.com (Official API bypass)
    if (host.includes('rekonise.com')) {
      const slug = urlObj.pathname.replace(/^\/|\/$/g, '')
      if (slug) {
        try {
          const getRes = await fetch(`https://api.rekonise.com/social-unlocks/${slug}/`, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              Accept: 'application/json',
            },
          })
          if (getRes.ok) {
            const data: any = await getRes.json()
            const token = data?.unlock_token
            if (token) {
              const unlockRes = await fetch(
                `https://api.rekonise.com/social-unlocks/${slug}/unlock?token=${token}`,
                {
                  headers: {
                    'User-Agent':
                      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    Accept: 'application/json',
                  },
                }
              )
              if (unlockRes.ok) {
                const unlockData: any = await unlockRes.json()
                if (unlockData?.url && typeof unlockData.url === 'string' && unlockData.url.startsWith('http')) {
                  return { targetUrl: unlockData.url, serviceName: 'Rekonise' }
                }
              }
            }
          }
        } catch {
          // ignore
        }
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
  let hasCloudflare = false
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
    const unlockerResult = await resolveSocialUnlocker(currentUrl)
    if (unlockerResult && !visited.has(unlockerResult.targetUrl)) {
      detectedService = unlockerResult.serviceName
      hops.push({
        step,
        url: currentUrl,
        domain: urlObj.hostname,
        status: 200,
        statusText: 'Unlocked',
        type: `${unlockerResult.serviceName} (Extracted)`,
        latencyMs: 50,
      })
      visited.add(currentUrl)
      currentUrl = unlockerResult.targetUrl
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

      const srvHeader = (res.headers.get('server') || '').toLowerCase()
      const cfMitigated = res.headers.get('cf-mitigated')
      if (cfMitigated === 'challenge' || ((res.status === 403 || res.status === 503) && srvHeader.includes('cloudflare'))) {
        hasCloudflare = true
        redirectType = 'Cloudflare WAF (Anti-Bot Challenge)'
        responseStatusText = 'Protected (Cloudflare)'
      }

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = res.headers.get('location')
        if (loc) {
          nextUrl = new URL(loc, currentUrl).toString()
          redirectType = `HTTP ${res.status} Redirect`
        }
      } else if (res.status === 200 || res.status === 403 || res.status === 503) {
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

            if (
              html.includes('cf-browser-verification') ||
              html.includes('challenge-platform') ||
              html.includes('Just a moment...') ||
              html.includes('Checking your browser before accessing')
            ) {
              hasCloudflare = true
              redirectType = 'Cloudflare Turnstile Challenge'
              responseStatusText = 'Protected (Turnstile)'
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
  } else if (hasCloudflare) {
    if (!detectedService) {
      detectedService = 'Cloudflare WAF / Turnstile'
    }
    warning =
      'Tautan ini dilindungi Cloudflare Bot Management / Turnstile CAPTCHA. Server cloud kami tidak dapat mengeksekusi verifikasi interaktif JavaScript. Buka tautan langsung di browser Anda untuk melanjutkan.'
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
