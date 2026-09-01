<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Code,
  Upload,
  Copy,
  Check,
  Download,
  Trash2,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Sliders,
  FileCode,
  Layers,
  ArrowRight,
  Eye
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

const toast = useToast()

const rawSvgInput = ref('')
const previewBg = ref<'transparent' | 'dark' | 'light' | 'grid'>('grid')
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
  toast.info('Sample Loaded', `Loaded sample ${type} SVG`)
}

const handleFileUpload = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  const file = input.files[0]
  if (!file.name.endsWith('.svg') && file.type !== 'image/svg+xml') {
    toast.error('Invalid File', 'Please upload a valid .svg file')
    return
  }

  const reader = new FileReader()
  reader.onload = (event) => {
    rawSvgInput.value = (event.target?.result as string) || ''
    toast.success('SVG Loaded', `${file.name} loaded successfully`)
  }
  reader.readAsText(file)
  input.value = ''
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

  // 3. Remove metadata tags (e.g. <metadata>, <title>, <desc>, <sketch:type>)
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

  // 6. Round floating point numbers in path coordinates (e.g. 12.345678 -> 12.35)
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

// Convert SVG to React Component (convert kebab-case to camelCase attributes)
const reactComponentCode = computed(() => {
  if (!optimizedSvg.value) return ''
  let reactSvg = optimizedSvg.value
    .replace(/xmlns:xlink/g, 'xmlnsXlink')
    .replace(/xlink:href/g, 'xlinkHref')
    .replace(/fill-rule/g, 'fillRule')
    .replace(/clip-rule/g, 'clipRule')
    .replace(/stroke-width/g, 'strokeWidth')
    .replace(/stroke-linecap/g, 'strokeLinecap')
    .replace(/stroke-linejoin/g, 'strokeLinejoin')
    .replace(/stroke-miterlimit/g, 'strokeMiterlimit')
    .replace(/stop-color/g, 'stopColor')
    .replace(/stop-opacity/g, 'stopOpacity')
    .replace(/class=/g, 'className=')

  reactSvg = reactSvg.replace(/<svg\b([^>]*)>/i, '<svg $1 width={size || width} height={size || height} className={className} {...props}>')

  return `import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
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
  link.download = 'optimized_icon.svg'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  toast.success('Downloaded', 'Saved optimized_icon.svg')
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
    link.download = `optimized_svg_${scale}x.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success('PNG Exported', `Saved PNG image at ${width}x${height}px!`)
  } catch (err: any) {
    toast.error('PNG Export Failed', err.message || 'Could not export PNG')
  }
}
</script>

