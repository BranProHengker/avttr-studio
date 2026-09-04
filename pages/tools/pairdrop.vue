<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import {
  Wifi,
  WifiOff,
  Radio,
  Smartphone,
  Laptop,
  Tablet,
  Share2,
  QrCode,
  Copy,
  Check,
  Send,
  Download,
  X,
  FileUp,
  FileText,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Zap,
  Users,
  Camera,
  Hash,
  ScanLine,
  KeyRound
} from 'lucide-vue-next'
import jsQR from 'jsqr'
import { usePairDrop, type PeerDevice } from '~/composables/usePairDrop'
import { useArtisticQr } from '~/composables/useArtisticQr'
import { useClipboard } from '~/composables/useClipboard'
import { useToast } from '~/composables/useToast'
import Card from '~/components/ui/Card.vue'
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
} = usePairDrop()

// Modals State
const showQrModal = ref(false)
const showRoomModal = ref(false)
const showSendTextModal = ref(false)
const showScannerModal = ref(false)
const showJoinCodeModal = ref(false)

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

// Hidden File Input
const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedTargetPeer = ref<PeerDevice | null>(null)

// Drag and drop state
const isDraggingOver = ref(false)
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
const startCameraScanner = async () => {
  cameraError.value = ''
  showScannerModal.value = true
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
      scanAnimFrame = requestAnimationFrame(scanVideoFrame)
    }
  } catch (err: any) {
    console.error('Camera error:', err)
    isScanning.value = false
    cameraError.value = err.name === 'NotAllowedError'
      ? 'Camera access was denied. Please allow camera permissions in your browser.'
      : 'Unable to access camera on this device. You can join using a Room Code instead.'
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

const closeScannerModal = () => {
  stopCameraScanner()
  showScannerModal.value = false
}

const scanVideoFrame = () => {
  if (!isScanning.value || !scannerVideoRef.value || !scannerCanvasRef.value) return
  const video = scannerVideoRef.value

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    const canvas = scannerCanvasRef.value
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    if (ctx) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      })

      if (code && code.data) {
        const scannedRaw = code.data.trim()
        let targetRoom = scannedRaw

        try {
          const parsedUrl = new URL(scannedRaw)
          const roomParam = parsedUrl.searchParams.get('room')
          if (roomParam) {
            targetRoom = roomParam
          }
        } catch {
          // Plain text code
        }

        if (targetRoom) {
          closeScannerModal()
          connect(targetRoom)
          toast.success('Room Joined', `Connected to room: ${targetRoom}`)
          return
        }
      }
    }
  }

  scanAnimFrame = requestAnimationFrame(scanVideoFrame)
}

// Join Code Handler
const openJoinCodeModal = () => {
  roomCodeInput.value = ''
  showJoinCodeModal.value = true
}

