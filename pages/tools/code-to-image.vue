<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Code,
  Download,
  Copy,
  Check,
  Upload,
  Palette,
  Sparkles,
  Layers,
  Pipette,
  Maximize2,
  Minimize2,
  X,
  Plus,
  Trash2,
  RotateCcw,
  Sliders,
  Type,
  FileCode,
  Image as ImageIcon
} from 'lucide-vue-next'
import { toPng, toBlob } from 'html-to-image'
import Prism from 'prismjs'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-markup-templating'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-c'
import 'prismjs/components/prism-cpp'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-php'
import 'prismjs/components/prism-markdown'

import { useToast } from '~/composables/useToast'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

const toast = useToast()

type BgMode = 'preset' | 'color' | 'image' | 'transparent'
type WindowStyle = 'macos' | 'windows' | 'minimal' | 'none'
type ShadowStyle = 'none' | 'soft' | 'dramatic' | 'glow'

interface CodeTheme {
  id: string
  name: string
  bg: string
  text: string
  accent: string
  keyword: string
  function: string
  string: string
  comment: string
  number: string
  operator: string
}

const THEMES: CodeTheme[] = [
  {
    id: 'dracula',
    name: 'Dracula',
    bg: '#282a36',
    text: '#f8f8f2',
    accent: '#bd93f9',
    keyword: '#ff79c6',
    function: '#50fa7b',
    string: '#f1fa8c',
    comment: '#6272a4',
    number: '#bd93f9',
    operator: '#ff79c6'
  },
  {
    id: 'one-dark',
    name: 'One Dark Pro',
    bg: '#282c34',
    text: '#abb2bf',
    accent: '#61afef',
    keyword: '#c678dd',
    function: '#61afef',
    string: '#98c379',
    comment: '#5c6370',
    number: '#d19a66',
    operator: '#56b6c2'
  },
  {
    id: 'nord',
    name: 'Nord',
    bg: '#2e3440',
    text: '#d8dee9',
    accent: '#88c0d0',
    keyword: '#81a1c1',
    function: '#88c0d0',
    string: '#a3be8c',
    comment: '#616e88',
    number: '#b48ead',
    operator: '#81a1c1'
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    bg: '#0b0e14',
    text: '#e6e1cf',
    accent: '#00f0ff',
    keyword: '#ff007f',
    function: '#00f0ff',
    string: '#ffe600',
    comment: '#495162',
    number: '#ff5555',
    operator: '#00f0ff'
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    bg: '#011627',
    text: '#d6deeb',
    accent: '#82aaff',
    keyword: '#c792ea',
    function: '#82aaff',
    string: '#ecc48d',
    comment: '#637777',
    number: '#f78c6c',
    operator: '#7fdbca'
  },
  {
    id: 'monokai',
    name: 'Monokai Pro',
    bg: '#2d2a2e',
    text: '#fcfcfa',
    accent: '#ffd866',
    keyword: '#ff6188',
    function: '#a9dc76',
    string: '#ffd866',
    comment: '#727072',
    number: '#ab9df2',
    operator: '#78dce8'
  },
  {
    id: 'obsidian',
    name: 'Obsidian Foil',
    bg: '#161618',
    text: '#f4f4f5',
    accent: '#38bdf8',
    keyword: '#f43f5e',
    function: '#38bdf8',
    string: '#34d399',
    comment: '#52525b',
    number: '#fbbf24',
    operator: '#e4e4e7'
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    bg: '#0d1117',
    text: '#c9d1d9',
    accent: '#58a6ff',
    keyword: '#ff7b72',
    function: '#d2a8ff',
    string: '#a5d6ff',
    comment: '#8b949e',
    number: '#79c0ff',
    operator: '#ff7b72'
  }
]

