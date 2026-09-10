import { useLocalStorage } from '@vueuse/core'

const isCollapsed = useLocalStorage('avttr_sidebar_collapsed', false)

export function useSidebar() {
  const toggleCollapse = () => {
    isCollapsed.value = !isCollapsed.value
  }

  const setCollapsed = (val: boolean) => {
    isCollapsed.value = val
  }

  return {
    isCollapsed,
    toggleCollapse,
    setCollapsed,
  }
}
