<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  FileCode,
  Upload,
  Copy,
  Check,
  Download,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sliders,
  ArrowRight,
  Eye,
  FolderOpen,
  Code
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

const toast = useToast()

// Mode switcher when entering SVG: 'upload' vs 'paste'
const inputMode = ref<'upload' | 'paste'>('upload')
const rawSvgInput = ref('')
const loadedFileName = ref<string>('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

const previewBg = ref<'grid' | 'dark' | 'light'>('grid')
const zoomLevel = ref(1)
const activeExportTab = ref<'svg' | 'vue' | 'react' | 'datauri' | 'png'>('svg')
const copiedFormat = ref<string | null>(null)
const pngScale = ref<number>(2)

// Optimization Options
const optRemoveComments = ref(true)
const optRemoveMetadata = ref(true)
const optCleanAttributes = ref(true)
const optRoundNumbers = ref(true)
const optMinifyWhitespace = ref(true)
const optRemoveIds = ref(false)

const SAMPLE_SVGS = {
  logo: `<svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:sketch="http://www.bohemiancoding.com/sketch/ns">
  <!-- Generator: Figma to Avttr Studio -->
  <defs>
    <linearGradient id="paint0_linear" x1="20" y1="20" x2="180" y2="180" gradientUnits="userSpaceOnUse">
      <stop stop-color="#3B82F6"/>
      <stop offset="1" stop-color="#8B5CF6"/>
    </linearGradient>
  </defs>
  <rect width="200" height="200" rx="40" fill="url(#paint0_linear)" sketch:type="MSShapeGroup"/>
  <path d="M60 140L100 60L140 140H118L100 102L82 140H60Z" fill="white" data-name="Glyph_A"/>
</svg>`,
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
</svg>`,
}

const loadSample = (type: 'logo' | 'icon') => {
  rawSvgInput.value = SAMPLE_SVGS[type]
  loadedFileName.value = `sample_${type}.svg`
  toast.info('Sample Loaded', `Loaded sample ${type} SVG`)
}

const handleFile = (file: File) => {
  if (!file.name.endsWith('.svg') && file.type !== 'image/svg+xml') {
    toast.error('Invalid File', 'Please upload a valid .svg file')
    return
  }

  const reader = new FileReader()
  reader.onload = (event) => {
    rawSvgInput.value = (event.target?.result as string) || ''
    loadedFileName.value = file.name
    toast.success('SVG Loaded', `${file.name} loaded successfully`)
  }
  reader.readAsText(file)
}

const handleFileUpload = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  handleFile(input.files[0])
  input.value = ''
}

const handleFileDrop = (e: DragEvent) => {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) {
    handleFile(file)
  }
}

// 100% Client-Side SVG Optimization Engine
const optimizeSvgCode = (svg: string): string => {
  if (!svg.trim() || !svg.includes('<svg')) return ''

  let result = svg.trim()

  // 1. Remove XML declaration & DOCTYPE
  result = result.replace(/<\?xml[^>]*\?>/gi, '')
  result = result.replace(/<!DOCTYPE[^>]*>/gi, '')

  // 2. Remove comments
  if (optRemoveComments.value) {
    result = result.replace(/<!--[\s\S]*?-->/g, '')
  }

  // 3. Remove metadata tags
  if (optRemoveMetadata.value) {
    result = result.replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
    result = result.replace(/<title[\s\S]*?<\/title>/gi, '')
    result = result.replace(/<desc[\s\S]*?<\/desc>/gi, '')
  }

  // 4. Remove bloat attributes (Figma, Illustrator, Sketch, Inkscape, Sodipodi)
  if (optCleanAttributes.value) {
    result = result.replace(/\s(xmlns:sketch|xmlns:inkscape|xmlns:sodipodi|sketch:type|data-name|inkscape:[a-z-]+|sodipodi:[a-z-]+)="[^"]*"/gi, '')
    result = result.replace(/\s(version)="1\.[01]"/gi, '')
    result = result.replace(/\s(id)="svg-[a-z0-9_.-]+"/gi, '')
    result = result.replace(/\s(xml:space)="preserve"/gi, '')
    result = result.replace(/\s(enable-background)="[^"]*"/gi, '')
  }

  // 5. Remove IDs if selected
  if (optRemoveIds.value) {
    result = result.replace(/\sid="[^"]*"/gi, '')
  }

  // 6. Round floating point numbers in path coordinates
  if (optRoundNumbers.value) {
    result = result.replace(/([0-9]+\.[0-9]{3,})/g, (match) => {
      const num = parseFloat(match)
      return isNaN(num) ? match : num.toFixed(2).replace(/\.?0+$/, '')
    })
  }

  // 7. Collapse & Minify Whitespace
  if (optMinifyWhitespace.value) {
    result = result
      .replace(/>\s+</g, '><')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s*([=,])\s*/g, '$1')
      .trim()
  }

  return result
}

const optimizedSvg = computed(() => {
  return optimizeSvgCode(rawSvgInput.value)
})

const originalBytes = computed(() => {
  return new TextEncoder().encode(rawSvgInput.value).length
})

const optimizedBytes = computed(() => {
  return new TextEncoder().encode(optimizedSvg.value).length
})

const savingsPercent = computed(() => {
  if (originalBytes.value === 0 || optimizedBytes.value === 0) return 0
  const diff = originalBytes.value - optimizedBytes.value
  return Math.max(0, Math.round((diff / originalBytes.value) * 100))
})

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Convert SVG to Vue 3 Component
const vueComponentCode = computed(() => {
  if (!optimizedSvg.value) return ''
  const innerSvg = optimizedSvg.value.replace(/<svg\b([^>]*)>/i, '<svg $1 :width="size || width" :height="size || height" :class="customClass">')
  return `<script setup lang="ts">
interface Props {
  size?: number | string
  width?: number | string
  height?: number | string
  customClass?: string
}

withDefaults(defineProps<Props>(), {
  size: 24,
  customClass: '',
})
<\/script>

<template>
  ${innerSvg}
</template>`
})

// Convert SVG to React Component
const reactComponentCode = computed(() => {
  if (!optimizedSvg.value) return ''
  const reactSvg = optimizedSvg.value
    .replace(/xmlns:xlink/g, 'xmlnsXlink')
    .replace(/xlink:href/g, 'xlinkHref')
    .replace(/fill-rule/g, 'fillRule')
    .replace(/clip-rule/g, 'clipRule')
    .replace(/stroke-width/g, 'strokeWidth')
    .replace(/stroke-linecap/g, 'strokeLinecap')
    .replace(/stroke-linejoin/g, 'strokeLinejoin')
    .replace(/stroke-miterlimit/g, 'strokeMiterlimit')

  return `import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const SvgIcon: React.FC<IconProps> = ({ size = 24, width, height, className = '', ...props }) => {
  return (
    ${reactSvg}
  );
};

export default SvgIcon;`
})

// Convert to CSS Data URI
const dataUriCode = computed(() => {
  if (!optimizedSvg.value) return ''
  const encoded = encodeURIComponent(optimizedSvg.value)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22')
  return `background-image: url("data:image/svg+xml,${encoded}");`
})

// Copy Helper
const handleCopy = (code: string, formatName: string) => {
  if (!code) return
  navigator.clipboard.writeText(code)
  copiedFormat.value = formatName
  toast.success('Copied to Clipboard', `Copied ${formatName} code successfully`)
  setTimeout(() => {
    copiedFormat.value = null
  }, 2000)
}

// Download Clean SVG File
const handleDownloadSvg = () => {
  if (!optimizedSvg.value) return
  const blob = new Blob([optimizedSvg.value], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = loadedFileName.value || 'optimized.svg'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  toast.success('Downloaded', 'Saved optimized SVG file')
}

// Download High-Res PNG via Canvas
const handleDownloadPng = async () => {
  if (!optimizedSvg.value) return
  try {
    const svgBlob = new Blob([optimizedSvg.value], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.src = url

    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })

    const scale = pngScale.value || 2
    const canvas = document.createElement('canvas')
    const width = (img.naturalWidth || 300) * scale
    const height = (img.naturalHeight || 300) * scale
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas context not available')

    ctx.drawImage(img, 0, 0, width, height)
    URL.revokeObjectURL(url)

    const pngUrl = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = pngUrl
    link.download = `${(loadedFileName.value || 'vector').replace(/\.[^/.]+$/, '')}_${scale}x.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success('PNG Exported', `Saved PNG image at ${width}x${height}px!`)
  } catch (err: any) {
    toast.error('PNG Export Failed', err.message || 'Could not export PNG')
  }
}