const BG_PRESETS = [
  { id: 'gradient-obsidian', name: 'Obsidian', type: 'gradient', class: 'bg-gradient-to-br from-[#1c1c1e] via-[#0f0f10] to-[#050505]' },
  { id: 'gradient-studio', name: 'Studio Blue', type: 'gradient', class: 'bg-gradient-to-br from-[#1e293b] via-[#0f172a] to-[#020617]' },
  { id: 'gradient-emerald', name: 'Emerald', type: 'gradient', class: 'bg-gradient-to-br from-[#064e3b] via-[#022c22] to-[#0f172a]' },
  { id: 'gradient-sunset', name: 'Sunset', type: 'gradient', class: 'bg-gradient-to-br from-[#7c2d12] via-[#450a0a] to-[#1e1b4b]' },
  { id: 'gradient-violet', name: 'Midnight', type: 'gradient', class: 'bg-gradient-to-br from-[#4c1d95] via-[#1e1b4b] to-[#030712]' },
  { id: 'gradient-cyber', name: 'Cyberpunk', type: 'gradient', class: 'bg-gradient-to-br from-[#0284c7] via-[#3b0764] to-[#0f172a]' },
  { id: 'wallpaper-mesh', name: 'Mesh Art', type: 'image', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1400&q=80' },
  { id: 'wallpaper-dark', name: 'Obsidian Foil', type: 'image', url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1400&q=80' },
  { id: 'wallpaper-studio', name: 'Spotlight', type: 'image', url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1400&q=80' },
]

const QUICK_COLORS = [
  '#171717',
  '#000000',
  '#0f172a',
  '#1e1b4b',
  '#064e3b',
  '#7c2d12',
  '#27272a',
  '#ffffff',
]

const LANGUAGES = [
  { id: 'typescript', name: 'TypeScript', ext: 'ts' },
  { id: 'javascript', name: 'JavaScript', ext: 'js' },
  { id: 'python', name: 'Python', ext: 'py' },
  { id: 'jsx', name: 'React (TSX/JSX)', ext: 'tsx' },
  { id: 'rust', name: 'Rust', ext: 'rs' },
  { id: 'go', name: 'Go', ext: 'go' },
  { id: 'sql', name: 'SQL', ext: 'sql' },
  { id: 'bash', name: 'Bash / Shell', ext: 'sh' },
  { id: 'json', name: 'JSON', ext: 'json' },
  { id: 'css', name: 'CSS / Tailwind', ext: 'css' },
  { id: 'cpp', name: 'C++', ext: 'cpp' },
  { id: 'java', name: 'Java', ext: 'java' },
  { id: 'php', name: 'PHP', ext: 'php' },
  { id: 'markdown', name: 'Markdown', ext: 'md' },
]

const INITIAL_CODE = `import { ofetch } from 'ofetch'

export interface MediaPayload {
  url: string
  quality?: '1080p' | '720p' | 'audio'
}

export async function resolveMedia(payload: MediaPayload) {
  const endpoint = '/api/download/resolve'
  const response = await ofetch(endpoint, {
    method: 'POST',
    body: payload,
    timeout: 8000
  })

  return response.data
}`

const selectedLanguage = ref<string>('typescript')
const selectedTheme = ref<string>('dracula')
const windowTitle = ref<string>('resolveMedia.ts')
const windowStyle = ref<WindowStyle>('macos')
const showLineNumbers = ref<boolean>(true)
const fontSize = ref<number>(14)
const fontFamily = ref<string>('font-mono')
const shadowStyle = ref<ShadowStyle>('dramatic')
const paddingSize = ref<number>(48)
const borderRadius = ref<number>(14)

const bgMode = ref<BgMode>('preset')
const selectedBgTheme = ref<string>('gradient-obsidian')
const customBgColor = ref<string>('#171717')
const customBgImage = ref<string | null>(null)
const bgBlur = ref<number>(0)
const bgOverlay = ref<number>(15)

const code = ref<string>(INITIAL_CODE)
const isExporting = ref<boolean>(false)
const isCopied = ref<boolean>(false)
const isCodeCopied = ref<boolean>(false)

const activeTheme = computed(() => {
  return THEMES.find((t) => t.id === selectedTheme.value) || THEMES[0]
})

const escapeHtml = (str: string) => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const highlightedCode = computed(() => {
  try {
    const lang = selectedLanguage.value
    const grammar = Prism.languages[lang] || Prism.languages.typescript || Prism.languages.javascript
    if (!grammar) return escapeHtml(code.value)
    return Prism.highlight(code.value, grammar, lang)
  } catch (err) {
    return escapeHtml(code.value)
  }
})

const lines = computed(() => {
  return code.value.split('\n')
})

const activeBgClass = computed(() => {
  if (bgMode.value === 'transparent') {
    return 'bg-[#121212] bg-[radial-gradient(#333333_1px,transparent_1px)] [background-size:16px_16px]'
  }
  if (bgMode.value === 'color' || currentBgImageUrl.value) {
    return 'bg-transparent'
  }
  const preset = BG_PRESETS.find((p) => p.id === selectedBgTheme.value)
  return preset && preset.class ? preset.class : 'bg-[#171717]'
})

const currentBgImageUrl = computed(() => {
  if (bgMode.value === 'image') return customBgImage.value
  if (bgMode.value === 'preset') {
    const preset = BG_PRESETS.find((p) => p.id === selectedBgTheme.value)
    return (preset && preset.type === 'image') ? preset.url : null
  }
  return null
})

const shadowClass = computed(() => {
  switch (shadowStyle.value) {
    case 'soft': return 'shadow-xl shadow-black/40 ring-1 ring-white/5'
    case 'dramatic': return 'shadow-2xl shadow-black/80 ring-1 ring-white/10'
    case 'glow': return 'shadow-[0_20px_60px_rgba(59,130,246,0.25)] ring-1 ring-white/20'
    default: return 'shadow-none'
  }
})



const handleTabKey = (e: KeyboardEvent) => {
  if (e.key === 'Tab') {
    e.preventDefault()
    const textarea = e.target as HTMLTextAreaElement
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    code.value = code.value.substring(0, start) + '  ' + code.value.substring(end)
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + 2
    }, 0)
  }
}

const handleBgImageUpload = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  const file = input.files[0]
  if (!file.type.startsWith('image/')) {
    toast.error('Invalid File', 'Please select an image file (PNG, JPG, WebP)')
    return
  }

  const reader = new FileReader()
  reader.onload = (event) => {
    customBgImage.value = (event.target?.result as string) || null
    bgMode.value = 'image'
    toast.success('Background Applied', `${file.name} loaded as custom background`)
  }
  reader.readAsDataURL(file)
  input.value = ''
}

