<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import JSZip from 'jszip'
import {
  CloudUpload as UploadCloud,
  MediaImage as FileImage,
  Download,
  Trash as Trash2,
  ControlSlider as Sliders,
  Sparks as Sparkles,
  MultiplePages as Layers,
  ArrowRight,
  Eye,
  Check,
  Refresh as RefreshCw,
  Table2Columns as Columns,
  Maximize as Maximize2,
  Plus,
  PasteClipboard as Clipboard,
  Globe,
  X,
  Upload,
} from '@iconoir/vue'
import { useToast } from '~/composables/useToast'
import { useI18n } from '~/composables/useI18n'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

interface CompressedItem {
  id: string
  file: File
  name: string
  originalSize: number
  compressedSize: number
  originalUrl: string
  compressedUrl: string
  format: string
  width: number
  height: number
  status: 'processing' | 'done' | 'error'
  savedPercent: number
  blob: Blob
}

const toast = useToast()
const { t, locale } = useI18n()
const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const items = ref<CompressedItem[]>([])
const quality = ref(85)
const outputFormat = ref<'auto' | 'original' | 'webp' | 'jpeg' | 'png'>('auto')
const isZipping = ref(false)

// Input Source Switcher State
const inputSource = ref<'upload' | 'url'>('upload')
const imageUrlInput = ref('')
const isFetchingUrl = ref(false)

// Inline Comparison State
const activeCompareItem = ref<CompressedItem | null>(null)
const comparisonSliderPos = ref(50)
const compareViewMode = ref<'slider' | 'side-by-side'>('slider')
const isInteractingSlider = ref(false)
const compareContainerRef = ref<HTMLElement | null>(null)

const totalOriginalSize = computed(() =>
  items.value.reduce((acc, item) => acc + item.originalSize, 0)
)
const totalCompressedSize = computed(() =>
  items.value.reduce((acc, item) => acc + (item.compressedSize || item.originalSize), 0)
)
const totalSavedPercent = computed(() => {
  if (totalOriginalSize.value === 0) return 0
  const saved = totalOriginalSize.value - totalCompressedSize.value
  return Math.max(0, Math.round((saved / totalOriginalSize.value) * 100))
})

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

const optimizeSvg = async (file: File): Promise<Blob> => {
  const text = await file.text()
  // Clean SVG metadata, comments, unnecessary whitespace
  const cleaned = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim()

  return new Blob([cleaned], { type: 'image/svg+xml' })
}

const compressRasterImage = (
  file: File,
  qualityVal: number,
  targetFormat: string
): Promise<{ blob: Blob; width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const width = img.naturalWidth || img.width
      const height = img.naturalHeight || img.height

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d', { alpha: true })

      if (!ctx) {
        reject(new Error('Canvas context unavailable'))
        return
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, width, height)

      // Determine MIME type
      let mimeType = 'image/webp'
      if (targetFormat === 'original') {
        mimeType = file.type || 'image/jpeg'
      } else if (targetFormat === 'jpeg' || targetFormat === 'jpg') {
        mimeType = 'image/jpeg'
      } else if (targetFormat === 'png') {
        mimeType = 'image/png'
      } else {
        mimeType = 'image/webp'
      }

      const q = qualityVal / 100

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({ blob, width, height })
          } else {
            reject(new Error('Compression failed'))
          }
        },
        mimeType,
        q
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }

    img.src = objectUrl
  })
}

const processFile = async (file: File): Promise<CompressedItem | null> => {
  const originalUrl = URL.createObjectURL(file)
  const id = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

  try {
    let compressedBlob: Blob
    let width = 0
    let height = 0
    let format = 'webp'

    if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
      compressedBlob = await optimizeSvg(file)
      format = 'svg'
      width = 0
      height = 0
    } else {
      const result = await compressRasterImage(file, quality.value, outputFormat.value)
      compressedBlob = result.blob
      width = result.width
      height = result.height

      if (outputFormat.value === 'original') {
        format = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      } else if (outputFormat.value === 'auto') {
        format = 'webp'
      } else {
        format = outputFormat.value
      }
    }

    const compressedSize = compressedBlob.size
    const compressedUrl = URL.createObjectURL(compressedBlob)
    const savedPercent =
      file.size > 0
        ? Math.max(0, Math.round(((file.size - compressedSize) / file.size) * 100))
        : 0

    return {
      id,
      file,
      name: file.name,
      originalSize: file.size,
      compressedSize,
      originalUrl,
      compressedUrl,
      format,
      width,
      height,
      status: 'done',
      savedPercent,
      blob: compressedBlob,
    }
  } catch (err: any) {
    return {
      id,
      file,
      name: file.name,
      originalSize: file.size,
      compressedSize: file.size,
      originalUrl,
      compressedUrl: originalUrl,
      format: 'unknown',
      width: 0,
      height: 0,
      status: 'error',
      savedPercent: 0,
      blob: file,
    }
  }
}

