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

    <!-- SoundCloud Official Logo -->
    <svg
      v-else-if="normalized === 'soundcloud'"
      viewBox="0 0 24 24"
      fill="currentColor"
      class="w-full h-full text-[#FF5500]"
    >
      <path d="M1.175 12.225c-.051 0-.094.045-.101.1l-.25 2.124.25 2.1c.007.058.05.098.101.098.054 0 .098-.04.101-.098l.056-2.1-.056-2.124a.097.097 0 0 0-.101-.1zm1.393-.837c-.067 0-.12.052-.128.118l-.24 2.943.24 2.89c.008.066.061.118.128.118.07 0 .124-.052.128-.118l.063-2.89-.063-2.943a.124.124 0 0 0-.128-.118zm1.503-.437c-.078 0-.14.062-.148.14l-.234 3.42.234 3.332c.008.078.07.14.148.14.081 0 .144-.062.148-.14l.066-3.332-.066-3.42a.144.144 0 0 0-.148-.14zm1.517-.113c-.09 0-.16.073-.167.164l-.226 3.533.226 3.414c.007.091.077.164.167.164s.16-.073.167-.164l.067-3.414-.067-3.533a.164.164 0 0 0-.167-.164zm1.53-.404c-.102 0-.18.084-.187.187l-.21 3.937.21 3.784c.007.103.085.187.187.187.105 0 .187-.084.187-.187l.067-3.784-.067-3.937a.185.185 0 0 0-.187-.187zm1.543-.518c-.114 0-.203.095-.207.21l-.192 4.455.192 4.254c.004.115.093.21.207.21.117 0 .207-.095.207-.21l.067-4.254-.067-4.455a.207.207 0 0 0-.207-.21zm1.554.49c-.126 0-.223.106-.226.233l-.173 3.965.173 4.232c.003.127.1.233.226.233.13 0 .227-.106.227-.233l.066-4.232-.066-3.965a.229.229 0 0 0-.227-.233zm1.567-2.617c-.138 0-.246.118-.246.256l-.155 6.58.155 4.398c0 .138.108.256.246.256.141 0 .247-.118.247-.256l.066-4.398-.066-6.58a.252.252 0 0 0-.247-.256zm1.579-.908c-.15 0-.265.129-.265.28l-.136 7.488.136 4.542c0 .151.115.28.265.28.153 0 .267-.129.267-.28l.066-4.542-.066-7.488a.276.276 0 0 0-.267-.28zm1.591-.702c-.162 0-.285.14-.285.303l-.117 8.19.117 4.674c0 .163.123.303.285.303.165 0 .287-.14.287-.303l.066-4.674-.066-8.19a.298.298 0 0 0-.287-.303zm1.603.237c-.174 0-.305.152-.305.328l-.098 7.953.098 4.795c0 .176.131.328.305.328.177 0 .307-.152.307-.328l.065-4.795-.065-7.953a.322.322 0 0 0-.307-.328zm3.08-1.53c-.313 0-.612.062-.888.175-.122.05-.183.166-.183.304l-.08 9.004.08 4.898c0 .188.14.351.324.351h5.834c2.613 0 4.733-2.12 4.733-4.733 0-2.482-1.92-4.52-4.37-4.717-.384-2.92-2.883-5.182-5.45-5.182z"/>
    </svg>

    <!-- Video to GIF Vector -->
    <svg
      v-else-if="normalized === 'video-to-gif' || normalized === 'gif'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="w-full h-full"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <path d="M10 9H7a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3v-2H8v-2h2"/>
      <path d="M14 9v6"/>
      <path d="M18 9h-3v6"/>
      <path d="M15 12h2.5"/>
    </svg>

    <!-- TeraBox Cloud Official Logo -->
    <svg
      v-else-if="normalized === 'terabox'"
      viewBox="0 0 24 24"
      fill="currentColor"
      class="w-full h-full text-[#0066FF]"
    >
      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3zm-5.5-8.5h-3v3.5H7.5l4.5 4.5 4.5-4.5h-3z"/>
    </svg>

    <!-- PairDrop / P2P AirDrop Vector -->
    <svg
      v-else-if="normalized === 'pairdrop' || normalized === 'airdrop' || normalized === 'p2p-drop'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="w-full h-full"
    >
      <path d="M4.93 4.93a10 10 0 0 1 14.14 0" />
      <path d="M7.76 7.76a6 6 0 0 1 8.48 0" />
      <path d="M10.59 10.59a2 2 0 0 1 2.82 0" />
      <circle cx="12" cy="18" r="1.5" fill="currentColor" />
      <path d="M12 14v2.5" />
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

    <!-- Background Remover Vector -->
    <svg
      v-else-if="normalized === 'background-remover' || normalized === 'bg-remover' || normalized === 'cutout'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="w-full h-full"
    >
      <path d="M12 2v4"/>
      <path d="m4.93 4.93 2.83 2.83"/>
      <path d="M2 12h4"/>
      <path d="m4.93 19.07 2.83-2.83"/>
      <path d="m14 14 7 7"/>
      <path d="m17 11 4 4"/>
      <path d="m11 17 4 4"/>
    </svg>

    <!-- Image Converter Vector -->
    <svg
      v-else-if="normalized === 'image-converter' || normalized === 'converter'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="w-full h-full"
    >
      <path d="M21 7v6h-6"/>
      <path d="M3 17v-6h6"/>
      <path d="m21 13-4-4a5 5 0 0 0-7.07 0L3 16"/>
      <path d="m3 11 4 4a5 5 0 0 0 7.07 0L21 8"/>
    </svg>

    <!-- Color Converter / Eyedropper Vector -->
    <svg
      v-else-if="normalized === 'color-converter' || normalized === 'eyedropper' || normalized === 'pipette'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="w-full h-full"
    >
      <path d="m2 22 1-1h3l9-9"/>
      <path d="M3 21v-3l9-9"/>
      <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l-3-3Z"/>
    </svg>

    <!-- Font Library Vector -->
    <svg
      v-else-if="normalized === 'font-library' || normalized === 'font-explorer' || normalized === 'font-tester' || normalized === 'typography' || normalized === 'brat-generator' || normalized === 'brat' || normalized === 'type'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="w-full h-full"
    >
      <polyline points="4 7 4 4 20 4 20 7"/>
      <line x1="9" x2="15" y1="20" y2="20"/>
      <line x1="12" x2="12" y1="4" y2="20"/>
    </svg>

    <!-- PDF Studio / Document Vector -->
    <svg
      v-else-if="normalized === 'pdf-tools' || normalized === 'file-text' || normalized === 'pdf'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="w-full h-full"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" x2="8" y1="13" y2="13"/>
      <line x1="16" x2="8" y1="17" y2="17"/>
      <line x1="10" x2="8" y1="9" y2="9"/>
    </svg>

    <!-- SVG Optimizer / Sparkles Vector -->
    <svg
      v-else-if="normalized === 'svg-optimizer' || normalized === 'sparkles' || normalized === 'svg'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="w-full h-full"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/>
      <path d="M19 17v4"/>
      <path d="M3 5h4"/>
      <path d="M17 19h4"/>
    </svg>

    <!-- Device Mockup / Smartphone Vector -->
    <svg
      v-else-if="normalized === 'device-mockup' || normalized === 'smartphone' || normalized === 'mockup'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="w-full h-full"
    >
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2"/>
      <path d="M12 18h.01"/>
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
