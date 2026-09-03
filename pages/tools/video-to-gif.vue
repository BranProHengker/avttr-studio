<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  Film,
  Play,
  Pause,
  RotateCcw,
  Download,
  Upload,
  Copy,
  Check,
  Sparkles,
  Sliders,
  Scissors,
  Layers,
  Clock,
  FileVideo,
  Eye,
  Trash2,
  Maximize2,
  RefreshCw,
  Zap,
  ArrowRight
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

const toast = useToast()

// Video state
const videoFile = ref<File | null>(null)
const videoUrl = ref<string>('')
const videoElementRef = ref<HTMLVideoElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const totalDuration = ref(0)
const videoNaturalWidth = ref(0)
const videoNaturalHeight = ref(0)
const isLoopingSegment = ref(true)

// Trimmer range
const startTime = ref(0)
const endTime = ref(5)

// GIF Options
const fps = ref<number>(15)
const resolutionPreset = ref<'original' | '720p' | '480p' | '360p' | '240p'>('480p')
const playbackSpeed = ref<number>(1.0)

// Progress & Generation state
const isGenerating = ref(false)
const generationProgress = ref(0)
const statusMessage = ref('Preparing frames...')
const generatedGifUrl = ref<string>('')
const generatedGifSize = ref<number>(0)
const isCopied = ref(false)

