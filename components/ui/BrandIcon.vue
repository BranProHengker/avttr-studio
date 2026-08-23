<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  name: string
  size?: number | string
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 20,
  class: '',
})

const normalized = computed(() => props.name.toLowerCase())
</script>

<template>
  <span
    class="inline-flex items-center justify-center shrink-0 select-none text-current"
    :class="props.class"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <!-- TikTok Official Logo -->
    <svg
      v-if="normalized === 'tiktok'"
      viewBox="0 0 24 24"
      fill="currentColor"
      class="w-full h-full"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.88 2.89 2.89 0 0 1-2.89-2.88 2.89 2.89 0 0 1 2.89-2.89c.3 0 .59.05.86.13V9.38a6.38 6.38 0 0 0-.86-.06 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.75a8.28 8.28 0 0 0 4.82 1.54V6.84a4.83 4.83 0 0 1-1.05-.15z"/>
    </svg>

    <!-- Instagram Official Logo -->
    <svg
      v-else-if="normalized === 'instagram'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="w-full h-full"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
    </svg>

    <!-- YouTube Official Logo -->
    <svg
      v-else-if="normalized === 'youtube'"
      viewBox="0 0 24 24"
      fill="currentColor"
      class="w-full h-full text-[#FF0000]"
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>

    <!-- X / Twitter Official Logo -->
    <svg
      v-else-if="normalized === 'twitter' || normalized === 'x'"
      viewBox="0 0 24 24"
      fill="currentColor"
      class="w-full h-full"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>

    <!-- CapCut Official Logo -->
    <svg
      v-else-if="normalized === 'capcut'"
      viewBox="0 0 24 24"
      fill="currentColor"
      class="w-full h-full"
    >
      <path d="M2.5 5.5h19v3.5l-9.5 3 9.5 3v3.5h-19v-3.5l9.5-3-9.5-3z"/>
    </svg>

    <!-- Facebook Official Logo -->
    <svg
      v-else-if="normalized === 'facebook'"
      viewBox="0 0 24 24"
      fill="currentColor"
      class="w-full h-full text-[#1877F2]"
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>

    <!-- Spotify Official Logo -->
    <svg
      v-else-if="normalized === 'spotify'"
      viewBox="0 0 24 24"
      fill="currentColor"
      class="w-full h-full text-[#1DB954]"
    >
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.49 17.306a.754.754 0 0 1-1.04.249c-2.848-1.74-6.435-2.134-10.66-1.168a.754.754 0 0 1-.34-1.468c4.622-1.054 8.583-.604 11.79 1.353.37.227.487.71.25 1.034zm1.466-3.26a.944.944 0 0 1-1.3.312c-3.26-2.003-8.23-2.585-12.083-1.414a.944.944 0 0 1-.555-1.804c4.403-1.336 9.89-.684 13.626 1.612a.944.944 0 0 1 .312 1.294zm.126-3.393c-3.91-2.322-10.355-2.535-14.088-1.4a1.132 1.132 0 0 1-.655-2.167c4.29-1.303 11.41-1.05 15.908 1.62a1.132 1.132 0 0 1-1.165 1.947z"/>
    </svg>

    <!-- QR Code / Scanner Vector -->
    <svg
      v-else-if="normalized === 'qr-generator' || normalized === 'qrcode'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="w-full h-full"
    >
      <rect x="3" y="3" width="7" height="7"/>
      <rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/>
    </svg>

    <!-- Color Palette Vector -->
    <svg
      v-else-if="normalized === 'color-palette' || normalized === 'palette'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="w-full h-full"
    >
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
    </svg>

    <!-- Hash & Base64 Vector -->
    <svg
      v-else-if="normalized === 'base64-image' || normalized === 'hash-encoder' || normalized === 'hash'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="w-full h-full"
    >
      <line x1="4" y1="9" x2="20" y2="9"/>
      <line x1="4" y1="15" x2="20" y2="15"/>
      <line x1="10" y1="3" x2="8" y2="21"/>
      <line x1="16" y1="3" x2="14" y2="21"/>
    </svg>

    <!-- Image Compressor Vector -->
    <svg
      v-else-if="normalized === 'image-compressor' || normalized === 'compress' || normalized === 'image'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="w-full h-full"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <path d="m21 15-5-5L5 21"/>
      <path d="m14 4 2 2-2 2"/>
      <path d="m20 4-2 2 2 2"/>
    </svg>

    <!-- Generic Fallback Tool -->
    <svg
      v-else
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="w-full h-full"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  </span>
</template>
