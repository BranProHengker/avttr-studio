<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  Page as FileText,
  Copy,
  Check,
  Download,
  Printer,
  Upload,
  Eye,
  PageEdit as Edit3,
  ViewColumns2 as Columns2,
  Trash,
  Refresh as RefreshCw,
  Undo,
  Redo,
  InfoCircle,
  CheckCircle,
  WarningTriangle,
  Code as CodeIcon,
  List as ListIcon,
  Quote,
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Strikethrough,
  Table as TableIcon,
  Minus,
  Maximize,
  Clock,
  Text,
} from '@iconoir/vue'
import Prism from 'prismjs'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-markdown'

import { useToast } from '~/composables/useToast'
import { useI18n } from '~/composables/useI18n'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'
import Card from '~/components/ui/Card.vue'

const toast = useToast()
const { t } = useI18n()

useHead({
  title: 'Markdown Studio — Live Typography Styler & Exporter | Avttr Studio',
  meta: [
    {
      name: 'description',
      content: 'Interactive Markdown editor with live typography themes, GitHub-style callouts, syntax highlighting, rich text clipboard copy, and print-to-PDF export.'
    }
  ]
})

// Starter Templates
const TEMPLATES = {
  starter: `# Markdown Studio

Write markdown on the left, preview styled typography on the right. Supports **bold**, *italic*, and \`inline code\`.

> [!NOTE]
> 100% processed locally in your browser. Zero token cost and safe for confidential notes.

### Quick Preview
- [x] Multi-theme typography (Modern, Serif, Notion, Mono)
- [x] 1-click **Copy Rich Text** for Google Docs & Slack
- [x] Export to clean **Print / PDF**

\`\`\`typescript
const status = "Ready to write"
console.log(status)
\`\`\`
`,
  prd: `# Product Requirements Document: Feature Name

**Status**: Draft  
**Author**: Engineering Team  
**Last Updated**: 2026-10-30  

---

## 1. Problem Statement
Users need a fast, zero-token way to style and export markdown documents without signing up for third-party subscription services or leaking confidential text.

---

## 2. Objectives & Goals
- [x] 100% Client-side execution with zero external server latency
- [x] Support multiple typography aesthetics matching modern design standards
- [ ] Implement seamless Rich Text clipboard copying for Google Docs & Gmail

---

## 3. Technical Specifications

### Architecture Overview
\`\`\`text
[ Client Markdown Input ] ──> [ Heuristic Tokenizer ] ──> [ Prism Highlighter ] ──> [ Theme Engine ]
\`\`\`

### Key Metrics & SLAs
| Metric | Target | Current |
| :--- | :--- | :--- |
| **Render Latency** | < 16ms (60 FPS) | ~4ms |
| **Memory Footprint** | < 15 MB | ~8 MB |
| **Server Cost** | $0.00 | $0.00 |
`,
  meeting: `# Engineering Sync & Architecture Review

**Date**: October 30, 2026  
**Attendees**: Lead Architect, Frontend Engineer, Product Designer  

---

## Agenda
1. Review sprint deliverables and open PRs
2. Evaluate client-side markdown styling performance
3. Finalize typography scale and print stylesheets

---

## Key Discussion Points
- Moving towards unboxed, clean layouts improves reading ergonomics.
- Multi-format export (Rich Text + PDF) eliminates the need for separate converters.

> [!NOTE]
> All new utility tools must comply with the 5 synchronization points defined in project governance.

---

## Action Items
- [x] Finalize Prism.js language imports
- [x] Verify clipboard HTML mime type write support
- [ ] Conduct accessibility audit for contrast compliance
`,
  changelog: `# Changelog

All notable changes to this project are documented in this file.

---

## [v2.4.0] - 2026-10-30

### Added
- **Markdown Studio**: Live typography editor with 5 themes and rich-text export.
- **Submenu Grid Accordion**: Smooth CSS Grid collapsible transitions for sidebar navigation.
- **In-Memory Cache**: Zero-token reuse for repeated scraper and inspection queries.

### Improved
- Refined vertical guideline indicators for active navigation items.
- Streamlined typography tokens across all utility cards.

### Fixed
- Fixed nested tag rendering in code preview containers.
`,
  minimal: `# Untitled Document

Start writing your markdown here...
`
}

// State
const content = ref(TEMPLATES.starter)
const activeTheme = ref<'modern' | 'editorial' | 'notion' | 'mono' | 'academic'>('modern')
const viewMode = ref<'split' | 'editor' | 'preview'>('split')
const isCopied = ref(false)
const copiedType = ref<'md' | 'rich' | 'html' | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const previewContainerRef = ref<HTMLElement | null>(null)

