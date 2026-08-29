<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

interface Props {
  modelValue?: number
  currentPage?: number
  totalPages: number
  disabled?: boolean
  showPrevNext?: boolean
  prevText?: string
  nextText?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: 1,
  currentPage: undefined,
  disabled: false,
  showPrevNext: true,
  prevText: 'Prev',
  nextText: 'Next',
})

const emit = defineEmits<{
  (e: 'update:modelValue', page: number): void
  (e: 'change', page: number): void
}>()

const activePage = computed(() => {
  return props.currentPage !== undefined ? props.currentPage : props.modelValue
})

const paginationRange = computed(() => {
  const current = activePage.value
  const total = Math.max(props.totalPages, 1)

  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  if (current <= 3) {
    return [1, 2, 3, '...', total]
  }

  if (current >= total - 2) {
    return [1, '...', total - 2, total - 1, total]
  }

  return [1, '...', current - 1, current, current + 1, '...', total]
})

const setPage = (page: number | string) => {
  if (props.disabled) return
  if (typeof page === 'string') return

  if (page < 1 || page > props.totalPages || page === activePage.value) return

  emit('update:modelValue', page)
  emit('change', page)
}
</script>

<template>
  <nav
    v-if="totalPages > 1"
    class="inline-flex items-center gap-1.5 p-1.5 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl shadow-xs select-none"
    aria-label="Pagination Navigation"
  >
    <!-- Previous Button -->
    <button
      v-if="showPrevNext"
      type="button"
      :disabled="activePage <= 1 || disabled"
      class="px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--text-primary)] bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs flex items-center gap-1"
      aria-label="Previous Page"
      @click="setPage(activePage - 1)"
    >
      <ChevronLeft class="w-3.5 h-3.5" />
      <span>{{ prevText }}</span>
    </button>

    <!-- Page Number Buttons & Ellipsis -->
    <template v-for="(item, idx) in paginationRange" :key="idx">
      <span
        v-if="item === '...'"
        class="w-7 h-7 flex items-center justify-center text-xs text-[var(--text-tertiary)] font-mono select-none"
        aria-hidden="true"
      >
        ...
      </span>

      <button
        v-else
        type="button"
        :disabled="disabled"
        class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold transition-all cursor-pointer"
        :class="
          activePage === item
            ? 'bg-[#1E1E1E] text-white dark:bg-white dark:text-black shadow-xs font-bold'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
        "
        :aria-current="activePage === item ? 'page' : undefined"
        @click="setPage(item)"
      >
        {{ item }}
      </button>
    </template>

    <!-- Next Button -->
    <button
      v-if="showPrevNext"
      type="button"
      :disabled="activePage >= totalPages || disabled"
      class="px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--text-primary)] bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs flex items-center gap-1"
      aria-label="Next Page"
      @click="setPage(activePage + 1)"
    >
      <span>{{ nextText }}</span>
      <ChevronRight class="w-3.5 h-3.5" />
    </button>
  </nav>
</template>
