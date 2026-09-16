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
} from 'lucide-vue-next'
import JSZip from 'jszip'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'
import { useToast } from '~/composables/useToast'
import { useSkillAuditor, type SkillAuditReport, type SecurityFinding } from '~/composables/useSkillAuditor'

const { showToast } = useToast()
const { auditContent } = useSkillAuditor()

const inputQuery = ref('')
const isLoading = ref(false)
const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

// Current skill inspection state
const skillName = ref('')
const repoOwner = ref('')
const repoName = ref('')
const rawContent = ref('')
const installCommand = ref('')
const availableSkills = ref<string[]>([])
const activeFinding = ref<SecurityFinding | null>(null)

// Audit report
const report = ref<SkillAuditReport | null>(null)

const codeLines = computed(() => {
  if (!rawContent.value) return []
  return rawContent.value.split(/\r?\n/)
})

const findingsByLine = computed(() => {
  const map: Record<number, SecurityFinding[]> = {}
  if (!report.value) return map
  for (const f of report.value.findings) {
    if (!map[f.line]) map[f.line] = []
    map[f.line].push(f)
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
      rawContent.value = data.primaryContent
      installCommand.value = data.installCommand
      report.value = auditContent(data.primaryContent, `${skillName.value}.md`)
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
      rawContent.value = data.primaryContent
      installCommand.value = data.installCommand
      report.value = auditContent(data.primaryContent, `${skill}.md`)
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

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const handleFileSelect = (e: Event) => {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    processLocalFile(input.files[0])
  }
}

const handleFileDrop = (e: DragEvent) => {
  isDragging.value = false
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    processLocalFile(e.dataTransfer.files[0])
  }
}

const processLocalFile = (file: File) => {
  const reader = new FileReader()
  const fileName = file.name
  skillName.value = fileName.replace(/\.[^/.]+$/, '')
  repoOwner.value = 'local'
  repoName.value = fileName
  availableSkills.value = []
  installCommand.value = `// Local file: ${fileName}`

  reader.onload = (event) => {
    const text = event.target?.result as string
    if (text) {
      rawContent.value = text
      report.value = auditContent(text, fileName)
    }
  }
  reader.readAsText(file)
}

const downloadZip = async () => {
  if (!rawContent.value) return
  try {
    const zip = new JSZip()
    const folderName = skillName.value || 'skill'
    const folder = zip.folder(folderName)
    folder?.file('SKILL.md', rawContent.value)

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

const downloadMarkdown = () => {
  if (!rawContent.value) return
  const blob = new Blob([rawContent.value], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = skillName.value ? `${skillName.value}.md` : 'SKILL.md'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  showToast({ title: 'File SKILL.md berhasil diunduh', type: 'success' })
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
  if (!rawContent.value) return
  try {
    await navigator.clipboard.writeText(rawContent.value)
    showToast({ title: 'Kode berhasil disalin', type: 'success' })
  } catch {
    showToast({ title: 'Gagal menyalin kode', type: 'error' })
  }
}

const scrollToFinding = (finding: SecurityFinding) => {
  activeFinding.value = finding
  nextTick(() => {
    const el = document.getElementById(`code-line-${finding.line}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

const resetScanner = () => {
  report.value = null
  rawContent.value = ''
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
        Static pattern & AST security inspector for AI Agent skills. Statically analyze prompt injections, secret leaks, reverse shells, and unsafe execution.
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

    <!-- File Dropzone (Section 10 Standard) -->
    <div
      v-if="!report"
      class="relative border-2 border-dashed rounded-[14px] p-8 sm:p-14 border-[#2E2E2E] bg-[#141416] hover:border-[#3E3E3E] text-center cursor-pointer select-none transition-all group"
      :class="isDragging ? 'border-white/50 bg-[#1a1a1c]' : ''"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleFileDrop"
      @click="triggerFileInput"
    >
      <input
        ref="fileInputRef"
        type="file"
        accept=".md,.txt,.zip,.py,.ts,.sh"
        class="hidden"
        @change="handleFileSelect"
      />
      <div class="w-12 h-12 mx-auto rounded-xl bg-[#212121] border border-[#2E2E2E] flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
        <FolderCheck class="w-6 h-6 text-white" />
      </div>
      <div class="mt-4 text-sm font-semibold text-[var(--text-primary)]">
        Drop your skill folder or SKILL.md here or browse
      </div>
      <div class="text-xs text-[var(--text-secondary)] mt-1">
        Supports SKILL.md, .zip, .py, .ts, and .sh files. 100% processed client-side.
      </div>
    </div>

    <!-- Inspection Results Workspace -->
    <div v-if="report" class="space-y-4">
      <!-- Multi-Skill Explorer Pills -->
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

      <!-- Compact Action & Status Ribbon -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-[14px] bg-[var(--bg-card)] border border-[var(--border-card)]">
        <!-- Status & Target -->
        <div class="flex items-center gap-3">
          <div class="font-mono text-sm font-bold text-white">
            {{ skillName }}
          </div>

          <Badge
            :variant="report.status === 'danger' ? 'primary' : report.status === 'warning' ? 'secondary' : 'badge'"
          >
            {{ report.status === 'danger' ? 'CRITICAL RISK' : report.status === 'warning' ? 'WARNING' : 'CLEAN' }}
            ({{ report.score }}/100)
          </Badge>

          <span class="text-xs text-[var(--text-secondary)] font-mono hidden md:inline">
            {{ codeLines.length }} lines
          </span>
        </div>

        <!-- Action Buttons -->
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
            variant="secondary"
            size="sm"
            class="h-8 px-2.5 text-xs cursor-pointer"
            @click="downloadMarkdown"
          >
            <Download class="w-3.5 h-3.5 mr-1.5" />
            SKILL.md
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

      <!-- Split Layout: Findings List vs Code Viewer -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <!-- Findings Column (5 cols) -->
        <div class="lg:col-span-5 space-y-2.5">
          <div class="flex items-center justify-between px-1">
            <span class="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Security Findings ({{ report.findings.length }})
            </span>
          </div>

          <!-- Clean status if 0 findings -->
          <div
            v-if="report.findings.length === 0"
            class="p-6 rounded-[14px] bg-[var(--bg-card)] border border-[var(--border-card)] text-center space-y-2"
          >
            <ShieldCheck class="w-7 h-7 text-white mx-auto" />
            <div class="text-sm font-semibold text-white">No Security Threats Detected</div>
            <p class="text-xs text-[var(--text-secondary)] leading-relaxed">
              No prompt overrides, dangerous shell executions, credential harvesting, or exfiltration patterns detected.
            </p>
          </div>

          <!-- Findings Cards -->
          <div
            v-for="f in report.findings"
            :key="f.id"
            class="p-3.5 rounded-[12px] bg-[var(--bg-card)] border transition-all cursor-pointer group space-y-2 text-left"
            :class="
              activeFinding?.id === f.id
                ? 'border-white/50 bg-[var(--bg-card-hover)]'
                : 'border-[var(--border-card)] hover:border-[#3E3E3E]'
            "
            @click="scrollToFinding(f)"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <ShieldAlert v-if="f.severity === 'critical'" class="w-4 h-4 text-rose-400 shrink-0" />
                <AlertTriangle v-else class="w-4 h-4 text-amber-400 shrink-0" />
                <span class="text-xs font-semibold text-white">
                  {{ f.title }}
                </span>
              </div>
              <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#212121] text-neutral-400 shrink-0">
                Line {{ f.line }}
              </span>
            </div>

            <p class="text-xs text-[var(--text-secondary)] leading-relaxed">
              {{ f.description }}
            </p>

            <div class="p-2 rounded bg-[#141416] border border-[#262626] font-mono text-[11px] text-neutral-300 truncate">
              {{ f.codeSnippet }}
            </div>
          </div>
        </div>

        <!-- Code Viewer Column (7 cols) -->
        <div class="lg:col-span-7 bg-[#141416] border border-[var(--border-card)] rounded-[14px] overflow-hidden">
          <div class="px-4 py-2.5 border-b border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
            <div class="flex items-center gap-2">
              <FileCode class="w-3.5 h-3.5" />
              <span>{{ skillName ? `${skillName}.md` : 'SKILL.md' }}</span>
            </div>
            <span>{{ codeLines.length }} lines</span>
          </div>

          <div class="max-h-[620px] overflow-y-auto overflow-x-auto p-4 font-mono text-xs select-text">
            <div
              v-for="(line, idx) in codeLines"
              :id="`code-line-${idx + 1}`"
              :key="idx"
              class="flex items-start gap-3 py-0.5 px-2 rounded transition-colors"
              :class="[
                findingsByLine[idx + 1]
                  ? findingsByLine[idx + 1][0].severity === 'critical'
                    ? 'bg-rose-950/40 text-rose-200 border border-rose-800/40'
                    : 'bg-amber-950/40 text-amber-200 border border-amber-800/40'
                  : activeFinding?.line === idx + 1
                  ? 'bg-white/10'
                  : 'hover:bg-white/5 text-neutral-300'
              ]"
            >
              <span class="w-8 shrink-0 text-right text-[11px] select-none text-neutral-600">
                {{ idx + 1 }}
              </span>

              <div class="flex-1 whitespace-pre-wrap break-all leading-relaxed">
                {{ line || ' ' }}
              </div>

              <span
                v-if="findingsByLine[idx + 1]"
                class="shrink-0 text-[9px] uppercase font-bold px-1 rounded"
                :class="findingsByLine[idx + 1][0].severity === 'critical' ? 'text-rose-400' : 'text-amber-400'"
              >
                {{ findingsByLine[idx + 1][0].severity }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
