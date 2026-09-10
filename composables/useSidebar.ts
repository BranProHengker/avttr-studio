export function useSidebar() {
  const isCollapsed = useCookie<boolean>('avttr_sidebar_collapsed', {
    default: () => false,
    watch: true,
  })

  // Synchronize with existing localStorage on client
  if (import.meta.client) {
    const stored = localStorage.getItem('avttr_sidebar_collapsed')
    if (stored !== null) {
      const val = stored === 'true'
      if (isCollapsed.value !== val) {
        isCollapsed.value = val
      }
    }
  }

  const toggleCollapse = () => {
    isCollapsed.value = !isCollapsed.value
    if (import.meta.client) {
      localStorage.setItem('avttr_sidebar_collapsed', String(isCollapsed.value))
    }
  }

  const setCollapsed = (val: boolean) => {
    isCollapsed.value = val
    if (import.meta.client) {
      localStorage.setItem('avttr_sidebar_collapsed', String(val))
    }
  }

  return {
    isCollapsed,
    toggleCollapse,
    setCollapsed,
  }
}
