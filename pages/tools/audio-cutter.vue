<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import {
  Music,
  Play,
  Pause,
  RotateCcw,
  Download,
  Upload,
  Volume2,
  VolumeX,
  Scissors,
  Sliders,
  Clock,
  Radio,
  FileAudio,
  Film,
  Check,
  ZoomIn,
  ZoomOut,
  Repeat,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Settings2,
  Layers,
  FastForward,
  Rewind,
  Maximize2,
  Trash2,
  Undo2,
  Redo2,
  Plus,
  X,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Activity
} from 'lucide-vue-next'
import { Mp3Encoder } from '@breezystack/lamejs'
import { useToast } from '~/composables/useToast'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

const toast = useToast()

interface AudioKeyframe {
  id: string
  timeOffset: number   // time in seconds relative to clip start (0 to clipDuration)
  volume: number       // 0.0 to 2.0 (1.0 = 100% normal)
}

interface MediaAsset {
  id: string
  name: string
  size: number
  duration: number
  sampleRate: number
  channels: number
  buffer: AudioBuffer
}

interface AudioClip {
  id: string
  mediaId: string          // references MediaAsset.id
  name: string
  sourceStart: number      // start seconds in source buffer
  sourceEnd: number        // end seconds in source buffer
  timelineStart: number    // placement on master timeline (seconds)
  trackIndex: number       // 0 for A1, 1 for A2, etc.
  volume?: number          // base volume multiplier (1.0 default)
  keyframes?: AudioKeyframe[]
}

interface TrackInfo {
  id: string
  name: string
  isMuted: boolean
}

const rulerCanvasRef = ref<HTMLCanvasElement | null>(null)
const timelineBodyRef = ref<HTMLDivElement | null>(null)
const addMediaInputRef = ref<HTMLInputElement | null>(null)

const isDecoding = ref(false)
const isExporting = ref(false)
const isPlaying = ref(false)
const isLooping = ref(false)

const fileName = ref<string>('')
const fileSize = ref<number>(0)
const isVideoSource = ref(false)

let audioCtx: AudioContext | null = null
const currentAudioBuffer = shallowRef<AudioBuffer | null>(null)
const mediaAssets = shallowRef<Map<string, MediaAsset>>(new Map())
let activeSourceNodes: AudioBufferSourceNode[] = []
let activeGainNodes: GainNode[] = []
let masterGainNode: GainNode | null = null

const audioDuration = ref<number>(0)
const sampleRate = ref<number>(44100)
const channelCount = ref<number>(2)

const currentTime = ref<number>(0)
const volume = ref<number>(1)
const isMuted = ref<boolean>(false)
const playbackSpeed = ref<number>(1)
const exportFormat = ref<'mp3' | 'wav'>('mp3')
const mp3Bitrate = ref<number>(320)
const exportFileName = ref<string>('')

// Multi-Clip & Multi-Track System (Default 1 Track)
const tracks = ref<TrackInfo[]>([
  { id: 'track-1', name: 'A1', isMuted: false }
])
const selectedTrackIndex = ref<number>(0)
const clips = ref<AudioClip[]>([])
const selectedClipId = ref<string | null>(null)

const selectTrack = (tIndex: number) => {
  selectedTrackIndex.value = tIndex
  const clipOnTrack = clips.value.find(c => c.trackIndex === tIndex)
  if (clipOnTrack && (!selectedClip.value || selectedClip.value.trackIndex !== tIndex)) {
    selectedClipId.value = clipOnTrack.id
  }
}

// Dragging & Interaction State
const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

// Timeline Dragging Interaction
type DragMode = 'move-clip' | 'trim-start' | 'trim-end' | 'playhead' | null
const dragMode = ref<DragMode>(null)
const draggingClipId = ref<string | null>(null)
let dragStartX = 0
let dragStartY = 0
let initialTimelineStart = 0
let initialSourceStart = 0
let initialSourceEnd = 0
let initialTrackIndex = 0

// History Stack for Undo / Redo
const historyStack = ref<string[]>([])
const historyIndex = ref<number>(-1)

const recordHistory = () => {
  const snapshot = JSON.stringify(clips.value)
  if (historyIndex.value >= 0 && historyStack.value[historyIndex.value] === snapshot) {
    return
  }
  historyStack.value = historyStack.value.slice(0, historyIndex.value + 1)
  historyStack.value.push(snapshot)
  historyIndex.value = historyStack.value.length - 1
}

const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < historyStack.value.length - 1)

const undo = () => {
  if (!canUndo.value) return
  historyIndex.value--
  clips.value = JSON.parse(historyStack.value[historyIndex.value])
  drawAllClipWaveforms()
  drawRuler()
  toast.info('Undo', 'Reverted timeline change')
}

const redo = () => {
  if (!canRedo.value) return
  historyIndex.value++
  clips.value = JSON.parse(historyStack.value[historyIndex.value])
  drawAllClipWaveforms()
  drawRuler()
  toast.info('Redo', 'Restored timeline change')
}

// Master Timeline Duration (Dynamic max of all clips)
const totalTimelineDuration = computed(() => {
  let max = audioDuration.value || 10
  for (const c of clips.value) {
    const end = c.timelineStart + (c.sourceEnd - c.sourceStart)
    if (end > max) max = end
  }
  return Math.max(max, 1)
})

const selectedClip = computed(() => {
  return clips.value.find(c => c.id === selectedClipId.value) || null
})

// Calculate Volume at a relative time in a clip with linear interpolation
const getClipVolumeAtTime = (clip: AudioClip, relativeTime: number): number => {
  const baseVol = clip.volume !== undefined ? clip.volume : 1.0
  if (!clip.keyframes || clip.keyframes.length === 0) {
    return baseVol
  }

  const kfs = [...clip.keyframes].sort((a, b) => a.timeOffset - b.timeOffset)
  if (relativeTime <= kfs[0].timeOffset) {
    return kfs[0].volume
  }
  if (relativeTime >= kfs[kfs.length - 1].timeOffset) {
    return kfs[kfs.length - 1].volume
  }

  for (let i = 0; i < kfs.length - 1; i++) {
    const kf1 = kfs[i]
    const kf2 = kfs[i + 1]
    if (relativeTime >= kf1.timeOffset && relativeTime <= kf2.timeOffset) {
      const diff = kf2.timeOffset - kf1.timeOffset
      if (diff === 0) return kf1.volume
      const progress = (relativeTime - kf1.timeOffset) / diff
      return kf1.volume + (kf2.volume - kf1.volume) * progress
    }
  }
  return baseVol
}

// Check if playhead is currently positioned on a keyframe
const isPlayheadOnKeyframe = computed(() => {
  if (!selectedClip.value) return false
  const clip = selectedClip.value
  const offset = currentTime.value - clip.timelineStart
  const clipDur = clip.sourceEnd - clip.sourceStart
  if (offset < 0 || offset > clipDur) return false
  const kfs = clip.keyframes || []
  return kfs.some(k => Math.abs(k.timeOffset - offset) < 0.08)
})

// Toggle Add/Remove Keyframe at Playhead Position
const toggleKeyframeAtPlayhead = () => {
  if (!selectedClip.value) {
    toast.warning('No Clip Selected', 'Select an audio clip to add keyframes')
    return
  }
  const clip = selectedClip.value
  const offset = currentTime.value - clip.timelineStart
  const clipDur = clip.sourceEnd - clip.sourceStart

  if (offset < 0 || offset > clipDur) {
    toast.warning('Outside Clip', 'Place playhead inside the selected clip to add keyframe')
    return
  }

  if (!clip.keyframes) clip.keyframes = []

  const existingIdx = clip.keyframes.findIndex(k => Math.abs(k.timeOffset - offset) < 0.08)
  if (existingIdx !== -1) {
    clip.keyframes.splice(existingIdx, 1)
    recordHistory()
    drawAllClipWaveforms()
    toast.info('Keyframe Removed', `Removed keyframe at ${formatTimecode(currentTime.value)}`)
  } else {
    const currentVol = getClipVolumeAtTime(clip, offset)
    clip.keyframes.push({
      id: `kf-${Date.now()}`,
      timeOffset: Number(offset.toFixed(3)),
      volume: Number(currentVol.toFixed(2))
    })
    clip.keyframes.sort((a, b) => a.timeOffset - b.timeOffset)
    recordHistory()
    drawAllClipWaveforms()
    toast.success('Keyframe Added', `Added volume keyframe at ${formatTimecode(currentTime.value)}`)
  }
}

// Keyframe Preset: Fade In (1.5s)
const applyFadeIn = (duration = 1.5) => {
  if (!selectedClip.value) return
  const clip = selectedClip.value
  const clipDur = clip.sourceEnd - clip.sourceStart
  const actualDur = Math.min(duration, clipDur / 2)

  if (!clip.keyframes) clip.keyframes = []
  // Remove any keyframes within the fade-in zone
  clip.keyframes = clip.keyframes.filter(k => k.timeOffset > actualDur)

  clip.keyframes.push({
    id: `kf-${Date.now()}-in-0`,
    timeOffset: 0,
    volume: 0
  })
  clip.keyframes.push({
    id: `kf-${Date.now()}-in-1`,
    timeOffset: Number(actualDur.toFixed(2)),
    volume: 1.0
  })
  clip.keyframes.sort((a, b) => a.timeOffset - b.timeOffset)

  recordHistory()
  drawAllClipWaveforms()
  toast.success('Fade In Applied', `Created ${actualDur.toFixed(1)}s smooth fade-in curve`)
}