const handleDownloadPng = async () => {
  const node = document.getElementById('code-render-stage')
  if (!node) return
  isExporting.value = true
  try {
    const isTransparent = bgMode.value === 'transparent'
    const dataUrl = await toPng(node, {
      pixelRatio: 2.5,
      cacheBust: true,
      style: {
        border: 'none',
        borderRadius: '0',
        ...(isTransparent ? { background: 'transparent', backgroundImage: 'none' } : {})
      }
    })
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `${windowTitle.value.replace(/\.[^/.]+$/, '') || 'code'}_snippet.png`
    link.click()
    toast.success('Image Downloaded', 'High-res code screenshot exported successfully!')
  } catch (err: any) {
    toast.error('Download Failed', err.message || 'Could not export code image')
  } finally {
    isExporting.value = false
  }
}

const handleCopyImage = async () => {
  const node = document.getElementById('code-render-stage')
  if (!node) return
  isExporting.value = true
  try {
    const isTransparent = bgMode.value === 'transparent'
    const blob = await toBlob(node, {
      pixelRatio: 2.5,
      cacheBust: true,
      style: {
        border: 'none',
        borderRadius: '0',
        ...(isTransparent ? { background: 'transparent', backgroundImage: 'none' } : {})
      }
    })
    if (!blob) throw new Error('Could not render image blob')

    let isWriteSupported = false
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
      try {
        const item = new ClipboardItem({ 'image/png': blob })
        await navigator.clipboard.write([item])
        isWriteSupported = true
      } catch (clipErr) {
        console.warn('Direct clipboard.write restricted:', clipErr)
        isWriteSupported = false
      }
    }

    if (isWriteSupported) {
      isCopied.value = true
      toast.success('Image Copied', 'PNG code screenshot copied to clipboard! Paste directly with Ctrl+V.')
      setTimeout(() => {
        isCopied.value = false
      }, 2500)
    } else {
      // Fallback for Firefox
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${windowTitle.value.replace(/\.[^/.]+$/, '') || 'code'}_snippet.png`
      link.click()
      setTimeout(() => URL.revokeObjectURL(link.href), 1000)
      toast.info('Auto-Downloaded', 'Firefox membatasi akses clipboard image. Gambar code otomatis didownload!')
    }
  } catch (err: any) {
    toast.error('Copy Failed', err.message || 'Could not copy image')
  } finally {
    isExporting.value = false
  }
}

const handleCopyCode = async () => {
  try {
    await navigator.clipboard.writeText(code.value)
    isCodeCopied.value = true
    toast.success('Code Copied', 'Raw code copied to clipboard!')
    setTimeout(() => {
      isCodeCopied.value = false
    }, 2000)
  } catch (err: any) {
    toast.error('Copy Failed', err.message)
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
        <span class="text-[var(--text-secondary)] font-medium">Tools</span>
        <span>/</span>
        <span class="text-[var(--text-primary)]">Code to Image Studio</span>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Code to Image Studio
          </h1>
          <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Transform raw code snippets into high-end macOS & Windows window screenshots with syntax highlighting and gradients.
          </p>
        </div>
      </div>
    </div>

    <!-- Main Workspace (Two Column) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left Column: Settings & Configuration (4 cols) -->
      <div class="lg:col-span-4 space-y-4">
        <!-- 1. Code Language & Title -->
        <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-3.5">
          <label class="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider block">
            Code Language & File
          </label>

          <!-- Language Selector & Tab Title -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <span class="text-xs text-[var(--text-secondary)]">Language</span>
              <select
                v-model="selectedLanguage"
                class="w-full px-2.5 py-1.5 bg-[#121212] border border-[var(--border-subtle)] rounded-lg text-xs text-white focus:outline-hidden focus:border-white/40 cursor-pointer font-medium"
              >
                <option v-for="lang in LANGUAGES" :key="lang.id" :value="lang.id">
                  {{ lang.name }}
                </option>
              </select>
            </div>

            <div class="space-y-1.5">
              <span class="text-xs text-[var(--text-secondary)]">File Tab Title</span>
              <input
                v-model="windowTitle"
                type="text"
                class="w-full px-2.5 py-1.5 bg-[#121212] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-white focus:outline-hidden focus:border-white/40"
                placeholder="index.ts"
              />
            </div>
          </div>
        </Card>

        <!-- 2. Window Frame & Editor Themes -->
        <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-4">
          <label class="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider block">
            Editor Theme & Window
          </label>

          <!-- Theme Palette Grid -->
          <div class="space-y-1.5">
            <span class="text-xs text-[var(--text-secondary)]">Syntax Theme</span>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="t in THEMES"
                :key="t.id"
                type="button"
                class="p-2 rounded-lg border text-left flex items-center justify-between transition-all cursor-pointer"
                :class="selectedTheme === t.id ? 'border-white bg-[#222226] text-white shadow-xs' : 'border-[var(--border-subtle)] bg-[#121212] text-[var(--text-secondary)] hover:text-white hover:border-white/30'"
                @click="selectedTheme = t.id"
              >
                <span class="text-xs font-medium truncate">{{ t.name }}</span>
                <div class="flex items-center gap-1 shrink-0">
                  <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: t.accent }" />
                  <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: t.keyword }" />
                </div>
              </button>
            </div>
          </div>

          <!-- Window Header Style -->
          <div class="space-y-1.5">
            <span class="text-xs text-[var(--text-secondary)]">Window Header Style</span>
            <div class="grid grid-cols-4 gap-1.5 text-xs">
              <button
                type="button"
                class="py-1.5 px-2 rounded-md border text-center transition-all cursor-pointer"
                :class="windowStyle === 'macos' ? 'bg-[#2E2E2E] border-white/40 text-white font-semibold' : 'bg-[#121212] border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-white'"
                @click="windowStyle = 'macos'"
              >
                macOS
              </button>
              <button
                type="button"
                class="py-1.5 px-2 rounded-md border text-center transition-all cursor-pointer"
                :class="windowStyle === 'windows' ? 'bg-[#2E2E2E] border-white/40 text-white font-semibold' : 'bg-[#121212] border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-white'"
                @click="windowStyle = 'windows'"
              >
                Windows
              </button>
              <button
                type="button"
                class="py-1.5 px-2 rounded-md border text-center transition-all cursor-pointer"
                :class="windowStyle === 'minimal' ? 'bg-[#2E2E2E] border-white/40 text-white font-semibold' : 'bg-[#121212] border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-white'"
                @click="windowStyle = 'minimal'"
              >
                Minimal
              </button>
              <button
                type="button"
                class="py-1.5 px-2 rounded-md border text-center transition-all cursor-pointer"
                :class="windowStyle === 'none' ? 'bg-[#2E2E2E] border-white/40 text-white font-semibold' : 'bg-[#121212] border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-white'"
                @click="windowStyle = 'none'"
              >
                None
              </button>
            </div>
          </div>

          <!-- Line Numbers & Font Size -->
          <div class="grid grid-cols-2 gap-3 pt-1 border-t border-[var(--border-subtle)]">
            <div class="space-y-1">
              <div class="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>Font Size</span>
                <span class="font-mono text-white text-[11px]">{{ fontSize }}px</span>
              </div>
              <input
                v-model.number="fontSize"
                type="range"
                min="12"
                max="20"
                step="1"
                class="w-full h-1.5 bg-[#2E2E2E] rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            <div class="space-y-1">
              <span class="text-xs text-[var(--text-secondary)]">Line Numbers</span>
              <button
                type="button"
                class="w-full py-1.5 px-2 rounded-lg border text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5"
                :class="showLineNumbers ? 'bg-white text-black border-white font-semibold' : 'bg-[#121212] border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-white'"
                @click="showLineNumbers = !showLineNumbers"
              >
                <span>{{ showLineNumbers ? 'Enabled' : 'Hidden' }}</span>
              </button>
            </div>
          </div>
        </Card>

        <!-- 3. Background Styling & Padding -->
        <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-3.5">
          <div class="flex items-center justify-between">
            <label class="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
              Background & Padding
            </label>
          </div>

          <!-- Mode Switcher Tabs with Icons -->
          <div class="grid grid-cols-4 gap-1 p-1 bg-[#141414] border border-[var(--border-subtle)] rounded-lg text-xs">
            <button
              type="button"
              class="py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              :class="bgMode === 'preset' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-tertiary)] hover:text-white'"
              @click="bgMode = 'preset'"
            >
              <Sparkles class="w-3.5 h-3.5" />
              <span>Presets</span>
            </button>
            <button
              type="button"
              class="py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              :class="bgMode === 'color' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-tertiary)] hover:text-white'"
              @click="bgMode = 'color'"
            >
              <Pipette class="w-3.5 h-3.5" />
              <span>Color</span>
            </button>
            <button
              type="button"
              class="py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              :class="bgMode === 'image' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-tertiary)] hover:text-white'"
              @click="bgMode = 'image'"
            >
              <ImageIcon class="w-3.5 h-3.5" />
              <span>Image</span>
            </button>
            <button
              type="button"
              class="py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              :class="bgMode === 'transparent' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-tertiary)] hover:text-white'"
              @click="bgMode = 'transparent'"
            >
              <Layers class="w-3.5 h-3.5" />
              <span>Transparent</span>
            </button>
          </div>

          <!-- Mode 1: Presets Swatches -->
          <div v-if="bgMode === 'preset'" class="grid grid-cols-4 gap-2 pt-1">
            <button
              v-for="bg in BG_PRESETS"
              :key="bg.id"
              type="button"
              class="h-9 rounded-md border transition-all cursor-pointer relative overflow-hidden"
              :class="[
                bg.type === 'image' ? 'bg-[#121212]' : bg.class,
                selectedBgTheme === bg.id ? 'border-white ring-2 ring-white/30' : 'border-[#2E2E2E] hover:border-white/40'
              ]"
              :title="bg.name"
              @click="selectedBgTheme = bg.id"
            >
              <img v-if="bg.type === 'image' && bg.url" :src="bg.url" :alt="bg.name" class="w-full h-full object-cover opacity-80" />
            </button>
          </div>

          <!-- Mode 2: Color Picker with Pipette Icon -->
          <div v-else-if="bgMode === 'color'" class="space-y-3 pt-1">
            <div class="flex items-center gap-2.5">
              <label
                class="w-9 h-9 rounded-lg border border-white/20 relative flex items-center justify-center shrink-0 cursor-pointer shadow-xs transition-transform hover:scale-105"
                :style="{ backgroundColor: customBgColor }"
                title="Click to open color picker"
              >
                <Pipette class="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
                <input
                  v-model="customBgColor"
                  type="color"
                  class="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
              </label>
              <div class="relative flex-1">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] font-mono text-xs font-semibold">HEX</span>
                <input
                  v-model="customBgColor"
                  type="text"
                  class="w-full pl-12 pr-3 py-1.5 bg-[#121212] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-white uppercase focus:outline-hidden focus:border-white/40"
                  placeholder="#171717"
                />
              </div>
            </div>

            <!-- Quick Swatches -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <button
                v-for="c in QUICK_COLORS"
                :key="c"
                type="button"
                class="w-6 h-6 rounded-md border transition-all cursor-pointer"
                :class="customBgColor.toLowerCase() === c.toLowerCase() ? 'border-white ring-2 ring-white/40 scale-110' : 'border-white/10 hover:border-white/30'"
                :style="{ backgroundColor: c }"
                :title="c"
                @click="customBgColor = c"
              />
            </div>
          </div>

          <!-- Mode 3: Custom Background Image Upload -->
          <div v-else-if="bgMode === 'image'" class="space-y-3 pt-1">
            <div v-if="customBgImage" class="p-2 rounded-lg bg-[#141414] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
              <div class="flex items-center gap-2 min-w-0">
                <img :src="customBgImage" alt="Custom BG" class="w-8 h-8 rounded object-cover border border-white/10 shrink-0" />
                <span class="text-xs text-white truncate">Custom Wallpaper</span>
              </div>
              <label class="text-xs text-white hover:underline cursor-pointer">
                Change
                <input type="file" accept="image/*" class="hidden" @change="handleBgImageUpload" />
              </label>
            </div>

            <label v-else class="flex flex-col items-center justify-center gap-1.5 p-4 border-dashed border border-[var(--border-subtle)] hover:border-white/30 rounded-lg cursor-pointer bg-[#121212] text-center">
              <Plus class="w-4 h-4 text-[var(--text-tertiary)]" />
              <span class="text-xs text-white font-medium">Upload Custom Wallpaper</span>
              <span class="text-[10px] text-[var(--text-tertiary)]">PNG, JPG, WebP</span>
              <input type="file" accept="image/*" class="hidden" @change="handleBgImageUpload" />
            </label>

            <!-- Blur & Overlay Adjustments -->
            <div class="space-y-2.5 pt-1">
              <div class="space-y-1">
                <div class="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span>Background Blur</span>
                  <span class="font-mono text-white">{{ bgBlur }}px</span>
                </div>
                <input
                  v-model.number="bgBlur"
                  type="range"
                  min="0"
                  max="24"
                  step="2"
                  class="w-full h-1.5 bg-[#2E2E2E] rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>

              <div class="space-y-1">
                <div class="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span>Dark Dim Overlay</span>
                  <span class="font-mono text-white">{{ bgOverlay }}%</span>
                </div>
                <input
                  v-model.number="bgOverlay"
                  type="range"
                  min="0"
                  max="80"
                  step="5"
                  class="w-full h-1.5 bg-[#2E2E2E] rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>
            </div>
          </div>

          <!-- Mode 4: Transparent -->
          <div v-else-if="bgMode === 'transparent'" class="p-3 bg-[#141414] border border-[var(--border-subtle)] rounded-lg text-center space-y-1">
            <div class="text-xs font-medium text-white">Transparent Background</div>
            <div class="text-[11px] text-[var(--text-tertiary)]">Exports pure transparent PNG code snippet with zero background</div>
          </div>

          <!-- Canvas Padding & Shadow Sliders -->
          <div class="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border-subtle)]">
            <div class="space-y-1">
              <div class="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>Padding</span>
                <span class="font-mono text-white text-[11px]">{{ paddingSize }}px</span>
              </div>
              <input
                v-model.number="paddingSize"
                type="range"
                min="16"
                max="80"
                step="8"
                class="w-full h-1.5 bg-[#2E2E2E] rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            <div class="space-y-1">
              <span class="text-xs text-[var(--text-secondary)]">Window Shadow</span>
              <select
                v-model="shadowStyle"
                class="w-full px-2.5 py-1.5 bg-[#121212] border border-[var(--border-subtle)] rounded-lg text-xs text-white focus:outline-hidden focus:border-white/40 cursor-pointer font-medium"
              >
                <option value="none">None</option>
                <option value="soft">Soft</option>
                <option value="dramatic">Dramatic</option>
                <option value="glow">Neon Glow</option>
              </select>
            </div>
          </div>
        </Card>
      </div>

      <!-- Right Column: Interactive Editor Canvas & Export (8 cols) -->
      <div class="lg:col-span-8 space-y-4">
        <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Code class="w-4 h-4 text-white" />
              <span class="text-xs font-semibold text-[var(--text-primary)]">Live Code Canvas</span>
            </div>

            <div class="flex items-center gap-2 text-xs font-mono text-[var(--text-tertiary)]">
              <span>{{ lines.length }} lines</span>
              <span>•</span>
              <span class="uppercase">{{ selectedLanguage }}</span>
            </div>
          </div>

          <!-- Render Viewport (What will be captured to PNG) -->
          <div
            id="code-render-stage"
            class="w-full rounded-xl overflow-hidden border border-[#212121] flex items-center justify-center transition-all duration-300 relative"
            :class="activeBgClass"
            :style="{
              padding: `${paddingSize}px`,
              backgroundColor: bgMode === 'color' ? customBgColor : undefined
            }"
          >
            <!-- Background Wallpaper Layer -->
            <div
              v-if="currentBgImageUrl"
              class="absolute inset-0 pointer-events-none transition-all duration-300"
            >
              <img
                :src="currentBgImageUrl"
                alt="Background"
                class="w-full h-full object-cover transition-all duration-300"
                :style="{ filter: bgBlur > 0 ? `blur(${bgBlur}px)` : 'none' }"
              />
              <div
                class="absolute inset-0 bg-black transition-opacity duration-300"
                :style="{ opacity: bgOverlay / 100 }"
              />
            </div>

            <!-- Code Window Card Frame -->
            <div
              class="w-full max-w-3xl rounded-xl transition-all duration-300 relative z-10 overflow-hidden border"
              :class="shadowClass"
              :style="{
                backgroundColor: activeTheme.bg,
                borderColor: `${activeTheme.comment}40`,
                borderRadius: `${borderRadius}px`
              }"
            >
              <!-- Window Header (macOS / Windows / Minimal) -->
              <div
                v-if="windowStyle !== 'none'"
                class="px-4 py-3 border-b flex items-center justify-between select-none"
                :style="{ borderColor: `${activeTheme.comment}25` }"
              >
                <!-- macOS Style Traffic Lights -->
                <div v-if="windowStyle === 'macos'" class="flex items-center gap-2">
                  <span class="w-3 h-3 rounded-full bg-[#ff5f56] border border-black/10 inline-block" />
                  <span class="w-3 h-3 rounded-full bg-[#ffbd2e] border border-black/10 inline-block" />
                  <span class="w-3 h-3 rounded-full bg-[#27c93f] border border-black/10 inline-block" />
                </div>

                <!-- Windows Style Controls -->
                <div v-else-if="windowStyle === 'windows'" class="flex items-center gap-2">
                  <span class="text-xs font-bold tracking-tight text-white/90 truncate">{{ windowTitle || 'untitled' }}</span>
                </div>

                <!-- Minimal Style / Centered Tab Title -->
                <div v-else class="flex items-center gap-2">
                  <FileCode class="w-3.5 h-3.5 opacity-60" :style="{ color: activeTheme.accent }" />
                  <span class="text-xs font-mono text-white/80">{{ windowTitle || 'code.ts' }}</span>
                </div>

                <!-- Centered macOS Title -->
                <div v-if="windowStyle === 'macos'" class="text-xs font-mono text-white/70 truncate max-w-xs">
                  {{ windowTitle || 'untitled' }}
                </div>

                <!-- Right Windows Controls Buttons -->
                <div v-if="windowStyle === 'windows'" class="flex items-center gap-3 text-white/60 text-xs">
                  <Minimize2 class="w-3 h-3 hover:text-white" />
                  <Maximize2 class="w-3 h-3 hover:text-white" />
                  <X class="w-3 h-3 hover:text-red-400" />
                </div>
                <div v-else class="w-10" />
              </div>

              <!-- Code Content Container with Overlaid Textarea for Typing -->
              <div class="relative p-4 sm:p-5 flex overflow-x-auto">
                <!-- Line Numbers Column -->
                <div
                  v-if="showLineNumbers"
                  class="pr-4 select-none font-mono text-right text-xs leading-relaxed opacity-40 shrink-0"
                  :style="{
                    color: activeTheme.comment,
                    fontSize: `${fontSize}px`,
                    lineHeight: '1.65'
                  }"
                >
                  <div v-for="n in lines.length" :key="n">{{ n }}</div>
                </div>

                <!-- Code Container -->
                <div class="relative flex-1 min-w-0 font-mono text-xs leading-relaxed overflow-hidden" :style="{ fontSize: `${fontSize}px`, lineHeight: '1.65' }">
                  <!-- Highlighted Code Render (Backdrop) -->
                  <pre
                    class="m-0 p-0 font-mono text-xs whitespace-pre select-text pointer-events-auto leading-relaxed overflow-x-auto"
                    :style="{
                      color: activeTheme.text,
                      fontSize: `${fontSize}px`,
                      lineHeight: '1.65'
                    }"
                  ><code v-html="highlightedCode" /></pre>

                  <!-- Transparent Editable Textarea (Overlay for direct typing) -->
                  <textarea
                    v-model="code"
                    spellcheck="false"
                    class="absolute inset-0 w-full h-full p-0 font-mono text-xs text-transparent caret-white bg-transparent resize-none border-none outline-hidden whitespace-pre overflow-hidden leading-relaxed select-text"
                    :style="{
                      fontSize: `${fontSize}px`,
                      lineHeight: '1.65'
                    }"
                    @keydown="handleTabKey"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Action Buttons (Download & Copy) -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <Button
              variant="primary"
              size="default"
              :disabled="!code.trim() || isExporting"
              @click="handleDownloadPng"
            >
              <Download class="w-4 h-4 mr-2" />
              <span>Download Image</span>
            </Button>

            <Button
              variant="secondary"
              size="default"
              :disabled="!code.trim() || isExporting"
              @click="handleCopyImage"
            >
              <Check v-if="isCopied" class="w-4 h-4 mr-2 text-emerald-400" />
              <Copy v-else class="w-4 h-4 mr-2" />
              <span>{{ isCopied ? 'Image Copied!' : 'Copy Image' }}</span>
            </Button>

            <Button
              variant="ghost"
              size="default"
              :disabled="!code.trim()"
              class="border border-[var(--border-subtle)]"
              @click="handleCopyCode"
            >
              <Check v-if="isCodeCopied" class="w-4 h-4 mr-2 text-emerald-400" />
              <FileCode v-else class="w-4 h-4 mr-2" />
              <span>{{ isCodeCopied ? 'Code Copied!' : 'Copy Raw Code' }}</span>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>

<style>
/* Prism Syntax Highlighting Styles driven by theme */
.token.comment,
.token.prolog,
.token.doctype,
.token.cdata {
  color: #6272a4;
  font-style: italic;
}

.token.punctuation {
  opacity: 0.8;
}

.token.namespace {
  opacity: 0.7;
}

.token.property,
.token.tag,
.token.boolean,
.token.number,
.token.constant,
.token.symbol,
.token.deleted {
  color: #bd93f9;
}

.token.selector,
.token.attr-name,
.token.string,
.token.char,
.token.builtin,
.token.inserted {
  color: #f1fa8c;
}

.token.operator,
.token.entity,
.token.url,
.language-css .token.string,
.style .token.string {
  color: #ff79c6;
}

.token.atrule,
.token.attr-value,
.token.keyword {
  color: #ff79c6;
  font-weight: 600;
}

.token.function,
.token.class-name {
  color: #50fa7b;
}

.token.regex,
.token.important,
.token.variable {
  color: #f8f8f2;
}

.token.important,
.token.bold {
  font-weight: bold;
}

.token.italic {
  font-style: italic;
}
</style>
