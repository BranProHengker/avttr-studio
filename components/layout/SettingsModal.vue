<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDark, useToggle } from '@vueuse/core'
import { useI18n } from '~/composables/useI18n'
import { useSettings, type SettingsTab } from '~/composables/useSettings'
import { useHistory } from '~/composables/useHistory'
import { useToast } from '~/composables/useToast'
import Modal from '~/components/ui/Modal.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'
import {
  Sliders,
  Download,
  HardDrive,
  Info,
  Bug,
  Check,
  ExternalLink,
  Trash2,
  RotateCcw,
  Sun,
  Moon,
  Globe,
  ShieldCheck,
  Github,
} from 'lucide-vue-next'

const { t, locale, toggleLocale } = useI18n()
const { settings, isSettingsOpen, activeSettingsTab, closeSettings, resetSettings } = useSettings()
const { history, clear: clearHistory } = useHistory()
const { show: showToast } = useToast()

const isDark = useDark({
  selector: 'html',
  attribute: 'class',
  valueDark: 'dark',
  valueLight: '',
})
const toggleDark = useToggle(isDark)

const tabs = computed<Array<{ id: SettingsTab; label: string; icon: any }>>(() => [
  { id: 'general', label: t.value.tabGeneral, icon: Sliders },
  { id: 'downloader', label: t.value.tabDownloader, icon: Download },
  { id: 'storage', label: t.value.tabStorage, icon: HardDrive },
  { id: 'about', label: t.value.tabAbout, icon: Info },
  { id: 'support', label: t.value.tabSupport, icon: Bug },
])

const handleClearHistory = () => {
  clearHistory()
  showToast({
    type: 'success',
    title: t.value.clearHistory,
    description: 'All download history records have been cleared from local storage.',
  })
}

const handleResetPreferences = () => {
  resetSettings()
  showToast({
    type: 'info',
    title: 'Preferences Reset',
    description: 'Settings have been reset to factory defaults.',
  })
}
</script>