// Keyframe Preset: Fade Out (1.5s)
const applyFadeOut = (duration = 1.5) => {
  if (!selectedClip.value) return
  const clip = selectedClip.value
  const clipDur = clip.sourceEnd - clip.sourceStart
  const actualDur = Math.min(duration, clipDur / 2)
  const startTime = clipDur - actualDur

  if (!clip.keyframes) clip.keyframes = []
  // Remove any keyframes within the fade-out zone
  clip.keyframes = clip.keyframes.filter(k => k.timeOffset < startTime)

  clip.keyframes.push({
    id: `kf-${Date.now()}-out-0`,
    timeOffset: Number(startTime.toFixed(2)),
    volume: 1.0
  })
  clip.keyframes.push({
    id: `kf-${Date.now()}-out-1`,
    timeOffset: Number(clipDur.toFixed(2)),
    volume: 0
  })
  clip.keyframes.sort((a, b) => a.timeOffset - b.timeOffset)

  recordHistory()
  drawAllClipWaveforms()
  toast.success('Fade Out Applied', `Created ${actualDur.toFixed(1)}s smooth fade-out curve`)
}

// Keyframe Preset: Audio Ducking (-60% volume)
const applyDucking = () => {
  if (!selectedClip.value) return
  const clip = selectedClip.value
  const clipDur = clip.sourceEnd - clip.sourceStart
  if (clipDur < 2) {
    toast.warning('Clip Too Short', 'Ducking requires clip duration of at least 2 seconds')
    return
  }

  if (!clip.keyframes) clip.keyframes = []
  clip.keyframes = [
    { id: `kf-${Date.now()}-1`, timeOffset: 0, volume: 1.0 },
    { id: `kf-${Date.now()}-2`, timeOffset: 0.5, volume: 0.35 },
    { id: `kf-${Date.now()}-3`, timeOffset: Number((clipDur - 0.5).toFixed(2)), volume: 0.35 },
    { id: `kf-${Date.now()}-4`, timeOffset: Number(clipDur.toFixed(2)), volume: 1.0 }
  ]

  recordHistory()
  drawAllClipWaveforms()
  toast.success('Ducking Applied', 'Lowered background volume by 65%')
}

// Clear all keyframes on selected clip
const clearKeyframes = () => {
  if (!selectedClip.value) return
  selectedClip.value.keyframes = []
  recordHistory()
  drawAllClipWaveforms()
  toast.info('Keyframes Cleared', 'Reset volume automation curve')
}

// Remove single keyframe
const removeKeyframe = (kfId: string) => {
  if (!selectedClip.value || !selectedClip.value.keyframes) return
  selectedClip.value.keyframes = selectedClip.value.keyframes.filter(k => k.id !== kfId)
  recordHistory()
  drawAllClipWaveforms()
}

// Jump to previous keyframe
const jumpToPrevKeyframe = () => {
  if (!selectedClip.value || !selectedClip.value.keyframes || selectedClip.value.keyframes.length === 0) return
  const clip = selectedClip.value
  const kfs = clip.keyframes || []
  const offset = currentTime.value - clip.timelineStart
  const prevKfs = kfs.filter(k => k.timeOffset < offset - 0.05)
  if (prevKfs.length > 0) {
    const targetKf = prevKfs[prevKfs.length - 1]
    currentTime.value = Number((clip.timelineStart + targetKf.timeOffset).toFixed(3))
  }
}

// Jump to next keyframe
const jumpToNextKeyframe = () => {
  if (!selectedClip.value || !selectedClip.value.keyframes || selectedClip.value.keyframes.length === 0) return
  const clip = selectedClip.value
  const kfs = clip.keyframes || []
  const offset = currentTime.value - clip.timelineStart
  const nextKf = kfs.find(k => k.timeOffset > offset + 0.05)
  if (nextKf) {
    currentTime.value = Number((clip.timelineStart + nextKf.timeOffset).toFixed(3))
  }
}

let playbackStartTime = 0
let playbackOffset = 0
let animationFrameId: number | null = null

const formatTimecode = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) seconds = 0
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const millis = Math.floor((seconds % 1) * 1000)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

const getAudioContext = () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    audioCtx = new AudioContextClass()
    masterGainNode = audioCtx.createGain()
    masterGainNode.connect(audioCtx.destination)
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

// Draw Top Timecode Ruler
const drawRuler = () => {
  const canvas = rulerCanvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0) return

  const dpr = window.devicePixelRatio || 1
  canvas.width = rect.width * dpr
  canvas.height = 24 * dpr
  ctx.scale(dpr, dpr)

  const width = rect.width
  const height = 24
  ctx.clearRect(0, 0, width, height)

  const duration = totalTimelineDuration.value
  if (duration <= 0) return

  const tickInterval = duration > 120 ? 20 : duration > 60 ? 10 : duration > 20 ? 5 : 1
  const numIntervals = Math.floor(duration / tickInterval)

  ctx.fillStyle = '#71717a'
  ctx.font = '9px monospace'
  ctx.textAlign = 'left'

  for (let i = 0; i <= numIntervals; i++) {
    const time = i * tickInterval
    const percent = time / duration
    const x = percent * width

    ctx.fillStyle = '#52525b'
    ctx.fillRect(x, 14, 1, 10)

    const label = `${Math.floor(time / 60)}:${(time % 60).toString().padStart(2, '0')}`
    ctx.fillStyle = '#a1a1aa'
    ctx.fillText(label, x + 3, 10)
  }
}

// Draw Mini Waveform + Keyframe Envelope Curve for each clip
const drawClipWaveform = (canvas: HTMLCanvasElement, clip: AudioClip) => {
  const asset = mediaAssets.value.get(clip.mediaId)
  const buffer = asset ? asset.buffer : currentAudioBuffer.value
  if (!canvas || !buffer) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return

  const dpr = window.devicePixelRatio || 1
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)

  const width = rect.width
  const height = rect.height
  ctx.clearRect(0, 0, width, height)

  const rawData = buffer.getChannelData(0)
  const totalSamples = rawData.length
  const bufferDuration = buffer.duration

  const startSample = Math.floor((clip.sourceStart / bufferDuration) * totalSamples)
  const endSample = Math.floor((clip.sourceEnd / bufferDuration) * totalSamples)
  const clipSamples = endSample - startSample
  if (clipSamples <= 0) return

  const barWidth = 2.5
  const barGap = 1.5
  const step = barWidth + barGap
  const totalBars = Math.floor(width / step)
  const samplesPerBar = Math.floor(clipSamples / totalBars)

  ctx.fillStyle = selectedClipId.value === clip.id ? '#ffffff' : 'rgba(255, 255, 255, 0.7)'

  for (let i = 0; i < totalBars; i++) {
    const barX = i * step
    const sampleIndex = startSample + i * samplesPerBar

    let min = 1.0
    let max = -1.0
    const checkCount = Math.min(samplesPerBar, 80)
    for (let j = 0; j < checkCount; j++) {
      const datum = rawData[sampleIndex + Math.floor((j * samplesPerBar) / checkCount)] || 0
      if (datum < min) min = datum
      if (datum > max) max = datum
    }

    const amplitude = Math.max(Math.abs(min), Math.abs(max))
    const barHeight = Math.max(amplitude * (height * 0.75), 2)
    const barY = (height - barHeight) / 2

    ctx.beginPath()
    ctx.roundRect(barX, barY, barWidth, barHeight, 1)
    ctx.fill()
  }

  // Draw Keyframe Volume Automation Envelope Curve & Diamonds
  if (clip.keyframes && clip.keyframes.length > 0) {
    const clipDur = clip.sourceEnd - clip.sourceStart
    const kfs = [...clip.keyframes].sort((a, b) => a.timeOffset - b.timeOffset)

    // Draw connecting envelope line
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.beginPath()

    // Start point
    const firstVol = kfs[0].volume
    const firstY = height - Math.max(4, Math.min(height - 4, (firstVol / 1.5) * height))
    ctx.moveTo(0, firstY)

    kfs.forEach(kf => {
      const kfX = (kf.timeOffset / clipDur) * width
      const kfY = height - Math.max(4, Math.min(height - 4, (kf.volume / 1.5) * height))
      ctx.lineTo(kfX, kfY)
    })

    // End point
    const lastVol = kfs[kfs.length - 1].volume
    const lastY = height - Math.max(4, Math.min(height - 4, (lastVol / 1.5) * height))
    ctx.lineTo(width, lastY)
    ctx.stroke()

    // Draw diamond nodes at each keyframe
    kfs.forEach(kf => {
      const kfX = (kf.timeOffset / clipDur) * width
      const kfY = height - Math.max(4, Math.min(height - 4, (kf.volume / 1.5) * height))

      ctx.save()
      ctx.translate(kfX, kfY)
      ctx.rotate(Math.PI / 4)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(-3.5, -3.5, 7, 7)
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 1
      ctx.strokeRect(-3.5, -3.5, 7, 7)
      ctx.restore()
    })
  }
}

const drawAllClipWaveforms = () => {
  nextTick(() => {
    clips.value.forEach(clip => {
      const canvas = document.getElementById(`canvas-${clip.id}`) as HTMLCanvasElement
      if (canvas) {
        drawClipWaveform(canvas, clip)
      }
    })
  })
}

