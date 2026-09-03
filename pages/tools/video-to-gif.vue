<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import {
  Film,
  Play,
  Pause,
  RotateCcw,
  Download,
  Upload,
  Copy,
  Check,
  Clipboard,
  ArrowRight,
  Link as LinkIcon,
  FolderOpen
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

const toast = useToast()

// Source state
const videoFile = ref<File | null>(null)
const videoUrl = ref<string>('')
const videoElementRef = ref<HTMLVideoElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

// URL input state
const videoUrlInput = ref('')
const isFetchingUrl = ref(false)
const isDragging = ref(false)

// Playback state
const isPlaying = ref(false)
const currentTime = ref(0)
const totalDuration = ref(0)
const videoNaturalWidth = ref(0)
const videoNaturalHeight = ref(0)
const isLooping = ref(true)

// Trimmer range (in seconds)
const startTime = ref(0)
const endTime = ref(4)

// GIF Options
const fps = ref<number>(15)
const resolutionPreset = ref<'original' | '720p' | '480p' | '360p' | '240p'>('480p')
const playbackSpeed = ref<number>(1.0)

// Generation state
const isGenerating = ref(false)
const generationProgress = ref(0)
const statusMessage = ref('Preparing frames...')
const generatedGifUrl = ref<string>('')
const generatedGifSize = ref<number>(0)
const isCopied = ref(false)

const clipDuration = computed(() => {
  const d = Math.max(0, endTime.value - startTime.value)
  return Math.round(d * 10) / 10
})

const estimatedFrames = computed(() => {
  return Math.round(clipDuration.value * fps.value)
})

// Calculate target dimensions
const targetDimensions = computed(() => {
  const nw = videoNaturalWidth.value || 640
  const nh = videoNaturalHeight.value || 360
  const aspect = nw / nh

  switch (resolutionPreset.value) {
    case '720p': {
      const h = 720
      return { width: Math.round(h * aspect), height: h }
    }
    case '480p': {
      const h = 480
      return { width: Math.round(h * aspect), height: h }
    }
    case '360p': {
      const h = 360
      return { width: Math.round(h * aspect), height: h }
    }
    case '240p': {
      const h = 240
      return { width: Math.round(h * aspect), height: h }
    }
    case 'original':
    default:
      return { width: nw, height: nh }
  }
})

// Format seconds to mm:ss.s
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(1)
  return `${mins}:${Number(secs) < 10 ? '0' : ''}${secs}`
}

const formatBytes = (bytes: number): string => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// Handle file upload
const handleFileUpload = (file: File) => {
  if (!file.type.startsWith('video/') && !/\.(mp4|webm|mov|mkv|avi)$/i.test(file.name)) {
    toast.error('Invalid File', 'Please select a valid MP4, WebM, or MOV video file')
    return
  }

  if (videoUrl.value && videoUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(videoUrl.value)
  }

  videoFile.value = file
  videoUrl.value = URL.createObjectURL(file)
  generatedGifUrl.value = ''
  toast.success('Video Loaded', file.name)
}

const onFileInputChange = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input.files && input.files[0]) {
    handleFileUpload(input.files[0])
  }
}

