<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed, ref, defineAsyncComponent } from 'vue'
import { useDownloader } from '~/composables/useDownloader'
import HeroPasteBar from '~/components/dashboard/HeroPasteBar.vue'
import BrandIcon from '~/components/ui/BrandIcon.vue'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'

const LazyMediaPreviewModal = defineAsyncComponent(() => import('~/components/downloaders/MediaPreviewModal.vue'))

const route = useRoute()
const platformParam = computed(() => (route.params.platform as string) || 'tiktok')

const platformInfo = computed(() => {
  switch (platformParam.value) {
    case 'tiktok':
      return {
        name: 'TikTok',
        subtitle: 'Download TikTok HD Videos without watermark, Audio MP3, and Photo Carousels',
        placeholder: 'Paste TikTok video link (e.g. https://www.tiktok.com/@user/video/...)',
        features: ['1080p Full HD', 'Zero Watermark', 'High Bitrate Audio MP3', 'Photo Slide Batch ZIP'],
      }
    case 'instagram':
      return {
        name: 'Instagram',
        subtitle: 'Download Instagram Reels, Carousel Photos, Stories, and Audio Tracks',
        placeholder: 'Paste Instagram post or reel link (e.g. https://www.instagram.com/reel/...)',
        features: ['Reels HD (MP4)', 'Multi-Image Carousel ZIP', 'Original Audio', 'Zero Login Required'],
      }
    case 'youtube':
      return {
        name: 'YouTube',
        subtitle: 'Download YouTube Videos (1080p/720p), Shorts, and Audio MP3 streams',
        placeholder: 'Paste YouTube video link (e.g. https://youtu.be/... or youtube.com/watch?v=...)',
        features: ['1080p & 720p HD Video', 'Shorts Support', 'Audio Extraction (MP3)', 'Fast Streaming'],
      }
    case 'twitter':
      return {
        name: 'Twitter / X',
        subtitle: 'Download Twitter (X) videos, GIFs, and media attachments in original quality',
        placeholder: 'Paste Twitter/X status link (e.g. https://x.com/user/status/...)',
        features: ['HD Video Stream', 'GIF Support', 'Direct Proxy Stream', 'No App Install Needed'],
      }
    case 'capcut':
      return {
        name: 'CapCut',
        subtitle: 'Extract clean CapCut templates and video exports without app overlays',
        placeholder: 'Paste CapCut template link (e.g. https://www.capcut.com/template-detail/...)',
        features: ['Clean Template Video', 'No CapCut Logo', 'Original Resolution', 'Fast Extraction'],
      }
    case 'facebook':
      return {
        name: 'Facebook',
        subtitle: 'Download public Facebook videos and reels in high definition',
        placeholder: 'Paste Facebook video link (e.g. https://www.facebook.com/watch?v=...)',
        features: ['HD & SD Video', 'Reels Support', 'Direct MP4 File', 'No Account Required'],
      }
    case 'spotify':
    default:
      return {
        name: 'Spotify & Audio',
        subtitle: 'Fetch track metadata, album cover artwork, and audio streams',
        placeholder: 'Paste Spotify or SoundCloud link...',
        features: ['Audio Stream', 'HD Album Art', 'Track Info', 'Fast Processing'],
      }
  }
})

const { url, loading, result, resolveMedia } = useDownloader()
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
  <div class="space-y-8 pb-12 w-full max-w-5xl">
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
    <HeroPasteBar
      v-model="url"
      :loading="loading"
      @submit="handleResolve"
    />

    <!-- Features Overview -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card
        v-for="feat in platformInfo.features"
        :key="feat"
        :hoverable="false"
        class="p-3.5 text-center flex flex-col items-center justify-center"
      >
        <span class="text-xs font-semibold text-[var(--text-primary)]">{{ feat }}</span>
      </Card>
    </div>

    <!-- Instructions Guide -->
    <Card :hoverable="false" class="p-6 space-y-4">
      <h3 class="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
        <span>How to download from {{ platformInfo.name }}</span>
      </h3>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-[var(--text-secondary)]">
        <div class="p-3 bg-[var(--bg-card-hover)] rounded-lg space-y-1">
          <div class="font-mono font-bold text-white">01. Copy Link</div>
          <p>Open {{ platformInfo.name }}, tap Share, and copy the video/post URL.</p>
        </div>

        <div class="p-3 bg-[var(--bg-card-hover)] rounded-lg space-y-1">
          <div class="font-mono font-bold text-white">02. Paste in Avttr</div>
          <p>Paste the link into the box above and click "Download".</p>
        </div>

        <div class="p-3 bg-[var(--bg-card-hover)] rounded-lg space-y-1">
          <div class="font-mono font-bold text-white">03. Direct Download</div>
          <p>Choose your quality option (HD Video, Audio MP3, or ZIP) to download directly.</p>
        </div>
      </div>
    </Card>

    <!-- Lazy Loaded Preview Modal -->
    <LazyMediaPreviewModal
      v-if="isModalOpen"
      v-model="isModalOpen"
      :result="result"
    />
  </div>
</template>