// Initial Media Upload (Creates new project)
const processMediaFile = async (file: File) => {
  fileName.value = file.name
  exportFileName.value = file.name.replace(/\.[^/.]+$/, '') + `_mashup.${exportFormat.value}`
  fileSize.value = file.size
  isVideoSource.value = file.type.startsWith('video/')

  isDecoding.value = true
  stopPlayback()

  try {
    const arrayBuffer = await file.arrayBuffer()
    const ctx = getAudioContext()
    const decoded = await ctx.decodeAudioData(arrayBuffer)

    currentAudioBuffer.value = decoded
    audioDuration.value = decoded.duration
    sampleRate.value = decoded.sampleRate
    channelCount.value = decoded.numberOfChannels
    currentTime.value = 0

    // Store in Media Pool
    const mediaId = `media-${Date.now()}`
    const newAsset: MediaAsset = {
      id: mediaId,
      name: file.name,
      size: file.size,
      duration: decoded.duration,
      sampleRate: decoded.sampleRate,
      channels: decoded.numberOfChannels,
      buffer: decoded
    }
    const newPool = new Map<string, MediaAsset>()
    newPool.set(mediaId, newAsset)
    mediaAssets.value = newPool

    // Reset tracks to 1 track on new upload
    tracks.value = [
      { id: `track-${Date.now()}`, name: 'A1', isMuted: false }
    ]
    selectedTrackIndex.value = 0

    // Initialize with 1 Master Clip on Track A1
    const newClip: AudioClip = {
      id: `clip-${Date.now()}`,
      mediaId,
      name: file.name,
      sourceStart: 0,
      sourceEnd: decoded.duration,
      timelineStart: 0,
      trackIndex: 0,
      volume: 1.0,
      keyframes: []
    }
    clips.value = [newClip]
    selectedClipId.value = newClip.id

    // Initialize History Stack
    historyStack.value = [JSON.stringify(clips.value)]
    historyIndex.value = 0

    toast.success('Audio Decoded', `Loaded ${decoded.numberOfChannels === 2 ? 'Stereo' : 'Mono'} (${decoded.sampleRate} Hz)`)
    await nextTick()
    setTimeout(() => {
      drawAllClipWaveforms()
      drawRuler()
    }, 60)
  } catch (err: any) {
    toast.error('Decoding Failed', 'Unable to decode media file. Please upload standard MP3, WAV, AAC, or MP4.')
  } finally {
    isDecoding.value = false
  }
}

// Add Extra Media for Mashup (Append to project)
const addExtraMediaFiles = async (files: FileList | File[]) => {
  if (!currentAudioBuffer.value) {
    if (files.length > 0) {
      await processMediaFile(files[0])
    }
    return
  }

  isDecoding.value = true
  try {
    const ctx = getAudioContext()

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const arrayBuffer = await file.arrayBuffer()
      const decoded = await ctx.decodeAudioData(arrayBuffer)

      const mediaId = `media-${Date.now()}-${i}`
      const newAsset: MediaAsset = {
        id: mediaId,
        name: file.name,
        size: file.size,
        duration: decoded.duration,
        sampleRate: decoded.sampleRate,
        channels: decoded.numberOfChannels,
        buffer: decoded
      }

      mediaAssets.value.set(mediaId, newAsset)

      // Auto-assign to a new track
      const targetTrackIdx = tracks.value.length
      tracks.value.push({
        id: `track-${Date.now()}-${i}`,
        name: `A${targetTrackIdx + 1}`,
        isMuted: false
      })
      selectedTrackIndex.value = targetTrackIdx

      const newClip: AudioClip = {
        id: `clip-${Date.now()}-${i}`,
        mediaId,
        name: file.name,
        sourceStart: 0,
        sourceEnd: decoded.duration,
        timelineStart: currentTime.value || 0,
        trackIndex: targetTrackIdx,
        volume: 1.0,
        keyframes: []
      }

      clips.value.push(newClip)
      selectedClipId.value = newClip.id
    }

    recordHistory()
    toast.success('Media Added', `Imported ${files.length} audio file(s) for mashup`)
    await nextTick()
    setTimeout(() => {
      drawAllClipWaveforms()
      drawRuler()
    }, 60)
  } catch (err: any) {
    toast.error('Import Failed', err.message || 'Unable to decode one or more media files.')
  } finally {
    isDecoding.value = false
  }
}

const handleFileInputChange = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  processMediaFile(input.files[0])
  input.value = ''
}

const handleAddMediaInputChange = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  addExtraMediaFiles(input.files)
  input.value = ''
}

const onDrop = (e: DragEvent) => {
  isDragging.value = false
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    if (currentAudioBuffer.value) {
      addExtraMediaFiles(e.dataTransfer.files)
    } else {
      processMediaFile(e.dataTransfer.files[0])
    }
  }
}

// Multi-Track, Multi-Buffer & Keyframe Automation Playback Engine
const updatePlaybackPosition = () => {
  if (!isPlaying.value || !audioCtx) return

  const elapsed = (audioCtx.currentTime - playbackStartTime) * playbackSpeed.value
  const pos = playbackOffset + elapsed

  if (pos >= totalTimelineDuration.value) {
    if (isLooping.value) {
      playAudio()
    } else {
      stopPlayback()
      currentTime.value = 0
    }
    return
  }

  currentTime.value = pos
  animationFrameId = requestAnimationFrame(updatePlaybackPosition)
}

const playAudio = () => {
  if (clips.value.length === 0) return
  const ctx = getAudioContext()

  stopPlayback()

  playbackOffset = currentTime.value
  playbackStartTime = ctx.currentTime

  activeSourceNodes = []
  activeGainNodes = []

  clips.value.forEach(clip => {
    const track = tracks.value[clip.trackIndex]
    if (track && track.isMuted) return

    const asset = mediaAssets.value.get(clip.mediaId)
    const buffer = asset ? asset.buffer : currentAudioBuffer.value
    if (!buffer) return

    const clipDuration = clip.sourceEnd - clip.sourceStart
    const clipTimelineEnd = clip.timelineStart + clipDuration

    if (clipTimelineEnd <= currentTime.value) return // already finished

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = playbackSpeed.value

    // Per-clip gain node for volume & keyframe automation
    const clipGain = ctx.createGain()
    const baseClipVol = clip.volume !== undefined ? clip.volume : 1.0

    // Connect nodes
    source.connect(clipGain)
    if (masterGainNode) {
      masterGainNode.gain.value = isMuted.value ? 0 : volume.value
      clipGain.connect(masterGainNode)
    } else {
      clipGain.connect(ctx.destination)
    }

    const currentOffsetInClip = Math.max(0, currentTime.value - clip.timelineStart)
    const initialVol = getClipVolumeAtTime(clip, currentOffsetInClip)
    clipGain.gain.setValueAtTime(initialVol * baseClipVol, ctx.currentTime)

    // Schedule linear ramps for keyframes occurring after currentTime
    if (clip.keyframes && clip.keyframes.length > 0) {
      const kfs = [...clip.keyframes].sort((a, b) => a.timeOffset - b.timeOffset)
      kfs.forEach(kf => {
        const kfTimelineTime = clip.timelineStart + kf.timeOffset
        if (kfTimelineTime > currentTime.value) {
          const delay = (kfTimelineTime - currentTime.value) / playbackSpeed.value
          clipGain.gain.linearRampToValueAtTime(kf.volume * baseClipVol, ctx.currentTime + delay)
        }
      })
    }

    if (currentTime.value <= clip.timelineStart) {
      // Starts in the future
      const delay = (clip.timelineStart - currentTime.value) / playbackSpeed.value
      source.start(ctx.currentTime + delay, clip.sourceStart, clipDuration)
    } else {
      // Currently inside this clip
      const offsetInClip = currentTime.value - clip.timelineStart
      const remainingClipDuration = clipDuration - offsetInClip
      source.start(ctx.currentTime, clip.sourceStart + offsetInClip, remainingClipDuration)
    }

    activeSourceNodes.push(source)
    activeGainNodes.push(clipGain)
  })

  isPlaying.value = true
  animationFrameId = requestAnimationFrame(updatePlaybackPosition)
}

const pauseAudio = () => {
  stopPlayback()
}

const togglePlay = () => {
  if (isPlaying.value) {
    pauseAudio()
  } else {
    playAudio()
  }
}

const stopPlayback = () => {
  activeSourceNodes.forEach(node => {
    try {
      node.stop()
      node.disconnect()
    } catch {}
  })
  activeSourceNodes = []
  activeGainNodes = []

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  isPlaying.value = false
}

const seekRelative = (delta: number) => {
  const next = Math.max(0, Math.min(totalTimelineDuration.value, currentTime.value + delta))
  currentTime.value = next
  if (isPlaying.value) {
    playAudio()
  }
}

// Interactive Multi-Track Dragging System (Kiri/Kanan & Atas/Bawah)
const startClipDrag = (e: MouseEvent, clip: AudioClip, mode: 'move-clip' | 'trim-start' | 'trim-end') => {
  e.stopPropagation()
  selectedClipId.value = clip.id
  selectedTrackIndex.value = clip.trackIndex
  dragMode.value = mode
  draggingClipId.value = clip.id
  dragStartX = e.clientX
  dragStartY = e.clientY
  initialTimelineStart = clip.timelineStart
  initialSourceStart = clip.sourceStart
  initialSourceEnd = clip.sourceEnd
  initialTrackIndex = clip.trackIndex

  window.addEventListener('mousemove', onGlobalMouseMove)
  window.addEventListener('mouseup', onGlobalMouseUp)
}

