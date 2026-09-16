<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  Music,
  Search,
  Upload,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Download,
  Eye,
  Code2,
  RefreshCw,
  Sparkles,
  AlertCircle,
  FileAudio,
  X,
  Clock,
  Disc,
  User,
  Sliders,
  CheckCircle2
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import { useI18n } from '~/composables/useI18n'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'
import Card from '~/components/ui/Card.vue'

interface LrcTrackItem {
  id: number
  trackName: string
  artistName: string
  albumName?: string
  duration?: number
  instrumental: boolean
  plainLyrics?: string
  syncedLyrics?: string
}

interface ParsedLyricLine {
  id: number
  timeTag: string
  seconds: number
  originalText: string
  romajiText?: string
}

const toast = useToast()
const { t, locale } = useI18n()

useHead({
  title: 'LRC Synced Lyrics Studio — Japanese Romaji Karaoke Generator | Avttr Studio',
  meta: [
    {
      name: 'description',
      content: 'Fetch millisecond-synced .lrc lyrics, convert Japanese Kanji to Romaji, preview live karaoke playback, and export dual-line .lrc files.'
    }
  ]
})

// Input State
const searchQuery = ref('')
const isSearching = ref(false)
const searchResults = ref<LrcTrackItem[]>([])
const hasSearched = ref(false)

// Audio File State
const audioFile = ref<File | null>(null)
const audioUrl = ref<string | null>(null)
const audioElement = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const audioDuration = ref(0)
const volume = ref(0.8)
const isMuted = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

// Active Lyrics State
const selectedTrack = ref<LrcTrackItem | null>(null)
const originalLrc = ref('')
const romajiLrc = ref('')
const dualLrc = ref('')
const isRomajiConverted = ref(false)
const isConvertingRomaji = ref(false)
const syncOffset = ref(0) // seconds to shift timestamps
const exportMode = ref<'dual' | 'romaji' | 'original'>('dual')
const activeView = ref<'karaoke' | 'raw'>('karaoke')
const rawEditedLrc = ref('')
const hasCopied = ref(false)
const karaokeContainerRef = ref<HTMLElement | null>(null)

// Format seconds into mm:ss.xx
const formatSeconds = (sec: number): string => {
  if (isNaN(sec) || sec < 0) return '00:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// Check if string contains Japanese Kanji/Kana
const containsJapanese = (text: string): boolean => {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)
}

// Parsed active lines for Karaoke playback
const parsedLines = computed<ParsedLyricLine[]>(() => {
  const source = originalLrc.value
  if (!source) return []

  const lines = source.split('\n').map((l) => l.trim()).filter(Boolean)
  const timeRegex = /^\[(\d{2}):(\d{2}\.\d{2,3})\](.*)$/
  const items: ParsedLyricLine[] = []

  // Romaji lookup map
  const romajiMap = new Map<string, string>()
  if (romajiLrc.value) {
    const rLines = romajiLrc.value.split('\n').map((l) => l.trim()).filter(Boolean)
    for (const r of rLines) {
      const match = r.match(timeRegex)
      if (match) {
        romajiMap.set(`[${match[1]}:${match[2]}]`, match[3].trim())
      }
    }
  }

  let idCounter = 0
  for (const line of lines) {
    const match = line.match(timeRegex)
    if (match) {
      const min = parseInt(match[1], 10)
      const sec = parseFloat(match[2])
      const seconds = min * 60 + sec
      const tag = `[${match[1]}:${match[2]}]`
      const orig = match[3].trim()
      const r = romajiMap.get(tag)

      items.push({
        id: idCounter++,
        timeTag: tag,
        seconds,
        originalText: orig,
        romajiText: r && r !== orig ? r : undefined
      })
    }
  }

  return items.sort((a, b) => a.seconds - b.seconds)
})

// Current active line index in karaoke
const activeLineIndex = computed(() => {
  if (parsedLines.value.length === 0) return -1
  const effectiveTime = currentTime.value - syncOffset.value

  let activeIdx = -1
  for (let i = 0; i < parsedLines.value.length; i++) {
    if (effectiveTime >= parsedLines.value[i].seconds) {
      activeIdx = i
    } else {
      break
    }
  }
  return activeIdx
})

