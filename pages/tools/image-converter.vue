<script setup lang="ts">
import { ref, computed } from 'vue'
import JSZip from 'jszip'
import { PDFDocument } from 'pdf-lib'
import {
  Upload,
  Download,
  Trash2,
  RefreshCw,
  Sliders,
  Check,
  FileImage,
  ArrowRight,
  Archive,
  Layers
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

export type ImageTargetFormat = 'webp' | 'png' | 'jpeg' | 'avif' | 'ico' | 'svg' | 'pdf' | 'gif' | 'bmp'

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

const items = ref<ConvertedFileItem[]>([])
const globalTargetFormat = ref<ImageTargetFormat>('webp')
const globalQuality = ref(90)
const globalIcoSize = ref(64)
const isConvertingAll = ref(false)

const formatOptions = [
  { id: 'webp', label: 'WebP', desc: 'Modern web image (small & crisp)' },
  { id: 'png', label: 'PNG', desc: 'Lossless with transparency' },
  { id: 'jpeg', label: 'JPG', desc: 'Universal photograph standard' },
  { id: 'avif', label: 'AVIF', desc: 'Next-gen format with superior compression' },
  { id: 'ico', label: 'ICO', desc: 'Website Favicon icon' },
  { id: 'svg', label: 'SVG', desc: 'Vector XML container' },
  { id: 'pdf', label: 'PDF', desc: 'Document PDF format' },
  { id: 'gif', label: 'GIF', desc: 'Graphics Interchange Format' },
  { id: 'bmp', label: 'BMP', desc: 'Uncompressed raw bitmap' },
] as const

const icoSizes = [16, 32, 48, 64, 128, 256]

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
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
  const validFiles = files.filter((f) => f.type.startsWith('image/'))
  if (validFiles.length === 0) {
    toast.error('Invalid Files', 'Please select image files')
    return
  }

  if (items.value.length + validFiles.length > 10) {
    toast.warning('File Limit', 'Maximum 10 files per batch')
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

  // Trigger conversion
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

        // JPEG background white fill
        if (item.targetFormat === 'jpeg') {
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, targetWidth, targetHeight)
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

        let mime = 'image/png'
        if (item.targetFormat === 'webp') mime = 'image/webp'
        else if (item.targetFormat === 'jpeg') mime = 'image/jpeg'
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
              // Fallback to PNG if browser doesn't support specific mime (e.g. AVIF on older engines)
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
  toast.success('Conversion Complete', 'All images converted')
}

// Download Single File
const downloadSingle = (item: ConvertedFileItem) => {
  if (!item.convertedUrl) return
  const baseName = item.name.replace(/\.[^/.]+$/, '')
  const ext = item.targetFormat === 'jpeg' ? 'jpg' : item.targetFormat
  const link = document.createElement('a')
  link.href = item.convertedUrl
  link.download = `${baseName}.${ext}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  toast.success('Downloaded', `${baseName}.${ext}`)
}

// Download All as ZIP Archive
const downloadZip = async () => {
  const readyItems = items.value.filter((i) => i.convertedBlob)
  if (readyItems.length === 0) return

  const zip = new JSZip()
  readyItems.forEach((item) => {
    const baseName = item.name.replace(/\.[^/.]+$/, '')
    const ext = item.targetFormat === 'jpeg' ? 'jpg' : item.targetFormat
    if (item.convertedBlob) {
      zip.file(`${baseName}.${ext}`, item.convertedBlob)
    }
  })

  const content = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(content)
  const link = document.createElement('a')
  link.href = url
  link.download = `converted_images_${Date.now()}.zip`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  toast.success('Downloaded ZIP', 'Archive downloaded successfully')
}

// Remove single item
const removeItem = (id: string) => {
  items.value = items.value.filter((i) => i.id !== id)
}

// Clear all
const clearAll = () => {
  items.value = []
  toast.info('Cleared', 'All items removed')
}
</script>

<template>
  <div class="space-y-6 pb-12 w-full">
    <!-- Header Section -->
    <div class="space-y-2">
      <div class="flex items-center gap-2 text-xs text-[var(--text-tertiary)] font-mono">
        <NuxtLink to="/" class="hover:text-[var(--text-primary)] transition-colors">Dashboard</NuxtLink>
        <span>/</span>
        <span class="text-[var(--text-secondary)] font-medium">Tools</span>
        <span>/</span>
        <span class="text-[var(--text-primary)]">Image Format Converter</span>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Image Format Converter
          </h1>
          <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Convert WebP, PNG, JPG, AVIF, ICO Favicon, SVG, PDF, GIF, and BMP in batch with instant ZIP export.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <Badge variant="secondary">
            Batch Support
          </Badge>
        </div>
      </div>
    </div>

    <!-- Empty Upload State -->
    <div v-if="items.length === 0">
      <Card :hoverable="false" class="p-8 sm:p-12 text-center">
        <label
          class="border-2 border-dashed border-[var(--border-card)] hover:border-white/40 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors group"
          @dragover.prevent
          @drop.prevent="handleDrop"
        >
          <div class="w-14 h-14 rounded-2xl bg-[var(--bg-input)] border border-[var(--border-subtle)] flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-xs">
            <FileImage class="w-6 h-6 text-white" />
          </div>

          <div class="space-y-1 mt-2">
            <div class="text-sm font-semibold text-white">
              Drop images here, or <span class="underline underline-offset-4">browse files</span>
            </div>
            <p class="text-xs text-[var(--text-tertiary)]">
              Convert WebP, PNG, JPG, AVIF, ICO, SVG, PDF, GIF, BMP (Max 10 files)
            </p>
          </div>

          <input type="file" multiple accept="image/*" class="hidden" @change="handleFileSelect" />
        </label>
      </Card>
    </div>

    <!-- Active Conversion Dashboard -->
    <div v-else class="space-y-5">
      <!-- Top Target Format Settings Bar -->
      <Card :hoverable="false" class="p-5 space-y-4">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <!-- Target Format Selector -->
          <div class="space-y-1.5">
            <label class="block text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
              Target Output Format
            </label>
            <div class="flex flex-wrap items-center gap-2">
              <button
                v-for="fmt in formatOptions"
                :key="fmt.id"
                type="button"
                class="px-4 py-2 text-xs font-medium rounded-lg border transition-all cursor-pointer"
                :class="
                  globalTargetFormat === fmt.id
                    ? 'bg-white text-black border-white font-bold shadow-xs'
                    : 'bg-[var(--bg-input)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-white'
                "
                @click="globalTargetFormat = fmt.id; convertAll()"
              >
                {{ fmt.label }}
              </button>
            </div>
          </div>

          <!-- ICO Dimension & Global Action Buttons -->
          <div class="flex items-center gap-4">
            <!-- ICO Dimension Selector -->
            <div v-if="globalTargetFormat === 'ico'" class="space-y-1">
              <label class="block text-xs text-[var(--text-secondary)]">Favicon Dimension</label>
              <select
                v-model.number="globalIcoSize"
                class="p-2 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg text-xs text-white focus:outline-none cursor-pointer"
                @change="convertAll"
              >
                <option v-for="sz in icoSizes" :key="sz" :value="sz">{{ sz }}x{{ sz }} px</option>
              </select>
            </div>

            <!-- Global Action Buttons -->
            <div class="flex items-center gap-2 pt-3 md:pt-0">
              <Button variant="primary" class="font-semibold text-xs" @click="downloadZip">
                <Archive class="w-3.5 h-3.5 mr-1.5" />
                Download All (ZIP)
              </Button>

              <Button variant="ghost" class="text-xs text-[var(--text-tertiary)] hover:text-red-400" @click="clearAll">
                <Trash2 class="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <!-- Conversion Items List -->
      <div class="space-y-3">
        <div
          v-for="item in items"
          :key="item.id"
          class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[14px] flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-[var(--border-card-hover)]"
        >
          <!-- Left: Thumbnail & Name -->
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-12 h-12 rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)] overflow-hidden shrink-0 flex items-center justify-center">
              <img :src="item.originalUrl" :alt="item.name" class="w-full h-full object-cover" />
            </div>

            <div class="truncate">
              <div class="text-xs font-semibold text-white truncate max-w-xs sm:max-w-md">
                {{ item.name }}
              </div>
              <div class="flex items-center gap-2 mt-1 text-[11px] font-mono text-[var(--text-tertiary)]">
                <span>{{ formatBytes(item.originalSize) }}</span>
                <ArrowRight class="w-3 h-3 text-[var(--text-tertiary)]" />
                <span class="text-white font-semibold uppercase">{{ item.targetFormat }}</span>
                <span v-if="item.convertedSize" class="text-green-400 font-semibold">
                  ({{ formatBytes(item.convertedSize) }})
                </span>
              </div>
            </div>
          </div>

          <!-- Right: Status & Action -->
          <div class="flex items-center gap-2 shrink-0">
            <div v-if="item.status === 'converting'" class="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <div class="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span>Converting...</span>
            </div>

            <Button
              v-else-if="item.status === 'done'"
              size="sm"
              variant="secondary"
              @click="downloadSingle(item)"
            >
              <Download class="w-3.5 h-3.5 mr-1" />
              Download
            </Button>

            <button
              type="button"
              class="p-1.5 text-[var(--text-tertiary)] hover:text-red-400 transition-colors cursor-pointer"
              title="Remove"
              @click="removeItem(item.id)"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
