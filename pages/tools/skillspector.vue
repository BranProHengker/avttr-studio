<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import {
  Folder as FolderCheck,
  ShieldCheck,
  ShieldAlert,
  WarningTriangle as AlertTriangle,
  Download,
  Copy,
  Terminal,
  Refresh as RefreshCw,
  SystemRestart as Loader2,
  Archive,
  PageEdit as FileCode,
  Folder,
  Eye,
  CodeBrackets as Code2,
  PasteClipboard as Clipboard,
  X,
} from '@iconoir/vue'
import JSZip from 'jszip'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'
import { useToast } from '~/composables/useToast'
import { useSkillAuditor, type SkillAuditReport, type SecurityFinding } from '~/composables/useSkillAuditor'

interface SkillFile {
  path: string
  content: string
}

const { show: showToast } = useToast()
const { auditFiles } = useSkillAuditor()

const inputQuery = ref('')
const isLoading = ref(false)
const isDragging = ref(false)
const folderInputRef = ref<HTMLInputElement | null>(null)

// Current skill inspection state
const skillName = ref('')
const repoOwner = ref('')
const repoName = ref('')
const installCommand = ref('')
const availableSkills = ref<string[]>([])
const files = ref<SkillFile[]>([])
const activeFilePath = ref('')
const activeFinding = ref<SecurityFinding | null>(null)

// Audit report
const report = ref<SkillAuditReport | null>(null)

const activeFile = computed(() => {
  if (files.value.length === 0) return null
  return files.value.find(f => f.path === activeFilePath.value) || files.value[0]
})

const codeLines = computed(() => {
  if (!activeFile.value) return []
  return activeFile.value.content.split(/\r?\n/)
})

const totalLines = computed(() => {
  return files.value.reduce((acc, f) => acc + f.content.split(/\r?\n/).length, 0)
})

const findingsForActiveFile = computed(() => {
  const map: Record<number, SecurityFinding[]> = {}
  if (!report.value || !activeFile.value) return map
  for (const f of report.value.findings) {
    if (
      f.filename === activeFile.value.path ||
      f.filename.endsWith(activeFile.value.path) ||
      activeFile.value.path.endsWith(f.filename)
    ) {
      if (!map[f.line]) map[f.line] = []
      map[f.line].push(f)
    }
  }
  return map
})

const hasFindingsInActiveFile = computed(() => {
  return Object.keys(findingsForActiveFile.value).length > 0
})

const isMarkdownFile = computed(() => {
  if (!activeFile.value) return false
  return /\.md$/i.test(activeFile.value.path)
})

const markdownViewMode = ref<'preview' | 'raw'>('preview')

interface ParsedSkillDoc {
  frontmatter: Record<string, string> | null
  html: string
}

