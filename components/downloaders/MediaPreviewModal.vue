<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Music } from 'lucide-vue-next'
import type { ScraperResult, MediaItem } from '~/types'
import { useDownloader } from '~/composables/useDownloader'
import { useClipboard } from '~/composables/useClipboard'
import { useZip } from '~/composables/useZip'
import Modal from '~/components/ui/Modal.vue'
import Button from '~/components/ui/Button.vue'
import BrandIcon from '~/components/ui/BrandIcon.vue'

interface Props {
  modelValue: boolean
  result: ScraperResult | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const { downloadMediaItem, getProxiedUrl } = useDownloader()
const { copy } = useClipboard()
const { downloadAsZip, isZipping, zipProgress } = useZip()

const selectedMediaIndex = ref(0)

const activeMedia = computed<MediaItem | null>(() => {
  if (!props.result || props.result.medias.length === 0) return null
  return props.result.medias[selectedMediaIndex.value] || props.result.medias[0]
})

const videoMedias = computed(() => {
  return props.result?.medias.filter((m) => m.type === 'video') || []
})

const audioMedias = computed(() => {
  return props.result?.medias.filter((m) => m.type === 'audio') || []
})

const imageMedias = computed(() => {
  return props.result?.medias.filter((m) => m.type === 'image') || []
})

const isCarousel = computed(() => {
  return imageMedias.value.length > 1
})

// Custom Audio Player State
const audioPlayerRef = ref<HTMLAudioElement | null>(null)
const isAudioPlaying = ref(false)
const audioCurrentTime = ref(0)
const audioDuration = ref(0)
const isAudioMuted = ref(false)

const toggleAudioPlay = () => {
  if (!audioPlayerRef.value) return
  if (isAudioPlaying.value) {
    audioPlayerRef.value.pause()
  } else {
    audioPlayerRef.value.play().catch(() => {})
  }
}

const onAudioTimeUpdate = () => {
  if (!audioPlayerRef.value) return
  audioCurrentTime.value = audioPlayerRef.value.currentTime
}

const onAudioLoadedMetadata = () => {
  if (!audioPlayerRef.value) return
  audioDuration.value = audioPlayerRef.value.duration || 30
}

const onAudioSeek = (e: Event) => {
  const target = e.target as HTMLInputElement
  const time = parseFloat(target.value)
  if (audioPlayerRef.value) {
    audioPlayerRef.value.currentTime = time
    audioCurrentTime.value = time
  }
}

const toggleAudioMute = () => {
  if (!audioPlayerRef.value) return
  isAudioMuted.value = !isAudioMuted.value
  audioPlayerRef.value.muted = isAudioMuted.value
}

const seekRelative = (offset: number) => {
  if (!audioPlayerRef.value) return
  const max = audioDuration.value || 30
  audioPlayerRef.value.currentTime = Math.max(0, Math.min(max, audioPlayerRef.value.currentTime + offset))
}

const formatTime = (sec: number) => {
  if (!sec || isNaN(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

watch(
  () => props.modelValue,
  (val) => {
    if (!val && audioPlayerRef.value) {
      audioPlayerRef.value.pause()
      isAudioPlaying.value = false
      audioCurrentTime.value = 0
    }
  }
)
</script>

<template>
  <Modal
    :model-value="modelValue"
    max-width="2xl"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="flex items-center gap-2.5 min-w-0">
        <BrandIcon v-if="result?.platform" :name="result.platform" :size="20" class="shrink-0" />
        <h3 class="text-sm font-semibold text-[var(--text-primary)] truncate max-w-md">
          {{ result?.title || 'Media Download Options' }}
        </h3>
      </div>
    </template>

    <div v-if="result" class="space-y-5">
      <!-- Media Player / Preview Banner -->
      <div class="rounded-xl overflow-hidden bg-black/90 border border-[var(--border-subtle)] flex items-center justify-center relative min-h-[200px] max-h-[380px]">
        <!-- Image Carousel or Single Image -->
        <div v-if="activeMedia?.type === 'image' || isCarousel" class="relative w-full h-[300px] sm:h-[340px] flex items-center justify-center bg-black/60">
          <img
            :src="activeMedia?.url || imageMedias[selectedMediaIndex]?.url || result.thumbnail"
            :alt="result.title"
            loading="lazy"
            decoding="async"
            class="max-h-full max-w-full object-contain"
          />

          <!-- Carousel Controls -->
          <div v-if="isCarousel" class="absolute bottom-3 inset-x-0 flex items-center justify-center gap-2">
            <button
              v-for="(_, idx) in imageMedias"
              :key="idx"
              type="button"
              class="w-2 h-2 rounded-full transition-all cursor-pointer"
              :class="idx === selectedMediaIndex ? 'bg-white w-5' : 'bg-white/40 hover:bg-white/70'"
              @click="selectedMediaIndex = idx"
            />
          </div>
        </div>

        <!-- Video Player Preview -->
        <div v-else-if="activeMedia?.type === 'video'" class="relative w-full h-[280px] sm:h-[340px] flex items-center justify-center bg-black">
          <video
            v-if="activeMedia.url"
            :key="activeMedia.url"
            :src="getProxiedUrl(activeMedia)"
            :poster="result.thumbnail"
            controls
            playsinline
            preload="metadata"
            class="w-full h-full max-h-[340px] object-contain"
          />
        </div>

        <!-- Audio Interactive Player with Timeline & Controls -->
        <div v-else-if="activeMedia?.type === 'audio'" class="w-full p-6 flex flex-col items-center justify-center gap-5 bg-[var(--bg-card)]">
          <!-- Hidden Audio Element -->
          <audio
            v-if="activeMedia.url"
            ref="audioPlayerRef"
            :src="getProxiedUrl(activeMedia)"
            preload="metadata"
            @play="isAudioPlaying = true"
            @pause="isAudioPlaying = false"
            @timeupdate="onAudioTimeUpdate"
            @loadedmetadata="onAudioLoadedMetadata"
            @ended="isAudioPlaying = false"
          />

          <!-- Album Artwork with Equalizer Overlay -->
          <div class="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border border-[var(--border-subtle)] shadow-2xl shrink-0 group">
            <img
              v-if="result.thumbnail"
              :src="result.thumbnail"
              :alt="result.title"
              class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              decoding="async"
            />
            <div v-else class="w-full h-full bg-[#1E1E22] flex items-center justify-center text-[var(--text-secondary)]">
              <Music class="w-10 h-10" />
            </div>

            <!-- Playing Equalizer Animation Overlay -->
            <div v-if="isAudioPlaying" class="absolute bottom-2 right-2 flex items-end gap-0.5 px-2 py-1 bg-black/75 backdrop-blur-md rounded-md">
              <span class="w-1 bg-white animate-[pulse_1s_infinite_100ms] h-3 rounded-full"></span>
              <span class="w-1 bg-white animate-[pulse_1s_infinite_300ms] h-5 rounded-full"></span>
              <span class="w-1 bg-white animate-[pulse_1s_infinite_200ms] h-2 rounded-full"></span>
              <span class="w-1 bg-white animate-[pulse_1s_infinite_400ms] h-4 rounded-full"></span>
            </div>
          </div>

          <!-- Track Title & Artist -->
          <div class="text-center space-y-0.5 max-w-md px-4">
            <h3 class="text-sm font-bold text-[var(--text-primary)] truncate">
              {{ result.title || 'Audio Track' }}
            </h3>
            <p class="text-xs text-[var(--text-secondary)] font-mono">
              {{ result.author?.name || 'Spotify Track' }}
            </p>
          </div>

          <!-- Interactive Timeline Scrubber -->
          <div class="w-full max-w-md space-y-1.5 px-2">
            <div class="relative w-full flex items-center">
              <input
                type="range"
                min="0"
                :max="audioDuration || 30"
                step="0.1"
                :value="audioCurrentTime"
                @input="onAudioSeek"
                class="w-full h-1.5 bg-[#2E2E2E] rounded-lg appearance-none cursor-pointer accent-white hover:h-2 transition-all"
              />
            </div>

            <!-- Time Counters -->
            <div class="flex items-center justify-between text-[11px] font-mono text-[var(--text-tertiary)]">
              <span>{{ formatTime(audioCurrentTime) }}</span>
              <span>{{ formatTime(audioDuration || 30) }}</span>
            </div>
          </div>

          <!-- Control Buttons -->
          <div class="flex items-center justify-center gap-4">
            <button
              type="button"
              class="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[#2E2E2E] transition-all cursor-pointer"
              title="Rewind 10s"
              @click="seekRelative(-10)"
            >
              <RotateCcw class="w-4 h-4" />
            </button>

            <button
              type="button"
              class="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer"
              @click="toggleAudioPlay"
            >
              <Pause v-if="isAudioPlaying" class="w-5 h-5 fill-current" />
              <Play v-else class="w-5 h-5 fill-current translate-x-0.5" />
            </button>

            <button
              type="button"
              class="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[#2E2E2E] transition-all cursor-pointer"
              title="Forward 10s"
              @click="seekRelative(10)"
            >
              <RotateCw class="w-4 h-4" />
            </button>

            <button
              type="button"
              class="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[#2E2E2E] transition-all cursor-pointer ml-1"
              :title="isAudioMuted ? 'Unmute' : 'Mute'"
              @click="toggleAudioMute"
            >
              <VolumeX v-if="isAudioMuted" class="w-4 h-4" />
              <Volume2 v-else class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Fallback Single Thumbnail Preview -->
        <div v-else-if="result.thumbnail" class="relative w-full h-[260px] sm:h-[320px] flex items-center justify-center bg-black">
          <img
            :src="result.thumbnail"
            :alt="result.title"
            loading="lazy"
            decoding="async"
            class="w-full h-full object-contain"
          />
        </div>
      </div>

      <!-- Author Information & Description -->
      <div class="flex items-start justify-between gap-4 p-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl">
        <div class="flex items-center gap-3">
          <div v-if="result.author?.avatar" class="w-10 h-10 rounded-full overflow-hidden border border-[var(--border-subtle)] shrink-0">
            <img :src="result.author.avatar" :alt="result.author.name" loading="lazy" decoding="async" class="w-full h-full object-cover" />
          </div>
          <div v-else class="w-10 h-10 rounded-full bg-[var(--bg-card-hover)] flex items-center justify-center text-xs font-bold text-[var(--text-secondary)] shrink-0">
            {{ (result.author?.name || result.platform || 'A')[0].toUpperCase() }}
          </div>

          <div>
            <h4 class="text-xs font-semibold text-[var(--text-primary)]">
              {{ result.author?.name || 'Creator' }}
            </h4>
            <p class="text-[11px] text-[var(--text-tertiary)] font-mono">
              @{{ result.author?.username || result.platform }}
            </p>
          </div>
        </div>

        <div v-if="result.cached" class="shrink-0">
          <span class="px-2 py-0.5 rounded text-[11px] font-mono bg-[#2E2E2E] text-[var(--text-secondary)] border border-[var(--border-subtle)]">Cached</span>
        </div>
      </div>

      <!-- Download Action Buttons -->
      <div class="space-y-3">
        <h4 class="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          Available Download Streams
        </h4>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <!-- Video Options -->
          <div
            v-for="(item, idx) in videoMedias"
            :key="idx"
            class="flex items-center justify-between p-3 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg hover:border-[var(--border-card-hover)] hover:bg-[var(--bg-card-hover)] transition-all"
          >
            <div>
              <div class="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <span>{{ item.quality || 'Video (MP4)' }}</span>
              </div>
              <div class="text-[10px] text-[var(--text-tertiary)] font-mono mt-0.5">
                {{ item.format?.toUpperCase() || 'MP4' }} {{ item.size ? `• ${(item.size / (1024 * 1024)).toFixed(1)} MB` : '' }}
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              @click="downloadMediaItem(item, `${result.platform}_${idx + 1}`)"
            >
              Download
            </Button>
          </div>

          <!-- Audio Option -->
          <div
            v-for="(item, idx) in audioMedias"
            :key="'audio-' + idx"
            class="flex items-center justify-between p-3 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg hover:border-[var(--border-card-hover)] hover:bg-[var(--bg-card-hover)] transition-all"
          >
            <div>
              <div class="text-xs font-semibold text-[var(--text-primary)]">
                {{ item.quality || 'Audio Only (MP3)' }}
              </div>
              <div class="text-[10px] text-[var(--text-tertiary)] font-mono mt-0.5">
                {{ item.format?.toUpperCase() || 'MP3' }} {{ item.size ? `• ${(item.size / (1024 * 1024)).toFixed(1)} MB` : '• High Quality MP3' }}
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              @click="downloadMediaItem(item, `${result.title || result.platform}`)"
            >
              Download MP3
            </Button>
          </div>
        </div>

        <!-- Carousel ZIP Action -->
        <div v-if="isCarousel" class="pt-2">
          <Button
            variant="primary"
            class="w-full font-semibold"
            :loading="isZipping"
            @click="downloadAsZip(imageMedias, result.title || 'instagram_carousel')"
          >
            <span>Download All {{ imageMedias.length }} Images as ZIP</span>
            <span v-if="isZipping" class="ml-2 font-mono text-xs">({{ zipProgress }}%)</span>
          </Button>
        </div>

        <!-- Individual Image Downloads if Carousel -->
        <div v-if="isCarousel" class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          <div
            v-for="(img, idx) in imageMedias"
            :key="'img-' + idx"
            class="relative group rounded-lg overflow-hidden border border-[var(--border-subtle)] aspect-square bg-black/40"
          >
            <img :src="img.url" :alt="`Image ${idx + 1}`" loading="lazy" decoding="async" class="w-full h-full object-cover" />
            <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
              <Button
                variant="secondary"
                size="sm"
                class="text-[10px] py-1 px-2 h-auto"
                @click="downloadMediaItem(img, `${result.title || 'image'}_${idx + 1}`)"
              >
                Save #{{ idx + 1 }}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-xs text-[var(--text-tertiary)]">
        <button
          type="button"
          class="hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          @click="activeMedia?.url && copy(activeMedia.url)"
        >
          Copy Direct Link
        </button>
        <Button variant="ghost" size="sm" @click="emit('update:modelValue', false)">
          Close
        </Button>
      </div>
    </div>
  </Modal>
</template>
