<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import {
  Upload,
  Download,
  Sparkles,
  Sliders,
  Type,
  Image as ImageIcon,
  Layers,
  Copy,
  Check,
  RotateCw,
  FlipHorizontal,
  Wand2,
  Trash2,
  Eye,
  Settings2,
  Info,
  RefreshCw,
  Palette,
  Maximize2
} from 'lucide-vue-next'
import confetti from 'canvas-confetti'
import { useToast } from '~/composables/useToast'
import { useI18n } from '~/composables/useI18n'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'
import Input from '~/components/ui/Input.vue'
import { createWhatsAppStickerBlob, type WhatsAppStickerMetadata } from '~/utils/whatsappSticker'

useHead({
  title: 'Sticker Studio — WhatsApp & Telegram Sticker Maker | Avttr Studio',
  meta: [
    {
      name: 'description',
      content: 'Create authentic WhatsApp and Telegram stickers with custom white outlines, meme captions, and genuine 512x512 WebP EXIF injection 100% in your browser.'
    }
  ]
})

const toast = useToast()
const { t } = useI18n()

// Canvas References
const canvasRef = ref<HTMLCanvasElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

// File & Source Image State
const originalFile = ref<File | null>(null)
const sourceImage = ref<HTMLImageElement | null>(null)
const isDragging = ref(false)
const isRemovingBg = ref(false)
const hasCopied = ref(false)
const isDownloading = ref(false)
const estimatedSizeKb = ref<number>(0)

// Sticker Outline & Shadow State
const strokeWidth = ref<number>(10)
const strokeColor = ref<string>('#FFFFFF')
const hasShadow = ref<boolean>(true)
const shadowBlur = ref<number>(12)
const shadowOpacity = ref<number>(0.4)

// Text & Caption State
const topText = ref<string>('')
const bottomText = ref<string>('')
const fontFamily = ref<'impact' | 'sans' | 'comic' | 'mono'>('impact')
const fontSize = ref<number>(42)
const textColor = ref<string>('#FFFFFF')
const textStrokeColor = ref<string>('#000000')
const textStrokeWidth = ref<number>(5)
const isUppercase = ref<boolean>(true)

// Transform & Framing State
const scale = ref<number>(1.0)
const offsetX = ref<number>(0)
const offsetY = ref<number>(0)
const rotation = ref<number>(0)
const isFlippedX = ref<boolean>(false)
const showSafeMargin = ref<boolean>(true)

// Preview Environment State
const previewMode = ref<'wa-dark' | 'wa-light' | 'telegram' | 'transparent'>('wa-dark')

// WhatsApp Metadata State
const packName = ref<string>('Avttr Pack')
const authorName = ref<string>('Avttr Studio')
const emojiTags = ref<string>('🔥, 😎')

// Target Format
const targetFormat = ref<'whatsapp' | 'telegram' | 'png'>('whatsapp')

// Quick Sample Images
const sampleImages = [
  { name: 'Mio Mascot', url: '/mio.png', isCutout: true },
  { name: 'Logo Favicon', url: '/favicon.png', isCutout: true }
]

// Preset Stroke Colors
const strokeColorPresets = ['#FFFFFF', '#000000', '#FFE600', '#00F0FF', '#FF0055', '#25D366']

// Load Image from Blob or URL
const loadImage = (url: string, fileObj?: File) => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    sourceImage.value = img
    if (fileObj) {
      originalFile.value = fileObj
    } else {
      originalFile.value = new File([], 'sticker_sample.png', { type: 'image/png' })
    }
    // Auto-fit scale
    autoFitImage(img)
    nextTick(() => {
      renderSticker()
    })
    toast.success('Image Loaded', 'Customize your sticker with outlines and text')
  }
  img.onerror = () => {
    toast.error('Image Error', 'Could not load image')
  }
  img.src = url
}

// Auto Fit Image into 512x512 with 24px safe padding
const autoFitImage = (img: HTMLImageElement) => {
  const targetDimension = 512 - 48
  const maxDim = Math.max(img.naturalWidth, img.naturalHeight)
  if (maxDim > 0) {
    scale.value = Number((targetDimension / maxDim).toFixed(2))
  } else {
    scale.value = 1.0
  }
  offsetX.value = 0
  offsetY.value = 0
  rotation.value = 0
  isFlippedX.value = false
}

// File Selection Handlers
const handleFileSelect = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  processSelectedFile(file)
}

const handleDrop = (e: DragEvent) => {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  processSelectedFile(file)
}

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const processSelectedFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    toast.error('Invalid Format', 'Please upload a PNG, JPG, or WebP image')
    return
  }
  const url = URL.createObjectURL(file)
  loadImage(url, file)
}

