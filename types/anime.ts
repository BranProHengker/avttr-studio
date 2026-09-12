export interface AniListTitle {
  native?: string | null
  romaji?: string | null
  english?: string | null
  chinese?: string | null
}

export interface AniListCoverImage {
  extraLarge?: string
  large?: string
  medium?: string
  color?: string
}

export interface AniListStudioEdge {
  isMain?: boolean
  node?: {
    id: number
    name: string
    siteUrl?: string
  }
}

export interface AniListInfo {
  id: number
  idMal?: number
  type?: string
  title: AniListTitle
  format?: string
  status?: string
  startDate?: { year?: number; month?: number; day?: number }
  endDate?: { year?: number; month?: number; day?: number }
  season?: string
  seasonYear?: number
  episodes?: number
  duration?: number
  countryOfOrigin?: string
  isAdult?: boolean
  genres?: string[]
  synonyms?: string[]
  coverImage?: AniListCoverImage
  bannerImage?: string
  siteUrl?: string
  studios?: {
    edges?: AniListStudioEdge[]
  }
  externalLinks?: Array<{
    id: number
    url: string
    site: string
  }>
}

export interface TraceMoeResult {
  anilist: number | AniListInfo
  filename: string
  episode: number | string | null
  from: number
  to: number
  at: number
  similarity: number
  video: string
  image: string
}

export interface TraceMoeResponse {
  frameCount: number
  error: string
  result: TraceMoeResult[]
  quota?: number
  quotaUsed?: number
}

export interface AnimeSearchOptions {
  cutBorders?: boolean
  anilistInfo?: boolean
}
