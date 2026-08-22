<script setup lang="ts">
import type { ToolItem } from '~/types'
import BrandIcon from '~/components/ui/BrandIcon.vue'

interface Props {
  tool: ToolItem
}

defineProps<Props>()
</script>

<template>
  <NuxtLink
    :to="tool.route"
    class="group block bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[14px] p-5 hover:border-[var(--border-card-hover)] hover:bg-[var(--bg-card-hover)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all duration-150 ease-in-out relative overflow-hidden"
  >
    <div class="flex items-start gap-3.5">
      <!-- Icon Container -->
      <div class="w-10 h-10 rounded-lg bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] group-hover:border-[var(--border-card-hover)] group-hover:bg-[var(--bg-surface-elevated)] flex items-center justify-center text-[var(--text-primary)] transition-all shrink-0">
        <BrandIcon :name="tool.icon" :size="20" />
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <h3 class="text-sm font-semibold text-[var(--text-primary)] group-hover:text-white transition-colors truncate">
          {{ tool.title }}
        </h3>

        <p class="mt-1.5 text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-2">
          {{ tool.description }}
        </p>
      </div>
    </div>
  </NuxtLink>
</template>