// Global Paste Handler (Ctrl+V)
const handleGlobalPaste = (e: ClipboardEvent) => {
  const items = e.clipboardData?.items
  if (!items) return

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const blob = items[i].getAsFile()
      if (blob) {
        e.preventDefault()
        toast.info('Pasted', 'Loading image from clipboard...')
        processSelectedFile(blob)
        return
      }
    }
  }
}

// AI Background Removal Action
const removeBackground = async () => {
  if (!sourceImage.value) return

  isRemovingBg.value = true
  toast.info('Removing Background', 'Processing cutout...')

  try {
    // Render current source to base64
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = sourceImage.value.naturalWidth
    tempCanvas.height = sourceImage.value.naturalHeight
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) throw new Error('Could not create canvas context')
    tempCtx.drawImage(sourceImage.value, 0, 0)
    const base64 = tempCanvas.toDataURL('image/png')

    const res = await $fetch<{ success: boolean; resultUrl: string }>('/api/tools/remove-bg', {
      method: 'POST',
      body: {
        image_b64: base64,
        size: 'auto'
      }
    })

    if (res?.resultUrl) {
      loadImage(res.resultUrl)
      toast.success('Cutout Done', 'Background removed! Now adding sticker border.')
    } else {
      throw new Error('Could not process background removal')
    }
  } catch (err: any) {
    const isQuota = err.statusCode === 429 || /limit|credit|quota/i.test(err.message || '')
    if (isQuota) {
      toast.warning('API Quota Reached', 'You can upload an image that is already transparent (PNG/WebP).')
    } else {
      toast.error('Removal Failed', err.data?.message || err.message || 'Background removal failed')
    }
  } finally {
    isRemovingBg.value = false
  }
}

// Main Render Function for 512x512 Canvas
const renderSticker = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, 512, 512)

  if (!sourceImage.value) return

  const img = sourceImage.value
  const imgW = img.naturalWidth
  const imgH = img.naturalHeight
  if (imgW === 0 || imgH === 0) return

  const currentScale = scale.value
  const drawW = imgW * currentScale
  const drawH = imgH * currentScale
  const cx = 256 + offsetX.value
  const cy = 256 + offsetY.value

  // Helper to draw the transformed image into any context
  const drawTransformed = (targetCtx: CanvasRenderingContext2D) => {
    targetCtx.save()
    targetCtx.translate(cx, cy)
    targetCtx.rotate((rotation.value * Math.PI) / 180)
    if (isFlippedX.value) {
      targetCtx.scale(-1, 1)
    }
    targetCtx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH)
    targetCtx.restore()
  }

  // 1. Draw Outline & Shadow using offscreen silhouette buffer
  if (strokeWidth.value > 0) {
    const off = document.createElement('canvas')
    off.width = 512
    off.height = 512
    const offCtx = off.getContext('2d')

    if (offCtx) {
      drawTransformed(offCtx)
      offCtx.globalCompositeOperation = 'source-in'
      offCtx.fillStyle = strokeColor.value
      offCtx.fillRect(0, 0, 512, 512)

      // Apply drop shadow behind outline if enabled
      if (hasShadow.value) {
        ctx.save()
        ctx.shadowColor = `rgba(0, 0, 0, ${shadowOpacity.value})`
        ctx.shadowBlur = shadowBlur.value
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 4
        ctx.drawImage(off, 0, 0)
        ctx.restore()
      }

      // Draw multi-angle stroke expansion for smooth rounded outline
      const r = strokeWidth.value
      const steps = Math.max(16, Math.min(36, r * 2))
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * 2 * Math.PI
        ctx.drawImage(off, Math.cos(angle) * r, Math.sin(angle) * r)
      }

      // Secondary inner pass for extra thick smoothness
      if (r > 6) {
        const innerSteps = Math.max(8, Math.floor(steps / 2))
        const innerR = r * 0.5
        for (let i = 0; i < innerSteps; i++) {
          const angle = (i / innerSteps) * 2 * Math.PI
          ctx.drawImage(off, Math.cos(angle) * innerR, Math.sin(angle) * innerR)
        }
      }
    }
  } else if (hasShadow.value) {
    // Only drop shadow without outline
    ctx.save()
    ctx.shadowColor = `rgba(0, 0, 0, ${shadowOpacity.value})`
    ctx.shadowBlur = shadowBlur.value
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 4
    drawTransformed(ctx)
    ctx.restore()
  }

  // 2. Draw original full-color image on top
  drawTransformed(ctx)

  // 3. Draw Top and Bottom Meme Captions
  if (topText.value.trim()) {
    drawMemeCaption(ctx, topText.value.trim(), 'top')
  }
  if (bottomText.value.trim()) {
    drawMemeCaption(ctx, bottomText.value.trim(), 'bottom')
  }

  // Calculate rough estimated size
  updateEstimatedSize()
}