const submitJoinCode = () => {
  const code = roomCodeInput.value.trim().toUpperCase()
  if (!code) return
  connect(code)
  showJoinCodeModal.value = false
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

// Open Test Peer in New Tab
const openTestPeerTab = () => {
  if (typeof window !== 'undefined') {
    window.open(currentShareUrl.value, '_blank')
  }
}

// Format bytes
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
        <span class="text-[var(--text-secondary)] font-medium">Tools</span>
        <span>/</span>
        <span class="text-[var(--text-primary)]">PairDrop</span>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            PairDrop
          </h1>
          <p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
            Zero-cloud, encrypted peer-to-peer file & text transfer over local Wi-Fi. No file size limits, zero server storage.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <Badge variant="badge">
            WebRTC P2P
          </Badge>
          <Badge variant="secondary">
            Zero Server Bandwidth
          </Badge>
        </div>
      </div>
    </div>

    <!-- Top Action Bar (Room status, Camera scan, Join code, QR pair, Share link) -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#171717] border border-[var(--border-subtle)] rounded-xl">
      <!-- Room Info -->
      <div class="flex items-center gap-2.5 text-xs">
        <div class="p-1.5 rounded-lg bg-white/5 border border-white/10 text-[var(--text-secondary)]">
          <Radio class="w-4 h-4 text-white/80" />
        </div>
        <div>
          <div class="text-[11px] text-[var(--text-tertiary)]">Active Network / Room</div>
          <div class="font-semibold text-white flex items-center gap-1.5 font-mono">
            <span>{{ currentRoom === 'auto' ? 'Local Wi-Fi (Auto)' : `Room #${currentRoom}` }}</span>
            <button
              type="button"
              class="text-[11px] text-[var(--text-tertiary)] hover:text-white underline cursor-pointer ml-1"
              @click="openRoomSwitcher"
            >
              Change
            </button>
          </div>
        </div>
      </div>

      <!-- Quick Action Buttons -->
      <div class="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          class="text-xs font-semibold"
          @click="startCameraScanner"
        >
          <Camera class="w-3.5 h-3.5 mr-1.5 text-black" />
          <span>Scan Camera</span>
        </Button>

        <Button
          size="sm"
          variant="secondary"
          class="text-xs"
          @click="openJoinCodeModal"
        >
          <Hash class="w-3.5 h-3.5 mr-1.5 text-white" />
          <span>Join Code</span>
        </Button>

        <Button
          size="sm"
          variant="secondary"
          class="text-xs"
          @click="showQrModal = true"
        >
          <QrCode class="w-3.5 h-3.5 mr-1.5 text-white" />
          <span>Show QR</span>
        </Button>

        <Button
          size="sm"
          variant="secondary"
          class="text-xs"
          @click="copyShareUrl"
        >
          <Check v-if="copiedUrl" class="w-3.5 h-3.5 mr-1.5 text-white" />
          <Share2 v-else class="w-3.5 h-3.5 mr-1.5 text-white" />
          <span>{{ copiedUrl ? 'Copied' : 'Share Link' }}</span>
        </Button>

        <Button
          size="sm"
          variant="outline"
          class="text-xs hidden lg:inline-flex"
          title="Open a second test peer in another tab"
          @click="openTestPeerTab"
        >
          <ExternalLink class="w-3.5 h-3.5 mr-1.5" />
          <span>2nd Tab</span>
        </Button>
      </div>
    </div>

    <!-- Central Orbital Radar Arena -->
    <div class="relative w-full rounded-[14px] border border-[#212121] bg-[#121214] overflow-hidden min-h-[440px] sm:min-h-[500px] flex flex-col justify-between p-6 sm:p-10 select-none">
      <!-- Background Concentric Orbital Rings Animation -->
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <div class="w-[260px] h-[260px] sm:w-[340px] sm:h-[340px] rounded-full border border-white/20 animate-ping [animation-duration:4s]" />
        <div class="absolute w-[380px] h-[380px] sm:w-[480px] sm:h-[480px] rounded-full border border-white/10" />
        <div class="absolute w-[520px] h-[520px] sm:w-[640px] sm:h-[640px] rounded-full border border-white/5" />
      </div>

      <!-- Top Radar Status Notice -->
      <div class="relative z-10 flex items-center justify-between text-xs text-[var(--text-tertiary)]">
        <div class="flex items-center gap-2 font-mono">
          <span>{{ peers.length }} {{ peers.length === 1 ? 'device' : 'devices' }} discovered</span>
        </div>
        <div class="hidden sm:block text-[11px]">
          Click or drop files onto any device to transfer
        </div>
      </div>

      <!-- Center Discovered Devices Area -->
      <div class="relative z-10 my-auto py-8">
        <!-- Empty Discovered State -->
        <div v-if="peers.length === 0" class="text-center max-w-sm mx-auto space-y-4">
          <div class="w-16 h-16 rounded-2xl bg-[#1c1c1f] border border-[#2e2e32] flex items-center justify-center mx-auto text-[var(--text-secondary)] shadow-sm">
            <Radio class="w-8 h-8 text-white/60 animate-pulse" />
          </div>
          <div>
            <h3 class="text-sm font-semibold text-white">
              Scanning for Nearby Devices
            </h3>
            <p class="text-xs text-[var(--text-secondary)] mt-1">
              Open PairDrop on your phone, tablet, or another laptop connected to the same Wi-Fi network.
            </p>
          </div>
          <div class="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button size="sm" variant="primary" class="text-xs" @click="startCameraScanner">
              <Camera class="w-3.5 h-3.5 mr-1 text-black" />
              Scan Camera
            </Button>
            <Button size="sm" variant="secondary" class="text-xs" @click="openJoinCodeModal">
              <Hash class="w-3.5 h-3.5 mr-1 text-white" />
              Enter Code
            </Button>
            <Button size="sm" variant="secondary" class="text-xs" @click="showQrModal = true">
              <QrCode class="w-3.5 h-3.5 mr-1 text-white" />
              Show QR
            </Button>
          </div>
        </div>

        <!-- Discovered Peer Nodes Grid / Orbit -->
        <div v-else class="flex flex-wrap items-center justify-center gap-4 sm:gap-6 max-w-4xl mx-auto">
          <div
            v-for="peer in peers"
            :key="peer.peerId"
            class="group relative flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer w-[140px] sm:w-[170px]"
            :class="[
              dragTargetPeerId === peer.peerId
                ? 'bg-white/10 border-white scale-105 shadow-[0_0_20px_rgba(255,255,255,0.15)]'
                : 'bg-[#18181b] border-[#2e2e32] hover:border-white/50 hover:bg-[#202024] hover:scale-102 shadow-xs'
            ]"
            @click="triggerFileSelect(peer)"
            @dragover="onDragOverPeer($event, peer.peerId)"
            @dragleave="onDragLeavePeer"
            @drop="onDropOnPeer($event, peer)"
          >
            <!-- Device Avatar Icon -->
            <div class="relative w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white mb-2.5 transition-transform group-hover:scale-110">
              <component :is="getDeviceIcon(peer.deviceType)" class="w-6 h-6" />
            </div>

            <!-- Device Name -->
            <span class="text-xs font-semibold text-white truncate max-w-full text-center group-hover:text-white">
              {{ peer.name }}
            </span>

            <!-- OS & Drop Hint -->
            <div class="flex items-center gap-1 mt-1 text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-mono">
              <span>{{ peer.os }}</span>
              <span>•</span>
              <span>{{ peer.deviceType }}</span>
            </div>

            <!-- Action Quick Tray on Hover -->
            <div class="mt-2.5 flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                class="px-2 py-1 rounded bg-white/10 hover:bg-white text-white hover:text-black text-[11px] font-medium transition-colors cursor-pointer"
                title="Send File"
                @click.stop="triggerFileSelect(peer)"
              >
                Send File
              </button>
              <button
                type="button"
                class="p-1 rounded bg-white/10 hover:bg-white text-white hover:text-black transition-colors cursor-pointer"
                title="Send Text Message"
                @click.stop="openSendText(peer)"
              >
                <Send class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom "You" Center Node Card -->
      <div class="relative z-10 pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-white text-black font-bold flex items-center justify-center shrink-0 shadow-md">
            <component :is="getDeviceIcon(myDeviceType)" class="w-5 h-5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">You</span>
              <span class="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/10 text-white/80 uppercase">{{ myOs }}</span>
            </div>

            <!-- Name with in-place rename -->
            <div v-if="!isEditingName" class="flex items-center gap-2">
              <span class="text-sm font-bold text-white">{{ myPeerName }}</span>
              <button
                type="button"
                class="text-[11px] text-[var(--text-tertiary)] hover:text-white transition-colors cursor-pointer"
                title="Rename device"
                @click="startEditName"
              >
                Edit
              </button>
              <button
                type="button"
                class="text-[11px] text-[var(--text-tertiary)] hover:text-white transition-colors cursor-pointer"
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
                class="bg-[#222] border border-white/20 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-white"
                @keyup.enter="saveName"
              />
              <Button size="sm" variant="primary" class="text-xs px-2 py-0.5 h-6" @click="saveName">
                Save
              </Button>
            </div>
          </div>
        </div>

        <div class="text-xs text-[var(--text-secondary)] flex items-center gap-2">
          <ShieldCheck class="w-4 h-4 text-white/60 shrink-0" />
          <span>End-to-End Direct P2P Encryption</span>
        </div>
      </div>
    </div>

    <!-- Active Transfer Progress Floating Drawer -->
    <div
      v-if="activeTransfer"
      class="fixed bottom-6 right-6 z-50 w-[90vw] sm:w-[380px] p-4 rounded-2xl bg-[#1b1b1e] border border-white/20 shadow-2xl space-y-3 backdrop-blur-md animate-in slide-in-from-bottom duration-200"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <FileUp v-if="activeTransfer.direction === 'send'" class="w-4 h-4 text-white" />
            <Download v-else class="w-4 h-4 text-white" />
          </div>
          <div class="min-w-0">
            <div class="text-xs font-bold text-white truncate">
              {{ activeTransfer.direction === 'send' ? 'Sending' : 'Receiving' }}: {{ activeTransfer.fileName }}
            </div>
            <div class="text-[11px] text-[var(--text-tertiary)] truncate">
              {{ activeTransfer.direction === 'send' ? 'To' : 'From' }} {{ activeTransfer.peerName }} • {{ formatSize(activeTransfer.fileSize) }}
            </div>
          </div>
        </div>

        <button
          type="button"
          class="text-white/60 hover:text-white p-1 cursor-pointer"
          @click="cancelTransfer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Progress bar -->
      <div class="space-y-1">
        <div class="h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            class="h-full bg-white rounded-full transition-all duration-150"
            :style="{ width: `${activeTransfer.progress}%` }"
          />
        </div>
        <div class="flex items-center justify-between text-[11px] font-mono text-[var(--text-tertiary)]">
          <span>{{ activeTransfer.progress }}%</span>
          <span>{{ formatSpeed(activeTransfer.speed) }}</span>
        </div>
      </div>
    </div>

    <!-- Incoming File Transfer Consent Modal -->
    <Modal
      :model-value="!!incomingRequest"
      title="Incoming File Transfer"
      @close="rejectIncoming"
    >
      <div v-if="incomingRequest" class="space-y-4">
        <div class="p-4 rounded-xl bg-[#141416] border border-[#282828] flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
            <FileText class="w-6 h-6 text-white" />
          </div>
          <div class="min-w-0">
            <div class="text-sm font-bold text-white truncate">{{ incomingRequest.file.name }}</div>
            <div class="text-xs text-[var(--text-secondary)] mt-0.5">
              Size: {{ formatSize(incomingRequest.file.size) }}
            </div>
            <div class="text-[11px] text-[var(--text-tertiary)] mt-0.5">
              Sent by <strong class="text-white">{{ incomingRequest.fromPeer.name }}</strong> ({{ incomingRequest.fromPeer.os }})
            </div>
          </div>
        </div>

        <p class="text-xs text-[var(--text-secondary)] leading-relaxed">
          The file will transfer directly to your device via WebRTC and download to your local storage.
        </p>

        <div class="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" @click="rejectIncoming">
            Decline
          </Button>
          <Button variant="primary" class="font-bold" @click="acceptIncoming">
            Accept & Download
          </Button>
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
          From <strong class="text-white">{{ incomingText.fromPeer.name }}</strong>:
        </div>

        <div class="p-3.5 bg-[#141416] border border-[#282828] rounded-xl text-sm font-mono text-white select-all break-words max-h-60 overflow-y-auto">
          {{ incomingText.text }}
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="secondary"
            @click="copy(incomingText.text); toast.success('Copied', 'Note copied to clipboard')"
          >
            <Copy class="w-3.5 h-3.5 mr-1.5" />
            Copy to Clipboard
          </Button>
          <Button variant="primary" @click="closeIncomingText">
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
          Quickly drop text, a URL, or clipboard note to the selected device.
        </p>
        <textarea
          v-model="textToSend"
          rows="4"
          placeholder="Paste or type text message here..."
          class="w-full p-3 bg-[var(--bg-input)] border border-[var(--border-card)] text-[var(--text-primary)] rounded-lg text-sm focus:outline-none focus:border-white"
        />
        <div class="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" @click="showSendTextModal = false">
            Cancel
          </Button>
          <Button variant="primary" :disabled="!textToSend.trim()" @click="submitSendText">
            <Send class="w-3.5 h-3.5 mr-1.5" />
            Send Note
          </Button>
        </div>
      </div>
    </Modal>

    <!-- QR Code Display Modal (for other devices to scan) -->
    <Modal
      v-model="showQrModal"
      title="Scan to Connect Phone"
      @close="showQrModal = false"
    >
      <div class="space-y-4 text-center flex flex-col items-center">
        <p class="text-xs text-[var(--text-secondary)] max-w-sm">
          Point your smartphone camera at this QR code to automatically open PairDrop and join this exact room.
        </p>

        <!-- QR Canvas Render -->
        <div class="p-3 bg-[#141416] border border-[#282828] rounded-2xl flex items-center justify-center shadow-lg">
          <div class="w-[240px] h-[240px] [&>svg]:w-full [&>svg]:h-full" v-html="pairingQrSvg" />
        </div>

        <div class="w-full p-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-secondary)] truncate">
          {{ currentShareUrl }}
        </div>

        <div class="flex items-center gap-2 w-full">
          <Button variant="secondary" class="w-full text-xs" @click="copyShareUrl">
            <Copy class="w-3.5 h-3.5 mr-1.5" />
            Copy Share Link
          </Button>
          <Button variant="primary" class="w-full text-xs" @click="showQrModal = false">
            Done
          </Button>
        </div>
      </div>
    </Modal>

    <!-- Camera QR Code Scanner Modal (Mobile / Webcam scan) -->
    <Modal
      v-model="showScannerModal"
      title="Scan Room QR Code"
      @close="closeScannerModal"
    >
      <div class="space-y-4">
        <p class="text-xs text-[var(--text-secondary)]">
          Point your camera at a PairDrop QR code displayed on another device or screen to join automatically.
        </p>

        <!-- Camera Viewfinder Container -->
        <div class="relative w-full aspect-square max-w-[340px] mx-auto rounded-2xl bg-black border border-[#2e2e32] overflow-hidden flex items-center justify-center">
          <video
            ref="scannerVideoRef"
            autoplay
            playsinline
            muted
            class="w-full h-full object-cover"
          />
          <!-- Hidden Canvas for jsQR Frame Processing -->
          <canvas
            ref="scannerCanvasRef"
            class="hidden"
          />

          <!-- Reticle / Target Viewfinder Frame -->
          <div v-if="isScanning && !cameraError" class="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
            <div class="relative w-44 h-44 sm:w-52 sm:h-52 border-2 border-white/50 rounded-2xl flex items-center justify-center">
              <!-- Animated Scanning Laser Line -->
              <div class="absolute inset-x-2 h-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-pulse top-1/2 -translate-y-1/2" />
              <!-- Corner indicators -->
              <div class="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-white" />
              <div class="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-white" />
              <div class="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-white" />
              <div class="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-white" />
            </div>
          </div>

          <!-- Error Message if Camera Access Fails -->
          <div v-if="cameraError" class="absolute inset-0 bg-[#141416]/95 p-6 flex flex-col items-center justify-center text-center space-y-3">
            <AlertCircle class="w-8 h-8 text-white/60" />
            <div class="text-xs text-white/90 leading-relaxed font-medium">
              {{ cameraError }}
            </div>
            <Button size="sm" variant="secondary" class="text-xs" @click="closeScannerModal(); openJoinCodeModal()">
              <Hash class="w-3.5 h-3.5 mr-1.5" />
              Enter Code Manually
            </Button>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2 pt-1">
          <Button variant="outline" class="text-xs" @click="closeScannerModal(); openJoinCodeModal()">
            <Hash class="w-3.5 h-3.5 mr-1" />
            Use Code Instead
          </Button>
          <Button variant="secondary" class="text-xs" @click="closeScannerModal">
            Cancel
          </Button>
        </div>
      </div>
    </Modal>

    <!-- Join Room with Code Modal -->
    <Modal
      v-model="showJoinCodeModal"
      title="Join Room with Code"
      @close="showJoinCodeModal = false"
    >
      <div class="space-y-4">
        <p class="text-xs text-[var(--text-secondary)]">
          Enter a room code or custom name to connect with devices anywhere, even across different Wi-Fi networks.
        </p>

        <div class="space-y-2">
          <div class="relative">
            <input
              v-model="roomCodeInput"
              type="text"
              maxlength="25"
              placeholder="e.g. 7X9K2 or OFFICE"
              class="w-full p-3.5 bg-[var(--bg-input)] border border-[var(--border-card)] text-white text-center font-mono text-lg font-bold tracking-widest uppercase rounded-xl focus:outline-none focus:border-white placeholder:normal-case placeholder:font-normal placeholder:text-sm placeholder:tracking-normal"
              autofocus
              @keyup.enter="submitJoinCode"
            />
          </div>

          <div class="flex items-center justify-between text-xs text-[var(--text-tertiary)] pt-1">
            <span>Need a fresh room?</span>
            <button
              type="button"
              class="text-xs text-white hover:underline cursor-pointer flex items-center gap-1"
              @click="generateRandomRoomCode"
            >
              <RefreshCw class="w-3 h-3" />
              Generate 6-character Code
            </button>
          </div>
        </div>

        <!-- Current Room Notice -->
        <div class="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
          <div>
            <div class="text-[11px] text-[var(--text-tertiary)]">Your Current Room</div>
            <div class="font-mono font-bold text-white">
              {{ currentRoom === 'auto' ? 'Local Wi-Fi (Auto)' : `#${currentRoom}` }}
            </div>
          </div>
          <Button
            v-if="currentRoom !== 'auto'"
            size="sm"
            variant="outline"
            class="text-xs h-7 px-2"
            @click="copy(currentRoom); toast.success('Copied', 'Room code copied to clipboard')"
          >
            <Copy class="w-3 h-3 mr-1" />
            Copy Code
          </Button>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" @click="showJoinCodeModal = false">
            Cancel
          </Button>
          <Button variant="primary" :disabled="!roomCodeInput.trim()" @click="submitJoinCode">
            Join Room
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
          <Button variant="secondary" @click="showRoomModal = false">
            Cancel
          </Button>
          <Button variant="primary" @click="joinRoom">
            Join Room
          </Button>
        </div>
      </div>
    </Modal>
  </div>
</template>
