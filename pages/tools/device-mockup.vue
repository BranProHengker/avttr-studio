<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Smartphone,
  Laptop,
  Tablet,
  Monitor,
  Square,
  Upload,
  Download,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Sliders,
  Maximize,
  Layers,
  Palette,
  Eye,
  Trash2
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

const toast = useToast()

type DeviceType = 'iphone' | 'macbook' | 'ipad' | 'monitor' | 'clay'
type AspectRatio = '16:9' | '1:1' | '4:5' | '9:16'
type PerspectiveAngle = 'flat' | 'iso-left' | 'iso-right' | 'floating'

const selectedDevice = ref<DeviceType>('iphone')
const selectedAspectRatio = ref<AspectRatio>('16:9')
const selectedPerspective = ref<PerspectiveAngle>('flat')
const selectedBgTheme = ref<string>('gradient-obsidian')
const customBgColor = ref('#171717')

const paddingSize = ref(48)
const shadowIntensity = ref<'none' | 'soft' | 'dramatic' | 'glow'>('dramatic')
const deviceColor = ref<'black' | 'silver' | 'titanium'>('black')

const uploadedImage = ref<string | null>(null)
const isExporting = ref(false)
const isCopied = ref(false)

const BG_PRESETS = [
  { id: 'gradient-obsidian', name: 'Obsidian', class: 'bg-gradient-to-br from-[#1c1c1e] via-[#0f0f10] to-[#050505]' },
  { id: 'gradient-emerald', name: 'Emerald', class: 'bg-gradient-to-br from-[#064e3b] via-[#022c22] to-[#0f172a]' },
  { id: 'gradient-sunset', name: 'Sunset', class: 'bg-gradient-to-br from-[#7c2d12] via-[#450a0a] to-[#1e1b4b]' },
  { id: 'gradient-violet', name: 'Midnight', class: 'bg-gradient-to-br from-[#4c1d95] via-[#1e1b4b] to-[#030712]' },
  { id: 'gradient-cyber', name: 'Cyberpunk', class: 'bg-gradient-to-br from-[#0284c7] via-[#3b0764] to-[#0f172a]' },
  { id: 'solid-dark', name: 'Pure Dark', class: 'bg-[#121212]' },
  { id: 'transparent', name: 'Transparent', class: 'bg-[#121212] bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:16px_16px]' },
]

const SAMPLE_IMAGES = {
  mobile: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
  desktop: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1400&q=80',
}

onMounted(() => {
  // Default sample image
  uploadedImage.value = SAMPLE_IMAGES.mobile
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
    toast.success('Screenshot Loaded', `${file.name} ready for mockup`)
  }
  reader.readAsDataURL(file)
  input.value = ''
}

const loadSample = (type: 'mobile' | 'desktop') => {
  uploadedImage.value = SAMPLE_IMAGES[type]
  if (type === 'desktop') {
    selectedDevice.value = 'macbook'
  } else {
    selectedDevice.value = 'iphone'
  }
  toast.info('Sample Loaded', `Loaded sample ${type} screenshot`)
}

// Compute dynamic aspect ratio styles
const aspectRatioClass = computed(() => {
  switch (selectedAspectRatio.value) {
    case '16:9':
      return 'aspect-16/9'
    case '1:1':
      return 'aspect-square'
    case '4:5':
      return 'aspect-4/5'
    case '9:16':
      return 'aspect-9/16 max-w-sm mx-auto'
    default:
      return 'aspect-16/9'
  }
})

// Compute 3D perspective style
const perspectiveStyle = computed(() => {
  switch (selectedPerspective.value) {
    case 'iso-left':
      return {
        transform: 'perspective(1200px) rotateY(16deg) rotateX(6deg) scale(0.92)',
        transformOrigin: 'center center',
      }
    case 'iso-right':
      return {
        transform: 'perspective(1200px) rotateY(-16deg) rotateX(6deg) scale(0.92)',
        transformOrigin: 'center center',
      }
    case 'floating':
      return {
        transform: 'perspective(1200px) rotateX(8deg) translateY(-8px) scale(0.95)',
        transformOrigin: 'center center',
      }
    default:
      return {
        transform: 'none',
      }
  }
})

// Compute shadow style
const shadowClass = computed(() => {
  switch (shadowIntensity.value) {
    case 'soft':
      return 'shadow-xl shadow-black/40'
    case 'dramatic':
      return 'shadow-2xl shadow-black/80 ring-1 ring-white/10'
    case 'glow':
      return 'shadow-[0_20px_60px_rgba(59,130,246,0.25)] ring-1 ring-white/20'
    case 'none':
    default:
      return 'shadow-none'
  }
})

