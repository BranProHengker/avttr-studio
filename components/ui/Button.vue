<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'default',
  disabled: false,
  loading: false,
  type: 'button',
})

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'primary':
      return 'bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] shadow-sm font-semibold border-transparent'
    case 'secondary':
      return 'bg-[var(--bg-card-hover)] text-[var(--text-primary)] hover:bg-[var(--border-subtle)] border-[var(--border-card)]'
    case 'outline':
      return 'bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] border-[var(--border-card)]'
    case 'ghost':
      return 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] border-transparent'
    case 'destructive':
      return 'bg-[#EF4444] text-white hover:bg-[#DC2626] border-transparent'
    default:
      return ''
  }
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'h-8 px-3 text-xs rounded-md'
    case 'lg':
      return 'h-12 px-6 text-base rounded-lg'
    case 'icon':
      return 'h-10 w-10 p-0 rounded-lg flex items-center justify-center'
    case 'default':
    default:
      return 'h-10 px-4 text-sm rounded-lg'
  }
})
</script>

<template>
  <button
    :id="id"
    :type="type"
    :disabled="disabled || loading"
    class="inline-flex items-center justify-center font-medium transition-all duration-150 ease-in-out cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-[#1447E6]/40 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 border gap-2"
    :class="[variantClasses, sizeClasses]"
  >
    <svg
      v-if="loading"
      class="animate-spin -ml-1 mr-1.5 h-4 w-4 text-current"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
    <slot />
  </button>
</template>
