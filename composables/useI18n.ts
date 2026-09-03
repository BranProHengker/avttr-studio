import { ref, computed, onMounted } from 'vue'

export type Locale = 'en' | 'id'

export interface ToolTranslation {
  title: string
  description: string
}

export interface CategoryTranslation {
  name: string
  description: string
}

export interface Translations {
  // Navigation & Workspace
  appName: string
  appSubtitle: string
  dashboard: string
  allDownloaders: string
  socialDownloaders: string
  clientUtilities: string
  systemStorage: string
  downloadHistory: string
  quickSearch: string
  userProfile: string

  // Hero & Dashboard
  heroTitle: string
  heroSubtitle: string
  pastePlaceholder: string
  pasteBtn: string
  fetchingMedia: string
  browseTools: string

  // Categories
  catDownloaders: string
  catDownloadersDesc: string
  catImages: string
  catImagesDesc: string
  catColor: string
  catColorDesc: string
  videoSocials: string
  audioMusic: string
  assetGenerators: string
  designSystem: string

  // Actions & Buttons
  download: string
  downloadAllZip: string
  downloadHd: string
  downloadAudio: string
  copyLink: string
  copied: string
  clearAll: string
  compare: string
  save: string
  close: string
  processing: string
  dropImages: string
  dropImagesDesc: string
  qualityPreset: string
  fineTune: string
  outputFormat: string
  beforeAfter: string
  splitSlider: string
  sideBySide: string
  original: string
  compressed: string
  clientPrivacy: string

  // Tool Specific Controls
  addImages: string
  addMedia: string
  fetchVideo: string
  fetchImage: string
  compressionMode: string
  smartLossless: string
  recommended: string
  maxCompression: string
  dropzoneBrowse: string
  dropzoneImageDesc: string
  dropzoneVideoDesc: string
  dropzoneAudioDesc: string

  // Search & History
  searchPlaceholder: string
  noResults: string
  noHistory: string
  noHistoryDesc: string
  recentDownloads: string
  clearHistory: string

  // Language
  language: string
  langEn: string
  langId: string

  // Category & Tool Item Maps
  categories: Record<string, CategoryTranslation>
  tools: Record<string, ToolTranslation>
}

