<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import {
  Type,
  Download,
  Copy,
  Play,
  Pause,
  Sliders,
  Palette,
  Check,
  Film,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignJustify
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import { useClipboard } from '~/composables/useClipboard'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

// Import gifshot for client-side animated GIF export
let gifshot: any = null

const toast = useToast()
const { copy } = useClipboard()

// Mode: 'static' (Full text static image) vs 'animated' (Word-by-word GIF)
const outputMode = ref<'static' | 'animated'>('static')

// State matching authentic meme format
const textInput = ref('Do       you\nthink I have\nforgotten?')
const frameDelay = ref(500)
const blurAmount = ref(2.2)
const verticalStretch = ref(1.15)
const letterSpacing = ref(-0.5)
const fontSizeMultiplier = ref(1.0)
const fontWeight = ref<'400' | '500' | '700'>('500')
const textAlign = ref<'left' | 'center' | 'justify'>('left')
const textCase = ref<'original' | 'lower' | 'upper'>('original')
const aspectRatio = ref<'1:1' | '9:16' | '16:9'>('1:1')

// Color Palette State
const PRESET_THEMES = [
  { id: 'brat-white', name: 'White Meme', bg: '#FFFFFF', text: '#000000' },
  { id: 'brat-green', name: 'Brat Lime', bg: '#8ACE00', text: '#000000' },
  { id: 'brat-black', name: 'Deluxe Black', bg: '#000000', text: '#FFFFFF' },
  { id: 'brat-pink', name: 'Club Pink', bg: '#FF69B4', text: '#000000' },
  { id: 'brat-blue', name: 'Classic Blue', bg: '#00D4FF', text: '#000000' },
  { id: 'brat-orange', name: 'Neon Orange', bg: '#FF5722', text: '#000000' },
]

const selectedThemeId = ref('brat-white')
const customBgColor = ref('#FFFFFF')
const customTextColor = ref('#000000')

// Quick Meme Presets
const MEME_PRESETS = [
  'Do       you\nthink I have\nforgotten?',
  'brat',
  '365\nparty girl',
  'talk\ntalk',
  'sympathy is\na knife',
  'everything\nis romantic',
  'apple',
  'so iconic',
  'sipaling\ncoding',
  'kamu\nnanya?',
  'menyala\nabangku'
]

// Canvas References & Animation
const canvasRef = ref<HTMLCanvasElement | null>(null)
const isPlaying = ref(false)
const currentWordIndex = ref(0)
const isExportingGif = ref(false)
const gifProgress = ref(0)
const isCopied = ref(false)

let animationTimer: any = null

const activeText = computed(() => {
  let val = textInput.value || 'brat'
  if (textCase.value === 'lower') return val.toLowerCase()
  if (textCase.value === 'upper') return val.toUpperCase()
  return val
})

const wordsList = computed(() => {
  return activeText.value.trim().split(/\s+/).filter(Boolean)
})

const canvasDimensions = computed(() => {
  if (aspectRatio.value === '9:16') return { width: 540, height: 960 }
  if (aspectRatio.value === '16:9') return { width: 960, height: 540 }
  return { width: 500, height: 500 }
})

// Apply preset theme
const selectTheme = (theme: typeof PRESET_THEMES[0]) => {
  selectedThemeId.value = theme.id
  customBgColor.value = theme.bg
  customTextColor.value = theme.text
  drawCanvas()
}

// Render canvas frame matching authentic low-fi meme look
const drawCanvas = (textToRender = activeText.value) => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { width, height } = canvasDimensions.value
  canvas.width = width
  canvas.height = height

  // Fill Background
  ctx.fillStyle = customBgColor.value
  ctx.fillRect(0, 0, width, height)

  if (!textToRender.trim()) return

  // Font family priority for authentic condensed narrow look
  const fontFamilies = '"Arial Narrow", "Nimbus Sans Narrow", "Franklin Gothic Medium", "Helvetica Neue Condensed", "Arial", sans-serif'
  const paddingX = width * 0.08
  const paddingY = height * 0.08
  const maxContentWidth = width - paddingX * 2
  const maxContentHeight = height - paddingY * 2

  // Split input into explicit lines if present
  const rawLines = textToRender.split('\n')
  
  // Calculate dynamic font size to fill the box
  let lines: string[] = []
  let calculatedFontSize = Math.min(width, height) * 0.28 * fontSizeMultiplier.value
  let lineHeight = calculatedFontSize * 0.98

  ctx.save()

  // Iterate to find font size that fits canvas bounds
  for (let s = calculatedFontSize; s >= 18; s -= 2) {
    ctx.font = `${fontWeight.value} ${s}px ${fontFamilies}`
    lineHeight = s * 0.96

    lines = []
    for (const rawLine of rawLines) {
      if (!rawLine.trim()) {
        lines.push('')
        continue
      }
      const words = rawLine.split(' ')
      let currentLine = ''
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const metrics = ctx.measureText(testLine)
        if (metrics.width > maxContentWidth && currentLine) {
          lines.push(currentLine)
          currentLine = word
        } else {
          currentLine = testLine
        }
      }
      if (currentLine) lines.push(currentLine)
    }

    const totalH = lines.length * lineHeight
    if (totalH <= maxContentHeight) {
      calculatedFontSize = s
      break
    }
  }

  // Apply Authentic Low-Fi Blur
  if (blurAmount.value > 0) {
    ctx.filter = `blur(${blurAmount.value}px)`
  }

  ctx.font = `${fontWeight.value} ${calculatedFontSize}px ${fontFamilies}`
  ctx.fillStyle = customTextColor.value
  ctx.textBaseline = 'middle'

  const totalTextHeight = lines.length * lineHeight
  const startY = (height - totalTextHeight) / 2 + lineHeight / 2

  // Measure widest line for block centering
  let maxLineWidth = 0
  for (const line of lines) {
    const w = ctx.measureText(line).width
    if (w > maxLineWidth) maxLineWidth = w
  }

  const blockLeftX = (width - maxLineWidth) / 2

  // Render each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    const y = startY + i * lineHeight

    ctx.save()
    ctx.scale(1, verticalStretch.value)
    const scaledY = y / verticalStretch.value

    if (letterSpacing.value !== 0) {
      ctx.letterSpacing = `${letterSpacing.value}px`
    }

    if (textAlign.value === 'center') {
      ctx.textAlign = 'center'
      ctx.fillText(line, width / 2, scaledY)
    } else if (textAlign.value === 'justify' && line.includes(' ')) {
      const words = line.split(' ').filter(Boolean)
      if (words.length > 1 && i < lines.length - 1) {
        const totalWordsWidth = words.reduce((acc, w) => acc + ctx.measureText(w).width, 0)
        const spaceBetween = (maxLineWidth - totalWordsWidth) / (words.length - 1)
        let currentX = blockLeftX
        for (const w of words) {
          ctx.textAlign = 'left'
          ctx.fillText(w, currentX, scaledY)
          currentX += ctx.measureText(w).width + spaceBetween
        }
      } else {
        ctx.textAlign = 'left'
        ctx.fillText(line, blockLeftX, scaledY)
      }
    } else {
      ctx.textAlign = 'left'
      ctx.fillText(line, blockLeftX, scaledY)
    }

    ctx.restore()
  }

  ctx.restore()
}

