<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  CinemaOld as Film,
  Play,
  Pause,
  Download,
  Scissor as Scissors,
  PasteClipboard as Clipboard,
  Xmark as X,
  Check,
  ArrowRight,
  Sparks as Sparkles,
  Refresh as RefreshCw,
  Clock,
  Archive,
  Page as FileText,
  Eye,
  OpenNewWindow as ExternalLink,
  Tv as Monitor,
  Settings as Sliders,
  CheckCircle,
  WarningCircle as AlertCircle,
  Link as LinkIcon
} from '@iconoir/vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'
import Card from '~/components/ui/Card.vue'
import JSZip from 'jszip'
import { useToast } from '~/composables/useToast'
import { useI18n } from '~/composables/useI18n'
import type { AutoClipItem } from '~/server/api/tools/autoclip/analyze.post'

interface HeatmapPoint {
  timeSec: number
  intensity: number
}

interface AutoClipperResponse {
  success: boolean
  videoId: string
  title: string
  duration: number
  author?: {
    name: string
  }
  thumbnail: string
  heatmap: HeatmapPoint[]
  clips: AutoClipItem[]
  engine: string
}

const toast = useToast()
const { t, locale } = useI18n()

useHead({
  title: 'AutoClipper — Avttr Studio',
  meta: [
    {
      name: 'description',
      content: 'Turn long YouTube videos into 9:16 vertical clips using YouTube engagement replay heatmaps and AI refinement. 100% free with smart framing.'
    }
  ]
})

// Input Omnibar state
const urlInput = ref('')
const isAnalyzing = ref(false)
const analyzeError = ref('')

// Results state
const resultData = ref<AutoClipperResponse | null>(null)
const activeClipIndex = ref(0)

// 9:16 Shorts Framing Studio state
type FramingMode = 'blur_padded' | 'facecam_gameplay' | 'pan_center'
type FacecamCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
type SubtitleStyle = 'tiktok' | 'minimal' | 'boxed'

const framingMode = ref<FramingMode>('blur_padded')
const facecamCorner = ref<FacecamCorner>('top-left')
const horizontalPan = ref<number>(0) // -100 to 100 (percentage)
const showSubtitles = ref(true)
const subtitleStyle = ref<SubtitleStyle>('tiktok')

// Preview player state
const isPlaying = ref(false)
const currentTime = ref(0)
let playbackTimer: any = null

const activeClip = computed<AutoClipItem | null>(() => {
  if (!resultData.value?.clips?.length) return null
  return resultData.value.clips[activeClipIndex.value] || resultData.value.clips[0]
})

// Update framing when active clip changes
watch(activeClip, (clip) => {
  if (clip) {
    currentTime.value = clip.startTime
    if (clip.framing) {
      framingMode.value = clip.framing
    }
  }
})

// Formatted time helper
function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// Active subtitle line according to currentTime
const currentSubtitle = computed(() => {
  if (!showSubtitles.value || !activeClip.value?.subtitles?.length) return ''
  const sub = activeClip.value.subtitles.find(
    s => currentTime.value >= s.start && currentTime.value <= s.end
  )
  if (sub) return sub.text
  // Fallback to active hook if no specific sub matches active second
  return activeClip.value.hook
})

// Iframe embed URL for active clip
const iframeSrc = computed(() => {
  if (!resultData.value?.videoId || !activeClip.value) return ''
  const start = activeClip.value.startTime
  const end = activeClip.value.endTime
  return `https://www.youtube-nocookie.com/embed/${resultData.value.videoId}?start=${start}&end=${end}&autoplay=0&controls=1&rel=0&modestbranding=1`
})

// Paste from clipboard helper
async function pasteUrl() {
  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      urlInput.value = text.trim()
      toast.info(locale.value === 'id' ? 'Link berhasil ditempel' : 'URL pasted from clipboard')
    }
  } catch {
    toast.error(locale.value === 'id' ? 'Izin clipboard ditolak' : 'Clipboard access denied')
  }
}

function clearUrl() {
  urlInput.value = ''
  analyzeError.value = ''
}

