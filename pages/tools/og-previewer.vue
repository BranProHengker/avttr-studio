<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Share2,
  Copy,
  Check,
  Upload,
  Globe,
  FileText,
  FileCode,
  Palette,
  Info,
  ExternalLink,
  Sparkles,
  RefreshCw,
  RotateCcw,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle
} from 'lucide-vue-next'
import Prism from 'prismjs'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'

import { useToast } from '~/composables/useToast'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

const toast = useToast()

type ActivePlatform = 'twitter' | 'discord' | 'whatsapp' | 'linkedin' | 'facebook' | 'google' | 'guide'
type TwitterCardType = 'summary_large_image' | 'summary'
type CodeExportFormat = 'nextjs' | 'astro' | 'nuxt' | 'react' | 'svelte' | 'remix' | 'html'

const activeTab = ref<ActivePlatform>('twitter')
const twitterCardType = ref<TwitterCardType>('summary_large_image')
const codeFormat = ref<CodeExportFormat>('nextjs')
const isCopied = ref(false)

const url = ref('https://avttr.studio/tools/og-previewer')
const title = ref('Avttr Studio — Next-Gen Creative Web Utilities & Media Toolkit')
const description = ref('All-in-one suite of high-performance developer tools, media scrapers, SVG optimizers, device mockups, and client-side web utilities.')
const siteName = ref('Avttr Studio')
const imageUrl = ref('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&h=630&q=80')
const themeColor = ref('#3b82f6')
const twitterHandle = ref('@avttr_studio')

const PRESETS = [
  {
    name: 'SaaS Platform',
    url: 'https://avttr.studio',
    title: 'Avttr Studio — Next-Gen Creative Web Utilities & Media Toolkit',
    description: 'All-in-one suite of high-performance developer tools, media scrapers, SVG optimizers, device mockups, and client-side web utilities.',
    siteName: 'Avttr Studio',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&h=630&q=80',
    themeColor: '#3b82f6',
    twitterHandle: '@avttr_studio',
  },
  {
    name: 'Tech Blog Post',
    url: 'https://blog.avttr.studio/mastering-tailwind-v4',
    title: 'Mastering Tailwind CSS v4 & Nuxt 3 in Production',
    description: 'A deep dive into CSS theme variables, fluid responsive design tokens, and building high-performance modern web apps.',
    siteName: 'Avttr Engineering',
    imageUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1200&h=630&q=80',
    themeColor: '#10b981',
    twitterHandle: '@avttr_dev',
  },
  {
    name: 'Product Showcase',
    url: 'https://shop.avttr.studio/products/minimalist-desk-mat',
    title: 'Obsidian Desk Mat — Precision Felt & Vegan Leather',
    description: 'Engineered for developers and creators. Waterproof nano-coating with anti-fray stitched edges and ultra-smooth glide surface.',
    siteName: 'Avttr Goods',
    imageUrl: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=1200&h=630&q=80',
    themeColor: '#f59e0b',
    twitterHandle: '@avttr_goods',
  }
]

const loadPreset = (preset: typeof PRESETS[0]) => {
  url.value = preset.url
  title.value = preset.title
  description.value = preset.description
  siteName.value = preset.siteName
  imageUrl.value = preset.imageUrl
  themeColor.value = preset.themeColor
  twitterHandle.value = preset.twitterHandle
  toast.info('Preset Loaded', `Loaded ${preset.name} metadata`)
}

const resetForm = () => {
  url.value = ''
  title.value = ''
  description.value = ''
  siteName.value = ''
  imageUrl.value = ''
  themeColor.value = '#3b82f6'
  twitterHandle.value = ''
  toast.info('Form Reset', 'All metadata fields have been cleared')
}

const handleImageUpload = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  const file = input.files[0]
  if (!file.type.startsWith('image/')) {
    toast.error('Invalid File', 'Please upload a valid image (PNG, JPG, WebP)')
    return
  }

  const reader = new FileReader()
  reader.onload = (event) => {
    imageUrl.value = (event.target?.result as string) || ''
    toast.success('Image Applied', `${file.name} loaded as OG image preview`)
  }
  reader.readAsDataURL(file)
  input.value = ''
}

const displayDomain = computed(() => {
  try {
    const parsed = new URL(url.value)
    return parsed.hostname
  } catch {
    return 'example.com'
  }
})

const titleStatus = computed(() => {
  const len = title.value.length
  if (len === 0) return { label: 'Empty', color: 'text-red-400', badge: 'error' }
  if (len < 30) return { label: 'Short', color: 'text-amber-400', badge: 'warning' }
  if (len <= 65) return { label: 'Optimal', color: 'text-emerald-400', badge: 'success' }
  return { label: 'May Truncate', color: 'text-amber-400', badge: 'warning' }
})

const descStatus = computed(() => {
  const len = description.value.length
  if (len === 0) return { label: 'Empty', color: 'text-red-400', badge: 'error' }
  if (len < 60) return { label: 'Short', color: 'text-amber-400', badge: 'warning' }
  if (len <= 160) return { label: 'Optimal', color: 'text-emerald-400', badge: 'success' }
  return { label: 'May Truncate', color: 'text-amber-400', badge: 'warning' }
})

