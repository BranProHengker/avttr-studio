<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
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
  { hex: '#0A0A0A', isLocked: false },
  { hex: '#1447E6', isLocked: false },
  { hex: '#3080FF', isLocked: false },
  { hex: '#10B981', isLocked: false },
  { hex: '#F59E0B', isLocked: false },
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
  <div class="space-y-8 pb-12 w-full max-w-5xl">
    <!-- Breadcrumb -->
    <div class="flex items-center gap-2">
      <NuxtLink to="/" class="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
        ← Dashboard
      </NuxtLink>
      <span class="text-xs text-[var(--text-tertiary)]">/</span>
      <span class="text-xs font-mono text-[var(--text-primary)]">Color Palette Studio</span>
    </div>

    <!-- Header & Action Controls -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Color Palette Studio
          </h1>
          <Badge variant="primary" size="sm">Spacebar to Generate</Badge>
        </div>
        <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
          Explore color harmonies, check WCAG contrast ratios, and copy CSS values in one click.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="primary" @click="generateNewPalette">
          <span>Generate Palette</span>
          <kbd class="ml-1.5 px-1.5 py-0.5 text-[10px] font-mono bg-white/20 rounded">Space</kbd>
        </Button>
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
            class="p-2 rounded-lg backdrop-blur-md bg-black/20 hover:bg-black/40 transition-colors cursor-pointer"
            :title="c.isLocked ? 'Unlock color' : 'Lock color'"
            @click="toggleLock(idx)"
          >
            <svg v-if="c.isLocked" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <svg v-else class="w-3.5 h-3.5 opacity-60 hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
          </button>
        </div>

        <!-- Bottom Color Info & Copy -->
        <div class="space-y-2">
          <button
            type="button"
            class="text-left font-mono text-sm sm:text-base font-bold tracking-wider hover:underline cursor-pointer"
            @click="copy(c.hex, 'Color HEX')"
          >
            {{ c.hex }}
          </button>
          <div class="text-[10px] font-mono opacity-80 uppercase">
            Color {{ idx + 1 }}
          </div>
        </div>
      </div>
    </div>

    <!-- Contrast & Export Card -->
    <Card :hoverable="false" class="p-6 space-y-4">
      <h3 class="text-sm font-semibold text-[var(--text-primary)]">
        Export Palette Tokens
      </h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-mono text-[var(--text-tertiary)] mb-1">CSS Custom Properties</label>
          <pre class="p-3 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg text-xs font-mono text-[var(--text-primary)] overflow-x-auto">:root {
{{ colors.map((c, i) => `  --color-${i + 1}: ${c.hex};`).join('\n') }}
}</pre>
        </div>

        <div>
          <label class="block text-xs font-mono text-[var(--text-tertiary)] mb-1">JSON Array</label>
          <pre class="p-3 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg text-xs font-mono text-[var(--text-primary)] overflow-x-auto">{{ JSON.stringify(colors.map(c => c.hex), null, 2) }}</pre>
        </div>
      </div>
    </Card>
  </div>
</template>
