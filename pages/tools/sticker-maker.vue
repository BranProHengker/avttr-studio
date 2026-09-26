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
  Maximize2,
  Link as LinkIcon,
  Clipboard,
  X,
  ArrowRight
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
const { t, locale } = useI18n()

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

// Quick Sample Images (Distinct Real Assets)
const sampleImages = [
  { name: 'Mio Mascot', url: '/mio.png' },
  { name: 'Mio 404 Scene', url: '/mio-404-scene.webp' },
  { name: 'Editorial Card', url: '/og-image-editorial.png' }
]

// URL Input & Clipboard Paste State
const imageUrlInput = ref('')
const isFetchingUrl = ref(false)

// Preset Stroke Colors
const strokeColorPresets = ['#FFFFFF', '#000000', '#FFE600', '#00F0FF', '#FF0055', '#25D366']

// Select Stroke Color & auto-enable stroke if currently 0
const selectStrokeColor = (color: string) => {
  strokeColor.value = color
  if (strokeWidth.value === 0) {
    strokeWidth.value = 10
  }
}

const handleCustomColorInput = () => {
  if (strokeWidth.value === 0) {
    strokeWidth.value = 10
  }
}

// Load Image from Blob or URL
const loadImage = (url: string, fileObj?: File) => {
  const img = new Image()
  if (/^https?:\/\//i.test(url)) {
    img.crossOrigin = 'anonymous'
  }
  img.onload = () => {
    sourceImage.value = img
    if (fileObj) {
      originalFile.value = fileObj
    } else {
      const name = url.split('/').pop()?.split('?')[0] || 'sticker_sample.png'
      originalFile.value = new File([], name, { type: 'image/png' })
    }
    autoFitImage(img)
    nextTick(() => {
      renderSticker()
    })
    toast.success('Image Loaded', 'Customize your sticker with outlines and text')
  }
  img.onerror = () => {
    if (img.crossOrigin) {
      const fallback = new Image()
      fallback.onload = () => {
        sourceImage.value = fallback
        autoFitImage(fallback)
        nextTick(() => renderSticker())
        toast.success('Image Loaded', 'Customize your sticker with outlines and text')
      }
      fallback.onerror = () => {
        toast.error('Image Error', 'Could not load image')
      }
      fallback.src = url
      return
    }
    toast.error('Image Error', 'Could not load image')
  }
  img.src = url
}