// Themes configuration
const THEMES = [
  { id: 'modern', name: 'Minimalist Modern', font: 'font-sans', desc: 'Clean Inter style with subtle zinc borders' },
  { id: 'editorial', name: 'Editorial Serif', font: 'font-serif', desc: 'Elegant Georgia serif with refined drop-quotes' },
  { id: 'notion', name: 'Notion Clean', font: 'font-sans', desc: 'Spacious line height with colored callout cards' },
  { id: 'mono', name: 'Cyber Monospace', font: 'font-mono', desc: 'JetBrains Mono terminal aesthetic with code badges' },
  { id: 'academic', name: 'Academic Paper', font: 'font-serif', desc: 'Formal publication layout with justified margins' },
] as const

// Document Metrics
const metrics = computed(() => {
  const text = content.value.trim()
  if (!text) {
    return { words: 0, characters: 0, lines: 0, readingTime: 0 }
  }
  const words = text.split(/\s+/).filter(Boolean).length
  const characters = text.length
  const lines = text.split('\n').length
  const readingTime = Math.max(1, Math.ceil(words / 200))
  return { words, characters, lines, readingTime }
})

// Client-Side Markdown Parser
const renderedHtml = computed(() => {
  const raw = content.value
  if (!raw.trim()) {
    return '<div class="py-12 text-center text-[var(--text-tertiary)] italic">Document is empty. Start typing on the left...</div>'
  }

  // Pre-process and parse line by line with state tracking
  const lines = raw.split('\n')
  const htmlChunks: string[] = []
  
  let inCodeBlock = false
  let codeBlockLang = ''
  let codeBlockLines: string[] = []

  let inTable = false
  let tableHeaders: string[] = []
  let tableRows: string[][] = []

  let inBlockquote = false
  let blockquoteType: 'note' | 'tip' | 'important' | 'warning' | 'caution' | 'default' = 'default'
  let blockquoteLines: string[] = []

  let inList: 'ul' | 'ol' | null = null

  const formatInline = (text: string): string => {
    let out = text
      // HTML Escape special characters first
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    
    // Inline code
    out = out.replace(/`([^`]+)`/g, '<code class="markdown-inline-code">$1</code>')
    
    // Bold & Italic
    out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-[var(--text-primary)]">$1</strong>')
    out = out.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>')
    out = out.replace(/~~([^~]+)~~/g, '<del class="line-through text-[var(--text-tertiary)]">$1</del>')
    
    // Links
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-zinc-900 dark:text-white underline underline-offset-4 decoration-zinc-400 dark:decoration-zinc-600 hover:decoration-zinc-900 dark:hover:decoration-white transition-colors">$1</a>')
    
    // Keyboard kbd tags
    out = out.replace(/&lt;kbd&gt;(.*?)&lt;\/kbd&gt;/g, '<kbd class="px-1.5 py-0.5 text-[11px] font-mono rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-xs">$1</kbd>')

    return out
  }

  const flushCodeBlock = () => {
    if (!inCodeBlock) return
    const rawCode = codeBlockLines.join('\n')
    let highlighted = ''
    try {
      const grammar = Prism.languages[codeBlockLang] || Prism.languages.markup || Prism.languages.clike
      highlighted = Prism.highlight(rawCode, grammar, codeBlockLang || 'markup')
    } catch {
      highlighted = rawCode.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }

    htmlChunks.push(`
      <div class="my-5 rounded-xl border border-[var(--border-subtle)] bg-zinc-950 text-zinc-100 overflow-hidden shadow-xs">
        <div class="flex items-center justify-between px-4 py-2 border-b border-zinc-800/80 bg-zinc-900/60 text-xs font-mono text-zinc-400">
          <span class="uppercase tracking-wider text-[11px] font-medium">${codeBlockLang || 'text'}</span>
          <span class="text-[10px] text-zinc-500">${codeBlockLines.length} lines</span>
        </div>
        <pre class="p-4 overflow-x-auto text-xs font-mono leading-relaxed"><code class="language-${codeBlockLang}">${highlighted}</code></pre>
      </div>
    `)
    inCodeBlock = false
    codeBlockLang = ''
    codeBlockLines = []
  }

  const flushTable = () => {
    if (!inTable) return
    let t = '<div class="overflow-x-auto my-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xs"><table class="w-full text-xs text-left border-collapse">'
    if (tableHeaders.length > 0) {
      t += '<thead class="bg-zinc-100/70 dark:bg-zinc-900/60 border-b border-[var(--border-subtle)] text-[var(--text-tertiary)] uppercase font-mono text-[10px] tracking-wider"><tr>'
      for (const h of tableHeaders) {
        t += `<th class="px-4 py-3 font-semibold">${formatInline(h)}</th>`
      }
      t += '</tr></thead>'
    }
    t += '<tbody class="divide-y divide-[var(--border-subtle)]">'
    for (const row of tableRows) {
      t += '<tr class="hover:bg-[var(--bg-card-hover)] transition-colors">'
      for (const cell of row) {
        t += `<td class="px-4 py-3 text-[var(--text-secondary)] font-normal">${formatInline(cell)}</td>`
      }
      t += '</tr>'
    }
    t += '</tbody></table></div>'
    htmlChunks.push(t)
    inTable = false
    tableHeaders = []
    tableRows = []
  }

  const flushBlockquote = () => {
    if (!inBlockquote) return
    const text = blockquoteLines.map(line => formatInline(line)).join('<br />')
    
    if (blockquoteType === 'note') {
      htmlChunks.push(`
        <div class="my-4 p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 text-blue-950 dark:text-blue-200 flex gap-3 items-start text-xs leading-relaxed">
          <div class="w-5 h-5 rounded-md bg-blue-500/15 flex items-center justify-center shrink-0 mt-0.5 text-blue-600 dark:text-blue-400 font-bold text-xs">ℹ</div>
          <div><strong class="block font-semibold mb-1 uppercase tracking-wider text-[10px] text-blue-700 dark:text-blue-300">Note</strong>${text}</div>
        </div>
      `)
    } else if (blockquoteType === 'tip') {
      htmlChunks.push(`
        <div class="my-4 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-emerald-950 dark:text-emerald-200 flex gap-3 items-start text-xs leading-relaxed">
          <div class="w-5 h-5 rounded-md bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs">✓</div>
          <div><strong class="block font-semibold mb-1 uppercase tracking-wider text-[10px] text-emerald-700 dark:text-emerald-300">Tip</strong>${text}</div>
        </div>
      `)
    } else if (blockquoteType === 'important') {
      htmlChunks.push(`
        <div class="my-4 p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 text-purple-950 dark:text-purple-200 flex gap-3 items-start text-xs leading-relaxed">
          <div class="w-5 h-5 rounded-md bg-purple-500/15 flex items-center justify-center shrink-0 mt-0.5 text-purple-600 dark:text-purple-400 font-bold text-xs">✦</div>
          <div><strong class="block font-semibold mb-1 uppercase tracking-wider text-[10px] text-purple-700 dark:text-purple-300">Important</strong>${text}</div>
        </div>
      `)
    } else if (blockquoteType === 'warning') {
      htmlChunks.push(`
        <div class="my-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-950 dark:text-amber-200 flex gap-3 items-start text-xs leading-relaxed">
          <div class="w-5 h-5 rounded-md bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5 text-amber-600 dark:text-amber-400 font-bold text-xs">⚠</div>
          <div><strong class="block font-semibold mb-1 uppercase tracking-wider text-[10px] text-amber-700 dark:text-amber-300">Warning</strong>${text}</div>
        </div>
      `)
    } else {
      htmlChunks.push(`
        <blockquote class="my-4 pl-4 border-l-2 border-zinc-300 dark:border-zinc-700 text-[var(--text-secondary)] italic text-xs leading-relaxed">
          ${text}
        </blockquote>
      `)
    }

    inBlockquote = false
    blockquoteType = 'default'
    blockquoteLines = []
  }

  const flushList = () => {
    if (!inList) return
    htmlChunks.push(inList === 'ul' ? '</ul>' : '</ol>')
    inList = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code block toggle
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock()
      } else {
        flushTable()
        flushBlockquote()
        flushList()
        inCodeBlock = true
        codeBlockLang = line.trim().slice(3).trim().toLowerCase()
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockLines.push(line)
      continue
    }

    // Horizontal Rule
    if (/^(---|___|\*\*\*)$/.test(line.trim())) {
      flushTable()
      flushBlockquote()
      flushList()
      htmlChunks.push('<hr class="my-8 border-t border-[var(--border-subtle)]" />')
      continue
    }

    // GitHub Alert or Blockquote
    if (line.trim().startsWith('>')) {
      flushTable()
      flushList()
      const content = line.trim().replace(/^>\s*/, '')
      
      if (!inBlockquote) {
        inBlockquote = true
        if (content.startsWith('[!NOTE]')) {
          blockquoteType = 'note'
          continue
        } else if (content.startsWith('[!TIP]')) {
          blockquoteType = 'tip'
          continue
        } else if (content.startsWith('[!IMPORTANT]')) {
          blockquoteType = 'important'
          continue
        } else if (content.startsWith('[!WARNING]')) {
          blockquoteType = 'warning'
          continue
        } else {
          blockquoteType = 'default'
        }
      }
      blockquoteLines.push(content)
      continue
    } else if (inBlockquote) {
      flushBlockquote()
    }

    // Table rows
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      flushBlockquote()
      flushList()
      const cells = line.split('|').slice(1, -1).map(c => c.trim())
      
      // Separator row
      if (cells.every(c => /^:?-+:?$/.test(c))) {
        inTable = true
        continue
      }

      if (!inTable) {
        tableHeaders = cells
        inTable = true
      } else {
        tableRows.push(cells)
      }
      continue
    } else if (inTable) {
      flushTable()
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      flushList()
      const level = headingMatch[1].length
      const title = formatInline(headingMatch[2])
      
      if (level === 1) {
        htmlChunks.push(`<h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-8 mb-4">${title}</h1>`)
      } else if (level === 2) {
        htmlChunks.push(`<h2 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-7 mb-3 pb-1 border-b border-[var(--border-subtle)]">${title}</h2>`)
      } else if (level === 3) {
        htmlChunks.push(`<h3 class="text-base sm:text-lg font-semibold text-[var(--text-primary)] mt-5 mb-2">${title}</h3>`)
      } else if (level === 4) {
        htmlChunks.push(`<h4 class="text-sm font-semibold text-[var(--text-primary)] mt-4 mb-1.5">${title}</h4>`)
      } else {
        htmlChunks.push(`<h5 class="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mt-3 mb-1">${title}</h5>`)
      }
      continue
    }

    // Task list items
    const taskMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/)
    if (taskMatch) {
      flushList()
      const checked = taskMatch[1].toLowerCase() === 'x'
      const text = formatInline(taskMatch[2])
      htmlChunks.push(`
        <div class="flex items-center gap-2.5 my-1.5 text-xs text-[var(--text-secondary)]">
          <input type="checkbox" ${checked ? 'checked' : ''} disabled class="rounded border-zinc-400 text-zinc-900 focus:ring-0 cursor-default" />
          <span class="${checked ? 'line-through text-[var(--text-tertiary)]' : ''}">${text}</span>
        </div>
      `)
      continue
    }

    // Unordered List items
    const ulMatch = line.match(/^[-*]\s+(.*)$/)
    if (ulMatch) {
      if (inList !== 'ul') {
        flushList()
        htmlChunks.push('<ul class="list-disc list-inside space-y-1 my-3 text-xs text-[var(--text-secondary)] leading-relaxed">')
        inList = 'ul'
      }
      htmlChunks.push(`<li>${formatInline(ulMatch[1])}</li>`)
      continue
    }

    // Ordered List items
    const olMatch = line.match(/^(\d+)\.\s+(.*)$/)
    if (olMatch) {
      if (inList !== 'ol') {
        flushList()
        htmlChunks.push('<ol class="list-decimal list-inside space-y-1 my-3 text-xs text-[var(--text-secondary)] leading-relaxed">')
        inList = 'ol'
      }
      htmlChunks.push(`<li>${formatInline(olMatch[2])}</li>`)
      continue
    }

    // Regular empty line or paragraph
    flushList()
    if (!line.trim()) {
      continue
    }

    htmlChunks.push(`<p class="my-3 text-xs sm:text-[13px] text-[var(--text-secondary)] leading-relaxed">${formatInline(line)}</p>`)
  }

  // Flush remaining blocks
  flushCodeBlock()
  flushTable()
  flushBlockquote()
  flushList()

  return htmlChunks.join('\n')
})