const parsedMarkdownDoc = computed<ParsedSkillDoc>(() => {
  if (!activeFile.value || !isMarkdownFile.value) {
    return { frontmatter: null, html: '' }
  }

  const content = activeFile.value.content
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)

  let frontmatter: Record<string, string> | null = null
  let body = content

  if (fmMatch) {
    const rawYaml = fmMatch[1]
    body = fmMatch[2]
    const fm: Record<string, string> = {}
    const lines = rawYaml.split(/\r?\n/)
    let currentKey = ''
    for (const line of lines) {
      const keyMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/)
      if (keyMatch) {
        currentKey = keyMatch[1]
        fm[currentKey] = keyMatch[2].trim()
      } else if (currentKey && (line.startsWith('  ') || line.startsWith('\t'))) {
        fm[currentKey] = (fm[currentKey] ? fm[currentKey] + ' ' : '') + line.trim()
      }
    }
    frontmatter = Object.keys(fm).length > 0 ? fm : null
  }

  const formatInline = (text: string): string => {
    let out = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    out = out.replace(/\*\*\*(.*?)\*\*\*/g, '<strong class="font-bold text-[var(--text-primary)]"><em>$1</em></strong>')
    out = out.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[var(--text-primary)]">$1</strong>')
    out = out.replace(/\*(.*?)\*/g, '<em class="text-[var(--text-secondary)] italic">$1</em>')

    out = out.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-[#212121] border border-zinc-200 dark:border-[#2E2E2E] font-mono text-[11px] text-[var(--text-primary)]">$1</code>')
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-400 underline underline-offset-2">$1</a>')

    return out
  }

  const rawLines = body.split(/\r?\n/)
  const htmlChunks: string[] = []
  let inCodeBlock = false
  let codeBlockLang = ''
  let codeBlockLines: string[] = []
  let inTable = false
  let tableHeaders: string[] = []
  let tableRows: string[][] = []

  const flushTable = () => {
    if (!inTable) return
    let t = '<div class="overflow-x-auto my-4 rounded-xl border border-zinc-200 dark:border-[var(--border-card)] bg-white dark:bg-[var(--bg-card)]"><table class="w-full text-xs text-left border-collapse">'
    if (tableHeaders.length > 0) {
      t += '<thead class="bg-zinc-50 dark:bg-[var(--bg-app)] border-b border-zinc-200 dark:border-[var(--border-card)] text-[var(--text-secondary)] uppercase font-mono text-[10px] tracking-wider"><tr>'
      for (const h of tableHeaders) {
        t += `<th class="px-4 py-2.5 font-semibold">${formatInline(h)}</th>`
      }
      t += '</tr></thead>'
    }
    t += '<tbody class="divide-y divide-zinc-200 dark:divide-[var(--border-subtle)]">'
    for (const row of tableRows) {
      t += '<tr class="hover:bg-zinc-50/80 dark:hover:bg-[var(--bg-card-hover)] transition-colors">'
      for (const cell of row) {
        t += `<td class="px-4 py-2.5 text-[var(--text-secondary)] font-mono text-[11px]">${formatInline(cell)}</td>`
      }
      t += '</tr>'
    }
    t += '</tbody></table></div>'
    htmlChunks.push(t)
    inTable = false
    tableHeaders = []
    tableRows = []
  }

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i]
    const trimmed = rawLine.trim()

    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        if (inTable) flushTable()
        inCodeBlock = true
        codeBlockLang = trimmed.slice(3).trim()
        codeBlockLines = []
      } else {
        inCodeBlock = false
        const escapedCode = codeBlockLines.join('\n')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
        htmlChunks.push(`
          <div class="my-3 rounded-xl border border-zinc-200 dark:border-[#2E2E2E] bg-zinc-50 dark:bg-[#141416] overflow-hidden">
            <div class="px-3.5 py-1.5 bg-zinc-100 dark:bg-[#1a1a1c] border-b border-zinc-200 dark:border-[#2E2E2E] text-[10px] font-mono text-[var(--text-tertiary)] flex items-center justify-between">
              <span>${codeBlockLang || 'code'}</span>
            </div>
            <pre class="p-3.5 text-xs font-mono overflow-x-auto text-[var(--text-primary)] leading-relaxed select-text"><code>${escapedCode}</code></pre>
          </div>
        `)
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine)
      continue
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map(c => c.trim())

      if (cells.every(c => /^:?-+:?$/.test(c))) {
        continue
      }

      if (!inTable) {
        inTable = true
        tableHeaders = cells
      } else {
        tableRows.push(cells)
      }
      continue
    } else if (inTable) {
      flushTable()
    }

    if (!trimmed) {
      continue
    }

    if (/^(---|___|\*\*\*)$/.test(trimmed)) {
      htmlChunks.push('<hr class="my-5 border-zinc-200 dark:border-[var(--border-subtle)]" />')
      continue
    }

    if (trimmed.startsWith('# ')) {
      htmlChunks.push(`<h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-7 mb-3 pb-2 border-b border-zinc-200 dark:border-[var(--border-subtle)]">${formatInline(trimmed.slice(2))}</h1>`)
      continue
    }
    if (trimmed.startsWith('## ')) {
      htmlChunks.push(`<h2 class="text-base sm:text-lg font-bold text-[var(--text-primary)] mt-6 mb-2.5 pb-1 border-b border-zinc-200/80 dark:border-[var(--border-subtle)]/40">${formatInline(trimmed.slice(3))}</h2>`)
      continue
    }
    if (trimmed.startsWith('### ')) {
      htmlChunks.push(`<h3 class="text-sm font-semibold text-[var(--text-primary)] mt-4 mb-2">${formatInline(trimmed.slice(4))}</h3>`)
      continue
    }
    if (trimmed.startsWith('#### ')) {
      htmlChunks.push(`<h4 class="text-xs font-semibold text-[var(--text-primary)] mt-3 mb-1.5 uppercase tracking-wider font-mono">${formatInline(trimmed.slice(5))}</h4>`)
      continue
    }

    if (trimmed.startsWith('> ')) {
      htmlChunks.push(`<blockquote class="border-l-2 border-zinc-400 dark:border-zinc-600 pl-3.5 my-2.5 text-xs text-[var(--text-secondary)] italic leading-relaxed">${formatInline(trimmed.slice(2))}</blockquote>`)
      continue
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      htmlChunks.push(`<div class="flex items-start gap-2.5 my-1.5 text-xs text-[var(--text-secondary)] leading-relaxed"><span class="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600 shrink-0 mt-1.5"></span><span class="flex-1">${formatInline(trimmed.slice(2))}</span></div>`)
      continue
    }

    const numMatch = trimmed.match(/^(\d+)\.\s*(.*)/)
    if (numMatch) {
      htmlChunks.push(`<div class="flex items-start gap-3 my-2 text-xs text-[var(--text-secondary)] leading-relaxed"><span class="font-mono text-[11px] font-bold text-[var(--text-tertiary)] shrink-0 mt-0.5">${numMatch[1]}.</span><span class="flex-1">${formatInline(numMatch[2])}</span></div>`)
      continue
    }

    htmlChunks.push(`<p class="text-xs text-[var(--text-secondary)] leading-relaxed my-2">${formatInline(trimmed)}</p>`)
  }

  if (inTable) flushTable()

  return {
    frontmatter,
    html: htmlChunks.join('\n')
  }
})

