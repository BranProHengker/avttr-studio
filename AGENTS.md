# AGENTS.md — Development Guidelines for Avttr Studio

## 1. Project Overview & Architecture
* **Project Name:** Avttr Studio
* **Tech Stack:**
  * **Framework:** Nuxt 3 (Fullstack Vue 3 + Nitro Server Engine) — *Unified Single Repository*
  * **Language:** TypeScript
  * **Styling:** Tailwind CSS v4 + Design Tokens (`DESIGN.md`)
  * **Icons & Utilities:** `lucide-vue-next`, `@vueuse/core`, `jszip`
  * **Engine / Scrapers:** Nitro routes (`/server/api/download/...`), `ofetch`, Cheerio, and Cobalt API integration with smart auto-fallback.
  * **MCP Integration:** `context7` for authoritative library queries and documentation.

---

## 2. Mandatory AI Skills Reference
Agents must adhere to the principles defined across these designated skills:
* `nuxtjs-vue-typescript`: Nuxt 3 and Vue 3 development with TypeScript, Composition API, and Tailwind CSS.
* `diagnosing-bugs`: Systematic diagnosis loop for runtime bugs, network/scraper issues, and regressions.
* `ai-research-explore`: Exploration, engine benchmarking, and reverse-engineering research.
* `ui-ux-pro-max` / `components-build`: High-grade composable UI components and state management.
* `hallmark` / `design-taste-frontend` / `frontend-design`: Anti-AI-slop frontend standards and craftsmanship.
* `minimalist-ui` / `high-end-visual-design` / `tailwind-design-system`: Clean typography, dark palette, and strict tokens.
* `ux-designer` / `web-design-guidelines`: Accessibility, keyboard ergonomics (`Cmd+K`), and touch targets.
* `api-design-principles` / `security-review` / `security-audit`: Robust, RESTful, and secure server routes.
* `ai-slop-cleaner` / `redesign-existing-projects` / `audit-website` / `brainstorming`: Code hygiene and continuous audit.
* `design-consistency-auditor`: Hunts design-token drift, hardcoded hex values, one-off styles, and ensures 100% strict cross-page design token consistency.

---

## 3. Directory Structure Conventions (Unified Nuxt 3 Fullstack)

```text
/
├── app.vue                         # Main layout wrapper, Toast container, Command Palette
├── nuxt.config.ts                  # Nuxt 3 config (Tailwind, VueUse, Meta, Head)
├── package.json
├── PRD.md
├── DESIGN.md
├── AGENTS.md
├── assets/
│   └── css/
│       └── main.css                # Tailwind v4 + Shadcn CSS Variables
├── components/
│   ├── ui/                         # Primitive UI Atoms (Button, Input, Badge, Card, Modal, Toast)
│   │   ├── Button.vue
│   │   ├── Input.vue
│   │   ├── Badge.vue
│   │   ├── Card.vue
│   │   ├── Modal.vue
│   │   └── Toast.vue
│   ├── layout/                     # App Layout Components
│   │   ├── AppSidebar.vue
│   │   ├── AppNavbar.vue
│   │   ├── CommandPalette.vue
│   │   └── ToastContainer.vue
│   ├── dashboard/                  # Dashboard Components
│   │   ├── HeroPasteBar.vue
│   │   ├── CategorySection.vue
│   │   ├── ToolCard.vue
│   │   └── HistoryDrawer.vue
│   ├── downloaders/                # Downloader Specialized Components
│   │   ├── MediaPreviewModal.vue
│   │   ├── MediaGallery.vue
│   │   └── QualityDropdown.vue
│   └── tools/                      # Interactive Web Tool Components (QR, JSON, Color, etc.)
│       ├── QrGenerator.vue
│       ├── JsonFormatter.vue
│       ├── ColorPalette.vue
│       └── HashEncoder.vue
├── composables/
│   ├── useDownloader.ts            # Media resolve, fetch & download state
│   ├── useToast.ts                 # Toast notification trigger
│   ├── useHistory.ts               # LocalStorage persistent download history
│   ├── useSearch.ts                # CommandPalette search & filter
│   ├── useClipboard.ts             # Copy helper with automatic toast
│   └── useZip.ts                   # Client-side multi-image ZIP archiver
├── pages/
│   ├── index.vue                   # Main Dashboard (Shadcnblocks Admin Kit style)
│   ├── d/                          # Dedicated downloader routes
│   │   └── [platform].vue          # /d/tiktok, /d/instagram, /d/youtube, etc.
│   └── tools/                      # Dedicated web utility routes
│       ├── pdf-tools.vue           # PDF Merge, Split, Extract & Images to PDF
│       ├── svg-optimizer.vue       # SVG Cleaner, Live Preview & Component Generator
│       ├── device-mockup.vue       # iPhone, MacBook & Clay 3D Mockup Studio
│       ├── image-compressor.vue    # PNG, JPG, WebP, SVG, AVIF Compressor
│       ├── image-converter.vue     # Batch Image & ICO Favicon Converter
│       ├── background-remover.vue  # 100% Client-side AI Background Remover
│       ├── qr-generator.vue        # Styled QR Code Generator
│       ├── brat-generator.vue      # Charli XCX Brat Text & GIF Generator
│       ├── font-library.vue        # Google Fonts & DaFont Explorer & Tester
│       ├── color-converter.vue     # Bi-directional Color Picker & Shade Matrix
│       ├── color-palette.vue       # Palette Generator & WCAG Contrast Checker
│       └── hash-encoder.vue        # Base64, SHA-256 / SHA-512 Hash Studio
├── server/
│   ├── api/
│   │   ├── download/
│   │   │   └── resolve.post.ts     # Main resolve endpoint (auto-detect + multi-engine)
│   │   └── proxy.ts                # Stream proxy for direct file download
│   └── utils/
│       ├── cache.ts                # In-memory LRU / Nitro unstorage cache
│       ├── sanitizer.ts            # URL sanitizer & shortlink unshortener
│       ├── scrapers/               # Modular platform scrapers
│       │   ├── tiktok.ts
│       │   ├── instagram.ts
│       │   ├── youtube.ts
│       │   ├── twitter.ts
│       │   ├── capcut.ts
│       │   ├── facebook.ts
│       │   ├── terabox.ts
│       │   └── cobaltFallback.ts
│       └── types.ts                # Standardized server scraper interfaces
└── types/
    └── index.ts                    # Universal TypeScript interfaces
```

