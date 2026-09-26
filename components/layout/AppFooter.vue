<script setup lang="ts">
import { useI18n } from '~/composables/useI18n'
import { useSettings } from '~/composables/useSettings'
import { Bug, Github } from 'lucide-vue-next'

const { t } = useI18n()
const { openSettings } = useSettings()
</script>

<template>
  <footer class="mt-auto border-t border-[var(--border-subtle)] py-4 px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text-tertiary)]">
    <!-- Left Copyright & Guarantee -->
    <div class="flex items-center gap-2 text-center sm:text-left">
      <span>© 2026 Avttr Studio</span>
      <span class="opacity-40">•</span>
      <span class="hidden sm:inline">{{ t.footerPrivacy }}</span>
    </div>

    <!-- Right Controls: Report Bug, GitHub, Version -->
    <div class="flex items-center gap-4 shrink-0">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        @click="openSettings('support')"
        title="Open Support & Bug Report"
      >
        <Bug class="w-3.5 h-3.5 text-rose-500/80" />
        <span>{{ t.reportBug }}</span>
      </button>

      <span class="opacity-40">•</span>

      <a
        href="https://github.com/BranProHengker/avttr-studio"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1.5 hover:text-[var(--text-primary)] transition-colors"
        title="GitHub Repository"
      >
        <Github class="w-3.5 h-3.5" />
        <span>GitHub</span>
      </a>
    </div>
  </footer>
</template>
