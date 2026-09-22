<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import {
  Film,
  Play,
  Pause,
  RotateCcw,
  Download,
  Scissors,
  Sliders,
  FolderOpen,
  X,
  Volume2,
  VolumeX,
  Check,
  Clipboard,
  ArrowRight,
  Link as LinkIcon,
  Lock,
  Unlock,
  Sparkles,
  Monitor,
  RefreshCw,
  Clock,
  HardDrive
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import { useI18n } from '~/composables/useI18n'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

const toast = useToast()
const { t, locale } = useI18n()

useHead({
  title: 'Video Resizer & Trimmer — Avttr Studio',
  meta: [
    {
      name: 'description',
      content: 'Adjust video resolution, trim duration, and compress file size with fast client-side hardware processing. 100% private.'
    }
  ]
})

// Source state
const videoFile = ref<File | null>(null)
const videoUrl = ref<string>('')
const videoElementRef = ref<HTMLVideoElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const timelineContainerRef = ref<HTMLDivElement | null>(null)

// Input URL omnibox state
const videoUrlInput = ref('')
const isFetchingUrl = ref(false)
const isDragging = ref(false)

// Video Metadata
const videoNaturalWidth = ref(0)
const videoNaturalHeight = ref(0)
const totalDuration = ref(0)
const currentTime = ref(0)
const isPlaying = ref(false)
const isMuted = ref(false)
const originalFileSize = ref(0)

// Trimmer Range State (in seconds)
const startTime = ref(0)
const endTime = ref(0)
const isPreviewingTrim = ref(false)

// Resolution Presets
type ResolutionPreset = 'original' | '1080p' | '720p' | '480p' | '360p' | 'custom'
const selectedPreset = ref<ResolutionPreset>('720p')
const customWidth = ref(1280)
const customHeight = ref(720)
const lockAspectRatio = ref(true)

// Quality & Audio
const qualityPreset = ref<'high' | 'balanced' | 'compact'>('balanced')
const keepAudio = ref(true)

// Processing state
const isProcessing = ref(false)
const processProgress = ref(0)
const processStatus = ref('Preparing video frames...')

// Output State
const outputBlobUrl = ref<string>('')
const outputSize = ref<number>(0)
const outputWidth = ref<number>(0)
const outputHeight = ref<number>(0)
const outputDuration = ref<number>(0)
const outputMimeType = ref<string>('')

// Computed Target Dimensions (Always even numbers for video encoders)
const targetDimensions = computed<{ width: number; height: number }>(() => {
  const srcW = videoNaturalWidth.value || 1920
  const srcH = videoNaturalHeight.value || 1080
  const aspect = srcW / srcH
  const isLandscape = srcW >= srcH

  if (selectedPreset.value === 'original') {
    return {
      width: Math.round(srcW / 2) * 2,
      height: Math.round(srcH / 2) * 2
    }
  }

  if (selectedPreset.value === 'custom') {
    return {
      width: Math.max(16, Math.round((customWidth.value || 640) / 2) * 2),
      height: Math.max(16, Math.round((customHeight.value || 360) / 2) * 2)
    }
  }

  const maxDimensionMap: Record<'1080p' | '720p' | '480p' | '360p', number> = {
    '1080p': 1920,
    '720p': 1280,
    '480p': 854,
    '360p': 640
  }

  const targetMax = maxDimensionMap[selectedPreset.value]

  let w: number
  let h: number

  if (isLandscape) {
    w = Math.min(srcW, targetMax)
    h = Math.round(w / aspect)
  } else {
    h = Math.min(srcH, targetMax)
    w = Math.round(h * aspect)
  }

  return {
    width: Math.max(16, Math.round(w / 2) * 2),
    height: Math.max(16, Math.round(h / 2) * 2)
  }
})

// Target Bitrate Estimation
const targetBitrate = computed<number>(() => {
  const pixelCount = targetDimensions.value.width * targetDimensions.value.height
  const baseRate = pixelCount > 1920 * 1000 ? 3500000 : pixelCount > 1280 * 700 ? 1800000 : 900000

  if (qualityPreset.value === 'high') return Math.round(baseRate * 1.5)
  if (qualityPreset.value === 'compact') return Math.round(baseRate * 0.6)
  return baseRate
})

// Trim Duration
const trimDuration = computed(() => {
  return Math.max(0.1, Number((endTime.value - startTime.value).toFixed(2)))
})

// Size Savings
const sizeSavingsPercentage = computed(() => {
  if (!originalFileSize.value || !outputSize.value) return 0
  const diff = originalFileSize.value - outputSize.value
  return Math.round((diff / originalFileSize.value) * 100)
})

// Format Helpers
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

// Custom dimension sync with aspect ratio
watch(customWidth, (newW) => {
  if (selectedPreset.value === 'custom' && lockAspectRatio.value && videoNaturalWidth.value && videoNaturalHeight.value) {
    const ratio = videoNaturalHeight.value / videoNaturalWidth.value
    customHeight.value = Math.round((newW * ratio) / 2) * 2
  }
})

// Video Loading & Event Handlers
function onLoadedMetadata() {
  if (!videoElementRef.value) return
  const el = videoElementRef.value
  videoNaturalWidth.value = el.videoWidth
  videoNaturalHeight.value = el.videoHeight
  totalDuration.value = el.duration
  startTime.value = 0
  endTime.value = el.duration
  customWidth.value = el.videoWidth
  customHeight.value = el.videoHeight
}

function onTimeUpdate() {
  if (!videoElementRef.value) return
  currentTime.value = videoElementRef.value.currentTime

  // Auto loop/stop trim preview
  if (isPreviewingTrim.value && currentTime.value >= endTime.value) {
    videoElementRef.value.pause()
    isPlaying.value = false
    isPreviewingTrim.value = false
    videoElementRef.value.currentTime = startTime.value
  }
}

function togglePlay() {
  if (!videoElementRef.value) return
  if (isPlaying.value) {
    videoElementRef.value.pause()
    isPlaying.value = false
    isPreviewingTrim.value = false
  } else {
    if (currentTime.value >= totalDuration.value) {
      videoElementRef.value.currentTime = startTime.value
    }
    videoElementRef.value.play().catch(() => {})
    isPlaying.value = true
  }
}

function previewTrimSelection() {
  if (!videoElementRef.value) return
  videoElementRef.value.currentTime = startTime.value
  isPreviewingTrim.value = true
  videoElementRef.value.play().catch(() => {})
  isPlaying.value = true
}

function seekTo(seconds: number) {
  if (!videoElementRef.value) return
  videoElementRef.value.currentTime = Math.max(0, Math.min(totalDuration.value, seconds))
}

function onTimelineClick(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement | null
  if (!target || !totalDuration.value) return
  const rect = target.getBoundingClientRect()
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  seekTo(pct * totalDuration.value)
}

function resetTrim() {
  startTime.value = 0
  endTime.value = totalDuration.value
  seekTo(0)
}

// File Upload Handler
function handleFileUpload(file: File) {
  if (!file.type.startsWith('video/')) {
    toast.error(
      locale.value === 'id' ? 'Format File Salah' : 'Invalid File',
      locale.value === 'id' ? 'Silakan pilih file video (MP4, WebM, MOV).' : 'Please upload a video file (MP4, WebM, MOV).'
    )
    return
  }

  // Revoke previous URL
  if (videoUrl.value && videoUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(videoUrl.value)
  }
  if (outputBlobUrl.value && outputBlobUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(outputBlobUrl.value)
    outputBlobUrl.value = ''
  }

  videoFile.value = file
  originalFileSize.value = file.size
  videoUrl.value = URL.createObjectURL(file)
  isPlaying.value = false
  currentTime.value = 0
}

function onFileInputChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    handleFileUpload(target.files[0])
    target.value = ''
  }
}

