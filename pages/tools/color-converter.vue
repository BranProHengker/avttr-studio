<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Copy, Pipette, RefreshCw, Check, Sliders, Sparkles, Hash } from 'lucide-vue-next'
import { useClipboard } from '~/composables/useClipboard'
import { useToast } from '~/composables/useToast'
import { useI18n } from '~/composables/useI18n'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

const { copy } = useClipboard()
const toast = useToast()
const { t } = useI18n()

// Core HSV State
const hue = ref(44) // 0 to 360
const saturation = ref(99) // 0 to 100
const value = ref(99) // 0 to 100
const alpha = ref(100) // 0 to 100

// Local draft inputs for bi-directional live typing
const hexInput = ref('#FCBA03')
const rgbInput = ref('252, 186, 3')
const cmykInput = ref('0%, 26%, 99%, 1%')
const hsvInput = ref('44°, 99%, 99%')
const hslInput = ref('44°, 98%, 50%')

const isEyeDropperSupported = ref(false)
const svCanvasRef = ref<HTMLElement | null>(null)
const isDraggingSV = ref(false)

// Conversion Math Utilities
const hsvToRgb = (h: number, s: number, v: number): [number, number, number] => {
  const sat = s / 100
  const val = v / 100
  const c = val * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = val - c

  let r1 = 0
  let g1 = 0
  let b1 = 0

  if (h >= 0 && h < 60) {
    r1 = c; g1 = x; b1 = 0
  } else if (h >= 60 && h < 120) {
    r1 = x; g1 = c; b1 = 0
  } else if (h >= 120 && h < 180) {
    r1 = 0; g1 = c; b1 = x
  } else if (h >= 180 && h < 240) {
    r1 = 0; g1 = x; b1 = c
  } else if (h >= 240 && h < 300) {
    r1 = x; g1 = 0; b1 = c
  } else {
    r1 = c; g1 = 0; b1 = x
  }

  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ]
}

const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  const sat = s / 100
  const lum = l / 100
  const c = (1 - Math.abs(2 * lum - 1)) * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lum - c / 2

  let r1 = 0
  let g1 = 0
  let b1 = 0

  if (h >= 0 && h < 60) {
    r1 = c; g1 = x; b1 = 0
  } else if (h >= 60 && h < 120) {
    r1 = x; g1 = c; b1 = 0
  } else if (h >= 120 && h < 180) {
    r1 = 0; g1 = c; b1 = x
  } else if (h >= 180 && h < 240) {
    r1 = 0; g1 = x; b1 = c
  } else if (h >= 240 && h < 300) {
    r1 = x; g1 = 0; b1 = c
  } else {
    r1 = c; g1 = 0; b1 = x
  }

  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ]
}

const rgbToHsv = (r: number, g: number, b: number): [number, number, number] => {
  const r1 = r / 255
  const g1 = g / 255
  const b1 = b / 255

  const max = Math.max(r1, g1, b1)
  const min = Math.min(r1, g1, b1)
  const d = max - min

  let h = 0
  const s = max === 0 ? 0 : d / max
  const v = max

  if (d !== 0) {
    if (max === r1) {
      h = ((g1 - b1) / d) % 6
    } else if (max === g1) {
      h = (b1 - r1) / d + 2
    } else {
      h = (r1 - g1) / d + 4
    }
    h = Math.round(h * 60)
    if (h < 0) h += 360
  }

  return [h, Math.round(s * 100), Math.round(v * 100)]
}

const rgbToCmyk = (r: number, g: number, b: number): [number, number, number, number] => {
  const r1 = r / 255
  const g1 = g / 255
  const b1 = b / 255

  const k = 1 - Math.max(r1, g1, b1)
  if (k === 1) return [0, 0, 0, 100]

  const c = Math.round(((1 - r1 - k) / (1 - k)) * 100)
  const m = Math.round(((1 - g1 - k) / (1 - k)) * 100)
  const y = Math.round(((1 - b1 - k) / (1 - k)) * 100)

  return [c, m, y, Math.round(k * 100)]
}

