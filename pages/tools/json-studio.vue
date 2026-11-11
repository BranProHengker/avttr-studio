<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import {
  Code,
  Copy,
  Check,
  Download,
  Upload,
  Trash as Trash2,
  Refresh as RefreshCw,
  Search,
  NavArrowRight,
  NavArrowDown,
  Eye,
  Settings,
  ZoomIn,
  ZoomOut,
  List,
  Tree,
  Undo as RotateCcw,
  Sparks as Sparkles,
  PageEdit as FileCode,
  CheckCircle,
  WarningTriangle,
} from '@iconoir/vue'
import Prism from 'prismjs'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-python'

import { useToast } from '~/composables/useToast'
import { useI18n } from '~/composables/useI18n'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'
import {
  validateJson,
  autoFixJson,
  calculateJsonStats,
  jsonToTypeScript,
  jsonToZod,
  jsonToGo,
  jsonToRust,
  jsonToPython,
  jsonToJsonSchema,
  buildGraphNodes,
  type JsonStats,
  type GraphNode,
  type GraphEdge,
} from '~/composables/useJsonTransformer'

const toast = useToast()
const { t, locale } = useI18n()

useHead({
  title: 'JSON Studio — Type Generator & Graph Visualizer — Avttr Studio',
  meta: [
    {
      name: 'description',
      content: 'Client-side JSON studio to convert JSON into TypeScript, Zod, Go, Rust, and Python, or explore payloads with interactive visual node graphs. 100% private.'
    }
  ]
})

// Sample JSON Datasets
const SAMPLES = {
  user: {
    id: 1042,
    username: 'avttr_dev',
    email: 'avttr@studio.internal',
    is_active: true,
    created_at: '2026-11-11T20:00:00Z',
    roles: ['admin', 'maintainer'],
    profile: {
      display_name: 'Avttr Studio',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      bio: 'Fullstack developer & creative designer.',
      location: {
        city: 'Jakarta',
        country: 'Indonesia',
        coordinates: { lat: -6.2088, lng: 106.8456 }
      }
    },
    settings: {
      theme: 'dark',
      notifications: { email: true, push: false, telegram: true }
    }
  },
  ecommerce: {
    order_id: 'ORD-98421',
    status: 'shipped',
    currency: 'USD',
    subtotal: 149.99,
    tax: 15.0,
    shipping_fee: 0.0,
    total: 164.99,
    customer: {
      id: 582,
      name: 'John Doe',
      verified: true
    },
    items: [
      { sku: 'KB-MECH-PRO', name: 'Mechanical Keyboard RGB', qty: 1, unit_price: 119.99 },
      { sku: 'MOUSE-PAD-XL', name: 'Desk Mat Stealth Black', qty: 1, unit_price: 30.0 }
    ],
    tracking: {
      carrier: 'DHL Express',
      code: 'DHL-84729104',
      estimated_delivery: '2026-11-14'
    }
  },
  github: {
    name: 'avttr-studio',
    full_name: 'avttr/avttr-studio',
    private: false,
    stars_count: 3820,
    forks_count: 421,
    license: { key: 'mit', name: 'MIT License', spdx_id: 'MIT' },
    topics: ['nuxt3', 'vue3', 'typescript', 'tailwind-v4', 'devtools'],
    author: {
      login: 'avttr',
      id: 1984201,
      type: 'User',
      site_admin: false
    }
  }
}

// Active Studio View Mode
type StudioView = 'types' | 'graph' | 'tree'
const activeView = ref<StudioView>('types')

// Raw JSON Input State
const jsonInput = ref<string>(JSON.stringify(SAMPLES.user, null, 2))
const rootTypeName = ref<string>('UserResponse')
const parsedJson = ref<any>(SAMPLES.user)
const jsonStats = ref<JsonStats>(calculateJsonStats(SAMPLES.user))
const validationError = ref<string | null>(null)
const errorLine = ref<number | null>(null)
const errorCol = ref<number | null>(null)

// Target Languages for Type Generator
type TargetLang = 'typescript' | 'zod' | 'go' | 'rust' | 'python' | 'json-schema'
const selectedLang = ref<TargetLang>('typescript')

// Type Generation Flags
const tsMode = ref<'interface' | 'type'>('interface')
const isOptional = ref<boolean>(false)
const isReadonly = ref<boolean>(false)
const useSemicolons = ref<boolean>(true)

