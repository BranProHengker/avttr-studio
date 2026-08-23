import type { ToolCategory, ToolItem } from '~/types'

export const ALL_CATEGORIES: ToolCategory[] = [
  {
    id: 'downloaders',
    name: 'DOWNLOADERS',
    description: 'Direct, ad-free media downloaders for all major social networks',
    icon: 'Download',
    tools: [
      {
        id: 'tiktok',
        title: 'TikTok Downloader',
        description: 'Download HD videos without watermark, audio MP3, and photo slides.',
        category: 'downloader',
        icon: 'tiktok',
        route: '/d/tiktok',
        badge: 'HD',
        popular: true,
        platform: 'tiktok',
      },
      {
        id: 'instagram',
        title: 'Instagram Downloader',
        description: 'Save Instagram Reels, Carousel posts, Photos, and Audio clips.',
        category: 'downloader',
        icon: 'instagram',
        route: '/d/instagram',
        badge: 'Fast',
        popular: true,
        platform: 'instagram',
      },
      {
        id: 'youtube',
        title: 'YouTube Downloader',
        description: 'Extract YouTube 1080p/720p videos, Shorts, and high-bitrate MP3s.',
        category: 'downloader',
        icon: 'youtube',
        route: '/d/youtube',
        badge: 'HD',
        popular: true,
        platform: 'youtube',
      },
      {
        id: 'twitter',
        title: 'Twitter / X Downloader',
        description: 'Download Twitter (X) video clips, GIFs, and media attachments.',
        category: 'downloader',
        icon: 'twitter',
        route: '/d/twitter',
        badge: 'Fast',
        platform: 'twitter',
      },
      {
        id: 'capcut',
        title: 'CapCut Downloader',
        description: 'Download clean CapCut video templates without watermark.',
        category: 'downloader',
        icon: 'capcut',
        route: '/d/capcut',
        badge: 'New',
        platform: 'capcut',
      },
      {
        id: 'facebook',
        title: 'Facebook Downloader',
        description: 'Download high-definition public Facebook videos and reels.',
        category: 'downloader',
        icon: 'facebook',
        route: '/d/facebook',
        platform: 'facebook',
      },
      {
        id: 'spotify',
        title: 'Spotify & Audio',
        description: 'Fetch track details, artwork, and audio streams.',
        category: 'downloader',
        icon: 'spotify',
        route: '/d/spotify',
        badge: 'Beta',
        platform: 'spotify',
      },
    ],
  },
  {
    id: 'images',
    name: 'IMAGES & ASSETS',
    description: 'Browser-based asset utilities and cryptographic encoders',
    icon: 'Image',
    tools: [
      {
        id: 'image-compressor',
        title: 'Image Compressor',
        description: 'Compress PNG, JPG, WebP, SVG, AVIF, and GIF without reducing resolution or visual quality.',
        category: 'image',
        icon: 'image-compressor',
        route: '/tools/image-compressor',
        badge: 'New',
        popular: true,
      },
      {
        id: 'qr-generator',
        title: 'QR Code Studio',
        description: 'Generate styled QR codes with custom colors, error correction, and SVG/PNG download.',
        category: 'image',
        icon: 'qr-generator',
        route: '/tools/qr-generator',
        badge: 'New',
        popular: true,
      },
      {
        id: 'base64-image',
        title: 'Base64 & Hash Studio',
        description: 'Convert files to Base64, generate SHA-256 / SHA-512 hashes via Web Crypto API.',
        category: 'image',
        icon: 'hash-encoder',
        route: '/tools/hash-encoder',
        badge: 'Fast',
      },
    ],
  },
  {
    id: 'color',
    name: 'COLOUR & DESIGN',
    description: 'Harmonious palettes, contrast verification, and token exports',
    icon: 'Palette',
    tools: [
      {
        id: 'color-palette',
        title: 'Color Palette Studio',
        description: 'Generate harmonious color palettes, check WCAG contrast, and copy CSS tokens.',
        category: 'color',
        icon: 'color-palette',
        route: '/tools/color-palette',
        badge: 'New',
      },
    ],
  },
]

export function useSearch() {
  const searchQuery = ref('')
  const isPaletteOpen = ref(false)

  const allTools = computed<ToolItem[]>(() => {
    return ALL_CATEGORIES.flatMap((c) => c.tools)
  })

  const filteredCategories = computed(() => {
    if (!searchQuery.value.trim()) return ALL_CATEGORIES

    const q = searchQuery.value.toLowerCase()
    return ALL_CATEGORIES.map((cat) => ({
      ...cat,
      tools: cat.tools.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.tools.length > 0)
  })

  const openPalette = () => {
    isPaletteOpen.value = true
  }

  const closePalette = () => {
    isPaletteOpen.value = false
    searchQuery.value = ''
  }

  return {
    searchQuery,
    isPaletteOpen,
    allTools,
    categories: ALL_CATEGORIES,
    filteredCategories,
    openPalette,
    closePalette,
  }
}
