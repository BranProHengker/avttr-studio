<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed, ref, defineAsyncComponent } from 'vue'
import { useDownloader } from '~/composables/useDownloader'
import { useI18n } from '~/composables/useI18n'
import HeroPasteBar from '~/components/dashboard/HeroPasteBar.vue'
import BrandIcon from '~/components/ui/BrandIcon.vue'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

const LazyMediaPreviewModal = defineAsyncComponent(() => import('~/components/downloaders/MediaPreviewModal.vue'))

const route = useRoute()
const { locale } = useI18n()
const platformParam = computed(() => (route.params.platform as string) || 'tiktok')

const platformInfo = computed(() => {
  const isId = locale.value === 'id'

  switch (platformParam.value) {
    case 'tiktok':
      return {
        name: 'TikTok',
        subtitle: isId
          ? 'Download video TikTok HD tanpa watermark, audio MP3, dan photo slide'
          : 'Download TikTok HD Videos without watermark, Audio MP3, and Photo Carousels',
        placeholder: 'Paste TikTok video link (e.g. https://www.tiktok.com/@user/video/...)',
        features: isId
          ? ['1080p Full HD', 'Tanpa Watermark', 'Audio MP3 Berkualitas', 'Slide Foto ZIP']
          : ['1080p Full HD', 'Zero Watermark', 'High Bitrate Audio MP3', 'Photo Slide Batch ZIP'],
      }
    case 'instagram':
      return {
        name: 'Instagram',
        subtitle: isId
          ? 'Download Instagram Reels, postingan Carousel, foto, dan audio'
          : 'Download Instagram Reels, Carousel Photos, Stories, and Audio Tracks',
        placeholder: 'Paste Instagram post or reel link (e.g. https://www.instagram.com/reel/...)',
        features: isId
          ? ['Reels HD (MP4)', 'Multi-Image Carousel ZIP', 'Audio Asli', 'Tanpa Login']
          : ['Reels HD (MP4)', 'Multi-Image Carousel ZIP', 'Original Audio', 'Zero Login Required'],
      }
    case 'youtube':
      return {
        name: 'YouTube',
        subtitle: isId
          ? 'Download video YouTube, Shorts, dan audio MP3'
          : 'Download YouTube Videos, Shorts, and Audio MP3 streams',
        placeholder: 'Paste YouTube video link (e.g. https://youtu.be/... or youtube.com/watch?v=...)',
        features: isId
          ? ['Mendukung Shorts', 'Ekstraksi Audio (MP3)', 'Streaming Cepat']
          : ['Shorts Support', 'Audio Extraction (MP3)', 'Fast Streaming'],
      }
    case 'twitter':
      return {
        name: 'Twitter / X',
        subtitle: isId
          ? 'Download video Twitter (X), animasi GIF, dan media kualitas asli'
          : 'Download Twitter (X) videos, GIFs, and media attachments in original quality',
        placeholder: 'Paste Twitter/X status link (e.g. https://x.com/user/status/...)',
        features: isId
          ? ['HD Video Stream', 'Mendukung GIF', 'Direct Stream', 'Tanpa Aplikasi']
          : ['HD Video Stream', 'GIF Support', 'Direct Proxy Stream', 'No App Install Needed'],
      }
    case 'capcut':
      return {
        name: 'CapCut',
        subtitle: isId
          ? 'Ekstrak video template CapCut bersih tanpa watermark'
          : 'Extract clean CapCut templates and video exports without app overlays',
        placeholder: 'Paste CapCut template link (e.g. https://www.capcut.com/template-detail/...)',
        features: isId
          ? ['Video Template Bersih', 'Tanpa Logo CapCut', 'Resolusi Asli', 'Ekstraksi Cepat']
          : ['Clean Template Video', 'No CapCut Logo', 'Original Resolution', 'Fast Extraction'],
      }
    case 'facebook':
      return {
        name: 'Facebook',
        subtitle: isId
          ? 'Download video dan reels publik Facebook kualitas HD'
          : 'Download public Facebook videos and reels in high definition',
        placeholder: 'Paste Facebook video link (e.g. https://www.facebook.com/watch?v=...)',
        features: isId
          ? ['Video HD & SD', 'Mendukung Reels', 'File MP4 Langsung', 'Tanpa Akun']
          : ['HD & SD Video', 'Reels Support', 'Direct MP4 File', 'No Account Required'],
      }
    case 'terabox':
      return {
        name: 'TeraBox',
        subtitle: isId
          ? 'Link download langsung cepat untuk file, folder, dan video TeraBox'
          : 'Direct high-speed download links for TeraBox files, folders, and shared videos',
        placeholder: 'Paste TeraBox share link (e.g. https://terabox.com/s/... or https://terabox.app/s/...)',
        features: isId
          ? ['Link Download Langsung', 'HD Video Stream', 'Mendukung Multi-File', 'Dual Engine']
          : ['Fast Direct Link', 'HD Video Stream', 'Multi-File Folder Support', 'Apify & Direct Engine'],
      }
    case 'soundcloud':
      return {
        name: 'SoundCloud',
        subtitle: isId
          ? 'Download lagu SoundCloud, podcast, DJ mix, dan cover artwork HD'
          : 'Download SoundCloud tracks, podcast episodes, and 500x500 Ultra HD cover artwork',
        placeholder: 'Paste SoundCloud track link (e.g. https://soundcloud.com/artist/track)...',
        features: isId
          ? ['Stream Audio MP3', 'Cover Art HD', 'Info Lagu', 'Direct Stream']
          : ['MP3 Audio Stream', 'Ultra HD Artwork', 'Track Info', 'Direct Proxy'],
      }
    case 'spotify':
      return {
        name: 'Spotify',
        subtitle: isId
          ? 'Ambil metadata lagu, cover album HD, dan stream audio MP3'
          : 'Fetch track metadata, Ultra HD album cover artwork, and 320kbps MP3 audio streams',
        placeholder: 'Paste Spotify track link (e.g. https://open.spotify.com/track/...)...',
        features: isId
          ? ['Audio MP3 Berkualitas', 'Preview 30 Detik', 'Cover Album HD', 'Stream Cepat']
          : ['320kbps MP3 Audio', 'HQ 30s Preview', 'Ultra HD Album Art', 'Fast Stream'],
      }
    default:
      return {
        name: 'Media Downloader',
        subtitle: isId
          ? 'Pengunduh media serbaguna dan stream extractor resolusi tinggi'
          : 'Universal media scraper and high-resolution stream extractor',
        placeholder: 'Paste media link...',
        features: isId
          ? ['Direct Stream', 'Kualitas Asli', 'Client Privacy', 'Proses Cepat']
          : ['Direct Stream', 'Original Quality', 'Client Privacy', 'Fast Processing'],
      }
  }
})

