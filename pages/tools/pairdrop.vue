<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
  Antenna as Radio,
  SmartphoneDevice as Smartphone,
  Laptop,
  PenTablet as Tablet,
  ShareAndroid as Share2,
  QrCode,
  Copy,
  Check,
  Send,
  Download,
  Xmark as X,
  PageUp as FileUp,
  Page as FileText,
  WarningCircle as AlertCircle,
  Refresh as RefreshCw,
  MediaImage as ImageIcon,
  ShieldCheck,
  Camera,
  Hashtag as Hash,
  EditPencil as Edit,
} from '@iconoir/vue'
import jsQR from 'jsqr'
import { usePairDrop, type PeerDevice } from '~/composables/usePairDrop'
import { useArtisticQr } from '~/composables/useArtisticQr'
import { useClipboard } from '~/composables/useClipboard'
import { useToast } from '~/composables/useToast'
import Button from '~/components/ui/Button.vue'
import Badge from '~/components/ui/Badge.vue'
import Modal from '~/components/ui/Modal.vue'

const toast = useToast()
const { copy } = useClipboard()
const { generateArtisticSvg } = useArtisticQr()

const {
  isConnected,
  isConnecting,
  currentRoom,
  peers,
  myPeerId,
  myPeerName,
  deviceType: myDeviceType,
  os: myOs,
  activeTransfer,
  incomingRequest,
  incomingText,
  connect,
  setMyName,
  randomizeMyName,
  sendFile,
  sendText,
  acceptIncoming,
  rejectIncoming,
  cancelTransfer,
  closeIncomingText,
  onPeerJoined,
} = usePairDrop()

// Modals State
const showPairModal = ref(false)
const pairTab = ref<'qr' | 'scan' | 'code'>('qr')
const showRoomModal = ref(false)
const showSendTextModal = ref(false)

const targetPeerForText = ref<PeerDevice | null>(null)
const textToSend = ref('')
const newRoomInput = ref('')
const roomCodeInput = ref('')
const isEditingName = ref(false)
const editNameInput = ref('')

// Camera Scanner state
const scannerVideoRef = ref<HTMLVideoElement | null>(null)
const scannerCanvasRef = ref<HTMLCanvasElement | null>(null)
const isScanning = ref(false)
const cameraError = ref('')
let mediaStream: MediaStream | null = null
let scanAnimFrame: number | null = null

// Pair modal controls
const openPairModal = (tab: 'qr' | 'scan' | 'code' = 'qr') => {
  pairTab.value = tab
  showPairModal.value = true
  if (tab === 'scan') {
    startCameraScanner()
  } else {
    stopCameraScanner()
  }
}

const switchPairTab = (tab: 'qr' | 'scan' | 'code') => {
  pairTab.value = tab
  if (tab === 'scan') {
    startCameraScanner()
  } else {
    stopCameraScanner()
  }
}

const closePairModal = () => {
  stopCameraScanner()
  showPairModal.value = false
}

// Auto-close pairing modals when a peer joins or incoming request arrives
onPeerJoined((peer) => {
  if (showPairModal.value || showRoomModal.value) {
    closePairModal()
    showRoomModal.value = false
    toast.success('Device Connected', `${peer.name} joined the room!`)
  } else {
    toast.info('New Device Connected', `${peer.name} joined the room`)
  }
})

watch(
  () => peers.value.length,
  (newCount, oldCount) => {
    if (newCount > oldCount && (showPairModal.value || showRoomModal.value)) {
      const newlyJoined = peers.value[peers.value.length - 1]
      closePairModal()
      showRoomModal.value = false
      toast.success('Device Connected', `${newlyJoined?.name || 'New device'} joined the room!`)
    }
  }
)

// Ensure incoming file request is never blocked behind open dialogs
watch(
  () => incomingRequest.value,
  (req) => {
    if (req) {
      closePairModal()
      showRoomModal.value = false
      showSendTextModal.value = false
    }
  }
)

// Hidden File Input
const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedTargetPeer = ref<PeerDevice | null>(null)

// Drag and drop state
const dragTargetPeerId = ref<string | null>(null)

// Copy URL helper
const copiedUrl = ref(false)
const currentShareUrl = computed(() => {
  if (typeof window === 'undefined') return ''
  const base = window.location.origin + window.location.pathname
  return currentRoom.value && currentRoom.value !== 'auto'
    ? `${base}?room=${encodeURIComponent(currentRoom.value)}`
    : base
})

// QR Code SVG for Pairing
const pairingQrSvg = computed(() => {
  if (!currentShareUrl.value) return ''
  return generateArtisticSvg({
    text: currentShareUrl.value,
    style: 'default',
    anchorStyle: 'rounded',
    fgColor: '#FFFFFF',
    bgColor: '#141416',
    size: 240,
    margin: 2,
    dotScale: 0.9,
  })
})

