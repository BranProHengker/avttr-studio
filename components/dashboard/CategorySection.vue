<script setup lang="ts">
import type { ToolCategory } from '~/types'
import { Folder } from 'lucide-vue-next'
import ToolCard from './ToolCard.vue'

interface Props {
  category: ToolCategory
}

defineProps<Props>()
</script>

<template>
  <section class="space-y-3.5">
    <!-- Category Header -->
    <div class="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
      <h2 class="text-xs font-mono font-bold tracking-wider text-[var(--text-primary)] uppercase flex items-center gap-2">
        <Folder class="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" />
        {{ category.name }}
      </h2>

      <span v-if="category.description" class="hidden sm:inline text-xs text-[var(--text-secondary)]">
        {{ category.description }}
      </span>
    </div>

    <!-- Cards Grid (macOS Finder / OS Desktop 2-to-6 columns) -->
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-3.5">
      <ToolCard
        v-for="tool in category.tools"
        :key="tool.id"
        :tool="tool"
      />
    </div>
  </section>
</template>