const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  const r1 = r / 255
  const g1 = g / 255
  const b1 = b / 255

  const max = Math.max(r1, g1, b1)
  const min = Math.min(r1, g1, b1)
  const l = (max + min) / 2

  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r1) {
      h = ((g1 - b1) / d) % 6
    } else if (max === g1) {
      h = (b1 - r1) / d + 2
    } else {
      h = (r1 - g1) / d + 4
    }
    h = Math.round(h * 60)
    if (h < 0) h += 360
  }

  return [h, Math.round(s * 100), Math.round(l * 100)]
}

// Current RGB computed
const currentRgb = computed(() => hsvToRgb(hue.value, saturation.value, value.value))

// Synchronize all input fields when core state changes
watch([hue, saturation, value], () => {
  const [r, g, b] = currentRgb.value
  hexInput.value = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase()
  rgbInput.value = `${r}, ${g}, ${b}`
  const [c, m, y, k] = rgbToCmyk(r, g, b)
  cmykInput.value = `${c}%, ${m}%, ${y}%, ${k}%`
  hsvInput.value = `${hue.value}°, ${saturation.value}%, ${value.value}%`
  const [h, s, l] = rgbToHsl(r, g, b)
  hslInput.value = `${h}°, ${s}%, ${l}%`
}, { immediate: true })

// Bi-Directional Input Handlers
const onHexChange = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  hexInput.value = val
  const clean = val.replace(/[^0-9A-Fa-f]/g, '')
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16)
    const g = parseInt(clean.substring(2, 4), 16)
    const b = parseInt(clean.substring(4, 6), 16)
    const [h, s, v] = rgbToHsv(r, g, b)
    hue.value = h
    saturation.value = s
    value.value = v
  } else if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16)
    const g = parseInt(clean[1] + clean[1], 16)
    const b = parseInt(clean[2] + clean[2], 16)
    const [h, s, v] = rgbToHsv(r, g, b)
    hue.value = h
    saturation.value = s
    value.value = v
  }
}

const onRgbChange = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  rgbInput.value = val
  const nums = val.match(/\d+/g)
  if (nums && nums.length >= 3) {
    const r = Math.min(255, Math.max(0, parseInt(nums[0], 10)))
    const g = Math.min(255, Math.max(0, parseInt(nums[1], 10)))
    const b = Math.min(255, Math.max(0, parseInt(nums[2], 10)))
    const [h, s, v] = rgbToHsv(r, g, b)
    hue.value = h
    saturation.value = s
    value.value = v
  }
}

const onCmykChange = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  cmykInput.value = val
  const nums = val.match(/\d+/g)
  if (nums && nums.length >= 4) {
    const c = Math.min(100, Math.max(0, parseInt(nums[0], 10))) / 100
    const m = Math.min(100, Math.max(0, parseInt(nums[1], 10))) / 100
    const y = Math.min(100, Math.max(0, parseInt(nums[2], 10))) / 100
    const k = Math.min(100, Math.max(0, parseInt(nums[3], 10))) / 100
    const r = Math.round(255 * (1 - c) * (1 - k))
    const g = Math.round(255 * (1 - m) * (1 - k))
    const b = Math.round(255 * (1 - y) * (1 - k))
    const [h, s, v] = rgbToHsv(r, g, b)
    hue.value = h
    saturation.value = s
    value.value = v
  }
}

const onHsvChange = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  hsvInput.value = val
  const nums = val.match(/\d+/g)
  if (nums && nums.length >= 3) {
    const h = Math.min(360, Math.max(0, parseInt(nums[0], 10)))
    const s = Math.min(100, Math.max(0, parseInt(nums[1], 10)))
    const v = Math.min(100, Math.max(0, parseInt(nums[2], 10)))
    hue.value = h
    saturation.value = s
    value.value = v
  }
}

