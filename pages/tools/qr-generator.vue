<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import {
  Download,
  Copy,
  Upload,
  Sparkles,
  Link,
  Mail,
  Phone,
  MessageSquare,
  Trash2,
  Check,
  Eye,
  Sliders,
  Palette,
  Image as ImageIcon,
  ChevronDown,
  RefreshCw,
  Zap
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import { useClipboard } from '~/composables/useClipboard'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

// Dynamic import of QRCodeStyling for SSR safety
let QRCodeStyling: any = null

const qrContainerRef = ref<HTMLElement | null>(null)
let qrCodeInstance: any = null

const toast = useToast()
const { copy } = useClipboard()

// Active Type Tab
const activeType = ref<'url' | 'email' | 'phone' | 'sms'>('url')

// Form inputs based on type (empty by default with placeholders)
const urlText = ref('')
const emailTo = ref('')
const emailSubject = ref('')
const emailBody = ref('')
const phoneNumber = ref('')
const smsNumber = ref('')
const smsMessage = ref('')

// Computed final QR content payload
const qrPayload = computed(() => {
  switch (activeType.value) {
    case 'url':
      return urlText.value || 'https://github.com/BranProHengker/avttr-studio'
    case 'email':
      if (!emailTo.value) return 'mailto:hello@example.com'
      return `mailto:${emailTo.value}?subject=${encodeURIComponent(emailSubject.value)}&body=${encodeURIComponent(emailBody.value)}`
    case 'phone':
      return phoneNumber.value ? `tel:${phoneNumber.value}` : 'tel:+6281234567890'
    case 'sms':
      return smsNumber.value ? `sms:${smsNumber.value}?body=${encodeURIComponent(smsMessage.value)}` : 'sms:+6281234567890'
    default:
      return urlText.value || 'https://github.com/BranProHengker/avttr-studio'
  }
})

// Customization Options State
const size = ref(300)
const margin = ref(10)
const errorCorrection = ref<'L' | 'M' | 'Q' | 'H'>('M')

// Colors
const fgColor = ref('#000000')
const bgColor = ref('#ffffff')
const isTransparentBg = ref(false)
const useGradient = ref(false)
const gradientColor2 = ref('#1447E6')
const gradientType = ref<'linear' | 'radial'>('linear')

// Shapes
const dotStyle = ref<'square' | 'dots' | 'rounded' | 'classy' | 'extra-rounded'>('square')
const cornerSquareStyle = ref<'square' | 'dot' | 'extra-rounded'>('square')
const cornerDotStyle = ref<'square' | 'dot'>('square')

// Logo / Image State
const logoDataUrl = ref<string | null>(null)
const logoSize = ref(0.35)
const logoMargin = ref(4)

// File Input Ref for manual trigger
const fileInputRef = ref<HTMLInputElement | null>(null)

// Accordion sections
const openSections = ref<Record<string, boolean>>({
  shapes: true,
  colours: true,
  logo: true,
  basics: false,
})

const toggleSection = (key: string) => {
  openSections.value[key] = !openSections.value[key]
}

// Preset Quick Styles
interface QuickStyle {
  name: string
  fg: string
  bg: string
  dot: 'square' | 'dots' | 'rounded' | 'classy' | 'extra-rounded'
  cornerSquare: 'square' | 'dot' | 'extra-rounded'
  cornerDot: 'square' | 'dot'
  gradient?: boolean
  grad2?: string
}

const quickStyles: QuickStyle[] = [
  { name: 'Classic', fg: '#000000', bg: '#ffffff', dot: 'square', cornerSquare: 'square', cornerDot: 'square' },
  { name: 'Rounded', fg: '#171717', bg: '#ffffff', dot: 'rounded', cornerSquare: 'extra-rounded', cornerDot: 'dot' },
  { name: 'Dots', fg: '#0A0A0A', bg: '#ffffff', dot: 'dots', cornerSquare: 'extra-rounded', cornerDot: 'dot' },
  { name: 'Classy', fg: '#1E293B', bg: '#ffffff', dot: 'classy', cornerSquare: 'extra-rounded', cornerDot: 'square' },
  { name: 'Indigo', fg: '#4F46E5', bg: '#ffffff', dot: 'rounded', cornerSquare: 'extra-rounded', cornerDot: 'dot' },
  { name: 'Rose', fg: '#E11D48', bg: '#ffffff', dot: 'dots', cornerSquare: 'extra-rounded', cornerDot: 'dot' },
  { name: 'Teal', fg: '#0D9488', bg: '#ffffff', dot: 'classy', cornerSquare: 'square', cornerDot: 'dot' },
  { name: 'Amber', fg: '#D97706', bg: '#ffffff', dot: 'extra-rounded', cornerSquare: 'extra-rounded', cornerDot: 'dot' },
  { name: 'Violet', fg: '#7C3AED', bg: '#ffffff', dot: 'classy', cornerSquare: 'extra-rounded', cornerDot: 'dot' },
]

const applyQuickStyle = (s: QuickStyle) => {
  fgColor.value = s.fg
  bgColor.value = s.bg
  dotStyle.value = s.dot
  cornerSquareStyle.value = s.cornerSquare
  cornerDotStyle.value = s.cornerDot
  useGradient.value = !!s.gradient
  if (s.grad2) gradientColor2.value = s.grad2
  toast.success('Style Applied', `Applied ${s.name} preset`)
}

// Preset Quick Logos
const presetLogos = [
  { name: 'Mio Logo', url: '/mio.png' },
  { name: 'GitHub', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>' },
  { name: 'Instagram', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#E1306C"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>' },
  { name: 'TikTok', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.88 2.89 2.89 0 0 1-2.89-2.88 2.89 2.89 0 0 1 2.89-2.89c.3 0 .59.04.86.12V9.37a6.34 6.34 0 0 0-.86-.06A6.34 6.34 0 0 0 3 15.65a6.34 6.34 0 0 0 6.34 6.35 6.34 6.34 0 0 0 6.34-6.35V8.71a8.18 8.18 0 0 0 4.91 1.63v-3.44a4.85 4.85 0 0 1-1-.21z"/></svg>' },
  { name: 'Twitter / X', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' },
]

const applyPresetLogo = (preset: { name: string; url?: string; svg?: string }) => {
  if (preset.url) {
    logoDataUrl.value = preset.url
  } else if (preset.svg) {
    logoDataUrl.value = `data:image/svg+xml;utf8,${encodeURIComponent(preset.svg)}`
  }
  errorCorrection.value = 'H'
  toast.success('Logo Selected', `${preset.name} applied to center`)
}

// Logo upload handler
const handleLogoUpload = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    toast.error('Invalid File', 'Please select an image file')
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    logoDataUrl.value = reader.result as string
    errorCorrection.value = 'H'
    toast.success('Logo Attached', 'Center logo updated with High error redundancy')
  }
  reader.readAsDataURL(file)
}

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const removeLogo = () => {
  logoDataUrl.value = null
  if (fileInputRef.value) fileInputRef.value.value = ''
  toast.info('Logo Removed', 'Center logo has been removed')
}

// Generate & Update QR Code Canvas
const updateQRCode = async () => {
  if (!qrContainerRef.value || typeof window === 'undefined') return

  if (!QRCodeStyling) {
    const mod = await import('qr-code-styling')
    QRCodeStyling = mod.default || mod
  }

  const effectiveBg = isTransparentBg.value ? 'transparent' : bgColor.value

  const options: any = {
    width: size.value,
    height: size.value,
    type: 'svg',
    data: qrPayload.value,
    margin: margin.value,
    qrOptions: {
      typeNumber: 0,
      mode: 'Byte',
      errorCorrectionLevel: errorCorrection.value,
    },
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: logoSize.value,
      margin: logoMargin.value,
      crossOrigin: 'anonymous',
    },
    dotsOptions: {
      type: dotStyle.value,
      color: fgColor.value,
      gradient: useGradient.value
        ? {
            type: gradientType.value,
            rotation: 45,
            colorStops: [
              { offset: 0, color: fgColor.value },
              { offset: 1, color: gradientColor2.value },
            ],
          }
        : undefined,
    },
    backgroundOptions: {
      color: effectiveBg,
    },
    cornersSquareOptions: {
      type: cornerSquareStyle.value,
      color: fgColor.value,
    },
    cornersDotOptions: {
      type: cornerDotStyle.value,
      color: fgColor.value,
    },
  }

  if (logoDataUrl.value) {
    options.image = logoDataUrl.value
  } else {
    options.image = ''
  }

  if (!qrCodeInstance) {
    qrCodeInstance = new QRCodeStyling(options)
    qrContainerRef.value.innerHTML = ''
    qrCodeInstance.append(qrContainerRef.value)
  } else {
    qrCodeInstance.update(options)
  }
}

// Export Download Actions
const downloadPNG = async () => {
  if (!qrCodeInstance) return
  await qrCodeInstance.download({
    name: 'custom-qrcode',
    extension: 'png',
  })
  toast.success('Downloaded', 'High-res QR Code saved as PNG')
}

const downloadSVG = async () => {
  if (!qrCodeInstance) return
  await qrCodeInstance.download({
    name: 'custom-qrcode',
    extension: 'svg',
  })
  toast.success('Downloaded', 'Scalable Vector QR Code saved as SVG')
}

const copyQRCodeImage = async () => {
  try {
    if (!qrCodeInstance) return
    const rawBlob = await qrCodeInstance.getRawData('png')
    if (rawBlob) {
      const item = new ClipboardItem({ 'image/png': rawBlob })
      await navigator.clipboard.write([item])
      toast.success('Copied to Clipboard', 'QR Image is ready to paste anywhere')
    }
  } catch (err: any) {
    toast.error('Copy Failed', 'Browser does not permit direct image copying')
  }
}

// Watchers
watch(
  [
    qrPayload,
    size,
    margin,
    errorCorrection,
    fgColor,
    bgColor,
    isTransparentBg,
    useGradient,
    gradientColor2,
    gradientType,
    dotStyle,
    cornerSquareStyle,
    cornerDotStyle,
    logoDataUrl,
    logoSize,
    logoMargin,
  ],
  () => {
    updateQRCode()
  }
)

onMounted(async () => {
  await nextTick()
  updateQRCode()
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
        <span class="text-[var(--text-primary)]">QR Code Generator</span>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            QR Code Generator
          </h1>
          <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Create customized vector QR codes with custom bit shapes, corner eyes, colors, and embedded logos.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <Badge variant="secondary">
            PNG & SVG Export
          </Badge>
        </div>
      </div>
    </div>

    <!-- Type Selection Tabs (URL, Email, Phone, SMS) -->
    <div class="flex items-center bg-[#171717] border border-[var(--border-subtle)] rounded-full p-1 w-fit text-xs">
      <button
        type="button"
        class="flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-all cursor-pointer font-medium"
        :class="activeType === 'url' ? 'bg-[#2E2E2E] text-white shadow-xs font-semibold' : 'text-[var(--text-secondary)] hover:text-white'"
        @click="activeType = 'url'"
      >
        <Link class="w-3.5 h-3.5" />
        <span>URL / Link</span>
      </button>

      <button
        type="button"
        class="flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-all cursor-pointer font-medium"
        :class="activeType === 'email' ? 'bg-[#2E2E2E] text-white shadow-xs font-semibold' : 'text-[var(--text-secondary)] hover:text-white'"
        @click="activeType = 'email'"
      >
        <Mail class="w-3.5 h-3.5" />
        <span>Email</span>
      </button>

      <button
        type="button"
        class="flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-all cursor-pointer font-medium"
        :class="activeType === 'phone' ? 'bg-[#2E2E2E] text-white shadow-xs font-semibold' : 'text-[var(--text-secondary)] hover:text-white'"
        @click="activeType = 'phone'"
      >
        <Phone class="w-3.5 h-3.5" />
        <span>Phone</span>
      </button>

      <button
        type="button"
        class="flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-all cursor-pointer font-medium"
        :class="activeType === 'sms' ? 'bg-[#2E2E2E] text-white shadow-xs font-semibold' : 'text-[var(--text-secondary)] hover:text-white'"
        @click="activeType = 'sms'"
      >
        <MessageSquare class="w-3.5 h-3.5" />
        <span>SMS</span>
      </button>
    </div>

    <!-- Main Bento Grid Workspace -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left Column: Sticky Live Preview & Quick Styles -->
      <div class="lg:col-span-5 space-y-5 lg:sticky lg:top-20">
        <!-- Preview Display Card -->
        <Card :hoverable="false" class="p-6 flex flex-col items-center justify-center space-y-6">
          <div class="w-full flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
              Preview
            </span>
            <Badge variant="badge" size="sm">Live Vector</Badge>
          </div>

          <!-- QR Canvas Viewport -->
          <div
            class="p-4 rounded-2xl border border-[var(--border-subtle)] flex items-center justify-center min-h-[290px] w-full max-w-[300px] shadow-sm relative overflow-hidden transition-all"
            :class="isTransparentBg ? 'bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:16px_16px] bg-[#1a1a1a]' : ''"
            :style="!isTransparentBg ? { backgroundColor: bgColor } : {}"
          >
            <div ref="qrContainerRef" class="flex items-center justify-center select-none" />
          </div>

          <!-- Export Action Buttons -->
          <div class="w-full grid grid-cols-3 gap-2 pt-1">
            <Button
              variant="primary"
              class="font-semibold text-xs"
              @click="downloadPNG"
            >
              <Download class="w-3.5 h-3.5 mr-1" />
              PNG
            </Button>

            <Button
              variant="secondary"
              class="text-xs"
              @click="downloadSVG"
            >
              <Download class="w-3.5 h-3.5 mr-1" />
              SVG
            </Button>

            <Button
              variant="secondary"
              class="text-xs"
              @click="copyQRCodeImage"
            >
              <Copy class="w-3.5 h-3.5 mr-1" />
              Copy
            </Button>
          </div>
        </Card>

        <!-- Quick Styles Palette -->
        <Card :hoverable="false" class="p-5 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
              <Sparkles class="w-3.5 h-3.5 text-white" />
              Quick Styles
            </span>
          </div>

          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="s in quickStyles"
              :key="s.name"
              type="button"
              class="p-2.5 rounded-lg text-xs font-medium border border-[var(--border-subtle)] bg-[var(--bg-input)] hover:border-white hover:text-white transition-all cursor-pointer text-center"
              @click="applyQuickStyle(s)"
            >
              <span class="block truncate">{{ s.name }}</span>
            </button>
          </div>
        </Card>
      </div>

      <!-- Right Column: Structured Options Bento Cards -->
      <div class="lg:col-span-7 space-y-4">
        <!-- 1. Content Payload Input -->
        <Card :hoverable="false" class="p-5 space-y-3">
          <label class="block text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
            {{ activeType === 'url' ? 'Destination URL' : activeType === 'email' ? 'Email Details' : activeType === 'phone' ? 'Phone Number' : 'SMS Message' }}
          </label>

          <!-- URL Input -->
          <div v-if="activeType === 'url'">
            <input
              v-model="urlText"
              type="url"
              placeholder="https://example.com"
              class="w-full p-3 bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-primary)] rounded-lg text-sm transition-all focus:outline-none focus:border-white focus:ring-2 focus:ring-white/10 font-mono"
            />
          </div>

          <!-- Email Input -->
          <div v-else-if="activeType === 'email'" class="space-y-2.5">
            <input
              v-model="emailTo"
              type="email"
              placeholder="recipient@example.com"
              class="w-full p-2.5 bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:border-white focus:ring-2 focus:ring-white/10 font-mono"
            />
            <input
              v-model="emailSubject"
              type="text"
              placeholder="Subject line"
              class="w-full p-2.5 bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:border-white focus:ring-2 focus:ring-white/10"
            />
            <textarea
              v-model="emailBody"
              rows="2"
              placeholder="Message body..."
              class="w-full p-2.5 bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:border-white focus:ring-2 focus:ring-white/10"
            />
          </div>

          <!-- Phone Input -->
          <div v-else-if="activeType === 'phone'">
            <input
              v-model="phoneNumber"
              type="tel"
              placeholder="+62 812 3456 7890"
              class="w-full p-3 bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:border-white focus:ring-2 focus:ring-white/10 font-mono"
            />
          </div>

          <!-- SMS Input -->
          <div v-else-if="activeType === 'sms'" class="space-y-2.5">
            <input
              v-model="smsNumber"
              type="tel"
              placeholder="+62 812 3456 7890"
              class="w-full p-2.5 bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:border-white focus:ring-2 focus:ring-white/10 font-mono"
            />
            <textarea
              v-model="smsMessage"
              rows="2"
              placeholder="SMS text message..."
              class="w-full p-2.5 bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:border-white focus:ring-2 focus:ring-white/10"
            />
          </div>
        </Card>

        <!-- 2. Accordion: Shapes & Geometry -->
        <Card :hoverable="false" class="p-5 space-y-4">
          <div class="flex items-center justify-between cursor-pointer group" @click="toggleSection('shapes')">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
              <Eye class="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-white transition-colors" />
              Shapes & Geometry
            </h3>
            <ChevronDown
              class="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-white transition-transform duration-200"
              :class="openSections.shapes ? 'rotate-180' : ''"
            />
          </div>

          <div v-show="openSections.shapes" class="space-y-4 pt-2 border-t border-[var(--border-subtle)]">
            <!-- Bit / Body Style -->
            <div class="space-y-1.5">
              <label class="block text-xs text-[var(--text-secondary)]">
                Bit Style (Pattern Dots)
              </label>
              <div class="grid grid-cols-3 sm:grid-cols-5 gap-2">
                <button
                  v-for="item in [
                    { id: 'square', label: 'Boxy' },
                    { id: 'rounded', label: 'Bouba' },
                    { id: 'dots', label: 'Braille' },
                    { id: 'classy', label: 'Calligraph' },
                    { id: 'extra-rounded', label: 'Blobby' },
                  ] as const"
                  :key="item.id"
                  type="button"
                  class="py-2 text-xs font-medium rounded-lg border transition-all cursor-pointer"
                  :class="
                    dotStyle === item.id
                      ? 'bg-white text-black border-white font-bold shadow-xs'
                      : 'bg-[var(--bg-input)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-white'
                  "
                  @click="dotStyle = item.id"
                >
                  {{ item.label }}
                </button>
              </div>
            </div>

            <!-- Corner Square (Outer Eye) -->
            <div class="space-y-1.5">
              <label class="block text-xs text-[var(--text-secondary)]">
                Corner Eyes (Outer Marker)
              </label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="item in [
                    { id: 'square', label: 'Boxy' },
                    { id: 'extra-rounded', label: 'Circular' },
                    { id: 'dot', label: 'Rounded' },
                  ] as const"
                  :key="item.id"
                  type="button"
                  class="py-2 text-xs font-medium rounded-lg border transition-all cursor-pointer"
                  :class="
                    cornerSquareStyle === item.id
                      ? 'bg-white text-black border-white font-bold shadow-xs'
                      : 'bg-[var(--bg-input)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-white'
                  "
                  @click="cornerSquareStyle = item.id"
                >
                  {{ item.label }}
                </button>
              </div>
            </div>

            <!-- Corner Dot (Inner Pupil) -->
            <div class="space-y-1.5">
              <label class="block text-xs text-[var(--text-secondary)]">
                Corner Pupils (Inner Marker)
              </label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="item in [
                    { id: 'square', label: 'Square' },
                    { id: 'dot', label: 'Circle' },
                  ] as const"
                  :key="item.id"
                  type="button"
                  class="py-2 text-xs font-medium rounded-lg border transition-all cursor-pointer"
                  :class="
                    cornerDotStyle === item.id
                      ? 'bg-white text-black border-white font-bold shadow-xs'
                      : 'bg-[var(--bg-input)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-white'
                  "
                  @click="cornerDotStyle = item.id"
                >
                  {{ item.label }}
                </button>
              </div>
            </div>
          </div>
        </Card>

        <!-- 3. Accordion: Colours & Gradients -->
        <Card :hoverable="false" class="p-5 space-y-4">
          <div class="flex items-center justify-between cursor-pointer group" @click="toggleSection('colours')">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
              <Palette class="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-white transition-colors" />
              Colours & Gradients
            </h3>
            <ChevronDown
              class="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-white transition-transform duration-200"
              :class="openSections.colours ? 'rotate-180' : ''"
            />
          </div>

          <div v-show="openSections.colours" class="space-y-4 pt-2 border-t border-[var(--border-subtle)]">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Foreground -->
              <div>
                <label class="block text-xs text-[var(--text-secondary)] mb-1.5">
                  Pattern / Foreground Color
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

              <!-- Background -->
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label class="text-xs text-[var(--text-secondary)]">Background Color</label>
                  <label class="text-[11px] text-[var(--text-tertiary)] cursor-pointer flex items-center gap-1">
                    <input type="checkbox" v-model="isTransparentBg" class="rounded accent-white cursor-pointer" />
                    <span>Transparent</span>
                  </label>
                </div>
                <div
                  class="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg p-2"
                  :class="isTransparentBg ? 'opacity-40 pointer-events-none' : ''"
                >
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

            <!-- Gradient Option -->
            <div class="pt-2 border-t border-[var(--border-subtle)]/50 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs text-[var(--text-secondary)]">Enable Gradient Pattern</span>
                <input type="checkbox" v-model="useGradient" class="rounded accent-white cursor-pointer" />
              </div>

              <div v-if="useGradient" class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] text-[var(--text-tertiary)] mb-1">Gradient End Color</label>
                  <div class="flex items-center gap-2 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg p-2">
                    <input v-model="gradientColor2" type="color" class="w-6 h-6 rounded border-0 cursor-pointer bg-transparent" />
                    <input v-model="gradientColor2" type="text" class="w-full text-xs font-mono text-white uppercase bg-transparent focus:outline-none" />
                  </div>
                </div>

                <div>
                  <label class="block text-[11px] text-[var(--text-tertiary)] mb-1">Gradient Type</label>
                  <select
                    v-model="gradientType"
                    class="w-full p-2 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg text-xs text-white focus:outline-none"
                  >
                    <option value="linear">Linear (Diagonal)</option>
                    <option value="radial">Radial (Center Glow)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <!-- 4. Accordion: Logo / Image -->
        <Card :hoverable="false" class="p-5 space-y-4">
          <div class="flex items-center justify-between cursor-pointer group" @click="toggleSection('logo')">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
              <ImageIcon class="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-white transition-colors" />
              Logo / Image
            </h3>
            <ChevronDown
              class="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-white transition-transform duration-200"
              :class="openSections.logo ? 'rotate-180' : ''"
            />
          </div>

          <div v-show="openSections.logo" class="space-y-4 pt-2 border-t border-[var(--border-subtle)]">
            <!-- Hidden native file input -->
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleLogoUpload"
            />

            <!-- Empty Dropzone State -->
            <div v-if="!logoDataUrl">
              <label
                class="border-2 border-dashed border-[var(--border-card)] hover:border-white/40 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors text-center group"
                @click="triggerFileInput"
              >
                <Upload class="w-6 h-6 text-[var(--text-tertiary)] group-hover:text-white transition-colors" />
                <span class="text-xs font-medium text-[var(--text-secondary)] group-hover:text-white">
                  Drop, click, or paste logo image
                </span>
                <span class="text-[11px] text-[var(--text-tertiary)]">PNG, JPG, SVG, WebP supported</span>
              </label>
            </div>

            <!-- Active Logo Control Box (with Replace & Size control) -->
            <div v-else class="space-y-3">
              <div class="p-3.5 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-xl flex items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-white/10 p-1 border border-white/20 flex items-center justify-center overflow-hidden shrink-0">
                    <img :src="logoDataUrl" alt="Logo preview" class="w-full h-full object-contain" />
                  </div>
                  <div class="min-w-0">
                    <div class="text-xs font-semibold text-white truncate">Center Logo Attached</div>
                    <div class="text-[11px] text-[var(--text-tertiary)] truncate">Redundancy High (30%)</div>
                  </div>
                </div>

                <div class="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" variant="secondary" class="text-xs" @click="triggerFileInput">
                    <RefreshCw class="w-3 h-3 mr-1" />
                    Change
                  </Button>
                  <Button size="sm" variant="ghost" class="text-red-400 hover:text-red-300" @click="removeLogo">
                    <Trash2 class="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <!-- Logo Scale Slider -->
              <div class="space-y-1.5 px-1">
                <div class="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span>Logo Size</span>
                  <span class="font-mono text-white">{{ Math.round(logoSize * 100) }}%</span>
                </div>
                <input
                  v-model.number="logoSize"
                  type="range"
                  min="0.2"
                  max="0.45"
                  step="0.05"
                  class="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[#2E2E2E] accent-white"
                />
              </div>
            </div>

            <!-- Quick Preset Logos (Socials & Mio) -->
            <div class="space-y-2 pt-1">
              <span class="text-[11px] text-[var(--text-tertiary)] block">Or choose a quick preset icon:</span>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="p in presetLogos"
                  :key="p.name"
                  type="button"
                  class="px-2.5 py-1.5 bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] hover:border-white/40 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                  @click="applyPresetLogo(p)"
                >
                  <span>{{ p.name }}</span>
                </button>
              </div>
            </div>
          </div>
        </Card>

        <!-- 5. Accordion: Basics (Size, Padding, Error Correction) -->
        <Card :hoverable="false" class="p-5 space-y-4">
          <div class="flex items-center justify-between cursor-pointer group" @click="toggleSection('basics')">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
              <Sliders class="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-white transition-colors" />
              Basics & Settings
            </h3>
            <ChevronDown
              class="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-white transition-transform duration-200"
              :class="openSections.basics ? 'rotate-180' : ''"
            />
          </div>

          <div v-show="openSections.basics" class="space-y-4 pt-2 border-t border-[var(--border-subtle)]">
            <!-- Size Slider -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>Canvas Size</span>
                <span class="font-mono text-white">{{ size }}px</span>
              </div>
              <input
                v-model.number="size"
                type="range"
                min="180"
                max="480"
                step="20"
                class="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[#2E2E2E] accent-white"
              />
            </div>

            <!-- Padding Slider -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>Padding / Margin</span>
                <span class="font-mono text-white">{{ margin }}px</span>
              </div>
              <input
                v-model.number="margin"
                type="range"
                min="0"
                max="30"
                step="2"
                class="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[#2E2E2E] accent-white"
              />
            </div>

            <!-- Error Correction Level -->
            <div class="space-y-1.5">
              <label class="block text-xs text-[var(--text-secondary)]">
                Error Correction Redundancy
              </label>
              <div class="grid grid-cols-4 gap-2">
                <button
                  v-for="lvl in ['L', 'M', 'Q', 'H'] as const"
                  :key="lvl"
                  type="button"
                  class="py-1.5 text-xs font-mono font-medium rounded-lg border transition-all cursor-pointer"
                  :class="
                    errorCorrection === lvl
                      ? 'bg-white text-black border-white font-bold shadow-xs'
                      : 'bg-[var(--bg-input)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-white'
                  "
                  @click="errorCorrection = lvl"
                >
                  {{ lvl }}
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