const { url, loading, result, error, resolveMedia } = useDownloader()
const isModalOpen = ref(false)

const handleResolve = async () => {
  if (!url.value.trim()) return
  const data = await resolveMedia()
  if (data && data.success) {
    isModalOpen.value = true
  }
}
</script>

<template>
  <div class="space-y-8 pb-12 w-full">
    <!-- Breadcrumb & Back -->
    <div class="flex items-center gap-2">
      <NuxtLink to="/" class="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1">
        <span>← Dashboard</span>
      </NuxtLink>
      <span class="text-xs text-[var(--text-tertiary)]">/</span>
      <span class="text-xs font-mono text-[var(--text-primary)]">{{ platformInfo.name }} Downloader</span>
    </div>

    <!-- Header Section -->
    <div class="space-y-2">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
          <BrandIcon :name="platformParam" :size="24" />
        </div>
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            {{ platformInfo.name }} Downloader
          </h1>
          <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            {{ platformInfo.subtitle }}
          </p>
        </div>
      </div>
    </div>

    <!-- Downloader Input Box -->
    <div class="space-y-3">
      <HeroPasteBar
        v-model="url"
        :loading="loading"
        @submit="handleResolve"
      />

      <!-- Error / Cookie Expired Alert Box -->
      <div
        v-if="error"
        class="p-4 rounded-xl border transition-all flex items-start gap-3.5"
        :class="
          error.toLowerCase().includes('cookie') || error.toLowerCase().includes('terabox')
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
        "
      >
        <div
          class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          :class="error.toLowerCase().includes('cookie') ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'"
        >
          <svg class="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <div class="space-y-1 text-xs min-w-0 flex-1">
          <div class="font-semibold text-sm">
            {{ error.toLowerCase().includes('cookie') ? 'Sesi Cookie TeraBox Kedaluwarsa' : 'Gagal Memproses Link' }}
          </div>
          <p class="leading-relaxed opacity-90">
            {{ error }}
          </p>
          <div v-if="error.toLowerCase().includes('cookie') || error.toLowerCase().includes('terabox')" class="pt-1.5 text-[11px] text-amber-300/90 font-mono">
            💡 <strong>Petunjuk:</strong> Perbarui variabel <code>TERABOX_COOKIE</code> di file <code>.env</code> server dengan cookie <code>ndus</code> terbaru dari TeraBox.
          </div>
        </div>
      </div>
    </div>

    <!-- Feature Pill Tags -->
    <div class="flex flex-wrap items-center gap-2">
      <Badge
        v-for="feat in platformInfo.features"
        :key="feat"
        variant="badge"
        class="px-3 py-1 text-xs"
      >
        {{ feat }}
      </Badge>
    </div>

    <!-- Lazy Loaded Preview Modal -->
    <LazyMediaPreviewModal
      v-if="isModalOpen"
      v-model="isModalOpen"
      :result="result"
    />
  </div>
</template>
