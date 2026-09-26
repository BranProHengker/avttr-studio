<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import {
  FolderCheck,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Download,
  Copy,
  Terminal,
  RefreshCw,
  Loader2,
  Archive,
  FileCode,
  Folder,
} from 'lucide-vue-next'
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
  nextTick(() => {
    const el = document.getElementById(`code-line-${finding.line}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

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

    <!-- Search Omnibar -->
    <div class="relative flex items-center w-full">
      <div class="absolute left-4 pointer-events-none text-[var(--text-secondary)]">
        <FolderCheck class="w-5 h-5 text-[var(--text-secondary)]" />
      </div>
      <input
        v-model="inputQuery"
        type="text"
        placeholder="Paste GitHub repo, skill URL, or command (npx skills add https://github.com/... --skill ...)..."
        class="w-full h-12 pl-12 pr-28 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all font-mono"
        @keydown.enter="handleInspect"
      />
      <div class="absolute right-2 flex items-center gap-1.5">
        <Button
          v-if="!inputQuery"
          variant="secondary"
          size="sm"
          class="h-8 px-2.5 text-xs cursor-pointer"
          @click="handlePaste"
        >
          Paste
        </Button>
        <Button
          variant="primary"
          size="sm"
          class="h-8 px-3 text-xs font-medium cursor-pointer"
          :disabled="isLoading || !inputQuery.trim()"
          @click="handleInspect"
        >
          <Loader2 v-if="isLoading" class="w-3.5 h-3.5 animate-spin mr-1.5" />
          <span>{{ isLoading ? 'Inspecting...' : 'Inspect' }}</span>
        </Button>
      </div>
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

            <div class="p-2 rounded bg-[#141416] border border-[#262626] font-mono text-[11px] text-neutral-300 truncate">
              {{ f.codeSnippet }}
            </div>
          </div>
        </div>
      </div>

      <!-- Zero Findings Clean Banner (Takes only 1 line, leaves full width for code) -->
      <div
        v-else
        class="flex items-center gap-3 px-4 py-3 rounded-[12px] bg-[var(--bg-card)] border border-[var(--border-card)] text-xs text-neutral-300"
      >
        <ShieldCheck class="w-4 h-4 text-white shrink-0" />
        <span class="font-medium text-white">No Security Threats Detected:</span>
        <span class="text-[var(--text-secondary)]">
          All {{ files.length }} files verified clean. No prompt overrides, destructive shell executions, credential harvesting, or exfiltration patterns detected.
        </span>
      </div>

      <!-- Full-Width Code Viewer Stage -->
      <div class="w-full bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[14px] overflow-hidden">
        <!-- File Selector / Tabs Header -->
        <div class="px-4 py-2 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 text-xs font-mono">
          <div class="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-[80%]">
            <button
              v-for="f in files"
              :key="f.path"
              type="button"
              class="px-2.5 py-1 rounded text-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer border"
              :class="
                activeFile?.path === f.path
                  ? 'bg-[#2E2E2E] text-white font-medium border-white/20 shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/5 border-transparent'
              "
              @click="activeFilePath = f.path"
            >
              <FileCode class="w-3.5 h-3.5" />
              <span>{{ f.path.split('/').pop() }}</span>
            </button>
          </div>

          <span class="text-[11px] text-[var(--text-secondary)] shrink-0">
            {{ codeLines.length }} lines
          </span>
        </div>

        <!-- Full-Width Code Lines Viewer -->
        <div class="max-h-[640px] overflow-y-auto overflow-x-auto p-4 font-mono text-xs select-text">
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
                : 'hover:bg-white/5 text-neutral-300'
            ]"
          >
            <span class="w-10 shrink-0 text-right text-[11px] select-none text-neutral-600">
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
