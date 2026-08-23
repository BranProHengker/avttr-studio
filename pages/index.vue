<script setup lang="ts">
import { ref, defineAsyncComponent } from 'vue'
import { useDownloader } from '~/composables/useDownloader'
import { useI18n } from '~/composables/useI18n'
import { ALL_CATEGORIES } from '~/composables/useSearch'
import HeroPasteBar from '~/components/dashboard/HeroPasteBar.vue'
import CategorySection from '~/components/dashboard/CategorySection.vue'
import Badge from '~/components/ui/Badge.vue'

const LazyMediaPreviewModal = defineAsyncComponent(() => import('~/components/downloaders/MediaPreviewModal.vue'))

const { url, loading, result, resolveMedia } = useDownloader()
const { t } = useI18n()
const isModalOpen = ref(false)

const handleResolve = async () => {
  if (!url.value.trim()) return
  const data = await resolveMedia()
  if (data && data.success) {
    isModalOpen.value = true
  }
}
</script>

<template>
  <div class="space-y-8 pb-12">
    <!-- Header Banner with 100% Client Privacy badge -->
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
          100% Client Privacy
        </Badge>
      </div>
    </div>

    <!-- Hero Universal Downloader Omnibox -->
    <div class="space-y-3">
      <HeroPasteBar
        v-model="url"
        :loading="loading"
        @submit="handleResolve"
      />
    </div>

    <!-- Categorized Tool Sections (Delphi Style) -->
    <div class="space-y-10 pt-2">
      <CategorySection
        v-for="category in ALL_CATEGORIES"
        :key="category.id"
        :category="category"
      />
    </div>

    <!-- Lazy Loaded Media Download Preview Modal -->
    <LazyMediaPreviewModal
      v-if="isModalOpen"
      v-model="isModalOpen"
      :result="result"
    />
  </div>
</template>
