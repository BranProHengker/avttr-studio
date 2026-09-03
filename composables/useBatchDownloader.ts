import { ref, computed } from 'vue'
import type { ScraperResult, MediaItem } from '~/types'
import { detectPlatform } from '~/server/utils/sanitizer'
import { useDownloader } from './useDownloader'
import { useZip } from './useZip'
import { useToast } from './useToast'
import { useHistory } from './useHistory'

export interface BatchQueueItem {
  id: string
  url: string
  platform: string
  status: 'pending' | 'resolving' | 'ready' | 'error'
  result?: ScraperResult
  error?: string
  selectedMediaIndex: number
}

const queue = ref<BatchQueueItem[]>([])
const isProcessing = ref(false)
const isModalOpen = ref(false)

export function useBatchDownloader() {
  const toast = useToast()
  const history = useHistory()
  const { downloadMediaItem, getProxiedUrl } = useDownloader()
  const { downloadAsZip, isZipping, zipProgress } = useZip()

  // Extract all valid URLs from raw text (newlines, spaces, commas)
  const extractUrls = (text: string): string[] => {
    if (!text) return []
    const urlRegex = /(https?:\/\/[^\s,]+)/g
    const matches = text.match(urlRegex) || []
    // Filter duplicates and valid URLs
    return Array.from(new Set(matches.map(u => u.trim())))
  }

  // Add URLs to the queue
  const addUrls = (raw: string | string[]): number => {
    const urls = Array.isArray(raw) ? raw : extractUrls(raw)
    if (urls.length === 0) return 0

    let addedCount = 0
    urls.forEach(url => {
      // Avoid exact duplicates in current queue
      if (!queue.value.some(item => item.url === url)) {
        const plat = detectPlatform(url)
        queue.value.push({
          id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          url,
          platform: plat,
          status: 'pending',
          selectedMediaIndex: 0
        })
        addedCount++
      }
    })

    if (addedCount > 0) {
      isModalOpen.value = true
    }

    return addedCount
  }

  // Resolve a single item
  const resolveItem = async (item: BatchQueueItem): Promise<boolean> => {
    item.status = 'resolving'
    item.error = undefined

    try {
      const response = await $fetch<ScraperResult>('/api/download/resolve', {
        method: 'POST',
        body: { url: item.url }
      })

      if (response && response.success) {
        item.result = response
        item.status = 'ready'
        item.platform = response.platform
        item.selectedMediaIndex = 0
        history.add(item.url, response)
        return true
      } else {
        item.status = 'error'
        item.error = response?.error || 'Failed to extract media'
        return false
      }
    } catch (err: any) {
      item.status = 'error'
      item.error = err.data?.message || err.message || 'Network error'
      return false
    }
  }

  // Process queue with concurrency limit of 3
  const startProcessing = async () => {
    if (isProcessing.value) return
    isProcessing.value = true

    const pendingItems = () => queue.value.filter(item => item.status === 'pending')

    const CONCURRENCY = 3
    const activeResolvers = new Set<Promise<void>>()

    while (pendingItems().length > 0) {
      const nextItem = pendingItems()[0]
      if (!nextItem) break

      const promise = (async () => {
        await resolveItem(nextItem)
      })()

      activeResolvers.add(promise)
      promise.finally(() => activeResolvers.delete(promise))

      if (activeResolvers.size >= CONCURRENCY) {
        await Promise.race(activeResolvers)
      }
    }

    // Wait for remaining items to finish
    await Promise.all(activeResolvers)
    isProcessing.value = false

    const readyCount = queue.value.filter(i => i.status === 'ready').length
    const errorCount = queue.value.filter(i => i.status === 'error').length
    if (readyCount > 0) {
      toast.success('Batch Complete', `${readyCount} media items ready for download`)
    }
    if (errorCount > 0) {
      toast.warning('Some Failed', `${errorCount} link(s) could not be resolved`)
    }
  }

  // Retry an item
  const retryItem = async (id: string) => {
    const item = queue.value.find(i => i.id === id)
    if (!item) return
    item.status = 'pending'
    await resolveItem(item)
  }

  // Retry all failed
  const retryAllFailed = async () => {
    queue.value.forEach(item => {
      if (item.status === 'error') item.status = 'pending'
    })
    await startProcessing()
  }

  // Remove item
  const removeItem = (id: string) => {
    queue.value = queue.value.filter(i => i.id !== id)
  }

  // Clear entire queue
  const clearQueue = () => {
    queue.value = []
  }

  // Download all ready items into a single ZIP archive
  const downloadAllAsZip = async () => {
    const readyItems = queue.value.filter(i => i.status === 'ready' && i.result && i.result.medias.length > 0)
    if (readyItems.length === 0) {
      toast.warning('No Media Ready', 'There are no resolved media files to archive')
      return
    }

    // Collect all selected media items
    const mediaToZip: MediaItem[] = []
    readyItems.forEach(item => {
      if (!item.result) return
      const media = item.result.medias[item.selectedMediaIndex] || item.result.medias[0]
      if (media) {
        // Assign distinct filename if missing
        const safeTitle = (item.result.title || 'media').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30)
        const ext = media.format || (media.type === 'video' ? 'mp4' : media.type === 'audio' ? 'mp3' : 'jpg')
        mediaToZip.push({
          ...media,
          filename: media.filename || `${item.platform}_${safeTitle}_${item.id.slice(-4)}.${ext}`
        })
      }
    })

    const zipFilename = `avttr_batch_${new Date().toISOString().slice(0, 10)}.zip`
    await downloadAsZip(mediaToZip, zipFilename)
  }

  // Download a single item
  const downloadSingleItem = (item: BatchQueueItem) => {
    if (!item.result || item.result.medias.length === 0) return
    const media = item.result.medias[item.selectedMediaIndex] || item.result.medias[0]
    if (media) {
      downloadMediaItem(media, item.result.title)
    }
  }

  // Computed stats
  const totalCount = computed(() => queue.value.length)
  const readyCount = computed(() => queue.value.filter(i => i.status === 'ready').length)
  const errorCount = computed(() => queue.value.filter(i => i.status === 'error').length)
  const resolvingCount = computed(() => queue.value.filter(i => i.status === 'resolving').length)
  const pendingCount = computed(() => queue.value.filter(i => i.status === 'pending').length)
  const overallProgress = computed(() => {
    if (totalCount.value === 0) return 0
    const finished = readyCount.value + errorCount.value
    return Math.round((finished / totalCount.value) * 100)
  })

  return {
    queue,
    isProcessing,
    isModalOpen,
    isZipping,
    zipProgress,
    totalCount,
    readyCount,
    errorCount,
    resolvingCount,
    pendingCount,
    overallProgress,
    extractUrls,
    addUrls,
    startProcessing,
    retryItem,
    retryAllFailed,
    removeItem,
    clearQueue,
    downloadAllAsZip,
    downloadSingleItem
  }
}
