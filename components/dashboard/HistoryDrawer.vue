<script setup lang="ts">
import { useHistory } from '~/composables/useHistory'
import { useClipboard } from '~/composables/useClipboard'
import { useI18n } from '~/composables/useI18n'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

interface Props {
  isOpen: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select-url', url: string): void
}>()

const { history, remove, clear } = useHistory()
const { copy } = useClipboard()
const { t } = useI18n()

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const handleSelect = (url: string) => {
  emit('select-url', url)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div>
      <!-- Backdrop -->
      <Transition
        enter-active-class="transition-opacity duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isOpen"
          class="fixed inset-0 bg-black/60 backdrop-blur-xs z-50"
          @click="emit('close')"
        />
      </Transition>

      <!-- Slide-over Drawer Panel -->
      <aside
        class="fixed top-0 bottom-0 right-0 z-50 w-full max-w-md bg-[var(--bg-sidebar)] border-l border-[var(--border-subtle)] flex flex-col shadow-[-16px_0_48px_rgba(0,0,0,0.5)] transition-transform duration-200 ease-in-out transform"
        :class="isOpen ? 'translate-x-0' : 'translate-x-full'"
      >
        <!-- Header -->
        <div class="h-14 px-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-semibold text-[var(--text-primary)]">
              {{ t.recentDownloads }}
            </h3>
            <Badge variant="secondary" size="sm">{{ history.length }}</Badge>
          </div>
          <button
            type="button"
            class="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-md cursor-pointer"
            @click="emit('close')"
          >
            ✕
          </button>
        </div>

        <!-- History List -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          <div
            v-if="history.length === 0"
            class="py-16 text-center text-xs text-[var(--text-tertiary)]"
          >
            <p>{{ t.noHistory }}</p>
            <p class="mt-1 text-[11px]">{{ t.noHistoryDesc }}</p>
          </div>

          <div
            v-for="item in history"
            :key="item.id"
            class="p-3.5 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[12px] hover:border-[var(--border-card-hover)] transition-all space-y-2.5"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-start gap-2.5 overflow-hidden">
                <div
                  v-if="item.thumbnail"
                  class="w-10 h-10 rounded-md bg-black/40 overflow-hidden shrink-0 border border-[var(--border-subtle)]"
                >
                  <img :src="item.thumbnail" :alt="item.title" loading="lazy" decoding="async" class="w-full h-full object-cover" />
                </div>
                <div class="overflow-hidden">
                  <div class="text-xs font-semibold text-[var(--text-primary)] truncate">
                    {{ item.title }}
                  </div>
                  <div class="text-[11px] text-[var(--text-tertiary)] font-mono">
                    {{ formatDate(item.timestamp) }}
                  </div>
                </div>
              </div>
              <Badge variant="secondary" size="sm">{{ item.platform }}</Badge>
            </div>

            <!-- Actions -->
            <div class="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)] gap-2">
              <span class="text-[11px] text-[var(--text-secondary)] font-mono truncate max-w-[140px]">
                {{ item.url }}
              </span>
              <div class="flex items-center gap-1.5 shrink-0">
                <Button size="sm" variant="ghost" @click="copy(item.url, 'Link')">
                  Copy
                </Button>
                <Button size="sm" variant="secondary" @click="handleSelect(item.url)">
                  Open
                </Button>
                <button
                  type="button"
                  class="p-1 text-[var(--text-tertiary)] hover:text-[#EF4444] transition-colors cursor-pointer"
                  title="Remove item"
                  @click="remove(item.id)"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div v-if="history.length > 0" class="p-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
          <Button size="sm" variant="ghost" @click="clear">
            {{ t.clearHistory }}
          </Button>
          <span class="text-[11px] text-[var(--text-tertiary)] font-mono">localStorage</span>
        </div>
      </aside>
    </div>
  </Teleport>
</template>