// History Stack for Undo & Redo
const history = ref<string[]>([content.value])
const historyIndex = ref(0)
let isHistoryAction = false
let historyTimer: any = null

const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

const pushHistory = (newVal: string) => {
  if (isHistoryAction) return
  if (history.value[historyIndex.value] === newVal) return

  const sliced = history.value.slice(0, historyIndex.value + 1)
  sliced.push(newVal)
  if (sliced.length > 50) {
    sliced.shift()
  }
  history.value = sliced
  historyIndex.value = sliced.length - 1
}

// Watch content with debounce for typing changes
watch(content, (newVal) => {
  if (isHistoryAction) return
  clearTimeout(historyTimer)
  historyTimer = setTimeout(() => {
    pushHistory(newVal)
  }, 400)
})

const undo = () => {
  if (!canUndo.value) return
  isHistoryAction = true
  historyIndex.value--
  content.value = history.value[historyIndex.value]
  setTimeout(() => { isHistoryAction = false }, 50)
}

const redo = () => {
  if (!canRedo.value) return
  isHistoryAction = true
  historyIndex.value++
  content.value = history.value[historyIndex.value]
  setTimeout(() => { isHistoryAction = false }, 50)
}

// Keyboard shortcuts for Editor (Undo, Redo, Bold, Italic, Tab Indent)
const handleKeydown = (e: KeyboardEvent) => {
  // Undo: Ctrl+Z or Cmd+Z (without Shift)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault()
    undo()
    return
  }
  // Redo: Ctrl+Y or Cmd+Y, or Ctrl+Shift+Z / Cmd+Shift+Z
  if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
    e.preventDefault()
    redo()
    return
  }
  // Bold: Ctrl+B or Cmd+B
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
    e.preventDefault()
    insertSnippet('**', '**', 'bold text')
    return
  }
  // Italic: Ctrl+I or Cmd+I
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
    e.preventDefault()
    insertSnippet('*', '*', 'italic text')
    return
  }
  // Tab key: Indent with 2 spaces
  if (e.key === 'Tab') {
    e.preventDefault()
    const textarea = textareaRef.value
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    content.value = content.value.substring(0, start) + '  ' + content.value.substring(end)
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + 2
    }, 0)
  }
}