<template>
  <Modal
    :model-value="isSettingsOpen"
    max-width="3xl"
    :title="t.settings"
    @update:model-value="closeSettings"
  >
    <div class="flex flex-col sm:flex-row min-h-[460px] -m-6 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 dark:divide-[#26262A]">
      <!-- Left Sidebar Tabs -->
      <nav class="w-full sm:w-56 shrink-0 p-3 sm:p-3.5 bg-zinc-50/70 dark:bg-[#131315] flex sm:flex-col gap-1 overflow-x-auto sm:overflow-x-visible">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left cursor-pointer shrink-0 sm:shrink border"
          :class="
            activeSettingsTab === tab.id
              ? 'bg-white dark:bg-[#222226] text-zinc-900 dark:text-white font-semibold shadow-xs border-zinc-200/80 dark:border-white/10'
              : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-[#1B1B1F] border-transparent'
          "
          @click="activeSettingsTab = tab.id"
        >
          <component :is="tab.icon" class="w-4 h-4 shrink-0" />
          <span class="truncate">{{ tab.label }}</span>
        </button>

        <div class="hidden sm:block mt-auto pt-4 border-t border-zinc-200 dark:border-[#26262A] px-2 text-[11px] text-zinc-400 dark:text-neutral-500 font-mono">
          <span>Avttr Studio v1.2.0</span>
        </div>
      </nav>

      <!-- Right Tab Content Panel -->
      <div class="flex-1 p-5 sm:p-6 overflow-y-auto max-h-[65vh] space-y-6 bg-white dark:bg-[#161617]">
        <!-- 1. GENERAL TAB -->
        <div v-if="activeSettingsTab === 'general'" class="space-y-6">
          <div class="border-b border-zinc-200 dark:border-[#26262A] pb-3">
            <h3 class="text-sm font-semibold text-zinc-900 dark:text-white">
              {{ t.tabGeneral }}
            </h3>
            <p class="text-xs text-zinc-500 dark:text-neutral-400 mt-0.5">
              Customize language, display theme, and browser input ergonomics.
            </p>
          </div>

          <!-- Language Row -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-3.5 sm:p-4 rounded-xl border border-zinc-200 dark:border-[#26262A] bg-zinc-50/70 dark:bg-[#1B1B1E] hover:border-zinc-300 dark:hover:border-[#333338] transition-colors">
            <div class="space-y-0.5">
              <div class="text-xs font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <Globe class="w-3.5 h-3.5 text-zinc-500 dark:text-neutral-400" />
                <span>{{ t.language }}</span>
              </div>
              <p class="text-xs text-zinc-500 dark:text-neutral-400">
                Select your preferred interface language.
              </p>
            </div>
            <div class="flex items-center gap-1 bg-zinc-200/60 dark:bg-[#121214] border border-zinc-200 dark:border-[#28282D] rounded-lg p-0.5 shrink-0">
              <button
                type="button"
                class="px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-all"
                :class="locale === 'en' ? 'bg-white dark:bg-[#28282D] text-zinc-900 dark:text-white shadow-xs font-semibold border border-black/5 dark:border-white/10' : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'"
                @click="locale !== 'en' && toggleLocale()"
              >
                English
              </button>
              <button
                type="button"
                class="px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-all"
                :class="locale === 'id' ? 'bg-white dark:bg-[#28282D] text-zinc-900 dark:text-white shadow-xs font-semibold border border-black/5 dark:border-white/10' : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'"
                @click="locale !== 'id' && toggleLocale()"
              >
                Indonesia
              </button>
            </div>
          </div>

          <!-- Theme Row -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-3.5 sm:p-4 rounded-xl border border-zinc-200 dark:border-[#26262A] bg-zinc-50/70 dark:bg-[#1B1B1E] hover:border-zinc-300 dark:hover:border-[#333338] transition-colors">
            <div class="space-y-0.5">
              <div class="text-xs font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <Sun v-if="!isDark" class="w-3.5 h-3.5 text-zinc-500" />
                <Moon v-else class="w-3.5 h-3.5 text-neutral-400" />
                <span>Interface Theme</span>
              </div>
              <p class="text-xs text-zinc-500 dark:text-neutral-400">
                Switch between Apple Soft Light and Obsidian Dark mode.
              </p>
            </div>
            <div class="flex items-center gap-1 bg-zinc-200/60 dark:bg-[#121214] border border-zinc-200 dark:border-[#28282D] rounded-lg p-0.5 shrink-0">
              <button
                type="button"
                class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-all"
                :class="!isDark ? 'bg-white text-zinc-900 shadow-xs font-semibold border border-black/5' : 'text-zinc-600 dark:text-neutral-400 hover:text-white'"
                @click="isDark && toggleDark()"
              >
                <Sun class="w-3 h-3" />
                <span>Light</span>
              </button>
              <button
                type="button"
                class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-all"
                :class="isDark ? 'bg-[#28282D] text-white shadow-xs font-semibold border border-white/10' : 'text-zinc-600 hover:text-zinc-900'"
                @click="!isDark && toggleDark()"
              >
                <Moon class="w-3 h-3" />
                <span>Dark</span>
              </button>
            </div>
          </div>

          <!-- Reset Defaults Trigger -->
          <div class="pt-2 flex justify-end">
            <button
              type="button"
              class="text-xs text-zinc-400 dark:text-neutral-500 hover:text-zinc-700 dark:hover:text-neutral-300 flex items-center gap-1.5 cursor-pointer transition-colors"
              @click="handleResetPreferences"
            >
              <RotateCcw class="w-3 h-3" />
              <span>Reset preferences to defaults</span>
            </button>
          </div>
        </div>

        <!-- 2. DOWNLOADER TAB -->
        <div v-else-if="activeSettingsTab === 'downloader'" class="space-y-6">
          <div class="border-b border-zinc-200 dark:border-[#26262A] pb-3">
            <h3 class="text-sm font-semibold text-zinc-900 dark:text-white">
              {{ t.tabDownloader }}
            </h3>
            <p class="text-xs text-zinc-500 dark:text-neutral-400 mt-0.5">
              Default resolution, media formats, and smart resolver parameters.
            </p>
          </div>

          <!-- Quality Selection -->
          <div class="p-3.5 sm:p-4 rounded-xl border border-zinc-200 dark:border-[#26262A] bg-zinc-50/70 dark:bg-[#1B1B1E] space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-xs font-semibold text-zinc-900 dark:text-white">Preferred Video Quality</div>
                <p class="text-xs text-zinc-500 dark:text-neutral-400">Resolution prioritized when multiple streams are available.</p>
              </div>
              <Badge variant="outline" class="text-[10px]">Auto-fallback</Badge>
            </div>
            <div class="grid grid-cols-3 gap-2 pt-1">
              <button
                v-for="q in (['best', '1080p', '720p'] as const)"
                :key="q"
                type="button"
                class="py-2 px-3 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer capitalize"
                :class="
                  settings.defaultQuality === q
                    ? 'bg-white dark:bg-[#28282D] text-zinc-900 dark:text-white border-zinc-300 dark:border-white/20 font-semibold shadow-xs'
                    : 'bg-zinc-100/60 dark:bg-[#141416] text-zinc-600 dark:text-neutral-400 border-zinc-200 dark:border-[#28282D] hover:border-zinc-300 dark:hover:border-[#3E3E44]'
                "
                @click="settings.defaultQuality = q"
              >
                {{ q === 'best' ? 'Best Available' : q }}
              </button>
            </div>
          </div>

          <!-- Auto Download Thumbnail -->
          <div class="flex items-center justify-between p-3.5 sm:p-4 rounded-xl border border-zinc-200 dark:border-[#26262A] bg-zinc-50/70 dark:bg-[#1B1B1E]">
            <div class="space-y-0.5">
              <div class="text-xs font-semibold text-zinc-900 dark:text-white">Thumbnail Companion</div>
              <p class="text-xs text-zinc-500 dark:text-neutral-400">Include HD video cover image when downloading media.</p>
            </div>
            <button
              type="button"
              class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
              :class="settings.autoDownloadThumbnail ? 'bg-zinc-900 dark:bg-white' : 'bg-zinc-300 dark:bg-[#2A2A2E] border border-zinc-200 dark:border-[#38383E]'"
              @click="settings.autoDownloadThumbnail = !settings.autoDownloadThumbnail"
              aria-label="Toggle Thumbnail Companion"
            >
              <span
                class="pointer-events-none inline-block h-4 w-4 transform rounded-full shadow-sm ring-0 transition duration-200 ease-in-out"
                :class="settings.autoDownloadThumbnail ? 'translate-x-4 bg-white dark:bg-zinc-900' : 'translate-x-0 bg-white'"
              />
            </button>
          </div>

          <!-- Custom Cobalt Instance URL (Advanced) -->
          <div class="p-3.5 sm:p-4 rounded-xl border border-zinc-200 dark:border-[#26262A] bg-zinc-50/70 dark:bg-[#1B1B1E] space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="text-xs font-semibold text-zinc-900 dark:text-white">Custom Engine Instance</div>
              <Badge variant="ghost" class="text-[10px]">Optional / Power User</Badge>
            </div>
            <p class="text-xs text-zinc-500 dark:text-neutral-400">
              Specify your self-hosted Cobalt API instance URL (leave empty for default public fallback).
            </p>
            <input
              v-model="settings.customCobaltApi"
              type="url"
              placeholder="https://cobalt.yourdomain.com"
              class="w-full h-9 px-3 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-[#28282D] rounded-lg text-xs font-mono text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-neutral-600 focus:outline-none focus:border-zinc-400 dark:focus:border-[#4E4E58]"
            />
          </div>
        </div>

        <!-- 3. STORAGE & CACHE TAB -->
        <div v-else-if="activeSettingsTab === 'storage'" class="space-y-6">
          <div class="border-b border-zinc-200 dark:border-[#26262A] pb-3">
            <h3 class="text-sm font-semibold text-zinc-900 dark:text-white">
              {{ t.tabStorage }}
            </h3>
            <p class="text-xs text-zinc-500 dark:text-neutral-400 mt-0.5">
              Inspect client-side storage, history records, and cache control.
            </p>
          </div>

          <!-- History Stats -->
          <div class="p-4 rounded-xl border border-zinc-200 dark:border-[#26262A] bg-zinc-50/70 dark:bg-[#1B1B1E] flex items-center justify-between">
            <div class="space-y-1">
              <div class="text-xs font-semibold text-zinc-900 dark:text-white">Local Download History</div>
              <p class="text-xs text-zinc-500 dark:text-neutral-400">
                Currently holding <span class="font-bold text-zinc-900 dark:text-white">{{ history.length }}</span> items in your browser localStorage.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              :disabled="history.length === 0"
              class="text-xs text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/20"
              @click="handleClearHistory"
            >
              <Trash2 class="w-3.5 h-3.5 mr-1" />
              <span>Clear History</span>
            </Button>
          </div>

          <!-- Privacy Banner -->
          <div class="p-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-500/10 flex items-start gap-3">
            <ShieldCheck class="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div class="space-y-1">
              <div class="text-xs font-semibold text-emerald-900 dark:text-emerald-300">100% Client-Side Privacy Guarantee</div>
              <p class="text-xs text-emerald-800/80 dark:text-emerald-300/80 leading-relaxed">
                Images, PDFs, lyrics, color codes, and file archives are rendered exclusively inside your browser memory (Canvas & Web Workers). No files are uploaded to central storage.
              </p>
            </div>
          </div>
        </div>

        <!-- 4. ABOUT & STACK TAB -->
        <div v-else-if="activeSettingsTab === 'about'" class="space-y-6">
          <div class="border-b border-zinc-200 dark:border-[#26262A] pb-3">
            <h3 class="text-sm font-semibold text-zinc-900 dark:text-white">
              {{ t.tabAbout }}
            </h3>
            <p class="text-xs text-zinc-500 dark:text-neutral-400 mt-0.5">
              Project architecture, design system standards, and open-source credits.
            </p>
          </div>

          <div class="flex items-center gap-3.5 p-4 rounded-xl border border-zinc-200 dark:border-[#26262A] bg-zinc-50/70 dark:bg-[#1B1B1E]">
            <img src="/mio.png" alt="Avttr Studio" class="w-12 h-12 rounded-xl object-cover border border-zinc-200 dark:border-[#28282D]" />
            <div>
              <div class="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                <span>Avttr Studio</span>
                <Badge variant="primary" class="text-[10px]">v1.2.0</Badge>
              </div>
              <p class="text-xs text-zinc-500 dark:text-neutral-400 mt-0.5">
                Minimalist Media Utility & Developer Tools Studio.
              </p>
            </div>
          </div>

          <div class="space-y-2">
            <div class="text-xs font-semibold text-zinc-900 dark:text-white">Engine & Framework Stack</div>
            <div class="flex flex-wrap gap-1.5">
              <Badge variant="outline">Nuxt 3 (Fullstack)</Badge>
              <Badge variant="outline">Vue 3 Composition API</Badge>
              <Badge variant="outline">Tailwind CSS v4</Badge>
              <Badge variant="outline">TypeScript 5</Badge>
              <Badge variant="outline">Lucide Icons</Badge>
              <Badge variant="outline">Web Streams Proxy</Badge>
              <Badge variant="outline">JSZip (Client Worker)</Badge>
            </div>
          </div>

          <div class="p-3.5 rounded-xl border border-zinc-200 dark:border-[#26262A] bg-zinc-50/70 dark:bg-[#1B1B1E] text-xs text-zinc-500 dark:text-neutral-400 flex items-center justify-between">
            <span>Open Source under MIT License</span>
            <a
              href="https://github.com/BranProHengker/avttr-studio"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-1 font-medium text-zinc-900 dark:text-white hover:underline"
            >
              <Github class="w-3.5 h-3.5" />
              <span>BranProHengker/avttr-studio</span>
              <ExternalLink class="w-3 h-3" />
            </a>
          </div>
        </div>

        <!-- 5. REPORT BUG & SUPPORT TAB -->
        <div v-else-if="activeSettingsTab === 'support'" class="space-y-6">
          <div class="border-b border-zinc-200 dark:border-[#26262A] pb-3">
            <h3 class="text-sm font-semibold text-zinc-900 dark:text-white">
              {{ t.tabSupport }}
            </h3>
            <p class="text-xs text-zinc-500 dark:text-neutral-400 mt-0.5">
              Found a broken downloader, visual glitch, or feature suggestion? Let us know.
            </p>
          </div>

          <!-- Primary GitHub Issue Card -->
          <div class="p-4 rounded-xl border border-zinc-200 dark:border-[#26262A] bg-zinc-50/70 dark:bg-[#1B1B1E] space-y-3">
            <div class="flex items-start gap-3">
              <div class="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Bug class="w-5 h-5" />
              </div>
              <div class="space-y-1">
                <h4 class="text-xs font-semibold text-zinc-900 dark:text-white">Report Bug on GitHub Issues</h4>
                <p class="text-xs text-zinc-500 dark:text-neutral-400 leading-relaxed">
                  Open a tracking issue directly on the official repository. Include the media URL or tool name that caused the issue.
                </p>
              </div>
            </div>

            <div class="pt-2 flex flex-col sm:flex-row gap-2">
              <a
                href="https://github.com/BranProHengker/avttr-studio/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                <Bug class="w-3.5 h-3.5" />
                <span>Submit GitHub Issue</span>
                <ExternalLink class="w-3 h-3 ml-auto opacity-75" />
              </a>

              <a
                href="https://discord.com/users/862578324244267018"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-[#2E2E34] bg-white dark:bg-[#1E1E22] hover:bg-zinc-100 dark:hover:bg-[#25252A] text-xs font-medium text-zinc-900 dark:text-white transition-all cursor-pointer"
                title="Contact via Discord"
              >
                <svg class="w-3.5 h-3.5 fill-current text-[#5865F2]" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                <span>Discord</span>
              </a>
            </div>
          </div>

          <!-- Diagnostic Info Box -->
          <div class="p-3.5 rounded-xl border border-zinc-200 dark:border-[#26262A] bg-zinc-100/60 dark:bg-[#121214] space-y-1.5">
            <div class="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400 dark:text-neutral-500">
              Client Diagnostic Hints
            </div>
            <div class="text-[11px] font-mono text-zinc-500 dark:text-neutral-400 space-y-0.5">
              <div>Version: Avttr Studio v1.2.0</div>
              <div>Stack: Nuxt 3.16 + Tailwind v4 + Nitro Engine</div>
              <div>Tip: Copy error messages or failed URLs when opening an issue.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>
