<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'neutral'
  size?: 'default' | 'sm'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'default',
})

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'primary':
      return 'bg-[#27272A] text-[var(--text-primary)] border-[#3F3F46]'
    case 'success':
      return 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30'
    case 'warning':
      return 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30'
    case 'error':
      return 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30'
    case 'neutral':
    default:
      return 'bg-[#1E1E22] text-[var(--text-secondary)] border-[var(--border-subtle)]'
  }
})
</script>

<template>
  <span
    class="inline-flex items-center font-mono font-medium border rounded-[6px] tracking-tight uppercase select-none"
    :class="[
      variantClasses,
      size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]',
    ]"
  >
    <slot />
  </span>
</template>
