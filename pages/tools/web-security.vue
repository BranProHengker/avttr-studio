<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  Globe,
  Lock,
  ExternalLink,
  Copy,
  Clipboard,
  Check,
  X,
  AlertTriangle,
  Info,
  Clock,
  Server,
  Layers,
  ChevronDown,
  ChevronUp,
  FileCode,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-vue-next'
import { useToast } from '~/composables/useToast'
import { useI18n } from '~/composables/useI18n'
import type { SecurityAuditResult, HeaderAnalysisItem } from '~/server/utils/securityAudit'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

const toast = useToast()
const { t, locale } = useI18n()

const inputUrl = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const result = ref<SecurityAuditResult | null>(null)
const activeFilter = ref<'all' | 'issues' | 'passed'>('all')
const expandedCards = ref<Record<string, boolean>>({})
const snippetTabs = ref<Record<string, 'nginx' | 'cloudflare' | 'nuxt' | 'vercel'>>({})
const showRawHeaders = ref(false)
const copiedSnippetKey = ref<string | null>(null)

// Bilingual text dictionary
const ui = computed(() => {
  const isId = locale.value === 'id'
  return {
    subtitle: isId
      ? 'Pemeriksa rapor keamanan header HTTP, enkripsi HTTPS, dan pencegah serangan siber pada website Anda.'
      : 'Audit HTTP security headers, evaluate HTTPS/TLS posture, and prevent cyber attacks on your website.',
    placeholder: isId
      ? 'Masukkan domain atau URL (contoh: heybran.my.id atau https://github.com)'
      : 'Enter domain or URL (e.g. heybran.my.id or https://github.com)',
    btnScan: isId ? 'Periksa Web' : 'Audit Site',
    emptyTitle: isId ? 'Apa Saja yang Diperiksa?' : 'What Is Being Checked?',
    card1Title: isId ? 'HSTS & Enkripsi HTTPS' : 'HSTS & Transport Security',
    card1Desc: isId
      ? 'Memastikan browser selalu terhubung lewat koneksi aman dan kebal dari pembajakan SSL di jaringan Wi-Fi umum.'
      : 'Forces browsers to always connect via encrypted HTTPS, defending against SSL stripping on public Wi-Fi.',
    card2Title: isId ? 'Anti-Clickjacking (X-Frame)' : 'Anti-Clickjacking (X-Frame)',
    card2Desc: isId
      ? 'Mencegah website Anda disusupkan ke dalam iframe transparan milik hacker untuk memanipulasi klik pengguna.'
      : 'Prevents unauthorized framing of your site in invisible attacker iframes.',
    card3Title: isId ? 'Content Security Policy (CSP)' : 'Content Security Policy (CSP)',
    card3Desc: isId
      ? 'Menyaring script berbahaya dari luar agar tidak bisa menyusup dan mencuri cookie pengguna di browser.'
      : 'Whitelists approved script and asset sources to block Cross-Site Scripting (XSS).',
    card4Title: isId ? 'Kebocoran Info Server' : 'Server Info Disclosure',
    card4Desc: isId
      ? 'Mendeteksi apakah server Anda membocorkan versi Apache, Nginx, atau PHP yang bisa dijadikan sasaran eksploitasi.'
      : 'Detects leaked Apache, Nginx, or PHP versions that expose software vulnerabilities.',
    filterAll: isId ? 'Semua Header' : 'All Headers',
    filterIssues: isId ? 'Perlu Dibenahi' : 'Issues',
    filterPassed: isId ? 'Sudah Aman' : 'Passed',
    statsPassed: isId ? 'Lolos' : 'Passed',
    statsWarnings: isId ? 'Peringatan' : 'Warnings',
    statsFailed: isId ? 'Perlu Dibenahi' : 'Issues',
    httpsActive: isId ? 'HTTPS Aktif' : 'HTTPS Active',
    httpsInsecure: isId ? 'HTTP Polos (Tidak Aman)' : 'Plain HTTP (Insecure)',
    infoLeakAlert: isId ? 'Peringatan: Informasi Internal Server Bocor' : 'Warning: Internal Server Information Leaked',
    infoLeakDesc: isId
      ? 'Website Anda menampilkan versi software yang digunakan. Hacker bisa memanfaatkan informasi ini untuk mencari celah keamanan spesifik.'
      : 'Your website exposes underlying software versions. Attackers can leverage this to look up targeted vulnerabilities.',
    remedyPrefix: isId ? 'Solusi: ' : 'Fix: ',
    sectionResults: isId ? 'Rincian Hasil Pemeriksaan' : 'Detailed Audit Results',
    statusInstalled: isId ? 'Terpasang' : 'Installed',
    statusOptimize: isId ? 'Perlu Dioptimalkan' : 'Needs Optimization',
    statusMissing: isId ? 'Belum Ada' : 'Missing',
    detectedValue: isId ? 'Nilai yang Terdeteksi' : 'Detected Value',
    whatItDoes: isId ? 'Apa Fungsinya?' : 'What Does It Do?',
    riskIfMissing: isId ? 'Risiko Bila Dibiarkan' : 'Risk If Missing',
    howToFix: isId ? 'Cara Memperbaiki (Tinggal Salin Kode)' : 'How to Fix (1-Click Copy Code)',
    copyBtn: isId ? 'Salin' : 'Copy',
    copiedBtn: isId ? 'Tersalin' : 'Copied',
    rawHeadersTitle: isId ? 'Semua Response Header Mentah' : 'Raw HTTP Response Headers',
    toggleShow: isId ? 'Tampilkan' : 'Show',
    toggleHide: isId ? 'Sembunyikan' : 'Hide',
    toastPasted: isId ? 'Ditempel dari clipboard' : 'Pasted from clipboard',
    toastClipboardDenied: isId ? 'Akses clipboard ditolak' : 'Clipboard access denied',
    toastClipboardDeniedDesc: isId ? 'Silakan tempel URL secara manual.' : 'Please paste the URL manually.',
    toastInputRequired: isId ? 'Masukkan domain atau URL yang ingin diperiksa.' : 'Please enter a valid domain or URL.',
    toastScanSuccess: isId ? 'Pemeriksaan Selesai' : 'Audit Complete',
    toastCopied: isId ? 'Disalin ke Clipboard' : 'Copied to Clipboard',
    toastCopiedDesc: isId ? 'Konfigurasi siap ditempel di server Anda.' : 'Configuration is ready to paste into your server.',
  }
})