const copyShareUrl = async () => {
  await copy(currentShareUrl.value)
  copiedUrl.value = true
  toast.success('Link Copied', 'Share this URL with devices to join the same room')
  setTimeout(() => {
    copiedUrl.value = false
  }, 2000)
}

// Camera QR Scanner Handler
const qrImageInputRef = ref<HTMLInputElement | null>(null)
let lastScanTimestamp = 0

const startCameraScanner = async () => {
  cameraError.value = ''
  isScanning.value = true

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    })
    mediaStream = stream

    await nextTick()

    if (scannerVideoRef.value) {
      scannerVideoRef.value.srcObject = stream
      scannerVideoRef.value.setAttribute('playsinline', 'true')
      await scannerVideoRef.value.play()
      lastScanTimestamp = 0
      scanAnimFrame = requestAnimationFrame(scanVideoFrame)
    }
  } catch (err: any) {
    console.error('Camera error:', err)
    isScanning.value = false
    cameraError.value = err.name === 'NotAllowedError'
      ? 'Camera access denied. Please allow camera permissions in your browser or select a photo of the QR code.'
      : 'Unable to access camera on this device. You can select a QR photo or join with a room code.'
  }
}

const stopCameraScanner = () => {
  isScanning.value = false
  if (scanAnimFrame) {
    cancelAnimationFrame(scanAnimFrame)
    scanAnimFrame = null
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop())
    mediaStream = null
  }
}

const handleScannedCode = (scannedRaw: string) => {
  const trimmed = scannedRaw.trim()
  let targetRoom = trimmed

  try {
    const parsedUrl = new URL(trimmed)
    const roomParam = parsedUrl.searchParams.get('room')
    if (roomParam) {
      targetRoom = roomParam
    }
  } catch {
    // Plain text room code
  }

  if (targetRoom) {
    closePairModal()
    connect(targetRoom)
    toast.success('Room Joined', `Connected to room: ${targetRoom}`)
  }
}

const scanVideoFrame = () => {
  if (!isScanning.value || !scannerVideoRef.value || !scannerCanvasRef.value) return
  const video = scannerVideoRef.value

  const now = performance.now()
  // Throttle jsQR scanning to ~8-10 scans/sec
  if (now - lastScanTimestamp >= 100 && video.readyState >= 2 && video.videoWidth > 0) {
    lastScanTimestamp = now
    const canvas = scannerCanvasRef.value
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    if (ctx) {
      const maxDim = 640
      let w = video.videoWidth
      let h = video.videoHeight
      if (w > maxDim || h > maxDim) {
        const scale = Math.min(maxDim / w, maxDim / h)
        w = Math.floor(w * scale)
        h = Math.floor(h * scale)
      }

      if (canvas.width !== w) canvas.width = w
      if (canvas.height !== h) canvas.height = h

      ctx.drawImage(video, 0, 0, w, h)
      const imageData = ctx.getImageData(0, 0, w, h)

      const code = jsQR(imageData.data, w, h, {
        inversionAttempts: 'attemptBoth',
      })

      if (code && code.data) {
        handleScannedCode(code.data)
        return
      }
    }
  }

  scanAnimFrame = requestAnimationFrame(scanVideoFrame)
}

// Upload & scan QR image from device gallery / files
const onQrImageUploaded = (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    const img = new window.Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      const maxDim = 1024
      let w = img.width
      let h = img.height
      if (w > maxDim || h > maxDim) {
        const scale = Math.min(maxDim / w, maxDim / h)
        w = Math.floor(w * scale)
        h = Math.floor(h * scale)
      }

      canvas.width = w
      canvas.height = h
      ctx.drawImage(img, 0, 0, w, h)
      const imageData = ctx.getImageData(0, 0, w, h)

      const code = jsQR(imageData.data, w, h, {
        inversionAttempts: 'attemptBoth',
      })

      if (code && code.data) {
        handleScannedCode(code.data)
      } else {
        toast.error('Scan Failed', 'Could not detect a valid QR code in this image')
      }
    }
    img.src = reader.result as string
  }
  reader.readAsDataURL(file)
}

// Join Code Handler
const submitJoinCode = () => {
  const code = roomCodeInput.value.trim().toUpperCase()
  if (!code) return
  connect(code)
  closePairModal()
  roomCodeInput.value = ''
  toast.success('Room Joined', `Connected to room #${code}`)
}

const generateRandomRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let randomCode = ''
  for (let i = 0; i < 6; i++) {
    randomCode += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  roomCodeInput.value = randomCode
}

