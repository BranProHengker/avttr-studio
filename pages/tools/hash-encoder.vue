<script setup lang="ts">
import { ref, watch } from 'vue'
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
  <div class="space-y-8 pb-12 w-full max-w-5xl">
    <!-- Breadcrumb -->
    <div class="flex items-center gap-2">
      <NuxtLink to="/" class="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
        ← Dashboard
      </NuxtLink>
      <span class="text-xs text-[var(--text-tertiary)]">/</span>
      <span class="text-xs font-mono text-[var(--text-primary)]">Base64 & Hash Studio</span>
    </div>

    <!-- Header -->
    <div class="space-y-1">
      <div class="flex items-center gap-2">
        <h1 class="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          Base64 & Hash Studio
        </h1>
        <Badge variant="primary" size="sm">Web Crypto API</Badge>
      </div>
      <p class="text-xs sm:text-sm text-[var(--text-secondary)]">
        Compute SHA-256/SHA-512 hashes, encode/decode Base64, and format URL parameters securely on the client.
      </p>
    </div>

    <!-- Tabs Header -->
    <div class="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2">
      <button
        type="button"
        class="px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer"
        :class="activeTab === 'hash' ? 'bg-[#1447E6] text-white font-semibold' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'"
        @click="activeTab = 'hash'"
      >
        Cryptographic Hashes
      </button>
      <button
        type="button"
        class="px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer"
        :class="activeTab === 'base64' ? 'bg-[#1447E6] text-white font-semibold' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'"
        @click="activeTab = 'base64'"
      >
        Base64 Converter
      </button>
      <button
        type="button"
        class="px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer"
        :class="activeTab === 'url' ? 'bg-[#1447E6] text-white font-semibold' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'"
        @click="activeTab = 'url'"
      >
        URL Encoder
      </button>
    </div>

    <!-- Input Textarea Card -->
    <Card :hoverable="false" class="p-5 space-y-3">
      <div class="flex items-center justify-between">
        <label class="text-xs font-semibold text-[var(--text-primary)]">
          Input String or Payload
        </label>
        <label class="text-xs text-[#3080FF] hover:underline cursor-pointer">
          <span>Upload File</span>
          <input type="file" class="hidden" @change="handleFileUpload" />
        </label>
      </div>

      <textarea
        v-model="inputText"
        rows="4"
        placeholder="Type or paste payload..."
        class="w-full p-3 bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-lg text-xs sm:text-sm font-mono focus:outline-none focus:border-[#1447E6] focus:ring-3 focus:ring-[#1447E6]/15"
      />
    </Card>

    <!-- Tab 1: Hashes Output -->
    <div v-if="activeTab === 'hash'" class="space-y-3">
      <Card :hoverable="false" class="p-4 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-mono font-bold text-[var(--text-primary)]">SHA-256 (Standard)</span>
          <Button size="sm" variant="ghost" @click="copy(sha256Hash, 'SHA-256')">Copy</Button>
        </div>
        <div class="p-2.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg font-mono text-xs text-[#3080FF] break-all select-all">
          {{ sha256Hash || 'Waiting for input...' }}
        </div>
      </Card>

      <Card :hoverable="false" class="p-4 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-mono font-bold text-[var(--text-primary)]">SHA-512 (High Security)</span>
          <Button size="sm" variant="ghost" @click="copy(sha512Hash, 'SHA-512')">Copy</Button>
        </div>
        <div class="p-2.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg font-mono text-xs text-[#10B981] break-all select-all">
          {{ sha512Hash || 'Waiting for input...' }}
        </div>
      </Card>

      <Card :hoverable="false" class="p-4 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-mono font-bold text-[var(--text-primary)]">SHA-1 (Legacy)</span>
          <Button size="sm" variant="ghost" @click="copy(sha1Hash, 'SHA-1')">Copy</Button>
        </div>
        <div class="p-2.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg font-mono text-xs text-[var(--text-secondary)] break-all select-all">
          {{ sha1Hash || 'Waiting for input...' }}
        </div>
      </Card>
    </div>

    <!-- Tab 2: Base64 Output -->
    <div v-if="activeTab === 'base64'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Card :hoverable="false" class="p-5 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-[var(--text-primary)]">Base64 Encoded</span>
          <Button size="sm" variant="ghost" @click="copy(base64Encoded, 'Base64 Encoded')">Copy</Button>
        </div>
        <textarea
          :value="base64Encoded"
          readonly
          rows="6"
          class="w-full p-2.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg font-mono text-xs text-[var(--text-primary)] resize-none"
        />
      </Card>

      <Card :hoverable="false" class="p-5 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-[var(--text-primary)]">Base64 Decoded (If input is valid B64)</span>
          <Button size="sm" variant="ghost" @click="copy(base64Decoded, 'Base64 Decoded')">Copy</Button>
        </div>
        <textarea
          :value="base64Decoded"
          readonly
          rows="6"
          class="w-full p-2.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg font-mono text-xs text-[var(--text-primary)] resize-none"
        />
      </Card>
    </div>

    <!-- Tab 3: URL Output -->
    <div v-if="activeTab === 'url'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Card :hoverable="false" class="p-5 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-[var(--text-primary)]">URL Encoded</span>
          <Button size="sm" variant="ghost" @click="copy(urlEncoded, 'URL Encoded')">Copy</Button>
        </div>
        <textarea
          :value="urlEncoded"
          readonly
          rows="6"
          class="w-full p-2.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg font-mono text-xs text-[var(--text-primary)] resize-none"
        />
      </Card>

      <Card :hoverable="false" class="p-5 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-[var(--text-primary)]">URL Decoded</span>
          <Button size="sm" variant="ghost" @click="copy(urlDecoded, 'URL Decoded')">Copy</Button>
        </div>
        <textarea
          :value="urlDecoded"
          readonly
          rows="6"
          class="w-full p-2.5 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-lg font-mono text-xs text-[var(--text-primary)] resize-none"
        />
      </Card>
    </div>
  </div>
</template>
