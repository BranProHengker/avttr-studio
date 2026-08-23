# Design System — Shadcnblocks Admin Kit (DESIGN.md)
## Avttr Studio — Enterprise-Grade Minimalist & Modern Dashboard

---

## 1. Visual Theme & Atmosphere

The **Shadcnblocks Admin Kit** design system presents a clean, professional, data-driven interface optimized for productivity, developer tools, and high-performance media downloading. Built on a foundation of precision neutral scales (with Dark Mode as default matching the deep obsidian/charcoal aesthetic) and strategic accent blues (`#1447E6`), it emphasizes clarity, instant feedback, and effortless scanning. 

The aesthetic is modern, minimal, and high-density, leveraging structured whitespace, crisp 1px borders, subtle depth, and precise typography. The system prioritizes readability, keyboard-first navigation (`Cmd+K`), and accessible ergonomics while maintaining a confident, tech-forward personality.

### Key Characteristics
* **Neutral-First Palette with Confident Blue Accents:** Dark mode default with rich charcoal/obsidian surfaces and high-contrast text.
* **Shadcn / Radix Component Architecture:** Clean card-based layouts, unified 14px card radii, and 8px control radii.
* **Minimal Shadows & 1px Precision Borders:** Crisp structural definition without heavy ornamental distractions.
* **High Contrast Typography:** Strict Inter typography hierarchy for scannability across tools and dashboard modules.
* **Consistent 4px Spacing Grid:** Systematic padding, margin, and alignment rules across all components.
* **Accessible Color Semantics:** Standardized indicators for status (Green Success, Red Error, Amber Warning, Blue Active).

---

## 2. Color Palette & Semantic Tokens

### Primary & Accent Colors
* **Primary High-Contrast Accent (`#FFFFFF` in Dark / `#18181B` in Light):** Primary action buttons, focused outlines, and high-priority CTA triggers.
* **Active Navigation Neutral (`#2E2E2E`):** Active sidebar item surface with pure white text and crisp 1px borders.
* **Status Metrics (`#10B981` Emerald / `#EF4444` Red):** Positive trend metrics, success indicators, and error badges.

### CSS Variables & Semantic Tokens (Dark & Light Mode Support)

```css
:root {
  /* LIGHT THEME TOKENS */
  --bg-app: #FFFFFF;
  --bg-sidebar: #FBFBFC;
  --bg-card: #FFFFFF;
  --bg-card-hover: #F4F4F5;
  --bg-surface-elevated: #FFFFFF;
  --bg-input: #FFFFFF;
  --bg-input-search: #F4F4F5;
  
  --border-subtle: #E4E4E7;
  --border-card: #E4E4E7;
  --border-card-hover: #D4D4D8;
  --border-active: #18181B;

  --text-primary: #18181B;
  --text-secondary: #71717A;
  --text-tertiary: #A1A1AA;

  --primary: #18181B;
  --primary-foreground: #FFFFFF;
  --primary-hover: #27272A;
  --primary-active: #171717;

  --success: #10B981;
  --error: #EF4444;
  --warning: #F59E0B;
}

.dark, :root[data-theme="dark"] {
  /* DARK THEME TOKENS (DEFAULT - #171717 PALETTE) */
  --bg-app: #171717;
  --bg-sidebar: #171717;
  --bg-card: #212121;
  --bg-card-hover: #292929;
  --bg-surface-elevated: #292929;
  --bg-input: #212121;
  --bg-input-search: #262626;

  --border-subtle: #2E2E2E;
  --border-card: #2E2E2E;
  --border-card-hover: #404040;
  --border-active: #FAFAFA;

  --text-primary: #FAFAFA;
  --text-secondary: #A3A3A3;
  --text-tertiary: #737373;

  --primary: #FAFAFA;
  --primary-foreground: #171717;
  --primary-hover: #E5E5E5;
  --primary-active: #D4D4D4;

  --success: #10B981;
  --error: #EF4444;
  --warning: #F59E0B;
}
```

---

## 3. Typography Rules

### Font Family
* **Primary:** `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
* **Monospace:** `JetBrains Mono, Fira Code, monospace` (for code snippets, JSON, regex, metrics, and badges)

### Hierarchy Table

| Role | Font | Size | Weight | Line Height | Letter Spacing | Context / Usage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Display Large** | Inter | 32px | 600 | 40px | -0.01em | Dashboard hero headers, page titles |
| **Heading 1** | Inter | 24px | 600 | 32px | -0.01em | Major section headers, metric values |
| **Heading 2** | Inter | 20px | 600 | 28px | 0em | Card titles, modal titles |
| **Heading 3** | Inter | 16px | 600 | 24px | 0em | Subsection headers, navigation groups |
| **Body Regular** | Inter | 14px | 400 | 20px | 0em | Primary body text, descriptions |
| **Body Small** | Inter | 12px | 400 | 16px | 0em | Secondary metadata, timestamps, hints |
| **Label Strong** | Inter | 12px | 600 | 15px | 0em | Form labels, category headers, badges |
| **Button** | Inter | 14px | 500 | 20px | 0em | Standard action buttons |
| **Button Small** | Inter | 12px | 500 | 16px | 0em | Compact actions, table actions |
| **Code / Mono** | Mono | 12px | 400 | 16px | 0em | URLs, JSON, hashes, keyboard shortcuts |

---

## 4. Component Stylings (Shadcnblocks Standard)

### A. Buttons

#### 1. Primary Button
* **Background:** `#1447E6`
* **Text:** `#FFFFFF`, `14px`, weight `500`
* **Height:** `40px` | **Padding:** `8px 16px` | **Radius:** `8px`
* **Hover:** Background `#193CB8`, Box-shadow `rgba(20, 71, 230, 0.2) 0px 4px 8px`
* **Active:** Background `#0F2FA0`
* **Disabled:** Background `#CCCCCC` (Dark: `#2C2C2C`), Text `#999999`, cursor `not-allowed`

