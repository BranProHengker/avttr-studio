<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  CinemaOld as Film,
  Play,
  Pause,
  Download,
  Scissor as Scissors,
  PasteClipboard as Clipboard,
  Xmark as X,
  ArrowRight,
  Sparks as Sparkles,
  Refresh as RefreshCw,
  Archive,
  Page as FileText,
  OpenNewWindow as ExternalLink,
  WarningCircle as AlertCircle,
  Link as LinkIcon,
  SoundHigh as Volume2,
  SoundOff as VolumeX
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
  streamUrl?: string
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
const isDownloadingClip = ref(false)

// 9:16 Shorts Framing Studio state
type FramingMode = 'blur_padded' | 'facecam_gameplay' | 'pan_center'
type FacecamCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
type SubtitleStyle = 'minimal' | 'tiktok' | 'boxed' | 'neon'
type SubtitleSize = 'sm' | 'md' | 'lg'
type SubtitlePosition = 'top' | 'center' | 'bottom'

const framingMode = ref<FramingMode>('blur_padded')
const facecamCorner = ref<FacecamCorner>('top-left')
const horizontalPan = ref<number>(0)

// Subtitle customizer state (DEFAULT WHITE as explicitly requested)
const showSubtitles = ref(true)
const subtitleStyle = ref<SubtitleStyle>('minimal') // Default to Clean White
const subtitleSize = ref<SubtitleSize>('md')
const subtitlePosition = ref<SubtitlePosition>('bottom')

// Native Custom Video Player State (Our own player, matching video-resizer standard)
const videoElementRef = ref<HTMLVideoElement | null>(null)
const scrubberBarRef = ref<HTMLElement | null>(null)
const isPlaying = ref(false)
const isMuted = ref(false)
const currentTime = ref(0)
const isVideoReady = ref(false)
const videoLoadError = ref(false)
let isScrubbing = false

const activeClip = computed<AutoClipItem | null>(() => {
  if (!resultData.value?.clips?.length) return null
  return resultData.value.clips[activeClipIndex.value] || resultData.value.clips[0]
})

// Processed direct media stream URL from our own Nitro backend
const videoStreamUrl = computed(() => {
  if (resultData.value?.streamUrl) {
    return resultData.value.streamUrl
  }
  if (!resultData.value?.videoId) return ''
  return `/api/tools/autoclip/stream?videoId=${resultData.value.videoId}`
})

// Sync player position when active clip changes
watch(activeClip, (clip) => {
  if (clip) {
    currentTime.value = clip.startTime
    if (clip.framing) {
      framingMode.value = clip.framing
    }
    if (videoElementRef.value) {
      videoElementRef.value.currentTime = clip.startTime
      if (isPlaying.value) {
        videoElementRef.value.play().catch(() => {})
      }
    }
  }
})

