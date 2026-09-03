<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useDark, useToggle } from '@vueuse/core'
import { useHistory } from '~/composables/useHistory'
import { useI18n } from '~/composables/useI18n'
import { PanelLeft } from 'lucide-vue-next'
import Badge from '~/components/ui/Badge.vue'

defineEmits<{
  (e: 'toggle-sidebar'): void
  (e: 'open-palette'): void
  (e: 'open-history'): void
}>()

const isDark = useDark({
  selector: 'html',
  attribute: 'class',
  valueDark: 'dark',
  valueLight: '',
})
const toggleDark = useToggle(isDark)
const { history } = useHistory()
const { locale, t, toggleLocale } = useI18n()

const shortcutKey = ref('Ctrl+K')

onMounted(() => {
  if (typeof navigator !== 'undefined') {
    const isMac = /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent || navigator.platform)
    shortcutKey.value = isMac ? '⌘K' : 'Ctrl+K'
  }
})
</script>

<template>
  <header
    class="sticky top-0 z-30 h-14 bg-[var(--bg-app)]/85 backdrop-blur-md border-b border-[var(--border-subtle)] flex items-center justify-between px-3 sm:px-6 transition-colors"
  >
    <!-- Left: Mobile Menu Toggle & Title -->
    <div class="flex items-center gap-2.5 sm:gap-4 min-w-0">
      <button
        type="button"
        class="lg:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-lg transition-colors cursor-pointer"
        @click="$emit('toggle-sidebar')"
        aria-label="Toggle navigation"
      >
        <PanelLeft class="w-5 h-5" />
      </button>

      <div class="flex items-center gap-2 shrink-0">
        <slot name="title">
          <h1 class="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
            {{ t.dashboard }}
          </h1>
        </slot>
      </div>
    </div>

    <!-- Right Controls -->
    <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
      <!-- Quick Search Trigger (Mobile Icon) -->
      <button
        type="button"
        class="lg:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-lg transition-colors cursor-pointer"
        @click="$emit('open-palette')"
        title="Search"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>

      <!-- GitHub Repository Link (threeui style button) -->
      <a
        href="https://github.com/BranProHengker/avttr-studio"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-card)] hover:border-white/20 rounded-lg text-xs font-medium text-white transition-all shadow-xs group"
        title="Star on GitHub"
      >
        <svg class="w-3.5 h-3.5 fill-current text-[var(--text-secondary)] group-hover:text-white transition-colors" viewBox="0 0 24 24">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
        </svg>
        <span class="font-semibold text-[11px] hidden sm:inline">GitHub</span>
      </a>

      <!-- Language Switcher Pill (ID / EN) -->
      <button
        type="button"
        class="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-card)] rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-white transition-all cursor-pointer"
        @click="toggleLocale"
        :title="`Language: ${locale.toUpperCase()} (Click to switch)`"
      >
        <svg class="w-3.5 h-3.5 text-[var(--text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <span class="font-mono font-semibold uppercase text-[11px] text-white">
          {{ locale }}
        </span>
      </button>

      <!-- History Trigger -->
      <button
        type="button"
        class="relative p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-lg transition-colors cursor-pointer"
        @click="$emit('open-history')"
        :title="t.downloadHistory"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span
          v-if="history.length > 0"
          class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-white shadow-xs"
        />
      </button>

      <!-- Dark / Light Theme Toggle -->
      <button
        type="button"
        class="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-lg transition-colors cursor-pointer"
        @click="toggleDark()"
        title="Toggle Theme"
      >
        <svg v-if="isDark" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </button>
    </div>
  </header>
</template>