// Toolbar Quick Actions for Editor
const insertSnippet = (prefix: string, suffix: string = '', defaultText: string = '') => {
  const textarea = textareaRef.value
  if (!textarea) return

  pushHistory(content.value)

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = content.value.substring(start, end) || defaultText

  const replacement = `${prefix}${selected}${suffix}`
  content.value = content.value.substring(0, start) + replacement + content.value.substring(end)
  pushHistory(content.value)

  setTimeout(() => {
    textarea.focus()
    textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length)
  }, 10)
}

// Template Switcher
const loadTemplate = (key: keyof typeof TEMPLATES) => {
  pushHistory(content.value)
  content.value = TEMPLATES[key]
  pushHistory(content.value)
  toast.success(`Loaded ${key.toUpperCase()} template`)
}

// Copy as Raw Markdown
const copyMarkdown = async () => {
  try {
    await navigator.clipboard.writeText(content.value)
    copiedType.value = 'md'
    isCopied.value = true
    toast.success('Raw Markdown copied to clipboard')
    setTimeout(() => { isCopied.value = false; copiedType.value = null }, 2000)
  } catch (err) {
    toast.error('Failed to copy markdown')
  }
}

// Copy as Rich Text (Formatted RTF/HTML for Google Docs & Slack)
const copyRichText = async () => {
  try {
    const htmlBlob = new Blob([renderedHtml.value], { type: 'text/html' })
    const textBlob = new Blob([content.value], { type: 'text/plain' })
    
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob,
        })
      ])
      copiedType.value = 'rich'
      isCopied.value = true
      toast.success('Rich Text copied! Ready to paste into Google Docs or Slack.')
      setTimeout(() => { isCopied.value = false; copiedType.value = null }, 2500)
    } else {
      await navigator.clipboard.writeText(content.value)
      toast.info('Fallback: Copied markdown text')
    }
  } catch (err) {
    toast.error('Clipboard write failed on this browser')
  }
}

