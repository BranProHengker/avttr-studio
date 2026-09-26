<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import JSZip from 'jszip'
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
  HardDrive,
  Maximize,
  Minimize,
  Archive,
  Trash2,
  Plus,
  AlertCircle,
  List
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import { useI18n } from '~/composables/useI18n'
import Button from '~/components/ui/Button.vue'

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

    const format = new Mp4OutputFormat()
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
        quality: qual
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

        const format = new Mp4OutputFormat()
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
            quality: qual
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
        <div class="flex items-center p-1 bg-zinc-100 dark:bg-[#141416] border border-zinc-200 dark:border-[#2E2E2E] rounded-xl text-xs">
          <button
            type="button"
            :disabled="!videoUrl"
            class="px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5"
            :class="mode === 'single' ? 'bg-white dark:bg-[#2E2E2E] text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-950 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed'"
            @click="mode = 'single'"
          >
            <Film class="w-3.5 h-3.5" />
            <span>Single Studio</span>
          </button>
          <button
            type="button"
            :disabled="queue.length === 0"
            class="px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5"
            :class="mode === 'batch' ? 'bg-white dark:bg-[#2E2E2E] text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-950 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed'"
            @click="mode = 'batch'"
          >
            <List class="w-3.5 h-3.5" />
            <span>Batch Queue</span>
            <span v-if="queue.length > 0" class="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-200 dark:bg-white/10 text-zinc-800 dark:text-white font-mono">
              {{ queue.length }}
            </span>
          </button>
        </div>

        <Button
          variant="secondary"
          size="default"
          class="h-9 px-3.5 rounded-lg text-xs font-medium cursor-pointer"
          @click="fileInputRef?.click()"
        >
          <Plus class="w-3.5 h-3.5 mr-1.5 text-white/70" />
          <span>{{ mode === 'batch' ? (locale === 'id' ? 'Tambah Video' : 'Add Videos') : (locale === 'id' ? 'Ganti Video' : 'Change Video') }}</span>
        </Button>
      </div>
    </div>

    <!-- STATE 1: Upload Stage (When No Video Loaded & Queue Empty) -->
    <div v-if="!videoUrl && queue.length === 0" class="space-y-4">
      <!-- URL Input Omnibox -->
      <div class="flex flex-col sm:flex-row items-center gap-2.5">
        <div class="relative w-full flex-1 flex items-center">
          <LinkIcon class="w-4 h-4 text-[var(--text-tertiary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            v-model="videoUrlInput"
            type="url"
            :placeholder="locale === 'id' ? 'Tempel link video langsung (CORS enabled)...' : 'Paste direct video URL (CORS enabled)...'"
            class="w-full h-11 pl-10 bg-white dark:bg-[#171717] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] border border-zinc-200 dark:border-[#2E2E2E] focus:border-zinc-400 dark:focus:border-white/40 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-xl text-xs font-mono transition-all focus:outline-none focus:ring-2 focus:ring-zinc-400/20 dark:focus:ring-white/10"
            :class="videoUrlInput ? 'pr-20' : 'pr-10'"
            @keydown.enter="fetchVideoFromUrl"
          />
          <div class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              v-if="videoUrlInput"
              type="button"
              class="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-95"
              title="Clear input"
              aria-label="Clear input"
              @click="videoUrlInput = ''"
            >
              <X class="w-4 h-4" />
            </button>
            <button
              type="button"
              class="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-95"
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
        class="relative border-2 border-dashed rounded-[14px] p-8 sm:p-14 text-center transition-all cursor-pointer select-none border-zinc-300 dark:border-[#2E2E2E] bg-zinc-50/50 dark:bg-[#141416] hover:border-zinc-400 dark:hover:border-[#3E3E3E]"
        :class="isDragging ? 'border-zinc-900 bg-zinc-100 dark:border-white dark:bg-[var(--bg-card-hover)]' : ''"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="(e) => { isDragging = false; if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files) }"
        @click="fileInputRef?.click()"
      >
        <div class="max-w-md mx-auto space-y-3">
          <div class="w-12 h-12 mx-auto rounded-xl bg-white dark:bg-[#212121] border border-zinc-200 dark:border-[#2E2E2E] flex items-center justify-center text-zinc-900 dark:text-white shadow-xs">
            <Film class="w-6 h-6 text-zinc-900 dark:text-white" />
          </div>
          <div>
            <h3 class="text-sm font-semibold text-[var(--text-primary)]">
              {{ t.dropzoneBrowse }}
            </h3>
            <p class="text-xs text-[var(--text-secondary)] mt-1">
              {{ locale === 'id' ? 'Mendukung MP4, WebM, MOV, MKV. Bisa single atau antrean batch sekaligus. 100% diproses di browser.' : 'Supports MP4, WebM, MOV, and MKV. Single or batch sequential compression. 100% processed client-side.' }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- STATE 2: Batch Queue Workbench -->
    <div v-else-if="mode === 'batch' && queue.length > 0" class="space-y-6">
      <!-- Batch Summary Bar -->
      <div class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[14px] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-[#212121] border border-zinc-200 dark:border-[#2E2E2E] flex items-center justify-center text-zinc-900 dark:text-white shrink-0">
            <List class="w-5 h-5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-semibold text-[var(--text-primary)]">
                {{ locale === 'id' ? 'Antrean Kompresi Batch' : 'Batch Compression Queue' }}
              </h2>
              <span class="px-2 py-0.5 rounded-full text-[11px] font-mono bg-zinc-100 dark:bg-white/10 text-zinc-800 dark:text-white border border-zinc-200 dark:border-transparent">
                {{ queue.length }} {{ queue.length > 1 ? 'Videos' : 'Video' }}
              </span>
            </div>
            <p class="text-xs text-neutral-400 font-mono mt-0.5">
              {{ completedQueueCount }} / {{ queue.length }} {{ locale === 'id' ? 'selesai diproses' : 'completed' }}
              <span v-if="totalQueueOriginalSize > 0" class="text-neutral-500">
                · {{ formatFileSize(totalQueueOriginalSize) }}
                <template v-if="completedQueueCount > 0">
                  → {{ formatFileSize(totalQueueCompressedSize) }}
                  <span v-if="totalQueueSavingsPercent > 0" class="text-emerald-400 font-bold ml-1">
                    (-{{ totalQueueSavingsPercent }}%)
                  </span>
                </template>
              </span>
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- Live ETA Badge if processing -->
          <span
            v-if="isBatchProcessing && batchEtaSeconds > 0"
            class="px-2.5 py-1 rounded-xl text-[11px] font-mono bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center gap-1.5 shrink-0"
          >
            <Clock class="w-3.5 h-3.5 text-blue-400" />
            <span>ETA {{ formatDurationEstimate(batchEtaSeconds) }}</span>
          </span>

          <!-- Download All as ZIP -->
          <Button
            v-if="completedQueueCount > 0"
            variant="primary"
            size="default"
            class="h-9 px-4 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
            :loading="isZipping"
            @click="downloadBatchZip"
          >
            <Archive class="w-3.5 h-3.5 mr-1.5" />
            <span>{{ isZipping ? (locale === 'id' ? 'Membuat ZIP...' : 'Zipping...') : (locale === 'id' ? `Unduh Semua ZIP (${completedQueueCount})` : `Download All ZIP (${completedQueueCount})`) }}</span>
          </Button>

          <!-- Cancel processing if active -->
          <Button
            v-if="isBatchProcessing"
            variant="secondary"
            size="default"
            class="h-9 px-3 rounded-xl text-xs font-medium cursor-pointer shrink-0 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20"
            @click="cancelBatch"
          >
            <X class="w-3.5 h-3.5 mr-1" />
            <span>{{ locale === 'id' ? 'Batalkan' : 'Cancel' }}</span>
          </Button>

          <!-- Clear Queue -->
          <Button
            v-else
            variant="secondary"
            size="default"
            class="h-9 px-3 rounded-xl text-xs font-medium cursor-pointer shrink-0 text-neutral-400 hover:text-red-400"
            @click="clearQueue"
          >
            <Trash2 class="w-3.5 h-3.5 mr-1.5" />
            <span>{{ locale === 'id' ? 'Kosongkan' : 'Clear' }}</span>
          </Button>
        </div>
      </div>

      <!-- Batch Main Grid: 12 columns -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Left: Batch Settings & Execution Panel (5 Cols) -->
        <div class="lg:col-span-5 space-y-4">
          <div class="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#2E2E2E] rounded-[14px] p-5 space-y-5">
            <div class="flex items-center justify-between border-b border-zinc-200 dark:border-[#212121] pb-3">
              <div class="flex items-center gap-2">
                <Sliders class="w-4 h-4 text-[var(--text-primary)]" />
                <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  {{ locale === 'id' ? 'Pengaturan Global Batch' : 'Batch Global Settings' }}
                </h3>
              </div>
              <span class="text-[11px] font-mono text-[var(--text-tertiary)]">
                WebCodecs GPU
              </span>
            </div>

            <!-- Resolution Preset -->
            <div class="space-y-2">
              <label class="text-xs font-medium text-[var(--text-secondary)]">
                {{ locale === 'id' ? 'Target Resolusi' : 'Target Resolution' }}
              </label>
              <div class="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                <button
                  v-for="preset in (['original', '1080p', '720p', '480p', '360p'] as ResolutionPreset[])"
                  :key="preset"
                  type="button"
                  class="py-2 px-1 rounded-lg text-xs font-mono font-medium border text-center transition-all cursor-pointer"
                  :class="batchPreset === preset
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white shadow-xs font-bold'
                    : 'bg-zinc-100 dark:bg-[#18181A] border-zinc-200 dark:border-[#2E2E2E] text-[var(--text-secondary)] hover:border-zinc-400 dark:hover:border-neutral-500'"
                  :disabled="isBatchProcessing"
                  @click="batchPreset = preset"
                >
                  {{ preset === 'original' ? 'Original' : preset }}
                </button>
              </div>
              <p class="text-[11px] text-[var(--text-tertiary)]">
                {{ locale === 'id' ? 'Setiap video mempertahankan rasio asli (landscape/portrait/square).' : 'Automatically adapts to each video native aspect ratio.' }}
              </p>
            </div>

            <!-- Quality Profile -->
            <div class="space-y-2">
              <label class="text-xs font-medium text-[var(--text-secondary)]">
                {{ locale === 'id' ? 'Tingkat Kompresi' : 'Compression Profile' }}
              </label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  class="p-2.5 rounded-lg border text-left transition-all cursor-pointer"
                  :class="batchQuality === 'balanced'
                    ? 'bg-zinc-100 dark:bg-[#1E1E22] border-zinc-900 dark:border-white/40 text-[var(--text-primary)] ring-1 ring-zinc-900/20 dark:ring-white/20'
                    : 'bg-zinc-50 dark:bg-[#18181A] border-zinc-200 dark:border-[#2E2E2E] text-[var(--text-secondary)] hover:border-zinc-400 dark:hover:border-neutral-500'"
                  :disabled="isBatchProcessing"
                  @click="batchQuality = 'balanced'"
                >
                  <div class="text-xs font-semibold text-[var(--text-primary)]">Balanced</div>
                  <div class="text-[10px] text-[var(--text-tertiary)] mt-0.5">{{ locale === 'id' ? 'Optimal ukuran & mutu' : 'Best size & quality' }}</div>
                </button>
                <button
                  type="button"
                  class="p-2.5 rounded-lg border text-left transition-all cursor-pointer"
                  :class="batchQuality === 'compact'
                    ? 'bg-zinc-100 dark:bg-[#1E1E22] border-zinc-900 dark:border-white/40 text-[var(--text-primary)] ring-1 ring-zinc-900/20 dark:ring-white/20'
                    : 'bg-zinc-50 dark:bg-[#18181A] border-zinc-200 dark:border-[#2E2E2E] text-[var(--text-secondary)] hover:border-zinc-400 dark:hover:border-neutral-500'"
                  :disabled="isBatchProcessing"
                  @click="batchQuality = 'compact'"
                >
                  <div class="text-xs font-semibold text-[var(--text-primary)]">Compact</div>
                  <div class="text-[10px] text-[var(--text-tertiary)] mt-0.5">{{ locale === 'id' ? 'Ukuran paling hemat' : 'Smallest file size' }}</div>
                </button>
                <button
                  type="button"
                  class="p-2.5 rounded-lg border text-left transition-all cursor-pointer"
                  :class="batchQuality === 'high'
                    ? 'bg-zinc-100 dark:bg-[#1E1E22] border-zinc-900 dark:border-white/40 text-[var(--text-primary)] ring-1 ring-zinc-900/20 dark:ring-white/20'
                    : 'bg-zinc-50 dark:bg-[#18181A] border-zinc-200 dark:border-[#2E2E2E] text-[var(--text-secondary)] hover:border-zinc-400 dark:hover:border-neutral-500'"
                  :disabled="isBatchProcessing"
                  @click="batchQuality = 'high'"
                >
                  <div class="text-xs font-semibold text-[var(--text-primary)]">High</div>
                  <div class="text-[10px] text-[var(--text-tertiary)] mt-0.5">{{ locale === 'id' ? 'Kualitas visual tajam' : 'Crisp visual fidelity' }}</div>
                </button>
              </div>
            </div>

            <!-- Audio Option -->
            <div class="flex items-center justify-between p-3 bg-zinc-50 dark:bg-[#18181A] border border-zinc-200 dark:border-[#2E2E2E] rounded-xl">
              <div>
                <div class="text-xs font-medium text-[var(--text-primary)]">
                  {{ locale === 'id' ? 'Pertahankan Suara / Audio' : 'Keep Audio Track' }}
                </div>
                <div class="text-[11px] text-[var(--text-tertiary)]">
                  {{ locale === 'id' ? 'Hilangkan centang untuk video bisu (hemat kuota)' : 'Uncheck to mute videos and save more size' }}
                </div>
              </div>
              <input
                v-model="batchKeepAudio"
                type="checkbox"
                class="w-4 h-4 rounded border-zinc-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-zinc-900 dark:text-white focus:ring-0 cursor-pointer"
                :disabled="isBatchProcessing"
              />
            </div>

            <!-- Sequential Execution Notice -->
            <div class="p-3 bg-zinc-50 dark:bg-[#18181A] border border-zinc-200 dark:border-[#262626] rounded-xl space-y-1">
              <div class="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)]">
                <Sparkles class="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                <span>{{ locale === 'id' ? 'Pemrosesan Bergantian (Sequential)' : 'Sequential Processing' }}</span>
              </div>
              <p class="text-[11px] text-[var(--text-tertiary)] leading-relaxed">
                {{ locale === 'id'
                  ? 'Video dikompres satu per satu secara otomatis via hardware GPU browser agar hemat RAM & mencegah browser crash.'
                  : 'Videos are encoded one-by-one via browser hardware GPU to prevent memory overload and browser crash.' }}
              </p>
            </div>

            <!-- CTA Execution Button -->
            <div class="pt-2">
              <Button
                v-if="!isBatchProcessing"
                variant="primary"
                size="default"
                class="w-full h-11 rounded-xl text-xs font-semibold cursor-pointer"
                @click="processBatch"
              >
                <Play class="w-4 h-4 mr-2" />
                <span>{{ locale === 'id' ? 'Mulai Kompresi Bergantian' : 'Start Sequential Compression' }}</span>
              </Button>

              <Button
                v-else
                variant="secondary"
                size="default"
                class="w-full h-11 rounded-xl text-xs font-semibold cursor-pointer text-neutral-400 hover:text-red-400 border border-zinc-200 dark:border-[#2E2E2E]"
                @click="cancelBatch"
              >
                <X class="w-4 h-4 mr-1.5" />
                <span>{{ locale === 'id' ? 'Batalkan Antrean' : 'Cancel Queue' }}</span>
              </Button>
            </div>
          </div>
        </div>

        <!-- Right: Video Queue Items List (7 Cols) -->
        <div class="lg:col-span-7 space-y-3">
          <div class="flex items-center justify-between text-xs text-neutral-400 px-1">
            <span class="font-medium text-neutral-300">
              {{ locale === 'id' ? 'Daftar Video Antrean' : 'Queue Items' }} ({{ queue.length }})
            </span>
            <span>
              {{ completedQueueCount }}/{{ queue.length }} {{ locale === 'id' ? 'Selesai' : 'Completed' }}
            </span>
          </div>

          <!-- Queue List Cards -->
          <div class="space-y-2.5">
            <div
              v-for="item in queue"
              :key="item.id"
              class="p-3.5 bg-white dark:bg-[#141416] border rounded-xl transition-all"
              :class="item.status === 'processing'
                ? 'border-blue-500/50 bg-blue-50/50 dark:bg-[#161a22]'
                : item.status === 'done'
                  ? 'border-emerald-500/30'
                  : 'border-zinc-200 dark:border-[#2E2E2E]'"
            >
              <div class="flex items-start justify-between gap-3">
                <!-- File info & Interactive Thumbnail Snapshot -->
                <div class="flex items-start gap-3 min-w-0 flex-1">
                  <!-- Thumbnail snapshot container -->
                  <div
                    class="relative w-16 h-12 rounded-lg bg-zinc-100 dark:bg-[#212121] border border-zinc-200 dark:border-[#2E2E2E] overflow-hidden flex items-center justify-center shrink-0 cursor-pointer group/thumb select-none"
                    @click="openPreviewModal(item)"
                    :title="locale === 'id' ? 'Klik untuk preview video' : 'Click to preview video'"
                  >
                    <img
                      v-if="item.thumbnailUrl"
                      :src="item.thumbnailUrl"
                      class="w-full h-full object-cover transition-transform group-hover/thumb:scale-105"
                      alt="Thumbnail"
                    />
                    <Film v-else class="w-5 h-5 text-[var(--text-tertiary)]" />

                    <!-- Play overlay on hover -->
                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                      <Play class="w-4 h-4 fill-white text-white" />
                    </div>
                  </div>

                  <div class="min-w-0 flex-1">
                    <div
                      class="text-xs font-semibold text-[var(--text-primary)] truncate cursor-pointer hover:underline"
                      :title="item.name"
                      @click="openPreviewModal(item)"
                    >
                      {{ item.name }}
                    </div>
                    <div class="flex flex-wrap items-center gap-2 mt-1 text-[11px] font-mono text-[var(--text-tertiary)]">
                      <span>{{ formatFileSize(item.originalSize) }}</span>
                      <template v-if="item.status === 'done'">
                        <span>→</span>
                        <span class="text-emerald-500 font-bold">{{ formatFileSize(item.outputSize) }}</span>
                        <span v-if="item.savedPercent > 0" class="text-emerald-500">(-{{ item.savedPercent }}%)</span>
                        <span v-if="item.targetWidth" class="text-neutral-500">({{ item.targetWidth }}×{{ item.targetHeight }})</span>
                      </template>
                    </div>
                  </div>
                </div>

                <!-- Status & Action Buttons -->
                <div class="flex items-center gap-2 shrink-0">
                  <!-- Status Badges -->
                  <span
                    v-if="item.status === 'waiting'"
                    class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-100 dark:bg-neutral-800 text-[var(--text-secondary)]"
                  >
                    {{ locale === 'id' ? 'Menunggu' : 'Waiting' }}
                  </span>
                  <span
                    v-else-if="item.status === 'processing'"
                    class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/10 text-blue-500 flex items-center gap-1"
                  >
                    <RefreshCw class="w-3 h-3 animate-spin" />
                    <span>{{ item.progress }}%</span>
                    <span v-if="item.estimatedSecondsRemaining" class="text-neutral-400 ml-0.5 font-normal">({{ formatDurationEstimate(item.estimatedSecondsRemaining) }})</span>
                  </span>
                  <span
                    v-else-if="item.status === 'done'"
                    class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-500 flex items-center gap-1"
                  >
                    <Check class="w-3 h-3" />
                    {{ locale === 'id' ? 'Selesai' : 'Done' }}
                  </span>
                  <span
                    v-else-if="item.status === 'error'"
                    class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-red-500/10 text-red-500 flex items-center gap-1"
                    :title="item.errorMsg"
                  >
                    <AlertCircle class="w-3 h-3" />
                    Error
                  </span>

                  <!-- Download Single Item -->
                  <button
                    v-if="item.status === 'done'"
                    type="button"
                    class="p-1.5 rounded-lg bg-zinc-100 dark:bg-white/10 hover:bg-zinc-900 dark:hover:bg-white text-zinc-900 dark:text-white hover:text-white dark:hover:text-black transition-colors cursor-pointer"
                    :title="locale === 'id' ? 'Unduh video ini' : 'Download this video'"
                    @click="downloadQueueItem(item)"
                  >
                    <Download class="w-3.5 h-3.5" />
                  </button>

                  <!-- Open in Studio button -->
                  <button
                    type="button"
                    class="p-1.5 rounded-lg bg-zinc-100 dark:bg-neutral-800 hover:bg-zinc-200 dark:hover:bg-neutral-700 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    :title="locale === 'id' ? 'Buka di Studio Player & Trimmer' : 'Open in Single Studio'"
                    @click="openItemInStudio(item)"
                  >
                    <Film class="w-3.5 h-3.5" />
                  </button>

                  <!-- Remove item -->
                  <button
                    type="button"
                    class="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    :disabled="item.status === 'processing'"
                    :title="locale === 'id' ? 'Hapus dari antrean' : 'Remove from queue'"
                    @click="removeQueueItem(item.id)"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <!-- Processing Progress Bar with Live ETA -->
              <div v-if="item.status === 'processing'" class="mt-2.5 space-y-1">
                <div class="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                  <span class="text-blue-400 flex items-center gap-1">
                    <RefreshCw class="w-3 h-3 animate-spin" />
                    <span>Hardware GPU encoding</span>
                  </span>
                  <span v-if="item.estimatedSecondsRemaining" class="text-neutral-300">
                    {{ locale === 'id' ? `Perkiraan selesai: ${formatDurationEstimate(item.estimatedSecondsRemaining)}` : `Est. remaining: ${formatDurationEstimate(item.estimatedSecondsRemaining)}` }}
                  </span>
                </div>
                <div class="w-full h-1.5 bg-[#2E2E2E] rounded-full overflow-hidden">
                  <div
                    class="h-full bg-[#00a8ff] transition-all duration-150"
                    :style="{ width: `${item.progress}%` }"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Add More Videos Dropzone Area -->
          <div
            class="border border-dashed border-[#2E2E2E] hover:border-[#3E3E3E] rounded-xl p-4 text-center cursor-pointer transition-colors"
            @click="fileInputRef?.click()"
          >
            <div class="flex items-center justify-center gap-2 text-xs text-neutral-400 hover:text-white">
              <Plus class="w-4 h-4" />
              <span>{{ locale === 'id' ? 'Klik atau tarik video lain untuk ditambahkan ke antrean' : 'Click or drop more videos to append to queue' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Video Preview Modal (Rendered on-demand, zero background GPU overhead) -->
      <div
        v-if="activePreviewItem"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        @click.self="closePreviewModal"
      >
        <div class="relative w-full max-w-3xl bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#2E2E2E] rounded-[14px] overflow-hidden shadow-2xl p-4 sm:p-5 space-y-4">
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-zinc-200 dark:border-[#212121] pb-3">
            <div class="min-w-0 pr-4">
              <h3 class="text-sm font-semibold text-[var(--text-primary)] truncate" :title="activePreviewItem.name">
                {{ activePreviewItem.name }}
              </h3>
              <p class="text-xs text-[var(--text-tertiary)] font-mono mt-0.5">
                {{ activePreviewItem.outputUrl ? (locale === 'id' ? 'Preview Hasil Kompresi' : 'Preview Compressed Video') : (locale === 'id' ? 'Preview Video Asli' : 'Preview Original Video') }}
                <span v-if="activePreviewItem.outputSize" class="text-emerald-500 font-bold ml-1">
                  ({{ formatFileSize(activePreviewItem.outputSize) }})
                </span>
                <span v-else class="text-[var(--text-tertiary)] ml-1">
                  ({{ formatFileSize(activePreviewItem.originalSize) }})
                </span>
              </p>
            </div>
            <button
              type="button"
              class="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
              @click="closePreviewModal"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Video Player -->
          <div class="relative bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center max-h-[60vh]">
            <video
              :src="previewModalUrl"
              controls
              autoplay
              playsinline
              class="w-full h-full object-contain mx-auto"
            />
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-between pt-1">
            <span class="text-xs font-mono text-[var(--text-tertiary)]">
              {{ activePreviewItem.status === 'done' ? (locale === 'id' ? 'Status: Selesai' : 'Status: Completed') : (locale === 'id' ? 'Status: Dalam Antrean' : 'Status: In Queue') }}
            </span>
            <div class="flex items-center gap-2">
              <Button
                v-if="activePreviewItem.outputUrl"
                variant="primary"
                size="default"
                class="h-8 px-3 rounded-lg text-xs font-medium cursor-pointer"
                @click="downloadQueueItem(activePreviewItem)"
              >
                <Download class="w-3.5 h-3.5 mr-1.5" />
                <span>Download</span>
              </Button>
              <Button
                variant="secondary"
                size="default"
                class="h-8 px-3 rounded-lg text-xs font-medium cursor-pointer"
                @click="closePreviewModal"
              >
                <span>{{ locale === 'id' ? 'Tutup' : 'Close' }}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- STATE 3: Single Video Studio Workbench -->
    <div v-else class="space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Left Column: Video Preview Player & Timeline Trimmer (7 Cols) -->
        <div class="lg:col-span-7 space-y-4">
          <!-- Video Display Card (Minimalist Player bar as requested by user) -->
          <div
            ref="playerContainerRef"
            class="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#2E2E2E] rounded-[14px] overflow-hidden shadow-xs"
          >
            <div
              class="relative bg-black aspect-video flex items-center justify-center overflow-hidden cursor-pointer"
              @click="togglePlay"
            >
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
            </div>

            <!-- Sleek Minimalist Player Bar (Matching user reference mockup) -->
            <div class="px-3.5 py-2.5 bg-zinc-100 dark:bg-[#121214] border-t border-zinc-200 dark:border-[#262626] flex items-center gap-2.5 select-none">
              <!-- Play / Pause -->
              <button
                type="button"
                class="p-1 text-[var(--text-primary)] hover:opacity-80 transition-colors cursor-pointer shrink-0 flex items-center justify-center focus:outline-none"
                :title="isPlaying ? 'Pause' : 'Play'"
                @click="togglePlay"
              >
                <Play v-if="!isPlaying" class="w-4 h-4 fill-current text-current" />
                <Pause v-else class="w-4 h-4 fill-current text-current" />
              </button>

              <!-- Scrubber Bar -->
              <div
                ref="scrubberBarRef"
                class="relative flex-1 flex items-center h-5 cursor-pointer group/scrub"
                @mousedown="startScrubbing"
                @touchstart.passive="startTouchScrubbing"
              >
                <!-- Track -->
                <div class="w-full h-1 bg-zinc-200 dark:bg-[#2E2E2E] group-hover/scrub:h-1.5 rounded-full relative overflow-hidden transition-all">
                  <!-- Progress Fill -->
                  <div
                    class="h-full bg-[#00a8ff] rounded-full"
                    :style="{ width: `${progressPercent}%` }"
                  />
                </div>

                <!-- Circular Knob -->
                <div
                  class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-zinc-900 dark:bg-white rounded-full shadow-md pointer-events-none transition-transform group-hover/scrub:scale-125"
                  :style="{ left: `${progressPercent}%` }"
                />
              </div>

              <!-- Time Display (0:01 / 0:31) -->
              <div class="text-[11px] font-mono text-[var(--text-secondary)] shrink-0 whitespace-nowrap">
                {{ formatPlayerTime(currentTime) }} / {{ formatPlayerTime(totalDuration) }}
              </div>

              <!-- Mute Button -->
              <button
                type="button"
                class="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0 focus:outline-none"
                :title="isMuted ? 'Unmute' : 'Mute'"
                @click="isMuted = !isMuted"
              >
                <Volume2 v-if="!isMuted" class="w-4 h-4" />
                <VolumeX v-else class="w-4 h-4 text-red-500" />
              </button>

              <!-- Fullscreen Button -->
              <button
                type="button"
                class="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0 focus:outline-none"
                :title="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'"
                @click="toggleFullscreen"
              >
                <Maximize v-if="!isFullscreen" class="w-4 h-4" />
                <Minimize v-else class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Video Timeline Trimmer Card -->
          <div class="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#2E2E2E] rounded-[14px] p-5 space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Scissors class="w-4 h-4 text-[var(--text-primary)]" />
                <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] font-mono">
                  Clip Trimmer
                </h3>
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="text-[11px] font-mono text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
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
                class="relative h-9 bg-zinc-100 dark:bg-[#212121] rounded-lg border border-zinc-200 dark:border-[#2E2E2E] overflow-hidden cursor-pointer select-none"
                @click="onTimelineClick"
              >
                <!-- Trimmed Active Range Zone -->
                <div
                  v-if="totalDuration > 0"
                  class="absolute top-0 bottom-0 bg-zinc-900/15 dark:bg-white/15 border-x border-zinc-900/40 dark:border-white/40"
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
                  <div class="flex items-center justify-between text-[11px] font-mono text-[var(--text-tertiary)] mb-1">
                    <span>Start:</span>
                    <span class="text-[var(--text-primary)] font-medium">{{ formatPlayerTime(startTime) }}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    :max="Math.max(0, endTime - 0.1)"
                    step="0.1"
                    v-model.number="startTime"
                    class="w-full accent-zinc-900 dark:accent-white cursor-pointer"
                    @input="seekTo(startTime)"
                  />
                </div>

                <div>
                  <div class="flex items-center justify-between text-[11px] font-mono text-[var(--text-tertiary)] mb-1">
                    <span>End:</span>
                    <span class="text-[var(--text-primary)] font-medium">{{ formatPlayerTime(endTime) }}</span>
                  </div>
                  <input
                    type="range"
                    :min="Math.min(totalDuration, startTime + 0.1)"
                    :max="totalDuration || 1"
                    step="0.1"
                    v-model.number="endTime"
                    class="w-full accent-zinc-900 dark:accent-white cursor-pointer"
                    @input="seekTo(endTime)"
                  />
                </div>
              </div>
            </div>

            <!-- Trimmer Footer Action -->
            <div class="pt-2 border-t border-zinc-200 dark:border-[#212121] flex items-center justify-between">
              <div class="text-xs font-mono text-[var(--text-tertiary)]">
                Trimmed Duration: <span class="text-[var(--text-primary)] font-semibold">{{ formatPlayerTime(trimDuration) }}</span>
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
          <div class="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#2E2E2E] rounded-[14px] p-5 space-y-4">
            <div class="flex items-center gap-2">
              <Monitor class="w-4 h-4 text-[var(--text-primary)]" />
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
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold border-zinc-900 dark:border-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-[#18181A] border-zinc-200 dark:border-[#2E2E2E] text-[var(--text-secondary)] hover:border-zinc-400 dark:hover:border-neutral-500'"
                @click="selectedPreset = 'original'"
              >
                <div class="text-xs">Original</div>
                <div class="text-[10px] opacity-70 font-mono mt-0.5">100%</div>
              </button>

              <button
                type="button"
                class="px-3 py-2.5 rounded-lg border text-center transition-all cursor-pointer select-none"
                :class="selectedPreset === '1080p'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold border-zinc-900 dark:border-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-[#18181A] border-zinc-200 dark:border-[#2E2E2E] text-[var(--text-secondary)] hover:border-zinc-400 dark:hover:border-neutral-500'"
                @click="selectedPreset = '1080p'"
              >
                <div class="text-xs font-medium">1080p</div>
                <div class="text-[10px] opacity-70 font-mono mt-0.5">FHD</div>
              </button>

              <button
                type="button"
                class="px-3 py-2.5 rounded-lg border text-center transition-all cursor-pointer select-none"
                :class="selectedPreset === '720p'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold border-zinc-900 dark:border-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-[#18181A] border-zinc-200 dark:border-[#2E2E2E] text-[var(--text-secondary)] hover:border-zinc-400 dark:hover:border-neutral-500'"
                @click="selectedPreset = '720p'"
              >
                <div class="text-xs font-medium">720p</div>
                <div class="text-[10px] opacity-70 font-mono mt-0.5">HD Standard</div>
              </button>

              <button
                type="button"
                class="px-3 py-2.5 rounded-lg border text-center transition-all cursor-pointer select-none"
                :class="selectedPreset === '480p'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold border-zinc-900 dark:border-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-[#18181A] border-zinc-200 dark:border-[#2E2E2E] text-[var(--text-secondary)] hover:border-zinc-400 dark:hover:border-neutral-500'"
                @click="selectedPreset = '480p'"
              >
                <div class="text-xs font-medium">480p</div>
                <div class="text-[10px] opacity-70 font-mono mt-0.5">SD Compact</div>
              </button>

              <button
                type="button"
                class="px-3 py-2.5 rounded-lg border text-center transition-all cursor-pointer select-none"
                :class="selectedPreset === '360p'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold border-zinc-900 dark:border-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-[#18181A] border-zinc-200 dark:border-[#2E2E2E] text-[var(--text-secondary)] hover:border-zinc-400 dark:hover:border-neutral-500'"
                @click="selectedPreset = '360p'"
              >
                <div class="text-xs font-medium">360p</div>
                <div class="text-[10px] opacity-70 font-mono mt-0.5">Minimal</div>
              </button>

              <button
                type="button"
                class="px-3 py-2.5 rounded-lg border text-center transition-all cursor-pointer select-none"
                :class="selectedPreset === 'custom'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-black font-semibold border-zinc-900 dark:border-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-[#18181A] border-zinc-200 dark:border-[#2E2E2E] text-[var(--text-secondary)] hover:border-zinc-400 dark:hover:border-neutral-500'"
                @click="selectedPreset = 'custom'"
              >
                <div class="text-xs font-medium">Custom</div>
                <div class="text-[10px] opacity-70 font-mono mt-0.5">W × H</div>
              </button>
            </div>

            <!-- Custom W x H Inputs -->
            <div v-if="selectedPreset === 'custom'" class="p-3 bg-zinc-50 dark:bg-[#18181A] rounded-xl border border-zinc-200 dark:border-[#2E2E2E] space-y-3">
              <div class="grid grid-cols-2 gap-2.5">
                <div>
                  <label class="block text-[11px] font-mono text-[var(--text-tertiary)] mb-1">Width (px)</label>
                  <input
                    type="number"
                    min="16"
                    step="2"
                    v-model.number="customWidth"
                    class="w-full h-8 px-2.5 bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#2E2E2E] rounded-lg text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-zinc-400 dark:focus:border-white/40"
                  />
                </div>
                <div>
                  <label class="block text-[11px] font-mono text-[var(--text-tertiary)] mb-1">Height (px)</label>
                  <input
                    type="number"
                    min="16"
                    step="2"
                    v-model.number="customHeight"
                    class="w-full h-8 px-2.5 bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#2E2E2E] rounded-lg text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-zinc-400 dark:focus:border-white/40"
                  />
                </div>
              </div>

              <div class="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  class="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer select-none"
                  @click="lockAspectRatio = !lockAspectRatio"
                >
                  <Lock v-if="lockAspectRatio" class="w-3.5 h-3.5 text-[var(--text-primary)]" />
                  <Unlock v-else class="w-3.5 h-3.5 text-neutral-400" />
                  <span>Lock Aspect Ratio</span>
                </button>
              </div>
            </div>

            <!-- Output Resolution Badge Display -->
            <div class="px-3.5 py-2.5 rounded-lg bg-zinc-50 dark:bg-[#18181A] border border-zinc-200 dark:border-[#2E2E2E] flex items-center justify-between text-xs font-mono">
              <span class="text-[var(--text-tertiary)]">Target Resolution:</span>
              <span class="text-[var(--text-primary)] font-semibold">
                {{ targetDimensions.width }} × {{ targetDimensions.height }} px
              </span>
            </div>
          </div>

          <!-- Quality & Audio Settings Card -->
          <div class="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#2E2E2E] rounded-[14px] p-5 space-y-4">
            <div class="flex items-center gap-2">
              <Sliders class="w-4 h-4 text-[var(--text-primary)]" />
              <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] font-mono">
                Compression & Audio
              </h3>
            </div>

            <!-- Quality Presets -->
            <div class="space-y-1.5">
              <label class="block text-[11px] font-mono text-[var(--text-tertiary)]">Encoding Profile</label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  class="py-2 px-2 rounded-lg border text-center text-xs transition-colors cursor-pointer select-none"
                  :class="qualityPreset === 'high'
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-black font-medium border-zinc-900 dark:border-white/30'
                    : 'bg-zinc-100 dark:bg-[#18181A] text-[var(--text-secondary)] border-zinc-200 dark:border-[#2E2E2E] hover:text-[var(--text-primary)]'"
                  @click="qualityPreset = 'high'"
                >
                  High
                </button>

                <button
                  type="button"
                  class="py-2 px-2 rounded-lg border text-center text-xs transition-colors cursor-pointer select-none"
                  :class="qualityPreset === 'balanced'
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-black font-medium border-zinc-900 dark:border-white/30'
                    : 'bg-zinc-100 dark:bg-[#18181A] text-[var(--text-secondary)] border-zinc-200 dark:border-[#2E2E2E] hover:text-[var(--text-primary)]'"
                  @click="qualityPreset = 'balanced'"
                >
                  Balanced
                </button>

                <button
                  type="button"
                  class="py-2 px-2 rounded-lg border text-center text-xs transition-colors cursor-pointer select-none"
                  :class="qualityPreset === 'compact'
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-black font-medium border-zinc-900 dark:border-white/30'
                    : 'bg-zinc-100 dark:bg-[#18181A] text-[var(--text-secondary)] border-zinc-200 dark:border-[#2E2E2E] hover:text-[var(--text-primary)]'"
                  @click="qualityPreset = 'compact'"
                >
                  Compact
                </button>
              </div>
            </div>

            <!-- Audio Toggle Switch -->
            <div class="pt-2 border-t border-zinc-200 dark:border-[#212121] flex items-center justify-between">
              <div>
                <div class="text-xs font-medium text-[var(--text-primary)]">Audio Track</div>
                <div class="text-[11px] text-[var(--text-tertiary)]">Keep or mute audio track</div>
              </div>

              <button
                type="button"
                class="px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
                :class="keepAudio
                  ? 'bg-zinc-900 dark:bg-[#2E2E2E] border-zinc-900 dark:border-white/30 text-white'
                  : 'bg-zinc-100 dark:bg-[#18181A] border-zinc-200 dark:border-[#2E2E2E] text-[var(--text-secondary)]'"
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
            <div v-if="isProcessing" class="p-4 bg-zinc-50 dark:bg-[#141416] border border-zinc-200 dark:border-[#2E2E2E] rounded-xl space-y-2">
              <div class="flex items-center justify-between text-xs font-mono">
                <span class="text-[var(--text-tertiary)]">{{ processStatus }}</span>
                <span class="text-[var(--text-primary)] font-bold">{{ processProgress }}%</span>
              </div>
              <div class="w-full h-2 bg-zinc-200 dark:bg-[#212121] rounded-full overflow-hidden">
                <div
                  class="h-full bg-zinc-900 dark:bg-white transition-all duration-150"
                  :style="{ width: `${processProgress}%` }"
                />
              </div>
              <div class="flex justify-end pt-1">
                <button
                  type="button"
                  class="text-[11px] font-mono text-red-500 hover:underline cursor-pointer"
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
      <div v-if="outputBlobUrl" class="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#2E2E2E] rounded-[14px] p-6 space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-200 dark:border-[#212121] pb-4">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Check class="w-4 h-4" />
            </div>
            <div>
              <h3 class="text-sm font-semibold text-[var(--text-primary)]">Video Ready for Download</h3>
              <p class="text-xs text-[var(--text-tertiary)] font-mono">
                Processed via 100% Client-Side WebCodecs Hardware GPU
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
          <div class="p-3.5 bg-zinc-50 dark:bg-[#18181A] border border-zinc-200 dark:border-[#2E2E2E] rounded-xl space-y-1">
            <div class="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Resolution</div>
            <div class="text-xs text-[var(--text-tertiary)] line-through">{{ videoNaturalWidth }}×{{ videoNaturalHeight }}</div>
            <div class="text-sm font-bold text-[var(--text-primary)]">{{ outputWidth }}×{{ outputHeight }}</div>
          </div>

          <div class="p-3.5 bg-zinc-50 dark:bg-[#18181A] border border-zinc-200 dark:border-[#2E2E2E] rounded-xl space-y-1">
            <div class="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Duration</div>
            <div class="text-xs text-[var(--text-tertiary)] line-through">{{ formatPlayerTime(totalDuration) }}</div>
            <div class="text-sm font-bold text-[var(--text-primary)]">{{ formatPlayerTime(outputDuration) }}</div>
          </div>

          <div class="p-3.5 bg-zinc-50 dark:bg-[#18181A] border border-zinc-200 dark:border-[#2E2E2E] rounded-xl space-y-1">
            <div class="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">File Size</div>
            <div class="text-xs text-[var(--text-tertiary)] line-through">{{ formatFileSize(originalFileSize) }}</div>
            <div class="text-sm font-bold text-emerald-500">{{ formatFileSize(outputSize) }}</div>
          </div>

          <div class="p-3.5 bg-zinc-50 dark:bg-[#18181A] border border-zinc-200 dark:border-[#2E2E2E] rounded-xl space-y-1">
            <div class="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Savings</div>
            <div class="text-xs text-[var(--text-tertiary)]">Reduced by</div>
            <div class="text-sm font-bold" :class="sizeSavingsPercentage > 0 ? 'text-emerald-500' : 'text-[var(--text-primary)]'">
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
