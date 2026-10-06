<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Link2,
  ExternalLink,
  Copy,
  Clipboard,
  Check,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
  Globe,
  Share2,
  CheckCircle2,
  X,
  Lock,
  Info,
} from 'lucide-vue-next'
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
    <!-- Breadcrumb & Header -->
    <div class="flex items-center gap-2">
      <NuxtLink
        to="/"
        class="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1"
      >
        <span>← Dashboard</span>
      </NuxtLink>
      <span class="text-xs text-[var(--text-tertiary)]">/</span>
      <span class="text-xs text-[var(--text-secondary)]">DEVELOPER & AI</span>
      <span class="text-xs text-[var(--text-tertiary)]">/</span>
      <span class="text-xs font-mono text-[var(--text-primary)]">Link Bypasser</span>
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

    <!-- Main Omnibox Input Section -->
    <Card :hoverable="false" class="p-4 sm:p-6">
      <div class="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div class="relative flex-1">
          <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-tertiary)]">
            <Link2 class="w-4 h-4" />
          </div>
          <input
            id="bypass-url-input"
            v-model="inputUrl"
            type="url"
            placeholder="Paste shortlink or redirect URL (e.g. bit.ly, s.id, google.com/url?q=...)"
            class="w-full pl-10 pr-10 py-2.5 text-sm rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--border-active)] transition-all font-mono"
            :disabled="loading"
            @keydown.enter="handleBypass"
          />
          <button
            v-if="inputUrl"
            type="button"
            class="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title="Clear input"
            @click="clearInput"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="default"
            type="button"
            :disabled="loading"
            class="px-3"
            @click="pasteFromClipboard"
          >
            <Clipboard class="w-4 h-4 mr-1.5" />
            Paste
          </Button>
          <Button
            id="bypass-submit-btn"
            variant="primary"
            size="default"
            type="button"
            :loading="loading"
            @click="handleBypass"
          >
            <Sparkles v-if="!loading" class="w-4 h-4 mr-1.5" />
            {{ loading ? 'Tracing...' : 'Bypass Link' }}
          </Button>
        </div>
      </div>
    </Card>

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

    <!-- 3. Supported Platforms & Capabilities Directory (Bento Grid) -->
    <div class="space-y-3 pt-4">
      <div class="space-y-0.5">
        <h2 class="text-sm font-semibold text-[var(--text-primary)]">
          Supported Resolvers & Bypass Engines
        </h2>
        <p class="text-xs text-[var(--text-secondary)]">
          Autonomous multi-hop tracing works with all standard redirects, with tailored rules for major networks:
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- 1. Standard Shorteners -->
        <Card :hoverable="false" class="p-4 space-y-2">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)]">
              <Globe class="w-3.5 h-3.5" />
            </div>
            <h3 class="text-xs font-semibold text-[var(--text-primary)]">Shortlink Expander</h3>
          </div>
          <p class="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            Follows HTTP 301/302 redirects recursively for Bitly, TinyURL, S.id, Cutt.ly, is.gd, and Twitter t.co.
          </p>
          <div class="flex flex-wrap gap-1 pt-1">
            <Badge variant="badge" size="sm">bit.ly</Badge>
            <Badge variant="badge" size="sm">s.id</Badge>
            <Badge variant="badge" size="sm">tinyurl</Badge>
            <Badge variant="badge" size="sm">t.co</Badge>
          </div>
        </Card>

        <!-- 2. Social Link Shims -->
        <Card :hoverable="false" class="p-4 space-y-2">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)]">
              <Share2 class="w-3.5 h-3.5" />
            </div>
            <h3 class="text-xs font-semibold text-[var(--text-primary)]">Gateway & Shim Unmask</h3>
          </div>
          <p class="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            Instantly extracts destination URLs from Google warning redirects, Facebook link shim, Instagram, and Steam.
          </p>
          <div class="flex flex-wrap gap-1 pt-1">
            <Badge variant="badge" size="sm">Google URL</Badge>
            <Badge variant="badge" size="sm">FB Shim</Badge>
            <Badge variant="badge" size="sm">Steam</Badge>
            <Badge variant="badge" size="sm">YouTube</Badge>
          </div>
        </Card>

        <!-- 3. Social Unlockers & Adfly -->
        <Card :hoverable="false" class="p-4 space-y-2">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)]">
              <Lock class="w-3.5 h-3.5" />
            </div>
            <h3 class="text-xs font-semibold text-[var(--text-primary)]">Unlocker Bypass</h3>
          </div>
          <p class="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            Bypasses "Subscribe to Unlock" pages (Sub2Unlock, Boost.ink) and decodes AdFly reverse payload variables.
          </p>
          <div class="flex flex-wrap gap-1 pt-1">
            <Badge variant="badge" size="sm">Sub2Unlock</Badge>
            <Badge variant="badge" size="sm">Boost.ink</Badge>
            <Badge variant="badge" size="sm">Adf.ly</Badge>
          </div>
        </Card>

        <!-- 4. Telemetry Sanitizer -->
        <Card :hoverable="false" class="p-4 space-y-2">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)]">
              <ShieldCheck class="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <h3 class="text-xs font-semibold text-[var(--text-primary)]">Tracker Stripper</h3>
          </div>
          <p class="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            Automatically strips UTM parameters, Facebook click IDs, and telemetry tokens to keep your destination clean.
          </p>
          <div class="flex flex-wrap gap-1 pt-1">
            <Badge variant="badge" size="sm">utm_*</Badge>
            <Badge variant="badge" size="sm">fbclid</Badge>
            <Badge variant="badge" size="sm">gclid</Badge>
            <Badge variant="badge" size="sm">igsh</Badge>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
