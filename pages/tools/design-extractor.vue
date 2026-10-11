<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Globe,
  Search,
  Copy,
  Check,
  Download,
  Layers,
  Palette,
  Type,
  Box,
  Code,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Sliders,
  Cpu,
  FileText,
  Clipboard,
  X
} from 'lucide-vue-next'
import Prism from 'prismjs'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-markdown'

import { useToast } from '~/composables/useToast'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'
import Input from '~/components/ui/Input.vue'
import type { ExtractedDesignData, ColorToken } from '~/server/utils/designExtractor'

const toast = useToast()

const inputUrl = ref('')
const isLoading = ref(false)
const errorMsg = ref('')
const extractedData = ref<ExtractedDesignData | null>(null)
const previewFontSize = ref(20)
const previewText = ref('The quick brown fox jumps over the lazy dog')

type ActiveTab = 'palette' | 'typography' | 'geometry' | 'stack' | 'export'
type ExportFormat = 'designMd' | 'techStackMd' | 'tailwindCss' | 'shadcnCss' | 'dtcgJson'

const activeTab = ref<ActiveTab>('palette')
const exportFormat = ref<ExportFormat>('designMd')
const isCopied = ref(false)

const handlePaste = async () => {
  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      inputUrl.value = text.trim()
    }
  } catch {
    toast.error('Clipboard access denied', 'Paste the URL manually into the field.')
  }
}

const handleExtract = async () => {
  const target = inputUrl.value.trim()
  if (!target) {
    toast.warning('URL Required', 'Please enter a website URL.')
    return
  }

  isLoading.value = true
  errorMsg.value = ''

  try {
    const res = await $fetch<{
      success: boolean
      data?: ExtractedDesignData
      error?: string
      aiUsed?: boolean
      aiFallback?: boolean
      aiError?: string
    }>('/api/tools/extract-design', {
      method: 'POST',
      body: { url: target },
    })

    if (res.success && res.data) {
      extractedData.value = res.data
      if (res.aiFallback) {
        toast.warning(
          'Groq AI Limit Reached',
          'Rate limit (429) hit. Successfully generated full Dembrandt spec via local deterministic engine.'
        )
      } else if (res.aiUsed) {
        toast.success(
          'Dembrandt Spec Synthesized',
          `Generated via Qwen 3.8-27B on Groq for ${res.data.metadata.hostname}`
        )
      } else {
        toast.success('Tokens Extracted', `Parsed tokens from ${res.data.metadata.hostname}`)
      }
    } else {
      errorMsg.value = res.error || 'Failed to extract design tokens from the website.'
      toast.error('Extraction Failed', errorMsg.value)
    }
  } catch (err: any) {
    errorMsg.value = err.data?.message || err.message || 'Network error occurred while fetching site.'
    toast.error('Request Error', errorMsg.value)
  } finally {
    isLoading.value = false
  }
}

const copyToClipboard = async (text: string, label: string = 'Copied') => {
  try {
    await navigator.clipboard.writeText(text)
    isCopied.value = true
    toast.success('Copied', `${label} copied to clipboard`)
    setTimeout(() => {
      isCopied.value = false
    }, 2000)
  } catch {
    toast.error('Copy Failed', 'Could not access clipboard')
  }
}

const downloadFile = (filename: string, content: string, mime: string) => {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  toast.success('Downloaded', `Saved ${filename}`)
}

const currentExportContent = computed(() => {
  if (!extractedData.value) return ''
  switch (exportFormat.value) {
    case 'designMd':
      return extractedData.value.exports.designMd
    case 'techStackMd':
      return extractedData.value.exports.techStackMd
    case 'tailwindCss':
      return extractedData.value.exports.tailwindCss
    case 'shadcnCss':
      return extractedData.value.exports.shadcnCss
    case 'dtcgJson':
      return extractedData.value.exports.dtcgJson
    default:
      return ''
  }
})