#### 2. Secondary Button
* **Background:** `var(--bg-card-hover)`
* **Border:** `1px solid var(--border-card)`
* **Text:** `var(--text-primary)`, `14px`, weight `500`
* **Height:** `40px` | **Padding:** `8px 16px` | **Radius:** `8px`
* **Hover:** Border `var(--border-card-hover)`, background `var(--bg-surface-elevated)`

#### 3. Ghost / Outline Button
* **Background:** `transparent`
* **Border:** `1px solid var(--border-card)`
* **Text:** `var(--text-secondary)`
* **Hover:** Background `var(--bg-card-hover)`, text `var(--text-primary)`

#### 4. Compact Button
* **Height:** `32px` | **Padding:** `4px 12px` | **Radius:** `6px` | **Font:** `12px`, weight `500`

---

### B. Cards & Containers

#### 1. Standard Tool Card
* **Background:** `var(--bg-card)`
* **Border:** `1px solid var(--border-card)`
* **Radius:** `14px`
* **Padding:** `20px` to `24px`
* **Box Shadow:** `rgba(0, 0, 0, 0.05) 0px 1px 2px 0px`
* **Hover State:** Border `var(--border-card-hover)`, Box-shadow `rgba(0, 0, 0, 0.15) 0px 4px 12px 0px`, transition `200ms ease-in-out`
* **Header:** Icon box (`38x38px`, radius `8px`, border `1px solid var(--border-subtle)`), Title `16px` weight `600`, Description `14px` color `var(--text-secondary)`

#### 2. Metric / KPI Card
* **Background:** `var(--bg-card)`
* **Border:** `1px solid var(--border-card)`
* **Radius:** `14px` | **Padding:** `24px`
* **Icon Box:** `40px × 40px`, radius `8px`, background `var(--bg-card-hover)`
* **Metric Value:** `24px` weight `600`, color `var(--text-primary)`
* **Trend Indicator:** `12px` weight `500`, color `var(--success)` (+27.8%) or `var(--error)` (-13.7%)

---

### C. Inputs & Forms

#### 1. Text Input & Universal Hero Paste Bar
* **Background:** `var(--bg-input)`
* **Border:** `1px solid var(--border-card)`
* **Radius:** `8px`
* **Height:** `40px` (Standard) / `48px` (Hero Paste Bar)
* **Padding:** `12px 14px`
* **Font:** `14px` (Hero: `15px`), color `var(--text-primary)`
* **Placeholder:** `var(--text-tertiary)`
* **Focus State:** Border `#1447E6`, Box-shadow `0 0 0 3px rgba(20, 71, 230, 0.15)`

#### 2. Search Input (Cmd+K)
* **Background:** `var(--bg-input-search)`
* **Border:** `1px solid var(--border-card)`
* **Radius:** `8px` | **Height:** `36px` | **Padding:** `8px 12px 8px 36px`
* **Shortcut Badge:** `KBD` tag with `Ctrl+K` / `⌘K` on right side

---

### D. Navigation & Sidebar

#### 1. Sidebar Navigation Item
* **Height:** `40px` | **Padding:** `10px 12px` | **Radius:** `8px`
* **Default:** Text `var(--text-secondary)`, icon `18px × 18px` color `var(--text-tertiary)`
* **Hover:** Background `var(--bg-card-hover)`, text `var(--text-primary)`
* **Active:** Background `var(--primary-subtle)`, text `#1447E6` (or bright white with blue accent bar), icon `#1447E6`, left border `3px solid #1447E6`

#### 2. Top Navigation Bar
* **Height:** `56px` | **Padding:** `12px 24px` | **Border Bottom:** `1px solid var(--border-subtle)`
* **Elements:** Sidebar toggle, Breadcrumbs, Global Search button (`Ctrl+K`), Theme Toggle, Accent Picker.

---

### E. Badges & Tagline Pills (Shadcn Specification)

All badges use full pill geometry (`rounded-full`), `text-xs` (`12px`), and strict semantic variants:

