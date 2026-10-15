<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Globe,
  Upload,
  PasteClipboard as Clipboard,
  Xmark as X,
  Scanning as ScanSearch,
  FireFlame as Flame,
  WarningTriangle as AlertTriangle,
  CheckCircle as CheckCircle2,
  ShareAndroid as Share2,
  Undo as RotateCcw,
  Sparks as Sparkles,
  Page as Receipt,
  PageEdit as FileCode,
  ShieldCheck,
  Flash as Zap,
  InfoCircle as Info,
  MediaImage as ImageIcon,
} from '@iconoir/vue'
import { useToast } from '~/composables/useToast'
import { useI18n } from '~/composables/useI18n'
import { useClipboard } from '~/composables/useClipboard'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'
import Card from '~/components/ui/Card.vue'

const toast = useToast()
const { t, locale } = useI18n()
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
const scanLogs = ref<Array<{ text: string; hit?: boolean }>>([])

// Inspection Results
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

// Clear screenshot state
const clearScreenshot = () => {
  previewImage.value = null
  previewFilename.value = ''
  previewFileSize.value = ''
  inspection.value = null
  roastData.value = null
  scanLogs.value = []
  isAnalyzing.value = false
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
  if (scanLogs.value.length > 7) {
    scanLogs.value.pop()
  }
}

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
      addLog(locale.value === 'id' ? 'Website sangat bersih dari aroma template.' : 'Site is surprisingly clean.')
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

// Trigger AI Roasting via Qwen 3.8-27B (Groq) with Gemini fallback
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
  } catch (err: any) {
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
          roast: isIndo ? 'Latar gelap total khas startup AI generasi 2024.' : 'Near-black backdrop. The standard uniform of seed-funded AI startups.',
          why: isIndo ? 'Area visual didominasi latar hitam pekat tanpa variasi elevasi.' : 'The above-the-fold canvas is overwhelmingly near-black with little tonal depth.',
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
          roast: isIndo ? 'Warna ungu lagi. Warna seragam wajib template seed-round.' : 'Purple again. The official color palette of default AI templates.',
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
          why: isIndo ? 'Warna tombol lime kontras tinggi khas template AI modern.' : 'High-contrast neon lime pills placed over dark backdrops.',
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
${roastData.value?.roasts.map((r, i) => `${i + 1}. ${r.line}`).join('\n') || inspection.value.findings.slice(0, 3).map((f, i) => `${i + 1}. ${f.roast}`).join('\n')}

${isIndo ? 'Saran Perbaikan' : 'Key Recommendation'}:
${roastData.value?.fix || (isIndo ? 'Hapus orbs melayang dan ganti font bawaan.' : 'Remove floating blurred orbs and adopt unique typography.')}

${isIndo ? 'Periksa website lu di Avttr Studio' : 'Inspect your site at Avttr Studio'}: https://studio.avttr.my.id/tools/slop-spector`

  copy(text, isIndo ? 'Hasil Roasting' : 'Roast Result')
}

// Score color meter
const scoreColorClass = computed(() => {
  const s = inspection.value?.score || 0
  if (s > 70) return 'text-rose-500 border-rose-500/30 bg-rose-500/10'
  if (s > 45) return 'text-amber-500 border-amber-500/30 bg-amber-500/10'
  if (s > 25) return 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10'
  return 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10'
})