const startRulerDrag = (e: MouseEvent) => {
  const rect = rulerCanvasRef.value?.getBoundingClientRect()
  if (!rect) return
  const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  currentTime.value = Number((percent * totalTimelineDuration.value).toFixed(3))
  dragMode.value = 'playhead'
  if (isPlaying.value) playAudio()

  window.addEventListener('mousemove', onGlobalMouseMove)
  window.addEventListener('mouseup', onGlobalMouseUp)
}

const startPlayheadDrag = (e: MouseEvent) => {
  e.stopPropagation()
  dragMode.value = 'playhead'
  if (timelineBodyRef.value) {
    const rect = timelineBodyRef.value.getBoundingClientRect()
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    currentTime.value = Number((percent * totalTimelineDuration.value).toFixed(3))
    if (isPlaying.value) playAudio()
  }

  window.addEventListener('mousemove', onGlobalMouseMove)
  window.addEventListener('mouseup', onGlobalMouseUp)
}

const onTimelineBodyMouseDown = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('.cursor-grab') || (e.target as HTMLElement).closest('button')) {
    return
  }
  startPlayheadDrag(e)
}

const onGlobalMouseMove = (e: MouseEvent) => {
  if (!dragMode.value || !timelineBodyRef.value) return

  const rect = timelineBodyRef.value.getBoundingClientRect()
  const pxPerSec = rect.width / totalTimelineDuration.value
  const deltaX = e.clientX - dragStartX
  const deltaSec = deltaX / pxPerSec

  if (dragMode.value === 'playhead') {
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    currentTime.value = Number((percent * totalTimelineDuration.value).toFixed(3))
    return
  }

  const clip = clips.value.find(c => c.id === draggingClipId.value)
  if (!clip) return

  if (dragMode.value === 'move-clip') {
    // Horizontal Movement (Kiri / Kanan)
    const newStart = Math.max(0, initialTimelineStart + deltaSec)
    clip.timelineStart = Number(newStart.toFixed(3))

    // Vertical Movement across Tracks (Atas / Bawah)
    const deltaY = e.clientY - dragStartY
    const trackHeight = 64 // height per track row
    const trackOffset = Math.round(deltaY / trackHeight)
    const newTrackIndex = Math.max(0, Math.min(tracks.value.length - 1, initialTrackIndex + trackOffset))
    clip.trackIndex = newTrackIndex
    selectedTrackIndex.value = newTrackIndex

    drawAllClipWaveforms()
  } else if (dragMode.value === 'trim-start') {
    // Drag Left Trim Handle
    const newSourceStart = Math.max(0, Math.min(initialSourceEnd - 0.2, initialSourceStart + deltaSec))
    const actualDelta = newSourceStart - initialSourceStart
    clip.sourceStart = Number(newSourceStart.toFixed(3))
    clip.timelineStart = Math.max(0, Number((initialTimelineStart + actualDelta).toFixed(3)))
    drawAllClipWaveforms()
  } else if (dragMode.value === 'trim-end') {
    // Drag Right Trim Handle
    const asset = mediaAssets.value.get(clip.mediaId)
    const maxSource = asset ? asset.duration : (currentAudioBuffer.value ? currentAudioBuffer.value.duration : 1000)
    const newSourceEnd = Math.min(maxSource, Math.max(initialSourceStart + 0.2, initialSourceEnd + deltaSec))
    clip.sourceEnd = Number(newSourceEnd.toFixed(3))
    drawAllClipWaveforms()
  }
}

const onGlobalMouseUp = () => {
  if (dragMode.value === 'move-clip' || dragMode.value === 'trim-start' || dragMode.value === 'trim-end') {
    recordHistory()
  }
  if (dragMode.value === 'playhead' && isPlaying.value) {
    playAudio()
  }
  dragMode.value = null
  draggingClipId.value = null
  window.removeEventListener('mousemove', onGlobalMouseMove)
  window.removeEventListener('mouseup', onGlobalMouseUp)
}

// Resolve Target Clip Based on Current Active Track & Selection
const getTargetClipAtPlayhead = (): AudioClip | null => {
  if (selectedClipId.value) {
    const sel = clips.value.find(c => c.id === selectedClipId.value)
    if (sel) {
      const dur = sel.sourceEnd - sel.sourceStart
      if (currentTime.value >= sel.timelineStart && currentTime.value <= sel.timelineStart + dur) {
        return sel
      }
    }
  }

  if (selectedTrackIndex.value !== null) {
    const trackClip = clips.value.find(c => {
      if (c.trackIndex !== selectedTrackIndex.value) return false
      const dur = c.sourceEnd - c.sourceStart
      return currentTime.value >= c.timelineStart && currentTime.value <= c.timelineStart + dur
    })
    if (trackClip) return trackClip
  }

  return clips.value.find(c => {
    const dur = c.sourceEnd - c.sourceStart
    return currentTime.value >= c.timelineStart && currentTime.value <= c.timelineStart + dur
  }) || null
}

// CapCut Split / Cut Action
const splitAtPlayhead = () => {
  const target = getTargetClipAtPlayhead()

  if (!target) {
    toast.warning('Split Unavailable', 'Select a clip or place playhead inside an audio clip to split')
    return
  }

  const clipDur = target.sourceEnd - target.sourceStart
  if (currentTime.value <= target.timelineStart || currentTime.value >= target.timelineStart + clipDur) {
    toast.warning('Split Out of Bounds', 'Playhead must be inside the selected clip to split')
    return
  }

  const offsetInClip = currentTime.value - target.timelineStart
  const splitSourceTime = target.sourceStart + offsetInClip

  const targetTrackIdx = target.trackIndex
  const newTrackIdx = targetTrackIdx + 1
  if (newTrackIdx >= tracks.value.length) {
    const nextNum = tracks.value.length + 1
    tracks.value.push({
      id: `track-${Date.now()}`,
      name: `A${nextNum}`,
      isMuted: false
    })
  }

  // Clip 1 remains on original track
  const clip1: AudioClip = {
    ...target,
    id: `clip-${Date.now()}-1`,
    sourceEnd: splitSourceTime,
    keyframes: target.keyframes?.filter(k => k.timeOffset < offsetInClip) || []
  }

  // Clip 2 is moved to the track below
  const clip2: AudioClip = {
    id: `clip-${Date.now()}-2`,
    mediaId: target.mediaId,
    name: target.name,
    sourceStart: splitSourceTime,
    sourceEnd: target.sourceEnd,
    timelineStart: currentTime.value,
    trackIndex: newTrackIdx,
    volume: target.volume,
    keyframes: (target.keyframes || [])
      .filter(k => k.timeOffset >= offsetInClip)
      .map(k => ({ ...k, id: `kf-${Date.now()}-${Math.random()}`, timeOffset: k.timeOffset - offsetInClip }))
  }

  const idx = clips.value.findIndex(c => c.id === target.id)
  clips.value.splice(idx, 1, clip1, clip2)
  selectedClipId.value = clip2.id
  selectedTrackIndex.value = newTrackIdx

  recordHistory()
  drawAllClipWaveforms()
  toast.success('Audio Split', `Created new clip on Track A${newTrackIdx + 1}`)
}

// Split Left
const splitLeft = () => {
  const target = getTargetClipAtPlayhead()

  if (!target) {
    toast.warning('Trim Unavailable', 'Select a clip or place playhead inside an audio clip')
    return
  }

  const clipDur = target.sourceEnd - target.sourceStart
  if (currentTime.value <= target.timelineStart || currentTime.value >= target.timelineStart + clipDur) {
    toast.warning('Trim Out of Bounds', 'Playhead must be inside the clip to trim')
    return
  }

  const offsetInClip = currentTime.value - target.timelineStart
  target.sourceStart += offsetInClip
  target.timelineStart = currentTime.value

  if (target.keyframes) {
    target.keyframes = target.keyframes
      .filter(k => k.timeOffset >= offsetInClip)
      .map(k => ({ ...k, timeOffset: k.timeOffset - offsetInClip }))
  }

  recordHistory()
  drawAllClipWaveforms()
  toast.info('Trim Left', `Cut left portion of ${target.name}`)
}

// Split Right
const splitRight = () => {
  const target = getTargetClipAtPlayhead()

  if (!target) {
    toast.warning('Trim Unavailable', 'Select a clip or place playhead inside an audio clip')
    return
  }

  const clipDur = target.sourceEnd - target.sourceStart
  if (currentTime.value <= target.timelineStart || currentTime.value >= target.timelineStart + clipDur) {
    toast.warning('Trim Out of Bounds', 'Playhead must be inside the clip to trim')
    return
  }

  const offsetInClip = currentTime.value - target.timelineStart
  target.sourceEnd = target.sourceStart + offsetInClip

  if (target.keyframes) {
    target.keyframes = target.keyframes.filter(k => k.timeOffset <= offsetInClip)
  }

  recordHistory()
  drawAllClipWaveforms()
  toast.info('Trim Right', `Cut right portion of ${target.name}`)
}

// Delete Selected Clip
const deleteSelectedClip = () => {
  if (!selectedClipId.value) {
    toast.warning('No Clip Selected', 'Click on a clip in the timeline to select it')
    return
  }

  const idx = clips.value.findIndex(c => c.id === selectedClipId.value)
  if (idx !== -1) {
    clips.value.splice(idx, 1)
    selectedClipId.value = clips.value[0]?.id || null
    recordHistory()
    drawAllClipWaveforms()
    toast.info('Clip Deleted', 'Removed clip from timeline')
  }
}

