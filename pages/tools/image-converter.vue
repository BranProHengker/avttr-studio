<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'
import {
  Upload,
  Download,
  Trash as Trash2,
  Refresh as RefreshCw,
  MediaImage as FileImage,
  ArrowRight,
  Archive,
  PasteClipboard as Clipboard,
  Globe,
  Plus,
  Eye,
  Check,
} from '@iconoir/vue'
import { useToast } from '~/composables/useToast'
import { useI18n } from '~/composables/useI18n'
import Button from '~/components/ui/Button.vue'
import UrlOmnibar from '~/components/ui/UrlOmnibar.vue'
import MinimalLoader from '~/components/ui/MinimalLoader.vue'
import Modal from '~/components/ui/Modal.vue'

export type ImageTargetFormat = 'webp' | 'png' | 'jpg' | 'jpeg' | 'avif' | 'ico' | 'svg' | 'pdf' | 'gif' | 'bmp'

interface ConvertedFileItem {
  id: string
  file: File
  name: string
  originalSize: number
  originalUrl: string
  targetFormat: ImageTargetFormat
  quality: number
  icoSize?: number
  convertedBlob: Blob | null
  convertedUrl: string | null
  convertedSize: number | null
  status: 'idle' | 'converting' | 'done' | 'error'
  error?: string
}

const toast = useToast()
const { t, locale } = useI18n()

const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

const items = ref<ConvertedFileItem[]>([])
const globalTargetFormat = ref<ImageTargetFormat>('webp')
const globalQuality = ref(90)
const globalIcoSize = ref(64)
const isConvertingAll = ref(false)

// Input Source Switcher State (Upload vs URL)
const inputSource = ref<'upload' | 'url'>('upload')
const imageUrlInput = ref('')
const isFetchingUrl = ref(false)

// Preview Modal State
const previewModalItem = ref<ConvertedFileItem | null>(null)

const formatOptions = [
  { id: 'webp', label: 'WebP', desc: 'Modern web image (.webp)' },
  { id: 'png', label: 'PNG', desc: 'Lossless transparency (.png)' },
  { id: 'jpg', label: 'JPG', desc: 'Universal photograph standard (.jpg)' },
  { id: 'jpeg', label: 'JPEG', desc: 'Universal photograph standard (.jpeg)' },
  { id: 'avif', label: 'AVIF', desc: 'Next-gen high compression (.avif)' },
  { id: 'ico', label: 'ICO', desc: 'Website Favicon icon (.ico)' },
  { id: 'svg', label: 'SVG', desc: 'Vector XML container (.svg)' },
  { id: 'pdf', label: 'PDF', desc: 'Document PDF format (.pdf)' },
  { id: 'gif', label: 'GIF', desc: 'Graphics Interchange Format (.gif)' },
  { id: 'bmp', label: 'BMP', desc: 'Uncompressed raw bitmap (.bmp)' },
] as const

const icoSizes = [16, 32, 48, 64, 128, 256]

const totalOriginalSize = computed(() =>
  items.value.reduce((acc, item) => acc + item.originalSize, 0)
)
const totalConvertedSize = computed(() =>
  items.value.reduce((acc, item) => acc + (item.convertedSize || item.originalSize), 0)
)

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const handleFileSelect = (e: Event) => {
  const files = (e.target as HTMLInputElement).files
  if (!files) return
  addFiles(Array.from(files))
}

const handleDrop = (e: DragEvent) => {
  const files = e.dataTransfer?.files
  if (!files) return
  addFiles(Array.from(files))
}

