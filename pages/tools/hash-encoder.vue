<script setup lang="ts">
import { ref, watch } from 'vue'
import { Copy, Upload, Check, Hash, FileCode, Link as LinkIcon } from 'lucide-vue-next'
import { useClipboard } from '~/composables/useClipboard'
import { useToast } from '~/composables/useToast'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

const activeTab = ref<'hash' | 'base64' | 'url'>('hash')
const inputText = ref('Avttr Studio 2026')

// Hashes
const sha1Hash = ref('')
const sha256Hash = ref('')
const sha512Hash = ref('')

// Base64
const base64Encoded = ref('')
const base64Decoded = ref('')

// URL & Entities
const urlEncoded = ref('')
const urlDecoded = ref('')

const { copy } = useClipboard()
const toast = useToast()

const computeHashes = async (text: string) => {
  if (!text) {
    sha1Hash.value = ''
    sha256Hash.value = ''
    sha512Hash.value = ''
    return
  }

  const encoder = new TextEncoder()
  const data = encoder.encode(text)

  try {
    // SHA-1
    const buffer1 = await crypto.subtle.digest('SHA-1', data)
    sha1Hash.value = Array.from(new Uint8Array(buffer1))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // SHA-256
    const buffer256 = await crypto.subtle.digest('SHA-256', data)
    sha256Hash.value = Array.from(new Uint8Array(buffer256))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // SHA-512
    const buffer512 = await crypto.subtle.digest('SHA-512', data)
    sha512Hash.value = Array.from(new Uint8Array(buffer512))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch (err: any) {
    toast.error('Hash Error', err.message)
  }
}

const computeBase64 = (text: string) => {
  try {
    base64Encoded.value = btoa(unescape(encodeURIComponent(text)))
  } catch {
    base64Encoded.value = 'Encoding error'
  }

  try {
    base64Decoded.value = decodeURIComponent(escape(atob(text)))
  } catch {
    base64Decoded.value = 'Invalid Base64 string'
  }
}

const computeUrl = (text: string) => {
  urlEncoded.value = encodeURIComponent(text)
  try {
    urlDecoded.value = decodeURIComponent(text)
  } catch {
    urlDecoded.value = 'Invalid URL component'
  }
}

watch(
  inputText,
  (val) => {
    computeHashes(val)
    computeBase64(val)
    computeUrl(val)
  },
  { immediate: true }
)

const handleFileUpload = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    inputText.value = reader.result as string
    toast.success('File Loaded', `Read ${file.name}`)
  }
  reader.readAsText(file)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header & Breadcrumbs -->
    <div>
      <div class="flex items-center gap-2 text-xs text-[var(--text-tertiary)] mb-1">
        <NuxtLink to="/" class="hover:text-[var(--text-primary)] transition-colors">
          Dashboard
        </NuxtLink>
        <span>/</span>
        <span class="text-[var(--text-secondary)] font-medium">Tools</span>
        <span>/</span>
        <span class="text-[var(--text-primary)]">Base64 & Hash Studio</span>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Base64 & Hash Studio
          </h1>
          <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Compute SHA-256/SHA-512 hashes, encode/decode Base64, and format URL parameters securely on the client.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <Badge variant="secondary">
            Web Crypto API
          </Badge>
          <Badge variant="badge">
            100% Client Privacy
          </Badge>
        </div>
      </div>
    </div>

    <!-- Mode Switcher Tabs -->
    <div class="flex items-center bg-[#171717] border border-[var(--border-subtle)] rounded-full p-1 w-fit text-xs">
      <button
        type="button"
        class="px-4 py-1.5 rounded-full transition-all cursor-pointer font-medium"
        :class="activeTab === 'hash' ? 'bg-[#2E2E2E] text-white shadow-xs font-semibold' : 'text-[var(--text-secondary)] hover:text-white'"
        @click="activeTab = 'hash'"
      >
        Cryptographic Hashes
      </button>

      <button
        type="button"
        class="px-4 py-1.5 rounded-full transition-all cursor-pointer font-medium"
        :class="activeTab === 'base64' ? 'bg-[#2E2E2E] text-white shadow-xs font-semibold' : 'text-[var(--text-secondary)] hover:text-white'"
        @click="activeTab = 'base64'"
      >
        Base64 Encode & Decode
      </button>

      <button
        type="button"
        class="px-4 py-1.5 rounded-full transition-all cursor-pointer font-medium"
        :class="activeTab === 'url' ? 'bg-[#2E2E2E] text-white shadow-xs font-semibold' : 'text-[var(--text-secondary)] hover:text-white'"
        @click="activeTab = 'url'"
      >
        URL Component
      </button>
    </div>

    <!-- Input Box Card -->
    <Card :hoverable="false" class="p-5 sm:p-6 space-y-4">
      <div class="flex items-center justify-between">
        <label class="block text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
          Input Payload / Plaintext
        </label>

        <label class="text-xs text-[var(--text-secondary)] hover:text-white cursor-pointer flex items-center gap-1.5 transition-colors">
          <Upload class="w-3.5 h-3.5" />
          <span>Load Text File</span>
          <input type="file" class="hidden" @change="handleFileUpload" />
        </label>
      </div>

      <textarea
        v-model="inputText"
        rows="4"
        placeholder="Enter text or paste payload to hash / encode..."
        class="w-full p-3 bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-lg text-sm transition-all focus:outline-none focus:border-white focus:ring-2 focus:ring-white/10 font-mono"
      />
    </Card>

    <!-- TAB 1: Hashes -->
    <div v-if="activeTab === 'hash'" class="space-y-4">
      <!-- SHA-256 (Primary) -->
      <Card :hoverable="false" class="p-5 space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-[var(--text-primary)]">SHA-256 (Recommended)</span>
            <Badge variant="primary" size="sm">256-bit</Badge>
          </div>
          <Button size="sm" variant="ghost" @click="copy(sha256Hash, 'SHA-256 Hash')">
            <Copy class="w-3.5 h-3.5 mr-1" />
            Copy
          </Button>
        </div>
        <div class="p-3 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg font-mono text-xs text-white break-all select-all">
          {{ sha256Hash || '...' }}
        </div>
      </Card>

      <!-- SHA-512 -->
      <Card :hoverable="false" class="p-5 space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-[var(--text-primary)]">SHA-512 (High Security)</span>
            <Badge variant="secondary" size="sm">512-bit</Badge>
          </div>
          <Button size="sm" variant="ghost" @click="copy(sha512Hash, 'SHA-512 Hash')">
            <Copy class="w-3.5 h-3.5 mr-1" />
            Copy
          </Button>
        </div>
        <div class="p-3 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg font-mono text-xs text-[var(--text-secondary)] break-all select-all">
          {{ sha512Hash || '...' }}
        </div>
      </Card>

      <!-- SHA-1 -->
      <Card :hoverable="false" class="p-5 space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-[var(--text-primary)]">SHA-1 (Legacy / Git Checksums)</span>
            <Badge variant="badge" size="sm">160-bit</Badge>
          </div>
          <Button size="sm" variant="ghost" @click="copy(sha1Hash, 'SHA-1 Hash')">
            <Copy class="w-3.5 h-3.5 mr-1" />
            Copy
          </Button>
        </div>
        <div class="p-3 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg font-mono text-xs text-[var(--text-secondary)] break-all select-all">
          {{ sha1Hash || '...' }}
        </div>
      </Card>
    </div>

    <!-- TAB 2: Base64 -->
    <div v-else-if="activeTab === 'base64'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Encoded -->
      <Card :hoverable="false" class="p-5 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-[var(--text-primary)]">Base64 Encoded (Output)</span>
          <Button size="sm" variant="ghost" @click="copy(base64Encoded, 'Base64 Encoded')">
            <Copy class="w-3.5 h-3.5 mr-1" />
            Copy
          </Button>
        </div>
        <div class="p-3 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg font-mono text-xs text-white break-all select-all min-h-[100px]">
          {{ base64Encoded || '...' }}
        </div>
      </Card>

      <!-- Decoded -->
      <Card :hoverable="false" class="p-5 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-[var(--text-primary)]">Base64 Decoded (From Payload)</span>
          <Button size="sm" variant="ghost" @click="copy(base64Decoded, 'Base64 Decoded')">
            <Copy class="w-3.5 h-3.5 mr-1" />
            Copy
          </Button>
        </div>
        <div class="p-3 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg font-mono text-xs text-[var(--text-secondary)] break-all select-all min-h-[100px]">
          {{ base64Decoded || '...' }}
        </div>
      </Card>
    </div>

    <!-- TAB 3: URL Component -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- URI Encoded -->
      <Card :hoverable="false" class="p-5 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-[var(--text-primary)]">encodeURIComponent</span>
          <Button size="sm" variant="ghost" @click="copy(urlEncoded, 'URL Encoded')">
            <Copy class="w-3.5 h-3.5 mr-1" />
            Copy
          </Button>
        </div>
        <div class="p-3 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg font-mono text-xs text-white break-all select-all min-h-[100px]">
          {{ urlEncoded || '...' }}
        </div>
      </Card>

      <!-- URI Decoded -->
      <Card :hoverable="false" class="p-5 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-[var(--text-primary)]">decodeURIComponent</span>
          <Button size="sm" variant="ghost" @click="copy(urlDecoded, 'URL Decoded')">
            <Copy class="w-3.5 h-3.5 mr-1" />
            Copy
          </Button>
        </div>
        <div class="p-3 bg-[var(--bg-input)] border border-[var(--border-card)] rounded-lg font-mono text-xs text-[var(--text-secondary)] break-all select-all min-h-[100px]">
          {{ urlDecoded || '...' }}
        </div>
      </Card>
    </div>
  </div>
</template>