const currentExportFilename = computed(() => {
  const host = extractedData.value?.metadata.hostname || 'site'
  switch (exportFormat.value) {
    case 'designMd':
      return `DESIGN-${host}.md`
    case 'techStackMd':
      return `TECHSTACK-${host}.md`
    case 'tailwindCss':
      return `theme-${host}.css`
    case 'shadcnCss':
      return `shadcn-theme-${host}.css`
    case 'dtcgJson':
      return `tokens-${host}.json`
    default:
      return 'tokens.txt'
  }
})

const highlightedExportCode = computed(() => {
  const code = currentExportContent.value
  if (!code) return ''
  try {
    let grammar = Prism.languages.markdown
    let lang = 'markdown'
    if (exportFormat.value === 'tailwindCss' || exportFormat.value === 'shadcnCss') {
      grammar = Prism.languages.css
      lang = 'css'
    } else if (exportFormat.value === 'dtcgJson') {
      grammar = Prism.languages.json
      lang = 'json'
    }
    return Prism.highlight(code, grammar, lang)
  } catch {
    return code
  }
})

const getRoleBadgeVariant = (role: ColorToken['role']) => {
  switch (role) {
    case 'background': return 'badge'
    case 'foreground': return 'primary'
    case 'accent': return 'secondary'
    case 'border': return 'outline'
    default: return 'ghost'
  }
}
</script>

