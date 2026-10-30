import { useLocalStorage } from '@vueuse/core'

export function useUrlHistory(
  storageKey: string = 'avttr_url_history',
  initialValues: string[] = []
) {
  const history = useLocalStorage<string[]>(storageKey, initialValues)

  const add = (url: string) => {
    const trimmed = (url || '').trim()
    if (!trimmed) return
    const current = Array.isArray(history.value) ? history.value : []
    const filtered = current.filter(
      (item) => item.toLowerCase() !== trimmed.toLowerCase()
    )
    history.value = [trimmed, ...filtered].slice(0, 15)
  }

  const remove = (url: string) => {
    if (!Array.isArray(history.value)) return
    history.value = history.value.filter((item) => item !== url)
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
