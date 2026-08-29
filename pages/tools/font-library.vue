<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  Search,
  Shuffle,
  Copy,
  Download,
  Upload,
  Check,
  Type,
  Code,
  ExternalLink,
  RefreshCw,
  Sliders,
  Globe,
  Palette,
  Eye,
  Loader2,
  Sun,
  Moon
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import { useClipboard } from '~/composables/useClipboard'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

interface FontItem {
  id: string
  name: string
  category: 'sans-serif' | 'serif' | 'display' | 'monospace' | 'handwriting' | 'retro'
  source: 'google' | 'fontshare' | 'custom'
  weights: number[]
  designer?: string
  googleFontName?: string
  fontshareName?: string
  customBlobUrl?: string
}

export interface DaFontItem {
  id: string
  name: string
  author: string
  license: string
  previewUrl: string
  downloadUrl: string
  source: 'dafont'
  category?: string
}

const toast = useToast()
const { copy } = useClipboard()

// Active Source Tab: 'all' | 'google' | 'dafont'
const activeSource = ref<'all' | 'google' | 'dafont'>('all')

// Search & Filter State
const searchQuery = ref('')
const selectedCategory = ref<string>('all')
const selectedDaFontCat = ref<string>('')
const previewText = ref('The quick brown fox jumps over the lazy dog')

// Specimen Preview Canvas Theme Toggle (for maximum readability & accessibility)
const specimenTheme = ref<'dark' | 'light'>('light')

// Playground Controls
const fontSize = ref(32)
const letterSpacing = ref(0)
const lineHeight = ref(1.4)

// DaFont Scraping State
const daFontResults = ref<DaFontItem[]>([])
const isLoadingDaFont = ref(false)

// Selected Font for Inspector Detail Modal / Drawer
const selectedFont = ref<FontItem | null>(null)

