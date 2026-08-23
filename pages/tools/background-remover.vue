<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  Upload,
  Download,
  Trash2,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Check,
  RefreshCw,
  Eye,
  Sliders,
  Palette
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

const toast = useToast()

const originalImageFile = ref<File | null>(null)
const originalImageUrl = ref<string | null>(null)
const processedImageUrl = ref<string | null>(null)
const isProcessing = ref(false)
const progressStatus = ref('')
const progressPercent = ref(0)

// Background customization options
const bgType = ref<'transparent' | 'color' | 'gradient'>('transparent')
const solidBgColor = ref('#FFFFFF')
const gradientChoice = ref('linear-gradient(135deg, #667eea 0%, #764ba2 100%)')

const gradients = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)',
  'linear-gradient(120deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(to top, #0ba360 0%, #3cba92 100%)',
  'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #171717 0%, #2E2E2E 100%)',
]

// File drop & upload handler
const handleFileSelect = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  processSelectedFile(file)
}

const handleDrop = (e: DragEvent) => {
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  processSelectedFile(file)
}

const processSelectedFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    toast.error('Invalid Format', 'Please upload a PNG, JPG, or WebP image')
    return
  }

  originalImageFile.value = file
  originalImageUrl.value = URL.createObjectURL(file)
  processedImageUrl.value = null
  removeBackground()
}

// AI Background Removal via @imgly/background-removal
const removeBackground = async () => {
  if (!originalImageFile.value) return

  isProcessing.value = true
  progressPercent.value = 10
  progressStatus.value = 'Initializing AI Neural Model...'

  try {
    const { removeBackground: removeBg } = await import('@imgly/background-removal')

    progressPercent.value = 35
    progressStatus.value = 'Segmenting subject from background...'

    const blob = await removeBg(originalImageFile.value, {
      progress: (key: string, current: number, total: number) => {
        if (total > 0) {
          const pct = Math.round((current / total) * 100)
          progressPercent.value = Math.max(35, Math.min(95, pct))
          progressStatus.value = `Processing: ${key} (${pct}%)`
        }
      },
    })

    processedImageUrl.value = URL.createObjectURL(blob)
    progressPercent.value = 100
    toast.success('Cutout Ready', 'Background removed with AI precision')
  } catch (err: any) {
    console.error('BG Removal Error:', err)
    toast.error('Processing Failed', err.message || 'Could not remove background')
  } finally {
    isProcessing.value = false
  }
}

// Download Composite Result
const downloadCutout = () => {
  if (!processedImageUrl.value) return

  // If transparent, download directly
  if (bgType.value === 'transparent') {
    const link = document.createElement('a')
    link.href = processedImageUrl.value
    link.download = `cutout_${originalImageFile.value?.name.replace(/\.[^/.]+$/, '') || 'image'}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Downloaded', 'Transparent PNG cutout saved')
    return
  }

  // Composite with background color / gradient on canvas
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (bgType.value === 'color') {
      ctx.fillStyle = solidBgColor.value
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    } else if (bgType.value === 'gradient') {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      grad.addColorStop(0, '#667eea')
      grad.addColorStop(1, '#764ba2')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    ctx.drawImage(img, 0, 0)
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `composite_${originalImageFile.value?.name.replace(/\.[^/.]+$/, '') || 'image'}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Downloaded', 'High-res composite image saved')
  }
  img.src = processedImageUrl.value
}