// Formatted time helpers
function formatTime(sec: number): string {
  if (isNaN(sec) || sec < 0) return '00:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function formatPlayerTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Scrubber progress calculation within active clip range
const clipProgressPercent = computed(() => {
  if (!activeClip.value) return 0
  const start = activeClip.value.startTime
  const end = activeClip.value.endTime
  const dur = Math.max(1, end - start)
  const currentOffset = Math.max(0, Math.min(dur, currentTime.value - start))
  return (currentOffset / dur) * 100
})

// Native Video Player Controls
function togglePlay() {
  if (!videoElementRef.value) return
  if (isPlaying.value) {
    videoElementRef.value.pause()
    isPlaying.value = false
  } else {
    // If current time is outside clip bounds, seek to clip start first
    if (activeClip.value) {
      if (
        videoElementRef.value.currentTime < activeClip.value.startTime ||
        videoElementRef.value.currentTime >= activeClip.value.endTime
      ) {
        videoElementRef.value.currentTime = activeClip.value.startTime
      }
    }
    videoElementRef.value
      .play()
      .then(() => {
        isPlaying.value = true
      })
      .catch(() => {
        isPlaying.value = false
      })
  }
}

function restartClip() {
  if (!videoElementRef.value || !activeClip.value) return
  videoElementRef.value.currentTime = activeClip.value.startTime
  videoElementRef.value
    .play()
    .then(() => {
      isPlaying.value = true
    })
    .catch(() => {})
}

function onVideoLoadedMetadata() {
  isVideoReady.value = true
  videoLoadError.value = false
  if (videoElementRef.value && activeClip.value) {
    videoElementRef.value.currentTime = activeClip.value.startTime
  }
}

function onVideoTimeUpdate() {
  if (!videoElementRef.value || !activeClip.value) return
  const t = videoElementRef.value.currentTime
  currentTime.value = t

  // Auto loop inside active clip bounds
  if (t >= activeClip.value.endTime) {
    videoElementRef.value.currentTime = activeClip.value.startTime
  }
}

function onVideoError() {
  console.warn('[AutoClipper Player] Native stream playback issue.')
  videoLoadError.value = true
}

// Scrubber interaction
function seekFromMouseEvent(e: MouseEvent) {
  if (!scrubberBarRef.value || !activeClip.value || !videoElementRef.value) return
  const rect = scrubberBarRef.value.getBoundingClientRect()
  const offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
  const ratio = offsetX / rect.width
  const start = activeClip.value.startTime
  const dur = activeClip.value.duration
  const targetTime = start + ratio * dur
  videoElementRef.value.currentTime = targetTime
  currentTime.value = targetTime
}

function startScrubbing(e: MouseEvent) {
  isScrubbing = true
  seekFromMouseEvent(e)
  const onMouseMove = (moveEvt: MouseEvent) => {
    if (isScrubbing) seekFromMouseEvent(moveEvt)
  }
  const onMouseUp = () => {
    isScrubbing = false
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

// Active subtitle text (editable from activeClip or manual override)
const currentSubtitle = computed(() => {
  if (!showSubtitles.value || !activeClip.value) return ''
  if (activeClip.value.subtitles?.length && activeClip.value.subtitles[0].text) {
    return activeClip.value.subtitles[0].text
  }
  return activeClip.value.hook || ''
})

// Stepper duration adjustments for active clip
function adjustStartTime(deltaSec: number) {
  if (!activeClip.value || !resultData.value) return
  const current = activeClip.value.startTime
  const newStart = Math.max(0, Math.min(activeClip.value.endTime - 5, current + deltaSec))
  activeClip.value.startTime = newStart
  activeClip.value.duration = Math.max(1, activeClip.value.endTime - newStart)
  currentTime.value = newStart
  if (videoElementRef.value) {
    videoElementRef.value.currentTime = newStart
  }
}

function adjustEndTime(deltaSec: number) {
  if (!activeClip.value || !resultData.value) return
  const current = activeClip.value.endTime
  const maxDur = resultData.value.duration || 9999
  const newEnd = Math.min(maxDur, Math.max(activeClip.value.startTime + 5, current + deltaSec))
  activeClip.value.endTime = newEnd
  activeClip.value.duration = Math.max(1, newEnd - activeClip.value.startTime)
}

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
  videoLoadError.value = false

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

// Download MP4 Video of the Active Clip directly from our own stream processor
function downloadActiveClipVideo() {
  if (!activeClip.value || !resultData.value) return

  const clip = activeClip.value
  const slugTitle = clip.hook
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 40)
  const filename = `${clip.id}_${slugTitle}.mp4`

  isDownloadingClip.value = true
  toast.info(
    locale.value === 'id'
      ? 'Memproses & mengunduh klip video MP4...'
      : 'Processing & downloading MP4 video clip...'
  )

  let downloadUrl = ''
  if (resultData.value.streamUrl) {
    downloadUrl = `${resultData.value.streamUrl}&start=${clip.startTime}&end=${clip.endTime}&download=1&filename=${encodeURIComponent(filename)}`
  } else {
    downloadUrl = `/api/tools/autoclip/stream?videoId=${resultData.value.videoId}&start=${clip.startTime}&end=${clip.endTime}&download=1&filename=${encodeURIComponent(filename)}`
  }

  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()

  setTimeout(() => {
    if (document.body.contains(link)) document.body.removeChild(link)
    isDownloadingClip.value = false
    toast.success(
      locale.value === 'id'
        ? 'Pengunduhan video klip MP4 dimulai'
        : 'MP4 video clip download initiated'
    )
  }, 1500)
}

// Heatmap SVG Path Generator (Monochromatic Sleek Standard)
const heatmapSvgPath = computed(() => {
  if (!resultData.value?.heatmap?.length || !resultData.value.duration) return ''
  const points = resultData.value.heatmap
  const maxIntensity = Math.max(...points.map((p) => p.intensity), 0.1)
  const width = 1000
  const height = 80

  const coords = points.map((p) => {
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
  resultData.value.clips.forEach((clip) => {
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
    files.forEach((f) => zip.file(f.name, f.content))
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
    <div class="flex items-center gap-2 text-xs font-mono text-[var(--text-secondary)]">
      <NuxtLink to="/" class="hover:text-[var(--text-primary)] transition-colors">
        Dashboard
      </NuxtLink>
      <span class="text-[var(--text-tertiary)]">/</span>
      <span class="hover:text-[var(--text-primary)] transition-colors">
        Downloader
      </span>
      <span class="text-[var(--text-tertiary)]">/</span>
      <span class="text-[var(--text-primary)] font-semibold">
        AutoClipper
      </span>
    </div>

    <!-- Header Section (Clean standard, no decorative marketing badges) -->
    <div class="space-y-1">
      <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
        <Film class="w-6 h-6 text-zinc-900 dark:text-white" />
        AutoClipper
      </h1>
      <p class="text-xs sm:text-sm text-[var(--text-secondary)]">
        {{ locale === 'id'
          ? 'Potong highlight viral video YouTube otomatis berdasarkan kurva retensi penonton & framing vertikal 9:16 untuk TikTok, Shorts, dan Reels.'
          : 'Automatically detect viral YouTube highlights using viewer replay heatmaps and generate 9:16 vertical clips with TikTok subtitles.'
        }}
      </p>
    </div>

    <!-- Standardized URL Omnibar (DESIGN.md Section 11) -->
    <form @submit.prevent="handleAnalyze" class="w-full">
      <div class="flex flex-col sm:flex-row items-center gap-2.5 w-full">
        <div class="relative w-full">
          <!-- Leading Icon -->
          <div class="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-[var(--text-tertiary)]">
            <LinkIcon class="w-4 h-4" />
          </div>

          <!-- URL Input Field -->
          <input
            id="autoclip-url-input"
            v-model="urlInput"
            type="url"
            :placeholder="locale === 'id' ? 'Tempel link video YouTube (contoh: https://youtu.be/... atau youtube.com/watch?v=...)' : 'Paste YouTube video link (e.g. https://youtu.be/... or youtube.com/watch?v=...)'"
            :disabled="isAnalyzing"
            class="w-full h-12 pl-10 pr-20 bg-white dark:bg-[#171717] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] border border-zinc-200 dark:border-[#2E2E2E] focus:border-zinc-400 dark:focus:border-white/40 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 disabled:opacity-50 shadow-xs font-mono"
            autocomplete="off"
            spellcheck="false"
          />

          <!-- Trailing Micro-Actions (Paste & Clear) -->
          <div class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              v-if="urlInput"
              type="button"
              id="autoclip-clear-btn"
              @click="clearUrl"
              class="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Clear input"
            >
              <X class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              id="autoclip-paste-btn"
              @click="pasteUrl"
              class="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Paste from clipboard"
            >
              <Clipboard class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Submit Action CTA Button -->
        <Button
          id="autoclip-submit-btn"
          type="submit"
          variant="primary"
          size="default"
          class="w-full sm:w-auto shrink-0 h-12 px-5 rounded-xl font-medium text-xs sm:text-sm cursor-pointer"
          :loading="isAnalyzing"
        >
          <Sparkles class="w-4 h-4 mr-1.5" />
          {{ isAnalyzing
            ? (locale === 'id' ? 'Menganalisis...' : 'Analyzing...')
            : (locale === 'id' ? 'Analisis Video' : 'Analyze Video')
          }}
        </Button>
      </div>
    </form>

    <!-- Error Alert Box -->
    <div
      v-if="analyzeError"
      class="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-200 flex items-start gap-3"
    >
      <AlertCircle class="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
      <div class="text-xs space-y-1">
        <p class="font-semibold">{{ locale === 'id' ? 'Gagal Menganalisis Video' : 'Analysis Failed' }}</p>
        <p class="opacity-90">{{ analyzeError }}</p>
      </div>
    </div>

    <!-- Active Results Workspace -->
    <div v-if="resultData && activeClip" class="space-y-6">
      <!-- 1. Source Video Overview Card (No hover color change) -->
      <Card :hoverable="false" class="p-5 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[var(--border-card)]">
          <div class="space-y-1 min-w-0">
            <div class="flex items-center gap-2">
              <Badge variant="badge" class="font-mono text-[10px]">
                YouTube Source
              </Badge>
              <span class="text-xs font-mono text-[var(--text-tertiary)]">
                {{ formatTime(resultData.duration) }}
              </span>
              <span class="text-xs font-mono text-[var(--text-tertiary)]">
                &bull; {{ resultData.engine }}
              </span>
            </div>
            <h2 class="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate">
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
              title="Open source video on YouTube"
            >
              <ExternalLink class="w-4 h-4" />
            </a>
          </div>
        </div>

        <!-- Audience Replay Heatmap Timeline (Clean Monochromatic Waveform) -->
        <div class="space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
              <Sparkles class="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
              {{ locale === 'id' ? 'YouTube Audience Replay Heatmap (Titik Momen Paling Viral)' : 'YouTube Replay Heatmap (Audience Engagement Peaks)' }}
            </span>
            <span class="text-[11px] font-mono text-[var(--text-tertiary)]">
              {{ resultData.clips.length }} {{ locale === 'id' ? 'Puncak Terdeteksi' : 'Peaks Detected' }}
            </span>
          </div>

          <!-- Heatmap Waveform Container -->
          <div class="relative w-full h-16 bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 shadow-inner group cursor-pointer">
            <svg
              viewBox="0 0 1000 80"
              preserveAspectRatio="none"
              class="w-full h-full opacity-60 group-hover:opacity-80 transition-opacity"
            >
              <defs>
                <linearGradient id="heatGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#A1A1AA" stop-opacity="0.8" />
                  <stop offset="100%" stop-color="#3F3F46" stop-opacity="0.2" />
                </linearGradient>
              </defs>
              <path :d="heatmapSvgPath" fill="url(#heatGradient)" />
            </svg>

            <!-- Clip Range Highlights on the Waveform (Clean Monochromatic High-Contrast Indicator) -->
            <div
              v-for="(clip, idx) in resultData.clips"
              :key="clip.id"
              class="absolute top-0 bottom-0 transition-all cursor-pointer border-x"
              :class="
                idx === activeClipIndex
                  ? 'bg-white/20 border-white z-10'
                  : 'bg-white/5 border-white/20 hover:bg-white/10'
              "
              :style="{
                left: `${(clip.startTime / resultData.duration) * 100}%`,
                width: `${(clip.duration / resultData.duration) * 100}%`
              }"
              @click="activeClipIndex = idx"
              :title="`${clip.hook} (${formatTime(clip.startTime)} - ${formatTime(clip.endTime)})`"
            >
              <div
                class="absolute -top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold leading-none shadow-xs"
                :class="idx === activeClipIndex ? 'bg-white text-zinc-900 dark:bg-white dark:text-black' : 'bg-zinc-800 text-zinc-300'"
              >
                #{{ idx + 1 }}
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between text-[11px] font-mono text-[var(--text-tertiary)] pt-1">
            <span>00:00</span>
            <span>{{ formatTime(resultData.duration / 2) }}</span>
            <span>{{ formatTime(resultData.duration) }}</span>
          </div>
        </div>
      </Card>

      <!-- 2. Dual Studio Layout: Clips Selector & Editor (Left) & 9:16 Shorts Preview Player (Right) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        <!-- Left Column: Viral Highlights & Full Clip Editor Panel -->
        <div class="lg:col-span-7 space-y-5">
          <!-- A. Bento Clip Selector Cards (No hover color change as requested) -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-[var(--text-primary)]">
                {{ locale === 'id' ? 'Daftar Sorotan Viral' : 'Detected Viral Highlights' }} ({{ resultData.clips.length }})
              </h3>
              <span class="text-xs text-[var(--text-tertiary)] font-mono">
                {{ locale === 'id' ? 'Pilih untuk edit & sesuaikan' : 'Select to edit & customize' }}
              </span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card
                v-for="(clip, idx) in resultData.clips"
                :key="clip.id"
                :hoverable="false"
                class="p-3.5 border select-none relative overflow-hidden bg-[var(--bg-card)] cursor-pointer transition-none"
                :class="
                  idx === activeClipIndex
                    ? 'border-zinc-900 dark:border-white ring-1 ring-zinc-900 dark:ring-white'
                    : 'border-[var(--border-card)]'
                "
                @click="activeClipIndex = idx"
              >
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <Badge
                      :variant="idx === activeClipIndex ? 'primary' : 'badge'"
                      class="text-[10px] font-mono px-2 py-0.5"
                    >
                      #{{ idx + 1 }} {{ idx === 0 ? 'Top Pick' : 'Clip' }}
                    </Badge>
                    <span class="text-[11px] font-mono font-semibold text-[var(--text-secondary)]">
                      {{ clip.viralScore }}/100
                    </span>
                  </div>

                  <h4 class="text-xs font-bold text-[var(--text-primary)] line-clamp-2 leading-snug">
                    {{ clip.hook }}
                  </h4>

                  <div class="flex items-center justify-between text-[11px] font-mono text-[var(--text-tertiary)]">
                    <span>{{ formatTime(clip.startTime) }} - {{ formatTime(clip.endTime) }}</span>
                    <span class="font-bold text-[var(--text-secondary)]">{{ clip.duration }}s</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <!-- B. Dedicated Interactive Clip Editor Panel (No hover color change) -->
          <Card :hoverable="false" class="p-5 space-y-5 border border-zinc-200 dark:border-zinc-800">
            <div class="flex items-center justify-between pb-3 border-b border-[var(--border-card)]">
              <h3 class="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Scissors class="w-4 h-4 text-zinc-900 dark:text-white" />
                {{ locale === 'id' ? 'Panel Edit Klip #' + (activeClipIndex + 1) : 'Clip Editor #' + (activeClipIndex + 1) }}
              </h3>
              <Badge variant="badge" class="font-mono text-[11px]">
                {{ formatTime(activeClip.startTime) }} &rarr; {{ formatTime(activeClip.endTime) }} ({{ activeClip.duration }}s)
              </Badge>
            </div>

            <!-- 1. Trimmer Duration Adjuster Steppers (Clean Monochromatic Controls) -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <label class="text-xs font-semibold text-[var(--text-primary)]">
                  {{ locale === 'id' ? 'Potong Durasi Klip (Start & End Time)' : 'Trim Clip Duration (Start & End Time)' }}
                </label>
                <span class="text-[11px] font-mono text-[var(--text-tertiary)]">
                  {{ activeClip.duration >= 20 && activeClip.duration <= 60 ? 'Optimal (Shorts/TikTok)' : 'Durasi Kustom' }}
                </span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <!-- Start Time Stepper -->
                <div class="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181a] border border-[var(--border-card)] space-y-2">
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-[var(--text-secondary)]">{{ locale === 'id' ? 'Detik Mulai (Start):' : 'Start Time:' }}</span>
                    <span class="font-mono font-bold text-[var(--text-primary)]">{{ formatTime(activeClip.startTime) }} ({{ activeClip.startTime }}s)</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <button
                      type="button"
                      @click="adjustStartTime(-5)"
                      class="flex-1 py-1 text-xs rounded border border-[var(--border-card)] hover:bg-[var(--bg-card-hover)] font-mono transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      title="Mundur 5 detik"
                    >
                      -5s
                    </button>
                    <button
                      type="button"
                      @click="adjustStartTime(-1)"
                      class="flex-1 py-1 text-xs rounded border border-[var(--border-card)] hover:bg-[var(--bg-card-hover)] font-mono transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      title="Mundur 1 detik"
                    >
                      -1s
                    </button>
                    <button
                      type="button"
                      @click="adjustStartTime(1)"
                      class="flex-1 py-1 text-xs rounded border border-[var(--border-card)] hover:bg-[var(--bg-card-hover)] font-mono transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      title="Maju 1 detik"
                    >
                      +1s
                    </button>
                    <button
                      type="button"
                      @click="adjustStartTime(5)"
                      class="flex-1 py-1 text-xs rounded border border-[var(--border-card)] hover:bg-[var(--bg-card-hover)] font-mono transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      title="Maju 5 detik"
                    >
                      +5s
                    </button>
                  </div>
                </div>

                <!-- End Time Stepper -->
                <div class="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181a] border border-[var(--border-card)] space-y-2">
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-[var(--text-secondary)]">{{ locale === 'id' ? 'Detik Selesai (End):' : 'End Time:' }}</span>
                    <span class="font-mono font-bold text-[var(--text-primary)]">{{ formatTime(activeClip.endTime) }} ({{ activeClip.endTime }}s)</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <button
                      type="button"
                      @click="adjustEndTime(-5)"
                      class="flex-1 py-1 text-xs rounded border border-[var(--border-card)] hover:bg-[var(--bg-card-hover)] font-mono transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      title="Mundur 5 detik"
                    >
                      -5s
                    </button>
                    <button
                      type="button"
                      @click="adjustEndTime(-1)"
                      class="flex-1 py-1 text-xs rounded border border-[var(--border-card)] hover:bg-[var(--bg-card-hover)] font-mono transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      title="Mundur 1 detik"
                    >
                      -1s
                    </button>
                    <button
                      type="button"
                      @click="adjustEndTime(1)"
                      class="flex-1 py-1 text-xs rounded border border-[var(--border-card)] hover:bg-[var(--bg-card-hover)] font-mono transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      title="Maju 1 detik"
                    >
                      +1s
                    </button>
                    <button
                      type="button"
                      @click="adjustEndTime(5)"
                      class="flex-1 py-1 text-xs rounded border border-[var(--border-card)] hover:bg-[var(--bg-card-hover)] font-mono transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                      title="Maju 5 detik"
                    >
                      +5s
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 2. Viral Hook & Subtitle Text Live Editor -->
            <div class="space-y-3 pt-2 border-t border-[var(--border-card)]">
              <label class="text-xs font-semibold text-[var(--text-primary)] block">
                {{ locale === 'id' ? 'Edit Judul Hook & Teks Subtitle' : 'Edit Hook Title & Subtitle Text' }}
              </label>

              <!-- Hook Title Input -->
              <div class="space-y-1">
                <span class="text-[11px] text-[var(--text-tertiary)] block">
                  {{ locale === 'id' ? 'Judul Hook Viral:' : 'Viral Hook Headline:' }}
                </span>
                <input
                  v-model="activeClip.hook"
                  type="text"
                  class="w-full h-9 px-3 rounded-lg border border-[var(--border-card)] bg-[var(--bg-input)] text-xs text-[var(--text-primary)] font-medium focus:outline-none focus:border-zinc-400 dark:focus:border-white/40 focus:ring-1 focus:ring-zinc-900/10 dark:focus:ring-white/10"
                  placeholder="Ketik judul hook viral..."
                />
              </div>

              <!-- Subtitle Overlay Text Input -->
              <div class="space-y-1">
                <span class="text-[11px] text-[var(--text-tertiary)] block">
                  {{ locale === 'id' ? 'Teks Subtitle / Ucapan Penting (Muncul di Video):' : 'Subtitle / Key Quote Text (Displayed on Video):' }}
                </span>
                <textarea
                  v-if="activeClip.subtitles?.length"
                  v-model="activeClip.subtitles[0].text"
                  rows="2"
                  class="w-full p-2.5 rounded-lg border border-[var(--border-card)] bg-[var(--bg-input)] text-xs text-[var(--text-primary)] leading-relaxed focus:outline-none focus:border-zinc-400 dark:focus:border-white/40 focus:ring-1 focus:ring-zinc-900/10 dark:focus:ring-white/10 resize-none font-mono"
                  placeholder="Ketik teks subtitle yang tampil pada video..."
                ></textarea>
                <textarea
                  v-else
                  v-model="activeClip.summary"
                  rows="2"
                  class="w-full p-2.5 rounded-lg border border-[var(--border-card)] bg-[var(--bg-input)] text-xs text-[var(--text-primary)] leading-relaxed focus:outline-none focus:border-zinc-400 dark:focus:border-white/40 focus:ring-1 focus:ring-zinc-900/10 dark:focus:ring-white/10 resize-none font-mono"
                ></textarea>
              </div>
            </div>

            <!-- 3. Subtitle Styling & Customization (Default White) -->
            <div class="space-y-3 pt-2 border-t border-[var(--border-card)]">
              <div class="flex items-center justify-between">
                <label class="text-xs font-semibold text-[var(--text-primary)]">
                  {{ locale === 'id' ? 'Kustomisasi Subtitle' : 'Subtitle Styling' }}
                </label>
                <button
                  type="button"
                  @click="showSubtitles = !showSubtitles"
                  class="text-xs font-mono font-medium px-2 py-0.5 rounded transition-colors cursor-pointer"
                  :class="showSubtitles ? 'bg-zinc-900 text-white dark:bg-white dark:text-black font-semibold' : 'bg-zinc-100 dark:bg-zinc-800 text-[var(--text-tertiary)]'"
                >
                  {{ showSubtitles ? 'SUBTITLE ON' : 'SUBTITLE OFF' }}
                </button>
              </div>

              <div v-if="showSubtitles" class="space-y-2">
                <!-- Preset Style Buttons (White is First / Default) -->
                <div class="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    @click="subtitleStyle = 'minimal'"
                    class="px-2 py-1.5 text-[11px] rounded-md border font-medium transition-all text-center cursor-pointer"
                    :class="subtitleStyle === 'minimal' ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black font-bold' : 'border-[var(--border-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
                  >
                    White
                  </button>
                  <button
                    type="button"
                    @click="subtitleStyle = 'tiktok'"
                    class="px-2 py-1.5 text-[11px] rounded-md border font-medium transition-all text-center cursor-pointer"
                    :class="subtitleStyle === 'tiktok' ? 'border-zinc-900 bg-zinc-100 text-zinc-900 dark:border-white dark:bg-zinc-800 dark:text-white font-bold' : 'border-[var(--border-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
                  >
                    TikTok
                  </button>
                  <button
                    type="button"
                    @click="subtitleStyle = 'boxed'"
                    class="px-2 py-1.5 text-[11px] rounded-md border font-medium transition-all text-center cursor-pointer"
                    :class="subtitleStyle === 'boxed' ? 'border-zinc-900 bg-zinc-100 text-zinc-900 dark:border-white dark:bg-zinc-800 dark:text-white font-bold' : 'border-[var(--border-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
                  >
                    Boxed
                  </button>
                  <button
                    type="button"
                    @click="subtitleStyle = 'neon'"
                    class="px-2 py-1.5 text-[11px] rounded-md border font-medium transition-all text-center cursor-pointer"
                    :class="subtitleStyle === 'neon' ? 'border-zinc-900 bg-zinc-100 text-zinc-900 dark:border-white dark:bg-zinc-800 dark:text-white font-bold' : 'border-[var(--border-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
                  >
                    Neon
                  </button>
                </div>

                <!-- Font Size & Position Row -->
                <div class="grid grid-cols-2 gap-3 pt-1">
                  <!-- Font size -->
                  <div class="space-y-1">
                    <span class="text-[11px] text-[var(--text-tertiary)] block">Ukuran Font:</span>
                    <div class="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        @click="subtitleSize = 'sm'"
                        class="py-1 text-[11px] rounded border font-mono transition-colors cursor-pointer"
                        :class="subtitleSize === 'sm' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black font-bold' : 'border-[var(--border-card)] text-[var(--text-secondary)]'"
                      >
                        Kecil
                      </button>
                      <button
                        type="button"
                        @click="subtitleSize = 'md'"
                        class="py-1 text-[11px] rounded border font-mono transition-colors cursor-pointer"
                        :class="subtitleSize === 'md' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black font-bold' : 'border-[var(--border-card)] text-[var(--text-secondary)]'"
                      >
                        Sedang
                      </button>
                      <button
                        type="button"
                        @click="subtitleSize = 'lg'"
                        class="py-1 text-[11px] rounded border font-mono transition-colors cursor-pointer"
                        :class="subtitleSize === 'lg' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black font-bold' : 'border-[var(--border-card)] text-[var(--text-secondary)]'"
                      >
                        Besar
                      </button>
                    </div>
                  </div>

                  <!-- Position -->
                  <div class="space-y-1">
                    <span class="text-[11px] text-[var(--text-tertiary)] block">Posisi Layar:</span>
                    <div class="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        @click="subtitlePosition = 'top'"
                        class="py-1 text-[11px] rounded border font-mono transition-colors cursor-pointer"
                        :class="subtitlePosition === 'top' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black font-bold' : 'border-[var(--border-card)] text-[var(--text-secondary)]'"
                      >
                        Atas
                      </button>
                      <button
                        type="button"
                        @click="subtitlePosition = 'center'"
                        class="py-1 text-[11px] rounded border font-mono transition-colors cursor-pointer"
                        :class="subtitlePosition === 'center' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black font-bold' : 'border-[var(--border-card)] text-[var(--text-secondary)]'"
                      >
                        Tengah
                      </button>
                      <button
                        type="button"
                        @click="subtitlePosition = 'bottom'"
                        class="py-1 text-[11px] rounded border font-mono transition-colors cursor-pointer"
                        :class="subtitlePosition === 'bottom' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black font-bold' : 'border-[var(--border-card)] text-[var(--text-secondary)]'"
                      >
                        Bawah
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <!-- Right Column: 9:16 Shorts Studio Player & Direct Downloads -->
        <div class="lg:col-span-5 space-y-4">
          <Card :hoverable="false" class="p-5 space-y-4">
            <!-- Studio Header -->
            <div class="flex items-center justify-between pb-3 border-b border-[var(--border-card)]">
              <div>
                <h3 class="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Scissors class="w-4 h-4 text-zinc-900 dark:text-white" />
                  {{ locale === 'id' ? 'Studio Format Vertikal (9:16)' : 'Vertical 9:16 Shorts Studio' }}
                </h3>
                <p class="text-xs text-[var(--text-secondary)] line-clamp-1">
                  {{ activeClip.hook }}
                </p>
              </div>

              <Badge variant="badge" class="font-mono text-[10px]">
                9:16 Ratio
              </Badge>
            </div>

            <!-- Framing Mode Buttons -->
            <div class="space-y-2">
              <label class="text-xs font-semibold text-[var(--text-primary)] block">
                {{ locale === 'id' ? 'Mode Framing Kamera' : 'Camera Framing Mode' }}:
              </label>

              <div class="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  @click="framingMode = 'blur_padded'"
                  class="px-2.5 py-2 text-xs rounded-lg border font-medium transition-all text-center cursor-pointer"
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
                  class="px-2.5 py-2 text-xs rounded-lg border font-medium transition-all text-center cursor-pointer"
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
                  class="px-2.5 py-2 text-xs rounded-lg border font-medium transition-all text-center cursor-pointer"
                  :class="
                    framingMode === 'pan_center'
                      ? 'border-zinc-900 dark:border-white bg-zinc-900 dark:bg-white text-white dark:text-black shadow-xs'
                      : 'border-[var(--border-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                  "
                >
                  Manual Pan
                </button>
              </div>

              <!-- Contextual Controls for Gamer Mode -->
              <div v-if="framingMode === 'facecam_gameplay'" class="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181a] border border-[var(--border-card)] space-y-2">
                <span class="text-[11px] font-semibold text-[var(--text-secondary)] block">
                  {{ locale === 'id' ? 'Posisi Webcam / Facecam Streamer' : 'Streamer Facecam Corner' }}:
                </span>
                <div class="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    @click="facecamCorner = 'top-left'"
                    class="px-2 py-1.5 text-xs rounded-md border font-mono transition-colors cursor-pointer"
                    :class="facecamCorner === 'top-left' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black font-bold' : 'border-[var(--border-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'"
                  >
                    &#x2196; Kiri Atas
                  </button>
                  <button
                    type="button"
                    @click="facecamCorner = 'top-right'"
                    class="px-2 py-1.5 text-xs rounded-md border font-mono transition-colors cursor-pointer"
                    :class="facecamCorner === 'top-right' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black font-bold' : 'border-[var(--border-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'"
                  >
                    &#x2197; Kanan Atas
                  </button>
                  <button
                    type="button"
                    @click="facecamCorner = 'bottom-left'"
                    class="px-2 py-1.5 text-xs rounded-md border font-mono transition-colors cursor-pointer"
                    :class="facecamCorner === 'bottom-left' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black font-bold' : 'border-[var(--border-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'"
                  >
                    &#x2199; Kiri Bawah
                  </button>
                  <button
                    type="button"
                    @click="facecamCorner = 'bottom-right'"
                    class="px-2 py-1.5 text-xs rounded-md border font-mono transition-colors cursor-pointer"
                    :class="facecamCorner === 'bottom-right' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black font-bold' : 'border-[var(--border-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'"
                  >
                    &#x2198; Kanan Bawah
                  </button>
                </div>
              </div>

              <!-- Contextual Controls for Manual Pan Mode -->
              <div v-if="framingMode === 'pan_center'" class="p-3 rounded-xl bg-zinc-50 dark:bg-[#18181a] border border-[var(--border-card)] space-y-2">
                <div class="flex items-center justify-between text-[11px] font-semibold text-[var(--text-secondary)]">
                  <span>{{ locale === 'id' ? 'Fokus Horizontal' : 'Horizontal Focus Offset' }}:</span>
                  <span class="font-mono text-[var(--text-primary)] font-bold">{{ horizontalPan }}%</span>
                </div>
                <input
                  type="range"
                  min="-80"
                  max="80"
                  step="5"
                  v-model.number="horizontalPan"
                  class="w-full accent-zinc-900 dark:accent-white cursor-pointer"
                />
                <div class="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    @click="horizontalPan = -50"
                    class="px-2 py-1 text-[11px] rounded border border-[var(--border-card)] hover:bg-[var(--bg-card-hover)] cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Fokus Kiri
                  </button>
                  <button
                    type="button"
                    @click="horizontalPan = 0"
                    class="px-2 py-1 text-[11px] rounded border border-[var(--border-card)] hover:bg-[var(--bg-card-hover)] cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Tengah
                  </button>
                  <button
                    type="button"
                    @click="horizontalPan = 50"
                    class="px-2 py-1 text-[11px] rounded border border-[var(--border-card)] hover:bg-[var(--bg-card-hover)] cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Fokus Kanan
                  </button>
                </div>
              </div>
            </div>

            <!-- OUR OWN NATIVE 9:16 VIDEO PLAYER STAGE (Zero YouTube Iframe UI) -->
            <div class="relative w-full max-w-[300px] mx-auto aspect-[9/16] rounded-2xl overflow-hidden bg-black shadow-2xl border-2 border-zinc-800 select-none group flex flex-col justify-between">
              
              <!-- 1. Video Visual Layer -->
              <div class="absolute inset-0 overflow-hidden cursor-pointer" @click="togglePlay">
                <!-- Smart Blur Mode: Dynamic Blurred Background Video -->
                <div v-if="framingMode === 'blur_padded'" class="absolute inset-0 overflow-hidden pointer-events-none">
                  <video
                    v-if="!videoLoadError"
                    :src="videoStreamUrl"
                    class="w-full h-full object-cover scale-150 blur-xl opacity-50"
                    muted
                    loop
                    autoplay
                    playsinline
                  ></video>
                  <img
                    v-else
                    :src="resultData.thumbnail"
                    alt="Background blur"
                    class="w-full h-full object-cover scale-150 blur-xl opacity-50"
                  />
                </div>

                <!-- Primary Native HTML5 Video Element -->
                <div
                  class="w-full h-full flex items-center justify-center relative overflow-hidden"
                  :class="{
                    'p-2': framingMode === 'blur_padded'
                  }"
                >
                  <video
                    ref="videoElementRef"
                    :src="videoStreamUrl"
                    class="w-full h-full"
                    :class="{
                      'object-contain': framingMode === 'blur_padded',
                      'object-cover': framingMode === 'pan_center' || framingMode === 'facecam_gameplay'
                    }"
                    :style="
                      framingMode === 'pan_center'
                        ? { transform: `translateX(${horizontalPan}%) scale(1.6)` }
                        : {}
                    "
                    playsinline
                    :muted="isMuted"
                    @loadedmetadata="onVideoLoadedMetadata"
                    @timeupdate="onVideoTimeUpdate"
                    @error="onVideoError"
                    @play="isPlaying = true"
                    @pause="isPlaying = false"
                  />
                </div>

                <!-- Play / Pause Overlay Icon when paused -->
                <div
                  v-if="!isPlaying"
                  class="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px] transition-opacity pointer-events-none"
                >
                  <div class="w-12 h-12 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg">
                    <Play class="w-6 h-6 fill-current ml-0.5" />
                  </div>
                </div>
              </div>

              <!-- 2. Live Subtitle Overlay inside 9:16 Mockup Frame -->
              <div
                v-if="showSubtitles && currentSubtitle"
                class="absolute inset-x-3 z-30 pointer-events-none flex justify-center"
                :class="{
                  'top-14': subtitlePosition === 'top',
                  'top-1/2 -translate-y-1/2': subtitlePosition === 'center',
                  'bottom-14': subtitlePosition === 'bottom'
                }"
              >
                <!-- Clean White (DEFAULT!) -->
                <div
                  v-if="subtitleStyle === 'minimal'"
                  class="text-white font-extrabold uppercase tracking-wide text-center drop-shadow-[0_2px_4px_rgba(0,0,0,1)] px-2 leading-tight"
                  :class="{
                    'text-xs': subtitleSize === 'sm',
                    'text-sm': subtitleSize === 'md',
                    'text-base': subtitleSize === 'lg'
                  }"
                >
                  {{ currentSubtitle }}
                </div>

                <!-- TikTok Yellow -->
                <div
                  v-else-if="subtitleStyle === 'tiktok'"
                  class="text-[#FEE440] font-black uppercase tracking-wider text-center drop-shadow-[0_2px_4px_rgba(0,0,0,1)] px-2 leading-tight"
                  :class="{
                    'text-xs': subtitleSize === 'sm',
                    'text-sm': subtitleSize === 'md',
                    'text-base': subtitleSize === 'lg'
                  }"
                >
                  {{ currentSubtitle }}
                </div>

                <!-- Boxed Dark -->
                <div
                  v-else-if="subtitleStyle === 'boxed'"
                  class="bg-black/85 backdrop-blur-sm text-white font-bold text-center px-2.5 py-1 rounded-md border border-white/10 leading-tight"
                  :class="{
                    'text-[10px]': subtitleSize === 'sm',
                    'text-xs': subtitleSize === 'md',
                    'text-sm': subtitleSize === 'lg'
                  }"
                >
                  {{ currentSubtitle }}
                </div>

                <!-- Neon Cyan -->
                <div
                  v-else-if="subtitleStyle === 'neon'"
                  class="text-cyan-300 font-black uppercase text-center drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] px-2 leading-tight"
                  :class="{
                    'text-xs': subtitleSize === 'sm',
                    'text-sm': subtitleSize === 'md',
                    'text-base': subtitleSize === 'lg'
                  }"
                >
                  {{ currentSubtitle }}
                </div>
              </div>

              <!-- Top watermark -->
              <div class="absolute top-2.5 right-2.5 z-20 pointer-events-none px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[9px] font-mono text-zinc-300">
                Avttr Studio
              </div>

              <!-- 3. Minimalist Sleek Player Bar (Matching Video Resizer Style) -->
              <div class="absolute inset-x-0 bottom-0 z-30 px-3 py-2 bg-gradient-to-t from-black via-black/80 to-transparent flex items-center gap-2 select-none">
                <!-- Play / Pause -->
                <button
                  type="button"
                  class="p-1 text-white hover:text-white/80 transition-colors cursor-pointer shrink-0"
                  @click="togglePlay"
                >
                  <Play v-if="!isPlaying" class="w-4 h-4 fill-current" />
                  <Pause v-else class="w-4 h-4 fill-current" />
                </button>

                <!-- Scrubber Track -->
                <div
                  ref="scrubberBarRef"
                  class="relative flex-1 flex items-center h-4 cursor-pointer group/scrub"
                  @mousedown="startScrubbing"
                >
                  <div class="w-full h-1 bg-white/20 group-hover/scrub:h-1.5 rounded-full relative overflow-hidden transition-all">
                    <div
                      class="h-full bg-white dark:bg-[#F5F5F7] rounded-full"
                      :style="{ width: `${clipProgressPercent}%` }"
                    />
                  </div>
                  <div
                    class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-[#F5F5F7] rounded-full shadow pointer-events-none"
                    :style="{ left: `${clipProgressPercent}%` }"
                  />
                </div>

                <!-- Timecode -->
                <div class="text-[10px] font-mono text-white/90 shrink-0 whitespace-nowrap">
                  {{ formatPlayerTime(currentTime - activeClip.startTime) }} / {{ formatPlayerTime(activeClip.duration) }}
                </div>

                <!-- Restart Button -->
                <button
                  type="button"
                  class="p-1 text-white/70 hover:text-white transition-colors cursor-pointer shrink-0"
                  title="Ulang klip dari awal"
                  @click="restartClip"
                >
                  <RefreshCw class="w-3.5 h-3.5" />
                </button>

                <!-- Mute -->
                <button
                  type="button"
                  class="p-1 text-white/70 hover:text-white transition-colors cursor-pointer shrink-0"
                  @click="isMuted = !isMuted"
                >
                  <Volume2 v-if="!isMuted" class="w-3.5 h-3.5" />
                  <VolumeX v-else class="w-3.5 h-3.5 text-white/90" />
                </button>
              </div>
            </div>

            <!-- Direct Video Clip Download Buttons -->
            <div class="pt-2 space-y-2">
              <!-- Primary: Download MP4 Video Clip -->
              <Button
                variant="primary"
                size="default"
                class="w-full justify-center text-xs font-bold py-2.5 shadow-md cursor-pointer"
                :loading="isDownloadingClip"
                @click="downloadActiveClipVideo"
              >
                <Download class="w-4 h-4 mr-2" />
                {{ locale === 'id' ? 'Download Video Klip (MP4)' : 'Download Video Clip (MP4)' }}
              </Button>

              <!-- Secondary: Download Subtitle SRT -->
              <Button
                variant="outline"
                size="default"
                class="w-full justify-center text-xs font-semibold cursor-pointer"
                @click="downloadClipSrt"
              >
                <FileText class="w-3.5 h-3.5 mr-1.5" />
                {{ locale === 'id' ? 'Download Subtitle (.SRT)' : 'Download Subtitle (.SRT)' }}
              </Button>

              <!-- Advanced Trim in Video Resizer Studio Link -->
              <NuxtLink
                :to="{
                  path: '/tools/video-resizer',
                  query: {
                    source: `https://www.youtube.com/watch?v=${resultData.videoId}`,
                    start: activeClip.startTime.toString(),
                    end: activeClip.endTime.toString()
                  }
                }"
                class="flex items-center justify-center w-full h-9 rounded-lg border border-[var(--border-card)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors"
              >
                <Scissors class="w-3.5 h-3.5 mr-1.5 text-[var(--text-tertiary)]" />
                {{ locale === 'id' ? 'Edit & Potong Presisi di Video Trimmer Studio' : 'Precision Trim in Video Trimmer Studio' }}
                <ArrowRight class="w-3 h-3 ml-1" />
              </NuxtLink>
            </div>
          </Card>
        </div>
      </div>
    </div>
  </div>
</template>