const translations: Record<Locale, Translations> = {
  en: {
    appName: 'Avttr Studio',
    appSubtitle: 'Nuxt 3 + shadcn',
    dashboard: 'Dashboard',
    allDownloaders: 'All Dashboard',
    socialDownloaders: 'Social Downloaders',
    clientUtilities: 'Client Utilities',
    systemStorage: 'System & Storage',
    downloadHistory: 'Download History',
    quickSearch: 'Quick Search',
    userProfile: 'avttr',

    heroTitle: 'Fast media tools, processed locally.',
    heroSubtitle: 'Universal downloader, audio trimmer, and asset optimizer without server tracking.',
    pastePlaceholder: 'Paste TikTok, Instagram, YouTube, Twitter/X, CapCut, Facebook, or Spotify link...',
    pasteBtn: 'Fetch Media',
    fetchingMedia: 'Resolving Media...',
    browseTools: 'Browse Utilities',

    catDownloaders: 'DOWNLOADERS',
    catDownloadersDesc: 'Direct, ad-free media downloaders for all major social networks',
    catImages: 'IMAGES & ASSETS',
    catImagesDesc: 'Browser-based asset utilities, compression, and cryptographic encoders',
    catColor: 'COLOUR & DESIGN',
    catColorDesc: 'Harmonious palettes, contrast verification, and token exports',
    videoSocials: 'Video & Socials',
    audioMusic: 'Audio & Music',
    assetGenerators: 'Asset Generators',
    designSystem: 'Design System',

    download: 'Download',
    downloadAllZip: 'Download All (ZIP)',
    downloadHd: 'Download HD',
    downloadAudio: 'Download Audio (MP3)',
    copyLink: 'Copy Direct Link',
    copied: 'Copied to Clipboard',
    clearAll: 'Clear All',
    compare: 'Compare',
    save: 'Save',
    close: 'Close',
    processing: 'Processing...',
    dropImages: 'Drop your images here or browse',
    dropImagesDesc: 'Support PNG, JPG, JPEG, WebP, SVG, AVIF, GIF, BMP. Maximum 5 photos per batch.',
    qualityPreset: 'Quality Preset',
    fineTune: 'Fine Tune Quality',
    outputFormat: 'Output Format',
    beforeAfter: 'Before vs After Comparison',
    splitSlider: 'Split Slider',
    sideBySide: 'Side-by-Side',
    original: 'Original',
    compressed: 'Compressed',
    clientPrivacy: 'Client Privacy',

    addImages: 'Add Images',
    addMedia: 'Add Media',
    fetchVideo: 'Fetch Video',
    fetchImage: 'Fetch Image',
    compressionMode: 'Compression Mode',
    smartLossless: 'Smart Lossless',
    recommended: 'Recommended',
    maxCompression: 'Max Compression',
    dropzoneBrowse: 'Drop your file here or browse',
    dropzoneImageDesc: 'Supports PNG, JPG, JPEG, WebP, SVG, and AVIF up to 20MB. 100% processed client-side.',
    dropzoneVideoDesc: 'Supports MP4, WebM, MOV, and AVI up to 100MB. 100% processed client-side.',
    dropzoneAudioDesc: 'Supports MP4, WebM, MOV, MP3, WAV, AAC, M4A, OGG, and FLAC. 100% processed client-side.',

    searchPlaceholder: 'Search tools, downloaders, shortcuts...',
    noResults: 'No tools found matching your search.',
    noHistory: 'No downloads yet',
    noHistoryDesc: 'Resolved media and downloaded files will appear here.',
    recentDownloads: 'Recent Downloads',
    clearHistory: 'Clear History',

    language: 'Language',
    langEn: 'English',
    langId: 'Bahasa Indonesia',

    categories: {
      downloaders: {
        name: 'DOWNLOADERS',
        description: 'Direct, ad-free media downloaders for all major social networks',
      },
      images: {
        name: 'IMAGES & ASSETS',
        description: 'Browser-based asset utilities, compression, and cryptographic encoders',
      },
      color: {
        name: 'COLOUR & DESIGN',
        description: 'Harmonious palettes, contrast verification, and token exports',
      },
    },

    tools: {
      tiktok: {
        title: 'TikTok Downloader',
        description: 'Download HD videos without watermark, audio MP3, and photo slides.',
      },
      instagram: {
        title: 'Instagram Downloader',
        description: 'Save Instagram Reels, Carousel posts, Photos, and Audio clips.',
      },
      youtube: {
        title: 'YouTube Downloader',
        description: 'Extract YouTube 1080p/720p videos, Shorts, and high-bitrate MP3s.',
      },
      twitter: {
        title: 'Twitter / X Downloader',
        description: 'Download Twitter (X) video clips, GIFs, and media attachments.',
      },
      capcut: {
        title: 'CapCut Downloader',
        description: 'Download clean CapCut video templates without watermark.',
      },
      facebook: {
        title: 'Facebook Downloader',
        description: 'Download high-definition public Facebook videos and reels.',
      },
      spotify: {
        title: 'Spotify Downloader',
        description: 'Fetch track metadata, Ultra HD 640x640 album covers, and full MP3 audio streams.',
      },
      soundcloud: {
        title: 'SoundCloud Downloader',
        description: 'Download SoundCloud tracks, DJ mixes, podcasts, and 500x500 Ultra HD artwork.',
      },
      terabox: {
        title: 'TeraBox Downloader',
        description: 'Fast direct download links for TeraBox cloud files and shared videos.',
      },
      'video-to-gif': {
        title: 'Video to GIF',
        description: 'Convert MP4, WebM, and MOV video clips into crisp animated GIFs with trimming, FPS, and speed controls.',
      },
      'audio-cutter': {
        title: 'Audio Extractor & Trimmer',
        description: 'Extract audio from video, inspect waveforms, and trim audio clips preserving original sample rates.',
      },
      'image-compressor': {
        title: 'Image Compressor',
        description: 'Compress PNG, JPG, WebP, SVG, AVIF, and GIF without reducing resolution or visual quality.',
      },
      'image-converter': {
        title: 'Image Format Converter',
        description: 'Batch convert PNG, JPG, WebP, AVIF, BMP, and Favicon ICO formats with instant ZIP download.',
      },
      'background-remover': {
        title: 'Background Remover',
        description: '100% Client-side AI neural segmentation to remove backgrounds instantly without server uploads.',
      },
      'pdf-tools': {
        title: 'PDF Studio',
        description: 'Merge multiple PDFs, split & extract pages, and convert photos to PDF completely in your browser.',
      },
      'svg-optimizer': {
        title: 'SVG Optimizer',
        description: 'Clean Figma bloatware, minify SVG paths, live preview, and export to Vue 3, React, or 4K PNG.',
      },
      'device-mockup': {
        title: 'Device Mockup Studio',
        description: 'Wrap screenshots into high-end iPhone 16 Pro, MacBook M3, and minimal 3D mockups for portfolio showcase.',
      },
      'qr-generator': {
        title: 'QR Code Generator',
        description: 'Generate styled QR codes with custom colors, error correction, and SVG/PNG download.',
      },
      'brat-generator': {
        title: 'Brat Text Generator',
        description: 'Generate authentic Charli XCX Brat album-style blurred text, memes, and word-by-word animated GIFs.',
      },
      'font-library': {
        title: 'Font Library',
        description: 'Browse, test, search Google Fonts & DaFont directory with live specimen previews and ZIP downloads.',
      },
      'color-converter': {
        title: 'Color Converter & Picker',
        description: 'Visual color picker with bi-directional HEX, RGB, CMYK, HSV, HSL translation & shades.',
      },
      'color-palette': {
        title: 'Color Palette Generator',
        description: 'Generate harmonious color palettes, check WCAG contrast, and copy CSS tokens.',
      },
      'base64-image': {
        title: 'Base64 & Hash Encoder',
        description: 'Convert files to Base64, generate SHA-256 / SHA-512 hashes via Web Crypto API.',
      },
      'code-to-image': {
        title: 'Code to Image Studio',
        description: 'Transform code snippets into aesthetic macOS/Windows screenshots with syntax highlighting & gradient backgrounds.',
      },
      'og-previewer': {
        title: 'Open Graph Previewer',
        description: 'Test, simulate, and generate social cards for Twitter, Discord, WhatsApp, Facebook, LinkedIn, and Google.',
      },
    },
  },
  id: {
    appName: 'Avttr Studio',
    appSubtitle: 'Nuxt 3 + shadcn',
    dashboard: 'Dashboard',
    allDownloaders: 'All Dashboard',
    socialDownloaders: 'Social Downloader',
    clientUtilities: 'Utilitas Klien',
    systemStorage: 'Sistem & Riwayat',
    downloadHistory: 'Riwayat Unduhan',
    quickSearch: 'Pencarian Cepat',
    userProfile: 'avttr',

    heroTitle: 'Alat olah media cepat, diproses langsung di perangkat.',
    heroSubtitle: 'Downloader serbaguna, pemotong audio, dan pengoptimal aset tanpa pelacakan server.',
    pastePlaceholder: 'Tempel link TikTok, Instagram, YouTube, Twitter/X, CapCut, Facebook, atau Spotify...',
    pasteBtn: 'Ambil Media',
    fetchingMedia: 'Mengambil Media...',
    browseTools: 'Jelajahi Utilitas',

    catDownloaders: 'DOWNLOADER',
    catDownloadersDesc: 'Download media langsung tanpa watermark untuk semua platform media sosial',
    catImages: 'GAMBAR & ASET',
    catImagesDesc: 'Utilitas kompresi gambar, generator aset, dan pengolahan lokal di browser',
    catColor: 'WARNA & DESAIN',
    catColorDesc: 'Palet warna harmonis, verifikasi kontras WCAG, dan mockup studio',
    videoSocials: 'Video & Sosial',
    audioMusic: 'Audio & Musik',
    assetGenerators: 'Generator Aset',
    designSystem: 'Sistem Desain',

    download: 'Download',
    downloadAllZip: 'Download Semua (ZIP)',
    downloadHd: 'Download HD',
    downloadAudio: 'Download Audio (MP3)',
    copyLink: 'Salin Link Langsung',
    copied: 'Tersalin ke Clipboard',
    clearAll: 'Hapus Semua',
    compare: 'Bandingkan',
    save: 'Simpan',
    close: 'Tutup',
    processing: 'Memproses...',
    dropImages: 'Tarik foto ke sini atau pilih file',
    dropImagesDesc: 'Mendukung PNG, JPG, JPEG, WebP, SVG, AVIF, GIF, BMP. Maksimal 5 foto per batch.',
    qualityPreset: 'Preset Kualitas',
    fineTune: 'Kualitas Detail',
    outputFormat: 'Format Output',
    beforeAfter: 'Perbandingan Sebelum & Sesudah',
    splitSlider: 'Split Slider',
    sideBySide: 'Berdampingan',
    original: 'Asli',
    compressed: 'Hasil Kompresi',
    clientPrivacy: 'Privasi Klien',

    addImages: 'Tambah Gambar',
    addMedia: 'Tambah Media',
    fetchVideo: 'Ambil Video',
    fetchImage: 'Ambil Foto',
    compressionMode: 'Mode Kompresi',
    smartLossless: 'Smart Lossless',
    recommended: 'Rekomendasi',
    maxCompression: 'Kompresi Maksimal',
    dropzoneBrowse: 'Drop file di sini atau klik untuk browse',
    dropzoneImageDesc: 'Mendukung PNG, JPG, JPEG, WebP, SVG, dan AVIF hingga 20MB. 100% diproses di browser.',
    dropzoneVideoDesc: 'Mendukung MP4, WebM, MOV, dan AVI hingga 100MB. 100% diproses di browser.',
    dropzoneAudioDesc: 'Mendukung MP4, WebM, MOV, MP3, WAV, AAC, M4A, OGG, dan FLAC. 100% diproses di browser.',

    searchPlaceholder: 'Cari tools, downloader, shortcut...',
    noResults: 'Tidak ada tools yang cocok dengan pencarian.',
    noHistory: 'Belum ada unduhan',
    noHistoryDesc: 'Media yang berhasil diunduh akan tersimpan otomatis di sini.',
    recentDownloads: 'Riwayat Unduhan',
    clearHistory: 'Bersihkan Riwayat',

    language: 'Bahasa',
    langEn: 'English',
    langId: 'Bahasa Indonesia',

    categories: {
      downloaders: {
        name: 'DOWNLOADER',
        description: 'Download media langsung tanpa watermark untuk semua platform media sosial',
      },
      images: {
        name: 'GAMBAR & ASET',
        description: 'Utilitas kompresi gambar, generator aset, dan pengolahan lokal di browser',
      },
      color: {
        name: 'WARNA & DESAIN',
        description: 'Palet warna harmonis, verifikasi kontras WCAG, dan mockup studio',
      },
    },

    tools: {
      tiktok: {
        title: 'TikTok Downloader',
        description: 'Download video HD tanpa watermark, audio MP3, dan slide foto.',
      },
      instagram: {
        title: 'Instagram Downloader',
        description: 'Simpan Reels, postingan Carousel, foto, dan audio klip Instagram.',
      },
      youtube: {
        title: 'YouTube Downloader',
        description: 'Download video YouTube 1080p/720p, Shorts, dan audio MP3 kualitas tinggi.',
      },
      twitter: {
        title: 'Twitter / X Downloader',
        description: 'Download klip video Twitter (X), animasi GIF, dan lampiran media.',
      },
      capcut: {
        title: 'CapCut Downloader',
        description: 'Download template video CapCut bersih tanpa watermark.',
      },
      facebook: {
        title: 'Facebook Downloader',
        description: 'Download video dan reels publik Facebook kualitas HD.',
      },
      spotify: {
        title: 'Spotify Downloader',
        description: 'Ambil metadata lagu, cover album HD 640x640, dan audio MP3 penuh.',
      },
      soundcloud: {
        title: 'SoundCloud Downloader',
        description: 'Download lagu SoundCloud, DJ mix, podcast, dan artwork cover HD.',
      },
      terabox: {
        title: 'TeraBox Downloader',
        description: 'Link download langsung cepat untuk file cloud dan video TeraBox.',
      },
      'video-to-gif': {
        title: 'Video to GIF',
        description: 'Ubah klip video MP4, WebM, dan MOV ke animasi GIF dengan kontrol trim dan FPS.',
      },
      'audio-cutter': {
        title: 'Audio Extractor & Trimmer',
        description: 'Ekstrak audio dari video, inspeksi waveform, dan potong klip audio.',
      },
      'image-compressor': {
        title: 'Image Compressor',
        description: 'Kompres foto PNG, JPG, WebP, SVG, AVIF, dan GIF tanpa mengurangi resolusi.',
      },
      'image-converter': {
        title: 'Image Format Converter',
        description: 'Konversi batch format gambar dan buat favicon ICO resolusi multi-layer.',
      },
      'background-remover': {
        title: 'Background Remover',
        description: 'Hapus background foto otomatis 100% di browser dengan AI lokal tanpa upload.',
      },
      'pdf-tools': {
        title: 'PDF Studio',
        description: 'Gabungkan file PDF, pisahkan halaman, dan ubah foto ke dokumen PDF di browser.',
      },
      'svg-optimizer': {
        title: 'SVG Optimizer',
        description: 'Bersihkan kode SVG, preview langsung, dan export ke komponen Vue 3 / React.',
      },
      'device-mockup': {
        title: 'Device Mockup Studio',
        description: 'Pasang screenshot ke frame 3D iPhone 16 Pro, MacBook M3, dan mockup minimalis.',
      },
      'qr-generator': {
        title: 'QR Code Generator',
        description: 'Buat QR code bergaya dengan warna kustom, logo, dan download SVG/PNG.',
      },
      'brat-generator': {
        title: 'Brat Text Generator',
        description: 'Generator teks dan animasi GIF bergaya album Brat Charli XCX.',
      },
      'font-library': {
        title: 'Font Library',
        description: 'Jelajahi dan coba langsung ribuan font dari Google Fonts & DaFont.',
      },
      'color-converter': {
        title: 'Color Converter & Picker',
        description: 'Color picker visual dengan konversi dua arah HEX, RGB, CMYK, HSV, dan HSL.',
      },
      'color-palette': {
        title: 'Color Palette Generator',
        description: 'Generate palet warna harmonis, cek kontras aksesibilitas WCAG, dan salin CSS token.',
      },
      'base64-image': {
        title: 'Base64 & Hash Encoder',
        description: 'Konversi file ke Base64 dan generate hash SHA-256 / SHA-512 via Web Crypto API.',
      },
      'code-to-image': {
        title: 'Code to Image Studio',
        description: 'Ubah kode pemrograman menjadi screenshot mockup yang rapi dan elegan.',
      },
      'og-previewer': {
        title: 'Open Graph Previewer',
        description: 'Preview tampilan kartu link untuk Twitter, Discord, WhatsApp, Facebook, dan Google.',
      },
    },
  },
}

const currentLocale = ref<Locale>('en')
const isLocaleLoaded = ref(false)

export function useI18n() {
  const initLocale = () => {
    if (import.meta.client && !isLocaleLoaded.value) {
      const saved = localStorage.getItem('avttr_locale') as Locale | null
      if (saved === 'en' || saved === 'id') {
        currentLocale.value = saved
      } else {
        // Auto-detect from user browser system language
        const navLang = (navigator.language || (navigator as any).userLanguage || '').toLowerCase()
        if (navLang.startsWith('id') || navLang.startsWith('in')) {
          currentLocale.value = 'id'
        } else {
          currentLocale.value = 'en'
        }
      }
      isLocaleLoaded.value = true
    }
  }

  const setLocale = (locale: Locale) => {
    currentLocale.value = locale
    if (import.meta.client) {
      localStorage.setItem('avttr_locale', locale)
    }
  }

  const toggleLocale = () => {
    const next = currentLocale.value === 'en' ? 'id' : 'en'
    setLocale(next)
  }

  const t = computed(() => translations[currentLocale.value] || translations.en)

  onMounted(() => {
    initLocale()
  })

  return {
    locale: currentLocale,
    t,
    setLocale,
    toggleLocale,
    initLocale,
  }
}