// Fetch Image from URL (supports HTTP/HTTPS with proxy fallback, data URLs, and relative assets)
const fetchImageFromUrl = async (urlToFetch?: string) => {
  const target = (urlToFetch || imageUrlInput.value).trim()
  if (!target) return

  const isHttp = /^https?:\/\//i.test(target)
  const isRelative = target.startsWith('/') || target.startsWith('./')
  const isDataUrl = target.startsWith('data:image/')

  if (!isHttp && !isRelative && !isDataUrl) {
    toast.error('Invalid URL', 'Please enter a valid HTTP/HTTPS link or image URL')
    return
  }

  isFetchingUrl.value = true
  try {
    let response: Response | null = null

    if (isDataUrl) {
      const res = await fetch(target)
      const blob = await res.blob()
      const file = new File([blob], 'online_sticker.png', { type: blob.type || 'image/png' })
      processSelectedFile(file)
      imageUrlInput.value = ''
      return
    }

    if (isRelative) {
      response = await fetch(target)
    } else {
      try {
        response = await fetch(target, { mode: 'cors' })
        if (!response.ok) response = null
      } catch {
        response = null
      }

      if (!response) {
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(target)}`
        response = await fetch(proxyUrl)
      }
    }

    if (!response || !response.ok) throw new Error('Could not download image from link')

    const blob = await response.blob()
    const fileName = target.split('/').pop()?.split('?')[0] || 'online_sticker.png'
    const file = new File([blob], fileName, { type: blob.type || 'image/png' })

    processSelectedFile(file)
    imageUrlInput.value = ''
  } catch (err: any) {
    toast.error('Fetch Failed', err.message || 'Could not load image from link')
  } finally {
    isFetchingUrl.value = false
  }
}

// Paste Image from Clipboard
const pasteFromClipboard = async () => {
  try {
    const clipboardItems = await navigator.clipboard.read()
    for (const item of clipboardItems) {
      const imageType = item.types.find((t) => t.startsWith('image/'))
      if (imageType) {
        const blob = await item.getType(imageType)
        const file = new File([blob], `pasted_sticker_${Date.now()}.png`, { type: imageType })
        toast.info('Image Pasted', 'Loading image from clipboard...')
        processSelectedFile(file)
        return
      }
    }

    const text = await navigator.clipboard.readText()
    if (text && /^https?:\/\//i.test(text.trim())) {
      imageUrlInput.value = text.trim()
      fetchImageFromUrl(text.trim())
      return
    }

    toast.warning('No Image in Clipboard', 'Please copy an image or image URL first')
  } catch (err) {
    toast.error('Clipboard Access', 'Use Ctrl+V / ⌘V to paste directly')
  }
}

// Load Distinct Sample Asset
const loadSample = (url: string) => {
  fetchImageFromUrl(url)
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

    <!-- URL Omnibox & Paste Clipboard Control -->
    <div class="space-y-3">
      <form @submit.prevent="fetchImageFromUrl()" class="flex flex-col sm:flex-row items-center gap-2.5">
        <div class="relative w-full flex-1 flex items-center">
          <LinkIcon class="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="imageUrlInput"
            type="url"
            placeholder="Paste image URL (https://...) or press Ctrl+V anywhere..."
            class="w-full h-11 pl-10 bg-white dark:bg-[#171717] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] border border-zinc-200 dark:border-[#2E2E2E] focus:border-zinc-400 dark:focus:border-white/40 text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 rounded-xl text-xs font-mono transition-all focus:outline-none focus:ring-2 focus:ring-zinc-400/20 dark:focus:ring-white/10"
            :class="imageUrlInput ? 'pr-20' : 'pr-12'"
          />
          <div class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              v-if="imageUrlInput"
              type="button"
              class="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10"
              title="Clear input"
              @click="imageUrlInput = ''"
            >
              <X class="w-4 h-4" />
            </button>
            <button
              type="button"
              class="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10"
              title="Paste from clipboard"
              @click="pasteFromClipboard"
            >
              <Clipboard class="w-4 h-4" />
            </button>
          </div>
        </div>

        <Button
          type="submit"
          variant="secondary"
          class="w-full sm:w-auto h-11 px-5 rounded-xl font-medium text-xs shrink-0 cursor-pointer"
          :disabled="!imageUrlInput.trim() || isFetchingUrl"
          :loading="isFetchingUrl"
        >
          <ArrowRight class="w-3.5 h-3.5 mr-1.5" />
          <span>{{ isFetchingUrl ? 'Fetching...' : 'Load URL' }}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          class="w-full sm:w-auto h-11 px-4 rounded-xl font-medium text-xs shrink-0 cursor-pointer"
          @click="pasteFromClipboard"
        >
          <Clipboard class="w-3.5 h-3.5 mr-1.5" />
          <span>Paste Image</span>
        </Button>
      </form>

      <!-- Standard Upload Dropzone (DESIGN.md Section 10) -->
      <div
        id="sticker-dropzone"
        class="relative border-2 border-dashed rounded-[14px] p-6 sm:p-10 border-zinc-300 dark:border-[#2E2E2E] bg-zinc-50/50 dark:bg-[#141416] hover:border-zinc-400 dark:hover:border-[#3E3E3E] text-center cursor-pointer select-none transition-all duration-150"
        :class="{ 'border-zinc-900 bg-zinc-100 dark:border-white/40 dark:bg-white/5': isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
      >
        <div class="w-12 h-12 mx-auto rounded-xl bg-white dark:bg-[#212121] border border-zinc-200 dark:border-[#2E2E2E] flex items-center justify-center text-zinc-900 dark:text-white shadow-xs">
          <Upload class="w-6 h-6 text-zinc-900 dark:text-white" />
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
            class="px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-[#2E2E2E] bg-zinc-100 dark:bg-[#1E1E1E] text-zinc-800 dark:text-white hover:bg-zinc-200 dark:hover:bg-[#2A2A2A] hover:border-zinc-300 dark:hover:border-[#4E4E4E] transition-colors cursor-pointer"
            @click="loadSample(sample.url)"
          >
            {{ sample.name }}
          </button>
        </div>
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
                variant="outline"
                size="sm"
                @click="pasteFromClipboard"
              >
                <Clipboard class="w-3.5 h-3.5 mr-1.5" />
                <span>Paste</span>
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
            <span
              class="text-xs font-mono transition-colors"
              :class="strokeWidth === 0 ? 'text-white font-medium' : 'text-[var(--text-secondary)]'"
            >
              {{ strokeWidth === 0 ? 'No outline' : `${strokeWidth}px outline` }}
            </span>
          </div>

          <!-- Stroke Width Slider & Quick Presets -->
          <div class="space-y-2.5">
            <div class="flex justify-between text-xs text-[var(--text-secondary)]">
              <span>Outline Thickness</span>
              <span class="font-mono text-white">{{ strokeWidth === 0 ? 'None (0px)' : `${strokeWidth}px` }}</span>
            </div>

            <!-- Quick Presets -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                class="px-2.5 py-1 text-xs rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer"
                :class="strokeWidth === 0 ? 'border-white bg-white/15 text-white font-medium shadow-xs ring-1 ring-white/20' : 'border-[#2E2E2E] bg-[#1A1A1A] text-gray-400 hover:text-white hover:border-[#3E3E3E]'"
                @click="strokeWidth = 0"
              >
                <div class="w-3.5 h-3.5 rounded-[3px] border border-white/20 shrink-0 overflow-hidden bg-[linear-gradient(45deg,#555_25%,transparent_25%),linear-gradient(-45deg,#555_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#555_75%),linear-gradient(-45deg,transparent_75%,#555_75%)] bg-[size:4px_4px] bg-[#1a1a1a]" />
                <span>No Outline</span>
              </button>
              <button
                type="button"
                class="px-2.5 py-1 text-xs rounded-lg border transition-all"
                :class="strokeWidth === 4 ? 'border-white bg-white text-black font-medium' : 'border-[#2E2E2E] bg-[#1A1A1A] text-gray-400 hover:text-white hover:border-[#3E3E3E]'"
                @click="strokeWidth = 4"
              >
                Thin (4px)
              </button>
              <button
                type="button"
                class="px-2.5 py-1 text-xs rounded-lg border transition-all"
                :class="strokeWidth === 10 ? 'border-white bg-white text-black font-medium' : 'border-[#2E2E2E] bg-[#1A1A1A] text-gray-400 hover:text-white hover:border-[#3E3E3E]'"
                @click="strokeWidth = 10"
              >
                Medium (10px)
              </button>
              <button
                type="button"
                class="px-2.5 py-1 text-xs rounded-lg border transition-all"
                :class="strokeWidth === 18 ? 'border-white bg-white text-black font-medium' : 'border-[#2E2E2E] bg-[#1A1A1A] text-gray-400 hover:text-white hover:border-[#3E3E3E]'"
                @click="strokeWidth = 18"
              >
                Thick (18px)
              </button>
            </div>

            <input
              v-model.number="strokeWidth"
              type="range"
              min="0"
              max="24"
              step="1"
              class="w-full accent-white bg-[#2E2E2E] h-1.5 rounded-lg appearance-none cursor-pointer mt-1"
            />
          </div>

          <!-- Stroke Color Selector -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs text-[var(--text-secondary)] block">Outline Color</label>
              <span v-if="strokeWidth === 0" class="text-[11px] text-[var(--text-secondary)]">Click a color to enable outline</span>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <!-- Transparent / No Outline Checkerboard Swatch -->
              <button
                type="button"
                class="w-6 h-6 rounded-full border border-[#2E2E2E] overflow-hidden transition-transform cursor-pointer bg-[linear-gradient(45deg,#555_25%,transparent_25%),linear-gradient(-45deg,#555_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#555_75%),linear-gradient(-45deg,transparent_75%,#555_75%)] bg-[size:6px_6px] bg-[#1a1a1a]"
                :class="{ 'ring-2 ring-white scale-110 border-white/60': strokeWidth === 0 }"
                title="Transparent / No Outline (0px)"
                @click="strokeWidth = 0"
              />

              <button
                v-for="color in strokeColorPresets"
                :key="color"
                type="button"
                class="w-6 h-6 rounded-full border border-[#2E2E2E] transition-transform"
                :class="{ 'ring-2 ring-white scale-110': strokeWidth > 0 && strokeColor.toLowerCase() === color.toLowerCase() }"
                :style="{ backgroundColor: color }"
                @click="selectStrokeColor(color)"
              />
              <input
                v-model="strokeColor"
                type="color"
                class="w-7 h-7 rounded border border-[#2E2E2E] bg-transparent cursor-pointer"
                title="Custom color"
                @input="handleCustomColorInput"
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
        <Card class="p-4 text-xs text-[var(--text-secondary)] space-y-2.5">
          <div class="flex items-center gap-1.5 text-[var(--text-primary)] font-semibold">
            <Info class="w-3.5 h-3.5 text-white" />
            <span>{{ locale === 'id' ? 'Cara Kirim Sebagai Stiker (Biar Nggak Jadi Foto)' : 'How to Send as a Real Sticker (Avoid Photo Mode)' }}</span>
          </div>
          <div class="space-y-2 leading-relaxed">
            <p>
              • <strong>WhatsApp Web:</strong> {{ locale === 'id' ? 'Jangan drag & drop langsung. Klik tombol' : 'Do not drag & drop directly. Click the' }} <kbd class="px-1.5 py-0.5 bg-[#2E2E2E] rounded text-white font-mono">+</kbd> {{ locale === 'id' ? 'di sebelah kolom chat &rarr; Pilih menu' : 'attachment button &rarr; Select' }} <strong>"New Sticker" / "Stiker"</strong> {{ locale === 'id' ? '(icon stiker) &rarr; Pilih file' : '(sticker icon) &rarr; Choose the' }} <code class="text-white font-mono">.webp</code> {{ locale === 'id' ? 'ini agar terkirim transparan.' : 'file to send as a floating sticker.' }}
            </p>
            <p>
              • <strong>WhatsApp Mobile (HP):</strong> {{ locale === 'id' ? 'Kirim stiker ke diri sendiri lewat WhatsApp Web, lalu di HP cukup tekan & tahan stikernya &rarr; pilih' : 'Send the sticker to your chat via WhatsApp Web, then on your phone tap & hold it &rarr; choose' }} <strong>{{ locale === 'id' ? '"Tambah ke Favorit" (⭐)' : '"Add to Favorites" (⭐)' }}</strong> {{ locale === 'id' ? 'agar tersimpan permanen di HP.' : 'to save it permanently.' }}
            </p>
            <p>
              • <strong>Telegram:</strong> {{ locale === 'id' ? 'Kirim file' : 'Send this' }} <code class="text-white font-mono">.webp</code> {{ locale === 'id' ? '512×512 ini ke bot' : '512×512 file to the' }} <strong>@Stickers</strong> {{ locale === 'id' ? 'dengan mode' : 'bot as a' }} <strong>{{ locale === 'id' ? 'File / Dokumen (Tanpa Kompresi)' : 'File / Document (Uncompressed)' }}</strong> {{ locale === 'id' ? 'untuk dimasukkan ke stiker pack kamu.' : 'to add it to your official sticker pack.' }}
            </p>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
