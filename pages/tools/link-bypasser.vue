<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Link as Link2,
  OpenNewWindow as ExternalLink,
  Copy,
  PasteClipboard as Clipboard,
  Check,
  ShieldCheck,
  WarningTriangle as AlertTriangle,
  Clock,
  MultiplePages as Layers,
  Sparks as Sparkles,
  Globe,
  CheckCircle as CheckCircle2,
  Xmark as X,
  InfoCircle as Info,
  SystemRestart as Loader2,
  ArrowRight,
  Puzzle,
  Code,
} from '@iconoir/vue'
import { useToast } from '~/composables/useToast'
import type { BypassResult } from '~/server/utils/bypasser'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'
import UrlOmnibar from '~/components/ui/UrlOmnibar.vue'
import MinimalLoader from '~/components/ui/MinimalLoader.vue'

const toast = useToast()

const inputUrl = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const result = ref<BypassResult | null>(null)
const copiedClean = ref(false)
const copiedHopIndex = ref<number | null>(null)

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
        toast.info('Pasted from clipboard', text.trim().slice(0, 40) + '...')
      }
    }
  } catch {
    toast.error('Clipboard access denied', 'Please paste the URL manually.')
  }
}

const handleBypass = async (overrideUrl?: string) => {
  if (overrideUrl) inputUrl.value = overrideUrl
  const raw = inputUrl.value.trim()
  if (!raw) {
    error.value = 'Please enter a valid URL to bypass.'
    return
  }

  error.value = null
  loading.value = true
  result.value = null

  try {
    const data = await $fetch<BypassResult>('/api/tools/bypass-link', {
      method: 'POST',
      body: { url: raw },
    })

    if (!data.success) {
      error.value = data.error || 'Failed to trace URL'
      toast.error('Bypass Failed', data.error || 'Could not resolve URL')
    } else {
      result.value = data
      toast.success(
        'URL Resolved',
        data.hops.length > 1
          ? `Traced ${data.hops.length} hops to final destination.`
          : 'Clean destination URL extracted.'
      )
    }
  } catch (err: any) {
    const msg = err?.data?.statusMessage || err?.message || 'Server error occurred'
    error.value = msg
    toast.error('Error', msg)
  } finally {
    loading.value = false
  }
}

const copyToClipboard = async (text: string, type: 'clean' | 'hop', hopIdx?: number) => {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      if (type === 'clean') {
        copiedClean.value = true
        setTimeout(() => {
          copiedClean.value = false
        }, 2000)
      } else if (typeof hopIdx === 'number') {
        copiedHopIndex.value = hopIdx
        setTimeout(() => {
          copiedHopIndex.value = null
        }, 2000)
      }
      toast.success('Copied to clipboard', text.slice(0, 48) + '...')
    }
  } catch {
    toast.error('Copy failed', 'Please select and copy manually.')
  }
}