// Category badge color
const categoryBadgeClass = (cat: string) => {
  switch (cat) {
    case 'fingerprint':
      return 'border-rose-500/30 text-rose-400 bg-rose-500/10'
    case 'copy':
      return 'border-amber-500/30 text-amber-400 bg-amber-500/10'
    case 'layout':
      return 'border-sky-500/30 text-sky-400 bg-sky-500/10'
    case 'nitpick':
      return 'border-zinc-500/30 text-zinc-400 bg-zinc-500/10'
    case 'visual':
      return 'border-purple-500/30 text-purple-400 bg-purple-500/10'
    default:
      return 'border-zinc-500/30 text-zinc-400 bg-zinc-500/10'
  }
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
          ? 'Forensik jejak dosa generator AI di balik website. Deteksi buzzwords, unstyled Shadcn tokens, orbs melayang, dan di-roast langsung oleh AI.'
          : 'Forensic detector for AI slop and generator fingerprints. Audits buzzwords, default Shadcn tokens, blurred blobs, and roasts the result.' }}
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
          @click="runInspection"
        >
          <ScanSearch class="w-4 h-4 mr-2" />
          {{ locale === 'id' ? 'Audit AI Slop' : 'Inspect Slop' }}
        </Button>
      </div>
    </div>

    <!-- Hidden File Input for Screenshot Mode -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      class="hidden"
      @change="onFileSelected"
    />

    <!-- Screenshot Mode Container -->
    <div v-else class="w-full">
      <!-- Active Screenshot Preview Card -->
      <Card v-if="previewImage" :hoverable="false" class="p-4 sm:p-5 space-y-4">
        <!-- Preview Header Bar: File Info + Change / Remove Actions -->
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

        <!-- Image Frame & Radar Laser Scan Overlay when analyzing -->
        <div class="relative rounded-xl overflow-hidden bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-center p-3 min-h-[220px]">
          <img
            :src="previewImage"
            alt="Uploaded screenshot preview"
            class="max-h-80 w-auto object-contain rounded-lg shadow-md"
          />

          <!-- Scanning Overlay Animation -->
          <div
            v-if="isAnalyzing"
            class="absolute inset-0 bg-gradient-to-b from-rose-500/10 via-transparent to-rose-500/10 pointer-events-none flex flex-col justify-between"
          >
            <div class="w-full h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_12px_rgba(244,63,94,0.8)] animate-pulse" />
            <div class="w-full text-center py-2 bg-black/60 backdrop-blur-xs text-[11px] font-mono text-rose-400 font-semibold tracking-wider uppercase">
              {{ locale === 'id' ? 'Memindai Spektrum Piksel AI...' : 'Scanning AI Pixel Spectrum...' }}
            </div>
            <div class="w-full h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_12px_rgba(244,63,94,0.8)] animate-pulse" />
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

    <!-- Live Scanner Terminal (Log Pemindaian) -->
    <div
      v-if="scanLogs.length > 0 || isAnalyzing"
      class="p-4 rounded-[14px] bg-[#111113] border border-[#262629] text-xs font-mono text-zinc-400 space-y-1.5 shadow-inner"
    >
      <div class="flex items-center justify-between text-[11px] text-zinc-500 pb-1 border-b border-zinc-800">
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full" :class="isAnalyzing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'" />
          <span>SLOPSPECTOR RADAR ENGINE</span>
        </div>
        <span>{{ isAnalyzing ? (locale === 'id' ? 'MEMINDAI...' : 'ANALYZING...') : 'IDLE' }}</span>
      </div>
      <div v-for="(log, idx) in scanLogs" :key="idx" class="flex items-baseline justify-between gap-4">
        <span :class="log.hit ? 'text-rose-400 font-semibold' : 'text-zinc-300'">{{ log.text }}</span>
        <span class="text-[10px] text-zinc-600">t+{{ idx * 120 }}ms</span>
      </div>
    </div>

    <!-- Skeleton Loading State (Bento Grid) -->
    <div v-if="isAnalyzing" class="space-y-6 pt-2 animate-pulse" aria-busy="true">
      <!-- Top Bento Overview Skeleton -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <!-- Slop Score Card Skeleton (5 Cols) -->
        <Card :hoverable="false" class="lg:col-span-5 p-6 flex flex-col justify-between space-y-6 bg-zinc-100/60 dark:bg-[#1A1A1C]/60 border-zinc-200 dark:border-[#262629]">
          <div class="space-y-3">
            <div class="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div class="flex items-baseline gap-3">
              <div class="h-14 w-32 rounded-xl bg-zinc-300/70 dark:bg-zinc-800" />
              <div class="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800/80" />
            </div>
            <div class="h-4 w-44 rounded bg-zinc-200 dark:bg-zinc-800/70 pt-1" />
          </div>

          <!-- Meter Bar Skeleton -->
          <div class="space-y-2">
            <div class="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div class="flex justify-between">
              <div class="h-2.5 w-20 rounded bg-zinc-200 dark:bg-zinc-800/60" />
              <div class="h-2.5 w-20 rounded bg-zinc-200 dark:bg-zinc-800/60" />
            </div>
          </div>

          <!-- Metadata Skeleton -->
          <div class="pt-3 border-t border-[var(--border-subtle)] flex justify-between">
            <div class="h-3 w-28 rounded bg-zinc-200 dark:bg-zinc-800/60" />
            <div class="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800/60" />
          </div>
        </Card>

        <!-- AI Roaster Card Skeleton (7 Cols) -->
        <Card :hoverable="false" class="lg:col-span-7 p-6 space-y-5 bg-zinc-100/60 dark:bg-[#1A1A1C]/60 border-zinc-200 dark:border-[#262629]">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-4 h-4 rounded bg-rose-500/30" />
              <div class="h-3 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <div class="h-4 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          </div>

          <!-- Roasting Rows Skeleton -->
          <div class="space-y-3.5">
            <div v-for="i in 3" :key="i" class="flex items-start gap-3">
              <div class="w-5 h-5 rounded-md bg-zinc-200 dark:bg-zinc-800 shrink-0" />
              <div class="w-full space-y-1.5">
                <div class="h-4 w-4/5 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div class="h-3 w-2/5 rounded bg-zinc-200 dark:bg-zinc-800/60" />
              </div>
            </div>

            <!-- Fix Recommendation Skeleton -->
            <div class="pt-3 border-t border-[var(--border-subtle)] space-y-1.5">
              <div class="h-3 w-40 rounded bg-emerald-500/30" />
              <div class="h-3.5 w-5/6 rounded bg-zinc-200 dark:bg-zinc-800/60" />
            </div>
          </div>

          <!-- Buttons Skeleton -->
          <div class="flex gap-2 pt-2">
            <div class="h-8 w-24 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            <div class="h-8 w-28 rounded-lg bg-zinc-200 dark:bg-zinc-800/60" />
          </div>
        </Card>
      </div>

      <!-- Findings Skeleton Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <!-- Receipt Skeleton (4 Cols) -->
        <Card :hoverable="false" class="lg:col-span-4 p-5 space-y-4 bg-zinc-100/60 dark:bg-[#1A1A1C]/60 border-zinc-200 dark:border-[#262629]">
          <div class="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
            <div class="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div class="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800/60" />
          </div>
          <div class="space-y-2.5">
            <div v-for="j in 4" :key="j" class="flex justify-between">
              <div class="h-3 w-3/5 rounded bg-zinc-200 dark:bg-zinc-800/70" />
              <div class="h-3 w-10 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          </div>
          <div class="pt-3 border-t border-dashed border-zinc-700 flex justify-between">
            <div class="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div class="h-5 w-12 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </Card>

        <!-- Findings Cards Skeleton (8 Cols) -->
        <div class="lg:col-span-8 space-y-3">
          <div class="flex items-center justify-between">
            <div class="h-3 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div class="h-3 w-32 rounded bg-zinc-200 dark:bg-zinc-800/60" />
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card
              v-for="k in 4"
              :key="k"
              :hoverable="false"
              class="p-4 space-y-2.5 bg-zinc-100/60 dark:bg-[#1A1A1C]/60 border-zinc-200 dark:border-[#262629]"
            >
              <div class="flex items-center justify-between">
                <div class="h-4 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                <div class="h-3 w-12 rounded bg-rose-500/20" />
              </div>
              <div class="h-4 w-4/5 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div class="h-10 rounded bg-black/30 border border-white/5" />
              <div class="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-800/50" />
            </Card>
          </div>
        </div>
      </div>
    </div>

    <!-- Results Section -->
    <div v-else-if="inspection" class="space-y-6 pt-2">
      <!-- Top Bento Overview: Score & Roasting Verdict -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <!-- Slop Score Card (5 Cols) -->
        <Card :hoverable="false" class="lg:col-span-5 p-6 flex flex-col justify-between space-y-6">
          <div class="space-y-1">
            <span class="text-[11px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
              SLOP INDEX
            </span>
            <div class="flex items-baseline gap-3">
              <span class="text-6xl font-extrabold tracking-tighter" :class="scoreColorClass.split(' ')[0]">
                {{ inspection.score }}%
              </span>
              <span class="text-xs text-[var(--text-secondary)] font-mono">
                / 100% Slop
              </span>
            </div>
            <p class="text-xs font-medium text-[var(--text-primary)] pt-1">
              {{ roastData?.verdict || inspection.verdictLabel }}
            </p>
          </div>

          <!-- Score Gauge Meter Bar -->
          <div class="space-y-1.5">
            <div class="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-700"
                :class="inspection.score > 60 ? 'bg-rose-500' : inspection.score > 35 ? 'bg-amber-500' : 'bg-emerald-500'"
                :style="{ width: `${inspection.score}%` }"
              />
            </div>
            <div class="flex justify-between text-[10px] font-mono text-[var(--text-tertiary)]">
              <span>0% Human Craft</span>
              <span>100% Robot Slop</span>
            </div>
          </div>

          <!-- Target Metadata -->
          <div class="pt-3 border-t border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-secondary)] flex justify-between">
            <span>Target: {{ inspection.host }}</span>
            <span>Words: {{ inspection.stats.words || 'Screenshot' }}</span>
          </div>
        </Card>

        <!-- AI Roasting Card (7 Cols) -->
        <Card :hoverable="false" class="lg:col-span-7 p-6 space-y-5 bg-gradient-to-br from-[var(--bg-card)] to-zinc-900/40 border-[var(--border-card)]">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Flame class="w-4 h-4 text-rose-500" />
              <span class="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                {{ locale === 'id' ? 'VONIS AI ROASTER' : 'AI ROASTER VERDICT' }}
              </span>
            </div>
            <Badge v-if="roastData?.model" variant="outline" size="sm" class="text-[10px] font-mono">
              {{ roastData.model }}
            </Badge>
          </div>

          <!-- Loading Roast Shimmer -->
          <div v-if="isRoasting" class="py-6 space-y-3 animate-pulse">
            <div class="h-4 bg-zinc-700/30 rounded w-3/4" />
            <div class="h-4 bg-zinc-700/30 rounded w-5/6" />
            <div class="h-4 bg-zinc-700/30 rounded w-1/2" />
          </div>

          <!-- Roasting List -->
          <div v-else class="space-y-3.5">
            <div
              v-for="(r, idx) in roastData?.roasts || inspection.findings.slice(0, 3)"
              :key="idx"
              class="flex items-start gap-3 text-xs leading-relaxed"
            >
              <div class="w-5 h-5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono flex items-center justify-center shrink-0 text-[11px]">
                {{ idx + 1 }}
              </div>
              <div class="space-y-0.5">
                <p class="text-sm font-medium text-[var(--text-primary)]">
                  {{ 'line' in r ? r.line : r.roast }}
                </p>
                <span class="text-[11px] font-mono text-zinc-500">
                  {{ 'evidence' in r ? r.evidence : r.quotes[0] || r.label }}
                </span>
              </div>
            </div>

            <!-- Single Practical Fix -->
            <div class="pt-3 border-t border-[var(--border-subtle)] space-y-1">
              <span class="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5">
                <ShieldCheck class="w-3.5 h-3.5" />
                {{ locale === 'id' ? 'Saran Perbaikan Paling Mendesak:' : 'Most Urgent Fix Recommendation:' }}
              </span>
              <p class="text-xs text-[var(--text-secondary)] leading-relaxed">
                {{ roastData?.fix || (locale === 'id' ? 'Hapus elemen rounded-full blur-3xl dan gunakan tipografi yang berkarakter.' : 'Remove floating blurred orbs and adopt unique typography.') }}
              </p>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-wrap items-center gap-2 pt-2">
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
              {{ locale === 'id' ? 'Coba Web Lain' : 'Try Another Web' }}
            </Button>
          </div>
        </Card>
      </div>

      <!-- Slop Receipt & Detailed Findings Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <!-- Slop Receipt Column (4 Cols) -->
        <Card :hoverable="false" class="lg:col-span-4 p-5 space-y-4 font-mono text-xs">
          <div class="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)] text-[var(--text-secondary)]">
            <div class="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
              <Receipt class="w-4 h-4" />
              <span>SLOP RECEIPT</span>
            </div>
            <span>{{ inspection.host }}</span>
          </div>

          <!-- Items Breakdown -->
          <div class="space-y-2 text-[11px]">
            <div
              v-for="f in inspection.findings"
              :key="f.key"
              class="flex justify-between items-baseline gap-2"
            >
              <span class="truncate text-[var(--text-secondary)]">{{ f.label }}</span>
              <span class="text-rose-400 font-bold shrink-0">+{{ f.pts }}</span>
            </div>
            <div
              v-for="c in inspection.credits"
              :key="c.label"
              class="flex justify-between items-baseline gap-2 text-emerald-400"
            >
              <span class="truncate">{{ c.label }}</span>
              <span class="font-bold shrink-0">-{{ c.pts }}</span>
            </div>
          </div>

          <!-- Receipt Total -->
          <div class="pt-3 border-t border-dashed border-zinc-700 flex justify-between items-baseline">
            <span class="text-xs uppercase text-[var(--text-secondary)]">
              {{ locale === 'id' ? 'Total Dosa AI:' : 'Total Slop Crimes:' }}
            </span>
            <span class="text-lg font-extrabold" :class="scoreColorClass.split(' ')[0]">
              {{ inspection.score }}%
            </span>
          </div>
        </Card>

        <!-- Detailed Evidence Bento Grid (8 Cols) -->
        <div class="lg:col-span-8 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
              {{ locale === 'id' ? `DETAIL TEMUAN BUKTI (${inspection.findings.length})` : `EVIDENCE FINDINGS (${inspection.findings.length})` }}
            </span>
            <span class="text-[11px] font-mono text-zinc-500">
              {{ locale === 'id' ? 'Kutipan Langsung dari Source Code' : 'Direct Source Code Quotes' }}
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card
              v-for="item in inspection.findings"
              :key="item.key"
              :hoverable="false"
              class="p-4 space-y-2"
            >
              <div class="flex items-center justify-between">
                <Badge
                  variant="outline"
                  size="sm"
                  class="text-[10px] font-mono capitalize"
                  :class="categoryBadgeClass(item.cat)"
                >
                  {{ item.cat }}
                </Badge>
                <span class="text-xs font-mono font-bold text-rose-400">+{{ item.pts }} pts</span>
              </div>

              <div class="text-xs font-semibold text-[var(--text-primary)]">
                {{ item.label }}
              </div>

              <div v-if="item.quotes.length" class="p-2 rounded bg-black/40 border border-white/5 font-mono text-[11px] text-zinc-400 space-y-1">
                <div v-for="(q, qidx) in item.quotes" :key="qidx" class="truncate">
                  "{{ q }}"
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