const generatedCode = computed(() => {
  const u = url.value
  const t = title.value
  const d = description.value
  const img = imageUrl.value
  const site = siteName.value
  const th = twitterHandle.value
  const c = themeColor.value

  if (codeFormat.value === 'nextjs') {
    return `// Next.js App Router (app/layout.tsx or app/page.tsx)
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '${t}',
  description: '${d}',
  themeColor: '${c}',
  openGraph: {
    type: 'website',
    url: '${u}',
    siteName: '${site}',
    title: '${t}',
    description: '${d}',
    images: [
      {
        url: '${img}',
        width: 1200,
        height: 630,
        alt: '${t}',
      },
    ],
  },
  twitter: {
    card: '${twitterCardType.value}',
    site: '${th}',
    creator: '${th}',
    title: '${t}',
    description: '${d}',
    images: ['${img}'],
  },
}`
  }

  if (codeFormat.value === 'astro') {
    return `---
// src/layouts/Layout.astro or src/pages/index.astro
interface Props {
  title?: string;
  description?: string;
}

const canonicalURL = new URL(Astro.url.pathname, Astro.site || '${u}');
---

<head>
  <!-- Primary Meta Tags -->
  <title>${t}</title>
  <meta name="title" content="${t}" />
  <meta name="description" content="${d}" />
  <meta name="theme-color" content="${c}" />
  <link rel="canonical" href={canonicalURL} />

  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${u}" />
  <meta property="og:site_name" content="${site}" />
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:image" content="${img}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <!-- Twitter / X -->
  <meta property="twitter:card" content="${twitterCardType.value}" />
  <meta property="twitter:url" content="${u}" />
  <meta property="twitter:site" content="${th}" />
  <meta property="twitter:creator" content="${th}" />
  <meta property="twitter:title" content="${t}" />
  <meta property="twitter:description" content="${d}" />
  <meta property="twitter:image" content="${img}" />
</head>`
  }

  if (codeFormat.value === 'nuxt') {
    return `// Nuxt 3 Composition API (pages or app.vue)
useSeoMeta({
  title: '${t}',
  description: '${d}',
  themeColor: '${c}',
  ogType: 'website',
  ogUrl: '${u}',
  ogSiteName: '${site}',
  ogTitle: '${t}',
  ogDescription: '${d}',
  ogImage: '${img}',
  ogImageWidth: 1200,
  ogImageHeight: 630,
  twitterCard: '${twitterCardType.value}',
  twitterSite: '${th}',
  twitterCreator: '${th}',
  twitterTitle: '${t}',
  twitterDescription: '${d}',
  twitterImage: '${img}',
})`
  }

  if (codeFormat.value === 'react') {
    return `// React 19 Document Metadata or React Helmet (src/App.tsx)
export default function Page() {
  return (
    <>
      <title>${t}</title>
      <meta name="description" content="${d}" />
      <meta name="theme-color" content="${c}" />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content="${u}" />
      <meta property="og:site_name" content="${site}" />
      <meta property="og:title" content="${t}" />
      <meta property="og:description" content="${d}" />
      <meta property="og:image" content="${img}" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      {/* Twitter / X */}
      <meta name="twitter:card" content="${twitterCardType.value}" />
      <meta name="twitter:site" content="${th}" />
      <meta name="twitter:creator" content="${th}" />
      <meta name="twitter:title" content="${t}" />
      <meta name="twitter:description" content="${d}" />
      <meta name="twitter:image" content="${img}" />
    </>
  );
}`
  }

  if (codeFormat.value === 'svelte') {
    return `<!-- SvelteKit (src/routes/+page.svelte or +layout.svelte) -->
<svelte:head>
  <title>${t}</title>
  <meta name="description" content="${d}" />
  <meta name="theme-color" content="${c}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${u}" />
  <meta property="og:site_name" content="${site}" />
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:image" content="${img}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <!-- Twitter / X -->
  <meta name="twitter:card" content="${twitterCardType.value}" />
  <meta name="twitter:site" content="${th}" />
  <meta name="twitter:creator" content="${th}" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${img}" />
</svelte:head>`
  }

  if (codeFormat.value === 'remix') {
    return `// Remix / React Router v7 (app/routes/_index.tsx)
import type { MetaFunction } from '@remix-run/node'

export const meta: MetaFunction = () => {
  return [
    { title: '${t}' },
    { name: 'description', content: '${d}' },
    { name: 'theme-color', content: '${c}' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: '${u}' },
    { property: 'og:site_name', content: '${site}' },
    { property: 'og:title', content: '${t}' },
    { property: 'og:description', content: '${d}' },
    { property: 'og:image', content: '${img}' },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { name: 'twitter:card', content: '${twitterCardType.value}' },
    { name: 'twitter:site', content: '${th}' },
    { name: 'twitter:creator', content: '${th}' },
    { name: 'twitter:title', content: '${t}' },
    { name: 'twitter:description', content: '${d}' },
    { name: 'twitter:image', content: '${img}' },
  ]
}`
  }

  return `<!-- Primary Meta Tags -->
<title>${t}</title>
<meta name="title" content="${t}" />
<meta name="description" content="${d}" />
<meta name="theme-color" content="${c}" />

<!-- Open Graph / Facebook / LinkedIn / WhatsApp -->
<meta property="og:type" content="website" />
<meta property="og:url" content="${u}" />
<meta property="og:site_name" content="${site}" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:image" content="${img}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />

<!-- Twitter / X -->
<meta name="twitter:card" content="${twitterCardType.value}" />
<meta name="twitter:url" content="${u}" />
<meta name="twitter:site" content="${th}" />
<meta name="twitter:creator" content="${th}" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${img}" />`
})

