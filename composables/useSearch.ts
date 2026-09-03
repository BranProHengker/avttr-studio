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
        title: 'Spotify Downloader',
        description: 'Fetch track metadata, Ultra HD 640x640 album covers, and full MP3 audio streams.',
        category: 'downloader',
        icon: 'spotify',
        route: '/d/spotify',
        badge: 'HQ Audio',
        popular: true,
        platform: 'spotify',
      },
      {
        id: 'soundcloud',
        title: 'SoundCloud Downloader',
        description: 'Download SoundCloud tracks, DJ mixes, podcasts, and 500x500 Ultra HD artwork.',
        category: 'downloader',
        icon: 'soundcloud',
        route: '/d/soundcloud',
        badge: 'MP3',
        platform: 'soundcloud',
      },
      {
        id: 'terabox',
        title: 'TeraBox Downloader',
        description: 'Fast direct download links for TeraBox cloud files and shared videos.',
        category: 'downloader',
        icon: 'terabox',
        route: '/d/terabox',
        badge: 'New',
        popular: true,
        platform: 'terabox',
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
        id: 'pdf-tools',
        title: 'PDF Studio',
        description: 'Merge multiple PDFs, split & extract pages, and convert photos to PDF completely in your browser.',
        category: 'image',
        icon: 'file-text',
        route: '/tools/pdf-tools',
        badge: 'New',
        popular: true,
      },
      {
        id: 'svg-optimizer',
        title: 'SVG Optimizer',
        description: 'Clean Figma bloatware, minify SVG paths, live preview, and export to Vue 3, React, or 4K PNG.',
        category: 'image',
        icon: 'sparkles',
        route: '/tools/svg-optimizer',
        badge: 'New',
        popular: true,
      },
      {
        id: 'code-to-image',
        title: 'Code to Image Studio',
        description: 'Transform code snippets into aesthetic macOS/Windows screenshots with syntax highlighting & gradient backgrounds.',
        category: 'image',
        icon: 'code',
        route: '/tools/code-to-image',
        badge: 'New',
        popular: true,
      },
      {
        id: 'audio-cutter',
        title: 'Audio Extractor & Trimmer',
        description: 'Extract audio from video, inspect waveforms, and trim audio clips preserving original sample rates.',
        category: 'image',
        icon: 'music',
        route: '/tools/audio-cutter',
        badge: 'New',
        popular: true,
      },
      {
        id: 'video-to-gif',
        title: 'Video to GIF',
        description: 'Convert MP4, WebM, and MOV video clips into crisp animated GIFs with trimming, FPS, and speed controls.',
        category: 'image',
        icon: 'video-to-gif',
        route: '/tools/video-to-gif',
        badge: 'New',
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
        id: 'device-mockup',
        title: 'Device Mockup Studio',
        description: 'Wrap screenshots into high-end iPhone 16 Pro, MacBook M3, and minimal 3D mockups for portfolio showcase.',
        category: 'color',
        icon: 'smartphone',
        route: '/tools/device-mockup',
        badge: 'New',
        popular: true,
      },
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
        id: 'font-library',
        title: 'Font Library',
        description: 'Browse, test, search Google Fonts & DaFont directory with live specimen previews and ZIP downloads.',
        category: 'color',
        icon: 'font-library',
        route: '/tools/font-library',
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
      {
        id: 'og-previewer',
        title: 'Open Graph Previewer',
        description: 'Test, simulate, and generate social cards for Twitter, Discord, WhatsApp, Facebook, LinkedIn, and Google.',
        category: 'color',
        icon: 'globe',
        route: '/tools/og-previewer',
        badge: 'New',
        popular: true,
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