const clearSvg = () => {
  rawSvgInput.value = ''
  loadedFileName.value = ''
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
      <span class="text-white">SVG Optimizer</span>
    </div>

    <!-- Title Row with Client Privacy Badge -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          SVG Optimizer
        </h1>
        <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
          Clean Figma bloatware, minify path coordinates, preview interactively, and export to Vue 3, React JSX, or PNG.
        </p>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <Button
          v-if="optimizedSvg"
          variant="secondary"
          size="default"
          class="h-9 px-3.5 rounded-lg text-xs font-medium cursor-pointer"
          @click="clearSvg"
        >
          <FolderOpen class="w-3.5 h-3.5 mr-1.5 text-white/70" />
          <span>Upload Another</span>
        </Button>
        <Badge variant="badge">Client Privacy</Badge>
      </div>
    </div>

    <!-- State 1: Upload / Input Stage (When No SVG Loaded) -->
    <div v-if="!optimizedSvg" class="space-y-4">
      <!-- Mode Switcher Tabs (Consistent with HeroPasteBar) -->
      <div class="flex items-center px-0.5">
        <div class="flex items-center bg-[#171717] border border-[#262626] rounded-lg p-0.5">
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
            :class="inputMode === 'upload' ? 'bg-[#2E2E2E] text-white shadow-xs' : 'text-neutral-400 hover:text-white'"
            @click="inputMode = 'upload'"
          >
            <Upload class="w-3.5 h-3.5" />
            <span>Upload SVG File</span>
          </button>

          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
            :class="inputMode === 'paste' ? 'bg-[#2E2E2E] text-white shadow-xs' : 'text-neutral-400 hover:text-white'"
            @click="inputMode = 'paste'"
          >
            <Code class="w-3.5 h-3.5" />
            <span>Paste SVG Code</span>
          </button>
        </div>
      </div>

      <!-- Mode 1: Standardized Dropzone Upload Box -->
      <div
        v-if="inputMode === 'upload'"
        class="relative border-2 border-dashed rounded-[14px] p-8 sm:p-14 text-center transition-all cursor-pointer select-none border-[#2E2E2E] bg-[#141416] hover:border-[#3E3E3E]"
        :class="isDragging ? 'border-white bg-[var(--bg-card-hover)]' : ''"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleFileDrop"
        @click="fileInputRef?.click()"
      >
        <div class="max-w-md mx-auto space-y-3">
          <div class="w-12 h-12 mx-auto rounded-xl bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-white shadow-xs">
            <FileCode class="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 class="text-sm font-semibold text-[var(--text-primary)]">
              Drop your SVG file here or browse
            </h3>
            <p class="text-xs text-[var(--text-secondary)] mt-1">
              Supports .SVG and vector XML up to 10MB. 100% processed client-side.
            </p>
          </div>
        </div>

        <input
          ref="fileInputRef"
          type="file"
          accept=".svg,image/svg+xml"
          class="hidden"
          @change="handleFileUpload"
        />
      </div>

      <!-- Mode 2: Paste Raw SVG Code Box -->
      <div v-else class="space-y-3">
        <textarea
          v-model="rawSvgInput"
          rows="10"
          class="w-full p-4 bg-[#141416] border border-[#2E2E2E] rounded-xl text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-white/40 resize-none leading-relaxed transition-all focus:ring-2 focus:ring-white/10"
          placeholder="Paste your raw SVG code here (e.g. <svg viewBox=...>)..."
        />

        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="text-xs font-mono text-neutral-500">Quick Samples:</span>
            <button
              type="button"
              class="px-2.5 py-1 rounded-md bg-[#1F1F23] hover:bg-[#2A2A30] border border-white/10 text-xs font-mono text-white/80 hover:text-white cursor-pointer transition-colors"
              @click="loadSample('logo')"
            >
              Logo
            </button>
            <button
              type="button"
              class="px-2.5 py-1 rounded-md bg-[#1F1F23] hover:bg-[#2A2A30] border border-white/10 text-xs font-mono text-white/80 hover:text-white cursor-pointer transition-colors"
              @click="loadSample('icon')"
            >
              Icon
            </button>
          </div>

          <Button
            variant="secondary"
            size="default"
            class="h-10 rounded-xl font-medium text-xs cursor-pointer px-5"
            :disabled="!rawSvgInput.trim()"
            @click="optimizeSvgCode(rawSvgInput)"
          >
            <ArrowRight class="w-3.5 h-3.5 mr-1.5" />
            <span>Optimize SVG</span>
          </Button>
        </div>
      </div>
    </div>

    <!-- State 2: Active Workspace (When SVG Loaded) -->
    <div v-else class="space-y-5">
      <!-- Top Stats & Overview Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#141416] border border-[#262626]">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-white shrink-0">
            <FileCode class="w-4 h-4" />
          </div>
          <div>
            <div class="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
              {{ loadedFileName || 'Raw SVG Vector' }}
            </div>
            <div class="flex items-center gap-2 text-xs font-mono text-neutral-400 mt-0.5">
              <span>Original: {{ formatBytes(originalBytes) }}</span>
              <span>→</span>
              <span class="text-white font-semibold">Optimized: {{ formatBytes(optimizedBytes) }}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Badge variant="badge">
            -{{ savingsPercent }}% Saved
          </Badge>
          <Button
            variant="secondary"
            size="default"
            class="h-9 px-4 rounded-lg font-medium text-xs cursor-pointer"
            @click="handleDownloadSvg"
          >
            <Download class="w-3.5 h-3.5 mr-1.5" />
            <span>Download .SVG</span>
          </Button>
        </div>
      </div>

      <!-- Main Deck: 2 Columns Side-by-Side -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <!-- Left Column: Live Visual Canvas Area (6 cols) -->
        <div class="lg:col-span-6 rounded-xl bg-[#141416] border border-[#262626] p-4 sm:p-5 space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Eye class="w-4 h-4 text-white" />
              <span class="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Live Preview
              </span>
            </div>

            <!-- Background & Zoom Controls -->
            <div class="flex items-center gap-2">
              <!-- Bg Toggles -->
              <div class="flex items-center p-0.5 bg-[#171717] border border-[#262626] rounded-lg text-xs font-mono">
                <button
                  type="button"
                  class="px-2 py-0.5 rounded cursor-pointer transition-colors"
                  :class="previewBg === 'grid' ? 'bg-[#2E2E2E] text-white font-bold' : 'text-neutral-400 hover:text-white'"
                  title="Checkered Grid"
                  @click="previewBg = 'grid'"
                >
                  Grid
                </button>
                <button
                  type="button"
                  class="px-2 py-0.5 rounded cursor-pointer transition-colors"
                  :class="previewBg === 'dark' ? 'bg-[#2E2E2E] text-white font-bold' : 'text-neutral-400 hover:text-white'"
                  title="Dark Background"
                  @click="previewBg = 'dark'"
                >
                  Dark
                </button>
                <button
                  type="button"
                  class="px-2 py-0.5 rounded cursor-pointer transition-colors"
                  :class="previewBg === 'light' ? 'bg-white text-black font-bold' : 'text-neutral-400 hover:text-white'"
                  title="Light Background"
                  @click="previewBg = 'light'"
                >
                  Light
                </button>
              </div>

              <!-- Zoom Controls -->
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="p-1.5 text-neutral-400 hover:text-white rounded-md hover:bg-[#222226] cursor-pointer"
                  title="Zoom Out"
                  @click="zoomLevel = Math.max(0.5, zoomLevel - 0.25)"
                >
                  <ZoomOut class="w-3.5 h-3.5" />
                </button>
                <span class="text-[11px] font-mono text-neutral-400 w-9 text-center">
                  {{ Math.round(zoomLevel * 100) }}%
                </span>
                <button
                  type="button"
                  class="p-1.5 text-neutral-400 hover:text-white rounded-md hover:bg-[#222226] cursor-pointer"
                  title="Zoom In"
                  @click="zoomLevel = Math.min(3, zoomLevel + 0.25)"
                >
                  <ZoomIn class="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  class="p-1.5 text-neutral-400 hover:text-white rounded-md hover:bg-[#222226] cursor-pointer"
                  title="Reset Zoom"
                  @click="zoomLevel = 1"
                >
                  <RotateCcw class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <!-- Visual Canvas Screen -->
          <div
            class="h-80 rounded-xl overflow-hidden border border-[#212121] flex items-center justify-center relative select-none"
            :class="{
              'bg-[#121212] bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:16px_16px]': previewBg === 'grid',
              'bg-[#0e0e10]': previewBg === 'dark',
              'bg-white text-black': previewBg === 'light',
            }"
          >
            <div
              class="transition-transform duration-100 flex items-center justify-center p-6 max-w-full max-h-full"
              :style="{ transform: `scale(${zoomLevel})` }"
              v-html="optimizedSvg"
            />
          </div>

          <!-- Optimization Rules Toggles -->
          <div class="space-y-3 pt-1">
            <div class="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Sliders class="w-3.5 h-3.5" />
              <span>Optimization Rules</span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs text-neutral-300">
              <label class="flex items-center gap-2 cursor-pointer select-none hover:text-white">
                <input v-model="optRemoveComments" type="checkbox" class="accent-white rounded cursor-pointer" />
                <span>Strip Comments</span>
              </label>

              <label class="flex items-center gap-2 cursor-pointer select-none hover:text-white">
                <input v-model="optRemoveMetadata" type="checkbox" class="accent-white rounded cursor-pointer" />
                <span>Remove Metadata</span>
              </label>

              <label class="flex items-center gap-2 cursor-pointer select-none hover:text-white">
                <input v-model="optCleanAttributes" type="checkbox" class="accent-white rounded cursor-pointer" />
                <span>Clean Figma Bloat</span>
              </label>

              <label class="flex items-center gap-2 cursor-pointer select-none hover:text-white">
                <input v-model="optRoundNumbers" type="checkbox" class="accent-white rounded cursor-pointer" />
                <span>Round Precision</span>
              </label>

              <label class="flex items-center gap-2 cursor-pointer select-none hover:text-white">
                <input v-model="optMinifyWhitespace" type="checkbox" class="accent-white rounded cursor-pointer" />
                <span>Minify Spaces</span>
              </label>

              <label class="flex items-center gap-2 cursor-pointer select-none hover:text-white">
                <input v-model="optRemoveIds" type="checkbox" class="accent-white rounded cursor-pointer" />
                <span>Remove IDs</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Right Column: Code Export Studio (6 cols) -->
        <div class="lg:col-span-6 rounded-xl bg-[#141416] border border-[#262626] p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div class="space-y-3">
            <div class="flex items-center justify-between border-b border-[#262626] pb-3">
              <span class="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Export Formats
              </span>
              <span class="text-xs font-mono text-neutral-400">
                100% Client Generated
              </span>
            </div>

            <!-- Export Format Tabs -->
            <div class="flex items-center gap-1 overflow-x-auto pb-1">
              <button
                v-for="tab in ([
                  { id: 'svg', label: 'Clean SVG' },
                  { id: 'vue', label: 'Vue 3' },
                  { id: 'react', label: 'React JSX' },
                  { id: 'datauri', label: 'CSS Data URI' },
                  { id: 'png', label: 'PNG Image' }
                ] as const)"
                :key="tab.id"
                type="button"
                class="px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer whitespace-nowrap"
                :class="activeExportTab === tab.id ? 'bg-[#2E2E2E] text-white font-medium shadow-xs' : 'text-neutral-400 hover:text-white hover:bg-[#1f1f23]'"
                @click="activeExportTab = tab.id"
              >
                {{ tab.label }}
              </button>
            </div>

            <!-- Tab 1: Clean SVG -->
            <div v-if="activeExportTab === 'svg'" class="space-y-3">
              <pre class="p-3.5 bg-[#0e0e10] border border-[#262626] rounded-xl text-xs font-mono text-neutral-200 overflow-x-auto max-h-64 leading-relaxed select-all">{{ optimizedSvg }}</pre>
              <div class="grid grid-cols-2 gap-2">
                <Button variant="secondary" size="default" class="h-10 rounded-xl font-medium text-xs cursor-pointer" @click="handleCopy(optimizedSvg, 'SVG')">
                  <Check v-if="copiedFormat === 'SVG'" class="w-3.5 h-3.5 mr-1.5 text-white" />
                  <Copy v-else class="w-3.5 h-3.5 mr-1.5" />
                  <span>{{ copiedFormat === 'SVG' ? 'Copied SVG' : 'Copy SVG' }}</span>
                </Button>
                <Button variant="secondary" size="default" class="h-10 rounded-xl font-medium text-xs cursor-pointer" @click="handleDownloadSvg">
                  <Download class="w-3.5 h-3.5 mr-1.5" />
                  <span>Download .SVG</span>
                </Button>
              </div>
            </div>

            <!-- Tab 2: Vue 3 -->
            <div v-if="activeExportTab === 'vue'" class="space-y-3">
              <pre class="p-3.5 bg-[#0e0e10] border border-[#262626] rounded-xl text-xs font-mono text-neutral-200 overflow-x-auto max-h-64 leading-relaxed select-all">{{ vueComponentCode }}</pre>
              <Button variant="secondary" size="default" class="w-full h-10 rounded-xl font-medium text-xs cursor-pointer" @click="handleCopy(vueComponentCode, 'Vue 3')">
                <Check v-if="copiedFormat === 'Vue 3'" class="w-3.5 h-3.5 mr-1.5 text-white" />
                <Copy v-else class="w-3.5 h-3.5 mr-1.5" />
                <span>{{ copiedFormat === 'Vue 3' ? 'Copied Vue Component' : 'Copy Vue 3 Component (.vue)' }}</span>
              </Button>
            </div>

            <!-- Tab 3: React JSX -->
            <div v-if="activeExportTab === 'react'" class="space-y-3">
              <pre class="p-3.5 bg-[#0e0e10] border border-[#262626] rounded-xl text-xs font-mono text-neutral-200 overflow-x-auto max-h-64 leading-relaxed select-all">{{ reactComponentCode }}</pre>
              <Button variant="secondary" size="default" class="w-full h-10 rounded-xl font-medium text-xs cursor-pointer" @click="handleCopy(reactComponentCode, 'React JSX')">
                <Check v-if="copiedFormat === 'React JSX'" class="w-3.5 h-3.5 mr-1.5 text-white" />
                <Copy v-else class="w-3.5 h-3.5 mr-1.5" />
                <span>{{ copiedFormat === 'React JSX' ? 'Copied React Component' : 'Copy React Component (.tsx)' }}</span>
              </Button>
            </div>

            <!-- Tab 4: CSS Data URI -->
            <div v-if="activeExportTab === 'datauri'" class="space-y-3">
              <pre class="p-3.5 bg-[#0e0e10] border border-[#262626] rounded-xl text-xs font-mono text-neutral-200 overflow-x-auto max-h-64 leading-relaxed select-all">{{ dataUriCode }}</pre>
              <Button variant="secondary" size="default" class="w-full h-10 rounded-xl font-medium text-xs cursor-pointer" @click="handleCopy(dataUriCode, 'CSS Data URI')">
                <Check v-if="copiedFormat === 'CSS Data URI'" class="w-3.5 h-3.5 mr-1.5 text-white" />
                <Copy v-else class="w-3.5 h-3.5 mr-1.5" />
                <span>{{ copiedFormat === 'CSS Data URI' ? 'Copied Data URI' : 'Copy CSS Data URI' }}</span>
              </Button>
            </div>

            <!-- Tab 5: PNG Export -->
            <div v-if="activeExportTab === 'png'" class="space-y-3">
              <div class="flex items-center justify-between p-3 bg-[#18181b] border border-white/10 rounded-xl text-xs">
                <span class="text-neutral-400 font-medium">Export Scale:</span>
                <div class="flex items-center gap-1.5">
                  <button
                    v-for="sc in [1, 2, 4]"
                    :key="sc"
                    type="button"
                    class="px-2.5 py-1 rounded-lg text-xs font-mono cursor-pointer transition-colors"
                    :class="pngScale === sc ? 'bg-white text-black font-bold' : 'text-neutral-400 hover:text-white bg-[#222226]'"
                    @click="pngScale = sc"
                  >
                    {{ sc }}x
                  </button>
                </div>
              </div>

              <Button variant="secondary" size="default" class="w-full h-10 rounded-xl font-medium text-xs cursor-pointer" @click="handleDownloadPng">
                <Download class="w-3.5 h-3.5 mr-1.5" />
                <span>Download {{ pngScale }}x PNG Image</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