// Fetch Video from URL (Supports direct MP4/WebM URLs and Social Media posts e.g. Twitter/X, TikTok)
const fetchVideoFromUrl = async () => {
  const inputUrl = videoUrlInput.value.trim()
  if (!inputUrl) return

  isFetchingUrl.value = true
  try {
    let directMediaUrl = inputUrl

    // 1. If it's a social media post (X/Twitter, TikTok, Instagram, YouTube, Tenor, etc.), resolve video first
    const isPlatformUrl = /(?:twitter\.com|x\.com|tiktok\.com|instagram\.com|youtube\.com|youtu\.be|facebook\.com|fb\.watch|tenor\.com|giphy\.com)/i.test(inputUrl)
    if (isPlatformUrl) {
      toast.info('Resolving Link', 'Extracting video from platform...')
      const resolveRes = await $fetch<any>('/api/download/resolve', {
        method: 'POST',
        body: { url: inputUrl },
      })

      if (resolveRes && resolveRes.success && resolveRes.medias?.length > 0) {
        const foundVid = resolveRes.medias.find((m: any) => m.type === 'video') || resolveRes.medias[0]
        if (foundVid && foundVid.url) {
          directMediaUrl = foundVid.url
          toast.success('Video Found', resolveRes.title || 'Platform video resolved')
        } else {
          throw new Error('No video found in this post')
        }
      } else {
        throw new Error(resolveRes?.error || 'Could not extract video from link')
      }
    }

    // 2. Fetch the video blob (try direct fetch, fallback to proxy if CORS-blocked)
    let response: Response | null = null
    try {
      response = await fetch(directMediaUrl, { mode: 'cors' })
      if (!response.ok) response = null
    } catch {
      response = null
    }

    if (!response || !response.ok) {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(directMediaUrl)}`
      response = await fetch(proxyUrl)
    }

    if (!response || !response.ok) throw new Error('Could not download video stream')

    const blob = await response.blob()
    const rawName = directMediaUrl.split('/').pop()?.split('?')[0] || `video_${Date.now()}.mp4`
    const filename = rawName.includes('.') ? rawName : `${rawName}.mp4`
    const file = new File([blob], filename, { type: blob.type || 'video/mp4' })

    handleFileUpload(file)
    videoUrlInput.value = ''
  } catch (err: any) {
    toast.error('Fetch Failed', err.message || 'Unable to fetch video from URL. Check if link is public.')
  } finally {
    isFetchingUrl.value = false
  }
}

// Paste from Clipboard Button Handler
const pasteFromClipboard = async () => {
  try {
    const text = await navigator.clipboard.readText()
    if (text && text.trim()) {
      videoUrlInput.value = text.trim()
      toast.info('Pasted from Clipboard', text.trim().slice(0, 40) + '...')
      fetchVideoFromUrl()
    } else {
      toast.warning('Clipboard Empty', 'No URL found in clipboard')
    }
  } catch {
    toast.error('Clipboard Access', 'Use Ctrl+V / ⌘V to paste directly')
  }
}

// Video player events
const onVideoLoadedMetadata = () => {
  const vid = videoElementRef.value
  if (!vid) return
  totalDuration.value = vid.duration || 0
  videoNaturalWidth.value = vid.videoWidth || 640
  videoNaturalHeight.value = vid.videoHeight || 360

  startTime.value = 0
  endTime.value = Math.min(vid.duration, 4)
  currentTime.value = 0
}

const onVideoTimeUpdate = () => {
  const vid = videoElementRef.value
  if (!vid) return
  currentTime.value = vid.currentTime

  if (isLooping.value && isPlaying.value) {
    if (vid.currentTime >= endTime.value) {
      vid.currentTime = startTime.value
      vid.play()
    }
  }
}

const togglePlayPause = () => {
  const vid = videoElementRef.value
  if (!vid) return
  if (vid.paused) {
    if (vid.currentTime >= endTime.value || vid.currentTime < startTime.value) {
      vid.currentTime = startTime.value
    }
    vid.play()
    isPlaying.value = true
  } else {
    vid.pause()
    isPlaying.value = false
  }
}

const seekTo = (sec: number) => {
  const vid = videoElementRef.value
  if (!vid) return
  const safeSec = Math.max(0, Math.min(sec, totalDuration.value || 60))
  vid.currentTime = safeSec
  currentTime.value = safeSec
}

// Set start / end to current playback position
const setStartToCurrent = () => {
  const t = Math.round(currentTime.value * 10) / 10
  if (t < endTime.value) {
    startTime.value = t
    toast.info('Start Cut Updated', `${t}s`)
  } else {
    toast.warning('Invalid Range', 'Start cut must be before End cut')
  }
}

const setEndToCurrent = () => {
  const t = Math.round(currentTime.value * 10) / 10
  if (t > startTime.value) {
    endTime.value = t
    toast.info('End Cut Updated', `${t}s`)
  } else {
    toast.warning('Invalid Range', 'End cut must be after Start cut')
  }
}

// Number input handlers with safety clamping
const updateStartTime = (val: number) => {
  if (isNaN(val)) return
  const rounded = Math.round(val * 10) / 10
  if (rounded >= 0 && rounded < endTime.value) {
    startTime.value = rounded
    seekTo(rounded)
  }
}

const updateEndTime = (val: number) => {
  if (isNaN(val)) return
  const rounded = Math.round(val * 10) / 10
  const max = totalDuration.value || 60
  if (rounded > startTime.value && rounded <= max) {
    endTime.value = rounded
    seekTo(rounded)
  }
}

const resetTrim = () => {
  startTime.value = 0
  endTime.value = Math.min(totalDuration.value || 4, 4)
  seekTo(0)
}

// Generate GIF using gifshot
const generateGif = async () => {
  if (!videoUrl.value) return

  if (clipDuration.value <= 0) {
    toast.error('Invalid Trim', 'End time must be greater than start time')
    return
  }

  isGenerating.value = true
  generationProgress.value = 0
  statusMessage.value = 'Initializing GIF encoder...'

  try {
    const gifshotModule = await import('gifshot')
    const gifshot = (gifshotModule as any).default || gifshotModule

    const { width, height } = targetDimensions.value
    const durationSec = clipDuration.value

    statusMessage.value = `Capturing frames (${fps.value} FPS)...`

    gifshot.createGIF(
      {
        video: [videoUrl.value],
        numFrames: estimatedFrames.value,
        interval: (1 / fps.value) * (1 / playbackSpeed.value),
        offset: startTime.value,
        duration: durationSec,
        gifWidth: width,
        gifHeight: height,
        progressCallback: (captureProgress: number) => {
          generationProgress.value = Math.round(captureProgress * 100)
          if (captureProgress < 0.6) {
            statusMessage.value = `Capturing frames... ${generationProgress.value}%`
          } else if (captureProgress < 0.9) {
            statusMessage.value = `Quantizing palette... ${generationProgress.value}%`
          } else {
            statusMessage.value = `Encoding GIF89a... ${generationProgress.value}%`
          }
        },
      },
      (obj: any) => {
        isGenerating.value = false
        if (!obj.error) {
          generatedGifUrl.value = obj.image

          const base64Str = obj.image.split(',')[1] || ''
          generatedGifSize.value = Math.round((base64Str.length * 3) / 4)

          toast.success('GIF Ready', `Converted ${clipDuration.value}s clip to animated GIF!`)
        } else {
          toast.error('Conversion Failed', obj.errorCode || 'Could not generate GIF')
        }
      }
    )
  } catch (err: any) {
    isGenerating.value = false
    toast.error('Encoder Error', err?.message || 'Failed to load gifshot module')
  }
}

// Download GIF
const downloadGif = () => {
  if (!generatedGifUrl.value) return
  const a = document.createElement('a')
  a.href = generatedGifUrl.value
  const baseName = videoFile.value?.name.replace(/\.[^/.]+$/, '') || 'avttr_clip'
  a.download = `${baseName}_${targetDimensions.value.width}x${targetDimensions.value.height}_${fps.value}fps.gif`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  toast.success('Downloaded', 'Animated GIF saved to device')
}

// Copy GIF to clipboard
const copyGifToClipboard = async () => {
  if (!generatedGifUrl.value) return
  try {
    const res = await fetch(generatedGifUrl.value)
    const blob = await res.blob()
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/gif': blob })
    ])
    isCopied.value = true
    toast.success('Copied to Clipboard', 'Ready to paste into Slack, Discord, or Figma!')
    setTimeout(() => { isCopied.value = false }, 2500)
  } catch {
    toast.error('Clipboard Error', 'Please use Download GIF button')
  }
}

onUnmounted(() => {
  if (videoUrl.value && videoUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(videoUrl.value)
  }
})
</script>

<template>
  <div class="space-y-6 pb-12 w-full">
    <!-- Breadcrumb -->
    <div class="flex items-center gap-2 text-xs font-mono text-[var(--text-tertiary)]">
      <NuxtLink to="/" class="hover:text-white transition-colors">Dashboard</NuxtLink>
      <span>/</span>
      <span>Tools</span>
      <span>/</span>
      <span class="text-white">Video to GIF</span>
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
          Video to GIF
        </h1>
        <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
          Trim video clips and convert into animated GIFs with FPS and resolution controls.
        </p>
      </div>

      <div v-if="videoUrl" class="flex items-center gap-2 shrink-0">
        <Button
          variant="secondary"
          size="default"
          class="h-9 px-3.5 rounded-lg text-xs font-medium cursor-pointer"
          @click="fileInputRef?.click()"
        >
          <FolderOpen class="w-3.5 h-3.5 mr-1.5 text-white/70" />
          <span>Change Video</span>
        </Button>
      </div>
    </div>

    <!-- State 1: Upload Stage (When No Video Loaded) -->
    <div v-if="!videoUrl" class="space-y-4">
      <!-- URL Input Omnibox -->
      <div class="flex flex-col sm:flex-row items-center gap-2.5">
        <div class="relative w-full flex-1 flex items-center">
          <LinkIcon class="w-4 h-4 text-[var(--text-tertiary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            v-model="videoUrlInput"
            type="url"
            placeholder="Paste direct video URL, Twitter/X post, or social link..."
            class="w-full h-11 pl-10 pr-10 bg-[#171717] hover:bg-[#1a1a1c] border border-[#2E2E2E] focus:border-white/40 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-xl text-xs font-mono transition-all focus:outline-none focus:ring-2 focus:ring-white/10"
            @keydown.enter="fetchVideoFromUrl"
          />
          <button
            type="button"
            class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
            @click="pasteFromClipboard"
            title="Paste from clipboard"
          >
            <Clipboard class="w-4 h-4" />
          </button>
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
          <span>Fetch Video</span>
        </Button>
      </div>

      <!-- Dropzone -->
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
              Drop your video file here or browse
            </h3>
            <p class="text-xs text-[var(--text-secondary)] mt-1">
              Supports MP4, WebM, MOV, and AVI up to 100MB. 100% processed client-side.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- State 2: Clean, Unified Video to GIF Studio -->
    <div v-else class="space-y-5">
      <!-- Video Monitor Player Box -->
      <div class="rounded-xl bg-[#141416] border border-[#262626] p-3 sm:p-4 space-y-3">
        <!-- Video Screen Container -->
        <div class="relative w-full rounded-lg bg-black overflow-hidden border border-white/10 flex items-center justify-center max-h-[420px] aspect-video">
          <video
            ref="videoElementRef"
            :src="videoUrl"
            crossorigin="anonymous"
            class="w-full h-full object-contain cursor-pointer"
            playsinline
            @click="togglePlayPause"
            @loadedmetadata="onVideoLoadedMetadata"
            @timeupdate="onVideoTimeUpdate"
          />

          <!-- Play/Pause Click Overlay -->
          <button
            type="button"
            class="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            @click="togglePlayPause"
          >
            <div class="w-12 h-12 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-white backdrop-blur-xs shadow-lg">
              <Play v-if="!isPlaying" class="w-5 h-5 ml-0.5" />
              <Pause v-else class="w-5 h-5" />
            </div>
          </button>

          <!-- Current Time Indicator -->
          <div class="absolute bottom-2.5 left-3 px-2 py-0.5 rounded-md bg-black/80 border border-white/10 text-[11px] font-mono text-white backdrop-blur-xs">
            {{ formatTime(currentTime) }} / {{ formatTime(totalDuration) }}
          </div>

          <!-- Video Specs -->
          <div class="absolute top-2.5 right-3 px-2 py-0.5 rounded-md bg-black/80 border border-white/10 text-[10px] font-mono text-neutral-400 backdrop-blur-xs">
            {{ videoNaturalWidth }}×{{ videoNaturalHeight }}
          </div>
        </div>

        <!-- Video Scrub Track -->
        <div class="flex items-center gap-3 pt-1">
          <button
            type="button"
            class="w-9 h-9 rounded-lg bg-[#222226] hover:bg-[#2c2c32] text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
            @click="togglePlayPause"
          >
            <Pause v-if="isPlaying" class="w-4 h-4 fill-current" />
            <Play v-else class="w-4 h-4 fill-current ml-0.5" />
          </button>

          <input
            type="range"
            min="0"
            :max="totalDuration || 60"
            step="0.05"
            :value="currentTime"
            class="flex-1 accent-white cursor-pointer"
            @input="(e) => seekTo(Number((e.target as HTMLInputElement).value))"
          />

          <button
            type="button"
            class="p-2 rounded-lg border text-xs font-mono transition-colors cursor-pointer shrink-0"
            :class="isLooping ? 'bg-[#2E2E2E] border-white/20 text-white' : 'bg-[#18181b] border-transparent text-neutral-400 hover:text-white'"
            title="Toggle Segment Loop"
            @click="isLooping = !isLooping"
          >
            <RotateCcw class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- Clean Trim Controls (With Sliders + Number Inputs) -->
      <div class="rounded-xl bg-[#141416] border border-[#262626] p-4 sm:p-5 space-y-4">
        <div class="flex items-center justify-between border-b border-[#262626] pb-3">
          <div class="flex items-center gap-2">
            <span class="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Trim Range
            </span>
            <span class="px-2 py-0.5 rounded-full text-[11px] font-mono bg-[#222226] text-white border border-white/10">
              Duration: {{ clipDuration }}s ({{ estimatedFrames }} frames)
            </span>
          </div>

          <button
            type="button"
            class="text-xs font-mono text-neutral-400 hover:text-white cursor-pointer flex items-center gap-1 transition-colors"
            @click="resetTrim"
          >
            <RotateCcw class="w-3.5 h-3.5" />
            <span>Reset Range</span>
          </button>
        </div>

        <!-- Two Columns: Start Cut & End Cut with Range + Number Input -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Start Cut -->
          <div class="p-3.5 rounded-lg bg-[#18181b] border border-white/5 space-y-2.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-mono text-[var(--text-secondary)]">Start Cut</label>
              <div class="flex items-center gap-1.5">
                <!-- Number Input for Precise Seconds -->
                <div class="flex items-center gap-1">
                  <input
                    :value="startTime"
                    type="number"
                    min="0"
                    :max="Math.max(0, endTime - 0.1)"
                    step="0.1"
                    class="w-20 h-7.5 px-2 bg-[#121214] border border-[#2E2E2E] focus:border-white/40 text-white font-mono text-xs rounded-md text-center focus:outline-none"
                    @change="(e) => updateStartTime(Number((e.target as HTMLInputElement).value))"
                  />
                  <span class="text-xs font-mono text-neutral-500">sec</span>
                </div>

                <!-- Quick Button to Set to Current Playhead -->
                <button
                  type="button"
                  class="px-2 py-1 rounded bg-[#252528] hover:bg-[#303034] text-[11px] font-mono text-white/80 hover:text-white border border-white/10 cursor-pointer transition-colors"
                  title="Set Start Cut to current playhead"
                  @click="setStartToCurrent"
                >
                  Set Current
                </button>
              </div>
            </div>

            <!-- Start Range Slider -->
            <input
              v-model.number="startTime"
              type="range"
              min="0"
              :max="Math.max(0, endTime - 0.1)"
              step="0.1"
              class="w-full accent-white cursor-pointer"
              @input="seekTo(startTime)"
            />
          </div>

          <!-- End Cut -->
          <div class="p-3.5 rounded-lg bg-[#18181b] border border-white/5 space-y-2.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-mono text-[var(--text-secondary)]">End Cut</label>
              <div class="flex items-center gap-1.5">
                <!-- Number Input for Precise Seconds -->
                <div class="flex items-center gap-1">
                  <input
                    :value="endTime"
                    type="number"
                    :min="startTime + 0.1"
                    :max="totalDuration || 60"
                    step="0.1"
                    class="w-20 h-7.5 px-2 bg-[#121214] border border-[#2E2E2E] focus:border-white/40 text-white font-mono text-xs rounded-md text-center focus:outline-none"
                    @change="(e) => updateEndTime(Number((e.target as HTMLInputElement).value))"
                  />
                  <span class="text-xs font-mono text-neutral-500">sec</span>
                </div>

                <!-- Quick Button to Set to Current Playhead -->
                <button
                  type="button"
                  class="px-2 py-1 rounded bg-[#252528] hover:bg-[#303034] text-[11px] font-mono text-white/80 hover:text-white border border-white/10 cursor-pointer transition-colors"
                  title="Set End Cut to current playhead"
                  @click="setEndToCurrent"
                >
                  Set Current
                </button>
              </div>
            </div>

            <!-- End Range Slider -->
            <input
              v-model.number="endTime"
              type="range"
              :min="startTime + 0.1"
              :max="totalDuration || 60"
              step="0.1"
              class="w-full accent-white cursor-pointer"
              @input="seekTo(endTime)"
            />
          </div>
        </div>
      </div>

      <!-- GIF Format & Resolution Settings (Clean Compact Grid) -->
      <div class="rounded-xl bg-[#141416] border border-[#262626] p-4 sm:p-5 space-y-4">
        <div class="flex items-center justify-between border-b border-[#262626] pb-3">
          <span class="text-xs font-mono font-bold text-white uppercase tracking-wider">
            GIF Export Settings
          </span>
          <span class="text-xs font-mono text-[var(--text-tertiary)]">
            Output: {{ targetDimensions.width }}×{{ targetDimensions.height }}px
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <!-- 1. Resolution -->
          <div class="space-y-2">
            <label class="text-xs font-mono text-[var(--text-secondary)] block">Resolution</label>
            <div class="grid grid-cols-3 gap-1">
              <button
                v-for="res in (['original', '720p', '480p', '360p', '240p'] as const)"
                :key="res"
                type="button"
                class="py-1.5 px-2 rounded-lg text-xs font-mono border transition-all cursor-pointer text-center"
                :class="resolutionPreset === res ? 'bg-white text-black font-bold border-white shadow-xs' : 'bg-[#18181b] border-white/10 text-neutral-400 hover:text-white'"
                @click="resolutionPreset = res"
              >
                {{ res.toUpperCase() }}
              </button>
            </div>
          </div>

          <!-- 2. FPS -->
          <div class="space-y-2">
            <label class="text-xs font-mono text-[var(--text-secondary)] block">Frame Rate (FPS)</label>
            <div class="grid grid-cols-4 gap-1">
              <button
                v-for="rate in [10, 15, 20, 24]"
                :key="rate"
                type="button"
                class="py-1.5 px-2 rounded-lg text-xs font-mono border transition-all cursor-pointer text-center"
                :class="fps === rate ? 'bg-white text-black font-bold border-white shadow-xs' : 'bg-[#18181b] border-white/10 text-neutral-400 hover:text-white'"
                @click="fps = rate"
              >
                {{ rate }}
              </button>
            </div>
          </div>

          <!-- 3. Speed -->
          <div class="space-y-2">
            <label class="text-xs font-mono text-[var(--text-secondary)] block">Speed</label>
            <div class="grid grid-cols-5 gap-1">
              <button
                v-for="spd in [0.5, 0.75, 1.0, 1.25, 1.5]"
                :key="spd"
                type="button"
                class="py-1.5 px-1 rounded-lg text-xs font-mono border transition-all cursor-pointer text-center"
                :class="playbackSpeed === spd ? 'bg-white text-black font-bold border-white shadow-xs' : 'bg-[#18181b] border-white/10 text-neutral-400 hover:text-white'"
                @click="playbackSpeed = spd"
              >
                {{ spd }}x
              </button>
            </div>
          </div>
        </div>

        <!-- Encoding Progress Bar -->
        <div v-if="isGenerating" class="space-y-2 pt-2 border-t border-[#262626]">
          <div class="flex justify-between text-xs font-mono">
            <span class="text-white/80">{{ statusMessage }}</span>
            <span class="text-white font-bold">{{ generationProgress }}%</span>
          </div>
          <div class="w-full h-1.5 bg-[#222226] rounded-full overflow-hidden">
            <div
              class="h-full bg-white transition-all duration-200"
              :style="{ width: `${generationProgress}%` }"
            />
          </div>
        </div>

        <!-- Action Button (Matching user's preferred secondary arrow style) -->
        <div v-if="!generatedGifUrl" class="pt-2">
          <Button
            variant="secondary"
            size="default"
            class="w-full h-11 rounded-xl font-medium text-xs sm:text-sm cursor-pointer"
            :disabled="isGenerating || clipDuration <= 0"
            :loading="isGenerating"
            @click="generateGif"
          >
            <ArrowRight class="w-3.5 h-3.5 mr-1.5" />
            <span>{{ isGenerating ? 'Encoding GIF...' : 'Generate GIF' }}</span>
          </Button>
        </div>

        <!-- Rendered Output Card -->
        <div v-else class="p-4 rounded-xl bg-[#18181b] border border-white/15 space-y-3 pt-3">
          <div class="flex items-center justify-between text-xs font-mono">
            <span class="text-white font-semibold">GIF Ready</span>
            <span class="text-[var(--text-tertiary)]">{{ formatBytes(generatedGifSize) }}</span>
          </div>

          <div class="w-full rounded-lg bg-black border border-white/10 overflow-hidden flex items-center justify-center p-2 max-h-56">
            <img
              :src="generatedGifUrl"
              alt="Generated GIF"
              class="max-w-full max-h-52 object-contain rounded"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="default"
              class="h-10 rounded-xl font-medium text-xs cursor-pointer"
              @click="downloadGif"
            >
              <Download class="w-3.5 h-3.5 mr-1.5" />
              <span>Download GIF</span>
            </Button>
            <Button
              variant="secondary"
              size="default"
              class="h-10 rounded-xl font-medium text-xs cursor-pointer"
              @click="copyGifToClipboard"
            >
              <Check v-if="isCopied" class="w-3.5 h-3.5 mr-1.5 text-white" />
              <Copy v-else class="w-3.5 h-3.5 mr-1.5" />
              <span>{{ isCopied ? 'Copied' : 'Copy GIF' }}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
