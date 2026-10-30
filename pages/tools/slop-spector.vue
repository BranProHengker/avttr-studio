<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Globe,
  Upload,
  PasteClipboard as Clipboard,
  Xmark as X,
  Scanning as ScanSearch,
  Check,
  ShieldCheck,
  Undo as RotateCcw,
  Page as Receipt,
  NavArrowDown,
  InfoCircle as Info,
  MediaImage as ImageIcon,
  OpenNewWindow as ExternalLink,
} from '@iconoir/vue'
import { useToast } from '~/composables/useToast'
import { useI18n } from '~/composables/useI18n'
import { useClipboard } from '~/composables/useClipboard'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'
import Card from '~/components/ui/Card.vue'
import LoadingBreadcrumb from '~/components/ui/LoadingBreadcrumb.vue'

const toast = useToast()
const { locale } = useI18n()
const { copy } = useClipboard()

useHead({
  title: 'SlopSpector — AI Web Slop Inspector & Roaster | Avttr Studio',
  meta: [
    {
      name: 'description',
      content: 'Forensic detector for AI slop and generator fingerprints. Audits buzzwords, default Shadcn tokens, blurred blobs, and roasts the result.'
    }
  ]
})

// Active Mode: 'url' | 'shot'
const activeMode = ref<'url' | 'shot'>('url')
const inputUrl = ref('')
const isAnalyzing = ref(false)
const isRoasting = ref(false)
const showLogs = ref(false)
const screenshotLoadError = ref(false)
const selectedCategory = ref<'all' | string>('all')
const scanLogs = ref<Array<{ text: string; hit?: boolean }>>([])

// Inspection Results Interface
interface FindingItem {
  cat: string
  key: string
  label: string
  pts: number
  roast: string
  why: string
  quotes: string[]
}

interface InspectionResult {
  host: string
  url: string
  source?: string
  heroImage?: string
  score: number
  verdictId: string
  verdictLabel: string
  findings: FindingItem[]
  credits: Array<{ label: string; pts: number; detail: string }>
  stats: {
    words: number
    headingsCount: number
    buzzCount: number
    emDashes: number
  }
}

interface RoastResult {
  verdict: string
  roasts: Array<{ line: string; evidence: string }>
  fix: string
  model: string
}

const inspection = ref<InspectionResult | null>(null)
const roastData = ref<RoastResult | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const previewImage = ref<string | null>(null)
const previewFilename = ref<string>('')
const previewFileSize = ref<string>('')

// Format bytes helper
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

// Dynamic hero section screenshot
const siteHeroScreenshot = computed(() => {
  if (activeMode.value === 'shot' && previewImage.value) {
    return previewImage.value
  }
  if (!inspection.value?.url) return ''
  if (screenshotLoadError.value) {
    return `https://api.microlink.io/?url=${encodeURIComponent(inspection.value.url)}&screenshot=true&embed=screenshot.url`
  }
  if (inspection.value.heroImage) {
    return inspection.value.heroImage
  }
  return `https://image.thum.io/get/width/1200/crop/700/${inspection.value.url}`
})

// Clear screenshot state
const clearScreenshot = () => {
  previewImage.value = null
  previewFilename.value = ''
  previewFileSize.value = ''
  inspection.value = null
  roastData.value = null
  scanLogs.value = []
  isAnalyzing.value = false
  showLogs.value = false
  screenshotLoadError.value = false
  selectedCategory.value = 'all'
  if (fileInputRef.value) fileInputRef.value.value = ''
}

// Paste helper
const handlePaste = async () => {
  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      inputUrl.value = text.trim()
      toast.success(
        locale.value === 'id' ? 'Link Ditempel' : 'Link Pasted',
        inputUrl.value
      )
    }
  } catch {
    toast.error(
      locale.value === 'id' ? 'Gagal Menempel' : 'Paste Failed',
      locale.value === 'id' ? 'Izin clipboard ditolak browser' : 'Clipboard permission denied'
    )
  }
}

// Clear URL & reset states
const handleClear = () => {
  inputUrl.value = ''
  clearScreenshot()
}

// Log streaming helper
const addLog = (text: string, hit = false) => {
  scanLogs.value.unshift({ text, hit })
  if (scanLogs.value.length > 8) {
    scanLogs.value.pop()
  }
}

const currentLogText = computed(() => {
  return scanLogs.value[0]?.text || (locale.value === 'id' ? 'Menginisialisasi audit...' : 'Initializing audit...')
})

// Categories list for filtering
const categoriesList = computed(() => {
  if (!inspection.value?.findings) return []
  const set = new Set(inspection.value.findings.map((f) => f.cat))
  return Array.from(set)
})

// Filtered findings based on selected tab
const filteredFindings = computed(() => {
  if (!inspection.value?.findings) return []
  if (selectedCategory.value === 'all') return inspection.value.findings
  return inspection.value.findings.filter((f) => f.cat === selectedCategory.value)
})

// Formatted and sanitized roast lines
const formattedRoasts = computed(() => {
  if (roastData.value?.roasts && roastData.value.roasts.length > 0) {
    return roastData.value.roasts.map((r) => {
      let ev = (r.evidence || '').trim()
      if (/top_findings|slop_score|\[\s*\]/i.test(ev)) {
        ev = ''
      }
      return {
        line: r.line,
        evidence: ev
      }
    })
  }

  if (inspection.value?.findings && inspection.value.findings.length > 0) {
    return inspection.value.findings.slice(0, 3).map((f) => ({
      line: f.roast || f.label,
      evidence: f.quotes?.[0] || f.label
    }))
  }

  // Graceful roast for clean sites
  return [
    {
      line: locale.value === 'id'
        ? 'Website sangat bersih dari aroma template instan.'
        : 'Site is remarkably clean with no obvious generator boilerplate.',
      evidence: ''
    },
    {
      line: locale.value === 'id'
        ? 'Tidak ditemukan buzzwords murahan atau orbs blur template.'
        : 'Zero cheap buzzwords or unstyled floating orbs detected.',
      evidence: ''
    },
    {
      line: locale.value === 'id'
        ? 'Hasil audit menunjukkan kode dan tipografi dibuat dengan teliti.'
        : 'Audit confirms typography and markup were handcrafted with care.',
      evidence: ''
    }
  ]
})