// Sample video for 1-click test
const sampleVideoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'

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
  if (!file.type.startsWith('video/')) {
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

const loadSampleVideo = () => {
  videoFile.value = null
  videoUrl.value = sampleVideoUrl
  generatedGifUrl.value = ''
  toast.info('Sample Video Loaded', 'Ready to trim and convert to animated GIF')
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

  // Loop trimmed section if enabled
  if (isLoopingSegment.value && isPlaying.value) {
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
  vid.currentTime = Math.max(0, Math.min(sec, totalDuration.value))
  currentTime.value = vid.currentTime
}

const jumpToStart = () => {
  seekTo(startTime.value)
}

const jumpToEnd = () => {
  seekTo(endTime.value)
}

const resetTrim = () => {
  startTime.value = 0
  endTime.value = Math.min(totalDuration.value, 4)
  seekTo(0)
}

// Generate GIF using gifshot
const generateGif = async () => {
  if (!videoUrl.value) return

  if (clipDuration.value <= 0) {
    toast.error('Invalid Trim', 'End time must be greater than start time')
    return
  }

  if (clipDuration.value > 20) {
    toast.warning('Long Clip Warning', 'GIFs over 15 seconds can be very large. Consider trimming to < 10 seconds.')
  }

  isGenerating.value = true
  generationProgress.value = 0
  statusMessage.value = 'Initializing GIF encoder...'

  try {
    const gifshotModule = await import('gifshot')
    const gifshot = (gifshotModule as any).default || gifshotModule

    const { width, height } = targetDimensions.value
    const durationSec = clipDuration.value

    statusMessage.value = `Extracting frames (${fps.value} FPS)...`

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
            statusMessage.value = `Capturing video frames... ${generationProgress.value}%`
          } else if (captureProgress < 0.9) {
            statusMessage.value = `Quantizing 256-color palette... ${generationProgress.value}%`
          } else {
            statusMessage.value = `Assembling GIF89a animation... ${generationProgress.value}%`
          }
        },
      },
      (obj: any) => {
        isGenerating.value = false
        if (!obj.error) {
          generatedGifUrl.value = obj.image

          // Approximate size from base64 string
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
  toast.success('Downloaded', 'Animated GIF saved to your device')
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
    toast.success('Copied to Clipboard', 'You can now paste the GIF into Slack, Discord, or Figma!')
    setTimeout(() => { isCopied.value = false }, 2500)
  } catch {
    toast.error('Clipboard Error', 'Please use Download GIF button')
  }
}

// Cleanup object URLs on unmount
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
      <span class="text-white">Video to GIF Studio</span>
    </div>

    <!-- Header Row -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          Video to GIF Studio
        </h1>
        <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
          Convert MP4, WebM, and MOV video clips into crisp animated GIFs with client-side trimming, FPS control, and palette optimization.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="!videoUrl"
          type="button"
          class="px-3 py-1.5 rounded-lg bg-[#222226] hover:bg-[#2c2c32] border border-white/10 text-xs font-medium text-white transition-all cursor-pointer flex items-center gap-1.5"
          @click="loadSampleVideo"
        >
          <Sparkles class="w-3.5 h-3.5 text-amber-400" />
          <span>Try Sample Video</span>
        </button>

        <button
          v-else
          type="button"
          class="px-3 py-1.5 rounded-lg bg-[#222226] hover:bg-[#2c2c32] border border-white/10 text-xs font-medium text-white transition-all cursor-pointer flex items-center gap-1.5"
          @click="videoUrl = ''; generatedGifUrl = ''"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span>Upload Another Video</span>
        </button>
      </div>
    </div>

    <!-- State 1: Dropzone Upload Box (When no video loaded) -->
    <div
      v-if="!videoUrl"
      class="border-2 border-dashed border-[#2E2E2E] hover:border-white/40 rounded-[14px] p-10 sm:p-14 text-center transition-all bg-[var(--bg-card)] flex flex-col items-center justify-center space-y-4"
      @dragover.prevent
      @drop.prevent="(e) => e.dataTransfer?.files[0] && handleFileUpload(e.dataTransfer.files[0])"
    >
      <div class="w-16 h-16 rounded-2xl bg-[#222226] border border-white/10 flex items-center justify-center text-white/80 shadow-md">
        <Film class="w-8 h-8" />
      </div>

      <div class="space-y-1.5 max-w-md">
        <h3 class="text-base font-semibold text-white">
          Drop your video file here
        </h3>
        <p class="text-xs text-[var(--text-secondary)]">
          Supports MP4, WebM, and MOV up to 100MB. Processing happens 100% locally in your browser.
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
        <label class="cursor-pointer">
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/mov"
            class="hidden"
            @change="onFileInputChange"
          />
          <span class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors shadow-xs">
            <Upload class="w-4 h-4" />
            <span>Browse Video</span>
          </span>
        </label>

        <button
          type="button"
          class="px-4 py-2 rounded-lg bg-[#222226] hover:bg-[#2c2c32] border border-white/10 text-white font-medium text-xs transition-colors cursor-pointer flex items-center gap-2"
          @click="loadSampleVideo"
        >
          <Sparkles class="w-4 h-4 text-amber-400" />
          <span>Load Sample Video</span>
        </button>
      </div>
    </div>

    <!-- State 2: Active Video Trimmer & GIF Tuning Workspace -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left Column: Video Player & Dual Trimmer (7 cols) -->
      <div class="lg:col-span-7 space-y-4">
        <Card class="p-4 sm:p-5 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-4">
          <!-- Video Monitor Screen -->
          <div class="relative w-full aspect-video rounded-xl bg-black overflow-hidden border border-white/10 flex items-center justify-center group">
            <video
              ref="videoElementRef"
              :src="videoUrl"
              class="w-full h-full object-contain cursor-pointer"
              playsinline
              @click="togglePlayPause"
              @loadedmetadata="onVideoLoadedMetadata"
              @timeupdate="onVideoTimeUpdate"
            />

            <!-- Play / Pause Overlay Icon -->
            <button
              type="button"
              class="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              @click="togglePlayPause"
            >
              <div class="w-14 h-14 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-white backdrop-blur-xs shadow-xl">
                <Play v-if="!isPlaying" class="w-6 h-6 ml-0.5" />
                <Pause v-else class="w-6 h-6" />
              </div>
            </button>

            <!-- Current Timecode Indicator -->
            <div class="absolute bottom-2.5 left-3 px-2 py-0.5 rounded-md bg-black/80 border border-white/10 text-[11px] font-mono text-white backdrop-blur-xs">
              {{ formatTime(currentTime) }} / {{ formatTime(totalDuration) }}
            </div>

            <!-- Resolution Stamp -->
            <div class="absolute top-2.5 right-3 px-2 py-0.5 rounded-md bg-black/80 border border-white/10 text-[10px] font-mono text-neutral-400 backdrop-blur-xs">
              {{ videoNaturalWidth }}x{{ videoNaturalHeight }}
            </div>
          </div>

          <!-- Video Controls Toolbar -->
          <div class="flex items-center justify-between gap-2 pt-1 border-b border-[#262626] pb-3">
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                class="p-2 rounded-lg bg-[#222226] hover:bg-[#2c2c32] text-white cursor-pointer transition-colors"
                title="Play/Pause"
                @click="togglePlayPause"
              >
                <Play v-if="!isPlaying" class="w-4 h-4" />
                <Pause v-else class="w-4 h-4" />
              </button>

              <button
                type="button"
                class="px-2.5 py-1.5 rounded-lg bg-[#222226] hover:bg-[#2c2c32] text-xs font-mono text-neutral-300 hover:text-white cursor-pointer transition-colors"
                title="Jump to Start Trim"
                @click="jumpToStart"
              >
                Start: {{ formatTime(startTime) }}
              </button>

              <button
                type="button"
                class="px-2.5 py-1.5 rounded-lg bg-[#222226] hover:bg-[#2c2c32] text-xs font-mono text-neutral-300 hover:text-white cursor-pointer transition-colors"
                title="Jump to End Trim"
                @click="jumpToEnd"
              >
                End: {{ formatTime(endTime) }}
              </button>
            </div>

            <div class="flex items-center gap-2">
              <!-- Loop Segment Toggle -->
              <button
                type="button"
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer border"
                :class="isLoopingSegment ? 'bg-[#2E2E2E] border-white/20 text-white' : 'bg-transparent border-transparent text-neutral-400 hover:text-white'"
                @click="isLoopingSegment = !isLoopingSegment"
              >
                <RotateCcw class="w-3.5 h-3.5" />
                <span>Loop Segment</span>
              </button>

              <button
                type="button"
                class="p-1.5 text-neutral-500 hover:text-neutral-300 cursor-pointer"
                title="Reset Trim Range"
                @click="resetTrim"
              >
                <RefreshCw class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- Trimmer Scrubbers -->
          <div class="space-y-3 pt-1">
            <div class="flex items-center justify-between text-xs font-mono">
              <span class="text-neutral-400">Trim Interval</span>
              <span class="text-emerald-400 font-semibold">Clip Length: {{ clipDuration }}s ({{ estimatedFrames }} frames)</span>
            </div>

            <!-- Dual Range Sliders -->
            <div class="space-y-2">
              <div class="space-y-1">
                <div class="flex justify-between text-[11px] font-mono text-neutral-400">
                  <span>Start Cut:</span>
                  <span class="text-white">{{ formatTime(startTime) }}</span>
                </div>
                <input
                  v-model.number="startTime"
                  type="range"
                  :min="0"
                  :max="endTime - 0.2"
                  step="0.1"
                  class="w-full accent-white cursor-pointer"
                  @input="seekTo(startTime)"
                />
              </div>

              <div class="space-y-1">
                <div class="flex justify-between text-[11px] font-mono text-neutral-400">
                  <span>End Cut:</span>
                  <span class="text-white">{{ formatTime(endTime) }}</span>
                </div>
                <input
                  v-model.number="endTime"
                  type="range"
                  :min="startTime + 0.2"
                  :max="totalDuration || 10"
                  step="0.1"
                  class="w-full accent-white cursor-pointer"
                  @input="seekTo(endTime)"
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <!-- Right Column: GIF Tuning Deck & Render Action (5 cols) -->
      <div class="lg:col-span-5 space-y-4">
        <Card class="p-4 sm:p-5 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-5">
          <div class="flex items-center justify-between">
            <label class="text-xs font-semibold text-white uppercase tracking-wider block">
              GIF Output Configuration
            </label>
            <Badge variant="badge">GIF89a</Badge>
          </div>

          <!-- 1. Resolution Presets -->
          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs">
              <span class="text-[var(--text-secondary)] font-medium">Output Resolution</span>
              <span class="font-mono text-white text-[11px]">
                {{ targetDimensions.width }} × {{ targetDimensions.height }} px
              </span>
            </div>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                v-for="res in (['original', '720p', '480p', '360p', '240p'] as const)"
                :key="res"
                type="button"
                class="py-1.5 px-2 rounded-lg text-xs font-mono font-medium border transition-all cursor-pointer text-center"
                :class="resolutionPreset === res ? 'bg-white text-black font-bold border-white shadow-xs' : 'bg-[#141416] border-white/10 text-neutral-400 hover:text-white'"
                @click="resolutionPreset = res"
              >
                {{ res.toUpperCase() }}
              </button>
            </div>
          </div>

          <!-- 2. Frame Rate (FPS) Selector -->
          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs">
              <span class="text-[var(--text-secondary)] font-medium">Frame Rate (FPS)</span>
              <span class="font-mono text-white text-[11px]">{{ fps }} Frames / Sec</span>
            </div>
            <div class="grid grid-cols-4 gap-1.5">
              <button
                v-for="rate in [10, 15, 20, 24]"
                :key="rate"
                type="button"
                class="py-1.5 px-2 rounded-lg text-xs font-mono font-medium border transition-all cursor-pointer text-center"
                :class="fps === rate ? 'bg-white text-black font-bold border-white shadow-xs' : 'bg-[#141416] border-white/10 text-neutral-400 hover:text-white'"
                @click="fps = rate"
              >
                {{ rate }} FPS
              </button>
            </div>
          </div>

          <!-- 3. Playback Speed Multiplier -->
          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs">
              <span class="text-[var(--text-secondary)] font-medium">Speed Multiplier</span>
              <span class="font-mono text-white text-[11px]">{{ playbackSpeed }}x Speed</span>
            </div>
            <div class="grid grid-cols-5 gap-1">
              <button
                v-for="spd in [0.5, 0.75, 1.0, 1.25, 1.5]"
                :key="spd"
                type="button"
                class="py-1 px-1 rounded-md text-xs font-mono border transition-all cursor-pointer text-center"
                :class="playbackSpeed === spd ? 'bg-white text-black font-bold border-white' : 'bg-[#141416] border-white/10 text-neutral-400 hover:text-white'"
                @click="playbackSpeed = spd"
              >
                {{ spd }}x
              </button>
            </div>
          </div>

          <!-- Summary Metric Box -->
          <div class="p-3 rounded-xl bg-[#141416] border border-[#262626] space-y-1.5 text-xs font-mono">
            <div class="flex justify-between text-neutral-400">
              <span>Selected Segment:</span>
              <span class="text-white">{{ clipDuration }} seconds</span>
            </div>
            <div class="flex justify-between text-neutral-400">
              <span>Total GIF Frames:</span>
              <span class="text-white">{{ estimatedFrames }} frames</span>
            </div>
            <div class="flex justify-between text-neutral-400">
              <span>Dimensions:</span>
              <span class="text-white">{{ targetDimensions.width }} × {{ targetDimensions.height }}</span>
            </div>
          </div>

          <!-- Progress Bar (During Generation) -->
          <div v-if="isGenerating" class="space-y-2 pt-2">
            <div class="flex justify-between text-xs font-mono">
              <span class="text-amber-400">{{ statusMessage }}</span>
              <span class="text-white font-bold">{{ generationProgress }}%</span>
            </div>
            <div class="w-full h-2 bg-[#222226] rounded-full overflow-hidden">
              <div
                class="h-full bg-white transition-all duration-200"
                :style="{ width: `${generationProgress}%` }"
              />
            </div>
          </div>

          <!-- Generate Action Button -->
          <Button
            variant="primary"
            size="lg"
            class="w-full font-semibold shadow-xs"
            :disabled="isGenerating || clipDuration <= 0"
            :loading="isGenerating"
            @click="generateGif"
          >
            <Sparkles class="w-4 h-4 mr-2" />
            <span>{{ isGenerating ? 'Encoding Animated GIF...' : 'Generate Animated GIF' }}</span>
          </Button>
        </Card>

        <!-- Output Result Card (When GIF is ready) -->
        <Card
          v-if="generatedGifUrl"
          class="p-4 sm:p-5 bg-[var(--bg-card)] border border-emerald-500/30 space-y-4"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span class="text-xs font-semibold text-white uppercase tracking-wider">Ready for Export</span>
            </div>
            <span class="text-xs font-mono text-emerald-400 font-semibold">{{ formatBytes(generatedGifSize) }}</span>
          </div>

          <!-- Animated GIF Looping Preview -->
          <div class="w-full rounded-xl bg-black border border-white/10 overflow-hidden flex items-center justify-center p-2">
            <img
              :src="generatedGifUrl"
              alt="Generated Animated GIF"
              class="max-w-full max-h-64 object-contain rounded-lg shadow-lg"
            />
          </div>

          <!-- Action Buttons -->
          <div class="grid grid-cols-2 gap-2.5">
            <Button
              variant="primary"
              size="default"
              class="font-semibold"
              @click="downloadGif"
            >
              <Download class="w-4 h-4 mr-1.5" />
              <span>Download GIF</span>
            </Button>

            <Button
              variant="secondary"
              size="default"
              class="font-medium"
              @click="copyGifToClipboard"
            >
              <Check v-if="isCopied" class="w-4 h-4 mr-1.5 text-emerald-400" />
              <Copy v-else class="w-4 h-4 mr-1.5" />
              <span>{{ isCopied ? 'Copied!' : 'Copy GIF' }}</span>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