// Computed Final Export Text based on exportMode
const finalLrcOutput = computed(() => {
  if (activeView.value === 'raw' && rawEditedLrc.value) {
    return rawEditedLrc.value
  }

  if (exportMode.value === 'romaji' && romajiLrc.value) {
    return romajiLrc.value
  }
  if (exportMode.value === 'dual' && dualLrc.value) {
    return dualLrc.value
  }
  return originalLrc.value
})

// Detect if current lyrics contain Japanese
const isJapaneseSong = computed(() => {
  return containsJapanese(originalLrc.value)
})

// Auto-scroll Karaoke view to active line
watch(activeLineIndex, (newIdx) => {
  if (newIdx < 0 || activeView.value !== 'karaoke' || !karaokeContainerRef.value) return
  const activeEl = karaokeContainerRef.value.querySelector(`[data-line-id="${newIdx}"]`) as HTMLElement
  if (activeEl) {
    activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
})

// Search LRCLIB API via Server Route
const searchLyrics = async () => {
  const query = searchQuery.value.trim()
  if (!query) return

  isSearching.value = true
  hasSearched.value = true
  searchResults.value = []

  try {
    const res = await $fetch<{ success: boolean; data: LrcTrackItem[] }>('/api/tools/lrc-search', {
      query: { q: query }
    })

    if (res && Array.isArray(res.data)) {
      searchResults.value = res.data
      if (res.data.length === 0) {
        toast.info(
          locale.value === 'id' ? 'Tidak Ditemukan' : 'No Lyrics Found',
          locale.value === 'id' ? 'Coba cari dengan nama artis atau judul yang lebih spesifik.' : 'Try searching with more specific title or artist keywords.'
        )
      }
    }
  } catch (err: any) {
    toast.error('Search Failed', err.statusMessage || 'Could not reach LRCLIB database')
  } finally {
    isSearching.value = false
  }
}

// Select a track from search results
const selectTrack = (track: LrcTrackItem) => {
  selectedTrack.value = track
  originalLrc.value = track.syncedLyrics || track.plainLyrics || ''
  romajiLrc.value = ''
  dualLrc.value = originalLrc.value
  isRomajiConverted.value = false
  syncOffset.value = 0
  rawEditedLrc.value = originalLrc.value

  if (!track.syncedLyrics && track.plainLyrics) {
    toast.warning(
      locale.value === 'id' ? 'Lirik Tidak Tersinkronisasi' : 'Plain Lyrics Only',
      locale.value === 'id' ? 'Lagu ini hanya memiliki teks lirik biasa tanpa timestamp.' : 'This track only has unsynced plain lyrics.'
    )
  } else if (track.syncedLyrics) {
    toast.success(
      locale.value === 'id' ? 'Lirik Berhasil Dimuat' : 'Synced Lyrics Loaded',
      `${track.trackName} — ${track.artistName}`
    )
  }
}

// Convert Japanese Kanji to Romaji via Gemini 2.5 Flash
const convertToRomaji = async () => {
  if (!originalLrc.value) return
  isConvertingRomaji.value = true

  try {
    const res = await $fetch<{
      success: boolean
      romajiLrc: string
      dualLrc: string
      isJapanese: boolean
    }>('/api/tools/lrc-romaji', {
      method: 'POST',
      body: { lyrics: originalLrc.value }
    })

    if (res && res.success) {
      romajiLrc.value = res.romajiLrc
      dualLrc.value = res.dualLrc
      isRomajiConverted.value = true
      exportMode.value = 'dual'
      rawEditedLrc.value = res.dualLrc

      toast.success(
        locale.value === 'id' ? 'Romaji Berhasil Digenerate' : 'Romaji Generated',
        locale.value === 'id' ? 'Lirik Jepang berhasil diubah ke Romaji dual-line!' : 'Japanese lyrics Romanized with synchronized timestamps!'
      )
    }
  } catch (err: any) {
    toast.error('Romaji Conversion Failed', err.statusMessage || 'Failed to Romanize lyrics with AI')
  } finally {
    isConvertingRomaji.value = false
  }
}

// Audio File Selection Handler
const handleAudioFile = (file: File) => {
  audioFile.value = file
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
  }
  audioUrl.value = URL.createObjectURL(file)

  // Clean filename to search query
  const cleanName = file.name
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]/g, ' ')
    .replace(/\b(feat|ft|official|audio|video|lyrics|remix|hd|flac|mp3)\b/gi, '')
    .trim()

  searchQuery.value = cleanName
  searchLyrics()

  toast.success(
    locale.value === 'id' ? 'File Audio Dimuat' : 'Audio File Loaded',
    file.name
  )
}

const onFileInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    handleAudioFile(target.files[0])
  }
}

const handleDrop = (event: DragEvent) => {
  isDragging.value = false
  if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
    const file = event.dataTransfer.files[0]
    if (file.type.startsWith('audio/') || /\.(flac|mp3|m4a|wav|ogg|opus)$/i.test(file.name)) {
      handleAudioFile(file)
    } else {
      toast.warning('Unsupported Audio', 'Please upload a valid audio file (FLAC, MP3, M4A, WAV).')
    }
  }
}

// Audio Playback Controls
const togglePlay = () => {
  if (!audioElement.value) return
  if (isPlaying.value) {
    audioElement.value.pause()
  } else {
    audioElement.value.play().catch(() => {})
  }
}

const onTimeUpdate = () => {
  if (audioElement.value) {
    currentTime.value = audioElement.value.currentTime
  }
}

const onLoadedMetadata = () => {
  if (audioElement.value) {
    audioDuration.value = audioElement.value.duration
  }
}

const onSeek = (e: Event) => {
  const target = e.target as HTMLInputElement
  const time = parseFloat(target.value)
  if (audioElement.value) {
    audioElement.value.currentTime = time
    currentTime.value = time
  }
}

const seekToLine = (seconds: number) => {
  if (audioElement.value) {
    audioElement.value.currentTime = seconds
    currentTime.value = seconds
    if (!isPlaying.value) {
      audioElement.value.play().catch(() => {})
    }
  }
}

const toggleMute = () => {
  if (!audioElement.value) return
  isMuted.value = !isMuted.value
  audioElement.value.muted = isMuted.value
}

// Sync Offset adjustments
const adjustOffset = (delta: number) => {
  syncOffset.value = Math.round((syncOffset.value + delta) * 10) / 10
}

const resetOffset = () => {
  syncOffset.value = 0
}

// Export actions
const copyLrc = async () => {
  try {
    await navigator.clipboard.writeText(finalLrcOutput.value)
    hasCopied.value = true
    setTimeout(() => {
      hasCopied.value = false
    }, 2000)
    toast.success('Copied to Clipboard', 'LRC lyrics copied with timestamps.')
  } catch {
    toast.error('Copy Failed', 'Please copy manually from Raw Editor.')
  }
}

