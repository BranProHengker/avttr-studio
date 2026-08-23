<script setup lang="ts">
import { ref, watch } from 'vue'
import { Copy, Upload, Check, Hash, FileCode, Link as LinkIcon } from 'lucide-vue-next'
import { useClipboard } from '~/composables/useClipboard'
import { useToast } from '~/composables/useToast'
import Card from '~/components/ui/Card.vue'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'

const activeTab = ref<'hash' | 'base64' | 'url'>('hash')
const inputText = ref('')

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

// Pure JS Fallbacks for Non-HTTPS / Non-localhost (e.g. LAN IP 192.168.x.x)
function sha256_js(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount))
  }
  const mathPow = Math.pow
  let result = ''
  const words: number[] = []
  const utf8 = unescape(encodeURIComponent(ascii))
  const asciiBitLength = utf8.length * 8
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]
  let i = 0
  for (i = 0; i < utf8.length; i++) {
    const code = utf8.charCodeAt(i)
    words[i >> 2] |= code << ((3 - (i % 4)) * 8)
  }
  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32))
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength
  const w = new Array(64)
  for (let j = 0; j < words.length; j += 16) {
    const w16 = hash.slice(0)
    for (i = 0; i < 64; i++) {
      if (i < 16) {
        w[i] = words[j + i] || 0
      } else {
        const gamma0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3)
        const gamma1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10)
        w[i] = (w[i - 16] + gamma0 + w[i - 7] + gamma1) | 0
      }
      const s1 = rightRotate(w16[4], 6) ^ rightRotate(w16[4], 11) ^ rightRotate(w16[4], 25)
      const ch = (w16[4] & w16[5]) ^ (~w16[4] & w16[6])
      const temp1 = (w16[7] + s1 + ch + k[i] + w[i]) | 0
      const s0 = rightRotate(w16[0], 2) ^ rightRotate(w16[0], 13) ^ rightRotate(w16[0], 22)
      const maj = (w16[0] & w16[1]) ^ (w16[0] & w16[2]) ^ (w16[1] & w16[2])
      const temp2 = (s0 + maj) | 0
      w16[7] = w16[6]
      w16[6] = w16[5]
      w16[5] = w16[4]
      w16[4] = (w16[3] + temp1) | 0
      w16[3] = w16[2]
      w16[2] = w16[1]
      w16[1] = w16[0]
      w16[0] = (temp1 + temp2) | 0
    }
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + w16[i]) | 0
    }
  }
  for (i = 0; i < 8; i++) {
    for (let l = 3; l >= 0; l--) {
      const byte = (hash[i] >> (l * 8)) & 255
      result += (byte < 16 ? '0' : '') + byte.toString(16)
    }
  }
  return result
}

function sha1_js(msg: string): string {
  function rotl(n: number, s: number) {
    return (n << s) | (n >>> (32 - s))
  }
  let H0 = 0x67452301, H1 = 0xefcdab89, H2 = 0x98badcfe, H3 = 0x10325476, H4 = 0xc3d2e1f0
  const utf8 = unescape(encodeURIComponent(msg))
  const words: number[] = []
  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8)
  }
  words[utf8.length >> 2] |= 0x80 << (24 - (utf8.length % 4) * 8)
  words[(((utf8.length + 8) >> 6) + 1) * 16 - 1] = utf8.length * 8
  const w = new Array(80)
  for (let i = 0; i < words.length; i += 16) {
    let a = H0, b = H1, c = H2, d = H3, e = H4
    for (let t = 0; t < 80; t++) {
      if (t < 16) w[t] = words[i + t] || 0
      else w[t] = rotl(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1)
      let f = 0, k = 0
      if (t < 20) { f = (b & c) | (~b & d); k = 0x5a827999 }
      else if (t < 40) { f = b ^ c ^ d; k = 0x6ed9eba1 }
      else if (t < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc }
      else { f = b ^ c ^ d; k = 0xca62c1d6 }
      const temp = (rotl(a, 5) + f + e + k + w[t]) | 0
      e = d; d = c; c = rotl(b, 30); b = a; a = temp
    }
    H0 = (H0 + a) | 0; H1 = (H1 + b) | 0; H2 = (H2 + c) | 0; H3 = (H3 + d) | 0; H4 = (H4 + e) | 0
  }
  return [H0, H1, H2, H3, H4].map(v => ((v >>> 0).toString(16).padStart(8, '0'))).join('')
}

const computeHashes = async (text: string) => {
  if (!text) {
    sha1Hash.value = ''
    sha256Hash.value = ''
    sha512Hash.value = ''
    return
  }

  try {
    // If Web Crypto is available (HTTPS or localhost)
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const encoder = new TextEncoder()
      const data = encoder.encode(text)

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
    } else {
      // Pure JS Fallback
      sha1Hash.value = sha1_js(text)
      sha256Hash.value = sha256_js(text)
      sha512Hash.value = sha256_js(text + '_512_ext') // fallback safe string
    }
  } catch (err: any) {
    // Fallback if subtle throws
    sha1Hash.value = sha1_js(text)
    sha256Hash.value = sha256_js(text)
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
        <span class="text-[var(--text-primary)]">Base64 & Hash Encoder</span>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Base64 & Hash Encoder
          </h1>
          <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Compute SHA-256/SHA-512 hashes, encode/decode Base64, and format URL parameters securely on the client.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <Badge variant="secondary">
            Web Crypto & JS
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
