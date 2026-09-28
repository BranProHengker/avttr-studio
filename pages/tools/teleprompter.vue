<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  Video,
  VideoOff,
  Play,
  Square,
  Pause,
  RotateCcw,
  Download,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  Settings2,
  Sparkles,
  Clock,
  FlipHorizontal,
  CheckCircle2,
  Type
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import { useI18n } from '~/composables/useI18n'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

const toast = useToast()
const { t } = useI18n()

useHead({
  title: 'Teleprompter Video Studio — Webcam Recorder with Smart Cue Cards | Avttr Studio',
  meta: [
    {
      name: 'description',
      content: 'Webcam video recorder with floating cue cards, per-card timers, and hotkey switching. Perfect for job interviews, PPT presentations, and elevator pitches.'
    }
  ]
})

// Cue Card Interface
interface CueCard {
  id: string
  text: string
  duration: number // target seconds
}

// Default Presets
const INTERVIEW_PRESET: CueCard[] = [
  {
    id: 'card-1',
    text: 'Halo, perkenalkan nama saya [Nama Anda]. Saya seorang profesional dengan antusiasme tinggi di bidang teknologi dan pengembangan produk.',
    duration: 8
  },
  {
    id: 'card-2',
    text: 'Dalam peran terakhir, saya memimpin inisiatif kunci yang meningkatkan efisiensi alur kerja sebesar 40% dan mempercepat deliverable tim.',
    duration: 9
  },
  {
    id: 'card-3',
    text: 'Saya sangat tertarik dengan kesempatan ini karena visi perusahaan sejalan dengan nilai dan roadmap karier yang ingin saya bangun.',
    duration: 8
  }
]

const PRESENTATION_PRESET: CueCard[] = [
  {
    id: 'card-1',
    text: 'Selamat pagi rekan-rekan. Hari ini kita akan membahas solusi inovatif untuk mengatasi tantangan retensi pengguna di kuartal mendatang.',
    duration: 8
  },
  {
    id: 'card-2',
    text: 'Berdasarkan data riset terbaru, 65% pengguna meninggalkan alur registrasi karena langkah form yang terlalu kompleks.',
    duration: 9
  },
  {
    id: 'card-3',
    text: 'Dengan menerapkan sistem one-click checkout dan preview instan, kita memproyeksikan peningkatan konversi hingga 2.5 kali lipat.',
    duration: 10
  }
]

// State: Cue Cards
const cards = ref<CueCard[]>(JSON.parse(JSON.stringify(INTERVIEW_PRESET)))
const currentCardIndex = ref(0)
const cardTimeElapsed = ref(0)
const cardTimerInterval = ref<any>(null)

// State: Devices & Stream
const videoDevices = ref<MediaDeviceInfo[]>([])
const audioDevices = ref<MediaDeviceInfo[]>([])
const selectedVideoDevice = ref<string>('')
const selectedAudioDevice = ref<string>('')
const videoElementRef = ref<HTMLVideoElement | null>(null)
const mediaStream = ref<MediaStream | null>(null)
const isCameraActive = ref(false)
const isCameraLoading = ref(false)
const isMirror = ref(true)
const cameraError = ref<string | null>(null)

// State: Recording
const isRecording = ref(false)
const isPaused = ref(false)
const recordingDuration = ref(0)
const recordingInterval = ref<any>(null)
const countdown = ref<number | null>(null)
const countdownInterval = ref<any>(null)
const mediaRecorder = ref<MediaRecorder | null>(null)
const recordedChunks = ref<Blob[]>([])
const recordedVideoUrl = ref<string | null>(null)
const recordedMimeType = ref('video/webm')

// State: Prompter Display Settings
const isAutoAdvance = ref(false)
const fontSize = ref<'sm' | 'md' | 'lg' | 'xl'>('lg')
const bgOpacity = ref<'solid' | 'glass' | 'minimal'>('glass')
const showNextPreview = ref(true)

