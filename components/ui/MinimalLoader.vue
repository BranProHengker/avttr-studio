<script setup lang="ts">
import LoadingBreadcrumb from '~/components/ui/LoadingBreadcrumb.vue'

interface Props {
  text?: string
  subtext?: string
  size?: number | string
  strokeWidth?: number | string
  showChevron?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  text: 'Analyzing...',
  subtext: '',
  size: 22,
  strokeWidth: 2.4,
  showChevron: true,
  class: '',
})
</script>

<template>
  <div
    class="py-16 sm:py-24 flex flex-col items-center justify-center text-center select-none"
    :class="props.class"
  >
    <LoadingBreadcrumb
      :text="text"
      :size="size"
      :stroke-width="strokeWidth"
      :show-chevron="showChevron"
      class="text-sm sm:text-base font-medium tracking-wide"
    />
    <p
      v-if="subtext"
      class="mt-2.5 text-xs font-mono text-[var(--text-tertiary)] max-w-md mx-auto leading-relaxed"
    >
      {{ subtext }}
    </p>
  </div>
</template>
