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
} from '@iconoir/vue'
import { useToast } from '~/composables/useToast'
import type { BypassResult } from '~/server/utils/bypasser'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

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

const handleBypass = async () => {
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

    <!-- Search Omnibar (DESIGN.md Section 11 Architecture) -->
    <div class="flex flex-col sm:flex-row items-center gap-2.5 w-full">
      <div class="relative flex-1 w-full flex items-center">
        <!-- Leading Icon -->
        <div class="absolute left-3.5 flex items-center justify-center pointer-events-none text-[var(--text-tertiary)]">
          <Link2 class="w-4 h-4" />
        </div>

        <input
          id="bypass-url-input"
          v-model="inputUrl"
          type="url"
          placeholder="https://bit.ly/xyz atau https://s.id/..."
          class="w-full h-12 pl-10 pr-20 bg-white dark:bg-[#171717] hover:bg-zinc-50 dark:hover:bg-[#1a1a1c] border border-zinc-200 dark:border-[#2E2E2E] focus:border-zinc-400 dark:focus:border-white/40 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 disabled:opacity-50 shadow-xs font-mono"
          :disabled="loading"
          @keydown.enter="handleBypass"
        />

        <!-- Trailing Micro-Actions -->
        <div class="absolute right-2.5 flex items-center gap-1">
          <button
            v-if="inputUrl"
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
            @click="pasteFromClipboard"
          >
            <Clipboard class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Standalone CTA Action Button -->
      <Button
        id="bypass-submit-btn"
        variant="primary"
        size="default"
        type="button"
        class="w-full sm:w-auto shrink-0 h-12 px-5 rounded-xl font-medium text-xs sm:text-sm cursor-pointer"
        :disabled="loading || !inputUrl.trim()"
        @click="handleBypass"
      >
        <Loader2 v-if="loading" class="w-4 h-4 animate-spin mr-1.5" />
        <Sparkles v-else class="w-4 h-4 mr-1.5" />
        <span>{{ loading ? 'Tracing...' : 'Bypass Link' }}</span>
      </Button>
    </div>

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

        <!-- Ad Shortener / Gateway Warning Notice -->
        <div
          v-if="result.warning"
          class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2.5 text-xs"
        >
          <div class="flex items-center gap-2 font-semibold text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle class="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Batas Proteksi Terdeteksi: {{ result.detectedService || 'Paywall Interaktif' }}</span>
          </div>
          
          <p class="leading-relaxed opacity-95 text-xs">
            {{ result.warning }}
          </p>

          <div class="pt-2 border-t border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-amber-800/90 dark:text-amber-300/90">
            <div class="flex items-center gap-1.5">
              <Info class="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span><strong>Tips:</strong> Klik tombol <strong>Buka Link Gateway</strong> untuk melanjutkan verifikasi langsung di browser Anda.</span>
            </div>
            <span class="font-mono opacity-80 shrink-0">{{ result.hops.length }} hop terlacak</span>
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
