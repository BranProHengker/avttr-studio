/**
 * Security utilities for Avttr Studio
 * Provides SSRF protection, private IP validation, trusted host verification,
 * and in-memory sliding-window rate limiting.
 */

// Private IPv4 ranges as integer bitmasks
function ipToLong(ip: string): number | null {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return null
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

function inRange(ipNum: number, cidrIp: string, prefixBits: number): boolean {
  const cidrNum = ipToLong(cidrIp)
  if (cidrNum === null) return false
  const mask = prefixBits === 0 ? 0 : (~0 << (32 - prefixBits)) >>> 0
  return (ipNum & mask) === (cidrNum & mask)
}

/**
 * Check if a hostname or IP points to a private, loopback, or metadata address (SSRF prevention)
 */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim()

  // 1. Direct hostnames
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.lan')
  ) {
    return true
  }

  // 2. IPv6 Private / Link-Local
  if (host.startsWith('[') && host.endsWith(']')) {
    const rawIpv6 = host.slice(1, -1)
    if (
      rawIpv6 === '::1' ||
      rawIpv6 === '::' ||
      rawIpv6.startsWith('fc') ||
      rawIpv6.startsWith('fd') ||
      rawIpv6.startsWith('fe80')
    ) {
      return true
    }
  }

  // 3. IPv4 Checks
  const ipNum = ipToLong(host)
  if (ipNum !== null) {
    // 127.0.0.0/8 (Loopback)
    if (inRange(ipNum, '127.0.0.0', 8)) return true
    // 10.0.0.0/8 (Private)
    if (inRange(ipNum, '10.0.0.0', 8)) return true
    // 172.16.0.0/12 (Private)
    if (inRange(ipNum, '172.16.0.0', 12)) return true
    // 192.168.0.0/16 (Private)
    if (inRange(ipNum, '192.168.0.0', 16)) return true
    // 169.254.0.0/16 (Link-local / AWS / GCP metadata)
    if (inRange(ipNum, '169.254.0.0', 16)) return true
    // 100.64.0.0/10 (Carrier-Grade NAT)
    if (inRange(ipNum, '100.64.0.0', 10)) return true
    // 0.0.0.0/8 (Current network)
    if (inRange(ipNum, '0.0.0.0', 8)) return true
    // Test-Net ranges
    if (inRange(ipNum, '192.0.2.0', 24)) return true
    if (inRange(ipNum, '198.51.100.0', 24)) return true
    if (inRange(ipNum, '203.0.113.0', 24)) return true
  }

  return false
}

/**
 * Validate that a given URL is safe for server-side fetching/proxying
 */
export function validateSafeUrl(urlString: string): { valid: boolean; error?: string; url?: URL } {
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, error: 'Target URL is required' }
  }

  const trimmed = urlString.trim()
  if (trimmed.length > 4096) {
    return { valid: false, error: 'URL exceeds maximum allowed length' }
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { valid: false, error: 'Invalid URL structure' }
  }

  // Enforce HTTP / HTTPS protocol only
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: `Disallowed protocol '${parsed.protocol}'. Only http: and https: are allowed.` }
  }

  // Reject credentials embedded in URL (e.g. http://user:pass@host)
  if (parsed.username || parsed.password) {
    return { valid: false, error: 'URLs containing embedded credentials are not allowed' }
  }

  // Prevent SSRF to internal / cloud metadata hosts
  if (isPrivateHost(parsed.hostname)) {
    return { valid: false, error: 'Access to private, loopback, or cloud metadata network addresses is strictly forbidden' }
  }

  return { valid: true, url: parsed }
}

/**
 * List of verified official TeraBox and affiliate domains
 */
const TRUSTED_TERABOX_ROOT_DOMAINS = [
  'terabox.com',
  '1024tera.com',
  'terabox.app',
  'terabox.fun',
  'terasharelink.com',
  'teraboxlink.com',
  'freeterabox.com',
  'mirrobox.com',
  'nephobox.com',
  '4funbox.com',
  'tibibox.com',
  'baidupcs.com',
]

/**
 * Strict root-domain check to prevent sending private cookies to rogue domains (e.g. attacker-terabox.com)
 */
export function isTrustedTeraBoxHost(hostname: string): boolean {
  const cleanHost = hostname.toLowerCase().trim()
  return TRUSTED_TERABOX_ROOT_DOMAINS.some(
    (root) => cleanHost === root || cleanHost.endsWith(`.${root}`)
  )
}

/**
 * Simple in-memory sliding window rate limiter
 */
interface RateLimitBucket {
  tokens: number
  lastReset: number
}

const rateLimitStore = new Map<string, RateLimitBucket>()

// Periodically clean up stale rate limit records every 5 minutes
if (typeof setInterval !== 'undefined') {
  const cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of rateLimitStore.entries()) {
      if (now - bucket.lastReset > 5 * 60 * 1000) {
        rateLimitStore.delete(key)
      }
    }
  }, 5 * 60 * 1000)

  if (cleanupTimer && typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref()
  }
}

/**
 * Check if request from key is within rate limits
 * @param key Identifier (e.g. IP address + route)
 * @param maxRequests Maximum requests allowed per window
 * @param windowSeconds Window duration in seconds
 */
export function checkRateLimit(
  key: string,
  maxRequests = 60,
  windowSeconds = 60
): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const windowMs = windowSeconds * 1000

  let bucket = rateLimitStore.get(key)
  if (!bucket || now - bucket.lastReset >= windowMs) {
    bucket = { tokens: maxRequests - 1, lastReset: now }
    rateLimitStore.set(key, bucket)
    return { allowed: true, remaining: maxRequests - 1 }
  }

  if (bucket.tokens > 0) {
    bucket.tokens -= 1
    return { allowed: true, remaining: bucket.tokens }
  }

  return { allowed: false, remaining: 0 }
}
