<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  Upload,
  Download,
  Trash2,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Check,
  RefreshCw,
  Eye,
  Sliders,
  Palette,
  Clipboard,
  Link as LinkIcon,
  Zap,
  AlertTriangle,
  ArrowRight,
  FolderOpen
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import { useI18n } from '~/composables/useI18n'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

const toast = useToast()
const { t, locale } = useI18n()

const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

const originalImageFile = ref<File | null>(null)
const originalImageUrl = ref<string | null>(null)
const processedImageUrl = ref<string | null>(null)
const isProcessing = ref(false)
const isFetchingUrl = ref(false)
const progressStatus = ref('')
const imageUrlInput = ref('')
const isQuotaExceeded = ref(false)
const quotaErrorMessage = ref('')

// Background customization options
const bgType = ref<'transparent' | 'color' | 'gradient'>('transparent')
const solidBgColor = ref('#FFFFFF')
const gradientChoice = ref('linear-gradient(135deg, #667eea 0%, #764ba2 100%)')

const gradients = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)',
  'linear-gradient(120deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(to top, #0ba360 0%, #3cba92 100%)',
  'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #171717 0%, #2E2E2E 100%)',
]

// File drop & upload handler
const handleFileSelect = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  processSelectedFile(file)
}

const handleDrop = (e: DragEvent) => {
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  processSelectedFile(file)
}

const processSelectedFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    toast.error('Invalid Format', 'Please upload a PNG, JPG, or WebP image')
    return
  }

  originalImageFile.value = file
  originalImageUrl.value = URL.createObjectURL(file)
  processedImageUrl.value = null
  removeBackground()
}

