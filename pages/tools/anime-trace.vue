<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  ScanSearch,
  Upload,
  Link as LinkIcon,
  Clipboard,
  ExternalLink,
  Film,
  Clock,
  Sparkles,
  RefreshCw,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Layers,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  Tv,
  Calendar,
  Building
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import { useI18n } from '~/composables/useI18n'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'
import Card from '~/components/ui/Card.vue'
import Input from '~/components/ui/Input.vue'
import type { TraceMoeResponse, TraceMoeResult, AniListInfo } from '~/types/anime'

const toast = useToast()
const { t, locale } = useI18n()

useHead({
  title: 'Anime Scene Search — Identify Anime by Screenshot Frame | Avttr Studio',
  meta: [
    {
      name: 'description',
      content: 'Identify any anime from a single screenshot frame. Get exact episode, timestamp, titles, and live video preview powered by trace.moe.'
    }
  ]
})

// Input States
const imageUrlInput = ref('')
const previewImageUrl = ref<string | null>(null)
const isAnalyzing = ref(false)
const isDragging = ref(false)
const cutBorders = ref(true)
const fileInputRef = ref<HTMLInputElement | null>(null)
const errorMsg = ref<string | null>(null)

// Results State
const searchResults = ref<TraceMoeResult[]>([])
const selectedMatchIndex = ref<number>(0)
const previewMode = ref<'video' | 'image'>('video')

// Quota HUD State
const dailyQuota = ref<number | null>(null)
const dailyQuotaUsed = ref<number | null>(null)
const rateLimitRemaining = ref<number | null>(null)

// Video Player State
const isVideoMuted = ref(true)
const videoPlayerRef = ref<HTMLVideoElement | null>(null)

// Sample Screenshots for 1-click test
const samplePresets = [
  {
    title: 'Gochuumon wa Usagi Desuka?',
    label: 'Chino & Rabbit (Official Demo)',
    url: 'https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg',
    thumb: 'https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg'
  },
  {
    title: 'Suzume no Tojimari',
    label: 'Suzume & Chair',
    url: 'https://raw.githubusercontent.com/soruly/trace.moe-api/master/demo.jpg',
    thumb: 'https://raw.githubusercontent.com/soruly/trace.moe-api/master/demo.jpg'
  }
]

// Computed Active Match
const currentMatch = computed<TraceMoeResult | null>(() => {
  if (!searchResults.value.length) return null
  return searchResults.value[selectedMatchIndex.value] || searchResults.value[0]
})

// Helper: Extract AniList metadata safely
const currentAniList = computed<AniListInfo | null>(() => {
  if (!currentMatch.value || typeof currentMatch.value.anilist === 'number') {
    return null
  }
  return currentMatch.value.anilist as AniListInfo
})

// Downscale image on client canvas for fast, resource-efficient upload (~60-90KB)
const downscaleImageForSearch = async (fileOrBlob: Blob): Promise<Blob> => {
  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(fileOrBlob)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const MAX_DIM = 720
      let { width, height } = img
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width)
          width = MAX_DIM
        } else {
          width = Math.round((width * MAX_DIM) / height)
          height = MAX_DIM
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(fileOrBlob)
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          resolve(blob || fileOrBlob)
        },
        'image/jpeg',
        0.85
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(fileOrBlob)
    }
    img.src = objectUrl
  })
}