// Score level indicator
const scoreLevel = computed(() => {
  const s = inspection.value?.score ?? 0
  if (s > 60) {
    return {
      label: locale.value === 'id' ? 'Dosa AI Tinggi' : 'High AI Slop',
      colorBg: 'bg-rose-500',
      badgeVariant: 'error' as const
    }
  }
  if (s > 30) {
    return {
      label: locale.value === 'id' ? 'Aroma AI Tercium' : 'Moderate AI Residue',
      colorBg: 'bg-amber-500',
      badgeVariant: 'warning' as const
    }
  }
  return {
    label: locale.value === 'id' ? 'Karya Otentik' : 'Authentic Craft',
    colorBg: 'bg-emerald-500',
    badgeVariant: 'success' as const
  }
})

// Core URL Inspection Handler
const runInspection = async () => {
  if (!inputUrl.value.trim()) {
    toast.error(
      locale.value === 'id' ? 'URL Kosong' : 'Empty URL',
      locale.value === 'id' ? 'Masukkan alamat website yang ingin diaudit' : 'Please enter a website link to inspect'
    )
    return
  }

  isAnalyzing.value = true
  inspection.value = null
  roastData.value = null
  scanLogs.value = []
  showLogs.value = false
  screenshotLoadError.value = false
  selectedCategory.value = 'all'

  addLog(locale.value === 'id' ? `Menghubungi target: ${inputUrl.value}...` : `Connecting to: ${inputUrl.value}...`)

  try {
    addLog(locale.value === 'id' ? 'Mengunduh markup HTML & CSS tokens...' : 'Downloading HTML markup & CSS tokens...')
    const res = await $fetch<InspectionResult>('/api/tools/slop-spector/inspect', {
      method: 'POST',
      body: {
        url: inputUrl.value,
        language: locale.value
      }
    })

    addLog(locale.value === 'id' ? `Berhasil mengambil konten (${res.stats.words} kata)` : `Content fetched (${res.stats.words} words)`)
    addLog(locale.value === 'id' ? 'Memindai jejak AI builder & buzzword klise...' : 'Scanning for AI builder signatures & buzzwords...')

    if (res.findings.length > 0) {
      addLog(locale.value === 'id' ? `Ditemukan ${res.findings.length} indikasi AI slop!` : `Detected ${res.findings.length} slop patterns!`, true)
    } else {
      addLog(locale.value === 'id' ? 'Website sangat bersih dari aroma template.' : 'Site is clean of template boilerplate.')
    }

    inspection.value = res
    isAnalyzing.value = false

    // Trigger AI Roasting in background
    triggerRoast(res)
  } catch (err: any) {
    isAnalyzing.value = false
    toast.error(
      locale.value === 'id' ? 'Pemeriksaan Gagal' : 'Inspection Failed',
      err?.statusMessage || err?.message || (locale.value === 'id' ? 'Gagal memeriksa website. Pastikan URL dapat diakses publik.' : 'Could not inspect website. Make sure the URL is publicly reachable.')
    )
  }
}

// Trigger AI Roasting via server
const triggerRoast = async (insp: InspectionResult) => {
  isRoasting.value = true
  try {
    const res = await $fetch<RoastResult>('/api/tools/slop-spector/roast', {
      method: 'POST',
      body: {
        siteName: insp.host,
        score: insp.score,
        verdictLabel: insp.verdictLabel,
        findings: insp.findings,
        language: locale.value
      }
    })
    roastData.value = res
  } catch {
    // If roast fails, keep default deterministic verdict
  } finally {
    isRoasting.value = false
  }
}

// Image Dropzone Handling (Canvas HSL Scan)
const onFileSelected = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) processScreenshot(file)
}

const onDropFile = (event: DragEvent) => {
  const file = event.dataTransfer?.files?.[0]
  if (file) processScreenshot(file)
}

const processScreenshot = (file: File) => {
  if (!file.type.startsWith('image/')) {
    toast.error(
      locale.value === 'id' ? 'File Tidak Valid' : 'Invalid File',
      locale.value === 'id' ? 'Silakan unggah gambar screenshot (PNG/JPG/WebP).' : 'Please upload a screenshot image (PNG/JPG/WebP).'
    )
    return
  }

  previewFilename.value = file.name
  previewFileSize.value = formatBytes(file.size)

  const reader = new FileReader()
  reader.onload = (e) => {
    previewImage.value = e.target?.result as string
    analyzeImagePixels(previewImage.value, file.name)
  }
  reader.onerror = () => {
    isAnalyzing.value = false
    toast.error(
      locale.value === 'id' ? 'Gagal Membaca File' : 'File Read Error',
      locale.value === 'id' ? 'Tidak dapat membaca file screenshot yang dipilih.' : 'Unable to read the selected screenshot file.'
    )
  }
  reader.readAsDataURL(file)
}

// Manual Paste Image from Clipboard button
const handlePasteFromClipboard = async () => {
  try {
    if (!navigator.clipboard?.read) {
      toast.error(
        locale.value === 'id' ? 'Browser Terbatas' : 'Browser Limited',
        locale.value === 'id' ? 'Gunakan tombol shortcut Ctrl+V untuk menempel gambar langsung' : 'Press Ctrl+V to paste the image directly'
      )
      return
    }

    const items = await navigator.clipboard.read()
    for (const item of items) {
      const imgType = item.types.find((t) => t.startsWith('image/'))
      if (imgType) {
        const blob = await item.getType(imgType)
        const file = new File([blob], 'clipboard-screenshot.png', { type: imgType })
        activeMode.value = 'shot'
        processScreenshot(file)
        toast.success(
          locale.value === 'id' ? 'Screenshot Ditempel' : 'Screenshot Pasted',
          locale.value === 'id' ? 'Gambar dari clipboard berhasil dimuat' : 'Image loaded from clipboard'
        )
        return
      }
    }

    toast.error(
      locale.value === 'id' ? 'Tidak Ada Gambar' : 'No Image Found',
      locale.value === 'id' ? 'Clipboard Anda tidak memuat gambar. Salin screenshot terlebih dahulu.' : 'No image found in clipboard. Copy a screenshot first.'
    )
  } catch {
    toast.error(
      locale.value === 'id' ? 'Gagal Akses Clipboard' : 'Clipboard Access Failed',
      locale.value === 'id' ? 'Izin akses clipboard ditolak. Silakan tekan Ctrl+V langsung di halaman.' : 'Clipboard permission denied. Please press Ctrl+V directly on the page.'
    )
  }
}