const getStatusBadgeVariant = (status: number) => {
  if (status >= 200 && status < 300) return 'success'
  if (status >= 300 && status < 400) return 'secondary'
  if (status >= 400 && status < 500) return 'warning'
  if (status >= 500) return 'error'
  return 'neutral'
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
      <span class="text-[var(--text-primary)]">Link Bypasser</span>
    </div>

    <!-- Page Title -->
    <div class="space-y-1">
      <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
        Link Bypasser & Redirect Tracer
      </h1>
      <p class="text-xs sm:text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
        Trace full HTTP redirect chains, unmask link shims & gateway wrappers, and strip tracking tokens safely.
      </p>
    </div>

    <!-- Search Omnibar with URL History Popover -->
    <UrlOmnibar
      id="bypass-url-input"
      v-model="inputUrl"
      :loading="loading"
      storage-key="avttr_link_bypasser_history"
      placeholder="https://bit.ly/xyz atau https://s.id/..."
      :submit-text="loading ? 'Tracing...' : 'Bypass Link'"
      :submit-icon="Sparkles"
      @submit="handleBypass"
      @clear="clearInput"
    >
      <template #leading>
        <Link2 class="w-4 h-4" />
      </template>
    </UrlOmnibar>

    <!-- Minimalist Unboxed Loading State -->
    <MinimalLoader
      v-if="loading"
      text="Tracing Redirect Hops..."
      subtext="Resolving shortlinks, stripping tracking queries, and querying destination servers..."
    />

    <!-- Error Box -->
    <div
      v-if="error"
      class="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-200 flex items-start gap-3 transition-all text-xs"
    >
      <AlertTriangle class="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
      <div class="space-y-0.5">
        <div class="font-semibold text-sm">Failed to trace link</div>
        <p class="leading-relaxed opacity-90">{{ error }}</p>
      </div>
    </div>

    <!-- Active Result View -->
    <div v-if="result && result.success" class="space-y-6">
      <!-- 1. Destination Overview Card -->
      <Card :hoverable="false" class="p-5 sm:p-6 space-y-5">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[var(--border-subtle)]">
          <div class="flex items-center gap-2 flex-wrap">
            <Badge :variant="result.warning ? 'warning' : 'success'" size="lg" class="gap-1.5 font-semibold">
              <CheckCircle2 v-if="!result.warning" class="w-3.5 h-3.5" />
              <AlertTriangle v-else class="w-3.5 h-3.5" />
              {{ result.warning ? 'Batas Proteksi Terdeteksi' : 'Final Destination' }}
            </Badge>
            <Badge v-if="result.detectedService" variant="badge" size="lg">
              {{ result.detectedService }}
            </Badge>
            <Badge variant="outline" size="lg" class="font-mono">
              {{ result.hops.length }} {{ result.hops.length === 1 ? 'Hop' : 'Hops' }} ({{ result.totalTimeMs }}ms)
            </Badge>
          </div>

          <div class="flex items-center gap-2">
            <Button
              id="copy-clean-url-btn"
              variant="primary"
              size="sm"
              @click="copyToClipboard(result.cleanedUrl, 'clean')"
            >
              <Check v-if="copiedClean" class="w-3.5 h-3.5 mr-1 text-emerald-300" />
              <Copy v-else class="w-3.5 h-3.5 mr-1" />
              {{ result.warning ? (copiedClean ? 'Tersalin' : 'Salin URL Gateway') : (copiedClean ? 'Copied' : 'Copy Clean URL') }}
            </Button>
            <a
              :href="result.cleanedUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center justify-center font-medium transition-all duration-150 ease-in-out cursor-pointer select-none border gap-1.5 h-8 px-3 text-xs rounded-md bg-[var(--bg-card-hover)] text-[var(--text-primary)] hover:bg-[var(--border-subtle)] border-[var(--border-card)]"
            >
              <ExternalLink class="w-3.5 h-3.5" />
              {{ result.warning ? 'Buka Link Gateway' : 'Open Link' }}
            </a>
          </div>
        </div>

        <!-- Ad Shortener / Gateway Warning Notice with Userscript Helper -->
        <div
          v-if="result.warning"
          class="rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 overflow-hidden text-xs"
        >
          <!-- Top Warning Header -->
          <div class="p-4 sm:p-5 space-y-2.5">
            <div class="flex items-center gap-2 font-semibold text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle class="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Batas Proteksi Terdeteksi: {{ result.detectedService || 'Paywall Interaktif' }}</span>
            </div>
            
            <p class="leading-relaxed opacity-95 text-xs">
              {{ result.warning }}
            </p>

            <div class="flex items-center gap-1.5 text-[11px] text-amber-800/90 dark:text-amber-300/90 font-medium">
              <Info class="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Gunakan tombol <strong>Buka Link Gateway</strong> di atas untuk menyelesaikan verifikasi langsung di browser Anda.</span>
            </div>
          </div>

          <!-- Browser Script Auto-Bypass Helper -->
          <div class="border-t border-amber-500/20 bg-amber-500/5 p-4 sm:p-5 space-y-3">
            <div class="flex items-center gap-2 font-semibold text-xs text-amber-800 dark:text-amber-300">
              <Puzzle class="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Ingin Otomatis Lewati Timer & Iklan? Pasang Script Browser:</span>
            </div>

            <p class="text-[11px] leading-relaxed text-amber-900/80 dark:text-amber-200/80">
              Proteksi Cloudflare Turnstile & countdown timer mewajibkan verifikasi dari browser asli Anda. Anda dapat menginstal script browser (userscript) agar otomatis memotong timer, melewati verifikasi robot, dan langsung melompat ke file unduhan akhir:
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <!-- Item 1: Tampermonkey Extension -->
              <a
                id="link-install-tampermonkey"
                href="https://www.tampermonkey.net/"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-start gap-2.5 p-3 rounded-lg bg-white/70 dark:bg-black/20 border border-amber-500/20 hover:border-amber-500/50 transition-colors group cursor-pointer"
              >
                <div class="w-7 h-7 rounded-md bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-700 dark:text-amber-300">
                  <Puzzle class="w-3.5 h-3.5" />
                </div>
                <div class="space-y-0.5 min-w-0">
                  <div class="flex items-center gap-1 font-semibold text-xs text-[var(--text-primary)] group-hover:text-amber-600 dark:group-hover:text-amber-400">
                    <span>1. Pasang Tampermonkey</span>
                    <ExternalLink class="w-3 h-3 shrink-0 opacity-60" />
                  </div>
                  <p class="text-[10px] text-[var(--text-tertiary)] leading-tight">
                    Ekstensi pengelola script untuk Chrome, Firefox, Edge, Brave & Kiwi.
                  </p>
                </div>
              </a>

              <!-- Item 2: BypassNET Script on GreasyFork -->
              <a
                id="link-install-bypassnet"
                href="https://greasyfork.org/scripts/527564-bypassnet"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-start gap-2.5 p-3 rounded-lg bg-white/70 dark:bg-black/20 border border-amber-500/20 hover:border-amber-500/50 transition-colors group cursor-pointer"
              >
                <div class="w-7 h-7 rounded-md bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-700 dark:text-amber-300">
                  <Code class="w-3.5 h-3.5" />
                </div>
                <div class="space-y-0.5 min-w-0">
                  <div class="flex items-center gap-1 font-semibold text-xs text-[var(--text-primary)] group-hover:text-amber-600 dark:group-hover:text-amber-400">
                    <span>2. Install Script BypassNET</span>
                    <ExternalLink class="w-3 h-3 shrink-0 opacity-60" />
                  </div>
                  <p class="text-[10px] text-[var(--text-tertiary)] leading-tight">
                    Auto-skip Linkvertise, Safelinku, Semawur, OuO & 40+ shortener lainnya.
                  </p>
                </div>
              </a>
            </div>

            <div class="pt-1 flex items-center justify-between text-[11px] text-amber-800/80 dark:text-amber-300/80">
              <span>Tips: Setelah script terpasang di browser, link akan otomatis dilewati saat Anda klik tombol <strong>Buka Link Gateway</strong>.</span>
              <span class="font-mono opacity-80 shrink-0">{{ result.hops.length }} hop terlacak</span>
            </div>
          </div>
        </div>

        <!-- Clean URL Display Box -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-[11px] text-[var(--text-tertiary)] font-mono">
            <span>{{ result.warning ? 'URL Gateway Terlacak (Langkah Terakhir yang Terjangkau Server):' : 'Destination URL:' }}</span>
          </div>
          <div class="p-3.5 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] break-all font-mono text-sm text-[var(--text-primary)] select-all leading-relaxed">
            {{ result.cleanedUrl }}
          </div>
        </div>

        <!-- Tracking Parameters Stripped Banner -->
        <div
          v-if="result.removedParams && result.removedParams.length > 0"
          class="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-900 dark:text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
        >
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-semibold flex items-center gap-1">
              <ShieldCheck class="w-4 h-4 text-emerald-500 shrink-0" />
              Stripped {{ result.removedParams.length }} tracking token(s):
            </span>
            <span
              v-for="p in result.removedParams"
              :key="p"
              class="px-1.5 py-0.5 rounded font-mono text-[11px] bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
            >
              {{ p }}
            </span>
          </div>
          <span class="text-[11px] opacity-80 shrink-0">Sanitized URL ready to share</span>
        </div>
      </Card>

      <!-- 2. Hops Visualizer Timeline -->
      <Card :hoverable="false" class="p-5 sm:p-6 space-y-4">
        <div class="flex items-center justify-between">
          <div class="space-y-0.5">
            <h2 class="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Layers class="w-4 h-4 text-[var(--text-secondary)]" />
              Redirect Chain Journey (Hops)
            </h2>
            <p class="text-xs text-[var(--text-secondary)]">
              Chronological sequence of all network redirects and link shim translations.
            </p>
          </div>
          <span class="text-xs font-mono text-[var(--text-tertiary)]">
            Total Latency: {{ result.totalTimeMs }}ms
          </span>
        </div>

        <div class="relative pl-6 sm:pl-8 space-y-6 pt-2 before:absolute before:left-3 sm:before:left-4 before:top-4 before:bottom-4 before:w-[2px] before:bg-[var(--border-subtle)]">
          <div
            v-for="(hop, idx) in result.hops"
            :key="idx"
            class="relative space-y-2 group"
          >
            <!-- Step Pin on Timeline -->
            <div
              class="absolute -left-6 sm:-left-8 top-0.5 w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-mono font-bold transition-colors shadow-xs"
              :class="
                idx === result.hops.length - 1
                  ? 'bg-emerald-500 text-white border-emerald-400 ring-4 ring-emerald-500/10'
                  : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
              "
            >
              {{ hop.step }}
            </div>

            <!-- Hop Card Body -->
            <div class="p-3.5 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] hover:border-[var(--border-card-hover)] transition-all space-y-2">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2 flex-wrap">
                  <Badge :variant="getStatusBadgeVariant(hop.status)" size="sm" class="font-mono font-semibold">
                    {{ hop.status === 200 ? '200 OK' : `${hop.status} ${hop.statusText}` }}
                  </Badge>
                  <span class="text-xs font-semibold text-[var(--text-primary)] font-mono">
                    {{ hop.domain }}
                  </span>
                  <Badge variant="outline" size="sm" class="text-[11px]">
                    {{ hop.type }}
                  </Badge>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-[11px] font-mono text-[var(--text-tertiary)] flex items-center gap-1">
                    <Clock class="w-3 h-3" />
                    {{ hop.latencyMs }}ms
                  </span>
                  <button
                    type="button"
                    class="p-1 rounded hover:bg-[var(--bg-card-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    :title="copiedHopIndex === idx ? 'Copied' : 'Copy hop URL'"
                    @click="copyToClipboard(hop.url, 'hop', idx)"
                  >
                    <Check v-if="copiedHopIndex === idx" class="w-3.5 h-3.5 text-emerald-500" />
                    <Copy v-else class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div class="font-mono text-xs text-[var(--text-secondary)] break-all select-all">
                {{ hop.url }}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>