// Word count helper
const countWords = (text: string) => {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

// Auto calculate seconds from words (~130 words per minute => ~2.2 words per second)
const autoCalculateDuration = (text: string): number => {
  const words = countWords(text)
  return Math.max(4, Math.round(words / 2.2))
}

// Current Card Computed
const currentCard = computed(() => cards.value[currentCardIndex.value] || cards.value[0])
const nextCard = computed(() => {
  if (currentCardIndex.value < cards.value.length - 1) {
    return cards.value[currentCardIndex.value + 1]
  }
  return null
})

// Progress of current card timer
const cardProgressPercent = computed(() => {
  if (!currentCard.value || !currentCard.value.duration) return 0
  return Math.min(100, Math.round((cardTimeElapsed.value / currentCard.value.duration) * 100))
})

// Total Script Stats
const totalWords = computed(() => {
  return cards.value.reduce((acc, card) => acc + countWords(card.text), 0)
})

const totalEstSeconds = computed(() => {
  return cards.value.reduce((acc, card) => acc + (card.duration || 5), 0)
})

// Format seconds to mm:ss
const formatTime = (secs: number) => {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// Navigation between cue cards
const goToCard = (index: number) => {
  if (index >= 0 && index < cards.value.length) {
    currentCardIndex.value = index
    cardTimeElapsed.value = 0
  }
}

const nextCardAction = () => {
  if (currentCardIndex.value < cards.value.length - 1) {
    goToCard(currentCardIndex.value + 1)
  } else {
    cardTimeElapsed.value = currentCard.value?.duration || 0
  }
}

const prevCardAction = () => {
  if (currentCardIndex.value > 0) {
    goToCard(currentCardIndex.value - 1)
  }
}

// Card Timer tick
const startCardTimer = () => {
  stopCardTimer()
  cardTimerInterval.value = setInterval(() => {
    if (isPaused.value) return
    cardTimeElapsed.value += 0.5
    if (currentCard.value && cardTimeElapsed.value >= currentCard.value.duration) {
      if (isAutoAdvance.value) {
        nextCardAction()
      }
    }
  }, 500)
}

const stopCardTimer = () => {
  if (cardTimerInterval.value) {
    clearInterval(cardTimerInterval.value)
    cardTimerInterval.value = null
  }
}

// Card CRUD
const addCard = () => {
  const newCard: CueCard = {
    id: `card-${Date.now()}`,
    text: '',
    duration: 8
  }
  cards.value.push(newCard)
  goToCard(cards.value.length - 1)
}

const removeCard = (idx: number) => {
  if (cards.value.length <= 1) {
    toast.warning('Minimal 1 Catatan', 'Anda memerlukan setidaknya satu kartu catatan.')
    return
  }
  cards.value.splice(idx, 1)
  if (currentCardIndex.value >= cards.value.length) {
    currentCardIndex.value = cards.value.length - 1
  }
  cardTimeElapsed.value = 0
}

const moveCard = (idx: number, direction: 'up' | 'down') => {
  if (direction === 'up' && idx > 0) {
    const temp = cards.value[idx]
    cards.value[idx] = cards.value[idx - 1]
    cards.value[idx - 1] = temp
    if (currentCardIndex.value === idx) currentCardIndex.value = idx - 1
    else if (currentCardIndex.value === idx - 1) currentCardIndex.value = idx
  } else if (direction === 'down' && idx < cards.value.length - 1) {
    const temp = cards.value[idx]
    cards.value[idx] = cards.value[idx + 1]
    cards.value[idx + 1] = temp
    if (currentCardIndex.value === idx) currentCardIndex.value = idx + 1
    else if (currentCardIndex.value === idx + 1) currentCardIndex.value = idx
  }
}

const applyPreset = (preset: 'interview' | 'presentation' | 'blank') => {
  if (preset === 'interview') {
    cards.value = JSON.parse(JSON.stringify(INTERVIEW_PRESET))
  } else if (preset === 'presentation') {
    cards.value = JSON.parse(JSON.stringify(PRESENTATION_PRESET))
  } else {
    cards.value = [
      { id: 'card-1', text: '', duration: 8 }
    ]
  }
  currentCardIndex.value = 0
  cardTimeElapsed.value = 0
  toast.info('Template Diterapkan', 'Daftar catatan telah diperbarui.')
}

// Device Enumeration
const getDevices = async () => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    videoDevices.value = devices.filter(d => d.kind === 'videoinput')
    audioDevices.value = devices.filter(d => d.kind === 'audioinput')

    if (!selectedVideoDevice.value && videoDevices.value.length > 0) {
      selectedVideoDevice.value = videoDevices.value[0].deviceId
    }
    if (!selectedAudioDevice.value && audioDevices.value.length > 0) {
      selectedAudioDevice.value = audioDevices.value[0].deviceId
    }
  } catch (err) {
    console.error('Error fetching media devices:', err)
  }
}

