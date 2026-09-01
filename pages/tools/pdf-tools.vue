<script setup lang="ts">
import { ref, computed } from 'vue'
import { PDFDocument, PageSizes, degrees } from 'pdf-lib'
import {
  FileText,
  Upload,
  Download,
  Trash2,
  MoveUp,
  MoveDown,
  Layers,
  Scissors,
  Image as ImageIcon,
  Check,
  AlertCircle,
  FileCheck,
  RefreshCw,
  Plus
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

const toast = useToast()

// Active Tab: 'merge' | 'split' | 'img2pdf'
const activeTab = ref<'merge' | 'split' | 'img2pdf'>('merge')

// ==========================================
// 1. PDF MERGE STATE
// ==========================================
interface PdfMergeItem {
  id: string
  file: File
  name: string
  size: number
  pageCount: number
  arrayBuffer: ArrayBuffer
}

const mergeFiles = ref<PdfMergeItem[]>([])
const isMerging = ref(false)
const mergeOutputName = ref('merged_document.pdf')

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const handleMergeFileUpload = async (e: Event) => {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  const files = Array.from(input.files).filter((f) => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
  if (files.length === 0) {
    toast.error('Invalid Files', 'Please select valid PDF files')
    return
  }

  for (const file of files) {
    try {
      const buffer = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true })
      mergeFiles.value.push({
        id: Math.random().toString(36).substring(2, 9),
        file,
        name: file.name,
        size: file.size,
        pageCount: pdfDoc.getPageCount(),
        arrayBuffer: buffer,
      })
    } catch (err: any) {
      toast.error('Corrupted PDF', `Could not read ${file.name}: ${err.message || 'File is invalid or protected'}`)
    }
  }

  input.value = ''
  toast.success('PDFs Added', `Added ${files.length} PDF file(s)`)
}

const moveMergeItem = (index: number, direction: 'up' | 'down') => {
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= mergeFiles.value.length) return
  const temp = mergeFiles.value[index]
  mergeFiles.value[index] = mergeFiles.value[targetIndex]
  mergeFiles.value[targetIndex] = temp
}

const removeMergeItem = (index: number) => {
  mergeFiles.value.splice(index, 1)
}

const clearMergeFiles = () => {
  mergeFiles.value = []
}

const totalMergePages = computed(() => {
  return mergeFiles.value.reduce((sum, item) => sum + item.pageCount, 0)
})

