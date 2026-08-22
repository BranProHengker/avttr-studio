import type { ScraperResult, MediaItem, PlatformType } from '~/types'

export type { ScraperResult, MediaItem, PlatformType }

export interface PlatformScraper {
  name: PlatformType
  supports: (url: string) => boolean
  resolve: (url: string) => Promise<ScraperResult>
}