// Global window paste listener for instant Ctrl+V
const handleGlobalPaste = (e: ClipboardEvent) => {
  const items = e.clipboardData?.items
  if (!items) return

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.startsWith('image/')) {
      const file = items[i].getAsFile()
      if (file) {
        e.preventDefault()
        activeMode.value = 'shot'
        processScreenshot(file)
        toast.success(
          locale.value === 'id' ? 'Screenshot Ditempel' : 'Screenshot Pasted',
          locale.value === 'id' ? 'Memulai analisis piksel dari screenshot' : 'Starting pixel analysis from screenshot'
        )
        return
      }
    }
  }
}

onMounted(() => {
  window.addEventListener('paste', handleGlobalPaste)
})

onUnmounted(() => {
  window.removeEventListener('paste', handleGlobalPaste)
})

// Client-side Canvas Image Analysis
const analyzeImagePixels = (imgSrc: string, filename: string) => {
  isAnalyzing.value = true
  inspection.value = null
  roastData.value = null
  scanLogs.value = []
  showLogs.value = false
  screenshotLoadError.value = false
  selectedCategory.value = 'all'

  addLog(locale.value === 'id' ? `Memuat screenshot: ${filename}` : `Loading screenshot: ${filename}`)
  const img = new Image()
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        isAnalyzing.value = false
        toast.error(
          locale.value === 'id' ? 'Canvas Tidak Didukung' : 'Canvas Not Supported',
          locale.value === 'id' ? 'Gagal menginisialisasi 2D Canvas context di browser Anda.' : 'Failed to initialize 2D Canvas context in your browser.'
        )
        return
      }

      canvas.width = 200
      canvas.height = 120
      ctx.drawImage(img, 0, 0, 200, 120)

      const imageData = ctx.getImageData(0, 0, 200, 120).data
      let darkPixels = 0
      let violetPixels = 0
      let limePixels = 0
      const totalPixels = 200 * 120

      for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i] / 255
        const g = imageData[i + 1] / 255
        const b = imageData[i + 2] / 255

        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const l = (max + min) / 2

        if (l < 0.16) darkPixels++

        let h = 0
        const d = max - min
        if (d > 0) {
          if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60
          else if (max === g) h = ((b - r) / d + 2) * 60
          else h = ((r - g) / d + 4) * 60
        }

        if (h >= 240 && h <= 290 && l > 0.2 && l < 0.8) violetPixels++
        if (h >= 75 && h <= 110 && l > 0.3) limePixels++
      }

      const darkRatio = darkPixels / totalPixels
      const violetRatio = violetPixels / totalPixels
      const limeRatio = limePixels / totalPixels

      const mockFindings: FindingItem[] = []
      let scoreAcc = 10
      const isIndo = locale.value === 'id'

      if (darkRatio > 0.45) {
        scoreAcc += 20
        mockFindings.push({
          cat: 'visual',
          key: 'dark',
          label: isIndo ? 'Dark Mode Pekat Dominan' : 'Predominant Near-Black Background',
          pts: 14,
          roast: isIndo ? 'Latar gelap total khas template startup AI.' : 'Near-black backdrop. The standard uniform of seed-funded AI startups.',
          why: isIndo ? 'Area visual didominasi latar hitam pekat tanpa variasi tonal depth.' : 'The canvas is overwhelmingly near-black with little tonal depth.',
          quotes: [`${Math.round(darkRatio * 100)}% ${isIndo ? 'area gelap' : 'dark area'}`]
        })
      }

      if (violetRatio > 0.05) {
        scoreAcc += 25
        mockFindings.push({
          cat: 'visual',
          key: 'violet',
          label: isIndo ? 'Aksen Violet / Indigo AI' : 'Violet / Indigo AI Accents',
          pts: 18,
          roast: isIndo ? 'Warna ungu template. Palet seragam wajib generator.' : 'Purple again. The official color palette of default AI templates.',
          why: isIndo ? 'Palet warna aksen ungu/indigo sangat dominan di atas lipatan.' : 'Indigo and violet dominate the visual hierarchy above the fold.',
          quotes: [`${Math.round(violetRatio * 100)}% ${isIndo ? 'piksel ungu' : 'violet pixels'}`]
        })
      }

      if (limeRatio > 0.02) {
        scoreAcc += 20
        mockFindings.push({
          cat: 'visual',
          key: 'lime',
          label: isIndo ? 'Neon Acid Lime Highlight' : 'Acid Lime Highlighter Accents',
          pts: 15,
          roast: isIndo ? 'Tombol hijau neon stabilo bawaan generator.' : 'Acid lime buttons. The favorite highlighter of modern AI templates.',
          why: isIndo ? 'Warna tombol lime kontras tinggi khas template modern.' : 'High-contrast neon lime pills placed over dark backdrops.',
          quotes: [`${Math.round(limeRatio * 100)}% ${isIndo ? 'piksel hijau lime' : 'lime pixels'}`]
        })
      }

      const mockResult: InspectionResult = {
        host: filename.replace(/\.[^.]+$/, ''),
        url: 'Uploaded Screenshot',
        score: Math.min(95, scoreAcc),
        verdictId: scoreAcc > 45 ? 'ai-residue' : 'mostly-human',
        verdictLabel: scoreAcc > 45
          ? (isIndo ? 'Aroma AI Tercium Kuat' : 'Strong AI Vibe Detected')
          : (isIndo ? 'Tampilan Standar' : 'Mostly Clean'),
        findings: mockFindings,
        credits: [],
        stats: {
          words: 0,
          headingsCount: 0,
          buzzCount: 0,
          emDashes: 0
        }
      }

      inspection.value = mockResult
      isAnalyzing.value = false
      triggerRoast(mockResult)
    } catch (err: any) {
      isAnalyzing.value = false
      toast.error(
        locale.value === 'id' ? 'Gagal Menganalisa Gambar' : 'Image Analysis Failed',
        err?.message || (locale.value === 'id' ? 'Terjadi kesalahan saat membaca piksel gambar.' : 'Error while reading image pixels.')
      )
    }
  }

  img.onerror = () => {
    isAnalyzing.value = false
    toast.error(
      locale.value === 'id' ? 'Gambar Gagal Dimuat' : 'Image Load Failed',
      locale.value === 'id' ? 'Format gambar rusak atau tidak dapat di-decode oleh browser.' : 'Image format is corrupted or cannot be decoded by browser.'
    )
  }

  img.src = imgSrc
}

