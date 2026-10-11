export interface HeaderAnalysisItem {
  name: string
  key: string
  status: 'pass' | 'warn' | 'fail'
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  scoreContribution: number
  value?: string
  explanation: string
  risk: string
  recommendation: string
  snippets: {
    nginx: string
    cloudflare: string
    nuxt: string
    vercel: string
  }
}

export interface InfoLeakItem {
  header: string
  value: string
  severity: 'high' | 'medium' | 'low'
  description: string
  remedy: string
}

export interface SecurityAuditResult {
  success: boolean
  targetUrl: string
  finalUrl: string
  ip?: string
  httpVersion?: string
  responseTimeMs: number
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'
  score: number
  summary: {
    passed: number
    warnings: number
    failed: number
    totalHeaders: number
  }
  isHttps: boolean
  headersAnalyzed: HeaderAnalysisItem[]
  infoLeaks: InfoLeakItem[]
  rawHeaders: Record<string, string>
  error?: string
}

export function evaluateSecurityHeaders(
  rawHeaders: Record<string, string>,
  targetUrl: string,
  finalUrl: string,
  responseTimeMs: number,
  ip?: string
): SecurityAuditResult {
  const normalized: Record<string, string> = {}
  for (const [k, v] of Object.entries(rawHeaders)) {
    normalized[k.toLowerCase()] = v
  }

  const isHttps = finalUrl.toLowerCase().startsWith('https://')
  let score = 0
  const items: HeaderAnalysisItem[] = []
  const infoLeaks: InfoLeakItem[] = []

  // 1. Strict-Transport-Security (HSTS)
  const hstsVal = normalized['strict-transport-security']
  if (!isHttps) {
    items.push({
      name: 'Strict-Transport-Security (HSTS)',
      key: 'strict-transport-security',
      status: 'fail',
      severity: 'critical',
      scoreContribution: 0,
      explanation: 'Situs dibuka melalui protokol HTTP biasa tanpa proteksi enkripsi SSL/TLS.',
      risk: 'Lalu lintas data pengunjung bisa disadap atau diubah di jaringan Wi-Fi umum.',
      recommendation: 'Aktifkan sertifikat HTTPS dan pasang header HSTS.',
      snippets: {
        nginx: 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;',
        cloudflare: 'Nyalakan toggle "HSTS" pada menu SSL/TLS > Edge Certificates.',
        nuxt: "routeRules: { '/**': { headers: { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } } }",
        vercel: '{\n  "headers": [\n    { "source": "/(.*)", "headers": [{ "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" }] }\n  ]\n}',
      },
    })
  } else if (!hstsVal) {
    items.push({
      name: 'Strict-Transport-Security (HSTS)',
      key: 'strict-transport-security',
      status: 'fail',
      severity: 'high',
      scoreContribution: 0,
      explanation: 'Browser tidak diperintahkan untuk selalu mengunci koneksi ke HTTPS.',
      risk: 'Pengunjung di jaringan publik bisa terkena serangan downgrade SSL (koneksi dipaksa turun ke HTTP biasa).',
      recommendation: 'Tambahkan header HSTS dengan durasi minimal 6 bulan (max-age=15552000).',
      snippets: {
        nginx: 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;',
        cloudflare: 'Aktifkan opsi HSTS di menu SSL/TLS > Edge Certificates.',
        nuxt: "routeRules: { '/**': { headers: { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } } }",
        vercel: '{\n  "headers": [\n    { "source": "/(.*)", "headers": [{ "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" }] }\n  ]\n}',
      },
    })
  } else {
    const hasSubdomains = hstsVal.toLowerCase().includes('includesubdomains')
    const maxAgeMatch = hstsVal.match(/max-age=(\d+)/i)
    const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 0

    if (maxAge >= 10886400) {
      score += 25
      items.push({
        name: 'Strict-Transport-Security (HSTS)',
        key: 'strict-transport-security',
        status: 'pass',
        severity: 'pass' as any,
        scoreContribution: 25,
        value: hstsVal,
        explanation: 'Browser dipaksa selalu berkomunikasi lewat HTTPS.',
        risk: 'Koneksi terenkripsi penuh dari celah serangan downgrade.',
        recommendation: hasSubdomains ? 'Konfigurasi HSTS sudah optimal.' : 'Pertimbangkan menambah opsi includeSubDomains jika semua subdomain sudah HTTPS.',
        snippets: {
          nginx: 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;',
          cloudflare: 'Status HSTS sudah aktif di Cloudflare Edge.',
          nuxt: "routeRules: { '/**': { headers: { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } } }",
          vercel: '{\n  "headers": [\n    { "source": "/(.*)", "headers": [{ "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" }] }\n  ]\n}',
        },
      })
    } else {
      score += 15
      items.push({
        name: 'Strict-Transport-Security (HSTS)',
        key: 'strict-transport-security',
        status: 'warn',
        severity: 'medium',
        scoreContribution: 15,
        value: hstsVal,
        explanation: 'Header HSTS terpasang, tetapi durasi max-age masih di bawah 6 bulan.',
        risk: 'Browser hanya mengingat aturan ini dalam rentang waktu yang singkat.',
        recommendation: 'Naikkan nilai max-age ke minimal 31536000 (1 tahun).',
        snippets: {
          nginx: 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;',
          cloudflare: 'Naikkan Max-Age Header di menu SSL/TLS Cloudflare.',
          nuxt: "routeRules: { '/**': { headers: { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } } }",
          vercel: '{\n  "headers": [\n    { "source": "/(.*)", "headers": [{ "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" }] }\n  ]\n}',
        },
      })
    }
  }

  // 2. Content-Security-Policy (CSP)
  const cspVal = normalized['content-security-policy']
  if (!cspVal) {
    items.push({
      name: 'Content-Security-Policy (CSP)',
      key: 'content-security-policy',
      status: 'fail',
      severity: 'high',
      scoreContribution: 0,
      explanation: 'Tidak ada daftar izin sumber script, style, atau media yang dimuat.',
      risk: 'Jika ada celah input teks di web, script kiriman hacker bisa langsung jalan di browser pengunjung (serangan XSS).',
      recommendation: 'Buat aturan CSP minimal yang membatasi asal muat file eksternal.',
      snippets: {
        nginx: "add_header Content-Security-Policy \"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;\" always;",
        cloudflare: 'Tambahkan Response Header Modification di Rules > Transform Rules.',
        nuxt: "routeRules: { '/**': { headers: { 'Content-Security-Policy': \"default-src 'self'; img-src 'self' data: https:;\" } } }",
        vercel: '{\n  "headers": [\n    { "source": "/(.*)", "headers": [{ "key": "Content-Security-Policy", "value": "default-src \'self\';" }] }\n  ]\n}',
      },
    })
  } else {
    const hasUnsafeEval = cspVal.includes("'unsafe-eval'")
    const hasWildcard = cspVal.includes('*') && !cspVal.includes('https:*')
    if (hasUnsafeEval || hasWildcard) {
      score += 15
      items.push({
        name: 'Content-Security-Policy (CSP)',
        key: 'content-security-policy',
        status: 'warn',
        severity: 'medium',
        scoreContribution: 15,
        value: cspVal,
        explanation: "CSP aktif, tetapi mengizinkan aturan longgar seperti 'unsafe-eval' atau tanda bintang (*).",
        risk: 'Perlindungan terhadap injeksi script masih memiliki celah bypass.',
        recommendation: "Hindari 'unsafe-eval' dan sebutkan domain sumber script secara spesifik.",
        snippets: {
          nginx: "add_header Content-Security-Policy \"default-src 'self'; script-src 'self'; style-src 'self';\" always;",
          cloudflare: 'Perketat aturan CSP pada Transform Rules.',
          nuxt: "routeRules: { '/**': { headers: { 'Content-Security-Policy': \"default-src 'self';\" } } }",
          vercel: '{\n  "headers": [\n    { "source": "/(.*)", "headers": [{ "key": "Content-Security-Policy", "value": "default-src \'self\';" }] }\n  ]\n}',
        },
      })
    } else {
      score += 25
      items.push({
        name: 'Content-Security-Policy (CSP)',
        key: 'content-security-policy',
        status: 'pass',
        severity: 'pass' as any,
        scoreContribution: 25,
        value: cspVal,
        explanation: 'Aturan sumber konten dibatasi secara ketat.',
        risk: 'Browser otomatis menolak pemuatan script liar dari domain luar yang tidak terdaftar.',
        recommendation: 'Pertahankan aturan CSP dan pantau jika ada integrasi analitik baru.',
        snippets: {
          nginx: 'CSP sudah terpasang dengan baik.',
          cloudflare: 'CSP sudah terpasang dengan baik.',
          nuxt: 'CSP sudah terpasang dengan baik.',
          vercel: 'CSP sudah terpasang dengan baik.',
        },
      })
    }
  }

  // 3. X-Frame-Options (Clickjacking)
  const xfoVal = normalized['x-frame-options']
  if (!xfoVal) {
    items.push({
      name: 'X-Frame-Options',
      key: 'x-frame-options',
      status: 'fail',
      severity: 'high',
      scoreContribution: 0,
      explanation: 'Situs ini boleh dimuat ke dalam jendela iframe di website milik orang lain.',
      risk: 'Rentan serangan Clickjacking. Pelaku bisa menumpuk website Anda di bawah tombol jebakan mereka.',
      recommendation: 'Pasang nilai DENY atau SAMEORIGIN.',
      snippets: {
        nginx: 'add_header X-Frame-Options "SAMEORIGIN" always;',
        cloudflare: 'Tambahkan header X-Frame-Options: SAMEORIGIN pada Transform Rules.',
        nuxt: "routeRules: { '/**': { headers: { 'X-Frame-Options': 'SAMEORIGIN' } } }",
        vercel: '{\n  "headers": [\n    { "source": "/(.*)", "headers": [{ "key": "X-Frame-Options", "value": "SAMEORIGIN" }] }\n  ]\n}',
      },
    })
  } else {
    const upper = xfoVal.toUpperCase()
    if (upper === 'DENY' || upper === 'SAMEORIGIN') {
      score += 20
      items.push({
        name: 'X-Frame-Options',
        key: 'x-frame-options',
        status: 'pass',
        severity: 'pass' as any,
        scoreContribution: 20,
        value: xfoVal,
        explanation: `Situs membatasi penyematan iframe dengan mode ${upper}.`,
        risk: 'Situs terlindungi dari manipulasi klik dan jebakan antarmuka palsu.',
        recommendation: 'Konfigurasi sudah tepat.',
        snippets: {
          nginx: `add_header X-Frame-Options "${upper}" always;`,
          cloudflare: `Header aktif: X-Frame-Options: ${upper}`,
          nuxt: `routeRules: { '/**': { headers: { 'X-Frame-Options': '${upper}' } } }`,
          vercel: `X-Frame-Options sudah diset ke ${upper}`,
        },
      })
    } else {
      score += 10
      items.push({
        name: 'X-Frame-Options',
        key: 'x-frame-options',
        status: 'warn',
        severity: 'medium',
        scoreContribution: 10,
        value: xfoVal,
        explanation: 'Header terpasang tetapi nilainya kurang standar.',
        risk: 'Sebagian browser modern mungkin mengabaikan nilai di luar DENY atau SAMEORIGIN.',
        recommendation: 'Gunakan DENY jika situs tidak pernah di-iframe, atau SAMEORIGIN jika dipakai internal.',
        snippets: {
          nginx: 'add_header X-Frame-Options "SAMEORIGIN" always;',
          cloudflare: 'Set X-Frame-Options ke SAMEORIGIN.',
          nuxt: "routeRules: { '/**': { headers: { 'X-Frame-Options': 'SAMEORIGIN' } } }",
          vercel: '{\n  "headers": [{ "source": "/(.*)", "headers": [{ "key": "X-Frame-Options", "value": "SAMEORIGIN" }] }]\n}',
        },
      })
    }
  }

  // 4. X-Content-Type-Options
  const xctoVal = normalized['x-content-type-options']
  if (!xctoVal) {
    items.push({
      name: 'X-Content-Type-Options',
      key: 'x-content-type-options',
      status: 'fail',
      severity: 'medium',
      scoreContribution: 0,
      explanation: 'Browser diizinkan menebak jenis MIME file secara sepihak (MIME-sniffing).',
      risk: 'File teks atau gambar buatan pengguna yang disusupi script berbahaya bisa saja dieksekusi browser sebagai kode program.',
      recommendation: 'Pasang nilai "nosniff" untuk memaksa browser mematuhi tipe konten resmi.',
      snippets: {
        nginx: 'add_header X-Content-Type-Options "nosniff" always;',
        cloudflare: 'Tambahkan header X-Content-Type-Options: nosniff.',
        nuxt: "routeRules: { '/**': { headers: { 'X-Content-Type-Options': 'nosniff' } } }",
        vercel: '{\n  "headers": [\n    { "source": "/(.*)", "headers": [{ "key": "X-Content-Type-Options", "value": "nosniff" }] }\n  ]\n}',
      },
    })
  } else if (xctoVal.toLowerCase().includes('nosniff')) {
    score += 15
    items.push({
      name: 'X-Content-Type-Options',
      key: 'x-content-type-options',
      status: 'pass',
      severity: 'pass' as any,
      scoreContribution: 15,
      value: xctoVal,
      explanation: 'Browser dilarang menebak jenis file dan wajib mematuhi header Content-Type.',
      risk: 'Aman dari serangan MIME-confusion dan eksekusi file liar.',
      recommendation: 'Konfigurasi sudah benar.',
      snippets: {
        nginx: 'add_header X-Content-Type-Options "nosniff" always;',
        cloudflare: 'Sudah aktif.',
        nuxt: "routeRules: { '/**': { headers: { 'X-Content-Type-Options': 'nosniff' } } }",
        vercel: 'Sudah aktif.',
      },
    })
  } else {
    items.push({
      name: 'X-Content-Type-Options',
      key: 'x-content-type-options',
      status: 'warn',
      severity: 'low',
      scoreContribution: 5,
      value: xctoVal,
      explanation: 'Header ada, tetapi nilainya bukan nosniff.',
      risk: 'Browser mungkin tidak mengenali aturan pembatasan MIME.',
      recommendation: 'Ganti nilainya menjadi "nosniff".',
      snippets: {
        nginx: 'add_header X-Content-Type-Options "nosniff" always;',
        cloudflare: 'Set ke nosniff.',
        nuxt: "routeRules: { '/**': { headers: { 'X-Content-Type-Options': 'nosniff' } } }",
        vercel: 'Set ke nosniff.',
      },
    })
  }

  // 5. Referrer-Policy
  const refVal = normalized['referrer-policy']
  if (!refVal) {
    items.push({
      name: 'Referrer-Policy',
      key: 'referrer-policy',
      status: 'fail',
      severity: 'medium',
      scoreContribution: 0,
      explanation: 'Tidak ada batasan informasi URL yang dikirimkan saat pengguna mengeklik tautan keluar.',
      risk: 'Parameter sensitif pada URL (seperti token sesi atau ID akun) bisa bocor ke server pihak luar.',
      recommendation: 'Gunakan kebijakan modern seperti strict-origin-when-cross-origin.',
      snippets: {
        nginx: 'add_header Referrer-Policy "strict-origin-when-cross-origin" always;',
        cloudflare: 'Tambahkan header Referrer-Policy: strict-origin-when-cross-origin.',
        nuxt: "routeRules: { '/**': { headers: { 'Referrer-Policy': 'strict-origin-when-cross-origin' } } }",
        vercel: '{\n  "headers": [\n    { "source": "/(.*)", "headers": [{ "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }] }\n  ]\n}',
      },
    })
  } else {
    score += 10
    items.push({
      name: 'Referrer-Policy',
      key: 'referrer-policy',
      status: 'pass',
      severity: 'pass' as any,
      scoreContribution: 10,
      value: refVal,
      explanation: `Kebijakan pengiriman URL asal dibatasi dengan nilai: ${refVal}.`,
      risk: 'Informasi jalur URL terlindungi saat pengguna berpindah ke tautan luar.',
      recommendation: 'Kebijakan referrer sudah berjalan.',
      snippets: {
        nginx: `add_header Referrer-Policy "${refVal}" always;`,
        cloudflare: `Header aktif: Referrer-Policy: ${refVal}`,
        nuxt: `routeRules: { '/**': { headers: { 'Referrer-Policy': '${refVal}' } } }`,
        vercel: 'Sudah aktif.',
      },
    })
  }

  // 6. Permissions-Policy
  const permVal = normalized['permissions-policy'] || normalized['feature-policy']
  if (!permVal) {
    items.push({
      name: 'Permissions-Policy',
      key: 'permissions-policy',
      status: 'fail',
      severity: 'low',
      scoreContribution: 0,
      explanation: 'Tidak ada pembatasan fitur peramban (kamera, mikrofon, geolokasi, dsb).',
      risk: 'Script pihak ketiga (iklan atau widget) berpotensi memicu permintaan izin fitur sensitif ke pengguna.',
      recommendation: 'Tutup akses API peramban yang tidak dibutuhkan oleh website Anda.',
      snippets: {
        nginx: 'add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;',
        cloudflare: 'Tambahkan header Permissions-Policy: camera=(), microphone=(), geolocation=().',
        nuxt: "routeRules: { '/**': { headers: { 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' } } }",
        vercel: '{\n  "headers": [\n    { "source": "/(.*)", "headers": [{ "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }] }\n  ]\n}',
      },
    })
  } else {
    score += 5
    items.push({
      name: 'Permissions-Policy',
      key: 'permissions-policy',
      status: 'pass',
      severity: 'pass' as any,
      scoreContribution: 5,
      value: permVal,
      explanation: 'Akses ke hardware dan API peramban dibatasi secara eksplisit.',
      risk: 'Script pihak ketiga tidak bisa sembarangan meminta akses kamera atau sensor perangkat.',
      recommendation: 'Kebijakan izin sudah sesuai.',
      snippets: {
        nginx: `add_header Permissions-Policy "${permVal}" always;`,
        cloudflare: 'Permissions-Policy aktif.',
        nuxt: `routeRules: { '/**': { headers: { 'Permissions-Policy': '${permVal}' } } }`,
        vercel: 'Sudah aktif.',
      },
    })
  }

  // Check Information Disclosure / Fingerprinting
  const serverHeader = normalized['server']
  if (serverHeader) {
    const hasVersion = /\d+\.\d+/.test(serverHeader)
    if (hasVersion) {
      score = Math.max(0, score - 5)
      infoLeaks.push({
        header: 'Server',
        value: serverHeader,
        severity: 'medium',
        description: `Server membocorkan versi perangkat lunak (${serverHeader}).`,
        remedy: 'Sembunyikan nomor versi di Nginx (server_tokens off;) atau Apache (ServerTokens Prod).',
      })
    }
  }

  const poweredBy = normalized['x-powered-by']
  if (poweredBy) {
    score = Math.max(0, score - 5)
    infoLeaks.push({
      header: 'X-Powered-By',
      value: poweredBy,
      severity: 'medium',
      description: `Server mempublikasikan teknologi runtime yang digunakan (${poweredBy}).`,
      remedy: 'Hapus header ini (misal di PHP: expose_php = Off, atau di Express: app.disable("x-powered-by")).',
    })
  }

  const aspNetVer = normalized['x-aspnet-version'] || normalized['x-aspnetmvc-version']
  if (aspNetVer) {
    score = Math.max(0, score - 5)
    infoLeaks.push({
      header: 'X-AspNet-Version',
      value: aspNetVer,
      severity: 'medium',
      description: 'Membocorkan versi spesifik framework .NET yang dipakai.',
      remedy: 'Matikan enableVersionHeader pada konfigurasi web.config.',
    })
  }

  // Calculate Letter Grade
  let grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' = 'F'
  if (!isHttps) {
    grade = 'F'
  } else if (score >= 95) {
    grade = 'A+'
  } else if (score >= 80) {
    grade = 'A'
  } else if (score >= 65) {
    grade = 'B'
  } else if (score >= 45) {
    grade = 'C'
  } else if (score >= 25) {
    grade = 'D'
  } else {
    grade = 'F'
  }

  const passed = items.filter((i) => i.status === 'pass').length
  const warnings = items.filter((i) => i.status === 'warn').length
  const failed = items.filter((i) => i.status === 'fail').length

  return {
    success: true,
    targetUrl,
    finalUrl,
    ip,
    httpVersion: 'HTTP/1.1 or HTTP/2',
    responseTimeMs,
    grade,
    score,
    summary: {
      passed,
      warnings,
      failed,
      totalHeaders: items.length,
    },
    isHttps,
    headersAnalyzed: items,
    infoLeaks,
    rawHeaders,
  }
}