const escapeHtml = (str: string) => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const currentFileTab = computed(() => {
  switch (codeFormat.value) {
    case 'nextjs': return { file: 'app/layout.tsx', lang: 'typescript', badge: 'TypeScript' }
    case 'astro': return { file: 'src/layouts/Layout.astro', lang: 'html', badge: 'Astro' }
    case 'nuxt': return { file: 'app.vue', lang: 'typescript', badge: 'Vue 3' }
    case 'react': return { file: 'src/App.tsx', lang: 'tsx', badge: 'React TSX' }
    case 'svelte': return { file: 'src/routes/+page.svelte', lang: 'html', badge: 'Svelte' }
    case 'remix': return { file: 'app/routes/_index.tsx', lang: 'typescript', badge: 'Remix TSX' }
    default: return { file: 'index.html', lang: 'html', badge: 'HTML5' }
  }
})

const highlightedGeneratedCode = computed(() => {
  try {
    const lang = currentFileTab.value.lang
    const grammar = Prism.languages[lang] || Prism.languages.typescript || Prism.languages.javascript
    if (!grammar) return escapeHtml(generatedCode.value)
    return Prism.highlight(generatedCode.value, grammar, lang)
  } catch (err) {
    return escapeHtml(generatedCode.value)
  }
})

const codeLines = computed(() => {
  return generatedCode.value.split('\n')
})

const copyMetaCode = async () => {
  try {
    await navigator.clipboard.writeText(generatedCode.value)
    isCopied.value = true
    toast.success('Code Copied', 'Meta tags copied to clipboard!')
    setTimeout(() => {
      isCopied.value = false
    }, 2000)
  } catch (err: any) {
    toast.error('Copy Failed', err.message || 'Could not copy to clipboard')
  }
}