async function fetchVideoFromUrl() {
  const url = videoUrlInput.value.trim()
  if (!url) return

  isFetchingUrl.value = true
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const file = new File([blob], 'video.mp4', { type: blob.type || 'video/mp4' })
    handleFileUpload(file)
    videoUrlInput.value = ''
    toast.success(
      locale.value === 'id' ? 'Video Berhasil Dimuat' : 'Video Loaded',
      locale.value === 'id' ? 'Video siap untuk di-resize dan di-trim.' : 'Video ready for resizing and trimming.'
    )
  } catch (err) {
    toast.error(
      locale.value === 'id' ? 'Gagal Memuat Video' : 'Failed to Load Video',
      locale.value === 'id' ? 'Pastikan URL video mengizinkan akses CORS.' : 'Make sure the direct video URL allows CORS access.'
    )
  } finally {
    isFetchingUrl.value = false
  }
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      videoUrlInput.value = text.trim()
      fetchVideoFromUrl()
    }
  } catch {
    toast.error('Clipboard', 'Failed to read clipboard')
  }
}

// ─── Core Client-Side Video Processing Engine ────────────────────────
let abortProcessing = false

function cancelProcessing() {
  abortProcessing = true
  isProcessing.value = false
  processStatus.value = 'Cancelled'
}

