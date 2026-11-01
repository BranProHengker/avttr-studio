<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import JSZip from 'jszip'
import {
  CinemaOld as Film,
  Play,
  Pause,
  Undo as RotateCcw,
  Download,
  Scissor as Scissors,
  ControlSlider as Sliders,
  Folder as FolderOpen,
  Xmark as X,
  SoundHigh as Volume2,
  SoundOff as VolumeX,
  Check,
  PasteClipboard as Clipboard,
  ArrowRight,
  Link as LinkIcon,
  Lock,
  LockSlash as Unlock,
  Sparks as Sparkles,
  Tv as Monitor,
  Refresh as RefreshCw,
  Clock,
  HardDrive,
  Maximize,
  Compress as Minimize,
  Archive,
  Trash as Trash2,
  Plus,
  WarningCircle as AlertCircle,
  List,
} from '@iconoir/vue'
import { useToast } from '~/composables/useToast'
import { useI18n } from '~/composables/useI18n'
import Button from '~/components/ui/Button.vue'
import Card from '~/components/ui/Card.vue'
import Badge from '~/components/ui/Badge.vue'
import UrlOmnibar from '~/components/ui/UrlOmnibar.vue'

interface VideoQueueItem {
  id: string
  file: File
  name: string
  originalSize: number
  status: 'waiting' | 'processing' | 'done' | 'error'
  progress: number
  outputBlob: Blob | null
  outputUrl: string
  outputSize: number
  savedPercent: number
  targetWidth: number
  targetHeight: number
  thumbnailUrl?: string
  estimatedSecondsRemaining?: number
  errorMsg?: string
}

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

// Mode and Batch Queue State
const mode = ref<'single' | 'batch'>('single')
const queue = ref<VideoQueueItem[]>([])
const isBatchProcessing = ref(false)
const currentBatchIndex = ref(-1)
const isZipping = ref(false)
const batchEtaSeconds = ref<number>(0)
const activePreviewItem = ref<VideoQueueItem | null>(null)
const previewModalUrl = ref<string>('')
let abortBatch = false
let activeBatchConversion: any = null

// Batch settings
const batchPreset = ref<ResolutionPreset>('original')
const batchQuality = ref<'high' | 'balanced' | 'compact'>('balanced')
const batchKeepAudio = ref(true)

// Source state
const videoFile = ref<File | null>(null)
const videoUrl = ref<string>('')
const videoElementRef = ref<HTMLVideoElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const timelineContainerRef = ref<HTMLDivElement | null>(null)
const scrubberBarRef = ref<HTMLElement | null>(null)
const playerContainerRef = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)
let isScrubbing = false

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
const activePreviewMode = ref<'source' | 'output'>('source')

const activeVideoSrc = computed(() => {
  if (activePreviewMode.value === 'output' && outputBlobUrl.value) {
    return outputBlobUrl.value
  }
  return videoUrl.value
})

watch(activePreviewMode, () => {
  if (!videoElementRef.value) return
  isPlaying.value = false
  currentTime.value = 0
  videoElementRef.value.currentTime = 0
})

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

// Size Savings (Single Mode)
const sizeSavingsPercentage = computed(() => {
  if (!originalFileSize.value || !outputSize.value) return 0
  const diff = originalFileSize.value - outputSize.value
  return Math.round((diff / originalFileSize.value) * 100)
})

// Batch Queue Computed Stats
const totalQueueOriginalSize = computed(() => {
  return queue.value.reduce((acc, item) => acc + item.originalSize, 0)
})

const totalQueueCompressedSize = computed(() => {
  return queue.value.reduce((acc, item) => acc + (item.outputSize || item.originalSize), 0)
})

const totalQueueSavingsPercent = computed(() => {
  if (totalQueueOriginalSize.value === 0) return 0
  const saved = totalQueueOriginalSize.value - totalQueueCompressedSize.value
  return Math.max(0, Math.round((saved / totalQueueOriginalSize.value) * 100))
})

const completedQueueCount = computed(() => {
  return queue.value.filter((i) => i.status === 'done').length
})

