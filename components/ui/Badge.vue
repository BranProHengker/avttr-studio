<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'badge' | 'outline' | 'ghost' | 'success' | 'warning' | 'error' | 'neutral'
  size?: 'default' | 'sm' | 'lg'
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  size: 'default',
  class: '',
})

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'primary':
      // Soft dark charcoal pill in light mode, soft off-white pill in dark mode
      return 'rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold shadow-xs hover:opacity-90 border-transparent'
    case 'secondary':
      // Subtle neutral pill matching Apple/Shadcn soft palette
      return 'rounded-full bg-zinc-200/60 text-[var(--text-primary)] dark:bg-[#2C2C2E] dark:text-[var(--text-primary)] font-medium border border-zinc-200/80 dark:border-transparent hover:bg-zinc-200 dark:hover:bg-[#38383A]'
    case 'badge':
    case 'neutral':
      // Card surface with subtle border (like 'v2.0')
      return 'rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:border-[var(--border-card-hover)]'
    case 'outline':
      // Transparent pill with border (like 'Popular')
      return 'rounded-full border border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-card-hover)]'
    case 'ghost':
      // Clean text-only (like 'Coming soon')
      return 'bg-transparent text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-full border-transparent'
    case 'success':
      return 'rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium border border-emerald-500/20'
    case 'warning':
      return 'rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium border border-amber-500/20'
    case 'error':
      return 'rounded-full bg-red-500/10 text-red-700 dark:text-red-400 font-medium border border-red-500/20'
    default:
      return 'rounded-full bg-zinc-100 text-zinc-900 dark:bg-[#2E2E2E] dark:text-white font-medium border border-zinc-200 dark:border-transparent hover:bg-zinc-200 dark:hover:bg-[#383838]'
  }
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'px-2 py-0.5 text-[10px]'
    case 'lg':
      return 'px-3 py-1 text-sm'
    case 'default':
    default:
      return 'px-2.5 py-0.5 text-xs'
  }
})
</script>

<template>
  <span
    class="inline-flex w-fit shrink-0 items-center justify-center gap-1 font-medium whitespace-nowrap select-none transition-colors"
    :class="[variantClasses, sizeClasses, props.class]"
  >
    <slot />
  </span>
</template>
