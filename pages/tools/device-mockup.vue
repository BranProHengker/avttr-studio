<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Smartphone,
  Laptop,
  Square,
  Upload,
  Download,
  Copy,
  Check,
  Eye,
  Trash2,
  Plus,
  Palette,
  Sparkles,
  Sliders,
  Image as ImageIcon,
  Pipette,
  Layers
} from 'lucide-vue-next'
import { toPng, toBlob } from 'html-to-image'
import { useToast } from '~/composables/useToast'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

const toast = useToast()

type DeviceType = 'iphone' | 'macbook' | 'clay'
type AspectRatio = '16:9' | '1:1' | '4:5' | '9:16'
type PerspectiveAngle = 'flat' | 'iso-left' | 'iso-right' | 'floating'
type BgMode = 'preset' | 'color' | 'image' | 'transparent'

const selectedDevice = ref<DeviceType>('iphone')
const selectedAspectRatio = ref<AspectRatio>('16:9')
const selectedPerspective = ref<PerspectiveAngle>('flat')
const bgMode = ref<BgMode>('preset')
const selectedBgTheme = ref<string>('gradient-obsidian')
const customBgColor = ref<string>('#171717')
const customBgImage = ref<string | null>(null)
const bgBlur = ref<number>(0)
const bgOverlay = ref<number>(15)

const paddingSize = ref(48)
const shadowIntensity = ref<'none' | 'soft' | 'dramatic' | 'glow'>('dramatic')
const deviceColor = ref<'black' | 'silver' | 'titanium'>('black')

const uploadedImage = ref<string | null>(null)
const uploadedImageName = ref<string>('')
const isExporting = ref(false)
const isCopied = ref(false)

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

const SAMPLE_IMAGES = {
  mobile: {
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    name: 'Mobile App UI',
    device: 'iphone' as DeviceType,
  },
  desktop: {
    url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1400&q=80',
    name: 'Web Dashboard UI',
    device: 'macbook' as DeviceType,
  },
}

const toDataUrl = async (url: string): Promise<string> => {
  if (!url || url.startsWith('data:')) return url
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  } catch {
    return url
  }
}

onMounted(async () => {
  uploadedImage.value = await toDataUrl(SAMPLE_IMAGES.mobile.url)
  uploadedImageName.value = SAMPLE_IMAGES.mobile.name
})

const handleImageUpload = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  const file = input.files[0]
  if (!file.type.startsWith('image/')) {
    toast.error('Invalid File', 'Please upload a valid image file (PNG, JPG, WebP)')
    return
  }

  const reader = new FileReader()
  reader.onload = (event) => {
    uploadedImage.value = (event.target?.result as string) || null
    uploadedImageName.value = file.name
    toast.success('Screenshot Loaded', `${file.name} ready for mockup`)
  }
  reader.readAsDataURL(file)
  input.value = ''
}

const handleBgImageUpload = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  const file = input.files[0]
  if (!file.type.startsWith('image/')) {
    toast.error('Invalid File', 'Please select a valid image file (PNG, JPG, WebP)')
    return
  }

  const reader = new FileReader()
  reader.onload = (event) => {
    customBgImage.value = (event.target?.result as string) || null
    bgMode.value = 'image'
    toast.success('Background Applied', `${file.name} set as custom background`)
  }
  reader.readAsDataURL(file)
  input.value = ''
}

const loadSample = async (type: 'mobile' | 'desktop') => {
  const sample = SAMPLE_IMAGES[type]
  uploadedImage.value = await toDataUrl(sample.url)
  uploadedImageName.value = sample.name
  selectedDevice.value = sample.device
  toast.info('Sample Loaded', `Loaded sample ${sample.name}`)
}

const removeScreenshot = () => {
  uploadedImage.value = null
  uploadedImageName.value = ''
  toast.info('Removed', 'Screenshot removed')
}

const aspectRatioClass = computed(() => {
  switch (selectedAspectRatio.value) {
    case '16:9': return 'aspect-16/9'
    case '1:1': return 'aspect-square max-w-xl mx-auto'
    case '4:5': return 'aspect-4/5 max-w-md mx-auto'
    case '9:16': return 'aspect-9/16 max-w-sm mx-auto'
    default: return 'aspect-16/9'
  }
})

const perspectiveStyle = computed(() => {
  switch (selectedPerspective.value) {
    case 'iso-left': return { transform: 'perspective(1200px) rotateY(16deg) rotateX(6deg) scale(0.92)' }
    case 'iso-right': return { transform: 'perspective(1200px) rotateY(-16deg) rotateX(6deg) scale(0.92)' }
    case 'floating': return { transform: 'perspective(1200px) rotateX(8deg) translateY(-8px) scale(0.95)' }
    default: return { transform: 'none' }
  }
})

