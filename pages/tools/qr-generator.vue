<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import QRCode from 'qrcode'
import { Download, Copy, RefreshCw, Check } from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import { useClipboard } from '~/composables/useClipboard'
import { useI18n } from '~/composables/useI18n'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

const text = ref('https://github.com')
const fgColor = ref('#000000')
const bgColor = ref('#ffffff')
const errorCorrectionLevel = ref<'L' | 'M' | 'Q' | 'H'>('M')
const qrDataUrl = ref('')
const qrSvg = ref('')

const toast = useToast()
const { copy } = useClipboard()
const { t } = useI18n()

const generateQR = async () => {
  if (!text.value) {
    qrDataUrl.value = ''
    qrSvg.value = ''
    return
  }

  try {
    // Generate PNG Data URL
    qrDataUrl.value = await QRCode.toDataURL(text.value, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: errorCorrectionLevel.value,
      color: {
        dark: fgColor.value,
        light: bgColor.value,
      },
    })

    // Generate SVG string
    qrSvg.value = await QRCode.toString(text.value, {
      type: 'svg',
      margin: 2,
      errorCorrectionLevel: errorCorrectionLevel.value,
      color: {
        dark: fgColor.value,
        light: bgColor.value,
      },
    })
  } catch (err: any) {
    toast.error('QR Error', err.message || 'Failed to generate QR code')
  }
}

const downloadPNG = () => {
  if (!qrDataUrl.value) return
  const link = document.createElement('a')
  link.href = qrDataUrl.value
  link.download = 'qrcode.png'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  toast.success('Downloaded', 'QR Code saved as PNG')
}

const downloadSVG = () => {
  if (!qrSvg.value) return
  const blob = new Blob([qrSvg.value], { type: 'image/svg+xml' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'qrcode.svg'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
  toast.success('Downloaded', 'QR Code saved as SVG')
}

watch([text, fgColor, bgColor, errorCorrectionLevel], () => {
  generateQR()
})

onMounted(() => {
  generateQR()
})
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
        <span class="text-[var(--text-primary)]">QR Code Studio</span>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            QR Code Studio
          </h1>
          <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Generate customized vector QR codes with custom colors and export as high-resolution PNG or SVG.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <Badge variant="secondary">
            SVG & PNG Export
          </Badge>
          <Badge variant="badge">
            100% Client Privacy
          </Badge>
        </div>
      </div>
    </div>

    <!-- Main Workspace Grid -->
    <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
      <!-- Left Config Controls -->
      <div class="md:col-span-7 space-y-5">
        <Card :hoverable="false" class="p-5 sm:p-6 space-y-4">
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] mb-1.5">
              Content / URL
            </label>
            <textarea
              v-model="text"
              rows="3"
              placeholder="Enter URL or plain text to encode..."
              class="w-full p-3 bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-lg text-sm transition-all focus:outline-none focus:border-white focus:ring-2 focus:ring-white/10 font-mono"
            />
          </div>

          <!-- Color Customizer -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] mb-1.5">
                Foreground Color
              </label>
              <div class="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg p-2">
                <input
                  v-model="fgColor"
                  type="color"
                  class="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                />
                <input
                  v-model="fgColor"
                  type="text"
                  class="w-full text-xs font-mono text-[var(--text-primary)] uppercase bg-transparent focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] mb-1.5">
                Background Color
              </label>
              <div class="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg p-2">
                <input
                  v-model="bgColor"
                  type="color"
                  class="w-7 h-7 rounded border-0 cursor-pointer bg-transparent"
                />
                <input
                  v-model="bgColor"
                  type="text"
                  class="w-full text-xs font-mono text-[var(--text-primary)] uppercase bg-transparent focus:outline-none"
                />
              </div>
            </div>
          </div>

          <!-- Error Correction Level -->
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] mb-1.5">
              Error Correction Level
            </label>
            <div class="grid grid-cols-4 gap-2">
              <button
                v-for="lvl in ['L', 'M', 'Q', 'H'] as const"
                :key="lvl"
                type="button"
                class="py-2 text-xs font-mono font-medium rounded-lg border transition-all cursor-pointer"
                :class="
                  errorCorrectionLevel === lvl
                    ? 'bg-white text-black border-white font-bold shadow-xs'
                    : 'bg-[var(--bg-input)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-white hover:border-[var(--border-card-hover)]'
                "
                @click="errorCorrectionLevel = lvl"
              >
                {{ lvl }}
              </button>
            </div>
            <p class="text-[11px] text-[var(--text-tertiary)] mt-1.5 font-mono">
              L: 7% recovery • M: 15% recovery • Q: 25% recovery • H: 30% recovery
            </p>
          </div>
        </Card>
      </div>

      <!-- Right Preview Box -->
      <div class="md:col-span-5 space-y-4">
        <Card :hoverable="false" class="p-6 text-center flex flex-col items-center justify-center space-y-5">
          <!-- Canvas Display -->
          <div
            class="p-4 rounded-xl border border-[var(--border-subtle)] shadow-inner transition-colors flex items-center justify-center min-h-[220px] w-full max-w-[240px]"
            :style="{ backgroundColor: bgColor }"
          >
            <img
              v-if="qrDataUrl"
              :src="qrDataUrl"
              alt="Generated QR Code"
              class="w-full h-auto object-contain rounded select-none"
            />
            <span v-else class="text-xs text-[var(--text-tertiary)] font-mono">
              Enter content to generate
            </span>
          </div>

          <!-- Action Buttons -->
          <div class="w-full space-y-2">
            <Button
              variant="primary"
              class="w-full font-semibold"
              :disabled="!qrDataUrl"
              @click="downloadPNG"
            >
              <Download class="w-3.5 h-3.5 mr-1.5" />
              Download PNG
            </Button>

            <Button
              variant="secondary"
              class="w-full"
              :disabled="!qrSvg"
              @click="downloadSVG"
            >
              <Download class="w-3.5 h-3.5 mr-1.5" />
              Download SVG (Vector)
            </Button>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
