<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useHistory } from '~/composables/useHistory'
import { useI18n } from '~/composables/useI18n'

interface Props {
  isOpen: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open-palette'): void
  (e: 'open-history'): void
}>()

const route = useRoute()
const { history } = useHistory()
const { t } = useI18n()

const shortcutKey = ref('Ctrl+K')

onMounted(() => {
  if (typeof navigator !== 'undefined') {
    const isMac = /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent || navigator.platform)
    shortcutKey.value = isMac ? '⌘K' : 'Ctrl+K'
  }
})

// Accordion state for collapsible menus
const openMenus = ref<Record<string, boolean>>({
  'dashboard': true,
  'video-reels': true,
  'feeds-audio': true,
  'assets': true,
  'design': true,
})

const toggleMenu = (menuKey: string) => {
  openMenus.value[menuKey] = !openMenus.value[menuKey]
}

const isRouteActive = (targetRoute: string) => {
  if (targetRoute === '/' && route.path === '/') return true
  if (targetRoute !== '/' && route.path === targetRoute) return true
  return false
}
</script>

<template>
  <div>
    <!-- Mobile Backdrop -->
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
      @click="emit('close')"
    />

    <!-- Sidebar Container -->
    <aside
      class="fixed top-0 bottom-0 left-0 z-40 w-64 bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 select-none"
      :class="isOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <!-- Top Workspace Switcher Header (Shadcnblocks Style) -->
      <div class="p-3 border-b border-[var(--border-subtle)]">
        <NuxtLink
          to="/"
          class="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-card)] transition-colors group cursor-pointer"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <!-- Mio Logo Image -->
            <div class="w-8 h-8 rounded-lg overflow-hidden bg-[#212121] border border-[#2E2E2E] flex items-center justify-center shrink-0 shadow-xs">
              <img
                src="/mio.png"
                alt="Avttr Studio Logo"
                class="w-full h-full object-cover"
              />
            </div>
            <div class="truncate">
              <div class="font-semibold text-sm text-white tracking-tight leading-tight truncate">
                {{ t.appName }}
              </div>
              <div class="text-xs text-[var(--text-tertiary)] leading-tight truncate mt-0.5">
                {{ t.appSubtitle }}
              </div>
            </div>
          </div>

          <!-- Selector Chevrons Up/Down -->
          <svg class="w-4 h-4 text-[var(--text-tertiary)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        </NuxtLink>
      </div>

      <!-- Prominent Search Bar (Under Workspace Header) -->
      <div class="px-3 pt-3 pb-1 border-b border-[var(--border-subtle)]/50">
        <button
          type="button"
          class="w-full flex items-center gap-2 px-3 py-2 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-card)] hover:border-[var(--border-card-hover)] rounded-lg text-xs text-[var(--text-secondary)] hover:text-white transition-all cursor-pointer shadow-xs group"
          @click="emit('open-palette')"
          title="Search tools (Ctrl + K)"
        >
          <svg class="w-3.5 h-3.5 text-[var(--text-tertiary)] group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span class="flex-1 text-left truncate text-[12px] text-[var(--text-secondary)] group-hover:text-white">Search tools...</span>
          <kbd class="px-1.5 py-0.5 text-[10px] font-mono bg-[#2E2E2E] text-[var(--text-tertiary)] group-hover:text-white rounded shadow-xs font-semibold">
            {{ shortcutKey }}
          </kbd>
        </button>
      </div>

      <!-- Navigation Content -->
      <div class="flex-1 overflow-y-auto px-3 py-3 space-y-6">
        <!-- Section: Social Downloaders -->
        <div class="space-y-1.5">
          <div class="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            {{ t.socialDownloaders }}
          </div>

          <!-- Dashboard Menu -->
          <div class="space-y-0.5">
            <button
              type="button"
              class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-[#FAFAFA] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer group"
              @click="toggleMenu('dashboard')"
            >
              <div class="flex items-center gap-2.5">
                <svg class="w-4.5 h-4.5 text-[var(--text-secondary)] group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span>{{ t.dashboard }}</span>
              </div>
              <svg
                class="w-3.5 h-3.5 text-[var(--text-tertiary)] transition-transform duration-150"
                :class="openMenus['dashboard'] ? 'rotate-90' : ''"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <!-- Collapsible Submenu Tree -->
            <div v-show="openMenus['dashboard']" class="ml-4 pl-3.5 border-l border-[#2E2E2E] space-y-0.5 mt-0.5">
              <NuxtLink
                to="/"
                class="block px-3 py-2 text-[13px] rounded-md transition-colors"
                :class="
                  isRouteActive('/')
                    ? 'bg-[#2E2E2E] text-white font-medium shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card-hover)]'
                "
              >
                {{ t.allDownloaders }}
              </NuxtLink>
            </div>
          </div>

          <!-- Video & Socials Menu -->
          <div class="space-y-0.5">
            <button
              type="button"
              class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-[#FAFAFA] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer group"
              @click="toggleMenu('video-reels')"
            >
              <div class="flex items-center gap-2.5">
                <svg class="w-4.5 h-4.5 text-[var(--text-secondary)] group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>{{ t.videoSocials }}</span>
              </div>
              <svg
                class="w-3.5 h-3.5 text-[var(--text-tertiary)] transition-transform duration-150"
                :class="openMenus['video-reels'] ? 'rotate-90' : ''"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <!-- Collapsible Submenu Tree -->
            <div v-show="openMenus['video-reels']" class="ml-4 pl-3.5 border-l border-[#2E2E2E] space-y-0.5 mt-0.5">
              <NuxtLink
                to="/d/tiktok"
                class="block px-3 py-2 text-[13px] rounded-md transition-colors"
                :class="
                  isRouteActive('/d/tiktok')
                    ? 'bg-[#2E2E2E] text-white font-medium shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card-hover)]'
                "
              >
                TikTok
              </NuxtLink>
              <NuxtLink
                to="/d/instagram"
                class="block px-3 py-2 text-[13px] rounded-md transition-colors"
                :class="
                  isRouteActive('/d/instagram')
                    ? 'bg-[#2E2E2E] text-white font-medium shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card-hover)]'
                "
              >
                Instagram
              </NuxtLink>
              <NuxtLink
                to="/d/youtube"
                class="block px-3 py-2 text-[13px] rounded-md transition-colors"
                :class="
                  isRouteActive('/d/youtube')
                    ? 'bg-[#2E2E2E] text-white font-medium shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card-hover)]'
                "
              >
                YouTube
              </NuxtLink>
              <NuxtLink
                to="/d/twitter"
                class="block px-3 py-2 text-[13px] rounded-md transition-colors"
                :class="
                  isRouteActive('/d/twitter')
                    ? 'bg-[#2E2E2E] text-white font-medium shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card-hover)]'
                "
              >
                Twitter / X
              </NuxtLink>
              <NuxtLink
                to="/d/capcut"
                class="block px-3 py-2 text-[13px] rounded-md transition-colors"
                :class="
                  isRouteActive('/d/capcut')
                    ? 'bg-[#2E2E2E] text-white font-medium shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card-hover)]'
                "
              >
                CapCut
              </NuxtLink>
              <NuxtLink
                to="/d/facebook"
                class="block px-3 py-2 text-[13px] rounded-md transition-colors"
                :class="
                  isRouteActive('/d/facebook')
                    ? 'bg-[#2E2E2E] text-white font-medium shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card-hover)]'
                "
              >
                Facebook
              </NuxtLink>
            </div>
          </div>

          <!-- Audio & Music Menu -->
          <div class="space-y-0.5">
            <button
              type="button"
              class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-[#FAFAFA] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer group"
              @click="toggleMenu('feeds-audio')"
            >
              <div class="flex items-center gap-2.5">
                <svg class="w-4.5 h-4.5 text-[var(--text-secondary)] group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <span>{{ t.audioMusic }}</span>
              </div>
              <svg
                class="w-3.5 h-3.5 text-[var(--text-tertiary)] transition-transform duration-150"
                :class="openMenus['feeds-audio'] ? 'rotate-90' : ''"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <!-- Collapsible Submenu Tree -->
            <div v-show="openMenus['feeds-audio']" class="ml-4 pl-3.5 border-l border-[#2E2E2E] space-y-0.5 mt-0.5">
              <NuxtLink
                to="/d/spotify"
                class="block px-3 py-2 text-[13px] rounded-md transition-colors"
                :class="
                  isRouteActive('/d/spotify')
                    ? 'bg-[#2E2E2E] text-white font-medium shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card-hover)]'
                "
              >
                Spotify & Audio
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Section: Client Utilities -->
        <div class="space-y-1.5">
          <div class="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            {{ t.clientUtilities }}
          </div>

          <!-- Assets Menu -->
          <div class="space-y-0.5">
            <button
              type="button"
              class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-[#FAFAFA] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer group"
              @click="toggleMenu('assets')"
            >
              <div class="flex items-center gap-2.5">
                <svg class="w-4.5 h-4.5 text-[var(--text-secondary)] group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                <span>{{ t.assetGenerators }}</span>
              </div>
              <svg
                class="w-3.5 h-3.5 text-[var(--text-tertiary)] transition-transform duration-150"
                :class="openMenus['assets'] ? 'rotate-90' : ''"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <!-- Collapsible Submenu Tree -->
            <div v-show="openMenus['assets']" class="ml-4 pl-3.5 border-l border-[#2E2E2E] space-y-0.5 mt-0.5">
              <NuxtLink
                to="/tools/image-compressor"
                class="block px-3 py-2 text-[13px] rounded-md transition-colors"
                :class="
                  isRouteActive('/tools/image-compressor')
                    ? 'bg-[#2E2E2E] text-white font-medium shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card-hover)]'
                "
              >
                Image Compressor
              </NuxtLink>
              <NuxtLink
                to="/tools/qr-generator"
                class="block px-3 py-2 text-[13px] rounded-md transition-colors"
                :class="
                  isRouteActive('/tools/qr-generator')
                    ? 'bg-[#2E2E2E] text-white font-medium shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card-hover)]'
                "
              >
                QR Code Generator
              </NuxtLink>
              <NuxtLink
                to="/tools/hash-encoder"
                class="block px-3 py-2 text-[13px] rounded-md transition-colors"
                :class="
                  isRouteActive('/tools/hash-encoder')
                    ? 'bg-[#2E2E2E] text-white font-medium shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card-hover)]'
                "
              >
                Base64 & Hash Encoder
              </NuxtLink>
            </div>
          </div>

          <!-- Design Menu -->
          <div class="space-y-0.5">
            <button
              type="button"
              class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-[#FAFAFA] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer group"
              @click="toggleMenu('design')"
            >
              <div class="flex items-center gap-2.5">
                <svg class="w-4.5 h-4.5 text-[var(--text-secondary)] group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4 5 5 0 015-5h4a5 5 0 015 5 4 4 0 01-4 4H7zM16 3.13a4 4 0 010 7.75M21 14v1a4 4 0 01-4 4h-1" />
                </svg>
                <span>{{ t.designSystem }}</span>
              </div>
              <svg
                class="w-3.5 h-3.5 text-[var(--text-tertiary)] transition-transform duration-150"
                :class="openMenus['design'] ? 'rotate-90' : ''"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <!-- Collapsible Submenu Tree -->
            <div v-show="openMenus['design']" class="ml-4 pl-3.5 border-l border-[#2E2E2E] space-y-0.5 mt-0.5">
              <NuxtLink
                to="/tools/color-converter"
                class="block px-3 py-2 text-[13px] rounded-md transition-colors"
                :class="
                  isRouteActive('/tools/color-converter')
                    ? 'bg-[#2E2E2E] text-white font-medium shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card-hover)]'
                "
              >
                Color Converter & Picker
              </NuxtLink>
              <NuxtLink
                to="/tools/color-palette"
                class="block px-3 py-2 text-[13px] rounded-md transition-colors"
                :class="
                  isRouteActive('/tools/color-palette')
                    ? 'bg-[#2E2E2E] text-white font-medium shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card-hover)]'
                "
              >
                Color Palette Generator
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Section: System & Storage -->
        <div class="space-y-1.5">
          <div class="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            {{ t.systemStorage }}
          </div>

          <div class="space-y-0.5">
            <!-- Download History Button -->
            <button
              type="button"
              class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer group"
              @click="emit('open-history')"
            >
              <div class="flex items-center gap-2.5">
                <svg class="w-4.5 h-4.5 text-[var(--text-secondary)] group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{{ t.downloadHistory }}</span>
              </div>
              <span
                v-if="history.length > 0"
                class="px-2 py-0.5 text-xs font-mono bg-[#2E2E2E] text-white rounded-md"
              >
                {{ history.length }}
              </span>
            </button>
          </div>
        </div>
      </div>

      <!-- Bottom GitHub Repository Card -->
      <div class="p-3 border-t border-[var(--border-subtle)]">
        <a
          href="https://github.com/BranProHengker/avttr-studio"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-card)] hover:border-white/20 transition-all cursor-pointer group"
          title="Open GitHub Repository"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <!-- GitHub Icon Avatar -->
            <div class="w-9 h-9 rounded-lg bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-white shrink-0 group-hover:border-white/30 transition-colors shadow-xs">
              <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
            </div>
            <div class="truncate">
              <div class="font-semibold text-sm text-white leading-tight truncate flex items-center gap-1.5">
                <span>avttr-studio</span>
                <svg class="w-3 h-3 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
              <div class="text-xs text-[var(--text-tertiary)] leading-tight truncate mt-0.5 font-mono">
                BranProHengker/avttr-studio
              </div>
            </div>
          </div>

          <!-- Chevron Right -->
          <svg class="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-white transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </aside>
  </div>
</template>