// Format Helpers
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`
}

function formatPlayerTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

const progressPercent = computed(() => {
  if (totalDuration.value <= 0) return 0
  return Math.min(100, Math.max(0, (currentTime.value / totalDuration.value) * 100))
})

function seekFromMouseEvent(e: MouseEvent) {
  if (!scrubberBarRef.value || totalDuration.value <= 0) return
  const rect = scrubberBarRef.value.getBoundingClientRect()
  const offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
  const ratio = offsetX / rect.width
  seekTo(ratio * totalDuration.value)
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

function startTouchScrubbing(e: TouchEvent) {
  if (!e.touches[0] || !scrubberBarRef.value || totalDuration.value <= 0) return
  const rect = scrubberBarRef.value.getBoundingClientRect()
  const touch = e.touches[0]
  const offsetX = Math.max(0, Math.min(touch.clientX - rect.left, rect.width))
  const ratio = offsetX / rect.width
  seekTo(ratio * totalDuration.value)
}

function toggleFullscreen() {
  if (!playerContainerRef.value) return
  if (!document.fullscreenElement) {
    playerContainerRef.value.requestFullscreen().then(() => {
      isFullscreen.value = true
    }).catch(() => {})
  } else {
    document.exitFullscreen().then(() => {
      isFullscreen.value = false
    }).catch(() => {})
  }
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

onMounted(() => {
  if (typeof document !== 'undefined') {
    document.addEventListener('fullscreenchange', onFullscreenChange)
  }
})

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
  if (activePreviewMode.value === 'source') {
    videoNaturalWidth.value = el.videoWidth
    videoNaturalHeight.value = el.videoHeight
    totalDuration.value = el.duration
    startTime.value = 0
    endTime.value = el.duration
    customWidth.value = el.videoWidth
    customHeight.value = el.videoHeight
  }
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

// File Upload & Batch Queue Handlers
function handleFileUpload(file: File) {
  if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|webm|mov|mkv|avi|m4v)$/i)) {
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
  activePreviewMode.value = 'source'

  videoFile.value = file
  originalFileSize.value = file.size
  videoUrl.value = URL.createObjectURL(file)
  isPlaying.value = false
  currentTime.value = 0
  mode.value = 'single'
}

function generateVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve('')
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    const url = URL.createObjectURL(file)
    video.src = url

    let resolved = false
    const cleanup = () => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url)
      video.remove()
    }

    const capture = () => {
      if (resolved) return
      resolved = true
      try {
        const canvas = document.createElement('canvas')
        const w = video.videoWidth || 320
        const h = video.videoHeight || 180
        const scale = Math.min(1, 160 / Math.max(w, h))
        canvas.width = Math.max(16, Math.round(w * scale))
        canvas.height = Math.max(16, Math.round(h * scale))
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const thumbUrl = canvas.toDataURL('image/webp', 0.7)
          cleanup()
          resolve(thumbUrl)
          return
        }
      } catch (e) {
        console.error('Thumbnail capture error:', e)
      }
      cleanup()
      resolve('')
    }

    video.onloadeddata = () => {
      const targetTime = Math.min(1, (video.duration || 1) * 0.1)
      video.currentTime = targetTime
    }

    video.onseeked = () => {
      capture()
    }

    video.onerror = () => {
      if (!resolved) {
        resolved = true
        cleanup()
        resolve('')
      }
    }

    setTimeout(() => {
      if (!resolved) {
        resolved = true
        cleanup()
        resolve('')
      }
    }, 2500)
  })
}

function handleFiles(fileList: FileList | File[]) {
  const incoming = Array.from(fileList).filter((f) =>
    f.type.startsWith('video/') || f.name.match(/\.(mp4|webm|mov|mkv|avi|m4v)$/i)
  )

  if (incoming.length === 0) {
    toast.error(
      locale.value === 'id' ? 'Format File Salah' : 'Invalid Files',
      locale.value === 'id' ? 'Silakan pilih file video yang valid (MP4, WebM, MOV, MKV).' : 'Please upload valid video files (MP4, WebM, MOV, MKV).'
    )
    return
  }

  // If single file and no existing queue in single mode, load into Single Studio
  if (incoming.length === 1 && queue.value.length === 0 && mode.value === 'single') {
    handleFileUpload(incoming[0])
    return
  }

  // Multiple files or adding to batch queue
  for (const file of incoming) {
    const item: VideoQueueItem = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      file,
      name: file.name,
      originalSize: file.size,
      status: 'waiting',
      progress: 0,
      outputBlob: null,
      outputUrl: '',
      outputSize: 0,
      savedPercent: 0,
      targetWidth: 0,
      targetHeight: 0,
      thumbnailUrl: '',
      estimatedSecondsRemaining: 0
    }
    queue.value.push(item)

    // Generate lightweight thumbnail snapshot asynchronously in background
    generateVideoThumbnail(file).then((thumb) => {
      item.thumbnailUrl = thumb
    })
  }

  mode.value = 'batch'
  toast.success(
    locale.value === 'id' ? 'Ditambahkan ke Antrean' : 'Added to Queue',
    locale.value === 'id'
      ? `${incoming.length} video ditambahkan ke antrean batch.`
      : `${incoming.length} videos added to batch queue.`
  )
}

function onFileInputChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    handleFiles(target.files)
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

// ─── Core Client-Side Video Processing Engine (WebCodecs) ─────────────
let activeConversion: any = null
let abortProcessing = false

function cancelProcessing() {
  abortProcessing = true
  if (activeConversion) {
    try {
      activeConversion.cancel()
    } catch {}
  }
  isProcessing.value = false
  processStatus.value = 'Cancelled'
}

async function processVideo() {
  if (!videoFile.value && !videoUrl.value) return

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
  processStatus.value = locale.value === 'id' ? 'Menyiapkan hardware encoder...' : 'Preparing hardware encoder...'
  abortProcessing = false

  if (videoElementRef.value) {
    videoElementRef.value.pause()
    isPlaying.value = false
  }

  try {
    const {
      BlobSource,
      ALL_FORMATS,
      Input,
      Output,
      Mp4OutputFormat,
      BufferTarget,
      Conversion,
      Quality
    } = await import('mediabunny')

    let sourceBlob: Blob
    if (videoFile.value) {
      sourceBlob = videoFile.value
    } else {
      const res = await fetch(videoUrl.value)
      sourceBlob = await res.blob()
    }

    const input = new Input({
      source: new BlobSource(sourceBlob),
      formats: ALL_FORMATS
    })

    const format = new Mp4OutputFormat({ fastStart: 'in-memory' })
    const target = new BufferTarget()
    const output = new Output({ format, target })

    const qual = qualityPreset.value === 'high'
      ? new Quality('high')
      : qualityPreset.value === 'compact'
        ? new Quality('low')
        : new Quality('medium')

    activeConversion = await Conversion.init({
      input,
      output,
      trim: {
        start,
        end
      },
      video: {
        width: targetW,
        height: targetH,
        fit: 'contain',
        quality: qual,
        keyFrameInterval: 1
      },
      audio: keepAudio.value && !isMuted.value ? {} : { discard: true },
      showWarnings: false
    })

    if (!activeConversion.isValid) {
      throw new Error('Format video tidak didukung oleh hardware encoder.')
    }

    activeConversion.onProgress = (progress: number, processedTime: number) => {
      if (abortProcessing) return
      const percent = Math.min(99, Math.max(0, Math.round(progress * 100)))
      processProgress.value = percent
      processStatus.value = locale.value === 'id'
        ? `Memproses frame hardware: ${percent}% (${processedTime.toFixed(1)}s)`
        : `Encoding frames: ${percent}% (${processedTime.toFixed(1)}s)`
    }

    await activeConversion.execute()

    if (abortProcessing) return

    processProgress.value = 100
    processStatus.value = locale.value === 'id' ? 'Menyelesaikan file MP4...' : 'Finalizing MP4 file...'

    const buffer = target.buffer
    if (!buffer) throw new Error('Output buffer kosong.')

    const finalBlob = new Blob([buffer], { type: 'video/mp4' })

    if (outputBlobUrl.value && outputBlobUrl.value.startsWith('blob:')) {
      URL.revokeObjectURL(outputBlobUrl.value)
    }

    outputBlobUrl.value = URL.createObjectURL(finalBlob)
    outputSize.value = finalBlob.size
    outputWidth.value = targetW
    outputHeight.value = targetH
    outputDuration.value = duration
    outputMimeType.value = 'video/mp4'
    isProcessing.value = false
    activePreviewMode.value = 'output'

    toast.success(
      locale.value === 'id' ? 'Selesai!' : 'Complete!',
      locale.value === 'id'
        ? `Video berhasil diproses ke ${targetW}x${targetH} (${formatFileSize(finalBlob.size)}) secara instan via hardware GPU!`
        : `Video processed to ${targetW}x${targetH} (${formatFileSize(finalBlob.size)}) instantly via hardware GPU!`
    )
  } catch (err: any) {
    if (abortProcessing) return
    console.error('WebCodecs execution error:', err)
    toast.error(
      'Processing Error',
      err?.message || 'Gagal memproses video via hardware encoder.'
    )
    isProcessing.value = false
  } finally {
    activeConversion = null
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

// ─── Batch Queue Engine & Methods ─────────────────────────────────────
function computeBatchDimensions(srcW: number, srcH: number, preset: ResolutionPreset): { width: number; height: number } {
  const aspect = srcW / srcH
  const isLandscape = srcW >= srcH

  if (preset === 'original') {
    return {
      width: Math.round(srcW / 2) * 2,
      height: Math.round(srcH / 2) * 2
    }
  }

  const maxMap: Record<string, number> = {
    '1080p': 1920,
    '720p': 1280,
    '480p': 854,
    '360p': 640
  }
  const targetMax = maxMap[preset] || 1280

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
}

function formatDurationEstimate(seconds: number): string {
  if (!seconds || seconds <= 0) return ''
  if (seconds < 60) {
    return locale.value === 'id' ? `~${seconds} dtk` : `~${seconds}s`
  }
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return locale.value === 'id'
    ? `~${mins}m ${secs}d`
    : `~${mins}m ${secs}s`
}

function openPreviewModal(item: VideoQueueItem) {
  activePreviewItem.value = item
  if (item.outputUrl) {
    previewModalUrl.value = item.outputUrl
  } else {
    previewModalUrl.value = URL.createObjectURL(item.file)
  }
}

function closePreviewModal() {
  if (previewModalUrl.value && activePreviewItem.value && !activePreviewItem.value.outputUrl) {
    URL.revokeObjectURL(previewModalUrl.value)
  }
  previewModalUrl.value = ''
  activePreviewItem.value = null
}

function removeQueueItem(id: string) {
  if (activePreviewItem.value?.id === id) {
    closePreviewModal()
  }
  const index = queue.value.findIndex((i) => i.id === id)
  if (index !== -1) {
    const item = queue.value[index]
    if (item.outputUrl && item.outputUrl.startsWith('blob:')) {
      URL.revokeObjectURL(item.outputUrl)
    }
    queue.value.splice(index, 1)
  }
}

function clearQueue() {
  closePreviewModal()
  batchEtaSeconds.value = 0
  queue.value.forEach((item) => {
    if (item.outputUrl && item.outputUrl.startsWith('blob:')) {
      URL.revokeObjectURL(item.outputUrl)
    }
  })
  queue.value = []
  if (!videoUrl.value) {
    mode.value = 'single'
  }
}

function cancelBatch() {
  abortBatch = true
  if (activeBatchConversion) {
    try {
      activeBatchConversion.cancel()
    } catch {}
  }
  isBatchProcessing.value = false
  currentBatchIndex.value = -1
  batchEtaSeconds.value = 0
  toast.info('Cancelled', 'Batch compression cancelled')
}

async function processBatch() {
  if (queue.value.length === 0) return

  isBatchProcessing.value = true
  abortBatch = false
  batchEtaSeconds.value = 0

  try {
    const {
      BlobSource,
      ALL_FORMATS,
      Input,
      Output,
      Mp4OutputFormat,
      BufferTarget,
      Conversion,
      Quality
    } = await import('mediabunny')

    for (let i = 0; i < queue.value.length; i++) {
      const item = queue.value[i]
      if (item.status === 'done' || abortBatch) continue

      currentBatchIndex.value = i
      item.status = 'processing'
      item.progress = 0
      item.estimatedSecondsRemaining = 0

      try {
        const input = new Input({
          source: new BlobSource(item.file),
          formats: ALL_FORMATS
        })

        const videoTrack = await input.getPrimaryVideoTrack()
        const srcW = videoTrack ? await videoTrack.getDisplayWidth() : 1280
        const srcH = videoTrack ? await videoTrack.getDisplayHeight() : 720
        const dims = computeBatchDimensions(srcW, srcH, batchPreset.value)
        item.targetWidth = dims.width
        item.targetHeight = dims.height

        const format = new Mp4OutputFormat({ fastStart: 'in-memory' })
        const target = new BufferTarget()
        const output = new Output({ format, target })

        const qual = batchQuality.value === 'high'
          ? new Quality('high')
          : batchQuality.value === 'compact'
            ? new Quality('low')
            : new Quality('medium')

        const conversion = await Conversion.init({
          input,
          output,
          video: {
            width: dims.width,
            height: dims.height,
            fit: 'contain',
            quality: qual,
            keyFrameInterval: 1
          },
          audio: batchKeepAudio.value ? {} : { discard: true },
          showWarnings: false
        })

        if (!conversion.isValid) {
          throw new Error('Conversion unsupported')
        }

        const itemStartTime = Date.now()
        conversion.onProgress = (prog: number) => {
          if (abortBatch) return
          item.progress = Math.min(99, Math.round(prog * 100))

          const elapsedSec = (Date.now() - itemStartTime) / 1000
          if (prog > 0.03 && elapsedSec > 0.4) {
            const estimatedTotalSec = elapsedSec / prog
            const currentRemainingSec = Math.max(0, Math.round(estimatedTotalSec - elapsedSec))
            item.estimatedSecondsRemaining = currentRemainingSec

            // Calculate remaining waiting items estimate based on processed speed
            const processedBytesThisItem = item.file.size * prog
            const speedBytesPerSec = processedBytesThisItem / elapsedSec
            const waitingItems = queue.value.slice(i + 1).filter((it) => it.status === 'waiting')
            const waitingBytes = waitingItems.reduce((acc, it) => acc + it.file.size, 0)
            const waitingTimeSec = speedBytesPerSec > 0 ? Math.round(waitingBytes / speedBytesPerSec) : 0

            batchEtaSeconds.value = currentRemainingSec + waitingTimeSec
          }
        }

        activeBatchConversion = conversion
        await conversion.execute()

        if (abortBatch) {
          item.status = 'waiting'
          item.estimatedSecondsRemaining = 0
          break
        }

        const buffer = target.buffer
        if (!buffer) throw new Error('Buffer empty')

        const finalBlob = new Blob([buffer], { type: 'video/mp4' })
        item.outputBlob = finalBlob
        item.outputUrl = URL.createObjectURL(finalBlob)
        item.outputSize = finalBlob.size
        item.savedPercent = item.originalSize > 0
          ? Math.max(0, Math.round(((item.originalSize - finalBlob.size) / item.originalSize) * 100))
          : 0
        item.status = 'done'
        item.progress = 100
        item.estimatedSecondsRemaining = 0
      } catch (itemErr: any) {
        if (abortBatch) break
        console.error(`Error processing ${item.name}:`, itemErr)
        item.status = 'error'
        item.errorMsg = itemErr?.message || 'Compression failed'
        item.estimatedSecondsRemaining = 0
      }
    }

    if (!abortBatch) {
      toast.success(
        locale.value === 'id' ? 'Batch Selesai!' : 'Batch Complete!',
        locale.value === 'id'
          ? 'Semua video dalam antrean berhasil diproses.'
          : 'All videos in queue have been processed.'
      )
    }
  } catch (err: any) {
    toast.error('Batch Error', err?.message || 'Failed during batch processing')
  } finally {
    isBatchProcessing.value = false
    currentBatchIndex.value = -1
    activeBatchConversion = null
    batchEtaSeconds.value = 0
  }
}

function downloadQueueItem(item: VideoQueueItem) {
  if (!item.outputUrl) return
  const a = document.createElement('a')
  a.href = item.outputUrl
  const nameNoExt = item.name.replace(/\.[^.]+$/, '')
  a.download = `${nameNoExt}_compressed.mp4`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function openItemInStudio(item: VideoQueueItem) {
  handleFileUpload(item.file)
  mode.value = 'single'
}

async function downloadBatchZip() {
  const doneItems = queue.value.filter((i) => i.status === 'done' && i.outputBlob)
  if (doneItems.length === 0) return

  isZipping.value = true
  try {
    const zip = new JSZip()
    doneItems.forEach((item) => {
      const nameNoExt = item.name.replace(/\.[^.]+$/, '')
      zip.file(`${nameNoExt}_compressed.mp4`, item.outputBlob!)
    })
    const blob = await zip.generateAsync({ type: 'blob' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `avttr_batch_compressed_${Date.now()}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success(
      locale.value === 'id' ? 'ZIP Diunduh' : 'ZIP Downloaded',
      locale.value === 'id' ? `${doneItems.length} video berhasil diarsipkan dalam ZIP` : `${doneItems.length} videos archived in ZIP`
    )
  } catch (err: any) {
    toast.error('ZIP Error', err?.message || 'Failed to generate ZIP')
  } finally {
    isZipping.value = false
  }
}