* **Primary (`variant="primary"`):** Solid high-contrast white pill (`bg-white text-black font-semibold shadow-xs px-2.5 py-0.5`).
* **Secondary (`variant="secondary"`):** Neutral dark pill (`bg-[#2E2E2E] text-white font-medium px-2.5 py-0.5`).
* **Badge / Neutral (`variant="badge"`):** Dark card surface with 1px border (`border border-[var(--border-subtle)] bg-[var(--bg-card)] text-white px-2.5 py-0.5`).
* **Outline (`variant="outline"`):** Transparent pill with 1px border (`border border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] px-2.5 py-0.5`).
* **Ghost (`variant="ghost"`):** Borderless text-only pill (`bg-transparent text-xs text-[var(--text-tertiary)] hover:text-white px-1.5 py-0.5`).
* **Semantic Status Pills (`variant="success" | "warning" | "error"`):**
  * **Success:** `bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 rounded-full`
  * **Warning:** `bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 rounded-full`
  * **Error:** `bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30 rounded-full`

---

## 5. Spacing System (4px Base Grid)

* **4px (xs):** Tight icon gaps, micro spacing.
* **8px (sm):** Button inner spacing, small card gaps, form label margins.
* **12px (md):** Input padding, navigation item padding.
* **16px (lg):** Section title margins, standard card internal gaps.
* **20px (xl):** Compact card padding.
* **24px (xxl):** Standard card padding, dashboard grid gaps (`gap-6`).
* **32px (3xl):** Major section separation.
* **48px (4xl):** Page-level container vertical rhythm.

---

## 6. Elevation & Depth Scale

| Level | Treatment (Dark Mode) | Treatment (Light Mode) | Use Case |
| :--- | :--- | :--- | :--- |
| **Base (0)** | No shadow | No shadow | Backgrounds, static containers |
| **Raised (1)** | `0 1px 2px rgba(0, 0, 0, 0.3)` | `0 1px 2px rgba(0, 0, 0, 0.05)` | Standard cards, KPI cards |
| **Floating (2)** | `0 4px 12px rgba(0, 0, 0, 0.4)` | `0 4px 8px rgba(0, 0, 0, 0.1)` | Hovered cards, preview panels |
| **Elevated (3)** | `0 8px 24px rgba(0, 0, 0, 0.6)` | `0 8px 16px rgba(0, 0, 0, 0.15)` | Dropdowns, tooltips, popovers |
| **Modal (4)** | `0 16px 36px rgba(0, 0, 0, 0.7)` | `0 12px 24px rgba(0, 0, 0, 0.2)` | Media preview modal, command palette |

---

## 7. Responsive Breakpoints & Behavior

| Breakpoint | Viewport | Sidebar | Dashboard Grid |
| :--- | :--- | :--- | :--- |
| **Mobile** | `320px – 639px` | Collapsed to drawer / bottom nav | 1 Column, full-width inputs |
| **Tablet** | `640px – 1023px` | Collapsed to icons (`64px`) | 2 Columns (`grid-cols-2`) |
| **Desktop** | `1024px – 1399px` | Full width (`260px` – `280px`) | 3 Columns (`grid-cols-3`) |
| **Wide Desktop** | `1400px+` | Full width (`280px`) | 4 Columns (`grid-cols-4`, max-width `1440px`) |

---

## 8. Agent Engineering Guardrails

1. **Color Rule:** Primary CTA uses high-contrast `#FAFAFA` in Dark mode and `#18181B` in Light mode. Active nav items use `#27272A`. Never use arbitrary random blues outside tokens.
2. **Typography Rule:** Always use `Inter` font stack with explicit line-heights and font-weights (`400`, `500`, `600`).
3. **Card Consistency:** All cards MUST use `border-radius: 14px` (`rounded-[14px]`) and `1px solid var(--border-card)`.
4. **Interactive Controls:** All buttons, dropdowns, and form inputs MUST use `border-radius: 8px` (`rounded-lg`).
5. **No Clutter Rule:** Keep interfaces clean and data-centric. Eliminate unnecessary borders, gradients, or excessive card nesting.

---

## 9. Lazy Loading & Performance Architecture

To maintain instant initial page loads and 60fps animations across devices, the following lazy loading standards must be strictly upheld:

### A. Component-Level Dynamic Imports
* **Heavy Dialogs & Overlays:** All secondary heavy components (`CommandPalette.vue`, `MediaPreviewModal.vue`, `HistoryDrawer.vue`) MUST be loaded via `defineAsyncComponent()` or Nuxt's lazy `<Lazy...>` component prefix so their bundles are only fetched on user interaction.
* **Client-Only Heavy Utilities:** Heavy libraries (e.g. `JSZip`, `qrcode`, canvas confetti) must only be imported dynamically when an action is triggered (`import('jszip')` or dynamic execution), keeping the main dashboard bundle under `150kB`.

### B. Media & Asset Lazy Loading
* **Native Lazy Loading:** All `<img>` tags (thumbnails in history, avatars, media gallery previews) MUST include `loading="lazy"` and `decoding="async"`.
* **Skeleton Loading Pulse:** Temporary fetching states must use the `<Skeleton>` component (`bg-[#27272A]/60 rounded-md animate-pulse`) to prevent layout shift (CLS = 0).