const handlePaste = async () => {
  try {
    const text = await navigator.clipboard.readText()
    if (text) {
      inputQuery.value = text.trim()
      handleInspect()
    }
  } catch {
    showToast({ title: 'Gagal membaca clipboard', type: 'error' })
  }
}

const clearInput = () => {
  inputQuery.value = ''
}

const handleInspect = async () => {
  const query = inputQuery.value.trim()
  if (!query) return

  isLoading.value = true
  activeFinding.value = null

  try {
    const data = await $fetch<{
      success: boolean
      owner: string
      repo: string
      branch: string
      selectedSkill: string
      availableSkills: string[]
      primaryContent: string
      installCommand: string
      files?: Array<{ name: string; path: string; content: string }>
    }>('/api/tools/skillspector', {
      method: 'POST',
      body: {
        input: query,
        selectedSkill: skillName.value || undefined,
      },
    })

    if (data && data.success) {
      repoOwner.value = data.owner
      repoName.value = data.repo
      skillName.value = data.selectedSkill || data.repo
      availableSkills.value = data.availableSkills || []
      installCommand.value = data.installCommand

      const skillFiles: SkillFile[] = data.files && data.files.length > 0
        ? data.files.map(f => ({ path: f.path, content: f.content }))
        : [{ path: data.selectedSkill ? `${data.selectedSkill}/SKILL.md` : 'SKILL.md', content: data.primaryContent }]

      files.value = skillFiles
      activeFilePath.value = skillFiles[0].path
      report.value = auditFiles(skillFiles)
    }
  } catch (err: any) {
    showToast({
      title: 'Gagal memindai repositori',
      description: err?.data?.message || err?.message || 'Pastikan repo publik dan path valid.',
      type: 'error',
    })
  } finally {
    isLoading.value = false
  }
}

const selectSkillFromRepo = async (skill: string) => {
  if (skill === skillName.value && report.value) return
  skillName.value = skill
  isLoading.value = true
  try {
    const fullQuery = repoOwner.value && repoName.value
      ? `https://github.com/${repoOwner.value}/${repoName.value}`
      : inputQuery.value

    const data = await $fetch<{
      success: boolean
      owner: string
      repo: string
      branch: string
      selectedSkill: string
      availableSkills: string[]
      primaryContent: string
      installCommand: string
    }>('/api/tools/skillspector', {
      method: 'POST',
      body: {
        input: fullQuery,
        selectedSkill: skill,
      },
    })

    if (data && data.success) {
      const skillFiles: SkillFile[] = [
        { path: `${skill}/SKILL.md`, content: data.primaryContent },
      ]
      files.value = skillFiles
      activeFilePath.value = skillFiles[0].path
      installCommand.value = data.installCommand
      report.value = auditFiles(skillFiles)
      activeFinding.value = null
    }
  } catch (err: any) {
    showToast({
      title: 'Gagal memuat skill',
      description: err?.data?.message || err?.message,
      type: 'error',
    })
  } finally {
    isLoading.value = false
  }
}