const resetAll = () => {
  originalImageFile.value = null
  originalImageUrl.value = null
  processedImageUrl.value = null
  isProcessing.value = false
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header & Breadcrumbs -->
    <div>
      <div class="flex items-center gap-2 text-xs text-[var(--text-tertiary)] mb-1">
        <NuxtLink to="/" class="hover:text-[var(--text-primary)] transition-colors">
          Dashboard
        </NuxtLink>
        <span>/</span>
        <span class="text-[var(--text-secondary)] font-medium">Tools</span>
        <span>/</span>
        <span class="text-[var(--text-primary)]">Background Remover</span>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Background Remover
          </h1>
          <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            100% Client-Side AI segmentation to remove backgrounds instantly without uploading to external servers.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <Badge variant="secondary">
            Neural AI Model
          </Badge>
          <Badge variant="badge">
            100% Client Privacy
          </Badge>
        </div>
      </div>
    </div>

    <!-- Main Workspace -->
    <div v-if="!originalImageUrl" class="space-y-4">
      <Card :hoverable="false" class="p-8 sm:p-12 text-center">
        <label
          class="border-2 border-dashed border-[var(--border-card)] hover:border-white/40 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors group"
          @dragover.prevent
          @drop.prevent="handleDrop"
        >
          <div class="w-14 h-14 rounded-2xl bg-[var(--bg-input)] border border-[var(--border-subtle)] flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-xs">
            <Sparkles class="w-6 h-6 text-white" />
          </div>

          <div class="space-y-1 mt-2">
            <div class="text-sm font-semibold text-white">
              Drop your image here, or <span class="underline underline-offset-4">browse</span>
            </div>
            <p class="text-xs text-[var(--text-tertiary)]">
              Supports PNG, JPG, JPEG, WebP, AVIF (Max 20MB)
            </p>
          </div>

          <input type="file" accept="image/*" class="hidden" @change="handleFileSelect" />
        </label>
      </Card>
    </div>

    <!-- Active Workspace View -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left: Interactive Visual Canvas Area -->
      <div class="lg:col-span-8 space-y-4">
        <Card :hoverable="false" class="p-4 sm:p-6 flex flex-col items-center justify-center min-h-[380px] relative overflow-hidden">
          <!-- Processing Overlay -->
          <div
            v-if="isProcessing"
            class="absolute inset-0 bg-black/80 backdrop-blur-xs z-20 flex flex-col items-center justify-center p-6 text-center space-y-4"
          >
            <div class="w-10 h-10 border-3 border-white/20 border-t-white rounded-full animate-spin" />
            <div class="space-y-1.5 max-w-sm">
              <div class="text-sm font-semibold text-white">{{ progressStatus }}</div>
              <div class="w-full bg-[#2E2E2E] h-2 rounded-full overflow-hidden">
                <div
                  class="bg-white h-full transition-all duration-300 rounded-full"
                  :style="{ width: `${progressPercent}%` }"
                />
              </div>
            </div>
          </div>

          <!-- Cutout Canvas Preview -->
          <div
            class="w-full max-h-[440px] rounded-xl border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden relative shadow-inner p-4"
            :class="bgType === 'transparent' ? 'bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:16px_16px] bg-[#1a1a1a]' : ''"
            :style="
              bgType === 'color'
                ? { backgroundColor: solidBgColor }
                : bgType === 'gradient'
                ? { backgroundImage: gradientChoice }
                : {}
            "
          >
            <img
              v-if="processedImageUrl"
              :src="processedImageUrl"
              alt="Cutout result"
              class="max-h-[380px] w-auto object-contain select-none transition-all drop-shadow-md"
            />
            <img
              v-else-if="originalImageUrl"
              :src="originalImageUrl"
              alt="Original preview"
              class="max-h-[380px] w-auto object-contain select-none opacity-60"
            />
          </div>
        </Card>
      </div>

      <!-- Right: Customization Controls & Download Card -->
      <div class="lg:col-span-4 space-y-4">
        <!-- Background Options Card -->
        <Card :hoverable="false" class="p-5 space-y-4">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
            <Palette class="w-3.5 h-3.5" />
            Background Replacement
          </h3>

          <!-- BG Type Tabs -->
          <div class="grid grid-cols-3 gap-1.5 p-1 bg-[#171717] border border-[var(--border-subtle)] rounded-lg text-xs">
            <button
              type="button"
              class="py-1.5 rounded-md font-medium transition-all cursor-pointer text-center"
              :class="bgType === 'transparent' ? 'bg-[#2E2E2E] text-white font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
              @click="bgType = 'transparent'"
            >
              Transparent
            </button>
            <button
              type="button"
              class="py-1.5 rounded-md font-medium transition-all cursor-pointer text-center"
              :class="bgType === 'color' ? 'bg-[#2E2E2E] text-white font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
              @click="bgType = 'color'"
            >
              Solid Color
            </button>
            <button
              type="button"
              class="py-1.5 rounded-md font-medium transition-all cursor-pointer text-center"
              :class="bgType === 'gradient' ? 'bg-[#2E2E2E] text-white font-semibold shadow-xs' : 'text-[var(--text-secondary)] hover:text-white'"
              @click="bgType = 'gradient'"
            >
              Gradient
            </button>
          </div>

          <!-- Solid Color Customizer -->
          <div v-if="bgType === 'color'" class="space-y-2 pt-1">
            <div class="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg p-2">
              <input
                v-model="solidBgColor"
                type="color"
                class="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
              />
              <input
                v-model="solidBgColor"
                type="text"
                class="w-full text-xs font-mono text-[var(--text-primary)] uppercase bg-transparent focus:outline-none"
              />
            </div>

            <!-- Quick Swatches -->
            <div class="flex items-center gap-1.5 pt-1">
              <button
                v-for="c in ['#FFFFFF', '#000000', '#F3F4F6', '#1E293B', '#3B82F6', '#10B981', '#F59E0B', '#EF4444']"
                :key="c"
                type="button"
                class="w-6 h-6 rounded-md border border-[var(--border-subtle)] transition-transform hover:scale-110 cursor-pointer shadow-xs"
                :style="{ backgroundColor: c }"
                @click="solidBgColor = c"
              />
            </div>
          </div>

          <!-- Gradient Choices -->
          <div v-else-if="bgType === 'gradient'" class="grid grid-cols-3 gap-2 pt-1">
            <button
              v-for="grad in gradients"
              :key="grad"
              type="button"
              class="h-10 rounded-lg border border-[var(--border-subtle)] transition-transform hover:scale-105 cursor-pointer shadow-xs"
              :class="gradientChoice === grad ? 'ring-2 ring-white' : ''"
              :style="{ backgroundImage: grad }"
              @click="gradientChoice = grad"
            />
          </div>
        </Card>

        <!-- Actions Card -->
        <Card :hoverable="false" class="p-5 space-y-3">
          <Button
            variant="primary"
            class="w-full font-semibold"
            :disabled="!processedImageUrl || isProcessing"
            @click="downloadCutout"
          >
            <Download class="w-4 h-4 mr-2" />
            Download Cutout
          </Button>

          <Button
            variant="secondary"
            class="w-full text-xs"
            :disabled="isProcessing"
            @click="removeBackground"
          >
            <RefreshCw class="w-3.5 h-3.5 mr-1.5" />
            Reprocess AI
          </Button>

          <Button
            variant="ghost"
            class="w-full text-xs text-[var(--text-tertiary)] hover:text-red-400"
            @click="resetAll"
          >
            <Trash2 class="w-3.5 h-3.5 mr-1.5" />
            Upload Another Image
          </Button>
        </Card>
      </div>
    </div>
  </div>
</template>