// Device Icon Resolver
const getDeviceIcon = (type: string) => {
  switch (type) {
    case 'mobile':
      return Smartphone
    case 'tablet':
      return Tablet
    default:
      return Laptop
  }
}

// File Pick & Drop Triggers
const triggerFileSelect = (peer: PeerDevice) => {
  selectedTargetPeer.value = peer
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
    fileInputRef.value.click()
  }
}

const onFileSelected = (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file && selectedTargetPeer.value) {
    sendFile(selectedTargetPeer.value, file)
  }
}

// Drag & Drop on Peer Node
const onDragOverPeer = (e: DragEvent, peerId: string) => {
  e.preventDefault()
  dragTargetPeerId.value = peerId
}

const onDragLeavePeer = () => {
  dragTargetPeerId.value = null
}

const onDropOnPeer = (e: DragEvent, peer: PeerDevice) => {
  e.preventDefault()
  dragTargetPeerId.value = null
  const file = e.dataTransfer?.files?.[0]
  if (file) {
    sendFile(peer, file)
  }
}

// Text Message Modal trigger
const openSendText = (peer: PeerDevice) => {
  targetPeerForText.value = peer
  textToSend.value = ''
  showSendTextModal.value = true
}

const submitSendText = () => {
  if (targetPeerForText.value && textToSend.value.trim()) {
    sendText(targetPeerForText.value, textToSend.value)
    showSendTextModal.value = false
    textToSend.value = ''
  }
}

// Room Management
const openRoomSwitcher = () => {
  newRoomInput.value = currentRoom.value === 'auto' ? '' : currentRoom.value
  showRoomModal.value = true
}

const joinRoom = () => {
  const room = newRoomInput.value.trim()
  connect(room || 'auto')
  showRoomModal.value = false
  toast.success('Room Updated', room ? `Joined Room: ${room}` : 'Switched to Auto Wi-Fi Network')
}

// Name Editing
const startEditName = () => {
  editNameInput.value = myPeerName.value
  isEditingName.value = true
}

const saveName = () => {
  if (editNameInput.value.trim()) {
    setMyName(editNameInput.value)
  }
  isEditingName.value = false
}

// Format helpers
const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const formatSpeed = (bytesPerSec: number): string => {
  return `${formatSize(bytesPerSec)}/s`
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search)
    const roomParam = urlParams.get('room')
    if (roomParam) {
      connect(roomParam)
    }
  }
})

onUnmounted(() => {
  stopCameraScanner()
})
</script>

