<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NavArrowRight } from '@iconoir/vue'

interface Props {
  text?: string
  size?: number | string
  strokeWidth?: number | string
  showChevron?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  text: 'Analyzing...',
  size: 18,
  strokeWidth: 2.2,
  showChevron: true,
  class: '',
})

const pathRef = ref<SVGPathElement | null>(null)
const pathLength = ref(46)
const isReady = ref(false)

onMounted(() => {
  if (pathRef.value) {
    const total = pathRef.value.getTotalLength()
    if (total > 0) {
      pathLength.value = Math.round(total)
    }
  }
  isReady.value = true
})
</script>

<template>
  <div
    class="inline-flex items-center gap-2 text-sm font-medium tracking-wide select-none"
    :class="props.class"
  >
    <!-- Animated SVG Path Drawing Loader -->
    <svg
      role="status"
      aria-label="Loading..."
      viewBox="0 0 19 19"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      :width="size"
      :height="size"
      class="text-zinc-600 dark:text-zinc-200 shrink-0"
    >
      <path
        ref="pathRef"
        d="M4.43431 2.42415C-0.789139 6.90104 1.21472 15.2022 8.434 15.9242C15.5762 16.6384 18.8649 9.23035 15.9332 4.5183C14.1316 1.62255 8.43695 0.0528911 7.51841 3.33733C6.48107 7.04659 15.2699 15.0195 17.4343 16.9241"
        stroke="currentColor"
        :stroke-width="strokeWidth"
        stroke-linecap="round"
        :style="isReady ? {
          strokeDasharray: pathLength,
          '--path-length': `${pathLength}px`,
        } : undefined"
        class="transition-opacity duration-300"
        :class="isReady ? 'opacity-100 animate-draw-stroke' : 'opacity-0'"
      />
    </svg>

    <!-- Shimmer Text -->
    <span
      class="bg-clip-text text-transparent shimmer-text font-medium"
      style="background-size: 200% auto;"
    >
      {{ text }}
    </span>

    <!-- Optional Chevron Indicator -->
    <NavArrowRight
      v-if="showChevron"
      class="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0"
    />
  </div>
</template>

<style scoped>
@keyframes drawStroke {
  0% {
    stroke-dashoffset: var(--path-length, 46px);
    animation-timing-function: ease-in-out;
  }
  50% {
    stroke-dashoffset: 0;
    animation-timing-function: ease-in-out;
  }
  100% {
    stroke-dashoffset: calc(var(--path-length, 46px) * -1);
  }
}

.animate-draw-stroke {
  animation: drawStroke 2.4s infinite;
}

@keyframes textShimmer {
  0% {
    background-position: -100% center;
  }
  100% {
    background-position: 100% center;
  }
}

.shimmer-text {
  animation: textShimmer 2.2s ease-in-out infinite;
  background-image: linear-gradient(
    90deg,
    rgb(113 113 122) 0%,
    rgb(113 113 122) 35%,
    rgb(24 24 27) 50%,
    rgb(113 113 122) 65%,
    rgb(113 113 122) 100%
  );
}

:global(.dark) .shimmer-text,
:global(:root[data-theme="dark"]) .shimmer-text {
  background-image: linear-gradient(
    90deg,
    rgb(161 161 170) 0%,
    rgb(161 161 170) 35%,
    rgb(255 255 255) 50%,
    rgb(161 161 170) 65%,
    rgb(161 161 170) 100%
  );
}
</style>