const triggerFolderInput = () => {
  folderInputRef.value?.click()
}

const handleFolderSelect = async (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    const list: SkillFile[] = []
    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i]
      if (file.size < 5 * 1024 * 1024) {
        const text = await file.text()
        const path = file.webkitRelativePath || file.name
        list.push({ path, content: text })
      }
    }
    if (list.length > 0) {
      processFolderFiles(list)
    }
  }
}

const handleDrop = async (e: DragEvent) => {
  isDragging.value = false
  if (!e.dataTransfer) return

  const items = e.dataTransfer.items
  if (items && items.length > 0) {
    const list = await extractFilesFromDataTransfer(items)
    if (list.length > 0) {
      processFolderFiles(list)
      return
    }
  }

  // Fallback to standard file drop
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const list: SkillFile[] = []
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      const file = e.dataTransfer.files[i]
      if (file.size < 5 * 1024 * 1024) {
        const text = await file.text()
        list.push({ path: file.name, content: text })
      }
    }
    if (list.length > 0) {
      processFolderFiles(list)
    }
  }
}

const extractFilesFromDataTransfer = async (items: DataTransferItemList): Promise<SkillFile[]> => {
  const result: SkillFile[] = []

  const traverse = async (entry: any, currentPath = ''): Promise<void> => {
    if (!entry) return
    if (entry.isFile) {
      const file: File = await new Promise((resolve, reject) => entry.file(resolve, reject))
      if (file.size < 5 * 1024 * 1024) {
        const text = await file.text()
        const path = currentPath ? `${currentPath}/${file.name}` : file.name
        result.push({ path, content: text })
      }
    } else if (entry.isDirectory) {
      const reader = entry.createReader()
      const readEntries = async (): Promise<any[]> => {
        const list: any[] = []
        let batch: any[]
        do {
          batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject))
          list.push(...batch)
        } while (batch.length > 0)
        return list
      }
      const children = await readEntries()
      const dirPath = currentPath ? `${currentPath}/${entry.name}` : entry.name
      for (const child of children) {
        await traverse(child, dirPath)
      }
    }
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.webkitGetAsEntry) {
      const entry = item.webkitGetAsEntry()
      if (entry) await traverse(entry, '')
    }
  }

  return result
}

const processFolderFiles = (list: SkillFile[]) => {
  const firstPath = list[0].path
  const segments = firstPath.split('/')
  const detectedName = segments.length > 1 ? segments[0] : firstPath.replace(/\.[^/.]+$/, '')

  skillName.value = detectedName
  repoOwner.value = 'local'
  repoName.value = detectedName
  availableSkills.value = []
  installCommand.value = `// Local skill folder: ${detectedName}`
  files.value = list

  // Prioritize opening SKILL.md or the first code file
  const mainSkillFile = list.find(f => f.path.endsWith('SKILL.md') || f.path.endsWith('skill.md'))
  activeFilePath.value = mainSkillFile ? mainSkillFile.path : list[0].path

  report.value = auditFiles(list)
}

const downloadZip = async () => {
  if (files.value.length === 0) return
  try {
    const zip = new JSZip()
    const folderName = skillName.value || 'skill'
    const folder = zip.folder(folderName)

    for (const f of files.value) {
      // Clean relative path without repeating root folder name
      const relativePath = f.path.startsWith(`${folderName}/`)
        ? f.path.slice(folderName.length + 1)
        : f.path
      folder?.file(relativePath, f.content)
    }

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${folderName}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    showToast({ title: 'Skill berhasil diunduh as .zip', type: 'success' })
  } catch {
    showToast({ title: 'Gagal membuat file .zip', type: 'error' })
  }
}