const handleExecuteMerge = async () => {
  if (mergeFiles.value.length < 2) {
    toast.error('Insufficient Files', 'Please add at least 2 PDF files to merge')
    return
  }

  isMerging.value = true
  try {
    const mergedPdf = await PDFDocument.create()

    for (const item of mergeFiles.value) {
      const sourcePdf = await PDFDocument.load(item.arrayBuffer)
      const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices())
      copiedPages.forEach((page) => mergedPdf.addPage(page))
    }

    const mergedPdfBytes = await mergedPdf.save()
    const blob = new Blob([mergedPdfBytes as any], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = mergeOutputName.value.endsWith('.pdf') ? mergeOutputName.value : `${mergeOutputName.value}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.success('Merge Complete', `Successfully merged ${totalMergePages.value} pages into 1 PDF!`)
  } catch (err: any) {
    toast.error('Merge Failed', err.message || 'Failed to merge PDF documents')
  } finally {
    isMerging.value = false
  }
}

// ==========================================
// 2. PDF SPLIT & EXTRACT STATE
// ==========================================
const splitFile = ref<{
  file: File
  name: string
  size: number
  pageCount: number
  arrayBuffer: ArrayBuffer
} | null>(null)

const pageRangeInput = ref('')
const isSplitting = ref(false)
const splitOutputName = ref('extracted_pages.pdf')

const handleSplitFileUpload = async (e: Event) => {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  const file = input.files[0]
  if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
    toast.error('Invalid File', 'Please select a valid PDF file')
    return
  }

  try {
    const buffer = await file.arrayBuffer()
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true })
    const count = pdfDoc.getPageCount()

    splitFile.value = {
      file,
      name: file.name,
      size: file.size,
      pageCount: count,
      arrayBuffer: buffer,
    }

    // Default range is all pages
    pageRangeInput.value = count === 1 ? '1' : `1-${count}`
    splitOutputName.value = `${file.name.replace(/\.pdf$/i, '')}_extracted.pdf`
    toast.success('PDF Loaded', `${file.name} loaded with ${count} pages`)
  } catch (err: any) {
    toast.error('Read Error', `Could not read PDF: ${err.message || 'Unknown error'}`)
  }

  input.value = ''
}

// Parse string like "1-3, 5, 8-10" into 0-indexed page array
const parsePageRanges = (input: string, maxPages: number): number[] => {
  const indices = new Set<number>()
  const parts = input.split(',').map((p) => p.trim())

  for (const part of parts) {
    if (!part) continue
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => s.trim())
      const start = parseInt(startStr, 10)
      const end = parseInt(endStr, 10)
      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.max(1, Math.min(start, end))
        const max = Math.min(maxPages, Math.max(start, end))
        for (let i = min; i <= max; i++) {
          indices.add(i - 1)
        }
      }
    } else {
      const num = parseInt(part, 10)
      if (!isNaN(num) && num >= 1 && num <= maxPages) {
        indices.add(num - 1)
      }
    }
  }

  return Array.from(indices).sort((a, b) => a - b)
}

const parsedSelectedPages = computed(() => {
  if (!splitFile.value) return []
  return parsePageRanges(pageRangeInput.value, splitFile.value.pageCount)
})

const handleExecuteSplit = async () => {
  if (!splitFile.value) return
  const pagesToExtract = parsedSelectedPages.value

  if (pagesToExtract.length === 0) {
    toast.error('No Pages Selected', 'Please enter a valid page range (e.g. 1-3, 5)')
    return
  }

  isSplitting.value = true
  try {
    const sourcePdf = await PDFDocument.load(splitFile.value.arrayBuffer)
    const newPdf = await PDFDocument.create()

    const copiedPages = await newPdf.copyPages(sourcePdf, pagesToExtract)
    copiedPages.forEach((page) => newPdf.addPage(page))

    const newPdfBytes = await newPdf.save()
    const blob = new Blob([newPdfBytes as any], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = splitOutputName.value.endsWith('.pdf') ? splitOutputName.value : `${splitOutputName.value}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.success('Extract Complete', `Successfully extracted ${pagesToExtract.length} pages to new PDF!`)
  } catch (err: any) {
    toast.error('Split Failed', err.message || 'Failed to extract PDF pages')
  } finally {
    isSplitting.value = false
  }
}

// ==========================================
// 3. IMAGES TO PDF STATE
// ==========================================
interface ImgToPdfItem {
  id: string
  file: File
  name: string
  size: number
  previewUrl: string
}

const imageFiles = ref<ImgToPdfItem[]>([])
const pageSizeOption = ref<'fit' | 'a4' | 'letter'>('a4')
const pageOrientation = ref<'portrait' | 'landscape'>('portrait')
const pageMargin = ref<number>(0)
const isConvertingImg = ref(false)
const imgPdfOutputName = ref('converted_images.pdf')

const handleImageUpload = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  const files = Array.from(input.files).filter((f) => f.type.startsWith('image/'))
  if (files.length === 0) {
    toast.error('Invalid Files', 'Please select image files (JPG, PNG, WebP)')
    return
  }

  for (const file of files) {
    imageFiles.value.push({
      id: Math.random().toString(36).substring(2, 9),
      file,
      name: file.name,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
    })
  }

  input.value = ''
  toast.success('Images Added', `Added ${files.length} image(s)`)
}

const moveImgItem = (index: number, direction: 'up' | 'down') => {
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= imageFiles.value.length) return
  const temp = imageFiles.value[index]
  imageFiles.value[index] = imageFiles.value[targetIndex]
  imageFiles.value[targetIndex] = temp
}

const removeImgItem = (index: number) => {
  URL.revokeObjectURL(imageFiles.value[index].previewUrl)
  imageFiles.value.splice(index, 1)
}

const clearImgFiles = () => {
  imageFiles.value.forEach((img) => URL.revokeObjectURL(img.previewUrl))
  imageFiles.value = []
}

