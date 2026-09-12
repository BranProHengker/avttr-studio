<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  ScanSearch,
  Link as LinkIcon,
  Clipboard,
  ExternalLink,
  Film,
  Clock,
  Sparkles,
  RefreshCw,
  Volume2,
  VolumeX,
  Layers,
  Image as ImageIcon,
  AlertCircle,
  X
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import { useI18n } from '~/composables/useI18n'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'
import Card from '~/components/ui/Card.vue'
import Input from '~/components/ui/Input.vue'
import type { TraceMoeResponse, TraceMoeResult, AniListInfo, TraceMoeMeResponse } from '~/types/anime'

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

// Quota State
const dailyQuota = ref<number | null>(null)
const dailyQuotaUsed = ref<number | null>(null)
const rateLimitRemaining = ref<number | null>(null)
const isLoadingQuota = ref(false)

// Video Player State
const isVideoMuted = ref(true)
const videoPlayerRef = ref<HTMLVideoElement | null>(null)

// Fetch user's IP quota from trace.moe /me endpoint
const fetchQuota = async () => {
  isLoadingQuota.value = true
  try {
    let meData: TraceMoeMeResponse
    try {
      const res = await fetch('https://api.trace.moe/me')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      meData = await res.json()
    } catch {
      meData = await $fetch<TraceMoeMeResponse>('/api/tools/anime-trace')
    }
    if (meData && typeof meData.quota === 'number') {
      dailyQuota.value = meData.quota
      dailyQuotaUsed.value = meData.quotaUsed
    }
  } catch (err) {
    // Silently handle if offline or rate limited
  } finally {
    isLoadingQuota.value = false
  }
}

// Sample Screenshots for 1-click test
const samplePresets = [
  {
    title: 'Gochuumon wa Usagi Desuka?',
    label: 'Chino & Rabbit (Official Demo)',
    url: 'https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg'
  },
  {
    title: 'Suzume no Tojimari',
    label: 'Suzume & Chair',
    url: 'https://raw.githubusercontent.com/soruly/trace.moe-api/master/demo.jpg'
  }
]

// Active Match
const currentMatch = computed<TraceMoeResult | null>(() => {
  if (!searchResults.value.length) return null
  return searchResults.value[selectedMatchIndex.value] || searchResults.value[0]
})

// AniList Metadata
const currentAniList = computed<AniListInfo | null>(() => {
  if (!currentMatch.value || typeof currentMatch.value.anilist === 'number') {
    return null
  }
  return currentMatch.value.anilist as AniListInfo
})

// AniList Aliases (combines english title, synonyms, chinese synonyms)
const animeAliases = computed<string[]>(() => {
  if (!currentAniList.value) return []
  const list: string[] = []
  const ani = currentAniList.value

  if (ani.title?.english && ani.title.english !== ani.title.romaji && ani.title.english !== ani.title.native) {
    list.push(ani.title.english)
  }
  if (ani.synonyms && Array.isArray(ani.synonyms)) {
    list.push(...ani.synonyms)
  }
  if (ani.synonyms_chinese && Array.isArray(ani.synonyms_chinese)) {
    list.push(...ani.synonyms_chinese)
  }
  if (ani.title?.chinese && !list.includes(ani.title.chinese)) {
    list.push(ani.title.chinese)
  }
  return Array.from(new Set(list.filter(Boolean)))
})

// Airing Period text
const formatAiringPeriod = computed<string>(() => {
  if (!currentAniList.value) return ''
  const start = currentAniList.value.startDate
  const end = currentAniList.value.endDate

  const formatDate = (d?: { year?: number; month?: number; day?: number } | null) => {
    if (!d || !d.year) return ''
    const parts = [d.year]
    if (d.month) parts.push(d.month)
    if (d.day) parts.push(d.day)
    return parts.join('-')
  }

  const startStr = formatDate(start)
  const endStr = formatDate(end)

  if (startStr && endStr) {
    return `Airing from ${startStr} to ${endStr}.`
  } else if (startStr) {
    return `Aired on ${startStr}.`
  }
  return ''
})

// Format Overview text
const animeFormatOverview = computed<string>(() => {
  if (!currentAniList.value) return ''
  const ani = currentAniList.value
  const parts: string[] = []
  if (ani.episodes) {
    parts.push(`${ani.episodes} episode`)
  }
  if (ani.duration) {
    parts.push(`${ani.duration}-minute`)
  }
  if (ani.format) {
    parts.push(`${ani.format}`)
  }
  parts.push('anime.')
  return parts.join(' ')
})