// Comprehensive Curated Catalog of 80+ Top Modern Typefaces
const FONTS_DATABASE: FontItem[] = [
  // Sans-Serif Modern
  { id: 'inter', name: 'Inter', category: 'sans-serif', source: 'google', weights: [300, 400, 500, 600, 700, 800, 900], designer: 'Rasmus Andersson' },
  { id: 'plus-jakarta-sans', name: 'Plus Jakarta Sans', category: 'sans-serif', source: 'google', weights: [300, 400, 500, 600, 700, 800], designer: 'Tokotype' },
  { id: 'outfit', name: 'Outfit', category: 'sans-serif', source: 'google', weights: [300, 400, 500, 600, 700, 800, 900], designer: 'Outfit Foundation' },
  { id: 'satoshi', name: 'Satoshi', category: 'sans-serif', source: 'fontshare', fontshareName: 'satoshi', weights: [400, 500, 700, 900], designer: 'Fontshare' },
  { id: 'general-sans', name: 'General Sans', category: 'sans-serif', source: 'fontshare', fontshareName: 'general-sans', weights: [400, 500, 600, 700], designer: 'Fontshare' },
  { id: 'cabinet-grotesk', name: 'Cabinet Grotesk', category: 'sans-serif', source: 'fontshare', fontshareName: 'cabinet-grotesk', weights: [400, 500, 700, 800, 900], designer: 'Fontshare' },
  { id: 'space-grotesk', name: 'Space Grotesk', category: 'sans-serif', source: 'google', weights: [400, 500, 600, 700], designer: 'Florian Karsten' },
  { id: 'dm-sans', name: 'DM Sans', category: 'sans-serif', source: 'google', weights: [400, 500, 700], designer: 'Colophon Foundry' },
  { id: 'poppins', name: 'Poppins', category: 'sans-serif', source: 'google', weights: [300, 400, 500, 600, 700, 800], designer: 'Indian Type Foundry' },
  { id: 'montserrat', name: 'Montserrat', category: 'sans-serif', source: 'google', weights: [300, 400, 500, 600, 700, 800, 900], designer: 'Julieta Ulanovsky' },
  { id: 'manrope', name: 'Manrope', category: 'sans-serif', source: 'google', weights: [400, 500, 600, 700, 800], designer: 'Michael Sharanda' },
  { id: 'urbanist', name: 'Urbanist', category: 'sans-serif', source: 'google', weights: [300, 400, 500, 600, 700, 800], designer: 'Corey Hu' },
  { id: 'lexend', name: 'Lexend', category: 'sans-serif', source: 'google', weights: [300, 400, 500, 600, 700, 800], designer: 'Thomas Jockin' },
  { id: 'work-sans', name: 'Work Sans', category: 'sans-serif', source: 'google', weights: [300, 400, 500, 600, 700, 800], designer: 'Wei Huang' },
  { id: 'raleway', name: 'Raleway', category: 'sans-serif', source: 'google', weights: [300, 400, 500, 600, 700, 800, 900], designer: 'Matt McInerney' },

  // Display & Brutalist
  { id: 'clash-display', name: 'Clash Display', category: 'display', source: 'fontshare', fontshareName: 'clash-display', weights: [400, 500, 600, 700], designer: 'Fontshare' },
  { id: 'syne', name: 'Syne', category: 'display', source: 'google', weights: [400, 500, 600, 700, 800], designer: 'Bonjour Monde' },
  { id: 'bebas-neue', name: 'Bebas Neue', category: 'display', source: 'google', weights: [400], designer: 'Ryoichi Tsunekawa' },
  { id: 'oswald', name: 'Oswald', category: 'display', source: 'google', weights: [400, 500, 600, 700], designer: 'Vernon Adams' },
  { id: 'anton', name: 'Anton', category: 'display', source: 'google', weights: [400], designer: 'Vernon Adams' },
  { id: 'righteous', name: 'Righteous', category: 'display', source: 'google', weights: [400], designer: 'Astigmatic' },
  { id: 'bungee', name: 'Bungee', category: 'display', source: 'google', weights: [400], designer: 'David Jonathan Ross' },
  { id: 'dela-gothic-one', name: 'Dela Gothic One', category: 'display', source: 'google', weights: [400], designer: 'artill studio' },
  { id: 'permanent-marker', name: 'Permanent Marker', category: 'display', source: 'google', weights: [400], designer: 'Font Diner' },
  { id: 'abril-fatface', name: 'Abril Fatface', category: 'display', source: 'google', weights: [400], designer: 'TypeTogether' },

  // Serif Editorial & Luxury
  { id: 'playfair-display', name: 'Playfair Display', category: 'serif', source: 'google', weights: [400, 500, 600, 700, 800, 900], designer: 'Claus Eggers Sørensen' },
  { id: 'cinzel', name: 'Cinzel', category: 'serif', source: 'google', weights: [400, 600, 700, 800, 900], designer: 'Natanael Gama' },
  { id: 'lora', name: 'Lora', category: 'serif', source: 'google', weights: [400, 500, 600, 700], designer: 'Cyreal' },
  { id: 'merriweather', name: 'Merriweather', category: 'serif', source: 'google', weights: [300, 400, 700, 900], designer: 'Sorkin Type' },
  { id: 'bodoni-moda', name: 'Bodoni Moda', category: 'serif', source: 'google', weights: [400, 500, 600, 700, 800, 900], designer: 'Owen Earl' },
  { id: 'cormorant-garamond', name: 'Cormorant Garamond', category: 'serif', source: 'google', weights: [300, 400, 500, 600, 700], designer: 'Christian Thalmann' },
  { id: 'dm-serif-display', name: 'DM Serif Display', category: 'serif', source: 'google', weights: [400], designer: 'Colophon Foundry' },
  { id: 'fraunces', name: 'Fraunces', category: 'serif', source: 'google', weights: [400, 600, 700, 900], designer: 'Undercase Type' },
  { id: 'prata', name: 'Prata', category: 'serif', source: 'google', weights: [400], designer: 'Cyreal' },
  { id: 'newsreader', name: 'Newsreader', category: 'serif', source: 'google', weights: [400, 500, 600, 700], designer: 'Production Type' },

  // Monospace & Code
  { id: 'jetbrains-mono', name: 'JetBrains Mono', category: 'monospace', source: 'google', weights: [300, 400, 500, 700, 800], designer: 'JetBrains' },
  { id: 'fira-code', name: 'Fira Code', category: 'monospace', source: 'google', weights: [300, 400, 500, 600, 700], designer: 'Nikita Prokopov' },
  { id: 'space-mono', name: 'Space Mono', category: 'monospace', source: 'google', weights: [400, 700], designer: 'Colophon Foundry' },
  { id: 'source-code-pro', name: 'Source Code Pro', category: 'monospace', source: 'google', weights: [300, 400, 500, 600, 700], designer: 'Paul D. Hunt' },
  { id: 'inconsolata', name: 'Inconsolata', category: 'monospace', source: 'google', weights: [400, 700], designer: 'Raph Levien' },
  { id: 'share-tech-mono', name: 'Share Tech Mono', category: 'monospace', source: 'google', weights: [400], designer: 'Carrois Type' },

  // Handwriting & Creative
  { id: 'caveat', name: 'Caveat', category: 'handwriting', source: 'google', weights: [400, 600, 700], designer: 'Pablo Impallari' },
  { id: 'dancing-script', name: 'Dancing Script', category: 'handwriting', source: 'google', weights: [400, 600, 700], designer: 'Pablo Impallari' },
  { id: 'pacifico', name: 'Pacifico', category: 'handwriting', source: 'google', weights: [400], designer: 'Vernon Adams' },
  { id: 'sacramento', name: 'Sacramento', category: 'handwriting', source: 'google', weights: [400], designer: 'Astigmatic' },
  { id: 'indie-flower', name: 'Indie Flower', category: 'handwriting', source: 'google', weights: [400], designer: 'Kimberly Geswein' },
  { id: 'satisfy', name: 'Satisfy', category: 'handwriting', source: 'google', weights: [400], designer: 'Sideshow' },

  // Pixel / Retro / Gaming
  { id: 'press-start-2p', name: 'Press Start 2P', category: 'retro', source: 'google', weights: [400], designer: 'CodeMan38' },
  { id: 'silkscreen', name: 'Silkscreen', category: 'retro', source: 'google', weights: [400, 700], designer: 'Jason Kottke' },
  { id: 'pixelify-sans', name: 'Pixelify Sans', category: 'retro', source: 'google', weights: [400, 600, 700], designer: 'Stefanie Vogl' },
  { id: 'vt323', name: 'VT323', category: 'retro', source: 'google', weights: [400], designer: 'Peter Hull' },
]