const handleExecuteImgToPdf = async () => {
  if (imageFiles.value.length === 0) {
    toast.error('No Images', 'Please upload at least 1 image')
    return
  }

  isConvertingImg.value = true
  try {
    const pdfDoc = await PDFDocument.create()

    for (const item of imageFiles.value) {
      const buffer = await item.file.arrayBuffer()
      let embeddedImage
      if (item.file.type === 'image/png') {
        embeddedImage = await pdfDoc.embedPng(buffer)
      } else {
        // JPG, JPEG, and WebP via canvas fallback
        try {
          embeddedImage = await pdfDoc.embedJpg(buffer)
        } catch {
          // If direct embed fails (e.g. WebP or non-standard JPG), render to canvas then PNG
          const imgEl = new Image()
          imgEl.src = item.previewUrl
          await new Promise((res) => {
            imgEl.onload = res
          })
          const canvas = document.createElement('canvas')
          canvas.width = imgEl.naturalWidth
          canvas.height = imgEl.naturalHeight
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(imgEl, 0, 0)
          const pngDataUrl = canvas.toDataURL('image/png')
          const pngBytes = await (await fetch(pngDataUrl)).arrayBuffer()
          embeddedImage = await pdfDoc.embedPng(pngBytes)
        }
      }

      const imgWidth = embeddedImage.width
      const imgHeight = embeddedImage.height

      if (pageSizeOption.value === 'fit') {
        const page = pdfDoc.addPage([imgWidth, imgHeight])
        page.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: imgWidth,
          height: imgHeight,
        })
      } else {
        // A4 or Letter
        let baseSize = pageSizeOption.value === 'a4' ? PageSizes.A4 : PageSizes.Letter
        let pageWidth = pageOrientation.value === 'portrait' ? baseSize[0] : baseSize[1]
        let pageHeight = pageOrientation.value === 'portrait' ? baseSize[1] : baseSize[0]

        const page = pdfDoc.addPage([pageWidth, pageHeight])
        const margin = pageMargin.value

        const usableWidth = pageWidth - margin * 2
        const usableHeight = pageHeight - margin * 2

        const scale = Math.min(usableWidth / imgWidth, usableHeight / imgHeight)
        const finalWidth = imgWidth * scale
        const finalHeight = imgHeight * scale

        const posX = margin + (usableWidth - finalWidth) / 2
        const posY = margin + (usableHeight - finalHeight) / 2

        page.drawImage(embeddedImage, {
          x: posX,
          y: posY,
          width: finalWidth,
          height: finalHeight,
        })
      }
    }

    const pdfBytes = await pdfDoc.save()
    const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = imgPdfOutputName.value.endsWith('.pdf') ? imgPdfOutputName.value : `${imgPdfOutputName.value}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.success('PDF Created', `Created PDF with ${imageFiles.value.length} image pages!`)
  } catch (err: any) {
    toast.error('Conversion Failed', err.message || 'Failed to convert images to PDF')
  } finally {
    isConvertingImg.value = false
  }
}
</script>

<template>
  <div class="space-y-6 max-w-5xl mx-auto pb-12">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
      <div class="space-y-1">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-white">
            <FileText class="w-4.5 h-4.5 text-white" />
          </div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            PDF Studio
          </h1>
        </div>
        <p class="text-xs sm:text-sm text-[var(--text-secondary)]">
          Merge, split, extract pages, and convert photos to PDF completely in your browser with 100% client privacy.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Badge variant="badge">
          100% Client-Side
        </Badge>
      </div>
    </div>

    <!-- Mode Selector Tabs -->
    <div class="flex items-center gap-2 p-1 bg-[#171717] border border-[var(--border-subtle)] rounded-lg w-full sm:w-fit">
      <button
        type="button"
        class="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-all cursor-pointer"
        :class="activeTab === 'merge' ? 'bg-[#2E2E2E] text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card-hover)]'"
        @click="activeTab = 'merge'"
      >
        <Layers class="w-4 h-4" />
        <span>Merge PDF</span>
      </button>

      <button
        type="button"
        class="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-all cursor-pointer"
        :class="activeTab === 'split' ? 'bg-[#2E2E2E] text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card-hover)]'"
        @click="activeTab = 'split'"
      >
        <Scissors class="w-4 h-4" />
        <span>Split & Extract</span>
      </button>

      <button
        type="button"
        class="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-all cursor-pointer"
        :class="activeTab === 'img2pdf' ? 'bg-[#2E2E2E] text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card-hover)]'"
        @click="activeTab = 'img2pdf'"
      >
        <ImageIcon class="w-4 h-4" />
        <span>Images to PDF</span>
      </button>
    </div>

    <!-- TAB 1: MERGE PDF -->
    <div v-if="activeTab === 'merge'" class="space-y-6">
      <!-- Upload Dropzone -->
      <Card class="p-6 sm:p-8 border-dashed border-2 border-[var(--border-subtle)] hover:border-white/30 transition-all text-center">
        <label class="flex flex-col items-center justify-center gap-3 cursor-pointer">
          <div class="w-12 h-12 rounded-xl bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-white transition-colors">
            <Upload class="w-6 h-6" />
          </div>
          <div class="space-y-1">
            <p class="text-sm font-semibold text-[var(--text-primary)]">
              Click or drag & drop PDF files to combine
            </p>
            <p class="text-xs text-[var(--text-tertiary)]">
              Support multiple PDF files • Up to 200MB+ per file
            </p>
          </div>
          <input
            type="file"
            multiple
            accept=".pdf,application/pdf"
            class="hidden"
            @change="handleMergeFileUpload"
          />
        </label>
      </Card>

      <!-- Files List -->
      <div v-if="mergeFiles.length > 0" class="space-y-4">
        <div class="flex items-center justify-between">
          <div class="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            PDF Documents ({{ mergeFiles.length }}) • Total {{ totalMergePages }} Pages
          </div>
          <button
            type="button"
            class="text-xs text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1 cursor-pointer"
            @click="clearMergeFiles"
          >
            <Trash2 class="w-3.5 h-3.5" />
            <span>Clear All</span>
          </button>
        </div>

        <div class="space-y-2">
          <div
            v-for="(item, idx) in mergeFiles"
            :key="item.id"
            class="flex items-center justify-between p-3.5 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg hover:border-[var(--border-card-hover)] transition-all"
          >
            <div class="flex items-center gap-3 min-w-0 pr-3">
              <div class="w-8 h-8 rounded bg-[#212121] border border-[#2E2E2E] flex items-center justify-center shrink-0 text-xs font-bold text-[var(--text-secondary)]">
                {{ idx + 1 }}
              </div>
              <div class="min-w-0">
                <div class="text-sm font-medium text-[var(--text-primary)] truncate">
                  {{ item.name }}
                </div>
                <div class="text-xs text-[var(--text-tertiary)] font-mono flex items-center gap-2 mt-0.5">
                  <span>{{ item.pageCount }} {{ item.pageCount === 1 ? 'Page' : 'Pages' }}</span>
                  <span>•</span>
                  <span>{{ formatBytes(item.size) }}</span>
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-1 shrink-0">
              <button
                type="button"
                class="p-1.5 text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card-hover)] rounded transition-colors disabled:opacity-30 cursor-pointer"
                :disabled="idx === 0"
                title="Move Up"
                @click="moveMergeItem(idx, 'up')"
              >
                <MoveUp class="w-4 h-4" />
              </button>
              <button
                type="button"
                class="p-1.5 text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card-hover)] rounded transition-colors disabled:opacity-30 cursor-pointer"
                :disabled="idx === mergeFiles.length - 1"
                title="Move Down"
                @click="moveMergeItem(idx, 'down')"
              >
                <MoveDown class="w-4 h-4" />
              </button>
              <button
                type="button"
                class="p-1.5 text-[var(--text-secondary)] hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                title="Remove"
                @click="removeMergeItem(idx)"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- Output Configuration & Trigger -->
        <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="space-y-1">
              <label class="text-xs font-semibold text-[var(--text-secondary)]">Output File Name</label>
              <input
                v-model="mergeOutputName"
                type="text"
                class="w-full sm:w-64 px-3 py-1.5 bg-[#171717] border border-[var(--border-subtle)] rounded-md text-xs text-white placeholder-[var(--text-tertiary)] focus:outline-none focus:border-white/40 font-mono"
                placeholder="merged_document.pdf"
              />
            </div>

            <Button
              variant="primary"
              size="default"
              class="shrink-0"
              :disabled="mergeFiles.length < 2 || isMerging"
              @click="handleExecuteMerge"
            >
              <RefreshCw v-if="isMerging" class="w-4 h-4 animate-spin mr-2" />
              <Download v-else class="w-4 h-4 mr-2" />
              <span>Merge & Download PDF</span>
            </Button>
          </div>
        </Card>
      </div>
    </div>

    <!-- TAB 2: SPLIT & EXTRACT -->
    <div v-if="activeTab === 'split'" class="space-y-6">
      <!-- Upload Dropzone -->
      <Card
        v-if="!splitFile"
        class="p-6 sm:p-8 border-dashed border-2 border-[var(--border-subtle)] hover:border-white/30 transition-all text-center"
      >
        <label class="flex flex-col items-center justify-center gap-3 cursor-pointer">
          <div class="w-12 h-12 rounded-xl bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-white transition-colors">
            <Scissors class="w-6 h-6" />
          </div>
          <div class="space-y-1">
            <p class="text-sm font-semibold text-[var(--text-primary)]">
              Click or drag & drop 1 PDF file to extract pages
            </p>
            <p class="text-xs text-[var(--text-tertiary)]">
              Specify custom page ranges or extract single pages
            </p>
          </div>
          <input
            type="file"
            accept=".pdf,application/pdf"
            class="hidden"
            @change="handleSplitFileUpload"
          />
        </label>
      </Card>

      <!-- Loaded Split File Controls -->
      <div v-else class="space-y-4">
        <Card class="p-5 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-4">
          <div class="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-lg bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-white shrink-0">
                <FileCheck class="w-5 h-5 text-emerald-400" />
              </div>
              <div class="min-w-0">
                <h4 class="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {{ splitFile.name }}
                </h4>
                <p class="text-xs text-[var(--text-tertiary)] font-mono">
                  {{ splitFile.pageCount }} Total Pages • {{ formatBytes(splitFile.size) }}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              @click="splitFile = null"
            >
              Change File
            </Button>
          </div>

          <!-- Page Range Input -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-semibold text-[var(--text-primary)]">
                Pages to Extract
              </label>
              <span class="text-xs text-emerald-400 font-mono">
                {{ parsedSelectedPages.length }} page(s) will be extracted
              </span>
            </div>

            <input
              v-model="pageRangeInput"
              type="text"
              class="w-full px-3.5 py-2.5 bg-[#171717] border border-[var(--border-subtle)] rounded-lg text-sm text-white placeholder-[var(--text-tertiary)] focus:outline-none focus:border-white/40 font-mono"
              placeholder="e.g. 1-3, 5, 8-10"
            />
            <p class="text-[11px] text-[var(--text-tertiary)]">
              Example format: <code class="text-white">1-5</code> (pages 1 to 5), <code class="text-white">1, 3, 7</code> (specific pages), or <code class="text-white">1-3, 6-8</code>.
            </p>
          </div>

          <!-- Output File Name & Action -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-[var(--border-subtle)]">
            <div class="space-y-1">
              <label class="text-xs font-semibold text-[var(--text-secondary)]">Output File Name</label>
              <input
                v-model="splitOutputName"
                type="text"
                class="w-full sm:w-64 px-3 py-1.5 bg-[#171717] border border-[var(--border-subtle)] rounded-md text-xs text-white font-mono focus:outline-none focus:border-white/40"
              />
            </div>

            <Button
              variant="primary"
              size="default"
              :disabled="parsedSelectedPages.length === 0 || isSplitting"
              @click="handleExecuteSplit"
            >
              <RefreshCw v-if="isSplitting" class="w-4 h-4 animate-spin mr-2" />
              <Download v-else class="w-4 h-4 mr-2" />
              <span>Extract & Download PDF</span>
            </Button>
          </div>
        </Card>
      </div>
    </div>

    <!-- TAB 3: IMAGES TO PDF -->
    <div v-if="activeTab === 'img2pdf'" class="space-y-6">
      <!-- Upload Dropzone -->
      <Card class="p-6 sm:p-8 border-dashed border-2 border-[var(--border-subtle)] hover:border-white/30 transition-all text-center">
        <label class="flex flex-col items-center justify-center gap-3 cursor-pointer">
          <div class="w-12 h-12 rounded-xl bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-white transition-colors">
            <ImageIcon class="w-6 h-6" />
          </div>
          <div class="space-y-1">
            <p class="text-sm font-semibold text-[var(--text-primary)]">
              Click or drag & drop images to convert into PDF
            </p>
            <p class="text-xs text-[var(--text-tertiary)]">
              Supports JPG, PNG, WebP, BMP photos • Multi-image upload
            </p>
          </div>
          <input
            type="file"
            multiple
            accept="image/*"
            class="hidden"
            @change="handleImageUpload"
          />
        </label>
      </Card>

      <!-- Images List & Settings -->
      <div v-if="imageFiles.length > 0" class="space-y-6">
        <!-- Settings Bar -->
        <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] grid grid-cols-1 sm:grid-cols-3 gap-4">
          <!-- Page Size -->
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-[var(--text-secondary)]">Page Size</label>
            <select
              v-model="pageSizeOption"
              class="w-full px-3 py-1.5 bg-[#171717] border border-[var(--border-subtle)] rounded-md text-xs text-white focus:outline-none"
            >
              <option value="a4">A4 (Standard Document)</option>
              <option value="letter">US Letter</option>
              <option value="fit">Fit to Image Size</option>
            </select>
          </div>

          <!-- Page Orientation -->
          <div class="space-y-1.5" :class="pageSizeOption === 'fit' ? 'opacity-40 pointer-events-none' : ''">
            <label class="text-xs font-semibold text-[var(--text-secondary)]">Orientation</label>
            <select
              v-model="pageOrientation"
              class="w-full px-3 py-1.5 bg-[#171717] border border-[var(--border-subtle)] rounded-md text-xs text-white focus:outline-none"
            >
              <option value="portrait">Portrait (Vertical)</option>
              <option value="landscape">Landscape (Horizontal)</option>
            </select>
          </div>

          <!-- Margins -->
          <div class="space-y-1.5" :class="pageSizeOption === 'fit' ? 'opacity-40 pointer-events-none' : ''">
            <label class="text-xs font-semibold text-[var(--text-secondary)]">Page Margins</label>
            <select
              v-model="pageMargin"
              class="w-full px-3 py-1.5 bg-[#171717] border border-[var(--border-subtle)] rounded-md text-xs text-white focus:outline-none"
            >
              <option :value="0">No Margin (0 mm)</option>
              <option :value="20">Compact (10 mm)</option>
              <option :value="40">Standard (20 mm)</option>
            </select>
          </div>
        </Card>

        <!-- Image Items Grid -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div class="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              Image Pages ({{ imageFiles.length }})
            </div>
            <button
              type="button"
              class="text-xs text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1 cursor-pointer"
              @click="clearImgFiles"
            >
              <Trash2 class="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <div
              v-for="(item, idx) in imageFiles"
              :key="item.id"
              class="p-2.5 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg hover:border-[var(--border-card-hover)] transition-all space-y-2 relative group"
            >
              <div class="aspect-4/3 rounded bg-[#121212] overflow-hidden flex items-center justify-center border border-[#212121]">
                <img
                  :src="item.previewUrl"
                  alt="Preview"
                  class="w-full h-full object-contain"
                />
              </div>

              <div class="flex items-center justify-between gap-1 text-xs">
                <span class="font-bold text-white/80">#{{ idx + 1 }}</span>
                <span class="text-[10px] text-[var(--text-tertiary)] font-mono truncate max-w-[90px]">{{ item.name }}</span>
              </div>

              <!-- Item Controls -->
              <div class="flex items-center justify-between border-t border-[var(--border-subtle)] pt-1.5">
                <div class="flex items-center gap-1">
                  <button
                    type="button"
                    class="p-1 text-[var(--text-secondary)] hover:text-white rounded disabled:opacity-20 cursor-pointer"
                    :disabled="idx === 0"
                    title="Move Left"
                    @click="moveImgItem(idx, 'up')"
                  >
                    <MoveUp class="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    class="p-1 text-[var(--text-secondary)] hover:text-white rounded disabled:opacity-20 cursor-pointer"
                    :disabled="idx === imageFiles.length - 1"
                    title="Move Right"
                    @click="moveImgItem(idx, 'down')"
                  >
                    <MoveDown class="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  class="p-1 text-[var(--text-secondary)] hover:text-rose-400 rounded cursor-pointer"
                  title="Remove Image"
                  @click="removeImgItem(idx)"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Output & Convert Button -->
        <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="space-y-1">
              <label class="text-xs font-semibold text-[var(--text-secondary)]">Output File Name</label>
              <input
                v-model="imgPdfOutputName"
                type="text"
                class="w-full sm:w-64 px-3 py-1.5 bg-[#171717] border border-[var(--border-subtle)] rounded-md text-xs text-white font-mono focus:outline-none focus:border-white/40"
              />
            </div>

            <Button
              variant="primary"
              size="default"
              :disabled="imageFiles.length === 0 || isConvertingImg"
              @click="handleExecuteImgToPdf"
            >
              <RefreshCw v-if="isConvertingImg" class="w-4 h-4 animate-spin mr-2" />
              <Download v-else class="w-4 h-4 mr-2" />
              <span>Convert to PDF</span>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
