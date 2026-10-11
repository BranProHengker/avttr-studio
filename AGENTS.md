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
* **MANDATORY CO-READING OF `DESIGN.md`:** Whenever an AI Agent reads Rules or `AGENTS.md`, the agent MUST ALSO read `DESIGN.md`. Design consistency, tokens, and layouts defined in `DESIGN.md` are strictly binding across all pages, components, and tools without exception.

* **Standardized URL Omnibox & Action Form Architecture (DESIGN.md Section 11):**
  * All tools requiring URLs, links, or single-input queries MUST use the standalone omnibar layout modeled after `HeroPasteBar`:
  * Outer Container: Standalone responsive flex row (`flex flex-col sm:flex-row items-center gap-2.5 w-full`). **NEVER** wrap the omnibar inside an extra `<Card>`.
  * Leading Icon: `absolute left-3.5 flex items-center justify-center pointer-events-none text-[var(--text-tertiary)]` (e.g. `Globe`, `Link`, `Search`).
  * Input: `w-full h-12 pl-10 pr-20 bg-white dark:bg-[#171717] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] border border-zinc-200 dark:border-[#2E2E2E] focus:border-zinc-400 dark:focus:border-white/40 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 disabled:opacity-50 shadow-xs font-mono`.
  * Trailing Micro-Actions: `absolute right-2.5 flex items-center gap-1` with compact icon buttons for Clear (`X`) and Paste (`Clipboard`).
  * Submit Action CTA: Standalone `<Button variant="primary" size="default" class="w-full sm:w-auto shrink-0 h-12 px-5 rounded-xl font-medium text-xs sm:text-sm cursor-pointer" :loading="..." ...>`.
  * Strict Bans: Never wrap in an extra `<Card>`, never embed the primary submit button inside the input text field, never add decorative sample presets rows (`"SAMPLE SITES:"`, `"QUICK TEST:"`), and never insert decorative divider lines (`"OR ENTER LINK"`). Keep the Omnibar clean and focused.

* **Standardized File Upload & Dropzone Standard (DESIGN.md Section 10):**
  * All tools requiring local file uploads MUST use the standardized standalone dashed dropzone (`relative border-2 border-dashed rounded-[14px] p-8 sm:p-14 border-zinc-300 dark:border-[#2E2E2E] bg-zinc-50/50 dark:bg-[#141416] hover:border-zinc-400 dark:hover:border-[#3E3E3E] text-center cursor-pointer select-none`).
  * Never wrap the dashed box inside an extra `<Card>`.
  * Center Tile: `w-12 h-12 mx-auto rounded-xl bg-white dark:bg-[#212121] border border-zinc-200 dark:border-[#2E2E2E] flex items-center justify-center text-zinc-900 dark:text-white shadow-xs` with a 24px Lucide icon.
  * Headline: `text-sm font-semibold text-[var(--text-primary)]` (`Drop your [type] file here or browse`).
  * Subtitle: `text-xs text-[var(--text-secondary)] mt-1` (`Supports [formats] up to [size]. 100% processed client-side.`).
  * Strictly forbidden to insert unnecessary divider lines or text like `"OR DROP FILE"` between URL omniboxes and dropzones.