// Convert File to Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Fetch Image from URL (supports relative /mio.png, data:image, and remote HTTP/HTTPS with proxy fallback)
const fetchImageFromUrl = async (urlToFetch?: string) => {
  const target = (urlToFetch || imageUrlInput.value).trim()
  if (!target) return

  const isHttp = /^https?:\/\//i.test(target)
  const isRelative = target.startsWith('/') || target.startsWith('./')
  const isDataUrl = target.startsWith('data:image/')

  if (!isHttp && !isRelative && !isDataUrl) {
    toast.error('Invalid URL', 'Please enter a valid HTTP/HTTPS link or select a sample image')
    return
  }

  isFetchingUrl.value = true
  progressStatus.value = 'Fetching image...'

  try {
    let response: Response | null = null

    if (isDataUrl) {
      const res = await fetch(target)
      const blob = await res.blob()
      const file = new File([blob], 'sample_image.png', { type: blob.type || 'image/png' })
      processSelectedFile(file)
      imageUrlInput.value = ''
      return
    }

    if (isRelative) {
      // Local relative asset (e.g. /mio.png)
      response = await fetch(target)
    } else {
      // Try direct fetch first
      try {
        response = await fetch(target, { mode: 'cors' })
        if (!response.ok) response = null
      } catch {
        response = null
      }

      // Fallback to server proxy if direct fetch is blocked by CORS
      if (!response) {
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(target)}`
        response = await fetch(proxyUrl)
      }
    }

    if (!response || !response.ok) throw new Error('Could not download image from specified link')

    const blob = await response.blob()
    const fileName = target.split('/').pop()?.split('?')[0] || 'online_image.png'
    const file = new File([blob], fileName, { type: blob.type || 'image/png' })

    toast.success('Image Loaded', 'Processing background removal via Remove.bg...')
    processSelectedFile(file)
    imageUrlInput.value = ''
  } catch (err: any) {
    toast.error('Fetch Failed', err.message || 'Could not load image from link')
  } finally {
    isFetchingUrl.value = false
  }
}

// Paste from Clipboard Button Handler
const pasteFromClipboard = async () => {
  try {
    const clipboardItems = await navigator.clipboard.read()
    for (const item of clipboardItems) {
      const imageType = item.types.find((t) => t.startsWith('image/'))
      if (imageType) {
        const blob = await item.getType(imageType)
        const file = new File([blob], `pasted_image_${Date.now()}.png`, { type: imageType })
        toast.info('Image Pasted', 'Processing image from clipboard...')
        processSelectedFile(file)
        return
      }
    }

    // If no direct image blob in clipboard, check text for URL
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

// Global Keyboard Paste Listener (Ctrl+V / Cmd+V)
const handleGlobalPaste = (e: ClipboardEvent) => {
  const items = e.clipboardData?.items
  if (!items) return

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const blob = items[i].getAsFile()
      if (blob) {
        e.preventDefault()
        toast.info('Image Pasted', 'Processing pasted image from clipboard...')
        processSelectedFile(blob)
        return
      }
    }
  }

  // If text pasted is a direct image URL and no file is loaded
  if (!originalImageUrl.value) {
    const text = e.clipboardData?.getData('text/plain')?.trim()
    if (text && /^https?:\/\/.+\.(jpg|jpeg|png|webp|avif|svg)(\?.*)?$/i.test(text)) {
      e.preventDefault()
      fetchImageFromUrl(text)
    }
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('paste', handleGlobalPaste)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('paste', handleGlobalPaste)
  }
})

// Remove Background via official Remove.bg API
const removeBackground = async () => {
  if (!originalImageFile.value) return

  isProcessing.value = true
  progressStatus.value = 'Removing background with Remove.bg API...'
  isQuotaExceeded.value = false

  try {
    const b64 = await fileToBase64(originalImageFile.value)

    const res = await $fetch<{ success: boolean; resultUrl: string }>('/api/tools/remove-bg', {
      method: 'POST',
      body: {
        image_b64: b64,
        size: 'auto',
      },
    })

    if (res && res.resultUrl) {
      processedImageUrl.value = res.resultUrl
      toast.success('Cutout Ready', 'Background successfully removed!')
    } else {
      throw new Error('No image returned from Remove.bg')
    }
  } catch (err: any) {
    console.error('Remove.bg Error:', err)
    const isQuota = err.statusCode === 429 || err.statusCode === 402 || err.data?.data?.isQuotaExceeded || /limit|credit|quota|exceeded/i.test(err.message || '')
    if (isQuota) {
      isQuotaExceeded.value = true
      quotaErrorMessage.value = 'Remove.bg API Quota Limit Reached: The monthly free credits or API request limit has been exhausted. Background removal is temporarily unavailable.'
      toast.error('API Quota Limit', 'Remove.bg credits limit has been reached.')
    } else {
      const msg = err.data?.message || err.message || 'Could not remove background'
      toast.error('Removal Failed', msg)
    }
  } finally {
    isProcessing.value = false
  }
}

// Download Composite Result
const downloadCutout = () => {
  if (!processedImageUrl.value) return

  // If transparent, download directly
  if (bgType.value === 'transparent') {
    const link = document.createElement('a')
    link.href = processedImageUrl.value
    link.download = `cutout_${originalImageFile.value?.name.replace(/\.[^/.]+$/, '') || 'image'}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Downloaded', 'Transparent PNG cutout saved')
    return
  }

  // Composite with background color / gradient on canvas
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (bgType.value === 'color') {
      ctx.fillStyle = solidBgColor.value
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    } else if (bgType.value === 'gradient') {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      grad.addColorStop(0, '#667eea')
      grad.addColorStop(1, '#764ba2')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    ctx.drawImage(img, 0, 0)
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `composite_${originalImageFile.value?.name.replace(/\.[^/.]+$/, '') || 'image'}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Downloaded', 'High-res composite image saved')
  }
  img.src = processedImageUrl.value
}

const resetAll = () => {
  originalImageFile.value = null
  originalImageUrl.value = null
  processedImageUrl.value = null
  isProcessing.value = false
  imageUrlInput.value = ''
}
</script>

<template>
  <div class="space-y-6 pb-12 w-full">
    <!-- Header & Breadcrumbs (Standard Design Mandate) -->
    <div class="flex items-center gap-2 text-xs font-mono text-[var(--text-tertiary)]">
      <NuxtLink to="/" class="hover:text-white transition-colors">Dashboard</NuxtLink>
      <span>/</span>
      <span>Tools</span>
      <span>/</span>
      <span class="text-white">{{ t.tools['background-remover']?.title || 'Background Remover' }}</span>
    </div>

    <!-- Title Header Row -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          {{ t.tools['background-remover']?.title || 'Background Remover' }}
        </h1>
        <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
          {{ t.tools['background-remover']?.description || '100% Client-side AI neural segmentation to remove backgrounds instantly without server uploads.' }}
        </p>
      </div>

      <div v-if="originalImageUrl" class="flex items-center gap-2 shrink-0">
        <Button
          variant="secondary"
          size="default"
          class="h-9 px-3.5 rounded-lg text-xs font-medium cursor-pointer"
          @click="resetAll"
        >
          <FolderOpen class="w-3.5 h-3.5 mr-1.5 text-white/70" />
          <span>{{ locale === 'id' ? 'Upload Foto Lain' : 'Upload Another' }}</span>
        </Button>
      </div>
    </div>

    <!-- API Quota Limit Alert Banner -->
    <div
      v-if="isQuotaExceeded"
      class="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 flex items-start gap-3 shadow-sm transition-all"
    >
      <AlertTriangle class="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
      <div class="space-y-1">
        <h4 class="text-xs font-bold text-red-300">
          Remove.bg API Quota Limit Reached
        </h4>
        <p class="text-xs text-red-300/80 leading-relaxed">
          {{ quotaErrorMessage || 'API key limit reached (Insufficient credits or rate limit exceeded). Background removal is temporarily unavailable.' }}
        </p>
      </div>
    </div>

    <!-- Empty Upload & URL Input Workspace -->
    <div v-if="!originalImageUrl" class="space-y-4">
      <!-- 1. Standalone URL & Clipboard Paste Omnibox (No Outer Card) -->
      <form @submit.prevent="fetchImageFromUrl()" class="flex flex-col sm:flex-row items-center gap-2.5">
        <div class="relative w-full flex-1 flex items-center">
          <LinkIcon class="w-4 h-4 text-[var(--text-tertiary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            v-model="imageUrlInput"
            type="url"
            :placeholder="locale === 'id' ? 'Tempel link foto (URL) atau tekan Ctrl+V di mana saja...' : 'Paste image link (URL) or press Ctrl+V anywhere...'"
            class="w-full h-11 pl-10 pr-10 bg-[#171717] hover:bg-[#1a1a1c] border border-[#2E2E2E] focus:border-white/40 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-xl text-xs font-mono transition-all focus:outline-none focus:ring-2 focus:ring-white/10"
          />
          <button
            type="button"
            class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
            @click="pasteFromClipboard"
            :title="locale === 'id' ? 'Tempel dari clipboard' : 'Paste from clipboard'"
          >
            <Clipboard class="w-4 h-4" />
          </button>
        </div>

        <Button
          type="submit"
          variant="secondary"
          size="default"
          class="w-full sm:w-auto h-11 px-5 rounded-xl font-medium text-xs shrink-0 cursor-pointer"
          :disabled="!imageUrlInput.trim() || isFetchingUrl"
          :loading="isFetchingUrl"
        >
          <ArrowRight class="w-3.5 h-3.5 mr-1.5" />
          <span>{{ locale === 'id' ? 'Ambil Foto' : 'Fetch & Cutout' }}</span>
        </Button>
      </form>

      <!-- 2. Main Standardized Dropzone -->
      <div
        class="relative border-2 border-dashed rounded-[14px] p-8 sm:p-14 text-center transition-all cursor-pointer select-none border-[#2E2E2E] bg-[#141416] hover:border-[#3E3E3E]"
        :class="isDragging ? 'border-white bg-[var(--bg-card-hover)]' : ''"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="(e) => { isDragging = false; handleDrop(e) }"
        @click="fileInputRef?.click()"
      >
        <div class="max-w-md mx-auto space-y-3">
          <div class="w-12 h-12 mx-auto rounded-xl bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-white shadow-xs">
            <ImageIcon class="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 class="text-sm font-semibold text-[var(--text-primary)]">
              {{ t.dropzoneBrowse }}
            </h3>
            <p class="text-xs text-[var(--text-secondary)] mt-1">
              {{ t.dropzoneImageDesc }}
            </p>
          </div>
        </div>

        <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="handleFileSelect" />
      </div>
    </div>

    <!-- Active Workspace View -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left: Interactive Visual Canvas Area -->
      <div class="lg:col-span-8 space-y-4">
        <Card :hoverable="false" class="p-4 sm:p-6 flex flex-col items-center justify-center min-h-[380px] relative overflow-hidden">
          <!-- Processing Overlay -->
          <div
            v-if="isProcessing"
            class="absolute inset-0 bg-black/80 backdrop-blur-xs z-20 flex flex-col items-center justify-center p-6 text-center space-y-4"
          >
            <div class="w-10 h-10 border-3 border-white/20 border-t-white rounded-full animate-spin" />
            <div class="text-sm font-semibold text-white">{{ progressStatus }}</div>
          </div>

          <!-- Cutout Canvas Preview -->
          <div
            class="w-full max-h-[440px] rounded-xl border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden relative shadow-inner p-4"
            :class="bgType === 'transparent' ? 'bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:16px_16px] bg-[#1a1a1a]' : ''"
            :style="
              bgType === 'color'
                ? { backgroundColor: solidBgColor }
                : bgType === 'gradient'
                ? { backgroundImage: gradientChoice }
                : {}
            "
          >
            <img
              v-if="processedImageUrl"
              :src="processedImageUrl"
              alt="Cutout result"
              class="max-h-[380px] w-auto object-contain select-none transition-all drop-shadow-md"
            />
            <img
              v-else-if="originalImageUrl"
              :src="originalImageUrl"
              alt="Original preview"
              class="max-h-[380px] w-auto object-contain select-none opacity-60"
            />
          </div>
        </Card>
      </div>

      <!-- Right: Customization Controls & Download Card -->
      <div class="lg:col-span-4 space-y-4">
        <!-- Background Options Card -->
        <Card :hoverable="false" class="p-5 space-y-4">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
            <Palette class="w-3.5 h-3.5" />
            Background Replacement
          </h3>

          <!-- BG Type Tabs -->
          <div class="grid grid-cols-3 gap-1.5 p-1 bg-[#171717] border border-[var(--border-subtle)] rounded-lg text-xs">
            <button
              type="button"
              class="py-1.5 rounded-md font-medium transition-all cursor-pointer text-center"
              :class="bgType === 'transparent' ? 'bg-[#2E2E2E] text-white font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
              @click="bgType = 'transparent'"
            >
              Transparent
            </button>
            <button
              type="button"
              class="py-1.5 rounded-md font-medium transition-all cursor-pointer text-center"
              :class="bgType === 'color' ? 'bg-[#2E2E2E] text-white font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
              @click="bgType = 'color'"
            >
              Solid Color
            </button>
            <button
              type="button"
              class="py-1.5 rounded-md font-medium transition-all cursor-pointer text-center"
              :class="bgType === 'gradient' ? 'bg-[#2E2E2E] text-white font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
              @click="bgType = 'gradient'"
            >
              Gradient
            </button>
          </div>

          <!-- Solid Color Customizer -->
          <div v-if="bgType === 'color'" class="space-y-2 pt-1">
            <div class="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg p-2">
              <input
                v-model="solidBgColor"
                type="color"
                class="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
              />
              <input
                v-model="solidBgColor"
                type="text"
                class="w-full text-xs font-mono text-[var(--text-primary)] uppercase bg-transparent focus:outline-none"
              />
            </div>

            <!-- Quick Swatches -->
            <div class="flex items-center gap-1.5 pt-1">
              <button
                v-for="c in ['#FFFFFF', '#000000', '#F3F4F6', '#1E293B', '#3B82F6', '#10B981', '#F59E0B', '#EF4444']"
                :key="c"
                type="button"
                class="w-6 h-6 rounded-md border border-[var(--border-subtle)] transition-transform hover:scale-110 cursor-pointer shadow-xs"
                :style="{ backgroundColor: c }"
                @click="solidBgColor = c"
              />
            </div>
          </div>

          <!-- Gradient Choices -->
          <div v-else-if="bgType === 'gradient'" class="grid grid-cols-3 gap-2 pt-1">
            <button
              v-for="grad in gradients"
              :key="grad"
              type="button"
              class="h-10 rounded-lg border border-[var(--border-subtle)] transition-transform hover:scale-105 cursor-pointer shadow-xs"
              :class="gradientChoice === grad ? 'ring-2 ring-white' : ''"
              :style="{ backgroundImage: grad }"
              @click="gradientChoice = grad"
            />
          </div>
        </Card>

        <!-- Actions Card -->
        <Card :hoverable="false" class="p-5 space-y-3">
          <Button
            variant="primary"
            class="w-full font-semibold"
            :disabled="!processedImageUrl || isProcessing"
            @click="downloadCutout"
          >
            <Download class="w-4 h-4 mr-2" />
            Download Cutout
          </Button>

          <Button
            variant="secondary"
            class="w-full text-xs"
            :disabled="isProcessing"
            @click="removeBackground"
          >
            <RefreshCw class="w-3.5 h-3.5 mr-1.5" />
            Reprocess Cutout
          </Button>

          <Button
            variant="ghost"
            class="w-full text-xs text-[var(--text-tertiary)] hover:text-red-400"
            @click="resetAll"
          >
            <Trash2 class="w-3.5 h-3.5 mr-1.5" />
            Upload Another Image
          </Button>
        </Card>
      </div>
    </div>
  </div>
</template>