const addFiles = (files: File[]) => {
  const validFiles = files.filter((f) => f.type.startsWith('image/') || f.name.match(/\.(webp|png|jpe?g|avif|ico|svg|gif|bmp)$/i))
  if (validFiles.length === 0) {
    toast.error(
      locale.value === 'id' ? 'Berkas Tidak Valid' : 'Invalid Files',
      locale.value === 'id' ? 'Silakan pilih berkas gambar yang valid' : 'Please select valid image files'
    )
    return
  }

  if (items.value.length + validFiles.length > 10) {
    toast.warning(
      locale.value === 'id' ? 'Batas Berkas' : 'File Limit',
      locale.value === 'id' ? 'Maksimal 10 berkas per sesi' : 'Maximum 10 files per batch'
    )
  }

  const remainingSlots = 10 - items.value.length
  const filesToAdd = validFiles.slice(0, remainingSlots)

  filesToAdd.forEach((file) => {
    const item: ConvertedFileItem = {
      id: Math.random().toString(36).substring(2, 9),
      file,
      name: file.name,
      originalSize: file.size,
      originalUrl: URL.createObjectURL(file),
      targetFormat: globalTargetFormat.value,
      quality: globalQuality.value,
      icoSize: globalIcoSize.value,
      convertedBlob: null,
      convertedUrl: null,
      convertedSize: null,
      status: 'idle',
    }
    items.value.push(item)
  })

  // Trigger conversion immediately
  convertAll()
}

// Convert Single Image via Canvas / PDF / SVG
const convertItem = async (item: ConvertedFileItem): Promise<void> => {
  item.status = 'converting'

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = async () => {
      try {
        const targetWidth = item.targetFormat === 'ico' ? (item.icoSize || 64) : img.naturalWidth
        const targetHeight = item.targetFormat === 'ico' ? (item.icoSize || 64) : img.naturalHeight

        // 1. PDF Conversion via pdf-lib
        if (item.targetFormat === 'pdf') {
          const pdfDoc = await PDFDocument.create()
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0)
          const pngDataUrl = canvas.toDataURL('image/png')
          const pngBytes = await (await fetch(pngDataUrl)).arrayBuffer()
          const embeddedImage = await pdfDoc.embedPng(pngBytes)
          const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height])
          page.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width: embeddedImage.width,
            height: embeddedImage.height,
          })
          const pdfBytes = await pdfDoc.save()
          const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
          item.convertedBlob = blob
          item.convertedUrl = URL.createObjectURL(blob)
          item.convertedSize = blob.size
          item.status = 'done'
          resolve()
          return
        }

        // 2. SVG Container Conversion
        if (item.targetFormat === 'svg') {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0)
          const pngDataUrl = canvas.toDataURL('image/png')
          const svgContent = `<svg width="${img.naturalWidth}" height="${img.naturalHeight}" viewBox="0 0 ${img.naturalWidth} ${img.naturalHeight}" xmlns="http://www.w3.org/2000/svg">
  <image href="${pngDataUrl}" width="${img.naturalWidth}" height="${img.naturalHeight}"/>
</svg>`
          const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
          item.convertedBlob = blob
          item.convertedUrl = URL.createObjectURL(blob)
          item.convertedSize = blob.size
          item.status = 'done'
          resolve()
          return
        }

        // 3. Raster Image Formats via Canvas
        const canvas = document.createElement('canvas')
        canvas.width = targetWidth
        canvas.height = targetHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas context failure')

        // JPEG / JPG background white fill to prevent black background on transparent images
        if (item.targetFormat === 'jpeg' || item.targetFormat === 'jpg') {
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, targetWidth, targetHeight)
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

        let mime = 'image/png'
        if (item.targetFormat === 'webp') mime = 'image/webp'
        else if (item.targetFormat === 'jpeg' || item.targetFormat === 'jpg') mime = 'image/jpeg'
        else if (item.targetFormat === 'avif') mime = 'image/avif'
        else if (item.targetFormat === 'ico') mime = 'image/x-icon'
        else if (item.targetFormat === 'gif') mime = 'image/gif'
        else if (item.targetFormat === 'bmp') mime = 'image/bmp'

        const qualityVal = (item.targetFormat === 'png' || item.targetFormat === 'bmp' || item.targetFormat === 'ico') ? 1 : item.quality / 100

        canvas.toBlob(
          (blob) => {
            if (blob) {
              item.convertedBlob = blob
              item.convertedUrl = URL.createObjectURL(blob)
              item.convertedSize = blob.size
              item.status = 'done'
            } else {
              canvas.toBlob((fallbackBlob) => {
                if (fallbackBlob) {
                  item.convertedBlob = fallbackBlob
                  item.convertedUrl = URL.createObjectURL(fallbackBlob)
                  item.convertedSize = fallbackBlob.size
                  item.status = 'done'
                } else {
                  item.status = 'error'
                  item.error = 'Blob conversion failed'
                }
                resolve()
              }, 'image/png')
              return
            }
            resolve()
          },
          mime,
          qualityVal
        )
      } catch (err: any) {
        item.status = 'error'
        item.error = err.message || 'Conversion error'
        resolve()
      }
    }

    img.onerror = () => {
      item.status = 'error'
      item.error = 'Failed to load source image'
      resolve()
    }

    img.src = item.originalUrl
  })
}

