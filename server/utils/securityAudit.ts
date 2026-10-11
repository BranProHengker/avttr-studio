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
  ip?: string,
  lang: 'en' | 'id' = 'en'
): SecurityAuditResult {
  const isId = lang === 'id'
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
      explanation: isId
        ? 'Situs dibuka melalui protokol HTTP biasa tanpa proteksi enkripsi SSL/TLS.'
        : 'The site was loaded over unencrypted HTTP.',
      risk: isId
        ? 'Lalu lintas data pengunjung bisa disadap atau diubah di jaringan Wi-Fi umum.'
        : 'Traffic can be intercepted or modified by third parties on the same network.',
      recommendation: isId
        ? 'Aktifkan sertifikat HTTPS dan pasang header HSTS.'
        : 'Enable an SSL/TLS certificate and configure the HSTS header.',
      snippets: {
        nginx: 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;',
        cloudflare: isId
          ? 'Nyalakan toggle "HSTS" pada menu SSL/TLS > Edge Certificates.'
          : 'Turn on "HSTS" under SSL/TLS > Edge Certificates.',
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
      explanation: isId
        ? 'Browser tidak diperintahkan untuk selalu mengunci koneksi ke HTTPS.'
        : 'The browser is not instructed to always enforce HTTPS connections.',
      risk: isId
        ? 'Pengunjung di jaringan publik bisa terkena serangan downgrade SSL (koneksi dipaksa turun ke HTTP biasa).'
        : 'Users on public Wi-Fi networks can be targeted with SSL downgrade attacks.',
      recommendation: isId
        ? 'Tambahkan header HSTS dengan durasi minimal 6 bulan (max-age=15552000).'
        : 'Add an HSTS header with a duration of at least 6 months (max-age=15552000).',
      snippets: {
        nginx: 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;',
        cloudflare: isId
          ? 'Aktifkan opsi HSTS di menu SSL/TLS > Edge Certificates.'
          : 'Turn on "HSTS" under SSL/TLS > Edge Certificates.',
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
        explanation: isId
          ? 'Browser dipaksa selalu berkomunikasi lewat HTTPS.'
          : 'Browsers are forced to communicate strictly over encrypted HTTPS.',
        risk: isId
          ? 'Koneksi terenkripsi penuh dari celah serangan downgrade.'
          : 'Connections are protected against protocol downgrade attacks.',
        recommendation: hasSubdomains
          ? isId ? 'Konfigurasi HSTS sudah optimal.' : 'HSTS configuration is optimal.'
          : isId
          ? 'Pertimbangkan menambah opsi includeSubDomains jika semua subdomain sudah HTTPS.'
          : 'Consider adding includeSubDomains if all subdomains use HTTPS.',
        snippets: {
          nginx: 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;',
          cloudflare: isId ? 'Status HSTS sudah aktif di Cloudflare Edge.' : 'HSTS is active on Cloudflare Edge.',
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
        explanation: isId
          ? 'Header HSTS terpasang, tetapi durasi max-age masih di bawah 6 bulan.'
          : 'The HSTS header is present, but max-age is set to less than 6 months.',
        risk: isId
          ? 'Browser hanya mengingat aturan ini dalam rentang waktu yang singkat.'
          : 'Browsers only remember the HTTPS enforcement rule for a short period.',
        recommendation: isId
          ? 'Naikkan nilai max-age ke minimal 31536000 (1 tahun).'
          : 'Increase max-age to at least 31536000 (1 year).',
        snippets: {
          nginx: 'add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;',
          cloudflare: isId ? 'Naikkan Max-Age Header di menu SSL/TLS Cloudflare.' : 'Increase Max-Age Header under Cloudflare SSL/TLS.',
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
      explanation: isId
        ? 'Tidak ada daftar izin sumber script, style, atau media yang dimuat.'
        : 'No Content Security Policy is defined to restrict trusted asset sources.',
      risk: isId
        ? 'Jika ada celah input teks di web, script kiriman hacker bisa langsung jalan di browser pengunjung (serangan XSS).'
        : 'If an injection flaw exists, malicious scripts can execute directly in user browsers (XSS attacks).',
      recommendation: isId
        ? 'Buat aturan CSP minimal yang membatasi asal muat file eksternal.'
        : 'Define a baseline CSP to restrict where scripts and resources can load from.',
      snippets: {
        nginx: "add_header Content-Security-Policy \"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;\" always;",
        cloudflare: isId
          ? 'Tambahkan Response Header Modification di Rules > Transform Rules.'
          : 'Add Response Header Modification in Rules > Transform Rules.',
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
        explanation: isId
          ? "CSP aktif, tetapi mengizinkan aturan longgar seperti 'unsafe-eval' atau tanda bintang (*)."
          : "CSP is active, but permits loose directives like 'unsafe-eval' or wildcards (*).",
        risk: isId
          ? 'Perlindungan terhadap injeksi script masih memiliki celah bypass.'
          : 'Script injection defenses contain potential bypass paths.',
        recommendation: isId
          ? "Hindari 'unsafe-eval' dan sebutkan domain sumber script secara spesifik."
          : "Avoid 'unsafe-eval' and specify allowed script domains explicitly.",
        snippets: {
          nginx: "add_header Content-Security-Policy \"default-src 'self'; script-src 'self'; style-src 'self';\" always;",
          cloudflare: isId ? 'Perketat aturan CSP pada Transform Rules.' : 'Tighten CSP rules in Transform Rules.',
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
        explanation: isId
          ? 'Aturan sumber konten dibatasi secara ketat.'
          : 'Content sources are strictly restricted.',
        risk: isId
          ? 'Browser otomatis menolak pemuatan script liar dari domain luar yang tidak terdaftar.'
          : 'Browsers automatically reject unapproved external scripts.',
        recommendation: isId
          ? 'Pertahankan aturan CSP dan pantau jika ada integrasi analitik baru.'
          : 'Maintain this policy and review it when adding new analytics or third-party tools.',
        snippets: {
          nginx: isId ? 'CSP sudah terpasang dengan baik.' : 'CSP is properly configured.',
          cloudflare: isId ? 'CSP sudah terpasang dengan baik.' : 'CSP is properly configured.',
          nuxt: isId ? 'CSP sudah terpasang dengan baik.' : 'CSP is properly configured.',
          vercel: isId ? 'CSP sudah terpasang dengan baik.' : 'CSP is properly configured.',
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
      explanation: isId
        ? 'Situs ini boleh dimuat ke dalam jendela iframe di website milik orang lain.'
        : 'This site allows other websites to embed it within an iframe.',
      risk: isId
        ? 'Rentan serangan Clickjacking. Pelaku bisa menumpuk website Anda di bawah tombol jebakan mereka.'
        : 'Vulnerable to Clickjacking. Attackers can overlay your site beneath deceptive clickable elements.',
      recommendation: isId
        ? 'Pasang nilai DENY atau SAMEORIGIN.'
        : 'Set the header to DENY or SAMEORIGIN.',
      snippets: {
        nginx: 'add_header X-Frame-Options "SAMEORIGIN" always;',
        cloudflare: isId
          ? 'Tambahkan header X-Frame-Options: SAMEORIGIN pada Transform Rules.'
          : 'Add header X-Frame-Options: SAMEORIGIN in Transform Rules.',
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
        explanation: isId
          ? `Situs membatasi penyematan iframe dengan mode ${upper}.`
          : `The site restricts framing with ${upper} mode.`,
        risk: isId
          ? 'Situs terlindungi dari manipulasi klik dan jebakan antarmuka palsu.'
          : 'Protected against deceptive click overlays and framing attacks.',
        recommendation: isId ? 'Konfigurasi sudah tepat.' : 'The framing restriction is configured properly.',
        snippets: {
          nginx: `add_header X-Frame-Options "${upper}" always;`,
          cloudflare: `Header: X-Frame-Options: ${upper}`,
          nuxt: `routeRules: { '/**': { headers: { 'X-Frame-Options': '${upper}' } } }`,
          vercel: `X-Frame-Options: ${upper}`,
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
        explanation: isId
          ? 'Header terpasang tetapi nilainya kurang standar.'
          : 'The header is present, but uses a non-standard value.',
        risk: isId
          ? 'Sebagian browser modern mungkin mengabaikan nilai di luar DENY atau SAMEORIGIN.'
          : 'Some modern browsers may ignore values other than DENY or SAMEORIGIN.',
        recommendation: isId
          ? 'Gunakan DENY jika situs tidak pernah di-iframe, atau SAMEORIGIN jika dipakai internal.'
          : 'Use DENY if the site is never framed, or SAMEORIGIN for internal embedding.',
        snippets: {
          nginx: 'add_header X-Frame-Options "SAMEORIGIN" always;',
          cloudflare: isId ? 'Set X-Frame-Options ke SAMEORIGIN.' : 'Set X-Frame-Options to SAMEORIGIN.',
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
      explanation: isId
        ? 'Browser diizinkan menebak jenis MIME file secara sepihak (MIME-sniffing).'
        : 'Browsers are allowed to guess file MIME types (MIME-sniffing).',
      risk: isId
        ? 'File teks atau gambar buatan pengguna yang disusupi script berbahaya bisa saja dieksekusi browser sebagai kode program.'
        : 'User-uploaded files containing disguised scripts could execute as executable code.',
      recommendation: isId
        ? 'Pasang nilai "nosniff" untuk memaksa browser mematuhi tipe konten resmi.'
        : 'Set the value to "nosniff" to require strict MIME compliance.',
      snippets: {
        nginx: 'add_header X-Content-Type-Options "nosniff" always;',
        cloudflare: isId ? 'Tambahkan header X-Content-Type-Options: nosniff.' : 'Add header X-Content-Type-Options: nosniff.',
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
      explanation: isId
        ? 'Browser dilarang menebak jenis file dan wajib mematuhi header Content-Type.'
        : 'Browsers are prevented from guessing file types and must honor Content-Type.',
      risk: isId
        ? 'Aman dari serangan MIME-confusion dan eksekusi file liar.'
        : 'Protected against MIME-confusion attacks.',
      recommendation: isId ? 'Konfigurasi sudah benar.' : 'Configured properly.',
      snippets: {
        nginx: 'add_header X-Content-Type-Options "nosniff" always;',
        cloudflare: isId ? 'Sudah aktif.' : 'Already active.',
        nuxt: "routeRules: { '/**': { headers: { 'X-Content-Type-Options': 'nosniff' } } }",
        vercel: isId ? 'Sudah aktif.' : 'Already active.',
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
      explanation: isId
        ? 'Header ada, tetapi nilainya bukan nosniff.'
        : 'The header is present, but value is not nosniff.',
      risk: isId
        ? 'Browser mungkin tidak mengenali aturan pembatasan MIME.'
        : 'Browsers may not recognize non-standard MIME restrictions.',
      recommendation: isId
        ? 'Ganti nilainya menjadi "nosniff".'
        : 'Change the value to "nosniff".',
      snippets: {
        nginx: 'add_header X-Content-Type-Options "nosniff" always;',
        cloudflare: isId ? 'Set ke nosniff.' : 'Set to nosniff.',
        nuxt: "routeRules: { '/**': { headers: { 'X-Content-Type-Options': 'nosniff' } } }",
        vercel: isId ? 'Set ke nosniff.' : 'Set to nosniff.',
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
      explanation: isId
        ? 'Tidak ada batasan informasi URL yang dikirimkan saat pengguna mengeklik tautan keluar.'
        : 'No policy restricts URL information sent when users click outbound links.',
      risk: isId
        ? 'Parameter sensitif pada URL (seperti token sesi atau ID akun) bisa bocor ke server pihak luar.'
        : 'Sensitive query parameters (such as tokens or user IDs) could leak to third-party servers.',
      recommendation: isId
        ? 'Gunakan kebijakan modern seperti strict-origin-when-cross-origin.'
        : 'Use a modern policy such as strict-origin-when-cross-origin.',
      snippets: {
        nginx: 'add_header Referrer-Policy "strict-origin-when-cross-origin" always;',
        cloudflare: isId
          ? 'Tambahkan header Referrer-Policy: strict-origin-when-cross-origin.'
          : 'Add header Referrer-Policy: strict-origin-when-cross-origin.',
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
      explanation: isId
        ? `Kebijakan pengiriman URL asal dibatasi dengan nilai: ${refVal}.`
        : `Outbound referrer data is restricted using: ${refVal}.`,
      risk: isId
        ? 'Informasi jalur URL terlindungi saat pengguna berpindah ke tautan luar.'
        : 'Path and query parameters are protected during navigation.',
      recommendation: isId ? 'Kebijakan referrer sudah berjalan.' : 'Referrer policy is active.',
      snippets: {
        nginx: `add_header Referrer-Policy "${refVal}" always;`,
        cloudflare: `Header: Referrer-Policy: ${refVal}`,
        nuxt: `routeRules: { '/**': { headers: { 'Referrer-Policy': '${refVal}' } } }`,
        vercel: isId ? 'Sudah aktif.' : 'Already active.',
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
      explanation: isId
        ? 'Tidak ada pembatasan fitur peramban (kamera, mikrofon, geolokasi, dsb).'
        : 'No policy restricts browser hardware APIs (camera, microphone, geolocation).',
      risk: isId
        ? 'Script pihak ketiga (iklan atau widget) berpotensi memicu permintaan izin fitur sensitif ke pengguna.'
        : 'Third-party scripts or embedded widgets can prompt visitors for sensitive device permissions.',
      recommendation: isId
        ? 'Tutup akses API peramban yang tidak dibutuhkan oleh website Anda.'
        : 'Disable browser APIs that your application does not require.',
      snippets: {
        nginx: 'add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;',
        cloudflare: isId
          ? 'Tambahkan header Permissions-Policy: camera=(), microphone=(), geolocation=().'
          : 'Add header Permissions-Policy: camera=(), microphone=(), geolocation=().',
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
      explanation: isId
        ? 'Akses ke hardware dan API peramban dibatasi secara eksplisit.'
        : 'Access to hardware and browser APIs is explicitly restricted.',
      risk: isId
        ? 'Script pihak ketiga tidak bisa sembarangan meminta akses kamera atau sensor perangkat.'
        : 'Third-party scripts cannot access device sensors without explicit permission.',
      recommendation: isId ? 'Kebijakan izin sudah sesuai.' : 'Permissions policy is active.',
      snippets: {
        nginx: `add_header Permissions-Policy "${permVal}" always;`,
        cloudflare: isId ? 'Permissions-Policy aktif.' : 'Permissions-Policy active.',
        nuxt: `routeRules: { '/**': { headers: { 'Permissions-Policy': '${permVal}' } } }`,
        vercel: isId ? 'Sudah aktif.' : 'Already active.',
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
        description: isId
          ? `Server membocorkan versi perangkat lunak (${serverHeader}).`
          : `Server discloses software version (${serverHeader}).`,
        remedy: isId
          ? 'Sembunyikan nomor versi di Nginx (server_tokens off;) atau Apache (ServerTokens Prod).'
          : 'Hide the version number in Nginx (server_tokens off;) or Apache (ServerTokens Prod).',
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
      description: isId
        ? `Server mempublikasikan teknologi runtime yang digunakan (${poweredBy}).`
        : `Server advertises runtime technology (${poweredBy}).`,
      remedy: isId
        ? 'Hapus header ini (misal di PHP: expose_php = Off, atau di Express: app.disable("x-powered-by")).'
        : 'Remove this header (e.g. in PHP: expose_php = Off, in Express: app.disable("x-powered-by")).',
    })
  }

  const aspNetVer = normalized['x-aspnet-version'] || normalized['x-aspnetmvc-version']
  if (aspNetVer) {
    score = Math.max(0, score - 5)
    infoLeaks.push({
      header: 'X-AspNet-Version',
      value: aspNetVer,
      severity: 'medium',
      description: isId
        ? 'Membocorkan versi spesifik framework .NET yang dipakai.'
        : 'Discloses specific .NET framework version in use.',
      remedy: isId
        ? 'Matikan enableVersionHeader pada konfigurasi web.config.'
        : 'Disable enableVersionHeader in web.config.',
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