// Background class
const activeBgClass = computed(() => {
  const preset = BG_PRESETS.find((p) => p.id === selectedBgTheme.value)
  return preset ? preset.class : 'bg-[#171717]'
})

// Render mockup to Canvas and export
const exportToCanvas = async (scale = 2): Promise<HTMLCanvasElement> => {
  const mockupContainer = document.getElementById('mockup-render-area')
  if (!mockupContainer) throw new Error('Render container not found')

  // We construct a high-resolution canvas manually to ensure 100% crisp pixel rendering
  const canvas = document.createElement('canvas')
  const width = mockupContainer.clientWidth * scale
  const height = mockupContainer.clientHeight * scale
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  // 1. Draw Background
  if (selectedBgTheme.value === 'transparent') {
    ctx.clearRect(0, 0, width, height)
  } else {
    // Fill gradient
    const grad = ctx.createLinearGradient(0, 0, width, height)
    if (selectedBgTheme.value === 'gradient-emerald') {
      grad.addColorStop(0, '#064e3b')
      grad.addColorStop(0.5, '#022c22')
      grad.addColorStop(1, '#0f172a')
    } else if (selectedBgTheme.value === 'gradient-sunset') {
      grad.addColorStop(0, '#7c2d12')
      grad.addColorStop(0.5, '#450a0a')
      grad.addColorStop(1, '#1e1b4b')
    } else if (selectedBgTheme.value === 'gradient-violet') {
      grad.addColorStop(0, '#4c1d95')
      grad.addColorStop(0.5, '#1e1b4b')
      grad.addColorStop(1, '#030712')
    } else if (selectedBgTheme.value === 'gradient-cyber') {
      grad.addColorStop(0, '#0284c7')
      grad.addColorStop(0.5, '#3b0764')
      grad.addColorStop(1, '#0f172a')
    } else if (selectedBgTheme.value === 'solid-dark') {
      grad.addColorStop(0, '#121212')
      grad.addColorStop(1, '#121212')
    } else {
      // Obsidian default
      grad.addColorStop(0, '#1c1c1e')
      grad.addColorStop(0.5, '#0f0f10')
      grad.addColorStop(1, '#050505')
    }
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)
  }

  // 2. Draw Screenshot inside Mockup Frame
  if (uploadedImage.value) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = uploadedImage.value

    await new Promise((res, rej) => {
      img.onload = res
      img.onerror = rej
    })

    const pad = paddingSize.value * scale
    const targetW = width - pad * 2
    const targetH = height - pad * 2

    // Save state for 3D transforms / rounded clip
    ctx.save()

    // Draw shadow
    if (shadowIntensity.value !== 'none') {
      ctx.shadowColor = shadowIntensity.value === 'glow' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(0, 0, 0, 0.7)'
      ctx.shadowBlur = shadowIntensity.value === 'dramatic' ? 40 * scale : 20 * scale
      ctx.shadowOffsetY = 15 * scale
    }

    // Determine device frame geometry
    let frameRadius = 24 * scale
    let framePadding = 12 * scale

    if (selectedDevice.value === 'iphone') {
      frameRadius = 36 * scale
      framePadding = 10 * scale
    } else if (selectedDevice.value === 'macbook') {
      frameRadius = 16 * scale
      framePadding = 14 * scale
    }

    // Center coordinates
    const frameX = pad
    const frameY = pad

    // Draw Outer Chassis
    ctx.fillStyle = deviceColor.value === 'silver' ? '#e2e8f0' : deviceColor.value === 'titanium' ? '#334155' : '#18181b'
    ctx.beginPath()
    ctx.roundRect(frameX, frameY, targetW, targetH, frameRadius)
    ctx.fill()

    // Inner Screen Clip
    ctx.restore()
    ctx.save()
    const screenX = frameX + framePadding
    const screenY = frameY + framePadding
    const screenW = targetW - framePadding * 2
    const screenH = targetH - framePadding * 2
    const innerRadius = Math.max(4, frameRadius - framePadding)

    ctx.beginPath()
    ctx.roundRect(screenX, screenY, screenW, screenH, innerRadius)
    ctx.clip()

    // Draw image to cover screen
    const imgAspect = img.width / img.height
    const screenAspect = screenW / screenH
    let drawW = screenW
    let drawH = screenH
    let drawX = screenX
    let drawY = screenY

    if (imgAspect > screenAspect) {
      drawW = screenH * imgAspect
      drawX = screenX + (screenW - drawW) / 2
    } else {
      drawH = screenW / imgAspect
      drawY = screenY + (screenH - drawH) / 2
    }

    ctx.drawImage(img, drawX, drawY, drawW, drawH)

    // Dynamic Island for iPhone
    if (selectedDevice.value === 'iphone') {
      const pillW = 90 * scale
      const pillH = 26 * scale
      const pillX = screenX + (screenW - pillW) / 2
      const pillY = screenY + 12 * scale
      ctx.fillStyle = '#000000'
      ctx.beginPath()
      ctx.roundRect(pillX, pillY, pillW, pillH, 14 * scale)
      ctx.fill()
    }

    ctx.restore()
  }

  return canvas
}

