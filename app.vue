<script setup lang="ts">
import { ref, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import AppSidebar from '~/components/layout/AppSidebar.vue'
import AppNavbar from '~/components/layout/AppNavbar.vue'
import ToastContainer from '~/components/layout/ToastContainer.vue'
import { useSearch } from '~/composables/useSearch'

const LazyCommandPalette = defineAsyncComponent(() => import('~/components/layout/CommandPalette.vue'))
const LazyHistoryDrawer = defineAsyncComponent(() => import('~/components/dashboard/HistoryDrawer.vue'))

const isSidebarOpen = ref(false)
const isHistoryOpen = ref(false)
const { isPaletteOpen, openPalette, closePalette } = useSearch()

const handleGlobalKeydown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    if (isPaletteOpen.value) {
      closePalette()
    } else {
      openPalette()
    }
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleGlobalKeydown)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleGlobalKeydown)
  }
})
</script>

<template>
  <div class="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex">
    <!-- Sidebar Navigation -->
    <AppSidebar
      :is-open="isSidebarOpen"
      @close="isSidebarOpen = false"
      @open-palette="openPalette"
      @open-history="isHistoryOpen = true"
    />

    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col min-w-0 lg:pl-64 transition-all duration-200">
      <AppNavbar
        @toggle-sidebar="isSidebarOpen = !isSidebarOpen"
        @open-palette="openPalette"
        @open-history="isHistoryOpen = true"
      />

      <main class="flex-1 p-4 sm:p-6 lg:p-8 w-full">
        <NuxtPage />
      </main>
    </div>

    <!-- Lazy Loaded Modals & Notifications -->
    <LazyCommandPalette v-if="isPaletteOpen" :is-open="isPaletteOpen" @close="closePalette" />
    <LazyHistoryDrawer v-if="isHistoryOpen" :is-open="isHistoryOpen" @close="isHistoryOpen = false" />
    <ToastContainer />
  </div>
</template>
