<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Copy, Lock, Unlock, RefreshCw, Check } from 'lucide-vue-next'
import { useClipboard } from '~/composables/useClipboard'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

interface ColorItem {
  hex: string
  name?: string
  isLocked: boolean
}

const colors = ref<ColorItem[]>([
  { hex: '#171717', isLocked: false },
  { hex: '#212121', isLocked: false },
  { hex: '#2E2E2E', isLocked: false },
  { hex: '#737373', isLocked: false },
  { hex: '#FAFAFA', isLocked: false },
])

const { copy } = useClipboard()

const randomHex = () => {
  const letters = '0123456789ABCDEF'
  let color = '#'
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)]
  }
  return color
}

const generateNewPalette = () => {
  colors.value = colors.value.map((c) => ({
    ...c,
    hex: c.isLocked ? c.hex : randomHex(),
  }))
}

const toggleLock = (index: number) => {
  colors.value[index].isLocked = !colors.value[index].isLocked
}

const getContrastRatio = (hexColor: string) => {
  const r = parseInt(hexColor.slice(1, 3), 16) || 0
  const g = parseInt(hexColor.slice(3, 5), 16) || 0
  const b = parseInt(hexColor.slice(5, 7), 16) || 0
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 128 ? '#000000' : '#ffffff'
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.code === 'Space' && e.target === document.body) {
    e.preventDefault()
    generateNewPalette()
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeydown)
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
        <span class="text-[var(--text-primary)]">Color Palette Studio</span>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Color Palette Studio
          </h1>
          <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Explore color harmonies, check WCAG contrast ratios, and copy CSS tokens in one click.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <Button variant="primary" @click="generateNewPalette">
            Generate Palette
          </Button>
          <kbd class="px-2 py-1 text-xs font-mono bg-[#2E2E2E] text-[var(--text-secondary)] border border-[var(--border-subtle)] rounded-lg shadow-xs">
            Space
          </kbd>
        </div>
      </div>
    </div>

    <!-- Palette Bar View -->
    <div class="grid grid-cols-1 sm:grid-cols-5 h-[340px] rounded-[14px] overflow-hidden border border-[var(--border-card)] shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
      <div
        v-for="(c, idx) in colors"
        :key="idx"
        class="relative flex flex-col justify-between p-5 transition-colors group"
        :style="{ backgroundColor: c.hex, color: getContrastRatio(c.hex) }"
      >
        <!-- Top Lock Toggle -->
        <div class="flex justify-end">
          <button
            type="button"
            class="p-2 rounded-lg backdrop-blur-md bg-black/25 hover:bg-black/50 transition-colors cursor-pointer"
            :title="c.isLocked ? 'Unlock color' : 'Lock color'"
            @click="toggleLock(idx)"
          >
            <Lock v-if="c.isLocked" class="w-3.5 h-3.5" />
            <Unlock v-else class="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
          </button>
        </div>

        <!-- Bottom Color Info & Copy -->
        <div class="space-y-1">
          <button
            type="button"
            class="text-left font-mono text-sm sm:text-base font-bold tracking-wider hover:underline cursor-pointer flex items-center gap-1.5"
            @click="copy(c.hex, 'Color HEX')"
            title="Click to copy HEX"
          >
            <span>{{ c.hex }}</span>
            <Copy class="w-3 h-3 opacity-60" />
          </button>
          <div class="text-[10px] font-mono opacity-75 uppercase tracking-wider">
            Color {{ idx + 1 }}
          </div>
        </div>
      </div>
    </div>

    <!-- Contrast & Export Card -->
    <Card :hoverable="false" class="p-5 sm:p-6 space-y-4">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
        Export Palette Tokens
      </h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-xs font-mono text-[var(--text-secondary)]">CSS Custom Properties</label>
            <Button size="sm" variant="ghost" @click="copy(`:root {\n${colors.map((c, i) => `  --color-${i + 1}: ${c.hex};`).join('\n')}\n}`, 'CSS Variables')">
              <Copy class="w-3.5 h-3.5 mr-1" />
              Copy
            </Button>
          </div>
          <pre class="p-3 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg text-xs font-mono text-[var(--text-primary)] overflow-x-auto select-all">:root {
{{ colors.map((c, i) => `  --color-${i + 1}: ${c.hex};`).join('\n') }}
}</pre>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-xs font-mono text-[var(--text-secondary)]">JSON Array</label>
            <Button size="sm" variant="ghost" @click="copy(JSON.stringify(colors.map(c => c.hex), null, 2), 'JSON Array')">
              <Copy class="w-3.5 h-3.5 mr-1" />
              Copy
            </Button>
          </div>
          <pre class="p-3 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg text-xs font-mono text-[var(--text-primary)] overflow-x-auto select-all">{{ JSON.stringify(colors.map(c => c.hex), null, 2) }}</pre>
        </div>
      </div>
    </Card>
  </div>
</template>
