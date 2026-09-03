<script setup lang="ts">
import { ref, computed } from 'vue'
import { detectPlatform } from '~/server/utils/sanitizer'
import { useI18n } from '~/composables/useI18n'
import Button from '~/components/ui/Button.vue'
import BrandIcon from '~/components/ui/BrandIcon.vue'
import { Zap, Layers, Trash2, Clipboard, ArrowRight } from 'lucide-vue-next'

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

const pasteFromClipboard = async () => {
  try {
    const text = await navigator.clipboard.readText()
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
      emit('update:modelValue', text.trim())
      emit('submit')
    }
  } catch {
    // Clipboard permission denied
  }
}

const submitBatch = () => {
  const urls = detectedBatchUrls.value
  if (urls.length === 0) return
  emit('submit-batch', urls)
  batchText.value = ''
}
</script>

<template>
  <div class="w-full space-y-2.5">
    <!-- Header Mode Switcher Tabs (Placed Above Card) -->
    <div class="flex items-center justify-between px-1">
      <div class="flex items-center bg-[#171717] border border-[#262626] rounded-lg p-0.5">
        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
          :class="mode === 'single' ? 'bg-[#2E2E2E] text-white shadow-xs' : 'text-neutral-400 hover:text-white'"
          @click="mode = 'single'"
        >
          <Zap class="w-3.5 h-3.5" />
          <span>Single Link</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
          :class="mode === 'batch' ? 'bg-[#2E2E2E] text-white shadow-xs' : 'text-neutral-400 hover:text-white'"
          @click="mode = 'batch'"
        >
          <Layers class="w-3.5 h-3.5" />
          <span>Batch Queue</span>
          <span v-if="detectedBatchUrls.length > 0" class="px-1.5 py-0.2 rounded-full text-[10px] bg-white text-black font-bold">
            {{ detectedBatchUrls.length }}
          </span>
        </button>
      </div>

      <span class="text-xs text-neutral-500 font-mono hidden sm:inline">
        {{ mode === 'single' ? 'Auto-detects platform' : 'Process up to 20 links' }}
      </span>
    </div>

    <!-- Main Card -->
    <div class="w-full bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[14px] p-4 sm:p-5 shadow-[0_4px_24px_rgba(0,0,0,0.15)] transition-all space-y-3.5">
      <!-- Mode 1: Single Link Input -->
      <div v-if="mode === 'single'" class="flex flex-col sm:flex-row items-center gap-3">
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
          :value="modelValue"
          type="url"
          :placeholder="t.pastePlaceholder"
          class="w-full h-12 pl-10 pr-20 bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-lg text-sm transition-all focus:outline-none focus:border-white focus:ring-2 focus:ring-white/10 disabled:opacity-50"
          :disabled="loading"
          @input="handleSingleInput"
          @keydown.enter="emit('submit')"
        />

        <!-- Paste Action Button -->
        <button
          type="button"
          title="Paste from Clipboard"
          class="absolute right-3 p-1 text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
          @click="pasteFromClipboard"
        >
          <Clipboard class="w-4 h-4" />
        </button>
      </div>

      <!-- Submit Trigger -->
      <Button
        variant="primary"
        size="lg"
        class="w-full sm:w-auto shrink-0 font-semibold px-6"
        :loading="loading"
        @click="emit('submit')"
      >
        {{ t.download }}
      </Button>
    </div>

    <!-- Mode 2: Batch Queue Multi-line Input -->
    <div v-else class="space-y-3">
      <div class="relative">
        <textarea
          v-model="batchText"
          rows="4"
          placeholder="Paste multiple social media links here, separated by new lines...&#10;https://www.tiktok.com/@user/video/...&#10;https://www.instagram.com/reel/...&#10;https://youtu.be/..."
          class="w-full p-3.5 pr-14 bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-lg text-xs font-mono transition-all focus:outline-none focus:border-white focus:ring-2 focus:ring-white/10"
        />

        <div class="absolute right-2.5 bottom-2.5 flex items-center gap-1">
          <button
            v-if="batchText"
            type="button"
            class="p-1.5 text-neutral-400 hover:text-red-400 cursor-pointer flex items-center justify-center transition-colors"
            title="Clear input"
            @click="batchText = ''"
          >
            <Trash2 class="w-4 h-4" />
          </button>

          <button
            type="button"
            class="p-1.5 text-neutral-400 hover:text-white cursor-pointer flex items-center justify-center transition-colors"
            title="Paste Clipboard"
            @click="pasteFromClipboard"
          >
            <Clipboard class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div class="text-xs font-mono text-[var(--text-secondary)]">
          <span v-if="detectedBatchUrls.length > 0" class="text-white font-semibold">
            {{ detectedBatchUrls.length }} link(s) detected and ready to queue
          </span>
          <span v-else class="text-neutral-500">
            Enter 1 or more URLs on separate lines
          </span>
        </div>

        <Button
          variant="primary"
          size="default"
          class="font-semibold px-5"
          :disabled="detectedBatchUrls.length === 0"
          @click="submitBatch"
        >
          <span>Start Batch Queue ({{ detectedBatchUrls.length }})</span>
          <ArrowRight class="w-3.5 h-3.5 ml-1.5" />
        </Button>
      </div>
    </div>

    <!-- Supported Platform Tags -->
    <div class="pt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] font-mono">
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
      <span class="hover:text-[var(--text-secondary)]">TeraBox</span>
    </div>
  </div>
  </div>
</template>
