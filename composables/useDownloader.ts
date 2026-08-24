import { ref } from 'vue'
import type { ScraperResult, MediaItem } from '~/types'
import { useToast } from './useToast'
import { useHistory } from './useHistory'
import confetti from 'canvas-confetti'

export function useDownloader() {
  const url = ref('')
  const loading = ref(false)
  const result = ref<ScraperResult | null>(null)
  const error = ref<string | null>(null)

  const toast = useToast()
  const history = useHistory()

  const resolveMedia = async (targetUrl?: string): Promise<ScraperResult | null> => {
    const queryUrl = (targetUrl || url.value).trim()
    if (!queryUrl) {
      toast.warning('Input Required', 'Please enter a valid social media URL')
      return null
    }

    loading.value = true
    error.value = null
    result.value = null

    try {
      const response = await $fetch<ScraperResult>('/api/download/resolve', {
        method: 'POST',
        body: { url: queryUrl },
      })

      if (response && response.success) {
        result.value = response
        history.add(queryUrl, response)
        toast.success('Media Ready!', `Found ${response.medias.length} download options`)

        // Subtle confetti celebrate
        try {
          confetti({
            particleCount: 35,
            spread: 60,
            origin: { y: 0.85 },
            colors: ['#27272A', '#52525B', '#10B981'],
          })
        } catch {
          // Ignore confetti errors
        }

        return response
      } else {
        const errorMsg = response?.error || 'Failed to extract media. Video might be private.'
        error.value = errorMsg
        toast.error('Download Failed', errorMsg)
        return null
      }
    } catch (err: any) {
      const errorMsg = err.data?.message || err.message || 'Server error while resolving link'
      error.value = errorMsg
      toast.error('Error', errorMsg)
      return null
    } finally {
      loading.value = false
    }
  }

  const getProxiedUrl = (item?: MediaItem | string | null, customTitle?: string, isDownload = false): string => {
    if (!item) return ''
    
    let rawUrl = ''
    let ext = 'mp4'

    if (typeof item === 'string') {
      rawUrl = item
      if (rawUrl === 'undefined' || !rawUrl.startsWith('http')) return ''
      if (/\.m4a/i.test(rawUrl)) {
        ext = 'm4a'
      } else if (/\.opus/i.test(rawUrl)) {
        ext = 'opus'
      } else if (/\.(mp3|wav|flac|aac)/i.test(rawUrl) || /spotify|audio/i.test(rawUrl)) {
        ext = 'mp3'
      } else if (/\.(jpg|jpeg|png|webp|gif)/i.test(rawUrl)) {
        ext = 'jpg'
      }
    } else {
      rawUrl = item.url
      if (!rawUrl || rawUrl === 'undefined') return ''
      ext = item.format || (item.type === 'audio' ? 'm4a' : item.type === 'image' ? 'jpg' : 'mp4')
    }

    // If it's a converter URL (e.g. SaveFrom converter), return raw URL directly
    if (rawUrl.includes('sf-converter.com') || rawUrl.includes('convert?payload=')) {
      return rawUrl
    }

    const safeTitle = (customTitle || result.value?.title || 'media_download')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 50)
    const filename = `${safeTitle}.${ext}`

    const params = new URLSearchParams({
      url: rawUrl,
      filename,
    })

    if (isDownload) {
      params.set('download', '1')
    }

    return `/api/proxy?${params.toString()}`
  }

  const downloadMediaItem = (item: MediaItem, customTitle?: string) => {
    if (!item?.url) return

    // If it's a converter service URL (e.g. SaveFrom converter), open in a new tab directly
    if (item.url.includes('sf-converter.com') || item.url.includes('convert?payload=')) {
      window.open(item.url, '_blank')
      toast.info('Opening Converter', 'Redirecting to HD converter in new tab...')
      return
    }

    const downloadUrl = getProxiedUrl(item, customTitle, true)
    
    const link = document.createElement('a')
    link.href = downloadUrl
    link.setAttribute('download', '')
    link.setAttribute('target', '_blank')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.info('Download Started', 'Your file download has been initiated')
  }

  const reset = () => {
    url.value = ''
    result.value = null
    error.value = null
  }

  return {
    url,
    loading,
    result,
    error,
    resolveMedia,
    getProxiedUrl,
    downloadMediaItem,
    reset,
  }
}