<template>
  <div class="space-y-6 max-w-6xl mx-auto pb-12">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
      <div class="space-y-1">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-white">
            <Sparkles class="w-4.5 h-4.5 text-white" />
          </div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            SVG Optimizer & Componentizer
          </h1>
        </div>
        <p class="text-xs sm:text-sm text-[var(--text-secondary)]">
          Clean Figma bloatware, minify path coordinates, preview interactively, and export to Vue 3, React JSX, or 4K PNG.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Badge variant="badge">
          100% Client-Side
        </Badge>
      </div>
    </div>

    <!-- Main Workspace (Two Column Side-by-Side) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left Column: Input & Options (5 cols) -->
      <div class="lg:col-span-5 space-y-4">
        <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Input Raw SVG Code
            </label>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="text-[11px] text-white/70 hover:text-white transition-colors cursor-pointer"
                @click="loadSample('logo')"
              >
                Sample Logo
              </button>
              <span class="text-[var(--text-tertiary)]">•</span>
              <button
                type="button"
                class="text-[11px] text-white/70 hover:text-white transition-colors cursor-pointer"
                @click="loadSample('icon')"
              >
                Sample Icon
              </button>
            </div>
          </div>

          <textarea
            v-model="rawSvgInput"
            rows="10"
            class="w-full p-3 bg-[#121212] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-white placeholder-[var(--text-tertiary)] focus:outline-none focus:border-white/40 resize-none leading-relaxed"
            placeholder="Paste your SVG code here (e.g. <svg viewBox=...)..."
          />

          <!-- Upload Button -->
          <div class="flex items-center justify-between pt-1">
            <label class="flex items-center gap-2 px-3 py-1.5 bg-[#171717] hover:bg-[#212121] border border-[var(--border-subtle)] rounded-md text-xs font-medium text-white cursor-pointer transition-colors">
              <Upload class="w-3.5 h-3.5" />
              <span>Upload .SVG File</span>
              <input
                type="file"
                accept=".svg,image/svg+xml"
                class="hidden"
                @change="handleFileUpload"
              />
            </label>

            <button
              v-if="rawSvgInput"
              type="button"
              class="text-xs text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1 cursor-pointer"
              @click="rawSvgInput = ''"
            >
              <Trash2 class="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </Card>

        <!-- Optimizer Configuration Toggles -->
        <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-3">
          <div class="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5">
            <Sliders class="w-3.5 h-3.5" />
            <span>Optimization Rules</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-[var(--text-secondary)]">
            <label class="flex items-center gap-2 cursor-pointer select-none hover:text-white">
              <input v-model="optRemoveComments" type="checkbox" class="accent-white rounded" />
              <span>Strip Comments</span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer select-none hover:text-white">
              <input v-model="optRemoveMetadata" type="checkbox" class="accent-white rounded" />
              <span>Remove Metadata</span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer select-none hover:text-white">
              <input v-model="optCleanAttributes" type="checkbox" class="accent-white rounded" />
              <span>Clean Figma Bloat</span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer select-none hover:text-white">
              <input v-model="optRoundNumbers" type="checkbox" class="accent-white rounded" />
              <span>Round Precision (2-dec)</span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer select-none hover:text-white">
              <input v-model="optMinifyWhitespace" type="checkbox" class="accent-white rounded" />
              <span>Minify Whitespace</span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer select-none hover:text-white">
              <input v-model="optRemoveIds" type="checkbox" class="accent-white rounded" />
              <span>Remove Unused IDs</span>
            </label>
          </div>
        </Card>
      </div>

      <!-- Right Column: Live Interactive Preview & Multi-Export (7 cols) -->
      <div class="lg:col-span-7 space-y-4">
        <!-- Live Visual Preview Window -->
        <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Eye class="w-4 h-4 text-white" />
              <span class="text-xs font-semibold text-[var(--text-primary)]">Live Visual Preview</span>
            </div>

            <!-- Background & Zoom Controls -->
            <div class="flex items-center gap-2">
              <!-- Bg Toggles -->
              <div class="flex items-center p-0.5 bg-[#121212] border border-[var(--border-subtle)] rounded-md text-[10px]">
                <button
                  type="button"
                  class="px-2 py-0.5 rounded cursor-pointer transition-colors"
                  :class="previewBg === 'grid' ? 'bg-[#2E2E2E] text-white' : 'text-[var(--text-tertiary)] hover:text-white'"
                  title="Checkered Grid"
                  @click="previewBg = 'grid'"
                >
                  Grid
                </button>
                <button
                  type="button"
                  class="px-2 py-0.5 rounded cursor-pointer transition-colors"
                  :class="previewBg === 'dark' ? 'bg-[#2E2E2E] text-white' : 'text-[var(--text-tertiary)] hover:text-white'"
                  title="Dark Background"
                  @click="previewBg = 'dark'"
                >
                  Dark
                </button>
                <button
                  type="button"
                  class="px-2 py-0.5 rounded cursor-pointer transition-colors"
                  :class="previewBg === 'light' ? 'bg-white text-black font-semibold' : 'text-[var(--text-tertiary)] hover:text-white'"
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
                  class="p-1 text-[var(--text-secondary)] hover:text-white rounded hover:bg-[var(--bg-card-hover)] cursor-pointer"
                  title="Zoom Out"
                  @click="zoomLevel = Math.max(0.5, zoomLevel - 0.25)"
                >
                  <ZoomOut class="w-3.5 h-3.5" />
                </button>
                <span class="text-[10px] font-mono text-[var(--text-tertiary)] w-8 text-center">{{ Math.round(zoomLevel * 100) }}%</span>
                <button
                  type="button"
                  class="p-1 text-[var(--text-secondary)] hover:text-white rounded hover:bg-[var(--bg-card-hover)] cursor-pointer"
                  title="Zoom In"
                  @click="zoomLevel = Math.min(3, zoomLevel + 0.25)"
                >
                  <ZoomIn class="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  class="p-1 text-[var(--text-secondary)] hover:text-white rounded hover:bg-[var(--bg-card-hover)] cursor-pointer"
                  title="Reset Zoom"
                  @click="zoomLevel = 1"
                >
                  <RotateCcw class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <!-- Visual Canvas Area -->
          <div
            class="h-60 rounded-lg overflow-hidden border border-[#212121] flex items-center justify-center relative select-none"
            :class="{
              'bg-[#121212] bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:16px_16px]': previewBg === 'grid',
              'bg-[#121212]': previewBg === 'dark',
              'bg-white text-black': previewBg === 'light',
            }"
          >
            <div
              v-if="optimizedSvg"
              class="transition-transform duration-100 flex items-center justify-center p-4 max-w-full max-h-full"
              :style="{ transform: `scale(${zoomLevel})` }"
              v-html="optimizedSvg"
            />
            <div v-else class="text-xs text-[var(--text-tertiary)] flex flex-col items-center gap-1.5">
              <FileCode class="w-6 h-6 opacity-40" />
              <span>Paste SVG code on the left to see live preview</span>
            </div>
          </div>

          <!-- Savings Banner -->
          <div v-if="optimizedSvg" class="flex items-center justify-between p-2.5 bg-[#121212] border border-[var(--border-subtle)] rounded-lg text-xs font-mono">
            <div class="flex items-center gap-3">
              <span class="text-[var(--text-tertiary)]">Original: <strong class="text-white">{{ formatBytes(originalBytes) }}</strong></span>
              <ArrowRight class="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
              <span class="text-[var(--text-tertiary)]">Optimized: <strong class="text-emerald-400">{{ formatBytes(optimizedBytes) }}</strong></span>
            </div>

            <Badge variant="primary" class="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
              -{{ savingsPercent }}% Saved
            </Badge>
          </div>
        </Card>

        <!-- Multi-Format Export Tabs & Code Box -->
        <Card v-if="optimizedSvg" class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-4">
          <!-- Format Switcher -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[var(--border-subtle)]">
            <button
              type="button"
              class="px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap"
              :class="activeExportTab === 'svg' ? 'bg-[#2E2E2E] text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
              @click="activeExportTab = 'svg'"
            >
              Clean SVG
            </button>
            <button
              type="button"
              class="px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap"
              :class="activeExportTab === 'vue' ? 'bg-[#2E2E2E] text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
              @click="activeExportTab = 'vue'"
            >
              Vue 3 Component
            </button>
            <button
              type="button"
              class="px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap"
              :class="activeExportTab === 'react' ? 'bg-[#2E2E2E] text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
              @click="activeExportTab = 'react'"
            >
              React JSX
            </button>
            <button
              type="button"
              class="px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap"
              :class="activeExportTab === 'datauri' ? 'bg-[#2E2E2E] text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
              @click="activeExportTab = 'datauri'"
            >
              CSS Data URI
            </button>
            <button
              type="button"
              class="px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap"
              :class="activeExportTab === 'png' ? 'bg-[#2E2E2E] text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
              @click="activeExportTab = 'png'"
            >
              PNG Image
            </button>
          </div>

          <!-- Code Box: SVG -->
          <div v-if="activeExportTab === 'svg'" class="space-y-3">
            <div class="relative">
              <pre class="p-3 bg-[#121212] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto max-h-40 leading-relaxed">{{ optimizedSvg }}</pre>
            </div>
            <div class="flex items-center gap-2">
              <Button variant="primary" size="sm" class="flex-1" @click="handleCopy(optimizedSvg, 'SVG')">
                <Check v-if="copiedFormat === 'SVG'" class="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                <Copy v-else class="w-3.5 h-3.5 mr-1.5" />
                <span>{{ copiedFormat === 'SVG' ? 'Copied SVG!' : 'Copy Clean SVG' }}</span>
              </Button>
              <Button variant="secondary" size="sm" @click="handleDownloadSvg">
                <Download class="w-3.5 h-3.5 mr-1.5" />
                <span>Download .SVG</span>
              </Button>
            </div>
          </div>

          <!-- Code Box: Vue 3 -->
          <div v-if="activeExportTab === 'vue'" class="space-y-3">
            <pre class="p-3 bg-[#121212] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-sky-400 overflow-x-auto max-h-40 leading-relaxed">{{ vueComponentCode }}</pre>
            <Button variant="primary" size="sm" class="w-full" @click="handleCopy(vueComponentCode, 'Vue 3')">
              <Check v-if="copiedFormat === 'Vue 3'" class="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              <Copy v-else class="w-3.5 h-3.5 mr-1.5" />
              <span>{{ copiedFormat === 'Vue 3' ? 'Copied Vue Component!' : 'Copy Vue 3 Component (.vue)' }}</span>
            </Button>
          </div>

          <!-- Code Box: React JSX -->
          <div v-if="activeExportTab === 'react'" class="space-y-3">
            <pre class="p-3 bg-[#121212] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-indigo-400 overflow-x-auto max-h-40 leading-relaxed">{{ reactComponentCode }}</pre>
            <Button variant="primary" size="sm" class="w-full" @click="handleCopy(reactComponentCode, 'React JSX')">
              <Check v-if="copiedFormat === 'React JSX'" class="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              <Copy v-else class="w-3.5 h-3.5 mr-1.5" />
              <span>{{ copiedFormat === 'React JSX' ? 'Copied React Component!' : 'Copy React Component (.tsx)' }}</span>
            </Button>
          </div>

          <!-- Code Box: CSS Data URI -->
          <div v-if="activeExportTab === 'datauri'" class="space-y-3">
            <pre class="p-3 bg-[#121212] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-amber-400 overflow-x-auto max-h-40 leading-relaxed">{{ dataUriCode }}</pre>
            <Button variant="primary" size="sm" class="w-full" @click="handleCopy(dataUriCode, 'CSS Data URI')">
              <Check v-if="copiedFormat === 'CSS Data URI'" class="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              <Copy v-else class="w-3.5 h-3.5 mr-1.5" />
              <span>{{ copiedFormat === 'CSS Data URI' ? 'Copied Data URI!' : 'Copy CSS Data URI' }}</span>
            </Button>
          </div>

          <!-- Code Box: PNG Export -->
          <div v-if="activeExportTab === 'png'" class="space-y-3">
            <div class="flex items-center justify-between p-3 bg-[#121212] border border-[var(--border-subtle)] rounded-lg text-xs">
              <span class="text-[var(--text-secondary)] font-medium">Export Resolution:</span>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="px-2.5 py-1 rounded text-xs font-mono cursor-pointer transition-colors"
                  :class="pngScale === 1 ? 'bg-[#2E2E2E] text-white font-bold' : 'text-[var(--text-tertiary)] hover:text-white'"
                  @click="pngScale = 1"
                >
                  1x Standard
                </button>
                <button
                  type="button"
                  class="px-2.5 py-1 rounded text-xs font-mono cursor-pointer transition-colors"
                  :class="pngScale === 2 ? 'bg-[#2E2E2E] text-white font-bold' : 'text-[var(--text-tertiary)] hover:text-white'"
                  @click="pngScale = 2"
                >
                  2x HD (Retina)
                </button>
                <button
                  type="button"
                  class="px-2.5 py-1 rounded text-xs font-mono cursor-pointer transition-colors"
                  :class="pngScale === 4 ? 'bg-[#2E2E2E] text-white font-bold' : 'text-[var(--text-tertiary)] hover:text-white'"
                  @click="pngScale = 4"
                >
                  4x Ultra HD
                </button>
              </div>
            </div>

            <Button variant="primary" size="sm" class="w-full" @click="handleDownloadPng">
              <Download class="w-3.5 h-3.5 mr-1.5" />
              <span>Download High-Res PNG Image</span>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