// Word-by-word animation ticker
const startAnimation = () => {
  stopAnimation()
  isPlaying.value = true
  currentWordIndex.value = 0

  const total = wordsList.value.length
  if (total === 0) return

  const tick = () => {
    const textToShow = wordsList.value.slice(0, currentWordIndex.value + 1).join(' ')
    drawCanvas(textToShow)

    currentWordIndex.value = (currentWordIndex.value + 1) % (total + 1)
    if (currentWordIndex.value === 0) {
      animationTimer = setTimeout(tick, frameDelay.value * 2)
    } else {
      animationTimer = setTimeout(tick, frameDelay.value)
    }
  }

  tick()
}

const stopAnimation = () => {
  isPlaying.value = false
  if (animationTimer) {
    clearTimeout(animationTimer)
    animationTimer = null
  }
}

const togglePlay = () => {
  if (isPlaying.value) {
    stopAnimation()
    drawCanvas(activeText.value)
  } else {
    startAnimation()
  }
}

// Switch between Static Full Text and Animated Mode
const setOutputMode = (mode: 'static' | 'animated') => {
  outputMode.value = mode
  stopAnimation()
  nextTick(() => drawCanvas(activeText.value))
}

// Download Static PNG / JPG
const downloadStaticImage = (format: 'png' | 'jpeg' = 'png') => {
  const canvas = canvasRef.value
  if (!canvas) return

  stopAnimation()
  drawCanvas(activeText.value)

  const link = document.createElement('a')
  const cleanName = activeText.value.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24) || 'brat'
  link.download = `brat_${cleanName}.${format === 'jpeg' ? 'jpg' : 'png'}`
  link.href = canvas.toDataURL(`image/${format}`, format === 'jpeg' ? 0.95 : undefined)
  link.click()

  toast.show({
    title: 'Downloaded!',
    description: `Brat ${format.toUpperCase()} saved to your downloads.`,
    type: 'success',
  })
}