<template>
  <div class="space-y-6 pb-12 w-full">
    <!-- Header & Breadcrumbs -->
    <div class="space-y-2">
      <div class="flex items-center gap-2 text-xs text-[var(--text-tertiary)] font-mono">
        <NuxtLink to="/" class="hover:text-[var(--text-primary)] transition-colors">Dashboard</NuxtLink>
        <span>/</span>
        <span class="text-[var(--text-secondary)] font-medium">Developer</span>
        <span>/</span>
        <span class="text-[var(--text-primary)]">Web Design & Token Extractor</span>
      </div>

      <div class="space-y-1">
        <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          Web Design & Token Extractor
        </h1>
        <p class="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
          Reverse-engineer any website into design tokens, typography, color palettes, detected tech stack, and ready-to-use DESIGN.md or Tailwind theme.
        </p>
      </div>
    </div>

    <!-- Standardized Omnibar (HeroPasteBar Standard) -->
    <div class="flex flex-col sm:flex-row items-center gap-2.5 w-full">
      <div class="relative w-full flex-1 flex items-center">
        <div class="absolute left-3.5 flex items-center justify-center pointer-events-none text-[var(--text-tertiary)]">
          <Globe class="w-4 h-4" />
        </div>
        <input
          id="design-url-input"
          v-model="inputUrl"
          type="url"
          placeholder="https://example.com or paste any website URL..."
          class="w-full h-12 pl-10 pr-20 bg-white dark:bg-[#171717] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] border border-zinc-200 dark:border-[#2E2E2E] focus:border-zinc-400 dark:focus:border-white/40 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 disabled:opacity-50 shadow-xs font-mono"
          :disabled="isLoading"
          @keydown.enter="handleExtract"
        />
        <div class="absolute right-2.5 flex items-center gap-1">
          <button
            v-if="inputUrl"
            type="button"
            title="Clear input"
            aria-label="Clear input"
            class="p-1.5 text-zinc-400 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-95"
            @click="inputUrl = ''"
          >
            <X class="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Paste from clipboard"
            aria-label="Paste from clipboard"
            class="p-1.5 text-zinc-400 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-95"
            @click="handlePaste"
          >
            <Clipboard class="w-4 h-4" />
          </button>
        </div>
      </div>

      <Button
        id="btn-extract-tokens"
        variant="primary"
        size="default"
        class="w-full sm:w-auto shrink-0 h-12 px-5 rounded-xl font-medium text-xs sm:text-sm cursor-pointer"
        :loading="isLoading"
        :disabled="isLoading || !inputUrl.trim()"
        @click="handleExtract"
      >
        <Search v-if="!isLoading" class="w-4 h-4 mr-1.5" />
        <span>{{ isLoading ? 'Extracting...' : 'Extract Tokens' }}</span>
      </Button>
    </div>

    <!-- Loading State -->
    <Card v-if="isLoading" class="p-8 sm:p-12 text-center bg-[var(--bg-card)] border border-[var(--border-card)] space-y-3">
      <div class="w-10 h-10 mx-auto rounded-full bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)]">
        <RefreshCw class="w-5 h-5 animate-spin" />
      </div>
      <h3 class="text-sm font-semibold text-[var(--text-primary)]">
        Extracting design tokens and styles
      </h3>
      <p class="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
        Fetching HTML, parsing inline and external stylesheets, measuring relative luminance, and matching framework signatures.
      </p>
    </Card>

    <!-- Error State -->
    <div
      v-else-if="errorMsg"
      class="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-200 flex items-start gap-3 transition-all text-xs"
    >
      <AlertCircle class="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
      <div class="space-y-0.5">
        <div class="font-semibold text-sm">Extraction failed</div>
        <p class="leading-relaxed opacity-90">{{ errorMsg }}</p>
      </div>
    </div>

    <!-- Empty Initial State: 4 Capability Cards (Standardized with Link Bypasser) -->
    <div v-else-if="!extractedData" class="space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- 1. Color Palette -->
        <Card :hoverable="false" class="p-4 space-y-2">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)]">
              <Palette class="w-3.5 h-3.5" />
            </div>
            <h3 class="text-xs font-semibold text-[var(--text-primary)]">Token & Palette Extractor</h3>
          </div>
          <p class="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            Extracts HEX, RGB, HSL, and OKLCH color values, clusters semantic roles, and parses CSS variables.
          </p>
          <div class="flex flex-wrap gap-1 pt-1">
            <Badge variant="badge" size="sm">HEX / OKLCH</Badge>
            <Badge variant="badge" size="sm">CSS Vars</Badge>
            <Badge variant="badge" size="sm">Roles</Badge>
          </div>
        </Card>

        <!-- 2. Typography & Fonts -->
        <Card :hoverable="false" class="p-4 space-y-2">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)]">
              <Type class="w-3.5 h-3.5" />
            </div>
            <h3 class="text-xs font-semibold text-[var(--text-primary)]">Typography Hierarchy</h3>
          </div>
          <p class="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            Identifies Google Fonts links, @font-face declarations, font weights, font sizes, and line-height scales.
          </p>
          <div class="flex flex-wrap gap-1 pt-1">
            <Badge variant="badge" size="sm">Google Fonts</Badge>
            <Badge variant="badge" size="sm">Web Fonts</Badge>
            <Badge variant="badge" size="sm">Font Scales</Badge>
          </div>
        </Card>

        <!-- 3. WCAG Contrast Check -->
        <Card :hoverable="false" class="p-4 space-y-2">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)]">
              <ShieldCheck class="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <h3 class="text-xs font-semibold text-[var(--text-primary)]">WCAG AA Contrast Check</h3>
          </div>
          <p class="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            Calculates relative luminance and strict contrast ratios against the dominant background canvas.
          </p>
          <div class="flex flex-wrap gap-1 pt-1">
            <Badge variant="badge" size="sm">Pass AA (4.5:1)</Badge>
            <Badge variant="badge" size="sm">AA Large (3.0:1)</Badge>
            <Badge variant="badge" size="sm">AAA</Badge>
          </div>
        </Card>

        <!-- 4. Tech Stack & 1-Click Export -->
        <Card :hoverable="false" class="p-4 space-y-2">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)]">
              <Code class="w-3.5 h-3.5" />
            </div>
            <h3 class="text-xs font-semibold text-[var(--text-primary)]">Tech Stack & Export</h3>
          </div>
          <p class="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            Detects frameworks and styling, generating ready-to-use DESIGN.md, TECHSTACK.md, and Tailwind themes.
          </p>
          <div class="flex flex-wrap gap-1 pt-1">
            <Badge variant="badge" size="sm">DESIGN.md</Badge>
            <Badge variant="badge" size="sm">Tailwind v4</Badge>
            <Badge variant="badge" size="sm">shadcn/ui</Badge>
          </div>
        </Card>
      </div>
    </div>

    <!-- Results Workspace -->
    <div v-else class="space-y-6">
      <!-- Target Site Summary & Tech Stack Chips -->
      <Card class="p-5 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-start gap-3 min-w-0">
            <img
              v-if="extractedData.metadata.favicon"
              :src="extractedData.metadata.favicon"
              alt="Favicon"
              class="w-6 h-6 rounded-xs shrink-0 mt-0.5 object-contain"
              @error="($event.target as HTMLElement).style.display = 'none'"
            />
            <div class="min-w-0">
              <h2 class="text-base font-bold text-[var(--text-primary)] truncate">
                {{ extractedData.metadata.title }}
              </h2>
              <a
                :href="extractedData.metadata.url"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors font-mono"
              >
                <span>{{ extractedData.metadata.hostname }}</span>
                <ExternalLink class="w-3 h-3" />
              </a>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <Badge v-if="extractedData.aiUsed" variant="primary">
              Qwen 3.8-27B
            </Badge>
            <Badge v-else-if="extractedData.aiFallback" variant="outline">
              Local Engine
            </Badge>
            <Badge variant="outline">
              {{ extractedData.colors.palette.length }} Colors
            </Badge>
            <Badge variant="outline">
              {{ extractedData.typography.fonts.length }} Fonts
            </Badge>
            <Badge variant="badge">
              {{ extractedData.techStack.length }} Tech Detected
            </Badge>
          </div>
        </div>

        <p v-if="extractedData.metadata.description" class="text-xs text-[var(--text-secondary)] line-clamp-2">
          {{ extractedData.metadata.description }}
        </p>

        <!-- Quick Tech Stack Chips Row (Separated overview) -->
        <div v-if="extractedData.techStack.length > 0" class="pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-2">
          <span class="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)] mr-1">
            Detected Stack:
          </span>
          <button
            v-for="item in extractedData.techStack"
            :key="item.name"
            type="button"
            class="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--border-card-hover)] transition-all cursor-pointer inline-flex items-center gap-1.5"
            @click="activeTab = 'stack'"
          >
            <Cpu class="w-3 h-3 text-[var(--text-secondary)]" />
            <span>{{ item.name }}</span>
            <span class="text-[10px] text-[var(--text-tertiary)] font-mono">({{ item.category }})</span>
          </button>
        </div>
      </Card>

      <!-- Navigation Tabs -->
      <div class="flex items-center gap-1.5 border-b border-[var(--border-subtle)] pb-2 overflow-x-auto">
        <button
          type="button"
          class="px-3.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 cursor-pointer shrink-0"
          :class="activeTab === 'palette' ? 'bg-[var(--bg-card-hover)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
          @click="activeTab = 'palette'"
        >
          <Palette class="w-4 h-4" />
          <span>Color Palette</span>
          <span class="text-[10px] opacity-70">({{ extractedData.colors.palette.length }})</span>
        </button>

        <button
          type="button"
          class="px-3.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 cursor-pointer shrink-0"
          :class="activeTab === 'typography' ? 'bg-[var(--bg-card-hover)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
          @click="activeTab = 'typography'"
        >
          <Type class="w-4 h-4" />
          <span>Typography</span>
          <span class="text-[10px] opacity-70">({{ extractedData.typography.fonts.length }})</span>
        </button>

        <button
          type="button"
          class="px-3.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 cursor-pointer shrink-0"
          :class="activeTab === 'geometry' ? 'bg-[var(--bg-card-hover)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
          @click="activeTab = 'geometry'"
        >
          <Box class="w-4 h-4" />
          <span>Geometry & Elevation</span>
        </button>

        <button
          type="button"
          class="px-3.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 cursor-pointer shrink-0"
          :class="activeTab === 'stack' ? 'bg-[var(--bg-card-hover)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
          @click="activeTab = 'stack'"
        >
          <Cpu class="w-4 h-4" />
          <span>Tech Stack</span>
          <span class="text-[10px] opacity-70">({{ extractedData.techStack.length }})</span>
        </button>

        <button
          type="button"
          class="px-3.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 cursor-pointer shrink-0"
          :class="activeTab === 'export' ? 'bg-[var(--bg-card-hover)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
          @click="activeTab = 'export'"
        >
          <Code class="w-4 h-4" />
          <span>Code Export</span>
        </button>
      </div>

      <!-- Tab 1: Color Palette -->
      <div v-if="activeTab === 'palette'" class="space-y-6">
        <!-- Dominant Archetypes -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-2">
            <div class="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">
              Background Archetype
            </div>
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-lg border border-[var(--border-subtle)] shrink-0 shadow-xs"
                :style="{ backgroundColor: extractedData.colors.dominantBackground }"
              />
              <div class="min-w-0">
                <div class="text-sm font-mono font-bold text-[var(--text-primary)]">
                  {{ extractedData.colors.dominantBackground }}
                </div>
                <div class="text-[11px] text-[var(--text-secondary)]">
                  Primary canvas surface
                </div>
              </div>
            </div>
          </Card>

          <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-2">
            <div class="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">
              Foreground Archetype
            </div>
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-lg border border-[var(--border-subtle)] shrink-0 shadow-xs"
                :style="{ backgroundColor: extractedData.colors.dominantForeground }"
              />
              <div class="min-w-0">
                <div class="text-sm font-mono font-bold text-[var(--text-primary)]">
                  {{ extractedData.colors.dominantForeground }}
                </div>
                <div class="text-[11px] text-[var(--text-secondary)]">
                  Primary typography color
                </div>
              </div>
            </div>
          </Card>

          <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-2">
            <div class="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">
              Accent Archetype
            </div>
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-lg border border-[var(--border-subtle)] shrink-0 shadow-xs"
                :style="{ backgroundColor: extractedData.colors.accentColor }"
              />
              <div class="min-w-0">
                <div class="text-sm font-mono font-bold text-[var(--text-primary)]">
                  {{ extractedData.colors.accentColor }}
                </div>
                <div class="text-[11px] text-[var(--text-secondary)]">
                  Interactive brand accent
                </div>
              </div>
            </div>
          </Card>
        </div>

        <!-- Color Swatches Grid -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-[var(--text-primary)]">
              Extracted Colors & WCAG AA Ratios
            </h3>
            <span class="text-xs text-[var(--text-secondary)]">
              Evaluated against dominant background ({{ extractedData.colors.dominantBackground }})
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Card
              v-for="color in extractedData.colors.palette"
              :key="color.hex"
              class="p-3.5 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-3 hover:border-[var(--border-card-hover)] transition-all"
            >
              <div
                class="w-full h-14 rounded-lg border border-[var(--border-subtle)] flex items-end justify-end p-2 cursor-pointer shadow-xs"
                :style="{ backgroundColor: color.hex }"
                @click="copyToClipboard(color.hex, color.hex)"
              >
                <span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/60 text-white backdrop-blur-xs">
                  Copy
                </span>
              </div>

              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="font-mono text-xs font-bold text-[var(--text-primary)]">
                    {{ color.hex }}
                  </span>
                  <Badge :variant="getRoleBadgeVariant(color.role)">
                    {{ color.role }}
                  </Badge>
                </div>

                <div class="text-[11px] font-mono text-[var(--text-secondary)] truncate">
                  {{ color.rgb }}
                </div>

                <!-- WCAG AA Badge -->
                <div v-if="color.contrastWithBg" class="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                  <span class="text-[11px] text-[var(--text-secondary)] font-mono">
                    {{ color.contrastWithBg.ratio }}:1
                  </span>
                  <span
                    v-if="color.contrastWithBg.passesAA"
                    class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  >
                    Pass AA
                  </span>
                  <span
                    v-else-if="color.contrastWithBg.passesAALarge"
                    class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  >
                    AA Large
                  </span>
                  <span
                    v-else
                    class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                  >
                    Below AA
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <!-- Tab 2: Typography -->
      <div v-if="activeTab === 'typography'" class="space-y-6">
        <!-- Detected Fonts -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            v-for="font in extractedData.typography.fonts"
            :key="font.name"
            class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-3"
          >
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-sm font-bold text-[var(--text-primary)]">
                  {{ font.name }}
                </h4>
                <span class="text-xs text-[var(--text-secondary)] uppercase font-mono">
                  {{ font.category }} • {{ font.source }}
                </span>
              </div>
              <Badge variant="outline">
                Weights: {{ font.weights.join(', ') }}
              </Badge>
            </div>

            <div
              class="p-3 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
              :style="{ fontFamily: font.name }"
            >
              <div class="text-base truncate">
                Sphinx of black quartz, judge my vow.
              </div>
              <div class="text-xs opacity-75 mt-1 font-mono">
                ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789
              </div>
            </div>
          </Card>
        </div>

        <!-- Live Font Tester -->
        <Card class="p-5 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 class="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Sliders class="w-4 h-4 text-[var(--text-secondary)]" />
              <span>Interactive Font Tester</span>
            </h3>
            <div class="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
              <span>Size: {{ previewFontSize }}px</span>
              <input
                v-model="previewFontSize"
                type="range"
                min="12"
                max="48"
                class="w-28 accent-[var(--text-primary)]"
              />
            </div>
          </div>

          <Input
            id="font-tester-input"
            v-model="previewText"
            size="sm"
            placeholder="Type sample text..."
            class="text-xs"
          />

          <div
            class="p-5 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[var(--text-primary)] transition-all overflow-x-auto"
            :style="{
              fontFamily: extractedData.typography.primaryFont,
              fontSize: `${previewFontSize}px`,
            }"
          >
            {{ previewText || 'Preview text here' }}
          </div>
        </Card>

        <!-- Detected Scales -->
        <div v-if="extractedData.typography.fontSizes.length > 0" class="space-y-2">
          <h4 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            Detected Font Sizes
          </h4>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="s in extractedData.typography.fontSizes"
              :key="s"
              class="px-3 py-1 rounded-md text-xs font-mono bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            >
              {{ s }}
            </span>
          </div>
        </div>
      </div>

      <!-- Tab 3: Geometry & Elevation -->
      <div v-if="activeTab === 'geometry'" class="space-y-6">
        <!-- Radii -->
        <div class="space-y-3">
          <h3 class="text-sm font-bold text-[var(--text-primary)]">
            Border Radii Tokens
          </h3>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card
              v-for="r in (extractedData.geometry.radii.length ? extractedData.geometry.radii : ['4px', '8px', '14px', '9999px'])"
              :key="r"
              class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] text-center space-y-3"
            >
              <div
                class="w-16 h-16 mx-auto bg-[var(--bg-app)] border-2 border-[var(--text-secondary)] shadow-xs transition-all"
                :style="{ borderRadius: r }"
              />
              <div class="font-mono text-xs font-bold text-[var(--text-primary)]">
                {{ r }}
              </div>
            </Card>
          </div>
        </div>

        <!-- Shadows -->
        <div v-if="extractedData.geometry.shadows.length > 0" class="space-y-3">
          <h3 class="text-sm font-bold text-[var(--text-primary)]">
            Elevation & Box Shadows
          </h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card
              v-for="(s, idx) in extractedData.geometry.shadows"
              :key="idx"
              class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-3"
            >
              <div
                class="h-16 rounded-lg bg-[var(--bg-card)] flex items-center justify-center text-xs text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                :style="{ boxShadow: s }"
              >
                Elevation Level {{ idx + 1 }}
              </div>
              <div class="text-[11px] font-mono text-[var(--text-tertiary)] truncate">
                {{ s }}
              </div>
            </Card>
          </div>
        </div>
      </div>

      <!-- Tab 4: Tech Stack (Dedicated per user request) -->
      <div v-if="activeTab === 'stack'" class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-bold text-[var(--text-primary)]">
              Detected Tech Stack Breakdown
            </h3>
            <p class="text-xs text-[var(--text-secondary)] mt-0.5">
              Identified through DOM signatures, asset structures, and HTTP response headers.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            class="gap-1.5 text-xs cursor-pointer"
            @click="exportFormat = 'techStackMd'; activeTab = 'export'"
          >
            <FileText class="w-3.5 h-3.5" />
            <span>Export TECHSTACK.md</span>
          </Button>
        </div>

        <div v-if="extractedData.techStack.length === 0" class="p-8 text-center bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl text-xs text-[var(--text-secondary)]">
          No distinctive framework or library signatures detected on this target.
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            v-for="item in extractedData.techStack"
            :key="item.name"
            class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-2 hover:border-[var(--border-card-hover)] transition-all"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)]">
                  <Cpu class="w-4 h-4" />
                </div>
                <div>
                  <h4 class="text-sm font-bold text-[var(--text-primary)]">
                    {{ item.name }}
                  </h4>
                  <span class="text-[11px] uppercase tracking-wider font-mono text-[var(--text-tertiary)]">
                    {{ item.category }}
                  </span>
                </div>
              </div>
              <Badge variant="outline">
                {{ item.confidence }} confidence
              </Badge>
            </div>

            <p class="text-xs text-[var(--text-secondary)] pt-1 border-t border-[var(--border-subtle)]">
              {{ item.evidence }}
            </p>
          </Card>
        </div>
      </div>

      <!-- Tab 5: Code Export -->
      <div v-if="activeTab === 'export'" class="space-y-4">
        <!-- Export Format Selector Row -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-1.5">
            <Button
              :variant="exportFormat === 'designMd' ? 'primary' : 'secondary'"
              size="sm"
              class="text-xs"
              @click="exportFormat = 'designMd'"
            >
              DESIGN.md (Dembrandt Spec)
            </Button>
            <Button
              :variant="exportFormat === 'techStackMd' ? 'primary' : 'secondary'"
              size="sm"
              class="text-xs"
              @click="exportFormat = 'techStackMd'"
            >
              TECHSTACK.md
            </Button>
            <Button
              :variant="exportFormat === 'tailwindCss' ? 'primary' : 'secondary'"
              size="sm"
              class="text-xs"
              @click="exportFormat = 'tailwindCss'"
            >
              Tailwind v4 (@theme)
            </Button>
            <Button
              :variant="exportFormat === 'shadcnCss' ? 'primary' : 'secondary'"
              size="sm"
              class="text-xs"
              @click="exportFormat = 'shadcnCss'"
            >
              shadcn/ui CSS
            </Button>
            <Button
              :variant="exportFormat === 'dtcgJson' ? 'primary' : 'secondary'"
              size="sm"
              class="text-xs"
              @click="exportFormat = 'dtcgJson'"
            >
              W3C Tokens (JSON)
            </Button>
          </div>

          <div class="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              class="gap-1.5 text-xs"
              @click="copyToClipboard(currentExportContent, currentExportFilename)"
            >
              <Check v-if="isCopied" class="w-3.5 h-3.5 text-emerald-300" />
              <Copy v-else class="w-3.5 h-3.5" />
              <span>{{ isCopied ? 'Copied' : 'Copy Code' }}</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              class="gap-1.5 text-xs"
              @click="downloadFile(currentExportFilename, currentExportContent, 'text/plain')"
            >
              <Download class="w-3.5 h-3.5" />
              <span>Download</span>
            </Button>
          </div>
        </div>

        <!-- Code Viewer Card -->
        <Card class="overflow-hidden bg-[#121214] border border-[var(--border-card)]">
          <div class="flex items-center justify-between px-4 py-2 bg-[#18181b] border-b border-[#27272a] text-xs font-mono text-zinc-400">
            <span>{{ currentExportFilename }}</span>
            <span class="text-[11px] opacity-75">{{ exportFormat }}</span>
          </div>
          <pre class="p-4 text-xs font-mono text-zinc-200 overflow-x-auto max-h-[500px] leading-relaxed"><code v-html="highlightedExportCode"></code></pre>
        </Card>
      </div>
    </div>
  </div>
</template>