async function processVideo() {
  if (!videoElementRef.value || !videoNaturalWidth.value) return

  const video = videoElementRef.value
  const targetW = targetDimensions.value.width
  const targetH = targetDimensions.value.height
  const start = startTime.value
  const end = endTime.value
  const duration = end - start

  if (duration <= 0) {
    toast.error('Invalid Range', 'End time must be greater than start time.')
    return
  }

  isProcessing.value = true
  processProgress.value = 0
  processStatus.value = locale.value === 'id' ? 'Menginisialisasi encoder...' : 'Initializing encoder...'
  abortProcessing = false

  // Pause playback
  video.pause()
  isPlaying.value = false

  // Setup offscreen canvas
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d', { alpha: false })

  if (!ctx) {
    toast.error('Error', 'Canvas 2D context not supported')
    isProcessing.value = false
    return
  }

  // Select supported recording MIME type
  const possibleTypes = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ]

  let mimeType = ''
  for (const type of possibleTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      mimeType = type
      break
    }
  }

  if (!mimeType) {
    toast.error('Error', 'No supported video recording codec found.')
    isProcessing.value = false
    return
  }

  outputMimeType.value = mimeType

  try {
    // Setup Canvas stream (30 fps)
    const videoStream = canvas.captureStream(30)
    let combinedStream: MediaStream = videoStream

    // Audio routing via Web Audio API if audio enabled
    let audioCtx: AudioContext | null = null
    if (keepAudio.value && !isMuted.value) {
      try {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const source = audioCtx.createMediaElementSource(video)
        const dest = audioCtx.createMediaStreamDestination()
        source.connect(dest)
        source.connect(audioCtx.destination) // Keep audible if desired

        const audioTracks = dest.stream.getAudioTracks()
        if (audioTracks.length > 0) {
          combinedStream = new MediaStream([
            ...videoStream.getVideoTracks(),
            ...audioTracks
          ])
        }
      } catch (audioErr) {
        console.warn('Audio capture bypassed:', audioErr)
      }
    }

    const recordedChunks: Blob[] = []
    const mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: targetBitrate.value
    })

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data)
      }
    }

    const recordPromise = new Promise<Blob>((resolve, reject) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: mimeType })
        resolve(blob)
      }
      mediaRecorder.onerror = (err) => reject(err)
    })

    // Seek to start position
    video.currentTime = start
    await new Promise((res) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked)
        res(true)
      }
      video.addEventListener('seeked', onSeeked)
    })

    // Start Recording
    mediaRecorder.start(100) // Emit chunks every 100ms
    video.play()

    processStatus.value = locale.value === 'id' ? 'Memproses frame video...' : 'Processing video frames...'

    // Frame rendering loop
    await new Promise<void>((resolve) => {
      function renderFrame() {
        if (abortProcessing) {
          video.pause()
          mediaRecorder.stop()
          resolve()
          return
        }

        if (video.currentTime >= end || video.ended) {
          video.pause()
          mediaRecorder.stop()
          resolve()
          return
        }

        ctx!.drawImage(video, 0, 0, targetW, targetH)

        const currentProg = ((video.currentTime - start) / duration) * 100
        processProgress.value = Math.min(99, Math.max(0, Math.round(currentProg)))

        requestAnimationFrame(renderFrame)
      }

      requestAnimationFrame(renderFrame)
    })

    if (abortProcessing) {
      if (audioCtx) audioCtx.close()
      return
    }

    processStatus.value = locale.value === 'id' ? 'Menyusun file video...' : 'Packaging video file...'
    processProgress.value = 100

    const finalBlob = await recordPromise
    if (audioCtx) audioCtx.close()

    // Setup output preview
    if (outputBlobUrl.value && outputBlobUrl.value.startsWith('blob:')) {
      URL.revokeObjectURL(outputBlobUrl.value)
    }

    outputBlobUrl.value = URL.createObjectURL(finalBlob)
    outputSize.value = finalBlob.size
    outputWidth.value = targetW
    outputHeight.value = targetH
    outputDuration.value = duration
    isProcessing.value = false

    toast.success(
      locale.value === 'id' ? 'Selesai!' : 'Complete!',
      locale.value === 'id'
        ? `Video berhasil di-resize ke ${targetW}x${targetH} (${formatFileSize(finalBlob.size)}).`
        : `Video resized to ${targetW}x${targetH} (${formatFileSize(finalBlob.size)}).`
    )
  } catch (err: any) {
    console.error('Video processing error:', err)
    toast.error(
      'Processing Error',
      err?.message || 'Failed to process video'
    )
    isProcessing.value = false
  }
}

