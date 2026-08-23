<script setup lang="ts">
import { ref, computed } from 'vue'
import JSZip from 'jszip'
import {
  UploadCloud,
  FileImage,
  Download,
  Trash2,
  Sliders,
  Sparkles,
  Layers,
  ArrowRight,
  Eye,
  Check,
  RefreshCw,
  Columns,
  Maximize2,
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'
import Modal from '~/components/ui/Modal.vue'

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
const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const items = ref<CompressedItem[]>([])
const quality = ref(85)
const outputFormat = ref<'auto' | 'original' | 'webp' | 'jpeg' | 'png'>('auto')
const isZipping = ref(false)

// Comparison Modal State
const compareModalOpen = ref(false)
const activeCompareItem = ref<CompressedItem | null>(null)
const comparisonSliderPos = ref(50)
const compareViewMode = ref<'slider' | 'side-by-side' | 'original' | 'compressed'>('slider')
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

const reprocessAll = async () => {
  if (items.value.length === 0) return
  const currentFiles = items.value.map((i) => i.file)
  items.value = []
  await handleFiles(currentFiles)
}

const removeItem = (id: string) => {
  const idx = items.value.findIndex((i) => i.id === id)
  if (idx !== -1) {
    URL.revokeObjectURL(items.value[idx].originalUrl)
    URL.revokeObjectURL(items.value[idx].compressedUrl)
    items.value.splice(idx, 1)
  }
}

const clearAll = () => {
  items.value.forEach((item) => {
    URL.revokeObjectURL(item.originalUrl)
    URL.revokeObjectURL(item.compressedUrl)
  })
  items.value = []
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

const openComparison = (item: CompressedItem) => {
  activeCompareItem.value = item
  comparisonSliderPos.value = 50
  compareViewMode.value = 'slider'
  compareModalOpen.value = true
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
  <div class="space-y-6">
    <!-- Header & Breadcrumbs -->
    <div>
      <div class="flex items-center gap-2 text-xs text-[var(--text-tertiary)] mb-1">
        <NuxtLink to="/" class="hover:text-[var(--text-primary)] transition-colors">
          Dashboard
        </NuxtLink>
        <span>/</span>
        <span class="text-[var(--text-secondary)] font-medium">Tools</span>
        <span>/</span>
        <span class="text-[var(--text-primary)]">Image Compressor</span>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Image Compressor
          </h1>
          <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Smart visually-lossless compression without losing original resolution or clarity. 100% Client-Side.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <Badge variant="secondary">
            {{ items.length }} / 5 Files
          </Badge>
        </div>
      </div>
    </div>

    <!-- Compression Controls & Presets -->
    <Card class="p-4 sm:p-5">
      <div class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
        <!-- Quality Presets -->
        <div class="space-y-2 w-full lg:w-auto">
          <label class="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider block">
            Quality Preset
          </label>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border"
              :class="
                quality === 92
                  ? 'bg-white text-black border-white shadow-xs font-semibold'
                  : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-white hover:border-[var(--border-card-hover)]'
              "
              @click="quality = 92; reprocessAll()"
            >
              Smart Lossless (92%)
            </button>

            <button
              type="button"
              class="px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border"
              :class="
                quality === 85
                  ? 'bg-white text-black border-white shadow-xs font-semibold'
                  : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-white hover:border-[var(--border-card-hover)]'
              "
              @click="quality = 85; reprocessAll()"
            >
              Recommended (85%)
            </button>

            <button
              type="button"
              class="px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border"
              :class="
                quality === 70
                  ? 'bg-white text-black border-white shadow-xs font-semibold'
                  : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-white hover:border-[var(--border-card-hover)]'
              "
              @click="quality = 70; reprocessAll()"
            >
              Max Compression (70%)
            </button>
          </div>
        </div>

        <!-- Custom Quality Slider & Output Format -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
          <!-- Slider -->
          <div class="space-y-1.5 min-w-[160px]">
            <div class="flex items-center justify-between text-xs font-medium text-[var(--text-secondary)]">
              <span>Fine Tune Quality</span>
              <span class="font-mono text-white">{{ quality }}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              v-model.number="quality"
              @change="reprocessAll"
              class="w-full h-1.5 bg-[#2E2E2E] rounded-lg appearance-none cursor-pointer accent-white hover:h-2 transition-all"
            />
          </div>

          <!-- Output Format -->
          <div class="space-y-1.5 min-w-[150px]">
            <label class="text-xs font-medium text-[var(--text-secondary)] block">
              Output Format
            </label>
            <select
              v-model="outputFormat"
              @change="reprocessAll"
              class="w-full h-9 px-3 bg-[var(--bg-input)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-lg text-xs font-medium focus:outline-none focus:border-white transition-colors cursor-pointer"
            >
              <option value="auto">Auto (Smart WebP)</option>
              <option value="original">Original Format</option>
              <option value="webp">WebP (Smallest)</option>
              <option value="jpeg">JPEG / JPG</option>
              <option value="png">PNG (Lossless)</option>
            </select>
          </div>
        </div>
      </div>
    </Card>

    <!-- Upload Zone (Max 5 files) -->
    <div
      class="relative border-2 border-dashed rounded-[14px] p-8 sm:p-12 text-center transition-all cursor-pointer select-none"
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
        multiple
        accept="image/*,.svg"
        class="hidden"
        @change="onFileInputChange"
      />

      <div class="max-w-md mx-auto space-y-4">
        <div class="w-14 h-14 mx-auto rounded-2xl bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-white shadow-md">
          <UploadCloud class="w-7 h-7 text-white" />
        </div>

        <div>
          <h3 class="text-base font-semibold text-[var(--text-primary)]">
            Drop your images here or browse
          </h3>
          <p class="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
            Support PNG, JPG, JPEG, WebP, SVG, AVIF, GIF, BMP. Maximum 5 photos per batch.
          </p>
        </div>

        <div class="flex flex-wrap items-center justify-center gap-1.5 pt-1">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#212121] text-[var(--text-secondary)] border border-[var(--border-subtle)]">PNG</span>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#212121] text-[var(--text-secondary)] border border-[var(--border-subtle)]">JPG / JPEG</span>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#212121] text-[var(--text-secondary)] border border-[var(--border-subtle)]">WEBP</span>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#212121] text-[var(--text-secondary)] border border-[var(--border-subtle)]">SVG</span>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-[#212121] text-[var(--text-secondary)] border border-[var(--border-subtle)]">AVIF</span>
        </div>
      </div>
    </div>

    <!-- Compressed Files List -->
    <div v-if="items.length > 0" class="space-y-4">
      <!-- List Header & Actions -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[14px]">
        <div>
          <div class="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <span>{{ items.length }} Files Compressed</span>
            <span class="text-[var(--text-tertiary)]">•</span>
            <span class="text-white font-mono">Saved {{ totalSavedPercent }}% overall</span>
          </div>
          <p class="text-xs text-[var(--text-secondary)] mt-0.5">
            {{ formatBytes(totalOriginalSize) }} to {{ formatBytes(totalCompressedSize) }}
            <span class="text-white font-mono">(-{{ formatBytes(totalOriginalSize - totalCompressedSize) }})</span>
          </p>
        </div>

        <div class="flex items-center gap-2.5 w-full sm:w-auto">
          <Button
            variant="ghost"
            size="sm"
            @click="clearAll"
            class="text-[var(--text-secondary)] hover:text-red-400"
          >
            <Trash2 class="w-3.5 h-3.5 mr-1" />
            Clear All
          </Button>

          <Button
            variant="primary"
            size="sm"
            :loading="isZipping"
            @click="downloadAllZip"
            class="flex-1 sm:flex-initial"
          >
            <Download class="w-3.5 h-3.5 mr-1.5" />
            Download All (ZIP)
          </Button>
        </div>
      </div>

      <!-- Item Cards -->
      <div class="space-y-3">
        <div
          v-for="item in items"
          :key="item.id"
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl hover:border-[var(--border-card-hover)] transition-all"
        >
          <!-- Left: Thumbnail & Meta -->
          <div class="flex items-center gap-3.5 min-w-0">
            <!-- Thumbnail Box -->
            <div class="w-14 h-14 rounded-lg bg-black/60 border border-[var(--border-subtle)] overflow-hidden shrink-0 flex items-center justify-center relative">
              <img
                :src="item.compressedUrl"
                :alt="item.name"
                class="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>

            <div class="min-w-0 flex-1">
              <h4 class="text-xs font-semibold text-[var(--text-primary)] truncate max-w-xs sm:max-w-md">
                {{ item.name }}
              </h4>

              <div class="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-tertiary)] font-mono mt-1">
                <span v-if="item.width > 0">{{ item.width }} × {{ item.height }} px</span>
                <span v-if="item.width > 0">•</span>
                <span class="uppercase font-semibold text-[var(--text-secondary)]">{{ item.format }}</span>
              </div>

              <!-- Sizes -->
              <div class="flex items-center gap-2 text-xs font-mono mt-1">
                <span class="text-[var(--text-tertiary)] line-through">{{ formatBytes(item.originalSize) }}</span>
                <ArrowRight class="w-3 h-3 text-[var(--text-tertiary)]" />
                <span class="text-white font-semibold">{{ formatBytes(item.compressedSize) }}</span>
                <Badge variant="secondary" size="sm">
                  -{{ item.savedPercent }}%
                </Badge>
              </div>
            </div>
          </div>

          <!-- Right: Action Buttons -->
          <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <!-- Compare Button -->
            <Button
              variant="secondary"
              size="sm"
              @click="openComparison(item)"
              class="h-8 px-2.5 text-xs"
              title="Compare Before & After"
            >
              <Eye class="w-3.5 h-3.5 mr-1" />
              Compare
            </Button>

            <!-- Download Button -->
            <Button
              variant="primary"
              size="sm"
              @click="downloadItem(item)"
              class="h-8 px-3 text-xs"
            >
              <Download class="w-3.5 h-3.5 mr-1" />
              Save
            </Button>

            <!-- Remove Button -->
            <button
              type="button"
              @click="removeItem(item.id)"
              class="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:text-red-400 hover:bg-[#2E2E2E] transition-colors cursor-pointer"
              title="Remove item"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Enhanced Pixel-Perfect Comparison Modal -->
    <Modal
      :model-value="compareModalOpen"
      max-width="4xl"
      @update:model-value="compareModalOpen = $event"
    >
      <template #header>
        <div class="flex flex-col sm:flex-row sm:items-center justify-between w-full pr-6 gap-2">
          <div class="min-w-0">
            <h3 class="text-sm font-semibold text-[var(--text-primary)]">
              Before vs After Comparison
            </h3>
            <p class="text-xs text-[var(--text-secondary)] font-mono truncate max-w-sm sm:max-w-md mt-0.5">
              {{ activeCompareItem?.name }}
            </p>
          </div>

          <!-- View Mode Tabs & Saved Badge -->
          <div class="flex items-center gap-2">
            <div class="flex items-center bg-[#171717] border border-[var(--border-subtle)] rounded-full p-0.5 text-xs">
              <button
                type="button"
                class="px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                :class="compareViewMode === 'slider' ? 'bg-[#2E2E2E] text-white font-medium shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
                @click="compareViewMode = 'slider'"
              >
                Split Slider
              </button>
              <button
                type="button"
                class="px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                :class="compareViewMode === 'side-by-side' ? 'bg-[#2E2E2E] text-white font-medium shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
                @click="compareViewMode = 'side-by-side'"
              >
                Side-by-Side
              </button>
              <button
                type="button"
                class="px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                :class="compareViewMode === 'original' ? 'bg-[#2E2E2E] text-white font-medium shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
                @click="compareViewMode = 'original'"
              >
                Original
              </button>
              <button
                type="button"
                class="px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                :class="compareViewMode === 'compressed' ? 'bg-[#2E2E2E] text-white font-medium shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
                @click="compareViewMode = 'compressed'"
              >
                Compressed
              </button>
            </div>

            <Badge variant="primary" size="sm">
              -{{ activeCompareItem?.savedPercent }}%
            </Badge>
          </div>
        </div>
      </template>

      <div v-if="activeCompareItem" class="space-y-4">
        <!-- MODE 1: Pixel-Perfect Clip-Path Split Slider -->
        <div
          v-if="compareViewMode === 'slider'"
          ref="compareContainerRef"
          class="relative w-full h-[360px] sm:h-[480px] bg-[#111111] rounded-xl overflow-hidden select-none border border-[var(--border-subtle)] flex items-center justify-center cursor-ew-resize"
          @mousedown="isInteractingSlider = true"
          @mouseup="isInteractingSlider = false"
          @mouseleave="isInteractingSlider = false"
          @mousemove="handleContainerMouseMove"
          @touchstart="isInteractingSlider = true"
          @touchend="isInteractingSlider = false"
          @touchmove="handleContainerTouchMove"
        >
          <!-- Base Image: Compressed (Right side revealed) -->
          <img
            :src="activeCompareItem.compressedUrl"
            :alt="activeCompareItem.name"
            class="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
          />

          <!-- Overlay Image: Original (Left side revealed via clipPath) -->
          <img
            :src="activeCompareItem.originalUrl"
            :alt="activeCompareItem.name"
            class="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
            :style="{
              clipPath: `polygon(0 0, ${comparisonSliderPos}% 0, ${comparisonSliderPos}% 100%, 0 100%)`,
            }"
          />

          <!-- Vertical Divider Bar -->
          <div
            class="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_12px_rgba(0,0,0,0.8)] z-10 pointer-events-none"
            :style="{ left: `${comparisonSliderPos}%` }"
          >
            <!-- Draggable Circular Handle -->
            <div class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white text-black shadow-2xl flex items-center justify-center text-xs font-bold font-mono border-2 border-black/20">
              ↔
            </div>
          </div>

          <!-- Top-Left & Top-Right Floating Monochrome Badges -->
          <div class="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-[#1E1E1E]/90 backdrop-blur-md text-xs font-medium text-white border border-[var(--border-subtle)] z-20 shadow-lg flex items-center gap-1.5">
            <span>Original ({{ formatBytes(activeCompareItem.originalSize) }})</span>
          </div>

          <div class="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-[#1E1E1E]/90 backdrop-blur-md text-xs font-medium text-white border border-[var(--border-subtle)] z-20 shadow-lg flex items-center gap-1.5">
            <span>Compressed ({{ formatBytes(activeCompareItem.compressedSize) }})</span>
          </div>

          <!-- Hint Footer in Viewer -->
          <div class="absolute bottom-3 inset-x-0 flex justify-center z-20 pointer-events-none">
            <span class="px-3 py-1 rounded-full bg-black/75 backdrop-blur-md text-[11px] font-mono text-[var(--text-secondary)] border border-white/10">
              Drag anywhere to compare pixels
            </span>
          </div>
        </div>

        <!-- MODE 2: Side-by-Side Comparison -->
        <div v-else-if="compareViewMode === 'side-by-side'" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <!-- Left: Original -->
          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs font-mono text-[var(--text-secondary)] px-1">
              <span class="font-semibold text-white">Original File</span>
              <span>{{ formatBytes(activeCompareItem.originalSize) }}</span>
            </div>
            <div class="h-[280px] sm:h-[380px] bg-[#111111] rounded-xl overflow-hidden border border-[var(--border-subtle)] flex items-center justify-center p-2">
              <img :src="activeCompareItem.originalUrl" :alt="activeCompareItem.name" class="max-w-full max-h-full object-contain" />
            </div>
          </div>

          <!-- Right: Compressed -->
          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs font-mono text-white px-1">
              <span class="font-semibold">Compressed File</span>
              <span>{{ formatBytes(activeCompareItem.compressedSize) }} (-{{ activeCompareItem.savedPercent }}%)</span>
            </div>
            <div class="h-[280px] sm:h-[380px] bg-[#111111] rounded-xl overflow-hidden border border-[var(--border-subtle)] flex items-center justify-center p-2">
              <img :src="activeCompareItem.compressedUrl" :alt="activeCompareItem.name" class="max-w-full max-h-full object-contain" />
            </div>
          </div>
        </div>

        <!-- MODE 3: Single View (Original or Compressed) -->
        <div v-else class="space-y-2">
          <div class="flex items-center justify-between text-xs font-mono px-1">
            <span class="font-semibold text-white">
              {{ compareViewMode === 'original' ? 'Original View' : 'Compressed View' }}
            </span>
            <span class="text-[var(--text-tertiary)]">
              {{ formatBytes(compareViewMode === 'original' ? activeCompareItem.originalSize : activeCompareItem.compressedSize) }}
            </span>
          </div>
          <div class="h-[340px] sm:h-[440px] bg-[#111111] rounded-xl overflow-hidden border border-[var(--border-subtle)] flex items-center justify-center p-2">
            <img
              :src="compareViewMode === 'original' ? activeCompareItem.originalUrl : activeCompareItem.compressedUrl"
              :alt="activeCompareItem.name"
              class="max-w-full max-h-full object-contain"
            />
          </div>
        </div>

        <!-- Fine-Tune Range Slider (in slider mode) -->
        <div v-if="compareViewMode === 'slider'" class="space-y-1 pt-1">
          <div class="flex items-center justify-between text-xs text-[var(--text-tertiary)] font-mono">
            <span>Split Position (Left: Original • Right: Compressed)</span>
            <span class="text-white">{{ comparisonSliderPos }}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            v-model.number="comparisonSliderPos"
            class="w-full h-1.5 bg-[#2E2E2E] rounded-lg appearance-none cursor-ew-resize accent-white"
          />
        </div>

        <!-- Modal Footer -->
        <div class="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
          <div class="text-xs text-[var(--text-tertiary)] font-mono hidden sm:block">
            {{ activeCompareItem.width > 0 ? `${activeCompareItem.width} × ${activeCompareItem.height} px • ` : '' }}
            <span class="text-white font-semibold">-{{ formatBytes(activeCompareItem.originalSize - activeCompareItem.compressedSize) }} saved</span>
          </div>

          <div class="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <Button variant="ghost" size="sm" @click="compareModalOpen = false">
              Close
            </Button>

            <Button variant="primary" size="sm" @click="downloadItem(activeCompareItem)">
              <Download class="w-3.5 h-3.5 mr-1" />
              Download Compressed
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  </div>
</template>
