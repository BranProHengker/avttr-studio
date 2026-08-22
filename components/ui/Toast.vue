<script setup lang="ts">
import type { ToastItem } from '~/types'

interface Props {
  toast: ToastItem
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'dismiss', id: string): void
}>()
</script>

<template>
  <div
    class="flex items-start justify-between w-full max-w-sm p-4 bg-[var(--bg-surface-elevated)] border border-[var(--border-card)] rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.4)] pointer-events-auto transition-all transform gap-3"
  >
    <div class="flex items-start gap-3">
      <!-- Status Icon -->
      <div class="mt-0.5">
        <span v-if="toast.type === 'success'" class="flex h-5 w-5 rounded-full bg-[#10B981]/15 text-[#10B981] items-center justify-center text-xs">✓</span>
        <span v-else-if="toast.type === 'error'" class="flex h-5 w-5 rounded-full bg-[#EF4444]/15 text-[#EF4444] items-center justify-center text-xs">✕</span>
        <span v-else-if="toast.type === 'warning'" class="flex h-5 w-5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] items-center justify-center text-xs">!</span>
        <span v-else class="flex h-5 w-5 rounded-full bg-[#1447E6]/15 text-[#3080FF] items-center justify-center text-xs">ℹ</span>
      </div>

      <div>
        <h4 class="text-sm font-semibold text-[var(--text-primary)]">
          {{ toast.title }}
        </h4>
        <p v-if="toast.description" class="mt-0.5 text-xs text-[var(--text-secondary)] leading-relaxed">
          {{ toast.description }}
        </p>
      </div>
    </div>

    <!-- Dismiss Button -->
    <button
      type="button"
      class="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors p-1"
      @click="emit('dismiss', toast.id)"
    >
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>