// Download 4K Mockup
const handleDownloadPng = async () => {
  isExporting.value = true
  try {
    const canvas = await exportToCanvas(2)
    const url = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = url
    link.download = `mockup_${selectedDevice.value}_${selectedAspectRatio.value.replace(':', 'x')}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Mockup Exported', 'High-res mockup image downloaded successfully!')
  } catch (err: any) {
    toast.error('Export Failed', err.message || 'Could not export mockup')
  } finally {
    isExporting.value = false
  }
}

// Copy to Clipboard
const handleCopyImage = async () => {
  isExporting.value = true
  try {
    const canvas = await exportToCanvas(2)
    canvas.toBlob(async (blob) => {
      if (!blob) throw new Error('Blob conversion failed')
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ])
      isCopied.value = true
      toast.success('Copied to Clipboard', 'Mockup image copied! You can paste it directly into Discord, Figma, or Twitter.')
      setTimeout(() => {
        isCopied.value = false
      }, 2000)
    }, 'image/png')
  } catch (err: any) {
    toast.error('Copy Failed', err.message || 'Clipboard copy not supported on this browser')
  } finally {
    isExporting.value = false
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
            <Smartphone class="w-4.5 h-4.5 text-white" />
          </div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Device Mockup Studio
          </h1>
        </div>
        <p class="text-xs sm:text-sm text-[var(--text-secondary)]">
          Wrap your screenshots into high-end iPhone 16 Pro, MacBook, and minimal 3D mockups for portfolio showcase.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Badge variant="badge">
          100% Client-Side
        </Badge>
      </div>
    </div>

    <!-- Main Workspace (Two Column) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left Column: Controls (4 cols) -->
      <div class="lg:col-span-4 space-y-4">
        <!-- 1. Upload Section -->
        <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Screenshot Image
            </label>
            <div class="flex items-center gap-2 text-[11px]">
              <button
                type="button"
                class="text-white/70 hover:text-white cursor-pointer transition-colors"
                @click="loadSample('mobile')"
              >
                Mobile Sample
              </button>
              <span class="text-[var(--text-tertiary)]">•</span>
              <button
                type="button"
                class="text-white/70 hover:text-white cursor-pointer transition-colors"
                @click="loadSample('desktop')"
              >
                Desktop Sample
              </button>
            </div>
          </div>

          <label class="flex flex-col items-center justify-center gap-2 p-4 border-dashed border border-[var(--border-subtle)] hover:border-white/30 rounded-lg cursor-pointer bg-[#121212] transition-colors text-center">
            <Upload class="w-5 h-5 text-[var(--text-tertiary)]" />
            <span class="text-xs font-medium text-white">Click or drag screenshot</span>
            <span class="text-[10px] text-[var(--text-tertiary)]">PNG, JPG, WebP supported</span>
            <input
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleImageUpload"
            />
          </label>
        </Card>

        <!-- 2. Device Frame Selector -->
        <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-3">
          <label class="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Device Type
          </label>
          <div class="grid grid-cols-3 gap-2">
            <button
              type="button"
              class="p-2.5 rounded-lg border text-xs font-medium flex flex-col items-center gap-1.5 transition-all cursor-pointer"
              :class="selectedDevice === 'iphone' ? 'bg-[#2E2E2E] border-white/40 text-white' : 'bg-[#121212] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white'"
              @click="selectedDevice = 'iphone'"
            >
              <Smartphone class="w-4 h-4" />
              <span>iPhone 16</span>
            </button>
            <button
              type="button"
              class="p-2.5 rounded-lg border text-xs font-medium flex flex-col items-center gap-1.5 transition-all cursor-pointer"
              :class="selectedDevice === 'macbook' ? 'bg-[#2E2E2E] border-white/40 text-white' : 'bg-[#121212] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white'"
              @click="selectedDevice = 'macbook'"
            >
              <Laptop class="w-4 h-4" />
              <span>MacBook M3</span>
            </button>
            <button
              type="button"
              class="p-2.5 rounded-lg border text-xs font-medium flex flex-col items-center gap-1.5 transition-all cursor-pointer"
              :class="selectedDevice === 'clay' ? 'bg-[#2E2E2E] border-white/40 text-white' : 'bg-[#121212] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white'"
              @click="selectedDevice = 'clay'"
            >
              <Square class="w-4 h-4" />
              <span>Minimal Clay</span>
            </button>
          </div>
        </Card>

        <!-- 3. Aspect Ratio & 3D Perspective -->
        <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-4">
          <!-- Aspect Ratio -->
          <div class="space-y-2">
            <label class="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Canvas Ratio
            </label>
            <div class="grid grid-cols-4 gap-1.5 text-xs">
              <button
                v-for="ratio in (['16:9', '1:1', '4:5', '9:16'] as AspectRatio[])"
                :key="ratio"
                type="button"
                class="py-1.5 rounded-md border font-mono transition-all cursor-pointer"
                :class="selectedAspectRatio === ratio ? 'bg-[#2E2E2E] border-white/40 text-white font-bold' : 'bg-[#121212] border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-white'"
                @click="selectedAspectRatio = ratio"
              >
                {{ ratio }}
              </button>
            </div>
          </div>

          <!-- 3D Perspective Angle -->
          <div class="space-y-2">
            <label class="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Perspective Angle
            </label>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                class="py-1.5 px-3 rounded-md border text-center transition-all cursor-pointer"
                :class="selectedPerspective === 'flat' ? 'bg-[#2E2E2E] border-white/40 text-white' : 'bg-[#121212] border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-white'"
                @click="selectedPerspective = 'flat'"
              >
                Flat (2D)
              </button>
              <button
                type="button"
                class="py-1.5 px-3 rounded-md border text-center transition-all cursor-pointer"
                :class="selectedPerspective === 'floating' ? 'bg-[#2E2E2E] border-white/40 text-white' : 'bg-[#121212] border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-white'"
                @click="selectedPerspective = 'floating'"
              >
                Floating 3D
              </button>
              <button
                type="button"
                class="py-1.5 px-3 rounded-md border text-center transition-all cursor-pointer"
                :class="selectedPerspective === 'iso-left' ? 'bg-[#2E2E2E] border-white/40 text-white' : 'bg-[#121212] border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-white'"
                @click="selectedPerspective = 'iso-left'"
              >
                Isometric Left
              </button>
              <button
                type="button"
                class="py-1.5 px-3 rounded-md border text-center transition-all cursor-pointer"
                :class="selectedPerspective === 'iso-right' ? 'bg-[#2E2E2E] border-white/40 text-white' : 'bg-[#121212] border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-white'"
                @click="selectedPerspective = 'iso-right'"
              >
                Isometric Right
              </button>
            </div>
          </div>
        </Card>

        <!-- 4. Background Theme Presets -->
        <Card class="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] space-y-3">
          <label class="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Background Preset
          </label>
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="bg in BG_PRESETS"
              :key="bg.id"
              type="button"
              class="h-8 rounded-md border transition-all cursor-pointer relative overflow-hidden"
              :class="[
                bg.class,
                selectedBgTheme === bg.id ? 'border-white ring-2 ring-white/20' : 'border-[#2E2E2E] hover:border-white/40'
              ]"
              :title="bg.name"
              @click="selectedBgTheme = bg.id"
            />
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
          >
            <!-- Device Mockup Component Container -->
            <div
              class="transition-all duration-300 max-w-full max-h-full flex items-center justify-center"
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
              <span>Download 4K PNG Mockup</span>
            </Button>

            <Button
              variant="secondary"
              size="default"
              :disabled="!uploadedImage || isExporting"
              @click="handleCopyImage"
            >
              <Check v-if="isCopied" class="w-4 h-4 mr-2 text-emerald-400" />
              <Copy v-else class="w-4 h-4 mr-2" />
              <span>{{ isCopied ? 'Copied Image!' : 'Copy to Clipboard' }}</span>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
