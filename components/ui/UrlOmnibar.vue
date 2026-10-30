<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Globe,
  Xmark as X,
  PasteClipboard as Clipboard,
  Clock,
} from '@iconoir/vue'
import { onClickOutside } from '@vueuse/core'
import { useUrlHistory } from '~/composables/useUrlHistory'
import { useToast } from '~/composables/useToast'
import { useI18n } from '~/composables/useI18n'
import Button from '~/components/ui/Button.vue'

interface Props {
  modelValue: string
  placeholder?: string
  loading?: boolean
  disabled?: boolean
  type?: string
  storageKey?: string
  submitText?: string
  submitIcon?: any
  id?: string
  autoFocus?: boolean
  autoSubmitOnSelect?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'https://example.com or paste target URL...',
  loading: false,
  disabled: false,
  type: 'text',
  storageKey: 'avttr_url_history',
  submitText: '',
  submitIcon: undefined,
  id: 'omnibar-url-input',
  autoFocus: false,
  autoSubmitOnSelect: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'submit', value: string): void
  (e: 'clear'): void
  (e: 'paste', value: string): void
}>()

const toast = useToast()
const { locale } = useI18n()
const {
  history: urlHistoryList,
  add: addUrlHistory,
  remove: removeUrlHistory,
  clear: clearUrlHistory,
} = useUrlHistory(props.storageKey)

const isHistoryOpen = ref(false)
const omnibarWrapperRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

onClickOutside(omnibarWrapperRef, () => {
  isHistoryOpen.value = false
})

const filteredHistory = computed(() => {
  const list = Array.isArray(urlHistoryList.value) ? urlHistoryList.value : []
  if (!props.modelValue?.trim()) return list
  const query = props.modelValue.toLowerCase().trim()
  return list.filter((u) => u && u.toLowerCase().includes(query))
})

const handleInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

const handlePaste = async () => {
  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      const trimmed = text.trim()
      emit('update:modelValue', trimmed)
      emit('paste', trimmed)
      toast.success(
        locale.value === 'id' ? 'Link Ditempel' : 'Link Pasted',
        trimmed
      )
    }
  } catch {
    toast.error(
      locale.value === 'id' ? 'Gagal Menempel' : 'Paste Failed',
      locale.value === 'id' ? 'Izin clipboard ditolak browser' : 'Clipboard permission denied'
    )
  }
}

const handleClear = () => {
  emit('update:modelValue', '')
  emit('clear')
  inputRef.value?.focus()
}

const selectHistoryUrl = (url: string) => {
  emit('update:modelValue', url)
  isHistoryOpen.value = false
  if (props.autoSubmitOnSelect) {
    triggerSubmit(url)
  }
}

const triggerSubmit = (overrideVal?: string) => {
  const val = (overrideVal || props.modelValue || '').trim()
  if (!val || props.disabled || props.loading) return
  isHistoryOpen.value = false
  addUrlHistory(val)
  emit('submit', val)
}

defineExpose({
  add: addUrlHistory,
  clear: clearUrlHistory,
  focus: () => inputRef.value?.focus(),
})
</script>

<template>
  <div class="w-full">
    <div class="flex flex-col sm:flex-row items-center gap-2.5 w-full">
      <!-- Input Wrapper Container with History Popover Ref -->
      <div ref="omnibarWrapperRef" class="relative flex-1 w-full">
        <div class="relative flex items-center w-full">
          <!-- Leading Slot / Icon -->
          <div class="absolute left-3.5 flex items-center justify-center pointer-events-none text-[var(--text-tertiary)]">
            <slot name="leading">
              <Globe class="w-4 h-4" />
            </slot>
          </div>

          <!-- Main Input Field -->
          <input
            :id="id"
            ref="inputRef"
            :value="modelValue"
            :type="type"
            autocomplete="off"
            :placeholder="placeholder"
            :autofocus="autoFocus"
            class="w-full h-12 pl-10 pr-20 bg-white dark:bg-[#171717] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] border border-zinc-200 dark:border-[#2E2E2E] focus:border-zinc-400 dark:focus:border-white/40 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 disabled:opacity-50 shadow-xs font-mono"
            :disabled="disabled || loading"
            @input="handleInput"
            @focus="isHistoryOpen = true"
            @click="isHistoryOpen = true"
            @keydown.enter="triggerSubmit()"
            @keydown.esc="isHistoryOpen = false"
          />

          <!-- Trailing Utility Micro-Actions -->
          <div class="absolute right-2.5 flex items-center gap-1">
            <slot name="actions" />

            <button
              v-if="modelValue"
              :id="`${id}-clear`"
              type="button"
              class="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md transition-colors cursor-pointer"
              title="Clear"
              @click="handleClear"
            >
              <X class="w-4 h-4" />
            </button>
            <button
              v-else
              :id="`${id}-paste`"
              type="button"
              class="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md transition-colors cursor-pointer"
              title="Paste from clipboard"
              @click="handlePaste"
            >
              <Clipboard class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- History Dropdown Popover -->
        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="transform opacity-0 -translate-y-1 scale-98"
          enter-to-class="transform opacity-100 translate-y-0 scale-100"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="transform opacity-100 translate-y-0 scale-100"
          leave-to-class="transform opacity-0 -translate-y-1 scale-98"
        >
          <div
            v-if="isHistoryOpen && filteredHistory.length > 0"
            class="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl bg-white dark:bg-[#1E1E20] border border-zinc-200 dark:border-[#2E2E2E] shadow-xl overflow-hidden py-1 max-h-72 overflow-y-auto"
          >
            <div
              v-for="item in filteredHistory"
              :key="item"
              class="group px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-zinc-100 dark:hover:bg-[#28282A] cursor-pointer transition-colors"
              @mousedown.prevent="selectHistoryUrl(item)"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <Clock class="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors" />
                <span class="text-xs font-mono text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors truncate">
                  {{ item }}
                </span>
              </div>

              <!-- Delete single entry from history -->
              <button
                type="button"
                title="Remove from history"
                class="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-rose-500 transition-all rounded shrink-0 cursor-pointer"
                @mousedown.stop.prevent="removeUrlHistory(item)"
              >
                <X class="w-3.5 h-3.5" />
              </button>
            </div>

            <!-- Popover Footer: Clear All -->
            <div class="pt-1 mt-1 border-t border-zinc-100 dark:border-[#28282A] px-3.5 py-1.5 flex items-center justify-between text-[11px] font-mono text-[var(--text-tertiary)]">
              <span>{{ locale === 'id' ? 'Riwayat Terakhir' : 'Recent URLs' }}</span>
              <button
                type="button"
                class="hover:text-rose-500 transition-colors cursor-pointer text-[10px]"
                @mousedown.stop.prevent="clearUrlHistory"
              >
                {{ locale === 'id' ? 'Hapus Semua' : 'Clear All' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Submit Action Button (Customizable via Props or Slot) -->
      <slot name="submit" :submit="triggerSubmit" :loading="loading" :disabled="disabled || !modelValue.trim()">
        <Button
          v-if="submitText"
          :id="`${id}-submit`"
          variant="primary"
          size="default"
          class="w-full sm:w-auto shrink-0 h-12 px-5 rounded-xl font-medium text-xs sm:text-sm cursor-pointer"
          :loading="loading"
          :disabled="disabled || loading || !modelValue.trim()"
          @click="triggerSubmit()"
        >
          <component :is="submitIcon" v-if="submitIcon && !loading" class="w-4 h-4 mr-2" />
          <span>{{ submitText }}</span>
        </Button>
      </slot>
    </div>
  </div>
</template>
