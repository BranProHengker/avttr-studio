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
  RefreshCw,
  Columns,
  ArrowLeftRight,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sliders,
  Shuffle
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import { useClipboard } from '~/composables/useClipboard'
import Modal from '~/components/ui/Modal.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

export interface SelectedFontDetail {
  id: string
  name: string
  source: 'dafont' | 'google' | 'fontshare' | 'custom' | 'uncut'
  author?: string
  designer?: string
  category?: string
  license?: string
  downloads?: string
  downloadUrl?: string
  weights?: number[]
  fontshareName?: string
  previewUrl?: string
  pageUrl?: string
}

interface Props {
  modelValue: boolean
  font: SelectedFontDetail | null
  initialPreviewText?: string
  initialTab?: 'overview' | 'pairing' | 'charmap' | 'snippets'
}

const props = withDefaults(defineProps<Props>(), {
  font: null,
  initialPreviewText: 'The quick brown fox jumps over the lazy dog',
  initialTab: 'overview',
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

// Navigation Tabs inside Modal
const activeDetailTab = ref<'overview' | 'pairing' | 'charmap' | 'snippets'>('overview')

// Interactive Playground in Modal
const modalPreviewText = ref(props.initialPreviewText || 'The quick brown fox jumps over the lazy dog')
const modalFontSize = ref(36)
const modalLetterSpacing = ref(0)
const modalLineHeight = ref(1.4)
const modalTextAlign = ref<'left' | 'center' | 'right'>('center')
const modalTextTransform = ref<'none' | 'uppercase' | 'lowercase'>('none')
const modalCanvasTheme = ref<'dark' | 'light'>('light')

// Curated Pairing Partners Catalog
export interface PairingPartner {
  id: string
  name: string
  category: 'sans-serif' | 'serif' | 'monospace'
  style: string
  googleFont: string
  description: string
}

const PAIRING_PARTNERS: PairingPartner[] = [
  {
    id: 'plus-jakarta-sans',
    name: 'Plus Jakarta Sans',
    category: 'sans-serif',
    style: 'Geometric Clean Sans',
    googleFont: 'Plus+Jakarta+Sans',
    description: 'Modern geometric sans with warm personality, excellent for body text.',
  },
  {
    id: 'inter',
    name: 'Inter',
    category: 'sans-serif',
    style: 'Neo-Grotesk UI Standard',
    googleFont: 'Inter',
    description: 'Crafted specifically for computer screens, supreme legibility.',
  },
  {
    id: 'playfair-display',
    name: 'Playfair Display',
    category: 'serif',
    style: 'High-Contrast Editorial Serif',
    googleFont: 'Playfair+Display',
    description: 'Transitional editorial design with high contrast, elegant & punchy.',
  },
  {
    id: 'lora',
    name: 'Lora',
    category: 'serif',
    style: 'Contemporary Calligraphic Serif',
    googleFont: 'Lora',
    description: 'Well-balanced contemporary serif with brushed curves, perfect reading rhythm.',
  },
  {
    id: 'space-grotesk',
    name: 'Space Grotesk',
    category: 'sans-serif',
    style: 'Brutalist Monospaced Sans',
    googleFont: 'Space+Grotesk',
    description: 'Proportional variant of Space Mono, distinct brutalist tech personality.',
  },
  {
    id: 'jetbrains-mono',
    name: 'JetBrains Mono',
    category: 'monospace',
    style: 'Technical Monospace',
    googleFont: 'JetBrains+Mono',
    description: 'Engineered for developers, spacious x-height and clear distinction.',
  },
  {
    id: 'dm-sans',
    name: 'DM Sans',
    category: 'sans-serif',
    style: 'Low-Contrast Geometric',
    googleFont: 'DM+Sans',
    description: 'Clean low-contrast grotesque, crisp at small paragraphs.',
  },
  {
    id: 'outfit',
    name: 'Outfit',
    category: 'sans-serif',
    style: 'Brand Geometric Sans',
    googleFont: 'Outfit',
    description: 'Geometric type with rounded elegance, clean rhythm.',
  },
]

// Smart Pairing State
const selectedPartnerId = ref<string>('plus-jakarta-sans')
const fontRole = ref<'heading' | 'body'>('heading')
const pairingHeadline = ref('Crafting Timeless Digital Architecture')
const pairingBody = ref(
  'Typography is the craft of endowing human language with a durable visual form. When pairing contrasting typefaces, harmonize weight, x-height, and typographic rhythm to create seamless visual balance.'
)
const pairingHeadlineSize = ref(36)
const pairingBodySize = ref(15)

const selectedPartner = computed(() => {
  return PAIRING_PARTNERS.find((p) => p.id === selectedPartnerId.value) || PAIRING_PARTNERS[0]
})

// Dynamic glyphs list for Google WebFonts
const GLYPH_SECTIONS = [
  { label: 'Uppercase Letters (A-Z)', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') },
  { label: 'Lowercase Letters (a-z)', chars: 'abcdefghijklmnopqrstuvwxyz'.split('') },
  { label: 'Numbers (0-9)', chars: '0123456789'.split('') },
  { label: 'Punctuation & Symbols', chars: '!@#$%^&*()_+-=[]{}|;:,.<>?/`~"\'\\'.split('') },
  { label: 'Accented & Extended', chars: 'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïñòóôõöøùúûüýÿ'.split('') },
]

// Dynamically inject partner font <link> tag
const loadPartnerFont = (partner: PairingPartner) => {
  if (typeof document === 'undefined') return
  const id = `partner-font-${partner.id}`
  if (!document.getElementById(id)) {
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${partner.googleFont}:wght@400;500;600;700&display=swap`
    document.head.appendChild(link)
  }
}

watch(
  selectedPartner,
  (p) => {
    if (p) loadPartnerFont(p)
  },
  { immediate: true }
)

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
    if (isOpen && fontId) {
      activeDetailTab.value = props.initialTab || 'overview'
      modalPreviewText.value = props.initialPreviewText || 'The quick brown fox jumps over the lazy dog'

      // Smart recommendation for pairing partner
      const cat = (props.font?.category || '').toLowerCase()
      if (cat.includes('serif') || cat.includes('display') || cat.includes('retro') || cat.includes('handwriting')) {
        selectedPartnerId.value = 'plus-jakarta-sans'
        fontRole.value = 'heading'
      } else if (cat.includes('sans')) {
        selectedPartnerId.value = 'playfair-display'
        fontRole.value = 'body'
      } else if (cat.includes('mono')) {
        selectedPartnerId.value = 'inter'
        fontRole.value = 'heading'
      } else {
        selectedPartnerId.value = 'plus-jakarta-sans'
        fontRole.value = 'heading'
      }

      if (props.font?.source === 'dafont') {
        daFontDetail.value = null
        fetchDaFontFullDetail(modalPreviewText.value)
      }
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

// Swap Heading and Body roles in Smart Pairing
const swapPairingRoles = () => {
  fontRole.value = fontRole.value === 'heading' ? 'body' : 'heading'
  toast.show({
    title: 'Roles Swapped',
    description: `Current font is now used for ${fontRole.value === 'heading' ? 'Headings' : 'Body Paragraphs'}`,
    type: 'success',
  })
}

// Shuffle to a random complementary partner
const shufflePartner = () => {
  const currentIdx = PAIRING_PARTNERS.findIndex((p) => p.id === selectedPartnerId.value)
  let nextIdx = Math.floor(Math.random() * PAIRING_PARTNERS.length)
  if (nextIdx === currentIdx) {
    nextIdx = (nextIdx + 1) % PAIRING_PARTNERS.length
  }
  selectedPartnerId.value = PAIRING_PARTNERS[nextIdx].id
  toast.show({
    title: 'Partner Shuffled',
    description: `Paired with ${PAIRING_PARTNERS[nextIdx].name} (${PAIRING_PARTNERS[nextIdx].style})`,
    type: 'success',
  })
}

// Computed font family names for pairing
const headingFamily = computed(() => {
  if (fontRole.value === 'heading') {
    return props.font?.name || 'Primary Font'
  }
  return selectedPartner.value.name
})

const bodyFamily = computed(() => {
  if (fontRole.value === 'body') {
    return props.font?.name || 'Primary Font'
  }
  return selectedPartner.value.name
})

// Universal Embed Snippets Generator (Unified for Google, UNCUT, DaFont, and Custom)
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

  if (font.source === 'uncut') {
    const slug = font.id.replace(/^uncut-/, '')
    if (type === 'html') {
      return `<!-- UNCUT.wtf Font: Download .woff2 or .otf from UNCUT -->\n<link rel="preload" href="/fonts/${slug}.woff2" as="font" type="font/woff2" crossorigin>`
    }
    if (type === 'import' || type === 'css') {
      return `@font-face {\n  font-family: '${font.name}';\n  src: url('/fonts/${slug}.woff2') format('woff2'),\n       url('/fonts/${slug}.otf') format('opentype');\n  font-weight: normal;\n  font-style: normal;\n  font-display: swap;\n}\n\n.font-${slug} {\n  font-family: '${font.name}', ${font.category || 'sans-serif'};\n}`
    }
    if (type === 'tailwind') {
      return `fontFamily: {\n  '${slug}': ["'${font.name}'", '${font.category || 'sans-serif'}'],\n}`
    }
  }

  if (font.source === 'dafont') {
    const slug = font.id.replace(/-/g, '_')
    if (type === 'html') {
      return `<!-- 1. Download ZIP from DaFont and extract font into your /public/fonts/ directory -->\n<link rel="preload" href="/fonts/${slug}.ttf" as="font" type="font/ttf" crossorigin>`
    }
    if (type === 'import' || type === 'css') {
      return `/* 1. Extract downloaded DaFont file (.ttf/.otf) to your assets/fonts or public/fonts folder */\n@font-face {\n  font-family: '${font.name}';\n  src: url('/fonts/${slug}.ttf') format('truetype'),\n       url('/fonts/${slug}.otf') format('opentype');\n  font-weight: normal;\n  font-style: normal;\n  font-display: swap;\n}\n\n.font-${font.id} {\n  font-family: '${font.name}', cursive, sans-serif;\n}`
    }
    if (type === 'tailwind') {
      return `fontFamily: {\n  '${font.id}': ["'${font.name}'", 'cursive', 'sans-serif'],\n}`
    }
  }

  // Google Fonts Default
  const fontParam = encodeURIComponent(font.name).replace(/%20/g, '+')
  if (type === 'html') return `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=${fontParam}:wght@${weights.join(';')}&display=swap" rel="stylesheet">`
  if (type === 'import') return `@import url('https://fonts.googleapis.com/css2?family=${fontParam}:wght@${weights.join(';')}&display=swap');`
  if (type === 'css') return `font-family: '${font.name}', ${font.category === 'serif' ? 'serif' : font.category === 'monospace' ? 'monospace' : 'sans-serif'};`
  if (type === 'tailwind') return `fontFamily: {\n  '${font.id}': ["'${font.name}'", '${font.category === 'serif' ? 'serif' : font.category === 'monospace' ? 'monospace' : 'sans-serif'}'],\n}`
  return ''
}

// Pairing 1-Click Code Generation
const getPairingCode = (type: 'css-vars' | 'tailwind' | 'html-links') => {
  const hName = headingFamily.value
  const bName = bodyFamily.value

  if (type === 'css-vars') {
    return `/* Smart Font Pairing CSS Variables */\n:root {\n  --font-heading: '${hName}', sans-serif;\n  --font-body: '${bName}', sans-serif;\n}\n\nh1, h2, h3, h4, .font-heading {\n  font-family: var(--font-heading);\n}\n\nbody, p, .font-body {\n  font-family: var(--font-body);\n}`
  }

  if (type === 'tailwind') {
    return `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      fontFamily: {\n        heading: ["'${hName}'", 'sans-serif'],\n        body: ["'${bName}'", 'sans-serif'],\n      },\n    },\n  },\n}`
  }

  if (type === 'html-links') {
    const partnerParam = encodeURIComponent(selectedPartner.value.name).replace(/%20/g, '+')
    if (props.font?.source === 'google') {
      const mainParam = encodeURIComponent(props.font.name).replace(/%20/g, '+')
      return `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=${mainParam}:wght@600;700;800&family=${partnerParam}:wght@400;500;600&display=swap" rel="stylesheet">`
    }
    return `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=${partnerParam}:wght@400;500;600&display=swap" rel="stylesheet">`
  }

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
              {{
                font.source === 'dafont'
                  ? 'DaFont Directory'
                  : font.source === 'uncut'
                  ? 'UNCUT.wtf Contemporary'
                  : font.source === 'fontshare'
                  ? 'Fontshare'
                  : font.source === 'custom'
                  ? 'Custom Upload'
                  : 'Google WebFont'
              }}
            </Badge>
            <span class="text-xs text-[var(--text-tertiary)]">•</span>
            <span class="text-xs text-[var(--text-secondary)] font-medium capitalize">{{ effectiveCategory }}</span>
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

          <a
            v-else-if="font.source === 'uncut'"
            :href="font.pageUrl || `https://uncut.wtf`"
            target="_blank"
            rel="noopener noreferrer"
            class="p-2 bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-card)] rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="Open on UNCUT.wtf"
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
        <!-- Sub-Navigation Segmented Tabs inside Modal -->
        <div class="p-1 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl inline-flex flex-wrap gap-1 shadow-xs">
          <button
            type="button"
            class="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs transition-all cursor-pointer"
            :class="activeDetailTab === 'overview' ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
            @click="activeDetailTab = 'overview'"
          >
            <Eye class="w-3.5 h-3.5" />
            <span>Live Specimen & Tester</span>
          </button>

          <!-- SMART PAIRING TAB -->
          <button
            type="button"
            class="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs transition-all cursor-pointer"
            :class="activeDetailTab === 'pairing' ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
            @click="activeDetailTab = 'pairing'"
          >
            <Columns class="w-3.5 h-3.5" />
            <span>Smart Font Pairing</span>
            <span class="px-1.5 py-0.2 rounded-full text-[9px] font-mono uppercase bg-[var(--primary-hover)] text-inherit ml-0.5">
              PRO
            </span>
          </button>

          <button
            type="button"
            class="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs transition-all cursor-pointer"
            :class="activeDetailTab === 'charmap' ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
            @click="activeDetailTab = 'charmap'"
          >
            <Layers class="w-3.5 h-3.5" />
            <span>Character Map & Glyphs</span>
          </button>

          <button
            type="button"
            class="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs transition-all cursor-pointer"
            :class="activeDetailTab === 'snippets' ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
            @click="activeDetailTab = 'snippets'"
          >
            <Code class="w-3.5 h-3.5" />
            <span>1-Click CSS Export</span>
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

              <!-- Controls: Canvas Background & Size & Spacing -->
              <div class="flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
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

                <!-- Text Alignment Toggles -->
                <div class="flex items-center gap-0.5 bg-[var(--bg-input)] p-1 rounded-lg border border-[var(--border-subtle)]">
                  <button
                    type="button"
                    class="p-1 rounded cursor-pointer transition-colors"
                    :class="modalTextAlign === 'left' ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
                    title="Align Left"
                    @click="modalTextAlign = 'left'"
                  >
                    <AlignLeft class="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    class="p-1 rounded cursor-pointer transition-colors"
                    :class="modalTextAlign === 'center' ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
                    title="Align Center"
                    @click="modalTextAlign = 'center'"
                  >
                    <AlignCenter class="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    class="p-1 rounded cursor-pointer transition-colors"
                    :class="modalTextAlign === 'right' ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
                    title="Align Right"
                    @click="modalTextAlign = 'right'"
                  >
                    <AlignRight class="w-3 h-3" />
                  </button>
                </div>

                <!-- Font Size Slider -->
                <div class="flex items-center gap-1.5">
                  <span>Size:</span>
                  <input
                    v-model.number="modalFontSize"
                    type="range"
                    min="18"
                    max="80"
                    step="2"
                    class="w-18 sm:w-20 h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--border-subtle)] accent-[var(--primary)]"
                  />
                  <span class="font-mono text-[var(--text-primary)] w-7 text-right">{{ modalFontSize }}px</span>
                </div>
              </div>
            </div>

            <!-- Custom Text Input Omnibar -->
            <div class="relative flex items-center">
              <input
                v-model="modalPreviewText"
                type="text"
                class="w-full px-3.5 py-2.5 pr-32 bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-primary)] rounded-lg text-sm transition-all focus:outline-none focus:border-[var(--primary)] placeholder-[var(--text-tertiary)]"
                placeholder="Type custom text to test font..."
              />
              <div class="absolute right-2 flex items-center gap-1">
                <button
                  type="button"
                  class="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
                  @click="modalPreviewText = 'The quick brown fox jumps over the lazy dog'"
                >
                  Fox
                </button>
                <button
                  type="button"
                  class="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
                  @click="modalPreviewText = '0123456789 & # $ % @ ! ?'"
                >
                  123
                </button>
              </div>
            </div>

            <!-- Preview Surface Viewport -->
            <div
              class="p-6 rounded-xl border min-h-[140px] flex flex-col items-center justify-center gap-4 transition-colors overflow-hidden"
              :class="
                modalCanvasTheme === 'light'
                  ? 'bg-white text-zinc-950 border-zinc-200 shadow-xs'
                  : 'bg-[#0D0D0D] text-white border-zinc-800'
              "
            >
              <!-- For UNCUT: SVG Specimen Preview Image -->
              <div
                v-if="font.source === 'uncut'"
                class="w-full flex flex-col items-center justify-center p-4 gap-2"
              >
                <img
                  v-if="font.previewUrl"
                  :src="font.previewUrl"
                  :alt="font.name"
                  class="max-w-full max-h-[160px] object-contain transition-all"
                  :class="modalCanvasTheme === 'dark' ? 'invert brightness-200' : 'brightness-100'"
                />
                <span class="text-[11px] font-mono text-[var(--text-tertiary)] opacity-80">
                  Specimen Vector from UNCUT.wtf
                </span>
              </div>

              <!-- For Google / Fontshare / Custom: Live WebFont DOM -->
              <div
                v-else-if="font.source !== 'dafont'"
                class="w-full break-words select-all leading-normal"
                :style="{
                  fontFamily: `'${font.name}', sans-serif`,
                  fontSize: `${modalFontSize}px`,
                  letterSpacing: `${modalLetterSpacing}px`,
                  lineHeight: modalLineHeight,
                  textAlign: modalTextAlign,
                  textTransform: modalTextTransform,
                }"
              >
                {{ modalPreviewText || font.name }}
              </div>

              <!-- For DaFont: Dynamic Real Specimen Renders -->
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
              <p class="text-xs font-semibold text-[var(--text-primary)] truncate capitalize">{{ effectiveCategory }}</p>
            </div>

            <div class="p-3.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] space-y-1">
              <span class="text-[10px] font-mono uppercase text-[var(--text-tertiary)]">Source</span>
              <p class="text-xs font-semibold text-[var(--text-primary)] truncate uppercase font-mono">{{ font.source }}</p>
            </div>
          </div>
        </div>

        <!-- TAB 2: SMART FONT PAIRING STUDIO -->
        <div v-else-if="activeDetailTab === 'pairing'" class="space-y-6">
          <!-- Pairing Control Toolbar -->
          <div class="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div class="flex items-center gap-2">
                  <h4 class="text-sm font-bold text-[var(--text-primary)]">
                    Smart Font Pairing Matrix
                  </h4>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                    Harmonized Typographic Scale
                  </span>
                </div>
                <p class="text-xs text-[var(--text-secondary)] mt-0.5">
                  Evaluate how <strong class="text-[var(--text-primary)]">{{ font.name }}</strong> harmonizes with curated complementary body and headline typefaces.
                </p>
              </div>

              <!-- Quick Action Toolbar -->
              <div class="flex items-center gap-2">
                <Button size="sm" variant="secondary" class="h-8 text-xs font-medium" @click="swapPairingRoles">
                  <ArrowLeftRight class="w-3.5 h-3.5 mr-1.5" />
                  <span>Swap Roles</span>
                </Button>

                <Button size="sm" variant="secondary" class="h-8 text-xs font-medium" @click="shufflePartner">
                  <Shuffle class="w-3.5 h-3.5 mr-1.5" />
                  <span>Shuffle Partner</span>
                </Button>
              </div>
            </div>

            <!-- Partner Font Selector Pills -->
            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>Select Complementary Partner:</span>
                <span class="font-mono text-[11px] text-[var(--text-tertiary)]">
                  Active: <strong class="text-[var(--text-primary)]">{{ selectedPartner.name }}</strong> ({{ selectedPartner.style }})
                </span>
              </div>

              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="partner in PAIRING_PARTNERS"
                  :key="partner.id"
                  type="button"
                  class="px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border"
                  :class="
                    selectedPartnerId === partner.id
                      ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent font-semibold shadow-xs'
                      : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                  "
                  @click="selectedPartnerId = partner.id"
                >
                  {{ partner.name }}
                </button>
              </div>
            </div>

            <!-- Role Indicator Summary -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--border-subtle)] text-xs">
              <div class="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                <span class="text-[var(--text-secondary)] font-mono">Headline Font:</span>
                <span class="font-bold text-[var(--text-primary)]">{{ headingFamily }}</span>
              </div>
              <div class="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)]">
                <span class="text-[var(--text-secondary)] font-mono">Body Paragraph Font:</span>
                <span class="font-bold text-[var(--text-primary)]">{{ bodyFamily }}</span>
              </div>
            </div>
          </div>

          <!-- Live Pairing Visual Preview Showcase -->
          <div
            class="p-8 rounded-xl border transition-colors space-y-6 shadow-xs"
            :class="
              modalCanvasTheme === 'light'
                ? 'bg-white text-zinc-950 border-zinc-200'
                : 'bg-[#0D0D0D] text-white border-zinc-800'
            "
          >
            <!-- Canvas Invert & Sizing Bar -->
            <div class="flex items-center justify-between pb-3 border-b border-zinc-200/50 dark:border-zinc-800/80">
              <span class="text-xs font-mono uppercase tracking-wider opacity-70">
                Editorial Typographic Specimen
              </span>

              <div class="flex items-center gap-3 text-xs opacity-80">
                <div class="flex items-center gap-1.5">
                  <span>H-Size:</span>
                  <input
                    v-model.number="pairingHeadlineSize"
                    type="range"
                    min="24"
                    max="64"
                    step="2"
                    class="w-16 h-1.5 rounded-lg appearance-none cursor-pointer bg-zinc-300 dark:bg-zinc-700 accent-[var(--primary)]"
                  />
                  <span class="font-mono w-6 text-right">{{ pairingHeadlineSize }}</span>
                </div>

                <div class="flex items-center gap-1.5">
                  <span>B-Size:</span>
                  <input
                    v-model.number="pairingBodySize"
                    type="range"
                    min="13"
                    max="20"
                    step="1"
                    class="w-16 h-1.5 rounded-lg appearance-none cursor-pointer bg-zinc-300 dark:bg-zinc-700 accent-[var(--primary)]"
                  />
                  <span class="font-mono w-6 text-right">{{ pairingBodySize }}</span>
                </div>
              </div>
            </div>

            <!-- Headline Section -->
            <div class="space-y-2">
              <span class="text-[10px] font-mono uppercase tracking-widest opacity-50 block">
                HEADLINE ({{ headingFamily }})
              </span>

              <!-- If Heading is UNCUT / DaFont image fallback, render appropriately -->
              <div
                v-if="fontRole === 'heading' && font.source === 'uncut'"
                class="py-2"
              >
                <img
                  v-if="font.previewUrl"
                  :src="font.previewUrl"
                  :alt="font.name"
                  class="max-h-[64px] object-contain"
                  :class="modalCanvasTheme === 'dark' ? 'invert brightness-200' : ''"
                />
              </div>

              <div
                v-else-if="fontRole === 'heading' && font.source === 'dafont' && daFontDetail?.previewUrls?.[0]"
                class="py-2"
              >
                <img
                  :src="daFontDetail.previewUrls[0]"
                  :alt="font.name"
                  class="max-h-[64px] object-contain"
                  :class="modalCanvasTheme === 'dark' ? 'invert brightness-200' : ''"
                />
              </div>

              <!-- Standard Live DOM Heading -->
              <h2
                contenteditable="true"
                class="font-bold tracking-tight outline-none focus:ring-1 focus:ring-blue-500 rounded p-1 -m-1 transition-all"
                :style="{
                  fontFamily: `'${headingFamily}', sans-serif`,
                  fontSize: `${pairingHeadlineSize}px`,
                  lineHeight: '1.2',
                }"
                @input="pairingHeadline = ($event.target as HTMLElement).innerText"
              >
                {{ pairingHeadline }}
              </h2>
            </div>

            <!-- Body Paragraph Section -->
            <div class="space-y-2 pt-2">
              <span class="text-[10px] font-mono uppercase tracking-widest opacity-50 block">
                BODY PARAGRAPH ({{ bodyFamily }})
              </span>

              <p
                contenteditable="true"
                class="opacity-90 outline-none focus:ring-1 focus:ring-blue-500 rounded p-1 -m-1 transition-all max-w-3xl"
                :style="{
                  fontFamily: `'${bodyFamily}', sans-serif`,
                  fontSize: `${pairingBodySize}px`,
                  lineHeight: '1.65',
                }"
                @input="pairingBody = ($event.target as HTMLElement).innerText"
              >
                {{ pairingBody }}
              </p>
            </div>
          </div>

          <!-- 1-Click Code Generation for Pairing -->
          <div class="space-y-3">
            <h5 class="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
              <Code class="w-3.5 h-3.5" />
              <span>1-Click Pairing CSS & Config Export</span>
            </h5>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <!-- CSS Variables -->
              <div class="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-mono font-semibold text-[var(--text-primary)]">CSS Variables</span>
                  <Button size="sm" variant="secondary" class="h-7 text-xs px-2.5" @click="copy(getPairingCode('css-vars'))">
                    <Copy class="w-3 h-3 mr-1" />
                    <span>Copy</span>
                  </Button>
                </div>
                <pre class="p-3 bg-black/80 rounded-lg text-[11px] font-mono text-zinc-300 overflow-x-auto select-all"><code>{{ getPairingCode('css-vars') }}</code></pre>
              </div>

              <!-- Tailwind Config -->
              <div class="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-mono font-semibold text-[var(--text-primary)]">Tailwind fontFamily</span>
                  <Button size="sm" variant="secondary" class="h-7 text-xs px-2.5" @click="copy(getPairingCode('tailwind'))">
                    <Copy class="w-3 h-3 mr-1" />
                    <span>Copy</span>
                  </Button>
                </div>
                <pre class="p-3 bg-black/80 rounded-lg text-[11px] font-mono text-zinc-300 overflow-x-auto select-all"><code>{{ getPairingCode('tailwind') }}</code></pre>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 3: FULL CHARACTER MAP & GLYPHS MATRIX -->
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

        <!-- TAB 4: CODE SNIPPETS (Universal 1-Click Code Embeds for ALL sources) -->
        <div v-else-if="activeDetailTab === 'snippets'" class="space-y-4">
          <!-- CSS @font-face or @import -->
          <div class="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono font-semibold text-[var(--text-primary)]">
                {{ font.source === 'uncut' || font.source === 'dafont' ? 'CSS @font-face Definition' : 'CSS @import' }}
              </span>
              <Button size="sm" variant="secondary" class="h-7 text-xs px-2.5" @click="copy(getEmbedCode('import'))">
                <Copy class="w-3 h-3 mr-1" />
                <span>Copy</span>
              </Button>
            </div>
            <pre class="p-3 bg-black/80 rounded-lg text-xs font-mono text-zinc-300 overflow-x-auto select-all"><code>{{ getEmbedCode('import') }}</code></pre>
          </div>

          <!-- HTML <link> -->
          <div class="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono font-semibold text-[var(--text-primary)]">HTML &lt;link&gt; or Preload</span>
              <Button size="sm" variant="secondary" class="h-7 text-xs px-2.5" @click="copy(getEmbedCode('html'))">
                <Copy class="w-3 h-3 mr-1" />
                <span>Copy</span>
              </Button>
            </div>
            <pre class="p-3 bg-black/80 rounded-lg text-xs font-mono text-zinc-300 overflow-x-auto select-all"><code>{{ getEmbedCode('html') }}</code></pre>
          </div>

          <!-- CSS font-family rule -->
          <div class="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono font-semibold text-[var(--text-primary)]">CSS font-family</span>
              <Button size="sm" variant="secondary" class="h-7 text-xs px-2.5" @click="copy(getEmbedCode('css'))">
                <Copy class="w-3 h-3 mr-1" />
                <span>Copy</span>
              </Button>
            </div>
            <pre class="p-3 bg-black/80 rounded-lg text-xs font-mono text-zinc-300 overflow-x-auto select-all"><code>{{ getEmbedCode('css') }}</code></pre>
          </div>

          <!-- Tailwind CSS Config -->
          <div class="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono font-semibold text-[var(--text-primary)]">Tailwind fontFamily</span>
              <Button size="sm" variant="secondary" class="h-7 text-xs px-2.5" @click="copy(getEmbedCode('tailwind'))">
                <Copy class="w-3 h-3 mr-1" />
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