---

## 4. Reusable Code & Cleanliness Rules

### A. Strict DRY (Don't Repeat Yourself) & Component Reusability
* **Primitive Atoms First:** All reusable UI elements (Buttons, Inputs, Cards, Badges, Modals, Toasts) MUST live in `/components/ui/`.
* **No Duplicate Components:** Always import and reuse existing components from `/components/ui/` or `/components/layout/`. Never write duplicate inline buttons, cards, or inputs with ad-hoc styling.
* **Reusable Composables:** Shared logic (clipboard copy, toast notifications, search filtering, media fetching, local storage history, ZIP download) MUST be extracted into `/composables/` and reused across all pages and components.

### B. Minimalist Code Comments & Zero Decorative Noise
* **Self-Documenting Code:** Code should be readable by structure, naming, and type safety.
* **Comment Length Rule:** Keep comments strictly minimal (maximum 5–7 words per comment) only when explaining non-obvious logic.
* **No Decorative Symbols:** Absolutely forbidden to use ASCII banners, dividers, or multi-line decoration blocks (e.g. `// ========================== //` or `/* ******* */`).

---

## 5. Engineering, Scraper & Proxy Rules

### A. Media Scraper Standard Interface
All platform scrapers in `/server/utils/scrapers/` MUST conform to the standard `PlatformScraper` interface:

```typescript
export interface MediaItem {
  type: 'video' | 'audio' | 'image' | 'file';
  url: string;                  // Direct CDN or Proxied download URL
  filename?: string;            // Suggested file name
  quality?: string;             // '1080p', '720p', 'HD', 'Original'
  format?: string;              // 'mp4', 'mp3', 'webp', 'jpg', 'pdf', 'zip'
  size?: number;                // Size in bytes if available
  thumbnail?: string;
  watermark?: boolean;
}

export interface ScraperResult {
  success: boolean;
  platform: 'tiktok' | 'instagram' | 'youtube' | 'twitter' | 'facebook' | 'capcut' | 'spotify' | 'terabox' | 'other';
  title: string;
  description?: string;
  author?: {
    name: string;
    username: string;
    avatar?: string;
  };
  thumbnail?: string;
  duration?: number;
  medias: MediaItem[];
  error?: string;
}
```

### B. Dual-Engine & Fallback Requirement
* Never rely on a single fragile selector or single third-party domain.
* Every platform downloader must implement:
  1. **Primary Method:** Native mobile API / Direct platform resolver.
  2. **Fallback Method:** Cobalt engine endpoint / secondary public scraper.
  3. If primary fails or throws, catch cleanly and attempt fallback before returning an error to the user.

### C. Stream Proxy & Memory Protection (`/server/api/proxy.ts`)
* Media streams MUST be piped directly via `sendStream()` / Web Streams.
* Never buffer entire video files into server RAM. Set proper `Content-Disposition: attachment; filename="..."` headers.
* Transcode audio on-the-fly using FFmpeg stream when pure MP3 is requested.

### D. In-Memory Caching & Sanitization
* All incoming URLs must pass through `sanitizer.ts` to unshorten and strip tracking parameters (`?utm_...`, `?igsh=...`).
* Cache resolved scraper results for 10 minutes using Nitro `unstorage` / in-memory cache to prevent redundant scraping.