function downloadOutput() {
  if (!outputBlobUrl.value) return
  const a = document.createElement('a')
  a.href = outputBlobUrl.value
  const ext = outputMimeType.value.includes('mp4') ? 'mp4' : 'webm'
  const origName = videoFile.value?.name ? videoFile.value.name.replace(/\.[^.]+$/, '') : 'video'
  a.download = `${origName}_${targetDimensions.value.width}x${targetDimensions.value.height}.${ext}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

onUnmounted(() => {
  if (videoUrl.value && videoUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(videoUrl.value)
  }
  if (outputBlobUrl.value && outputBlobUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(outputBlobUrl.value)
  }
})
</script>

<template>
  <div class="space-y-6 pb-12 w-full">
    <!-- Breadcrumb Navigation -->
    <div class="flex items-center gap-2 text-xs font-mono text-[var(--text-tertiary)]">
      <NuxtLink to="/" class="hover:text-[var(--text-primary)] transition-colors">Dashboard</NuxtLink>
      <span>/</span>
      <span>Media Tools</span>
      <span>/</span>
      <span class="text-[var(--text-primary)]">Video Resizer & Trimmer</span>
    </div>

    <!-- Hidden File Input -->
    <input
      ref="fileInputRef"
      type="file"
      accept="video/mp4,video/webm,video/quicktime,video/mov,video/mkv,video/avi"
      class="hidden"
      @change="onFileInputChange"
    />

    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          {{ t.tools['video-resizer']?.title || 'Video Resizer & Trimmer' }}
        </h1>
        <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
          {{ t.tools['video-resizer']?.description || 'Adjust video resolution, trim clip duration, and reduce file size with client-side hardware processing.' }}
        </p>
      </div>

      <div class="flex items-center gap-2.5 shrink-0">
        <Badge variant="badge">Client Privacy</Badge>
        <Button
          v-if="videoUrl"
          variant="secondary"
          size="default"
          class="h-9 px-3.5 rounded-lg text-xs font-medium cursor-pointer"
          @click="fileInputRef?.click()"
        >
          <FolderOpen class="w-3.5 h-3.5 mr-1.5 text-white/70" />
          <span>{{ locale === 'id' ? 'Ganti Video' : 'Change Video' }}</span>
        </Button>
      </div>
    </div>

    <!-- STATE 1: Upload Stage (When No Video Loaded) -->
    <div v-if="!videoUrl" class="space-y-4">
      <!-- URL Input Omnibox -->
      <div class="flex flex-col sm:flex-row items-center gap-2.5">
        <div class="relative w-full flex-1 flex items-center">
          <LinkIcon class="w-4 h-4 text-[var(--text-tertiary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            v-model="videoUrlInput"
            type="url"
            :placeholder="locale === 'id' ? 'Tempel link video langsung (CORS enabled)...' : 'Paste direct video URL (CORS enabled)...'"
            class="w-full h-11 pl-10 bg-[#171717] hover:bg-[#1a1a1c] border border-[#2E2E2E] focus:border-white/40 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-xl text-xs font-mono transition-all focus:outline-none focus:ring-2 focus:ring-white/10"
            :class="videoUrlInput ? 'pr-20' : 'pr-10'"
            @keydown.enter="fetchVideoFromUrl"
          />
          <div class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              v-if="videoUrlInput"
              type="button"
              class="p-1 text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center rounded-lg hover:bg-white/10 active:scale-95"
              title="Clear input"
              aria-label="Clear input"
              @click="videoUrlInput = ''"
            >
              <X class="w-4 h-4" />
            </button>
            <button
              type="button"
              class="p-1 text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center rounded-lg hover:bg-white/10 active:scale-95"
              @click="pasteFromClipboard"
              :title="locale === 'id' ? 'Tempel dari clipboard' : 'Paste from clipboard'"
              :aria-label="locale === 'id' ? 'Tempel dari clipboard' : 'Paste from clipboard'"
            >
              <Clipboard class="w-4 h-4" />
            </button>
          </div>
        </div>
        <Button
          variant="secondary"
          size="default"
          class="w-full sm:w-auto h-11 px-5 rounded-xl font-medium text-xs shrink-0 cursor-pointer"
          :disabled="!videoUrlInput.trim() || isFetchingUrl"
          :loading="isFetchingUrl"
          @click="fetchVideoFromUrl"
        >
          <ArrowRight class="w-3.5 h-3.5 mr-1.5" />
          <span>{{ t.fetchVideo }}</span>
        </Button>
      </div>

      <!-- Standardized Dashed Dropzone (DESIGN.md Section 10) -->
      <div
        class="relative border-2 border-dashed rounded-[14px] p-8 sm:p-14 text-center transition-all cursor-pointer select-none"
        :class="isDragging ? 'border-white bg-[var(--bg-card-hover)]' : 'border-[#2E2E2E] bg-[#141416] hover:border-[#3E3E3E]'"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="(e) => { isDragging = false; if (e.dataTransfer?.files[0]) handleFileUpload(e.dataTransfer.files[0]) }"
        @click="fileInputRef?.click()"
      >
        <div class="max-w-md mx-auto space-y-3">
          <div class="w-12 h-12 mx-auto rounded-xl bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-white shadow-xs">
            <Film class="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 class="text-sm font-semibold text-[var(--text-primary)]">
              {{ t.dropzoneBrowse }}
            </h3>
            <p class="text-xs text-[var(--text-secondary)] mt-1">
              Supports MP4, WebM, MOV, and MKV. 100% processed client-side.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- STATE 2: Video Studio Workbench -->
    <div v-else class="space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Left Column: Video Preview Player & Timeline Trimmer (7 Cols) -->
        <div class="lg:col-span-7 space-y-4">
          <!-- Video Display Card -->
          <div class="bg-[#141416] border border-[#2E2E2E] rounded-[14px] overflow-hidden shadow-xs">
            <div class="relative bg-black aspect-video flex items-center justify-center overflow-hidden">
              <video
                ref="videoElementRef"
                :src="videoUrl"
                crossorigin="anonymous"
                playsinline
                :muted="isMuted"
                class="w-full h-full object-contain"
                @loadedmetadata="onLoadedMetadata"
                @timeupdate="onTimeUpdate"
                @ended="isPlaying = false"
              />

              <!-- Center Big Play Overlay -->
              <button
                type="button"
                class="absolute inset-0 m-auto w-14 h-14 rounded-full bg-black/60 border border-white/20 text-white flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-xs"
                :class="isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'"
                @click="togglePlay"
              >
                <Play v-if="!isPlaying" class="w-6 h-6 fill-current ml-0.5" />
                <Pause v-else class="w-6 h-6 fill-current" />
              </button>

              <!-- Duration Badge Top Right -->
              <div class="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-black/70 border border-white/10 text-[11px] font-mono text-white/90 backdrop-blur-xs">
                {{ formatTime(currentTime) }} / {{ formatTime(totalDuration) }}
              </div>
            </div>

            <!-- Player Quick Control Bar -->
            <div class="px-4 py-3 bg-[#18181A] border-t border-[#2E2E2E] flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  class="p-1 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                  @click="togglePlay"
                >
                  <Play v-if="!isPlaying" class="w-4 h-4 fill-current" />
                  <Pause v-else class="w-4 h-4 fill-current" />
                </button>

                <button
                  type="button"
                  class="p-1 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                  @click="isMuted = !isMuted"
                >
                  <Volume2 v-if="!isMuted" class="w-4 h-4" />
                  <VolumeX v-else class="w-4 h-4 text-red-400" />
                </button>

                <span class="text-white/80 font-medium">
                  {{ videoNaturalWidth }}×{{ videoNaturalHeight }}px
                </span>
              </div>

              <div class="flex items-center gap-2">
                <span>{{ formatFileSize(originalFileSize) }}</span>
              </div>
            </div>
          </div>

          <!-- Video Timeline Trimmer Card -->
          <div class="bg-[#141416] border border-[#2E2E2E] rounded-[14px] p-5 space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Scissors class="w-4 h-4 text-white/80" />
                <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] font-mono">
                  Clip Trimmer
                </h3>
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="text-[11px] font-mono text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  @click="resetTrim"
                >
                  Reset Full Duration
                </button>
              </div>
            </div>

            <!-- Visual Timeline Scrub Bar -->
            <div class="space-y-2">
              <div
                ref="timelineContainerRef"
                class="relative h-9 bg-[#212121] rounded-lg border border-[#2E2E2E] overflow-hidden cursor-pointer select-none"
                @click="onTimelineClick"
              >
                <!-- Trimmed Active Range Zone -->
                <div
                  v-if="totalDuration > 0"
                  class="absolute top-0 bottom-0 bg-white/15 border-x border-white/40"
                  :style="{
                    left: `${(startTime / totalDuration) * 100}%`,
                    width: `${Math.max(0, ((endTime - startTime) / totalDuration) * 100)}%`
                  }"
                />

                <!-- Current Playhead Scrubber -->
                <div
                  v-if="totalDuration > 0"
                  class="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                  :style="{ left: `${(currentTime / totalDuration) * 100}%` }"
                >
                  <div class="w-2 h-2 rounded-full bg-red-500 -ml-[3px] -mt-0.5" />
                </div>
              </div>

              <!-- Start / End Range Sliders -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <div class="flex items-center justify-between text-[11px] font-mono text-neutral-400 mb-1">
                    <span>Start:</span>
                    <span class="text-white font-medium">{{ formatTime(startTime) }}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    :max="Math.max(0, endTime - 0.1)"
                    step="0.1"
                    v-model.number="startTime"
                    class="w-full accent-white cursor-pointer"
                    @input="seekTo(startTime)"
                  />
                </div>

                <div>
                  <div class="flex items-center justify-between text-[11px] font-mono text-neutral-400 mb-1">
                    <span>End:</span>
                    <span class="text-white font-medium">{{ formatTime(endTime) }}</span>
                  </div>
                  <input
                    type="range"
                    :min="Math.min(totalDuration, startTime + 0.1)"
                    :max="totalDuration || 1"
                    step="0.1"
                    v-model.number="endTime"
                    class="w-full accent-white cursor-pointer"
                    @input="seekTo(endTime)"
                  />
                </div>
              </div>
            </div>

            <!-- Trimmer Footer Action -->
            <div class="pt-2 border-t border-[#212121] flex items-center justify-between">
              <div class="text-xs font-mono text-neutral-400">
                Trimmed Duration: <span class="text-white font-semibold">{{ formatTime(trimDuration) }}</span>
              </div>

              <Button
                variant="secondary"
                size="sm"
                class="h-8 px-3 rounded-lg text-xs font-medium cursor-pointer"
                @click="previewTrimSelection"
              >
                <Play class="w-3 h-3 fill-current mr-1.5" />
                <span>Preview Trim</span>
              </Button>
            </div>
          </div>
        </div>

        <!-- Right Column: Resolution & Quality Controls (5 Cols) -->
        <div class="lg:col-span-5 space-y-4">
          <!-- Resolution Controls Card -->
          <div class="bg-[#141416] border border-[#2E2E2E] rounded-[14px] p-5 space-y-4">
            <div class="flex items-center gap-2">
              <Monitor class="w-4 h-4 text-white/80" />
              <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] font-mono">
                Resolution Presets
              </h3>
            </div>

            <!-- Resolution Preset Grid (Clean & Non-Alay) -->
            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                class="px-3 py-2.5 rounded-lg border text-center transition-all cursor-pointer select-none"
                :class="selectedPreset === 'original'
                  ? 'bg-white text-black font-semibold border-white shadow-xs'
                  : 'bg-[#18181A] border-[#2E2E2E] text-neutral-300 hover:border-neutral-500'"
                @click="selectedPreset = 'original'"
              >
                <div class="text-xs">Original</div>
                <div class="text-[10px] opacity-70 font-mono mt-0.5">100%</div>
              </button>

              <button
                type="button"
                class="px-3 py-2.5 rounded-lg border text-center transition-all cursor-pointer select-none"
                :class="selectedPreset === '1080p'
                  ? 'bg-white text-black font-semibold border-white shadow-xs'
                  : 'bg-[#18181A] border-[#2E2E2E] text-neutral-300 hover:border-neutral-500'"
                @click="selectedPreset = '1080p'"
              >
                <div class="text-xs font-medium">1080p</div>
                <div class="text-[10px] opacity-70 font-mono mt-0.5">FHD</div>
              </button>

              <button
                type="button"
                class="px-3 py-2.5 rounded-lg border text-center transition-all cursor-pointer select-none"
                :class="selectedPreset === '720p'
                  ? 'bg-white text-black font-semibold border-white shadow-xs'
                  : 'bg-[#18181A] border-[#2E2E2E] text-neutral-300 hover:border-neutral-500'"
                @click="selectedPreset = '720p'"
              >
                <div class="text-xs font-medium">720p</div>
                <div class="text-[10px] opacity-70 font-mono mt-0.5">HD Standard</div>
              </button>

              <button
                type="button"
                class="px-3 py-2.5 rounded-lg border text-center transition-all cursor-pointer select-none"
                :class="selectedPreset === '480p'
                  ? 'bg-white text-black font-semibold border-white shadow-xs'
                  : 'bg-[#18181A] border-[#2E2E2E] text-neutral-300 hover:border-neutral-500'"
                @click="selectedPreset = '480p'"
              >
                <div class="text-xs font-medium">480p</div>
                <div class="text-[10px] opacity-70 font-mono mt-0.5">SD Compact</div>
              </button>

              <button
                type="button"
                class="px-3 py-2.5 rounded-lg border text-center transition-all cursor-pointer select-none"
                :class="selectedPreset === '360p'
                  ? 'bg-white text-black font-semibold border-white shadow-xs'
                  : 'bg-[#18181A] border-[#2E2E2E] text-neutral-300 hover:border-neutral-500'"
                @click="selectedPreset = '360p'"
              >
                <div class="text-xs font-medium">360p</div>
                <div class="text-[10px] opacity-70 font-mono mt-0.5">Minimal</div>
              </button>

              <button
                type="button"
                class="px-3 py-2.5 rounded-lg border text-center transition-all cursor-pointer select-none"
                :class="selectedPreset === 'custom'
                  ? 'bg-white text-black font-semibold border-white shadow-xs'
                  : 'bg-[#18181A] border-[#2E2E2E] text-neutral-300 hover:border-neutral-500'"
                @click="selectedPreset = 'custom'"
              >
                <div class="text-xs font-medium">Custom</div>
                <div class="text-[10px] opacity-70 font-mono mt-0.5">W × H</div>
              </button>
            </div>

            <!-- Custom W x H Inputs -->
            <div v-if="selectedPreset === 'custom'" class="p-3 bg-[#18181A] rounded-xl border border-[#2E2E2E] space-y-3">
              <div class="grid grid-cols-2 gap-2.5">
                <div>
                  <label class="block text-[11px] font-mono text-neutral-400 mb-1">Width (px)</label>
                  <input
                    type="number"
                    min="16"
                    step="2"
                    v-model.number="customWidth"
                    class="w-full h-8 px-2.5 bg-[#141416] border border-[#2E2E2E] rounded-lg text-xs font-mono text-white focus:outline-none focus:border-white/40"
                  />
                </div>
                <div>
                  <label class="block text-[11px] font-mono text-neutral-400 mb-1">Height (px)</label>
                  <input
                    type="number"
                    min="16"
                    step="2"
                    v-model.number="customHeight"
                    class="w-full h-8 px-2.5 bg-[#141416] border border-[#2E2E2E] rounded-lg text-xs font-mono text-white focus:outline-none focus:border-white/40"
                  />
                </div>
              </div>

              <div class="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  class="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white cursor-pointer select-none"
                  @click="lockAspectRatio = !lockAspectRatio"
                >
                  <Lock v-if="lockAspectRatio" class="w-3.5 h-3.5 text-white" />
                  <Unlock v-else class="w-3.5 h-3.5 text-neutral-500" />
                  <span>Lock Aspect Ratio</span>
                </button>
              </div>
            </div>

            <!-- Output Resolution Badge Display -->
            <div class="px-3.5 py-2.5 rounded-lg bg-[#18181A] border border-[#2E2E2E] flex items-center justify-between text-xs font-mono">
              <span class="text-neutral-400">Target Resolution:</span>
              <span class="text-white font-semibold">
                {{ targetDimensions.width }} × {{ targetDimensions.height }} px
              </span>
            </div>
          </div>

          <!-- Quality & Audio Settings Card -->
          <div class="bg-[#141416] border border-[#2E2E2E] rounded-[14px] p-5 space-y-4">
            <div class="flex items-center gap-2">
              <Sliders class="w-4 h-4 text-white/80" />
              <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] font-mono">
                Compression & Audio
              </h3>
            </div>

            <!-- Quality Presets -->
            <div class="space-y-1.5">
              <label class="block text-[11px] font-mono text-neutral-400">Encoding Profile</label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  class="py-2 px-2 rounded-lg border text-center text-xs transition-colors cursor-pointer select-none"
                  :class="qualityPreset === 'high'
                    ? 'bg-[#2E2E2E] text-white font-medium border-white/30'
                    : 'bg-[#18181A] text-neutral-400 border-[#2E2E2E] hover:text-white'"
                  @click="qualityPreset = 'high'"
                >
                  High
                </button>

                <button
                  type="button"
                  class="py-2 px-2 rounded-lg border text-center text-xs transition-colors cursor-pointer select-none"
                  :class="qualityPreset === 'balanced'
                    ? 'bg-[#2E2E2E] text-white font-medium border-white/30'
                    : 'bg-[#18181A] text-neutral-400 border-[#2E2E2E] hover:text-white'"
                  @click="qualityPreset = 'balanced'"
                >
                  Balanced
                </button>

                <button
                  type="button"
                  class="py-2 px-2 rounded-lg border text-center text-xs transition-colors cursor-pointer select-none"
                  :class="qualityPreset === 'compact'
                    ? 'bg-[#2E2E2E] text-white font-medium border-white/30'
                    : 'bg-[#18181A] text-neutral-400 border-[#2E2E2E] hover:text-white'"
                  @click="qualityPreset = 'compact'"
                >
                  Compact
                </button>
              </div>
            </div>

            <!-- Audio Toggle Switch -->
            <div class="pt-2 border-t border-[#212121] flex items-center justify-between">
              <div>
                <div class="text-xs font-medium text-white">Audio Track</div>
                <div class="text-[11px] text-neutral-400">Keep or mute audio track</div>
              </div>

              <button
                type="button"
                class="px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
                :class="keepAudio
                  ? 'bg-[#2E2E2E] border-white/30 text-white'
                  : 'bg-[#18181A] border-[#2E2E2E] text-neutral-400'"
                @click="keepAudio = !keepAudio"
              >
                <Volume2 v-if="keepAudio" class="w-3.5 h-3.5" />
                <VolumeX v-else class="w-3.5 h-3.5" />
                <span>{{ keepAudio ? 'Keep Audio' : 'Muted' }}</span>
              </button>
            </div>
          </div>

          <!-- Process Action Button -->
          <div class="space-y-3">
            <Button
              variant="primary"
              size="lg"
              class="w-full h-11 rounded-xl text-sm font-semibold cursor-pointer shadow-xs"
              :disabled="isProcessing"
              @click="processVideo"
            >
              <RefreshCw v-if="isProcessing" class="w-4 h-4 mr-2 animate-spin" />
              <Film v-else class="w-4 h-4 mr-2" />
              <span>{{ isProcessing ? 'Processing Video...' : 'Resize & Trim Video' }}</span>
            </Button>

            <!-- Processing Progress Bar -->
            <div v-if="isProcessing" class="p-4 bg-[#141416] border border-[#2E2E2E] rounded-xl space-y-2">
              <div class="flex items-center justify-between text-xs font-mono">
                <span class="text-neutral-400">{{ processStatus }}</span>
                <span class="text-white font-bold">{{ processProgress }}%</span>
              </div>
              <div class="w-full h-2 bg-[#212121] rounded-full overflow-hidden">
                <div
                  class="h-full bg-white transition-all duration-150"
                  :style="{ width: `${processProgress}%` }"
                />
              </div>
              <div class="flex justify-end pt-1">
                <button
                  type="button"
                  class="text-[11px] font-mono text-red-400 hover:underline cursor-pointer"
                  @click="cancelProcessing"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- STATE 3: Processed Output Section -->
      <div v-if="outputBlobUrl" class="bg-[#141416] border border-[#2E2E2E] rounded-[14px] p-6 space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#212121] pb-4">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Check class="w-4 h-4" />
            </div>
            <div>
              <h3 class="text-sm font-semibold text-white">Video Ready for Download</h3>
              <p class="text-xs text-neutral-400 font-mono">
                Processed via 100% Client-Side Hardware Canvas
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="default"
            class="h-10 px-5 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
            @click="downloadOutput"
          >
            <Download class="w-4 h-4 mr-2" />
            <span>Download Video</span>
          </Button>
        </div>

        <!-- Metrics Comparison Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
          <div class="p-3.5 bg-[#18181A] border border-[#2E2E2E] rounded-xl space-y-1">
            <div class="text-[10px] uppercase tracking-wider text-neutral-400">Resolution</div>
            <div class="text-xs text-neutral-400 line-through">{{ videoNaturalWidth }}×{{ videoNaturalHeight }}</div>
            <div class="text-sm font-bold text-white">{{ outputWidth }}×{{ outputHeight }}</div>
          </div>

          <div class="p-3.5 bg-[#18181A] border border-[#2E2E2E] rounded-xl space-y-1">
            <div class="text-[10px] uppercase tracking-wider text-neutral-400">Duration</div>
            <div class="text-xs text-neutral-400 line-through">{{ formatTime(totalDuration) }}</div>
            <div class="text-sm font-bold text-white">{{ formatTime(outputDuration) }}</div>
          </div>

          <div class="p-3.5 bg-[#18181A] border border-[#2E2E2E] rounded-xl space-y-1">
            <div class="text-[10px] uppercase tracking-wider text-neutral-400">File Size</div>
            <div class="text-xs text-neutral-400 line-through">{{ formatFileSize(originalFileSize) }}</div>
            <div class="text-sm font-bold text-emerald-400">{{ formatFileSize(outputSize) }}</div>
          </div>

          <div class="p-3.5 bg-[#18181A] border border-[#2E2E2E] rounded-xl space-y-1">
            <div class="text-[10px] uppercase tracking-wider text-neutral-400">Savings</div>
            <div class="text-xs text-neutral-400">Reduced by</div>
            <div class="text-sm font-bold" :class="sizeSavingsPercentage > 0 ? 'text-emerald-400' : 'text-white'">
              {{ sizeSavingsPercentage > 0 ? `-${sizeSavingsPercentage}%` : 'Optimal' }}
            </div>
          </div>
        </div>

        <!-- Output Player Preview -->
        <div class="max-w-xl mx-auto rounded-xl overflow-hidden border border-[#2E2E2E] bg-black">
          <video
            :src="outputBlobUrl"
            controls
            playsinline
            class="w-full max-h-[360px] object-contain mx-auto"
          />
        </div>
      </div>
    </div>
  </div>
</template>
