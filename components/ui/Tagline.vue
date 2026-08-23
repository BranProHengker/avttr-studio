<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'default' | 'primary' | 'secondary' | 'badge' | 'outline' | 'ghost'
  asChild?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  asChild: false,
  class: '',
})

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'primary':
      return 'rounded-full bg-white text-black font-semibold px-2.5 py-0.5 text-xs shadow-xs hover:bg-white/90'
    case 'secondary':
      return 'rounded-full bg-[#2E2E2E] text-white px-2.5 py-0.5 text-xs hover:bg-[#383838]'
    case 'badge':
      return 'rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-0.5 text-xs text-[var(--text-primary)] hover:border-[var(--border-card-hover)]'
    case 'outline':
      return 'rounded-full border border-[var(--border-subtle)] bg-transparent px-2.5 py-0.5 text-xs text-[var(--text-secondary)] hover:text-white'
    case 'ghost':
      return 'bg-transparent text-xs text-[var(--text-tertiary)] hover:text-white px-1.5 py-0.5'
    case 'default':
    default:
      return 'text-base font-semibold text-[var(--text-primary)]'
  }
})
</script>

<template>
  <component
    :is="asChild ? 'span' : 'div'"
    data-slot="tagline"
    :data-variant="variant"
    class="inline-flex w-fit shrink-0 items-center justify-center gap-1 font-medium whitespace-nowrap select-none transition-colors"
    :class="[variantClasses, props.class]"
  >
    <slot />
  </component>
</template>