* **Standardized Empty & Initial State Architecture (DESIGN.md Section 12):**
  * Local File Tools: Standalone Dashed Dropzone (`DESIGN.md Section 10`).
  * URL / Query Tools: 4 Capability Bento Cards Grid (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`) with `<Card :hoverable="false" class="p-4 space-y-2">`, `w-7 h-7 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)]` icon, `text-xs font-semibold text-[var(--text-primary)]` title, `text-[11px] text-[var(--text-secondary)]` description, and `<Badge variant="badge" size="sm">` chips.
  * Strict Ban: Never render a single generic centered icon card with empty `"No data yet"` placeholder text.

* **Primitive UI Component Mandate (DESIGN.md Section 13):**
  * `<Input>` (`components/ui/Input.vue`): Mandatory for all internal form fields (testers, sliders, dialogs, captions). Never write raw `<input>` with custom inline classes.
  * `<Button>` (`components/ui/Button.vue`): Mandatory for all clickable buttons. Primary buttons use `variant="primary"` (`var(--primary)`), secondary controls use `variant="secondary"`, ghost buttons use `variant="ghost"`. Never write ad-hoc `<button>` elements with inline background styles.
  * `<Badge>` (`components/ui/Badge.vue`): Mandatory for all pills and tags (`variant="badge" | "primary" | "secondary" | "outline" | "ghost"`).
  * `<Card>` (`components/ui/Card.vue`): Mandatory for all bento cards and content panels (`rounded-[14px]`).

* **Standard Breadcrumb Hierarchy & Clean Header Standard (DESIGN.md Section 14):**
  * Format: `Dashboard / [Category] / [Page Name]` with mono font and subtle hover transitions.
  * Strict Taxonomy: `Downloader`, `Media Tools`, `Image & Design`, `Text & Fonts`, `Colors`, or `Developer`.
  * Strict Ban: Never use generic `"Tools"` in breadcrumbs. Always use the specific category matching the sidebar.
  * Header Layout: Title (`text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]`) and concise subtitle description. Do NOT clutter headers with arbitrary decorative marketing badges (`"Local Engine"`, `"Zero AI Latency"`).

* **New Tool Onboarding Checklist (The 4 Anchors - DESIGN.md Section 15):**
  * Whenever a new tool or downloader route is created, AI agents MUST register the tool in all 4 synchronization points:
    1. Search & Command Palette: `composables/useSearch.ts`
    2. Internationalization: `composables/useI18n.ts` (both EN and ID dictionaries)
    3. Sidebar Navigation: `components/layout/AppSidebar.vue` (`isCategoryActive`, `radialCategories`, expanded submenu list)
    4. Brand Icon: `components/ui/BrandIcon.vue` (if a custom platform/brand SVG vector is required)

* **Uniform Page Layout & Full-Width Fluid Standard:** 
  * All sub-pages, downloader routes, and tools MUST use the standardized full-width container: `class="space-y-6 pb-12 w-full"`.
  * **Strict Ban on Narrow Max-Widths & `mx-auto` on Page Roots:** Never place `max-w-5xl`, `max-w-4xl`, or `mx-auto` on top-level page containers. Interfaces must utilize the full content width fluidly.

* **Dark Mode First & Radius Tokens:**
  * Dark palette default: `--bg-app: #161617` / `--bg-card: #212124` / `var(--border-card)`.
  * Cards use `rounded-[14px]` (`14px`), controls/inputs use `rounded-lg` (`8px`), Hero Omnibar uses `rounded-xl` (`12px`), badges use `rounded-full`.

* **Anti-AI-Slop Iconography Rules:**
  * **Strict Ban on Emojis/Emoticons in UI:** Absolutely forbidden to use generic emojis (e.g. 🎵, 📸, ▶️, 🎬, 📱, 📄, 🎨, ⚡, 🎧) inside cards, buttons, badges, headers, or sidebars.
  * **Official SVG Brand Logos:** Always use authentic, clean SVG vector brand logos for social platforms.
  * **Lucide Icons:** Use `lucide-vue-next` for all generic UI icons.
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

### D. Build Verification Protocol (No Build on Minor Updates)
* **Skip `npm run build` on Minor Updates:** Untuk update kecil-kecilan (seperti perbaikan teks/copywriting, styling minor, tweak CSS, perbaikan prop sederhana, atau update panduan), AI Agent **TIDAK PERLU** menjalankan `npm run build`.
* **When to Run `npm run build`:** Jalankan `npm run build` **HANYA JIKA**:
  1. Ditemukan atau dilaporkan adanya bug, runtime error, atau build failure dari user/deployment.
  2. Terjadi perubahan arsitektur besar / multi-file refactoring yang kompleks.
  3. Diminta secara eksplisit oleh user.
* **Lightweight Checks:** Jika diperlukan validasi cepat pada update rutin, gunakan pengecekan ringan (seperti `vue-tsc --noEmit`) tanpa memicu build penuh Vite/Nitro agar proses iterasi tetap cepat.
