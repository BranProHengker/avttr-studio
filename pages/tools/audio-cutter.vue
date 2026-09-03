<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import {
  Music,
  Play,
  Pause,
  Download,
  Upload,
  Volume2,
  VolumeX,
  FileAudio,
  Repeat,
  FolderOpen,
  FastForward,
  Rewind,
  Trash2,
  Undo2,
  Redo2,
  Plus,
  X,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Activity,
  ZoomIn,
  ZoomOut,
  Magnet
} from 'lucide-vue-next'
import { Mp3Encoder } from '@breezystack/lamejs'
import { useToast } from '~/composables/useToast'
import { useI18n } from '~/composables/useI18n'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

const toast = useToast()
const { t, locale } = useI18n()

interface AudioKeyframe {
  id: string
  timeOffset: number
  volume: number
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
  mediaId: string
  name: string
  sourceStart: number
  sourceEnd: number
  timelineStart: number
  trackIndex: number
  volume?: number
  keyframes?: AudioKeyframe[]
}

interface TrackInfo {
  id: string
  name: string
  isMuted: boolean
}

// Refs
const rulerCanvasRef = ref<HTMLCanvasElement | null>(null)
const timelineBodyRef = ref<HTMLDivElement | null>(null)
const cavaCanvasRef = ref<HTMLCanvasElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const extraFileInputRef = ref<HTMLInputElement | null>(null)
const replaceFileInputRef = ref<HTMLInputElement | null>(null)

// Playback & State
const isDecoding = ref(false)
const isExporting = ref(false)
const isPlaying = ref(false)
const isLooping = ref(false)
const isDragging = ref(false)
const isSnapping = ref(true)
const zoomLevel = ref<number>(1)

const fileName = ref<string>('')
const fileSize = ref<number>(0)
const currentTime = ref<number>(0)
const volume = ref<number>(1)
const isMuted = ref<boolean>(false)
const playbackSpeed = ref<number>(1)
const exportFormat = ref<'mp3' | 'wav'>('mp3')
const mp3Bitrate = ref<number>(320)
const exportFileName = ref<string>('')

// Multi-Track & Media Pool
const tracks = ref<TrackInfo[]>([{ id: 'track-1', name: 'A1', isMuted: false }])
const selectedTrackIndex = ref<number>(0)
const clips = ref<AudioClip[]>([])
const selectedClipId = ref<string | null>(null)
const mediaAssets = shallowRef<Map<string, MediaAsset>>(new Map())
const currentAudioBuffer = shallowRef<AudioBuffer | null>(null)
const audioDuration = ref<number>(0)

// Web Audio API Nodes
let audioCtx: AudioContext | null = null
let masterGainNode: GainNode | null = null
let analyserNode: AnalyserNode | null = null
let activeSourceNodes: AudioBufferSourceNode[] = []
let activeGainNodes: GainNode[] = []
let playbackStartTime = 0
let playbackOffset = 0
let animationFrameId: number | null = null
let cavaAnimId: number | null = null
let resizeObs: ResizeObserver | null = null

// Interaction State
type DragMode = 'move-clip' | 'trim-start' | 'trim-end' | 'playhead' | null
const dragMode = ref<DragMode>(null)
const draggingClipId = ref<string | null>(null)
let dragStartX = 0
let dragStartY = 0
let initialTimelineStart = 0
let initialSourceStart = 0
let initialSourceEnd = 0
let initialTrackIndex = 0

// History Stack (Undo / Redo)
const historyStack = ref<string[]>([])
const historyIndex = ref<number>(-1)