const handleFiles = async (fileList: FileList | File[]) => {
  const incoming = Array.from(fileList).filter((f) => f.type.startsWith('image/') || f.name.endsWith('.svg'))

  if (incoming.length === 0) {
    toast.warning('Invalid Files', 'Please select valid image files (PNG, JPG, WebP, SVG, GIF, AVIF)')
    return
  }

  // Maximum 5 files per batch rule
  const remainingSlots = 5 - items.value.length
  if (remainingSlots <= 0) {
    toast.warning('Limit Reached', 'Maximum 5 images per batch. Please remove some or download current batch.')
    return
  }

  const toProcess = incoming.slice(0, remainingSlots)
  if (incoming.length > remainingSlots) {
    toast.info('Batch Limit', `Only the first ${remainingSlots} images were added (Max 5 items).`)
  }

  for (const file of toProcess) {
    const item = await processFile(file)
    if (item) {
      items.value.push(item)
      if (!activeCompareItem.value) {
        activeCompareItem.value = item
      }
    }
  }

  toast.success('Images Optimized', `Successfully processed ${toProcess.length} images`)
}

const onDrop = (e: DragEvent) => {
  isDragging.value = false
  if (e.dataTransfer?.files) {
    handleFiles(e.dataTransfer.files)
  }
}

const onFileInputChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files) {
    handleFiles(target.files)
    target.value = ''
  }
}