// Perform Search Core
const runSearch = async (blob: Blob | null, externalUrl?: string) => {
  isAnalyzing.value = true
  errorMsg.value = null
  searchResults.value = []
  selectedMatchIndex.value = 0

  const queryParams = new URLSearchParams()
  queryParams.set('anilistInfo', '')
  if (cutBorders.value) {
    queryParams.set('cutBorders', '')
  }

  try {
    let data: TraceMoeResponse
    let headers: Headers | null = null

    if (externalUrl) {
      queryParams.set('url', externalUrl)
      // Direct browser fetch first
      try {
        const res = await fetch(`https://api.trace.moe/search?${queryParams.toString()}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        headers = res.headers
        data = await res.json()
      } catch (err) {
        // Fallback to Nitro server proxy
        data = await $fetch<TraceMoeResponse>('/api/tools/anime-trace', {
          method: 'POST',
          body: { url: externalUrl, cutBorders: cutBorders.value }
        })
      }
    } else if (blob) {
      // Downscale image to lightweight JPEG before sending
      const optimizedBlob = await downscaleImageForSearch(blob)

      // Direct client fetch to preserve Avttr server RAM & bandwidth
      try {
        const res = await fetch(`https://api.trace.moe/search?${queryParams.toString()}`, {
          method: 'POST',
          body: optimizedBlob,
          headers: { 'Content-Type': 'image/jpeg' }
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        headers = res.headers
        data = await res.json()
      } catch (err) {
        // Fallback to server route using base64
        const reader = new FileReader()
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(optimizedBlob)
        })
        const base64 = await base64Promise
        data = await $fetch<TraceMoeResponse>('/api/tools/anime-trace', {
          method: 'POST',
          body: { imageBase64: base64, cutBorders: cutBorders.value }
        })
      }
    } else {
      throw new Error('No image provided')
    }

    if (data.error) {
      throw new Error(data.error)
    }

    searchResults.value = data.result || []

    // Update Quota HUD
    if (data.quota !== undefined) dailyQuota.value = data.quota
    if (data.quotaUsed !== undefined) dailyQuotaUsed.value = data.quotaUsed
    if (headers) {
      const remaining = headers.get('x-ratelimit-remaining') || headers.get('ratelimit-remaining')
      if (remaining) rateLimitRemaining.value = parseInt(remaining, 10)
    }

    if (searchResults.value.length > 0) {
      toast.success(
        locale.value === 'id' ? 'Adegan Ditemukan!' : 'Scene Identified!',
        locale.value === 'id'
          ? `Ditemukan ${searchResults.value.length} kecocokan frame dari database trace.moe.`
          : `Found ${searchResults.value.length} frame matches from trace.moe database.`
      )
    } else {
      toast.warning(
        locale.value === 'id' ? 'Tidak Ada Kecocokan' : 'No Matches Found',
        locale.value === 'id'
          ? 'Coba gunakan screenshot dengan resolusi lebih jelas tanpa filter berat.'
          : 'Try another clear frame screenshot without heavy filters.'
      )
    }
  } catch (err: any) {
    errorMsg.value = err.data?.statusMessage || err.message || 'Failed to search anime scene'
    toast.error(
      locale.value === 'id' ? 'Gagal Mencari' : 'Search Failed',
      errorMsg.value || 'Could not connect to trace.moe API'
    )
  } finally {
    isAnalyzing.value = false
  }
}

// Handlers
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    loadLocalFile(target.files[0])
  }
}

const loadLocalFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    toast.error('Invalid File', 'Please select an image file (PNG, JPG, WebP).')
    return
  }
  previewImageUrl.value = URL.createObjectURL(file)
  imageUrlInput.value = ''
  runSearch(file)
}

const handleUrlSearch = () => {
  const trimmed = imageUrlInput.value.trim()
  if (!trimmed) {
    toast.warning('URL Required', 'Please enter a direct image URL.')
    return
  }
  previewImageUrl.value = trimmed
  runSearch(null, trimmed)
}

const handlePasteFromClipboard = async () => {
  try {
    const clipboardItems = await navigator.clipboard.read()
    for (const item of clipboardItems) {
      const imageType = item.types.find((type) => type.startsWith('image/'))
      if (imageType) {
        const blob = await item.getType(imageType)
        previewImageUrl.value = URL.createObjectURL(blob)
        imageUrlInput.value = ''
        toast.success('Image Pasted', 'Analyzing image from clipboard...')
        runSearch(blob)
        return
      }
    }
    toast.warning('No Image in Clipboard', 'Please copy an image or take a screenshot first (Win+Shift+S or Cmd+Shift+4).')
  } catch (err) {
    toast.error('Clipboard Access Denied', 'Press Ctrl+V anywhere on this page to paste your screenshot directly.')
  }
}

const handleSampleClick = (sample: typeof samplePresets[0]) => {
  previewImageUrl.value = sample.url
  imageUrlInput.value = sample.url
  runSearch(null, sample.url)
}

const handleDrop = (event: DragEvent) => {
  isDragging.value = false
  if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
    loadLocalFile(event.dataTransfer.files[0])
  }
}

