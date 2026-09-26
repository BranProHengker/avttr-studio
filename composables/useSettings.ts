import { ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'

export type SettingsTab = 'general' | 'downloader' | 'storage' | 'about' | 'support'

export interface UserSettings {
  defaultQuality: 'best' | '1080p' | '720p'
  defaultAudioFormat: 'mp3' | 'original'
  autoDownloadThumbnail: boolean
  autoPasteOnFocus: boolean
  customCobaltApi: string
}

const defaultSettings: UserSettings = {
  defaultQuality: 'best',
  defaultAudioFormat: 'mp3',
  autoDownloadThumbnail: false,
  autoPasteOnFocus: false,
  customCobaltApi: '',
}

// Global modal visibility state
const isSettingsOpen = ref(false)
const activeSettingsTab = ref<SettingsTab>('general')

export function useSettings() {
  const settings = useLocalStorage<UserSettings>('avttr_user_settings', defaultSettings)

  const openSettings = (tab: SettingsTab = 'general') => {
    activeSettingsTab.value = tab
    isSettingsOpen.value = true
  }

  const closeSettings = () => {
    isSettingsOpen.value = false
  }

  const toggleSettings = () => {
    if (isSettingsOpen.value) {
      closeSettings()
    } else {
      openSettings()
    }
  }

  const resetSettings = () => {
    settings.value = { ...defaultSettings }
  }

  return {
    settings,
    isSettingsOpen,
    activeSettingsTab,
    openSettings,
    closeSettings,
    toggleSettings,
    resetSettings,
  }
}