const copyInstallCommand = async () => {
  if (!installCommand.value) return
  try {
    await navigator.clipboard.writeText(installCommand.value)
    showToast({ title: 'Command berhasil disalin', type: 'success' })
  } catch {
    showToast({ title: 'Gagal menyalin command', type: 'error' })
  }
}

const copyCode = async () => {
  if (!activeFile.value) return
  try {
    await navigator.clipboard.writeText(activeFile.value.content)
    showToast({ title: 'Kode berhasil disalin', type: 'success' })
  } catch {
    showToast({ title: 'Gagal menyalin kode', type: 'error' })
  }
}

const scrollToFinding = (finding: SecurityFinding) => {
  activeFinding.value = finding
  activeFilePath.value = finding.filename
  markdownViewMode.value = 'raw'
  nextTick(() => {
    const el = document.getElementById(`code-line-${finding.line}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

watch(activeFilePath, (newPath) => {
  if (/\.md$/i.test(newPath)) {
    markdownViewMode.value = 'preview'
  }
})

const resetScanner = () => {
  report.value = null
  files.value = []
  activeFilePath.value = ''
  skillName.value = ''
  availableSkills.value = []
  activeFinding.value = null
  inputQuery.value = ''
}
</script>

<template>
  <div class="space-y-6 pb-12 w-full">
    <!-- Breadcrumbs -->
    <div class="flex items-center gap-2 text-xs font-mono text-[var(--text-secondary)]">
      <NuxtLink to="/" class="hover:text-white transition-colors">Dashboard</NuxtLink>
      <span>/</span>
      <span>Developer</span>
      <span>/</span>
      <span class="text-[var(--text-primary)]">SkillSpector</span>
    </div>

    <!-- Page Header -->
    <div class="space-y-1">
      <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
        SkillSpector
      </h1>
      <p class="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
        Static pattern & AST security inspector for AI Agent skills. Statically analyze prompt injections, secret leaks, reverse shells, and unsafe execution across skill directories.
      </p>
    </div>

    <!-- Search Omnibar (DESIGN.md Section 11 Architecture) -->
    <div class="flex flex-col sm:flex-row items-center gap-2.5 w-full">
      <div class="relative flex-1 w-full flex items-center">
        <!-- Leading Icon -->
        <div class="absolute left-3.5 flex items-center justify-center pointer-events-none text-[var(--text-tertiary)]">
          <FolderCheck class="w-4 h-4" />
        </div>

        <input
          v-model="inputQuery"
          type="text"
          placeholder="https://github.com/owner/repo atau npx skills add..."
          class="w-full h-12 pl-10 pr-20 bg-white dark:bg-[#171717] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] border border-zinc-200 dark:border-[#2E2E2E] focus:border-zinc-400 dark:focus:border-white/40 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 disabled:opacity-50 shadow-xs font-mono"
          :disabled="isLoading"
          @keydown.enter="handleInspect"
        />

        <!-- Trailing Micro-Actions -->
        <div class="absolute right-2.5 flex items-center gap-1">
          <button
            v-if="inputQuery"
            type="button"
            class="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer rounded-md hover:bg-zinc-100 dark:hover:bg-white/10"
            title="Clear"
            @click="clearInput"
          >
            <X class="w-4 h-4" />
          </button>
          <button
            type="button"
            class="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer rounded-md hover:bg-zinc-100 dark:hover:bg-white/10"
            title="Paste"
            @click="handlePaste"
          >
            <Clipboard class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Standalone CTA Action Button -->
      <Button
        variant="primary"
        size="default"
        class="w-full sm:w-auto shrink-0 h-12 px-5 rounded-xl font-medium text-xs sm:text-sm cursor-pointer"
        :disabled="isLoading || !inputQuery.trim()"
        @click="handleInspect"
      >
        <Loader2 v-if="isLoading" class="w-4 h-4 animate-spin mr-1.5" />
        <span>{{ isLoading ? 'Inspecting...' : 'Inspect Skill' }}</span>
      </Button>
    </div>

    <!-- Recursive Folder Dropzone -->
    <div
      v-if="!report"
      class="relative border-2 border-dashed rounded-[14px] p-8 sm:p-14 border-zinc-300 dark:border-[#2E2E2E] bg-zinc-50/50 dark:bg-[#141416] hover:border-zinc-400 dark:hover:border-[#3E3E3E] text-center cursor-pointer select-none transition-all group"
      :class="isDragging ? 'border-zinc-900 bg-zinc-100 dark:border-white/50 dark:bg-[#1a1a1c]' : ''"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
      @click="triggerFolderInput"
    >
      <input
        ref="folderInputRef"
        type="file"
        webkitdirectory
        directory
        multiple
        class="hidden"
        @change="handleFolderSelect"
      />
      <div class="w-12 h-12 mx-auto rounded-xl bg-white dark:bg-[#212121] border border-zinc-200 dark:border-[#2E2E2E] flex items-center justify-center text-zinc-900 dark:text-white shadow-xs group-hover:scale-105 transition-transform">
        <Folder class="w-6 h-6 text-zinc-900 dark:text-white" />
      </div>
      <div class="mt-4 text-sm font-semibold text-[var(--text-primary)]">
        Drop your skill folder here or browse
      </div>
      <div class="text-xs text-[var(--text-secondary)] mt-1">
        Supports full skill directories containing SKILL.md, .py, .sh, .ts, .mcp, and .json files. 100% processed client-side.
      </div>
    </div>

    <!-- Inspection Results Workspace -->
    <div v-if="report" class="space-y-4">
      <!-- Multi-Skill Explorer Pills (if repo has multiple skills) -->
      <div
        v-if="availableSkills.length > 1"
        class="flex items-center gap-2 overflow-x-auto pb-1 text-xs"
      >
        <span class="text-[var(--text-secondary)] font-mono shrink-0">Skills:</span>
        <button
          v-for="s in availableSkills"
          :key="s"
          type="button"
          class="px-2.5 py-1 rounded-md text-xs font-mono transition-all cursor-pointer shrink-0 border"
          :class="
            skillName === s
              ? 'bg-white text-black font-semibold border-white'
              : 'bg-[#212121] text-[var(--text-secondary)] hover:text-white border-[#2E2E2E]'
          "
          @click="selectSkillFromRepo(s)"
        >
          {{ s }}
        </button>
      </div>

      <!-- Flat Clean Toolbar Row (No Boxed Rectangle Shape) -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
        <!-- Status & Metadata -->
        <div class="flex items-center gap-3">
          <span class="font-mono text-sm font-bold text-white">
            {{ skillName }}
          </span>

          <Badge
            :variant="report.status === 'danger' ? 'primary' : report.status === 'warning' ? 'secondary' : 'badge'"
          >
            {{ report.status === 'danger' ? 'CRITICAL RISK' : report.status === 'warning' ? 'WARNING' : 'CLEAN' }}
            ({{ report.score }}/100)
          </Badge>

          <span class="text-xs text-[var(--text-secondary)] font-mono">
            {{ files.length }} files · {{ totalLines }} lines
          </span>
        </div>

        <!-- Action Buttons Directly on Row -->
        <div class="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            class="h-8 px-3 text-xs font-medium cursor-pointer"
            @click="downloadZip"
          >
            <Archive class="w-3.5 h-3.5 mr-1.5" />
            Download ZIP
          </Button>

          <Button
            v-if="installCommand && !installCommand.startsWith('//')"
            variant="secondary"
            size="sm"
            class="h-8 px-2.5 text-xs cursor-pointer"
            @click="copyInstallCommand"
          >
            <Terminal class="w-3.5 h-3.5 mr-1.5" />
            Copy Command
          </Button>

          <Button
            variant="secondary"
            size="sm"
            class="h-8 px-2.5 text-xs cursor-pointer"
            @click="copyCode"
          >
            <Copy class="w-3.5 h-3.5 mr-1.5" />
            Copy Code
          </Button>

          <Button
            variant="ghost"
            size="sm"
            class="h-8 px-2 text-xs cursor-pointer"
            @click="resetScanner"
          >
            <RefreshCw class="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <!-- Security Findings Panel (Proportional Top Section) -->
      <div v-if="report.findings.length > 0" class="space-y-2">
        <div class="flex items-center justify-between px-1">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Security Findings ({{ report.findings.length }})
            </span>
            <span
              class="text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold"
              :class="report.criticalCount > 0 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'"
            >
              {{ report.criticalCount > 0 ? `${report.criticalCount} Critical` : '' }}
              {{ report.criticalCount > 0 && report.warningCount > 0 ? ' · ' : '' }}
              {{ report.warningCount > 0 ? `${report.warningCount} Warnings` : '' }}
            </span>
          </div>

          <span class="text-xs text-[var(--text-secondary)] font-mono">
            Click finding to jump to code line
          </span>
        </div>

        <!-- Findings List in Clean Compact Rows -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div
            v-for="f in report.findings"
            :key="f.id"
            class="p-3.5 rounded-[12px] bg-[var(--bg-card)] border transition-all cursor-pointer group space-y-2 text-left"
            :class="
              activeFinding?.id === f.id
                ? 'border-white/50 bg-[var(--bg-card-hover)] ring-1 ring-white/20'
                : 'border-[var(--border-card)] hover:border-[#3E3E3E]'
            "
            @click="scrollToFinding(f)"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <ShieldAlert v-if="f.severity === 'critical'" class="w-4 h-4 text-rose-400 shrink-0" />
                <AlertTriangle v-else class="w-4 h-4 text-amber-400 shrink-0" />
                <span class="text-xs font-semibold text-white truncate">
                  {{ f.title }}
                </span>
              </div>
              <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#212121] text-neutral-400 shrink-0">
                Line {{ f.line }}
              </span>
            </div>

            <div class="text-[11px] font-mono text-[var(--text-secondary)] truncate">
              {{ f.filename }}
            </div>

            <div class="p-2 rounded bg-zinc-100 dark:bg-[#141416] border border-zinc-200 dark:border-[#262626] font-mono text-[11px] text-[var(--text-primary)] truncate">
              {{ f.codeSnippet }}
            </div>
          </div>
        </div>
      </div>

      <!-- Zero Findings Clean Banner (Takes only 1 line, leaves full width for code) -->
      <div
        v-else
        class="flex items-center gap-3 px-4 py-3 rounded-[12px] bg-[var(--bg-card)] border border-[var(--border-card)] text-xs text-[var(--text-secondary)]"
      >
        <ShieldCheck class="w-4 h-4 text-emerald-500 shrink-0" />
        <span class="font-medium text-[var(--text-primary)]">No Security Threats Detected:</span>
        <span class="text-[var(--text-secondary)]">
          All {{ files.length }} files verified clean. No prompt overrides, destructive shell executions, credential harvesting, or exfiltration patterns detected.
        </span>
      </div>

      <!-- Full-Width Code Viewer Stage -->
      <div class="w-full bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[14px] overflow-hidden">
        <!-- File Selector / Tabs Header -->
        <div class="px-4 py-2 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 text-xs font-mono">
          <div class="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-[70%] sm:max-w-[75%]">
            <button
              v-for="f in files"
              :key="f.path"
              type="button"
              class="px-2.5 py-1 rounded text-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer border"
              :class="
                activeFile?.path === f.path
                  ? 'bg-white dark:bg-[#2E2E2E] text-zinc-900 dark:text-white font-medium border-zinc-200 dark:border-white/20 shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 border-transparent'
              "
              @click="activeFilePath = f.path"
            >
              <FileCode class="w-3.5 h-3.5" />
              <span>{{ f.path.split('/').pop() }}</span>
            </button>
          </div>

          <!-- Controls: Markdown Preview / Raw Switcher & Line Count -->
          <div class="flex items-center gap-2.5 shrink-0">
            <!-- View Mode Switcher for Markdown -->
            <div
              v-if="isMarkdownFile"
              class="flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-[#141416] border border-zinc-200 dark:border-[#2E2E2E]"
            >
              <button
                type="button"
                class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer"
                :class="
                  markdownViewMode === 'preview'
                    ? 'bg-white dark:bg-[#2E2E2E] text-zinc-900 dark:text-white shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                "
                @click="markdownViewMode = 'preview'"
              >
                <Eye class="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
              <button
                type="button"
                class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer"
                :class="
                  markdownViewMode === 'raw'
                    ? 'bg-white dark:bg-[#2E2E2E] text-zinc-900 dark:text-white shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                "
                @click="markdownViewMode = 'raw'"
              >
                <Code2 class="w-3.5 h-3.5" />
                <span>Raw</span>
              </button>
            </div>

            <span class="text-[11px] text-[var(--text-secondary)] shrink-0 font-mono">
              {{ codeLines.length }} lines
            </span>
          </div>
        </div>

        <!-- Rendered Markdown Preview (Active on Markdown file & Preview mode) -->
        <div
          v-if="isMarkdownFile && markdownViewMode === 'preview'"
          class="max-h-[640px] overflow-y-auto p-5 sm:p-6 space-y-6 select-text"
        >
          <!-- Frontmatter Specification Bento Card -->
          <div
            v-if="parsedMarkdownDoc.frontmatter"
            class="p-4 rounded-xl border border-zinc-200 dark:border-[#2E2E2E] bg-zinc-50 dark:bg-[#141416] space-y-3"
          >
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-mono uppercase font-bold tracking-wider text-[var(--text-tertiary)]">
                Skill Specification (Frontmatter)
              </span>
              <Badge variant="outline" size="sm" class="text-[10px] font-mono">
                YAML Metadata
              </Badge>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div
                v-for="(val, key) in parsedMarkdownDoc.frontmatter"
                :key="key"
                class="p-2.5 rounded-lg bg-white dark:bg-[#1c1c1f] border border-zinc-200/80 dark:border-[#262626] space-y-0.5"
              >
                <div class="text-[10px] font-mono font-semibold text-[var(--text-secondary)] uppercase">
                  {{ key }}
                </div>
                <div class="text-xs font-mono text-[var(--text-primary)] break-words">
                  {{ val }}
                </div>
              </div>
            </div>
          </div>

          <!-- Finding warning indicator in active file -->
          <div
            v-if="hasFindingsInActiveFile"
            class="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-300"
          >
            <div class="flex items-center gap-2">
              <AlertTriangle class="w-4 h-4 shrink-0" />
              <span>
                File ini memiliki {{ Object.keys(findingsForActiveFile).length }} baris dengan indikasi risiko keamanan.
              </span>
            </div>
            <button
              type="button"
              class="font-mono text-[11px] underline underline-offset-2 hover:text-amber-500 cursor-pointer shrink-0"
              @click="markdownViewMode = 'raw'"
            >
              Lihat di Raw Code
            </button>
          </div>

          <!-- Rendered Markdown Body Content -->
          <div
            class="prose dark:prose-invert max-w-none text-xs leading-relaxed text-[var(--text-primary)]"
            v-html="parsedMarkdownDoc.html"
          />
        </div>

        <!-- Full-Width Code Lines Viewer (Raw mode or Non-Markdown) -->
        <div
          v-else
          class="max-h-[640px] overflow-y-auto overflow-x-auto p-4 font-mono text-xs select-text"
        >
          <div
            v-for="(line, idx) in codeLines"
            :id="`code-line-${idx + 1}`"
            :key="idx"
            class="flex items-start gap-4 py-0.5 px-2 rounded transition-colors"
            :class="[
              findingsForActiveFile[idx + 1]
                ? findingsForActiveFile[idx + 1][0].severity === 'critical'
                  ? 'bg-rose-950/40 text-rose-200 border border-rose-800/40'
                  : 'bg-amber-950/40 text-amber-200 border border-amber-800/40'
                : activeFinding?.line === idx + 1 && activeFinding?.filename === activeFile?.path
                ? 'bg-white/10'
                : 'hover:bg-zinc-100 dark:hover:bg-white/5 text-[var(--text-secondary)] dark:text-neutral-300'
            ]"
          >
            <span class="w-10 shrink-0 text-right text-[11px] select-none text-neutral-500 dark:text-neutral-600">
              {{ idx + 1 }}
            </span>

            <div class="flex-1 whitespace-pre-wrap break-all leading-relaxed">
              {{ line || ' ' }}
            </div>

            <span
              v-if="findingsForActiveFile[idx + 1]"
              class="shrink-0 text-[9px] uppercase font-bold px-1 rounded"
              :class="findingsForActiveFile[idx + 1][0].severity === 'critical' ? 'text-rose-400' : 'text-amber-400'"
            >
              {{ findingsForActiveFile[idx + 1][0].severity }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