const onHslChange = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  hslInput.value = val
  const nums = val.match(/\d+/g)
  if (nums && nums.length >= 3) {
    const h = Math.min(360, Math.max(0, parseInt(nums[0], 10)))
    const s = Math.min(100, Math.max(0, parseInt(nums[1], 10)))
    const l = Math.min(100, Math.max(0, parseInt(nums[2], 10)))
    const [r, g, b] = hslToRgb(h, s, l)
    const [nh, ns, nv] = rgbToHsv(r, g, b)
    hue.value = nh
    saturation.value = ns
    value.value = nv
  }
}

// CSS color preview
const previewColor = computed(() => {
  const [r, g, b] = currentRgb.value
  return `rgba(${r}, ${g}, ${b}, ${alpha.value / 100})`
})

// Hue Background for SV Canvas
const hueBgColor = computed(() => {
  const [r, g, b] = hsvToRgb(hue.value, 100, 100)
  return `rgb(${r}, ${g}, ${b})`
})

// Contrast Calculations
const getLuminance = (r: number, g: number, b: number) => {
  const a = [r, g, b].map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722
}

const contrastOnWhite = computed(() => {
  const [r, g, b] = currentRgb.value
  const lum1 = getLuminance(255, 255, 255)
  const lum2 = getLuminance(r, g, b)
  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)
  return ((brightest + 0.05) / (darkest + 0.05)).toFixed(2)
})

const contrastOnBlack = computed(() => {
  const [r, g, b] = currentRgb.value
  const lum1 = getLuminance(0, 0, 0)
  const lum2 = getLuminance(r, g, b)
  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)
  return ((brightest + 0.05) / (darkest + 0.05)).toFixed(2)
})

// Tailwind Shades (50 to 950)
const colorShades = computed(() => {
  const [h, s] = [hue.value, saturation.value]
  const levels = [
    { label: '50', v: 98, sMod: 0.1 },
    { label: '100', v: 95, sMod: 0.2 },
    { label: '200', v: 90, sMod: 0.4 },
    { label: '300', v: 85, sMod: 0.6 },
    { label: '400', v: 80, sMod: 0.8 },
    { label: '500', v: value.value, sMod: 1 },
    { label: '600', v: Math.max(10, value.value * 0.85), sMod: 1 },
    { label: '700', v: Math.max(10, value.value * 0.7), sMod: 1 },
    { label: '800', v: Math.max(10, value.value * 0.5), sMod: 1 },
    { label: '900', v: Math.max(10, value.value * 0.35), sMod: 1 },
    { label: '950', v: Math.max(5, value.value * 0.2), sMod: 1 },
  ]

  return levels.map((lvl) => {
    const sat = Math.min(100, Math.round(s * lvl.sMod))
    const [r, g, b] = hsvToRgb(h, sat, Math.round(lvl.v))
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase()
    return {
      level: lvl.label,
      hex,
      textColor: lvl.v > 50 ? '#000000' : '#FFFFFF',
    }
  })
})

// SV Canvas Drag Handling
const handleSVInteraction = (e: MouseEvent | TouchEvent) => {
  if (!svCanvasRef.value) return
  const rect = svCanvasRef.value.getBoundingClientRect()
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
  const y = Math.max(0, Math.min(rect.height, clientY - rect.top))

  saturation.value = Math.round((x / rect.width) * 100)
  value.value = Math.round(100 - (y / rect.height) * 100)
}

const onSVMouseDown = (e: MouseEvent) => {
  isDraggingSV.value = true
  handleSVInteraction(e)
}

const onSVMouseMove = (e: MouseEvent) => {
  if (isDraggingSV.value) {
    handleSVInteraction(e)
  }
}

const onSVMouseUp = () => {
  isDraggingSV.value = false
}

