<script setup lang="ts">
import { useDark, useToggle } from '@vueuse/core'
import { useHistory } from '~/composables/useHistory'
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
</script>

<template>
  <header
    class="sticky top-0 z-30 h-14 bg-[var(--bg-app)]/85 backdrop-blur-md border-b border-[var(--border-subtle)] flex items-center justify-between px-4 sm:px-6 transition-colors"
  >
    <!-- Left: Mobile Menu Toggle & Title -->
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="lg:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-lg transition-colors cursor-pointer"
        @click="$emit('toggle-sidebar')"
        aria-label="Toggle navigation"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div class="flex items-center gap-2">
        <slot name="title">
          <h1 class="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
            Dashboard
          </h1>
        </slot>
      </div>
    </div>

    <!-- Right Controls -->
    <div class="flex items-center gap-2">
      <!-- Quick Search Button -->
      <button
        type="button"
        class="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-card)] rounded-lg text-xs text-[var(--text-secondary)] transition-all cursor-pointer"
        @click="$emit('open-palette')"
      >
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>Search...</span>
        <kbd class="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded">⌘K</kbd>
      </button>

      <!-- History Trigger -->
      <button
        type="button"
        class="relative p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-lg transition-colors cursor-pointer"
        @click="$emit('open-history')"
        title="Recent Downloads History"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span
          v-if="history.length > 0"
          class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#1447E6]"
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