const fetchImageFromUrl = async () => {
  const target = imageUrlInput.value.trim()
  if (!target) return

  isFetchingUrl.value = true
  try {
    let response: Response | null = null

    // Try direct fetch first
    try {
      response = await fetch(target, { mode: 'cors' })
      if (!response.ok) response = null
    } catch {
      response = null
    }

    // Fallback to proxy
    if (!response) {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(target)}`
      response = await fetch(proxyUrl)
    }

    if (!response || !response.ok) {
      throw new Error(locale.value === 'id' ? 'Gagal mengunduh gambar dari tautan' : 'Could not download image from specified URL')
    }

    const blob = await response.blob()
    if (!blob.type.startsWith('image/') && !target.endsWith('.svg')) {
      throw new Error(locale.value === 'id' ? 'Tautan bukan merupakan file gambar yang valid' : 'URL does not point to a valid image')
    }

    let filename = 'downloaded-image'
    try {
      const parsedUrl = new URL(target, window.location.origin)
      const base = parsedUrl.pathname.split('/').pop()
      if (base && base.includes('.')) {
        filename = base
      } else {
        filename = `image-${Date.now()}.${blob.type.split('/')[1] || 'png'}`
      }
    } catch {
      filename = `image-${Date.now()}.${blob.type.split('/')[1] || 'png'}`
    }

    const file = new File([blob], filename, { type: blob.type || 'image/png' })
    await handleFiles([file])
    imageUrlInput.value = ''
    toast.success(
      locale.value === 'id' ? 'Gambar Diambil' : 'Image Loaded',
      locale.value === 'id' ? 'Gambar berhasil diambil dan dioptimasi' : 'Image loaded and optimized successfully'
    )
  } catch (err: any) {
    toast.error(
      locale.value === 'id' ? 'Gagal Mengambil Gambar' : 'Fetch Failed',
      err.message || (locale.value === 'id' ? 'Pastikan URL gambar valid dan publik' : 'Make sure the image URL is valid and public')
    )
  } finally {
    isFetchingUrl.value = false
  }
}

const handlePasteUrl = async () => {
  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      imageUrlInput.value = text.trim()
      toast.success(
        locale.value === 'id' ? 'Tautan Ditempel' : 'Link Pasted',
        imageUrlInput.value
      )
    }
  } catch {
    toast.error(
      locale.value === 'id' ? 'Gagal Mengakses Clipboard' : 'Clipboard Access Failed',
      locale.value === 'id' ? 'Izinkan akses clipboard di browser' : 'Please grant clipboard permissions'
    )
  }
}

const handlePasteImage = async () => {
  try {
    if (!navigator.clipboard?.read) {
      toast.warning(
        locale.value === 'id' ? 'Gunakan Shortcut' : 'Use Shortcut',
        locale.value === 'id' ? 'Tekan Ctrl+V langsung di halaman untuk menempel gambar' : 'Press Ctrl+V directly to paste image'
      )
      return
    }

    const clipboardItems = await navigator.clipboard.read()
    const files: File[] = []

    for (const item of clipboardItems) {
      const imgType = item.types.find((t) => t.startsWith('image/'))
      if (imgType) {
        const blob = await item.getType(imgType)
        const ext = imgType.split('/')[1] || 'png'
        files.push(new File([blob], `clipboard-${Date.now()}.${ext}`, { type: imgType }))
      }
    }

    if (files.length > 0) {
      await handleFiles(files)
    } else {
      toast.warning(
        locale.value === 'id' ? 'Tidak Ada Gambar' : 'No Image Found',
        locale.value === 'id' ? 'Clipboard tidak memuat gambar. Salin screenshot terlebih dahulu.' : 'No image found in clipboard. Copy a screenshot first.'
      )
    }
  } catch {
    toast.error(
      locale.value === 'id' ? 'Izin Ditolak' : 'Permission Denied',
      locale.value === 'id' ? 'Gunakan tombol shortcut Ctrl+V untuk menempel gambar langsung' : 'Press Ctrl+V directly on the page to paste image'
    )
  }
}

const handleGlobalPaste = (e: ClipboardEvent) => {
  const clipboardItems = e.clipboardData?.items
  if (!clipboardItems) return

  const files: File[] = []
  for (let i = 0; i < clipboardItems.length; i++) {
    if (clipboardItems[i].type.startsWith('image/')) {
      const file = clipboardItems[i].getAsFile()
      if (file) files.push(file)
    }
  }

  if (files.length > 0) {
    e.preventDefault()
    handleFiles(files)
  }
}

const stopSliderDrag = () => {
  isInteractingSlider.value = false
}

onMounted(() => {
  window.addEventListener('paste', handleGlobalPaste)
  window.addEventListener('mouseup', stopSliderDrag)
  window.addEventListener('touchend', stopSliderDrag)
})

onUnmounted(() => {
  window.removeEventListener('paste', handleGlobalPaste)
  window.removeEventListener('mouseup', stopSliderDrag)
  window.removeEventListener('touchend', stopSliderDrag)
})

const reprocessAll = async () => {
  if (items.value.length === 0) return
  const currentFiles = items.value.map((i) => i.file)
  const currentActiveName = activeCompareItem.value?.name
  items.value = []
  await handleFiles(currentFiles)
  if (currentActiveName) {
    const matched = items.value.find((i) => i.name === currentActiveName)
    if (matched) activeCompareItem.value = matched
  }
}

const selectCompareItem = (item: CompressedItem) => {
  activeCompareItem.value = item
  comparisonSliderPos.value = 50
}

const removeItem = (id: string) => {
  const idx = items.value.findIndex((i) => i.id === id)
  if (idx !== -1) {
    URL.revokeObjectURL(items.value[idx].originalUrl)
    URL.revokeObjectURL(items.value[idx].compressedUrl)
    items.value.splice(idx, 1)
    if (activeCompareItem.value?.id === id) {
      activeCompareItem.value = items.value[0] || null
    }
  }
}

const clearAll = () => {
  items.value.forEach((item) => {
    URL.revokeObjectURL(item.originalUrl)
    URL.revokeObjectURL(item.compressedUrl)
  })
  items.value = []
  activeCompareItem.value = null
}

const downloadItem = (item: CompressedItem) => {
  const baseName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name
  const filename = `${baseName}_compressed.${item.format}`
  const link = document.createElement('a')
  link.href = item.compressedUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  toast.success('Download Started', filename)
}

const downloadAllZip = async () => {
  if (items.value.length === 0) return
  isZipping.value = true

  try {
    const zip = new JSZip()
    const folder = zip.folder('compressed_images') || zip

    items.value.forEach((item, idx) => {
      const baseName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name
      const filename = `${String(idx + 1).padStart(2, '0')}_${baseName}.${item.format}`
      folder.file(filename, item.blob)
    })

    const content = await zip.generateAsync({ type: 'blob' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(content)
    link.download = `avttr_compressed_images_${Date.now()}.zip`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)

    toast.success('ZIP Downloaded', `All ${items.value.length} compressed files archived`)
  } catch (err: any) {
    toast.error('ZIP Failed', err.message || 'Failed to generate ZIP archive')
  } finally {
    isZipping.value = false
  }
}

const handleContainerMouseMove = (e: MouseEvent) => {
  if (!isInteractingSlider.value || !compareContainerRef.value) return
  const rect = compareContainerRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
  comparisonSliderPos.value = Math.round(percentage)
}

const handleContainerTouchMove = (e: TouchEvent) => {
  if (!compareContainerRef.value || e.touches.length === 0) return
  const rect = compareContainerRef.value.getBoundingClientRect()
  const x = e.touches[0].clientX - rect.left
  const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
  comparisonSliderPos.value = Math.round(percentage)
}
</script>

<template>
  <div class="space-y-6 pb-12 w-full">
    <!-- Header & Breadcrumbs (Standard Design Mandate) -->
    <div class="flex items-center gap-2 text-xs font-mono text-[var(--text-tertiary)]">
      <NuxtLink to="/" class="hover:text-[var(--text-primary)] transition-colors">Dashboard</NuxtLink>
      <span>/</span>
      <span>Image & Design</span>
      <span>/</span>
      <span class="text-[var(--text-primary)]">{{ t.tools['image-compressor']?.title || 'Image Compressor' }}</span>
    </div>

    <!-- Title Header Row -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          {{ t.tools['image-compressor']?.title || 'Image Compressor' }}
        </h1>
        <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
          {{ t.tools['image-compressor']?.description || 'Smart visually-lossless compression without losing original resolution or clarity.' }}
        </p>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <Button
          variant="secondary"
          size="default"
          class="h-9 px-3.5 rounded-lg text-xs font-medium cursor-pointer"
          title="Paste from clipboard (Ctrl+V)"
          @click="handlePasteImage"
        >
          <Clipboard class="w-3.5 h-3.5 mr-1.5 text-[var(--text-secondary)]" />
          <span>{{ locale === 'id' ? 'Tempel' : 'Paste' }}</span>
          <kbd class="hidden sm:inline-block ml-1 px-1 py-0.2 bg-zinc-100 dark:bg-white/10 rounded text-[10px] font-mono">Ctrl+V</kbd>
        </Button>

        <Button
          v-if="items.length > 0"
          variant="secondary"
          size="default"
          class="h-9 px-3.5 rounded-lg text-xs font-medium cursor-pointer"
          @click="fileInputRef?.click()"
        >
          <Plus class="w-3.5 h-3.5 mr-1.5 text-[var(--text-secondary)]" />
          <span>{{ t.addImages }}</span>
        </Button>
      </div>
    </div>

    <!-- Hidden native file input -->
    <input
      ref="fileInputRef"
      type="file"
      multiple
      accept="image/*,.svg"
      class="hidden"
      @change="onFileInputChange"
    />

    <!-- STATE 1: Empty Upload & URL Input Workspace -->
    <div v-if="items.length === 0" class="space-y-4">
      <!-- Reusable Mode Switcher (Gaya Foto 2) -->
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="inline-flex p-1 bg-zinc-100 dark:bg-[#1A1A1A] rounded-xl border border-zinc-200 dark:border-[#2E2E2E]">
          <button
            type="button"
            class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
            :class="inputSource === 'upload' ? 'bg-white dark:bg-[#2E2E2E] text-zinc-900 dark:text-white shadow-xs font-semibold' : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'"
            @click="inputSource = 'upload'"
          >
            <Upload class="w-3.5 h-3.5" />
            <span>{{ locale === 'id' ? 'Upload Berkas' : 'Upload Files' }}</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
            :class="inputSource === 'url' ? 'bg-white dark:bg-[#2E2E2E] text-zinc-900 dark:text-white shadow-xs font-semibold' : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'"
            @click="inputSource = 'url'"
          >
            <Globe class="w-3.5 h-3.5" />
            <span>{{ locale === 'id' ? 'Tautan Gambar (URL)' : 'Image URL' }}</span>
          </button>
        </div>

        <span class="text-xs text-[var(--text-tertiary)] font-mono">
          Maks. 5 gambar per sesi
        </span>
      </div>

      <!-- Mode A: Standalone Dashed Dropzone (DESIGN.md Section 10) -->
      <div
        v-if="inputSource === 'upload'"
        class="relative border-2 border-dashed rounded-[14px] p-8 sm:p-14 text-center transition-all cursor-pointer select-none border-zinc-300 dark:border-[#2E2E2E] bg-zinc-50/50 dark:bg-[#141416] hover:border-zinc-400 dark:hover:border-[#3E3E3E]"
        :class="isDragging ? 'border-zinc-900 bg-zinc-100 dark:border-white dark:bg-[var(--bg-card-hover)]' : ''"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="onDrop"
        @click="fileInputRef?.click()"
      >
        <div class="max-w-md mx-auto space-y-3">
          <div class="w-12 h-12 mx-auto rounded-xl bg-white dark:bg-[#212121] border border-zinc-200 dark:border-[#2E2E2E] flex items-center justify-center text-zinc-900 dark:text-white shadow-xs">
            <FileImage class="w-6 h-6 text-zinc-900 dark:text-white" />
          </div>

          <div>
            <h3 class="text-sm font-semibold text-[var(--text-primary)]">
              {{ t.dropzoneBrowse }}
            </h3>
            <p class="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
              {{ t.dropzoneImageDesc }}
            </p>
          </div>
        </div>
      </div>

      <!-- Mode B: Standalone URL Omnibar (DESIGN.md Section 11 Standard) -->
      <div v-else class="space-y-3">
        <form @submit.prevent="fetchImageFromUrl" class="flex flex-col sm:flex-row items-center gap-2.5 w-full">
          <div class="relative w-full flex-1 flex items-center">
            <div class="absolute left-3.5 flex items-center justify-center pointer-events-none text-[var(--text-tertiary)]">
              <Globe class="w-4 h-4" />
            </div>
            <input
              id="compress-image-url-input"
              v-model="imageUrlInput"
              type="url"
              placeholder="https://example.com/photo.jpg atau tempel tautan gambar..."
              class="w-full h-12 pl-10 pr-20 bg-white dark:bg-[#171717] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] border border-zinc-200 dark:border-[#2E2E2E] focus:border-zinc-400 dark:focus:border-white/40 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 disabled:opacity-50 shadow-xs font-mono"
              :disabled="isFetchingUrl"
              @keydown.enter="fetchImageFromUrl"
            />
            <div class="absolute right-2.5 flex items-center gap-1">
              <button
                v-if="imageUrlInput"
                type="button"
                title="Clear input"
                aria-label="Clear input"
                class="p-1.5 text-zinc-400 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-95"
                @click="imageUrlInput = ''"
              >
                <X class="w-4 h-4" />
              </button>
              <button
                type="button"
                title="Paste from clipboard"
                aria-label="Paste from clipboard"
                class="p-1.5 text-zinc-400 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-95"
                @click="handlePasteUrl"
              >
                <Clipboard class="w-4 h-4" />
              </button>
            </div>
          </div>

          <Button
            id="btn-fetch-compress"
            variant="primary"
            size="default"
            class="w-full sm:w-auto shrink-0 h-12 px-5 rounded-xl font-medium text-xs sm:text-sm cursor-pointer"
            :loading="isFetchingUrl"
            :disabled="!imageUrlInput.trim() || isFetchingUrl"
            @click="fetchImageFromUrl"
          >
            <ArrowRight v-if="!isFetchingUrl" class="w-4 h-4 mr-1.5" />
            <span>{{ isFetchingUrl ? 'Mengambil...' : (locale === 'id' ? 'Ambil & Kompres' : 'Fetch & Compress') }}</span>
          </Button>
        </form>

        <p class="text-[11px] text-[var(--text-tertiary)] px-1">
          {{ locale === 'id' ? 'Mendukung tautan gambar langsung PNG, JPG, WebP, SVG, AVIF. 100% diproses di browser Canvas.' : 'Supports PNG, JPG, WebP, SVG, AVIF direct URLs. 100% client-side processed via browser Canvas.' }}
        </p>
      </div>
    </div>

    <!-- STATE 2: Active Compression Workspace (Clean Unboxed Layout + Inline Compare) -->
    <div v-else class="space-y-6">
      <!-- Top Settings & Batch Ribbon (Unboxed Toolbar - No Nested Card Stack) -->
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-3.5 sm:p-4 rounded-[14px] bg-[var(--bg-card)] border border-[var(--border-card)]">
        <!-- Left: Compression Mode Switcher & Format -->
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-[var(--text-primary)]">Mode:</span>
            <!-- Reusable Segmented Control (Gaya Foto 2) -->
            <div class="inline-flex p-1 bg-zinc-100 dark:bg-[#1A1A1A] rounded-xl border border-zinc-200 dark:border-[#2E2E2E]">
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
                :class="quality === 92 ? 'bg-white dark:bg-[#2E2E2E] text-zinc-900 dark:text-white shadow-xs font-semibold' : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'"
                @click="quality = 92; reprocessAll()"
              >
                Smart Lossless
              </button>
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
                :class="quality === 85 ? 'bg-white dark:bg-[#2E2E2E] text-zinc-900 dark:text-white shadow-xs font-semibold' : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'"
                @click="quality = 85; reprocessAll()"
              >
                Recommended
              </button>
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
                :class="quality === 70 ? 'bg-white dark:bg-[#2E2E2E] text-zinc-900 dark:text-white shadow-xs font-semibold' : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'"
                @click="quality = 70; reprocessAll()"
              >
                Max Compression
              </button>
            </div>
          </div>

          <!-- Format Selector Dropdown -->
          <div class="flex items-center gap-1.5">
            <select
              v-model="outputFormat"
              @change="reprocessAll"
              class="h-9 px-3 bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-[#2E2E2E] text-[var(--text-primary)] rounded-xl text-xs font-medium focus:outline-none focus:border-zinc-400 dark:focus:border-white/40 transition-colors cursor-pointer"
            >
              <option value="auto">Auto (Smart WebP)</option>
              <option value="original">Original Format</option>
              <option value="webp">WebP (Smallest)</option>
              <option value="jpeg">JPEG / JPG</option>
              <option value="png">PNG (Lossless)</option>
            </select>
          </div>
        </div>

        <!-- Right: Summary Stats & Batch Actions -->
        <div class="flex items-center gap-3 justify-between lg:justify-end flex-wrap pt-2 lg:pt-0 border-t lg:border-t-0 border-[var(--border-subtle)]">
          <div class="text-xs font-mono text-[var(--text-secondary)]">
            <span class="font-semibold text-[var(--text-primary)]">{{ items.length }} Files</span>
            <span class="mx-1.5 text-[var(--text-tertiary)]">•</span>
            <span class="text-emerald-400 font-semibold">Saved {{ totalSavedPercent }}%</span>
            <span class="hidden sm:inline text-[var(--text-tertiary)] ml-1">({{ formatBytes(totalOriginalSize) }} → {{ formatBytes(totalCompressedSize) }})</span>
          </div>

          <div class="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              class="h-8 px-2.5 text-xs text-[var(--text-secondary)] hover:text-red-400"
              @click="clearAll"
            >
              <Trash2 class="w-3.5 h-3.5 mr-1" />
              <span>{{ t.clearAll }}</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              class="h-8 px-3 text-xs"
              :loading="isZipping"
              @click="downloadAllZip"
            >
              <Download class="w-3.5 h-3.5 mr-1.5" />
              <span>{{ t.downloadAllZip }}</span>
            </Button>
          </div>
        </div>
      </div>

      <!-- HERO INLINE COMPARE CANVAS (Langsung Tampil Tanpa Harus Klik Button Modal!) -->
      <div v-if="activeCompareItem" class="rounded-[14px] bg-[var(--bg-card)] border border-[var(--border-card)] p-4 sm:p-5 space-y-4 shadow-xs">
        <!-- Canvas Header: Meta, Badges, View Switcher & Single Save -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
          <!-- Left: Active Item Details -->
          <div class="min-w-0 space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="text-sm font-semibold text-[var(--text-primary)] truncate max-w-xs sm:max-w-md">
                {{ activeCompareItem.name }}
              </h3>
              <Badge variant="secondary" size="sm" class="font-mono text-emerald-400 font-bold">
                -{{ activeCompareItem.savedPercent }}%
              </Badge>
            </div>

            <div class="flex items-center gap-2 text-xs font-mono text-[var(--text-tertiary)] flex-wrap">
              <span v-if="activeCompareItem.width > 0">{{ activeCompareItem.width }} × {{ activeCompareItem.height }} px</span>
              <span v-if="activeCompareItem.width > 0">•</span>
              <span class="uppercase font-semibold text-[var(--text-secondary)]">{{ activeCompareItem.format }}</span>
              <span>•</span>
              <span class="line-through text-zinc-500">{{ formatBytes(activeCompareItem.originalSize) }}</span>
              <ArrowRight class="w-3 h-3 text-zinc-500 inline" />
              <span class="text-white font-bold">{{ formatBytes(activeCompareItem.compressedSize) }}</span>
              <span class="text-emerald-400 font-medium">(-{{ formatBytes(activeCompareItem.originalSize - activeCompareItem.compressedSize) }})</span>
            </div>
          </div>

          <!-- Right: View Switcher (Gaya Foto 2) & Quick Download -->
          <div class="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <div class="inline-flex p-1 bg-zinc-100 dark:bg-[#1A1A1A] rounded-xl border border-zinc-200 dark:border-[#2E2E2E]">
              <button
                type="button"
                class="px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer"
                :class="compareViewMode === 'slider' ? 'bg-white dark:bg-[#2E2E2E] text-zinc-900 dark:text-white shadow-xs font-semibold' : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'"
                @click="compareViewMode = 'slider'"
              >
                Split Slider
              </button>
              <button
                type="button"
                class="px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer"
                :class="compareViewMode === 'side-by-side' ? 'bg-white dark:bg-[#2E2E2E] text-zinc-900 dark:text-white shadow-xs font-semibold' : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'"
                @click="compareViewMode = 'side-by-side'"
              >
                Side-by-Side
              </button>
            </div>

            <Button
              variant="primary"
              size="sm"
              class="h-8 px-3 text-xs"
              @click="downloadItem(activeCompareItem)"
            >
              <Download class="w-3.5 h-3.5 mr-1" />
              <span>Save</span>
            </Button>
          </div>
        </div>

        <!-- Canvas Body (Responsive Split Slider vs Side-by-Side) -->
        <div>
          <!-- VIEW 1: Split Slider -->
          <div
            v-if="compareViewMode === 'slider'"
            ref="compareContainerRef"
            class="relative w-full h-[280px] xs:h-[340px] sm:h-[420px] md:h-[480px] bg-zinc-100 dark:bg-[#111113] rounded-xl overflow-hidden select-none border border-[var(--border-subtle)] flex items-center justify-center cursor-ew-resize"
            @mousedown="isInteractingSlider = true"
            @mousemove="handleContainerMouseMove"
            @touchstart="isInteractingSlider = true"
            @touchmove="handleContainerTouchMove"
          >
            <!-- Background Image: Compressed Image -->
            <img
              :src="activeCompareItem.compressedUrl"
              :alt="activeCompareItem.name"
              class="absolute inset-0 w-full h-full object-contain pointer-events-none select-none p-2 sm:p-4"
            />

            <!-- Foreground Overlay: Original Image clipped by polygon -->
            <img
              :src="activeCompareItem.originalUrl"
              :alt="activeCompareItem.name"
              class="absolute inset-0 w-full h-full object-contain pointer-events-none select-none p-2 sm:p-4"
              :style="{
                clipPath: `polygon(0 0, ${comparisonSliderPos}% 0, ${comparisonSliderPos}% 100%, 0 100%)`,
              }"
            />

            <!-- Divider Line with Circular Draggable Handle -->
            <div
              class="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_12px_rgba(0,0,0,0.8)] z-10 pointer-events-none"
              :style="{ left: `${comparisonSliderPos}%` }"
            >
              <div class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white text-zinc-900 shadow-xl flex items-center justify-center text-xs font-bold font-mono border border-zinc-200">
                ↔
              </div>
            </div>

            <!-- Floating Original Pill Badge (Top Left) -->
            <div class="absolute top-3 left-3 px-2.5 sm:px-3 py-1 rounded-full bg-white/90 dark:bg-[#1E1E1E]/90 backdrop-blur-md text-[11px] font-medium text-[var(--text-primary)] border border-zinc-200 dark:border-[#2E2E2E] z-20 shadow-xs flex items-center gap-1.5">
              <span>Original ({{ formatBytes(activeCompareItem.originalSize) }})</span>
            </div>

            <!-- Floating Compressed Pill Badge (Top Right) -->
            <div class="absolute top-3 right-3 px-2.5 sm:px-3 py-1 rounded-full bg-white/90 dark:bg-[#1E1E1E]/90 backdrop-blur-md text-[11px] font-medium text-[var(--text-primary)] border border-zinc-200 dark:border-[#2E2E2E] z-20 shadow-xs flex items-center gap-1.5">
              <span>Compressed ({{ formatBytes(activeCompareItem.compressedSize) }})</span>
            </div>

            <!-- Hint Bottom Overlay -->
            <div class="absolute bottom-3 inset-x-0 flex justify-center z-20 pointer-events-none">
              <span class="px-3 py-1 rounded-full bg-black/75 backdrop-blur-md text-[10px] sm:text-[11px] font-mono text-[var(--text-secondary)] border border-white/10">
                {{ locale === 'id' ? 'Geser slider untuk membandingkan piksel' : 'Drag slider to compare pixels' }}
              </span>
            </div>
          </div>

          <!-- VIEW 2: Side-by-Side View -->
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs font-mono text-[var(--text-secondary)] px-1">
                <span class="font-semibold text-[var(--text-primary)]">Original</span>
                <span>{{ formatBytes(activeCompareItem.originalSize) }}</span>
              </div>
              <div class="h-[220px] sm:h-[380px] bg-zinc-100 dark:bg-[#111113] rounded-xl overflow-hidden border border-[var(--border-subtle)] flex items-center justify-center p-3">
                <img :src="activeCompareItem.originalUrl" :alt="activeCompareItem.name" class="max-w-full max-h-full object-contain" />
              </div>
            </div>

            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs font-mono text-[var(--text-primary)] px-1">
                <span class="font-semibold">Compressed ({{ activeCompareItem.format.toUpperCase() }})</span>
                <span class="text-emerald-400 font-bold">{{ formatBytes(activeCompareItem.compressedSize) }}</span>
              </div>
              <div class="h-[220px] sm:h-[380px] bg-zinc-100 dark:bg-[#111113] rounded-xl overflow-hidden border border-[var(--border-subtle)] flex items-center justify-center p-3">
                <img :src="activeCompareItem.compressedUrl" :alt="activeCompareItem.name" class="max-w-full max-h-full object-contain" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Image Queue Strip (List Gambar dengan Thumbnail & Select) -->
      <div class="space-y-3">
        <div class="flex items-center justify-between text-xs text-[var(--text-tertiary)] font-mono">
          <span>{{ locale === 'id' ? 'ANTREAN BERKAS (KLIK UNTUK PRATINJAU)' : 'IMAGE QUEUE (CLICK TO PREVIEW)' }}</span>
          <span>{{ items.length }} / 5 {{ locale === 'id' ? 'Gambar' : 'Images' }}</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div
            v-for="item in items"
            :key="item.id"
            class="flex items-center justify-between gap-3 p-3 rounded-xl border transition-all cursor-pointer"
            :class="
              activeCompareItem?.id === item.id
                ? 'bg-zinc-100 dark:bg-[#252528] border-zinc-400 dark:border-white shadow-xs'
                : 'bg-[var(--bg-card)] border-[var(--border-card)] hover:border-[var(--border-card-hover)]'
            "
            @click="selectCompareItem(item)"
          >
            <!-- Thumbnail & Info -->
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-11 h-11 rounded-lg bg-black/60 border border-[var(--border-subtle)] overflow-hidden shrink-0 flex items-center justify-center">
                <img :src="item.compressedUrl" :alt="item.name" class="w-full h-full object-cover" />
              </div>
              <div class="min-w-0">
                <div class="text-xs font-medium text-[var(--text-primary)] truncate max-w-[140px] sm:max-w-[160px]">
                  {{ item.name }}
                </div>
                <div class="flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-tertiary)] mt-0.5">
                  <span class="text-white font-semibold">{{ formatBytes(item.compressedSize) }}</span>
                  <span class="text-emerald-400 font-bold">-{{ item.savedPercent }}%</span>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-1 shrink-0" @click.stop>
              <button
                type="button"
                title="Download single file"
                class="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
                @click="downloadItem(item)"
              >
                <Download class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Remove item"
                class="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
                @click="removeItem(item.id)"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