// Native EyeDropper API
const pickColorFromScreen = async () => {
  if (typeof window !== 'undefined' && 'EyeDropper' in window) {
    try {
      const eyeDropper = new (window as any).EyeDropper()
      const res = await eyeDropper.open()
      if (res?.sRGBHex) {
        hexInput.value = res.sRGBHex
        const clean = res.sRGBHex.replace('#', '')
        const r = parseInt(clean.substring(0, 2), 16)
        const g = parseInt(clean.substring(2, 4), 16)
        const b = parseInt(clean.substring(4, 6), 16)
        const [h, s, v] = rgbToHsv(r, g, b)
        hue.value = h
        saturation.value = s
        value.value = v
        toast.success('Color Sampled', res.sRGBHex)
      }
    } catch {
      // User cancelled
    }
  } else {
    toast.info('EyeDropper Unsupported', 'Your browser does not support the native EyeDropper API')
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    isEyeDropperSupported.value = 'EyeDropper' in window
    window.addEventListener('mouseup', onSVMouseUp)
    window.addEventListener('touchend', onSVMouseUp)
  }
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
        <span class="text-[var(--text-primary)]">Color Converter & Picker</span>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Color Converter & Picker
          </h1>
          <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Visual color picker with bi-directional HEX, RGB, CMYK, HSV, and HSL live translation.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <Button
            v-if="isEyeDropperSupported"
            variant="secondary"
            size="sm"
            @click="pickColorFromScreen"
            class="h-8 px-3 text-xs"
          >
            <Pipette class="w-3.5 h-3.5 mr-1.5" />
            Pick from Screen
          </Button>
          <Badge variant="badge">
            Bi-Directional Input
          </Badge>
        </div>
      </div>
    </div>

    <!-- Main Google-Style Interactive Color Studio Card -->
    <Card :hoverable="false" class="p-5 sm:p-6 space-y-6 overflow-hidden">
      <!-- 2D Saturation / Value Gradient & Live Preview Split -->
      <div class="grid grid-cols-1 md:grid-cols-12 gap-5">
        <!-- Left: Large Live Swatch Preview -->
        <div
          class="md:col-span-4 h-48 md:h-64 rounded-xl border border-[var(--border-subtle)] shadow-inner relative flex flex-col justify-between p-4 overflow-hidden select-none"
          :style="{ backgroundColor: previewColor }"
        >
          <!-- Contrast Text Overlay -->
          <div
            class="flex items-center justify-between text-xs font-mono font-bold"
            :style="{ color: value > 50 ? '#000000' : '#FFFFFF' }"
          >
            <span>Preview</span>
            <span>{{ alpha }}% Opacity</span>
          </div>

          <div
            class="space-y-0.5"
            :style="{ color: value > 50 ? '#000000' : '#FFFFFF' }"
          >
            <div class="text-xl sm:text-2xl font-mono font-extrabold tracking-wider">
              {{ hexInput }}
            </div>
            <div class="text-xs font-mono opacity-80">
              rgb({{ rgbInput }})
            </div>
          </div>
        </div>

        <!-- Right: 2D Saturation/Brightness Gradient Canvas -->
        <div
          ref="svCanvasRef"
          class="md:col-span-8 h-48 md:h-64 rounded-xl relative cursor-crosshair select-none border border-[var(--border-subtle)] overflow-hidden shadow-inner"
          :style="{ backgroundColor: hueBgColor }"
          @mousedown="onSVMouseDown"
          @mousemove="onSVMouseMove"
          @touchstart="handleSVInteraction"
          @touchmove="handleSVInteraction"
        >
          <!-- White Gradient (Left to Right) -->
          <div class="absolute inset-0 bg-gradient-to-r from-white to-transparent pointer-events-none" />

          <!-- Black Gradient (Top to Bottom) -->
          <div class="absolute inset-0 bg-gradient-to-t from-black to-transparent pointer-events-none" />

          <!-- Draggable Circular Handle -->
          <div
            class="absolute w-5 h-5 rounded-full border-2 border-white shadow-[0_0_8px_rgba(0,0,0,0.8)] -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-transform"
            :style="{
              left: `${saturation}%`,
              top: `${100 - value}%`,
              backgroundColor: hexInput,
            }"
          />
        </div>
      </div>

      <!-- Hue & Alpha Sliders -->
      <div class="space-y-4 pt-1">
        <!-- Rainbow Hue Slider -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs font-medium text-[var(--text-secondary)]">
            <span class="font-semibold text-white">Hue</span>
            <span class="font-mono">{{ hue }}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            v-model.number="hue"
            class="w-full h-3.5 rounded-full appearance-none cursor-pointer accent-white shadow-inner"
            style="background: linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%);"
          />
        </div>

        <!-- Alpha / Opacity Slider -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs font-medium text-[var(--text-secondary)]">
            <span class="font-semibold text-white">Opacity</span>
            <span class="font-mono">{{ alpha }}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            v-model.number="alpha"
            class="w-full h-3 rounded-full appearance-none cursor-pointer accent-white shadow-inner bg-[#2E2E2E]"
          />
        </div>
      </div>

      <!-- Color Format Translations Grid (ALL 5 ARE EDITABLE INPUTS) -->
      <div class="space-y-3 pt-2">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
            Color Translations (Editable Inputs)
          </h3>
          <span class="text-[11px] text-[var(--text-tertiary)] font-mono">
            Type in any field to translate
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <!-- 1. HEX (Editable Input) -->
          <div class="p-3.5 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-xl space-y-1.5 focus-within:border-white focus-within:ring-2 focus-within:ring-white/10 transition-all group">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-mono uppercase text-[var(--text-tertiary)] font-bold">HEX</span>
              <button
                type="button"
                class="p-1 text-[var(--text-tertiary)] hover:text-white transition-colors cursor-pointer"
                @click="copy(hexInput, 'HEX Code')"
                title="Copy HEX"
              >
                <Copy class="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              :value="hexInput"
              @input="onHexChange"
              type="text"
              class="w-full bg-transparent font-mono text-sm font-bold text-white uppercase focus:outline-none"
              placeholder="#FCBA03"
            />
          </div>

          <!-- 2. RGB (Editable Input) -->
          <div class="p-3.5 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-xl space-y-1.5 focus-within:border-white focus-within:ring-2 focus-within:ring-white/10 transition-all group">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-mono uppercase text-[var(--text-tertiary)] font-bold">RGB</span>
              <button
                type="button"
                class="p-1 text-[var(--text-tertiary)] hover:text-white transition-colors cursor-pointer"
                @click="copy(`rgb(${rgbInput})`, 'RGB Code')"
                title="Copy RGB"
              >
                <Copy class="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              :value="rgbInput"
              @input="onRgbChange"
              type="text"
              class="w-full bg-transparent font-mono text-sm font-bold text-white focus:outline-none"
              placeholder="252, 186, 3"
            />
          </div>

          <!-- 3. CMYK (Editable Input) -->
          <div class="p-3.5 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-xl space-y-1.5 focus-within:border-white focus-within:ring-2 focus-within:ring-white/10 transition-all group">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-mono uppercase text-[var(--text-tertiary)] font-bold">CMYK</span>
              <button
                type="button"
                class="p-1 text-[var(--text-tertiary)] hover:text-white transition-colors cursor-pointer"
                @click="copy(`cmyk(${cmykInput})`, 'CMYK Code')"
                title="Copy CMYK"
              >
                <Copy class="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              :value="cmykInput"
              @input="onCmykChange"
              type="text"
              class="w-full bg-transparent font-mono text-sm font-bold text-white focus:outline-none"
              placeholder="0%, 26%, 99%, 1%"
            />
          </div>

          <!-- 4. HSV (Editable Input) -->
          <div class="p-3.5 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-xl space-y-1.5 focus-within:border-white focus-within:ring-2 focus-within:ring-white/10 transition-all group">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-mono uppercase text-[var(--text-tertiary)] font-bold">HSV</span>
              <button
                type="button"
                class="p-1 text-[var(--text-tertiary)] hover:text-white transition-colors cursor-pointer"
                @click="copy(`hsv(${hsvInput})`, 'HSV Code')"
                title="Copy HSV"
              >
                <Copy class="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              :value="hsvInput"
              @input="onHsvChange"
              type="text"
              class="w-full bg-transparent font-mono text-sm font-bold text-white focus:outline-none"
              placeholder="44°, 99%, 99%"
            />
          </div>

          <!-- 5. HSL (Editable Input) -->
          <div class="p-3.5 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-xl space-y-1.5 focus-within:border-white focus-within:ring-2 focus-within:ring-white/10 transition-all group">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-mono uppercase text-[var(--text-tertiary)] font-bold">HSL</span>
              <button
                type="button"
                class="p-1 text-[var(--text-tertiary)] hover:text-white transition-colors cursor-pointer"
                @click="copy(`hsl(${hslInput})`, 'HSL Code')"
                title="Copy HSL"
              >
                <Copy class="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              :value="hslInput"
              @input="onHslChange"
              type="text"
              class="w-full bg-transparent font-mono text-sm font-bold text-white focus:outline-none"
              placeholder="44°, 98%, 50%"
            />
          </div>
        </div>
      </div>
    </Card>

    <!-- Tailwind Shades & Accessibility Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Tailwind Color Shades (50-950) -->
      <Card :hoverable="false" class="lg:col-span-8 p-5 space-y-3">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
          Tailwind Shades & Tints (50 - 950)
        </h3>

        <div class="grid grid-cols-2 sm:grid-cols-11 gap-1.5 rounded-xl overflow-hidden p-1 bg-[#171717] border border-[var(--border-subtle)]">
          <button
            v-for="shade in colorShades"
            :key="shade.level"
            type="button"
            class="h-16 rounded-lg flex flex-col justify-between p-1.5 text-left transition-transform hover:scale-105 cursor-pointer shadow-xs"
            :style="{ backgroundColor: shade.hex, color: shade.textColor }"
            @click="copy(shade.hex, `Shade ${shade.level}`)"
            :title="`Click to copy ${shade.hex}`"
          >
            <span class="text-[10px] font-mono font-bold">{{ shade.level }}</span>
            <span class="text-[9px] font-mono font-semibold uppercase truncate">{{ shade.hex }}</span>
          </button>
        </div>
      </Card>

      <!-- WCAG Contrast Verification -->
      <Card :hoverable="false" class="lg:col-span-4 p-5 space-y-3.5">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
          WCAG Contrast Score
        </h3>

        <div class="space-y-2.5">
          <!-- On White -->
          <div class="flex items-center justify-between p-3 rounded-lg bg-white text-black font-semibold text-xs border border-neutral-300">
            <span>Text on White</span>
            <div class="flex items-center gap-2">
              <span class="font-mono">{{ contrastOnWhite }}:1</span>
              <Badge :variant="parseFloat(contrastOnWhite) >= 4.5 ? 'secondary' : 'badge'" size="sm">
                {{ parseFloat(contrastOnWhite) >= 4.5 ? 'Pass (AA)' : 'Fail' }}
              </Badge>
            </div>
          </div>

          <!-- On Black -->
          <div class="flex items-center justify-between p-3 rounded-lg bg-black text-white font-semibold text-xs border border-[#2E2E2E]">
            <span>Text on Black</span>
            <div class="flex items-center gap-2">
              <span class="font-mono">{{ contrastOnBlack }}:1</span>
              <Badge :variant="parseFloat(contrastOnBlack) >= 4.5 ? 'primary' : 'badge'" size="sm">
                {{ parseFloat(contrastOnBlack) >= 4.5 ? 'Pass (AA)' : 'Fail' }}
              </Badge>
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>
