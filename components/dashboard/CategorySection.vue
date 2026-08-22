<script setup lang="ts">
import type { ToolCategory } from '~/types'
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
      <div class="flex items-center gap-2">
        <h2 class="text-xs font-mono font-bold tracking-wider text-[var(--text-primary)] uppercase">
          {{ category.name }}
        </h2>
        <span class="text-xs font-mono text-[var(--text-tertiary)]">
          {{ category.tools.length }}
        </span>
      </div>

      <span v-if="category.description" class="hidden sm:inline text-xs text-[var(--text-tertiary)]">
        {{ category.description }}
      </span>
    </div>

    <!-- Cards Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5">
      <ToolCard
        v-for="tool in category.tools"
        :key="tool.id"
        :tool="tool"
      />
    </div>
  </section>
</template>
