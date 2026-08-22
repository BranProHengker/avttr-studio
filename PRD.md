# Product Requirements Document (PRD)
## Project: Avttr Studio (Shadcnblocks Edition — All-in-One Productivity Hub & Multi-Downloader)

### 1. Overview & Problem Statement
* **Background:** Web utilities and social media downloaders on the internet are plagued by aggressive popups, intrusive redirect ads, deceptive click targets, captcha walls, and privacy-invasive tracking.
* **Goal:** Build **Avttr Studio** — a fast, privacy-focused, zero-ads personal web suite and multi-platform media downloader built with Nuxt 3 and designed in the high-density, professional aesthetic of **Shadcnblocks Admin Kit**.
* **Primary Value Proposition:** Single-click media downloading from 15+ social media platforms without ads, combined with client-side browser productivity tools (images, colors, developer formatters), streaming proxy, and local history.

---

### 2. Target Users & Core Personas
* **Primary User:** Content creator, developer, and power user (Personal Use) who requires rapid extraction of raw media assets (videos, audio, photos) and everyday developer/design utilities without leaving a clean desktop/mobile environment.

---

### 3. Key Feature Modules

#### A. Universal Social Media Downloader (Priority 1)
* **Smart Universal Input:** Single omnibox at the top of the dashboard. Pasting any supported link automatically sanitizes the URL, resolves redirects, identifies the platform, triggers parsing, and displays rich media previews.
* **Supported Platforms & Outputs:**
  1. **TikTok:** HD Video (No Watermark), SD Video, Audio (MP3), Carousel Photo Slides.
  2. **Instagram:** Reels (MP4 HD), Posts/Carousels (Multiple images/videos), Audio stream.
  3. **YouTube:** Shorts, Video (1080p/720p/360p MP4), Audio Only (M4A/MP3), Thumbnail extract.
  4. **Twitter / X:** Video (MP4 HD), GIF, Media attachments.
  5. **Facebook:** Public video (HD/SD MP4).
  6. **CapCut:** Clean template video without app overlays.
  7. **Spotify & SoundCloud:** Track metadata, album artwork, and audio preview/download stream.
  8. **Pinterest & Threads:** High-resolution images and video clips.
* **Stream Proxy (`/api/proxy`):** Direct stream piping with `Content-Disposition: attachment` to prevent CORS issues and prevent videos from just opening in a new tab.
* **Batch Multi-Image Archiver (JSZip):** 1-click "Download All as ZIP" for Instagram Carousels and TikTok Photo Slides.
* **URL Sanitizer & Unshortener (`sanitizer.ts`):** Strips UTM tracking codes, resolves shortlinks (`vt.tiktok.com`, `youtu.be`, `t.co`).
* **In-Memory Caching (10 min TTL):** Prevents duplicate platform scrapes for repeated URL lookups.
* **Backend Architecture (Dual-Engine Fallback):**
  * **Primary Engine:** High-performance direct mobile API parsers & native stream extractors.
  * **Fallback Engine:** Cobalt engine endpoints & secondary open-source scrapers with auto-cascade on failure.

#### B. Categorized Web Utilities & Dev Tools (Priority 2 - Delphi & Dev Suite)
* **Images & Assets:**
  * Image Format Converter (WebP, PNG, JPEG, SVG).
  * Styled QR Code Generator & Scanner (Live camera scan + custom colors & SVG/PNG export).
  * Base64 Image & File Encoder/Decoder.
* **Color & Design:**
  * Color Palette Generator & Harmonizer.
  * WCAG AA/AAA Contrast Checker.
  * CSS Gradient Maker (Linear, Radial, Mesh).
  * HEX / RGB / HSL / OKLCH Converter.
* **Developer & Text Tools:**
  * JSON Formatter, Validator, Minifier & Tree Viewer.
  * Base64 / URL / JWT Encoder & Decoder.
  * Hash Generator (MD5, SHA-1, SHA-256, SHA-512).
  * Regex Tester with cheat sheet & sample library.
  * Text Diff Checker & Case Converter.

---

### 4. User Experience & Navigation Structure
* **Sidebar (Collapsible 280px):**
  * Brand Header: Logo + "Avttr Studio" + Version pill.
  * Global Search Trigger (`Ctrl + K` / `⌘K`).
  * Navigation Sections with live item counters (Downloaders, Images, Color, Dev Tools).
  * Footer: Download History trigger & privacy guarantee.
* **Dashboard View:**
  * Quick Hero: Universal Paste Bar with clipboard auto-detect.
  * Section Headers with item counters (e.g. `DOWNLOADERS 8`, `DEV & TEXT 5`).
  * Shadcnblocks Tool Cards: Platform/Tool Icon, Title, Status Tag (`Fast`, `HD`, `New`), Description, and 1-click action.
* **Toast Notification System:** Centralized toasts for success, warnings (fallback in progress), and errors.
* **Local History Drawer:** 100% client-side `localStorage` storing the last 20 downloaded items for instant re-download.

---

### 5. Non-Functional Requirements
* **Performance:** Server-side API response time < 1.5s for downloader resolvers; 0ms latency for client-side WASM/Canvas tools.
* **Privacy:** Zero tracking scripts, zero Google Analytics, no user logs stored on server.
* **Architecture:** Unified Single Nuxt 3 Fullstack repository for zero CORS overhead and instant maintenance.
