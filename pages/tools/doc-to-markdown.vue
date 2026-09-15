<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  FileText,
  Upload,
  Clipboard,
  Copy,
  Check,
  Download,
  Eye,
  Code2,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Image as ImageIcon,
  X
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import { useI18n } from '~/composables/useI18n'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'
import Card from '~/components/ui/Card.vue'

const toast = useToast()
const { t, locale } = useI18n()

useHead({
  title: 'Doc to Markdown — PDF & Image to Markdown Studio | Avttr Studio',
  meta: [
    {
      name: 'description',
      content: 'Convert PDF documents and images into structured GitHub-Flavored Markdown with tables, formulas, and headings.'
    }
  ]
})

// Document State
const selectedFile = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const isConverting = ref(false)
const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const errorMsg = ref<string | null>(null)

// Output State
const convertedMarkdown = ref<string>('')
const activeTab = ref<'preview' | 'raw'>('preview')
const hasCopied = ref(false)

// Compute word & character counts
const stats = computed(() => {
  const text = convertedMarkdown.value.trim()
  return {
    words: text ? text.split(/\s+/).length : 0,
    chars: text.length
  }
})

// Convert Base64 Helper
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (err) => reject(err)
  })
}

// Core Conversion Handler
const processDocument = async (file: File) => {
  selectedFile.value = file
  previewUrl.value = URL.createObjectURL(file)
  errorMsg.value = null
  convertedMarkdown.value = ''
  isConverting.value = true

  try {
    const base64 = await fileToBase64(file)
    const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/png')

    const res = await $fetch<{ success: boolean; markdown: string; stats?: { words: number; characters: number } }>(
      '/api/tools/doc-to-markdown',
      {
        method: 'POST',
        body: {
          fileBase64: base64,
          mimeType
        }
      }
    )

    if (!res || !res.markdown) {
      throw new Error('Conversion returned an empty response')
    }

    convertedMarkdown.value = res.markdown
    toast.success(
      locale.value === 'id' ? 'Konversi Berhasil' : 'Conversion Complete',
      locale.value === 'id'
        ? `Berhasil mengekstrak ${res.stats?.words || stats.value.words} kata ke Markdown.`
        : `Successfully extracted ${res.stats?.words || stats.value.words} words to Markdown.`
    )
  } catch (err: any) {
    errorMsg.value = err.data?.statusMessage || err.message || 'Failed to convert document'
    toast.error(
      locale.value === 'id' ? 'Gagal Konversi' : 'Conversion Failed',
      errorMsg.value || 'Could not process document with Gemini AI'
    )
  } finally {
    isConverting.value = false
  }
}

// File Select
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    processDocument(target.files[0])
  }
}

// Drag & Drop
const handleDrop = (event: DragEvent) => {
  isDragging.value = false
  if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
    const file = event.dataTransfer.files[0]
    if (file.type.startsWith('image/') || file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      processDocument(file)
    } else {
      toast.warning('Unsupported Format', 'Please upload a PDF or image file (PNG, JPG, WebP).')
    }
  }
}

// Clipboard Paste
const handlePasteFromClipboard = async () => {
  try {
    const clipboardItems = await navigator.clipboard.read()
    for (const item of clipboardItems) {
      const imageType = item.types.find((type) => type.startsWith('image/'))
      if (imageType) {
        const blob = await item.getType(imageType)
        const file = new File([blob], 'pasted-screenshot.png', { type: imageType })
        toast.success(
          locale.value === 'id' ? 'Ditempel dari Clipboard' : 'Pasted from Clipboard',
          locale.value === 'id' ? 'Memproses gambar dengan AI...' : 'Processing image with AI...'
        )
        processDocument(file)
        return
      }
    }
    toast.warning('No Image in Clipboard', 'Please copy an image or take a screenshot first (Win+Shift+S / Cmd+Shift+4).')
  } catch (err) {
    toast.error('Clipboard Access Denied', 'Press Ctrl+V anywhere on this page to paste your screenshot directly.')
  }
}

