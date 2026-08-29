export type PlatformType =
  | 'tiktok'
  | 'instagram'
  | 'youtube'
  | 'twitter'
  | 'facebook'
  | 'capcut'
  | 'spotify'
  | 'soundcloud'
  | 'pinterest'
  | 'threads'
  | 'terabox'
  | 'other'

export interface MediaItem {
  type: 'video' | 'audio' | 'image'
  url: string
  quality?: string
  format?: string
  size?: number
  watermark?: boolean
  thumbnail?: string
}

export interface AuthorInfo {
  name: string
  username: string
  avatar?: string
}

export interface ScraperResult {
  success: boolean
  platform: PlatformType
  title: string
  description?: string
  author?: AuthorInfo
  thumbnail?: string
  duration?: number
  medias: MediaItem[]
  error?: string
  cached?: boolean
}

export interface ToolCategory {
  id: string
  name: string
  description?: string
  icon: string
  tools: ToolItem[]
}

export interface ToolItem {
  id: string
  title: string
  description: string
  category: 'downloader' | 'image' | 'color' | 'dev'
  icon: string
  route: string
  badge?: 'Fast' | 'HD' | 'New' | 'Beta' | 'AI' | 'Popular' | string
  popular?: boolean
  platform?: PlatformType
}

export interface PlatformScraper {
  name: PlatformType | string
  supports: (url: string) => boolean
  resolve: (url: string) => Promise<ScraperResult>
}

export interface ToastItem {
  id: string
  title: string
  description?: string
  type: 'default' | 'success' | 'warning' | 'error' | 'info'
  duration?: number
}

export interface DownloadHistoryItem {
  id: string
  url: string
  platform: PlatformType
  title: string
  thumbnail?: string
  timestamp: number
  mediasCount: number
}
