<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Download,
  RotateCcw,
  Trash2,
  Archive,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  ExternalLink,
  Layers,
  X,
  Clock,
  Sparkles
} from 'lucide-vue-next'
import type { MediaItem } from '~/types'
import { useBatchDownloader, type BatchQueueItem } from '~/composables/useBatchDownloader'
import Modal from '~/components/ui/Modal.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'
import BrandIcon from '~/components/ui/BrandIcon.vue'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const {
  queue,
  isProcessing,
  isZipping,
  zipProgress,
  totalCount,
  readyCount,
  errorCount,
  resolvingCount,
  pendingCount,
  overallProgress,
  addUrls,
  startProcessing,
  retryItem,
  retryAllFailed,
  removeItem,
  clearQueue,
  downloadAllAsZip,
  downloadSingleItem
} = useBatchDownloader()

// Filter State
type FilterTab = 'all' | 'ready' | 'resolving' | 'error'
const activeTab = ref<FilterTab>('all')

const filteredQueue = computed(() => {
  if (activeTab.value === 'ready') return queue.value.filter(i => i.status === 'ready')
  if (activeTab.value === 'resolving') return queue.value.filter(i => i.status === 'resolving' || i.status === 'pending')
  if (activeTab.value === 'error') return queue.value.filter(i => i.status === 'error')
  return queue.value
})

// Add more links input in modal
const showAddInput = ref(false)
const newLinksText = ref('')

const handleAddMoreLinks = () => {
  if (!newLinksText.value.trim()) return
  const count = addUrls(newLinksText.value)
  newLinksText.value = ''
  showAddInput.value = false
  if (count > 0 && !isProcessing.value) {
    startProcessing()
  }
}