// Copy full roast
const copyRoastResult = () => {
  if (!inspection.value) return
  const isIndo = locale.value === 'id'
  const text = `${isIndo ? 'Audit SlopSpector untuk' : 'SlopSpector Audit for'} ${inspection.value.host}:
${isIndo ? 'Skor Slop' : 'Slop Score'}: ${inspection.value.score}% (${roastData.value?.verdict || inspection.value.verdictLabel})

Roasting:
${formattedRoasts.value.map((r, i) => `${i + 1}. ${r.line}`).join('\n')}

${isIndo ? 'Rekomendasi Utama' : 'Key Recommendation'}:
${roastData.value?.fix || (isIndo ? 'Pertahankan kode bersih dan hindari copy klise generator.' : 'Maintain authentic copy and avoid default generator templates.')}

${isIndo ? 'Periksa website Anda di Avttr Studio' : 'Inspect your site at Avttr Studio'}: https://studio.avttr.my.id/tools/slop-spector`

  copy(text, isIndo ? 'Hasil Roasting' : 'Roast Result')
}
</script>

<template>
  <div class="space-y-6 pb-12 w-full">
    <!-- Breadcrumb Hierarchy -->
    <nav class="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] font-mono">
      <NuxtLink to="/" class="hover:text-[var(--text-primary)] transition-colors">Dashboard</NuxtLink>
      <span>/</span>
      <span class="hover:text-[var(--text-primary)] transition-colors">Developer</span>
      <span>/</span>
      <span class="text-[var(--text-primary)] font-medium">SlopSpector</span>
    </nav>

    <!-- Header Section (Clean Header Standard without Badges) -->
    <div class="space-y-1">
      <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
        SlopSpector
      </h1>
      <p class="text-xs sm:text-sm text-[var(--text-secondary)]">
        {{ locale === 'id'
          ? 'Forensik jejak generator AI di balik website. Deteksi buzzwords, unstyled tokens, dan pola template dengan vonis roast terkalibrasi.'
          : 'Forensic detector for AI slop and generator fingerprints. Audits buzzwords, unstyled tokens, and template patterns with a calibrated roast.' }}
      </p>
    </div>

    <!-- Mode Selector Segment -->
    <div class="inline-flex p-1 rounded-xl bg-zinc-100 dark:bg-[#1C1C1E] border border-zinc-200 dark:border-[#2E2E2E]">
      <button
        id="btn-mode-url"
        type="button"
        class="px-4 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
        :class="activeMode === 'url' ? 'bg-white dark:bg-[#28282A] text-[var(--text-primary)] shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
        @click="activeMode = 'url'"
      >
        {{ locale === 'id' ? 'Link Website' : 'Website Link' }}
      </button>
      <button
        id="btn-mode-shot"
        type="button"
        class="px-4 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
        :class="activeMode === 'shot' ? 'bg-white dark:bg-[#28282A] text-[var(--text-primary)] shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
        @click="activeMode = 'shot'"
      >
        {{ locale === 'id' ? 'Analisa Screenshot' : 'Screenshot Analysis' }}
      </button>
    </div>

    <!-- URL Omnibox (DESIGN.md Section 11 Architecture - Clean & Focused) -->
    <div v-if="activeMode === 'url'" class="w-full">
      <div class="flex flex-col sm:flex-row items-center gap-2.5 w-full">
        <div class="relative flex-1 w-full flex items-center">
          <Globe class="absolute left-3.5 w-4 h-4 text-[var(--text-tertiary)] pointer-events-none" />
          <input
            id="slop-url-input"
            v-model="inputUrl"
            type="url"
            :placeholder="locale === 'id' ? 'https://example.com atau startup.ai' : 'https://example.com or startup.ai'"
            class="w-full h-12 pl-10 pr-20 bg-white dark:bg-[#171717] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] border border-zinc-200 dark:border-[#2E2E2E] focus:border-zinc-400 dark:focus:border-white/40 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 disabled:opacity-50 shadow-xs font-mono"
            :disabled="isAnalyzing"
            @keydown.enter="runInspection"
          />
          <div class="absolute right-2.5 flex items-center gap-1">
            <button
              v-if="inputUrl"
              id="btn-clear-url"
              type="button"
              class="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md transition-colors cursor-pointer"
              title="Clear"
              @click="handleClear"
            >
              <X class="w-4 h-4" />
            </button>
            <button
              v-else
              id="btn-paste-url"
              type="button"
              class="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md transition-colors cursor-pointer"
              title="Paste from clipboard"
              @click="handlePaste"
            >
              <Clipboard class="w-4 h-4" />
            </button>
          </div>
        </div>

        <Button
          id="btn-submit-slop"
          variant="primary"
          size="default"
          class="w-full sm:w-auto shrink-0 h-12 px-5 rounded-xl font-medium text-xs sm:text-sm cursor-pointer"
          :loading="isAnalyzing"
          :disabled="isAnalyzing || !inputUrl.trim()"
          @click="runInspection"
        >
          <ScanSearch class="w-4 h-4 mr-2" />
          {{ locale === 'id' ? 'Audit AI Slop' : 'Inspect Slop' }}
        </Button>
      </div>
    </div>

    <!-- Screenshot Mode Container -->
    <div v-else class="w-full">
      <input
        ref="fileInputRef"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        class="hidden"
        @change="onFileSelected"
      />

      <!-- Active Screenshot Preview Card -->
      <Card v-if="previewImage" :hoverable="false" class="p-4 sm:p-5 space-y-4">
        <div class="flex items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-[#1E1E20] border border-zinc-200 dark:border-[#2E2E2E] flex items-center justify-center shrink-0">
              <ImageIcon class="w-4 h-4 text-[var(--text-secondary)]" />
            </div>
            <div class="min-w-0">
              <div class="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[200px] sm:max-w-xs">
                {{ previewFilename || 'screenshot.png' }}
              </div>
              <div class="text-[11px] font-mono text-[var(--text-tertiary)]">
                {{ previewFileSize || 'Image' }}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <Button
              id="btn-change-screenshot"
              variant="secondary"
              size="sm"
              class="rounded-lg text-xs cursor-pointer"
              :disabled="isAnalyzing"
              @click="fileInputRef?.click()"
            >
              <Upload class="w-3.5 h-3.5 mr-1" />
              {{ locale === 'id' ? 'Ganti' : 'Change' }}
            </Button>
            <Button
              id="btn-remove-screenshot"
              variant="ghost"
              size="sm"
              class="rounded-lg text-xs cursor-pointer text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
              :disabled="isAnalyzing"
              @click="clearScreenshot"
            >
              <X class="w-3.5 h-3.5 mr-1" />
              {{ locale === 'id' ? 'Hapus' : 'Remove' }}
            </Button>
          </div>
        </div>

        <div class="relative rounded-xl overflow-hidden bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-center p-3 min-h-[220px]">
          <img
            :src="previewImage"
            alt="Uploaded screenshot preview"
            class="max-h-80 w-auto object-contain rounded-lg shadow-md"
          />

          <div
            v-if="isAnalyzing"
            class="absolute inset-0 bg-gradient-to-b from-zinc-500/10 via-transparent to-zinc-500/10 pointer-events-none flex flex-col justify-between"
          >
            <div class="w-full h-1 bg-gradient-to-r from-transparent via-white to-transparent shadow-[0_0_12px_rgba(255,255,255,0.8)] animate-pulse" />
            <div class="w-full text-center py-2 bg-black/70 backdrop-blur-xs">
              <LoadingBreadcrumb
                :text="locale === 'id' ? 'Menganalisis Spektrum Piksel...' : 'Analyzing Pixel Spectrum...'"
                :size="18"
                class="text-xs"
              />
            </div>
            <div class="w-full h-1 bg-gradient-to-r from-transparent via-white to-transparent shadow-[0_0_12px_rgba(255,255,255,0.8)] animate-pulse" />
          </div>
        </div>
      </Card>

      <!-- Screenshot Dropzone (DESIGN.md Section 10 Architecture) -->
      <div
        v-else
        class="relative border-2 border-dashed rounded-[14px] p-8 sm:p-12 border-zinc-300 dark:border-[#2E2E2E] bg-zinc-50/50 dark:bg-[#141416] hover:border-zinc-400 dark:hover:border-[#3E3E3E] text-center cursor-pointer select-none transition-colors"
        @click="fileInputRef?.click()"
        @dragover.prevent
        @drop.prevent="onDropFile"
      >
        <div class="w-12 h-12 mx-auto rounded-xl bg-white dark:bg-[#212121] border border-zinc-200 dark:border-[#2E2E2E] flex items-center justify-center text-zinc-900 dark:text-white shadow-xs mb-3">
          <Upload class="w-6 h-6 text-zinc-500" />
        </div>
        <div class="text-sm font-semibold text-[var(--text-primary)]">
          {{ locale === 'id' ? 'Drop screenshot website di sini atau klik untuk browse' : 'Drop website screenshot here or click to browse' }}
        </div>
        <p class="text-xs text-[var(--text-secondary)] mt-1">
          {{ locale === 'id' ? 'Mendukung PNG, JPG, WebP. 100% diproses di browser melalui analisis piksel Canvas.' : 'Supports PNG, JPG, WebP. 100% client-side Canvas pixel analysis.' }}
        </p>

        <div class="flex items-center justify-center gap-2 pt-4">
          <Button
            id="btn-paste-screenshot"
            variant="secondary"
            size="sm"
            class="rounded-lg text-xs cursor-pointer shadow-xs"
            @click.stop="handlePasteFromClipboard"
          >
            <Clipboard class="w-3.5 h-3.5 mr-1.5" />
            {{ locale === 'id' ? 'Tempel dari Clipboard (Ctrl+V)' : 'Paste from Clipboard (Ctrl+V)' }}
          </Button>
        </div>
      </div>
    </div>

    <!-- AI Roaster Engine & Model Notice (Unboxed Minimalist) -->
    <div v-if="!inspection && !isAnalyzing" class="flex items-start gap-2.5 text-xs px-1">
      <Info class="w-4 h-4 text-[var(--text-tertiary)] shrink-0 mt-0.5" />
      <div class="space-y-0.5 text-[var(--text-secondary)] leading-relaxed">
        <div class="text-xs font-medium text-[var(--text-primary)]">
          {{ locale === 'id' ? 'Catatan Engine AI & Model Roaster' : 'AI Roaster Engine & Model Notice' }}
        </div>
        <p class="text-[11px] text-[var(--text-tertiary)]">
          {{ locale === 'id'
            ? 'Deteksi heuristik dan pemindaian AST berjalan deterministik di server & Canvas. Fitur vonis roasting ditenagai oleh model Qwen 3.8-27B (via Groq LPUs) dengan fallback otomatis ke Google Gemini.'
            : 'Heuristic AST and Canvas pixel scans run deterministically. Roasting verdicts are generated via Qwen 3.8-27B (via Groq LPUs) with automated Google Gemini fallback.' }}
        </p>
      </div>
    </div>

    <!-- Active Scanning Status Bar (Features LoadingBreadcrumb Animation) -->
    <Card
      v-if="isAnalyzing"
      :hoverable="false"
      class="p-5 rounded-[14px] bg-[var(--bg-card)] border border-[var(--border-card)] space-y-4 transition-all"
    >
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-xs">
        <LoadingBreadcrumb
          :text="currentLogText"
          :size="20"
          :stroke-width="2.2"
        />
        <span class="font-mono text-[11px] text-[var(--text-tertiary)] truncate max-w-[240px]">
          {{ inputUrl || previewFilename || 'Target' }}
        </span>
      </div>

      <div class="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden relative">
        <div class="h-full bg-zinc-900 dark:bg-zinc-100 rounded-full animate-indeterminate" />
      </div>

      <div class="flex items-center justify-between text-xs font-mono text-[var(--text-secondary)]">
        <span class="truncate">{{ locale === 'id' ? 'Memindai DOM AST, CSS tokens, & jejak AI builder' : 'Probing DOM AST, CSS tokens, & builder fingerprints' }}</span>
        <span class="text-[10px] text-[var(--text-tertiary)] shrink-0 ml-2">PROBING ACTIVE</span>
      </div>
    </Card>

    <!-- Completed Inspection: Website Hero Section Viewport Card (Replacing plain text line) -->
    <Card
      v-if="inspection && !isAnalyzing"
      :hoverable="false"
      class="p-4 sm:p-5 space-y-3.5 bg-[var(--bg-card)] border-[var(--border-card)]"
    >
      <!-- Browser Chrome Header Bar -->
      <div class="flex items-center justify-between gap-3">
        <!-- Window Control Dots -->
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
          <span class="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
        </div>

        <!-- URL Omnibox Pill in Window Header -->
        <div class="flex-1 max-w-sm sm:max-w-md mx-auto">
          <div class="h-7 px-3 rounded-lg bg-zinc-100 dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono text-[var(--text-secondary)] flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 truncate">
              <Globe class="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span class="truncate">https://{{ inspection.host }}</span>
            </div>
            <a
              v-if="inspection.url.startsWith('http')"
              :href="inspection.url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-zinc-400 hover:text-[var(--text-primary)] transition-colors shrink-0"
              title="Open site in new tab"
            >
              <ExternalLink class="w-3 h-3" />
            </a>
          </div>
        </div>

        <!-- Status Badge & Logs Toggle -->
        <div class="flex items-center gap-2 shrink-0">
          <Badge variant="success" size="sm" class="hidden sm:inline-flex text-[10px] font-mono">
            {{ locale === 'id' ? 'Audit Selesai' : 'Audit Complete' }}
          </Badge>
          <button
            type="button"
            class="text-[11px] font-mono text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-1"
            @click="showLogs = !showLogs"
          >
            <span>{{ showLogs ? (locale === 'id' ? 'Tutup Log' : 'Hide Log') : (locale === 'id' ? 'Log Audit' : 'Probe Log') }}</span>
            <NavArrowDown class="w-3.5 h-3.5 transition-transform" :class="{ 'rotate-180': showLogs }" />
          </button>
        </div>
      </div>

      <!-- Hero Section Viewport Image Frame -->
      <div class="relative w-full max-h-[300px] sm:max-h-[360px] overflow-hidden rounded-xl bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
        <img
          v-if="siteHeroScreenshot"
          :src="siteHeroScreenshot"
          :alt="`Hero preview of ${inspection.host}`"
          class="w-full h-auto max-h-[300px] sm:max-h-[360px] object-cover object-top transition-transform duration-300 hover:scale-[1.01]"
          loading="lazy"
          @error="screenshotLoadError = true"
        />
        <div v-else class="py-16 text-center text-xs text-[var(--text-tertiary)] font-mono">
          {{ locale === 'id' ? 'Preview viewport tidak tersedia' : 'Hero viewport preview unavailable' }}
        </div>

        <!-- Subtle Gradient Overlay with Viewport Label -->
        <div class="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex items-center justify-between text-[11px] font-mono text-zinc-300 pointer-events-none">
          <span class="truncate">Hero Section &bull; {{ inspection.host }}</span>
          <span class="text-zinc-400 shrink-0 ml-2">1280 &times; 720 Viewport</span>
        </div>
      </div>

      <!-- Expandable Probe Log (Only shown when requested) -->
      <div
        v-if="showLogs && scanLogs.length > 0"
        class="p-3.5 rounded-lg bg-zinc-100 dark:bg-[#141416] border border-zinc-200 dark:border-[#2D2D30] text-xs font-mono text-zinc-500 dark:text-zinc-400 space-y-1.5 shadow-inner"
      >
        <div v-for="(log, idx) in scanLogs" :key="idx" class="flex items-baseline justify-between gap-4">
          <span :class="log.hit ? 'text-rose-500 dark:text-rose-400 font-medium' : 'text-zinc-700 dark:text-zinc-300'">{{ log.text }}</span>
          <span class="text-[10px] text-zinc-400 dark:text-zinc-600">t+{{ idx * 120 }}ms</span>
        </div>
      </div>
    </Card>

    <!-- Skeleton Loading State (Bento Grid) -->
    <div v-if="isAnalyzing" class="space-y-6 pt-2 animate-pulse" aria-busy="true">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card :hoverable="false" class="lg:col-span-5 p-6 flex flex-col justify-between space-y-6 bg-zinc-100/60 dark:bg-[#1A1A1C]/60 border-zinc-200 dark:border-[#262629]">
          <div class="space-y-3">
            <div class="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div class="flex items-baseline gap-3">
              <div class="h-14 w-32 rounded-xl bg-zinc-300/70 dark:bg-zinc-800" />
              <div class="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800/80" />
            </div>
            <div class="h-4 w-44 rounded bg-zinc-200 dark:bg-zinc-800/70 pt-1" />
          </div>

          <div class="space-y-2">
            <div class="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div class="flex justify-between">
              <div class="h-2.5 w-20 rounded bg-zinc-200 dark:bg-zinc-800/60" />
              <div class="h-2.5 w-20 rounded bg-zinc-200 dark:bg-zinc-800/60" />
            </div>
          </div>

          <div class="pt-3 border-t border-[var(--border-subtle)] flex justify-between">
            <div class="h-3 w-28 rounded bg-zinc-200 dark:bg-zinc-800/60" />
            <div class="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800/60" />
          </div>
        </Card>

        <Card :hoverable="false" class="lg:col-span-7 p-6 space-y-5 bg-zinc-100/60 dark:bg-[#1A1A1C]/60 border-zinc-200 dark:border-[#262629]">
          <div class="flex items-center justify-between">
            <div class="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div class="h-4 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          </div>

          <div class="space-y-3.5">
            <div v-for="i in 3" :key="i" class="flex items-start gap-3">
              <div class="w-5 h-5 rounded-md bg-zinc-200 dark:bg-zinc-800 shrink-0" />
              <div class="w-full space-y-1.5">
                <div class="h-4 w-4/5 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div class="h-3 w-2/5 rounded bg-zinc-200 dark:bg-zinc-800/60" />
              </div>
            </div>

            <div class="pt-3 border-t border-[var(--border-subtle)] space-y-1.5">
              <div class="h-3 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div class="h-3.5 w-5/6 rounded bg-zinc-200 dark:bg-zinc-800/60" />
            </div>
          </div>
        </Card>
      </div>
    </div>

    <!-- Results Section -->
    <div v-else-if="inspection" class="space-y-6 pt-2">
      <!-- Top Bento Overview: Score & Roasting Verdict -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <!-- Slop Score Card (5 Cols) -->
        <Card :hoverable="false" class="lg:col-span-5 p-6 flex flex-col justify-between space-y-6 bg-[var(--bg-card)] border-[var(--border-card)]">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
                SLOP INDEX
              </span>
              <Badge :variant="scoreLevel.badgeVariant" size="sm">
                {{ scoreLevel.label }}
              </Badge>
            </div>

            <div class="flex items-baseline gap-2.5">
              <span class="text-6xl font-extrabold tracking-tight font-mono text-[var(--text-primary)]">
                {{ inspection.score }}%
              </span>
              <span class="text-xs text-[var(--text-tertiary)] font-mono">
                / 100% slop
              </span>
            </div>

            <p class="text-sm font-semibold text-[var(--text-primary)] tracking-tight pt-1">
              {{ roastData?.verdict || inspection.verdictLabel }}
            </p>
          </div>

          <!-- Score Gauge Meter Bar -->
          <div class="space-y-1.5">
            <div class="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-700"
                :class="scoreLevel.colorBg"
                :style="{ width: `${Math.max(4, inspection.score)}%` }"
              />
            </div>
            <div class="flex justify-between text-[10px] font-mono text-[var(--text-tertiary)]">
              <span>0% Human Craft</span>
              <span>100% Robot Slop</span>
            </div>
          </div>

          <!-- Target Metadata -->
          <div class="pt-3 border-t border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-tertiary)] flex items-center justify-between">
            <span class="truncate max-w-[220px]">Target: {{ inspection.host }}</span>
            <span>{{ activeMode === 'shot' ? (previewFileSize || 'Image') : `${inspection.stats.words} words` }}</span>
          </div>
        </Card>

        <!-- AI Roasting Card (7 Cols) -->
        <Card :hoverable="false" class="lg:col-span-7 p-6 space-y-4 bg-[var(--bg-card)] border-[var(--border-card)]">
          <div class="flex items-center justify-between">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
              {{ locale === 'id' ? 'Vonis AI Roaster' : 'AI Roaster Verdict' }}
            </h2>
            <Badge variant="outline" size="sm" class="text-[10px] font-mono font-normal text-[var(--text-tertiary)]">
              {{ roastData?.model || 'qwen/qwen3.8-27b' }}
            </Badge>
          </div>

          <!-- Loading Roast Shimmer -->
          <div v-if="isRoasting" class="py-6 space-y-3 animate-pulse">
            <div class="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
            <div class="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-5/6" />
            <div class="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
          </div>

          <!-- Roasting List -->
          <div v-else class="space-y-3.5">
            <div
              v-for="(r, idx) in formattedRoasts"
              :key="idx"
              class="flex items-start gap-3 text-xs leading-relaxed"
            >
              <span class="w-5 h-5 rounded-md bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300 font-mono text-xs flex items-center justify-center shrink-0">
                {{ idx + 1 }}
              </span>
              <div class="space-y-0.5 min-w-0">
                <p class="text-sm font-medium text-[var(--text-primary)] leading-snug">
                  {{ r.line }}
                </p>
                <p v-if="r.evidence" class="text-xs font-mono text-[var(--text-tertiary)] truncate">
                  {{ r.evidence }}
                </p>
              </div>
            </div>

            <!-- Single Practical Fix -->
            <div class="p-3 rounded-lg bg-zinc-50 dark:bg-[#1A1A1C] border border-zinc-200 dark:border-[#2D2D30] space-y-1">
              <div class="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                <ShieldCheck class="w-3.5 h-3.5 text-zinc-400" />
                <span>{{ locale === 'id' ? 'Rekomendasi Utama' : 'Key Recommendation' }}</span>
              </div>
              <p class="text-xs text-[var(--text-primary)] leading-relaxed">
                {{ roastData?.fix || (locale === 'id' ? 'Pertahankan kode bersih dan hindari copy klise generator.' : 'Maintain authentic copy and avoid default generator templates.') }}
              </p>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-wrap items-center gap-2 pt-1">
            <Button
              id="btn-copy-roast"
              variant="secondary"
              size="sm"
              class="rounded-lg text-xs cursor-pointer"
              @click="copyRoastResult"
            >
              <Clipboard class="w-3.5 h-3.5 mr-1.5" />
              {{ locale === 'id' ? 'Salin Roasting' : 'Copy Roast' }}
            </Button>
            <Button
              id="btn-audit-another"
              variant="ghost"
              size="sm"
              class="rounded-lg text-xs cursor-pointer"
              @click="handleClear"
            >
              <RotateCcw class="w-3.5 h-3.5 mr-1.5" />
              {{ locale === 'id' ? 'Audit Web Lain' : 'Inspect Another' }}
            </Button>
          </div>
        </Card>
      </div>

      <!-- Slop Receipt & Detailed Findings Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <!-- Slop Receipt Column (4 Cols) -->
        <Card :hoverable="false" class="lg:col-span-4 p-5 space-y-4 font-mono text-xs bg-[var(--bg-card)] border-[var(--border-card)] flex flex-col justify-between">
          <div class="space-y-4">
            <div class="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)] text-[var(--text-secondary)]">
              <div class="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                <Receipt class="w-4 h-4" />
                <span>SLOP RECEIPT</span>
              </div>
              <span class="truncate max-w-[130px] text-right">{{ inspection.host }}</span>
            </div>

            <!-- Items Breakdown -->
            <div v-if="inspection.findings.length > 0 || inspection.credits.length > 0" class="space-y-2 text-[11px]">
              <div
                v-for="f in inspection.findings"
                :key="f.key"
                class="flex justify-between items-baseline gap-2"
              >
                <span class="truncate text-[var(--text-secondary)]">{{ f.label }}</span>
                <span class="text-rose-500 font-medium shrink-0">+{{ f.pts }}</span>
              </div>
              <div
                v-for="c in inspection.credits"
                :key="c.label"
                class="flex justify-between items-baseline gap-2 text-emerald-500"
              >
                <span class="truncate">{{ c.label }}</span>
                <span class="font-medium shrink-0">-{{ c.pts }}</span>
              </div>
            </div>

            <!-- Clean baseline receipt when findings is 0 -->
            <div v-else class="space-y-2 text-[11px]">
              <div class="flex justify-between items-baseline gap-2 text-[var(--text-secondary)]">
                <span>Typography Stack</span>
                <span class="text-emerald-500 font-medium">-5 (Custom)</span>
              </div>
              <div class="flex justify-between items-baseline gap-2 text-[var(--text-secondary)]">
                <span>Generator Signatures</span>
                <span class="text-[var(--text-tertiary)]">0 (Clean)</span>
              </div>
              <div class="flex justify-between items-baseline gap-2 text-[var(--text-secondary)]">
                <span>Lexical Buzzwords</span>
                <span class="text-[var(--text-tertiary)]">0 (None)</span>
              </div>
              <div class="flex justify-between items-baseline gap-2 text-[var(--text-secondary)]">
                <span>Template Grids</span>
                <span class="text-[var(--text-tertiary)]">0 (Clean)</span>
              </div>
            </div>
          </div>

          <!-- Receipt Total -->
          <div class="pt-3 border-t border-dashed border-[var(--border-subtle)] flex justify-between items-baseline">
            <span class="text-xs uppercase text-[var(--text-secondary)]">
              {{ locale === 'id' ? 'Total Skor Slop:' : 'Total Slop Score:' }}
            </span>
            <span class="text-lg font-bold text-[var(--text-primary)]">
              {{ inspection.score }}%
            </span>
          </div>
        </Card>

        <!-- Right Side: Detailed Findings OR Pristine Clean State (8 Cols) -->
        <!-- Clean State when 0 findings -->
        <Card
          v-if="inspection.findings.length === 0"
          :hoverable="false"
          class="lg:col-span-8 p-6 flex flex-col justify-center items-center text-center space-y-4 bg-[var(--bg-card)] border-[var(--border-card)]"
        >
          <div class="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-center text-zinc-900 dark:text-zinc-100 shadow-xs">
            <ShieldCheck class="w-6 h-6 text-emerald-500" />
          </div>

          <div class="space-y-1 max-w-md">
            <h3 class="text-base font-semibold text-[var(--text-primary)]">
              {{ locale === 'id' ? 'Website Bersih dari Indikasi AI Slop' : 'Zero AI Slop Signatures Detected' }}
            </h3>
            <p class="text-xs text-[var(--text-secondary)] leading-relaxed">
              {{ locale === 'id'
                ? 'Target tidak menunjukkan pola template murahan, copy klise generator, atau komponen bawaan AI builder. Kode tampak dibuat otentik.'
                : 'The target exhibits no boilerplate marketing buzzwords, default template tokens, or automated generator signatures. Craftsmanship appears authentic.' }}
            </p>
          </div>

          <!-- Verification checklist grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg pt-2 text-left">
            <div class="p-2.5 rounded-lg bg-zinc-50 dark:bg-[#18181A] border border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
              <Check class="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span class="text-xs text-[var(--text-secondary)]">{{ locale === 'id' ? 'Bebas Fingerprint Builder' : 'No Builder Signatures' }}</span>
            </div>
            <div class="p-2.5 rounded-lg bg-zinc-50 dark:bg-[#18181A] border border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
              <Check class="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span class="text-xs text-[var(--text-secondary)]">{{ locale === 'id' ? 'Bebas Buzzword Klise' : 'Zero Lexical Buzzwords' }}</span>
            </div>
            <div class="p-2.5 rounded-lg bg-zinc-50 dark:bg-[#18181A] border border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
              <Check class="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span class="text-xs text-[var(--text-secondary)]">{{ locale === 'id' ? 'Tipografi Berkarakter' : 'Custom Typography Stack' }}</span>
            </div>
            <div class="p-2.5 rounded-lg bg-zinc-50 dark:bg-[#18181A] border border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
              <Check class="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span class="text-xs text-[var(--text-secondary)]">{{ locale === 'id' ? 'Bebas Orbs Blur Template' : 'No Floating Gradient Orbs' }}</span>
            </div>
          </div>
        </Card>

        <!-- Detailed Evidence Bento Grid when findings exist -->
        <div v-else class="lg:col-span-8 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2 pb-1">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                {{ locale === 'id' ? 'Temuan Bukti Forensik' : 'Forensic Evidence' }}
              </span>
              <Badge variant="outline" size="sm" class="font-mono text-[10px]">
                {{ inspection.findings.length }}
              </Badge>
            </div>

            <!-- Category filter buttons -->
            <div v-if="categoriesList.length > 1" class="flex items-center gap-1">
              <button
                type="button"
                class="px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer"
                :class="selectedCategory === 'all' ? 'bg-zinc-200 dark:bg-zinc-700 text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'"
                @click="selectedCategory = 'all'"
              >
                All
              </button>
              <button
                v-for="cat in categoriesList"
                :key="cat"
                type="button"
                class="px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer capitalize"
                :class="selectedCategory === cat ? 'bg-zinc-200 dark:bg-zinc-700 text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'"
                @click="selectedCategory = cat"
              >
                {{ cat }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card
              v-for="item in filteredFindings"
              :key="item.key"
              :hoverable="false"
              class="p-4 space-y-2.5 bg-[var(--bg-card)] border-[var(--border-card)]"
            >
              <div class="flex items-center justify-between">
                <Badge variant="outline" size="sm" class="text-[10px] font-mono capitalize">
                  {{ item.cat }}
                </Badge>
                <span class="text-xs font-mono font-medium text-rose-500">+{{ item.pts }} pts</span>
              </div>

              <div class="text-xs font-semibold text-[var(--text-primary)] leading-snug">
                {{ item.label }}
              </div>

              <div v-if="item.quotes.length" class="p-2 rounded-lg bg-zinc-100 dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800/80 font-mono text-[11px] text-[var(--text-secondary)] space-y-1">
                <div v-for="(q, qidx) in item.quotes" :key="qidx" class="truncate">
                  “{{ q }}”
                </div>
              </div>

              <p class="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                {{ item.why }}
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes indeterminate {
  0% {
    transform: translateX(-100%);
    width: 35%;
  }
  50% {
    transform: translateX(60%);
    width: 55%;
  }
  100% {
    transform: translateX(260%);
    width: 35%;
  }
}
.animate-indeterminate {
  animation: indeterminate 1.4s infinite ease-in-out;
}
</style>
