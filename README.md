# Avttr Studio

[English](#avttr-studio) | [Bahasa Indonesia](#bahasa-indonesia)

Live website: [studio.avttr.my.id](https://studio.avttr.my.id)

Avttr Studio is a personal web workspace built with Nuxt 3 that pairs ad-free multi-platform media downloaders with client-side utilities for design, audio, and development work.

The project exists for a straightforward reason: to make everyday digital tasks easier. Many open-source repositories and utility libraries on GitHub are genuinely useful, but having to run `git clone`, configure runtimes, and install local packages just for a quick one-off task is tedious.

Every utility here is completely free to use, requires no account or login, and comes with zero ads or tracking pop-ups. Data safety is built in by design: almost all file processing tasks (image compression, PDF editing, audio trimming, data hashing) run 100% locally inside your browser, meaning your files are never uploaded to or stored on any server.

---

## Available features

### 1. Media downloaders

All downloaders use a unified dashboard omnibar with auto-detection and a streaming backend proxy to prevent CORS issues.

- **TikTok Downloader**: download HD video without watermark, extract MP3 audio, and save photo slides as a ZIP archive.
- **Instagram Downloader**: download Reels, single photos, and multi-slide carousels packed directly into a ZIP file.
- **YouTube Downloader**: download MP4 videos (1080p, 720p, 360p), YouTube Shorts, and extract MP3 audio.
- **Twitter / X Downloader**: download MP4 video clips and animated GIFs from posts.
- **Spotify Downloader**: fetch track metadata, high-resolution album cover art (640x640), and MP3 audio streams.
- **SoundCloud Downloader**: download songs, DJ mixes, podcasts, and original artwork.
- **Facebook Downloader**: download public videos and Facebook Reels in HD/SD quality.
- **CapCut Downloader**: download clean template videos without app watermarks or overlays.
- **TeraBox Downloader**: generate direct download links for shared cloud files and videos.

### 2. Images and visual assets

Every tool in this section runs entirely in the browser using WebAssembly, the Canvas API, or Web Workers.

- **Image Compressor**: compress PNG, JPG, WebP, SVG, AVIF, and GIF images with a visual comparison slider (split slider and side-by-side modes) before downloading.
- **Image Format Converter**: batch convert between PNG, JPG, WebP, AVIF, BMP, and ICO favicon formats with one-click ZIP export.
- **Background Remover**: remove image backgrounds automatically using a WebAssembly neural segmentation model without uploading files to any server.
- **Sticker Studio**: create WhatsApp and Telegram stickers with auto white outlines, custom captions, and 512x512 WebP export.
- **Anime Scene Search**: identify anime titles, episode numbers, and timestamps from screenshot frames using trace.moe.
- **SVG Optimizer**: strip unnecessary Figma and Illustrator metadata, minify SVG paths, and export Vue 3 or React components.
- **Code to Image Studio**: turn code snippets into macOS or Windows styled screenshots with PrismJS syntax highlighting and gradient backgrounds.
- **Device Mockup Studio**: wrap application screenshots into iPhone 16 Pro, MacBook M3, or clay 3D device frames for portfolios.
- **QR Code Generator**: create custom QR codes with color controls, error correction levels, logo placement, and SVG/PNG export.
- **Brat Text Generator**: generate Charli XCX Brat album style text with blur effects and word-by-word animated GIF export.
- **PDF Studio**: merge PDFs, split or extract pages, and convert photos to PDF documents in the browser via pdf-lib.
- **Video to GIF & Video Resizer**: trim clip length, adjust resolution, configure FPS, and convert videos to GIF directly in the browser.
- **Teleprompter Video Studio**: webcam recorder with floating cue cards, adjustable pace timers, and keyboard hotkeys.

### 3. Colors and typography

- **Color Palette Generator**: build balanced palettes, check WCAG contrast compliance (AA/AAA), and export CSS custom properties.
- **Color Converter & Picker**: visual picker with two-way translation between HEX, RGB, CMYK, HSL, HSV, and shade matrix calculations.
- **Font Library**: search and test hundreds of Google Fonts and DaFont typefaces with live text specimens and font downloads.
- **Open Graph Previewer**: preview and debug social sharing cards for Twitter, Discord, WhatsApp, LinkedIn, Facebook, and Google Search.

### 4. Developer and security

- **SkillSpector**: static AST security inspector for AI agent skill files (SKILL.md) to detect prompt injections, secret token leaks, and risky bash commands.
- **SlopSpector**: forensic web inspector to detect AI boilerplate templates (v0, Lovable, Bolt), buzzwords, and default styling fingerprints.
- **Link Bypasser & Redirect Tracer**: trace complete HTTP redirect chains, bypass shortener link hops, and strip marketing tracking parameters (UTM, igsh).
- **Web Security Header Inspector**: audit HTTP security headers (CSP, HSTS, X-Frame-Options, Permissions-Policy) and generate remediation snippets.
- **Base64 & Hash Studio**: encode files to Base64 and compute SHA-256 / SHA-512 cryptographic hashes using the native Web Crypto API.
- **PairDrop**: direct, encrypted peer-to-peer file sharing between devices on the same local network using WebRTC without cloud storage.
- **Doc to Markdown**: convert documents and screenshots into structured GitHub Markdown.
- **LRC Lyrics Studio**: generate synchronized .lrc lyrics with LRCLIB integration and automatic Romaji transliteration for Japanese tracks.

---

## Tech stack

- **Framework**: Nuxt 3 (Vue 3 + Nitro Engine)
- **Styling**: Tailwind CSS v4 with design tokens
- **Icons**: Iconoir (`@iconoir/vue`)
- **Key libraries**: VueUse, JSZip, pdf-lib, PrismJS, mediabunny, ofetch
- **Backend scraper**: Nitro server routes with Cobalt API fallback

---

## Contribution guide

Avttr Studio is an open-source project. Contributions for new tools, bug fixes, or scraper improvements are welcome.

All contributions must go through a standard GitHub Pull Request (PR). Every PR is reviewed and tested by the project owner before being merged into the main branch.

### Workflow:

1. **Fork the repository**
   Click the **Fork** button at the top right of this repository to create a copy under your GitHub account.

2. **Clone your fork locally**
   ```bash
   git clone https://github.com/<your-username>/avttr-studio.git
   cd avttr-studio
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Create a new branch**
   Use a concise branch name that describes your change:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/scraper-issue
   ```

5. **Build your feature following project rules**
   If you add a new tool or downloader, register it in the **5 synchronization points** (refer to `AGENTS.md` and `DESIGN.md`):
   - **Search palette**: add the tool entry in `composables/useSearch.ts`.
   - **Internationalization (i18n)**: add dictionary entries in `composables/useI18n.ts` for both Indonesian (`id`) and English (`en`).
   - **Sidebar navigation**: register the route in `components/layout/AppSidebar.vue`.
   - **Brand icon**: use `@iconoir/vue` or add a clean SVG in `components/ui/BrandIcon.vue` for external brands.
   - **README documentation**: add the tool description to both the English and Indonesian feature catalogs in `README.md`.

   **Key styling standards:**
   - Use atomic UI components from `components/ui/` (`Button`, `Input`, `Card`, `Badge`). Avoid inline raw HTML tags with inconsistent utility classes.
   - Follow the **Anti-Over-Carding** rule: do not wrap solitary icon buttons, small triggers, or inline notices in heavy card containers. Keep them unboxed and clean.
   - Client-side tools must not send user data (images, documents, text) to the server unless external resolution is strictly required.

6. **Run type verification**
   Make sure there are zero TypeScript compiler errors:
   ```bash
   npx vue-tsc --noEmit
   ```
   This command must exit with code 0.

7. **Commit and push**
   ```bash
   git add .
   git commit -m "feat: add new tool name"
   git push origin feat/your-feature-name
   ```

8. **Open a Pull Request**
   - Go to the main repository: `https://github.com/BranProHengker/avttr-studio`.
   - Click **Compare & pull request**.
   - Write a clear summary of what was added or fixed, and include a screenshot for visual changes.
   - The owner will review your PR for functionality, styling consistency, and security before merging.

---

## Local development

### Prerequisites:
- Node.js version 18.x or 20.x
- npm or pnpm

### Getting started:

```bash
# Clone repository
git clone https://github.com/BranProHengker/avttr-studio.git
cd avttr-studio

# Install dependencies
npm install

# Start local dev server
npm run dev
```

Open your browser at `http://localhost:3000`.

### Production build:

```bash
npm run build
```

The output files will be generated in `.output/` and are ready for deployment on any Node.js environment or serverless platform.

---

## License and author

This project is licensed under the [MIT License](LICENSE).
Author website: [heybran.my.id](https://heybran.my.id) | GitHub: [@BranProHengker](https://github.com/BranProHengker)

---

# Bahasa Indonesia

[English](#avttr-studio) | [Bahasa Indonesia](#bahasa-indonesia)

Situs web langsung: [studio.avttr.my.id](https://studio.avttr.my.id)

Avttr Studio adalah web workspace personal berbasis Nuxt 3 yang menggabungkan multi-platform media downloader tanpa iklan dengan puluhan utility client-side untuk kebutuhan desain, audio, dan developer.

Proyek ini dibuat untuk satu alasan sederhana: mempermudah rutinitas digital sehari-hari. Banyak library dan repositori open-source keren di GitHub yang sebenarnya sangat berguna, tetapi merepotkan kalau harus melakukan `git clone`, konfigurasi runtime, dan instalasi dependensi lokal hanya untuk menyelesaikan tugas kecil.

Semua tool di sini bisa diakses gratis, tanpa perlu membuat akun atau login, dan tanpa gangguan iklan atau pop-up. Yang terpenting, privasi data aman: hampir seluruh pemrosesan berkas (kompresi gambar, manipulasi PDF, audio cutting, ekstraksi data) berjalan 100% lokal di browser pengguna tanpa pernah dikirim atau disimpan di server mana pun.

---

## Fitur yang tersedia

### 1. Media downloaders

Semua downloader menggunakan input omnibar terpadu di dashboard dengan auto-detect platform dan stream proxy backend untuk menghindari masalah CORS.

- **TikTok Downloader**: unduh video HD tanpa watermark, audio MP3 terpisah, dan slide foto dalam format ZIP.
- **Instagram Downloader**: unduh Reels, postingan foto tunggal, dan carousel multi-slide langsung di-pack ke ZIP.
- **YouTube Downloader**: unduh video MP4 (resolusi 1080p, 720p, 360p), YouTube Shorts, dan audio MP3.
- **Twitter / X Downloader**: unduh klip video MP4 dan animasi GIF dari cuitan.
- **Spotify Downloader**: ambil metadata lagu, cover art resolusi tinggi (640x640), dan stream audio MP3.
- **SoundCloud Downloader**: unduh lagu, podcast, DJ set, dan artwork asli.
- **Facebook Downloader**: unduh video publik dan Facebook Reels dalam kualitas HD/SD.
- **CapCut Downloader**: unduh video template bersih tanpa watermark atau overlay aplikasi.
- **TeraBox Downloader**: generate tautan unduhan langsung untuk berkas cloud dan video yang dibagikan.

### 2. Gambar dan aset visual

Semua tool di kategori ini diproses langsung di browser menggunakan WebAssembly, Canvas API, atau Web Workers.

- **Image Compressor**: kompresi gambar PNG, JPG, WebP, SVG, AVIF, dan GIF dengan slider pembanding visual (split slider dan side-by-side) sebelum diunduh.
- **Image Format Converter**: konversi massal berkas gambar antar format (PNG, JPG, WebP, AVIF, BMP, dan favicon ICO) dengan unduhan satu berkas ZIP.
- **Background Remover**: hapus latar belakang foto otomatis menggunakan model segmentasi neural berbasis WebAssembly tanpa kirim gambar ke server.
- **Sticker Studio**: buat stiker WhatsApp dan Telegram dengan outline putih otomatis, editor teks caption, dan ekspor WebP 512x512.
- **Anime Scene Search**: cari judul anime, nomor episode, dan timestamp detik dari potongan gambar screenshot via integrasi trace.moe.
- **SVG Optimizer**: bersihkan metadata berlebih dari ekspor Figma atau Illustrator, minify path, dan salin kode komponen untuk Vue 3 atau React.
- **Code to Image Studio**: ubah potongan kode menjadi tangkapan layar bergaya macOS atau Windows dengan syntax highlighting PrismJS dan latar gradien.
- **Device Mockup Studio**: masukkan screenshot aplikasi ke dalam frame iPhone 16 Pro, MacBook M3, atau clay mockup 3D untuk kebutuhan portofolio.
- **QR Code Generator**: buat kode QR kustom dengan pengaturan warna, tingkat koreksi error, penempatan logo, dan ekspor format SVG/PNG.
- **Brat Text Generator**: generator teks bergaya album Brat dari Charli XCX dengan efek blur dan ekspor animasi GIF kata demi kata.
- **PDF Studio**: gabung beberapa PDF, pisah atau ekstrak halaman, dan ubah foto ke dokumen PDF secara lokal via pdf-lib.
- **Video to GIF & Video Resizer**: potong durasi klip video, atur resolusi, ubah FPS, dan konversi ke animasi GIF langsung di browser.
- **Teleprompter Video Studio**: perekam webcam dengan kartu contekan melayang, pengatur tempo, dan pintasan keyboard untuk latihan presentasi.

### 3. Warna dan tipografi

- **Color Palette Generator**: buat kombinasi palet warna harmonis, cek rasio kontras WCAG (AA/AAA), dan ekspor variabel token CSS.
- **Color Converter & Picker**: color picker visual dengan konversi dua arah antara HEX, RGB, CMYK, HSL, HSV, dan matriks shade warna.
- **Font Library**: eksplorasi dan tes ratusan font dari Google Fonts dan DaFont dengan live preview input teks serta unduhan berkas font.
- **Open Graph Previewer**: simulator kartu media sosial untuk mengecek tampilan link di Twitter, Discord, WhatsApp, LinkedIn, Facebook, dan Google Search.

### 4. Developer dan keamanan

- **SkillSpector**: alat audit statis AST untuk file SKILL.md agent AI (Antigravity/Claude Code) guna mendeteksi injeksi prompt, kebocoran token rahasia, dan perintah eksekusi berbahaya.
- **SlopSpector**: pemindai kode web untuk mendeteksi artefak template AI slop (v0, Lovable, Bolt), kelebihan buzzword, dan audit token desain bawaan.
- **Link Bypasser & Redirect Tracer**: telusuri rantai pengalihan HTTP lengkap, lewati pemendek URL iklan (seperti linkvertise atau adfly), dan bersihkan parameter pelacak (UTM, igsh).
- **Web Security Header Inspector**: analisis konfigurasi header keamanan HTTP (CSP, HSTS, X-Frame-Options, Permissions-Policy) dengan rekomendasi cuplikan konfigurasi server.
- **Base64 & Hash Studio**: konversi berkas ke Base64 serta hitung hash kriptografi SHA-256 dan SHA-512 menggunakan Web Crypto API asli browser.
- **PairDrop**: transfer berkas peer-to-peer antar perangkat dalam satu jaringan lokal via WebRTC terenkripsi tanpa perantara penyimpanan server.
- **Doc to Markdown**: ekstraksi berkas dokumen dan tangkapan layar menjadi teks terstruktur GitHub Markdown.
- **LRC Lyrics Studio**: generator lirik lagu tersinkronisasi (.lrc) dengan database LRCLIB dan transliterasi romaji otomatis untuk lagu berbahasa Jepang.

---

## Panduan kontribusi

Proyek ini terbuka untuk umum (open-source). Siapa saja boleh menambahkan tool baru, memperbaiki bug, atau meningkatkan efisiensi scraper yang sudah ada.

Semua penambahan fitur baru akan dicek terlebih dahulu melalui Pull Request (PR) oleh pemilik repositori sebelum di-merge ke branch utama.

### Alur kerja kontribusi:

1. **Fork repositori**
   Buka repositori ini di GitHub dan klik tombol **Fork** di pojok kanan atas ke akun GitHub milikmu.

2. **Clone hasil fork ke lokal**
   ```bash
   git clone https://github.com/<username-kamu>/avttr-studio.git
   cd avttr-studio
   ```

3. **Pasang dependencies**
   ```bash
   npm install
   ```

4. **Buat branch baru**
   Gunakan nama branch deskriptif sesuai fitur atau perbaikan yang dikerjakan:
   ```bash
   git checkout -b feat/nama-tool-baru
   # atau
   git checkout -b fix/perbaikan-scraper-tiktok
   ```

5. **Kembangkan fitur dengan mematuhi aturan proyek**
   Jika kamu menambahkan tool baru, pastikan mendaftarkan tool tersebut di **5 titik sinkronisasi** (baca juga aturan lengkap di `AGENTS.md` dan `DESIGN.md`):
   - **Command palette / search**: tambahkan entri tool di `composables/useSearch.ts`.
   - **Internasionalisasi (i18n)**: tambahkan kamus teks di `composables/useI18n.ts` untuk bahasa Indonesia (`id`) dan bahasa Inggris (`en`).
   - **Navigasi sidebar**: daftarkan rute tool di `components/layout/AppSidebar.vue`.
   - **Ikon**: gunakan `@iconoir/vue` atau daftarkan SVG vektor di `components/ui/BrandIcon.vue` jika itu logo platform pihak ketiga.
   - **Dokumentasi README**: tambahkan ringkasan tool baru ke daftar fitur bahasa Inggris dan bahasa Indonesia di `README.md`.

   **Aturan styling penting:**
   - Gunakan komponen atom dari `components/ui/` (`Button`, `Input`, `Card`, `Badge`). Jangan menulis tag HTML mentah dengan inline class yang tidak konsisten.
   - Patuhi aturan **Anti-Over-Carding**: jangan membungkus setiap elemen kecil, tombol ikon tunggal, atau teks info ke dalam card atau bento box tebal. Gunakan layout unboxed yang bersih.
   - Tool client-side dilarang mengirim data privat pengguna (gambar, teks, PDF) ke server kecuali benar-benar membutuhkan resolver backend.

6. **Verifikasi kode sebelum commit**
   Pastikan tidak ada error TypeScript atau syntax yang rusak:
   ```bash
   npx vue-tsc --noEmit
   ```
   Pastikan perintah di atas menghasilkan exit code 0 tanpa error.

7. **Commit dan push**
   Tulis pesan commit yang singkat dan jelas:
   ```bash
   git add .
   git commit -m "feat: tambah tool nama-tool"
   git push origin feat/nama-tool-baru
   ```

8. **Buka Pull Request (PR)**
   - Masuk ke repositori utama di GitHub: `https://github.com/BranProHengker/avttr-studio`.
   - Klik **Compare & pull request**.
   - Berikan deskripsi ringkas mengenai apa yang ditambahkan atau diperbaiki, serta screenshot jika ada perubahan visual antarmuka.
   - Tunggu proses review. Jika ada catatan atau masukan penyesuaian, diskusikan di kolom komentar PR. Setelah lolos review, PR akan di-merge ke branch `main`.

---

## Menjalankan proyek di lokal

### Prasyarat:
- Node.js versi 18.x atau 20.x
- npm atau pnpm

### Langkah instalasi:

```bash
# Clone repository
git clone https://github.com/BranProHengker/avttr-studio.git
cd avttr-studio

# Install dependensi
npm install

# Jalankan server development
npm run dev
```

Buka peramban di `http://localhost:3000`.

### Build untuk produksi:

```bash
npm run build
```

Hasil build akan berada di direktori `.output/` dan siap dideploy ke platform hosting seperti VPS, Vercel, Netlify, atau Node.js server.

---

## Lisensi dan pembuat

Proyek ini dilisensikan di bawah [MIT License](LICENSE).
Situs web pembuat: [heybran.my.id](https://heybran.my.id) | GitHub: [@BranProHengker](https://github.com/BranProHengker)