// Copy Image Blob to Clipboard
const copyImageBlob = async () => {
  const canvas = canvasRef.value
  if (!canvas) return

  try {
    stopAnimation()
    drawCanvas(activeText.value)
    canvas.toBlob(async (blob) => {
      if (!blob) throw new Error('Blob creation failed')
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ])
      isCopied.value = true
      setTimeout(() => (isCopied.value = false), 2000)
      toast.show({
        title: 'Copied!',
        description: 'Brat full-text image copied to clipboard.',
        type: 'success',
      })
    }, 'image/png')
  } catch (err: any) {
    toast.show({
      title: 'Copy Failed',
      description: 'Could not copy image blob to clipboard.',
      type: 'error',
    })
  }
}

// Export Animated GIF using Client-side gifshot
const exportAnimatedGif = async () => {
  if (!gifshot) {
    gifshot = (await import('gifshot')).default || (await import('gifshot'))
  }

  const canvas = canvasRef.value
  if (!canvas || !gifshot) return

  isExportingGif.value = true
  gifProgress.value = 0
  stopAnimation()

  const words = wordsList.value
  if (words.length === 0) return

  const frameImages: string[] = []
  const { width, height } = canvasDimensions.value

  for (let i = 1; i <= words.length; i++) {
    const partialText = words.slice(0, i).join(' ')
    drawCanvas(partialText)
    frameImages.push(canvas.toDataURL('image/png'))
  }

  const fullFrame = canvas.toDataURL('image/png')
  frameImages.push(fullFrame)
  frameImages.push(fullFrame)

  gifshot.createGIF(
    {
      images: frameImages,
      gifWidth: Math.min(width, 400),
      gifHeight: Math.min(height, 400),
      interval: frameDelay.value / 1000,
      numWorkers: 2,
      progressCallback: (prog: number) => {
        gifProgress.value = Math.round(prog * 100)
      },
    },
    (obj: any) => {
      isExportingGif.value = false
      if (!obj.error) {
        const link = document.createElement('a')
        const cleanName = activeText.value.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 24) || 'brat'
        link.download = `brat_animated_${cleanName}.gif`
        link.href = obj.image
        link.click()

        toast.show({
          title: 'GIF Created!',
          description: 'Animated Brat GIF downloaded successfully.',
          type: 'success',
        })
      } else {
        toast.show({
          title: 'GIF Error',
          description: obj.errorMsg || 'Failed to generate GIF',
          type: 'error',
        })
      }
      drawCanvas(activeText.value)
    }
  )
}

