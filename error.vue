<script setup lang="ts">
import { ref, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import type { NuxtError } from '#app'
import { Home, Search } from 'lucide-vue-next'

const LazyCommandPalette = defineAsyncComponent(() => import('~/components/layout/CommandPalette.vue'))

interface Props {
  error?: NuxtError
}

const props = defineProps<Props>()

useHead({
  title: '404 — Halaman Hilang di Kehampaan | Avttr Studio',
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
  <div class="min-h-screen bg-black text-white relative flex flex-col justify-between overflow-x-hidden selection:bg-blue-600 selection:text-white font-sans">
    <!-- Star Field Layer -->
    <div class="absolute inset-0 stars-bg opacity-70 pointer-events-none" />

    <!-- Ambient Cosmic Radial Glow -->
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(14,165,233,0.06),transparent_65%)] pointer-events-none" />

    <!-- Top Minimal Brand Bar -->
    <header class="relative z-10 w-full px-6 py-5 flex items-center justify-between">
      <button
        id="btn-brand-home"
        type="button"
        class="flex items-center gap-2.5 text-white/70 hover:text-white transition-colors cursor-pointer"
        @click="handleGoHome"
      >
        <img
          src="/favicon.png"
          alt="Avttr Studio"
          class="w-6 h-6 rounded-md shadow-xs"
        >
        <span class="font-semibold text-sm tracking-tight text-white">Avttr Studio</span>
      </button>
      <span class="text-xs font-mono text-white/40 tracking-wider">
        ERROR // {{ props.error?.statusCode || 404 }}_NOT_FOUND
      </span>
    </header>

    <!-- Main Hero Content: Empty Void Vibe -->
    <main class="relative z-10 flex-1 flex items-center justify-center px-6 py-8 my-auto">
      <div class="w-full max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 lg:gap-24">
        
        <!-- Left Column on Desktop / Centered on Mobile: Character Mio -->
        <div class="flex-shrink-0 flex items-center justify-center order-1 md:order-none">
          <div class="relative animate-float">
            <!-- Subtle cyan backlight aura behind Mio -->
            <div class="absolute -inset-4 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <img 
              src="/mio-404.png" 
              alt="Mio Lost in the Void" 
              class="h-64 sm:h-80 md:h-96 lg:h-[430px] w-auto object-contain select-none pointer-events-none mio-glow"
            >
          </div>
        </div>

        <!-- Right Column on Desktop / Centered on Mobile: 404 Typography & Actions -->
        <div class="flex flex-col items-center md:items-start text-center md:text-left max-w-md order-2 md:order-none">
          <!-- "Oops!" from photo 2 -->
          <p class="text-xl sm:text-2xl font-light text-white/90 tracking-wide mb-1">
            Oops!
          </p>

          <!-- Massive 404 matching photo 2 -->
          <h1 class="text-7xl sm:text-8xl lg:text-9xl font-semibold tracking-tighter text-white font-mono leading-none mb-4 select-none">
            {{ props.error?.statusCode || 404 }}
          </h1>

          <!-- Subtitle matching photo 2 tone -->
          <p class="text-sm sm:text-base text-neutral-400 leading-relaxed mb-8">
            Halaman yang kamu tuju telah hilang di kehampaan atau tidak ditemukan. Mengalihkan ke beranda dalam <span class="font-mono text-white font-medium">{{ countdown }}</span> detik.
          </p>

          <!-- Action Buttons: Pill outline matching photo 2 -->
          <div class="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <!-- Back to Home Pill Button -->
            <button
              id="btn-back-home"
              type="button"
              class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-2.5 rounded-full border border-white/40 hover:border-white text-white text-sm font-medium transition-all hover:bg-white/10 active:scale-95 shadow-sm cursor-pointer"
              @click="handleGoHome"
            >
              <Home class="w-4 h-4" />
              <span>Kembali ke Beranda</span>
            </button>

            <!-- Quick Search Button -->
            <button
              id="btn-quick-search"
              type="button"
              class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-white/50 hover:text-white text-xs font-mono transition-colors hover:bg-white/5 cursor-pointer"
              @click="handleSearch"
            >
              <Search class="w-3.5 h-3.5" />
              <span>Cari Tool (Ctrl+K)</span>
            </button>
          </div>
        </div>

      </div>
    </main>

    <!-- Bottom Curved Earth Horizon Atmosphere (Photo 2 Replication) -->
    <div class="relative w-full overflow-hidden pointer-events-none mt-auto">
      <!-- Blue Atmospheric Ambient Glow -->
      <div class="absolute bottom-0 inset-x-0 h-40 bg-[radial-gradient(ellipse_at_bottom,rgba(56,189,248,0.22)_0%,rgba(37,99,235,0.12)_35%,transparent_75%)]" />
      
      <!-- Earth Curvature Image from Photo 2 -->
      <div class="relative w-full flex justify-center">
        <img 
          src="/earth-horizon.png" 
          alt="Earth Horizon" 
          class="w-full max-w-7xl h-24 sm:h-32 md:h-44 object-cover object-top opacity-90 filter contrast-110 select-none"
          style="mask-image: linear-gradient(to bottom, transparent 0%, black 25%, black 100%); -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 25%, black 100%);"
        >
      </div>
    </div>

    <!-- Command Palette for Quick Search -->
    <LazyCommandPalette
      v-if="isPaletteOpen"
      :is-open="isPaletteOpen"
      @close="isPaletteOpen = false"
    />
  </div>
</template>

<style scoped>
@keyframes float {
  0%, 100% {
    transform: translateY(0px) rotate(0deg);
  }
  50% {
    transform: translateY(-12px) rotate(0.8deg);
  }
}

.animate-float {
  animation: float 6s ease-in-out infinite;
}

/* Star field particles */
.stars-bg {
  background-image: 
    radial-gradient(1.5px 1.5px at 20px 30px, #ffffff, rgba(0,0,0,0)),
    radial-gradient(1px 1px at 80px 140px, rgba(255,255,255,0.7), rgba(0,0,0,0)),
    radial-gradient(1.5px 1.5px at 150px 80px, rgba(255,255,255,0.8), rgba(0,0,0,0)),
    radial-gradient(1px 1px at 240px 320px, rgba(255,255,255,0.5), rgba(0,0,0,0)),
    radial-gradient(2px 2px at 380px 210px, rgba(255,255,255,0.9), rgba(0,0,0,0)),
    radial-gradient(1px 1px at 450px 90px, rgba(255,255,255,0.6), rgba(0,0,0,0)),
    radial-gradient(1.5px 1.5px at 580px 380px, rgba(255,255,255,0.7), rgba(0,0,0,0)),
    radial-gradient(1px 1px at 720px 170px, rgba(255,255,255,0.5), rgba(0,0,0,0)),
    radial-gradient(2px 2px at 890px 290px, rgba(255,255,255,0.85), rgba(0,0,0,0)),
    radial-gradient(1px 1px at 980px 120px, rgba(255,255,255,0.6), rgba(0,0,0,0));
  background-repeat: repeat;
  background-size: 1000px 500px;
}

.mio-glow {
  filter: drop-shadow(0 0 20px rgba(56, 189, 248, 0.18)) drop-shadow(0 0 40px rgba(255, 255, 255, 0.08));
}
</style>