// Convert All Items
const convertAll = async () => {
  isConvertingAll.value = true
  for (const item of items.value) {
    item.targetFormat = globalTargetFormat.value
    item.quality = globalQuality.value
    item.icoSize = globalIcoSize.value
    await convertItem(item)
  }
  isConvertingAll.value = false
  toast.success(
    locale.value === 'id' ? 'Konversi Selesai' : 'Conversion Complete',
    locale.value === 'id' ? 'Semua gambar berhasil dikonversi' : 'All images converted'
  )
}

// Fetch Image from Direct URL (supports parity with Image Compressor)
const fetchImageFromUrl = async (urlToFetch?: string) => {
  const target = (typeof urlToFetch === 'string' ? urlToFetch : imageUrlInput.value).trim()
  if (!target) return

  isFetchingUrl.value = true
  try {
    const res = await fetch(`/api/download/proxy?url=${encodeURIComponent(target)}`)
    if (!res.ok) throw new Error('Failed to fetch image')
    const blob = await res.blob()
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
    addFiles([file])
    imageUrlInput.value = ''
    toast.success(
      locale.value === 'id' ? 'Gambar Diambil' : 'Image Loaded',
      locale.value === 'id' ? 'Gambar berhasil diambil dan dikonversi' : 'Image loaded and converted successfully'
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

// Paste from Clipboard helper
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
      addFiles(files)
    } else {
      toast.warning(
        locale.value === 'id' ? 'Tidak Ada Gambar' : 'No Image Found',
        locale.value === 'id' ? 'Clipboard tidak memuat gambar. Salin gambar terlebih dahulu.' : 'No image found in clipboard.'
      )
    }
  } catch {
    toast.error(
      locale.value === 'id' ? 'Izin Ditolak' : 'Permission Denied',
      locale.value === 'id' ? 'Tekan Ctrl+V langsung pada halaman untuk menempel gambar' : 'Press Ctrl+V directly on the page to paste image'
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
    addFiles(files)
  }
}

onMounted(() => {
  window.addEventListener('paste', handleGlobalPaste)
})

onUnmounted(() => {
  window.removeEventListener('paste', handleGlobalPaste)
})

// Download Single File
const downloadSingle = (item: ConvertedFileItem) => {
  if (!item.convertedUrl) return
  const baseName = item.name.replace(/\.[^/.]+$/, '')
  const ext = item.targetFormat
  const link = document.createElement('a')
  link.href = item.convertedUrl
  link.download = `${baseName}.${ext}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  toast.success(
    locale.value === 'id' ? 'Berhasil Diunduh' : 'Downloaded',
    `${baseName}.${ext}`
  )
}

// Download All as ZIP Archive
const downloadZip = async () => {
  const readyItems = items.value.filter((i) => i.convertedBlob)
  if (readyItems.length === 0) return

  const zip = new JSZip()
  readyItems.forEach((item, idx) => {
    const baseName = item.name.replace(/\.[^/.]+$/, '')
    const ext = item.targetFormat
    if (item.convertedBlob) {
      zip.file(`${String(idx + 1).padStart(2, '0')}_${baseName}.${ext}`, item.convertedBlob)
    }
  })

  const content = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(content)
  const link = document.createElement('a')
  link.href = url
  link.download = `avttr_converted_images_${Date.now()}.zip`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  toast.success(
    locale.value === 'id' ? 'Unduh ZIP Berhasil' : 'Downloaded ZIP',
    locale.value === 'id' ? 'Semua gambar berhasil diarsipkan' : 'Archive downloaded successfully'
  )
}

// Remove single item
const removeItem = (id: string) => {
  const item = items.value.find((i) => i.id === id)
  if (item) {
    URL.revokeObjectURL(item.originalUrl)
    if (item.convertedUrl) URL.revokeObjectURL(item.convertedUrl)
  }
  items.value = items.value.filter((i) => i.id !== id)
}

// Clear all
const clearAll = () => {
  items.value.forEach((item) => {
    URL.revokeObjectURL(item.originalUrl)
    if (item.convertedUrl) URL.revokeObjectURL(item.convertedUrl)
  })
  items.value = []
  toast.info(
    locale.value === 'id' ? 'Dibersihkan' : 'Cleared',
    locale.value === 'id' ? 'Semua gambar dihapus' : 'All items removed'
  )
}

// Preview Item Modal Trigger
const previewItem = (item: ConvertedFileItem) => {
  previewModalItem.value = item
}
</script>

<template>
  <div class="space-y-6 pb-12 w-full">
    <!-- Header Section (Clean Mandate - No Decorative Marketing Badges) -->
    <div class="space-y-2">
      <div class="flex items-center gap-2 text-xs text-[var(--text-tertiary)] font-mono">
        <NuxtLink to="/" class="hover:text-[var(--text-primary)] transition-colors">Dashboard</NuxtLink>
        <span>/</span>
        <span class="text-[var(--text-secondary)] font-medium">Image & Design</span>
        <span>/</span>
        <span class="text-[var(--text-primary)]">{{ t.tools['image-converter']?.title || 'Image Format Converter' }}</span>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            {{ t.tools['image-converter']?.title || 'Image Format Converter' }}
          </h1>
          <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            {{ t.tools['image-converter']?.description || 'Convert WebP, PNG, JPG, JPEG, AVIF, ICO Favicon, SVG, PDF, GIF, and BMP in batch with instant ZIP export.' }}
          </p>
        </div>

        <!-- Header Actions: Paste & Add Images -->
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
            <span>{{ locale === 'id' ? 'Tambah Gambar' : 'Add Images' }}</span>
          </Button>
        </div>
      </div>
    </div>

    <!-- Hidden native file input -->
    <input
      ref="fileInputRef"
      type="file"
      multiple
      accept="image/*,.svg"
      class="hidden"
      @change="handleFileSelect"
    />

    <!-- STATE 1: Empty Upload Workspace (Dropzone & URL Omnibar) -->
    <div v-if="items.length === 0" class="space-y-4">
      <!-- Reusable Mode Switcher (Upload vs URL) -->
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
          {{ locale === 'id' ? 'Maks. 10 gambar per sesi' : 'Max 10 images per batch' }}
        </span>
      </div>

      <!-- Mode A: Standalone Dashed Dropzone (DESIGN.md Section 10) -->
      <div
        v-if="inputSource === 'upload'"
        class="relative border-2 border-dashed rounded-[14px] p-8 sm:p-14 text-center transition-all cursor-pointer select-none border-zinc-300 dark:border-[#2E2E2E] bg-zinc-50/50 dark:bg-[#141416] hover:border-zinc-400 dark:hover:border-[#3E3E3E]"
        :class="isDragging ? 'border-zinc-900 bg-zinc-100 dark:border-white dark:bg-[var(--bg-card-hover)]' : ''"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="(e) => { isDragging = false; handleDrop(e) }"
        @click="fileInputRef?.click()"
      >
        <div class="max-w-md mx-auto space-y-3">
          <div class="w-12 h-12 mx-auto rounded-xl bg-white dark:bg-[#212121] border border-zinc-200 dark:border-[#2E2E2E] flex items-center justify-center text-zinc-900 dark:text-white shadow-xs">
            <FileImage class="w-6 h-6 text-zinc-900 dark:text-white" />
          </div>
          <div>
            <h3 class="text-sm font-semibold text-[var(--text-primary)]">
              {{ locale === 'id' ? 'Tarik & letakkan gambar di sini atau telusuri' : 'Drop your images here or browse' }}
            </h3>
            <p class="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
              {{ locale === 'id' ? 'Mendukung WebP, PNG, JPG, JPEG, AVIF, ICO, SVG, PDF, GIF, BMP. 100% diproses di browser.' : 'Supports WebP, PNG, JPG, JPEG, AVIF, ICO, SVG, PDF, GIF, BMP. 100% processed client-side.' }}
            </p>
          </div>
        </div>
      </div>

      <!-- Mode B: Standalone URL Omnibar -->
      <div v-else class="space-y-3">
        <UrlOmnibar
          id="convert-image-url-input"
          v-model="imageUrlInput"
          :loading="isFetchingUrl"
          storage-key="avttr_converter_url_history"
          placeholder="https://example.com/photo.jpg atau tempel tautan gambar..."
          :submit-text="isFetchingUrl ? (locale === 'id' ? 'Mengambil...' : 'Fetching...') : (locale === 'id' ? 'Ambil & Konversi' : 'Fetch & Convert')"
          :submit-icon="ArrowRight"
          @submit="fetchImageFromUrl"
          @clear="imageUrlInput = ''"
        />

        <MinimalLoader
          v-if="isFetchingUrl"
          :text="locale === 'id' ? 'Mengunduh & Menyiapkan Gambar...' : 'Downloading & Mounting Image...'"
          :subtext="locale === 'id' ? 'Mengambil stream media dan menyiapkan canvas konversi...' : 'Fetching media stream and mounting to conversion canvas...'"
        />

        <p v-else class="text-[11px] text-[var(--text-tertiary)] px-1">
          {{ locale === 'id' ? 'Mendukung tautan langsung gambar publik. 100% diproses langsung di peramban.' : 'Supports public direct image links. 100% processed directly in browser.' }}
        </p>
      </div>
    </div>

    <!-- STATE 2: Active Conversion Dashboard (Unboxed Toolbar + Modern Grid/Cards) -->
    <div v-else class="space-y-5">
      <!-- Top Target Format Settings Bar (Unboxed Toolbar - Matching Image Compressor) -->
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-3.5 sm:p-4 rounded-[14px] bg-[var(--bg-card)] border border-[var(--border-card)]">
        <!-- Left: Target Output Format & Quick Tuning -->
        <div class="flex flex-wrap items-center gap-3">
          <!-- Target Format Selector Dropdown -->
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-[var(--text-primary)]">Format:</span>
            <select
              v-model="globalTargetFormat"
              class="h-9 px-3 bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-[#2E2E2E] text-[var(--text-primary)] rounded-xl text-xs font-medium focus:outline-none focus:border-zinc-400 dark:focus:border-white/40 transition-colors cursor-pointer"
              @change="convertAll"
            >
              <option v-for="fmt in formatOptions" :key="fmt.id" :value="fmt.id">
                {{ fmt.label }} ({{ fmt.desc }})
              </option>
            </select>
          </div>

          <!-- Quality Tuner (Active for lossy webp, jpg, jpeg, avif) -->
          <div v-if="['webp', 'jpg', 'jpeg', 'avif'].includes(globalTargetFormat)" class="flex items-center gap-2">
            <span class="text-xs font-semibold text-[var(--text-primary)]">Quality:</span>
            <div class="inline-flex p-1 bg-zinc-100 dark:bg-[#1A1A1A] rounded-xl border border-zinc-200 dark:border-[#2E2E2E]">
              <button
                type="button"
                class="px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer"
                :class="globalQuality === 95 ? 'bg-white dark:bg-[#2E2E2E] text-zinc-900 dark:text-white shadow-xs font-semibold' : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'"
                @click="globalQuality = 95; convertAll()"
              >
                Max (95%)
              </button>
              <button
                type="button"
                class="px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer"
                :class="globalQuality === 85 ? 'bg-white dark:bg-[#2E2E2E] text-zinc-900 dark:text-white shadow-xs font-semibold' : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'"
                @click="globalQuality = 85; convertAll()"
              >
                Balanced (85%)
              </button>
              <button
                type="button"
                class="px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer"
                :class="globalQuality === 70 ? 'bg-white dark:bg-[#2E2E2E] text-zinc-900 dark:text-white shadow-xs font-semibold' : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'"
                @click="globalQuality = 70; convertAll()"
              >
                Compact (70%)
              </button>
            </div>
          </div>

          <!-- ICO Favicon Dimension Selector -->
          <div v-if="globalTargetFormat === 'ico'" class="flex items-center gap-2">
            <span class="text-xs font-semibold text-[var(--text-primary)]">Favicon Size:</span>
            <select
              v-model.number="globalIcoSize"
              class="h-9 px-3 bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-[#2E2E2E] text-[var(--text-primary)] rounded-xl text-xs font-medium focus:outline-none focus:border-zinc-400 dark:focus:border-white/40 transition-colors cursor-pointer"
              @change="convertAll"
            >
              <option v-for="sz in icoSizes" :key="sz" :value="sz">{{ sz }}x{{ sz }} px</option>
            </select>
          </div>
        </div>

        <!-- Right: Summary Stats & Global Actions -->
        <div class="flex items-center gap-3 justify-between lg:justify-end flex-wrap pt-2 lg:pt-0 border-t lg:border-t-0 border-[var(--border-subtle)]">
          <div class="text-xs font-mono text-[var(--text-secondary)]">
            <span class="font-semibold text-[var(--text-primary)]">{{ items.length }} Files</span>
            <span class="mx-1.5 text-[var(--text-tertiary)]">•</span>
            <span class="text-[var(--text-tertiary)]">{{ formatBytes(totalOriginalSize) }} → {{ formatBytes(totalConvertedSize) }}</span>
          </div>

          <div class="flex items-center gap-2">
            <Button
              variant="primary"
              size="default"
              class="h-9 px-3.5 rounded-lg text-xs font-semibold cursor-pointer"
              @click="downloadZip"
            >
              <Archive class="w-3.5 h-3.5 mr-1.5" />
              <span>{{ locale === 'id' ? 'Unduh Semua (ZIP)' : 'Download All (ZIP)' }}</span>
            </Button>

            <Button
              variant="ghost"
              size="default"
              class="h-9 w-9 p-0 text-[var(--text-tertiary)] hover:text-red-400 rounded-lg cursor-pointer"
              :title="locale === 'id' ? 'Hapus Semua' : 'Clear All'"
              @click="clearAll"
            >
              <Trash2 class="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <!-- Conversion Items List -->
      <div class="space-y-3">
        <div
          v-for="item in items"
          :key="item.id"
          class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[14px] flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-[var(--border-card-hover)]"
        >
          <!-- Left: Thumbnail & Name -->
          <div class="flex items-center gap-3 min-w-0">
            <!-- Thumbnail with preview trigger and subtle transparency grid -->
            <div
              class="w-14 h-14 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 overflow-hidden shrink-0 flex items-center justify-center relative cursor-pointer group select-none"
              :title="locale === 'id' ? 'Klik untuk pratinjau' : 'Click to preview'"
              @click="previewItem(item)"
            >
              <img
                :src="item.convertedUrl || item.originalUrl"
                :alt="item.name"
                class="w-full h-full object-contain"
              />
              <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Eye class="w-4 h-4" />
              </div>
            </div>

            <div class="truncate">
              <div class="text-xs font-semibold text-[var(--text-primary)] truncate max-w-xs sm:max-w-md">
                {{ item.name }}
              </div>
              <div class="flex items-center gap-2 mt-1 text-[11px] font-mono text-[var(--text-tertiary)] flex-wrap">
                <span>{{ formatBytes(item.originalSize) }}</span>
                <ArrowRight class="w-3 h-3 text-[var(--text-tertiary)] shrink-0" />
                <span class="text-[var(--text-primary)] font-semibold uppercase px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-white/10 border border-zinc-200 dark:border-white/10">
                  {{ item.targetFormat }}
                </span>
                <span v-if="item.convertedSize" class="text-emerald-500 font-semibold">
                  {{ formatBytes(item.convertedSize) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Right: Individual Item Format Switcher & Action Button -->
          <div class="flex items-center gap-2 shrink-0">
            <!-- Individual Item Format Selector Override -->
            <select
              v-model="item.targetFormat"
              class="h-8 px-2 bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-[#2E2E2E] text-[var(--text-primary)] rounded-lg text-xs font-medium focus:outline-none focus:border-zinc-400 dark:focus:border-white/40 transition-colors cursor-pointer uppercase"
              @change="convertItem(item)"
            >
              <option v-for="fmt in formatOptions" :key="fmt.id" :value="fmt.id">
                {{ fmt.id.toUpperCase() }}
              </option>
            </select>

            <div v-if="item.status === 'converting'" class="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] px-2">
              <div class="w-3.5 h-3.5 border-2 border-zinc-400/20 dark:border-white/20 border-t-zinc-900 dark:border-t-white rounded-full animate-spin" />
              <span class="hidden sm:inline">Converting...</span>
            </div>

            <Button
              v-else-if="item.status === 'done'"
              size="sm"
              variant="secondary"
              class="h-8 px-3 rounded-lg text-xs font-medium cursor-pointer"
              @click="downloadSingle(item)"
            >
              <Download class="w-3.5 h-3.5 mr-1" />
              <span>Download</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              class="h-8 w-8 p-0 text-[var(--text-tertiary)] hover:text-red-400 rounded-lg cursor-pointer"
              :title="locale === 'id' ? 'Hapus' : 'Remove'"
              @click="removeItem(item.id)"
            >
              <Trash2 class="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Preview Modal Dialog -->
    <Modal
      :model-value="!!previewModalItem"
      :title="previewModalItem?.name || 'Preview'"
      max-width="2xl"
      @close="previewModalItem = null"
    >
      <div v-if="previewModalItem" class="space-y-4">
        <div class="max-h-[60vh] overflow-hidden rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-black/40 flex items-center justify-center p-4">
          <img
            :src="previewModalItem.convertedUrl || previewModalItem.originalUrl"
            :alt="previewModalItem.name"
            class="max-h-[50vh] max-w-full object-contain rounded-lg shadow-sm"
          />
        </div>
        <div class="flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
          <span>{{ formatBytes(previewModalItem.originalSize) }} → {{ formatBytes(previewModalItem.convertedSize || previewModalItem.originalSize) }} ({{ previewModalItem.targetFormat.toUpperCase() }})</span>
          <Button size="sm" variant="primary" class="cursor-pointer" @click="downloadSingle(previewModalItem)">
            <Download class="w-3.5 h-3.5 mr-1.5" />
            <span>Download</span>
          </Button>
        </div>
      </div>
    </Modal>
  </div>
</template>