### E. Client-Side Tool Privacy Rule
* Image tools, PDF manipulation, QR generation, SVG optimization, and Hash utilities MUST run 100% on the client (browser Canvas, Web Workers, Web Crypto API, or `pdf-lib`).
* Multi-image downloads (e.g. Instagram Carousels, TikTok Slides) must be zipped on the client side using `JSZip`.
* Never send sensitive user data (passwords, JWTs, JSON payloads, images, PDFs) to the server unless explicitly required (e.g., media downloading).

---

## 6. UI & Aesthetic Guardrails (DESIGN.md Mandate)
* **Strict Mandate on `DESIGN.md`:** All pages, components, and tools MUST strictly follow the design tokens, typography, and spacing defined in `DESIGN.md`.
* **Uniform Page Layout & Full-Width Fluid Standard:** 
  * All sub-pages, downloader routes, and tools MUST use the standardized full-width container: `class="space-y-6 pb-12 w-full"`.
  * **Strict Ban on Narrow Max-Widths & `mx-auto` on Page Roots:** Never place `max-w-5xl`, `max-w-4xl`, or `mx-auto` on top-level page containers. Interfaces must utilize the full content width fluidly.
* **Standard Breadcrumb & Header Structure:** Every dedicated tool page and downloader page MUST start with:
  1. Left-aligned Breadcrumbs: `Dashboard / [Category] / [Page Name]` with mono font and subtle hover transitions.
  2. Header Flex Row: Title (`text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]`), subtitle description, and right-aligned `<Badge variant="badge">Client Privacy</Badge>`.
* **Dark Mode First:** Default to the `#171717` dark background palette.
* **Radius Tokens:** Cards use `rounded-[14px]` (`14px`), buttons/inputs use `rounded-lg` (`8px`), badges use `rounded-full` (full pill shape).
* **Badge & Tagline Standard:**
  * All badges and taglines MUST use the centralized `<Badge>` component from `/components/ui/Badge.vue`.
  * Geometry: Always full pill shape (`rounded-full`) with `text-xs` (`px-2.5 py-0.5`).
  * Pure Monochrome Palette: Solid white (`primary`), neutral dark `#2E2E2E` (`secondary`), card border `#212121` (`badge`), transparent outline (`outline`), or ghost text (`ghost`).
  * Strict prohibition on generic bright green/blue/colorful badge tints.
* **Anti-AI-Slop Iconography Rules:**
  * **Strict Ban on Emojis/Emoticons in UI:** Absolutely forbidden to use generic emojis (e.g. 🎵, 📸, ▶️, 🎬, 📱, 📄, 🎨, ⚡, 🎧) inside cards, buttons, badges, headers, or sidebars.
  * **Official SVG Brand Logos:** Always use authentic, clean SVG vector brand logos for social platforms (TikTok, Instagram, YouTube, Twitter/X, CapCut, Facebook, Spotify, TeraBox, etc.).
  * **Lucide Icons:** Use `lucide-vue-next` for all generic UI icons (Search, Copy, Download, History, Theme, Arrow, Check, Refresh, etc.).
* Ensure all interactive buttons, cards, and inputs have:
  * Unique and descriptive `id` attributes.
  * Subtle hover states (`150ms` transition).
  * Accessible keyboard navigation (`Enter` to trigger, `Esc` to close modals, `Ctrl+K` for global search).

---

## 7. Git & Version Control Strict Rules

### A. Strict Prohibition on Autonomous Commits & Pushes
* **No Autonomous Commit/Push:** AI Agents are ABSOLUTELY FORBIDDEN from executing `git commit`, `git push`, `git merge`, `git rebase`, `git tag`, or any remote publishing commands autonomously.
* **Explicit Prohibition List:** Never run `git commit -m "..."`, `git commit -am "..."`, `git push origin ...`, `gh pr create`, or similar modifying VCS actions without explicit direct user command.

### B. User-Managed Commits Only
* **Working Directory State:** All code modifications, bug fixes, refactoring, and new feature additions must remain strictly as **uncommitted working directory changes**.
* **Full User Ownership:** The user retains 100% manual control over:
  1. Inspecting file diffs (`git diff`, `git status`).
  2. Staging selected files (`git add`).
  3. Writing personalized commit messages (`git commit`).
  4. Pushing to remote repositories (`git push`).

### C. Safe Inspection & Quality Verification Protocol
* **Allowed Read-Only Commands:** Agents MAY run non-destructive inspection commands when needed: `git status`, `git diff`, `git log -n 5`.
* **Verification Without Commits:** Always verify code correctness using `vue-tsc --noEmit` or test runners, then report the verified status and changed files list cleanly to the user.