<template>
  <div class="space-y-6 pb-12 w-full">
    <!-- Hidden native file input -->
    <input
      ref="fileInputRef"
      type="file"
      class="hidden"
      @change="onFileSelected"
    />

    <!-- Header & Breadcrumbs -->
    <div>
      <div class="flex items-center gap-2 text-xs text-[var(--text-tertiary)] mb-1">
        <NuxtLink to="/" class="hover:text-[var(--text-primary)] transition-colors">
          Dashboard
        </NuxtLink>
        <span>/</span>
        <span class="text-[var(--text-secondary)] font-medium">Media Tools</span>
        <span>/</span>
        <span class="text-[var(--text-primary)]">PairDrop</span>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            PairDrop
          </h1>
          <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Direct, encrypted peer-to-peer file & text transfer over local Wi-Fi. No file size limits, zero server storage.
          </p>
        </div>
      </div>
    </div>

    <!-- Top Action Bar (Room status + 2 Distinct Primary Actions) -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-[#171717] border border-zinc-200 dark:border-[var(--border-subtle)] rounded-xl">
      <!-- Room Info -->
      <div class="flex items-center gap-2.5 text-xs">
        <div class="p-1.5 rounded-lg bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-[var(--text-secondary)]">
          <Radio class="w-4 h-4 text-[var(--text-primary)]" />
        </div>
        <div>
          <div class="text-[11px] text-[var(--text-tertiary)]">Active Network / Room</div>
          <div class="font-semibold text-[var(--text-primary)] flex items-center gap-1.5 font-mono">
            <span>{{ currentRoom === 'auto' ? 'Local Wi-Fi (Auto)' : `Room #${currentRoom}` }}</span>
            <button
              type="button"
              class="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] underline cursor-pointer ml-1"
              @click="openRoomSwitcher"
            >
              Change
            </button>
          </div>
        </div>
      </div>

      <!-- Single Primary Action + Single Share Action -->
      <div class="flex items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          class="text-xs font-semibold cursor-pointer"
          @click="openPairModal('qr')"
        >
          <QrCode class="w-3.5 h-3.5 mr-1.5" />
          <span>Pair Device</span>
        </Button>

        <Button
          size="sm"
          variant="secondary"
          class="text-xs cursor-pointer"
          @click="copyShareUrl"
        >
          <Check v-if="copiedUrl" class="w-3.5 h-3.5 mr-1.5 text-current" />
          <Share2 v-else class="w-3.5 h-3.5 mr-1.5 text-current" />
          <span>{{ copiedUrl ? 'Copied' : 'Share Link' }}</span>
        </Button>
      </div>
    </div>

    <!-- Mobile Sticky Incoming Request Alert Bar (Guaranteed Visibility on Mobile Viewports) -->
    <div
      v-if="incomingRequest"
      class="sm:hidden fixed top-3 inset-x-3 z-[90] p-4 rounded-2xl bg-white/95 dark:bg-[#18181b]/95 border border-zinc-300 dark:border-white/20 shadow-2xl backdrop-blur-md animate-in slide-in-from-top duration-200"
    >
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/10 flex items-center justify-center shrink-0">
          <FileText class="w-5 h-5 text-zinc-900 dark:text-white" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Incoming Transfer</div>
          <div class="text-xs font-bold text-zinc-900 dark:text-white truncate">{{ incomingRequest.file.name }}</div>
          <div class="text-[11px] text-[var(--text-secondary)] mt-0.5">
            {{ formatSize(incomingRequest.file.size) }} • From {{ incomingRequest.fromPeer.name }}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2 mt-3 pt-2 border-t border-zinc-200 dark:border-white/10">
        <Button variant="secondary" size="sm" class="flex-1 text-xs cursor-pointer" @click="rejectIncoming">
          Decline
        </Button>
        <Button variant="primary" size="sm" class="flex-1 text-xs font-bold cursor-pointer" @click="acceptIncoming">
          Accept & Download
        </Button>
      </div>
    </div>

    <!-- Central Orbital Radar Arena -->
    <div class="relative w-full rounded-[14px] border border-zinc-200 dark:border-[#212121] bg-white dark:bg-[#121214] shadow-xs overflow-hidden min-h-[440px] sm:min-h-[500px] flex flex-col justify-between p-6 sm:p-10 select-none">
      <!-- Background Concentric Orbital Rings (Subtle & Anti-AI-Slop) -->
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-15">
        <div class="w-[260px] h-[260px] sm:w-[340px] sm:h-[340px] rounded-full border border-zinc-400 dark:border-white" />
        <div class="absolute w-[380px] h-[380px] sm:w-[480px] sm:h-[480px] rounded-full border border-zinc-300 dark:border-white/50" />
        <div class="absolute w-[520px] h-[520px] sm:w-[640px] sm:h-[640px] rounded-full border border-zinc-200 dark:border-white/20" />
      </div>

      <!-- Top Radar Status Notice -->
      <div class="relative z-10 flex items-center justify-between text-xs text-[var(--text-tertiary)]">
        <div class="flex items-center gap-2 font-mono">
          <span>{{ peers.length }} {{ peers.length === 1 ? 'device' : 'devices' }} discovered</span>
        </div>
        <div class="hidden sm:block text-[11px]">
          Tap "Send File" or drop files directly onto any device
        </div>
      </div>

      <!-- Center Discovered Devices Area -->
      <div class="relative z-10 my-auto py-8">
        <!-- Empty Discovered State -->
        <div v-if="peers.length === 0" class="text-center max-w-sm mx-auto space-y-4">
          <div class="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-[#1c1c1f] border border-zinc-200 dark:border-[#2e2e32] flex items-center justify-center mx-auto text-[var(--text-secondary)] shadow-xs">
            <Radio class="w-8 h-8 text-zinc-500 dark:text-white/60 animate-pulse" />
          </div>
          <div>
            <h3 class="text-sm font-semibold text-zinc-900 dark:text-white">
              Scanning for Nearby Devices
            </h3>
            <p class="text-xs text-[var(--text-secondary)] mt-1 max-w-xs mx-auto">
              Open PairDrop on your phone, tablet, or laptop on the same network or scan the pairing QR code.
            </p>
          </div>
        </div>

        <!-- Discovered Peer Nodes Grid / Orbit -->
        <div v-else class="flex flex-wrap items-center justify-center gap-4 sm:gap-6 max-w-4xl mx-auto">
          <div
            v-for="peer in peers"
            :key="peer.peerId"
            class="group relative flex flex-col items-center justify-between p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer w-[150px] sm:w-[180px] min-h-[190px]"
            :class="[
              dragTargetPeerId === peer.peerId
                ? 'bg-zinc-100 dark:bg-white/10 border-zinc-900 dark:border-white scale-105 shadow-[0_0_20px_rgba(0,0,0,0.1)] dark:shadow-[0_0_20px_rgba(255,255,255,0.15)]'
                : 'bg-zinc-50 dark:bg-[#18181b] border-zinc-200 dark:border-[#2e2e32] hover:border-zinc-400 dark:hover:border-white/50 hover:bg-zinc-100/80 dark:hover:bg-[#202024] shadow-xs'
            ]"
            @click="triggerFileSelect(peer)"
            @dragover="onDragOverPeer($event, peer.peerId)"
            @dragleave="onDragLeavePeer"
            @drop="onDropOnPeer($event, peer)"
          >
            <!-- Top bar inside card: OS indicator & Send Note icon -->
            <div class="w-full flex items-center justify-between text-[10px] text-[var(--text-tertiary)] uppercase font-mono tracking-wider">
              <span class="px-1.5 py-0.5 rounded bg-zinc-200/60 dark:bg-white/10 text-zinc-700 dark:text-white/80">
                {{ peer.os }}
              </span>
              <button
                type="button"
                class="p-1 rounded-md text-[var(--text-tertiary)] hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/80 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Send Note"
                @click.stop="openSendText(peer)"
              >
                <Send class="w-3 h-3" />
              </button>
            </div>

            <!-- Device Avatar & Name -->
            <div class="flex flex-col items-center text-center my-2">
              <div class="relative w-12 h-12 rounded-xl bg-zinc-200/60 dark:bg-white/10 border border-zinc-300/60 dark:border-white/20 flex items-center justify-center text-zinc-900 dark:text-white mb-2 transition-transform group-hover:scale-105">
                <component :is="getDeviceIcon(peer.deviceType)" class="w-6 h-6" />
              </div>

              <span class="text-xs font-bold text-zinc-900 dark:text-white truncate max-w-[130px] sm:max-w-[150px]">
                {{ peer.name }}
              </span>
              <span class="text-[10px] text-[var(--text-tertiary)] capitalize mt-0.5">
                {{ peer.deviceType }}
              </span>
            </div>

            <!-- Single, Unambiguous Action Button (No Duplicate Buttons) -->
            <Button
              size="sm"
              variant="secondary"
              class="w-full text-xs font-semibold h-8 rounded-lg mt-1 cursor-pointer flex items-center justify-center"
              @click.stop="triggerFileSelect(peer)"
            >
              <FileUp class="w-3.5 h-3.5 mr-1.5" />
              <span>Send File</span>
            </Button>
          </div>
        </div>
      </div>

      <!-- Bottom "You" Center Node Card -->
      <div class="relative z-10 pt-4 border-t border-zinc-200 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-black font-bold flex items-center justify-center shrink-0 shadow-xs">
            <component :is="getDeviceIcon(myDeviceType)" class="w-5 h-5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">You</span>
              <span class="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-white/80 border border-zinc-200 dark:border-transparent uppercase">{{ myOs }}</span>
            </div>

            <!-- Name with in-place rename -->
            <div v-if="!isEditingName" class="flex items-center gap-2">
              <span class="text-sm font-bold text-zinc-900 dark:text-white">{{ myPeerName }}</span>
              <button
                type="button"
                class="text-[11px] text-[var(--text-tertiary)] hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                title="Rename device"
                @click="startEditName"
              >
                <Edit class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                class="text-[11px] text-[var(--text-tertiary)] hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                title="Randomize name"
                @click="randomizeMyName"
              >
                <RefreshCw class="w-3 h-3" />
              </button>
            </div>

            <!-- Editing input -->
            <div v-else class="flex items-center gap-1.5 mt-0.5">
              <input
                v-model="editNameInput"
                type="text"
                maxlength="25"
                class="bg-zinc-50 dark:bg-[#222] border border-zinc-300 dark:border-white/20 rounded px-2 py-0.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-500 dark:focus:border-white"
                @keyup.enter="saveName"
              />
              <Button size="sm" variant="primary" class="text-xs px-2 py-0.5 h-6 cursor-pointer" @click="saveName">
                Save
              </Button>
            </div>
          </div>
        </div>

        <div class="text-xs text-[var(--text-secondary)] flex items-center gap-2">
          <ShieldCheck class="w-4 h-4 text-zinc-500 dark:text-white/60 shrink-0" />
          <span>Direct P2P Encrypted Transfer</span>
        </div>
      </div>
    </div>

    <!-- Active Transfer Progress Floating Drawer -->
    <div
      v-if="activeTransfer"
      class="fixed bottom-6 right-6 z-50 w-[90vw] sm:w-[380px] p-4 rounded-2xl bg-white dark:bg-[#1b1b1e] border border-zinc-200 dark:border-white/20 shadow-2xl space-y-3 backdrop-blur-md animate-in slide-in-from-bottom duration-200"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white flex items-center justify-center shrink-0">
            <FileUp v-if="activeTransfer.direction === 'send'" class="w-4 h-4 text-current" />
            <Download v-else class="w-4 h-4 text-current" />
          </div>
          <div class="min-w-0">
            <div class="text-xs font-bold text-zinc-900 dark:text-white truncate">
              {{ activeTransfer.direction === 'send' ? 'Sending' : 'Receiving' }}: {{ activeTransfer.fileName }}
            </div>
            <div class="text-[11px] text-[var(--text-tertiary)] truncate">
              {{ activeTransfer.direction === 'send' ? 'To' : 'From' }} {{ activeTransfer.peerName }} • {{ formatSize(activeTransfer.fileSize) }}
            </div>
          </div>
        </div>

        <button
          type="button"
          class="text-zinc-400 hover:text-zinc-900 dark:text-white/60 dark:hover:text-white p-1 cursor-pointer"
          @click="cancelTransfer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Progress bar -->
      <div class="space-y-1">
        <div class="h-2 w-full rounded-full bg-zinc-100 dark:bg-white/10 overflow-hidden">
          <div
            class="h-full bg-zinc-900 dark:bg-white rounded-full transition-all duration-150"
            :style="{ width: `${activeTransfer.progress}%` }"
          />
        </div>
        <div class="flex items-center justify-between text-[11px] font-mono text-[var(--text-tertiary)]">
          <span>{{ activeTransfer.progress }}%</span>
          <span>{{ formatSpeed(activeTransfer.speed) }}</span>
        </div>
      </div>
    </div>

    <!-- Incoming File Transfer Consent Modal (Desktop & Tablet) -->
    <Modal
      :model-value="!!incomingRequest"
      title="Incoming File Transfer"
      @close="rejectIncoming"
    >
      <div v-if="incomingRequest" class="space-y-4">
        <div class="p-4 rounded-xl bg-zinc-50 dark:bg-[#141416] border border-zinc-200 dark:border-[#282828] flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl bg-zinc-200/60 dark:bg-white/10 border border-zinc-300/60 dark:border-white/20 flex items-center justify-center shrink-0">
            <FileText class="w-6 h-6 text-zinc-900 dark:text-white" />
          </div>
          <div class="min-w-0">
            <div class="text-sm font-bold text-zinc-900 dark:text-white truncate">{{ incomingRequest.file.name }}</div>
            <div class="text-xs text-[var(--text-secondary)] mt-0.5">
              Size: {{ formatSize(incomingRequest.file.size) }}
            </div>
            <div class="text-[11px] text-[var(--text-tertiary)] mt-0.5">
              Sent by <strong class="text-zinc-900 dark:text-white">{{ incomingRequest.fromPeer.name }}</strong> ({{ incomingRequest.fromPeer.os }})
            </div>
          </div>
        </div>

        <p class="text-xs text-[var(--text-secondary)] leading-relaxed">
          The file will transfer directly to your device via WebRTC and download to your local storage.
        </p>

        <div class="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" class="cursor-pointer" @click="rejectIncoming">
            Decline
          </Button>
          <Button variant="primary" class="font-bold cursor-pointer" @click="acceptIncoming">
            Accept & Download
          </Button>
        </div>
      </div>
    </Modal>

    <!-- Consolidated Pair Devices Modal (Show QR, Scan Camera, Room Code Tabs) -->
    <Modal
      v-model="showPairModal"
      title="Pair Devices"
      max-width="md"
      @close="closePairModal"
    >
      <div class="space-y-4">
        <!-- Segmented Tab Navigation -->
        <div class="grid grid-cols-3 gap-1 p-1 bg-zinc-100 dark:bg-white/5 rounded-xl border border-zinc-200 dark:border-white/10 text-xs">
          <button
            type="button"
            class="py-1.5 rounded-lg font-medium transition-colors cursor-pointer text-center"
            :class="pairTab === 'qr' ? 'bg-white dark:bg-[#222] text-zinc-900 dark:text-white shadow-xs font-semibold' : 'text-[var(--text-secondary)] hover:text-zinc-900 dark:hover:text-white'"
            @click="switchPairTab('qr')"
          >
            Show QR
          </button>
          <button
            type="button"
            class="py-1.5 rounded-lg font-medium transition-colors cursor-pointer text-center"
            :class="pairTab === 'scan' ? 'bg-white dark:bg-[#222] text-zinc-900 dark:text-white shadow-xs font-semibold' : 'text-[var(--text-secondary)] hover:text-zinc-900 dark:hover:text-white'"
            @click="switchPairTab('scan')"
          >
            Scan Camera
          </button>
          <button
            type="button"
            class="py-1.5 rounded-lg font-medium transition-colors cursor-pointer text-center"
            :class="pairTab === 'code' ? 'bg-white dark:bg-[#222] text-zinc-900 dark:text-white shadow-xs font-semibold' : 'text-[var(--text-secondary)] hover:text-zinc-900 dark:hover:text-white'"
            @click="switchPairTab('code')"
          >
            Room Code
          </button>
        </div>

        <!-- Tab 1: Show QR -->
        <div v-if="pairTab === 'qr'" class="space-y-4 text-center flex flex-col items-center">
          <p class="text-xs text-[var(--text-secondary)] max-w-sm">
            Point your smartphone camera at this QR code to automatically open PairDrop and connect.
          </p>

          <div class="p-3 bg-white dark:bg-[#141416] border border-zinc-200 dark:border-[#282828] rounded-2xl flex items-center justify-center shadow-lg">
            <div class="w-[220px] h-[220px] [&>svg]:w-full [&>svg]:h-full" v-html="pairingQrSvg" />
          </div>

          <div class="w-full p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-secondary)] truncate">
            {{ currentShareUrl }}
          </div>

          <div class="flex items-center gap-2 w-full">
            <Button variant="secondary" class="w-full text-xs cursor-pointer" @click="copyShareUrl">
              <Copy class="w-3.5 h-3.5 mr-1.5" />
              Copy Share Link
            </Button>
            <Button variant="primary" class="w-full text-xs cursor-pointer" @click="closePairModal">
              Done
            </Button>
          </div>
        </div>

        <!-- Tab 2: Scan Camera -->
        <div v-else-if="pairTab === 'scan'" class="space-y-4">
          <p class="text-xs text-[var(--text-secondary)]">
            Point your camera at a PairDrop QR code displayed on another device to join instantly.
          </p>

          <div class="relative w-full aspect-square max-w-[300px] mx-auto rounded-2xl bg-black border border-[#2e2e32] overflow-hidden flex items-center justify-center">
            <video
              ref="scannerVideoRef"
              autoplay
              playsinline
              muted
              class="w-full h-full object-cover"
            />
            <canvas
              ref="scannerCanvasRef"
              class="hidden"
            />

            <!-- Reticle Frame -->
            <div v-if="isScanning && !cameraError" class="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
              <div class="relative w-40 h-40 border-2 border-white/60 rounded-2xl flex items-center justify-center">
                <div class="absolute inset-x-2 h-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-pulse top-1/2 -translate-y-1/2" />
                <div class="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-white" />
                <div class="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-white" />
                <div class="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-white" />
                <div class="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-white" />
              </div>
            </div>

            <!-- Error fallback -->
            <div v-if="cameraError" class="absolute inset-0 bg-[#141416]/95 p-6 flex flex-col items-center justify-center text-center space-y-3">
              <AlertCircle class="w-8 h-8 text-white/60" />
              <div class="text-xs text-white/90 leading-relaxed font-medium">
                {{ cameraError }}
              </div>
              <Button size="sm" variant="secondary" class="text-xs cursor-pointer" @click="switchPairTab('code')">
                <Hash class="w-3.5 h-3.5 mr-1.5" />
                Enter Code Manually
              </Button>
            </div>
          </div>

          <input
            ref="qrImageInputRef"
            type="file"
            accept="image/*"
            class="hidden"
            @change="onQrImageUploaded"
          />

          <div class="flex items-center justify-between gap-2 pt-1">
            <Button variant="outline" class="text-xs cursor-pointer" @click="qrImageInputRef?.click()">
              <ImageIcon class="w-3.5 h-3.5 mr-1" />
              Upload QR Image
            </Button>
            <Button variant="secondary" class="text-xs cursor-pointer" @click="closePairModal">
              Close
            </Button>
          </div>
        </div>

        <!-- Tab 3: Room Code -->
        <div v-else class="space-y-4">
          <p class="text-xs text-[var(--text-secondary)]">
            Enter a room code or generate one to connect with devices anywhere, even across different Wi-Fi networks.
          </p>

          <div class="space-y-2">
            <input
              v-model="roomCodeInput"
              type="text"
              maxlength="25"
              placeholder="e.g. 7X9K2 or OFFICE"
              class="w-full p-3 bg-[var(--bg-input)] border border-[var(--border-card)] text-zinc-900 dark:text-white text-center font-mono text-lg font-bold tracking-widest uppercase rounded-xl focus:outline-none focus:border-zinc-400 dark:focus:border-white placeholder:normal-case placeholder:font-normal placeholder:text-sm placeholder:tracking-normal"
              @keyup.enter="submitJoinCode"
            />

            <div class="flex items-center justify-between text-xs text-[var(--text-tertiary)] pt-1">
              <span>Need a fresh room?</span>
              <button
                type="button"
                class="text-xs text-zinc-700 dark:text-white hover:underline cursor-pointer flex items-center gap-1"
                @click="generateRandomRoomCode"
              >
                <RefreshCw class="w-3 h-3" />
                Generate Code
              </button>
            </div>
          </div>

          <div class="p-3 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex items-center justify-between text-xs">
            <div>
              <div class="text-[11px] text-[var(--text-tertiary)]">Current Room</div>
              <div class="font-mono font-bold text-zinc-900 dark:text-white">
                {{ currentRoom === 'auto' ? 'Local Wi-Fi (Auto)' : `#${currentRoom}` }}
              </div>
            </div>
            <Button
              v-if="currentRoom !== 'auto'"
              size="sm"
              variant="outline"
              class="text-xs h-7 px-2 cursor-pointer"
              @click="copy(currentRoom); toast.success('Copied', 'Room code copied to clipboard')"
            >
              <Copy class="w-3 h-3 mr-1" />
              Copy
            </Button>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" class="cursor-pointer" @click="closePairModal">
              Cancel
            </Button>
            <Button variant="primary" class="cursor-pointer" :disabled="!roomCodeInput.trim()" @click="submitJoinCode">
              Join Room
            </Button>
          </div>
        </div>
      </div>
    </Modal>

    <!-- Incoming Text Message Modal -->
    <Modal
      :model-value="!!incomingText"
      title="Received Note / Message"
      @close="closeIncomingText"
    >
      <div v-if="incomingText" class="space-y-4">
        <div class="text-xs text-[var(--text-tertiary)]">
          From <strong class="text-zinc-900 dark:text-white">{{ incomingText.fromPeer.name }}</strong>:
        </div>

        <div class="p-3.5 bg-zinc-50 dark:bg-[#141416] border border-zinc-200 dark:border-[#282828] rounded-xl text-sm font-mono text-zinc-900 dark:text-white select-all break-words max-h-60 overflow-y-auto">
          {{ incomingText.text }}
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="secondary"
            class="cursor-pointer"
            @click="copy(incomingText.text); toast.success('Copied', 'Note copied to clipboard')"
          >
            <Copy class="w-3.5 h-3.5 mr-1.5" />
            Copy to Clipboard
          </Button>
          <Button variant="primary" class="cursor-pointer" @click="closeIncomingText">
            Close
          </Button>
        </div>
      </div>
    </Modal>

    <!-- Send Text Dialog Modal -->
    <Modal
      v-model="showSendTextModal"
      :title="`Send Note to ${targetPeerForText?.name || 'Device'}`"
      @close="showSendTextModal = false"
    >
      <div class="space-y-4">
        <p class="text-xs text-[var(--text-secondary)]">
          Quickly send a text snippet, URL, or clipboard note to the selected device.
        </p>
        <textarea
          v-model="textToSend"
          rows="4"
          placeholder="Paste or type text message here..."
          class="w-full p-3 bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:border-zinc-400 dark:focus:border-white"
        />
        <div class="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" class="cursor-pointer" @click="showSendTextModal = false">
            Cancel
          </Button>
          <Button variant="primary" class="cursor-pointer" :disabled="!textToSend.trim()" @click="submitSendText">
            <Send class="w-3.5 h-3.5 mr-1.5" />
            Send Note
          </Button>
        </div>
      </div>
    </Modal>

    <!-- Room Switcher Modal -->
    <Modal
      v-model="showRoomModal"
      title="Join or Create Custom Room"
      @close="showRoomModal = false"
    >
      <div class="space-y-4">
        <p class="text-xs text-[var(--text-secondary)]">
          Devices on different Wi-Fi networks or public connections can communicate by joining the same room code.
        </p>

        <div class="space-y-1.5">
          <label class="block text-xs text-[var(--text-tertiary)]">Room Code or Name</label>
          <input
            v-model="newRoomInput"
            type="text"
            placeholder="e.g. office-room, studio-77 (Leave blank for auto Wi-Fi)"
            class="w-full p-2.5 bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-primary)] rounded-lg text-sm font-mono focus:outline-none focus:border-white"
            @keyup.enter="joinRoom"
          />
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" class="cursor-pointer" @click="showRoomModal = false">
            Cancel
          </Button>
          <Button variant="primary" class="cursor-pointer" @click="joinRoom">
            Join Room
          </Button>
        </div>
      </div>
    </Modal>
  </div>
</template>