// Global Keyboard Paste Listener
const handleGlobalPaste = (event: ClipboardEvent) => {
  const items = event.clipboardData?.items
  if (!items) return
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.startsWith('image/')) {
      const file = items[i].getAsFile()
      if (file) {
        toast.success(
          locale.value === 'id' ? 'Ditempel dari Clipboard' : 'Pasted from Clipboard',
          locale.value === 'id' ? 'Memproses gambar dengan AI...' : 'Processing image with AI...'
        )
        processDocument(file)
        event.preventDefault()
        return
      }
    }
  }
}

onMounted(() => {
  window.addEventListener('paste', handleGlobalPaste)
})

onUnmounted(() => {
  window.removeEventListener('paste', handleGlobalPaste)
})

// Copy Markdown
const copyMarkdown = async () => {
  if (!convertedMarkdown.value) return
  try {
    await navigator.clipboard.writeText(convertedMarkdown.value)
    hasCopied.value = true
    toast.success(
      locale.value === 'id' ? 'Tersalin' : 'Copied to Clipboard',
      locale.value === 'id' ? 'Konten Markdown berhasil disalin.' : 'Markdown content copied to clipboard.'
    )
    setTimeout(() => {
      hasCopied.value = false
    }, 2000)
  } catch (err) {
    toast.error('Copy Failed', 'Please select and copy manually.')
  }
}

