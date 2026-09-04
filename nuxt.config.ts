import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  telemetry: false,

  css: ['~/assets/css/main.css'],

  modules: [
    '@vueuse/nuxt',
  ],

  vite: {
    plugins: [
      tailwindcss(),
    ],
  },

  app: {
    head: {
      title: 'Avttr Studio — All-in-One Productivity Hub & Media Downloader',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content: 'High-performance, ad-free personal web suite and multi-downloader for TikTok, Instagram, YouTube, Spotify, with AI background remover, QR code generator, and 80+ fonts.',
        },
        // Open Graph / Facebook / Discord / WhatsApp
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: 'https://studio.avttr.my.id/' },
        { property: 'og:title', content: 'Avttr Studio — All-in-One Productivity Hub & Media Downloader' },
        { property: 'og:description', content: 'High-performance, ad-free personal web suite and multi-downloader for TikTok, Instagram, YouTube, Spotify, with AI background remover, QR code generator, and 80+ fonts.' },
        { property: 'og:image', content: '/og-image.png' },
        { property: 'og:image:width', content: '1280' },
        { property: 'og:image:height', content: '720' },
        { property: 'og:image:type', content: 'image/png' },
        // Twitter Cards
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Avttr Studio — All-in-One Productivity Hub & Media Downloader' },
        { name: 'twitter:description', content: 'High-performance, ad-free personal web suite and multi-downloader for TikTok, Instagram, YouTube, Spotify, with AI background remover, QR code generator, and 80+ fonts.' },
        { name: 'twitter:image', content: '/og-image.png' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'shortcut icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
        },
      ],
    },
  },

  nitro: {
    storage: {
      cache: {
        driver: 'memory',
      },
    },
  },

  runtimeConfig: {
    removeBgApiKey: process.env.REMOVE_BG_API_KEY || '',
  },
})