// Draw Meme / Comic Caption
const drawMemeCaption = (ctx: CanvasRenderingContext2D, text: string, position: 'top' | 'bottom') => {
  const displayText = isUppercase.value ? text.toUpperCase() : text
  const fontMap: Record<string, string> = {
    impact: 'Impact, "Arial Black", sans-serif',
    sans: 'system-ui, -apple-system, sans-serif',
    comic: '"Comic Sans MS", "Chalkboard SE", sans-serif',
    mono: 'monospace'
  }

  const selectedFont = fontMap[fontFamily.value] || 'Impact'
  ctx.save()
  ctx.font = `900 ${fontSize.value}px ${selectedFont}`
  ctx.textAlign = 'center'
  ctx.textBaseline = position === 'top' ? 'top' : 'bottom'
  ctx.lineWidth = textStrokeWidth.value
  ctx.strokeStyle = textStrokeColor.value
  ctx.fillStyle = textColor.value
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2

  const y = position === 'top' ? 24 : 512 - 24

  // Stroke then fill for high legibility
  if (textStrokeWidth.value > 0) {
    ctx.strokeText(displayText, 256, y, 480)
  }
  ctx.fillText(displayText, 256, y, 480)
  ctx.restore()
}

// Approximate WebP Size Calculator
const updateEstimatedSize = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.toBlob(
    (b) => {
      if (b) {
        estimatedSizeKb.value = Math.round(b.size / 1024)
      }
    },
    'image/webp',
    0.88
  )
}

