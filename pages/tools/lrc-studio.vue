<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import {
  Music,
  Search,
  Play,
  Pause,
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
  Disc,
  Sliders,
  CheckCircle2
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import { useI18n } from '~/composables/useI18n'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

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

// Search & Input State
const searchQuery = ref('')
const isSearching = ref(false)
const searchResults = ref<LrcTrackItem[]>([])
const hasSearched = ref(false)
const isDragging = ref(false)

// Audio Playback State
const audioFile = ref<File | null>(null)
const audioUrl = ref<string | null>(null)
const audioElement = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const audioDuration = ref(0)
const isMuted = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

// Active Lyrics State
const selectedTrack = ref<LrcTrackItem | null>(null)
const originalLrc = ref('')
const romajiLrc = ref('')
const dualLrc = ref('')
const isRomajiConverted = ref(false)
const isConvertingRomaji = ref(false)
const syncOffset = ref(0) // seconds offset
const exportMode = ref<'dual' | 'romaji' | 'original'>('dual')
const activeView = ref<'karaoke' | 'raw'>('karaoke')
const rawEditedLrc = ref('')
const hasCopied = ref(false)
const karaokeContainerRef = ref<HTMLElement | null>(null)

// Check Japanese text helper (Kanji, Hiragana, Katakana)
const containsJapanese = (text: string): boolean => {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)
}

