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
        title: 'QR Code Generator',
        description: 'Generate styled QR codes with custom colors, error correction, and SVG/PNG download.',
        category: 'image',
        icon: 'qr-generator',
        route: '/tools/qr-generator',
        badge: 'New',
        popular: true,
      },
      {
        id: 'background-remover',
        title: 'Background Remover',
        description: '100% Client-side AI neural segmentation to remove backgrounds instantly without server uploads.',
        category: 'image',
        icon: 'background-remover',
        route: '/tools/background-remover',
        badge: 'AI',
        popular: true,
      },
      {
        id: 'image-converter',
        title: 'Image Format Converter',
        description: 'Batch convert PNG, JPG, WebP, AVIF, BMP, and Favicon ICO formats with instant ZIP download.',
        category: 'image',
        icon: 'image-converter',
        route: '/tools/image-converter',
        badge: 'New',
        popular: true,
      },
      {
        id: 'brat-generator',
        title: 'Brat Text Generator',
        description: 'Generate authentic Charli XCX Brat album-style blurred text, memes, and word-by-word animated GIFs.',
        category: 'image',
        icon: 'type',
        route: '/tools/brat-generator',
        badge: 'Popular',
        popular: true,
      },
      {
        id: 'base64-image',
        title: 'Base64 & Hash Encoder',
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
        id: 'color-converter',
        title: 'Color Converter & Picker',
        description: 'Visual color picker with bi-directional HEX, RGB, CMYK, HSV, HSL translation & shades.',
        category: 'color',
        icon: 'color-converter',
        route: '/tools/color-converter',
        badge: 'New',
        popular: true,
      },
      {
        id: 'font-explorer',
        title: 'Font Explorer & Tester',
        description: 'Browse, test, shuffle random fonts, and preview 80+ modern typefaces with instant CSS embed.',
        category: 'color',
        icon: 'font-explorer',
        route: '/tools/font-explorer',
        badge: 'New',
        popular: true,
      },
      {
        id: 'color-palette',
        title: 'Color Palette Generator',
        description: 'Generate harmonious color palettes, check WCAG contrast, and copy CSS tokens.',
        category: 'color',
        icon: 'color-palette',
        route: '/tools/color-palette',
        badge: 'Popular',
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
