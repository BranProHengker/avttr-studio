<script setup lang="ts">
import { computed } from 'vue'
import type { ToolItem } from '~/types'
import BrandIcon from '~/components/ui/BrandIcon.vue'

interface Props {
  tool: ToolItem
}

const props = defineProps<Props>()

const tabLabel = computed(() => {
  if (props.tool.format) {
    const primary = props.tool.format.split('•')[0].trim().replace(/^\./, '').toUpperCase()
    return `.${primary}`
  }
  return '.FILE'
})
</script>

<template>
  <NuxtLink
    :id="`tool-card-${tool.id}`"
    :to="tool.route"
    :title="tool.description"
    class="group flex flex-col h-full select-none transition-all duration-150 hover:-translate-y-0.5 cursor-pointer"
  >
    <!-- Top File Tab (Physical Archive / Manila File Tab) -->
    <div class="flex items-center">
      <div
        class="px-2.5 py-0.5 rounded-t-md bg-[var(--bg-card)] border-t border-x border-[var(--border-card)] group-hover:border-zinc-400 dark:group-hover:border-zinc-600 group-hover:bg-[var(--bg-card-hover)] text-[9px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider transition-colors"
      >
        {{ tabLabel }}
      </div>
    </div>

    <!-- File Body Container -->
    <div
      class="flex-1 bg-[var(--bg-card)] border border-[var(--border-card)] group-hover:border-zinc-400 dark:group-hover:border-zinc-600 group-hover:bg-[var(--bg-card-hover)] group-hover:shadow-[0_8px_20px_rgba(0,0,0,0.12)] rounded-b-[14px] rounded-tr-[14px] p-4 sm:p-5 flex flex-col items-center justify-center text-center transition-all -mt-[1px] overflow-hidden"
    >
      <!-- Finder Icon Tile Body -->
      <div
        class="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-zinc-100 dark:bg-[#18181B] border border-zinc-200/80 dark:border-white/10 group-hover:scale-105 group-hover:border-zinc-300 dark:group-hover:border-white/20 flex items-center justify-center text-[var(--text-primary)] shadow-xs transition-transform mb-2.5 sm:mb-3 shrink-0"
      >
        <BrandIcon :name="tool.icon" :size="24" />
      </div>

      <!-- Tool Name (Keeps Default Color on Hover) -->
      <h3 class="text-xs sm:text-[13px] font-semibold text-[var(--text-primary)] transition-colors truncate max-w-full leading-tight">
        {{ tool.title }}
      </h3>

      <!-- Format Extension Tag (OS Style) -->
      <span
        v-if="tool.format"
        class="text-[10px] sm:text-[11px] font-mono text-[var(--text-tertiary)] transition-colors mt-1 truncate max-w-full tracking-tight"
      >
        {{ tool.format }}
      </span>
    </div>
  </NuxtLink>
</template>

