<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import {
  FolderCheck,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Info,
  Download,
  Copy,
  Check,
  FileCode,
  Terminal,
  Cpu,
  RefreshCw,
  Loader2,
  ExternalLink,
  ChevronRight,
  Archive,
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
const repoBranch = ref('main')
const rawContent = ref('')
const installCommand = ref('')
const availableSkills = ref<string[]>([])
const activeFinding = ref<SecurityFinding | null>(null)

// Audit report
const report = ref<SkillAuditReport | null>(null)

// Code viewer line rendering
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
      repoBranch.value = data.branch
      skillName.value = data.selectedSkill || data.repo
      availableSkills.value = data.availableSkills || []
      rawContent.value = data.primaryContent
      installCommand.value = data.installCommand

      // Run 100% client-side AST & pattern audit
      report.value = auditContent(data.primaryContent, `${skillName.value}.md`)

      showToast({
        title: `Audit selesai: Grade ${report.value.grade}`,
        description: `${report.value.findings.length} temuan dianalisis.`,
        type: report.value.status === 'danger' ? 'warning' : 'success',
      })
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
      showToast({
        title: `Audit file lokal selesai: Grade ${report.value.grade}`,
        type: report.value.status === 'danger' ? 'warning' : 'success',
      })
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
    showToast({ title: 'Command instalasi berhasil disalin', type: 'success' })
  } catch {
    showToast({ title: 'Gagal menyalin command', type: 'error' })
  }
}