// Print / PDF Export
const printDocument = () => {
  window.print()
}

// Download as .md
const downloadMarkdown = () => {
  const blob = new Blob([content.value], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `document-${new Date().toISOString().slice(0, 10)}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  toast.success('Markdown file downloaded')
}

// Download as standalone HTML
const downloadHtml = () => {
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exported Document</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #18181b; }
    h1, h2, h3 { color: #09090b; font-weight: 700; margin-top: 1.5em; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #f4f4f5; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    pre { background: #09090b; color: #f4f4f5; padding: 16px; border-radius: 8px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
    th, td { border: 1px solid #e4e4e7; padding: 10px 14px; text-align: left; }
    th { background: #f4f4f5; font-weight: 600; }
    blockquote { border-left: 3px solid #71717a; padding-left: 16px; color: #52525b; margin: 16px 0; }
    hr { border: 0; border-top: 1px solid #e4e4e7; margin: 32px 0; }
  </style>
</head>
<body>
${renderedHtml.value}
</body>
</html>`

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `document-${new Date().toISOString().slice(0, 10)}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  toast.success('Styled HTML file downloaded')
}

// Drag and drop import .md
const handleFileDrop = (e: DragEvent) => {
  e.preventDefault()
  const file = e.dataTransfer?.files[0]
  if (file && (file.name.endsWith('.md') || file.name.endsWith('.txt'))) {
    const reader = new FileReader()
    reader.onload = (event) => {
      content.value = (event.target?.result as string) || ''
      toast.success(`Imported ${file.name}`)
    }
    reader.readAsText(file)
  }
}

// Clear document with undo support
const clearDocument = () => {
  if (!content.value.trim()) return
  pushHistory(content.value)
  content.value = ''
  pushHistory('')
  toast.info('Document cleared. Press Ctrl+Z to undo.')
}
</script>

<template>
  <div class="space-y-6 pb-12 w-full select-none" id="markdown-studio-root">
    <!-- Top Breadcrumbs (DESIGN.md Section 14) -->
    <div class="flex items-center gap-2 text-xs font-mono text-[var(--text-tertiary)]">
      <NuxtLink to="/" class="hover:text-[var(--text-primary)] transition-colors">Dashboard</NuxtLink>
      <span>/</span>
      <span class="text-[var(--text-secondary)]">Design System & Docs</span>
      <span>/</span>
      <span class="text-[var(--text-primary)] font-medium">Markdown Studio</span>
    </div>

    <!-- Header Section (Clean Header Standard) -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          Markdown Studio
        </h1>
        <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
          Live typography styler, document formatter, and multi-format exporter with zero token cost.
        </p>
      </div>

      <!-- Quick Metrics Pill (Unboxed Anti-Over-Carding) -->
      <div class="flex items-center gap-3 text-xs text-[var(--text-tertiary)] font-mono">
        <span class="flex items-center gap-1.5">
          <Text class="w-3.5 h-3.5" />
          <strong class="text-[var(--text-primary)] font-semibold">{{ metrics.words }}</strong> words
        </span>
        <span>•</span>
        <span class="flex items-center gap-1.5">
          <Clock class="w-3.5 h-3.5" />
          <strong class="text-[var(--text-primary)] font-semibold">{{ metrics.readingTime }}</strong> min read
        </span>
      </div>
    </div>

    <!-- Top Action Toolbar -->
    <div class="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl bg-white dark:bg-[#1a1a1c] border border-zinc-200 dark:border-[#2E2E2E] shadow-xs">
      <!-- Left Controls: View Mode & Theme Select -->
      <div class="flex flex-wrap items-center gap-2">
        <!-- View Mode Switcher -->
        <div class="flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60">
          <button
            type="button"
            class="px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 cursor-pointer"
            :class="viewMode === 'split' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-semibold' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'"
            @click="viewMode = 'split'"
            title="Side-by-side Editor & Preview"
          >
            <Columns2 class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">Split</span>
          </button>
          <button
            type="button"
            class="px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 cursor-pointer"
            :class="viewMode === 'editor' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-semibold' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'"
            @click="viewMode = 'editor'"
            title="Editor Only"
          >
            <Edit3 class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">Editor</span>
          </button>
          <button
            type="button"
            class="px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 cursor-pointer"
            :class="viewMode === 'preview' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-semibold' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'"
            @click="viewMode = 'preview'"
            title="Preview Only"
          >
            <Eye class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">Preview</span>
          </button>
        </div>

        <!-- Typography Theme Selector -->
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-[var(--text-tertiary)] hidden md:inline">Theme:</span>
          <select
            v-model="activeTheme"
            class="h-8 px-2.5 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 cursor-pointer font-medium"
          >
            <option v-for="theme in THEMES" :key="theme.id" :value="theme.id">
              {{ theme.name }}
            </option>
          </select>
        </div>

        <!-- Template Dropdown -->
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-[var(--text-tertiary)] hidden lg:inline">Template:</span>
          <select
            class="h-8 px-2.5 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-400 cursor-pointer font-medium"
            @change="(e) => loadTemplate((e.target as HTMLSelectElement).value as any)"
          >
            <option value="starter">Starter Showcase</option>
            <option value="prd">Technical PRD Spec</option>
            <option value="meeting">Engineering Meeting</option>
            <option value="changelog">Release Changelog</option>
            <option value="minimal">Empty Document</option>
          </select>
        </div>
      </div>

      <!-- Right Export & Copy CTAs (Primary & Secondary Actions) -->
      <div class="flex items-center gap-1.5 shrink-0">
        <!-- Copy Rich Text (Hero CTA) -->
        <Button
          variant="primary"
          size="sm"
          class="h-8 px-3 text-xs gap-1.5 font-medium cursor-pointer shadow-xs"
          @click="copyRichText"
          title="Copy formatted text to paste into Google Docs or Slack"
        >
          <Check v-if="copiedType === 'rich'" class="w-3.5 h-3.5" />
          <Copy v-else class="w-3.5 h-3.5" />
          <span>{{ copiedType === 'rich' ? 'Copied RTF!' : 'Copy Rich Text' }}</span>
        </Button>

        <!-- Print / PDF -->
        <Button
          variant="secondary"
          size="sm"
          class="h-8 px-2.5 text-xs gap-1.5 cursor-pointer"
          @click="printDocument"
          title="Print or Save as Clean PDF"
        >
          <Printer class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">Print / PDF</span>
        </Button>

        <!-- Download Menu / Actions -->
        <Button
          variant="ghost"
          size="sm"
          class="h-8 px-2 text-xs gap-1 cursor-pointer"
          @click="downloadMarkdown"
          title="Download as .md file"
        >
          <Download class="w-3.5 h-3.5" />
          <span class="hidden md:inline">.md</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          class="h-8 px-2 text-xs gap-1 cursor-pointer"
          @click="downloadHtml"
          title="Download as styled .html file"
        >
          <CodeIcon class="w-3.5 h-3.5" />
          <span class="hidden md:inline">.html</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          class="h-8 w-8 p-0 text-[var(--text-tertiary)] hover:text-red-500 cursor-pointer"
          @click="clearDocument"
          title="Clear Document"
        >
          <Trash class="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>

    <!-- Main Workspace Container -->
    <div
      class="grid gap-4 items-start"
      :class="[
        viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
      ]"
    >
      <!-- Left Column: Markdown Editor -->
      <div
        v-show="viewMode === 'split' || viewMode === 'editor'"
        class="flex flex-col rounded-[14px] border border-[var(--border-card)] bg-[var(--bg-card)] overflow-hidden shadow-xs"
        @dragover.prevent
        @drop="handleFileDrop"
      >
        <!-- Editor Format Helper Toolbar -->
        <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)] bg-zinc-50/80 dark:bg-[#1a1a1c] overflow-x-auto text-xs">
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              :disabled="!canUndo"
              @click="undo"
              title="Undo (Ctrl+Z)"
            >
              <Undo class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              class="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              :disabled="!canRedo"
              @click="redo"
              title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
            >
              <Redo class="w-3.5 h-3.5" />
            </button>
            <div class="w-px h-3.5 bg-zinc-200 dark:bg-zinc-700 mx-1" />
            <button
              type="button"
              class="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              @click="insertSnippet('**', '**', 'bold text')"
              title="Bold (Ctrl+B)"
            >
              <BoldIcon class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              class="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              @click="insertSnippet('*', '*', 'italic text')"
              title="Italic (Ctrl+I)"
            >
              <ItalicIcon class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              class="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              @click="insertSnippet('~~', '~~', 'strikethrough text')"
              title="Strikethrough"
            >
              <Strikethrough class="w-3.5 h-3.5" />
            </button>
            <div class="w-px h-3.5 bg-zinc-200 dark:bg-zinc-700 mx-1" />
            <button
              type="button"
              class="px-1.5 py-1 font-mono text-[11px] font-bold rounded hover:bg-zinc-200 dark:hover:bg-zinc-700/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              @click="insertSnippet('## ', '', 'Heading 2')"
              title="Heading 2"
            >
              H2
            </button>
            <button
              type="button"
              class="px-1.5 py-1 font-mono text-[11px] font-bold rounded hover:bg-zinc-200 dark:hover:bg-zinc-700/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              @click="insertSnippet('### ', '', 'Heading 3')"
              title="Heading 3"
            >
              H3
            </button>
            <div class="w-px h-3.5 bg-zinc-200 dark:bg-zinc-700 mx-1" />
            <button
              type="button"
              class="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              @click="insertSnippet('> [!NOTE]\n> ', '', 'Important note details here')"
              title="GitHub Note Alert"
            >
              <InfoCircle class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              class="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              @click="insertSnippet('```typescript\n', '\n```', '// Code snippet here')"
              title="Code Block"
            >
              <CodeIcon class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              class="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              @click="insertSnippet('- [ ] ', '', 'New action item')"
              title="Checklist / Task"
            >
              <CheckCircle class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              class="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              @click="insertSnippet('| Column 1 | Column 2 |\n| :--- | :--- |\n| Value 1 | Value 2 |\n', '', '')"
              title="Table"
            >
              <TableIcon class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              class="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              @click="insertSnippet('\n---\n', '', '')"
              title="Divider"
            >
              <Minus class="w-3.5 h-3.5" />
            </button>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="px-2 py-1 text-[11px] font-medium rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-[var(--text-tertiary)] hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center gap-1 cursor-pointer"
              @click="clearDocument"
              title="Clear all text"
            >
              <Trash class="w-3 h-3" />
              <span>Clear</span>
            </button>
            <span class="text-zinc-300 dark:text-zinc-700 hidden sm:inline">•</span>
            <div class="text-[11px] font-mono text-[var(--text-tertiary)] shrink-0 hidden sm:inline">
              Drag .md file here
            </div>
          </div>
        </div>

        <!-- Textarea -->
        <textarea
          ref="textareaRef"
          v-model="content"
          @keydown="handleKeydown"
          class="w-full min-h-[560px] p-4 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-tertiary)] font-mono text-xs sm:text-[13px] leading-relaxed resize-y focus:outline-none selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-zinc-900"
          placeholder="Write your markdown here or drag & drop a .md file..."
          spellcheck="false"
        />
      </div>

      <!-- Right Column: Live Styled Preview (Printable Area) -->
      <div
        v-show="viewMode === 'split' || viewMode === 'preview'"
        ref="previewContainerRef"
        class="markdown-preview-card flex flex-col rounded-[14px] border border-[var(--border-card)] bg-white dark:bg-[#18181a] overflow-hidden shadow-xs min-h-[560px]"
      >
        <!-- Preview Header Bar (Hidden in Print) -->
        <div class="print:hidden flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)] bg-zinc-50/80 dark:bg-[#1c1c1e] text-xs font-mono text-[var(--text-tertiary)]">
          <div class="flex items-center gap-2">
            <span class="font-medium text-[var(--text-secondary)]">Live Output</span>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 cursor-pointer"
              @click="copyMarkdown"
              title="Copy Raw Markdown"
            >
              <Copy class="w-3 h-3" />
              <span>Copy .md</span>
            </button>
          </div>
        </div>

        <!-- Rendered Typography Container -->
        <div
          class="markdown-rendered-body flex-1 p-6 sm:p-10 overflow-y-auto selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-zinc-900"
          :class="[
            activeTheme === 'modern' ? 'theme-modern font-sans' : '',
            activeTheme === 'editorial' ? 'theme-editorial font-serif' : '',
            activeTheme === 'notion' ? 'theme-notion font-sans' : '',
            activeTheme === 'mono' ? 'theme-mono font-mono' : '',
            activeTheme === 'academic' ? 'theme-academic font-serif' : '',
          ]"
          v-html="renderedHtml"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Inline Code pill */
:deep(.markdown-inline-code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85em;
  padding: 0.2em 0.4em;
  border-radius: 6px;
  background-color: var(--bg-card-hover, rgba(0, 0, 0, 0.05));
  border: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.1));
  color: var(--text-primary);
}

/* Theme: Minimalist Modern */
.theme-modern {
  color: var(--text-secondary);
}

/* Theme: Editorial Serif */
.theme-editorial {
  font-family: Georgia, Cambria, 'Times New Roman', Times, serif;
  line-height: 1.8;
}
.theme-editorial :deep(h1),
.theme-editorial :deep(h2),
.theme-editorial :deep(h3) {
  font-family: Georgia, Cambria, serif;
  letter-spacing: -0.02em;
}

/* Theme: Notion Clean */
.theme-notion {
  line-height: 1.75;
}

/* Theme: Cyber Monospace */
.theme-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  letter-spacing: -0.01em;
}
.theme-mono :deep(h1),
.theme-mono :deep(h2),
.theme-mono :deep(h3) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* Theme: Academic Paper */
.theme-academic {
  font-family: 'Times New Roman', Times, Georgia, serif;
  text-align: justify;
  line-height: 1.7;
}

/* Clean Print to PDF Stylesheet */
@media print {
  body {
    background: white !important;
    color: black !important;
  }

  /* Hide app shell elements when printing */
  aside,
  header,
  nav,
  #sidebar-collapse-toggle,
  .print\:hidden {
    display: none !important;
  }

  #markdown-studio-root {
    padding: 0 !important;
    margin: 0 !important;
  }

  .markdown-preview-card {
    border: none !important;
    box-shadow: none !important;
    background: white !important;
    padding: 0 !important;
  }

  .markdown-rendered-body {
    padding: 0 !important;
    color: #111 !important;
  }

  pre, blockquote, table {
    page-break-inside: avoid;
  }
}
</style>
