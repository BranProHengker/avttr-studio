<script setup lang="ts">
import { ref, defineAsyncComponent } from 'vue'
import { useDownloader } from '~/composables/useDownloader'
import { useBatchDownloader } from '~/composables/useBatchDownloader'
import { useI18n } from '~/composables/useI18n'
import { useSearch } from '~/composables/useSearch'
import HeroPasteBar from '~/components/dashboard/HeroPasteBar.vue'
import CategorySection from '~/components/dashboard/CategorySection.vue'
import Badge from '~/components/ui/Badge.vue'

const LazyMediaPreviewModal = defineAsyncComponent(() => import('~/components/downloaders/MediaPreviewModal.vue'))
const LazyBatchQueueModal = defineAsyncComponent(() => import('~/components/downloaders/BatchQueueModal.vue'))

const { url, loading, result, error, resolveMedia } = useDownloader()
const { addUrls, startProcessing, isModalOpen: isBatchModalOpen } = useBatchDownloader()
const { t } = useI18n()
const { categories } = useSearch()
const isModalOpen = ref(false)

const handleResolve = async () => {
  if (!url.value.trim()) return
  const data = await resolveMedia()
  if (data && data.success) {
    isModalOpen.value = true
  }
}

const handleBatchSubmit = (urls: string[]) => {
  if (!urls || urls.length === 0) return
  addUrls(urls)
  isBatchModalOpen.value = true
  startProcessing()
}
</script>

<template>
  <div class="space-y-8 pb-12">
    <!-- Header Banner with 100% Client Privacy badge (Only on All Dashboard) -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div class="space-y-1.5">
        <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          {{ t.heroTitle }}
        </h1>
        <p class="text-xs sm:text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
          {{ t.heroSubtitle }}
        </p>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <Badge variant="badge">
          Client Privacy
        </Badge>
      </div>
    </div>

    <!-- Hero Universal Downloader Omnibox -->
    <div class="space-y-3">
      <HeroPasteBar
        v-model="url"
        :loading="loading"
        @submit="handleResolve"
        @submit-batch="handleBatchSubmit"
      />

      <!-- Error / Cookie Expired Alert Box -->
      <div
        v-if="error"
        class="p-4 rounded-xl border transition-all flex items-start gap-3.5"
        :class="
          error.toLowerCase().includes('cookie') || error.toLowerCase().includes('terabox')
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
        "
      >
        <div
          class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          :class="error.toLowerCase().includes('cookie') ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'"
        >
          <svg class="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <div class="space-y-1 text-xs min-w-0 flex-1">
          <div class="font-semibold text-sm">
            {{ error.toLowerCase().includes('cookie') ? 'Sesi Cookie TeraBox Kedaluwarsa' : 'Gagal Memproses Link' }}
          </div>
          <p class="leading-relaxed opacity-90">
            {{ error }}
          </p>
          <div v-if="error.toLowerCase().includes('cookie') || error.toLowerCase().includes('terabox')" class="pt-1.5 text-[11px] text-amber-300/90 font-mono">
            💡 <strong>Petunjuk:</strong> Perbarui variabel <code>TERABOX_COOKIE</code> di file <code>.env</code> server dengan cookie <code>ndus</code> terbaru dari TeraBox.
          </div>
        </div>
      </div>
    </div>

    <!-- Categorized Tool Sections (Delphi Style) -->
    <div class="space-y-10 pt-2">
      <CategorySection
        v-for="category in categories"
        :key="category.id"
        :category="category"
      />
    </div>

    <!-- Lazy Loaded Single Media Download Preview Modal -->
    <LazyMediaPreviewModal
      v-if="isModalOpen"
      v-model="isModalOpen"
      :result="result"
    />

    <!-- Lazy Loaded Batch Downloader Queue Modal -->
    <LazyBatchQueueModal
      v-if="isBatchModalOpen"
      v-model="isBatchModalOpen"
    />
  </div>
</template>