const downloadLrc = () => {
  if (!finalLrcOutput.value) return
  const blob = new Blob([finalLrcOutput.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url

  const baseName = audioFile.value
    ? audioFile.value.name.replace(/\.[^/.]+$/, '')
    : selectedTrack.value
      ? `${selectedTrack.value.artistName} - ${selectedTrack.value.trackName}`
      : 'lyrics'

  const suffix = exportMode.value === 'romaji' ? ' (Romaji)' : exportMode.value === 'dual' ? ' (Dual)' : ''
  a.download = `${baseName}${suffix}.lrc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  toast.success('Downloaded .lrc', `Saved as ${a.download}`)
}

// Reset tool
const resetWorkspace = () => {
  if (audioElement.value) {
    audioElement.value.pause()
  }
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
  }
  audioFile.value = null
  audioUrl.value = null
  selectedTrack.value = null
  originalLrc.value = ''
  romajiLrc.value = ''
  dualLrc.value = ''
  isRomajiConverted.value = false
  syncOffset.value = 0
  searchResults.value = []
  hasSearched.value = false
  searchQuery.value = ''
  rawEditedLrc.value = ''
}

onUnmounted(() => {
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
  }
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
          <span>Audio & Music</span>
          <span>/</span>
          <span class="text-[var(--text-primary)] font-medium">LRC Lyrics Studio</span>
        </nav>
        <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          {{ t.tools['lrc-studio']?.title || 'LRC Synced Lyrics Studio' }}
        </h1>
        <p class="text-xs sm:text-sm text-[var(--text-secondary)]">
          {{ t.tools['lrc-studio']?.description || 'Synchronized .lrc lyrics generator with LRCLIB database and Japanese Romaji transcriber.' }}
        </p>
      </div>

      <!-- Engine Badges -->
      <div class="flex items-center gap-2 flex-wrap">
        <Badge variant="badge">LRCLIB Sync</Badge>
        <Badge variant="outline">Client Privacy</Badge>
      </div>
    </div>

    <!-- Hidden Native Audio & File Input -->
    <input
      ref="fileInputRef"
      type="file"
      accept="audio/flac,audio/mp3,audio/mpeg,audio/m4a,audio/wav,audio/ogg,.flac,.mp3,.m4a,.wav,.ogg"
      class="hidden"
      @change="onFileInputChange"
    />

    <audio
      v-if="audioUrl"
      ref="audioElement"
      :src="audioUrl"
      class="hidden"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
      @play="isPlaying = true"
      @pause="isPlaying = false"
      @ended="isPlaying = false"
    />

    <!-- Initial Search & Dropzone Deck (Shown when no track selected) -->
    <div v-if="!selectedTrack" class="space-y-4">
      <!-- Search Omnibox -->
      <div class="p-3 bg-[#141416] border border-[#2E2E2E] rounded-[14px]">
        <form class="flex items-center gap-2" @submit.prevent="searchLyrics">
          <div class="relative flex-1">
            <Search class="w-4 h-4 text-[var(--text-tertiary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search song title & artist (e.g. Yorushika - Yuunagi, The 1975 - About You)..."
              class="w-full h-11 pl-10 pr-4 bg-[#1B1B1E] border border-[#2E2E2E] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            class="h-11 px-5 text-xs font-medium shrink-0 flex items-center gap-1.5"
            :disabled="isSearching || !searchQuery.trim()"
          >
            <RefreshCw v-if="isSearching" class="w-3.5 h-3.5 animate-spin" />
            <Search v-else class="w-3.5 h-3.5" />
            <span>Search Lyrics</span>
          </Button>
        </form>
      </div>

      <!-- Standardized Section 10 Standalone Dropzone -->
      <div
        class="relative border-2 border-dashed rounded-[14px] p-8 sm:p-14 border-[#2E2E2E] bg-[#141416] hover:border-[#3E3E3E] text-center cursor-pointer select-none transition-colors"
        :class="isDragging ? 'border-white bg-[#1A1A1E]' : ''"
        @click="fileInputRef?.click()"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
      >
        <div class="w-12 h-12 mx-auto rounded-xl bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-white shadow-xs">
          <FileAudio class="w-6 h-6" />
        </div>
        <div class="text-sm font-semibold text-[var(--text-primary)] mt-3">
          {{ locale === 'id' ? 'Tarik & lepas file audio .flac atau .mp3 di sini atau browse' : 'Drop your audio .flac or .mp3 file here or browse' }}
        </div>
        <div class="text-xs text-[var(--text-secondary)] mt-1">
          {{ locale === 'id' ? 'Mendukung FLAC, MP3, M4A, WAV. Otomatis membaca judul dan sinkronisasi playback.' : 'Supports FLAC, MP3, M4A, WAV. Auto-detects track name and loads player preview.' }}
        </div>
        <div class="mt-4 flex items-center justify-center gap-2">
          <Button variant="ghost" class="h-8 px-3.5 text-xs border border-[#2E2E2E] text-[var(--text-secondary)] hover:text-white pointer-events-none">
            <Upload class="w-3.5 h-3.5 mr-1" />
            <span>Browse Audio File</span>
          </Button>
        </div>
      </div>

      <!-- Search Results List -->
      <div v-if="searchResults.length > 0" class="space-y-2">
        <div class="flex items-center justify-between text-xs font-mono text-[var(--text-tertiary)] px-1">
          <span>Search Results ({{ searchResults.length }})</span>
          <span>Click to load lyrics</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Card
            v-for="track in searchResults"
            :key="track.id"
            class="p-3.5 hover:border-zinc-500 cursor-pointer transition-all active:scale-[0.99] flex items-center justify-between gap-3 group"
            @click="selectTrack(track)"
          >
            <div class="space-y-1 min-w-0 flex-1">
              <div class="font-medium text-xs text-white truncate group-hover:text-emerald-400 transition-colors">
                {{ track.trackName }}
              </div>
              <div class="text-[11px] text-[var(--text-secondary)] truncate flex items-center gap-2">
                <span>{{ track.artistName }}</span>
                <span v-if="track.albumName" class="text-zinc-600">•</span>
                <span v-if="track.albumName" class="truncate text-zinc-400">{{ track.albumName }}</span>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <span v-if="track.duration" class="text-[10px] font-mono text-[var(--text-tertiary)]">
                {{ formatSeconds(track.duration) }}
              </span>
              <Badge :variant="track.syncedLyrics ? 'badge' : 'outline'">
                {{ track.syncedLyrics ? 'Synced' : 'Plain' }}
              </Badge>
            </div>
          </Card>
        </div>
      </div>

      <!-- Daily Quota & Usage Notice -->
      <div class="p-3.5 sm:p-4 rounded-[14px] bg-[#141416] border border-[#2E2E2E] flex items-start gap-3 text-xs">
        <AlertCircle class="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
        <div class="space-y-0.5 text-[var(--text-secondary)] leading-relaxed">
          <div class="text-xs font-semibold text-[var(--text-primary)]">
            {{ locale === 'id' ? 'Catatan Database & Layanan' : 'Database & Lyrics Notice' }}
          </div>
          <p class="text-[11px] text-[var(--text-tertiary)]">
            {{ locale === 'id'
              ? 'Lirik sinkronisasi (.lrc) diambil langsung dari database LRCLIB yang bebas digunakan tanpa batas. Konversi Romaji bahasa Jepang ditenagai oleh Google Gemini API.'
              : 'Synchronized lyrics (.lrc) are powered by the open LRCLIB database. Japanese Romaji transliteration is assisted by Google Gemini API.' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Active Lyrics & Karaoke Workspace -->
    <div v-else class="space-y-4">
      <!-- Toolbar Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#141416] border border-[#2E2E2E] rounded-[14px]">
        <!-- Track Info -->
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-lg bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-white shrink-0">
            <Music class="w-4 h-4 text-emerald-400" />
          </div>
          <div class="space-y-0.5 min-w-0">
            <div class="text-xs font-semibold text-white truncate max-w-xs sm:max-w-md">
              {{ selectedTrack?.trackName || 'Unknown Title' }}
            </div>
            <div class="text-[11px] text-[var(--text-secondary)] truncate">
              {{ selectedTrack?.artistName || 'Unknown Artist' }}
              <span v-if="selectedTrack?.albumName" class="text-zinc-600"> • {{ selectedTrack?.albumName }}</span>
            </div>
          </div>
        </div>

        <!-- Toolbar Right Actions -->
        <div class="flex items-center gap-2 flex-wrap">
          <!-- View Mode (Karaoke vs Raw) -->
          <div class="flex items-center bg-[#1E1E22] p-0.5 rounded-md border border-[#2E2E2E]">
            <button
              class="px-2.5 py-1 text-xs rounded transition-colors flex items-center gap-1.5"
              :class="activeView === 'karaoke' ? 'bg-[#2E2E2E] text-white font-medium' : 'text-[var(--text-tertiary)] hover:text-white'"
              @click="activeView = 'karaoke'"
            >
              <Eye class="w-3.5 h-3.5" />
              <span>Karaoke</span>
            </button>
            <button
              class="px-2.5 py-1 text-xs rounded transition-colors flex items-center gap-1.5"
              :class="activeView === 'raw' ? 'bg-[#2E2E2E] text-white font-medium' : 'text-[var(--text-tertiary)] hover:text-white'"
              @click="activeView = 'raw'"
            >
              <Code2 class="w-3.5 h-3.5" />
              <span>Raw LRC</span>
            </button>
          </div>

          <!-- Reset / New Search -->
          <Button
            variant="ghost"
            class="h-8 px-2.5 text-xs text-[var(--text-tertiary)] hover:text-white border border-[#2E2E2E]"
            title="Search another track"
            @click="resetWorkspace"
          >
            <X class="w-3.5 h-3.5 mr-1" />
            <span>Close</span>
          </Button>
        </div>
      </div>

      <!-- Main Split Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <!-- Left Column: Audio Player & Romaji Engine (5 cols) -->
        <div class="lg:col-span-5 space-y-3">
          <!-- Audio Player Card -->
          <Card class="p-4 space-y-3.5">
            <div class="flex items-center justify-between text-xs font-mono text-[var(--text-tertiary)]">
              <span class="flex items-center gap-1.5 text-white">
                <Disc class="w-3.5 h-3.5 text-emerald-400" />
                <span>Audio Playback</span>
              </span>
              <span v-if="audioFile" class="text-[10px] text-zinc-400 font-mono">
                Local: {{ audioFile.name }}
              </span>
              <span v-else class="text-[10px] text-zinc-500">
                No local audio
              </span>
            </div>

            <!-- Custom Audio Controls (when audio file uploaded) -->
            <div v-if="audioUrl" class="space-y-2.5 pt-1">
              <!-- Scrubber Slider -->
              <div class="space-y-1">
                <input
                  type="range"
                  min="0"
                  :max="audioDuration || 100"
                  step="0.1"
                  :value="currentTime"
                  class="w-full h-1.5 bg-[#262626] rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  @input="onSeek"
                />
                <div class="flex items-center justify-between text-[10px] font-mono text-[var(--text-tertiary)]">
                  <span>{{ formatSeconds(currentTime) }}</span>
                  <span>{{ formatSeconds(audioDuration) }}</span>
                </div>
              </div>

              <!-- Buttons Row -->
              <div class="flex items-center justify-between gap-2">
                <Button
                  variant="primary"
                  class="h-9 px-4 text-xs font-medium flex items-center gap-1.5"
                  @click="togglePlay"
                >
                  <Pause v-if="isPlaying" class="w-3.5 h-3.5" />
                  <Play v-else class="w-3.5 h-3.5" />
                  <span>{{ isPlaying ? 'Pause' : 'Play' }}</span>
                </Button>

                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-white/10"
                    title="Mute/Unmute"
                    @click="toggleMute"
                  >
                    <VolumeX v-if="isMuted" class="w-4 h-4" />
                    <Volume2 v-else class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Upload Audio Option if not yet loaded -->
            <div v-else class="p-4 rounded-xl bg-[#141416] border border-dashed border-[#2E2E2E] text-center space-y-2">
              <p class="text-xs text-[var(--text-secondary)]">
                Upload your <code class="text-white font-mono">.flac</code> or <code class="text-white font-mono">.mp3</code> file to test live karaoke playback.
              </p>
              <Button
                variant="secondary"
                class="h-8 px-3 text-xs"
                @click="fileInputRef?.click()"
              >
                <Upload class="w-3.5 h-3.5 mr-1" />
                <span>Load Audio File</span>
              </Button>
            </div>

            <!-- Timestamp Offset Adjuster -->
            <div class="pt-2 border-t border-[#262626] space-y-2">
              <div class="flex items-center justify-between text-xs">
                <span class="text-[var(--text-secondary)] font-medium flex items-center gap-1">
                  <Sliders class="w-3 h-3" />
                  <span>Sync Offset Shift</span>
                </span>
                <span class="font-mono text-[11px]" :class="syncOffset !== 0 ? 'text-emerald-400 font-bold' : 'text-zinc-500'">
                  {{ syncOffset > 0 ? `+${syncOffset}s` : `${syncOffset}s` }}
                </span>
              </div>

              <div class="grid grid-cols-5 gap-1.5">
                <button
                  type="button"
                  class="py-1 px-1.5 bg-[#1B1B1E] border border-[#2E2E2E] rounded text-[10px] font-mono text-[var(--text-secondary)] hover:text-white transition-colors"
                  @click="adjustOffset(-0.5)"
                >
                  -0.5s
                </button>
                <button
                  type="button"
                  class="py-1 px-1.5 bg-[#1B1B1E] border border-[#2E2E2E] rounded text-[10px] font-mono text-[var(--text-secondary)] hover:text-white transition-colors"
                  @click="adjustOffset(-0.1)"
                >
                  -0.1s
                </button>
                <button
                  type="button"
                  class="py-1 px-1.5 bg-[#1B1B1E] border border-[#2E2E2E] rounded text-[10px] font-mono text-zinc-500 hover:text-white transition-colors"
                  @click="resetOffset"
                >
                  Reset
                </button>
                <button
                  type="button"
                  class="py-1 px-1.5 bg-[#1B1B1E] border border-[#2E2E2E] rounded text-[10px] font-mono text-[var(--text-secondary)] hover:text-white transition-colors"
                  @click="adjustOffset(0.1)"
                >
                  +0.1s
                </button>
                <button
                  type="button"
                  class="py-1 px-1.5 bg-[#1B1B1E] border border-[#2E2E2E] rounded text-[10px] font-mono text-[var(--text-secondary)] hover:text-white transition-colors"
                  @click="adjustOffset(0.5)"
                >
                  +0.5s
                </button>
              </div>
            </div>
          </Card>

          <!-- Japanese Romaji Transcriber Card -->
          <Card class="p-4 space-y-3">
            <div class="flex items-center justify-between text-xs">
              <span class="font-medium text-white flex items-center gap-1.5">
                <Sparkles class="w-3.5 h-3.5 text-amber-400" />
                <span>Japanese Romaji Transcriber</span>
              </span>
              <Badge v-if="isJapaneseSong" variant="badge">Kanji Detected</Badge>
              <Badge v-else variant="outline">Non-Japanese</Badge>
            </div>

            <p class="text-xs text-[var(--text-secondary)] leading-relaxed">
              {{ locale === 'id'
                ? 'Ubah lirik Kanji/Kana menjadi pelafalan huruf alfabet Romaji yang sinkron milidetik dengan lagu.'
                : 'Transliterate Kanji/Kana lyrics into accurate phonetic Hepburn Romaji synchronized to millisecond timestamps.' }}
            </p>

            <Button
              v-if="!isRomajiConverted"
              variant="primary"
              class="w-full h-9 text-xs font-medium flex items-center justify-center gap-1.5"
              :disabled="isConvertingRomaji || !originalLrc"
              @click="convertToRomaji"
            >
              <RefreshCw v-if="isConvertingRomaji" class="w-3.5 h-3.5 animate-spin" />
              <Sparkles v-else class="w-3.5 h-3.5" />
              <span>{{ isConvertingRomaji ? 'Romanizing Lyrics...' : 'Generate Romaji (Dual-Line)' }}</span>
            </Button>

            <div v-else class="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 class="w-4 h-4 shrink-0" />
              <span>Romaji synchronized and ready for dual-line export!</span>
            </div>
          </Card>
        </div>

        <!-- Right Column: Lyrics Preview & Export Studio (7 cols) -->
        <Card class="p-4 lg:col-span-7 space-y-3.5 min-h-[580px] flex flex-col">
          <!-- Export Format Selector Bar -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-[#262626]">
            <!-- Format Switches -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[11px] font-mono text-[var(--text-tertiary)] mr-1">Export:</span>
              <button
                type="button"
                class="px-2.5 py-1 text-xs rounded-md transition-colors"
                :class="exportMode === 'dual' ? 'bg-[#2E2E2E] text-white font-medium shadow-xs' : 'text-zinc-400 hover:text-white'"
                @click="exportMode = 'dual'"
              >
                Dual-Line
              </button>
              <button
                type="button"
                class="px-2.5 py-1 text-xs rounded-md transition-colors"
                :class="exportMode === 'romaji' ? 'bg-[#2E2E2E] text-white font-medium shadow-xs' : 'text-zinc-400 hover:text-white'"
                :disabled="!romajiLrc"
                @click="exportMode = 'romaji'"
              >
                Romaji Only
              </button>
              <button
                type="button"
                class="px-2.5 py-1 text-xs rounded-md transition-colors"
                :class="exportMode === 'original' ? 'bg-[#2E2E2E] text-white font-medium shadow-xs' : 'text-zinc-400 hover:text-white'"
                @click="exportMode = 'original'"
              >
                Original
              </button>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-2">
              <Button
                variant="secondary"
                class="h-8 px-3 text-xs font-medium border-[#2E2E2E] flex items-center gap-1.5"
                @click="copyLrc"
              >
                <Check v-if="hasCopied" class="w-3.5 h-3.5 text-emerald-400" />
                <Copy v-else class="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                <span>{{ hasCopied ? 'Copied' : 'Copy' }}</span>
              </Button>

              <Button
                variant="primary"
                class="h-8 px-3 text-xs font-medium flex items-center gap-1.5"
                @click="downloadLrc"
              >
                <Download class="w-3.5 h-3.5" />
                <span>Download .lrc</span>
              </Button>
            </div>
          </div>

          <!-- Mode 1: Interactive Karaoke Live Scrolling View -->
          <div
            v-if="activeView === 'karaoke'"
            ref="karaokeContainerRef"
            class="flex-1 overflow-y-auto max-h-[500px] space-y-2.5 pr-2 select-none scroll-smooth"
          >
            <div
              v-for="(line, idx) in parsedLines"
              :key="line.id"
              :data-line-id="idx"
              class="p-2.5 rounded-xl cursor-pointer transition-all border"
              :class="
                activeLineIndex === idx
                  ? 'bg-emerald-500/10 border-emerald-500/30 scale-[1.01]'
                  : 'bg-[#141416]/50 border-transparent hover:bg-[#1C1C1F] hover:border-[#2E2E2E]'
              "
              @click="seekToLine(line.seconds)"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="space-y-1">
                  <!-- Kanji / Original Line -->
                  <div
                    class="text-sm font-medium transition-colors"
                    :class="activeLineIndex === idx ? 'text-white font-semibold' : 'text-zinc-400'"
                  >
                    {{ line.originalText }}
                  </div>

                  <!-- Romaji Sub-line (if available) -->
                  <div
                    v-if="line.romajiText"
                    class="text-xs transition-colors"
                    :class="activeLineIndex === idx ? 'text-emerald-400 font-medium' : 'text-zinc-500'"
                  >
                    {{ line.romajiText }}
                  </div>
                </div>

                <!-- Timestamp badge -->
                <span class="text-[10px] font-mono text-[var(--text-tertiary)] shrink-0 pt-0.5">
                  {{ line.timeTag }}
                </span>
              </div>
            </div>
          </div>

          <!-- Mode 2: Raw LRC Code Editor -->
          <div v-else class="flex-1 flex flex-col space-y-2">
            <textarea
              v-model="rawEditedLrc"
              class="w-full flex-1 min-h-[480px] p-3 text-xs font-mono bg-[#141416] border border-[#2E2E2E] rounded-lg text-white focus:outline-none focus:border-zinc-500 resize-y leading-relaxed"
              placeholder="[00:00.00] Lyrics..."
            ></textarea>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