// Watchers
watch(
  [
    textInput,
    customBgColor,
    customTextColor,
    blurAmount,
    verticalStretch,
    letterSpacing,
    fontSizeMultiplier,
    fontWeight,
    textAlign,
    textCase,
    aspectRatio,
  ],
  () => {
    if (!isPlaying.value) {
      nextTick(() => drawCanvas())
    }
  }
)

onMounted(async () => {
  try {
    gifshot = (await import('gifshot')).default || (await import('gifshot'))
  } catch {}
  nextTick(() => drawCanvas())
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
          Brat Text Generator
        </h1>
        <p class="text-xs text-[var(--text-secondary)] mt-1">
          Create iconic Charli XCX Brat album-style full text memes and word-by-word animated GIFs.
        </p>
      </div>

      <!-- Header Action Buttons -->
      <div class="flex items-center gap-2">
        <Button variant="secondary" size="sm" @click="copyImageBlob">
          <Check v-if="isCopied" class="w-3.5 h-3.5 text-emerald-400" />
          <Copy v-else class="w-3.5 h-3.5" />
          <span>{{ isCopied ? 'Copied' : 'Copy Image' }}</span>
        </Button>
        <Button variant="primary" size="sm" @click="downloadStaticImage('png')">
          <Download class="w-3.5 h-3.5" />
          <span>Download PNG</span>
        </Button>
      </div>
    </div>

    <!-- Mode Selector Segmented Control -->
    <div class="p-1 bg-[#1F1F1F] border border-[var(--border-subtle)] rounded-xl inline-flex gap-1 w-full sm:w-auto">
      <button
        type="button"
        class="flex-1 sm:flex-none flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs transition-all cursor-pointer"
        :class="outputMode === 'static' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
        @click="setOutputMode('static')"
      >
        <ImageIcon class="w-4 h-4" />
        <span>Full Text Static</span>
      </button>

      <button
        type="button"
        class="flex-1 sm:flex-none flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs transition-all cursor-pointer"
        :class="outputMode === 'animated' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
        @click="setOutputMode('animated')"
      >
        <Film class="w-4 h-4" />
        <span>Animated GIF Sequence</span>
      </button>
    </div>

    <!-- Main Workspace Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left Controls Column (5 cols) -->
      <div class="lg:col-span-5 space-y-5">
        <!-- Text Input Card -->
        <Card class="p-4 space-y-4">
          <div class="flex items-center justify-between">
            <label class="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
              <Type class="w-3.5 h-3.5" />
              Text Content (Supports Enter)
            </label>
            <span class="text-[11px] font-mono text-[var(--text-tertiary)]">
              {{ textInput.length }} chars
            </span>
          </div>

          <textarea
            v-model="textInput"
            rows="4"
            class="w-full px-3.5 py-2.5 bg-[#171717] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-white/40 transition-colors resize-none font-mono"
            placeholder="Type your brat text..."
          />

          <!-- Quick Meme Presets Tags -->
          <div class="space-y-1.5">
            <span class="text-[11px] font-mono text-[var(--text-tertiary)]">Meme Presets:</span>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="preset in MEME_PRESETS"
                :key="preset"
                type="button"
                class="px-2 py-1 text-[11px] font-mono bg-[var(--bg-card)] hover:bg-[#2E2E2E] text-[var(--text-secondary)] hover:text-white border border-[var(--border-subtle)] rounded-md transition-colors cursor-pointer"
                @click="textInput = preset"
              >
                {{ preset.replace(/\n/g, ' ') }}
              </button>
            </div>
          </div>
        </Card>

        <!-- Color & Themes Card -->
        <Card class="p-4 space-y-4">
          <label class="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
            <Palette class="w-3.5 h-3.5" />
            Color Palette & Themes
          </label>

          <!-- Preset Color Pills -->
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="theme in PRESET_THEMES"
              :key="theme.id"
              type="button"
              class="flex items-center gap-2 p-2 rounded-lg border text-xs transition-all cursor-pointer"
              :class="selectedThemeId === theme.id ? 'border-white bg-[#2E2E2E]' : 'border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[#2E2E2E]'"
              @click="selectTheme(theme)"
            >
              <span class="w-4 h-4 rounded-full border border-black/20 shrink-0" :style="{ backgroundColor: theme.bg }"></span>
              <span class="text-[11px] font-medium truncate text-[var(--text-primary)]">{{ theme.name }}</span>
            </button>
          </div>

          <!-- Custom Colors Input -->
          <div class="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border-subtle)]">
            <div class="space-y-1.5">
              <span class="text-[11px] font-mono text-[var(--text-tertiary)]">Background</span>
              <div class="flex items-center gap-2">
                <input
                  v-model="customBgColor"
                  type="color"
                  class="w-7 h-7 rounded border border-[var(--border-subtle)] bg-transparent cursor-pointer"
                />
                <input
                  v-model="customBgColor"
                  type="text"
                  class="flex-1 px-2 py-1 text-xs font-mono bg-[#171717] border border-[var(--border-subtle)] rounded text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div class="space-y-1.5">
              <span class="text-[11px] font-mono text-[var(--text-tertiary)]">Text Color</span>
              <div class="flex items-center gap-2">
                <input
                  v-model="customTextColor"
                  type="color"
                  class="w-7 h-7 rounded border border-[var(--border-subtle)] bg-transparent cursor-pointer"
                />
                <input
                  v-model="customTextColor"
                  type="text"
                  class="flex-1 px-2 py-1 text-xs font-mono bg-[#171717] border border-[var(--border-subtle)] rounded text-[var(--text-primary)]"
                />
              </div>
            </div>
          </div>
        </Card>

        <!-- Typography & Authentic Meme Sliders Card -->
        <Card class="p-4 space-y-4">
          <label class="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
            <Sliders class="w-3.5 h-3.5" />
            Meme Typography & Blur Settings
          </label>

          <div class="space-y-3.5">
            <!-- Blur Slider -->
            <div class="space-y-1.5">
              <div class="flex justify-between text-xs">
                <span class="text-[var(--text-secondary)]">Authentic Meme Blur</span>
                <span class="font-mono text-[var(--text-tertiary)]">{{ blurAmount }}px</span>
              </div>
              <input
                v-model.number="blurAmount"
                type="range"
                min="0"
                max="6"
                step="0.2"
                class="w-full h-1.5 bg-[#2E2E2E] rounded appearance-none cursor-pointer accent-white"
              />
            </div>

            <!-- Vertical Stretch Slider -->
            <div class="space-y-1.5">
              <div class="flex justify-between text-xs">
                <span class="text-[var(--text-secondary)]">Vertical Font Stretch</span>
                <span class="font-mono text-[var(--text-tertiary)]">{{ verticalStretch }}x</span>
              </div>
              <input
                v-model.number="verticalStretch"
                type="range"
                min="0.9"
                max="1.6"
                step="0.05"
                class="w-full h-1.5 bg-[#2E2E2E] rounded appearance-none cursor-pointer accent-white"
              />
            </div>

            <!-- Font Size Multiplier -->
            <div class="space-y-1.5">
              <div class="flex justify-between text-xs">
                <span class="text-[var(--text-secondary)]">Font Scale</span>
                <span class="font-mono text-[var(--text-tertiary)]">{{ fontSizeMultiplier }}x</span>
              </div>
              <input
                v-model.number="fontSizeMultiplier"
                type="range"
                min="0.6"
                max="1.6"
                step="0.05"
                class="w-full h-1.5 bg-[#2E2E2E] rounded appearance-none cursor-pointer accent-white"
              />
            </div>

            <!-- Font Weight Selector -->
            <div class="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-xs">
              <span class="text-[var(--text-secondary)]">Font Weight</span>
              <div class="flex items-center gap-1 bg-[#171717] p-1 rounded-lg border border-[var(--border-subtle)]">
                <button
                  type="button"
                  class="px-2.5 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors"
                  :class="fontWeight === '400' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
                  @click="fontWeight = '400'"
                >
                  Regular
                </button>
                <button
                  type="button"
                  class="px-2.5 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors"
                  :class="fontWeight === '500' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
                  @click="fontWeight = '500'"
                >
                  Medium
                </button>
                <button
                  type="button"
                  class="px-2.5 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors"
                  :class="fontWeight === '700' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
                  @click="fontWeight = '700'"
                >
                  Bold
                </button>
              </div>
            </div>

            <!-- Text Alignment -->
            <div class="flex items-center justify-between text-xs">
              <span class="text-[var(--text-secondary)]">Text Alignment</span>
              <div class="flex items-center gap-1 bg-[#171717] p-1 rounded-lg border border-[var(--border-subtle)]">
                <button
                  type="button"
                  class="p-1.5 rounded cursor-pointer transition-colors"
                  :class="textAlign === 'left' ? 'bg-white text-black shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
                  title="Left Align"
                  @click="textAlign = 'left'"
                >
                  <AlignLeft class="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  class="p-1.5 rounded cursor-pointer transition-colors"
                  :class="textAlign === 'center' ? 'bg-white text-black shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
                  title="Center Align"
                  @click="textAlign = 'center'"
                >
                  <AlignCenter class="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  class="p-1.5 rounded cursor-pointer transition-colors"
                  :class="textAlign === 'justify' ? 'bg-white text-black shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
                  title="Justify Align"
                  @click="textAlign = 'justify'"
                >
                  <AlignJustify class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Letter Case -->
            <div class="flex items-center justify-between text-xs">
              <span class="text-[var(--text-secondary)]">Letter Case</span>
              <div class="flex items-center gap-1 bg-[#171717] p-1 rounded-lg border border-[var(--border-subtle)]">
                <button
                  type="button"
                  class="px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors"
                  :class="textCase === 'original' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
                  @click="textCase = 'original'"
                >
                  As Typed
                </button>
                <button
                  type="button"
                  class="px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors"
                  :class="textCase === 'lower' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
                  @click="textCase = 'lower'"
                >
                  lower
                </button>
                <button
                  type="button"
                  class="px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors"
                  :class="textCase === 'upper' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
                  @click="textCase = 'upper'"
                >
                  UPPER
                </button>
              </div>
            </div>

            <!-- Aspect Ratio -->
            <div class="flex items-center justify-between text-xs">
              <span class="text-[var(--text-secondary)]">Aspect Ratio</span>
              <div class="flex items-center gap-1 bg-[#171717] p-1 rounded-lg border border-[var(--border-subtle)]">
                <button
                  type="button"
                  class="px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors"
                  :class="aspectRatio === '1:1' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
                  @click="aspectRatio = '1:1'"
                >
                  1:1 Square
                </button>
                <button
                  type="button"
                  class="px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors"
                  :class="aspectRatio === '9:16' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
                  @click="aspectRatio = '9:16'"
                >
                  9:16 Story
                </button>
                <button
                  type="button"
                  class="px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors"
                  :class="aspectRatio === '16:9' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
                  @click="aspectRatio = '16:9'"
                >
                  16:9 Banner
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <!-- Right Preview & Actions Column (7 cols) -->
      <div class="lg:col-span-7 space-y-5">
        <!-- Live Canvas Preview Container -->
        <Card class="p-6 flex flex-col items-center justify-center bg-black/90 relative overflow-hidden min-h-[440px]">
          <!-- Checkerboard background for transparency contrast -->
          <div class="relative max-w-full flex items-center justify-center shadow-2xl rounded-lg overflow-hidden border border-[var(--border-subtle)]">
            <canvas
              ref="canvasRef"
              class="max-h-[380px] max-w-full object-contain rounded-md transition-all"
            />
          </div>

          <!-- Aspect Ratio & Size indicator -->
          <div class="mt-4 flex items-center gap-2 text-[11px] font-mono text-[var(--text-tertiary)]">
            <span>{{ canvasDimensions.width }} × {{ canvasDimensions.height }}px</span>
            <span>•</span>
            <span>{{ aspectRatio }}</span>
            <span v-if="blurAmount > 0">• {{ blurAmount }}px Blur</span>
            <span>• {{ outputMode === 'static' ? 'Full Text Static' : 'Animated GIF' }}</span>
          </div>
        </Card>

        <!-- Static Image Download Actions (When in Static Full-Text Mode) -->
        <Card v-if="outputMode === 'static'" class="p-5 space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <ImageIcon class="w-4 h-4 text-[var(--text-secondary)]" />
              <h3 class="text-sm font-semibold text-[var(--text-primary)]">
                Full-Text Export (Static)
              </h3>
            </div>
            <Badge variant="secondary" class="font-mono text-[10px]">
              Ready to Save
            </Badge>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <Button
              variant="primary"
              class="w-full justify-center gap-2 py-2.5"
              @click="downloadStaticImage('png')"
            >
              <Download class="w-4 h-4" />
              <span>Download PNG</span>
            </Button>

            <Button
              variant="secondary"
              class="w-full justify-center gap-2 font-medium py-2.5"
              @click="downloadStaticImage('jpeg')"
            >
              <Download class="w-4 h-4" />
              <span>Download JPG</span>
            </Button>

            <Button
              variant="secondary"
              class="w-full justify-center gap-2 font-medium py-2.5"
              @click="copyImageBlob"
            >
              <Check v-if="isCopied" class="w-4 h-4 text-emerald-400" />
              <Copy v-else class="w-4 h-4" />
              <span>{{ isCopied ? 'Copied' : 'Copy Image' }}</span>
            </Button>
          </div>
        </Card>

        <!-- Animation & GIF Export Controls Card (When in Animated Mode) -->
        <Card v-else class="p-5 space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Film class="w-4 h-4 text-[var(--text-secondary)]" />
              <h3 class="text-sm font-semibold text-[var(--text-primary)]">
                Animated Word-by-Word Sequence
              </h3>
            </div>
            <Badge variant="secondary" class="font-mono text-[10px]">
              {{ wordsList.length }} Words
            </Badge>
          </div>

          <div class="space-y-3">
            <!-- Delay Slider -->
            <div class="space-y-1.5">
              <div class="flex justify-between text-xs">
                <span class="text-[var(--text-secondary)]">Word Reveal Delay</span>
                <span class="font-mono text-[var(--text-tertiary)]">{{ frameDelay }}ms</span>
              </div>
              <input
                v-model.number="frameDelay"
                type="range"
                min="150"
                max="1200"
                step="50"
                class="w-full h-1.5 bg-[#2E2E2E] rounded appearance-none cursor-pointer accent-white"
              />
            </div>

            <!-- Animation Action Buttons -->
            <div class="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="secondary"
                class="w-full justify-center gap-2 font-medium"
                @click="togglePlay"
              >
                <Pause v-if="isPlaying" class="w-4 h-4 fill-current" />
                <Play v-else class="w-4 h-4 fill-current" />
                <span>{{ isPlaying ? 'Pause Preview' : 'Play Sequence' }}</span>
              </Button>

              <Button
                variant="primary"
                class="w-full justify-center gap-2"
                :loading="isExportingGif"
                @click="exportAnimatedGif"
              >
                <Download class="w-4 h-4" />
                <span>{{ isExportingGif ? `Generating GIF (${gifProgress}%)` : 'Export Animated GIF' }}</span>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