const OG_REFERENCE_DATA = [
  { platform: 'Universal Standard', recommended: '1200 × 630 px', aspect: '1.91 : 1', minimum: '600 × 315 px', note: 'Standard for all modern platforms' },
  { platform: 'Twitter / X (Large)', recommended: '1200 × 630 px', aspect: '1.91 : 1', minimum: '600 × 335 px', note: 'summary_large_image card' },
  { platform: 'Twitter / X (Square)', recommended: '600 × 600 px', aspect: '1 : 1', minimum: '300 × 300 px', note: 'summary small square card' },
  { platform: 'Facebook Feed', recommended: '1200 × 630 px', aspect: '1.91 : 1', minimum: '600 × 315 px', note: 'Optimal retina & mobile feed' },
  { platform: 'LinkedIn Post', recommended: '1200 × 627 px', aspect: '1.91 : 1', minimum: '1200 × 627 px', note: 'Professional feed link share' },
  { platform: 'Discord Embed', recommended: '1200 × 630 px', aspect: '1.91 : 1', minimum: '256 × 256 px', note: 'Rich message embed card' },
  { platform: 'Slack (Kendur)', recommended: '1200 × 630 px', aspect: '1.91 : 1', minimum: '250 × 250 px', note: 'Workspace message unfurling' },
  { platform: 'WhatsApp Chat', recommended: '1200 × 630 px', aspect: '1.91 : 1', minimum: '300 × 200 px', note: 'Single link or message bubble' },
  { platform: 'Telegram Messenger', recommended: '1200 × 630 px', aspect: '1.91 : 1', minimum: '300 × 200 px', note: 'Instant page view link card' },
  { platform: 'Pinterest Pin', recommended: '1200 × 630 px', aspect: '1.91 : 1', minimum: '600 × 315 px', note: 'Rich pin article preview' },
]
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
        <span class="text-[var(--text-primary)]">Open Graph Previewer</span>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Open Graph & Social Card Studio
          </h1>
          <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Simulate, test, and inspect how your website link renders across Twitter/X, Discord, WhatsApp, LinkedIn, Facebook, and Google Search.
          </p>
        </div>
      </div>
    </div>

    <!-- Main Content Workspace (2 Columns) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left Column: Input Controls (5 cols) -->
      <div class="lg:col-span-5 space-y-4">
        <!-- 1. Quick Presets -->
        <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
              Quick Samples
            </label>
            <span class="text-[11px] text-[var(--text-tertiary)]">Fill test metadata</span>
          </div>

          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="p in PRESETS"
              :key="p.name"
              type="button"
              class="py-1.5 px-2 rounded-lg border text-xs font-medium bg-[#121212] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white hover:border-white/30 transition-all cursor-pointer truncate"
              @click="loadPreset(p)"
            >
              {{ p.name }}
            </button>
          </div>
        </Card>

        <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-4">
          <div class="flex items-center justify-between">
            <label class="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider block">
              Page Information
            </label>
            <button
              type="button"
              class="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Clear all fields"
              @click="resetForm"
            >
              <RotateCcw class="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          <!-- Page URL -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-xs">
              <span class="text-[var(--text-secondary)] font-medium">Target URL</span>
              <span class="font-mono text-[var(--text-tertiary)] text-[11px]">og:url</span>
            </div>
            <div class="relative">
              <Globe class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                v-model="url"
                type="url"
                class="w-full pl-9 pr-3 py-2 bg-[#121212] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-white placeholder-[var(--text-tertiary)] focus:outline-hidden focus:border-white/40 transition-colors"
                placeholder="https://example.com/page"
              />
            </div>
          </div>

          <!-- Page Title -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-xs">
              <div class="flex items-center gap-1.5">
                <span class="text-[var(--text-secondary)] font-medium">Page Title</span>
                <span class="font-mono text-[11px]" :class="titleStatus.color">({{ title.length }}/65 chars)</span>
              </div>
              <span class="font-mono text-[var(--text-tertiary)] text-[11px]">og:title</span>
            </div>
            <input
              v-model="title"
              type="text"
              class="w-full px-3 py-2 bg-[#121212] border border-[var(--border-subtle)] rounded-lg text-xs text-white placeholder-[var(--text-tertiary)] focus:outline-hidden focus:border-white/40 transition-colors font-medium"
              placeholder="Your Engaging Page Title"
            />
          </div>

          <!-- Page Description -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-xs">
              <div class="flex items-center gap-1.5">
                <span class="text-[var(--text-secondary)] font-medium">Description</span>
                <span class="font-mono text-[11px]" :class="descStatus.color">({{ description.length }}/160 chars)</span>
              </div>
              <span class="font-mono text-[var(--text-tertiary)] text-[11px]">og:description</span>
            </div>
            <textarea
              v-model="description"
              rows="3"
              class="w-full px-3 py-2 bg-[#121212] border border-[var(--border-subtle)] rounded-lg text-xs text-white placeholder-[var(--text-tertiary)] focus:outline-hidden focus:border-white/40 transition-colors resize-none leading-relaxed"
              placeholder="Brief summary of your page content for search engines and social cards..."
            />
          </div>

          <!-- Site Name & Theme Color Row -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>Site Name</span>
                <span class="font-mono text-[10px] text-[var(--text-tertiary)]">og:site_name</span>
              </div>
              <input
                v-model="siteName"
                type="text"
                class="w-full px-3 py-2 bg-[#121212] border border-[var(--border-subtle)] rounded-lg text-xs text-white focus:outline-hidden focus:border-white/40"
                placeholder="Avttr Studio"
              />
            </div>

            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>Theme Accent</span>
                <span class="font-mono text-[10px] text-[var(--text-tertiary)]">theme-color</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg border border-white/20 relative overflow-hidden shrink-0" :style="{ backgroundColor: themeColor }">
                  <input
                    v-model="themeColor"
                    type="color"
                    class="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  />
                </div>
                <input
                  v-model="themeColor"
                  type="text"
                  class="flex-1 px-3 py-2 bg-[#121212] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-white uppercase focus:outline-hidden focus:border-white/40"
                  placeholder="#3B82F6"
                />
              </div>
            </div>
          </div>

          <!-- Twitter Handle & Card Type -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>Twitter / X User</span>
                <span class="font-mono text-[10px] text-[var(--text-tertiary)]">@handle</span>
              </div>
              <input
                v-model="twitterHandle"
                type="text"
                class="w-full px-3 py-2 bg-[#121212] border border-[var(--border-subtle)] rounded-lg text-xs text-white font-mono focus:outline-hidden focus:border-white/40"
                placeholder="@username"
              />
            </div>

            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>Card Style</span>
                <span class="font-mono text-[10px] text-[var(--text-tertiary)]">twitter:card</span>
              </div>
              <select
                v-model="twitterCardType"
                class="w-full px-3 py-2 bg-[#121212] border border-[var(--border-subtle)] rounded-lg text-xs text-white focus:outline-hidden focus:border-white/40 cursor-pointer"
              >
                <option value="summary_large_image">Large Image Card</option>
                <option value="summary">Small Square Card</option>
              </select>
            </div>
          </div>

          <!-- OG Image URL & Upload Dropzone -->
          <div class="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
            <div class="flex items-center justify-between text-xs">
              <span class="text-[var(--text-secondary)] font-medium">OG Image Source</span>
              <span class="font-mono text-[11px] text-[var(--text-tertiary)]">1200 × 630 px</span>
            </div>

            <div class="relative">
              <ImageIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                v-model="imageUrl"
                type="url"
                class="w-full pl-9 pr-3 py-2 bg-[#121212] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-white placeholder-[var(--text-tertiary)] focus:outline-hidden focus:border-white/40 transition-colors truncate"
                placeholder="https://example.com/og-image.png"
              />
            </div>

            <label class="flex items-center justify-center gap-2 p-3 border-dashed border border-[var(--border-subtle)] hover:border-white/30 rounded-lg cursor-pointer bg-[#141414] transition-colors text-center group">
              <Upload class="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-white transition-colors" />
              <span class="text-xs text-[var(--text-secondary)] group-hover:text-white transition-colors">
                Or upload local image (PNG, JPG, WebP)
              </span>
              <input
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleImageUpload"
              />
            </label>
          </div>
        </Card>
      </div>

      <!-- Right Column: Live Simulators & Specs (7 cols) -->
      <div class="lg:col-span-7 space-y-4">
        <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-4">
          <!-- Platform Selector Tabs -->
          <div class="flex items-center gap-1 p-1 bg-[#141414] border border-[var(--border-subtle)] rounded-lg overflow-x-auto text-xs scrollbar-none">
            <button
              type="button"
              class="flex items-center gap-1.5 py-1.5 px-3 rounded-md font-medium transition-all cursor-pointer shrink-0"
              :class="activeTab === 'twitter' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-tertiary)] hover:text-white'"
              @click="activeTab = 'twitter'"
            >
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>Twitter / X</span>
            </button>

            <button
              type="button"
              class="flex items-center gap-1.5 py-1.5 px-3 rounded-md font-medium transition-all cursor-pointer shrink-0"
              :class="activeTab === 'discord' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-tertiary)] hover:text-white'"
              @click="activeTab = 'discord'"
            >
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.894.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span>Discord</span>
            </button>

            <button
              type="button"
              class="flex items-center gap-1.5 py-1.5 px-3 rounded-md font-medium transition-all cursor-pointer shrink-0"
              :class="activeTab === 'whatsapp' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-tertiary)] hover:text-white'"
              @click="activeTab = 'whatsapp'"
            >
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67Z"/>
              </svg>
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              class="flex items-center gap-1.5 py-1.5 px-3 rounded-md font-medium transition-all cursor-pointer shrink-0"
              :class="activeTab === 'linkedin' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-tertiary)] hover:text-white'"
              @click="activeTab = 'linkedin'"
            >
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
              </svg>
              <span>LinkedIn</span>
            </button>

            <button
              type="button"
              class="flex items-center gap-1.5 py-1.5 px-3 rounded-md font-medium transition-all cursor-pointer shrink-0"
              :class="activeTab === 'facebook' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-tertiary)] hover:text-white'"
              @click="activeTab = 'facebook'"
            >
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span>Facebook</span>
            </button>

            <button
              type="button"
              class="flex items-center gap-1.5 py-1.5 px-3 rounded-md font-medium transition-all cursor-pointer shrink-0"
              :class="activeTab === 'google' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-tertiary)] hover:text-white'"
              @click="activeTab = 'google'"
            >
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
              </svg>
              <span>Google SERP</span>
            </button>

            <button
              type="button"
              class="flex items-center gap-1.5 py-1.5 px-3 rounded-md font-medium transition-all cursor-pointer shrink-0"
              :class="activeTab === 'guide' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-tertiary)] hover:text-white'"
              @click="activeTab = 'guide'"
            >
              <Info class="w-3.5 h-3.5" />
              <span>2026 Specs</span>
            </button>
          </div>

          <!-- Preview Stage Viewport -->
          <div class="min-h-[380px] flex items-center justify-center p-4 sm:p-6 bg-[#0a0a0a] rounded-xl border border-[var(--border-subtle)] relative overflow-hidden">
            <!-- 1. Twitter / X Simulator -->
            <div v-if="activeTab === 'twitter'" class="w-full max-w-xl space-y-3 font-sans">
              <!-- Tweet Author Header -->
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-[#1e293b] border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                  <img src="/mio.png" alt="Avatar" class="w-full h-full object-cover" />
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="font-bold text-sm text-white truncate">Avttr Studio</span>
                    <span class="text-xs text-[#71767b] font-mono">{{ twitterHandle }}</span>
                    <span class="text-xs text-[#71767b]">· Just now</span>
                  </div>
                  <p class="text-xs text-[#e7e9ea] mt-0.5">Check out our latest release! ✨</p>
                </div>
              </div>

              <!-- Twitter Card Frame (Large vs Small) -->
              <div
                v-if="twitterCardType === 'summary_large_image'"
                class="rounded-2xl border border-[#2f3336] bg-[#000000] overflow-hidden hover:border-[#536471] transition-colors cursor-pointer group"
              >
                <div class="w-full aspect-1.91/1 bg-[#16181c] relative overflow-hidden flex items-center justify-center">
                  <img
                    v-if="imageUrl"
                    :src="imageUrl"
                    alt="OG Card"
                    class="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300"
                  />
                  <div v-else class="text-xs text-white/30 font-mono">No Image Specified</div>

                  <!-- Domain Chip on Image (Modern X Style) -->
                  <div class="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[11px] text-white/90 font-mono">
                    {{ displayDomain }}
                  </div>
                </div>

                <div class="p-3 space-y-1 bg-black">
                  <div class="text-[11px] text-[#71767b] font-mono">{{ displayDomain }}</div>
                  <h3 class="font-bold text-sm text-[#e7e9ea] line-clamp-1 leading-snug">{{ title || 'Page Title' }}</h3>
                  <p class="text-xs text-[#71767b] line-clamp-2 leading-relaxed">{{ description || 'Page description will appear here...' }}</p>
                </div>
              </div>

              <!-- Twitter Small Summary Card -->
              <div
                v-else
                class="rounded-2xl border border-[#2f3336] bg-black overflow-hidden flex hover:border-[#536471] transition-colors cursor-pointer"
              >
                <div class="w-32 aspect-square bg-[#16181c] shrink-0 relative overflow-hidden flex items-center justify-center border-r border-[#2f3336]">
                  <img v-if="imageUrl" :src="imageUrl" alt="OG Thumbnail" class="w-full h-full object-cover" />
                  <div v-else class="text-[10px] text-white/30">1:1</div>
                </div>
                <div class="p-3 flex flex-col justify-center min-w-0 flex-1">
                  <div class="text-[11px] text-[#71767b] font-mono">{{ displayDomain }}</div>
                  <h3 class="font-bold text-sm text-[#e7e9ea] line-clamp-1 mt-0.5">{{ title || 'Page Title' }}</h3>
                  <p class="text-xs text-[#71767b] line-clamp-2 mt-0.5">{{ description || 'Description...' }}</p>
                </div>
              </div>
            </div>

            <!-- 2. Discord Embed Simulator -->
            <div v-else-if="activeTab === 'discord'" class="w-full max-w-xl font-sans space-y-2">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-[#5865f2] flex items-center justify-center text-white font-bold text-sm shrink-0">
                  Bot
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-semibold text-sm text-white">Avttr Bot</span>
                    <span class="px-1 py-0.5 rounded text-[10px] bg-[#5865f2] text-white uppercase font-bold">APP</span>
                    <span class="text-xs text-[#949ba4]">Today at 12:00 PM</span>
                  </div>
                  <p class="text-xs text-[#dbdee1] mt-0.5">{{ url }}</p>
                </div>
              </div>

              <!-- Rich Embed Container with Left Color Bar -->
              <div
                class="rounded-md bg-[#2b2d31] p-3 sm:p-4 border-l-4 space-y-2.5 max-w-lg shadow-md ml-12"
                :style="{ borderLeftColor: themeColor || '#5865F2' }"
              >
                <div class="text-[11px] text-[#949ba4] font-medium tracking-wide">{{ siteName || displayDomain }}</div>
                <a :href="url" target="_blank" class="font-semibold text-sm text-[#00a8fc] hover:underline block leading-snug">
                  {{ title || 'Page Title' }}
                </a>
                <p class="text-xs text-[#dbdee1] leading-relaxed line-clamp-3">
                  {{ description || 'Page description will appear inside the Discord embed snippet...' }}
                </p>

                <!-- Embed Large Image -->
                <div v-if="imageUrl" class="rounded-md overflow-hidden max-h-56 bg-[#1e1f22] border border-white/5">
                  <img :src="imageUrl" alt="Discord OG" class="w-full h-full object-cover" />
                </div>
              </div>
            </div>

            <!-- 3. WhatsApp Simulator -->
            <div v-else-if="activeTab === 'whatsapp'" class="w-full max-w-md font-sans">
              <div class="p-2.5 rounded-lg bg-[#005c4b] text-white shadow-md space-y-2 max-w-sm ml-auto relative">
                <!-- Chat link text -->
                <p class="text-xs text-[#d1d7db] underline break-all leading-relaxed">{{ url }}</p>

                <!-- WhatsApp Card Bubble -->
                <div class="rounded-lg bg-[#025143] border border-white/10 overflow-hidden">
                  <div class="w-full aspect-1.91/1 bg-black/40 overflow-hidden flex items-center justify-center">
                    <img v-if="imageUrl" :src="imageUrl" alt="WhatsApp OG" class="w-full h-full object-cover" />
                    <span v-else class="text-xs text-white/30">No Image</span>
                  </div>
                  <div class="p-2.5 space-y-0.5">
                    <h4 class="font-semibold text-xs text-white line-clamp-1">{{ title || 'Page Title' }}</h4>
                    <p class="text-[11px] text-[#8696a0] line-clamp-2 leading-tight">{{ description || 'Description...' }}</p>
                    <div class="text-[10px] text-[#8696a0] font-mono pt-1">{{ displayDomain }}</div>
                  </div>
                </div>

                <div class="text-right text-[10px] text-[#8696a0]">12:00 PM ✓✓</div>
              </div>
            </div>

            <!-- 4. LinkedIn Simulator -->
            <div v-else-if="activeTab === 'linkedin'" class="w-full max-w-lg font-sans bg-[#1b1f23] rounded-lg border border-[#38434f] overflow-hidden shadow-lg space-y-3 p-3.5">
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 rounded-full bg-[#0a66c2] text-white font-bold flex items-center justify-center text-xs shrink-0">
                  IN
                </div>
                <div class="min-w-0 flex-1">
                  <div class="font-semibold text-xs text-white truncate">{{ siteName || 'Company Name' }}</div>
                  <div class="text-[10px] text-[#909ea8]">10,420 followers • 2h • 🌐</div>
                </div>
              </div>

              <p class="text-xs text-[#e8edf2] leading-relaxed">
                Excited to share our new launch. Check out the link below 👇
              </p>

              <!-- Link Card -->
              <div class="rounded-md border border-[#38434f] bg-[#111417] overflow-hidden">
                <div class="w-full aspect-1.91/1 bg-black/40 overflow-hidden flex items-center justify-center">
                  <img v-if="imageUrl" :src="imageUrl" alt="LinkedIn OG" class="w-full h-full object-cover" />
                  <span v-else class="text-xs text-white/30">No Image</span>
                </div>
                <div class="p-3 space-y-1">
                  <div class="text-[10px] text-[#909ea8] uppercase font-mono">{{ displayDomain }}</div>
                  <h4 class="font-bold text-xs text-white line-clamp-1">{{ title || 'Page Title' }}</h4>
                  <p class="text-[11px] text-[#909ea8] line-clamp-1">{{ description || 'Description...' }}</p>
                </div>
              </div>
            </div>

            <!-- 5. Facebook Simulator -->
            <div v-else-if="activeTab === 'facebook'" class="w-full max-w-lg font-sans bg-[#242526] rounded-lg border border-[#3e4042] overflow-hidden shadow-lg space-y-3 p-3.5">
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 rounded-full bg-[#1877f2] text-white font-bold flex items-center justify-center text-xs shrink-0">
                  FB
                </div>
                <div class="min-w-0 flex-1">
                  <div class="font-semibold text-xs text-[#e4e6eb] truncate">{{ siteName || 'Page Name' }}</div>
                  <div class="text-[10px] text-[#b0b3b8]">Sponsored • 🌐</div>
                </div>
              </div>

              <p class="text-xs text-[#e4e6eb] leading-relaxed">
                Discover next-gen workflow tools built for creators and engineers.
              </p>

              <!-- Facebook Link Box -->
              <div class="rounded border border-[#3e4042] bg-[#3a3b3c]/50 overflow-hidden">
                <div class="w-full aspect-1.91/1 bg-black/40 overflow-hidden flex items-center justify-center">
                  <img v-if="imageUrl" :src="imageUrl" alt="Facebook OG" class="w-full h-full object-cover" />
                  <span v-else class="text-xs text-white/30">No Image</span>
                </div>
                <div class="p-3 space-y-0.5">
                  <div class="text-[10px] text-[#b0b3b8] uppercase font-mono">{{ displayDomain }}</div>
                  <h4 class="font-bold text-xs text-[#e4e6eb] line-clamp-1">{{ title || 'Page Title' }}</h4>
                  <p class="text-[11px] text-[#b0b3b8] line-clamp-2">{{ description || 'Description...' }}</p>
                </div>
              </div>
            </div>

            <!-- 6. Google SERP Simulator -->
            <div v-else-if="activeTab === 'google'" class="w-full max-w-lg font-sans space-y-2 bg-[#202124] p-4 rounded-xl border border-[#3c4043] shadow-md">
              <div class="flex items-center gap-2.5">
                <div class="w-6 h-6 rounded-full bg-white flex items-center justify-center text-[10px] font-bold text-black shrink-0">
                  G
                </div>
                <div class="min-w-0">
                  <div class="text-xs text-[#bdc1c6] font-medium leading-tight truncate">{{ siteName || displayDomain }}</div>
                  <div class="text-[11px] text-[#9aa0a6] font-mono truncate">{{ url }}</div>
                </div>
              </div>

              <a :href="url" target="_blank" class="text-sm font-semibold text-[#8ab4f8] hover:underline block line-clamp-1 leading-snug">
                {{ title || 'Page Title — Example Search Result' }}
              </a>

              <p class="text-xs text-[#bdc1c6] line-clamp-2 leading-relaxed">
                {{ description || 'Meta description snippet displayed by Google search algorithms below title...' }}
              </p>
            </div>

            <!-- 7. 2026 Reference Specs Guide -->
            <div v-else-if="activeTab === 'guide'" class="w-full space-y-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <CheckCircle2 class="w-4 h-4 text-emerald-400" />
                  <span class="text-xs font-semibold text-white">2026 Open Graph Dimension Specifications</span>
                </div>
                <span class="text-[11px] text-[var(--text-tertiary)] font-mono">1.91 : 1 Aspect Ratio</span>
              </div>

              <!-- Specs Table -->
              <div class="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[#121212]">
                <table class="w-full text-left text-xs">
                  <thead class="bg-[#18181b] text-[var(--text-secondary)] font-mono border-b border-[var(--border-subtle)]">
                    <tr>
                      <th class="py-2 px-3 font-semibold">Platform</th>
                      <th class="py-2 px-3 font-semibold">Recommended</th>
                      <th class="py-2 px-3 font-semibold">Aspect Ratio</th>
                      <th class="py-2 px-3 font-semibold">Minimum Size</th>
                      <th class="py-2 px-3 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-[var(--border-subtle)] text-[var(--text-secondary)] font-mono">
                    <tr v-for="(spec, idx) in OG_REFERENCE_DATA" :key="idx" class="hover:bg-white/5 transition-colors">
                      <td class="py-2 px-3 font-medium text-white">{{ spec.platform }}</td>
                      <td class="py-2 px-3 text-emerald-400 font-bold">{{ spec.recommended }}</td>
                      <td class="py-2 px-3">{{ spec.aspect }}</td>
                      <td class="py-2 px-3 text-[var(--text-tertiary)]">{{ spec.minimum }}</td>
                      <td class="py-2 px-3 text-[var(--text-tertiary)] font-sans text-[11px]">{{ spec.note }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Golden Rules Cards -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div class="p-3 rounded-lg bg-[#141414] border border-[var(--border-subtle)] space-y-1">
                  <div class="text-xs font-bold text-white flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-blue-400" />
                    Golden Dimensions: 1200 × 630 px
                  </div>
                  <p class="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    Provides maximum retina clarity on 4K desktop screens while keeping file sizes lightweight for fast mobile social sharing.
                  </p>
                </div>

                <div class="p-3 rounded-lg bg-[#141414] border border-[var(--border-subtle)] space-y-1">
                  <div class="text-xs font-bold text-white flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-emerald-400" />
                    Safe Zone Margins: 80% Center
                  </div>
                  <p class="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    Keep headlines, logos, and focal art in the center 80% box (60px padding) to prevent edge clipping on WhatsApp / Telegram thumbnails.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <!-- 3. Meta Tag Code Exporter -->
        <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div class="flex items-center gap-2">
              <label class="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                Export Meta Tags
              </label>
              <Badge variant="badge">Auto-Generated</Badge>
            </div>

            <!-- Code Format Tabs -->
            <div class="flex items-center gap-1 p-0.5 bg-[#141414] border border-[var(--border-subtle)] rounded-lg text-xs overflow-x-auto scrollbar-none">
              <button
                type="button"
                class="py-1 px-2.5 rounded-md font-medium transition-all cursor-pointer shrink-0"
                :class="codeFormat === 'nextjs' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-tertiary)] hover:text-white'"
                @click="codeFormat = 'nextjs'"
              >
                Next.js
              </button>
              <button
                type="button"
                class="py-1 px-2.5 rounded-md font-medium transition-all cursor-pointer shrink-0"
                :class="codeFormat === 'astro' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-tertiary)] hover:text-white'"
                @click="codeFormat = 'astro'"
              >
                Astro
              </button>
              <button
                type="button"
                class="py-1 px-2.5 rounded-md font-medium transition-all cursor-pointer shrink-0"
                :class="codeFormat === 'nuxt' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-tertiary)] hover:text-white'"
                @click="codeFormat = 'nuxt'"
              >
                Nuxt 3
              </button>
              <button
                type="button"
                class="py-1 px-2.5 rounded-md font-medium transition-all cursor-pointer shrink-0"
                :class="codeFormat === 'react' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-tertiary)] hover:text-white'"
                @click="codeFormat = 'react'"
              >
                React
              </button>
              <button
                type="button"
                class="py-1 px-2.5 rounded-md font-medium transition-all cursor-pointer shrink-0"
                :class="codeFormat === 'svelte' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-tertiary)] hover:text-white'"
                @click="codeFormat = 'svelte'"
              >
                SvelteKit
              </button>
              <button
                type="button"
                class="py-1 px-2.5 rounded-md font-medium transition-all cursor-pointer shrink-0"
                :class="codeFormat === 'remix' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-tertiary)] hover:text-white'"
                @click="codeFormat = 'remix'"
              >
                Remix
              </button>
              <button
                type="button"
                class="py-1 px-2.5 rounded-md font-medium transition-all cursor-pointer shrink-0"
                :class="codeFormat === 'html' ? 'bg-white text-black font-semibold shadow-xs' : 'text-[var(--text-tertiary)] hover:text-white'"
                @click="codeFormat = 'html'"
              >
                HTML5
              </button>
            </div>
          </div>

          <!-- IDE Editor Window Frame -->
          <div class="rounded-xl overflow-hidden border border-[#262626] bg-[#0d0d0e] shadow-xl">
            <!-- IDE Window Top Bar -->
            <div class="px-3.5 py-2.5 bg-[#141416] border-b border-[#262626] flex items-center justify-between gap-3 select-none">
              <!-- Left: macOS Traffic Lights & Active Tab Pill -->
              <div class="flex items-center gap-3 min-w-0">
                <div class="flex items-center gap-1.5 shrink-0">
                  <span class="w-2.5 h-2.5 rounded-full bg-[#ff5f56] inline-block opacity-90" />
                  <span class="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] inline-block opacity-90" />
                  <span class="w-2.5 h-2.5 rounded-full bg-[#27c93f] inline-block opacity-90" />
                </div>

                <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#1e1e22] border border-white/10 text-xs font-mono text-white/90 truncate">
                  <FileCode class="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span class="truncate">{{ currentFileTab.file }}</span>
                </div>
              </div>

              <!-- Right: Language Badge & Copy Button -->
              <div class="flex items-center gap-2 shrink-0">
                <span class="text-[11px] font-mono text-[var(--text-tertiary)] hidden sm:inline-block">
                  {{ currentFileTab.badge }}
                </span>

                <button
                  type="button"
                  class="py-1 px-2.5 rounded-md bg-[#222226] hover:bg-[#2e2e34] border border-white/10 text-xs font-medium text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  @click="copyMetaCode"
                >
                  <Check v-if="isCopied" class="w-3.5 h-3.5 text-emerald-400" />
                  <Copy v-else class="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  <span>{{ isCopied ? 'Copied!' : 'Copy Code' }}</span>
                </button>
              </div>
            </div>

            <!-- IDE Code Body with Line Numbers & Syntax Highlighting -->
            <div class="p-4 flex overflow-x-auto max-h-72 leading-relaxed text-xs font-mono">
              <!-- Line Numbers -->
              <div class="pr-4 select-none font-mono text-right text-[var(--text-tertiary)] opacity-40 shrink-0 space-y-0.5 leading-relaxed">
                <div v-for="n in codeLines.length" :key="n">{{ n }}</div>
              </div>

              <!-- Highlighted Code -->
              <pre class="m-0 p-0 font-mono text-xs whitespace-pre text-[#e4e4e7] leading-relaxed flex-1"><code v-html="highlightedGeneratedCode" /></pre>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>

<style>
/* Syntax Highlighting Tokens */
.token.comment,
.token.prolog,
.token.doctype,
.token.cdata {
  color: #6272a4;
  font-style: italic;
}

.token.punctuation {
  color: #abb2bf;
}

.token.property,
.token.tag,
.token.boolean,
.token.number,
.token.constant,
.token.symbol {
  color: #bd93f9;
}

.token.selector,
.token.attr-name,
.token.string,
.token.char,
.token.builtin {
  color: #98c379;
}

.token.operator,
.token.entity,
.token.url {
  color: #56b6c2;
}

.token.atrule,
.token.attr-value,
.token.keyword {
  color: #c678dd;
  font-weight: 600;
}

.token.function,
.token.class-name {
  color: #61afef;
}

.token.variable {
  color: #e06c75;
}
</style>
