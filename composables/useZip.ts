import JSZip from 'jszip'
import { useToast } from './useToast'
import type { MediaItem } from '~/types'

export function useZip() {
  const isZipping = ref(false)
  const zipProgress = ref(0)
  const toast = useToast()

  const downloadAsZip = async (medias: MediaItem[], title: string = 'media_gallery') => {
    const images = medias.filter((m) => m.type === 'image' || m.format === 'jpg' || m.format === 'png' || m.format === 'webp')
    if (images.length === 0) {
      toast.warning('No Images Found', 'There are no image items to zip.')
      return
    }

    isZipping.value = true
    zipProgress.value = 0

    try {
      const zip = new JSZip()
      const folderName = title.replace(/[^a-z0-9_-]/gi, '_').substring(0, 30) || 'avttr_images'
      const folder = zip.folder(folderName) || zip

      let completed = 0

      for (let i = 0; i < images.length; i++) {
        const item = images[i]
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(item.url)}&filename=image_${i + 1}.${item.format || 'jpg'}`
        
        try {
          const response = await fetch(proxyUrl)
          if (!response.ok) throw new Error('Fetch failed')
          const blob = await response.blob()
          folder.file(`image_${String(i + 1).padStart(2, '0')}.${item.format || 'jpg'}`, blob)
        } catch {
          // Continue with next image if one fails
        }

        completed++
        zipProgress.value = Math.round((completed / images.length) * 100)
      }

      toast.info('Creating ZIP', 'Compressing files into archive...')
      const content = await zip.generateAsync({ type: 'blob' })

      // Trigger client file download
      const link = document.createElement('a')
      link.href = URL.createObjectURL(content)
      link.download = `${folderName}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)

      toast.success('ZIP Downloaded', `${completed} files archived successfully`)
    } catch (err: any) {
      toast.error('ZIP Error', err.message || 'Failed to generate ZIP archive')
    } finally {
      isZipping.value = false
      zipProgress.value = 0
    }
  }

  return {
    isZipping,
    zipProgress,
    downloadAsZip,
  }
}
