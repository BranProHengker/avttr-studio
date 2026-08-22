<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import QRCode from 'qrcode'
import { useToast } from '~/composables/useToast'
import { useClipboard } from '~/composables/useClipboard'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Input from '~/components/ui/Input.vue'
import Badge from '~/components/ui/Badge.vue'

const text = ref('https://github.com')
const fgColor = ref('#000000')
const bgColor = ref('#ffffff')
const errorCorrectionLevel = ref<'L' | 'M' | 'Q' | 'H'>('M')
const qrDataUrl = ref('')
const qrSvg = ref('')

const toast = useToast()
const { copy } = useClipboard()

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
  <div class="space-y-8 pb-12 w-full max-w-5xl">
    <!-- Breadcrumb -->
    <div class="flex items-center gap-2">
      <NuxtLink to="/" class="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
        ← Dashboard
      </NuxtLink>
      <span class="text-xs text-[var(--text-tertiary)]">/</span>
      <span class="text-xs font-mono text-[var(--text-primary)]">QR Code Studio</span>
    </div>

    <!-- Header -->
    <div class="space-y-1">
      <div class="flex items-center gap-2">
        <h1 class="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          QR Code Studio
        </h1>
        <Badge variant="primary" size="sm">Client-Side</Badge>
      </div>
      <p class="text-xs sm:text-sm text-[var(--text-secondary)]">
        Generate custom styled QR codes with custom colors and export as high-resolution PNG or vector SVG.
      </p>
    </div>

    <!-- Main Workspace Grid -->
    <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
      <!-- Left Config Controls -->
      <div class="md:col-span-7 space-y-5">
        <Card :hoverable="false" class="p-5 sm:p-6 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
              Content / URL
            </label>
            <textarea
              v-model="text"
              rows="3"
              placeholder="Enter URL or plain text to encode..."
              class="w-full p-3 bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-lg text-sm transition-all focus:outline-none focus:border-[#1447E6] focus:ring-3 focus:ring-[#1447E6]/15 font-mono"
            />
          </div>

          <!-- Color Customizer -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
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
              <label class="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
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
            <label class="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
              Error Correction Level
            </label>
            <div class="grid grid-cols-4 gap-2">
              <button
                v-for="lvl in ['L', 'M', 'Q', 'H'] as const"
                :key="lvl"
                type="button"
                class="py-1.5 text-xs font-mono font-medium rounded-lg border transition-all cursor-pointer"
                :class="
                  errorCorrectionLevel === lvl
                    ? 'bg-[#1447E6] text-white border-[#1447E6]'
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-card)] hover:bg-[var(--bg-card-hover)]'
                "
                @click="errorCorrectionLevel = lvl"
              >
                {{ lvl }}
              </button>
            </div>
          </div>
        </Card>
      </div>

      <!-- Right Live Preview & Download -->
      <div class="md:col-span-5 flex flex-col gap-4">
        <Card :hoverable="false" class="p-6 flex flex-col items-center justify-center gap-5">
          <!-- QR Canvas Box -->
          <div class="p-4 bg-white rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.1)] flex items-center justify-center max-w-[260px] aspect-square">
            <img
              v-if="qrDataUrl"
              :src="qrDataUrl"
              alt="Generated QR Code"
              class="w-full h-full object-contain"
            />
            <div v-else class="text-xs text-gray-400 font-mono text-center">
              Enter content to generate
            </div>
          </div>

          <!-- Download Action Triggers -->
          <div class="w-full space-y-2">
            <Button
              variant="primary"
              class="w-full font-semibold"
              :disabled="!qrDataUrl"
              @click="downloadPNG"
            >
              Download PNG
            </Button>
            <div class="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="sm"
                :disabled="!qrSvg"
                @click="downloadSVG"
              >
                Vector SVG
              </Button>
              <Button
                variant="outline"
                size="sm"
                :disabled="!qrDataUrl"
                @click="copy(qrDataUrl, 'Base64 Data URL')"
              >
                Copy Data URL
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
