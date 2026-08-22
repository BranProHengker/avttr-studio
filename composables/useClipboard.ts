import { useClipboard as useVueUseClipboard } from '@vueuse/core'
import { useToast } from './useToast'

export function useClipboard() {
  const { copy: copyText, isSupported } = useVueUseClipboard()
  const toast = useToast()

  const copy = async (text: string, label: string = 'Content') => {
    if (!text) return
    try {
      await copyText(text)
      toast.success('Copied!', `${label} copied to clipboard`)
    } catch {
      toast.error('Copy Failed', 'Unable to copy to clipboard')
    }
  }

  return {
    copy,
    isSupported,
  }
}