const shadowClass = computed(() => {
  switch (shadowIntensity.value) {
    case 'soft': return 'shadow-xl shadow-black/40'
    case 'dramatic': return 'shadow-2xl shadow-black/80 ring-1 ring-white/10'
    case 'glow': return 'shadow-[0_20px_60px_rgba(59,130,246,0.25)] ring-1 ring-white/20'
    default: return 'shadow-none'
  }
})

const currentBgImageUrl = computed(() => {
  if (bgMode.value === 'image') return customBgImage.value
  if (bgMode.value === 'preset') {
    const preset = BG_PRESETS.find((p) => p.id === selectedBgTheme.value)
    return (preset && preset.type === 'image') ? preset.url : null
  }
  return null
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

const handleDownloadPng = async () => {
  const node = document.getElementById('mockup-render-area')
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
    link.download = `mockup_${selectedDevice.value}_${selectedPerspective.value}_${selectedAspectRatio.value.replace(':', 'x')}.png`
    link.click()
    toast.success('Mockup Downloaded', 'High-res mockup image downloaded exactly as in preview!')
  } catch (err: any) {
    toast.error('Download Failed', err.message || 'Could not export mockup image')
  } finally {
    isExporting.value = false
  }
}

const handleCopyImage = async () => {
  const node = document.getElementById('mockup-render-area')
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
    if (!blob) throw new Error('Could not render mockup image blob')

    let isWriteSupported = false
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
      try {
        const item = new ClipboardItem({ 'image/png': blob })
        await navigator.clipboard.write([item])
        isWriteSupported = true
      } catch (clipErr) {
        console.warn('Direct clipboard.write not permitted (Firefox restriction):', clipErr)
        isWriteSupported = false
      }
    }

    if (isWriteSupported) {
      isCopied.value = true
      toast.success('Image Copied', 'PNG mockup image copied to clipboard! Paste directly with Ctrl+V.')
      setTimeout(() => {
        isCopied.value = false
      }, 2500)
    } else {
      // Graceful fallback for Firefox & unsupported environments: auto-download image
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `mockup_${selectedDevice.value}_${selectedPerspective.value}.png`
      link.click()
      setTimeout(() => URL.revokeObjectURL(link.href), 1000)
      toast.info('Auto-Downloaded', 'Firefox membatasi akses clipboard image. Gambar mockup otomatis didownload!')
    }
  } catch (err: any) {
    toast.error('Copy Failed', err.message || 'Could not copy mockup image')
  } finally {
    isExporting.value = false
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
        <span class="text-[var(--text-primary)]">Device Mockup Studio</span>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Device Mockup Studio
          </h1>
          <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Wrap your screenshots into high-end Phone, Desktop, and minimal 3D mockups for portfolio showcase.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <Badge variant="badge">
            Client Privacy
          </Badge>
        </div>
      </div>
    </div>

    <!-- Main Workspace (Two Column) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left Column: Controls (4 cols) -->
      <div class="lg:col-span-4 space-y-4">
        <!-- 1. Screenshot Image & Quick Samples -->
        <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-3.5">
          <div class="flex items-center justify-between">
            <label class="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
              Screenshot Image
            </label>
            <span class="text-[11px] text-[var(--text-tertiary)]">Auto-fit</span>
          </div>

          <!-- Quick Samples Pill Buttons -->
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer"
              :class="uploadedImageName === SAMPLE_IMAGES.mobile.name ? 'bg-white text-black border-white font-semibold' : 'bg-[#18181b] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white'"
              @click="loadSample('mobile')"
            >
              <Smartphone class="w-3.5 h-3.5" />
              <span>Mobile Sample</span>
            </button>

            <button
              type="button"
              class="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer"
              :class="uploadedImageName === SAMPLE_IMAGES.desktop.name ? 'bg-white text-black border-white font-semibold' : 'bg-[#18181b] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white'"
              @click="loadSample('desktop')"
            >
              <Laptop class="w-3.5 h-3.5" />
              <span>Desktop Sample</span>
            </button>
          </div>

          <!-- Upload Dropzone / Thumbnail Active -->
          <div v-if="uploadedImage" class="p-2.5 rounded-lg bg-[#141414] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <img :src="uploadedImage" alt="Preview" class="w-10 h-10 rounded-md object-cover border border-white/10 shrink-0" />
              <div class="min-w-0">
                <div class="text-xs font-medium text-white truncate">{{ uploadedImageName || 'Custom Screenshot' }}</div>
                <div class="text-[10px] text-[var(--text-tertiary)]">Ready on mockup</div>
              </div>
            </div>

            <div class="flex items-center gap-1">
              <label class="p-1.5 rounded-md hover:bg-[#2E2E2E] text-[var(--text-secondary)] hover:text-white cursor-pointer transition-colors" title="Change screenshot">
                <Upload class="w-4 h-4" />
                <input type="file" accept="image/*" class="hidden" @change="handleImageUpload" />
              </label>
              <button
                type="button"
                class="p-1.5 rounded-md hover:bg-[#2E2E2E] text-[var(--text-secondary)] hover:text-red-400 cursor-pointer transition-colors"
                title="Remove screenshot"
                @click="removeScreenshot"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>

          <label v-else class="flex flex-col items-center justify-center gap-2 p-5 border-dashed border border-[var(--border-subtle)] hover:border-white/30 rounded-lg cursor-pointer bg-[#121212] transition-colors text-center group">
            <Upload class="w-5 h-5 text-[var(--text-tertiary)] group-hover:text-white transition-colors" />
            <span class="text-xs font-medium text-white">Click or drag your screenshot</span>
            <span class="text-[10px] text-[var(--text-tertiary)]">PNG, JPG, WebP supported</span>
            <input
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleImageUpload"
            />
          </label>
        </Card>

        <!-- 2. Device Chassis Selector -->
        <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-3">
          <label class="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider block">
            Device Chassis
          </label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="d in (['iphone', 'macbook', 'clay'] as DeviceType[])"
              :key="d"
              type="button"
              class="p-2.5 rounded-lg border text-xs font-medium flex flex-col items-center gap-1.5 transition-all cursor-pointer"
              :class="selectedDevice === d ? 'bg-white text-black border-white font-semibold' : 'bg-[#121212] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white'"
              @click="selectedDevice = d"
            >
              <Smartphone v-if="d === 'iphone'" class="w-4 h-4" />
              <Laptop v-else-if="d === 'macbook'" class="w-4 h-4" />
              <Square v-else class="w-4 h-4" />
              <span>{{ d === 'iphone' ? 'Phone' : d === 'macbook' ? 'Desktop' : 'Minimal Clay' }}</span>
            </button>
          </div>
        </Card>

        <!-- 3. Canvas Ratio & Perspective -->
        <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-4">
          <!-- Aspect Ratio -->
          <div class="space-y-2">
            <label class="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider block">
              Canvas Ratio
            </label>
            <div class="grid grid-cols-4 gap-1.5 text-xs">
              <button
                v-for="ratio in (['16:9', '1:1', '4:5', '9:16'] as AspectRatio[])"
                :key="ratio"
                type="button"
                class="py-1.5 rounded-md border font-mono transition-all cursor-pointer"
                :class="selectedAspectRatio === ratio ? 'bg-white text-black border-white font-bold' : 'bg-[#121212] border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-white'"
                @click="selectedAspectRatio = ratio"
              >
                {{ ratio }}
              </button>
            </div>
          </div>

          <!-- 3D Perspective -->
          <div class="space-y-2">
            <label class="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider block">
              Perspective Angle
            </label>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                class="py-1.5 px-3 rounded-md border text-center transition-all cursor-pointer"
                :class="selectedPerspective === 'flat' ? 'bg-[#2E2E2E] border-white/40 text-white font-semibold' : 'bg-[#121212] border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-white'"
                @click="selectedPerspective = 'flat'"
              >
                Flat (2D)
              </button>
              <button
                type="button"
                class="py-1.5 px-3 rounded-md border text-center transition-all cursor-pointer"
                :class="selectedPerspective === 'floating' ? 'bg-[#2E2E2E] border-white/40 text-white font-semibold' : 'bg-[#121212] border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-white'"
                @click="selectedPerspective = 'floating'"
              >
                Floating 3D
              </button>
              <button
                type="button"
                class="py-1.5 px-3 rounded-md border text-center transition-all cursor-pointer"
                :class="selectedPerspective === 'iso-left' ? 'bg-[#2E2E2E] border-white/40 text-white font-semibold' : 'bg-[#121212] border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-white'"
                @click="selectedPerspective = 'iso-left'"
              >
                Isometric Left
              </button>
              <button
                type="button"
                class="py-1.5 px-3 rounded-md border text-center transition-all cursor-pointer"
                :class="selectedPerspective === 'iso-right' ? 'bg-[#2E2E2E] border-white/40 text-white font-semibold' : 'bg-[#121212] border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-white'"
                @click="selectedPerspective = 'iso-right'"
              >
                Isometric Right
              </button>
            </div>
          </div>
        </Card>

        <!-- 4. Background Styling & Modes -->
        <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-3.5">
          <div class="flex items-center justify-between">
            <label class="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
              Background Style
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
            <div class="text-[11px] text-[var(--text-tertiary)]">Exports pure transparent PNG mockup with zero background</div>
          </div>
        </Card>
      </div>

      <!-- Right Column: Live Mockup Canvas Preview & Export (8 cols) -->
      <div class="lg:col-span-8 space-y-4">
        <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Eye class="w-4 h-4 text-white" />
              <span class="text-xs font-semibold text-[var(--text-primary)]">Live Mockup Render</span>
            </div>

            <div class="flex items-center gap-2 text-xs font-mono text-[var(--text-tertiary)]">
              <span>Ratio: {{ selectedAspectRatio }}</span>
              <span>•</span>
              <span class="capitalize">{{ selectedDevice }}</span>
            </div>
          </div>

          <!-- Mockup Render Viewport -->
          <div
            id="mockup-render-area"
            class="w-full rounded-xl overflow-hidden border border-[#212121] flex items-center justify-center p-8 transition-all duration-300 relative"
            :class="[aspectRatioClass, activeBgClass]"
            :style="bgMode === 'color' ? { backgroundColor: customBgColor } : {}"
          >
            <!-- Background Image Layer if selected -->
            <div
              v-if="currentBgImageUrl"
              class="absolute inset-0 pointer-events-none transition-all duration-300"
            >
              <img
                :src="currentBgImageUrl"
                alt="Background Wallpaper"
                class="w-full h-full object-cover transition-all duration-300"
                :style="{ filter: bgBlur > 0 ? `blur(${bgBlur}px)` : 'none' }"
              />
              <div
                class="absolute inset-0 bg-black transition-opacity duration-300"
                :style="{ opacity: bgOverlay / 100 }"
              />
            </div>

            <!-- Device Mockup Component Container -->
            <div
              class="transition-all duration-300 max-w-full max-h-full flex items-center justify-center relative z-10"
              :style="perspectiveStyle"
            >
              <!-- iPhone 16 Frame -->
              <div
                v-if="selectedDevice === 'iphone'"
                class="w-56 sm:w-64 rounded-[40px] p-2.5 bg-[#18181b] border-2 border-[#3f3f46] relative overflow-hidden transition-all"
                :class="shadowClass"
              >
                <!-- Dynamic Island Pill -->
                <div class="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full z-20 flex items-center justify-end pr-2">
                  <div class="w-2.5 h-2.5 rounded-full bg-[#09090b] border border-white/10" />
                </div>

                <!-- Screen Area -->
                <div class="w-full aspect-9/19.5 rounded-[32px] overflow-hidden bg-black flex items-center justify-center">
                  <img
                    v-if="uploadedImage"
                    :src="uploadedImage"
                    alt="Mockup Screenshot"
                    class="w-full h-full object-cover"
                  />
                  <div v-else class="text-xs text-white/40">No Image</div>
                </div>
              </div>

              <!-- MacBook M3 Frame -->
              <div
                v-else-if="selectedDevice === 'macbook'"
                class="w-80 sm:w-[420px] rounded-xl p-2 bg-[#18181b] border border-[#3f3f46] transition-all relative overflow-hidden"
                :class="shadowClass"
              >
                <!-- Screen Notch -->
                <div class="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-3 bg-black rounded-b-md z-20" />

                <!-- Screen Area -->
                <div class="w-full aspect-16/10 rounded-lg overflow-hidden bg-black flex items-center justify-center">
                  <img
                    v-if="uploadedImage"
                    :src="uploadedImage"
                    alt="Mockup Screenshot"
                    class="w-full h-full object-cover"
                  />
                  <div v-else class="text-xs text-white/40">No Image</div>
                </div>
              </div>

              <!-- Minimal Clay Frame -->
              <div
                v-else
                class="w-72 sm:w-80 rounded-2xl p-2 bg-[#212121] border border-white/10 transition-all overflow-hidden"
                :class="shadowClass"
              >
                <div class="w-full aspect-4/3 rounded-xl overflow-hidden bg-black flex items-center justify-center">
                  <img
                    v-if="uploadedImage"
                    :src="uploadedImage"
                    alt="Mockup Screenshot"
                    class="w-full h-full object-cover"
                  />
                  <div v-else class="text-xs text-white/40">No Image</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Action Buttons (Download & Copy) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Button
              variant="primary"
              size="default"
              :disabled="!uploadedImage || isExporting"
              @click="handleDownloadPng"
            >
              <Download class="w-4 h-4 mr-2" />
              <span>Download Image</span>
            </Button>

            <Button
              variant="secondary"
              size="default"
              :disabled="!uploadedImage || isExporting"
              @click="handleCopyImage"
            >
              <Check v-if="isCopied" class="w-4 h-4 mr-2 text-emerald-400" />
              <Copy v-else class="w-4 h-4 mr-2" />
              <span>{{ isCopied ? 'Image Copied!' : 'Copy Image' }}</span>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
