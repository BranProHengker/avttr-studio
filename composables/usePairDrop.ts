import { ref, onMounted, onUnmounted } from 'vue'
import { useToast } from '~/composables/useToast'

export interface PeerDevice {
  peerId: string
  roomId: string
  name: string
  deviceType: 'desktop' | 'mobile' | 'tablet'
  os: 'windows' | 'mac' | 'linux' | 'android' | 'ios' | 'unknown'
  joinedAt: number
}

export interface TransferProgress {
  transferId: string
  direction: 'send' | 'receive'
  peerId: string
  peerName: string
  fileName: string
  fileSize: number
  mimeType: string
  progress: number
  bytesTransferred: number
  speed: number
  status: 'pending' | 'transferring' | 'completed' | 'cancelled' | 'error'
  error?: string
}

export interface IncomingRequest {
  transferId: string
  fromPeer: PeerDevice
  file: {
    name: string
    size: number
    mimeType: string
  }
}

export interface IncomingText {
  fromPeer: PeerDevice
  text: string
  receivedAt: number
}

const ADJECTIVES = [
  'Neon', 'Cyber', 'Solar', 'Velvet', 'Lunar', 'Cosmic', 'Swift', 'Golden',
  'Shadow', 'Frost', 'Crystal', 'Amber', 'Ruby', 'Emerald', 'Sapphire', 'Mystic',
  'Brave', 'Astral', 'Hyper', 'Nova', 'Sonic', 'Pixel', 'Echo', 'Zenith'
]

const NOUNS = [
  'Falcon', 'Fox', 'Otter', 'Panda', 'Tiger', 'Eagle', 'Hawk', 'Wolf',
  'Lynx', 'Dolphin', 'Phoenix', 'Jaguar', 'Koala', 'Badger', 'Dragon', 'Raven',
  'Cheetah', 'Leopard', 'Owl', 'Gazelle', 'Orion', 'Viper', 'Condor', 'Stag'
]

const CHUNK_SIZE = 64 * 1024 // 64KB chunks for optimal WebRTC throughput

function generateRandomName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  return `${adj} ${noun}`
}

function detectDevice(): { deviceType: 'desktop' | 'mobile' | 'tablet'; os: 'windows' | 'mac' | 'linux' | 'android' | 'ios' | 'unknown' } {
  if (typeof window === 'undefined') return { deviceType: 'desktop', os: 'unknown' }

  const ua = navigator.userAgent

  let os: 'windows' | 'mac' | 'linux' | 'android' | 'ios' | 'unknown' = 'unknown'
  if (/iPad|iPhone|iPod/.test(ua)) os = 'ios'
  else if (/Android/.test(ua)) os = 'android'
  else if (/Macintosh|Mac OS X/.test(ua)) os = 'mac'
  else if (/Windows/.test(ua)) os = 'windows'
  else if (/Linux/.test(ua)) os = 'linux'

  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop'
  if (/iPad|Tablet/i.test(ua) || (os === 'ios' && navigator.maxTouchPoints > 1)) deviceType = 'tablet'
  else if (/Mobile|Android|iP(hone|od)/i.test(ua)) deviceType = 'mobile'

  return { deviceType, os }
}