const copyCode = async () => {
  if (!rawContent.value) return
  try {
    await navigator.clipboard.writeText(rawContent.value)
    showToast({ title: 'Isi SKILL.md berhasil disalin', type: 'success' })
  } catch {
    showToast({ title: 'Gagal menyalin isi file', type: 'error' })
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
    <!-- Breadcrumb Navigation -->
    <div class="flex items-center gap-2 text-xs font-mono text-[var(--text-secondary)]">
      <NuxtLink to="/" class="hover:text-white transition-colors">Dashboard</NuxtLink>
      <span>/</span>
      <span>Developer</span>
      <span>/</span>
      <span class="text-[var(--text-primary)]">SkillSpector</span>
    </div>

    <!-- Header Banner (No Client Privacy Badge per user mandate) -->
    <div class="space-y-1">
      <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
        SkillSpector
      </h1>
      <p class="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-3xl">
        Deterministic pattern & AST security inspector for AI Agent skills. Statically analyze prompt injection, secret leaks, reverse shells, and exfiltration vectors.
      </p>
    </div>

    <!-- Omnibar Input -->
    <div class="relative flex items-center w-full">
      <div class="absolute left-4 pointer-events-none text-[var(--text-secondary)]">
        <FolderCheck class="w-5 h-5 text-[var(--text-secondary)]" />
      </div>
      <input
        v-model="inputQuery"
        type="text"
        placeholder="Paste GitHub repo, skill URL, or command (e.g. npx skills add https://github.com/mattpocock/skills --skill grill-me)..."
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

    <!-- Standardized File Dropzone (DESIGN.md Section 10) -->
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

    <!-- Results Display -->
    <div v-if="report" class="space-y-6">
      <!-- Multi-Skill Explorer Ribbon (If Repo has multiple skills) -->
      <div
        v-if="availableSkills.length > 1"
        class="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[14px] p-4 space-y-2.5"
      >
        <div class="flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <div class="flex items-center gap-2">
            <span class="font-mono text-white font-semibold">{{ repoOwner }}/{{ repoName }}</span>
            <span>•</span>
            <span>Contains {{ availableSkills.length }} skills</span>
          </div>
          <span class="text-[11px] font-mono">Select skill to inspect:</span>
        </div>

        <div class="flex flex-wrap gap-2 pt-1">
          <button
            v-for="s in availableSkills"
            :key="s"
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5"
            :class="
              skillName === s
                ? 'bg-white text-black font-semibold shadow-xs'
                : 'bg-[#212121] text-[var(--text-secondary)] hover:text-white border border-[#2E2E2E] hover:border-[#3E3E3E]'
            "
            @click="selectSkillFromRepo(s)"
          >
            <FolderCheck class="w-3.5 h-3.5" />
            <span>{{ s }}</span>
          </button>
        </div>
      </div>

      <!-- Top Summary Header Card -->
      <div class="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-[14px] p-5 sm:p-6 space-y-6">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <!-- Skill Info & Score -->
          <div class="flex items-start gap-4">
            <div
              class="w-14 h-14 rounded-xl border flex flex-col items-center justify-center shrink-0 shadow-xs"
              :class="
                report.status === 'danger'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : report.status === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-[#212121] border-[#2E2E2E] text-white'
              "
            >
              <span class="text-xl font-bold font-mono">{{ report.grade }}</span>
              <span class="text-[10px] font-mono opacity-80">{{ report.score }}/100</span>
            </div>

            <div class="space-y-1">
              <div class="flex items-center gap-2.5 flex-wrap">
                <h2 class="text-lg font-bold text-[var(--text-primary)] font-mono">
                  {{ skillName }}
                </h2>
                <Badge
                  :variant="report.status === 'danger' ? 'primary' : report.status === 'warning' ? 'secondary' : 'badge'"
                >
                  {{ report.status === 'danger' ? 'CRITICAL RISK' : report.status === 'warning' ? 'POTENTIAL RISKS' : 'VERIFIED SAFE' }}
                </Badge>
              </div>
              <p class="text-xs text-[var(--text-secondary)] font-mono">
                Source: {{ repoOwner }}/{{ repoName }} ({{ codeLines.length }} lines of instruction code)
              </p>
            </div>
          </div>

          <!-- Action Ribbon -->
          <div class="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              class="h-9 px-3 text-xs font-medium cursor-pointer"
              @click="downloadZip"
            >
              <Archive class="w-3.5 h-3.5 mr-1.5" />
              Download (.zip)
            </Button>

            <Button
              variant="secondary"
              size="sm"
              class="h-9 px-3 text-xs cursor-pointer"
              @click="downloadMarkdown"
            >
              <Download class="w-3.5 h-3.5 mr-1.5" />
              SKILL.md
            </Button>

            <Button
              v-if="installCommand && !installCommand.startsWith('//')"
              variant="secondary"
              size="sm"
              class="h-9 px-3 text-xs cursor-pointer"
              @click="copyInstallCommand"
            >
              <Terminal class="w-3.5 h-3.5 mr-1.5" />
              Copy Command
            </Button>

            <Button
              variant="secondary"
              size="sm"
              class="h-9 px-3 text-xs cursor-pointer"
              @click="copyCode"
            >
              <Copy class="w-3.5 h-3.5 mr-1.5" />
              Copy Code
            </Button>

            <Button
              variant="ghost"
              size="sm"
              class="h-9 px-2 text-xs cursor-pointer"
              @click="resetScanner"
            >
              <RefreshCw class="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <!-- Metric Cards Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[var(--border-subtle)]">
          <div class="p-3 rounded-lg bg-[#212121]/60 border border-[#2E2E2E]">
            <div class="text-[11px] text-[var(--text-secondary)]">Critical Threats</div>
            <div class="text-base font-bold font-mono mt-0.5" :class="report.criticalCount > 0 ? 'text-rose-400' : 'text-white'">
              {{ report.criticalCount }}
            </div>
          </div>

          <div class="p-3 rounded-lg bg-[#212121]/60 border border-[#2E2E2E]">
            <div class="text-[11px] text-[var(--text-secondary)]">Warnings</div>
            <div class="text-base font-bold font-mono mt-0.5" :class="report.warningCount > 0 ? 'text-amber-400' : 'text-white'">
              {{ report.warningCount }}
            </div>
          </div>

          <div class="p-3 rounded-lg bg-[#212121]/60 border border-[#2E2E2E]">
            <div class="text-[11px] text-[var(--text-secondary)]">Rules Checked</div>
            <div class="text-base font-bold font-mono text-white mt-0.5">
              {{ report.totalChecks }} Rules
            </div>
          </div>

          <div class="p-3 rounded-lg bg-[#212121]/60 border border-[#2E2E2E]">
            <div class="text-[11px] text-[var(--text-secondary)]">Analysis Engine</div>
            <div class="text-base font-bold font-mono text-white mt-0.5">
              AST & Taint
            </div>
          </div>
        </div>

        <!-- Capability & Permission Indicators -->
        <div class="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span class="text-[var(--text-secondary)] text-[11px] font-mono mr-1">Observed Capabilities:</span>
          <span
            class="px-2.5 py-0.5 rounded-full border text-[11px] font-mono"
            :class="report.permissions.shellExecution ? 'bg-[#2E2E2E] text-white border-white/20' : 'bg-[#18181A] text-neutral-500 border-neutral-800'"
          >
            Shell Execution: {{ report.permissions.shellExecution ? 'Detected' : 'None' }}
          </span>
          <span
            class="px-2.5 py-0.5 rounded-full border text-[11px] font-mono"
            :class="report.permissions.filesystemWrite ? 'bg-[#2E2E2E] text-white border-white/20' : 'bg-[#18181A] text-neutral-500 border-neutral-800'"
          >
            FS Modification: {{ report.permissions.filesystemWrite ? 'Detected' : 'None' }}
          </span>
          <span
            class="px-2.5 py-0.5 rounded-full border text-[11px] font-mono"
            :class="report.permissions.networkOutbound ? 'bg-[#2E2E2E] text-white border-white/20' : 'bg-[#18181A] text-neutral-500 border-neutral-800'"
          >
            Network / Webhooks: {{ report.permissions.networkOutbound ? 'Detected' : 'None' }}
          </span>
          <span
            class="px-2.5 py-0.5 rounded-full border text-[11px] font-mono"
            :class="report.permissions.environmentAccess ? 'bg-[#2E2E2E] text-white border-white/20' : 'bg-[#18181A] text-neutral-500 border-neutral-800'"
          >
            Env / Secrets: {{ report.permissions.environmentAccess ? 'Observed' : 'None' }}
          </span>
        </div>
      </div>

      <!-- Split View: Left Findings List & Right Code Viewer -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- Left: Findings Column (5 cols) -->
        <div class="lg:col-span-5 space-y-3">
          <div class="flex items-center justify-between px-1">
            <h3 class="text-sm font-semibold text-[var(--text-primary)]">
              Security Findings ({{ report.findings.length }})
            </h3>
            <span class="text-xs text-[var(--text-secondary)] font-mono">
              Click to locate line
            </span>
          </div>

          <!-- Clean status if 0 findings -->
          <div
            v-if="report.findings.length === 0"
            class="p-6 rounded-[14px] bg-[var(--bg-card)] border border-[var(--border-card)] text-center space-y-2"
          >
            <ShieldCheck class="w-8 h-8 text-white mx-auto" />
            <div class="text-sm font-semibold text-white">Zero Vulnerabilities Found</div>
            <p class="text-xs text-[var(--text-secondary)] leading-relaxed">
              No prompt injections, secret access patterns, reverse shells, or malicious piping detected across {{ codeLines.length }} lines.
            </p>
          </div>

          <!-- Findings Cards -->
          <div
            v-for="f in report.findings"
            :key="f.id"
            class="p-4 rounded-[14px] bg-[var(--bg-card)] border transition-all cursor-pointer group space-y-2 text-left"
            :class="
              activeFinding?.id === f.id
                ? 'border-white/40 ring-1 ring-white/20 bg-[var(--bg-card-hover)]'
                : 'border-[var(--border-card)] hover:border-[#3E3E3E]'
            "
            @click="scrollToFinding(f)"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2">
                <ShieldAlert v-if="f.severity === 'critical'" class="w-4 h-4 text-rose-400 shrink-0" />
                <AlertTriangle v-else-if="f.severity === 'warning'" class="w-4 h-4 text-amber-400 shrink-0" />
                <Info v-else class="w-4 h-4 text-neutral-400 shrink-0" />
                <span class="text-xs font-semibold text-white group-hover:text-white">
                  {{ f.title }}
                </span>
              </div>
              <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-[#212121] text-neutral-300 shrink-0">
                Line {{ f.line }}
              </span>
            </div>

            <p class="text-xs text-[var(--text-secondary)] leading-relaxed">
              {{ f.description }}
            </p>

            <div class="p-2 rounded bg-[#171717] border border-[#262626] font-mono text-[11px] text-neutral-300 truncate">
              {{ f.codeSnippet }}
            </div>

            <div class="text-[11px] text-neutral-400 leading-normal pt-1">
              💡 <strong>Recommendation:</strong> {{ f.recommendation }}
            </div>
          </div>
        </div>

        <!-- Right: Code Viewer Column (7 cols) -->
        <div class="lg:col-span-7 bg-[#141416] border border-[var(--border-card)] rounded-[14px] overflow-hidden">
          <div class="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
            <div class="flex items-center gap-2">
              <FileCode class="w-3.5 h-3.5" />
              <span>{{ skillName ? `${skillName}.md` : 'SKILL.md' }}</span>
            </div>
            <span>{{ codeLines.length }} lines</span>
          </div>

          <!-- Code Lines Container -->
          <div class="max-h-[640px] overflow-y-auto overflow-x-auto p-4 font-mono text-xs select-text">
            <div
              v-for="(line, idx) in codeLines"
              :id="`code-line-${idx + 1}`"
              :key="idx"
              class="flex items-start gap-4 py-0.5 px-2 rounded transition-colors group"
              :class="[
                findingsByLine[idx + 1]
                  ? findingsByLine[idx + 1][0].severity === 'critical'
                    ? 'bg-rose-900/30 border border-rose-600/40 text-rose-200'
                    : 'bg-amber-900/30 border border-amber-600/40 text-amber-200'
                  : activeFinding?.line === idx + 1
                  ? 'bg-white/10'
                  : 'hover:bg-white/5 text-neutral-300'
              ]"
            >
              <!-- Line Number -->
              <span class="w-8 shrink-0 text-right text-[11px] select-none text-neutral-600 group-hover:text-neutral-400">
                {{ idx + 1 }}
              </span>

              <!-- Code Content -->
              <div class="flex-1 whitespace-pre-wrap break-all leading-relaxed">
                {{ line || ' ' }}
              </div>

              <!-- Inline Finding Flag -->
              <span
                v-if="findingsByLine[idx + 1]"
                class="shrink-0 px-1.5 py-0.2 text-[9px] uppercase font-bold rounded"
                :class="
                  findingsByLine[idx + 1][0].severity === 'critical'
                    ? 'bg-rose-500 text-white'
                    : 'bg-amber-500 text-black'
                "
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