const getPlatformColor = (platform: string) => {
  switch (platform) {
    case 'tiktok': return 'text-[#FE2C55]'
    case 'instagram': return 'text-[#E1306C]'
    case 'youtube': return 'text-[#FF0000]'
    case 'twitter': return 'text-[#1DA1F2]'
    case 'capcut': return 'text-[#00C4CC]'
    case 'spotify': return 'text-[#1DB954]'
    case 'facebook': return 'text-[#1877F2]'
    default: return 'text-[var(--text-secondary)]'
  }
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    size="2xl"
    :title="`Batch Downloader Queue (${totalCount})`"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="space-y-4">
      <!-- Top Status & Progress Bar -->
      <div class="p-3.5 sm:p-4 rounded-xl bg-[#141416] border border-[#262626] space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="text-xs font-mono font-bold uppercase tracking-wider text-white">Queue Progress</span>
              <span class="text-xs font-mono text-[var(--text-tertiary)]">
                {{ overallProgress }}% Complete
              </span>
            </div>
            <div class="flex items-center gap-2 text-xs font-mono text-[var(--text-secondary)]">
              <span class="text-emerald-400 font-semibold">{{ readyCount }} Ready</span>
              <span>•</span>
              <span v-if="resolvingCount > 0" class="text-amber-400 font-semibold">{{ resolvingCount }} Processing</span>
              <span v-if="resolvingCount > 0">•</span>
              <span v-if="errorCount > 0" class="text-rose-400 font-semibold">{{ errorCount }} Failed</span>
              <span v-if="errorCount > 0">•</span>
              <span>{{ totalCount }} Total</span>
            </div>
          </div>

          <!-- Top Actions -->
          <div class="flex items-center gap-2 shrink-0">
            <!-- Retry Failed Button -->
            <button
              v-if="errorCount > 0"
              type="button"
              class="px-2.5 py-1.5 rounded-lg bg-[#222226] hover:bg-[#2c2c32] border border-white/10 text-xs font-medium text-white transition-all cursor-pointer flex items-center gap-1.5"
              @click="retryAllFailed"
            >
              <RotateCcw class="w-3.5 h-3.5 text-amber-400" />
              <span>Retry ({{ errorCount }})</span>
            </button>

            <!-- Add More Links Button -->
            <button
              type="button"
              class="px-2.5 py-1.5 rounded-lg bg-[#222226] hover:bg-[#2c2c32] border border-white/10 text-xs font-medium text-white transition-all cursor-pointer flex items-center gap-1.5"
              @click="showAddInput = !showAddInput"
            >
              <Plus class="w-3.5 h-3.5 text-white/80" />
              <span>Add Links</span>
            </button>

            <!-- Download All as ZIP -->
            <Button
              variant="primary"
              size="sm"
              class="font-semibold shadow-xs"
              :disabled="readyCount === 0 || isZipping"
              :loading="isZipping"
              @click="downloadAllAsZip"
            >
              <Archive class="w-3.5 h-3.5 mr-1.5" />
              <span>{{ isZipping ? `Zipping ${zipProgress}%` : `Download ZIP (${readyCount})` }}</span>
            </Button>
          </div>
        </div>

        <!-- Linear Progress Bar -->
        <div class="w-full h-1.5 bg-[#262626] rounded-full overflow-hidden">
          <div
            class="h-full bg-white transition-all duration-300"
            :style="{ width: `${overallProgress}%` }"
          />
        </div>
      </div>

      <!-- Add More Links Form (Collapsible) -->
      <div v-if="showAddInput" class="p-3.5 rounded-xl bg-[#141416] border border-[#262626] space-y-2.5">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-white">Paste additional social media links (separated by newlines)</span>
          <button type="button" class="text-neutral-500 hover:text-white" @click="showAddInput = false">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
        <textarea
          v-model="newLinksText"
          rows="3"
          placeholder="https://www.tiktok.com/...&#10;https://www.instagram.com/reel/...&#10;https://youtu.be/..."
          class="w-full p-2.5 rounded-lg bg-[#0e0e10] border border-[#262626] text-xs font-mono text-white placeholder-neutral-500 focus:outline-hidden focus:border-white/40"
        />
        <div class="flex justify-end gap-2">
          <Button variant="ghost" size="sm" @click="showAddInput = false">Cancel</Button>
          <Button variant="secondary" size="sm" :disabled="!newLinksText.trim()" @click="handleAddMoreLinks">
            Append to Queue
          </Button>
        </div>
      </div>

      <!-- Filter Tabs & Actions -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#262626] pb-2">
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="px-2.5 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer"
            :class="activeTab === 'all' ? 'bg-[#2E2E2E] text-white font-bold' : 'text-neutral-400 hover:text-white'"
            @click="activeTab = 'all'"
          >
            All ({{ totalCount }})
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer"
            :class="activeTab === 'ready' ? 'bg-[#2E2E2E] text-white font-bold' : 'text-neutral-400 hover:text-white'"
            @click="activeTab = 'ready'"
          >
            Ready ({{ readyCount }})
          </button>
          <button
            v-if="resolvingCount > 0"
            type="button"
            class="px-2.5 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer"
            :class="activeTab === 'resolving' ? 'bg-[#2E2E2E] text-white font-bold' : 'text-neutral-400 hover:text-white'"
            @click="activeTab = 'resolving'"
          >
            Processing ({{ resolvingCount }})
          </button>
          <button
            v-if="errorCount > 0"
            type="button"
            class="px-2.5 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer"
            :class="activeTab === 'error' ? 'bg-[#2E2E2E] text-white font-bold' : 'text-neutral-400 hover:text-white'"
            @click="activeTab = 'error'"
          >
            Failed ({{ errorCount }})
          </button>
        </div>

        <button
          v-if="totalCount > 0"
          type="button"
          class="text-xs font-mono text-neutral-500 hover:text-red-400 cursor-pointer flex items-center gap-1 self-end sm:self-auto"
          @click="clearQueue"
        >
          <Trash2 class="w-3.5 h-3.5" />
          <span>Clear Queue</span>
        </button>
      </div>

      <!-- Queue Items List -->
      <div class="max-h-[440px] overflow-y-auto space-y-2 pr-1">
        <div
          v-for="item in filteredQueue"
          :key="item.id"
          class="p-3 rounded-xl bg-[#141416] border border-[#262626] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors hover:border-[#383838]"
        >
          <!-- Left: Thumbnail & Info -->
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <!-- Media Thumbnail or Fallback -->
            <div class="w-12 h-12 rounded-lg bg-[#1f1f23] border border-white/5 overflow-hidden shrink-0 flex items-center justify-center relative">
              <img
                v-if="item.result?.thumbnail"
                :src="item.result.thumbnail"
                :alt="item.result.title"
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <div v-else class="flex items-center justify-center text-white/50">
                <BrandIcon :name="item.platform" :size="20" />
              </div>

              <!-- Loading overlay on item thumbnail -->
              <div v-if="item.status === 'resolving'" class="absolute inset-0 bg-black/60 flex items-center justify-center">
                <Loader2 class="w-4 h-4 text-white animate-spin" />
              </div>
            </div>

            <!-- Title & Platform -->
            <div class="min-w-0 flex-1 space-y-0.5">
              <div class="flex items-center gap-1.5">
                <span :class="getPlatformColor(item.platform)" class="text-xs font-semibold capitalize">
                  {{ item.platform }}
                </span>
                <span class="text-[10px] text-neutral-600 font-mono">•</span>
                <a
                  :href="item.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-[11px] font-mono text-neutral-400 hover:text-white truncate max-w-[200px] sm:max-w-xs block"
                  title="Open source link"
                >
                  {{ item.url }}
                </a>
              </div>

              <h4 class="text-xs font-medium text-white truncate max-w-sm sm:max-w-md">
                {{ item.result?.title || (item.status === 'resolving' ? 'Resolving media...' : item.url) }}
              </h4>

              <!-- Author / Subtitle -->
              <div class="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)] font-mono">
                <span v-if="item.result?.author?.name">By {{ item.result.author.name }}</span>
                <span v-if="item.result?.medias?.length">{{ item.result.medias.length }} format option(s)</span>
                <span v-if="item.error" class="text-rose-400 font-sans">{{ item.error }}</span>
              </div>
            </div>
          </div>

          <!-- Right: Format Selector & Action Buttons -->
          <div class="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <!-- Format / Quality Selector Dropdown (When Ready) -->
            <div v-if="item.status === 'ready' && item.result?.medias?.length" class="relative">
              <select
                v-model="item.selectedMediaIndex"
                class="h-8 pl-2 pr-6 rounded-lg bg-[#222226] border border-white/10 text-xs font-mono text-white focus:outline-hidden cursor-pointer appearance-none"
              >
                <option
                  v-for="(media, mIdx) in item.result.medias"
                  :key="mIdx"
                  :value="mIdx"
                >
                  {{ media.quality || media.type.toUpperCase() }} ({{ media.format || 'file' }})
                </option>
              </select>
            </div>

            <!-- Status Indicator / Download Trigger -->
            <div v-if="item.status === 'ready'">
              <Button
                variant="secondary"
                size="sm"
                class="h-8 font-medium text-xs cursor-pointer"
                title="Download this item"
                @click="downloadSingleItem(item)"
              >
                <Download class="w-3.5 h-3.5 mr-1" />
                <span>Download</span>
              </Button>
            </div>

            <div v-else-if="item.status === 'resolving'" class="flex items-center gap-1.5 text-xs text-amber-400 font-mono px-2 py-1 bg-amber-400/10 rounded-md">
              <Loader2 class="w-3.5 h-3.5 animate-spin" />
              <span>Resolving</span>
            </div>

            <div v-else-if="item.status === 'error'" class="flex items-center gap-1.5">
              <button
                type="button"
                class="p-1.5 rounded-lg bg-[#222226] hover:bg-[#2c2c32] text-amber-400 cursor-pointer"
                title="Retry link"
                @click="retryItem(item.id)"
              >
                <RotateCcw class="w-3.5 h-3.5" />
              </button>
            </div>

            <div v-else class="text-xs text-neutral-500 font-mono px-2 py-1">
              Queued
            </div>

            <!-- Remove from queue button -->
            <button
              type="button"
              class="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-white/5 cursor-pointer"
              title="Remove item"
              @click="removeItem(item.id)"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Empty state within filter -->
        <div v-if="filteredQueue.length === 0" class="py-12 text-center text-neutral-500 text-xs font-mono">
          No items match this filter tab.
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-between w-full">
        <div class="text-xs font-mono text-[var(--text-tertiary)]">
          {{ readyCount }} of {{ totalCount }} ready
        </div>

        <div class="flex items-center gap-2">
          <Button variant="ghost" size="sm" @click="emit('update:modelValue', false)">
            Close
          </Button>

          <Button
            variant="primary"
            size="sm"
            class="font-semibold"
            :disabled="readyCount === 0 || isZipping"
            :loading="isZipping"
            @click="downloadAllAsZip"
          >
            <Archive class="w-3.5 h-3.5 mr-1.5" />
            <span>{{ isZipping ? 'Archiving ZIP...' : 'Download All as ZIP' }}</span>
          </Button>
        </div>
      </div>
    </template>
  </Modal>
</template>