const recordHistory = () => {
  const snapshot = JSON.stringify(clips.value)
  if (historyIndex.value >= 0 && historyStack.value[historyIndex.value] === snapshot) return
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

// Master Timeline Duration
const totalTimelineDuration = computed(() => {
  let max = audioDuration.value || 10
  for (const c of clips.value) {
    const end = c.timelineStart + (c.sourceEnd - c.sourceStart)
    if (end > max) max = end
  }
  return Math.max(max, 1)
})

const selectedClip = computed(() => clips.value.find(c => c.id === selectedClipId.value) || null)

// Helpers
const formatTimecode = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) seconds = 0
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const millis = Math.floor((seconds % 1) * 1000)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`
}

const getAudioContext = () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    audioCtx = new AudioContextClass()
    masterGainNode = audioCtx.createGain()
    analyserNode = audioCtx.createAnalyser()
    analyserNode.fftSize = 64
    analyserNode.smoothingTimeConstant = 0.8
    masterGainNode.connect(analyserNode)
    analyserNode.connect(audioCtx.destination)
  }
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

// Track Selection
const selectTrack = (tIndex: number) => {
  selectedTrackIndex.value = tIndex
  const clipOnTrack = clips.value.find(c => c.trackIndex === tIndex)
  if (clipOnTrack && (!selectedClip.value || selectedClip.value.trackIndex !== tIndex)) {
    selectedClipId.value = clipOnTrack.id
  }
}

// Volume Keyframe Interpolation
const getClipVolumeAtTime = (clip: AudioClip, relativeTime: number): number => {
  const baseVol = clip.volume !== undefined ? clip.volume : 1.0
  if (!clip.keyframes || clip.keyframes.length === 0) return baseVol

  const kfs = [...clip.keyframes].sort((a, b) => a.timeOffset - b.timeOffset)
  if (relativeTime <= kfs[0].timeOffset) return kfs[0].volume
  if (relativeTime >= kfs[kfs.length - 1].timeOffset) return kfs[kfs.length - 1].volume

  for (let i = 0; i < kfs.length - 1; i++) {
    const kf1 = kfs[i]
    const kf2 = kfs[i + 1]
    if (relativeTime >= kf1.timeOffset && relativeTime <= kf2.timeOffset) {
      const diff = kf2.timeOffset - kf1.timeOffset
      if (diff === 0) return kf1.volume
      return kf1.volume + (kf2.volume - kf1.volume) * ((relativeTime - kf1.timeOffset) / diff)
    }
  }
  return baseVol
}

const isPlayheadOnKeyframe = computed(() => {
  if (!selectedClip.value) return false
  const offset = currentTime.value - selectedClip.value.timelineStart
  const clipDur = selectedClip.value.sourceEnd - selectedClip.value.sourceStart
  if (offset < 0 || offset > clipDur) return false
  return (selectedClip.value.keyframes || []).some(k => Math.abs(k.timeOffset - offset) < 0.08)
})

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
    clip.keyframes.push({
      id: `kf-${Date.now()}`,
      timeOffset: Number(offset.toFixed(3)),
      volume: Number(getClipVolumeAtTime(clip, offset).toFixed(2))
    })
    clip.keyframes.sort((a, b) => a.timeOffset - b.timeOffset)
    recordHistory()
    drawAllClipWaveforms()
    toast.success('Keyframe Added', `Added volume keyframe at ${formatTimecode(currentTime.value)}`)
  }
}

// Keyframe Presets
const applyFadeIn = (duration = 1.5) => {
  if (!selectedClip.value) return
  const clip = selectedClip.value
  const actualDur = Math.min(duration, (clip.sourceEnd - clip.sourceStart) / 2)
  clip.keyframes = (clip.keyframes || []).filter(k => k.timeOffset > actualDur)
  clip.keyframes.push({ id: `kf-${Date.now()}-in-0`, timeOffset: 0, volume: 0 })
  clip.keyframes.push({ id: `kf-${Date.now()}-in-1`, timeOffset: Number(actualDur.toFixed(2)), volume: 1.0 })
  clip.keyframes.sort((a, b) => a.timeOffset - b.timeOffset)
  recordHistory()
  drawAllClipWaveforms()
  toast.success('Fade In Applied', `Created ${actualDur.toFixed(1)}s fade-in curve`)
}

const applyFadeOut = (duration = 1.5) => {
  if (!selectedClip.value) return
  const clip = selectedClip.value
  const clipDur = clip.sourceEnd - clip.sourceStart
  const actualDur = Math.min(duration, clipDur / 2)
  const startTime = clipDur - actualDur
  clip.keyframes = (clip.keyframes || []).filter(k => k.timeOffset < startTime)
  clip.keyframes.push({ id: `kf-${Date.now()}-out-0`, timeOffset: Number(startTime.toFixed(2)), volume: 1.0 })
  clip.keyframes.push({ id: `kf-${Date.now()}-out-1`, timeOffset: Number(clipDur.toFixed(2)), volume: 0 })
  clip.keyframes.sort((a, b) => a.timeOffset - b.timeOffset)
  recordHistory()
  drawAllClipWaveforms()
  toast.success('Fade Out Applied', `Created ${actualDur.toFixed(1)}s fade-out curve`)
}

const applyDucking = () => {
  if (!selectedClip.value) return
  const clip = selectedClip.value
  const clipDur = clip.sourceEnd - clip.sourceStart
  if (clipDur < 2) {
    toast.warning('Clip Too Short', 'Ducking requires duration of at least 2s')
    return
  }
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

const clearKeyframes = () => {
  if (!selectedClip.value) return
  selectedClip.value.keyframes = []
  recordHistory()
  drawAllClipWaveforms()
  toast.info('Keyframes Cleared', 'Reset volume automation')
}

const removeKeyframe = (kfId: string) => {
  if (!selectedClip.value || !selectedClip.value.keyframes) return
  selectedClip.value.keyframes = selectedClip.value.keyframes.filter(k => k.id !== kfId)
  recordHistory()
  drawAllClipWaveforms()
}

const jumpToPrevKeyframe = () => {
  if (!selectedClip.value || !selectedClip.value.keyframes || selectedClip.value.keyframes.length === 0) return
  const clip = selectedClip.value
  const kfs = clip.keyframes || []
  const offset = currentTime.value - clip.timelineStart
  const prevKfs = kfs.filter(k => k.timeOffset < offset - 0.05)
  if (prevKfs.length > 0) {
    currentTime.value = Number((clip.timelineStart + prevKfs[prevKfs.length - 1].timeOffset).toFixed(3))
  }
}

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

// CAVA Terminal Audio Visualizer (Dynamic Spectrum Equalizer)
const renderCavaVisualizer = () => {
  if (!cavaCanvasRef.value) return
  const canvas = cavaCanvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight

  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr
    canvas.height = height * dpr
  }
  ctx.resetTransform()
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, width, height)

  const barCount = 32
  const gap = 3
  const barWidth = Math.max(2, (width - (barCount - 1) * gap) / barCount)

  let dataArray: Uint8Array | null = null
  if (analyserNode && isPlaying.value) {
    dataArray = new Uint8Array(analyserNode.frequencyBinCount)
    analyserNode.getByteFrequencyData(dataArray as any)
  }

  for (let i = 0; i < barCount; i++) {
    let percent = 0.05
    if (dataArray && isPlaying.value) {
      const bin = Math.floor((i / barCount) * (dataArray.length * 0.7))
      percent = Math.max(0.06, dataArray[bin] / 255)
    }

    const barHeight = Math.max(4, percent * (height - 6))
    const x = i * (barWidth + gap)
    const y = height - barHeight

    ctx.fillStyle = percent > 0.75 ? '#ffffff' : percent > 0.4 ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.3)'
    ctx.beginPath()
    ctx.roundRect(x, y, barWidth, barHeight, 1.5)
    ctx.fill()
  }

  if (isPlaying.value) {
    cavaAnimId = requestAnimationFrame(renderCavaVisualizer)
  }
}

// Start Ruler Dragging for Playhead Seek
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

// Waveform & Ruler Rendering
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
  ctx.resetTransform()
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, rect.width, 24)

  const duration = totalTimelineDuration.value
  if (duration <= 0) return

  const tickInterval = duration > 120 ? 20 : duration > 60 ? 10 : duration > 20 ? 5 : 1
  const numIntervals = Math.floor(duration / tickInterval)

  ctx.fillStyle = '#71717a'
  ctx.font = '9px monospace'
  for (let i = 0; i <= numIntervals; i++) {
    const time = i * tickInterval
    const x = (time / duration) * rect.width
    ctx.fillStyle = '#52525b'
    ctx.fillRect(x, 14, 1, 10)
    ctx.fillStyle = '#a1a1aa'
    ctx.fillText(`${Math.floor(time / 60)}:${(time % 60).toString().padStart(2, '0')}`, x + 3, 10)
  }
}

const drawClipWaveform = (canvas: HTMLCanvasElement, clip: AudioClip) => {
  const asset = mediaAssets.value.get(clip.mediaId)
  const buffer = asset ? asset.buffer : currentAudioBuffer.value
  if (!canvas || !buffer) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const rect = canvas.getBoundingClientRect()
  const width = Math.max(24, rect.width || canvas.clientWidth || canvas.parentElement?.clientWidth || 200)
  const height = Math.max(20, rect.height || canvas.clientHeight || canvas.parentElement?.clientHeight || 48)

  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.floor(width * dpr)
  canvas.height = Math.floor(height * dpr)
  ctx.resetTransform()
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, width, height)

  const rawData = buffer.getChannelData(0)
  const totalSamples = rawData.length
  const startSample = Math.max(0, Math.floor((clip.sourceStart / buffer.duration) * totalSamples))
  const endSample = Math.min(totalSamples, Math.floor((clip.sourceEnd / buffer.duration) * totalSamples))
  const clipSamples = endSample - startSample
  if (clipSamples <= 0) return

  const step = 3
  const barWidth = 2
  const totalBars = Math.max(1, Math.floor(width / step))
  const samplesPerBar = Math.max(1, Math.floor(clipSamples / totalBars))

  for (let i = 0; i < totalBars; i++) {
    const barX = i * step
    const sampleIndex = startSample + i * samplesPerBar
    let peak = 0
    const checkCount = Math.min(samplesPerBar, 32)
    for (let j = 0; j < checkCount; j++) {
      const idx = sampleIndex + Math.floor((j * samplesPerBar) / checkCount)
      if (idx < totalSamples) {
        const datum = Math.abs(rawData[idx] || 0)
        if (datum > peak) peak = datum
      }
    }

    const visualPeak = Math.min(1, Math.pow(peak, 0.65) * 1.6)
    const barHeight = Math.max(4, visualPeak * (height * 0.82))

    ctx.fillStyle = selectedClipId.value === clip.id ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.6)'
    ctx.beginPath()
    ctx.roundRect(barX, (height - barHeight) / 2, barWidth, barHeight, 1)
    ctx.fill()
  }

  // Draw Keyframe Automation Envelope Curve & Diamonds
  if (clip.keyframes && clip.keyframes.length > 0) {
    const clipDur = clip.sourceEnd - clip.sourceStart
    const kfs = [...clip.keyframes].sort((a, b) => a.timeOffset - b.timeOffset)

    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    const firstY = height - Math.max(4, Math.min(height - 4, (kfs[0].volume / 1.5) * height))
    ctx.moveTo(0, firstY)

    kfs.forEach(kf => {
      const kfX = (kf.timeOffset / clipDur) * width
      const kfY = height - Math.max(4, Math.min(height - 4, (kf.volume / 1.5) * height))
      ctx.lineTo(kfX, kfY)
    })
    const lastY = height - Math.max(4, Math.min(height - 4, (kfs[kfs.length - 1].volume / 1.5) * height))
    ctx.lineTo(width, lastY)
    ctx.stroke()

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
      if (canvas) drawClipWaveform(canvas, clip)
    })
  })
}

// Media Upload Processors
const processMediaFile = async (file: File) => {
  fileName.value = file.name
  exportFileName.value = file.name.replace(/\.[^/.]+$/, '') + `_mashup.${exportFormat.value}`
  fileSize.value = file.size
  isDecoding.value = true
  stopPlayback()

  try {
    const arrayBuffer = await file.arrayBuffer()
    const ctx = getAudioContext()
    const decoded = await ctx.decodeAudioData(arrayBuffer)

    currentAudioBuffer.value = decoded
    audioDuration.value = decoded.duration
    currentTime.value = 0

    const mediaId = `media-${Date.now()}`
    const newPool = new Map<string, MediaAsset>()
    newPool.set(mediaId, {
      id: mediaId,
      name: file.name,
      size: file.size,
      duration: decoded.duration,
      sampleRate: decoded.sampleRate,
      channels: decoded.numberOfChannels,
      buffer: decoded
    })
    mediaAssets.value = newPool

    tracks.value = [{ id: 'track-1', name: 'A1', isMuted: false }]
    selectedTrackIndex.value = 0

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

    historyStack.value = [JSON.stringify(clips.value)]
    historyIndex.value = 0

    toast.success('Audio Decoded', `Loaded ${decoded.numberOfChannels === 2 ? 'Stereo' : 'Mono'} (${decoded.sampleRate} Hz)`)
    await nextTick()
    setTimeout(() => {
      drawAllClipWaveforms()
      drawRuler()
      renderCavaVisualizer()
    }, 60)
  } catch (err: any) {
    toast.error('Decoding Failed', 'Unable to decode media file. Please upload standard audio/video format.')
  } finally {
    isDecoding.value = false
  }
}

const addExtraMediaFiles = async (files: FileList | File[]) => {
  if (!currentAudioBuffer.value) {
    if (files.length > 0) await processMediaFile(files[0])
    return
  }
  isDecoding.value = true
  try {
    const ctx = getAudioContext()
    const nextMap = new Map(mediaAssets.value)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const arrayBuffer = await file.arrayBuffer()
      const decoded = await ctx.decodeAudioData(arrayBuffer)
      const mediaId = `media-${Date.now()}-${i}`

      nextMap.set(mediaId, {
        id: mediaId,
        name: file.name,
        size: file.size,
        duration: decoded.duration,
        sampleRate: decoded.sampleRate,
        channels: decoded.numberOfChannels,
        buffer: decoded
      })

      const targetTrackIdx = tracks.value.length
      tracks.value.push({ id: `track-${Date.now()}-${i}`, name: `A${targetTrackIdx + 1}`, isMuted: false })
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

    mediaAssets.value = nextMap
    recordHistory()
    toast.success('Media Added', `Imported ${files.length} audio file(s) for mashup`)
    await nextTick()
    setTimeout(() => {
      drawAllClipWaveforms()
      drawRuler()
    }, 60)
  } catch (err: any) {
    toast.error('Import Failed', err.message || 'Unable to decode media.')
  } finally {
    isDecoding.value = false
  }
}

const triggerAddMedia = () => {
  extraFileInputRef.value?.click()
}

const triggerReplaceMedia = () => {
  replaceFileInputRef.value?.click()
}

const onExtraFilesChange = (e: Event) => {
  const f = (e.target as HTMLInputElement).files
  if (f && f.length > 0) addExtraMediaFiles(f)
}

const onReplaceFileChange = (e: Event) => {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) processMediaFile(f)
}

// Playback Engine
const updatePlaybackPosition = () => {
  if (!isPlaying.value || !audioCtx) return
  const elapsed = (audioCtx.currentTime - playbackStartTime) * playbackSpeed.value
  const pos = playbackOffset + elapsed

  if (pos >= totalTimelineDuration.value) {
    if (isLooping.value) playAudio()
    else {
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
    if (clip.timelineStart + clipDuration <= currentTime.value) return

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = playbackSpeed.value

    const clipGain = ctx.createGain()
    const baseClipVol = clip.volume !== undefined ? clip.volume : 1.0
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

    if (clip.keyframes && clip.keyframes.length > 0) {
      clip.keyframes.forEach(kf => {
        const kfTimelineTime = clip.timelineStart + kf.timeOffset
        if (kfTimelineTime > currentTime.value) {
          const delay = (kfTimelineTime - currentTime.value) / playbackSpeed.value
          clipGain.gain.linearRampToValueAtTime(kf.volume * baseClipVol, ctx.currentTime + delay)
        }
      })
    }

    if (currentTime.value <= clip.timelineStart) {
      const delay = (clip.timelineStart - currentTime.value) / playbackSpeed.value
      source.start(ctx.currentTime + delay, clip.sourceStart, clipDuration)
    } else {
      const offsetInClip = currentTime.value - clip.timelineStart
      source.start(ctx.currentTime, clip.sourceStart + offsetInClip, clipDuration - offsetInClip)
    }

    activeSourceNodes.push(source)
    activeGainNodes.push(clipGain)
  })

  isPlaying.value = true
  animationFrameId = requestAnimationFrame(updatePlaybackPosition)
  renderCavaVisualizer()
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
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  if (cavaAnimId) cancelAnimationFrame(cavaAnimId)
  animationFrameId = null
  cavaAnimId = null
  isPlaying.value = false
  renderCavaVisualizer()
}

const togglePlay = () => isPlaying.value ? stopPlayback() : playAudio()

const seekRelative = (delta: number) => {
  currentTime.value = Math.max(0, Math.min(totalTimelineDuration.value, currentTime.value + delta))
  if (isPlaying.value) playAudio()
}

// Magnetic Snapping Resolver
const snapThresholdSec = computed(() => Math.max(0.15, (totalTimelineDuration.value / 100) * 0.8))

const applySnapping = (targetStart: number, targetClipId: string): number => {
  if (!isSnapping.value) return targetStart
  const thresh = snapThresholdSec.value
  if (Math.abs(targetStart) < thresh) return 0
  if (Math.abs(targetStart - currentTime.value) < thresh) return currentTime.value

  for (const c of clips.value) {
    if (c.id === targetClipId) continue
    const cEnd = c.timelineStart + (c.sourceEnd - c.sourceStart)
    if (Math.abs(targetStart - cEnd) < thresh) return cEnd
    if (Math.abs(targetStart - c.timelineStart) < thresh) return c.timelineStart
  }
  return targetStart
}

// Drag & Drop Timeline Handlers
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
  if ((e.target as HTMLElement).closest('.cursor-grab') || (e.target as HTMLElement).closest('button')) return
  startPlayheadDrag(e)
}

const onGlobalMouseMove = (e: MouseEvent) => {
  if (!dragMode.value || !timelineBodyRef.value) return
  const rect = timelineBodyRef.value.getBoundingClientRect()
  const pxPerSec = rect.width / totalTimelineDuration.value
  const deltaSec = (e.clientX - dragStartX) / pxPerSec

  if (dragMode.value === 'playhead') {
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    currentTime.value = Number((percent * totalTimelineDuration.value).toFixed(3))
    return
  }

  const clip = clips.value.find(c => c.id === draggingClipId.value)
  if (!clip) return

  if (dragMode.value === 'move-clip') {
    const rawStart = Math.max(0, initialTimelineStart + deltaSec)
    clip.timelineStart = Number(applySnapping(rawStart, clip.id).toFixed(3))

    const trackOffset = Math.round((e.clientY - dragStartY) / 64)
    const newTrackIndex = Math.max(0, Math.min(tracks.value.length - 1, initialTrackIndex + trackOffset))
    clip.trackIndex = newTrackIndex
    selectedTrackIndex.value = newTrackIndex
    drawAllClipWaveforms()
  } else if (dragMode.value === 'trim-start') {
    const newSourceStart = Math.max(0, Math.min(initialSourceEnd - 0.2, initialSourceStart + deltaSec))
    clip.sourceStart = Number(newSourceStart.toFixed(3))
    clip.timelineStart = Math.max(0, Number((initialTimelineStart + (newSourceStart - initialSourceStart)).toFixed(3)))
    drawAllClipWaveforms()
  } else if (dragMode.value === 'trim-end') {
    const asset = mediaAssets.value.get(clip.mediaId)
    const maxSource = asset ? asset.duration : (currentAudioBuffer.value?.duration || 1000)
    clip.sourceEnd = Number(Math.min(maxSource, Math.max(initialSourceStart + 0.2, initialSourceEnd + deltaSec)).toFixed(3))
    drawAllClipWaveforms()
  }
}

const onGlobalMouseUp = () => {
  if (dragMode.value === 'move-clip' || dragMode.value === 'trim-start' || dragMode.value === 'trim-end') {
    recordHistory()
  }
  if (dragMode.value === 'playhead' && isPlaying.value) playAudio()
  dragMode.value = null
  draggingClipId.value = null
  window.removeEventListener('mousemove', onGlobalMouseMove)
  window.removeEventListener('mouseup', onGlobalMouseUp)
}

// Track-Aware Split & Trim
const getTargetClipAtPlayhead = (): AudioClip | null => {
  if (selectedClipId.value) {
    const sel = clips.value.find(c => c.id === selectedClipId.value)
    if (sel && currentTime.value >= sel.timelineStart && currentTime.value <= sel.timelineStart + (sel.sourceEnd - sel.sourceStart)) {
      return sel
    }
  }
  if (selectedTrackIndex.value !== null) {
    const trackClip = clips.value.find(c => c.trackIndex === selectedTrackIndex.value && currentTime.value >= c.timelineStart && currentTime.value <= c.timelineStart + (c.sourceEnd - c.sourceStart))
    if (trackClip) return trackClip
  }
  return clips.value.find(c => currentTime.value >= c.timelineStart && currentTime.value <= c.timelineStart + (c.sourceEnd - c.sourceStart)) || null
}

const splitAtPlayhead = () => {
  const target = getTargetClipAtPlayhead()
  if (!target) {
    toast.warning('Split Unavailable', 'Select a clip or place playhead inside an audio clip to split')
    return
  }
  const clipDur = target.sourceEnd - target.sourceStart
  if (currentTime.value <= target.timelineStart || currentTime.value >= target.timelineStart + clipDur) {
    toast.warning('Split Out of Bounds', 'Playhead must be inside the clip to split')
    return
  }

  const offsetInClip = currentTime.value - target.timelineStart
  const splitSourceTime = target.sourceStart + offsetInClip
  const newTrackIdx = target.trackIndex + 1

  if (newTrackIdx >= tracks.value.length) {
    tracks.value.push({ id: `track-${Date.now()}`, name: `A${tracks.value.length + 1}`, isMuted: false })
  }

  const clip1: AudioClip = {
    ...target,
    id: `clip-${Date.now()}-1`,
    sourceEnd: splitSourceTime,
    keyframes: target.keyframes?.filter(k => k.timeOffset < offsetInClip) || []
  }

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

const splitLeft = () => {
  const target = getTargetClipAtPlayhead()
  if (!target) return
  const offset = currentTime.value - target.timelineStart
  target.sourceStart += offset
  target.timelineStart = currentTime.value
  if (target.keyframes) {
    target.keyframes = target.keyframes.filter(k => k.timeOffset >= offset).map(k => ({ ...k, timeOffset: k.timeOffset - offset }))
  }
  recordHistory()
  drawAllClipWaveforms()
  toast.info('Trim Left', `Cut left portion of ${target.name}`)
}

const splitRight = () => {
  const target = getTargetClipAtPlayhead()
  if (!target) return
  const offset = currentTime.value - target.timelineStart
  target.sourceEnd = target.sourceStart + offset
  if (target.keyframes) target.keyframes = target.keyframes.filter(k => k.timeOffset <= offset)
  recordHistory()
  drawAllClipWaveforms()
  toast.info('Trim Right', `Cut right portion of ${target.name}`)
}

const deleteSelectedClip = () => {
  if (!selectedClipId.value) return
  const idx = clips.value.findIndex(c => c.id === selectedClipId.value)
  if (idx !== -1) {
    clips.value.splice(idx, 1)
    selectedClipId.value = clips.value[0]?.id || null
    recordHistory()
    drawAllClipWaveforms()
    toast.info('Clip Deleted', 'Removed clip from timeline')
  }
}

const addTrack = () => {
  tracks.value.push({ id: `track-${Date.now()}`, name: `A${tracks.value.length + 1}`, isMuted: false })
  selectedTrackIndex.value = tracks.value.length - 1
  toast.info('Track Added', `Created track A${tracks.value.length}`)
}

const deleteTrack = (tIndex: number) => {
  if (tracks.value.length <= 1) return
  const targetTrackIdx = Math.max(0, tIndex - 1)
  clips.value.forEach(clip => {
    if (clip.trackIndex === tIndex) clip.trackIndex = targetTrackIdx
    else if (clip.trackIndex > tIndex) clip.trackIndex -= 1
  })
  tracks.value.splice(tIndex, 1)
  tracks.value.forEach((t, i) => t.name = `A${i + 1}`)
  selectedTrackIndex.value = Math.min(selectedTrackIndex.value, tracks.value.length - 1)
  recordHistory()
  drawAllClipWaveforms()
}

// Encoders (WAV & MP3)
const encodeWav = (buffer: AudioBuffer): Blob => {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const length = buffer.length * numChannels * 2
  const arrayBuffer = new ArrayBuffer(44 + length)
  const view = new DataView(arrayBuffer)
  const writeStr = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + length, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * 2, true)
  view.setUint16(32, numChannels * 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, length, true)

  const channels = [buffer.getChannelData(0), numChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0)]
  let offset = 44
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      offset += 2
    }
  }
  return new Blob([view], { type: 'audio/wav' })
}

const encodeMp3 = (buffer: AudioBuffer, bitrate = 320): Blob => {
  const numChannels = buffer.numberOfChannels
  const mp3Encoder = new Mp3Encoder(numChannels, buffer.sampleRate, bitrate)
  const mp3Data: Uint8Array[] = []
  const left = buffer.getChannelData(0)
  const right = numChannels > 1 ? buffer.getChannelData(1) : left

  const leftInt16 = new Int16Array(left.length)
  const rightInt16 = new Int16Array(right.length)
  for (let i = 0; i < left.length; i++) {
    const l = Math.max(-1, Math.min(1, left[i]))
    const r = Math.max(-1, Math.min(1, right[i]))
    leftInt16[i] = l < 0 ? l * 0x8000 : l * 0x7fff
    rightInt16[i] = r < 0 ? r * 0x8000 : r * 0x7fff
  }

  const blockSize = 1152
  for (let i = 0; i < leftInt16.length; i += blockSize) {
    const lChunk = leftInt16.subarray(i, i + blockSize)
    const rChunk = rightInt16.subarray(i, i + blockSize)
    const buf = numChannels === 1 ? mp3Encoder.encodeBuffer(lChunk) : mp3Encoder.encodeBuffer(lChunk, rChunk)
    if (buf.length > 0) mp3Data.push(buf)
  }
  const endBuf = mp3Encoder.flush()
  if (endBuf.length > 0) mp3Data.push(endBuf)
  return new Blob(mp3Data as BlobPart[], { type: 'audio/mp3' })
}

const handleExportAudio = async () => {
  if (clips.value.length === 0) return
  isExporting.value = true
  stopPlayback()

  try {
    const totalDuration = totalTimelineDuration.value
    let maxRate = 44100
    mediaAssets.value.forEach(a => { if (a.sampleRate > maxRate) maxRate = a.sampleRate })
    const offlineCtx = new OfflineAudioContext(2, Math.floor(totalDuration * maxRate), maxRate)

    clips.value.forEach(clip => {
      const track = tracks.value[clip.trackIndex]
      if (track && track.isMuted) return
      const asset = mediaAssets.value.get(clip.mediaId)
      const buffer = asset ? asset.buffer : currentAudioBuffer.value
      if (!buffer) return

      const sourceNode = offlineCtx.createBufferSource()
      sourceNode.buffer = buffer
      const clipGain = offlineCtx.createGain()
      const baseClipVol = clip.volume !== undefined ? clip.volume : 1.0

      if (clip.keyframes && clip.keyframes.length > 0) {
        clipGain.gain.setValueAtTime(getClipVolumeAtTime(clip, 0) * baseClipVol, clip.timelineStart)
        clip.keyframes.forEach(kf => {
          clipGain.gain.linearRampToValueAtTime(kf.volume * baseClipVol, clip.timelineStart + kf.timeOffset)
        })
      } else {
        clipGain.gain.value = baseClipVol
      }

      sourceNode.connect(clipGain)
      clipGain.connect(offlineCtx.destination)
      sourceNode.start(clip.timelineStart, clip.sourceStart, clip.sourceEnd - clip.sourceStart)
    })

    const rendered = await offlineCtx.startRendering()
    const ext = exportFormat.value
    const blob = ext === 'mp3' ? encodeMp3(rendered, mp3Bitrate.value) : encodeWav(rendered)
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    let targetName = exportFileName.value.trim() || `mashup_export.${ext}`
    if (!targetName.endsWith(`.${ext}`)) targetName = targetName.replace(/\.[^/.]+$/, '') + `.${ext}`
    link.download = targetName
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 1500)
    toast.success('Audio Exported', `Saved ${formatTimecode(totalDuration)} as ${ext.toUpperCase()}`)
  } catch (err: any) {
    toast.error('Export Failed', err.message || 'Could not render audio')
  } finally {
    isExporting.value = false
  }
}

// Watchers & Keyboard Shortcuts
watch([volume, isMuted], () => {
  if (masterGainNode) masterGainNode.gain.value = isMuted.value ? 0 : volume.value
})

watch(playbackSpeed, (val) => {
  activeSourceNodes.forEach(n => n.playbackRate.value = val)
})

watch([clips, zoomLevel, selectedClipId], () => {
  nextTick(() => {
    drawAllClipWaveforms()
    drawRuler()
  })
}, { deep: true })

const handleKeydown = (e: KeyboardEvent) => {
  const tag = (e.target as HTMLElement).tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if (e.code === 'Space') { e.preventDefault(); togglePlay() }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo() }
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelectedClip() }
  else if (e.key === 's' || e.key === 'S') { e.preventDefault(); splitAtPlayhead() }
  else if (e.key === '[') { e.preventDefault(); splitLeft() }
  else if (e.key === ']') { e.preventDefault(); splitRight() }
  else if (e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); toggleKeyframeAtPlayhead() }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', () => { drawAllClipWaveforms(); drawRuler() })
  if (timelineBodyRef.value) {
    resizeObs = new ResizeObserver(() => {
      drawAllClipWaveforms()
      drawRuler()
      renderCavaVisualizer()
    })
    resizeObs.observe(timelineBodyRef.value)
  }
})

onUnmounted(() => {
  stopPlayback()
  if (resizeObs) resizeObs.disconnect()
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="space-y-4 pb-12 w-full">
    <!-- Hidden Global File Inputs -->
    <input ref="fileInputRef" type="file" accept="audio/*,video/mp4,video/webm,video/quicktime" class="hidden" @change="(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) processMediaFile(f) }" />
    <input ref="extraFileInputRef" type="file" multiple accept="audio/*,video/mp4,video/webm,video/quicktime" class="hidden" @change="onExtraFilesChange" />
    <input ref="replaceFileInputRef" type="file" accept="audio/*,video/mp4,video/webm,video/quicktime" class="hidden" @change="onReplaceFileChange" />

    <!-- State 1: Empty Dropzone -->
    <div v-if="!currentAudioBuffer" class="space-y-6">
      <div class="space-y-2">
        <div class="flex items-center gap-2 text-xs font-mono text-[var(--text-tertiary)]">
          <NuxtLink to="/" class="hover:text-white transition-colors">Dashboard</NuxtLink>
          <span>/</span>
          <span>Tools</span>
          <span>/</span>
          <span class="text-white">{{ t.tools['audio-cutter']?.title || 'Audio Extractor & Trimmer' }}</span>
        </div>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              {{ t.tools['audio-cutter']?.title || 'Audio Extractor & Trimmer' }}
            </h1>
            <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              {{ t.tools['audio-cutter']?.description || 'Extract sound from video or audio files, split clips, import multiple tracks, and create music mashups with keyframe volume automation.' }}
            </p>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <Badge variant="badge">{{ t.clientPrivacy }}</Badge>
          </div>
        </div>
      </div>

      <div
        class="relative border-2 border-dashed rounded-[14px] p-8 sm:p-14 text-center transition-all cursor-pointer select-none border-[#2E2E2E] bg-[#141416] hover:border-[#3E3E3E]"
        :class="isDragging ? 'border-white bg-[var(--bg-card-hover)]' : ''"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="(e) => { isDragging = false; if (e.dataTransfer?.files[0]) processMediaFile(e.dataTransfer.files[0]) }"
        @click="fileInputRef?.click()"
      >
        <div class="max-w-md mx-auto space-y-3">
          <div class="w-12 h-12 mx-auto rounded-xl bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-white shadow-xs">
            <Music class="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 class="text-sm font-semibold text-[var(--text-primary)]">
              {{ t.dropzoneBrowse }}
            </h3>
            <p class="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
              {{ t.dropzoneAudioDesc }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- State 2: Studio Timeline Workspace -->
    <div v-else class="space-y-4">
      <!-- Top Header Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#141416] border border-[#262626]">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-8 h-8 rounded-lg bg-[#222226] flex items-center justify-center shrink-0">
            <Music class="w-4 h-4 text-white" />
          </div>
          <div class="min-w-0">
            <h1 class="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">{{ fileName }}</h1>
            <p class="text-xs text-[var(--text-tertiary)] truncate">
              {{ formatTimecode(totalTimelineDuration) }} • {{ mediaAssets.size }} Media • {{ clips.length }} Clip{{ clips.length > 1 ? 's' : '' }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <!-- Add Media Button -->
          <Button variant="secondary" size="sm" class="font-medium cursor-pointer" @click="triggerAddMedia">
            <Plus class="w-3.5 h-3.5 mr-1.5" />
            <span>{{ t.addMedia }}</span>
          </Button>

          <!-- Replace Button -->
          <Button variant="secondary" size="sm" class="font-medium cursor-pointer" @click="triggerReplaceMedia">
            <FolderOpen class="w-3.5 h-3.5 mr-1.5 text-white/70" />
            <span>Replace</span>
          </Button>

          <div class="flex items-center bg-[#222226] border border-white/10 rounded-lg p-0.5">
            <button type="button" class="px-2 py-1 rounded-md text-[11px] font-mono cursor-pointer" :class="exportFormat === 'mp3' ? 'bg-white text-black font-bold' : 'text-white/60 hover:text-white'" @click="exportFormat = 'mp3'">MP3</button>
            <button type="button" class="px-2 py-1 rounded-md text-[11px] font-mono cursor-pointer" :class="exportFormat === 'wav' ? 'bg-white text-black font-bold' : 'text-white/60 hover:text-white'" @click="exportFormat = 'wav'">WAV</button>
          </div>

          <Button variant="primary" size="sm" class="font-semibold shadow-xs" :disabled="isExporting" @click="handleExportAudio">
            <Download class="w-3.5 h-3.5 mr-1.5" />
            <span>{{ isExporting ? 'Exporting...' : `Export ${exportFormat.toUpperCase()}` }}</span>
          </Button>
        </div>
      </div>

      <!-- Upper Section: Player Stage + Keyframe Inspector -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <!-- Player Deck (8 cols) -->
        <div class="lg:col-span-8 rounded-xl bg-[#0e0e10] border border-[#262626] p-6 flex flex-col justify-between space-y-4 min-h-[300px]">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-white inline-block animate-pulse" />
              <span class="text-xs font-mono text-white/90">AUDIO MONITOR</span>
            </div>
            <div class="text-xs font-mono text-[var(--text-tertiary)] flex items-center gap-2">
              <span>Selected: <strong class="text-white">{{ selectedClip ? formatTimecode(selectedClip.sourceEnd - selectedClip.sourceStart) : 'None' }}</strong></span>
              <span v-if="selectedClip?.keyframes?.length" class="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-white font-mono">
                {{ selectedClip.keyframes.length }} KF
              </span>
            </div>
          </div>

          <!-- LED Timecode + CAVA Spectrum Equalizer -->
          <div class="flex flex-col items-center justify-center space-y-3 py-1">
            <div class="text-3xl sm:text-5xl font-mono font-bold tracking-tight text-white select-none">
              {{ formatTimecode(currentTime) }}
            </div>
            <div class="text-xs font-mono text-[var(--text-tertiary)]">
              / {{ formatTimecode(totalTimelineDuration) }}
            </div>
            <!-- CAVA Terminal Spectrum Canvas -->
            <div class="w-full max-w-sm h-12 relative overflow-hidden flex items-center justify-center">
              <canvas ref="cavaCanvasRef" class="w-full h-full block" />
            </div>
          </div>

          <!-- Transport Controls -->
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-3 border-t border-[#262626]">
            <button type="button" class="p-2 rounded-lg bg-[#18181b] hover:bg-[#222226] text-white cursor-pointer" title="Seek -5s" @click="seekRelative(-5)">
              <Rewind class="w-4 h-4" />
            </button>

            <div class="flex items-center gap-3">
              <button type="button" class="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center transition-transform hover:scale-105 cursor-pointer shadow-md" :title="isPlaying ? 'Pause (Space)' : 'Play (Space)'" @click="togglePlay">
                <Pause v-if="isPlaying" class="w-5 h-5 fill-current" />
                <Play v-else class="w-5 h-5 fill-current ml-0.5" />
              </button>
              <button type="button" class="p-2.5 rounded-lg bg-[#18181b] hover:bg-[#222226] text-white cursor-pointer" :class="isLooping ? 'bg-white text-black' : ''" title="Toggle Loop" @click="isLooping = !isLooping">
                <Repeat class="w-4 h-4" />
              </button>
            </div>

            <div class="flex items-center gap-3">
              <button type="button" class="p-2 rounded-lg bg-[#18181b] hover:bg-[#222226] text-white cursor-pointer" title="Seek +5s" @click="seekRelative(5)">
                <FastForward class="w-4 h-4" />
              </button>
              <div class="flex items-center gap-2 pl-2 border-l border-[#262626]">
                <button type="button" class="text-[var(--text-secondary)] hover:text-white cursor-pointer" @click="isMuted = !isMuted">
                  <VolumeX v-if="isMuted || volume === 0" class="w-4 h-4 text-white/80" />
                  <Volume2 v-else class="w-4 h-4" />
                </button>
                <input v-model.number="volume" type="range" min="0" max="1" step="0.05" class="w-16 h-1.5 bg-[#2E2E2E] rounded-lg appearance-none cursor-pointer accent-white" />
              </div>
            </div>
          </div>
        </div>

        <!-- Inspector Panel (4 cols) -->
        <div class="lg:col-span-4 rounded-xl bg-[#141416] border border-[#262626] overflow-hidden flex flex-col justify-between max-h-[480px]">
          <div class="p-4 space-y-3 overflow-y-auto">
            <div class="flex items-center justify-between pb-2 border-b border-[#262626]">
              <span class="text-xs font-semibold text-white uppercase tracking-wider">Properties & Keyframe</span>
              <span class="text-[11px] font-mono text-[var(--text-tertiary)] truncate max-w-[150px]">
                {{ selectedClip ? selectedClip.name : 'No Clip Selected' }}
              </span>
            </div>

            <div v-if="selectedClip" class="p-2.5 rounded-lg bg-[#0e0e10] border border-white/5 space-y-1.5 font-mono text-[11px]">
              <div class="flex justify-between">
                <span class="text-[var(--text-tertiary)]">Media</span>
                <span class="text-white truncate max-w-[140px]">{{ selectedClip.name }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-[var(--text-tertiary)]">Track</span>
                <span class="text-white">A{{ selectedClip.trackIndex + 1 }} • {{ formatTimecode(selectedClip.timelineStart) }}</span>
              </div>
            </div>

            <!-- Volume Keyframe Controls -->
            <div v-if="selectedClip" class="space-y-2 p-2.5 rounded-lg bg-[#0e0e10] border border-[#262626]">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <Activity class="w-3.5 h-3.5 text-white" />
                  <span class="text-xs font-semibold text-white">Volume Keyframe</span>
                </div>
                <button
                  type="button"
                  class="p-1 rounded-md cursor-pointer flex items-center gap-1 text-xs font-mono"
                  :class="isPlayheadOnKeyframe ? 'bg-white text-black font-bold' : 'bg-[#1e1e24] text-white/80 hover:text-white border border-white/10'"
                  @click="toggleKeyframeAtPlayhead"
                >
                  <span>{{ isPlayheadOnKeyframe ? '◆ Remove' : '◇ Add KF' }}</span>
                </button>
              </div>

              <div class="grid grid-cols-3 gap-1 pt-1">
                <button type="button" class="py-1 rounded bg-[#18181b] hover:bg-[#222226] border border-white/5 text-[10px] text-[var(--text-secondary)] hover:text-white cursor-pointer flex items-center justify-center gap-1" @click="applyFadeIn(1.5)">
                  <TrendingUp class="w-3 h-3 text-white" />
                  <span>Fade In</span>
                </button>
                <button type="button" class="py-1 rounded bg-[#18181b] hover:bg-[#222226] border border-white/5 text-[10px] text-[var(--text-secondary)] hover:text-white cursor-pointer flex items-center justify-center gap-1" @click="applyFadeOut(1.5)">
                  <TrendingDown class="w-3 h-3 text-white" />
                  <span>Fade Out</span>
                </button>
                <button type="button" class="py-1 rounded bg-[#18181b] hover:bg-[#222226] border border-white/5 text-[10px] text-[var(--text-secondary)] hover:text-white cursor-pointer flex items-center justify-center gap-1" @click="applyDucking">
                  <Sparkles class="w-3 h-3 text-white" />
                  <span>Ducking</span>
                </button>
              </div>

              <!-- Keyframe List -->
              <div v-if="selectedClip.keyframes && selectedClip.keyframes.length > 0" class="space-y-1 pt-1">
                <div class="flex items-center justify-between text-[10px] font-mono text-[var(--text-tertiary)] uppercase">
                  <span>Points ({{ selectedClip.keyframes.length }})</span>
                  <button type="button" class="text-red-400 hover:underline cursor-pointer" @click="clearKeyframes">Clear</button>
                </div>
                <div class="max-h-24 overflow-y-auto space-y-1">
                  <div v-for="kf in selectedClip.keyframes" :key="kf.id" class="flex items-center justify-between gap-1 p-1 rounded bg-[#141416] border border-white/5 text-[11px] font-mono">
                    <span class="text-white">◆ {{ formatTimecode(selectedClip.timelineStart + kf.timeOffset) }}</span>
                    <div class="flex items-center gap-1.5">
                      <input v-model.number="kf.volume" type="range" min="0" max="1.5" step="0.05" class="w-12 h-1 bg-[#2E2E2E] rounded cursor-pointer accent-white" @input="drawAllClipWaveforms" @change="recordHistory" />
                      <span class="text-[10px] text-white/90 w-7 text-right">{{ Math.round(kf.volume * 100) }}%</span>
                      <button type="button" class="text-neutral-500 hover:text-red-400 cursor-pointer" @click="removeKeyframe(kf.id)"><X class="w-3 h-3" /></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Speed Multiplier -->
            <div class="space-y-1">
              <label class="text-[10px] font-mono text-[var(--text-secondary)] uppercase">Speed</label>
              <div class="grid grid-cols-5 gap-1 bg-[#0e0e10] p-1 rounded-lg border border-[#262626]">
                <button v-for="s in [0.5, 1.0, 1.25, 1.5, 2.0]" :key="s" type="button" class="py-1 rounded font-mono text-center text-xs cursor-pointer" :class="playbackSpeed === s ? 'bg-white text-black font-bold' : 'text-[var(--text-tertiary)] hover:text-white'" @click="playbackSpeed = s">{{ s }}x</button>
              </div>
            </div>
          </div>

          <!-- Inspector Export Bar -->
          <div class="p-3 bg-[#0e0e10] border-t border-[#262626] space-y-2">
            <input v-model="exportFileName" type="text" placeholder="Filename" class="w-full px-2.5 py-1.5 rounded-md bg-[#18181b] border border-white/10 text-xs font-mono text-white focus:outline-hidden focus:border-white/30" />
            <Button variant="primary" size="sm" class="w-full font-semibold" :disabled="isExporting || clips.length === 0" @click="handleExportAudio">
              <Download class="w-3.5 h-3.5 mr-1.5" />
              <span>{{ isExporting ? 'Rendering...' : `Download ${exportFormat.toUpperCase()}` }}</span>
            </Button>
          </div>
        </div>
      </div>

      <!-- Bottom Multi-Track Drag & Drop Studio -->
      <div class="rounded-xl bg-[#141416] border border-[#262626] overflow-hidden">
        <!-- Action Toolbar -->
        <div class="px-4 py-2 bg-[#0e0e10] border-b border-[#262626] flex flex-wrap items-center justify-between gap-3 select-none">
          <div class="flex items-center gap-1">
            <button type="button" class="p-1.5 rounded-lg cursor-pointer" :class="canUndo ? 'text-white hover:bg-[#222226]' : 'text-white/20 cursor-not-allowed'" :disabled="!canUndo" title="Undo (Ctrl+Z)" @click="undo">
              <Undo2 class="w-4 h-4" />
            </button>
            <button type="button" class="p-1.5 rounded-lg cursor-pointer" :class="canRedo ? 'text-white hover:bg-[#222226]' : 'text-white/20 cursor-not-allowed'" :disabled="!canRedo" title="Redo (Ctrl+Y)" @click="redo">
              <Redo2 class="w-4 h-4" />
            </button>

            <div class="w-px h-4 bg-[#262626] mx-1" />

            <button type="button" class="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-[#222226] cursor-pointer" title="Trim Left ( [ )" @click="splitLeft">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-dasharray="2 2" d="M4 6h4v12H4z" /><path d="M12 3v18" stroke-width="2" /><path d="M16 6h4v12h-4z" /></svg>
            </button>
            <button type="button" class="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-[#222226] cursor-pointer" title="Split at Playhead ( S )" @click="splitAtPlayhead">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 6h2v12H7" /><path d="M12 3v18" stroke-width="2" /><path d="M17 6h-2v12h2" /></svg>
            </button>
            <button type="button" class="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-[#222226] cursor-pointer" title="Trim Right ( ] )" @click="splitRight">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h4v12H4z" /><path d="M12 3v18" stroke-width="2" /><path stroke-dasharray="2 2" d="M16 6h4v12h-4z" /></svg>
            </button>

            <div class="w-px h-4 bg-[#262626] mx-1" />

            <!-- Keyframe Quick Toggle -->
            <button type="button" class="p-1.5 rounded-lg cursor-pointer flex items-center gap-1 text-xs" :class="isPlayheadOnKeyframe ? 'bg-white text-black font-bold' : 'text-white/80 hover:text-white hover:bg-[#222226]'" title="Add/Remove Keyframe (Alt+K)" @click="toggleKeyframeAtPlayhead">
              <span class="text-sm leading-none">{{ isPlayheadOnKeyframe ? '◆' : '◇' }}</span>
              <span class="hidden sm:inline text-[11px]">{{ isPlayheadOnKeyframe ? 'Remove KF' : 'Add KF' }}</span>
            </button>
            <button v-if="selectedClip?.keyframes?.length" type="button" class="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-[#222226] cursor-pointer text-xs" title="Previous KF" @click="jumpToPrevKeyframe">◀◇</button>
            <button v-if="selectedClip?.keyframes?.length" type="button" class="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-[#222226] cursor-pointer text-xs" title="Next KF" @click="jumpToNextKeyframe">◇▶</button>

            <div class="w-px h-4 bg-[#262626] mx-1" />

            <button type="button" class="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-[#222226] cursor-pointer" title="Delete Clip (Del)" @click="deleteSelectedClip">
              <Trash2 class="w-4 h-4" />
            </button>

            <button type="button" class="py-1 px-2 rounded-md bg-[#18181b] hover:bg-[#222226] border border-white/5 text-[11px] text-[var(--text-secondary)] hover:text-white cursor-pointer flex items-center gap-1 ml-2" @click="addTrack">
              <Plus class="w-3 h-3" />
              <span>Add Track</span>
            </button>

            <!-- Import Audio Button in Toolbar -->
            <Button variant="secondary" size="sm" class="font-medium text-[11px] h-7 px-2.5 ml-1.5 cursor-pointer" @click="triggerAddMedia">
              <FileAudio class="w-3.5 h-3.5 mr-1 text-white/90" />
              <span>Add Media</span>
            </Button>
          </div>

          <!-- Right: Snapping & Zoom Controls -->
          <div class="flex items-center gap-2 text-[11px] font-mono text-[var(--text-tertiary)]">
            <!-- Magnetic Snapping Toggle -->
            <button
              type="button"
              class="p-1.5 rounded-md cursor-pointer flex items-center gap-1 transition-colors"
              :class="isSnapping ? 'bg-white/15 text-white' : 'text-neutral-500 hover:text-white'"
              :title="isSnapping ? 'Magnetic Snapping Active' : 'Enable Magnetic Snapping'"
              @click="isSnapping = !isSnapping"
            >
              <Magnet class="w-3.5 h-3.5" />
              <span class="hidden md:inline text-[10px]">Snap</span>
            </button>

            <!-- Zoom Controls -->
            <div class="flex items-center bg-[#18181b] border border-white/5 rounded-md p-0.5">
              <button type="button" class="p-1 text-neutral-400 hover:text-white cursor-pointer" title="Zoom Out" @click="zoomLevel = Math.max(0.5, Number((zoomLevel - 0.25).toFixed(2)))">
                <ZoomOut class="w-3 h-3" />
              </button>
              <span class="px-1.5 text-[10px] text-white font-mono">{{ Math.round(zoomLevel * 100) }}%</span>
              <button type="button" class="p-1 text-neutral-400 hover:text-white cursor-pointer" title="Zoom In" @click="zoomLevel = Math.min(3, Number((zoomLevel + 0.25).toFixed(2)))">
                <ZoomIn class="w-3 h-3" />
              </button>
            </div>

            <span class="hidden sm:inline">Total: <strong class="text-white">{{ formatTimecode(totalTimelineDuration) }}</strong></span>
          </div>
        </div>

        <!-- Timeline Scrollable Workspace -->
        <div class="p-3 space-y-2 bg-[#121214] overflow-x-auto">
          <!-- Ruler -->
          <div class="flex items-center gap-3" :style="{ minWidth: `${100 * zoomLevel}%` }">
            <div class="w-20 shrink-0 text-[10px] font-mono uppercase text-[var(--text-tertiary)]">RULER</div>
            <div class="flex-1 h-6 relative overflow-hidden cursor-pointer" @mousedown="startRulerDrag">
              <canvas ref="rulerCanvasRef" class="w-full h-full block" />
            </div>
          </div>

          <!-- Track Lanes -->
          <div class="flex items-start gap-3 relative" :style="{ minWidth: `${100 * zoomLevel}%` }">
            <!-- Headers -->
            <div class="w-20 shrink-0 space-y-1.5 select-none">
              <div
                v-for="(track, tIndex) in tracks"
                :key="track.id"
                class="p-2 rounded-lg cursor-pointer flex items-center justify-between h-14 transition-all"
                :class="selectedTrackIndex === tIndex ? 'bg-[#222226] border border-white/40 ring-1 ring-white/10' : 'bg-[#18181b] border border-white/5 hover:border-white/20'"
                @click="selectTrack(tIndex)"
              >
                <span class="w-5 h-5 rounded font-mono font-bold text-[10px] flex items-center justify-center" :class="selectedTrackIndex === tIndex ? 'bg-white text-black' : 'bg-[#262626] text-white/80'">
                  {{ track.name }}
                </span>
                <div class="flex items-center gap-1">
                  <button type="button" class="p-1 rounded hover:bg-white/10 text-[var(--text-secondary)] hover:text-white cursor-pointer" @click.stop="track.isMuted = !track.isMuted">
                    <VolumeX v-if="track.isMuted" class="w-3.5 h-3.5 text-white" />
                    <Volume2 v-else class="w-3.5 h-3.5" />
                  </button>
                  <button v-if="tracks.length > 1" type="button" class="p-1 rounded hover:bg-red-500/20 text-[var(--text-tertiary)] hover:text-red-400 cursor-pointer" title="Delete Track" @click.stop="deleteTrack(tIndex)">
                    <X class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Body with Clips & Master Playhead -->
            <div ref="timelineBodyRef" class="flex-1 space-y-1.5 relative select-none cursor-pointer" @mousedown="onTimelineBodyMouseDown">
              <div
                v-for="(track, tIndex) in tracks"
                :key="track.id"
                class="h-14 rounded-lg relative overflow-hidden transition-colors"
                :class="selectedTrackIndex === tIndex ? 'bg-[#0f0f12] border border-white/30' : 'bg-[#0a0a0c] border border-[#222226]'"
                @mousedown="selectTrack(tIndex)"
              >
                <!-- Clips on Track -->
                <div
                  v-for="clip in clips.filter(c => c.trackIndex === tIndex)"
                  :key="clip.id"
                  class="absolute top-1 bottom-1 rounded-md overflow-hidden select-none cursor-grab active:cursor-grabbing z-10 transition-shadow"
                  :class="selectedClipId === clip.id ? 'ring-2 ring-white shadow-lg bg-[#1a1a1e]' : 'border border-white/20 bg-[#161618] hover:border-white/40'"
                  :style="{
                    left: `${(clip.timelineStart / totalTimelineDuration) * 100}%`,
                    width: `${((clip.sourceEnd - clip.sourceStart) / totalTimelineDuration) * 100}%`,
                    minWidth: '24px'
                  }"
                  @mousedown="(e) => startClipDrag(e, clip, 'move-clip')"
                >
                  <div class="absolute top-1 left-1.5 right-1.5 flex items-center justify-between pointer-events-none z-10 text-[9px] font-mono text-white/90 truncate">
                    <div class="flex items-center gap-1 truncate">
                      <Music class="w-2.5 h-2.5 shrink-0" />
                      <span class="truncate">{{ clip.name }}</span>
                    </div>
                    <span v-if="clip.keyframes?.length" class="text-white/80 shrink-0">◆ {{ clip.keyframes.length }}</span>
                  </div>

                  <canvas :id="`canvas-${clip.id}`" class="w-full h-full block opacity-90" />

                  <!-- Trim Handles -->
                  <div v-if="selectedClipId === clip.id" class="absolute left-0 top-0 bottom-0 w-3 bg-white cursor-ew-resize flex items-center justify-center z-20 hover:brightness-110" title="Trim start" @mousedown="(e) => startClipDrag(e, clip, 'trim-start')">
                    <div class="w-0.5 h-4 bg-black/60 rounded-full" />
                  </div>
                  <div v-if="selectedClipId === clip.id" class="absolute right-0 top-0 bottom-0 w-3 bg-white cursor-ew-resize flex items-center justify-center z-20 hover:brightness-110" title="Trim end" @mousedown="(e) => startClipDrag(e, clip, 'trim-end')">
                    <div class="w-0.5 h-4 bg-black/60 rounded-full" />
                  </div>
                </div>
              </div>

              <!-- Master Playhead Line -->
              <div class="absolute top-0 bottom-0 z-30 flex flex-col items-center select-none" :style="{ left: `${(currentTime / totalTimelineDuration) * 100}%`, transform: 'translateX(-50%)' }">
                <div class="w-4 h-4 bg-white rotate-45 -mt-1 shadow-lg cursor-ew-resize hover:scale-125 transition-transform flex items-center justify-center shrink-0" title="Drag Playhead" @mousedown.stop="startPlayheadDrag" />
                <div class="w-4 flex-1 flex justify-center cursor-ew-resize group" title="Drag Playhead" @mousedown.stop="startPlayheadDrag">
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