// Add New Audio Track Lane
const addTrack = () => {
  const nextNum = tracks.value.length + 1
  tracks.value.push({
    id: `track-${Date.now()}`,
    name: `A${nextNum}`,
    isMuted: false
  })
  selectedTrackIndex.value = tracks.value.length - 1
  toast.info('Track Added', `Created track A${nextNum}`)
}

// Delete Track Lane
const deleteTrack = (tIndex: number) => {
  if (tracks.value.length <= 1) {
    toast.warning('Cannot Delete', 'At least 1 audio track is required')
    return
  }

  const targetTrackIdx = Math.max(0, tIndex - 1)
  clips.value.forEach(clip => {
    if (clip.trackIndex === tIndex) {
      clip.trackIndex = targetTrackIdx
    } else if (clip.trackIndex > tIndex) {
      clip.trackIndex -= 1
    }
  })

  tracks.value.splice(tIndex, 1)
  tracks.value.forEach((t, i) => {
    t.name = `A${i + 1}`
  })
  selectedTrackIndex.value = Math.min(selectedTrackIndex.value, tracks.value.length - 1)

  recordHistory()
  drawAllClipWaveforms()
  toast.info('Track Removed', 'Track removed and clips adjusted')
}

// 16-bit PCM WAV Encoder
const encodeWav = (buffer: AudioBuffer): Blob => {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1
  const bitDepth = 16

  const length = buffer.length * numChannels * (bitDepth / 8)
  const arrayBuffer = new ArrayBuffer(44 + length)
  const view = new DataView(arrayBuffer)

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + length, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, format, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true)
  view.setUint16(32, numChannels * (bitDepth / 8), true)
  view.setUint16(34, bitDepth, true)
  writeString(36, 'data')
  view.setUint32(40, length, true)

  const channels: Float32Array[] = []
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i))
  }

  let offset = 44
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      let sample = channels[channel][i]
      sample = Math.max(-1, Math.min(1, sample))
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      view.setInt16(offset, intSample, true)
      offset += 2
    }
  }

  return new Blob([view], { type: 'audio/wav' })
}

// Client-Side MP3 Encoder
const encodeMp3 = (buffer: AudioBuffer, bitrate = 320): Blob => {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const mp3Encoder = new Mp3Encoder(numChannels, sampleRate, bitrate)

  const mp3Data: Uint8Array[] = []
  const sampleBlockSize = 1152

  const leftChannel = buffer.getChannelData(0)
  const rightChannel = numChannels > 1 ? buffer.getChannelData(1) : leftChannel

  const leftInt16 = new Int16Array(leftChannel.length)
  const rightInt16 = new Int16Array(rightChannel.length)

  for (let i = 0; i < leftChannel.length; i++) {
    const l = Math.max(-1, Math.min(1, leftChannel[i]))
    leftInt16[i] = l < 0 ? l * 0x8000 : l * 0x7fff

    const r = Math.max(-1, Math.min(1, rightChannel[i]))
    rightInt16[i] = r < 0 ? r * 0x8000 : r * 0x7fff
  }

  for (let i = 0; i < leftInt16.length; i += sampleBlockSize) {
    const leftChunk = leftInt16.subarray(i, i + sampleBlockSize)
    const rightChunk = rightInt16.subarray(i, i + sampleBlockSize)

    let mp3buf: Uint8Array
    if (numChannels === 1) {
      mp3buf = mp3Encoder.encodeBuffer(leftChunk)
    } else {
      mp3buf = mp3Encoder.encodeBuffer(leftChunk, rightChunk)
    }

    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf)
    }
  }

  const endBuf = mp3Encoder.flush()
  if (endBuf.length > 0) {
    mp3Data.push(endBuf)
  }

  return new Blob(mp3Data as BlobPart[], { type: 'audio/mp3' })
}

// Multi-Clip & Multi-Buffer Audio Mashup Exporter with Keyframe Automation
const handleExportAudio = async () => {
  if (clips.value.length === 0) return
  isExporting.value = true
  stopPlayback()

  try {
    const totalDuration = totalTimelineDuration.value

    let maxRate = 44100
    mediaAssets.value.forEach(a => {
      if (a.sampleRate > maxRate) maxRate = a.sampleRate
    })
    const origRate = maxRate
    const numChannels = 2
    const totalFrames = Math.floor(totalDuration * origRate)

    const offlineCtx = new OfflineAudioContext(numChannels, totalFrames, origRate)

    clips.value.forEach(clip => {
      const track = tracks.value[clip.trackIndex]
      if (track && track.isMuted) return

      const asset = mediaAssets.value.get(clip.mediaId)
      const buffer = asset ? asset.buffer : currentAudioBuffer.value
      if (!buffer) return

      const clipDuration = clip.sourceEnd - clip.sourceStart
      const sourceNode = offlineCtx.createBufferSource()
      sourceNode.buffer = buffer

      const clipGain = offlineCtx.createGain()
      const baseClipVol = clip.volume !== undefined ? clip.volume : 1.0

      // Apply keyframe volume curve on offline render
      if (clip.keyframes && clip.keyframes.length > 0) {
        const kfs = [...clip.keyframes].sort((a, b) => a.timeOffset - b.timeOffset)
        const initialVol = getClipVolumeAtTime(clip, 0)
        clipGain.gain.setValueAtTime(initialVol * baseClipVol, clip.timelineStart)

        kfs.forEach(kf => {
          const kfTime = clip.timelineStart + kf.timeOffset
          clipGain.gain.linearRampToValueAtTime(kf.volume * baseClipVol, kfTime)
        })
      } else {
        clipGain.gain.value = baseClipVol
      }

      sourceNode.connect(clipGain)
      clipGain.connect(offlineCtx.destination)
      sourceNode.start(clip.timelineStart, clip.sourceStart, clipDuration)
    })

    const renderedBuffer = await offlineCtx.startRendering()

    let audioBlob: Blob
    const ext = exportFormat.value

    if (ext === 'mp3') {
      audioBlob = encodeMp3(renderedBuffer, mp3Bitrate.value)
    } else {
      audioBlob = encodeWav(renderedBuffer)
    }

    const link = document.createElement('a')
    link.href = URL.createObjectURL(audioBlob)
    let targetName = exportFileName.value.trim() || `mashup_audio_export.${ext}`
    if (!targetName.endsWith(`.${ext}`)) {
      targetName = targetName.replace(/\.[^/.]+$/, '') + `.${ext}`
    }
    link.download = targetName
    link.click()

    setTimeout(() => URL.revokeObjectURL(link.href), 1500)
    toast.success('Audio Exported', `Saved ${formatTimecode(totalDuration)} mashup as ${ext.toUpperCase()}`)
  } catch (err: any) {
    toast.error('Export Failed', err.message || 'Could not render audio')
  } finally {
    isExporting.value = false
  }
}

watch([volume, isMuted], () => {
  if (masterGainNode) {
    masterGainNode.gain.value = isMuted.value ? 0 : volume.value
  }
})

watch(playbackSpeed, (val) => {
  activeSourceNodes.forEach(n => n.playbackRate.value = val)
})

const handleKeydown = (e: KeyboardEvent) => {
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

  if (e.code === 'Space') {
    e.preventDefault()
    togglePlay()
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault()
    if (e.shiftKey) redo()
    else undo()
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
    e.preventDefault()
    redo()
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    deleteSelectedClip()
  } else if (e.key === 's' || e.key === 'S') {
    e.preventDefault()
    splitAtPlayhead()
  } else if (e.key === '[') {
    e.preventDefault()
    splitLeft()
  } else if (e.key === ']') {
    e.preventDefault()
    splitRight()
  } else if (e.altKey && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault()
    toggleKeyframeAtPlayhead()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', () => {
    drawAllClipWaveforms()
    drawRuler()
  })
})

onUnmounted(() => {
  stopPlayback()
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', () => {
    drawAllClipWaveforms()
    drawRuler()
  })
})
</script>

