import { useLocalStorage } from '@vueuse/core'
import type { DownloadHistoryItem, ScraperResult } from '~/types'

export function useHistory() {
  const history = useLocalStorage<DownloadHistoryItem[]>('avttr_download_history', [])

  const add = (url: string, result: ScraperResult) => {
    if (!result.success) return

    const newItem: DownloadHistoryItem = {
      id: Math.random().toString(36).substring(2, 9),
      url,
      platform: result.platform,
      title: result.title || `${result.platform} Download`,
      thumbnail: result.thumbnail || result.medias[0]?.thumbnail,
      timestamp: Date.now(),
      mediasCount: result.medias.length,
    }

    // Keep unique URLs at the top, max 20 items
    const filtered = history.value.filter((item) => item.url !== url)
    history.value = [newItem, ...filtered].slice(0, 20)
  }

  const remove = (id: string) => {
    history.value = history.value.filter((item) => item.id !== id)
  }

  const clear = () => {
    history.value = []
  }

  return {
    history,
    add,
    remove,
    clear,
  }
}