// Start Camera Stream
const startCamera = async () => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    cameraError.value = 'Perangkat browser tidak mendukung akses webcam (getUserMedia).'
    return
  }

  isCameraLoading.value = true
  cameraError.value = null

  stopCamera()

  try {
    const constraints: MediaStreamConstraints = {
      video: selectedVideoDevice.value
        ? { deviceId: { exact: selectedVideoDevice.value }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        : { width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: selectedAudioDevice.value
        ? { deviceId: { exact: selectedAudioDevice.value }, echoCancellation: true, noiseSuppression: true }
        : { echoCancellation: true, noiseSuppression: true }
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    mediaStream.value = stream

    if (videoElementRef.value) {
      videoElementRef.value.srcObject = stream
      await videoElementRef.value.play().catch(() => {})
    }

    isCameraActive.value = true
    await getDevices()
  } catch (err: any) {
    console.error('Webcam permission error:', err)
    cameraError.value = err.name === 'NotAllowedError'
      ? 'Akses kamera atau mikrofon ditolak oleh browser. Harap izinkan akses untuk merekam.'
      : (err.message || 'Gagal menyalakan kamera.')
    isCameraActive.value = false
  } finally {
    isCameraLoading.value = false
  }
}

// Stop Camera Stream
const stopCamera = () => {
  if (mediaStream.value) {
    mediaStream.value.getTracks().forEach(track => track.stop())
    mediaStream.value = null
  }
  if (videoElementRef.value) {
    videoElementRef.value.srcObject = null
  }
  isCameraActive.value = false
}

// Supported MIME types detection
const getSupportedMimeType = () => {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4'
  ]
  for (const t of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
      return t
    }
  }
  return 'video/webm'
}

// Start Countdown & Recording
const triggerRecordingCountdown = () => {
  if (!isCameraActive.value) {
    toast.warning('Kamera Belum Aktif', 'Nyalakan kamera terlebih dahulu sebelum merekam.')
    return
  }

  countdown.value = 3
  countdownInterval.value = setInterval(() => {
    if (countdown.value !== null) {
      countdown.value -= 1
      if (countdown.value <= 0) {
        clearInterval(countdownInterval.value)
        countdown.value = null
        startRecording()
      }
    }
  }, 1000)
}

// Actual MediaRecorder Start
const startRecording = () => {
  if (!mediaStream.value) return

  recordedChunks.value = []
  recordedVideoUrl.value = null
  const mimeType = getSupportedMimeType()
  recordedMimeType.value = mimeType

  try {
    const recorder = new MediaRecorder(mediaStream.value, { mimeType })
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.value.push(e.data)
      }
    }

    recorder.onstop = () => {
      const blob = new Blob(recordedChunks.value, { type: recordedMimeType.value })
      if (recordedVideoUrl.value) URL.revokeObjectURL(recordedVideoUrl.value)
      recordedVideoUrl.value = URL.createObjectURL(blob)
      toast.success('Rekaman Selesai', 'Video berhasil direkam dan siap diunduh.')
    }

    recorder.start(1000)
    mediaRecorder.value = recorder
    isRecording.value = true
    isPaused.value = false
    recordingDuration.value = 0

    recordingInterval.value = setInterval(() => {
      if (!isPaused.value) {
        recordingDuration.value += 1
      }
    }, 1000)

    goToCard(0)
    startCardTimer()

    toast.info('Perekaman Dimulai', 'Gunakan tombol panah atau angka untuk ganti kartu catatan.')
  } catch (err: any) {
    toast.error('Gagal Merekam', err.message || 'MediaRecorder tidak dapat dijalankan.')
  }
}

// Pause / Resume Recording
const togglePause = () => {
  if (!mediaRecorder.value) return
  if (isPaused.value) {
    mediaRecorder.value.resume()
    isPaused.value = false
  } else {
    mediaRecorder.value.pause()
    isPaused.value = true
  }
}

// Stop Recording
const stopRecording = () => {
  if (mediaRecorder.value && isRecording.value) {
    mediaRecorder.value.stop()
  }
  isRecording.value = false
  isPaused.value = false

  if (recordingInterval.value) {
    clearInterval(recordingInterval.value)
    recordingInterval.value = null
  }
  stopCardTimer()
}

// Download Video
const downloadRecordedVideo = () => {
  if (!recordedVideoUrl.value) return
  const isMp4 = recordedMimeType.value.includes('mp4')
  const ext = isMp4 ? 'mp4' : 'webm'
  const filename = `teleprompter-recording-${Date.now()}.${ext}`

  const a = document.createElement('a')
  a.href = recordedVideoUrl.value
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  toast.success('Unduhan Berhasil', `File disimpan sebagai ${filename}`)
}

