<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { detectPlatform } from '~/server/utils/sanitizer'
import { useI18n } from '~/composables/useI18n'
import Button from '~/components/ui/Button.vue'
import BrandIcon from '~/components/ui/BrandIcon.vue'
import { Zap, Layers, Trash2, Clipboard, ArrowRight, X } from 'lucide-vue-next'

interface Props {
  modelValue: string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'submit'): void
  (e: 'submit-batch', urls: string[]): void
}>()

const { t } = useI18n()

// Template Refs for Focus
const singleInputRef = ref<HTMLInputElement | null>(null)
const batchTextareaRef = ref<HTMLTextAreaElement | null>(null)

// Mode Switcher: Single vs Batch Queue
const mode = ref<'single' | 'batch'>('single')
const batchText = ref('')

const extractUrls = (text: string): string[] => {
  if (!text) return []
  const urlRegex = /(https?:\/\/[^\s,]+)/g
  const matches = text.match(urlRegex) || []
  return Array.from(new Set(matches.map(u => u.trim())))
}

const detectedBatchUrls = computed(() => extractUrls(batchText.value))

const platform = computed(() => {
  if (!props.modelValue) return null
  const p = detectPlatform(props.modelValue)
  return p !== 'other' ? p : null
})

const handleSingleInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value
  const found = extractUrls(val)
  // If user pasted multiple URLs in single box, switch automatically to batch mode
  if (found.length > 1) {
    batchText.value = val
    mode.value = 'batch'
    emit('update:modelValue', '')
    return
  }
  emit('update:modelValue', val)
}

const applyPastedText = (text: string) => {
  if (!text) return

  const urls = extractUrls(text)
  if (urls.length > 1) {
    batchText.value = text.trim()
    mode.value = 'batch'
    emit('update:modelValue', '')
  } else if (urls.length === 1) {
    if (mode.value === 'batch') {
      batchText.value = batchText.value ? `${batchText.value}\n${urls[0]}` : urls[0]
    } else {
      emit('update:modelValue', urls[0])
      emit('submit')
    }
  } else if (text.trim()) {
    if (mode.value === 'batch') {
      batchText.value = batchText.value ? `${batchText.value}\n${text.trim()}` : text.trim()
    } else {
      emit('update:modelValue', text.trim())
      emit('submit')
    }
  }
}

const pasteFromClipboard = async () => {
  if (mode.value === 'single') {
    singleInputRef.value?.focus()
  } else {
    batchTextareaRef.value?.focus()
  }

  try {
    const text = await navigator.clipboard.readText()
    applyPastedText(text)
  } catch {
    // Kept focused so user can press Ctrl+V directly if browser blocks readText
  }
}

// Global Keyboard Paste Listener (Ctrl+V anywhere on page)
const handleGlobalPaste = (event: ClipboardEvent) => {
  const target = event.target as HTMLElement
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && target !== singleInputRef.value && target !== batchTextareaRef.value) {
    return
  }

  const text = event.clipboardData?.getData('text')
  if (text) {
    applyPastedText(text)
    event.preventDefault()
  }
}

onMounted(() => {
  window.addEventListener('paste', handleGlobalPaste)
})

onUnmounted(() => {
  window.removeEventListener('paste', handleGlobalPaste)
})

const clearInput = () => {
  emit('update:modelValue', '')
  singleInputRef.value?.focus()
}

const submitBatch = () => {
  const urls = detectedBatchUrls.value
  if (urls.length === 0) return
  emit('submit-batch', urls)
  batchText.value = ''
}
</script>