const clearInput = () => {
  inputUrl.value = ''
  result.value = null
  error.value = null
}

const pasteFromClipboard = async () => {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      const text = await navigator.clipboard.readText()
      if (text) {
        inputUrl.value = text.trim()
        toast.info(ui.value.toastPasted, text.trim().slice(0, 40) + '...')
      }
    }
  } catch {
    toast.error(ui.value.toastClipboardDenied, ui.value.toastClipboardDeniedDesc)
  }
}

const handleScan = async () => {
  const raw = inputUrl.value.trim()
  if (!raw) {
    error.value = ui.value.toastInputRequired
    return
  }

  error.value = null
  loading.value = true
  result.value = null

  try {
    const data = await $fetch<SecurityAuditResult>('/api/tools/security-check', {
      method: 'POST',
      body: { url: raw, lang: locale.value },
    })

    result.value = data
    data.headersAnalyzed.forEach((item) => {
      expandedCards.value[item.key] = item.status !== 'pass'
      snippetTabs.value[item.key] = 'nginx'
    })

    toast.success(ui.value.toastScanSuccess, `Grade: ${data.grade} (${data.score}/100)`)
  } catch (err: any) {
    const msg = err?.data?.statusMessage || err?.message || 'Failed to inspect target website'
    error.value = msg
    toast.error('Audit Failed', msg)
  } finally {
    loading.value = false
  }
}

// Re-fetch in new language if user switches locale while looking at a result
watch(locale, () => {
  if (result.value && inputUrl.value && !loading.value) {
    handleScan()
  }
})

const filteredHeaders = computed(() => {
  if (!result.value) return []
  if (activeFilter.value === 'issues') {
    return result.value.headersAnalyzed.filter((item) => item.status !== 'pass')
  }
  if (activeFilter.value === 'passed') {
    return result.value.headersAnalyzed.filter((item) => item.status === 'pass')
  }
  return result.value.headersAnalyzed
})

const toggleCard = (key: string) => {
  expandedCards.value[key] = !expandedCards.value[key]
}

const setSnippetTab = (key: string, tab: 'nginx' | 'cloudflare' | 'nuxt' | 'vercel') => {
  snippetTabs.value[key] = tab
}

const copySnippet = async (text: string, snippetId: string) => {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      copiedSnippetKey.value = snippetId
      setTimeout(() => {
        copiedSnippetKey.value = null
      }, 2000)
      toast.success(ui.value.toastCopied, ui.value.toastCopiedDesc)
    }
  } catch {
    toast.error('Failed to copy', 'Please select and copy manually.')
  }
}