// Retake / Reset Recording
const retakeRecording = () => {
  recordedChunks.value = []
  if (recordedVideoUrl.value) {
    URL.revokeObjectURL(recordedVideoUrl.value)
    recordedVideoUrl.value = null
  }
  goToCard(0)
  cardTimeElapsed.value = 0
}

// Global Keyboard Hotkey Handler
const handleKeydown = (e: KeyboardEvent) => {
  const target = e.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    return
  }

  // Number keys 1-9
  if (e.code.startsWith('Digit') || e.code.startsWith('Numpad')) {
    const num = parseInt(e.key, 10)
    if (!isNaN(num) && num >= 1 && num <= cards.value.length) {
      e.preventDefault()
      goToCard(num - 1)
      return
    }
  }

  // Arrow Right / Down
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault()
    nextCardAction()
    return
  }

  // Arrow Left / Up
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    prevCardAction()
    return
  }

  // Spacebar
  if (e.code === 'Space') {
    e.preventDefault()
    nextCardAction()
    return
  }
}

// Lifecycle Hooks
onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeydown)
    startCamera()
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeydown)
  }
  stopCamera()
  stopRecording()
  if (recordedVideoUrl.value) URL.revokeObjectURL(recordedVideoUrl.value)
})
</script>

<template>
  <div class="space-y-6 pb-12 w-full">
    <!-- Breadcrumbs & Header Flex Row -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="space-y-1">
        <nav class="flex items-center gap-1.5 text-xs font-mono text-[var(--text-tertiary)]">
          <NuxtLink to="/" class="hover:text-[var(--text-primary)] transition-colors">Dashboard</NuxtLink>
          <span>/</span>
          <span>Assets</span>
          <span>/</span>
          <span class="text-[var(--text-primary)] font-medium">Teleprompter Studio</span>
        </nav>
        <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          {{ t.tools['teleprompter']?.title || 'Teleprompter Video Studio' }}
        </h1>
        <p class="text-xs sm:text-sm text-[var(--text-secondary)]">
          {{ t.tools['teleprompter']?.description || 'Webcam video recorder with floating cue cards, per-card timers, and hotkey switching.' }}
        </p>
      </div>

      <!-- Engine Badges -->
      <div class="flex items-center gap-2 flex-wrap">
        <Badge variant="badge">1080p WebRTC</Badge>
        <Badge variant="outline">Client Privacy</Badge>
      </div>
    </div>

    <!-- Main Workspace Grid: Webcam Studio & Cue Cards Builder -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- LEFT / TOP: Webcam & Teleprompter Stage (7 Cols) -->
      <div class="lg:col-span-7 space-y-4">
        <!-- Video Viewport Card -->
        <div class="relative rounded-[14px] overflow-hidden bg-black border border-zinc-200 dark:border-[#28282D] shadow-lg aspect-video flex items-center justify-center select-none group">
          <!-- Live Webcam Feed (CLEAN FEED, NO OVERLAY RECORDED) -->
          <video
            ref="videoElementRef"
            autoplay
            playsinline
            muted
            class="w-full h-full object-cover transition-transform duration-200"
            :class="{ '-scale-x-100': isMirror }"
          />

          <!-- Camera Loading / Off State -->
          <div
            v-if="!isCameraActive || cameraError"
            class="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center p-6 text-center z-10 space-y-3"
          >
            <div class="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
              <VideoOff v-if="cameraError" class="w-6 h-6 text-rose-400" />
              <Video v-else class="w-6 h-6" />
            </div>
            <div class="max-w-xs space-y-1">
              <p class="text-sm font-semibold text-white">
                {{ cameraError ? 'Kamera Tidak Tersedia' : 'Kamera Belum Aktif' }}
              </p>
              <p class="text-xs text-zinc-400 leading-relaxed">
                {{ cameraError || 'Izinkan akses kamera dan mikrofon pada browser Anda untuk memulai rekaman studio.' }}
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              :disabled="isCameraLoading"
              @click="startCamera"
            >
              <Video class="w-3.5 h-3.5 mr-1.5" />
              <span>{{ isCameraLoading ? 'Menghubungkan...' : 'Nyalakan Kamera' }}</span>
            </Button>
          </div>

          <!-- Countdown Overlay (3 - 2 - 1) -->
          <div
            v-if="countdown !== null"
            class="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-30"
          >
            <div class="text-7xl sm:text-8xl font-black text-white animate-ping">
              {{ countdown }}
            </div>
          </div>

          <!-- TOP RECORDING STATUS BAR (Floating on video) -->
          <div
            v-if="isCameraActive"
            class="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none z-20"
          >
            <!-- Recording Indicator -->
            <div class="flex items-center gap-2">
              <div
                v-if="isRecording"
                class="flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-600/90 backdrop-blur-md text-white font-mono text-xs font-semibold shadow-md pointer-events-auto"
              >
                <span class="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span>REC {{ formatTime(recordingDuration) }}</span>
              </div>
              <div
                v-else
                class="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md text-zinc-300 font-mono text-[11px] border border-white/10"
              >
                STANDBY
              </div>
            </div>

            <!-- Card Navigator Pill -->
            <div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/15 text-xs font-mono">
              <span class="text-zinc-400">Kartu</span>
              <span class="font-bold text-white">{{ currentCardIndex + 1 }}</span>
              <span class="text-zinc-500">/</span>
              <span class="text-zinc-400">{{ cards.length }}</span>
            </div>
          </div>

          <!-- TELEPROMPTER HUD: FLOATING CUE CARD (Placed Top-Center near webcam lens) -->
          <div
            v-if="isCameraActive && currentCard"
            class="absolute top-12 sm:top-14 inset-x-4 sm:inset-x-8 z-20 pointer-events-auto transition-all duration-200"
          >
            <div
              class="rounded-xl border transition-all duration-200 overflow-hidden shadow-2xl backdrop-blur-md"
              :class="[
                bgOpacity === 'solid'
                  ? 'bg-zinc-950/95 border-zinc-700 text-white'
                  : bgOpacity === 'glass'
                    ? 'bg-zinc-900/80 border-white/20 text-white'
                    : 'bg-black/40 border-white/10 text-white'
              ]"
            >
              <!-- Card Meta Bar -->
              <div class="flex items-center justify-between px-3.5 py-1.5 border-b border-white/10 bg-white/5 text-[11px] font-mono">
                <div class="flex items-center gap-2">
                  <span class="px-1.5 py-0.5 rounded bg-white/20 text-white font-bold">
                    Poin {{ currentCardIndex + 1 }}
                  </span>
                  <span class="text-zinc-300">
                    {{ countWords(currentCard.text) }} kata
                  </span>
                </div>

                <div class="flex items-center gap-2">
                  <span class="text-zinc-300 flex items-center gap-1">
                    <Clock class="w-3 h-3 text-amber-400" />
                    <span>{{ Math.round(cardTimeElapsed) }}s / {{ currentCard.duration }}s</span>
                  </span>
                  <span class="hidden sm:inline text-zinc-500">•</span>
                  <span class="hidden sm:inline text-zinc-400 text-[10px]">
                    Tekan <kbd class="px-1 py-0.5 rounded bg-white/15 text-white font-bold">← / →</kbd> atau <kbd class="px-1 py-0.5 rounded bg-white/15 text-white font-bold">1-9</kbd>
                  </span>
                </div>
              </div>

              <!-- Card Time Progress Bar -->
              <div class="w-full h-1 bg-white/10">
                <div
                  class="h-full bg-emerald-400 transition-all duration-300 ease-linear"
                  :style="{ width: `${cardProgressPercent}%` }"
                />
              </div>

              <!-- Cue Card Text Content (Prompter Lens Focus) -->
              <div class="p-4 sm:p-5 text-center">
                <p
                  class="font-semibold leading-relaxed tracking-wide select-text drop-shadow-sm transition-all"
                  :class="{
                    'text-base sm:text-lg': fontSize === 'sm',
                    'text-lg sm:text-xl': fontSize === 'md',
                    'text-xl sm:text-2xl': fontSize === 'lg',
                    'text-2xl sm:text-3xl': fontSize === 'xl',
                  }"
                >
                  {{ currentCard.text || '(Belum ada teks pada kartu ini, ketik di form sebelah kanan)' }}
                </p>
              </div>

              <!-- Next Card Teaser Preview -->
              <div
                v-if="showNextPreview && nextCard"
                class="px-3.5 py-2 border-t border-white/10 bg-black/30 flex items-center justify-between text-xs text-zinc-300 gap-2"
              >
                <div class="flex items-center gap-1.5 truncate">
                  <span class="text-zinc-500 font-mono text-[10px] uppercase font-bold shrink-0">Selanjutnya ({{ currentCardIndex + 2 }}):</span>
                  <span class="truncate opacity-80 italic">{{ nextCard.text }}</span>
                </div>
                <button
                  type="button"
                  class="shrink-0 text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                  @click="nextCardAction"
                >
                  <span>Lanjut</span>
                  <ArrowRight class="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          <!-- Bottom Hotkey Floating Buttons on Video Hover -->
          <div
            v-if="isCameraActive"
            class="absolute bottom-3 inset-x-3 flex items-center justify-between pointer-events-none z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          >
            <button
              type="button"
              class="px-2.5 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-md text-xs font-medium border border-white/15 pointer-events-auto flex items-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              :disabled="currentCardIndex === 0"
              @click="prevCardAction"
            >
              <ArrowLeft class="w-3.5 h-3.5" />
              <span>Sebelumnya (←)</span>
            </button>

            <button
              type="button"
              class="px-2.5 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-md text-xs font-medium border border-white/15 pointer-events-auto flex items-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              :disabled="currentCardIndex >= cards.length - 1"
              @click="nextCardAction"
            >
              <span>Berikutnya (→)</span>
              <ArrowRight class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- CAMERA & RECORDING CONTROL BAR -->
        <div class="p-3.5 sm:p-4 rounded-xl border border-zinc-200 dark:border-[#28282D] bg-zinc-50/70 dark:bg-[#1B1B1E] flex flex-wrap items-center justify-between gap-3">
          <!-- Left: Main Recording Trigger -->
          <div class="flex items-center gap-2">
            <template v-if="!isRecording">
              <Button
                variant="primary"
                size="default"
                class="bg-rose-600 hover:bg-rose-500 text-white border-rose-600 shadow-sm font-semibold"
                :disabled="!isCameraActive || countdown !== null"
                @click="triggerRecordingCountdown"
              >
                <div class="w-3 h-3 rounded-full bg-white mr-1.5 animate-pulse" />
                <span>Mulai Rekam Video</span>
              </Button>
            </template>

            <template v-else>
              <Button
                variant="outline"
                size="default"
                class="text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-900/50"
                @click="togglePause"
              >
                <Pause v-if="!isPaused" class="w-4 h-4 mr-1.5" />
                <Play v-else class="w-4 h-4 mr-1.5" />
                <span>{{ isPaused ? 'Lanjutkan' : 'Jeda' }}</span>
              </Button>

              <Button
                variant="primary"
                size="default"
                class="bg-zinc-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-semibold"
                @click="stopRecording"
              >
                <Square class="w-4 h-4 mr-1.5 fill-current" />
                <span>Stop & Simpan</span>
              </Button>
            </template>
          </div>

          <!-- Right: Display & Camera Settings -->
          <div class="flex items-center gap-1.5 flex-wrap">
            <!-- Mirror Camera Toggle -->
            <button
              type="button"
              class="p-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer"
              :class="
                isMirror
                  ? 'bg-white dark:bg-[#28282D] text-zinc-900 dark:text-white border-zinc-300 dark:border-white/10 shadow-xs'
                  : 'bg-zinc-100/60 dark:bg-[#141416] text-zinc-600 dark:text-neutral-400 border-zinc-200 dark:border-[#28282D]'
              "
              title="Cerminkan kamera (Mirror)"
              @click="isMirror = !isMirror"
            >
              <FlipHorizontal class="w-4 h-4" />
            </button>

            <!-- Font Size Toggle -->
            <div class="flex items-center bg-zinc-200/60 dark:bg-[#121214] border border-zinc-200 dark:border-[#28282D] rounded-lg p-0.5">
              <button
                v-for="s in (['sm', 'md', 'lg', 'xl'] as const)"
                :key="s"
                type="button"
                class="px-2 py-1 rounded text-xs font-mono uppercase cursor-pointer transition-all"
                :class="
                  fontSize === s
                    ? 'bg-white dark:bg-[#28282D] text-zinc-900 dark:text-white font-bold shadow-xs'
                    : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'
                "
                :title="`Ukuran Font: ${s}`"
                @click="fontSize = s"
              >
                {{ s }}
              </button>
            </div>

            <!-- Auto Advance Switch -->
            <button
              type="button"
              class="px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              :class="
                isAutoAdvance
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-zinc-100/60 dark:bg-[#141416] text-zinc-600 dark:text-neutral-400 border-zinc-200 dark:border-[#28282D]'
              "
              title="Ganti kartu otomatis saat timer detik kartu habis"
              @click="isAutoAdvance = !isAutoAdvance"
            >
              <Sparkles class="w-3.5 h-3.5" />
              <span>Auto-Switch</span>
            </button>
          </div>
        </div>

        <!-- RESULT PREVIEW CARD (Shown when recording is finished) -->
        <div
          v-if="recordedVideoUrl"
          class="p-4 sm:p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-[#141d17] space-y-4"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <CheckCircle2 class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h4 class="text-sm font-semibold text-zinc-900 dark:text-white">Hasil Rekaman Siap</h4>
                <p class="text-xs text-zinc-500 dark:text-neutral-400">
                  Video bersih 100% tanpa teks catatan. Putar ulang atau unduh langsung ke komputer Anda.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              class="text-xs"
              @click="retakeRecording"
            >
              <RotateCcw class="w-3.5 h-3.5 mr-1" />
              <span>Rekam Ulang</span>
            </Button>
          </div>

          <!-- Recorded Video Player -->
          <div class="rounded-xl overflow-hidden bg-black border border-emerald-500/20 max-h-[300px] flex items-center justify-center">
            <video
              :src="recordedVideoUrl"
              controls
              playsinline
              class="max-h-[300px] w-full object-contain"
            />
          </div>

          <!-- Download Action -->
          <div class="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="primary"
              size="default"
              class="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm w-full sm:w-auto"
              @click="downloadRecordedVideo"
            >
              <Download class="w-4 h-4 mr-1.5" />
              <span>Unduh Video Rekaman (.{{ recordedMimeType.includes('mp4') ? 'mp4' : 'webm' }})</span>
            </Button>
          </div>
        </div>
      </div>

      <!-- RIGHT / BOTTOM: Cue Cards & Script Builder Form (5 Cols) -->
      <div class="lg:col-span-5 space-y-4">
        <!-- Script Builder Header & Presets -->
        <div class="p-4 rounded-xl border border-zinc-200 dark:border-[#28282D] bg-zinc-50/70 dark:bg-[#1B1B1E] space-y-3">
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <h3 class="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                <Type class="w-4 h-4 text-[var(--text-secondary)]" />
                <span>Formulir Catatan (Cue Cards)</span>
              </h3>
              <p class="text-xs text-zinc-500 dark:text-neutral-400">
                Total {{ totalWords }} kata • Estimasi durasi {{ formatTime(totalEstSeconds) }}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              class="text-xs cursor-pointer"
              @click="addCard"
            >
              <Plus class="w-3.5 h-3.5 mr-1" />
              <span>Tambah</span>
            </Button>
          </div>

          <!-- Quick Templates -->
          <div class="flex items-center gap-1.5 pt-1 overflow-x-auto text-xs">
            <span class="text-[11px] font-mono text-zinc-400 dark:text-neutral-500 shrink-0">Template:</span>
            <button
              type="button"
              class="px-2 py-1 rounded-md bg-zinc-200/60 dark:bg-[#222226] text-zinc-700 dark:text-neutral-300 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer shrink-0"
              @click="applyPreset('interview')"
            >
              Interview Kerja
            </button>
            <button
              type="button"
              class="px-2 py-1 rounded-md bg-zinc-200/60 dark:bg-[#222226] text-zinc-700 dark:text-neutral-300 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer shrink-0"
              @click="applyPreset('presentation')"
            >
              Presentasi PPT
            </button>
            <button
              type="button"
              class="px-2 py-1 rounded-md bg-zinc-200/60 dark:bg-[#222226] text-zinc-700 dark:text-neutral-300 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer shrink-0"
              @click="applyPreset('blank')"
            >
              Kosong
            </button>
          </div>
        </div>

        <!-- Cue Cards List (Accordion / Interactive Cards) -->
        <div class="space-y-3 max-h-[600px] overflow-y-auto pr-1">
          <div
            v-for="(card, idx) in cards"
            :key="card.id"
            class="p-3.5 rounded-xl border transition-all duration-150"
            :class="
              currentCardIndex === idx
                ? 'border-zinc-400 dark:border-white/30 bg-white dark:bg-[#222226] shadow-sm'
                : 'border-zinc-200 dark:border-[#28282D] bg-zinc-50/70 dark:bg-[#1B1B1E] opacity-90 hover:opacity-100'
            "
          >
            <!-- Card Header: Number, Hotkey, Order Controls -->
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="w-6 h-6 rounded-md flex items-center justify-center text-xs font-mono font-bold cursor-pointer transition-colors"
                  :class="
                    currentCardIndex === idx
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                      : 'bg-zinc-200 dark:bg-[#2A2A2E] text-zinc-700 dark:text-neutral-300 hover:bg-zinc-300'
                  "
                  :title="`Aktifkan poin ${idx + 1} (Hotkey: ${idx < 9 ? idx + 1 : 'none'})`"
                  @click="goToCard(idx)"
                >
                  {{ idx + 1 }}
                </button>

                <span class="text-xs font-semibold text-zinc-900 dark:text-white">
                  Poin {{ idx + 1 }}
                </span>

                <span v-if="idx < 9" class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-[#141416] border border-zinc-200 dark:border-[#28282D] text-zinc-500 dark:text-neutral-400">
                  Key: {{ idx + 1 }}
                </span>
              </div>

              <!-- Re-order & Delete -->
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  :disabled="idx === 0"
                  title="Geser ke atas"
                  @click="moveCard(idx, 'up')"
                >
                  <ChevronUp class="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  class="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  :disabled="idx === cards.length - 1"
                  title="Geser ke bawah"
                  @click="moveCard(idx, 'down')"
                >
                  <ChevronDown class="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  class="p-1 rounded text-zinc-400 hover:text-rose-500 transition-colors cursor-pointer ml-1"
                  title="Hapus kartu ini"
                  @click="removeCard(idx)"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Card Textarea Input -->
            <textarea
              v-model="card.text"
              rows="3"
              placeholder="Tuliskan kalimat atau poin naskah yang ingin Anda sampaikan..."
              class="w-full p-2.5 bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#28282D] rounded-lg text-xs leading-relaxed text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-neutral-600 focus:outline-none focus:border-zinc-400 dark:focus:border-[#4E4E58] resize-none"
              @focus="goToCard(idx)"
            />

            <!-- Card Bottom Stats & Duration Setter -->
            <div class="flex items-center justify-between mt-2 pt-1 text-xs">
              <div class="text-[11px] font-mono text-zinc-500 dark:text-neutral-400">
                <span>{{ countWords(card.text) }} kata</span>
              </div>

              <!-- Duration in Seconds -->
              <div class="flex items-center gap-1.5">
                <span class="text-[11px] text-zinc-500 dark:text-neutral-400 font-mono">Durasi:</span>
                <input
                  v-model.number="card.duration"
                  type="number"
                  min="2"
                  max="120"
                  class="w-14 h-7 px-2 text-center text-xs font-mono font-semibold bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#28282D] rounded-md text-zinc-900 dark:text-white focus:outline-none"
                  title="Target durasi dalam detik"
                />
                <span class="text-[11px] font-mono text-zinc-400">detik</span>
                <button
                  type="button"
                  class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-200/60 dark:bg-[#28282D] text-zinc-700 dark:text-neutral-300 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                  title="Hitung durasi ideal otomatis berdasarkan jumlah kata"
                  @click="card.duration = autoCalculateDuration(card.text)"
                >
                  Auto
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Add Card Big Button -->
        <button
          type="button"
          class="w-full py-2.5 rounded-xl border border-dashed border-zinc-300 dark:border-[#2E2E2E] hover:border-zinc-400 dark:hover:border-[#3E3E3E] bg-zinc-50/50 dark:bg-[#141416] text-xs font-semibold text-zinc-600 dark:text-neutral-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          @click="addCard"
        >
          <Plus class="w-4 h-4" />
          <span>Tambah Kartu Catatan Baru</span>
        </button>

        <!-- Device Settings Modal / Dropdown -->
        <div class="p-3.5 rounded-xl border border-zinc-200 dark:border-[#28282D] bg-zinc-50/70 dark:bg-[#1B1B1E] space-y-2">
          <div class="flex items-center justify-between text-xs font-semibold text-zinc-900 dark:text-white">
            <span class="flex items-center gap-1.5">
              <Settings2 class="w-3.5 h-3.5 text-zinc-500" />
              <span>Perangkat Kamera & Audio</span>
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <!-- Camera Device -->
            <div>
              <label class="block text-[11px] font-mono text-zinc-500 dark:text-neutral-400 mb-1">Kamera</label>
              <select
                v-model="selectedVideoDevice"
                class="w-full h-8 px-2 bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#28282D] rounded-lg text-xs text-zinc-900 dark:text-white focus:outline-none cursor-pointer"
                @change="startCamera"
              >
                <option v-for="d in videoDevices" :key="d.deviceId" :value="d.deviceId">
                  {{ d.label || 'Kamera Utama' }}
                </option>
              </select>
            </div>

            <!-- Mic Device -->
            <div>
              <label class="block text-[11px] font-mono text-zinc-500 dark:text-neutral-400 mb-1">Mikrofon</label>
              <select
                v-model="selectedAudioDevice"
                class="w-full h-8 px-2 bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#28282D] rounded-lg text-xs text-zinc-900 dark:text-white focus:outline-none cursor-pointer"
                @change="startCamera"
              >
                <option v-for="d in audioDevices" :key="d.deviceId" :value="d.deviceId">
                  {{ d.label || 'Mikrofon Utama' }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
