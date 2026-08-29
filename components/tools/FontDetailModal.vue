<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Download,
  Copy,
  ExternalLink,
  Type,
  Code,
  Check,
  Palette,
  Eye,
  Loader2,
  Info,
  Layers,
  Sparkles,
  Sun,
  Moon,
  RefreshCw
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import { useClipboard } from '~/composables/useClipboard'
import Modal from '~/components/ui/Modal.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

export interface SelectedFontDetail {
  id: string
  name: string
  source: 'dafont' | 'google' | 'fontshare' | 'custom'
  author?: string
  designer?: string
  category?: string
  license?: string
  downloads?: string
  downloadUrl?: string
  weights?: number[]
  fontshareName?: string
  previewUrl?: string
}

interface Props {
  modelValue: boolean
  font: SelectedFontDetail | null
  initialPreviewText?: string
}

const props = withDefaults(defineProps<Props>(), {
  font: null,
  initialPreviewText: 'The quick brown fox jumps over the lazy dog',
})

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
}>()

const toast = useToast()
const { copy } = useClipboard()

// Detail fetching state for DaFont
const isLoadingDetail = ref(false)
const isUpdatingPreview = ref(false)
const daFontDetail = ref<any>(null)

// Interactive Playground in Modal
const modalPreviewText = ref(props.initialPreviewText || 'The quick brown fox jumps over the lazy dog')
const modalFontSize = ref(36)
const modalLetterSpacing = ref(0)
const modalCanvasTheme = ref<'dark' | 'light'>('light')
const activeDetailTab = ref<'overview' | 'charmap' | 'snippets'>('overview')

