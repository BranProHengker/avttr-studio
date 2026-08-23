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
      // Solid white pill with black text (like 'New')
      return 'rounded-full bg-white text-black font-semibold shadow-xs hover:bg-white/90 border-transparent'
    case 'secondary':
      // Neutral dark pill (like 'Beta')
      return 'rounded-full bg-[#2E2E2E] text-white font-medium border-transparent hover:bg-[#383838]'
    case 'badge':
    case 'neutral':
      // Card surface with subtle border (like 'v2.0')
      return 'rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:border-[var(--border-card-hover)]'
    case 'outline':
      // Transparent pill with border (like 'Popular')
      return 'rounded-full border border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] hover:text-white hover:border-[var(--border-card-hover)]'
    case 'ghost':
      // Clean text-only (like 'Coming soon')
      return 'bg-transparent text-xs text-[var(--text-tertiary)] hover:text-white hover:bg-[var(--bg-card-hover)] rounded-full border-transparent'
    case 'success':
    case 'warning':
    case 'error':
    default:
      // Default to neutral dark pill
      return 'rounded-full bg-[#2E2E2E] text-white font-medium border-transparent hover:bg-[#383838]'
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
