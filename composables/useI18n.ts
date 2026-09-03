import { ref, computed, onMounted } from 'vue'

export type Locale = 'en' | 'id'

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

  // Tools & Downloaders
  videoSocials: string
  audioMusic: string
  assetGenerators: string
  designSystem: string
  imageCompressor: string
  imageCompressorDesc: string
  qrStudio: string
  qrStudioDesc: string
  hashStudio: string
  hashStudioDesc: string
  colorStudio: string
  colorStudioDesc: string

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

    heroTitle: 'Avttr Studio Dashboard',
    heroSubtitle: 'High-performance Swiss Army knife for fast social media downloading and client-side browser developer utilities.',
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
    imageCompressor: 'Image Compressor',
    imageCompressorDesc: 'Smart visually-lossless compression for PNG, JPG, WebP, SVG, AVIF without reducing resolution.',
    qrStudio: 'QR Code Studio',
    qrStudioDesc: 'Generate styled QR codes with custom colors, error correction, and SVG/PNG download.',
    hashStudio: 'Base64 & Hash Studio',
    hashStudioDesc: 'Convert files to Base64, generate SHA-256 / SHA-512 hashes via Web Crypto API.',
    colorStudio: 'Color Palette Studio',
    colorStudioDesc: 'Generate harmonious color palettes, check WCAG contrast, and copy CSS tokens.',

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

    searchPlaceholder: 'Search tools, downloaders, shortcuts...',
    noResults: 'No tools found matching your search.',
    noHistory: 'No downloads yet',
    noHistoryDesc: 'Resolved media and downloaded files will appear here.',
    recentDownloads: 'Recent Downloads',
    clearHistory: 'Clear History',

    language: 'Language',
    langEn: 'English',
    langId: 'Bahasa Indonesia',
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

    heroTitle: 'Dashboard Avttr Studio',
    heroSubtitle: 'Alat serbaguna berkinerja tinggi untuk mengunduh media sosial cepat dan utilitas developer browser client-side.',
    pastePlaceholder: 'Tempel link TikTok, Instagram, YouTube, Twitter/X, CapCut, Facebook, atau Spotify...',
    pasteBtn: 'Ambil Media',
    fetchingMedia: 'Mengambil Media...',
    browseTools: 'Jelajahi Utilitas',

    catDownloaders: 'DOWNLOADER',
    catDownloadersDesc: 'Pengunduh media langsung tanpa iklan untuk semua platform media sosial',
    catImages: 'GAMBAR & ASET',
    catImagesDesc: 'Utilitas kompresi gambar, generator aset, dan enkripsi kriptografi lokal',
    catColor: 'WARNA & DESAIN',
    catColorDesc: 'Palet warna harmonis, verifikasi kontras WCAG, dan ekspor token CSS',

    videoSocials: 'Video & Sosial',
    audioMusic: 'Audio & Musik',
    assetGenerators: 'Generator Aset',
    designSystem: 'Sistem Desain',
    imageCompressor: 'Image Compressor',
    imageCompressorDesc: 'Kompresi cerdas tanpa merusak kualitas/resolusi untuk PNG, JPG, WebP, SVG, AVIF.',
    qrStudio: 'QR Code Studio',
    qrStudioDesc: 'Buat kode QR bergaya dengan warna kustom, koreksi error, dan unduh SVG/PNG.',
    hashStudio: 'Base64 & Hash Studio',
    hashStudioDesc: 'Konversi file ke Base64, generate hash SHA-256 / SHA-512 via Web Crypto API.',
    colorStudio: 'Color Palette Studio',
    colorStudioDesc: 'Generate palet warna harmonis, cek kontras WCAG, dan salin token CSS.',

    download: 'Unduh',
    downloadAllZip: 'Unduh Semua (ZIP)',
    downloadHd: 'Unduh Video HD',
    downloadAudio: 'Unduh Audio (MP3)',
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

    searchPlaceholder: 'Cari tools, downloader, shortcut...',
    noResults: 'Tidak ada tools yang cocok dengan pencarian.',
    noHistory: 'Belum ada unduhan',
    noHistoryDesc: 'Media yang berhasil diunduh akan tersimpan otomatis di sini.',
    recentDownloads: 'Riwayat Unduhan',
    clearHistory: 'Bersihkan Riwayat',

    language: 'Bahasa',
    langEn: 'English',
    langId: 'Bahasa Indonesia',
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