// Download .md File
const downloadMarkdown = () => {
  if (!convertedMarkdown.value) return
  const originalName = selectedFile.value?.name.replace(/\.[^/.]+$/, '') || 'document'
  const filename = `${originalName}.md`

  const blob = new Blob([convertedMarkdown.value], { type: 'text/markdown;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  toast.success('Downloaded', `Saved as ${filename}`)
}

// Reset workspace
const resetWorkspace = () => {
  selectedFile.value = null
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = null
  convertedMarkdown.value = ''
  errorMsg.value = null
  if (fileInputRef.value) fileInputRef.value.value = ''
}

// Simple HTML formatter for basic markdown preview
const renderedHtml = computed(() => {
  if (!convertedMarkdown.value) return ''
  let raw = convertedMarkdown.value

  // Escape basic HTML
  raw = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Code blocks
  raw = raw.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="bg-[#141416] border border-[#2E2E2E] rounded-lg p-3 my-3 text-xs font-mono overflow-x-auto text-emerald-300"><code>${code.trim()}</code></pre>`
  })

  // Inline code
  raw = raw.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-[#212121] text-amber-300 font-mono text-[12px] border border-[#2E2E2E]">$1</code>')

  // Headings
  raw = raw.replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold text-white mt-4 mb-2">$1</h3>')
  raw = raw.replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-white mt-5 mb-2 pb-1 border-b border-[#2E2E2E]">$1</h2>')
  raw = raw.replace(/^# (.*$)/gim, '<h1 class="text-xl sm:text-2xl font-bold text-white mt-6 mb-3 pb-1 border-b border-[#3E3E3E]">$1</h1>')

  // Blockquotes
  raw = raw.replace(/^\> (.*$)/gim, '<blockquote class="border-l-2 border-emerald-500 pl-3 my-2 text-[var(--text-secondary)] italic">$1</blockquote>')

  // Bold & Italic
  raw = raw.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
  raw = raw.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
  raw = raw.replace(/\*(.*?)\*/g, '<em class="text-zinc-300">$1</em>')

  // Markdown Tables (basic parser)
  const lines = raw.split('\n')
  let inTable = false
  let tableHtml = ''
  const outputLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim())

      // Skip delimiter row like |---|---|
      if (cells.every((c) => /^:?-+:?$/.test(c))) {
        continue
      }

      if (!inTable) {
        inTable = true
        tableHtml = '<div class="my-4 overflow-x-auto border border-[#2E2E2E] rounded-lg"><table class="w-full text-xs text-left border-collapse">'
        // First row is header
        tableHtml += '<thead class="bg-[#18181B] border-b border-[#2E2E2E] text-white"><tr>'
        cells.forEach((c) => {
          tableHtml += `<th class="px-3 py-2 font-semibold border-r border-[#2E2E2E] last:border-r-0">${c}</th>`
        })
        tableHtml += '</tr></thead><tbody class="divide-y divide-[#2E2E2E]">'
      } else {
        tableHtml += '<tr class="hover:bg-[#1C1C1F] transition-colors">'
        cells.forEach((c) => {
          tableHtml += `<td class="px-3 py-2 border-r border-[#2E2E2E] last:border-r-0 text-[var(--text-secondary)]">${c}</td>`
        })
        tableHtml += '</tr>'
      }
    } else {
      if (inTable) {
        tableHtml += '</tbody></table></div>'
        outputLines.push(tableHtml)
        inTable = false
        tableHtml = ''
      }
      outputLines.push(lines[i])
    }
  }

  if (inTable) {
    tableHtml += '</tbody></table></div>'
    outputLines.push(tableHtml)
  }

  // Lists & Paragraphs
  return outputLines
    .join('\n')
    .replace(/^\- (.*$)/gim, '<li class="ml-4 list-disc text-xs text-[var(--text-secondary)] my-0.5">$1</li>')
    .replace(/^\d+\. (.*$)/gim, '<li class="ml-4 list-decimal text-xs text-[var(--text-secondary)] my-0.5">$1</li>')
    .replace(/\n\n/g, '<div class="my-2"></div>')
})
</script>

<template>
  <div class="space-y-6 pb-12 w-full">
    <!-- Breadcrumbs & Header Flex Row -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="space-y-1">
        <nav class="flex items-center gap-1.5 text-xs font-mono text-[var(--text-tertiary)]">
          <NuxtLink to="/" class="hover:text-[var(--text-primary)] transition-colors">Dashboard</NuxtLink>
          <span>/</span>
          <span>Assets</span>
          <span>/</span>
          <span class="text-[var(--text-primary)] font-medium">Doc to Markdown</span>
        </nav>
        <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          {{ t.tools['doc-to-markdown']?.title || 'Doc to Markdown Studio' }}
        </h1>
        <p class="text-xs sm:text-sm text-[var(--text-secondary)]">
          {{ t.tools['doc-to-markdown']?.description || 'Convert PDF documents and images into structured GitHub Markdown with preserved tables, formulas, and headings.' }}
        </p>
      </div>

      <!-- Engine Badges -->
      <div class="flex items-center gap-2 flex-wrap">
        <Badge variant="badge">AI Vision</Badge>
        <Badge variant="outline">Client Privacy</Badge>
      </div>
    </div>

    <!-- Hidden Native File Input -->
    <input
      ref="fileInputRef"
      type="file"
      accept="application/pdf,image/png,image/jpeg,image/webp,image/avif"
      class="hidden"
      @change="handleFileSelect"
    />

    <!-- Upload Deck (Shown when no file is active) -->
    <div v-if="!selectedFile && !isConverting" class="space-y-4">
      <!-- Standardized Section 10 Standalone Dropzone -->
      <div
        class="relative border-2 border-dashed rounded-[14px] p-8 sm:p-14 border-[#2E2E2E] bg-[#141416] hover:border-[#3E3E3E] text-center cursor-pointer select-none transition-colors"
        :class="isDragging ? 'border-white bg-[#1A1A1E]' : ''"
        @click="fileInputRef?.click()"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
      >
        <div class="w-12 h-12 mx-auto rounded-xl bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-white shadow-xs">
          <FileText class="w-6 h-6" />
        </div>
        <div class="text-sm font-semibold text-[var(--text-primary)] mt-3">
          {{ locale === 'id' ? 'Tarik & lepas dokumen PDF atau gambar di sini atau browse file' : 'Drop your PDF document or image here or browse' }}
        </div>
        <div class="text-xs text-[var(--text-secondary)] mt-1">
          {{ locale === 'id' ? 'Mendukung PDF, PNG, JPG, WebP. Tabel, rumus, dan layout terkonversi otomatis.' : 'Supports PDF, PNG, JPG, WebP. Preserves tables, formulas, and headings.' }}
        </div>

        <!-- Quick Action Buttons -->
        <div class="mt-6 flex items-center justify-center gap-2.5 flex-wrap" @click.stop>
          <Button
            variant="secondary"
            class="h-9 px-3.5 text-xs font-medium border-[#2E2E2E] flex items-center gap-1.5"
            @click="handlePasteFromClipboard"
          >
            <Clipboard class="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <span>Paste Screenshot</span>
            <kbd class="hidden sm:inline-block px-1 py-0.2 bg-[#212121] border border-[#2E2E2E] rounded text-[10px] text-[var(--text-tertiary)] font-mono">Ctrl+V</kbd>
          </Button>

          <Button
            variant="ghost"
            class="h-9 px-3.5 text-xs font-medium border border-[#2E2E2E] text-[var(--text-secondary)] hover:text-white"
            @click="fileInputRef?.click()"
          >
            <Upload class="w-3.5 h-3.5 mr-1" />
            <span>Browse Files</span>
          </Button>
        </div>
      </div>

      <!-- Daily Quota & Usage Notice -->
      <div class="p-4 rounded-[14px] bg-[#141416] border border-[#2E2E2E] flex items-start gap-3.5 text-xs">
        <div class="w-8 h-8 rounded-lg bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-zinc-400 shrink-0 mt-0.5">
          <Sparkles class="w-4 h-4" />
        </div>
        <div class="space-y-1 text-[var(--text-secondary)] leading-relaxed">
          <div class="text-xs font-semibold text-[var(--text-primary)]">
            {{ locale === 'id' ? 'Informasi Penggunaan & Kuota Harian' : 'Usage & Daily Quota Notice' }}
          </div>
          <p class="text-[11px] text-[var(--text-tertiary)]">
            {{ locale === 'id'
              ? 'Fitur ini didukung oleh Google Gemini API untuk membaca dan mengubah dokumen (PDF & Gambar) menjadi Markdown secara otomatis. Jika limit token harian habis, layanan ini dapat digunakan kembali besok setelah kuota harian di-reset.'
              : 'This feature is powered by Google Gemini API to parse and convert documents (PDF & Images) into Markdown. If the daily token quota is exhausted, you can use it again tomorrow after the daily quota resets.' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Converting Skeleton -->
    <Card v-else-if="isConverting" class="p-8 sm:p-14 text-center space-y-4">
      <div class="w-12 h-12 mx-auto rounded-xl bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-white animate-pulse">
        <RefreshCw class="w-6 h-6 animate-spin text-white" />
      </div>
      <div class="space-y-1.5">
        <div class="text-base font-semibold text-white">
          {{ locale === 'id' ? 'Menganalisis Dokumen dengan AI...' : 'Analyzing Document with AI...' }}
        </div>
        <p class="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
          {{ locale === 'id' ? 'Mengekstrak hierarki heading, tabel Markdown, rumus matematika, dan teks terstruktur.' : 'Extracting headings, Markdown tables, LaTeX equations, and document structure.' }}
        </p>
      </div>
    </Card>

    <!-- Error State -->
    <Card v-else-if="errorMsg && !convertedMarkdown" class="p-6 border-red-500/30 bg-red-500/5 space-y-3">
      <div class="flex items-start gap-3">
        <AlertCircle class="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div class="space-y-1 text-xs">
          <div class="font-semibold text-red-300">Conversion Error</div>
          <div class="text-[var(--text-secondary)]">{{ errorMsg }}</div>
        </div>
      </div>
      <div class="pt-2">
        <Button variant="secondary" class="h-8 px-3 text-xs" @click="resetWorkspace">
          Try Again / Upload Different File
        </Button>
      </div>
    </Card>

    <!-- Conversion Workspace (Split View) -->
    <div v-else-if="convertedMarkdown" class="space-y-4">
      <!-- Action Toolbar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#141416] border border-[#2E2E2E] rounded-[14px]">
        <!-- File Info & Stats -->
        <div class="flex items-center gap-3 text-xs font-mono text-[var(--text-secondary)] flex-wrap">
          <span class="text-white font-medium truncate max-w-xs" :title="selectedFile?.name">
            {{ selectedFile?.name || 'document' }}
          </span>
          <span class="text-zinc-600">•</span>
          <span>Words: <strong class="text-white">{{ stats.words }}</strong></span>
          <span class="text-zinc-600">•</span>
          <span>Characters: <strong class="text-white">{{ stats.chars }}</strong></span>
        </div>

        <!-- Toolbar Buttons -->
        <div class="flex items-center gap-2 flex-wrap">
          <!-- View Switcher -->
          <div class="flex items-center bg-[#1E1E22] p-0.5 rounded-md border border-[#2E2E2E]">
            <button
              class="px-2.5 py-1 text-xs rounded transition-colors flex items-center gap-1.5"
              :class="activeTab === 'preview' ? 'bg-[#2E2E2E] text-white font-medium' : 'text-[var(--text-tertiary)] hover:text-white'"
              @click="activeTab = 'preview'"
            >
              <Eye class="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
            <button
              class="px-2.5 py-1 text-xs rounded transition-colors flex items-center gap-1.5"
              :class="activeTab === 'raw' ? 'bg-[#2E2E2E] text-white font-medium' : 'text-[var(--text-tertiary)] hover:text-white'"
              @click="activeTab = 'raw'"
            >
              <Code2 class="w-3.5 h-3.5" />
              <span>Raw Markdown</span>
            </button>
          </div>

          <!-- Copy Button -->
          <Button
            id="btn-copy-markdown"
            variant="secondary"
            class="h-8 px-3 text-xs font-medium border-[#2E2E2E] flex items-center gap-1.5"
            @click="copyMarkdown"
          >
            <Check v-if="hasCopied" class="w-3.5 h-3.5 text-emerald-400" />
            <Copy v-else class="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <span>{{ hasCopied ? 'Copied' : 'Copy' }}</span>
          </Button>

          <!-- Download Button -->
          <Button
            id="btn-download-markdown"
            variant="primary"
            class="h-8 px-3 text-xs font-medium flex items-center gap-1.5"
            @click="downloadMarkdown"
          >
            <Download class="w-3.5 h-3.5" />
            <span>Download .md</span>
          </Button>

          <!-- Reset / New File -->
          <Button
            variant="ghost"
            class="h-8 px-2 text-xs text-[var(--text-tertiary)] hover:text-white"
            title="Upload another file"
            @click="resetWorkspace"
          >
            <X class="w-4 h-4" />
          </Button>
        </div>
      </div>

      <!-- Split Layout: Source Document vs Markdown Content -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <!-- Left Pane: Source Document (5 cols) -->
        <Card class="p-3 lg:col-span-5 space-y-2">
          <div class="flex items-center justify-between text-xs font-mono text-[var(--text-tertiary)] px-1">
            <span>Source Document</span>
            <span>{{ selectedFile?.type?.includes('pdf') ? 'PDF' : 'Image' }}</span>
          </div>

          <div class="rounded-lg overflow-hidden bg-[#141416] border border-[#2E2E2E] max-h-[650px] flex items-center justify-center relative overflow-y-auto">
            <!-- PDF Document Frame -->
            <iframe
              v-if="selectedFile?.type?.includes('pdf') && previewUrl"
              :src="previewUrl"
              class="w-full h-[550px] border-0"
            />

            <!-- Image Document -->
            <img
              v-else-if="previewUrl"
              :src="previewUrl"
              alt="Source document"
              class="w-full h-auto object-contain max-h-[550px] p-2"
            />
          </div>
        </Card>

        <!-- Right Pane: Converted Markdown (7 cols) -->
        <Card class="p-4 lg:col-span-7 space-y-3 min-h-[600px] flex flex-col">
          <!-- Rendered HTML Preview Mode -->
          <div
            v-if="activeTab === 'preview'"
            class="flex-1 overflow-y-auto max-h-[600px] text-xs text-[var(--text-primary)] leading-relaxed space-y-2 pr-2"
            v-html="renderedHtml"
          ></div>

          <!-- Raw Markdown Editable Mode -->
          <div v-else class="flex-1 flex flex-col space-y-2">
            <textarea
              v-model="convertedMarkdown"
              class="w-full flex-1 min-h-[550px] p-3 text-xs font-mono bg-[#141416] border border-[#2E2E2E] rounded-lg text-white focus:outline-none focus:border-zinc-500 resize-y leading-relaxed"
              placeholder="Markdown content..."
            ></textarea>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