// Format seconds helper
const formatSeconds = (sec: number): string => {
  if (isNaN(sec) || sec < 0) return '00:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// Parse active lines for karaoke
const parsedLines = computed<ParsedLyricLine[]>(() => {
  const source = activeView.value === 'raw' && rawEditedLrc.value ? rawEditedLrc.value : originalLrc.value
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

// Prepend or format [ti:...], [ar:...], [by:Avttr] watermark header
const formatLrcWithWatermark = (rawLrc: string): string => {
  if (!rawLrc || !rawLrc.trim()) return ''

  const title = selectedTrack.value?.trackName || ''
  const artist = selectedTrack.value?.artistName || ''

  const lines = rawLrc.split('\n')
  const contentLines: string[] = []
  let foundTi = ''
  let foundAr = ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^\[ti:\s*(.*?)\s*\]$/i.test(trimmed)) {
      foundTi = trimmed.match(/^\[ti:\s*(.*?)\s*\]$/i)?.[1]?.trim() || ''
    } else if (/^\[ar:\s*(.*?)\s*\]$/i.test(trimmed)) {
      foundAr = trimmed.match(/^\[ar:\s*(.*?)\s*\]$/i)?.[1]?.trim() || ''
    } else if (/^\[by:.*\]$/i.test(trimmed)) {
      // replace existing watermark with Avttr
    } else {
      contentLines.push(line)
    }
  }

  const finalTi = foundTi || title
  const finalAr = foundAr || artist

  const headerTags: string[] = []
  if (finalTi) headerTags.push(`[ti:${finalTi}]`)
  if (finalAr) headerTags.push(`[ar:${finalAr}]`)
  headerTags.push(`[by:Avttr]`)

  // Trim leading whitespace lines from content
  while (contentLines.length > 0 && !contentLines[0].trim()) {
    contentLines.shift()
  }

  return `${headerTags.join('\n')}\n\n${contentLines.join('\n')}`
}

// Computed final export text with guaranteed [by:Avttr] watermark
const finalLrcOutput = computed(() => {
  let content = ''
  if (activeView.value === 'raw' && rawEditedLrc.value) {
    content = rawEditedLrc.value
  } else if (exportMode.value === 'romaji' && romajiLrc.value) {
    content = romajiLrc.value
  } else if (exportMode.value === 'dual' && dualLrc.value) {
    content = dualLrc.value
  } else {
    content = originalLrc.value
  }

  return formatLrcWithWatermark(content)
})

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
      // Prioritize Japanese tracks if search query contains Japanese characters
      const queryHasJapanese = containsJapanese(query)
      const sorted = [...res.data].sort((a, b) => {
        if (queryHasJapanese) {
          const aJp = containsJapanese((a.trackName || '') + (a.artistName || '') + (a.syncedLyrics || '')) ? 1 : 0
          const bJp = containsJapanese((b.trackName || '') + (b.artistName || '') + (b.syncedLyrics || '')) ? 1 : 0
          if (bJp !== aJp) return bJp - aJp
        }
        const aSync = a.syncedLyrics ? 1 : 0
        const bSync = b.syncedLyrics ? 1 : 0
        return bSync - aSync
      })

      searchResults.value = sorted

      if (sorted.length === 0) {
        toast.info(
          locale.value === 'id' ? 'Tidak Ditemukan' : 'No Lyrics Found',
          locale.value === 'id'
            ? 'Coba cari dengan nama artis atau judul yang lebih spesifik.'
            : 'Try searching with more specific title or artist keywords.'
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
  const raw = track.syncedLyrics || track.plainLyrics || ''
  const formatted = formatLrcWithWatermark(raw)
  originalLrc.value = formatted
  romajiLrc.value = ''
  dualLrc.value = formatted
  isRomajiConverted.value = false
  syncOffset.value = 0
  rawEditedLrc.value = formatted
  searchResults.value = []

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
      if (!res.isJapanese) {
        toast.info('Non-Japanese Lyrics', 'No Japanese Kanji/Kana found in this song lyrics.')
        return
      }

      romajiLrc.value = formatLrcWithWatermark(res.romajiLrc)
      dualLrc.value = formatLrcWithWatermark(res.dualLrc)
      isRomajiConverted.value = true
      exportMode.value = 'dual'
      rawEditedLrc.value = dualLrc.value

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

// Extract Vorbis / ID3 tags directly from audio file
const extractAudioMetadata = async (file: File): Promise<{ title?: string; artist?: string }> => {
  try {
    const slice = file.slice(0, 131072) // 128KB header
    const buffer = await slice.arrayBuffer()
    const view = new DataView(buffer)
    const bytes = new Uint8Array(buffer)

    // FLAC check: starts with 'fLaC' (0x66, 0x4C, 0x61, 0x43)
    if (bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) {
      let offset = 4
      while (offset < buffer.byteLength - 4) {
        const header = view.getUint8(offset)
        const isLast = (header & 0x80) !== 0
        const blockType = header & 0x7F
        const length = (view.getUint8(offset + 1) << 16) | (view.getUint8(offset + 2) << 8) | view.getUint8(offset + 3)
        offset += 4

        if (blockType === 4 && offset + length <= buffer.byteLength) { // VORBIS_COMMENT
          const decoder = new TextDecoder('utf-8')
          const vendorLength = view.getUint32(offset, true)
          let commentOffset = offset + 4 + vendorLength
          if (commentOffset + 4 <= buffer.byteLength) {
            const userCommentCount = view.getUint32(commentOffset, true)
            commentOffset += 4

            const tags: Record<string, string> = {}
            for (let i = 0; i < userCommentCount && commentOffset < offset + length; i++) {
              if (commentOffset + 4 > buffer.byteLength) break
              const commentLen = view.getUint32(commentOffset, true)
              commentOffset += 4
              if (commentOffset + commentLen > buffer.byteLength) break
              const commentBytes = bytes.subarray(commentOffset, commentOffset + commentLen)
              const commentStr = decoder.decode(commentBytes)
              commentOffset += commentLen

              const eqIdx = commentStr.indexOf('=')
              if (eqIdx !== -1) {
                const key = commentStr.slice(0, eqIdx).toUpperCase()
                const val = commentStr.slice(eqIdx + 1).trim()
                tags[key] = val
              }
            }

            return {
              title: tags.TITLE,
              artist: tags.ARTIST || tags.ALBUMARTIST
            }
          }
        }
        offset += length
        if (isLast) break
      }
    }

    // ID3v2 check: starts with 'ID3' (0x49, 0x44, 0x33)
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      let offset = 10
      const decoder = new TextDecoder('utf-8')
      const tags: Record<string, string> = {}

      while (offset < buffer.byteLength - 10) {
        const frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
        if (!/^[A-Z0-9]{4}$/.test(frameId)) break
        const frameSize = view.getUint32(offset + 4)
        offset += 10
        if (offset + frameSize > buffer.byteLength || frameSize <= 1) break

        const frameData = bytes.subarray(offset + 1, offset + frameSize)
        offset += frameSize
        const text = decoder.decode(frameData).replace(/\0/g, '').trim()

        if (frameId === 'TIT2') tags.TITLE = text
        if (frameId === 'TPE1') tags.ARTIST = text
      }

      if (tags.TITLE || tags.ARTIST) {
        return {
          title: tags.TITLE,
          artist: tags.ARTIST
        }
      }
    }
  } catch {
    // fallback to filename
  }
  return {}
}

// Audio or LRC File Selection Handler
const handleFile = async (file: File) => {
  // If user drops a .lrc file, read text directly
  if (file.name.toLowerCase().endsWith('.lrc') || file.type === 'text/plain') {
    try {
      const text = await file.text()
      const title = file.name.replace(/\.[^/.]+$/, '')
      selectedTrack.value = {
        id: Date.now(),
        trackName: title,
        artistName: 'Local File',
        duration: 0,
        instrumental: false,
        syncedLyrics: text
      }
      const formatted = formatLrcWithWatermark(text)
      originalLrc.value = formatted
      romajiLrc.value = ''
      dualLrc.value = formatted
      isRomajiConverted.value = false
      syncOffset.value = 0
      rawEditedLrc.value = formatted
      searchResults.value = []
      toast.success('LRC File Loaded', file.name)
      return
    } catch {
      toast.error('Read Failed', 'Unable to parse .lrc file')
      return
    }
  }

  // Audio file (.flac, .mp3, .wav, etc.)
  audioFile.value = file
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
  }
  audioUrl.value = URL.createObjectURL(file)

  // Try extracting metadata tags first
  const meta = await extractAudioMetadata(file)
  let cleanName = ''

  if (meta.title && meta.artist) {
    cleanName = `${meta.artist} - ${meta.title}`
  } else if (meta.title) {
    cleanName = meta.title
  } else {
    // Fallback: smart filename cleanup
    cleanName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[_-]/g, ' ')
      .replace(/\b(feat|ft|official|audio|video|lyrics|remix|hd|flac|mp3|wav|m4a)\b/gi, '')
      .trim()
  }

  searchQuery.value = cleanName
  searchLyrics()

  const detectedLabel = meta.title ? `${meta.title}${meta.artist ? ' by ' + meta.artist : ''}` : file.name
  toast.success(locale.value === 'id' ? 'File Audio Dimuat' : 'Audio File Loaded', detectedLabel)
}

const onFileInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    handleFile(target.files[0])
  }
}

const onDropFile = (e: DragEvent) => {
  isDragging.value = false
  if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
    handleFile(e.dataTransfer.files[0])
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

// Reset workspace
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
    <!-- Breadcrumbs & Header Flex Row (DESIGN.md Standard) -->
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

      <!-- Engine Badges (Monochrome Standard) -->
      <div class="flex items-center gap-2 flex-wrap">
        <Badge variant="badge">LRCLIB Sync</Badge>
        <Badge variant="outline">Client Privacy</Badge>
      </div>
    </div>

    <!-- Hidden Native Audio & File Input -->
    <input
      ref="fileInputRef"
      type="file"
      accept="audio/*,.flac,.mp3,.m4a,.wav,.ogg,.lrc,text/plain"
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

    <!-- Unified Search & Audio Upload Bar (HeroPasteBar Standard) -->
    <div class="space-y-3">
      <div class="flex flex-col sm:flex-row items-center gap-2">
        <!-- Main Search Input -->
        <div class="relative flex-1 w-full">
          <Search class="w-4 h-4 text-[var(--text-tertiary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search song title & artist (e.g. Yorushika - Replicant, YOASOBI, The 1975)..."
            class="w-full h-12 pl-10 pr-24 bg-[#171717] hover:bg-[#1a1a1c] border border-[#2E2E2E] focus:border-white/40 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-white/10 shadow-xs"
            @keydown.enter.prevent="searchLyrics"
          />
          <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              class="h-8 px-3 text-xs"
              :disabled="isSearching || !searchQuery.trim()"
              @click="searchLyrics"
            >
              <RefreshCw v-if="isSearching" class="w-3.5 h-3.5 animate-spin mr-1 text-white" />
              <Search v-else class="w-3.5 h-3.5 mr-1 text-white" />
              <span>Search</span>
            </Button>
          </div>
        </div>

        <!-- Single Upload / Replace Audio Button (HeroPasteBar size) -->
        <Button
          type="button"
          variant="secondary"
          size="default"
          class="w-full sm:w-auto shrink-0 h-12 px-5 rounded-xl font-medium text-xs sm:text-sm cursor-pointer"
          @click="fileInputRef?.click()"
        >
          <FileAudio class="w-4 h-4 mr-1.5 text-white" />
          <span>{{ audioFile ? 'Replace Audio' : 'Upload Audio' }}</span>
        </Button>
      </div>

      <!-- Search Results Dropdown List -->
      <div v-if="searchResults.length > 0" class="p-3 bg-[#171717] border border-[#2E2E2E] rounded-xl space-y-2">
        <div class="flex items-center justify-between text-xs font-mono text-[var(--text-secondary)] px-1">
          <span>Available Versions in LRCLIB ({{ searchResults.length }})</span>
          <span class="text-[11px] text-[var(--text-tertiary)]">Select the matching language version</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div
            v-for="track in searchResults"
            :key="track.id"
            class="p-3 rounded-lg bg-[#212121] hover:bg-[#292929] border border-[#2E2E2E] hover:border-[#404040] cursor-pointer transition-all flex items-center justify-between gap-3"
            @click="selectTrack(track)"
          >
            <div class="min-w-0 flex-1 space-y-0.5">
              <div class="font-semibold text-xs text-white truncate">
                {{ track.trackName }}
              </div>
              <div class="text-[11px] text-[var(--text-secondary)] truncate flex items-center gap-1.5">
                <span>{{ track.artistName }}</span>
                <span v-if="track.albumName" class="text-zinc-600">•</span>
                <span v-if="track.albumName" class="truncate text-[var(--text-tertiary)]">{{ track.albumName }}</span>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <!-- Language badge -->
              <Badge v-if="containsJapanese((track.trackName || '') + (track.syncedLyrics || '') + (track.plainLyrics || ''))" variant="badge">
                Japanese
              </Badge>
              <Badge v-else variant="outline">
                Latin / EN
              </Badge>

              <!-- Sync badge -->
              <Badge v-if="track.syncedLyrics" variant="secondary">
                Synced
              </Badge>
              <Badge v-else variant="ghost">
                Plain
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- State 1: Dropzone (DESIGN.md Section 10 Specification) -->
    <div
      v-if="!selectedTrack"
      class="relative border-2 border-dashed rounded-[14px] p-8 sm:p-14 text-center transition-all cursor-pointer select-none border-zinc-300 dark:border-[#2E2E2E] bg-zinc-50/50 dark:bg-[#141416] hover:border-zinc-400 dark:hover:border-[#3E3E3E]"
      :class="isDragging ? 'border-zinc-900 bg-zinc-100 dark:border-white dark:bg-[var(--bg-card-hover)]' : ''"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="onDropFile"
      @click="fileInputRef?.click()"
    >
      <div class="max-w-md mx-auto space-y-3">
        <div class="w-12 h-12 mx-auto rounded-xl bg-white dark:bg-[#212121] border border-zinc-200 dark:border-[#2E2E2E] flex items-center justify-center text-zinc-900 dark:text-white shadow-xs">
          <Music class="w-6 h-6 text-zinc-900 dark:text-white" />
        </div>
        <div>
          <h3 class="text-sm font-semibold text-[var(--text-primary)]">
            Drop your audio (.flac, .mp3, .wav) or .lrc file here or browse
          </h3>
          <p class="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
            Supports FLAC, MP3, WAV, OGG, and LRC files. 100% processed client-side.
          </p>
        </div>
      </div>
    </div>

    <!-- State 2: Active Theater Workspace -->
    <div v-else class="space-y-4">
      <!-- High-Contrast Audio Player Deck -->
      <div class="p-4 sm:p-5 rounded-[14px] bg-[var(--bg-card)] border border-[var(--border-card)] space-y-4 shadow-xs">
        <!-- Top Track Header & Offset Shift -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <!-- Left: Track Meta -->
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-11 h-11 rounded-xl bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-white shrink-0">
              <Disc class="w-5 h-5 text-white animate-spin" style="animation-duration: 6s;" v-if="isPlaying" />
              <Music class="w-5 h-5 text-white" v-else />
            </div>
            <div class="space-y-0.5 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-base font-bold text-white truncate max-w-md">
                  {{ selectedTrack.trackName }}
                </span>
                <Badge v-if="isJapaneseSong" variant="badge">Japanese</Badge>
                <Badge v-else variant="outline">Latin / EN</Badge>
              </div>
              <div class="text-xs text-[var(--text-secondary)] truncate flex items-center gap-2">
                <span>{{ selectedTrack.artistName }}</span>
                <span v-if="selectedTrack.albumName" class="text-zinc-600">•</span>
                <span v-if="selectedTrack.albumName" class="truncate text-[var(--text-tertiary)]">{{ selectedTrack.albumName }}</span>
                <span v-if="audioFile" class="text-white font-mono text-[11px] font-medium ml-1">
                  [Local: {{ audioFile.name }}]
                </span>
              </div>
            </div>
          </div>

          <!-- Right: Sync Offset Controller -->
          <div class="flex items-center gap-1 bg-[#212121] border border-[#2E2E2E] p-1 rounded-lg">
            <span class="text-[11px] text-[var(--text-secondary)] font-mono flex items-center gap-1 px-1.5">
              <Sliders class="w-3 h-3 text-white" />
              <span>Offset:</span>
            </span>
            <button
              type="button"
              class="px-2 py-1 bg-[#171717] hover:bg-[#292929] border border-[#2E2E2E] rounded text-xs font-mono text-white transition-colors cursor-pointer"
              @click="adjustOffset(-0.5)"
            >
              -0.5s
            </button>
            <button
              type="button"
              class="px-2 py-1 bg-[#171717] hover:bg-[#292929] border border-[#2E2E2E] rounded text-xs font-mono text-white transition-colors cursor-pointer"
              @click="adjustOffset(-0.1)"
            >
              -0.1s
            </button>
            <span
              class="px-2 py-1 font-mono text-xs font-bold rounded"
              :class="syncOffset !== 0 ? 'text-white bg-[#2E2E2E]' : 'text-[var(--text-secondary)]'"
            >
              {{ syncOffset > 0 ? `+${syncOffset}s` : `${syncOffset}s` }}
            </span>
            <button
              type="button"
              class="px-2 py-1 bg-[#171717] hover:bg-[#292929] border border-[#2E2E2E] rounded text-xs font-mono text-white transition-colors cursor-pointer"
              @click="adjustOffset(0.1)"
            >
              +0.1s
            </button>
            <button
              type="button"
              class="px-2 py-1 bg-[#171717] hover:bg-[#292929] border border-[#2E2E2E] rounded text-xs font-mono text-white transition-colors cursor-pointer"
              @click="adjustOffset(0.5)"
            >
              +0.5s
            </button>
            <button
              type="button"
              class="px-2 py-1 text-[11px] font-mono text-[var(--text-tertiary)] hover:text-white transition-colors cursor-pointer"
              title="Reset offset to 0"
              @click="resetOffset"
            >
              Reset
            </button>
          </div>
        </div>

        <!-- Audio Scrubber & Controls (When Audio is loaded) -->
        <div v-if="audioUrl" class="space-y-2 pt-1">
          <div class="flex items-center gap-3">
            <span class="text-xs font-mono text-white min-w-[40px]">
              {{ formatSeconds(currentTime) }}
            </span>
            <div class="relative flex-1 flex items-center">
              <input
                type="range"
                min="0"
                :max="audioDuration || 100"
                step="0.1"
                :value="currentTime"
                class="w-full h-2 bg-[#2E2E2E] rounded-lg appearance-none cursor-pointer accent-white"
                @input="onSeek"
              />
            </div>
            <span class="text-xs font-mono text-[var(--text-secondary)] min-w-[40px] text-right">
              {{ formatSeconds(audioDuration) }}
            </span>
          </div>

          <div class="flex items-center justify-between gap-2 pt-1">
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="w-9 h-9 rounded-full bg-white text-black hover:bg-zinc-200 transition-all flex items-center justify-center cursor-pointer shadow-xs"
                @click="togglePlay"
              >
                <Pause v-if="isPlaying" class="w-4 h-4 fill-black" />
                <Play v-else class="w-4 h-4 fill-black ml-0.5" />
              </button>
              <button
                type="button"
                class="p-2 text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-white/10"
                title="Mute/Unmute"
                @click="toggleMute"
              >
                <VolumeX v-if="isMuted" class="w-4 h-4 text-white" />
                <Volume2 v-else class="w-4 h-4 text-white" />
              </button>
            </div>

            <div class="text-[11px] text-[var(--text-tertiary)]">
              Click any lyric line below to seek playback
            </div>
          </div>
        </div>

        <!-- Audio Not Loaded Notice -->
        <div v-else class="p-3 rounded-lg bg-[#212121] border border-[#2E2E2E] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <span class="text-[var(--text-secondary)]">
            Playback disabled. Upload your audio file (.flac, .mp3, .wav) to test live playback synchronization.
          </span>
          <Button
            variant="secondary"
            size="sm"
            class="h-8 px-3 text-xs shrink-0 self-start sm:self-auto"
            @click="fileInputRef?.click()"
          >
            <FileAudio class="w-3.5 h-3.5 mr-1.5 text-white" />
            <span>Upload Audio</span>
          </Button>
        </div>
      </div>

      <!-- Language Mismatch Notice -->
      <div
        v-if="!isJapaneseSong"
        class="p-3.5 rounded-[14px] bg-[#212121] border border-[#2E2E2E] flex items-center justify-between gap-3 text-xs"
      >
        <div class="flex items-center gap-2.5">
          <AlertCircle class="w-4 h-4 text-white shrink-0" />
          <div class="text-[var(--text-secondary)]">
            <strong class="text-white">English / Latin Lyrics:</strong>
            Romaji generation is only available for songs with Japanese Kanji or Kana characters.
          </div>
        </div>
      </div>

      <!-- Studio Action Ribbon (Standardized Heights & Variants) -->
      <div class="p-3 bg-[#171717] border border-[#2E2E2E] rounded-[14px] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <!-- Left: Romaji Generator & View Switcher -->
        <div class="flex items-center gap-2 flex-wrap">
          <Button
            v-if="isJapaneseSong && !isRomajiConverted"
            variant="secondary"
            size="default"
            class="h-9 px-3.5 rounded-lg text-xs font-medium cursor-pointer"
            :disabled="isConvertingRomaji"
            @click="convertToRomaji"
          >
            <RefreshCw v-if="isConvertingRomaji" class="w-3.5 h-3.5 animate-spin mr-1.5 text-white" />
            <Sparkles v-else class="w-3.5 h-3.5 mr-1.5 text-white" />
            <span>{{ isConvertingRomaji ? 'Romanizing...' : 'Generate Romaji' }}</span>
          </Button>

          <Badge
            v-else-if="isRomajiConverted"
            variant="badge"
            class="h-9 px-3 text-xs flex items-center gap-1.5"
          >
            <CheckCircle2 class="w-4 h-4 text-white" />
            <span>Romaji Active</span>
          </Badge>

          <!-- View Mode: Karaoke Stage vs Raw LRC Editor -->
          <div class="flex items-center bg-[#212121] p-0.5 rounded-lg border border-[#2E2E2E]">
            <button
              class="px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
              :class="activeView === 'karaoke' ? 'bg-[#2E2E2E] text-white font-medium shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
              @click="activeView = 'karaoke'"
            >
              <Eye class="w-3.5 h-3.5 text-white" />
              <span>Karaoke Stage</span>
            </button>
            <button
              class="px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
              :class="activeView === 'raw' ? 'bg-[#2E2E2E] text-white font-medium shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
              @click="activeView = 'raw'"
            >
              <Code2 class="w-3.5 h-3.5 text-white" />
              <span>Raw Editor</span>
            </button>
          </div>
        </div>

        <!-- Right: Export Modes & Download -->
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Format Switcher -->
          <div class="flex items-center bg-[#212121] p-0.5 rounded-lg border border-[#2E2E2E]">
            <button
              type="button"
              class="px-2.5 py-1.5 text-xs rounded-md transition-colors cursor-pointer"
              :class="exportMode === 'dual' ? 'bg-[#2E2E2E] text-white font-medium shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
              @click="exportMode = 'dual'"
            >
              Dual-Line
            </button>
            <button
              type="button"
              class="px-2.5 py-1.5 text-xs rounded-md transition-colors cursor-pointer"
              :class="exportMode === 'romaji' ? 'bg-[#2E2E2E] text-white font-medium shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
              :disabled="!romajiLrc"
              @click="exportMode = 'romaji'"
            >
              Romaji
            </button>
            <button
              type="button"
              class="px-2.5 py-1.5 text-xs rounded-md transition-colors cursor-pointer"
              :class="exportMode === 'original' ? 'bg-[#2E2E2E] text-white font-medium shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
              @click="exportMode = 'original'"
            >
              Original
            </button>
          </div>

          <!-- Copy Button -->
          <Button
            variant="secondary"
            size="default"
            class="h-9 px-3.5 rounded-lg text-xs font-medium cursor-pointer"
            @click="copyLrc"
          >
            <Check v-if="hasCopied" class="w-3.5 h-3.5 mr-1.5 text-white" />
            <Copy v-else class="w-3.5 h-3.5 mr-1.5 text-white" />
            <span>{{ hasCopied ? 'Copied' : 'Copy' }}</span>
          </Button>

          <!-- Download Button -->
          <Button
            variant="primary"
            size="default"
            class="h-9 px-4 rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
            @click="downloadLrc"
          >
            <Download class="w-3.5 h-3.5 mr-1.5 text-black" />
            <span>Download .lrc</span>
          </Button>

          <!-- Close / New Search Button -->
          <Button
            variant="secondary"
            size="default"
            class="h-9 w-9 p-0 rounded-lg text-[var(--text-secondary)] hover:text-white cursor-pointer"
            title="Search another track"
            @click="resetWorkspace"
          >
            <X class="w-4 h-4 text-white" />
          </Button>
        </div>
      </div>

      <!-- Immersive Lyrics Canvas (Main Stage - Full-Width Fluid Flow) -->
      <div class="rounded-[14px] bg-[var(--bg-card)] border border-[var(--border-card)] p-6 sm:p-10 min-h-[520px] flex flex-col">
        <!-- Mode 1: Interactive Karaoke Live Scrolling View -->
        <div
          v-if="activeView === 'karaoke'"
          ref="karaokeContainerRef"
          class="flex-1 overflow-y-auto max-h-[550px] space-y-4 pr-3 select-none scroll-smooth"
        >
          <div
            v-for="(line, idx) in parsedLines"
            :key="line.id"
            :data-line-id="idx"
            class="p-4 rounded-xl cursor-pointer transition-all border group"
            :class="
              activeLineIndex === idx
                ? 'bg-[#212121] border-[#404040] shadow-xs'
                : 'bg-transparent border-transparent hover:bg-[#1A1A1D] hover:border-[#2E2E2E]'
            "
            @click="seekToLine(line.seconds)"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-1.5 flex-1">
                <!-- Original Text (Large crisp white) -->
                <div
                  class="text-base sm:text-lg transition-colors leading-relaxed"
                  :class="activeLineIndex === idx ? 'text-white font-bold' : 'text-[var(--text-secondary)] font-medium group-hover:text-white'"
                >
                  {{ line.originalText }}
                </div>

                <!-- Romaji Subline (Monochrome Crisp) -->
                <div
                  v-if="line.romajiText"
                  class="text-xs sm:text-sm font-mono transition-colors"
                  :class="activeLineIndex === idx ? 'text-white font-semibold' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]'"
                >
                  {{ line.romajiText }}
                </div>
              </div>

              <!-- Timestamp -->
              <span
                class="text-xs font-mono px-2 py-0.5 rounded shrink-0 transition-colors"
                :class="activeLineIndex === idx ? 'bg-[#2E2E2E] text-white font-bold border border-[#404040]' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]'"
              >
                {{ line.timeTag }}
              </span>
            </div>
          </div>
        </div>

        <!-- Mode 2: Raw LRC Textarea Editor -->
        <div v-else class="flex-1 flex flex-col space-y-2">
          <div class="flex items-center justify-between text-xs text-[var(--text-secondary)] pb-1 font-mono">
            <span>Raw .lrc Content (Editable)</span>
            <span>Lines: {{ rawEditedLrc.split('\n').length }}</span>
          </div>
          <textarea
            v-model="rawEditedLrc"
            class="w-full flex-1 min-h-[480px] p-4 text-xs font-mono bg-[#171717] border border-[#2E2E2E] rounded-xl text-white focus:outline-none focus:border-[#404040] resize-y leading-relaxed"
            placeholder="[00:00.00] Lyrics..."
          ></textarea>
        </div>
      </div>
    </div>
  </div>
</template>