// Download Sticker Action
const downloadSticker = async () => {
  const canvas = canvasRef.value
  if (!canvas || !sourceImage.value) return

  isDownloading.value = true
  try {
    const rawPack = packName.value.trim() || 'Avttr Pack'
    const rawAuthor = authorName.value.trim() || 'Avttr Studio'
    const emojis = emojiTags.value
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean)

    const metadata: WhatsAppStickerMetadata = {
      id: `avttr.${Date.now()}`,
      pack: rawPack,
      author: rawAuthor,
      emojis: emojis.length > 0 ? emojis : ['✨']
    }

    let downloadBlob: Blob
    let extension: string

    if (targetFormat.value === 'whatsapp') {
      const res = await createWhatsAppStickerBlob(canvas, metadata, 0.88)
      downloadBlob = res.blob
      extension = 'webp'
    } else if (targetFormat.value === 'telegram') {
      downloadBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed WebP export'))), 'image/webp', 0.92)
      })
      extension = 'webp'
    } else {
      downloadBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed PNG export'))), 'image/png')
      })
      extension = 'png'
    }

    // Trigger Browser Download
    const blobUrl = URL.createObjectURL(downloadBlob)
    const link = document.createElement('a')
    const sanitizedName = (rawPack.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'sticker') + `_${Date.now()}`
    link.href = blobUrl
    link.download = `${sanitizedName}.${extension}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)

    // Celebration Confetti
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 }
    })

    if (targetFormat.value === 'whatsapp') {
      toast.success(
        'WhatsApp Sticker Ready!',
        `Saved as ${Math.round(downloadBlob.size / 1024)} KB WebP with WhatsApp EXIF metadata.`
      )
    } else {
      toast.success('Sticker Downloaded', `Saved as .${extension} format.`)
    }
  } catch (err: any) {
    console.error('Export Error:', err)
    toast.error('Download Failed', err.message || 'Could not export sticker')
  } finally {
    isDownloading.value = false
  }
}

// Copy Image to Clipboard (PNG)
const copyStickerToClipboard = async () => {
  const canvas = canvasRef.value
  if (!canvas || !sourceImage.value) return

  try {
    canvas.toBlob(async (blob) => {
      if (!blob) throw new Error('Could not generate clipboard image')
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob
        })
      ])
      hasCopied.value = true
      toast.success('Copied to Clipboard', 'You can now paste (Ctrl+V) directly into WhatsApp Web or Telegram!')
      setTimeout(() => {
        hasCopied.value = false
      }, 2500)
    }, 'image/png')
  } catch (err: any) {
    toast.error('Copy Failed', 'Browser permission denied. Use Download instead.')
  }
}

// Reset Transformations
const resetTransform = () => {
  if (sourceImage.value) {
    autoFitImage(sourceImage.value)
    renderSticker()
  }
}

// Watchers for reactive canvas re-render
watch(
  [
    strokeWidth,
    strokeColor,
    hasShadow,
    shadowBlur,
    shadowOpacity,
    topText,
    bottomText,
    fontFamily,
    fontSize,
    textColor,
    textStrokeColor,
    textStrokeWidth,
    isUppercase,
    scale,
    offsetX,
    offsetY,
    rotation,
    isFlippedX
  ],
  () => {
    renderSticker()
  }
)

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('paste', handleGlobalPaste)
  }
  // Auto-load sample mascot by default for immediate preview
  loadImage('/mio.png')
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('paste', handleGlobalPaste)
  }
})
</script>

<template>
  <div class="space-y-6 pb-12 w-full">
    <!-- Hidden File Input -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      class="hidden"
      @change="handleFileSelect"
    />

    <!-- Breadcrumb -->
    <div class="flex items-center gap-2 text-xs font-mono text-[var(--text-secondary)]">
      <NuxtLink to="/" class="hover:text-[var(--text-primary)] transition-colors">Dashboard</NuxtLink>
      <span>/</span>
      <NuxtLink to="/" class="hover:text-[var(--text-primary)] transition-colors">{{ t.clientUtilities }}</NuxtLink>
      <span>/</span>
      <span class="text-[var(--text-primary)]">{{ t.tools['sticker-maker']?.title || 'Sticker Studio' }}</span>
    </div>

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          {{ t.tools['sticker-maker']?.title || 'Sticker Studio' }}
        </h1>
        <p class="text-sm text-[var(--text-secondary)] mt-1">
          {{ t.tools['sticker-maker']?.description || 'Create WhatsApp & Telegram stickers with custom white outlines, meme captions, and 512×512 WebP export.' }}
        </p>
      </div>
      <div class="flex items-center gap-2 self-start sm:self-auto">
        <Badge variant="badge">Client Privacy</Badge>
      </div>
    </div>

    <!-- Standard Upload Dropzone (DESIGN.md Section 10) -->
    <div
      id="sticker-dropzone"
      class="relative border-2 border-dashed rounded-[14px] p-6 sm:p-10 border-[#2E2E2E] bg-[#141416] hover:border-[#3E3E3E] text-center cursor-pointer select-none transition-all duration-150"
      :class="{ 'border-white/40 bg-white/5': isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
      @click="triggerFileInput"
    >
      <div class="w-12 h-12 mx-auto rounded-xl bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-white shadow-xs">
        <Upload class="w-6 h-6" />
      </div>
      <h3 class="text-sm font-semibold text-[var(--text-primary)] mt-3">
        Drop your image here or browse
      </h3>
      <p class="text-xs text-[var(--text-secondary)] mt-1">
        Supports PNG, JPG, WebP up to 10MB. 100% processed client-side.
      </p>

      <!-- Quick Sample Buttons -->
      <div class="mt-4 flex items-center justify-center gap-2 flex-wrap" @click.stop>
        <span class="text-xs text-[var(--text-secondary)]">Or try sample:</span>
        <button
          v-for="sample in sampleImages"
          :key="sample.name"
          type="button"
          class="px-2.5 py-1 text-xs rounded-lg border border-[#2E2E2E] bg-[#1E1E1E] text-white hover:bg-[#2A2A2A] transition-colors"
          @click="loadImage(sample.url)"
        >
          {{ sample.name }}
        </button>
      </div>
    </div>

    <!-- Main Workspace Grid (Only when source image loaded) -->
    <div v-if="sourceImage" class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left Column: Customization Controls (lg:col-span-7) -->
      <div class="lg:col-span-7 space-y-5">
        <!-- Source Image Actions Card -->
        <Card class="p-4 sm:p-5">
          <div class="flex items-center justify-between gap-4 flex-wrap">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-[#212121] border border-[#2E2E2E] flex items-center justify-center overflow-hidden">
                <img :src="sourceImage.src" class="w-full h-full object-contain" alt="thumbnail" />
              </div>
              <div>
                <p class="text-xs font-semibold text-[var(--text-primary)]">
                  {{ originalFile?.name || 'Current Image' }}
                </p>
                <p class="text-xs text-[var(--text-secondary)]">
                  {{ sourceImage.naturalWidth }} × {{ sourceImage.naturalHeight }} px
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <Button
                id="btn-remove-bg"
                variant="outline"
                size="sm"
                :disabled="isRemovingBg"
                @click="removeBackground"
              >
                <RefreshCw v-if="isRemovingBg" class="w-3.5 h-3.5 animate-spin mr-1.5" />
                <Wand2 v-else class="w-3.5 h-3.5 mr-1.5" />
                <span>{{ isRemovingBg ? 'Cutting out...' : 'Cutout Background' }}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                @click="triggerFileInput"
              >
                <Upload class="w-3.5 h-3.5 mr-1.5" />
                <span>Change</span>
              </Button>
            </div>
          </div>
        </Card>

        <!-- Sticker Outline & Shadow Panel -->
        <Card class="p-4 sm:p-5 space-y-4">
          <div class="flex items-center justify-between border-b border-[#2E2E2E] pb-3">
            <div class="flex items-center gap-2">
              <Layers class="w-4 h-4 text-white" />
              <h2 class="text-sm font-semibold text-[var(--text-primary)]">Sticker Outline & Pop Shadow</h2>
            </div>
            <span class="text-xs text-[var(--text-secondary)] font-mono">{{ strokeWidth }}px outline</span>
          </div>

          <!-- Stroke Width Slider -->
          <div class="space-y-1.5">
            <div class="flex justify-between text-xs text-[var(--text-secondary)]">
              <span>White Outline Thickness</span>
              <span class="font-mono text-white">{{ strokeWidth }}px</span>
            </div>
            <input
              v-model.number="strokeWidth"
              type="range"
              min="0"
              max="24"
              step="1"
              class="w-full accent-white bg-[#2E2E2E] h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <!-- Stroke Color Selector -->
          <div class="space-y-2">
            <label class="text-xs text-[var(--text-secondary)] block">Outline Color</label>
            <div class="flex items-center gap-2 flex-wrap">
              <button
                v-for="color in strokeColorPresets"
                :key="color"
                type="button"
                class="w-6 h-6 rounded-full border border-[#2E2E2E] transition-transform"
                :class="{ 'ring-2 ring-white scale-110': strokeColor.toLowerCase() === color.toLowerCase() }"
                :style="{ backgroundColor: color }"
                @click="strokeColor = color"
              />
              <input
                v-model="strokeColor"
                type="color"
                class="w-7 h-7 rounded border border-[#2E2E2E] bg-transparent cursor-pointer"
                title="Custom color"
              />
            </div>
          </div>

          <!-- 3D Pop Shadow Controls -->
          <div class="pt-2 border-t border-[#2E2E2E] space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-[var(--text-primary)]">3D Sticker Drop Shadow</span>
              <input
                v-model="hasShadow"
                type="checkbox"
                class="w-4 h-4 rounded accent-white cursor-pointer"
              />
            </div>

            <div v-if="hasShadow" class="grid grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <div class="flex justify-between text-xs text-[var(--text-secondary)]">
                  <span>Shadow Blur</span>
                  <span class="font-mono text-white">{{ shadowBlur }}px</span>
                </div>
                <input
                  v-model.number="shadowBlur"
                  type="range"
                  min="0"
                  max="24"
                  step="1"
                  class="w-full accent-white bg-[#2E2E2E] h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div class="space-y-1.5">
                <div class="flex justify-between text-xs text-[var(--text-secondary)]">
                  <span>Opacity</span>
                  <span class="font-mono text-white">{{ Math.round(shadowOpacity * 100) }}%</span>
                </div>
                <input
                  v-model.number="shadowOpacity"
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  class="w-full accent-white bg-[#2E2E2E] h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        </Card>

        <!-- Meme & Caption Text Panel -->
        <Card class="p-4 sm:p-5 space-y-4">
          <div class="flex items-center justify-between border-b border-[#2E2E2E] pb-3">
            <div class="flex items-center gap-2">
              <Type class="w-4 h-4 text-white" />
              <h2 class="text-sm font-semibold text-[var(--text-primary)]">Meme & Caption Text</h2>
            </div>
            <label class="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer">
              <input
                v-model="isUppercase"
                type="checkbox"
                class="w-3.5 h-3.5 rounded accent-white cursor-pointer"
              />
              <span>ALL CAPS</span>
            </label>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-[var(--text-secondary)] block mb-1">Top Caption</label>
              <Input
                v-model="topText"
                placeholder="e.g. WHEN THE CODE"
                class="text-xs"
              />
            </div>
            <div>
              <label class="text-xs text-[var(--text-secondary)] block mb-1">Bottom Caption</label>
              <Input
                v-model="bottomText"
                placeholder="e.g. FINALLY COMPILES"
                class="text-xs"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <label class="text-xs text-[var(--text-secondary)] block mb-1">Font Family</label>
              <select
                v-model="fontFamily"
                class="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#2E2E2E] bg-[#141416] text-white focus:outline-none focus:border-[#4E4E4E]"
              >
                <option value="impact">Impact (Classic Meme)</option>
                <option value="sans">Bold Sans (Modern)</option>
                <option value="comic">Comic (Playful)</option>
                <option value="mono">Monospace (Code)</option>
              </select>
            </div>

            <div>
              <div class="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
                <span>Font Size</span>
                <span class="font-mono text-white">{{ fontSize }}px</span>
              </div>
              <input
                v-model.number="fontSize"
                type="range"
                min="20"
                max="64"
                step="2"
                class="w-full accent-white bg-[#2E2E2E] h-1.5 rounded-lg appearance-none cursor-pointer mt-2"
              />
            </div>

            <div>
              <div class="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
                <span>Text Stroke</span>
                <span class="font-mono text-white">{{ textStrokeWidth }}px</span>
              </div>
              <input
                v-model.number="textStrokeWidth"
                type="range"
                min="0"
                max="10"
                step="1"
                class="w-full accent-white bg-[#2E2E2E] h-1.5 rounded-lg appearance-none cursor-pointer mt-2"
              />
            </div>
          </div>
        </Card>

        <!-- Framing & Transform Panel -->
        <Card class="p-4 sm:p-5 space-y-4">
          <div class="flex items-center justify-between border-b border-[#2E2E2E] pb-3">
            <div class="flex items-center gap-2">
              <Sliders class="w-4 h-4 text-white" />
              <h2 class="text-sm font-semibold text-[var(--text-primary)]">Canvas Framing (512×512)</h2>
            </div>
            <button
              type="button"
              class="text-xs text-[var(--text-secondary)] hover:text-white transition-colors"
              @click="resetTransform"
            >
              Reset Fit
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Scale Slider -->
            <div class="space-y-1.5">
              <div class="flex justify-between text-xs text-[var(--text-secondary)]">
                <span>Scale / Zoom</span>
                <span class="font-mono text-white">{{ Math.round(scale * 100) }}%</span>
              </div>
              <input
                v-model.number="scale"
                type="range"
                min="0.3"
                max="2.0"
                step="0.05"
                class="w-full accent-white bg-[#2E2E2E] h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <!-- Rotation Slider -->
            <div class="space-y-1.5">
              <div class="flex justify-between text-xs text-[var(--text-secondary)]">
                <span>Rotation</span>
                <span class="font-mono text-white">{{ rotation }}°</span>
              </div>
              <input
                v-model.number="rotation"
                type="range"
                min="-180"
                max="180"
                step="5"
                class="w-full accent-white bg-[#2E2E2E] h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <!-- Offset X -->
            <div class="space-y-1.5">
              <div class="flex justify-between text-xs text-[var(--text-secondary)]">
                <span>Pan X</span>
                <span class="font-mono text-white">{{ offsetX }}px</span>
              </div>
              <input
                v-model.number="offsetX"
                type="range"
                min="-150"
                max="150"
                step="2"
                class="w-full accent-white bg-[#2E2E2E] h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <!-- Offset Y -->
            <div class="space-y-1.5">
              <div class="flex justify-between text-xs text-[var(--text-secondary)]">
                <span>Pan Y</span>
                <span class="font-mono text-white">{{ offsetY }}px</span>
              </div>
              <input
                v-model.number="offsetY"
                type="range"
                min="-150"
                max="150"
                step="2"
                class="w-full accent-white bg-[#2E2E2E] h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <!-- Quick Action Buttons -->
          <div class="flex items-center gap-2 pt-2 border-t border-[#2E2E2E]">
            <Button
              variant="outline"
              size="sm"
              @click="isFlippedX = !isFlippedX"
            >
              <FlipHorizontal class="w-3.5 h-3.5 mr-1.5" />
              <span>Flip H</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              @click="rotation = (rotation + 90) % 360"
            >
              <RotateCw class="w-3.5 h-3.5 mr-1.5" />
              <span>Rotate 90°</span>
            </Button>
            <label class="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] ml-auto cursor-pointer">
              <input
                v-model="showSafeMargin"
                type="checkbox"
                class="w-3.5 h-3.5 rounded accent-white cursor-pointer"
              />
              <span>16px Safe Guide</span>
            </label>
          </div>
        </Card>

        <!-- WhatsApp Metadata Panel -->
        <Card class="p-4 sm:p-5 space-y-4">
          <div class="flex items-center justify-between border-b border-[#2E2E2E] pb-3">
            <div class="flex items-center gap-2">
              <Settings2 class="w-4 h-4 text-white" />
              <h2 class="text-sm font-semibold text-[var(--text-primary)]">WhatsApp Sticker Pack Info</h2>
            </div>
            <Badge variant="ghost">Injected to WebP</Badge>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="text-xs text-[var(--text-secondary)] block mb-1">Pack Name</label>
              <Input
                v-model="packName"
                placeholder="Avttr Pack"
                class="text-xs"
              />
            </div>
            <div>
              <label class="text-xs text-[var(--text-secondary)] block mb-1">Author / Publisher</label>
              <Input
                v-model="authorName"
                placeholder="Avttr Studio"
                class="text-xs"
              />
            </div>
            <div>
              <label class="text-xs text-[var(--text-secondary)] block mb-1">Sticker Emojis</label>
              <Input
                v-model="emojiTags"
                placeholder="🔥, 😎"
                class="text-xs"
              />
            </div>
          </div>
        </Card>
      </div>

      <!-- Right Column: Live Chat Simulation & Export Deck (lg:col-span-5) -->
      <div class="lg:col-span-5 space-y-5 sticky top-20">
        <!-- Live Preview Deck -->
        <Card class="p-4 sm:p-5 space-y-4">
          <!-- Preview Mode Tabs -->
          <div class="flex items-center justify-between gap-2 border-b border-[#2E2E2E] pb-3">
            <span class="text-xs font-medium text-[var(--text-secondary)]">Preview Environment:</span>
            <div class="flex items-center gap-1 bg-[#1A1A1A] p-1 rounded-lg border border-[#2E2E2E]">
              <button
                type="button"
                class="px-2 py-0.5 text-xs rounded transition-colors"
                :class="previewMode === 'wa-dark' ? 'bg-[#2A2A2A] text-white font-medium' : 'text-gray-400 hover:text-white'"
                @click="previewMode = 'wa-dark'"
              >
                WA Dark
              </button>
              <button
                type="button"
                class="px-2 py-0.5 text-xs rounded transition-colors"
                :class="previewMode === 'wa-light' ? 'bg-[#2A2A2A] text-white font-medium' : 'text-gray-400 hover:text-white'"
                @click="previewMode = 'wa-light'"
              >
                WA Light
              </button>
              <button
                type="button"
                class="px-2 py-0.5 text-xs rounded transition-colors"
                :class="previewMode === 'telegram' ? 'bg-[#2A2A2A] text-white font-medium' : 'text-gray-400 hover:text-white'"
                @click="previewMode = 'telegram'"
              >
                Telegram
              </button>
              <button
                type="button"
                class="px-2 py-0.5 text-xs rounded transition-colors"
                :class="previewMode === 'transparent' ? 'bg-[#2A2A2A] text-white font-medium' : 'text-gray-400 hover:text-white'"
                @click="previewMode = 'transparent'"
              >
                Grid
              </button>
            </div>
          </div>

          <!-- Canvas Display Frame -->
          <div
            class="relative w-full aspect-square rounded-xl overflow-hidden border border-[#2E2E2E] flex items-center justify-center p-4 transition-colors"
            :class="{
              'bg-[#0b141a]': previewMode === 'wa-dark',
              'bg-[#efeae2]': previewMode === 'wa-light',
              'bg-[#0e1621]': previewMode === 'telegram',
              'bg-[linear-gradient(45deg,#1c1c1c_25%,transparent_25%),linear-gradient(-45deg,#1c1c1c_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1c1c1c_75%),linear-gradient(-45deg,transparent_75%,#1c1c1c_75%)] bg-[size:16px_16px] bg-[#121212]': previewMode === 'transparent'
            }"
          >
            <!-- WhatsApp Chat Bubble Simulation (when in chat preview modes) -->
            <div
              v-if="previewMode === 'wa-dark' || previewMode === 'wa-light'"
              class="absolute bottom-3 right-3 px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 shadow-sm"
              :class="previewMode === 'wa-dark' ? 'bg-[#1f2c34]/80 text-[#8696a0]' : 'bg-white/80 text-[#667781]'"
            >
              <span>12:45 PM</span>
              <span class="text-blue-400">✓✓</span>
            </div>

            <!-- 16px Safe Margin Guide Overlay -->
            <div
              v-if="showSafeMargin"
              class="absolute inset-4 border border-dashed border-white/20 pointer-events-none rounded-lg"
              title="16px WhatsApp Safe Margin"
            />

            <!-- 512x512 Main Canvas -->
            <canvas
              ref="canvasRef"
              width="512"
              height="512"
              class="w-full h-full max-w-[360px] max-h-[360px] object-contain select-none"
            />
          </div>

          <!-- Format Selector & Size Info -->
          <div class="space-y-3 pt-2">
            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                class="p-2.5 rounded-lg border text-left transition-all"
                :class="targetFormat === 'whatsapp' ? 'border-white bg-[#212121] text-white' : 'border-[#2E2E2E] bg-[#141416] text-[var(--text-secondary)] hover:border-[#3E3E3E]'"
                @click="targetFormat = 'whatsapp'"
              >
                <div class="text-xs font-semibold text-white">WhatsApp</div>
                <div class="text-[10px] opacity-70 mt-0.5">.webp (EXIF)</div>
              </button>

              <button
                type="button"
                class="p-2.5 rounded-lg border text-left transition-all"
                :class="targetFormat === 'telegram' ? 'border-white bg-[#212121] text-white' : 'border-[#2E2E2E] bg-[#141416] text-[var(--text-secondary)] hover:border-[#3E3E3E]'"
                @click="targetFormat = 'telegram'"
              >
                <div class="text-xs font-semibold text-white">Telegram</div>
                <div class="text-[10px] opacity-70 mt-0.5">512×512 .webp</div>
              </button>

              <button
                type="button"
                class="p-2.5 rounded-lg border text-left transition-all"
                :class="targetFormat === 'png' ? 'border-white bg-[#212121] text-white' : 'border-[#2E2E2E] bg-[#141416] text-[var(--text-secondary)] hover:border-[#3E3E3E]'"
                @click="targetFormat = 'png'"
              >
                <div class="text-xs font-semibold text-white">Direct PNG</div>
                <div class="text-[10px] opacity-70 mt-0.5">Transparent</div>
              </button>
            </div>

            <!-- Size Check Indicator -->
            <div class="flex items-center justify-between text-xs px-1">
              <span class="text-[var(--text-secondary)]">Canvas Resolution:</span>
              <span class="font-mono text-white">512 × 512 px</span>
            </div>
            <div class="flex items-center justify-between text-xs px-1">
              <span class="text-[var(--text-secondary)]">Estimated Size:</span>
              <span
                class="font-mono font-medium"
                :class="estimatedSizeKb < 100 ? 'text-emerald-400' : 'text-amber-400'"
              >
                ~{{ estimatedSizeKb }} KB {{ targetFormat === 'whatsapp' ? '(Max 100 KB)' : '' }}
              </span>
            </div>

            <!-- Primary Export Button -->
            <Button
              id="btn-download-sticker"
              variant="primary"
              class="w-full py-3"
              :disabled="isDownloading"
              @click="downloadSticker"
            >
              <Download class="w-4 h-4 mr-2" />
              <span>
                {{ isDownloading ? 'Building Sticker...' : `Download ${targetFormat === 'whatsapp' ? 'WhatsApp Sticker (.webp)' : targetFormat === 'telegram' ? 'Telegram Sticker (.webp)' : 'PNG Cutout'}` }}
              </span>
            </Button>

            <!-- Secondary Action: Copy to Clipboard -->
            <Button
              variant="outline"
              class="w-full"
              @click="copyStickerToClipboard"
            >
              <Check v-if="hasCopied" class="w-4 h-4 mr-2 text-emerald-400" />
              <Copy v-else class="w-4 h-4 mr-2" />
              <span>{{ hasCopied ? 'Copied to Clipboard!' : 'Copy to Clipboard (Paste to WA Web)' }}</span>
            </Button>
          </div>
        </Card>

        <!-- Quick Usage Guide Card -->
        <Card class="p-4 text-xs text-[var(--text-secondary)] space-y-2">
          <div class="flex items-center gap-1.5 text-[var(--text-primary)] font-semibold">
            <Info class="w-3.5 h-3.5" />
            <span>How to use in WhatsApp</span>
          </div>
          <p class="leading-relaxed">
            • <strong>WhatsApp Web:</strong> Drag & drop the downloaded file directly into chat, or click Copy above and press <kbd class="px-1 py-0.5 bg-[#2E2E2E] rounded text-white">Ctrl+V</kbd>.
          </p>
          <p class="leading-relaxed">
            • <strong>Mobile:</strong> The exported WebP file has official <code class="text-white">net.whatsapp.WhatsApp</code> EXIF metadata embedded, allowing WhatsApp sticker apps or direct file sharing to recognize it as a native sticker.
          </p>
        </Card>
      </div>
    </div>
  </div>
</template>