// Studios list
const animeStudios = computed(() => {
  if (!currentAniList.value?.studios?.edges) return []
  return currentAniList.value.studios.edges
    .map((e) => e.node)
    .filter((n): n is { id: number; name: string; siteUrl?: string } => !!n?.name)
})

// External links
const animeExternalLinks = computed(() => {
  if (!currentAniList.value?.externalLinks) return []
  return currentAniList.value.externalLinks.filter((l) => l.url && l.site)
})

// Genres string
const animeGenresText = computed(() => {
  if (!currentAniList.value?.genres?.length) return ''
  return currentAniList.value.genres.join(', ')
})

// Cover poster image
const animeCoverImage = computed(() => {
  if (!currentAniList.value?.coverImage) return ''
  return (
    currentAniList.value.coverImage.extraLarge ||
    currentAniList.value.coverImage.large ||
    currentAniList.value.coverImage.medium ||
    ''
  )
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

// Perform Search
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
      try {
        const res = await fetch(`https://api.trace.moe/search?${queryParams.toString()}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        headers = res.headers
        data = await res.json()
      } catch (err) {
        data = await $fetch<TraceMoeResponse>('/api/tools/anime-trace', {
          method: 'POST',
          body: { url: externalUrl, cutBorders: cutBorders.value }
        })
      }
    } else if (blob) {
      const optimizedBlob = await downscaleImageForSearch(blob)
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

    if (data.quota !== undefined) dailyQuota.value = data.quota
    if (data.quotaUsed !== undefined) dailyQuotaUsed.value = data.quotaUsed
    if (headers) {
      const remaining = headers.get('x-ratelimit-remaining') || headers.get('ratelimit-remaining')
      if (remaining) rateLimitRemaining.value = parseInt(remaining, 10)
    }

    if (searchResults.value.length > 0) {
      toast.success(
        locale.value === 'id' ? 'Adegan Ditemukan' : 'Scene Identified',
        locale.value === 'id'
          ? `Ditemukan ${searchResults.value.length} kecocokan frame.`
          : `Found ${searchResults.value.length} frame matches.`
      )
    } else {
      toast.warning(
        locale.value === 'id' ? 'Tidak Ada Kecocokan' : 'No Matches Found',
        locale.value === 'id'
          ? 'Coba gunakan screenshot frame yang lebih jelas.'
          : 'Try another clear frame screenshot.'
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
    toast.warning('No Image in Clipboard', 'Please copy an image or take a screenshot first.')
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
  fetchQuota()
})

onUnmounted(() => {
  window.removeEventListener('paste', handleGlobalPaste)
})

// Format seconds into MM:SS
const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
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
    <!-- Breadcrumbs & Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="space-y-1">
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

      <!-- Engine Badge -->
      <div class="flex items-center gap-2 flex-wrap text-xs text-[var(--text-secondary)] font-mono">
        <Badge variant="badge">trace.moe</Badge>
      </div>
    </div>

    <!-- Search Quota Widget (Matching trace.moe real UI) -->
    <div
      v-if="dailyQuota !== null && dailyQuotaUsed !== null"
      class="p-3.5 rounded-[14px] bg-[#141416] border border-[#2E2E2E] space-y-2 max-w-xl"
    >
      <div class="flex items-center justify-between text-xs text-[var(--text-primary)] font-normal select-none">
        <span>Search quota: {{ dailyQuotaUsed }} / {{ dailyQuota }} used</span>
        <span>{{ Math.max(0, dailyQuota - dailyQuotaUsed) }} remaining</span>
      </div>

      <!-- Progress Track & Fill -->
      <div class="w-full h-2 bg-[#2E2E32] rounded-full overflow-hidden">
        <div
          class="h-full bg-[#7086f4] rounded-full transition-all duration-300"
          :style="{ width: `${Math.min(100, Math.max(1, (dailyQuotaUsed / dailyQuota) * 100))}%` }"
        ></div>
      </div>

      <div class="text-right text-[11px] text-[var(--text-tertiary)] select-none">
        Quota will reset in 24 hours
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

    <!-- Input Section (Omnibox + Standalone Dropzone + Sample Presets) -->
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

        <!-- Options -->
        <div class="flex items-center justify-between mt-3 pt-3 border-t border-[#2E2E2E] text-xs text-[var(--text-secondary)] flex-wrap gap-2">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input
              v-model="cutBorders"
              type="checkbox"
              class="rounded border-[#2E2E2E] bg-[#141416] text-white focus:ring-0 w-3.5 h-3.5 accent-[#2E2E2E]"
            />
            <span>{{ locale === 'id' ? 'Auto Cut Black Borders (Rekomendasi untuk screenshot 16:9)' : 'Auto Cut Black Borders' }}</span>
          </label>

          <div class="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] font-mono">
            <Sparkles class="w-3.5 h-3.5 text-emerald-400" />
            <span>Downscaled client-side (~60KB)</span>
          </div>
        </div>
      </Card>

      <!-- Standardized Section 10 Standalone Dropzone (shown when no results yet) -->
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
          {{ locale === 'id' ? 'Mendukung PNG, JPG, WebP. 100% diproses cepat di browser.' : 'Supports PNG, JPG, WebP. 100% processed in browser.' }}
        </div>

        <!-- Sample Presets -->
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

    <!-- Analyzing Indicator -->
    <Card v-if="isAnalyzing" class="p-8 sm:p-12 text-center space-y-4">
      <div class="w-12 h-12 mx-auto rounded-xl bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-white animate-pulse">
        <RefreshCw class="w-6 h-6 animate-spin text-white" />
      </div>
      <div class="space-y-1">
        <div class="text-base font-semibold text-[var(--text-primary)]">
          {{ locale === 'id' ? 'Memindai Database Anime...' : 'Scanning Anime Database...' }}
        </div>
        <p class="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
          {{ locale === 'id' ? 'Mencocokkan fingerprint frame dengan arsip video trace.moe.' : 'Matching frame layout against trace.moe anime database.' }}
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
        </div>
      </div>
    </Card>

    <!-- Results Section -->
    <div v-else-if="searchResults.length > 0 && currentMatch" class="space-y-6">
      <!-- 1. Video Player & Side-by-Side Comparison -->
      <Card class="p-4 sm:p-5 space-y-4">
        <!-- Technical Meta Bar (Clean, no slop badges) -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#2E2E2E]">
          <div class="flex items-center gap-3 text-xs font-mono text-[var(--text-secondary)] flex-wrap">
            <span class="text-white font-medium">
              Episode: <strong class="text-white">{{ currentMatch.episode !== null && currentMatch.episode !== undefined ? currentMatch.episode : '1 / OVA' }}</strong>
            </span>
            <span class="text-zinc-600">•</span>
            <span>
              Time: <strong class="text-white">{{ formatTime(currentMatch.at) }}</strong>
              <span class="text-zinc-500 ml-1 font-normal">({{ currentMatch.from.toFixed(1) }}s – {{ currentMatch.to.toFixed(1) }}s)</span>
            </span>
            <span class="text-zinc-600">•</span>
            <span>
              Similarity: <strong class="text-white">{{ (currentMatch.similarity * 100).toFixed(2) }}%</strong>
            </span>
          </div>

          <!-- Video vs Exact Frame Mode Switcher -->
          <div class="flex items-center gap-1 bg-[#141416] p-0.5 rounded-md border border-[#2E2E2E] self-start sm:self-auto">
            <button
              class="px-2.5 py-1 rounded text-xs transition-colors"
              :class="previewMode === 'video' ? 'bg-[#2E2E2E] text-white font-medium' : 'text-[var(--text-tertiary)] hover:text-white'"
              @click="previewMode = 'video'"
            >
              Video Clip
            </button>
            <button
              class="px-2.5 py-1 rounded text-xs transition-colors"
              :class="previewMode === 'image' ? 'bg-[#2E2E2E] text-white font-medium' : 'text-[var(--text-tertiary)] hover:text-white'"
              @click="previewMode = 'image'"
            >
              Exact Frame
            </button>
          </div>
        </div>

        <!-- Dual Comparison Layout: Uploaded Frame vs. Matched Scene -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- Left: User's Original Screenshot -->
          <div class="space-y-1.5">
            <div class="text-[11px] font-mono text-[var(--text-tertiary)] flex items-center gap-1.5">
              <ImageIcon class="w-3.5 h-3.5" />
              <span>Your Screenshot</span>
            </div>
            <div class="aspect-video rounded-lg overflow-hidden bg-[#141416] border border-[#2E2E2E] flex items-center justify-center">
              <img
                v-if="previewImageUrl"
                :src="previewImageUrl"
                alt="Your screenshot"
                class="w-full h-full object-contain"
              />
              <div v-else class="text-xs text-[var(--text-tertiary)]">No preview</div>
            </div>
          </div>

          <!-- Right: Matched Frame / Video Clip -->
          <div class="space-y-1.5">
            <div class="text-[11px] font-mono text-[var(--text-tertiary)] flex items-center justify-between">
              <span class="flex items-center gap-1.5">
                <Film class="w-3.5 h-3.5 text-zinc-400" />
                <span>Matched Scene (trace.moe)</span>
              </span>
              <button
                v-if="previewMode === 'video' && currentMatch.video"
                class="text-[11px] text-[var(--text-secondary)] hover:text-white flex items-center gap-1"
                @click="isVideoMuted = !isVideoMuted"
              >
                <VolumeX v-if="isVideoMuted" class="w-3 h-3" />
                <Volume2 v-else class="w-3 h-3 text-white" />
                <span>{{ isVideoMuted ? 'Muted' : 'Audio On' }}</span>
              </button>
            </div>

            <div class="aspect-video rounded-lg overflow-hidden bg-[#141416] border border-[#2E2E2E] flex items-center justify-center relative">
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
              <img
                v-else-if="currentMatch.image"
                :src="currentMatch.image"
                alt="Matched Anime Frame"
                class="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>

        <!-- File Source -->
        <div class="text-[11px] text-[var(--text-tertiary)] font-mono truncate pt-2 border-t border-[#2E2E2E]">
          File: {{ currentMatch.filename }}
        </div>
      </Card>

      <!-- 2. Authentic Anime Details Card (Matches trace.moe exact UI structure from screenshot) -->
      <Card v-if="currentAniList" class="p-5 sm:p-7 space-y-3 bg-[#141416] border-[#2E2E2E]">
        <!-- Title: Native Japanese Header -->
        <div>
          <h2 class="text-xl sm:text-2xl font-normal text-white tracking-tight break-words">
            {{ currentAniList.title?.native || currentAniList.title?.romaji }}
          </h2>
          <!-- Subtitle: Romaji in soft blue -->
          <a
            :href="currentAniList.siteUrl || '#'"
            target="_blank"
            rel="noopener noreferrer"
            class="text-sm text-[#3b82f6] hover:underline break-words mt-1 block font-normal"
          >
            {{ currentAniList.title?.romaji || currentAniList.title?.english }}
          </a>
        </div>

        <!-- Dotted Divider -->
        <div class="border-b border-dotted border-zinc-700/80 my-3"></div>

        <!-- Episode & Airing Overview -->
        <div class="text-xs text-[var(--text-secondary)] space-y-1 leading-relaxed font-normal">
          <div v-if="animeFormatOverview">{{ animeFormatOverview }}</div>
          <div v-if="formatAiringPeriod">{{ formatAiringPeriod }}</div>
        </div>

        <!-- Dotted Divider -->
        <div class="border-b border-dotted border-zinc-700/80 my-3"></div>

        <!-- Two-column Layout: Data Table (Left) & Poster Art (Right) -->
        <div class="flex flex-col md:flex-row gap-6 items-start">
          <!-- Left: Definition Table with Dotted Dividers -->
          <div class="flex-1 min-w-0 w-full space-y-3 text-xs">
            <!-- Row: Alias -->
            <div v-if="animeAliases.length" class="flex flex-col sm:flex-row sm:gap-6 border-b border-dotted border-zinc-800/80 pb-3 gap-1">
              <div class="w-28 shrink-0 text-[var(--text-tertiary)] font-normal">Alias</div>
              <div class="flex-1 space-y-1 text-[var(--text-secondary)] leading-relaxed break-words">
                <div v-for="alias in animeAliases" :key="alias">{{ alias }}</div>
              </div>
            </div>

            <!-- Row: Genre -->
            <div v-if="animeGenresText" class="flex flex-col sm:flex-row sm:gap-6 border-b border-dotted border-zinc-800/80 pb-3 gap-1">
              <div class="w-28 shrink-0 text-[var(--text-tertiary)] font-normal">Genre</div>
              <div class="flex-1 text-[var(--text-secondary)]">{{ animeGenresText }}</div>
            </div>

            <!-- Row: Studio -->
            <div v-if="animeStudios.length" class="flex flex-col sm:flex-row sm:gap-6 border-b border-dotted border-zinc-800/80 pb-3 gap-1">
              <div class="w-28 shrink-0 text-[var(--text-tertiary)] font-normal">Studio</div>
              <div class="flex-1 space-y-1">
                <div v-for="std in animeStudios" :key="std.id || std.name">
                  <a
                    v-if="std.siteUrl"
                    :href="std.siteUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-[#3b82f6] hover:underline"
                  >
                    {{ std.name }}
                  </a>
                  <span v-else class="text-[var(--text-secondary)]">{{ std.name }}</span>
                </div>
              </div>
            </div>

            <!-- Row: External Links -->
            <div v-if="animeExternalLinks.length" class="flex flex-col sm:flex-row sm:gap-6 pb-2 gap-1">
              <div class="w-28 shrink-0 text-[var(--text-tertiary)] font-normal">External Links</div>
              <div class="flex-1 space-y-1">
                <div v-for="link in animeExternalLinks" :key="link.id || link.url">
                  <a
                    :href="link.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-[#3b82f6] hover:underline"
                  >
                    {{ link.site }}
                  </a>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Anime Poster Cover Image -->
          <div v-if="animeCoverImage" class="w-full sm:w-56 md:w-64 shrink-0 mx-auto md:mx-0">
            <img
              :src="animeCoverImage"
              :alt="currentAniList.title?.romaji || 'Anime Poster'"
              class="w-full h-auto object-cover border border-[#2E2E2E]"
            />
          </div>
        </div>

        <!-- Dotted Footer Divider -->
        <div class="border-b border-dotted border-zinc-700/80 my-3"></div>

        <!-- Footnote / Attribution -->
        <div class="text-right text-[11px] text-[var(--text-tertiary)] font-mono">
          Information provided by
          <a
            :href="currentAniList.siteUrl || 'https://anilist.co'"
            target="_blank"
            rel="noopener noreferrer"
            class="text-[#3b82f6] hover:underline"
          >
            anilist.co
          </a>
        </div>
      </Card>

      <!-- 3. Candidate Matches List -->
      <div v-if="searchResults.length > 1" class="space-y-3 pt-2">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] font-mono flex items-center gap-2">
            <Layers class="w-3.5 h-3.5" />
            <span>Other Matches ({{ searchResults.length }})</span>
          </h3>
          <span class="text-[11px] text-[var(--text-tertiary)] font-mono">
            Click to switch preview
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <div
            v-for="(item, idx) in searchResults"
            :key="item.image + idx"
            class="p-2.5 rounded-lg border bg-[#141416] hover:bg-[#1A1A1E] transition-colors cursor-pointer flex gap-3 select-none"
            :class="selectedMatchIndex === idx ? 'border-white' : 'border-[#2E2E2E] hover:border-[#3E3E3E]'"
            @click="selectedMatchIndex = idx"
          >
            <!-- Thumbnail -->
            <div class="w-24 h-16 rounded overflow-hidden bg-[#212121] shrink-0 relative">
              <img :src="item.image" alt="Scene thumbnail" class="w-full h-full object-cover" />
              <div class="absolute bottom-0.5 right-0.5 px-1 py-0.2 bg-black/80 rounded text-[9px] text-white font-mono">
                {{ formatTime(item.at) }}
              </div>
            </div>

            <!-- Metadata -->
            <div class="flex-1 min-w-0 space-y-1">
              <div class="text-xs font-medium text-white truncate" :title="typeof item.anilist !== 'number' ? item.anilist.title?.romaji || '' : item.filename">
                {{ typeof item.anilist !== 'number' ? (item.anilist.title?.romaji || item.anilist.title?.english || item.filename) : item.filename }}
              </div>

              <div class="flex items-center justify-between text-[11px] text-[var(--text-tertiary)] font-mono">
                <span>Ep. {{ item.episode !== null && item.episode !== undefined ? item.episode : '1' }}</span>
                <span>{{ (item.similarity * 100).toFixed(1) }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