function clearVideo() {
  if (videoUrl.value && videoUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(videoUrl.value)
  }
  if (outputBlobUrl.value && outputBlobUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(outputBlobUrl.value)
  }
  videoUrl.value = ''
  videoFile.value = null
  outputBlobUrl.value = ''
  activePreviewMode.value = 'source'
  queue.value = []
  mode.value = 'single'
}

function toggleMute() {
  isMuted.value = !isMuted.value
  if (videoElementRef.value) {
    videoElementRef.value.muted = isMuted.value
  }
}

function stepBackward(seconds = 1) {
  seekTo(Math.max(0, currentTime.value - seconds))
}

function stepForward(seconds = 1) {
  seekTo(Math.min(totalDuration.value, currentTime.value + seconds))
}

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('fullscreenchange', onFullscreenChange)
  }
  if (videoUrl.value && videoUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(videoUrl.value)
  }
  if (outputBlobUrl.value && outputBlobUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(outputBlobUrl.value)
  }
  queue.value.forEach((item) => {
    if (item.outputUrl && item.outputUrl.startsWith('blob:')) {
      URL.revokeObjectURL(item.outputUrl)
    }
  })
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

    <!-- Hidden File Input (Supports Multiple Selection) -->
    <input
      ref="fileInputRef"
      type="file"
      multiple
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

      <!-- Controls when files are loaded -->
      <div v-if="videoUrl || queue.length > 0" class="flex flex-wrap items-center gap-2.5 shrink-0">
        <!-- Mode Switcher Tabs -->
        <div class="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-[#2E2E2E] rounded-xl text-xs">
          <button
            type="button"
            :disabled="!videoUrl"
            class="px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5"
            :class="mode === 'single' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed'"
            @click="mode = 'single'"
          >
            <Film class="w-3.5 h-3.5" />
            <span>Single Studio</span>
          </button>
          <button
            type="button"
            :disabled="queue.length === 0"
            class="px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5"
            :class="mode === 'batch' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed'"
            @click="mode = 'batch'"
          >
            <List class="w-3.5 h-3.5" />
            <span>Batch Queue</span>
            <span v-if="queue.length > 0" class="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-200 dark:bg-white/10 text-zinc-800 dark:text-white font-mono">
              {{ queue.length }}
            </span>
          </button>
        </div>

        <!-- Clear / Reset Button -->
        <Button
          variant="outline"
          size="sm"
          class="text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 border-zinc-200 dark:border-[#2E2E2E]"
          @click="clearVideo"
        >
          <Trash2 class="w-3.5 h-3.5 mr-1" />
          <span>{{ locale === 'id' ? 'Hapus' : 'Clear' }}</span>
        </Button>
      </div>
    </div>

    <!-- Empty State: Standalone Omnibar + Dashed Dropzone (DESIGN.md Section 10 & 11) -->
    <div v-if="!videoUrl && queue.length === 0" class="space-y-4">
      <!-- Standalone Omnibar -->
      <UrlOmnibar
        v-model="videoUrlInput"
        :loading="isFetchingUrl"
        placeholder="https://example.com/video.mp4 or paste direct video URL..."
        submit-text="Load Video"
        @submit="fetchVideoFromUrl"
      />

      <!-- Standalone Dashed Dropzone -->
      <div
        class="relative border-2 border-dashed rounded-[14px] p-8 sm:p-14 border-zinc-300 dark:border-[#2E2E2E] bg-zinc-50/50 dark:bg-[#141416] hover:border-zinc-400 dark:hover:border-[#3E3E3E] text-center cursor-pointer select-none transition-colors"
        :class="{ 'border-zinc-500 dark:border-white/50 bg-zinc-100 dark:bg-white/5': isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="isDragging = false; if ($event.dataTransfer?.files) handleFiles($event.dataTransfer.files)"
        @click="fileInputRef?.click()"
      >
        <div class="w-12 h-12 mx-auto rounded-xl bg-white dark:bg-[#212121] border border-zinc-200 dark:border-[#2E2E2E] flex items-center justify-center text-zinc-900 dark:text-white shadow-xs">
          <Film class="w-6 h-6" />
        </div>
        <h3 class="text-sm font-semibold text-[var(--text-primary)] mt-4">
          {{ locale === 'id' ? 'Tarik video ke sini atau klik untuk memilih' : 'Drop video files here or browse' }}
        </h3>
        <p class="text-xs text-[var(--text-secondary)] mt-1">
          Supports MP4, WebM, MOV, MKV up to 500MB. 100% processed client-side.
        </p>
        <div class="flex flex-wrap items-center justify-center gap-1.5 mt-4">
          <Badge variant="secondary" size="sm">Single & Multi-batch</Badge>
          <Badge variant="outline" size="sm">H.264 / VP9</Badge>
          <Badge variant="outline" size="sm">Hardware Accelerated</Badge>
        </div>
      </div>
    </div>

    <!-- Mode 1: Single Studio (Player + Trimmer + Inspector) -->
    <div v-else-if="mode === 'single' && videoUrl" class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left Column: Unified Media Canvas & Timeline Trimmer (7 cols) -->
      <Card class="lg:col-span-7 space-y-4 p-4 sm:p-5">
        <!-- Top Canvas Info Bar -->
        <div class="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border-card)]">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-xs font-semibold text-[var(--text-primary)] truncate">{{ videoFile?.name || 'video.mp4' }}</span>
            <Badge variant="outline" size="sm" class="font-mono text-[10px] shrink-0">
              {{ videoNaturalWidth }}×{{ videoNaturalHeight }} • {{ formatFileSize(originalFileSize) }}
            </Badge>
          </div>

          <!-- Seamless Source vs Output Switcher -->
          <div v-if="outputBlobUrl" class="flex items-center p-0.5 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-[#2E2E2E] rounded-lg text-xs shrink-0">
            <button
              type="button"
              class="px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer"
              :class="activePreviewMode === 'source' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'"
              @click="activePreviewMode = 'source'"
            >
              Source
            </button>
            <button
              type="button"
              class="px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1"
              :class="activePreviewMode === 'output' ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'"
              @click="activePreviewMode = 'output'"
            >
              <span>Result</span>
              <span v-if="sizeSavingsPercentage > 0" class="text-[10px] font-bold text-emerald-500">(-{{ sizeSavingsPercentage }}%)</span>
            </button>
          </div>
        </div>

        <!-- Video Player Canvas -->
        <div
          ref="playerContainerRef"
          class="relative aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center border border-[var(--border-card)] group select-none"
        >
          <video
            ref="videoElementRef"
            :src="activeVideoSrc"
            playsinline
            preload="metadata"
            class="w-full h-full object-contain cursor-pointer"
            @timeupdate="onTimeUpdate"
            @loadedmetadata="onLoadedMetadata"
            @play="isPlaying = true"
            @pause="isPlaying = false"
            @click="togglePlay"
          />

          <!-- Big Play Overlay when Paused -->
          <button
            v-if="!isPlaying && !isProcessing"
            type="button"
            class="absolute inset-0 m-auto w-14 h-14 rounded-full bg-black/60 backdrop-blur-xs border border-white/20 flex items-center justify-center text-white hover:bg-black/80 transition-all cursor-pointer shadow-lg"
            @click.stop="togglePlay"
          >
            <Play class="w-6 h-6 ml-0.5" />
          </button>

          <!-- Current Mode Badge -->
          <div class="absolute top-3 right-3 pointer-events-none">
            <Badge :variant="activePreviewMode === 'output' ? 'primary' : 'secondary'" size="sm" class="shadow-xs">
              {{ activePreviewMode === 'output' ? 'Result Preview' : 'Source Video' }}
            </Badge>
          </div>
        </div>

        <!-- Player Scrubber & Controls -->
        <div class="p-3 bg-zinc-50/70 dark:bg-zinc-900/40 border border-[var(--border-card)] rounded-xl space-y-2">
          <!-- Time Scrubber Slider -->
          <div class="relative w-full flex items-center">
            <input
              type="range"
              min="0"
              :max="totalDuration || 100"
              step="0.05"
              :value="currentTime"
              class="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-white"
              @input="seekTo(Number(($event.target as HTMLInputElement).value))"
            />
          </div>

          <!-- Bottom Micro-Controls -->
          <div class="flex items-center justify-between gap-2 pt-1">
            <div class="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" class="h-8 w-8 p-0" @click="togglePlay">
                <component :is="isPlaying ? Pause : Play" class="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" class="h-8 w-8 p-0" title="Step backward 1s" @click="stepBackward(1)">
                <RotateCcw class="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" class="h-8 w-8 p-0" title="Step forward 1s" @click="stepForward(1)">
                <ArrowRight class="w-3.5 h-3.5" />
              </Button>
              <span class="text-xs font-mono text-[var(--text-secondary)] ml-1">
                {{ formatPlayerTime(currentTime) }} / {{ formatPlayerTime(totalDuration) }}
              </span>
            </div>

            <div class="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" class="h-8 w-8 p-0" @click="toggleMute">
                <component :is="isMuted ? VolumeX : Volume2" class="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" class="h-8 w-8 p-0" @click="toggleFullscreen">
                <component :is="isFullscreen ? Minimize : Maximize" class="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <!-- Precision Trimmer Section -->
        <div class="pt-2 border-t border-[var(--border-card)] space-y-3">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <Scissors class="w-4 h-4 text-[var(--text-secondary)]" />
              <span class="text-xs font-semibold text-[var(--text-primary)]">Clip Trimmer</span>
              <Badge variant="outline" size="sm" class="font-mono text-[10px]">
                Duration: {{ formatPlayerTime(trimDuration) }}
              </Badge>
            </div>
            <button
              v-if="startTime > 0 || endTime < totalDuration"
              type="button"
              class="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              @click="resetTrim"
            >
              Reset Trim
            </button>
          </div>

          <!-- Interactive Timeline Track -->
          <div
            ref="timelineContainerRef"
            class="relative h-10 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl overflow-hidden border border-[var(--border-card)] cursor-pointer select-none"
            @click="onTimelineClick"
          >
            <!-- Selected Range Highlight -->
            <div
              class="absolute top-0 bottom-0 bg-zinc-900/15 dark:bg-white/20 border-x-2 border-zinc-900 dark:border-white transition-none"
              :style="{
                left: `${totalDuration ? (startTime / totalDuration) * 100 : 0}%`,
                width: `${totalDuration ? ((endTime - startTime) / totalDuration) * 100 : 100}%`
              }"
            />

            <!-- Current Playhead Indicator -->
            <div
              class="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none z-10"
              :style="{ left: `${totalDuration ? (currentTime / totalDuration) * 100 : 0}%` }"
            />
          </div>

          <!-- Numeric Fine-Tuning Steppers -->
          <div class="grid grid-cols-2 gap-3">
            <div class="p-2.5 bg-zinc-50 dark:bg-zinc-900/40 border border-[var(--border-card)] rounded-xl space-y-1">
              <label class="text-[10px] uppercase font-mono tracking-wider text-[var(--text-tertiary)]">Start Time</label>
              <div class="flex items-center gap-2">
                <input
                  v-model.number="startTime"
                  type="number"
                  step="0.1"
                  min="0"
                  :max="endTime - 0.5"
                  class="w-full bg-transparent text-xs font-mono font-medium text-[var(--text-primary)] focus:outline-none"
                  @change="seekTo(startTime)"
                />
                <span class="text-[10px] font-mono text-[var(--text-tertiary)]">sec</span>
              </div>
            </div>

            <div class="p-2.5 bg-zinc-50 dark:bg-zinc-900/40 border border-[var(--border-card)] rounded-xl space-y-1">
              <label class="text-[10px] uppercase font-mono tracking-wider text-[var(--text-tertiary)]">End Time</label>
              <div class="flex items-center gap-2">
                <input
                  v-model.number="endTime"
                  type="number"
                  step="0.1"
                  :min="startTime + 0.5"
                  :max="totalDuration"
                  class="w-full bg-transparent text-xs font-mono font-medium text-[var(--text-primary)] focus:outline-none"
                  @change="seekTo(endTime)"
                />
                <span class="text-[10px] font-mono text-[var(--text-tertiary)]">sec</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <!-- Right Column: Studio Inspector (5 cols) -->
      <Card class="lg:col-span-5 space-y-5 p-4 sm:p-5">
        <!-- Inspector Header -->
        <div class="pb-2 border-b border-[var(--border-card)]">
          <h2 class="text-sm font-semibold text-[var(--text-primary)]">Export Settings</h2>
          <p class="text-xs text-[var(--text-secondary)] mt-0.5">Configure target resolution and compression profile</p>
        </div>

        <!-- Resolution Presets -->
        <div class="space-y-2">
          <label class="text-xs font-medium text-[var(--text-secondary)]">Target Resolution</label>
          <div class="grid grid-cols-2 gap-1.5">
            <button
              v-for="preset in (['original', '1080p', '720p', '480p', 'custom'] as const)"
              :key="preset"
              type="button"
              class="px-3 py-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer"
              :class="selectedPreset === preset
                ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-950 shadow-xs'
                : 'border-zinc-200 dark:border-[#2E2E2E] bg-white dark:bg-zinc-900/50 text-[var(--text-primary)] hover:border-zinc-400 dark:hover:border-zinc-700'"
              @click="selectedPreset = preset"
            >
              <div class="capitalize font-semibold">{{ preset }}</div>
              <div class="text-[10px] opacity-70">
                {{ preset === 'original' ? `${videoNaturalWidth}×${videoNaturalHeight}` : preset === '1080p' ? '1920×1080' : preset === '720p' ? '1280×720' : preset === '480p' ? '854×480' : 'Manual W×H' }}
              </div>
            </button>
          </div>

          <!-- Custom Dimension Inputs -->
          <div v-if="selectedPreset === 'custom'" class="pt-2 space-y-2">
            <div class="flex items-center gap-2">
              <div class="flex-1 space-y-1">
                <span class="text-[10px] uppercase font-mono text-[var(--text-tertiary)]">Width</span>
                <input
                  v-model.number="customWidth"
                  type="number"
                  step="2"
                  class="w-full px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-900 border border-[var(--border-card)] rounded-lg text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                class="mt-4 h-8 w-8 p-0"
                :title="lockAspectRatio ? 'Lock Aspect Ratio' : 'Unlock Aspect Ratio'"
                @click="lockAspectRatio = !lockAspectRatio"
              >
                <component :is="lockAspectRatio ? Lock : Unlock" class="w-4 h-4" />
              </Button>
              <div class="flex-1 space-y-1">
                <span class="text-[10px] uppercase font-mono text-[var(--text-tertiary)]">Height</span>
                <input
                  v-model.number="customHeight"
                  type="number"
                  step="2"
                  class="w-full px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-900 border border-[var(--border-card)] rounded-lg text-xs font-mono text-[var(--text-primary)] focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Quality Profile -->
        <div class="space-y-2">
          <label class="text-xs font-medium text-[var(--text-secondary)]">Quality Profile</label>
          <div class="grid grid-cols-3 gap-1.5 text-xs">
            <button
              v-for="qp in [
                { id: 'balanced', label: 'Balanced' },
                { id: 'high', label: 'High' },
                { id: 'compact', label: 'Compact' }
              ]"
              :key="qp.id"
              type="button"
              class="p-2.5 rounded-xl border text-center transition-all cursor-pointer"
              :class="qualityPreset === qp.id
                ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-950 shadow-xs'
                : 'border-zinc-200 dark:border-[#2E2E2E] bg-white dark:bg-zinc-900/50 text-[var(--text-primary)] hover:border-zinc-400 dark:hover:border-zinc-700'"
              @click="qualityPreset = qp.id as any"
            >
              <div class="font-semibold">{{ qp.label }}</div>
            </button>
          </div>
        </div>

        <!-- Audio Options -->
        <div class="space-y-3 pt-1">
          <label class="flex items-center justify-between p-2.5 bg-zinc-50/70 dark:bg-zinc-900/40 border border-[var(--border-card)] rounded-xl cursor-pointer">
            <div class="flex items-center gap-2">
              <component :is="keepAudio ? Volume2 : VolumeX" class="w-4 h-4 text-[var(--text-secondary)]" />
              <div>
                <div class="text-xs font-medium text-[var(--text-primary)]">Include Audio Track</div>
                <div class="text-[10px] text-[var(--text-tertiary)]">Disable to mute and reduce file size</div>
              </div>
            </div>
            <input
              v-model="keepAudio"
              type="checkbox"
              class="w-4 h-4 rounded-sm border-zinc-300 dark:border-zinc-700 accent-zinc-900 dark:accent-white cursor-pointer"
            />
          </label>
        </div>

        <!-- Processing State -->
        <div v-if="isProcessing" class="p-3.5 bg-zinc-50 dark:bg-zinc-900/60 border border-[var(--border-card)] rounded-xl space-y-2.5">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-[var(--text-primary)]">{{ processStatus || 'Processing video...' }}</span>
            <span class="font-mono font-bold text-[var(--text-primary)]">{{ processProgress }}%</span>
          </div>
          <div class="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div class="h-full bg-zinc-900 dark:bg-white transition-all duration-150" :style="{ width: `${processProgress}%` }" />
          </div>
          <div class="flex justify-end pt-1">
            <Button variant="outline" size="sm" class="text-xs text-rose-500 hover:text-rose-600" @click="cancelProcessing">
              Cancel
            </Button>
          </div>
        </div>

        <!-- Result Summary & Download (When Output is Ready) -->
        <div v-else-if="outputBlobUrl" class="p-3.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Check class="w-4 h-4" />
              <span>Conversion Ready</span>
            </div>
            <Badge v-if="sizeSavingsPercentage > 0" variant="primary" size="sm" class="bg-emerald-500 text-white font-mono">
              -{{ sizeSavingsPercentage }}% Saved
            </Badge>
          </div>

          <div class="grid grid-cols-3 gap-2 text-center text-xs">
            <div class="p-2 bg-white dark:bg-zinc-900/80 rounded-lg border border-[var(--border-card)]">
              <div class="text-[10px] text-[var(--text-tertiary)]">Duration</div>
              <div class="font-mono font-bold text-[var(--text-primary)] mt-0.5">{{ formatPlayerTime(outputDuration) }}</div>
            </div>
            <div class="p-2 bg-white dark:bg-zinc-900/80 rounded-lg border border-[var(--border-card)]">
              <div class="text-[10px] text-[var(--text-tertiary)]">Original</div>
              <div class="font-mono text-[var(--text-tertiary)] line-through mt-0.5">{{ formatFileSize(originalFileSize) }}</div>
            </div>
            <div class="p-2 bg-white dark:bg-zinc-900/80 rounded-lg border border-[var(--border-card)]">
              <div class="text-[10px] text-[var(--text-tertiary)]">New Size</div>
              <div class="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{{ formatFileSize(outputSize) }}</div>
            </div>
          </div>

          <div class="flex items-center gap-2 pt-1">
            <Button variant="primary" size="default" class="flex-1 font-medium text-xs" @click="downloadOutput">
              <Download class="w-4 h-4 mr-1.5" />
              <span>Download Video</span>
            </Button>
            <Button variant="outline" size="default" class="text-xs" @click="processVideo">
              <RefreshCw class="w-3.5 h-3.5 mr-1" />
              <span>Re-encode</span>
            </Button>
          </div>
        </div>

        <!-- Main CTA Button when no output yet -->
        <div v-else>
          <Button
            variant="primary"
            size="default"
            class="w-full h-11 text-sm font-semibold rounded-xl cursor-pointer"
            :disabled="isProcessing"
            @click="processVideo"
          >
            <Sliders class="w-4 h-4 mr-2" />
            <span>Process & Resize Video</span>
          </Button>
        </div>
      </Card>
    </div>

    <!-- Mode 2: Batch Queue Processing -->
    <div v-else-if="mode === 'batch'" class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left: Batch Presets (5 cols) -->
      <Card class="lg:col-span-5 space-y-4 p-4 sm:p-5">
        <div class="pb-2 border-b border-[var(--border-card)]">
          <h2 class="text-sm font-semibold text-[var(--text-primary)]">Batch Settings</h2>
          <p class="text-xs text-[var(--text-secondary)] mt-0.5">Settings applied to all queued videos</p>
        </div>

        <div class="space-y-2">
          <label class="text-xs font-medium text-[var(--text-secondary)]">Resolution Preset</label>
          <div class="grid grid-cols-2 gap-1.5">
            <button
              v-for="preset in (['original', '1080p', '720p', '480p'] as const)"
              :key="preset"
              type="button"
              class="px-3 py-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer"
              :class="batchPreset === preset
                ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-950 shadow-xs'
                : 'border-zinc-200 dark:border-[#2E2E2E] bg-white dark:bg-zinc-900/50 text-[var(--text-primary)]'"
              @click="batchPreset = preset"
            >
              {{ preset.toUpperCase() }}
            </button>
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-xs font-medium text-[var(--text-secondary)]">Quality Profile</label>
          <div class="grid grid-cols-3 gap-1.5 text-xs">
            <button
              v-for="qp in [
                { id: 'balanced', label: 'Balanced' },
                { id: 'high', label: 'High' },
                { id: 'compact', label: 'Compact' }
              ]"
              :key="qp.id"
              type="button"
              class="p-2 rounded-xl border text-center transition-all cursor-pointer"
              :class="batchQuality === qp.id
                ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-950 shadow-xs'
                : 'border-zinc-200 dark:border-[#2E2E2E] bg-white dark:bg-zinc-900/50 text-[var(--text-primary)]'"
              @click="batchQuality = qp.id as any"
            >
              {{ qp.label }}
            </button>
          </div>
        </div>

        <div class="pt-2">
          <Button
            variant="primary"
            size="default"
            class="w-full h-11 text-sm font-semibold rounded-xl cursor-pointer"
            :loading="isBatchProcessing"
            :disabled="queue.length === 0 || isBatchProcessing"
            @click="processBatch"
          >
            <Play class="w-4 h-4 mr-2" />
            <span>Process {{ queue.length }} Videos</span>
          </Button>
        </div>
      </Card>

      <!-- Right: Queue List (7 cols) -->
      <Card class="lg:col-span-7 space-y-4 p-4 sm:p-5">
        <div class="flex items-center justify-between pb-2 border-b border-[var(--border-card)]">
          <div class="flex items-center gap-2">
            <h2 class="text-sm font-semibold text-[var(--text-primary)]">Queue List</h2>
            <Badge variant="secondary" size="sm" class="font-mono text-[10px]">{{ queue.length }} files</Badge>
          </div>

          <div class="flex items-center gap-2">
            <Button
              v-if="queue.some(i => i.status === 'done')"
              variant="outline"
              size="sm"
              class="text-xs text-emerald-600 dark:text-emerald-400"
              :loading="isZipping"
              @click="downloadBatchZip"
            >
              <Archive class="w-3.5 h-3.5 mr-1" />
              <span>Download ZIP</span>
            </Button>
            <Button variant="ghost" size="sm" class="text-xs" @click="fileInputRef?.click()">
              <Plus class="w-3.5 h-3.5 mr-1" />
              <span>Add</span>
            </Button>
          </div>
        </div>

        <!-- Queue Items -->
        <div class="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          <div
            v-for="item in queue"
            :key="item.id"
            class="p-3 bg-zinc-50/70 dark:bg-zinc-900/40 border border-[var(--border-card)] rounded-xl space-y-2"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0 flex-1">
                <div class="text-xs font-medium text-[var(--text-primary)] truncate">{{ item.name }}</div>
                <div class="text-[10px] font-mono text-[var(--text-tertiary)] flex items-center gap-2 mt-0.5">
                  <span>{{ formatFileSize(item.originalSize) }}</span>
                  <span v-if="item.outputSize" class="text-emerald-600 dark:text-emerald-400 font-bold">
                    → {{ formatFileSize(item.outputSize) }} (-{{ item.savedPercent }}%)
                  </span>
                </div>
              </div>

              <!-- Status Badge & Per-item CTA -->
              <div class="flex items-center gap-2 shrink-0">
                <Badge
                  :variant="item.status === 'done' ? 'primary' : item.status === 'processing' ? 'secondary' : item.status === 'error' ? 'outline' : 'outline'"
                  size="sm"
                  class="capitalize text-[10px]"
                >
                  {{ item.status }}
                </Badge>

                <Button
                  v-if="item.status === 'done'"
                  variant="ghost"
                  size="sm"
                  class="h-7 w-7 p-0 text-emerald-600"
                  @click="downloadQueueItem(item)"
                >
                  <Download class="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 w-7 p-0 text-zinc-400 hover:text-rose-500"
                  @click="removeQueueItem(item.id)"
                >
                  <X class="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <!-- Item Progress Bar when Processing -->
            <div v-if="item.status === 'processing'" class="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div class="h-full bg-zinc-900 dark:bg-white transition-all duration-150" :style="{ width: `${item.progress}%` }" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>
