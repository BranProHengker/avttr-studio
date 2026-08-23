import { useToast } from './useToast'

export function useClipboard() {
  const toast = useToast()

  const copy = async (text: string, label: string = 'Content'): Promise<boolean> => {
    if (!text) return false

    // 1. Try modern navigator.clipboard if in Secure Context
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof window !== 'undefined' && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text)
        toast.success('Copied!', `${label} copied to clipboard`)
        return true
      } catch {
        // Continue to fallback
      }
    }

    // 2. Universal Fallback using invisible textarea & execCommand('copy') (Works 100% on HTTP / LAN IP)
    if (typeof document !== 'undefined') {
      try {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.top = '-9999px'
        textarea.style.left = '-9999px'
        textarea.style.opacity = '0'
        textarea.setAttribute('readonly', '')
        document.body.appendChild(textarea)
        textarea.select()
        textarea.setSelectionRange(0, textarea.value.length)
        const successful = document.execCommand('copy')
        document.body.removeChild(textarea)

        if (successful) {
          toast.success('Copied!', `${label} copied to clipboard`)
          return true
        }
      } catch {
        // Fallback failed
      }
    }

    toast.error('Copy Failed', 'Unable to copy to clipboard')
    return false
  }

  return {
    copy,
    isSupported: true,
  }
}