// Graph Visualizer Canvas State
const graphContainerRef = ref<HTMLDivElement | null>(null)
const graphData = ref<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] })
const zoomLevel = ref<number>(1)
const panX = ref<number>(20)
const panY = ref<number>(20)
const isPanning = ref<boolean>(false)
const startPanX = ref<number>(0)
const startPanY = ref<number>(0)
const selectedGraphNode = ref<GraphNode | null>(null)

// Tree Explorer State
const treeSearchQuery = ref<string>('')
const collapsedNodeIds = ref<Record<string, boolean>>({})

// Update JSON state & trigger downstream parsers
function onJsonChange() {
  if (!jsonInput.value.trim()) {
    parsedJson.value = null
    graphData.value = { nodes: [], edges: [] }
    jsonStats.value = { totalKeys: 0, depth: 0, byteSize: 0, arrayCount: 0, objectCount: 0, primitiveCount: 0 }
    validationError.value = 'Input is empty'
    errorLine.value = null
    errorCol.value = null
    return
  }

  const check = validateJson(jsonInput.value)
  if (check.valid) {
    parsedJson.value = check.data
    jsonStats.value = calculateJsonStats(check.data)
    validationError.value = null
    errorLine.value = null
    errorCol.value = null
    updateGraph()
  } else {
    parsedJson.value = null
    validationError.value = check.error || 'Syntax error'
    errorLine.value = check.line || null
    errorCol.value = check.col || null
  }
}

watch(jsonInput, onJsonChange)

function loadSample(key: keyof typeof SAMPLES) {
  jsonInput.value = JSON.stringify(SAMPLES[key], null, 2)
  rootTypeName.value = key === 'user' ? 'UserResponse' : key === 'ecommerce' ? 'OrderDetails' : 'RepositoryInfo'
  toast.success('Sample Loaded', `${key.toUpperCase()} payload loaded into studio.`)
}

function handleFileUpload(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    const reader = new FileReader()
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        jsonInput.value = event.target.result
        const cleanName = file.name.replace(/\.[^.]+$/, '')
        rootTypeName.value = cleanName.charAt(0).toUpperCase() + cleanName.slice(1)
        toast.success('File Loaded', `${file.name} loaded successfully.`)
      }
    }
    reader.readAsText(file)
    target.value = ''
  }
}

function formatJson(spaces = 2) {
  try {
    const parsed = JSON.parse(jsonInput.value)
    jsonInput.value = JSON.stringify(parsed, null, spaces)
    toast.success('Formatted', `JSON beautified with ${spaces} spaces indentation.`)
  } catch (err: any) {
    toast.error('Format Error', 'Fix JSON syntax errors before formatting.')
  }
}

function minifyJson() {
  try {
    const parsed = JSON.parse(jsonInput.value)
    jsonInput.value = JSON.stringify(parsed)
    toast.success('Minified', 'JSON compacted to single-line.')
  } catch {
    toast.error('Minify Error', 'Fix JSON syntax errors before minifying.')
  }
}

function attemptAutoFix() {
  const fixed = autoFixJson(jsonInput.value)
  const test = validateJson(fixed)
  if (test.valid) {
    jsonInput.value = JSON.stringify(test.data, null, 2)
    toast.success('Auto-Fixed!', 'Unquoted keys, comments, and trailing commas cleaned up.')
  } else {
    toast.error('Could Not Auto-Fix', 'Syntax is too malformed to auto-repair.')
  }
}

function clearEditor() {
  jsonInput.value = ''
  parsedJson.value = null
  graphData.value = { nodes: [], edges: [] }
  selectedGraphNode.value = null
  validationError.value = 'Input is empty'
}

// ─── Generated Code Computation ───────────────────────────────────────
const generatedCode = computed<string>(() => {
  if (validationError.value && validationError.value !== 'Input is empty') {
    return `// ⚠️ Cannot generate types: JSON syntax error\n// ${validationError.value}`
  }
  if (!parsedJson.value) return '// Paste valid JSON to generate types'
  const options = {
    rootName: rootTypeName.value || 'Root',
    tsMode: tsMode.value,
    isOptional: isOptional.value,
    isReadonly: isReadonly.value,
    useSemicolons: useSemicolons.value,
  }

  switch (selectedLang.value) {
    case 'typescript':
      return jsonToTypeScript(parsedJson.value, options)
    case 'zod':
      return jsonToZod(parsedJson.value, options)
    case 'go':
      return jsonToGo(parsedJson.value, options)
    case 'rust':
      return jsonToRust(parsedJson.value, options)
    case 'python':
      return jsonToPython(parsedJson.value, options)
    case 'json-schema':
      return jsonToJsonSchema(parsedJson.value, options)
    default:
      return ''
  }
})