const customFonts = ref<FontItem[]>([])

const allGoogleFonts = computed(() => {
  return [...customFonts.value, ...FONTS_DATABASE]
})

const categories = [
  { id: 'all', label: 'All WebFonts' },
  { id: 'sans-serif', label: 'Sans-Serif' },
  { id: 'serif', label: 'Serif & Luxury' },
  { id: 'display', label: 'Display & Bold' },
  { id: 'monospace', label: 'Monospace' },
  { id: 'handwriting', label: 'Handwriting' },
  { id: 'retro', label: 'Pixel & Retro' },
]

// DaFont Curated Theme Categories
const daFontCategories = [
  { id: '', label: 'Popular / New' },
  { id: '603', label: 'Retro & Vintage' },
  { id: '303', label: 'Techno & Sci-Fi' },
  { id: '401', label: 'Gothic & Medieval' },
  { id: '601', label: 'Script & Calligraphy' },
  { id: '605', label: 'Graffiti & Urban' },
  { id: '110', label: 'Horror & Halloween' },
  { id: '102', label: 'Comic & Cartoon' },
  { id: '304', label: 'Y2K & Cyber' },
  { id: '203', label: 'Typewriter' },
]

const textPresets = [
  { label: 'Sentence', text: 'The quick brown fox jumps over the lazy dog' },
  { label: 'Alphabet', text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz' },
  { label: 'Numbers & Symbols', text: '0123456789 !@#$%^&*()_+-=[]{}|;:,.<>?' },
  { label: 'Headline', text: 'Crafting Next-Gen Visual Experiences' },
]

// Filtered Google Fonts
const filteredGoogleFonts = computed(() => {
  if (activeSource.value === 'dafont') return []
  return allGoogleFonts.value.filter((font) => {
    const matchesCategory = selectedCategory.value === 'all' || font.category === selectedCategory.value
    const matchesSearch = font.name.toLowerCase().includes(searchQuery.value.toLowerCase()) || font.designer?.toLowerCase().includes(searchQuery.value.toLowerCase())
    return matchesCategory && matchesSearch
  })
})

// Dynamic Font Loading for Google Fonts
const loadedFontsSet = new Set<string>()

const loadFontDynamically = (font: FontItem) => {
  if (typeof document === 'undefined') return
  if (loadedFontsSet.has(font.id)) return

  loadedFontsSet.add(font.id)

  if (font.source === 'google') {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    const fontParam = encodeURIComponent(font.name).replace(/%20/g, '+')
    link.href = `https://fonts.googleapis.com/css2?family=${fontParam}:wght@${font.weights.join(';')}&display=swap`
    document.head.appendChild(link)
  } else if (font.source === 'fontshare' && font.fontshareName) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://api.fontshare.com/v2/css?f[]=${font.fontshareName}@${font.weights.join(',')}&display=swap`
    document.head.appendChild(link)
  }
}