export function usePairDrop() {
  const toast = useToast()

  // State
  const isConnected = ref(false)
  const isConnecting = ref(false)
  const currentRoom = ref('auto')
  const peers = ref<PeerDevice[]>([])

  // Local Peer Identity
  const { deviceType, os } = detectDevice()
  const myPeerId = ref('')
  const myPeerName = ref('')

  // Transfers & Modals State
  const activeTransfer = ref<TransferProgress | null>(null)
  const incomingRequest = ref<IncomingRequest | null>(null)
  const incomingText = ref<IncomingText | null>(null)

  // Internal WebRTC & SSE tracking
  let eventSource: EventSource | null = null
  const peerConnections = new Map<string, RTCPeerConnection>()
  const dataChannels = new Map<string, RTCDataChannel>()

  // Incoming chunk buffers keyed by transferId
  const incomingBuffers = new Map<string, {
    metadata: { name: string; size: number; mimeType: string }
    chunks: ArrayBuffer[]
    receivedBytes: number
    startTime: number
    lastTime: number
    lastBytes: number
  }>()

  // File queue for current sender
  let currentSendFile: File | null = null
  let isSendingCancelled = false

  const RTC_CONFIG: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  }

  // Generate or retrieve persistent Session ID
  const initIdentity = () => {
    if (typeof window === 'undefined') return

    let storedId = sessionStorage.getItem('avttr_pairdrop_id')
    if (!storedId) {
      storedId = 'p_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)
      sessionStorage.setItem('avttr_pairdrop_id', storedId)
    }
    myPeerId.value = storedId

    let storedName = localStorage.getItem('avttr_pairdrop_name')
    if (!storedName) {
      storedName = generateRandomName()
      localStorage.setItem('avttr_pairdrop_name', storedName)
    }
    myPeerName.value = storedName
  }

  const setMyName = (newName: string) => {
    const clean = newName.trim().slice(0, 30)
    if (!clean) return
    myPeerName.value = clean
    if (typeof window !== 'undefined') {
      localStorage.setItem('avttr_pairdrop_name', clean)
    }
    // Reconnect to update name on remote peers
    connect(currentRoom.value)
    toast.success('Device Renamed', `You are now "${clean}"`)
  }

  const randomizeMyName = () => {
    setMyName(generateRandomName())
  }

  // Connect to SSE signaling channel
  const connect = (roomId = 'auto') => {
    if (typeof window === 'undefined') return
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }

    initIdentity()
    isConnecting.value = true
    currentRoom.value = roomId

    const params = new URLSearchParams({
      peerId: myPeerId.value,
      roomId: roomId === 'auto' ? '' : roomId,
      name: myPeerName.value,
      deviceType,
      os,
    })

    const url = `/api/pairdrop/events?${params.toString()}`
    eventSource = new EventSource(url)

    eventSource.onopen = () => {
      isConnected.value = true
      isConnecting.value = false
    }

    eventSource.onmessage = async (e) => {
      if (!e.data || e.data.startsWith(':')) return
      try {
        const msg = JSON.parse(e.data)
        await handleServerMessage(msg)
      } catch {
        // Ping or malformed
      }
    }

    eventSource.onerror = () => {
      isConnected.value = false
      isConnecting.value = false
    }
  }

  // Handle incoming signaling messages from SSE
  const handleServerMessage = async (msg: any) => {
    switch (msg.type) {
      case 'init':
        currentRoom.value = msg.roomId
        peers.value = msg.peers || []
        break

      case 'peer-joined':
        if (msg.peer && msg.peer.peerId !== myPeerId.value) {
          peers.value = peers.value.filter((p) => p.peerId !== msg.peer.peerId)
          peers.value.push(msg.peer)
        }
        break

      case 'peer-left':
        peers.value = peers.value.filter((p) => p.peerId !== msg.peerId)
        cleanupPeerConnection(msg.peerId)
        break

      case 'signal':
        await handlePeerSignal(msg.from, msg.sender, msg.payload)
        break
    }
  }

  // Send signal to another peer via HTTP POST
  const sendSignal = async (toPeerId: string, payload: any) => {
    try {
      await $fetch('/api/pairdrop/signal', {
        method: 'POST',
        body: {
          from: myPeerId.value,
          to: toPeerId,
          payload,
        },
      })
    } catch {
      // Signal send failed
    }
  }

  // WebRTC Peer Connection Factory
  const getOrCreatePeerConnection = (targetPeerId: string): RTCPeerConnection => {
    let pc = peerConnections.get(targetPeerId)
    if (pc && pc.signalingState !== 'closed') {
      return pc
    }

    pc = new RTCPeerConnection(RTC_CONFIG)
    peerConnections.set(targetPeerId, pc)

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(targetPeerId, {
          type: 'ice-candidate',
          candidate: event.candidate,
        })
      }
    }

    pc.ondatachannel = (event) => {
      setupDataChannel(targetPeerId, event.channel)
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        cleanupPeerConnection(targetPeerId)
      }
    }

    return pc
  }

  // Setup WebRTC DataChannel handlers
  const setupDataChannel = (targetPeerId: string, dc: RTCDataChannel) => {
    dc.binaryType = 'arraybuffer'
    dataChannels.set(targetPeerId, dc)

    dc.onmessage = (event) => {
      if (typeof event.data === 'string') {
        handleControlMessage(targetPeerId, JSON.parse(event.data))
      } else if (event.data instanceof ArrayBuffer) {
        handleBinaryChunk(targetPeerId, event.data)
      }
    }

    dc.onclose = () => {
      dataChannels.delete(targetPeerId)
    }
  }

  // Handle incoming WebRTC signals
  const handlePeerSignal = async (fromPeerId: string, sender: PeerDevice | undefined, payload: any) => {
    const pc = getOrCreatePeerConnection(fromPeerId)

    switch (payload.type) {
      case 'offer':
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await sendSignal(fromPeerId, {
          type: 'answer',
          sdp: answer,
        })
        break

      case 'answer':
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
        break

      case 'ice-candidate':
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
        } catch {}
        break

      case 'file-request':
        incomingRequest.value = {
          transferId: payload.transferId,
          fromPeer: sender || {
            peerId: fromPeerId,
            name: payload.senderName || 'Nearby Device',
            deviceType: 'desktop',
            os: 'unknown',
            joinedAt: Date.now(),
            roomId: currentRoom.value,
          },
          file: payload.file,
        }
        break

      case 'file-accepted':
        if (currentSendFile && activeTransfer.value?.transferId === payload.transferId) {
          startStreamingFile(fromPeerId, currentSendFile, payload.transferId)
        }
        break

      case 'file-rejected':
        if (activeTransfer.value?.transferId === payload.transferId) {
          activeTransfer.value = null
          currentSendFile = null
          toast.info('Transfer Declined', `${sender?.name || 'Receiver'} declined the file transfer`)
        }
        break

      case 'text-message':
        incomingText.value = {
          fromPeer: sender || {
            peerId: fromPeerId,
            name: 'Nearby Device',
            deviceType: 'desktop',
            os: 'unknown',
            joinedAt: Date.now(),
            roomId: currentRoom.value,
          },
          text: payload.text,
          receivedAt: Date.now(),
        }
        break
    }
  }

  // Handle Control Packets over DataChannel
  const handleControlMessage = (fromPeerId: string, data: any) => {
    switch (data.type) {
      case 'transfer-start':
        incomingBuffers.set(data.transferId, {
          metadata: { name: data.name, size: data.size, mimeType: data.mimeType },
          chunks: [],
          receivedBytes: 0,
          startTime: Date.now(),
          lastTime: Date.now(),
          lastBytes: 0,
        })
        activeTransfer.value = {
          transferId: data.transferId,
          direction: 'receive',
          peerId: fromPeerId,
          peerName: peers.value.find((p) => p.peerId === fromPeerId)?.name || 'Sender',
          fileName: data.name,
          fileSize: data.size,
          mimeType: data.mimeType,
          progress: 0,
          bytesTransferred: 0,
          speed: 0,
          status: 'transferring',
        }
        break

      case 'transfer-cancel':
        incomingBuffers.delete(data.transferId)
        if (activeTransfer.value?.transferId === data.transferId) {
          activeTransfer.value = null
          toast.info('Transfer Cancelled', 'The sender cancelled the transfer')
        }
        break
    }
  }

  // Handle Incoming Binary Chunks over DataChannel
  const handleBinaryChunk = (fromPeerId: string, chunk: ArrayBuffer) => {
    const transfer = activeTransfer.value
    if (!transfer || transfer.direction !== 'receive') return

    const buffer = incomingBuffers.get(transfer.transferId)
    if (!buffer) return

    buffer.chunks.push(chunk)
    buffer.receivedBytes += chunk.byteLength

    const now = Date.now()
    const dt = (now - buffer.lastTime) / 1000
    if (dt >= 0.3) {
      const bytesDiff = buffer.receivedBytes - buffer.lastBytes
      transfer.speed = Math.round(bytesDiff / dt)
      buffer.lastTime = now
      buffer.lastBytes = buffer.receivedBytes
    }

    transfer.bytesTransferred = buffer.receivedBytes
    transfer.progress = Math.min(100, Math.round((buffer.receivedBytes / buffer.metadata.size) * 100))

    // Check complete
    if (buffer.receivedBytes >= buffer.metadata.size) {
      transfer.status = 'completed'
      transfer.progress = 100

      // Assemble final file Blob and trigger browser download
      const finalBlob = new Blob(buffer.chunks, { type: buffer.metadata.mimeType || 'application/octet-stream' })
      const downloadUrl = URL.createObjectURL(finalBlob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = buffer.metadata.name
      a.click()
      URL.revokeObjectURL(downloadUrl)

      toast.success('Transfer Complete', `Downloaded ${buffer.metadata.name}`)
      incomingBuffers.delete(transfer.transferId)

      setTimeout(() => {
        if (activeTransfer.value?.transferId === transfer.transferId) {
          activeTransfer.value = null
        }
      }, 3000)
    }
  }

  // Initiate file send to target peer
  const sendFile = async (targetPeer: PeerDevice, file: File) => {
    if (!file) return

    const transferId = 't_' + Math.random().toString(36).slice(2, 9)
    currentSendFile = file
    isSendingCancelled = false

    activeTransfer.value = {
      transferId,
      direction: 'send',
      peerId: targetPeer.peerId,
      peerName: targetPeer.name,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      progress: 0,
      bytesTransferred: 0,
      speed: 0,
      status: 'pending',
    }

    // Connect WebRTC if not yet established
    await ensureDataChannel(targetPeer.peerId)

    // Request consent from receiver
    await sendSignal(targetPeer.peerId, {
      type: 'file-request',
      transferId,
      senderName: myPeerName.value,
      file: {
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
      },
    })
  }

  // Ensure WebRTC DataChannel is ready
  const ensureDataChannel = async (targetPeerId: string): Promise<RTCDataChannel> => {
    let dc = dataChannels.get(targetPeerId)
    if (dc && dc.readyState === 'open') {
      return dc
    }

    const pc = getOrCreatePeerConnection(targetPeerId)
    dc = pc.createDataChannel('pairdrop-channel')
    setupDataChannel(targetPeerId, dc)

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await sendSignal(targetPeerId, {
      type: 'offer',
      sdp: offer,
    })

    return new Promise((resolve) => {
      if (dc!.readyState === 'open') {
        resolve(dc!)
        return
      }
      dc!.onopen = () => {
        resolve(dc!)
      }
    })
  }

  // Stream file chunks via DataChannel with backpressure control
  const startStreamingFile = async (targetPeerId: string, file: File, transferId: string) => {
    const dc = await ensureDataChannel(targetPeerId)
    if (!activeTransfer.value || activeTransfer.value.transferId !== transferId) return

    activeTransfer.value.status = 'transferring'

    // Notify receiver about transfer start
    dc.send(
      JSON.stringify({
        type: 'transfer-start',
        transferId,
        name: file.name,
        size: file.size,
        mimeType: file.type,
      })
    )

    let offset = 0
    let lastTime = Date.now()
    let lastBytes = 0

    const readAndSendNextChunk = () => {
      if (isSendingCancelled || !activeTransfer.value || activeTransfer.value.transferId !== transferId) {
        dc.send(JSON.stringify({ type: 'transfer-cancel', transferId }))
        return
      }

      if (offset >= file.size) {
        activeTransfer.value.status = 'completed'
        activeTransfer.value.progress = 100
        toast.success('Transfer Complete', `Sent ${file.name} to ${activeTransfer.value.peerName}`)
        setTimeout(() => {
          if (activeTransfer.value?.transferId === transferId) {
            activeTransfer.value = null
            currentSendFile = null
          }
        }, 3000)
        return
      }

      // Backpressure check (prevent buffer overflow in browser memory)
      if (dc.bufferedAmount > 8 * CHUNK_SIZE) {
        dc.onbufferedamountlow = () => {
          dc.onbufferedamountlow = null
          readAndSendNextChunk()
        }
        return
      }

      const slice = file.slice(offset, offset + CHUNK_SIZE)
      const reader = new FileReader()

      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          dc.send(reader.result)
          offset += reader.result.byteLength

          if (activeTransfer.value) {
            activeTransfer.value.bytesTransferred = offset
            activeTransfer.value.progress = Math.min(100, Math.round((offset / file.size) * 100))

            const now = Date.now()
            const dt = (now - lastTime) / 1000
            if (dt >= 0.3) {
              const diff = offset - lastBytes
              activeTransfer.value.speed = Math.round(diff / dt)
              lastTime = now
              lastBytes = offset
            }
          }

          // Continue streaming
          setTimeout(readAndSendNextChunk, 0)
        }
      }

      reader.readAsArrayBuffer(slice)
    }

    readAndSendNextChunk()
  }

  // Receiver actions
  const acceptIncoming = async () => {
    if (!incomingRequest.value) return
    const req = incomingRequest.value
    incomingRequest.value = null

    await ensureDataChannel(req.fromPeer.peerId)
    await sendSignal(req.fromPeer.peerId, {
      type: 'file-accepted',
      transferId: req.transferId,
    })
  }

  const rejectIncoming = async () => {
    if (!incomingRequest.value) return
    const req = incomingRequest.value
    incomingRequest.value = null

    await sendSignal(req.fromPeer.peerId, {
      type: 'file-rejected',
      transferId: req.transferId,
    })
  }

  const cancelTransfer = () => {
    isSendingCancelled = true
    if (activeTransfer.value) {
      const { peerId, transferId } = activeTransfer.value
      const dc = dataChannels.get(peerId)
      if (dc && dc.readyState === 'open') {
        dc.send(JSON.stringify({ type: 'transfer-cancel', transferId }))
      }
      activeTransfer.value = null
      currentSendFile = null
      toast.info('Transfer Cancelled', 'File transfer was stopped')
    }
  }

  // Send Instant Text Message
  const sendText = async (targetPeer: PeerDevice, text: string) => {
    if (!text.trim()) return
    await sendSignal(targetPeer.peerId, {
      type: 'text-message',
      text: text.trim(),
    })
    toast.success('Text Sent', `Sent message to ${targetPeer.name}`)
  }

  const closeIncomingText = () => {
    incomingText.value = null
  }

  // Cleanup helper
  const cleanupPeerConnection = (peerId: string) => {
    const dc = dataChannels.get(peerId)
    if (dc) {
      dc.close()
      dataChannels.delete(peerId)
    }

    const pc = peerConnections.get(peerId)
    if (pc) {
      pc.close()
      peerConnections.delete(peerId)
    }
  }

  onMounted(() => {
    connect('auto')
  })

  onUnmounted(() => {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    for (const [peerId] of peerConnections) {
      cleanupPeerConnection(peerId)
    }
  })

  return {
    // State
    isConnected,
    isConnecting,
    currentRoom,
    peers,
    myPeerId,
    myPeerName,
    deviceType,
    os,
    activeTransfer,
    incomingRequest,
    incomingText,

    // Methods
    connect,
    setMyName,
    randomizeMyName,
    sendFile,
    sendText,
    acceptIncoming,
    rejectIncoming,
    cancelTransfer,
    closeIncomingText,
  }
}