// Global paste listener
const handleGlobalPaste = (event: ClipboardEvent) => {
  const items = event.clipboardData?.items
  if (!items) return
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.startsWith('image/')) {
      const file = items[i].getAsFile()
      if (file) {
        previewImageUrl.value = URL.createObjectURL(file)
        imageUrlInput.value = ''
        toast.success('Image Pasted', 'Analyzing pasted screenshot...')
        runSearch(file)
        event.preventDefault()
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

// Utility Formatters
const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const getSimilarityInfo = (sim: number) => {
  const pct = (sim * 100).toFixed(1)
  if (sim >= 0.87) {
    return {
      pct: `${pct}%`,
      label: locale.value === 'id' ? 'Tingkat Akurasi Tinggi' : 'High Accuracy Match',
      class: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
    }
  } else if (sim >= 0.70) {
    return {
      pct: `${pct}%`,
      label: locale.value === 'id' ? 'Kemungkinan Cocok' : 'Probable Match',
      class: 'border-amber-500/40 bg-amber-500/10 text-amber-400'
    }
  } else {
    return {
      pct: `${pct}%`,
      label: locale.value === 'id' ? 'Akurasi Rendah' : 'Low Confidence',
      class: 'border-zinc-600/40 bg-zinc-600/10 text-zinc-400'
    }
  }
}

const resetAll = () => {
  previewImageUrl.value = null
  imageUrlInput.value = ''
  searchResults.value = []
  errorMsg.value = null
  if (fileInputRef.value) fileInputRef.value.value = ''
}
</script>

<template>
  <div class="space-y-6 pb-12 w-full">
    <!-- Breadcrumb & Header Flex Row -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="space-y-1">
        <!-- Breadcrumbs -->
        <nav class="flex items-center gap-1.5 text-xs font-mono text-[var(--text-tertiary)]">
          <NuxtLink to="/" class="hover:text-[var(--text-primary)] transition-colors">Dashboard</NuxtLink>
          <span>/</span>
          <span>Assets</span>
          <span>/</span>
          <span class="text-[var(--text-primary)] font-medium">Anime Scene Search</span>
        </nav>
        <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          {{ t.tools['anime-trace']?.title || 'Anime Scene Search' }}
        </h1>
        <p class="text-xs sm:text-sm text-[var(--text-secondary)]">
          {{ t.tools['anime-trace']?.description || 'Trace back any anime screenshot frame to its exact title, episode number, and timestamp with video preview.' }}
        </p>
      </div>

      <!-- Engine & Quota Badges -->
      <div class="flex items-center gap-2 flex-wrap">
        <div
          v-if="dailyQuota !== null"
          class="flex items-center gap-1.5 px-3 py-1 bg-[#1E1E22] border border-[#2E2E2E] rounded-full text-xs text-[var(--text-secondary)]"
          title="Daily IP Search Quota"
        >
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Quota: <strong class="text-white">{{ dailyQuota - (dailyQuotaUsed || 0) }}</strong> / {{ dailyQuota }}</span>
        </div>
        <Badge variant="badge">trace.moe Engine</Badge>
        <Badge variant="outline">Client Optimized</Badge>
      </div>
    </div>

    <!-- Hidden native file input -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/png,image/jpeg,image/webp,image/avif,image/bmp"
      class="hidden"
      @change="handleFileSelect"
    />

    <!-- Input Deck (Omnibox + Standalone Dropzone + Sample Presets) -->
    <div class="space-y-4">
      <!-- URL Omnibox + Actions -->
      <Card class="p-3 sm:p-4">
        <div class="flex flex-col sm:flex-row gap-2">
          <div class="relative flex-1">
            <LinkIcon class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <Input
              v-model="imageUrlInput"
              placeholder="Paste anime image URL (e.g. https://.../screenshot.jpg)..."
              class="pl-10 h-10 text-xs sm:text-sm w-full bg-[#141416] border-[#2E2E2E] text-white"
              @keydown.enter="handleUrlSearch"
            />
          </div>

          <div class="flex items-center gap-2">
            <Button
              id="btn-search-url"
              variant="primary"
              class="h-10 px-4 text-xs font-medium flex items-center gap-1.5"
              :disabled="isAnalyzing || !imageUrlInput.trim()"
              @click="handleUrlSearch"
            >
              <ScanSearch class="w-4 h-4" />
              <span>{{ locale === 'id' ? 'Cari Adegan' : 'Search Scene' }}</span>
            </Button>

            <Button
              id="btn-paste-image"
              variant="secondary"
              class="h-10 px-3.5 text-xs font-medium flex items-center gap-1.5 border-[#2E2E2E]"
              :disabled="isAnalyzing"
              @click="handlePasteFromClipboard"
            >
              <Clipboard class="w-4 h-4 text-[var(--text-secondary)]" />
              <span class="hidden sm:inline">Paste</span>
              <kbd class="hidden md:inline-block px-1 py-0.2 bg-[#212121] border border-[#2E2E2E] rounded text-[10px] text-[var(--text-tertiary)] font-mono">Ctrl+V</kbd>
            </Button>

            <Button
              v-if="previewImageUrl || searchResults.length"
              variant="ghost"
              class="h-10 px-2.5 text-xs text-[var(--text-tertiary)] hover:text-white"
              title="Reset"
              @click="resetAll"
            >
              <X class="w-4 h-4" />
            </Button>
          </div>
        </div>

        <!-- Border Cut & Speed Settings -->
        <div class="flex items-center justify-between mt-3 pt-3 border-t border-[#2E2E2E] text-xs text-[var(--text-secondary)] flex-wrap gap-2">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input
              v-model="cutBorders"
              type="checkbox"
              class="rounded border-[#2E2E2E] bg-[#141416] text-white focus:ring-0 w-3.5 h-3.5 accent-[#2E2E2E]"
            />
            <span>{{ locale === 'id' ? 'Auto Cut Black Borders (Rekomendasi untuk screenshot 16:9)' : 'Auto Cut Black Borders (Recommended for wide screenshots)' }}</span>
          </label>

          <div class="flex items-center gap-2 text-[11px] text-[var(--text-tertiary)] font-mono">
            <Sparkles class="w-3.5 h-3.5 text-emerald-400" />
            <span>Downscaled to 720p client-side (~60KB)</span>
          </div>
        </div>
      </Card>

      <!-- Standardized Section 10 Standalone Dropzone (shown if no preview yet) -->
      <div
        v-if="!previewImageUrl && !isAnalyzing"
        class="relative border-2 border-dashed rounded-[14px] p-8 sm:p-14 border-[#2E2E2E] bg-[#141416] hover:border-[#3E3E3E] text-center cursor-pointer select-none transition-colors"
        :class="isDragging ? 'border-white bg-[#1A1A1E]' : ''"
        @click="fileInputRef?.click()"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
      >
        <div class="w-12 h-12 mx-auto rounded-xl bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-white shadow-xs">
          <ScanSearch class="w-6 h-6" />
        </div>
        <div class="text-sm font-semibold text-[var(--text-primary)] mt-3">
          {{ locale === 'id' ? 'Tarik & lepas screenshot anime di sini atau browse file' : 'Drop your anime screenshot here or browse' }}
        </div>
        <div class="text-xs text-[var(--text-secondary)] mt-1">
          {{ locale === 'id' ? 'Mendukung PNG, JPG, WebP. Diproses 100% cepat di client.' : 'Supports PNG, JPG, WebP. 100% fast client-side processing.' }}
        </div>

        <!-- Sample Presets Toolbar -->
        <div class="mt-6 flex items-center justify-center gap-2 flex-wrap" @click.stop>
          <span class="text-[11px] text-[var(--text-tertiary)] font-mono uppercase tracking-wider">Test Sample:</span>
          <button
            v-for="sample in samplePresets"
            :key="sample.url"
            class="px-2.5 py-1 text-xs bg-[#212121] hover:bg-[#2A2A2E] border border-[#2E2E2E] rounded-md text-[var(--text-secondary)] hover:text-white transition-colors flex items-center gap-1.5"
            @click="handleSampleClick(sample)"
          >
            <Film class="w-3 h-3" />
            <span>{{ sample.label }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Analyzing Skeleton Indicator -->
    <Card v-if="isAnalyzing" class="p-8 sm:p-12 text-center space-y-4">
      <div class="w-12 h-12 mx-auto rounded-xl bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-white animate-pulse">
        <RefreshCw class="w-6 h-6 animate-spin text-white" />
      </div>
      <div class="space-y-1">
        <div class="text-base font-semibold text-[var(--text-primary)]">
          {{ locale === 'id' ? 'Memindai Database Anime...' : 'Scanning Anime Database...' }}
        </div>
        <p class="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
          {{ locale === 'id' ? 'Mencocokkan fingerprint warna frame dengan jutaan episode anime di trace.moe.' : 'Matching frame color layout against millions of anime video scenes on trace.moe.' }}
        </p>
      </div>
    </Card>

    <!-- Error State Alert -->
    <Card v-else-if="errorMsg && !searchResults.length" class="p-6 border-red-500/30 bg-red-500/5">
      <div class="flex items-start gap-3">
        <AlertCircle class="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div class="space-y-1 text-xs">
          <div class="font-semibold text-red-300">
            {{ locale === 'id' ? 'Pencarian Gagal' : 'Search Error' }}
          </div>
          <div class="text-[var(--text-secondary)]">{{ errorMsg }}</div>
          <p class="text-[11px] text-[var(--text-tertiary)] mt-2">
            Tip: Pastikan screenshot berasal dari tayangan anime resmi (bukan fanart, manga komik, atau video live action).
          </p>
        </div>
      </div>
    </Card>

    <!-- Results Section -->
    <div v-else-if="searchResults.length > 0 && currentMatch" class="space-y-6">
      <!-- Best / Active Match Hero Deck -->
      <Card class="p-4 sm:p-6 space-y-6">
        <!-- Top Info Header Flex -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#2E2E2E]">
          <div class="space-y-1.5 flex-1 min-w-0">
            <!-- Anime Primary Title -->
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-lg sm:text-xl font-bold text-white tracking-tight break-words">
                {{ currentAniList?.title?.romaji || currentAniList?.title?.english || currentMatch.filename }}
              </h2>
              <!-- Similarity Badge -->
              <span
                class="px-2.5 py-0.5 rounded-full text-xs font-semibold border flex items-center gap-1"
                :class="getSimilarityInfo(currentMatch.similarity).class"
              >
                <CheckCircle2 class="w-3 h-3" />
                {{ getSimilarityInfo(currentMatch.similarity).pct }} ({{ getSimilarityInfo(currentMatch.similarity).label }})
              </span>
            </div>

            <!-- Alternative Titles -->
            <div class="flex items-center gap-2 text-xs text-[var(--text-secondary)] flex-wrap">
              <span v-if="currentAniList?.title?.english && currentAniList.title.english !== currentAniList.title.romaji" class="text-white/80">
                {{ currentAniList.title.english }}
              </span>
              <span v-if="currentAniList?.title?.native" class="text-[var(--text-tertiary)] font-mono">
                • {{ currentAniList.title.native }}
              </span>
            </div>
          </div>

          <!-- Quick Episode & Timestamp Pill -->
          <div class="flex items-center gap-3 shrink-0">
            <div class="px-3 py-1.5 rounded-lg bg-[#141416] border border-[#2E2E2E] text-center">
              <div class="text-[10px] text-[var(--text-tertiary)] uppercase font-mono">Episode</div>
              <div class="text-sm font-bold text-white font-mono">
                {{ currentMatch.episode !== null && currentMatch.episode !== undefined ? currentMatch.episode : '1 / OVA' }}
              </div>
            </div>

            <div class="px-3 py-1.5 rounded-lg bg-[#141416] border border-[#2E2E2E] text-center">
              <div class="text-[10px] text-[var(--text-tertiary)] uppercase font-mono">Timestamp</div>
              <div class="text-sm font-bold text-emerald-400 font-mono flex items-center gap-1">
                <Clock class="w-3 h-3" />
                <span>{{ formatTime(currentMatch.at) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Dual Comparison Layout: Uploaded Frame vs. Matched Scene -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- Left: User's Original Screenshot -->
          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
              <span class="flex items-center gap-1.5 text-white font-medium">
                <ImageIcon class="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                <span>Your Screenshot</span>
              </span>
              <span class="text-[11px] text-[var(--text-tertiary)]">Input Query</span>
            </div>

            <div class="aspect-video rounded-lg overflow-hidden bg-[#141416] border border-[#2E2E2E] flex items-center justify-center relative">
              <img
                v-if="previewImageUrl"
                :src="previewImageUrl"
                alt="Your input screenshot"
                class="w-full h-full object-contain"
              />
              <div v-else class="text-xs text-[var(--text-tertiary)]">No preview</div>
            </div>
          </div>

          <!-- Right: Matched Frame / Video Clip Preview -->
          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs font-mono">
              <span class="flex items-center gap-1.5 text-white font-medium">
                <Film class="w-3.5 h-3.5 text-emerald-400" />
                <span>trace.moe Matched Scene</span>
              </span>

              <!-- Mode Switcher: Video vs Exact Frame -->
              <div class="flex items-center gap-1 bg-[#141416] p-0.5 rounded-md border border-[#2E2E2E]">
                <button
                  class="px-2 py-0.5 rounded text-[11px] transition-colors"
                  :class="previewMode === 'video' ? 'bg-[#2E2E2E] text-white font-medium' : 'text-[var(--text-tertiary)] hover:text-white'"
                  @click="previewMode = 'video'"
                >
                  Video Clip
                </button>
                <button
                  class="px-2 py-0.5 rounded text-[11px] transition-colors"
                  :class="previewMode === 'image' ? 'bg-[#2E2E2E] text-white font-medium' : 'text-[var(--text-tertiary)] hover:text-white'"
                  @click="previewMode = 'image'"
                >
                  Exact Frame
                </button>
              </div>
            </div>

            <div class="aspect-video rounded-lg overflow-hidden bg-[#141416] border border-[#2E2E2E] flex items-center justify-center relative group">
              <!-- Video Preview Mode -->
              <video
                v-if="previewMode === 'video' && currentMatch.video"
                ref="videoPlayerRef"
                :key="currentMatch.video"
                :src="currentMatch.video"
                autoplay
                loop
                :muted="isVideoMuted"
                playsinline
                controls
                class="w-full h-full object-contain"
              />

              <!-- Image Frame Mode -->
              <img
                v-else-if="currentMatch.image"
                :src="currentMatch.image"
                alt="Matched Anime Frame"
                class="w-full h-full object-contain"
              />

              <!-- Audio Mute Quick Toggle overlay (for video mode) -->
              <button
                v-if="previewMode === 'video' && currentMatch.video"
                class="absolute bottom-10 right-3 p-1.5 rounded-md bg-black/70 border border-white/20 text-white hover:bg-black transition-colors"
                title="Toggle Mute"
                @click="isVideoMuted = !isVideoMuted"
              >
                <VolumeX v-if="isVideoMuted" class="w-3.5 h-3.5" />
                <Volume2 v-else class="w-3.5 h-3.5 text-emerald-400" />
              </button>
            </div>
          </div>
        </div>

        <!-- AniList Anime Info & External Stream Links -->
        <div v-if="currentAniList" class="p-4 rounded-lg bg-[#141416] border border-[#2E2E2E] space-y-3">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div class="space-y-0.5">
              <span class="text-[var(--text-tertiary)] flex items-center gap-1">
                <Tv class="w-3 h-3" />
                Format / Status
              </span>
              <div class="text-white font-medium">
                {{ currentAniList.format || 'TV' }} • {{ currentAniList.status || 'Finished' }}
              </div>
            </div>

            <div class="space-y-0.5">
              <span class="text-[var(--text-tertiary)] flex items-center gap-1">
                <Calendar class="w-3 h-3" />
                Season / Year
              </span>
              <div class="text-white font-medium">
                {{ currentAniList.season || '' }} {{ currentAniList.seasonYear || '' }}
              </div>
            </div>

            <div class="space-y-0.5">
              <span class="text-[var(--text-tertiary)] flex items-center gap-1">
                <Building class="w-3 h-3" />
                Studio
              </span>
              <div class="text-white font-medium truncate">
                {{ currentAniList.studios?.edges?.[0]?.node?.name || 'Studio Gallop' }}
              </div>
            </div>

            <div class="space-y-0.5">
              <span class="text-[var(--text-tertiary)] flex items-center gap-1">
                <Clock class="w-3 h-3" />
                Total Episodes
              </span>
              <div class="text-white font-medium">
                {{ currentAniList.episodes ? `${currentAniList.episodes} eps` : 'N/A' }}
              </div>
            </div>
          </div>

          <!-- Genres list -->
          <div v-if="currentAniList.genres?.length" class="flex items-center gap-1.5 flex-wrap pt-2 border-t border-[#212121]">
            <span class="text-[11px] text-[var(--text-tertiary)] font-mono">Genres:</span>
            <span
              v-for="genre in currentAniList.genres"
              :key="genre"
              class="px-2 py-0.5 rounded-full text-[11px] bg-[#212121] border border-[#2E2E2E] text-[var(--text-secondary)]"
            >
              {{ genre }}
            </span>
          </div>

          <!-- External Links -->
          <div class="flex items-center gap-2 flex-wrap pt-2">
            <a
              v-if="currentAniList.siteUrl"
              :href="currentAniList.siteUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-xs text-[#1447E6] hover:underline"
            >
              <span>View on AniList</span>
              <ExternalLink class="w-3 h-3" />
            </a>

            <a
              v-if="currentAniList.idMal"
              :href="`https://myanimelist.net/anime/${currentAniList.idMal}`"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-xs text-[#2E51A2] hover:underline ml-3"
            >
              <span>MyAnimeList</span>
              <ExternalLink class="w-3 h-3" />
            </a>

            <span class="text-[var(--text-tertiary)] mx-1">•</span>
            <span class="text-[11px] text-[var(--text-tertiary)] font-mono truncate">
              File: {{ currentMatch.filename }}
            </span>
          </div>
        </div>
      </Card>

      <!-- Candidate Matches Grid (Other potential scenes) -->
      <div v-if="searchResults.length > 1" class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-white flex items-center gap-2">
            <Layers class="w-4 h-4 text-[var(--text-secondary)]" />
            <span>{{ locale === 'id' ? 'Kandidat Adegan Lainnya' : 'Other Candidate Matches' }} ({{ searchResults.length }})</span>
          </h3>
          <span class="text-xs text-[var(--text-tertiary)]">
            {{ locale === 'id' ? 'Klik kartu untuk beralih preview' : 'Click a card to switch preview' }}
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div
            v-for="(item, idx) in searchResults"
            :key="item.image + idx"
            class="p-3 rounded-xl border bg-[#141416] hover:bg-[#1A1A1E] transition-all cursor-pointer flex gap-3 select-none"
            :class="selectedMatchIndex === idx ? 'border-white shadow-xs' : 'border-[#2E2E2E] hover:border-[#3E3E3E]'"
            @click="selectedMatchIndex = idx"
          >
            <!-- Thumbnail -->
            <div class="w-24 h-16 rounded-md overflow-hidden bg-[#212121] shrink-0 relative">
              <img :src="item.image" alt="Scene thumbnail" class="w-full h-full object-cover" />
              <div class="absolute bottom-0.5 right-0.5 px-1 py-0.2 bg-black/80 rounded text-[9px] text-white font-mono">
                {{ formatTime(item.at) }}
              </div>
            </div>

            <!-- Meta details -->
            <div class="flex-1 min-w-0 space-y-1">
              <div class="text-xs font-semibold text-white truncate" :title="typeof item.anilist !== 'number' ? item.anilist.title?.romaji || '' : item.filename">
                {{ typeof item.anilist !== 'number' ? (item.anilist.title?.romaji || item.anilist.title?.english || item.filename) : item.filename }}
              </div>

              <div class="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                <span>Ep. {{ item.episode !== null ? item.episode : '1' }}</span>
                <span
                  class="font-mono font-medium"
                  :class="item.similarity >= 0.87 ? 'text-emerald-400' : item.similarity >= 0.70 ? 'text-amber-400' : 'text-zinc-400'"
                >
                  {{ (item.similarity * 100).toFixed(1) }}%
                </span>
              </div>

              <!-- Similarity Mini Progress Bar -->
              <div class="w-full h-1 bg-[#212121] rounded-full overflow-hidden">
                <div
                  class="h-full transition-all"
                  :class="item.similarity >= 0.87 ? 'bg-emerald-500' : item.similarity >= 0.70 ? 'bg-amber-500' : 'bg-zinc-500'"
                  :style="{ width: `${item.similarity * 100}%` }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