// Fetch DaFont Results via Nitro API
let daFontDebounceTimer: any = null

const fetchDaFont = async () => {
  if (activeSource.value === 'google') return

  isLoadingDaFont.value = true
  try {
    const params = new URLSearchParams()
    if (searchQuery.value.trim()) params.set('q', searchQuery.value.trim())
    if (selectedDaFontCat.value) params.set('cat', selectedDaFontCat.value)
    if (previewText.value.trim()) params.set('text', previewText.value.trim())

    const data: any = await $fetch(`/api/fonts/dafont?${params.toString()}`)
    if (data?.success && Array.isArray(data.fonts)) {
      daFontResults.value = data.fonts
    } else {
      daFontResults.value = []
    }
  } catch {
    daFontResults.value = []
  } finally {
    isLoadingDaFont.value = false
  }
}

const triggerDebouncedDaFontFetch = () => {
  if (daFontDebounceTimer) clearTimeout(daFontDebounceTimer)
  daFontDebounceTimer = setTimeout(() => {
    fetchDaFont()
  }, 400)
}

// Watchers
watch(
  [searchQuery, selectedDaFontCat, activeSource],
  () => {
    if (activeSource.value !== 'google') {
      triggerDebouncedDaFontFetch()
    }
  }
)

watch(
  previewText,
  () => {
    if (activeSource.value !== 'google') {
      triggerDebouncedDaFontFetch()
    }
  }
)

watch(
  filteredGoogleFonts,
  (fonts) => {
    fonts.slice(0, 30).forEach((f) => loadFontDynamically(f))
  },
  { immediate: true }
)

// Random Font Picker (Shuffle)
const pickRandomFont = () => {
  if (filteredGoogleFonts.value.length === 0) return
  const randomIndex = Math.floor(Math.random() * filteredGoogleFonts.value.length)
  const font = filteredGoogleFonts.value[randomIndex]
  loadFontDynamically(font)
  selectedFont.value = font
  toast.show({
    title: 'Random Font Selected',
    description: `Showing ${font.name} (${font.category})`,
    type: 'success',
  })
}

// Custom Font File Upload (.ttf, .otf, .woff, .woff2)
const handleCustomFontUpload = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  const fontName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
  const fontId = `custom-${Date.now()}`

  try {
    const arrayBuffer = await file.arrayBuffer()
    const fontFace = new FontFace(fontName, arrayBuffer)
    await fontFace.load()
    document.fonts.add(fontFace)

    const newFont: FontItem = {
      id: fontId,
      name: fontName,
      category: 'display',
      source: 'custom',
      weights: [400, 700],
      designer: 'Custom Upload',
      customBlobUrl: URL.createObjectURL(file),
    }

    customFonts.value.unshift(newFont)
    selectedFont.value = newFont
    toast.show({
      title: 'Font Loaded',
      description: `Custom font "${fontName}" is ready to preview!`,
      type: 'success',
    })
  } catch (err: any) {
    toast.show({
      title: 'Font Load Failed',
      description: err.message || 'Could not parse font file',
      type: 'error',
    })
  }
}