<template>
  <div class="w-full space-y-3">
    <!-- Header Mode Switcher Tabs -->
    <div class="flex items-center px-0.5">
      <div class="flex items-center bg-zinc-200/60 dark:bg-[#171717] border border-zinc-200 dark:border-[#262626] rounded-lg p-0.5">
        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
          :class="mode === 'single' ? 'bg-white dark:bg-[#2E2E2E] text-zinc-900 dark:text-white shadow-xs font-semibold' : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'"
          @click="mode = 'single'"
        >
          <Zap class="w-3.5 h-3.5" />
          <span>Single Link</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
          :class="mode === 'batch' ? 'bg-white dark:bg-[#2E2E2E] text-zinc-900 dark:text-white shadow-xs font-semibold' : 'text-zinc-600 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white'"
          @click="mode = 'batch'"
        >
          <Layers class="w-3.5 h-3.5" />
          <span>Batch Queue</span>
          <span v-if="detectedBatchUrls.length > 0" class="px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--primary)] text-[var(--primary-foreground)] font-bold">
            {{ detectedBatchUrls.length }}
          </span>
        </button>
      </div>
    </div>

    <!-- Mode 1: Single Link Input -->
    <div v-if="mode === 'single'" class="flex flex-col sm:flex-row items-center gap-2.5">
      <!-- Input Wrapper -->
      <div class="relative w-full flex-1 flex items-center">
        <!-- Platform Icon or Link Icon -->
        <div class="absolute left-3.5 flex items-center justify-center pointer-events-none text-[var(--text-primary)]">
          <BrandIcon v-if="platform" :name="platform" :size="18" />
          <svg v-else class="w-4 h-4 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>

        <input
          ref="singleInputRef"
          :value="modelValue"
          type="url"
          :placeholder="t.pastePlaceholder"
          class="w-full h-12 pl-10 bg-white dark:bg-[#171717] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] border border-zinc-200 dark:border-[#2E2E2E] focus:border-zinc-400 dark:focus:border-white/40 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 disabled:opacity-50 shadow-xs"
          :class="modelValue ? 'pr-20' : 'pr-12'"
          :disabled="loading"
          @input="handleSingleInput"
          @keydown.enter="emit('submit')"
        />

        <!-- Action Buttons Container (Right) -->
        <div class="absolute right-2.5 flex items-center gap-1">
          <!-- Clear Button (X) -->
          <button
            v-if="modelValue"
            type="button"
            title="Clear input"
            aria-label="Clear input"
            class="p-1.5 text-zinc-400 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-95"
            @click="clearInput"
          >
            <X class="w-4 h-4" />
          </button>

          <!-- Paste Action Button -->
          <button
            type="button"
            title="Paste from Clipboard"
            aria-label="Paste from clipboard"
            class="p-1.5 text-zinc-400 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-95"
            @click="pasteFromClipboard"
          >
            <Clipboard class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Submit Trigger -->
      <Button
        variant="primary"
        size="default"
        class="w-full sm:w-auto shrink-0 h-12 px-5 rounded-xl font-medium text-xs sm:text-sm cursor-pointer"
        :loading="loading"
        @click="emit('submit')"
      >
        <ArrowRight class="w-3.5 h-3.5 mr-1.5" />
        <span>{{ t.download }}</span>
      </Button>
    </div>

    <!-- Mode 2: Batch Queue Multi-line Input -->
    <div v-else class="space-y-3">
      <div class="relative">
        <textarea
          ref="batchTextareaRef"
          v-model="batchText"
          rows="4"
          placeholder="Paste multiple social media links here, separated by new lines...&#10;https://www.tiktok.com/@user/video/...&#10;https://www.instagram.com/reel/...&#10;https://youtu.be/..."
          class="w-full p-4 pr-16 bg-white dark:bg-[#171717] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] border border-zinc-200 dark:border-[#2E2E2E] focus:border-zinc-400 dark:focus:border-white/40 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-xl text-xs font-mono transition-all focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 shadow-xs"
        />

        <div class="absolute right-2.5 bottom-3 flex items-center gap-1">
          <button
            v-if="batchText"
            type="button"
            class="p-1.5 text-zinc-400 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer flex items-center justify-center transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-95"
            title="Clear input"
            aria-label="Clear input"
            @click="batchText = ''"
          >
            <X class="w-4 h-4" />
          </button>

          <button
            type="button"
            class="p-1.5 text-zinc-400 dark:text-neutral-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer flex items-center justify-center transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-95"
            title="Paste Clipboard"
            aria-label="Paste from clipboard"
            @click="pasteFromClipboard"
          >
            <Clipboard class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="text-xs font-mono text-[var(--text-secondary)]">
          <span v-if="detectedBatchUrls.length > 0" class="text-[var(--text-primary)] font-semibold">
            {{ detectedBatchUrls.length }} link(s) detected and ready to queue
          </span>
          <span v-else class="text-[var(--text-tertiary)]">
            Enter 1 or more URLs on separate lines
          </span>
        </div>

        <Button
          variant="primary"
          size="default"
          class="font-medium px-5 h-10 rounded-xl cursor-pointer"
          :disabled="detectedBatchUrls.length === 0"
          @click="submitBatch"
        >
          <ArrowRight class="w-3.5 h-3.5 mr-1.5" />
          <span>Start Batch Queue ({{ detectedBatchUrls.length }})</span>
        </Button>
      </div>
    </div>

    <!-- Supported Platform Tags -->
    <div class="pt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] font-mono px-0.5">
      <span>Supported:</span>
      <span class="hover:text-[var(--text-secondary)]">TikTok (No WM)</span>
      <span>•</span>
      <span class="hover:text-[var(--text-secondary)]">Instagram Reels & Photos</span>
      <span>•</span>
      <span class="hover:text-[var(--text-secondary)]">YouTube 1080p & MP3</span>
      <span>•</span>
      <span class="hover:text-[var(--text-secondary)]">Twitter/X</span>
      <span>•</span>
      <span class="hover:text-[var(--text-secondary)]">CapCut</span>
      <span>•</span>
      <span class="hover:text-[var(--text-secondary)]">Spotify</span>
      <span>•</span>
      <span class="hover:text-[var(--text-secondary)]">SoundCloud</span>
      <span>•</span>
      <span class="hover:text-[var(--text-secondary)]">TeraBox</span>
    </div>
  </div>
</template>