const getGradeColorClasses = (grade: string) => {
  const isId = locale.value === 'id'
  switch (grade) {
    case 'A+':
    case 'A':
      return {
        bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        ring: 'border-emerald-500/40',
        label: isId ? 'Sangat Baik' : 'Excellent',
      }
    case 'B':
      return {
        bg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
        ring: 'border-sky-500/40',
        label: isId ? 'Cukup Aman' : 'Good',
      }
    case 'C':
      return {
        bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        ring: 'border-amber-500/40',
        label: isId ? 'Perlu Perhatian' : 'Needs Attention',
      }
    case 'D':
      return {
        bg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
        ring: 'border-orange-500/40',
        label: isId ? 'Banyak Celah' : 'Vulnerable',
      }
    default:
      return {
        bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        ring: 'border-rose-500/40',
        label: isId ? 'Tidak Terlindungi' : 'Unprotected',
      }
  }
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
      <span class="text-[var(--text-primary)]">Web Security</span>
    </div>

    <!-- Page Title -->
    <div class="space-y-1">
      <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
        Web Security & Header Inspector
      </h1>
      <p class="text-xs sm:text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
        {{ ui.subtitle }}
      </p>
    </div>

    <!-- Standalone URL Omnibar (DESIGN.md Section 11) -->
    <div class="flex flex-col sm:flex-row items-center gap-2.5 w-full">
      <div class="relative flex items-center w-full">
        <!-- Leading Icon -->
        <div class="absolute left-3.5 flex items-center justify-center pointer-events-none text-[var(--text-tertiary)]">
          <ShieldCheck class="w-5 h-5" />
        </div>

        <!-- Input Field -->
        <input
          v-model="inputUrl"
          id="security-url-input"
          type="text"
          :placeholder="ui.placeholder"
          class="w-full h-12 pl-10 pr-20 bg-white dark:bg-[#171717] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] border border-zinc-200 dark:border-[#2E2E2E] focus:border-zinc-400 dark:focus:border-white/40 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 disabled:opacity-50 shadow-xs font-mono"
          :disabled="loading"
          @keydown.enter="handleScan"
        />

        <!-- Micro-Actions (Clear & Paste) -->
        <div class="absolute right-2.5 flex items-center gap-1">
          <button
            v-if="inputUrl"
            id="btn-clear-security-input"
            type="button"
            title="Clear"
            class="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            @click="clearInput"
          >
            <X class="w-4 h-4" />
          </button>
          <button
            id="btn-paste-security-input"
            type="button"
            title="Paste from Clipboard"
            class="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            @click="pasteFromClipboard"
          >
            <Clipboard class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Submit Action CTA -->
      <Button
        id="btn-run-security-check"
        variant="primary"
        size="default"
        class="w-full sm:w-auto shrink-0 h-12 px-6 rounded-xl font-medium text-xs sm:text-sm cursor-pointer"
        :loading="loading"
        @click="handleScan"
      >
        <ShieldCheck class="w-4 h-4 mr-1.5" />
        {{ ui.btnScan }}
      </Button>
    </div>

    <!-- Error Alert -->
    <div
      v-if="error"
      class="p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-3"
    >
      <AlertTriangle class="w-4 h-4 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <!-- Empty State: 4 Capability Bento Cards (DESIGN.md Section 12) -->
    <div v-if="!result && !loading" class="space-y-4 pt-2">
      <div class="text-xs font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
        {{ ui.emptyTitle }}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card :hoverable="false" class="p-4 space-y-2.5">
          <div class="w-8 h-8 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-center text-emerald-500">
            <Lock class="w-4 h-4" />
          </div>
          <div class="text-xs font-semibold text-[var(--text-primary)]">
            {{ ui.card1Title }}
          </div>
          <p class="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            {{ ui.card1Desc }}
          </p>
          <div class="pt-1">
            <Badge variant="badge" size="sm">Transport Security</Badge>
          </div>
        </Card>

        <Card :hoverable="false" class="p-4 space-y-2.5">
          <div class="w-8 h-8 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-center text-sky-500">
            <Layers class="w-4 h-4" />
          </div>
          <div class="text-xs font-semibold text-[var(--text-primary)]">
            {{ ui.card2Title }}
          </div>
          <p class="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            {{ ui.card2Desc }}
          </p>
          <div class="pt-1">
            <Badge variant="badge" size="sm">Frame Guard</Badge>
          </div>
        </Card>

        <Card :hoverable="false" class="p-4 space-y-2.5">
          <div class="w-8 h-8 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-center text-amber-500">
            <ShieldAlert class="w-4 h-4" />
          </div>
          <div class="text-xs font-semibold text-[var(--text-primary)]">
            {{ ui.card3Title }}
          </div>
          <p class="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            {{ ui.card3Desc }}
          </p>
          <div class="pt-1">
            <Badge variant="badge" size="sm">Anti-XSS Filter</Badge>
          </div>
        </Card>

        <Card :hoverable="false" class="p-4 space-y-2.5">
          <div class="w-8 h-8 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-center text-purple-500">
            <Server class="w-4 h-4" />
          </div>
          <div class="text-xs font-semibold text-[var(--text-primary)]">
            {{ ui.card4Title }}
          </div>
          <p class="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            {{ ui.card4Desc }}
          </p>
          <div class="pt-1">
            <Badge variant="badge" size="sm">Fingerprint Audit</Badge>
          </div>
        </Card>
      </div>
    </div>

    <!-- Results Section -->
    <div v-if="result" class="space-y-6">
      <!-- Hero Score Card Bento -->
      <Card :hoverable="false" class="p-6 space-y-6 border border-[var(--border-card)]">
        <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-[var(--border-subtle)]">
          <!-- Grade Display -->
          <div class="flex items-center gap-5">
            <div
              class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex flex-col items-center justify-center border font-mono font-bold shadow-sm"
              :class="getGradeColorClasses(result.grade).bg"
            >
              <span class="text-3xl sm:text-4xl tracking-tighter">{{ result.grade }}</span>
              <span class="text-[10px] uppercase font-sans font-medium tracking-wider mt-0.5 opacity-90">
                {{ getGradeColorClasses(result.grade).label }}
              </span>
            </div>

            <div class="space-y-1.5">
              <div class="flex items-center gap-2">
                <h2 class="text-base sm:text-lg font-bold text-[var(--text-primary)] break-all font-mono">
                  {{ result.targetUrl }}
                </h2>
                <a
                  :href="result.finalUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <ExternalLink class="w-4 h-4" />
                </a>
              </div>

              <div class="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)] font-mono">
                <span v-if="result.ip" class="flex items-center gap-1">
                  <Globe class="w-3.5 h-3.5 text-zinc-400" />
                  {{ result.ip }}
                </span>
                <span>•</span>
                <span class="flex items-center gap-1">
                  <Clock class="w-3.5 h-3.5 text-zinc-400" />
                  {{ result.responseTimeMs }} ms
                </span>
                <span>•</span>
                <span :class="result.isHttps ? 'text-emerald-500 font-medium' : 'text-rose-500 font-medium'">
                  {{ result.isHttps ? ui.httpsActive : ui.httpsInsecure }}
                </span>
              </div>
            </div>
          </div>

          <!-- Quick Stats Pill Counters -->
          <div class="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div class="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <div class="text-lg font-bold text-emerald-500 font-mono">{{ result.summary.passed }}</div>
              <div class="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-medium">{{ ui.statsPassed }}</div>
            </div>
            <div class="px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
              <div class="text-lg font-bold text-amber-500 font-mono">{{ result.summary.warnings }}</div>
              <div class="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-medium">{{ ui.statsWarnings }}</div>
            </div>
            <div class="px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
              <div class="text-lg font-bold text-rose-500 font-mono">{{ result.summary.failed }}</div>
              <div class="text-[10px] text-rose-600 dark:text-rose-400 uppercase font-medium">{{ ui.statsFailed }}</div>
            </div>
          </div>
        </div>

        <!-- Filter Tab Buttons -->
        <div class="flex items-center gap-2">
          <Button
            size="sm"
            :variant="activeFilter === 'all' ? 'primary' : 'ghost'"
            class="text-xs h-8 cursor-pointer"
            @click="activeFilter = 'all'"
          >
            {{ ui.filterAll }} ({{ result.headersAnalyzed.length }})
          </Button>
          <Button
            size="sm"
            :variant="activeFilter === 'issues' ? 'primary' : 'ghost'"
            class="text-xs h-8 cursor-pointer"
            @click="activeFilter = 'issues'"
          >
            {{ ui.filterIssues }} ({{ result.summary.failed + result.summary.warnings }})
          </Button>
          <Button
            size="sm"
            :variant="activeFilter === 'passed' ? 'primary' : 'ghost'"
            class="text-xs h-8 cursor-pointer"
            @click="activeFilter = 'passed'"
          >
            {{ ui.filterPassed }} ({{ result.summary.passed }})
          </Button>
        </div>
      </Card>

      <!-- Leaked Info & Fingerprinting Section (if detected) -->
      <Card
        v-if="result.infoLeaks.length > 0"
        :hoverable="false"
        class="p-5 border border-amber-500/20 bg-amber-500/5 space-y-3"
      >
        <div class="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider font-mono">
          <AlertTriangle class="w-4 h-4" />
          {{ ui.infoLeakAlert }}
        </div>
        <p class="text-xs text-[var(--text-secondary)] leading-relaxed">
          {{ ui.infoLeakDesc }}
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div
            v-for="leak in result.infoLeaks"
            :key="leak.header"
            class="p-3 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] space-y-1.5"
          >
            <div class="flex items-center justify-between text-xs font-mono">
              <span class="font-bold text-[var(--text-primary)]">{{ leak.header }}</span>
              <span class="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-500 font-semibold">
                {{ leak.value }}
              </span>
            </div>
            <p class="text-[11px] text-[var(--text-secondary)]">{{ leak.description }}</p>
            <div class="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
              {{ ui.remedyPrefix }}{{ leak.remedy }}
            </div>
          </div>
        </div>
      </Card>

      <!-- Detailed Headers Evaluation List -->
      <div class="space-y-3">
        <div class="text-xs font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
          {{ ui.sectionResults }}
        </div>

        <div
          v-for="item in filteredHeaders"
          :key="item.key"
          class="rounded-[14px] border border-[var(--border-card)] bg-[var(--bg-card)] transition-colors overflow-hidden"
        >
          <!-- Header Card Header Row -->
          <div
            class="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer select-none"
            @click="toggleCard(item.key)"
          >
            <div class="flex items-center gap-3">
              <!-- Status Icon Circle -->
              <div
                class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                :class="
                  item.status === 'pass'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : item.status === 'warn'
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-rose-500/10 text-rose-500'
                "
              >
                <Check v-if="item.status === 'pass'" class="w-4 h-4" />
                <AlertTriangle v-else-if="item.status === 'warn'" class="w-4 h-4" />
                <X v-else class="w-4 h-4" />
              </div>

              <!-- Header Title & Key -->
              <div>
                <div class="text-xs sm:text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <span>{{ item.name }}</span>
                  <Badge
                    :variant="item.status === 'pass' ? 'badge' : item.status === 'warn' ? 'secondary' : 'outline'"
                    size="sm"
                    class="text-[10px]"
                  >
                    {{ item.status === 'pass' ? ui.statusInstalled : item.status === 'warn' ? ui.statusOptimize : ui.statusMissing }}
                  </Badge>
                </div>
                <div class="text-[11px] text-[var(--text-secondary)] font-mono mt-0.5">
                  {{ item.key }}
                </div>
              </div>
            </div>

            <!-- Accordion Toggle Chevron -->
            <button
              type="button"
              class="p-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
              :title="expandedCards[item.key] ? ui.toggleHide : ui.toggleShow"
            >
              <ChevronUp v-if="expandedCards[item.key]" class="w-4 h-4" />
              <ChevronDown v-else class="w-4 h-4" />
            </button>
          </div>

          <!-- Expanded Body Content -->
          <div
            v-if="expandedCards[item.key]"
            class="px-4 pb-5 sm:px-5 border-t border-[var(--border-subtle)] pt-4 space-y-4 bg-zinc-950/20"
          >
            <!-- Current Value (if present) -->
            <div v-if="item.value" class="space-y-1">
              <div class="text-[11px] font-mono uppercase text-[var(--text-tertiary)]">{{ ui.detectedValue }}</div>
              <div class="p-2.5 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] font-mono text-xs text-zinc-300 break-all select-all">
                {{ item.value }}
              </div>
            </div>

            <!-- Human Explanation & Real-world Risk -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs leading-relaxed">
              <div class="p-3.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] space-y-1">
                <div class="font-semibold text-[var(--text-primary)] flex items-center gap-1.5 text-xs">
                  <Info class="w-3.5 h-3.5 text-sky-400" />
                  {{ ui.whatItDoes }}
                </div>
                <p class="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  {{ item.explanation }}
                </p>
              </div>

              <div class="p-3.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] space-y-1">
                <div class="font-semibold text-rose-500 flex items-center gap-1.5 text-xs">
                  <ShieldAlert class="w-3.5 h-3.5" />
                  {{ ui.riskIfMissing }}
                </div>
                <p class="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  {{ item.risk }}
                </p>
              </div>
            </div>

            <!-- How to Fix Section (Deterministic Snippets - Zero AI Tokens Needed) -->
            <div class="space-y-2 pt-1">
              <div class="flex items-center justify-between">
                <div class="text-[11px] font-mono uppercase text-[var(--text-tertiary)] flex items-center gap-1.5">
                  <FileCode class="w-3.5 h-3.5" />
                  {{ ui.howToFix }}
                </div>

                <!-- Environment Switcher Tabs -->
                <div class="flex items-center gap-1 bg-[var(--bg-app)] p-0.5 rounded-lg border border-[var(--border-subtle)] text-[10px] font-mono">
                  <button
                    type="button"
                    class="px-2 py-0.5 rounded cursor-pointer transition-colors"
                    :class="snippetTabs[item.key] === 'nginx' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'"
                    @click="setSnippetTab(item.key, 'nginx')"
                  >
                    Nginx
                  </button>
                  <button
                    type="button"
                    class="px-2 py-0.5 rounded cursor-pointer transition-colors"
                    :class="snippetTabs[item.key] === 'cloudflare' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'"
                    @click="setSnippetTab(item.key, 'cloudflare')"
                  >
                    Cloudflare
                  </button>
                  <button
                    type="button"
                    class="px-2 py-0.5 rounded cursor-pointer transition-colors"
                    :class="snippetTabs[item.key] === 'nuxt' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'"
                    @click="setSnippetTab(item.key, 'nuxt')"
                  >
                    Nuxt
                  </button>
                  <button
                    type="button"
                    class="px-2 py-0.5 rounded cursor-pointer transition-colors"
                    :class="snippetTabs[item.key] === 'vercel' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-white'"
                    @click="setSnippetTab(item.key, 'vercel')"
                  >
                    Vercel
                  </button>
                </div>
              </div>

              <!-- Code Snippet Box with 1-Click Copy -->
              <div class="relative group">
                <pre class="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed">{{ item.snippets[snippetTabs[item.key] || 'nginx'] }}</pre>
                <button
                  type="button"
                  class="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[11px] font-mono flex items-center gap-1 transition-colors border border-zinc-700"
                  @click="copySnippet(item.snippets[snippetTabs[item.key] || 'nginx'], `${item.key}-${snippetTabs[item.key]}`)"
                >
                  <Check v-if="copiedSnippetKey === `${item.key}-${snippetTabs[item.key]}`" class="w-3.5 h-3.5 text-emerald-400" />
                  <Copy v-else class="w-3.5 h-3.5" />
                  <span>{{ copiedSnippetKey === `${item.key}-${snippetTabs[item.key]}` ? ui.copiedBtn : ui.copyBtn }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Raw Headers Accordion Card -->
      <Card :hoverable="false" class="p-4 space-y-3 border border-[var(--border-card)]">
        <div
          class="flex items-center justify-between cursor-pointer select-none"
          @click="showRawHeaders = !showRawHeaders"
        >
          <div class="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)] font-mono">
            <Server class="w-4 h-4 text-zinc-400" />
            {{ ui.rawHeadersTitle }} ({{ Object.keys(result.rawHeaders).length }})
          </div>
          <button type="button" class="text-xs text-[var(--text-secondary)] hover:text-white font-mono flex items-center gap-1">
            <span>{{ showRawHeaders ? ui.toggleHide : ui.toggleShow }}</span>
            <ChevronUp v-if="showRawHeaders" class="w-3.5 h-3.5" />
            <ChevronDown v-else class="w-3.5 h-3.5" />
          </button>
        </div>

        <div v-if="showRawHeaders" class="pt-2">
          <div class="p-3.5 rounded-xl bg-zinc-950 font-mono text-xs text-zinc-400 space-y-1.5 overflow-x-auto border border-zinc-900 max-h-80 overflow-y-auto">
            <div
              v-for="(val, headerName) in result.rawHeaders"
              :key="headerName"
              class="flex gap-2 text-[11px]"
            >
              <span class="text-sky-400 shrink-0 select-all">{{ headerName }}:</span>
              <span class="text-zinc-300 break-all select-all">{{ val }}</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>