// 1-Click Code Generation & Copy
const getEmbedCode = (font: FontItem, type: 'html' | 'css' | 'import' | 'tailwind') => {
  if (font.source === 'fontshare') {
    if (type === 'html') return `<link href="https://api.fontshare.com/v2/css?f[]=${font.fontshareName}@${font.weights.join(',')}&display=swap" rel="stylesheet">`
    if (type === 'import') return `@import url('https://api.fontshare.com/v2/css?f[]=${font.fontshareName}@${font.weights.join(',')}&display=swap');`
    if (type === 'css') return `font-family: '${font.name}', sans-serif;`
    if (type === 'tailwind') return `fontFamily: {\n  '${font.id}': ["'${font.name}'", 'sans-serif'],\n}`
  }

  const fontParam = encodeURIComponent(font.name).replace(/%20/g, '+')
  if (type === 'html') return `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=${fontParam}:wght@${font.weights.join(';')}&display=swap" rel="stylesheet">`
  if (type === 'import') return `@import url('https://fonts.googleapis.com/css2?family=${fontParam}:wght@${font.weights.join(';')}&display=swap');`
  if (type === 'css') return `font-family: '${font.name}', ${font.category === 'serif' ? 'serif' : font.category === 'monospace' ? 'monospace' : 'sans-serif'};`
  if (type === 'tailwind') return `fontFamily: {\n  '${font.id}': ["'${font.name}'", '${font.category === 'serif' ? 'serif' : font.category === 'monospace' ? 'monospace' : 'sans-serif'}'],\n}`
  return ''
}

const copySnippet = (font: FontItem, type: 'html' | 'css' | 'import' | 'tailwind') => {
  const code = getEmbedCode(font, type)
  copy(code)
}

