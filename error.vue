<script setup lang="ts">
import { ref, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import type { NuxtError } from '#app'
import { ArrowLeft } from 'lucide-vue-next'

const LazyCommandPalette = defineAsyncComponent(() => import('~/components/layout/CommandPalette.vue'))

interface Props {
  error?: NuxtError
}

const props = defineProps<Props>()

useHead({
  title: '404 — Seems Like You Are Lost | Avttr Studio',
  meta: [
    { name: 'description', content: 'Halaman yang Anda cari tidak dapat ditemukan di Avttr Studio.' },
  ],
})

const countdown = ref(10)
const isPaletteOpen = ref(false)
let countdownTimer: ReturnType<typeof setInterval> | null = null

const handleGoHome = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  clearError({ redirect: '/' })
}

const handleSearch = () => {
  isPaletteOpen.value = true
}

const handleGlobalKeydown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    isPaletteOpen.value = !isPaletteOpen.value
    return
  }

  if (e.key === 'Escape' && !isPaletteOpen.value) {
    handleGoHome()
  } else if (e.key === 'Enter' && !isPaletteOpen.value) {
    handleGoHome()
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleGlobalKeydown)

    countdownTimer = setInterval(() => {
      if (countdown.value > 1) {
        countdown.value--
      } else {
        handleGoHome()
      }
    }, 1000)
  }
})

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleGlobalKeydown)
  }
})
</script>

<template>
  <div class="min-h-screen bg-[#0a0a0c] text-white relative flex flex-col justify-between overflow-hidden selection:bg-blue-600 selection:text-white font-sans select-none">
    <!-- Desktop Fullscreen HD Stage (md and up) -->
    <div class="hidden md:block fixed inset-0 w-full h-full overflow-hidden bg-black z-0 select-none">
      <img 
        src="/mio-404-scene.webp" 
        alt="404 Not Found" 
        class="w-full h-full object-cover object-center filter brightness-95"
      >
      <!-- Soft vignette gradient overlay for contrast & legibility -->
      <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/50 pointer-events-none" />
    </div>

    <!-- Mobile Responsive Stage (under md): Ambient Glow + 16:9 Crisp Center -->
    <div class="md:hidden fixed inset-0 w-full h-full overflow-hidden bg-[#09090b] z-0 select-none flex items-center justify-center p-4">
      <!-- Ambient blurred glow filling vertical space -->
      <img 
        src="/mio-404-scene.webp" 
        alt="Ambient Glow" 
        class="absolute inset-0 w-full h-full object-cover filter blur-3xl scale-125 opacity-35 pointer-events-none"
      >
      <div class="absolute inset-0 bg-black/60 pointer-events-none" />

      <!-- Center 16:9 Scene preserving full composition without cropping -->
      <div class="relative w-full max-w-sm aspect-[16/9] rounded-2xl overflow-hidden border border-white/15 shadow-2xl z-10">
        <img 
          src="/mio-404-scene.webp" 
          alt="404 Not Found" 
          class="w-full h-full object-cover object-center"
        >
      </div>
    </div>

    <!-- Layer 4: UI Elements Overlay -->
    <!-- Top Area: Brand Bar & Subtitle -->
    <div class="relative z-30 w-full flex flex-col gap-2 p-6 sm:p-8">
      <header class="w-full flex items-center justify-between">
        <button
          id="btn-brand-home"
          type="button"
          class="flex items-center gap-2.5 text-white/90 hover:text-white transition-colors cursor-pointer drop-shadow-md"
          @click="handleGoHome"
        >
          <img
            src="/favicon.png"
            alt="Avttr Studio"
            class="w-6 h-6 rounded-md shadow-xs"
          >
          <span class="font-semibold text-sm tracking-tight text-white">Avttr Studio</span>
        </button>
      </header>

      <!-- Subtitle above character -->
      <p class="text-xs sm:text-sm font-semibold tracking-[0.35em] text-white/90 uppercase select-none text-center drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] pt-2">
        SEEMS LIKE YOU ARE LOST
      </p>
    </div>

    <!-- Bottom Actions: Clean button and countdown (No footer text) -->
    <div class="relative z-30 w-full flex flex-col items-center justify-center pb-8 sm:pb-10 px-4 gap-3">
      <button
        id="btn-back-home"
        type="button"
        class="inline-flex items-center gap-2.5 px-7 py-2.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 hover:border-white/40 text-xs sm:text-sm font-medium tracking-[0.2em] uppercase text-white hover:text-blue-300 transition-all hover:-translate-x-1 duration-200 cursor-pointer group shadow-2xl"
        @click="handleGoHome"
      >
        <ArrowLeft class="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
        <span>BACK TO HOMEPAGE</span>
      </button>

      <!-- Countdown & shortcut info -->
      <p class="text-xs font-mono text-white/70 tracking-wider text-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
        Mengalihkan otomatis dalam <span class="text-white font-bold">{{ countdown }}</span> detik &bull; Tekan <button type="button" @click="handleSearch" class="px-1.5 py-0.5 rounded bg-black/60 border border-white/20 text-white text-[10px] hover:bg-black/80 cursor-pointer">Ctrl+K</button> untuk cari
      </p>
    </div>

    <!-- Command Palette for Quick Search -->
    <LazyCommandPalette
      v-if="isPaletteOpen"
      :is-open="isPaletteOpen"
      @close="isPaletteOpen = false"
    />
  </div>
</template>
