<script setup lang="ts">
import { useRouter } from 'vue-router'
import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
import { useSearch } from '~/composables/useSearch'
import { useI18n } from '~/composables/useI18n'
import Badge from '~/components/ui/Badge.vue'
import BrandIcon from '~/components/ui/BrandIcon.vue'

interface Props {
  isOpen: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
}>()

const router = useRouter()
const { searchQuery, allTools } = useSearch()
const { t } = useI18n()
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

const filteredList = computed(() => {
  if (!searchQuery.value.trim()) return allTools.value
  const q = searchQuery.value.toLowerCase()
  return allTools.value.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
  )
})

const navigateToTool = (route: string) => {
  emit('close')
  searchQuery.value = ''
  router.push(route)
}

const handleKeydown = (e: KeyboardEvent) => {
  if (!props.isOpen) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = (selectedIndex.value + 1) % (filteredList.value.length || 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value =
      (selectedIndex.value - 1 + filteredList.value.length) % (filteredList.value.length || 1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const target = filteredList.value[selectedIndex.value]
    if (target) {
      navigateToTool(target.route)
    }
  } else if (e.key === 'Escape') {
    emit('close')
  }
}

watch(
  () => props.isOpen,
  (val) => {
    if (val) {
      selectedIndex.value = 0
      setTimeout(() => {
        inputRef.value?.focus()
      }, 50)
    }
  }
)

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeydown)
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-start justify-center p-4 sm:pt-20"
      >
        <!-- Backdrop -->
        <div
          class="fixed inset-0 bg-black/75 backdrop-blur-sm"
          @click="emit('close')"
        />

        <!-- Command Dialog -->
        <div
          class="relative w-full max-w-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-card)] rounded-[14px] shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden z-10 flex flex-col max-h-[75vh]"
        >
          <!-- Search Input Bar -->
          <div class="flex items-center px-4 py-3.5 border-b border-[var(--border-subtle)] gap-3">
            <svg class="w-4 h-4 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref="inputRef"
              v-model="searchQuery"
              type="text"
              :placeholder="t.searchPlaceholder"
              class="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none"
            />
            <kbd class="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded text-[var(--text-tertiary)]">ESC</kbd>
          </div>

          <!-- Tool Results List -->
          <div class="p-2 overflow-y-auto flex-1 space-y-1">
            <div
              v-if="filteredList.length === 0"
              class="py-12 text-center text-xs text-[var(--text-tertiary)]"
            >
              {{ t.noResults }}
            </div>

            <div
              v-for="(tool, index) in filteredList"
              :key="tool.id"
              class="flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-colors cursor-pointer"
              :class="
                index === selectedIndex
                  ? 'bg-[#2E2E2E] text-white border border-[#404040]'
                  : 'hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] border border-transparent'
              "
              @click="navigateToTool(tool.route)"
              @mouseenter="selectedIndex = index"
            >
              <div class="flex items-center gap-3">
                <div class="w-7 h-7 rounded-md bg-[var(--bg-card)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)]">
                  <BrandIcon :name="tool.icon" :size="15" />
                </div>
                <div>
                  <div class="font-medium text-[var(--text-primary)]">
                    {{ tool.title }}
                  </div>
                  <div class="text-[11px] text-[var(--text-secondary)] truncate max-w-sm">
                    {{ tool.description }}
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <Badge v-if="tool.badge" size="sm" :variant="tool.badge === 'HD' ? 'primary' : 'secondary'">
                  {{ tool.badge }}
                </Badge>
                <span class="text-[10px] font-mono uppercase text-[var(--text-tertiary)]">
                  {{ tool.category }}
                </span>
              </div>
            </div>
          </div>

          <!-- Footer Hints -->
          <div class="px-4 py-2 bg-[var(--bg-card)] border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-tertiary)] font-mono">
            <div class="flex items-center gap-3">
              <span>↑↓ Navigate</span>
              <span>↵ Open</span>
            </div>
            <span>{{ filteredList.length }} tools</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