// Keyboard Spacebar Shortcut for Random Font
const handleKeyDown = (e: KeyboardEvent) => {
  const activeEl = document.activeElement
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return

  if (e.code === 'Space') {
    e.preventDefault()
    pickRandomFont()
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeyDown)
    FONTS_DATABASE.slice(0, 15).forEach((f) => loadFontDynamically(f))
    fetchDaFont()
  }
})
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto pb-12">
    <!-- Header & Breadcrumbs -->
    <div>
      <div class="flex items-center gap-2 text-xs text-[var(--text-tertiary)] mb-1">
        <NuxtLink to="/" class="hover:text-[var(--text-primary)] transition-colors">
          Dashboard
        </NuxtLink>
        <span>/</span>
        <span class="text-[var(--text-secondary)] font-medium">Tools</span>
        <span>/</span>
        <span class="text-[var(--text-primary)] font-medium">Font Library</span>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Font Library
          </h1>
          <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Browse, search, and live-preview Google Fonts & DaFont directory with instant ZIP downloads and CSS embeds.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <!-- Random Font Button -->
          <Button variant="primary" size="sm" class="font-semibold text-xs shadow-xs" @click="pickRandomFont">
            <Shuffle class="w-3.5 h-3.5 mr-1.5" />
            <span>Random WebFont</span>
            <kbd class="ml-1.5 px-1.5 py-0.5 text-[10px] bg-black/20 text-inherit rounded">Space</kbd>
          </Button>

          <!-- Custom Font Upload Label -->
          <label class="px-3 py-1.5 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-card)] hover:border-[var(--border-card-hover)] text-xs text-[var(--text-primary)] rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-xs">
            <Upload class="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
            <span>Upload Font</span>
            <input type="file" accept=".ttf,.otf,.woff,.woff2" class="hidden" @change="handleCustomFontUpload" />
          </label>
        </div>
      </div>
    </div>

    <!-- Source Selector Segmented Tabs -->
    <div class="p-1 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl inline-flex gap-1 shadow-xs">
      <button
        type="button"
        class="flex items-center gap-2 py-2 px-4 rounded-lg text-xs transition-all cursor-pointer"
        :class="activeSource === 'all' ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'"
        @click="activeSource = 'all'"
      >
        <Globe class="w-4 h-4" />
        <span>All Fonts (Google & DaFont)</span>
      </button>

      <button
        type="button"
        class="flex items-center gap-2 py-2 px-4 rounded-lg text-xs transition-all cursor-pointer"
        :class="activeSource === 'google' ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'"
        @click="activeSource = 'google'"
      >
        <Type class="w-4 h-4" />
        <span>Google WebFonts</span>
      </button>

      <button
        type="button"
        class="flex items-center gap-2 py-2 px-4 rounded-lg text-xs transition-all cursor-pointer"
        :class="activeSource === 'dafont' ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'"
        @click="activeSource = 'dafont'"
      >
        <Palette class="w-4 h-4" />
        <span>DaFont Directory (ZIP Downloads)</span>
      </button>
    </div>

    <!-- Playground Customizer Omnibar -->
    <Card :hoverable="false" class="p-4 sm:p-5 space-y-4">
      <!-- Search & Sample Text Bar -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <!-- Search Input -->
        <div class="lg:col-span-4 relative">
          <Search class="w-4 h-4 text-[var(--text-tertiary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search fonts across Google Fonts & DaFont..."
            class="w-full pl-10 pr-3 py-2.5 bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-primary)] rounded-lg text-xs sm:text-sm transition-all focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-glow)] placeholder-[var(--text-tertiary)]"
          />
        </div>

        <!-- Custom Sample Text Input -->
        <div class="lg:col-span-8 relative">
          <Type class="w-4 h-4 text-[var(--text-tertiary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            v-model="previewText"
            type="text"
            placeholder="Type your custom preview text here..."
            class="w-full pl-10 pr-28 py-2.5 bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-primary)] rounded-lg text-xs sm:text-sm transition-all focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-glow)] placeholder-[var(--text-tertiary)]"
          />
          <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              v-for="p in textPresets"
              :key="p.label"
              type="button"
              class="px-1.5 py-0.5 text-[10px] bg-[var(--bg-card-hover)] hover:bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] rounded transition-colors cursor-pointer hidden sm:inline-block"
              :title="p.text"
              @click="previewText = p.text"
            >
              {{ p.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- Categories, Theme Specimen Toggle & Controls Row -->
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2 border-t border-[var(--border-subtle)]">
        <!-- Category Filter Pills (Google Fonts or DaFont) -->
        <div v-if="activeSource !== 'dafont'" class="flex flex-wrap items-center gap-1.5">
          <button
            v-for="cat in categories"
            :key="cat.id"
            type="button"
            class="px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer"
            :class="
              selectedCategory === cat.id
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold shadow-xs'
                : 'bg-[var(--bg-input)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
            "
            @click="selectedCategory = cat.id"
          >
            {{ cat.label }}
          </button>
        </div>

        <!-- DaFont Category Theme Pills -->
        <div v-else class="flex flex-wrap items-center gap-1.5">
          <button
            v-for="cat in daFontCategories"
            :key="cat.id"
            type="button"
            class="px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer"
            :class="
              selectedDaFontCat === cat.id
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold shadow-xs'
                : 'bg-[var(--bg-input)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
            "
            @click="selectedDaFontCat = cat.id"
          >
            {{ cat.label }}
          </button>
        </div>

        <!-- Controls: Specimen Contrast Mode & Size/Spacing -->
        <div class="flex flex-wrap items-center gap-4 text-xs text-[var(--text-secondary)]">
          <!-- Specimen Preview Contrast Canvas Background Toggle -->
          <div class="flex items-center gap-1.5 bg-[var(--bg-input)] p-1 rounded-lg border border-[var(--border-subtle)]">
            <span class="text-[11px] px-1 text-[var(--text-tertiary)] font-mono">Canvas:</span>
            <button
              type="button"
              class="p-1 rounded cursor-pointer transition-colors"
              :class="specimenTheme === 'light' ? 'bg-white text-black shadow-xs font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
              title="Light Specimen Canvas (High Contrast Black on White)"
              @click="specimenTheme = 'light'"
            >
              <Sun class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              class="p-1 rounded cursor-pointer transition-colors"
              :class="specimenTheme === 'dark' ? 'bg-zinc-900 text-white shadow-xs font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
              title="Dark Specimen Canvas"
              @click="specimenTheme = 'dark'"
            >
              <Moon class="w-3.5 h-3.5" />
            </button>
          </div>

          <div class="flex items-center gap-2">
            <span>Size:</span>
            <input
              v-model.number="fontSize"
              type="range"
              min="16"
              max="64"
              step="2"
              class="w-20 sm:w-24 h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--border-subtle)] accent-[var(--primary)]"
            />
            <span class="font-mono text-[var(--text-primary)] w-8 text-right">{{ fontSize }}px</span>
          </div>

          <div class="flex items-center gap-2">
            <span>Spacing:</span>
            <input
              v-model.number="letterSpacing"
              type="range"
              min="-2"
              max="8"
              step="0.5"
              class="w-16 sm:w-20 h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--border-subtle)] accent-[var(--primary)]"
            />
            <span class="font-mono text-[var(--text-primary)] w-8 text-right">{{ letterSpacing }}px</span>
          </div>
        </div>
      </div>
    </Card>

    <!-- SECTION: DaFont Directory Scraped Results -->
    <div v-if="activeSource === 'dafont' || (activeSource === 'all' && daFontResults.length > 0)" class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Palette class="w-4 h-4 text-[var(--text-secondary)]" />
          <h2 class="text-sm font-mono uppercase tracking-wider font-semibold text-[var(--text-primary)]">
            DaFont Directory Specimens ({{ daFontResults.length }} fonts)
          </h2>
        </div>
        <div v-if="isLoadingDaFont" class="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] font-mono">
          <Loader2 class="w-3.5 h-3.5 animate-spin" />
          <span>Searching DaFont...</span>
        </div>
      </div>

      <!-- DaFont Cards Grid -->
      <div v-if="daFontResults.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="df in daFontResults"
          :key="df.id"
          class="p-5 bg-[var(--bg-card)] border border-[var(--border-card)] hover:border-[var(--border-card-hover)] rounded-[14px] transition-all space-y-4 flex flex-col justify-between shadow-xs"
        >
          <!-- Card Header -->
          <div class="flex items-start justify-between gap-2">
            <div>
              <h3 class="font-bold text-sm text-[var(--text-primary)] tracking-tight">
                {{ df.name }}
              </h3>
              <div class="flex items-center gap-2 mt-1 text-[11px] text-[var(--text-tertiary)]">
                <span>by <strong class="text-[var(--text-secondary)] font-medium">{{ df.author }}</strong></span>
                <span>•</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--bg-card-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                  {{ df.license }}
                </span>
              </div>
            </div>

            <!-- Download ZIP Action -->
            <a
              :href="df.downloadUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="px-3 py-1.5 bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-opacity shrink-0"
              title="Download font ZIP archive"
            >
              <Download class="w-3.5 h-3.5" />
              <span>Download ZIP</span>
            </a>
          </div>

          <!-- DaFont Live Specimen Image Preview Viewport (High-Contrast Clean Specimen Box) -->
          <div
            class="py-3 px-4 rounded-xl border min-h-[96px] flex items-center justify-center overflow-hidden transition-colors"
            :class="
              specimenTheme === 'light'
                ? 'bg-[#FFFFFF] border-zinc-200 text-zinc-950 shadow-xs'
                : 'bg-[#0D0D0D] border-zinc-800 text-white'
            "
          >
            <img
              :src="df.previewUrl"
              :alt="df.name"
              loading="lazy"
              decoding="async"
              class="max-h-[76px] max-w-full object-contain transition-all"
              :class="specimenTheme === 'dark' ? 'invert brightness-200 contrast-150' : 'brightness-100 contrast-125'"
            />
          </div>

          <!-- Card Footer -->
          <div class="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-tertiary)]">
            <span class="font-mono text-[10px] text-[var(--text-tertiary)]">Source: dafont.com</span>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="hover:text-[var(--text-primary)] transition-colors cursor-pointer font-medium"
                @click="copy(df.downloadUrl)"
              >
                Copy Link
              </button>
              <span>•</span>
              <a
                :href="`https://www.dafont.com/${df.id}.font`"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 font-medium"
              >
                <span>View on DaFont</span>
                <ExternalLink class="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- DaFont Empty State -->
      <Card v-else-if="!isLoadingDaFont" :hoverable="false" class="p-10 text-center space-y-3">
        <div class="w-12 h-12 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] mx-auto flex items-center justify-center text-[var(--text-tertiary)]">
          <Palette class="w-6 h-6" />
        </div>
        <div class="space-y-1">
          <h3 class="text-sm font-semibold text-[var(--text-primary)]">
            Font tidak ditemukan di direktori DaFont
          </h3>
          <p class="text-xs text-[var(--text-secondary)]">
            {{ searchQuery ? `Tidak ada font yang cocok dengan kata kunci "${searchQuery}" di DaFont.` : 'Tidak ada font yang tersedia untuk kategori ini.' }}
          </p>
        </div>
        <Button size="sm" variant="secondary" @click="searchQuery = ''; selectedDaFontCat = ''">
          Reset Pencarian DaFont
        </Button>
      </Card>
    </div>

    <!-- SECTION: Google WebFonts Catalog -->
    <div v-if="activeSource === 'google' || activeSource === 'all'" class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Type class="w-4 h-4 text-[var(--text-secondary)]" />
          <h2 class="text-sm font-mono uppercase tracking-wider font-semibold text-[var(--text-primary)]">
            Google WebFonts ({{ filteredGoogleFonts.length }} fonts)
          </h2>
        </div>
      </div>

      <!-- Google Font Cards Grid -->
      <div v-if="filteredGoogleFonts.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="font in filteredGoogleFonts"
          :key="font.id"
          class="p-5 bg-[var(--bg-card)] border rounded-[14px] transition-all hover:border-[var(--border-card-hover)] space-y-4 relative group shadow-xs"
          :class="selectedFont?.id === font.id ? 'border-[var(--border-active)] ring-1 ring-[var(--primary-glow)]' : 'border-[var(--border-card)]'"
          @mouseenter="loadFontDynamically(font)"
        >
          <!-- Card Top Bar -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="font-bold text-sm text-[var(--text-primary)] tracking-tight truncate">
                {{ font.name }}
              </span>
              <span class="px-2 py-0.5 text-[10px] uppercase font-mono tracking-wider bg-[var(--bg-card-hover)] text-[var(--text-secondary)] rounded border border-[var(--border-subtle)]">
                {{ font.category }}
              </span>
              <span v-if="font.designer" class="text-[11px] text-[var(--text-tertiary)] truncate hidden sm:inline">
                by {{ font.designer }}
              </span>
            </div>

            <!-- Quick Copy Actions -->
            <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                class="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] rounded-md border border-[var(--border-subtle)] transition-colors cursor-pointer text-[11px] flex items-center gap-1 font-mono"
                title="Copy CSS font-family"
                @click="copySnippet(font, 'css')"
              >
                <Code class="w-3 h-3" />
                <span>CSS</span>
              </button>

              <button
                type="button"
                class="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] rounded-md border border-[var(--border-subtle)] transition-colors cursor-pointer text-[11px] flex items-center gap-1 font-mono"
                title="Copy @import URL"
                @click="copySnippet(font, 'import')"
              >
                <Copy class="w-3 h-3" />
                <span>@import</span>
              </button>
            </div>
          </div>

          <!-- Live Font Preview Viewport (High-Contrast Clean Box) -->
          <div
            class="py-3 px-4 rounded-xl border min-h-[96px] flex items-center overflow-hidden transition-colors"
            :class="
              specimenTheme === 'light'
                ? 'bg-[#FFFFFF] border-zinc-200 text-zinc-950 shadow-xs'
                : 'bg-[#0D0D0D] border-zinc-800 text-white'
            "
          >
            <div
              class="w-full break-words transition-all select-all leading-normal font-normal"
              :style="{
                fontFamily: `'${font.name}', sans-serif`,
                fontSize: `${fontSize}px`,
                letterSpacing: `${letterSpacing}px`,
                lineHeight: lineHeight,
              }"
            >
              {{ previewText || font.name }}
            </div>
          </div>

          <!-- Card Footer -->
          <div class="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-tertiary)]">
            <div class="flex items-center gap-1 font-mono">
              <span>Weights:</span>
              <span class="text-[var(--text-secondary)] font-medium">{{ font.weights.join(', ') }}</span>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                class="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer underline underline-offset-2 font-medium"
                @click="copySnippet(font, 'tailwind')"
              >
                Tailwind Config
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Google Fonts Empty State -->
      <Card v-else :hoverable="false" class="p-10 text-center space-y-3">
        <div class="w-12 h-12 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] mx-auto flex items-center justify-center text-[var(--text-tertiary)]">
          <Type class="w-6 h-6" />
        </div>
        <div class="space-y-1">
          <h3 class="text-sm font-semibold text-[var(--text-primary)]">
            Font tidak ditemukan di katalog Google WebFonts
          </h3>
          <p class="text-xs text-[var(--text-secondary)]">
            Tidak ada font yang cocok dengan kata kunci "{{ searchQuery }}" di katalog Google WebFonts.
          </p>
        </div>
        <Button size="sm" variant="secondary" @click="searchQuery = ''; selectedCategory = 'all'">
          Reset Pencarian
        </Button>
      </Card>
    </div>
  </div>
</template>