<template>
  <div class="space-y-4 pb-12 w-full">
    <!-- State 1: When NO Audio is loaded -> Standard Avttr Studio Page Header & Dropzone -->
    <div v-if="!currentAudioBuffer" class="space-y-6">
      <!-- Header & Breadcrumbs -->
      <div class="space-y-2">
        <div class="flex items-center gap-2 text-xs text-[var(--text-tertiary)] font-mono">
          <NuxtLink to="/" class="hover:text-[var(--text-primary)] transition-colors">Dashboard</NuxtLink>
          <span>/</span>
          <span class="text-[var(--text-secondary)] font-medium">Tools</span>
          <span>/</span>
          <span class="text-[var(--text-primary)]">Audio Studio</span>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Audio Extractor & Timeline Trimmer
            </h1>
            <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              Extract sound from video or audio files, split clips, import multiple tracks, and create music mashups with keyframe volume automation.
            </p>
          </div>

          <div class="flex items-center gap-2">
            <Badge variant="badge">
              Client Privacy
            </Badge>
          </div>
        </div>
      </div>

      <!-- Standard Avttr Upload Dropzone Card -->
      <div
        class="relative border-2 border-dashed rounded-[14px] p-8 sm:p-14 text-center transition-all cursor-pointer select-none"
        :class="
          isDragging
            ? 'border-white bg-[var(--bg-card-hover)]'
            : 'border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--border-card-hover)]'
        "
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="onDrop"
        @click="fileInputRef?.click()"
      >
        <input
          ref="fileInputRef"
          type="file"
          accept="audio/*,video/mp4,video/webm,video/quicktime"
          class="hidden"
          @change="handleFileInputChange"
        />

        <div class="max-w-md mx-auto space-y-4">
          <div class="w-14 h-14 mx-auto rounded-2xl bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-white shadow-md">
            <Upload class="w-7 h-7 text-white" />
          </div>

          <div>
            <h3 class="text-base font-semibold text-[var(--text-primary)]">
              Drop your audio or video file here or browse
            </h3>
            <p class="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
              Support MP4, WebM, MOV, MP3, WAV, AAC, M4A, OGG, and FLAC. 100% processed locally on your device.
            </p>
          </div>

          <div class="flex flex-wrap items-center justify-center gap-1.5 pt-1">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#212121] text-[var(--text-secondary)] border border-[var(--border-subtle)]">MP4</span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#212121] text-[var(--text-secondary)] border border-[var(--border-subtle)]">WEBM</span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#212121] text-[var(--text-secondary)] border border-[var(--border-subtle)]">MP3</span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#212121] text-[var(--text-secondary)] border border-[var(--border-subtle)]">WAV</span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#212121] text-[var(--text-secondary)] border border-[var(--border-subtle)]">AAC</span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#212121] text-[var(--text-secondary)] border border-[var(--border-subtle)]">M4A</span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#212121] text-[var(--text-secondary)] border border-[var(--border-subtle)]">FLAC</span>
          </div>
        </div>
      </div>
    </div>

    <!-- State 2: When Audio IS Loaded -> CapCut Studio Multi-Clip Studio -->
    <div v-else class="space-y-4">
      <!-- CapCut Studio Top Header Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#141416] border border-[#262626]">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-8 h-8 rounded-lg bg-[#222226] flex items-center justify-center shrink-0">
            <Music class="w-4 h-4 text-white" />
          </div>
          <div class="min-w-0">
            <div>
              <h1 class="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                {{ fileName }}
              </h1>
            </div>
            <p class="text-xs text-[var(--text-tertiary)] truncate">
              {{ formatTimecode(totalTimelineDuration) }} • {{ mediaAssets.size }} Media • {{ clips.length }} Clip{{ clips.length > 1 ? 's' : '' }}
            </p>
          </div>
        </div>

        <!-- Header Action Controls -->
        <div class="flex items-center gap-2 shrink-0">
          <!-- Add Extra Media / Import Song for Mashup -->
          <label class="py-1.5 px-3 rounded-lg bg-[#222226] hover:bg-[#2e2e34] border border-white/10 text-xs font-medium text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-xs">
            <Plus class="w-3.5 h-3.5 text-white/90" />
            <span>Add Media</span>
            <input
              ref="addMediaInputRef"
              type="file"
              multiple
              accept="audio/*,video/mp4,video/webm,video/quicktime"
              class="hidden"
              @change="handleAddMediaInputChange"
            />
          </label>

          <!-- Replace Project Media -->
          <label class="py-1.5 px-3 rounded-lg bg-[#1a1a1e] hover:bg-[#222226] border border-white/5 text-xs font-medium text-[var(--text-secondary)] hover:text-white transition-all cursor-pointer flex items-center gap-1.5">
            <FolderOpen class="w-3.5 h-3.5 text-white/70" />
            <span>Replace</span>
            <input
              type="file"
              accept="audio/*,video/mp4,video/webm,video/quicktime"
              class="hidden"
              @change="handleFileInputChange"
            />
          </label>

          <!-- Format Selector Pill -->
          <div class="flex items-center bg-[#222226] border border-white/10 rounded-lg p-0.5">
            <button
              type="button"
              class="px-2 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer"
              :class="exportFormat === 'mp3' ? 'bg-white text-black font-bold' : 'text-white/60 hover:text-white'"
              @click="exportFormat = 'mp3'"
            >
              MP3
            </button>
            <button
              type="button"
              class="px-2 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer"
              :class="exportFormat === 'wav' ? 'bg-white text-black font-bold' : 'text-white/60 hover:text-white'"
              @click="exportFormat = 'wav'"
            >
              WAV
            </button>
          </div>

          <Button
            variant="primary"
            size="sm"
            class="font-semibold shadow-xs"
            :disabled="isExporting"
            @click="handleExportAudio"
          >
            <Download class="w-3.5 h-3.5 mr-1.5" />
            <span>{{ isExporting ? 'Exporting...' : `Export ${exportFormat.toUpperCase()}` }}</span>
          </Button>
        </div>
      </div>

      <!-- Upper Section: Player Stage + Clip Inspector -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <!-- Player Deck (8 cols) -->
        <div class="lg:col-span-8 rounded-xl bg-[#0e0e10] border border-[#262626] p-6 flex flex-col justify-between space-y-6 min-h-[300px]">
          <!-- Stage Top Monitor Info -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-white inline-block animate-pulse" />
              <span class="text-xs font-mono text-white/90">AUDIO MONITOR</span>
            </div>
            <div class="text-xs font-mono text-[var(--text-tertiary)] flex items-center gap-2">
              <span>Selected Clip: <strong class="text-white">{{ selectedClip ? formatTimecode(selectedClip.sourceEnd - selectedClip.sourceStart) : 'None' }}</strong></span>
              <span v-if="selectedClip?.keyframes?.length" class="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-white font-mono">
                {{ selectedClip.keyframes.length }} KF
              </span>
            </div>
          </div>

          <!-- Central LED Timecode Display -->
          <div class="flex flex-col items-center justify-center space-y-1 py-2">
            <div class="text-3xl sm:text-5xl font-mono font-bold tracking-tight text-white select-none">
              {{ formatTimecode(currentTime) }}
            </div>
            <div class="text-xs font-mono text-[var(--text-tertiary)]">
              / {{ formatTimecode(totalTimelineDuration) }}
            </div>
          </div>

          <!-- Transport Controls Bar -->
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-3 border-t border-[#262626]">
            <!-- Seek -5s -->
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                class="p-2 rounded-lg bg-[#18181b] hover:bg-[#222226] text-white transition-colors cursor-pointer"
                title="Seek -5s"
                @click="seekRelative(-5)"
              >
                <Rewind class="w-4 h-4" />
              </button>
            </div>

            <!-- Main Play / Pause Transport Button -->
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center transition-transform hover:scale-105 cursor-pointer shadow-md"
                :title="isPlaying ? 'Pause (Space)' : 'Play (Space)'"
                @click="togglePlay"
              >
                <Pause v-if="isPlaying" class="w-5 h-5 fill-current" />
                <Play v-else class="w-5 h-5 fill-current ml-0.5" />
              </button>

              <button
                type="button"
                class="p-2.5 rounded-lg bg-[#18181b] hover:bg-[#222226] text-white transition-colors cursor-pointer"
                :class="isLooping ? 'bg-white text-black hover:bg-neutral-200' : ''"
                title="Toggle Loop"
                @click="isLooping = !isLooping"
              >
                <Repeat class="w-4 h-4" />
              </button>
            </div>

            <!-- Seek +5s and Volume -->
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="p-2 rounded-lg bg-[#18181b] hover:bg-[#222226] text-white transition-colors cursor-pointer"
                title="Seek +5s"
                @click="seekRelative(5)"
              >
                <FastForward class="w-4 h-4" />
              </button>

              <div class="flex items-center gap-2 pl-2 border-l border-[#262626]">
                <button
                  type="button"
                  class="text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer"
                  @click="isMuted = !isMuted"
                >
                  <VolumeX v-if="isMuted || volume === 0" class="w-4 h-4 text-white/80" />
                  <Volume2 v-else class="w-4 h-4" />
                </button>
                <input
                  v-model.number="volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  class="w-16 h-1.5 bg-[#2E2E2E] rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Right Side Properties & Keyframe Inspector Panel (4 cols) -->
        <div class="lg:col-span-4 rounded-xl bg-[#141416] border border-[#262626] overflow-hidden flex flex-col justify-between max-h-[480px]">
          <div class="p-4 space-y-4 overflow-y-auto custom-scrollbar">
            <div class="flex items-center justify-between pb-2 border-b border-[#262626]">
              <span class="text-xs font-semibold text-white uppercase tracking-wider">Properties & Keyframe</span>
              <span class="text-[11px] font-mono text-[var(--text-tertiary)] truncate max-w-[150px]">
                {{ selectedClip ? selectedClip.name : 'No Clip Selected' }}
              </span>
            </div>

            <!-- Clip Info Header -->
            <div v-if="selectedClip" class="p-2.5 rounded-lg bg-[#0e0e10] border border-white/5 space-y-1.5 font-mono text-[11px]">
              <div class="flex justify-between">
                <span class="text-[var(--text-tertiary)]">Media Source</span>
                <span class="text-white truncate max-w-[140px]">{{ selectedClip.name }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-[var(--text-tertiary)]">Track Position</span>
                <span class="text-white">Track A{{ selectedClip.trackIndex + 1 }} • {{ formatTimecode(selectedClip.timelineStart) }}</span>
              </div>
            </div>

            <!-- Keyframe Volume Automation Section -->
            <div v-if="selectedClip" class="space-y-2.5 p-3 rounded-lg bg-[#0e0e10] border border-[#262626]">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <Activity class="w-3.5 h-3.5 text-white" />
                  <span class="text-xs font-semibold text-white">Volume Keyframe</span>
                </div>
                <!-- Keyframe Add/Remove Diamond Toggle Button -->
                <button
                  type="button"
                  class="p-1 rounded-md transition-all cursor-pointer flex items-center gap-1 text-xs font-mono"
                  :class="isPlayheadOnKeyframe ? 'bg-white text-black font-bold' : 'bg-[#1e1e24] text-white/80 hover:text-white hover:bg-[#2a2a32] border border-white/10'"
                  :title="isPlayheadOnKeyframe ? 'Remove Keyframe at Playhead (Alt+K)' : 'Add Keyframe at Playhead (Alt+K)'"
                  @click="toggleKeyframeAtPlayhead"
                >
                  <span class="text-sm leading-none">{{ isPlayheadOnKeyframe ? '◆' : '◇' }}</span>
                  <span>{{ isPlayheadOnKeyframe ? 'Remove KF' : 'Add KF' }}</span>
                </button>
              </div>

              <!-- Quick Presets -->
              <div class="grid grid-cols-3 gap-1 pt-1">
                <button
                  type="button"
                  class="py-1 px-1.5 rounded bg-[#18181b] hover:bg-[#222226] border border-white/5 text-[10px] text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1"
                  @click="applyFadeIn(1.5)"
                >
                  <TrendingUp class="w-3 h-3 text-white" />
                  <span>Fade In</span>
                </button>
                <button
                  type="button"
                  class="py-1 px-1.5 rounded bg-[#18181b] hover:bg-[#222226] border border-white/5 text-[10px] text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1"
                  @click="applyFadeOut(1.5)"
                >
                  <TrendingDown class="w-3 h-3 text-white" />
                  <span>Fade Out</span>
                </button>
                <button
                  type="button"
                  class="py-1 px-1.5 rounded bg-[#18181b] hover:bg-[#222226] border border-white/5 text-[10px] text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1"
                  @click="applyDucking"
                >
                  <Sparkles class="w-3 h-3 text-white" />
                  <span>Ducking</span>
                </button>
              </div>

              <!-- Keyframe Points List -->
              <div v-if="selectedClip.keyframes && selectedClip.keyframes.length > 0" class="space-y-1.5 pt-1">
                <div class="flex items-center justify-between text-[10px] font-mono text-[var(--text-tertiary)] uppercase">
                  <span>Points ({{ selectedClip.keyframes.length }})</span>
                  <button
                    type="button"
                    class="text-red-400 hover:underline cursor-pointer"
                    @click="clearKeyframes"
                  >
                    Clear All
                  </button>
                </div>
                <div class="max-h-28 overflow-y-auto space-y-1 pr-1">
                  <div
                    v-for="(kf, kIdx) in selectedClip.keyframes"
                    :key="kf.id"
                    class="flex items-center justify-between gap-2 p-1.5 rounded bg-[#141416] border border-white/5 text-[11px] font-mono"
                  >
                    <div class="flex items-center gap-1.5">
                      <span class="text-white text-xs">◆</span>
                      <span class="text-white">{{ formatTimecode(selectedClip.timelineStart + kf.timeOffset) }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <input
                        v-model.number="kf.volume"
                        type="range"
                        min="0"
                        max="1.5"
                        step="0.05"
                        class="w-14 h-1 bg-[#2E2E2E] rounded appearance-none cursor-pointer accent-white"
                        @input="drawAllClipWaveforms"
                        @change="recordHistory"
                      />
                      <span class="text-[10px] text-white/90 w-8 text-right">{{ Math.round(kf.volume * 100) }}%</span>
                      <button
                        type="button"
                        class="text-neutral-500 hover:text-red-400 p-0.5 cursor-pointer"
                        @click="removeKeyframe(kf.id)"
                      >
                        <X class="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Speed multiplier -->
            <div class="space-y-1.5">
              <label class="text-[10px] font-mono text-[var(--text-secondary)] uppercase">Playback Speed</label>
              <div class="grid grid-cols-5 gap-1 bg-[#0e0e10] p-1 rounded-lg border border-[#262626]">
                <button
                  v-for="s in [0.5, 1.0, 1.25, 1.5, 2.0]"
                  :key="s"
                  type="button"
                  class="py-1 rounded font-mono text-center text-xs transition-all cursor-pointer"
                  :class="playbackSpeed === s ? 'bg-white text-black font-bold' : 'text-[var(--text-tertiary)] hover:text-white'"
                  @click="playbackSpeed = s"
                >
                  {{ s }}x
                </button>
              </div>
            </div>
          </div>

          <!-- Bottom Inspector Export Action Bar -->
          <div class="p-3 bg-[#0e0e10] border-t border-[#262626] space-y-2.5">
            <!-- Format Choice -->
            <div class="space-y-1">
              <label class="text-[10px] font-mono text-[var(--text-tertiary)] uppercase block">Export Format</label>
              <div class="grid grid-cols-2 gap-1 bg-[#18181b] p-0.5 rounded-lg border border-white/5">
                <button
                  type="button"
                  class="py-1 text-[11px] font-mono rounded text-center transition-colors cursor-pointer"
                  :class="exportFormat === 'mp3' ? 'bg-white text-black font-bold' : 'text-white/60 hover:text-white'"
                  @click="exportFormat = 'mp3'"
                >
                  MP3 (320 kbps)
                </button>
                <button
                  type="button"
                  class="py-1 text-[11px] font-mono rounded text-center transition-colors cursor-pointer"
                  :class="exportFormat === 'wav' ? 'bg-white text-black font-bold' : 'text-white/60 hover:text-white'"
                  @click="exportFormat = 'wav'"
                >
                  WAV (Lossless)
                </button>
              </div>
            </div>

            <!-- Filename Input -->
            <div class="space-y-1">
              <label class="text-[10px] font-mono text-[var(--text-tertiary)] uppercase block">File Name</label>
              <input
                v-model="exportFileName"
                type="text"
                placeholder="Filename"
                class="w-full px-2.5 py-1.5 rounded-md bg-[#18181b] border border-white/10 text-xs font-mono text-white focus:outline-hidden focus:border-white/30"
              />
            </div>

            <Button
              variant="primary"
              size="sm"
              class="w-full font-semibold"
              :disabled="isExporting || clips.length === 0"
              @click="handleExportAudio"
            >
              <Download class="w-3.5 h-3.5 mr-1.5" />
              <span>{{ isExporting ? 'Rendering...' : `Download ${exportFormat.toUpperCase()}` }}</span>
            </Button>
          </div>
        </div>
      </div>

      <!-- Bottom Section: CapCut Multi-Track Drag-and-Drop Timeline Studio -->
      <div class="rounded-xl bg-[#141416] border border-[#262626] overflow-hidden">
        <!-- Timeline Toolbar Header with CapCut Action Icons -->
        <div class="px-4 py-2 bg-[#0e0e10] border-b border-[#262626] flex flex-wrap items-center justify-between gap-3 select-none">
          <!-- Left: Action Icons -->
          <div class="flex items-center gap-1">
            <!-- Undo (Ctrl+Z) -->
            <button
              type="button"
              class="p-1.5 rounded-lg transition-colors cursor-pointer"
              :class="canUndo ? 'text-white hover:bg-[#222226]' : 'text-white/20 cursor-not-allowed'"
              :disabled="!canUndo"
              title="Undo (Ctrl+Z)"
              @click="undo"
            >
              <Undo2 class="w-4 h-4" />
            </button>

            <!-- Redo (Ctrl+Y) -->
            <button
              type="button"
              class="p-1.5 rounded-lg transition-colors cursor-pointer"
              :class="canRedo ? 'text-white hover:bg-[#222226]' : 'text-white/20 cursor-not-allowed'"
              :disabled="!canRedo"
              title="Redo (Ctrl+Y)"
              @click="redo"
            >
              <Redo2 class="w-4 h-4" />
            </button>

            <div class="w-px h-4 bg-[#262626] mx-1" />

            <!-- Split Left -->
            <button
              type="button"
              class="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-[#222226] transition-colors cursor-pointer"
              title="Trim / Delete Left of Playhead ( [ )"
              @click="splitLeft"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path stroke-dasharray="2 2" d="M4 6h4v12H4z" />
                <path d="M12 3v18" stroke-width="2" />
                <path d="M16 6h4v12h-4z" />
              </svg>
            </button>

            <!-- Split at Playhead -->
            <button
              type="button"
              class="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-[#222226] transition-colors cursor-pointer"
              title="Split / Bagi di Playhead ( S )"
              @click="splitAtPlayhead"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M7 6h2v12H7" />
                <path d="M12 3v18" stroke-width="2" />
                <path d="M17 6h-2v12h2" />
              </svg>
            </button>

            <!-- Split Right -->
            <button
              type="button"
              class="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-[#222226] transition-colors cursor-pointer"
              title="Trim / Delete Right of Playhead ( ] )"
              @click="splitRight"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M4 6h4v12H4z" />
                <path d="M12 3v18" stroke-width="2" />
                <path stroke-dasharray="2 2" d="M16 6h4v12h-4z" />
              </svg>
            </button>

            <div class="w-px h-4 bg-[#262626] mx-1" />

            <!-- Keyframe Fast Controls -->
            <button
              type="button"
              class="p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs"
              :class="isPlayheadOnKeyframe ? 'bg-white text-black font-bold' : 'text-white/80 hover:text-white hover:bg-[#222226]'"
              :title="isPlayheadOnKeyframe ? 'Remove Keyframe (Alt+K)' : 'Add Keyframe (Alt+K)'"
              @click="toggleKeyframeAtPlayhead"
            >
              <span class="text-sm leading-none">{{ isPlayheadOnKeyframe ? '◆' : '◇' }}</span>
              <span class="hidden sm:inline text-[11px]">{{ isPlayheadOnKeyframe ? 'Remove KF' : 'Add KF' }}</span>
            </button>

            <button
              v-if="selectedClip?.keyframes?.length"
              type="button"
              class="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-[#222226] transition-colors cursor-pointer text-xs"
              title="Previous Keyframe"
              @click="jumpToPrevKeyframe"
            >
              ◀◇
            </button>
            <button
              v-if="selectedClip?.keyframes?.length"
              type="button"
              class="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-[#222226] transition-colors cursor-pointer text-xs"
              title="Next Keyframe"
              @click="jumpToNextKeyframe"
            >
              ◇▶
            </button>

            <div class="w-px h-4 bg-[#262626] mx-1" />

            <!-- Delete Selected Clip -->
            <button
              type="button"
              class="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-[#222226] transition-colors cursor-pointer"
              title="Delete Selected Clip (Del)"
              @click="deleteSelectedClip"
            >
              <Trash2 class="w-4 h-4" />
            </button>

            <!-- Add Track Button -->
            <button
              type="button"
              class="py-1 px-2 rounded-md bg-[#18181b] hover:bg-[#222226] border border-white/5 text-[11px] text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer flex items-center gap-1 ml-2"
              @click="addTrack"
            >
              <Plus class="w-3 h-3" />
              <span>Add Track</span>
            </button>

            <!-- Add Media to Timeline Button -->
            <button
              type="button"
              class="py-1 px-2.5 rounded-md bg-[#222226] hover:bg-[#2e2e34] border border-white/10 text-[11px] font-medium text-white transition-colors cursor-pointer flex items-center gap-1 ml-1 shadow-xs"
              @click="addMediaInputRef?.click()"
            >
              <FileAudio class="w-3.5 h-3.5 text-white/90" />
              <span>Import Audio</span>
            </button>
          </div>

          <!-- Right: Instructions -->
          <div class="flex items-center gap-3 text-[11px] font-mono text-[var(--text-tertiary)]">
            <span class="hidden sm:inline-block">Drag clips ↕ to change track • ↔ to move position</span>
            <span>Total: <span class="text-white font-semibold">{{ formatTimecode(totalTimelineDuration) }}</span></span>
          </div>
        </div>

        <!-- Multi-Track Timeline Workspace -->
        <div class="p-3 space-y-2 bg-[#121214]">
          <!-- Timecode Ruler Row -->
          <div class="flex items-center gap-3">
            <div class="w-20 shrink-0 text-[10px] font-mono uppercase text-[var(--text-tertiary)]">
              RULER
            </div>
            <div
              class="flex-1 h-6 relative overflow-hidden cursor-pointer"
              @mousedown="startRulerDrag"
            >
              <canvas ref="rulerCanvasRef" class="w-full h-full block" />
            </div>
          </div>

          <!-- Track Lanes Container with Multi-Clip Layout -->
          <div class="flex items-start gap-3 relative">
            <!-- Left Track Headers Column -->
            <div class="w-20 shrink-0 space-y-1.5 select-none">
              <div
                v-for="(track, tIndex) in tracks"
                :key="track.id"
                class="p-2 rounded-lg transition-all cursor-pointer flex items-center justify-between h-14"
                :class="selectedTrackIndex === tIndex ? 'bg-[#222226] border border-white/40 ring-1 ring-white/10 shadow-xs' : 'bg-[#18181b] border border-white/5 hover:border-white/20'"
                @click="selectTrack(tIndex)"
              >
                <div class="flex items-center gap-1">
                  <span
                    class="w-5 h-5 rounded font-mono font-bold text-[10px] flex items-center justify-center transition-colors"
                    :class="selectedTrackIndex === tIndex ? 'bg-white text-black' : 'bg-[#262626] text-white/80'"
                  >
                    {{ track.name }}
                  </span>
                </div>
                <div class="flex items-center gap-1">
                  <!-- Mute Button -->
                  <button
                    type="button"
                    class="p-1 rounded hover:bg-white/10 text-[var(--text-secondary)] hover:text-white cursor-pointer"
                    :title="track.isMuted ? 'Unmute Track' : 'Mute Track'"
                    @click.stop="track.isMuted = !track.isMuted"
                  >
                    <VolumeX v-if="track.isMuted" class="w-3.5 h-3.5 text-white" />
                    <Volume2 v-else class="w-3.5 h-3.5" />
                  </button>
                  <!-- Delete Track Button (Only when more than 1 track) -->
                  <button
                    v-if="tracks.length > 1"
                    type="button"
                    class="p-1 rounded hover:bg-red-500/20 text-[var(--text-tertiary)] hover:text-red-400 cursor-pointer transition-colors"
                    title="Delete Track"
                    @click.stop="deleteTrack(tIndex)"
                  >
                    <X class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Right Track Bodies Column with Master Playhead Overlay -->
            <div
              ref="timelineBodyRef"
              class="flex-1 space-y-1.5 relative select-none cursor-pointer"
              @mousedown="onTimelineBodyMouseDown"
            >
              <div
                v-for="(track, tIndex) in tracks"
                :key="track.id"
                class="h-14 rounded-lg relative overflow-hidden transition-colors"
                :class="selectedTrackIndex === tIndex ? 'bg-[#0f0f12] border border-white/30' : 'bg-[#0a0a0c] border border-[#222226]'"
                @mousedown="selectTrack(tIndex)"
              >
                <!-- Render Clips on this Track -->
                <div
                  v-for="clip in clips.filter(c => c.trackIndex === tIndex)"
                  :key="clip.id"
                  class="absolute top-1 bottom-1 rounded-md overflow-hidden select-none cursor-grab active:cursor-grabbing transition-shadow z-10"
                  :class="selectedClipId === clip.id ? 'ring-2 ring-white shadow-lg bg-[#1a1a1e]' : 'border border-white/20 bg-[#161618] hover:border-white/40'"
                  :style="{
                    left: `${(clip.timelineStart / totalTimelineDuration) * 100}%`,
                    width: `${((clip.sourceEnd - clip.sourceStart) / totalTimelineDuration) * 100}%`,
                    minWidth: '24px'
                  }"
                  @mousedown="(e) => startClipDrag(e, clip, 'move-clip')"
                >
                  <!-- Clip Top Title Badge -->
                  <div class="absolute top-1 left-1.5 right-1.5 flex items-center justify-between pointer-events-none z-10 text-[9px] font-mono text-white/90 truncate">
                    <div class="flex items-center gap-1 truncate">
                      <Music class="w-2.5 h-2.5 shrink-0" />
                      <span class="truncate">{{ clip.name }}</span>
                    </div>
                    <div v-if="clip.keyframes?.length" class="flex items-center gap-0.5 text-white/80 shrink-0">
                      <span>◆</span>
                      <span>{{ clip.keyframes.length }}</span>
                    </div>
                  </div>

                  <!-- Waveform & Keyframe Envelope Canvas for this Clip -->
                  <canvas
                    :id="`canvas-${clip.id}`"
                    class="w-full h-full block opacity-85"
                  />

                  <!-- Left Trim Handle -->
                  <div
                    v-if="selectedClipId === clip.id"
                    class="absolute left-0 top-0 bottom-0 w-3 bg-white cursor-ew-resize flex items-center justify-center z-20 hover:brightness-110"
                    title="Drag to trim start"
                    @mousedown="(e) => startClipDrag(e, clip, 'trim-start')"
                  >
                    <div class="w-0.5 h-4 bg-black/60 rounded-full" />
                  </div>

                  <!-- Right Trim Handle -->
                  <div
                    v-if="selectedClipId === clip.id"
                    class="absolute right-0 top-0 bottom-0 w-3 bg-white cursor-ew-resize flex items-center justify-center z-20 hover:brightness-110"
                    title="Drag to trim end"
                    @mousedown="(e) => startClipDrag(e, clip, 'trim-end')"
                  >
                    <div class="w-0.5 h-4 bg-black/60 rounded-full" />
                  </div>
                </div>
              </div>

              <!-- Master Vertical Playhead Line across all tracks with interactive drag handle -->
              <div
                class="absolute top-0 bottom-0 z-30 flex flex-col items-center select-none"
                :style="{
                  left: `${(currentTime / totalTimelineDuration) * 100}%`,
                  transform: 'translateX(-50%)'
                }"
              >
                <!-- Playhead Indicator Diamond with Drag Handle -->
                <div
                  class="w-4 h-4 bg-white rotate-45 -mt-1 shadow-lg cursor-ew-resize hover:scale-125 transition-transform flex items-center justify-center shrink-0"
                  title="Drag Playhead anywhere"
                  @mousedown.stop="startPlayheadDrag"
                />
                <!-- Playhead Vertical Line with Wide Hover/Hit Zone -->
                <div
                  class="w-4 flex-1 flex justify-center cursor-ew-resize group"
                  title="Drag Playhead anywhere"
                  @mousedown.stop="startPlayheadDrag"
                >
                  <div class="w-0.5 h-full bg-white shadow-md group-hover:w-1 transition-all" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
