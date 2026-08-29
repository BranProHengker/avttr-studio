<script setup lang="ts">
import { computed } from 'vue'
import { detectPlatform } from '~/server/utils/sanitizer'
import { useI18n } from '~/composables/useI18n'
import Button from '~/components/ui/Button.vue'
import BrandIcon from '~/components/ui/BrandIcon.vue'

interface Props {
  modelValue: string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'submit'): void
}>()

const { t } = useI18n()

const platform = computed(() => {
  if (!props.modelValue) return null
  const p = detectPlatform(props.modelValue)
  return p !== 'other' ? p : null
})

const pasteFromClipboard = async () => {
  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      emit('update:modelValue', text.trim())
      emit('submit')
    }
  } catch {
    // Clipboard permission denied
  }
}
</script>

<template>
  <div class="w-full bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[14px] p-4 sm:p-5 shadow-[0_4px_24px_rgba(0,0,0,0.15)] transition-all">
    <div class="flex flex-col sm:flex-row items-center gap-3">
      <!-- Input Wrapper -->
      <div class="relative w-full flex-1 flex items-center">
        <!-- Platform Icon or Link Icon -->
        <div class="absolute left-3.5 flex items-center justify-center pointer-events-none text-[var(--text-primary)]">
          <BrandIcon v-if="platform" :name="platform" :size="18" />
          <svg v-else class="w-4 h-4 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>

        <input
          :value="modelValue"
          type="url"
          :placeholder="t.pastePlaceholder"
          class="w-full h-12 pl-10 pr-20 bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-lg text-sm transition-all focus:outline-none focus:border-white focus:ring-2 focus:ring-white/10 disabled:opacity-50"
          :disabled="loading"
          @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
          @keydown.enter="emit('submit')"
        />

        <!-- Paste Action Button -->
        <button
          type="button"
          title="Paste from Clipboard"
          class="absolute right-2.5 p-2 bg-[var(--bg-card-hover)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-white rounded-md transition-all cursor-pointer flex items-center justify-center"
          @click="pasteFromClipboard"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </button>
      </div>

      <!-- Submit Trigger -->
      <Button
        variant="primary"
        size="lg"
        class="w-full sm:w-auto shrink-0 font-semibold px-6"
        :loading="loading"
        @click="emit('submit')"
      >
        {{ t.download }}
      </Button>
    </div>

    <!-- Supported Platform Tags -->
    <div class="mt-3.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] font-mono">
      <span>Supported:</span>
      <span class="hover:text-[var(--text-secondary)]">TikTok (No WM)</span>
      <span>•</span>
      <span class="hover:text-[var(--text-secondary)]">Instagram Reels & Photos</span>
      <span>•</span>
      <span class="hover:text-[var(--text-secondary)]">YouTube 1080p & MP3</span>
      <span>•</span>
      <span class="hover:text-[var(--text-secondary)]">Twitter/X</span>
      <span>•</span>
      <span class="hover:text-[var(--text-secondary)]">CapCut</span>
      <span>•</span>
      <span class="hover:text-[var(--text-secondary)]">Spotify</span>
      <span>•</span>
      <span class="hover:text-[var(--text-secondary)]">TeraBox</span>
    </div>
  </div>
</template>
