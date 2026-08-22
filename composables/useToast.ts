import type { ToastItem } from '~/types'

const toasts = ref<ToastItem[]>([])

export function useToast() {
  const show = (options: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9)
    const toast: ToastItem = {
      id,
      duration: 3500,
      ...options,
    }

    toasts.value.push(toast)

    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        dismiss(id)
      }, toast.duration)
    }

    return id
  }

  const dismiss = (id: string) => {
    const index = toasts.value.findIndex((t) => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }

  const success = (title: string, description?: string) =>
    show({ title, description, type: 'success' })

  const error = (title: string, description?: string) =>
    show({ title, description, type: 'error' })

  const warning = (title: string, description?: string) =>
    show({ title, description, type: 'warning' })

  const info = (title: string, description?: string) =>
    show({ title, description, type: 'info' })

  return {
    toasts,
    show,
    dismiss,
    success,
    error,
    warning,
    info,
  }
}