// Handle Form Submission
async function handleAnalyze() {
  const trimmed = urlInput.value.trim()
  if (!trimmed) {
    toast.error(locale.value === 'id' ? 'Masukkan URL video YouTube terlebih dahulu' : 'Please enter a YouTube video URL')
    return
  }

  isAnalyzing.value = true
  analyzeError.value = ''

  try {
    const res = await $fetch<AutoClipperResponse>('/api/tools/autoclip/analyze', {
      method: 'POST',
      body: {
        url: trimmed,
        language: locale.value
      }
    })

    if (!res.success || !res.clips?.length) {
      throw new Error(locale.value === 'id' ? 'Tidak dapat menemukan momen klip dari video ini' : 'No clip highlights found for this video')
    }

    resultData.value = res
    activeClipIndex.value = 0
    currentTime.value = res.clips[0].startTime
    if (res.clips[0].framing) {
      framingMode.value = res.clips[0].framing
    }

    toast.success(
      locale.value === 'id'
        ? `Berhasil mendeteksi ${res.clips.length} momen viral`
        : `Successfully detected ${res.clips.length} viral highlights`
    )
  } catch (err: any) {
    console.error('AutoClipper analysis failed:', err)
    analyzeError.value = err?.data?.statusMessage || err?.message || 'Gagal menganalisis video YouTube'
    toast.error(analyzeError.value)
  } finally {
    isAnalyzing.value = false
  }
}