// Highlighted HTML using Prism
const highlightedCode = computed<string>(() => {
  if (!generatedCode.value) return ''
  const code = generatedCode.value
  let grammar = Prism.languages.typescript
  let langKey = 'typescript'

  if (selectedLang.value === 'go') {
    grammar = Prism.languages.go || Prism.languages.clike
    langKey = 'go'
  } else if (selectedLang.value === 'rust') {
    grammar = Prism.languages.rust || Prism.languages.clike
    langKey = 'rust'
  } else if (selectedLang.value === 'python') {
    grammar = Prism.languages.python || Prism.languages.clike
    langKey = 'python'
  } else if (selectedLang.value === 'json-schema') {
    grammar = Prism.languages.json || Prism.languages.javascript
    langKey = 'json'
  }

  try {
    return Prism.highlight(code, grammar, langKey)
  } catch {
    return code.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
})

async function copyOutputCode() {
  if (!generatedCode.value) return
  await navigator.clipboard.writeText(generatedCode.value)
  toast.success('Copied!', `${selectedLang.value.toUpperCase()} code copied to clipboard.`)
}

async function copyJsonInput() {
  if (!jsonInput.value) return
  await navigator.clipboard.writeText(jsonInput.value)
  toast.success('Copied!', 'JSON payload copied to clipboard.')
}

function downloadOutputCode() {
  if (!generatedCode.value) return
  const extMap: Record<TargetLang, string> = {
    typescript: 'ts',
    zod: 'ts',
    go: 'go',
    rust: 'rs',
    python: 'py',
    'json-schema': 'json',
  }
  const ext = extMap[selectedLang.value] || 'txt'
  const filename = `${rootTypeName.value.toLowerCase() || 'schema'}.${ext}`
  const blob = new Blob([generatedCode.value], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
  toast.success('Downloaded', `${filename} saved successfully.`)
}

// ─── Graph Visualizer Methods ─────────────────────────────────────────
function updateGraph() {
  if (parsedJson.value) {
    graphData.value = buildGraphNodes(parsedJson.value, rootTypeName.value || 'Root')
  }
}

function resetZoom() {
  zoomLevel.value = 1
  panX.value = 30
  panY.value = 30
}

function zoomIn() {
  zoomLevel.value = Math.min(2.5, Number((zoomLevel.value + 0.15).toFixed(2)))
}

function zoomOut() {
  zoomLevel.value = Math.max(0.3, Number((zoomLevel.value - 0.15).toFixed(2)))
}

function onGraphMouseDown(e: MouseEvent) {
  if (e.target && (e.target as HTMLElement).closest('.interactive-node')) return
  isPanning.value = true
  startPanX.value = e.clientX - panX.value
  startPanY.value = e.clientY - panY.value

  const onMouseMove = (moveEvt: MouseEvent) => {
    if (!isPanning.value) return
    panX.value = moveEvt.clientX - startPanX.value
    panY.value = moveEvt.clientY - startPanY.value
  }

  const onMouseUp = () => {
    isPanning.value = false
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function calculateBezierCurve(fromX: number, fromY: number, toX: number, toY: number): string {
  const dx = toX - fromX
  const control1X = fromX + dx * 0.5
  const control2X = toX - dx * 0.5
  return `M ${fromX} ${fromY} C ${control1X} ${fromY}, ${control2X} ${toY}, ${toX} ${toY}`
}

async function copyJsonPath(path: string) {
  await navigator.clipboard.writeText(path)
  toast.success('Path Copied', `${path} copied to clipboard.`)
}

// ─── Tree Explorer Filtering & Collapsing ─────────────────────────────
function toggleNodeCollapse(nodeId: string) {
  collapsedNodeIds.value[nodeId] = !collapsedNodeIds.value[nodeId]
}

function expandAllTree() {
  collapsedNodeIds.value = {}
}

function collapseAllTree() {
  const map: Record<string, boolean> = {}
  graphData.value.nodes.forEach((n) => {
    map[n.id] = true
  })
  collapsedNodeIds.value = map
}

const filteredTreeNodes = computed<GraphNode[]>(() => {
  if (!parsedJson.value) return []
  if (!treeSearchQuery.value.trim()) return graphData.value.nodes

  const q = treeSearchQuery.value.toLowerCase().trim()
  return graphData.value.nodes
    .map((node) => {
      const labelMatch = node.label.toLowerCase().includes(q) || node.path.toLowerCase().includes(q)
      const matchingProps = node.properties.filter(
        (p) => p.key.toLowerCase().includes(q) || String(p.valuePreview).toLowerCase().includes(q)
      )
      if (labelMatch) {
        return node
      }
      if (matchingProps.length > 0) {
        return {
          ...node,
          properties: matchingProps,
        }
      }
      return null
    })
    .filter((n): n is GraphNode => n !== null)
})

function triggerFileInput() {
  if (import.meta.client) {
    const el = document.getElementById('json-file-input') as HTMLInputElement | null
    el?.click()
  }
}

onMounted(() => {
  updateGraph()
})
</script>

<template>
  <div class="space-y-6 pb-12 w-full">
    <!-- Breadcrumb Navigation (DESIGN.md Section 14) -->
    <div class="flex items-center gap-2 text-xs font-mono text-[var(--text-tertiary)]">
      <NuxtLink to="/" class="hover:text-[var(--text-primary)] transition-colors">Dashboard</NuxtLink>
      <span>/</span>
      <span>Developer</span>
      <span>/</span>
      <span class="text-[var(--text-primary)]">JSON Studio</span>
    </div>

    <!-- Hidden File Input for .json loading -->
    <input
      id="json-file-input"
      type="file"
      accept=".json,application/json,text/plain"
      class="hidden"
      @change="handleFileUpload"
    />

    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2.5">
          <span>JSON Studio</span>
          <Badge variant="outline" size="sm" class="font-mono text-[10px]">100% Client-Side</Badge>
        </h1>
        <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
          Convert JSON to TypeScript, Zod, Go, Rust, and Python types, or explore payloads with interactive visual node graphs.
        </p>
      </div>

      <!-- Quick Sample & Action Bar -->
      <div class="flex flex-wrap items-center gap-2">
        <!-- Sample Presets Pill -->
        <div class="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-[#2E2E2E] rounded-xl text-xs">
          <span class="px-2 text-[10px] uppercase font-mono text-[var(--text-tertiary)]">Presets:</span>
          <button
            type="button"
            class="px-2 py-1 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            @click="loadSample('user')"
          >
            User
          </button>
          <button
            type="button"
            class="px-2 py-1 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            @click="loadSample('ecommerce')"
          >
            Order
          </button>
          <button
            type="button"
            class="px-2 py-1 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            @click="loadSample('github')"
          >
            GitHub
          </button>
        </div>

        <!-- Mode Switcher Tabs -->
        <div class="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-[#2E2E2E] rounded-xl text-xs">
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5"
            :class="activeView === 'types' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'"
            @click="activeView = 'types'"
          >
            <Code class="w-3.5 h-3.5" />
            <span>Type Generator</span>
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5"
            :class="activeView === 'graph' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'"
            @click="activeView = 'graph'"
          >
            <Tree class="w-3.5 h-3.5" />
            <span>Visual Graph</span>
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5"
            :class="activeView === 'tree' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'"
            @click="activeView = 'tree'"
          >
            <List class="w-3.5 h-3.5" />
            <span>Tree Explorer</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Main Studio Grid (Side-by-side Layout) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- ─── LEFT COLUMN: JSON Input & Formatter (5 cols) ──────────────── -->
      <div class="lg:col-span-5 bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#262626] rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        <!-- Editor Header Bar -->
        <div class="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-[#262626]">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] font-mono">
              JSON Source
            </span>
            <Badge v-if="!validationError" variant="secondary" size="sm" class="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
              Valid JSON
            </Badge>
            <Badge v-else variant="outline" size="sm" class="text-[10px] text-rose-500 font-mono border-rose-500/30">
              Error
            </Badge>
          </div>

          <!-- Utility Micro-Actions -->
          <div class="flex items-center gap-1 text-xs">
            <button
              type="button"
              class="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Upload JSON File"
              @click="triggerFileInput"
            >
              <Upload class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              class="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Copy Raw JSON"
              @click="copyJsonInput"
            >
              <Copy class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              class="p-1.5 text-[var(--text-tertiary)] hover:text-rose-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Clear Input"
              @click="clearEditor"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Code Editor Area -->
        <div class="relative">
          <textarea
            v-model="jsonInput"
            spellcheck="false"
            rows="18"
            placeholder="Paste raw JSON payload here..."
            class="w-full p-3.5 bg-zinc-50 dark:bg-[#101012] border border-zinc-200 dark:border-[#2E2E2E] focus:border-zinc-400 dark:focus:border-white/40 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded-xl font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all resize-y select-text"
          />

          <!-- Floating Validation Error Banner -->
          <div
            v-if="validationError"
            class="mt-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between gap-2"
          >
            <div class="flex items-center gap-1.5 truncate">
              <WarningTriangle class="w-4 h-4 shrink-0" />
              <span class="truncate">{{ validationError }}</span>
              <span v-if="errorLine" class="font-mono text-[10px] shrink-0 opacity-80">(Line {{ errorLine }}, Col {{ errorCol }})</span>
            </div>
            <button
              type="button"
              class="px-2 py-1 rounded bg-rose-500 text-white font-medium text-[10px] shrink-0 hover:bg-rose-600 cursor-pointer"
              @click="attemptAutoFix"
            >
              Auto-Fix
            </button>
          </div>
        </div>

        <!-- Format & Quick Clean Tools Bar -->
        <div class="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-200 dark:border-[#262626]">
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-mono font-medium border border-zinc-200 dark:border-[#2E2E2E] bg-white dark:bg-zinc-800 text-[var(--text-primary)] hover:border-zinc-400 dark:hover:border-zinc-600 cursor-pointer"
              @click="formatJson(2)"
            >
              Prettify 2s
            </button>
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-mono font-medium border border-zinc-200 dark:border-[#2E2E2E] bg-white dark:bg-zinc-800 text-[var(--text-primary)] hover:border-zinc-400 dark:hover:border-zinc-600 cursor-pointer"
              @click="formatJson(4)"
            >
              4s
            </button>
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-mono font-medium border border-zinc-200 dark:border-[#2E2E2E] bg-white dark:bg-zinc-800 text-[var(--text-primary)] hover:border-zinc-400 dark:hover:border-zinc-600 cursor-pointer"
              @click="minifyJson"
            >
              Minify
            </button>
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-mono font-medium border border-zinc-200 dark:border-[#2E2E2E] bg-white dark:bg-zinc-800 text-[var(--text-primary)] hover:border-zinc-400 dark:hover:border-zinc-600 cursor-pointer flex items-center gap-1"
              title="Clean trailing commas and unquoted keys"
              @click="attemptAutoFix"
            >
              <Sparkles class="w-3 h-3 text-amber-500" />
              <span>Fix</span>
            </button>
          </div>

          <!-- Payload Quick Stats -->
          <div v-if="!validationError" class="text-[11px] font-mono text-[var(--text-tertiary)] flex items-center gap-2">
            <span>{{ jsonStats.totalKeys }} keys</span>
            <span>•</span>
            <span>{{ (jsonStats.byteSize / 1024).toFixed(1) }} KB</span>
          </div>
        </div>
      </div>

      <!-- ─── RIGHT COLUMN: Output Area (7 cols) ────────────────────────── -->
      <div class="lg:col-span-7 bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#262626] rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        <!-- ─── VIEW 1: TYPE GENERATOR ──────────────────────────────────── -->
        <div v-if="activeView === 'types'" class="space-y-4">
          <!-- Top Bar: Language Select & Root Name -->
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-[#262626]">
            <!-- Language Pills -->
            <div class="flex flex-wrap items-center gap-1.5">
              <button
                v-for="lang in (['typescript', 'zod', 'go', 'rust', 'python', 'json-schema'] as const)"
                :key="lang"
                type="button"
                class="px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer capitalize"
                :class="selectedLang === lang
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-800/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'"
                @click="selectedLang = lang"
              >
                {{ lang === 'json-schema' ? 'JSON Schema' : lang }}
              </button>
            </div>

            <!-- Root Type Name Input -->
            <div class="flex items-center gap-2">
              <span class="text-[10px] uppercase font-mono text-[var(--text-tertiary)] shrink-0">Root:</span>
              <input
                v-model="rootTypeName"
                type="text"
                class="w-32 sm:w-40 px-2 py-1 bg-zinc-50 dark:bg-[#101012] border border-zinc-200 dark:border-[#2E2E2E] rounded-lg text-xs font-mono text-[var(--text-primary)] focus:outline-none"
              />
            </div>
          </div>

          <!-- Modifier Flags Options Bar -->
          <div class="flex flex-wrap items-center gap-4 text-xs select-none">
            <label class="flex items-center gap-1.5 cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <input v-model="isOptional" type="checkbox" class="w-3.5 h-3.5 rounded accent-zinc-900 dark:accent-white cursor-pointer" />
              <span>Optional fields (?)</span>
            </label>

            <template v-if="selectedLang === 'typescript'">
              <label class="flex items-center gap-1.5 cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <input v-model="isReadonly" type="checkbox" class="w-3.5 h-3.5 rounded accent-zinc-900 dark:accent-white cursor-pointer" />
                <span>Readonly modifier</span>
              </label>

              <div class="flex items-center p-0.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-md text-[11px] font-mono">
                <button
                  type="button"
                  class="px-2 py-0.5 rounded cursor-pointer"
                  :class="tsMode === 'interface' ? 'bg-white dark:bg-zinc-700 font-semibold shadow-xs text-zinc-900 dark:text-white' : 'text-zinc-400'"
                  @click="tsMode = 'interface'"
                >
                  interface
                </button>
                <button
                  type="button"
                  class="px-2 py-0.5 rounded cursor-pointer"
                  :class="tsMode === 'type' ? 'bg-white dark:bg-zinc-700 font-semibold shadow-xs text-zinc-900 dark:text-white' : 'text-zinc-400'"
                  @click="tsMode = 'type'"
                >
                  type
                </button>
              </div>
            </template>
          </div>

          <!-- Code Display Output Viewport -->
          <div class="relative bg-zinc-900 dark:bg-[#0c0c0e] rounded-xl border border-zinc-800 dark:border-[#222225] overflow-hidden">
            <!-- Header bar inside output box -->
            <div class="px-3.5 py-2 bg-zinc-800/60 dark:bg-[#141417] border-b border-zinc-800 dark:border-[#222225] flex items-center justify-between text-xs">
              <span class="font-mono text-[11px] text-zinc-400">
                Generated {{ selectedLang.toUpperCase() }}
              </span>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="p-1 px-2 text-zinc-300 hover:text-white rounded hover:bg-white/10 transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
                  @click="copyOutputCode"
                >
                  <Copy class="w-3 h-3" />
                  <span>Copy</span>
                </button>
                <button
                  type="button"
                  class="p-1 px-2 text-zinc-300 hover:text-white rounded hover:bg-white/10 transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
                  @click="downloadOutputCode"
                >
                  <Download class="w-3 h-3" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            <!-- Code block -->
            <pre class="p-4 text-xs font-mono leading-relaxed overflow-x-auto max-h-[500px] select-text text-zinc-100"><code v-html="highlightedCode" /></pre>
          </div>
        </div>

        <!-- ─── VIEW 2: VISUAL GRAPH (2D Pan & Zoom SVG Nodes) ───────────── -->
        <div v-else-if="activeView === 'graph'" class="space-y-3">
          <!-- Canvas Toolbar Controls -->
          <div class="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-[#262626]">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)] font-mono">
                Interactive Graph
              </span>
              <Badge variant="outline" size="sm" class="font-mono text-[10px]">
                {{ graphData.nodes.length }} Nodes • {{ graphData.edges.length }} Edges
              </Badge>
            </div>

            <!-- Zoom Controls -->
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Zoom Out"
                @click="zoomOut"
              >
                <ZoomOut class="w-4 h-4" />
              </button>
              <span class="text-xs font-mono text-[var(--text-tertiary)] w-12 text-center">
                {{ Math.round(zoomLevel * 100) }}%
              </span>
              <button
                type="button"
                class="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Zoom In"
                @click="zoomIn"
              >
                <ZoomIn class="w-4 h-4" />
              </button>
              <button
                type="button"
                class="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Reset View"
                @click="resetZoom"
              >
                <RotateCcw class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- Infinite Pan & Zoom Canvas Viewport -->
          <div
            ref="graphContainerRef"
            class="relative h-[520px] bg-zinc-50 dark:bg-[#0c0c0e] rounded-xl border border-zinc-200 dark:border-[#262626] overflow-hidden select-none cursor-grab active:cursor-grabbing"
            @mousedown="onGraphMouseDown"
          >
            <!-- Background Grid dots pattern -->
            <div
              class="absolute inset-0 opacity-20 pointer-events-none"
              style="background-image: radial-gradient(rgba(150, 150, 150, 0.4) 1px, transparent 1px); background-size: 20px 20px;"
            />

            <!-- Zoomable & Pannable Group -->
            <div
              class="absolute top-0 left-0 transition-transform duration-75 origin-top-left"
              :style="{
                transform: `translate(${panX}px, ${panY}px) scale(${zoomLevel})`,
              }"
            >
              <!-- Connecting SVG Bezier Edges -->
              <svg class="absolute top-0 left-0 w-[4000px] h-[3000px] pointer-events-none z-0">
                <path
                  v-for="edge in graphData.edges"
                  :key="edge.id"
                  :d="calculateBezierCurve(edge.fromX || 0, edge.fromY || 0, edge.toX || 0, edge.toY || 0)"
                  fill="none"
                  stroke="currentColor"
                  class="text-zinc-300 dark:text-zinc-700"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>

              <!-- Node Cards Elements -->
              <div
                v-for="node in graphData.nodes"
                :key="node.id"
                class="interactive-node absolute w-60 rounded-xl bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-[#2e2e32] shadow-sm overflow-hidden z-10 transition-shadow hover:shadow-md cursor-pointer"
                :style="{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                }"
                @click.stop="selectedGraphNode = node"
              >
                <!-- Node Header -->
                <div class="px-3 py-2 bg-zinc-100/70 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-[#2e2e32] flex items-center justify-between gap-1">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class="text-xs font-semibold text-[var(--text-primary)] truncate font-mono">{{ node.label }}</span>
                  </div>
                  <Badge
                    :variant="node.type === 'object' ? 'primary' : node.type === 'array' ? 'secondary' : 'outline'"
                    size="sm"
                    class="font-mono text-[9px] uppercase px-1.5 py-0"
                  >
                    {{ node.type }}{{ node.itemCount !== undefined ? `[${node.itemCount}]` : '' }}
                  </Badge>
                </div>

                <!-- Node Property List -->
                <div class="p-2 space-y-1 max-h-40 overflow-y-auto">
                  <div
                    v-for="prop in node.properties"
                    :key="prop.key"
                    class="flex items-center justify-between text-[11px] font-mono px-1.5 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                  >
                    <span class="text-[var(--text-secondary)] truncate mr-2">{{ prop.key }}</span>
                    <span
                      class="text-[10px] shrink-0 font-medium"
                      :class="
                        prop.type === 'string' ? 'text-sky-500' :
                        prop.type === 'number' ? 'text-amber-500' :
                        prop.type === 'boolean' ? 'text-emerald-500' :
                        prop.type === 'array' ? 'text-violet-500 font-semibold' : 'text-indigo-400 font-semibold'
                      "
                    >
                      {{ prop.valuePreview }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Floating Inspector on Clicked Node -->
            <div
              v-if="selectedGraphNode"
              class="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-80 p-3 bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-md rounded-xl border border-zinc-200 dark:border-[#2e2e32] shadow-lg text-xs space-y-2 z-20"
            >
              <div class="flex items-center justify-between">
                <span class="font-semibold text-[var(--text-primary)] font-mono">{{ selectedGraphNode.label }}</span>
                <button
                  type="button"
                  class="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-0.5"
                  @click="selectedGraphNode = null"
                >
                  ✕
                </button>
              </div>
              <div class="flex items-center justify-between font-mono text-[11px] text-[var(--text-secondary)]">
                <span>Path: {{ selectedGraphNode.path }}</span>
                <button
                  type="button"
                  class="text-xs text-sky-500 hover:underline cursor-pointer"
                  @click="copyJsonPath(selectedGraphNode.path)"
                >
                  Copy Path
                </button>
              </div>
            </div>

            <!-- Error Out-of-sync Banner Overlay -->
            <div
              v-if="validationError && jsonInput.trim()"
              class="absolute inset-0 bg-zinc-950/75 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center z-30 select-text"
            >
              <div class="p-3 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 mb-2.5">
                <WarningTriangle class="w-6 h-6" />
              </div>
              <p class="text-sm font-semibold text-white">Invalid JSON Payload</p>
              <p class="text-xs text-rose-400 mt-1 max-w-sm font-mono truncate">{{ validationError }}</p>
              <p class="text-[11px] text-zinc-400 mt-2 max-w-sm">
                Kanvas grafik hanya merender JSON valid (diawali kurung kurawal <code class="text-zinc-200">{ }</code> atau array <code class="text-zinc-200">[ ]</code>).
              </p>
              <button
                type="button"
                class="mt-3.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors cursor-pointer"
                @click="attemptAutoFix"
              >
                Coba Auto-Fix Syntax
              </button>
            </div>

            <!-- Empty State Overlay -->
            <div
              v-else-if="!jsonInput.trim() || graphData.nodes.length === 0"
              class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10"
            >
              <Tree class="w-8 h-8 text-[var(--text-tertiary)] mb-2" />
              <p class="text-sm font-semibold text-[var(--text-primary)]">No Graph to Display</p>
              <p class="text-xs text-[var(--text-tertiary)] mt-1">Paste valid JSON in the editor to visualize the node graph.</p>
            </div>
          </div>
        </div>

        <!-- ─── VIEW 3: TREE EXPLORER (JSON Hero Style) ─────────────────── -->
        <div v-else-if="activeView === 'tree'" class="space-y-3">
          <!-- Tree Search & Expand Controls -->
          <div class="flex items-center justify-between gap-3 pb-2 border-b border-zinc-200 dark:border-[#262626]">
            <!-- Search Filter -->
            <div class="relative flex-1 max-w-xs">
              <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
              <input
                v-model="treeSearchQuery"
                type="text"
                placeholder="Search key or value..."
                class="w-full pl-8 pr-3 py-1 bg-zinc-50 dark:bg-[#101012] border border-zinc-200 dark:border-[#2E2E2E] rounded-lg text-xs font-mono text-[var(--text-primary)] focus:outline-none"
              />
            </div>

            <!-- Expand / Collapse All -->
            <div class="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                class="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-[#2E2E2E] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-colors cursor-pointer"
                @click="expandAllTree"
              >
                Expand All
              </button>
              <button
                type="button"
                class="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-[#2E2E2E] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-colors cursor-pointer"
                @click="collapseAllTree"
              >
                Collapse All
              </button>
            </div>
          </div>

          <!-- Tree Recursive Node List -->
          <div class="p-3 bg-zinc-50/70 dark:bg-[#0c0c0e] rounded-xl border border-zinc-200 dark:border-[#262626] font-mono text-xs max-h-[500px] overflow-y-auto space-y-2">
            <template v-if="parsedJson">
              <div v-if="filteredTreeNodes.length === 0" class="text-center py-10 text-[var(--text-tertiary)]">
                <Search class="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p>Tidak ada key atau value yang cocok dengan "{{ treeSearchQuery }}"</p>
                <button
                  type="button"
                  class="mt-2 text-xs text-sky-500 hover:underline cursor-pointer"
                  @click="treeSearchQuery = ''"
                >
                  Reset Filter
                </button>
              </div>

              <div
                v-for="node in filteredTreeNodes"
                :key="node.id"
                class="p-2.5 bg-white dark:bg-[#151518] border border-zinc-200 dark:border-[#242428] rounded-xl space-y-1.5 transition-all shadow-2xs"
                :style="{ marginLeft: `${node.depth * 14}px` }"
              >
                <!-- Node Header (Clickable to Collapse / Expand) -->
                <div class="flex items-center justify-between gap-2">
                  <div
                    class="flex items-center gap-1.5 min-w-0 cursor-pointer select-none group"
                    @click="toggleNodeCollapse(node.id)"
                  >
                    <button
                      type="button"
                      class="p-0.5 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] transition-transform"
                      :title="collapsedNodeIds[node.id] ? 'Expand' : 'Collapse'"
                    >
                      <NavArrowRight v-if="collapsedNodeIds[node.id]" class="w-3.5 h-3.5" />
                      <NavArrowDown v-else class="w-3.5 h-3.5" />
                    </button>
                    <span class="font-semibold text-[var(--text-primary)] hover:underline truncate">{{ node.label }}</span>
                    <Badge variant="secondary" size="sm" class="font-mono text-[9px] px-1.5 py-0">
                      {{ node.type }}{{ node.itemCount !== undefined ? ` (${node.itemCount})` : '' }}
                    </Badge>
                  </div>
                  <button
                    type="button"
                    class="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    title="Copy JSONPath"
                    @click="copyJsonPath(node.path)"
                  >
                    <span class="font-mono truncate max-w-[140px]">{{ node.path }}</span>
                    <Copy class="w-3 h-3" />
                  </button>
                </div>

                <!-- Properties within this branch (Collapsible) -->
                <div
                  v-show="!collapsedNodeIds[node.id]"
                  class="pl-3 border-l-2 border-zinc-200 dark:border-zinc-800/80 space-y-0.5 mt-1.5"
                >
                  <div
                    v-if="node.properties.length === 0"
                    class="text-[11px] text-[var(--text-tertiary)] italic py-0.5"
                  >
                    (Empty {{ node.type }})
                  </div>
                  <div
                    v-for="p in node.properties"
                    :key="p.key"
                    class="flex items-center justify-between text-[11px] py-1 px-1.5 rounded hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                  >
                    <div class="flex items-center gap-1.5 truncate mr-2">
                      <span class="text-[var(--text-secondary)]">{{ p.key }}:</span>
                    </div>
                    <span
                      class="truncate font-mono text-right"
                      :class="
                        p.type === 'string' ? 'text-sky-500' :
                        p.type === 'number' ? 'text-amber-500' :
                        p.type === 'boolean' ? 'text-emerald-500' :
                        'text-indigo-400 font-semibold'
                      "
                    >
                      {{ p.valuePreview }}
                    </span>
                  </div>
                </div>
              </div>
            </template>
            <div v-else class="text-center py-12 text-[var(--text-tertiary)]">
              No JSON data to display.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