// Dynamic glyphs list for Google WebFonts
const GLYPH_SECTIONS = [
  { label: 'Uppercase Letters (A-Z)', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') },
  { label: 'Lowercase Letters (a-z)', chars: 'abcdefghijklmnopqrstuvwxyz'.split('') },
  { label: 'Numbers (0-9)', chars: '0123456789'.split('') },
  { label: 'Punctuation & Symbols', chars: '!@#$%^&*()_+-=[]{}|;:,.<>?/`~"\'\\'.split('') },
  { label: 'Accented & Extended', chars: 'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïñòóôõöøùúûüýÿ'.split('') },
]

// Fetch full details when modal opens or when font id changes
const fetchDaFontFullDetail = async (customText = '') => {
  if (!props.font || props.font.source !== 'dafont') return

  if (!customText) {
    isLoadingDetail.value = true
  } else {
    isUpdatingPreview.value = true
  }

  try {
    const textParam = customText ? `&text=${encodeURIComponent(customText)}` : ''
    const data: any = await $fetch(`/api/fonts/detail?slug=${props.font.id}&source=dafont${textParam}`)
    if (data?.success) {
      daFontDetail.value = data
    }
  } catch {
    // Keep existing or fallback
  } finally {
    isLoadingDetail.value = false
    isUpdatingPreview.value = false
  }
}

// Watch modal state & font id
watch(
  () => [props.modelValue, props.font?.id],
  ([isOpen, fontId]) => {
    if (isOpen && fontId && props.font?.source === 'dafont') {
      daFontDetail.value = null
      modalPreviewText.value = props.initialPreviewText || 'The quick brown fox jumps over the lazy dog'
      activeDetailTab.value = 'overview'
      fetchDaFontFullDetail(modalPreviewText.value)
    }
  },
  { immediate: true }
)

// Debounced live typing test scraper for DaFont
let previewDebounceTimer: any = null
watch(modalPreviewText, (newText) => {
  if (!props.modelValue || !props.font || props.font.source !== 'dafont') return

  if (previewDebounceTimer) clearTimeout(previewDebounceTimer)
  previewDebounceTimer = setTimeout(() => {
    fetchDaFontFullDetail(newText.trim())
  }, 450)
})

const effectiveDownloadUrl = computed(() => {
  if (daFontDetail.value?.downloadUrl) return daFontDetail.value.downloadUrl
  if (props.font?.downloadUrl) return props.font.downloadUrl
  if (props.font?.source === 'dafont') return `https://dl.dafont.com/dl/?f=${props.font.id.replace(/-/g, '_')}`
  return ''
})

const effectiveAuthor = computed(() => {
  return daFontDetail.value?.author || props.font?.author || props.font?.designer || 'Font Designer'
})

const effectiveLicense = computed(() => {
  return daFontDetail.value?.license || props.font?.license || 'Free for personal use'
})

const effectiveCategory = computed(() => {
  return daFontDetail.value?.category || props.font?.category || 'Creative'
})

// Snippet generation for Google WebFonts
const getEmbedCode = (type: 'html' | 'css' | 'import' | 'tailwind') => {
  if (!props.font) return ''
  const font = props.font
  const weights = font.weights || [400, 700]

  if (font.source === 'fontshare' && font.fontshareName) {
    if (type === 'html') return `<link href="https://api.fontshare.com/v2/css?f[]=${font.fontshareName}@${weights.join(',')}&display=swap" rel="stylesheet">`
    if (type === 'import') return `@import url('https://api.fontshare.com/v2/css?f[]=${font.fontshareName}@${weights.join(',')}&display=swap');`
    if (type === 'css') return `font-family: '${font.name}', sans-serif;`
    if (type === 'tailwind') return `fontFamily: {\n  '${font.id}': ["'${font.name}'", 'sans-serif'],\n}`
  }

  const fontParam = encodeURIComponent(font.name).replace(/%20/g, '+')
  if (type === 'html') return `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=${fontParam}:wght@${weights.join(';')}&display=swap" rel="stylesheet">`
  if (type === 'import') return `@import url('https://fonts.googleapis.com/css2?family=${fontParam}:wght@${weights.join(';')}&display=swap');`
  if (type === 'css') return `font-family: '${font.name}', ${font.category === 'serif' ? 'serif' : font.category === 'monospace' ? 'monospace' : 'sans-serif'};`
  if (type === 'tailwind') return `fontFamily: {\n  '${font.id}': ["'${font.name}'", '${font.category === 'serif' ? 'serif' : font.category === 'monospace' ? 'monospace' : 'sans-serif'}'],\n}`
  return ''
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    max-width="4xl"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div v-if="font" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full pr-8">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <Badge variant="secondary" class="uppercase font-mono text-[10px]">
              {{ font.source === 'dafont' ? 'DaFont Directory' : 'Google WebFont' }}
            </Badge>
            <span class="text-xs text-[var(--text-tertiary)]">•</span>
            <span class="text-xs text-[var(--text-secondary)] font-medium">{{ effectiveCategory }}</span>
          </div>
          <h2 class="text-xl font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            <span>{{ font.name }}</span>
            <span class="text-xs font-normal text-[var(--text-tertiary)]">by {{ effectiveAuthor }}</span>
          </h2>
        </div>

        <!-- Header Actions -->
        <div class="flex items-center gap-2">
          <a
            v-if="effectiveDownloadUrl"
            :href="effectiveDownloadUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="px-3.5 py-1.5 bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-opacity shrink-0"
          >
            <Download class="w-3.5 h-3.5" />
            <span>Download ZIP</span>
          </a>

          <a
            v-if="font.source === 'dafont'"
            :href="`https://www.dafont.com/${font.id}.font`"
            target="_blank"
            rel="noopener noreferrer"
            class="p-2 bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-card)] rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="Open on DaFont.com"
          >
            <ExternalLink class="w-4 h-4" />
          </a>
        </div>
      </div>
    </template>

    <div v-if="font" class="p-6 space-y-6 overflow-y-auto max-h-[calc(85vh-120px)]">
      <!-- Loading Skeleton for DaFont Deep Detail -->
      <div v-if="isLoadingDetail" class="flex flex-col items-center justify-center py-16 gap-3 text-xs text-[var(--text-secondary)] font-mono">
        <Loader2 class="w-6 h-6 animate-spin text-[var(--text-primary)]" />
        <span>Loading specifications, poster artwork & character map for {{ font.name }}...</span>
      </div>

      <div v-else class="space-y-6">
        <!-- Sub-Navigation Tabs inside Modal -->
        <div class="p-1 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl inline-flex gap-1 shadow-xs">
          <button
            type="button"
            class="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs transition-all cursor-pointer"
            :class="activeDetailTab === 'overview' ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
            @click="activeDetailTab = 'overview'"
          >
            <Eye class="w-3.5 h-3.5" />
            <span>Live Playground & Specimen</span>
          </button>

          <button
            type="button"
            class="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs transition-all cursor-pointer"
            :class="activeDetailTab === 'charmap' ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
            @click="activeDetailTab = 'charmap'"
          >
            <Layers class="w-3.5 h-3.5" />
            <span>Full Character Map & Glyphs</span>
          </button>

          <button
            v-if="font.source !== 'dafont'"
            type="button"
            class="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs transition-all cursor-pointer"
            :class="activeDetailTab === 'snippets' ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
            @click="activeDetailTab = 'snippets'"
          >
            <Code class="w-3.5 h-3.5" />
            <span>Code Embeds</span>
          </button>
        </div>

        <!-- TAB 1: OVERVIEW & LIVE PLAYGROUND -->
        <div v-if="activeDetailTab === 'overview'" class="space-y-6">
          <!-- Full Illustration / Poster Mockups (If DaFont has illustration banner) -->
          <div
            v-if="daFontDetail?.illustrations && daFontDetail.illustrations.length > 0"
            class="space-y-3"
          >
            <div class="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
              <Sparkles class="w-3.5 h-3.5" />
              <span>Official Poster Mockup & Artwork</span>
            </div>
            <div class="grid grid-cols-1 gap-4 rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-black/40">
              <img
                v-for="(imgUrl, idx) in daFontDetail.illustrations"
                :key="idx"
                :src="imgUrl"
                :alt="`${font.name} Illustration ${Number(idx) + 1}`"
                loading="lazy"
                class="w-full max-h-[500px] object-contain rounded-lg"
              />
            </div>
          </div>

          <!-- Interactive Live Typing Playground Box -->
          <div class="space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
                <Type class="w-3.5 h-3.5" />
                <span>Interactive Live Preview Canvas</span>
                <span v-if="isUpdatingPreview" class="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] normal-case">
                  <Loader2 class="w-3 h-3 animate-spin" /> Rendering DaFont text...
                </span>
              </div>

              <!-- Controls: Canvas Background & Size -->
              <div class="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                <!-- Canvas Invert Toggle -->
                <div class="flex items-center gap-1 bg-[var(--bg-input)] p-1 rounded-lg border border-[var(--border-subtle)]">
                  <button
                    type="button"
                    class="p-1 rounded cursor-pointer transition-colors"
                    :class="modalCanvasTheme === 'light' ? 'bg-white text-black shadow-xs font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
                    title="Light Specimen Canvas"
                    @click="modalCanvasTheme = 'light'"
                  >
                    <Sun class="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    class="p-1 rounded cursor-pointer transition-colors"
                    :class="modalCanvasTheme === 'dark' ? 'bg-zinc-900 text-white shadow-xs font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
                    title="Dark Specimen Canvas"
                    @click="modalCanvasTheme = 'dark'"
                  >
                    <Moon class="w-3.5 h-3.5" />
                  </button>
                </div>

                <!-- Font Size Slider -->
                <div class="flex items-center gap-1.5">
                  <span>Size:</span>
                  <input
                    v-model.number="modalFontSize"
                    type="range"
                    min="20"
                    max="80"
                    step="2"
                    class="w-20 h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--border-subtle)] accent-[var(--primary)]"
                  />
                  <span class="font-mono text-[var(--text-primary)] w-7 text-right">{{ modalFontSize }}px</span>
                </div>
              </div>
            </div>

            <!-- Custom Text Input -->
            <input
              v-model="modalPreviewText"
              type="text"
              class="w-full px-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-primary)] rounded-lg text-sm transition-all focus:outline-none focus:border-[var(--primary)] placeholder-[var(--text-tertiary)]"
              placeholder="Type custom text to test font..."
            />

            <!-- Preview Surface Viewport -->
            <div
              class="p-6 rounded-xl border min-h-[140px] flex flex-col items-center justify-center gap-4 transition-colors overflow-hidden"
              :class="
                modalCanvasTheme === 'light'
                  ? 'bg-white text-zinc-950 border-zinc-200 shadow-xs'
                  : 'bg-[#0D0D0D] text-white border-zinc-800'
              "
            >
              <!-- For Google Fonts: Live WebFont DOM -->
              <div
                v-if="font.source !== 'dafont'"
                class="w-full text-center break-words select-all leading-normal"
                :style="{
                  fontFamily: `'${font.name}', sans-serif`,
                  fontSize: `${modalFontSize}px`,
                  letterSpacing: `${modalLetterSpacing}px`,
                }"
              >
                {{ modalPreviewText || font.name }}
              </div>

              <!-- For DaFont: Dynamic Real Specimen Renders (Handles multiple font variants if available) -->
              <template v-else>
                <div
                  v-if="daFontDetail?.previewUrls && daFontDetail.previewUrls.length > 0"
                  class="w-full space-y-4 flex flex-col items-center"
                >
                  <img
                    v-for="(pUrl, pIdx) in daFontDetail.previewUrls"
                    :key="pIdx"
                    :src="pUrl"
                    :alt="`${font.name} Variant ${Number(pIdx) + 1}`"
                    class="max-w-full max-h-[120px] object-contain transition-all"
                    :class="modalCanvasTheme === 'dark' ? 'invert brightness-200 contrast-150' : 'brightness-100 contrast-125'"
                  />
                </div>

                <!-- Fallback DaFont Image -->
                <img
                  v-else
                  :src="font.previewUrl || `https://img.dafont.com/preview.php?font=${font.id.replace(/-/g, '_')}&size=50`"
                  :alt="font.name"
                  class="max-w-full max-h-[120px] object-contain transition-all"
                  :class="modalCanvasTheme === 'dark' ? 'invert brightness-200 contrast-150' : 'brightness-100 contrast-125'"
                />
              </template>
            </div>
          </div>

          <!-- Note of the author / Description -->
          <div v-if="daFontDetail?.authorNote" class="p-5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] space-y-2">
            <h4 class="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
              <Info class="w-3.5 h-3.5" />
              <span>Note of the Author / License Terms</span>
            </h4>
            <div class="text-xs text-[var(--text-secondary)] whitespace-pre-line leading-relaxed font-sans select-text">
              {{ daFontDetail.authorNote }}
            </div>
          </div>

          <!-- Font Metadata Summary Grid -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="p-3.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] space-y-1">
              <span class="text-[10px] font-mono uppercase text-[var(--text-tertiary)]">License</span>
              <p class="text-xs font-semibold text-[var(--text-primary)] truncate">{{ effectiveLicense }}</p>
            </div>

            <div class="p-3.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] space-y-1">
              <span class="text-[10px] font-mono uppercase text-[var(--text-tertiary)]">Author / Foundry</span>
              <p class="text-xs font-semibold text-[var(--text-primary)] truncate">{{ effectiveAuthor }}</p>
            </div>

            <div class="p-3.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] space-y-1">
              <span class="text-[10px] font-mono uppercase text-[var(--text-tertiary)]">Category</span>
              <p class="text-xs font-semibold text-[var(--text-primary)] truncate">{{ effectiveCategory }}</p>
            </div>

            <div class="p-3.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] space-y-1">
              <span class="text-[10px] font-mono uppercase text-[var(--text-tertiary)]">Downloads</span>
              <p class="text-xs font-semibold text-[var(--text-primary)] truncate">{{ daFontDetail?.downloads || 'Popular' }}</p>
            </div>
          </div>
        </div>

        <!-- TAB 2: FULL CHARACTER MAP & GLYPHS MATRIX -->
        <div v-else-if="activeDetailTab === 'charmap'" class="space-y-6">
          <!-- If DaFont has charmap images from server -->
          <div
            v-if="daFontDetail?.charmaps && daFontDetail.charmaps.length > 0"
            class="space-y-4"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
                Complete Character Map (DaFont Specimen Sheet)
              </span>
              <Badge variant="secondary" class="font-mono text-[10px]">
                {{ daFontDetail.charmaps.length }} Sheets
              </Badge>
            </div>

            <div class="space-y-4">
              <div
                v-for="(charmapUrl, cIdx) in daFontDetail.charmaps"
                :key="cIdx"
                class="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white flex items-center justify-center overflow-x-auto shadow-xs"
              >
                <img
                  :src="charmapUrl"
                  :alt="`${font.name} Character Map ${Number(cIdx) + 1}`"
                  loading="lazy"
                  class="max-w-full object-contain"
                />
              </div>
            </div>
          </div>

          <!-- Interactive Glyphs Matrix Grid (For WebFonts or Fallback) -->
          <div class="space-y-5">
            <div
              v-for="section in GLYPH_SECTIONS"
              :key="section.label"
              class="space-y-2"
            >
              <h5 class="text-xs font-mono font-medium text-[var(--text-secondary)]">
                {{ section.label }}
              </h5>
              <div class="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-13 gap-2">
                <div
                  v-for="ch in section.chars"
                  :key="ch"
                  class="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] hover:border-[var(--border-card-hover)] flex flex-col items-center justify-center transition-all cursor-pointer group"
                  @click="modalPreviewText = ch; activeDetailTab = 'overview'"
                >
                  <span
                    class="text-lg text-[var(--text-primary)] group-hover:scale-110 transition-transform"
                    :style="font.source !== 'dafont' ? { fontFamily: `'${font.name}', sans-serif` } : {}"
                  >
                    {{ ch }}
                  </span>
                  <span class="text-[9px] font-mono text-[var(--text-tertiary)] mt-1">
                    {{ ch.charCodeAt(0).toString(16).toUpperCase() }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 3: CODE SNIPPETS (For Google WebFonts) -->
        <div v-else-if="activeDetailTab === 'snippets'" class="space-y-4">
          <!-- CSS @import -->
          <div class="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono font-semibold text-[var(--text-primary)]">CSS @import</span>
              <Button size="sm" variant="secondary" @click="copy(getEmbedCode('import'))">
                <Copy class="w-3.5 h-3.5 mr-1" />
                <span>Copy</span>
              </Button>
            </div>
            <pre class="p-3 bg-black/80 rounded-lg text-xs font-mono text-zinc-300 overflow-x-auto select-all"><code>{{ getEmbedCode('import') }}</code></pre>
          </div>

          <!-- HTML <link> -->
          <div class="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono font-semibold text-[var(--text-primary)]">HTML &lt;link&gt;</span>
              <Button size="sm" variant="secondary" @click="copy(getEmbedCode('html'))">
                <Copy class="w-3.5 h-3.5 mr-1" />
                <span>Copy</span>
              </Button>
            </div>
            <pre class="p-3 bg-black/80 rounded-lg text-xs font-mono text-zinc-300 overflow-x-auto select-all"><code>{{ getEmbedCode('html') }}</code></pre>
          </div>

          <!-- Tailwind CSS Config -->
          <div class="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono font-semibold text-[var(--text-primary)]">Tailwind fontFamily</span>
              <Button size="sm" variant="secondary" @click="copy(getEmbedCode('tailwind'))">
                <Copy class="w-3.5 h-3.5 mr-1" />
                <span>Copy</span>
              </Button>
            </div>
            <pre class="p-3 bg-black/80 rounded-lg text-xs font-mono text-zinc-300 overflow-x-auto select-all"><code>{{ getEmbedCode('tailwind') }}</code></pre>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>