// Heatmap SVG Path Generator
const heatmapSvgPath = computed(() => {
  if (!resultData.value?.heatmap?.length || !resultData.value.duration) return ''
  const points = resultData.value.heatmap
  const maxIntensity = Math.max(...points.map(p => p.intensity), 0.1)
  const width = 1000
  const height = 80

  const coords = points.map(p => {
    const x = (p.timeSec / resultData.value!.duration) * width
    const y = height - (p.intensity / maxIntensity) * (height - 10)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return `M 0,${height} L ${coords.join(' L ')} L ${width},${height} Z`
})

// Subtitle .SRT file generator
function generateSrt(clip: AutoClipItem): string {
  if (!clip.subtitles?.length) {
    return `1\n00:00:00,000 --> 00:00:10,000\n${clip.hook}\n\n2\n00:00:10,000 --> 00:00:30,000\n${clip.summary}\n`
  }

  return clip.subtitles
    .map((sub, idx) => {
      const startMs = (sub.start - clip.startTime) * 1000
      const endMs = (sub.end - clip.startTime) * 1000

      const formatSrtTime = (ms: number) => {
        const h = Math.floor(ms / 3600000)
        const m = Math.floor((ms % 3600000) / 60000)
        const s = Math.floor((ms % 60000) / 1000)
        const mill = Math.floor(ms % 1000)
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${mill.toString().padStart(3, '0')}`
      }

      return `${idx + 1}\n${formatSrtTime(Math.max(0, startMs))} --> ${formatSrtTime(Math.max(1000, endMs))}\n${sub.text}\n`
    })
    .join('\n')
}

// Download single clip SRT
function downloadClipSrt() {
  if (!activeClip.value) return
  const srtContent = generateSrt(activeClip.value)
  const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${activeClip.value.id}_${activeClip.value.hook.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}.srt`
  a.click()
  URL.revokeObjectURL(url)
  toast.success(locale.value === 'id' ? 'File subtitle .SRT berhasil diunduh' : 'Subtitle .SRT file downloaded')
}

// Download All in ZIP
async function handleDownloadAllZip() {
  if (!resultData.value?.clips?.length) return

  toast.info(locale.value === 'id' ? 'Mengompres paket klip ke file ZIP...' : 'Packing all clips into ZIP archive...')

  const files = resultData.value.clips.map((clip, idx) => {
    const clipMeta = {
      clipNumber: idx + 1,
      hook: clip.hook,
      summary: clip.summary,
      viralScore: clip.viralScore,
      startTime: formatTime(clip.startTime),
      endTime: formatTime(clip.endTime),
      durationSeconds: clip.duration,
      framingMode: clip.framing,
      youtubeUrl: `https://www.youtube.com/watch?v=${resultData.value!.videoId}&t=${clip.startTime}s`
    }

    return {
      name: `${clip.id}_info.json`,
      content: JSON.stringify(clipMeta, null, 2)
    }
  })

  // Add SRTs
  resultData.value.clips.forEach(clip => {
    files.push({
      name: `${clip.id}_subtitles.srt`,
      content: generateSrt(clip)
    })
  })

  // Add overview README
  const overviewText = `# AutoClipper Highlights Export
Source Video: ${resultData.value.title}
Channel: ${resultData.value.author?.name || 'YouTube Creator'}
Video Duration: ${formatTime(resultData.value.duration)}
AI Engine: ${resultData.value.engine}

Clips Included:
${resultData.value.clips.map((c, i) => `${i + 1}. [${c.viralScore}/100] ${c.hook} (${formatTime(c.startTime)} - ${formatTime(c.endTime)})`).join('\n')}
`
  files.push({
    name: 'README.txt',
    content: overviewText
  })

  try {
    const zip = new JSZip()
    files.forEach(f => zip.file(f.name, f.content))
    const zipBlob = await zip.generateAsync({ type: 'blob' })

    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `autoclipper_${resultData.value.videoId}_clips.zip`
    a.click()
    URL.revokeObjectURL(url)

    toast.success(locale.value === 'id' ? 'File ZIP berhasil diunduh' : 'ZIP archive downloaded successfully')
  } catch (err) {
    console.error('ZIP generation error:', err)
    toast.error(locale.value === 'id' ? 'Gagal membuat file ZIP' : 'Failed to create ZIP archive')
  }
}
</script>

<template>
  <div class="space-y-6 pb-12 w-full">
    <!-- Breadcrumb Hierarchy (DESIGN.md Section 14) -->
    <nav class="flex items-center gap-1.5 text-xs font-mono text-[var(--text-tertiary)]" aria-label="Breadcrumb">
      <NuxtLink to="/" class="hover:text-[var(--text-primary)] transition-colors">Dashboard</NuxtLink>
      <span>/</span>
      <span class="text-[var(--text-secondary)]">Media Tools</span>
      <span>/</span>
      <span class="text-[var(--text-primary)] font-medium">AutoClipper</span>
    </nav>

    <!-- Header Section (DESIGN.md Section 14) -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          AutoClipper
        </h1>
        <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
          {{ locale === 'id'
            ? 'Deteksi otomatis sorotan viral dari YouTube Replay Heatmap & ubah ke format vertikal 9:16 Shorts/TikTok dengan AI.'
            : 'Automatically extract viral highlights from YouTube Replay Heatmaps & convert to vertical 9:16 Shorts/TikTok with AI.'
          }}
        </p>
      </div>

      <!-- Action badges / engine status -->
      <div class="flex items-center gap-2">
        <Badge variant="badge" class="font-mono text-[11px] px-2.5 py-1">
          <Sparkles class="w-3.5 h-3.5 mr-1 text-amber-500" />
          Heatmap + Gemini 2.5
        </Badge>
        <Badge variant="outline" class="font-mono text-[11px] px-2.5 py-1 text-[var(--text-tertiary)]">
          9:16 Smart Framing
        </Badge>
      </div>
    </div>

    <!-- Notice Row (Unboxed, DESIGN.md Section 16) -->
    <div class="flex items-center gap-2 text-xs text-[var(--text-tertiary)] select-none">
      <Film class="w-3.5 h-3.5 shrink-0 text-zinc-400" />
      <span>
        {{ locale === 'id'
          ? 'Menganalisis kurva replay penonton langsung dari YouTube. Tanpa download video di server, hemat kuota dan 100% instan.'
          : 'Analyzes viewer replay engagement curves directly from YouTube. Zero server video buffering, completely instant.'
        }}
      </span>
    </div>

    <!-- Standardized URL Omnibar (DESIGN.md Section 11) -->
    <form @submit.prevent="handleAnalyze" class="flex flex-col sm:flex-row items-center gap-2.5 w-full">
      <div class="relative w-full">
        <!-- Leading Icon -->
        <div class="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-[var(--text-tertiary)]">
          <LinkIcon class="w-4 h-4" />
        </div>

        <!-- Omnibar Input -->
        <input
          v-model="urlInput"
          type="url"
          required
          :placeholder="locale === 'id' ? 'Tempel link video YouTube (cth: https://www.youtube.com/watch?v=...)' : 'Paste YouTube video URL (e.g., https://www.youtube.com/watch?v=...)'"
          class="w-full h-12 pl-10 pr-20 bg-white dark:bg-[#171717] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] border border-zinc-200 dark:border-[#2E2E2E] focus:border-zinc-400 dark:focus:border-white/40 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 disabled:opacity-50 shadow-xs font-mono"
          :disabled="isAnalyzing"
        />

        <!-- Trailing Micro-Actions -->
        <div class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button
            v-if="urlInput"
            type="button"
            @click="clearUrl"
            class="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-zinc-100 dark:hover:bg-[#252528] transition-colors"
            title="Clear input"
          >
            <X class="w-4 h-4" />
          </button>
          <button
            type="button"
            @click="pasteUrl"
            class="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-zinc-100 dark:hover:bg-[#252528] transition-colors"
            title="Paste from clipboard"
          >
            <Clipboard class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Action Button CTA -->
      <Button
        type="submit"
        variant="primary"
        size="default"
        class="w-full sm:w-auto shrink-0 h-12 px-5 rounded-xl font-medium text-xs sm:text-sm cursor-pointer"
        :loading="isAnalyzing"
        :disabled="isAnalyzing || !urlInput.trim()"
      >
        <template #icon>
          <Scissors class="w-4 h-4 mr-1.5" />
        </template>
        {{ isAnalyzing
          ? (locale === 'id' ? 'Menganalisis Momen...' : 'Analyzing Highlights...')
          : (locale === 'id' ? 'Temukan Sorotan Viral' : 'Find Viral Highlights')
        }}
      </Button>
    </form>

    <!-- Error Banner -->
    <div
      v-if="analyzeError"
      class="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400 text-xs flex items-center gap-3"
    >
      <AlertCircle class="w-4 h-4 shrink-0" />
      <span>{{ analyzeError }}</span>
    </div>

    <!-- Loading Bento Skeleton -->
    <div v-if="isAnalyzing" class="space-y-6 pt-4 animate-pulse">
      <div class="h-28 rounded-[14px] bg-zinc-200 dark:bg-[#212124] border border-[var(--border-card)]"></div>
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-span-7 space-y-4">
          <div v-for="i in 3" :key="i" class="h-32 rounded-[14px] bg-zinc-200 dark:bg-[#212124] border border-[var(--border-card)]"></div>
        </div>
        <div class="lg:col-span-5">
          <div class="w-full max-w-[340px] mx-auto aspect-[9/16] rounded-2xl bg-zinc-200 dark:bg-[#212124] border border-[var(--border-card)]"></div>
        </div>
      </div>
    </div>

    <!-- Analysis Results Studio -->
    <div v-else-if="resultData && activeClip" class="space-y-6 pt-2">
      <!-- 1. Video Overview & Heatmap Waveform Card -->
      <Card class="p-5 space-y-4">
        <!-- Video Meta Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-card)]">
          <div class="space-y-1 max-w-2xl">
            <div class="flex items-center gap-2">
              <Badge variant="badge" class="font-mono text-[10px] uppercase">
                {{ resultData.engine }}
              </Badge>
              <span class="text-xs text-[var(--text-tertiary)] font-mono">
                Duration: {{ formatTime(resultData.duration) }}
              </span>
            </div>
            <h2 class="text-base sm:text-lg font-bold text-[var(--text-primary)] leading-snug line-clamp-1">
              {{ resultData.title }}
            </h2>
            <p v-if="resultData.author?.name" class="text-xs text-[var(--text-secondary)]">
              {{ resultData.author.name }}
            </p>
          </div>

          <!-- Quick actions -->
          <div class="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              class="text-xs"
              @click="handleDownloadAllZip"
            >
              <Archive class="w-3.5 h-3.5 mr-1.5" />
              {{ locale === 'id' ? 'Download Semua (ZIP)' : 'Download All (ZIP)' }}
            </Button>
            <a
              :href="`https://www.youtube.com/watch?v=${resultData.videoId}`"
              target="_blank"
              rel="noopener noreferrer"
              class="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors"
              title="Open source video"
            >
              <ExternalLink class="w-4 h-4" />
            </a>
          </div>
        </div>

        <!-- Audience Replay Heatmap Timeline -->
        <div class="space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
              <Sparkles class="w-3.5 h-3.5 text-amber-500" />
              {{ locale === 'id' ? 'YouTube Audience Replay Heatmap (Momen Paling Sering Diputar)' : 'YouTube Replay Heatmap (Audience Engagement Peaks)' }}
            </span>
            <span class="text-[11px] font-mono text-[var(--text-tertiary)]">
              {{ resultData.clips.length }} {{ locale === 'id' ? 'Puncak Terdeteksi' : 'Peaks Detected' }}
            </span>
          </div>

          <!-- Heatmap Waveform Container -->
          <div class="relative w-full h-16 bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 shadow-inner group cursor-pointer">
            <!-- Heatmap SVG Gradient Wave -->
            <svg
              viewBox="0 0 1000 80"
              preserveAspectRatio="none"
              class="w-full h-full opacity-70 group-hover:opacity-90 transition-opacity"
            >
              <defs>
                <linearGradient id="heatGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.9" />
                  <stop offset="50%" stop-color="#E11D48" stop-opacity="0.6" />
                  <stop offset="100%" stop-color="#3B82F6" stop-opacity="0.1" />
                </linearGradient>
              </defs>
              <path :d="heatmapSvgPath" fill="url(#heatGradient)" />
            </svg>

            <!-- Clip Range Highlights on the Waveform -->
            <div
              v-for="(clip, idx) in resultData.clips"
              :key="clip.id"
              class="absolute top-0 bottom-0 transition-all cursor-pointer border-x"
              :class="
                idx === activeClipIndex
                  ? 'bg-amber-500/25 border-amber-400 z-10'
                  : 'bg-white/5 border-white/20 hover:bg-white/10'
              "
              :style="{
                left: `${(clip.startTime / resultData.duration) * 100}%`,
                width: `${(clip.duration / resultData.duration) * 100}%`
              }"
              @click="activeClipIndex = idx"
              :title="`${clip.hook} (${formatTime(clip.startTime)} - ${formatTime(clip.endTime)})`"
            >
              <!-- Peak Marker Pin -->
              <div
                class="absolute -top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold leading-none shadow-xs"
                :class="idx === activeClipIndex ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-300'"
              >
                #{{ idx + 1 }}
              </div>
            </div>
          </div>

          <!-- Legend info -->
          <div class="flex items-center justify-between text-[11px] font-mono text-[var(--text-tertiary)] pt-1">
            <span>00:00</span>
            <span>{{ formatTime(resultData.duration / 2) }}</span>
            <span>{{ formatTime(resultData.duration) }}</span>
          </div>
        </div>
      </Card>

      <!-- 2. Dual Studio Layout: Clips Selector (Left) & 9:16 Shorts Preview Player (Right) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- Left Column: Viral Highlights Clip Selector Cards -->
        <div class="lg:col-span-7 space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-[var(--text-primary)]">
              {{ locale === 'id' ? 'Daftar Sorotan Viral' : 'Detected Viral Highlights' }} ({{ resultData.clips.length }})
            </h3>
            <span class="text-xs text-[var(--text-tertiary)] font-mono">
              {{ locale === 'id' ? 'Pilih untuk edit & pratinjau' : 'Click to preview in studio' }}
            </span>
          </div>

          <!-- Bento Clip Cards List -->
          <div class="space-y-3">
            <Card
              v-for="(clip, idx) in resultData.clips"
              :key="clip.id"
              class="p-4 transition-all cursor-pointer border select-none relative overflow-hidden"
              :class="
                idx === activeClipIndex
                  ? 'border-zinc-900 dark:border-white ring-2 ring-zinc-900/10 dark:ring-white/10 bg-zinc-50 dark:bg-[#1a1a1c]'
                  : 'hover:border-zinc-400 dark:hover:border-zinc-700'
              "
              @click="activeClipIndex = idx"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="space-y-1.5 flex-1">
                  <!-- Badges row -->
                  <div class="flex items-center gap-2">
                    <Badge
                      :variant="idx === 0 ? 'primary' : 'badge'"
                      class="text-[10px] font-mono px-2 py-0.5"
                    >
                      #{{ idx + 1 }} {{ idx === 0 ? 'Top Viral Pick' : 'Highlight' }}
                    </Badge>

                    <span class="text-[11px] font-mono font-bold text-amber-500">
                      {{ clip.viralScore }}/100 Viral Score
                    </span>

                    <span class="text-[11px] font-mono text-[var(--text-tertiary)]">
                      {{ formatTime(clip.startTime) }} - {{ formatTime(clip.endTime) }} ({{ clip.duration }}s)
                    </span>
                  </div>

                  <!-- Hook Title -->
                  <h4 class="text-sm sm:text-base font-bold text-[var(--text-primary)] line-clamp-2 leading-snug">
                    {{ clip.hook }}
                  </h4>

                  <!-- Summary -->
                  <p class="text-xs text-[var(--text-secondary)] line-clamp-2">
                    {{ clip.summary }}
                  </p>

                  <!-- Spoken preview quote if available -->
                  <div v-if="clip.subtitles?.length" class="pt-1 flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] italic">
                    <FileText class="w-3 h-3 shrink-0" />
                    <span class="line-clamp-1">"{{ clip.subtitles[0].text }}"</span>
                  </div>
                </div>

                <!-- Right Indicator / Selection Button -->
                <div class="shrink-0 flex flex-col items-end gap-2">
                  <span
                    v-if="idx === activeClipIndex"
                    class="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800"
                  >
                    <Check class="w-3 h-3" />
                    Active
                  </span>
                  <span
                    v-else
                    class="text-[11px] font-mono text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                  >
                    Select &rarr;
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <!-- Right Column: 9:16 Shorts Studio Player & Framing Controls -->
        <div class="lg:col-span-5 space-y-4">
          <Card class="p-5 space-y-5">
            <!-- Studio Header -->
            <div class="flex items-center justify-between pb-3 border-b border-[var(--border-card)]">
              <div>
                <h3 class="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Scissors class="w-4 h-4 text-zinc-900 dark:text-white" />
                  {{ locale === 'id' ? 'Studio Format Vertikal (9:16)' : 'Vertical 9:16 Shorts Studio' }}
                </h3>
                <p class="text-xs text-[var(--text-secondary)]">
                  {{ activeClip.hook }}
                </p>
              </div>

              <Badge variant="badge" class="font-mono text-[10px]">
                9:16 Ratio
              </Badge>
            </div>

            <!-- 1. Framing Mode Switcher -->
            <div class="space-y-2">
              <label class="text-xs font-semibold text-[var(--text-primary)] block">
                {{ locale === 'id' ? 'Mode Framing Kamera' : 'Camera Framing Mode' }}:
              </label>

              <div class="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  @click="framingMode = 'blur_padded'"
                  class="px-2.5 py-2 text-xs rounded-lg border font-medium transition-all text-center"
                  :class="
                    framingMode === 'blur_padded'
                      ? 'border-zinc-900 dark:border-white bg-zinc-900 dark:bg-white text-white dark:text-black shadow-xs'
                      : 'border-[var(--border-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                  "
                >
                  Smart Blur
                </button>

                <button
                  type="button"
                  @click="framingMode = 'facecam_gameplay'"
                  class="px-2.5 py-2 text-xs rounded-lg border font-medium transition-all text-center"
                  :class="
                    framingMode === 'facecam_gameplay'
                      ? 'border-zinc-900 dark:border-white bg-zinc-900 dark:bg-white text-white dark:text-black shadow-xs'
                      : 'border-[var(--border-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                  "
                >
                  Gamer Stack
                </button>

                <button
                  type="button"
                  @click="framingMode = 'pan_center'"
                  class="px-2.5 py-2 text-xs rounded-lg border font-medium transition-all text-center"
                  :class="
                    framingMode === 'pan_center'
                      ? 'border-zinc-900 dark:border-white bg-zinc-900 dark:bg-white text-white dark:text-black shadow-xs'
                      : 'border-[var(--border-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                  "
                >
                  Manual Pan
                </button>
              </div>

              <!-- Contextual Controls for Gamer Mode (Facecam Corner Selector) -->
              <div v-if="framingMode === 'facecam_gameplay'" class="pt-2 p-3 rounded-xl bg-zinc-50 dark:bg-[#18181a] border border-[var(--border-card)] space-y-2">
                <span class="text-[11px] font-semibold text-[var(--text-secondary)] block">
                  {{ locale === 'id' ? 'Posisi Webcam / Facecam Streamer' : 'Streamer Facecam Corner' }}:
                </span>
                <div class="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    @click="facecamCorner = 'top-left'"
                    class="px-2 py-1.5 text-xs rounded-md border font-mono transition-colors"
                    :class="facecamCorner === 'top-left' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' : 'border-[var(--border-card)] hover:bg-[var(--bg-card-hover)]'"
                  >
                    &#x2196; Kiri Atas
                  </button>
                  <button
                    type="button"
                    @click="facecamCorner = 'top-right'"
                    class="px-2 py-1.5 text-xs rounded-md border font-mono transition-colors"
                    :class="facecamCorner === 'top-right' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' : 'border-[var(--border-card)] hover:bg-[var(--bg-card-hover)]'"
                  >
                    &#x2197; Kanan Atas
                  </button>
                  <button
                    type="button"
                    @click="facecamCorner = 'bottom-left'"
                    class="px-2 py-1.5 text-xs rounded-md border font-mono transition-colors"
                    :class="facecamCorner === 'bottom-left' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' : 'border-[var(--border-card)] hover:bg-[var(--bg-card-hover)]'"
                  >
                    &#x2199; Kiri Bawah
                  </button>
                  <button
                    type="button"
                    @click="facecamCorner = 'bottom-right'"
                    class="px-2 py-1.5 text-xs rounded-md border font-mono transition-colors"
                    :class="facecamCorner === 'bottom-right' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' : 'border-[var(--border-card)] hover:bg-[var(--bg-card-hover)]'"
                  >
                    &#x2198; Kanan Bawah
                  </button>
                </div>
              </div>

              <!-- Contextual Controls for Manual Pan Mode -->
              <div v-if="framingMode === 'pan_center'" class="pt-2 p-3 rounded-xl bg-zinc-50 dark:bg-[#18181a] border border-[var(--border-card)] space-y-2">
                <div class="flex items-center justify-between text-[11px] font-semibold text-[var(--text-secondary)]">
                  <span>{{ locale === 'id' ? 'Fokus Horizontal' : 'Horizontal Focus Offset' }}:</span>
                  <span class="font-mono">{{ horizontalPan }}%</span>
                </div>
                <input
                  type="range"
                  min="-80"
                  max="80"
                  step="5"
                  v-model.number="horizontalPan"
                  class="w-full accent-amber-500 cursor-pointer"
                />
                <div class="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    @click="horizontalPan = -50"
                    class="px-2 py-1 text-[11px] rounded border border-[var(--border-card)] hover:bg-[var(--bg-card-hover)]"
                  >
                    Fokus Kiri
                  </button>
                  <button
                    type="button"
                    @click="horizontalPan = 0"
                    class="px-2 py-1 text-[11px] rounded border border-[var(--border-card)] hover:bg-[var(--bg-card-hover)]"
                  >
                    Tengah
                  </button>
                  <button
                    type="button"
                    @click="horizontalPan = 50"
                    class="px-2 py-1 text-[11px] rounded border border-[var(--border-card)] hover:bg-[var(--bg-card-hover)]"
                  >
                    Fokus Kanan
                  </button>
                </div>
              </div>
            </div>

            <!-- 2. Subtitles Toggle & Styling -->
            <div class="space-y-2 pt-1 border-t border-[var(--border-card)]">
              <div class="flex items-center justify-between">
                <label class="text-xs font-semibold text-[var(--text-primary)]">
                  {{ locale === 'id' ? 'Teks Subtitle TikTok' : 'TikTok Subtitle Overlay' }}:
                </label>
                <button
                  type="button"
                  @click="showSubtitles = !showSubtitles"
                  class="text-xs font-mono font-medium px-2 py-0.5 rounded transition-colors"
                  :class="showSubtitles ? 'bg-amber-500 text-black' : 'bg-zinc-200 dark:bg-zinc-800 text-[var(--text-tertiary)]'"
                >
                  {{ showSubtitles ? 'ON' : 'OFF' }}
                </button>
              </div>

              <div v-if="showSubtitles" class="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  type="button"
                  @click="subtitleStyle = 'tiktok'"
                  class="px-2 py-1.5 text-[11px] rounded-md border font-medium transition-all"
                  :class="subtitleStyle === 'tiktok' ? 'border-amber-400 bg-amber-400/20 text-amber-500 font-bold' : 'border-[var(--border-card)]'"
                >
                  TikTok Yellow
                </button>
                <button
                  type="button"
                  @click="subtitleStyle = 'minimal'"
                  class="px-2 py-1.5 text-[11px] rounded-md border font-medium transition-all"
                  :class="subtitleStyle === 'minimal' ? 'border-white bg-white/20 text-white font-bold' : 'border-[var(--border-card)]'"
                >
                  Clean White
                </button>
                <button
                  type="button"
                  @click="subtitleStyle = 'boxed'"
                  class="px-2 py-1.5 text-[11px] rounded-md border font-medium transition-all"
                  :class="subtitleStyle === 'boxed' ? 'border-zinc-500 bg-zinc-800 text-white font-bold' : 'border-[var(--border-card)]'"
                >
                  Boxed Dark
                </button>
              </div>
            </div>

            <!-- 3. Vertical 9:16 Shorts Mockup Stage -->
            <div class="relative w-full max-w-[300px] mx-auto aspect-[9/16] rounded-2xl overflow-hidden bg-black shadow-2xl border-2 border-zinc-800 select-none group">
              <!-- A. Smart Blur Mode -->
              <template v-if="framingMode === 'blur_padded'">
                <!-- Blurred zoomed background reflection -->
                <div class="absolute inset-0 overflow-hidden pointer-events-none">
                  <img
                    :src="resultData.thumbnail"
                    alt="Background blur"
                    class="w-full h-full object-cover scale-150 blur-xl opacity-50"
                  />
                </div>

                <!-- Centered 16:9 Video Player -->
                <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 aspect-video bg-black shadow-2xl z-10">
                  <iframe
                    :src="iframeSrc"
                    class="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen
                  ></iframe>
                </div>
              </template>

              <!-- B. Gamer Mode (Facecam on top, Gameplay on bottom) -->
              <template v-else-if="framingMode === 'facecam_gameplay'">
                <!-- Top: Facecam Corner Crop -->
                <div class="h-[38%] w-full overflow-hidden relative border-b-2 border-white/20 bg-black">
                  <iframe
                    :src="iframeSrc"
                    class="w-[200%] h-[260%] max-w-none border-0 absolute pointer-events-none"
                    :class="{
                      'top-0 left-0': facecamCorner === 'top-left',
                      'top-0 right-0 -translate-x-[50%]': facecamCorner === 'top-right',
                      'bottom-0 left-0 -translate-y-[60%]': facecamCorner === 'bottom-left',
                      'bottom-0 right-0 -translate-x-[50%] -translate-y-[60%]': facecamCorner === 'bottom-right'
                    }"
                  ></iframe>
                  <!-- Badge for facecam overlay -->
                  <div class="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[9px] font-mono font-bold text-white">
                    FACECAM ({{ facecamCorner }})
                  </div>
                </div>

                <!-- Bottom: Gameplay View -->
                <div class="h-[62%] w-full overflow-hidden relative bg-black">
                  <iframe
                    :src="iframeSrc"
                    class="w-[140%] h-full max-w-none border-0 absolute left-1/2 -translate-x-1/2 top-0"
                    allowfullscreen
                  ></iframe>
                </div>
              </template>

              <!-- C. Manual Pan / Center Crop -->
              <template v-else-if="framingMode === 'pan_center'">
                <div class="absolute inset-0 overflow-hidden bg-black">
                  <iframe
                    :src="iframeSrc"
                    class="h-full w-[260%] max-w-none border-0 absolute top-0"
                    :style="{
                      left: `calc(50% + ${horizontalPan * 2}px)`,
                      transform: 'translateX(-50%)'
                    }"
                    allowfullscreen
                  ></iframe>
                </div>
              </template>

              <!-- Subtitle Overlay inside 9:16 Frame -->
              <div
                v-if="showSubtitles && currentSubtitle"
                class="absolute bottom-12 inset-x-3 z-30 pointer-events-none flex justify-center"
              >
                <div
                  v-if="subtitleStyle === 'tiktok'"
                  class="text-[#FEE440] font-black uppercase tracking-wider text-center text-sm drop-shadow-[0_2px_4px_rgba(0,0,0,1)] px-2"
                >
                  {{ currentSubtitle }}
                </div>
                <div
                  v-else-if="subtitleStyle === 'minimal'"
                  class="text-white font-semibold text-center text-xs drop-shadow-md px-2"
                >
                  {{ currentSubtitle }}
                </div>
                <div
                  v-else-if="subtitleStyle === 'boxed'"
                  class="bg-black/80 backdrop-blur-sm text-white font-bold text-center text-xs px-2.5 py-1 rounded-md border border-white/10"
                >
                  {{ currentSubtitle }}
                </div>
              </div>

              <!-- Top watermark / brand -->
              <div class="absolute top-2.5 right-2.5 z-20 pointer-events-none px-2 py-0.5 rounded bg-black/50 backdrop-blur-sm text-[9px] font-mono text-zinc-300">
                Avttr Studio
              </div>
            </div>

            <!-- Export Buttons for Active Clip -->
            <div class="pt-2 space-y-2">
              <Button
                variant="primary"
                size="default"
                class="w-full justify-center text-xs font-semibold"
                @click="downloadClipSrt"
              >
                <FileText class="w-3.5 h-3.5 mr-1.5" />
                {{ locale === 'id' ? 'Download Subtitle (.SRT)' : 'Download Subtitle (.SRT)' }}
              </Button>

              <NuxtLink
                :to="{
                  path: '/tools/video-resizer',
                  query: {
                    source: `https://www.youtube.com/watch?v=${resultData.videoId}`,
                    start: activeClip.startTime,
                    end: activeClip.endTime
                  }
                }"
                class="flex items-center justify-center w-full h-9 rounded-lg border border-[var(--border-card)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
              >
                <Scissors class="w-3.5 h-3.5 mr-1.5" />
                {{ locale === 'id' ? 'Edit & Potong Lanjutan di Video Resizer' : 'Advanced Trim in Video Resizer' }}
                <ArrowRight class="w-3 h-3 ml-1" />
              </NuxtLink>
            </div>
          </Card>
        </div>
      </div>
    </div>
  </div>
</template>
