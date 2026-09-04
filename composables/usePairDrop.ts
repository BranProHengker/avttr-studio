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

const CHUNK_SIZE = 16 * 1024 // 16KB universally safe SCTP packet size for mobile & desktop WebRTC

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
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
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

  // Callbacks for peer lifecycle events
  type PeerJoinedCallback = (peer: PeerDevice) => void
  const peerJoinedCallbacks = new Set<PeerJoinedCallback>()

  const onPeerJoined = (cb: PeerJoinedCallback) => {
    peerJoinedCallbacks.add(cb)
    return () => peerJoinedCallbacks.delete(cb)
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
          const isNew = !peers.value.some((p) => p.peerId === msg.peer.peerId)
          peers.value = peers.value.filter((p) => p.peerId !== msg.peer.peerId)
          peers.value.push(msg.peer)
          if (isNew) {
            peerJoinedCallbacks.forEach((cb) => {
              try {
                cb(msg.peer)
              } catch (err) {
                console.error('peerJoined callback error:', err)
              }
            })
          }
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

  // Send signal to another peer via HTTP POST with automatic retry
  const sendSignal = async (toPeerId: string, payload: any, retries = 2): Promise<boolean> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await $fetch('/api/pairdrop/signal', {
          method: 'POST',
          body: {
            from: myPeerId.value,
            to: toPeerId,
            payload,
          },
        })
        return true
      } catch (err) {
        if (attempt === retries) return false
        await new Promise((resolve) => setTimeout(resolve, 80 * (attempt + 1)))
      }
    }
    return false
  }

  // ICE Candidates Queue (buffers candidates until remote description is set)
  const iceCandidateQueue = new Map<string, RTCIceCandidateInit[]>()

  const queueIceCandidate = (peerId: string, candidate: RTCIceCandidateInit) => {
    if (!iceCandidateQueue.has(peerId)) {
      iceCandidateQueue.set(peerId, [])
    }
    iceCandidateQueue.get(peerId)!.push(candidate)
  }

  const drainIceCandidates = async (peerId: string, pc: RTCPeerConnection) => {
    const queue = iceCandidateQueue.get(peerId)
    if (queue && queue.length > 0) {
      for (const cand of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand))
        } catch {
          // Ignore candidate errors
        }
      }
      iceCandidateQueue.delete(peerId)
    }
  }

  // Base64 Helpers for Signaling Chunk Relay Fallback
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binary = atob(base64)
    const len = binary.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
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
    dc.bufferedAmountLowThreshold = 64 * 1024
    dataChannels.set(targetPeerId, dc)

    dc.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          handleControlMessage(targetPeerId, JSON.parse(event.data))
        } catch {}
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
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
          await drainIceCandidates(fromPeerId, pc)
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          await sendSignal(fromPeerId, {
            type: 'answer',
            sdp: answer,
          })
        } catch (err) {
          console.error('Error handling WebRTC offer:', err)
        }
        break

      case 'answer':
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
          await drainIceCandidates(fromPeerId, pc)
        } catch (err) {
          console.error('Error handling WebRTC answer:', err)
        }
        break

      case 'ice-candidate':
        if (!pc.remoteDescription) {
          queueIceCandidate(fromPeerId, payload.candidate)
        } else {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
          } catch {
            queueIceCandidate(fromPeerId, payload.candidate)
          }
        }
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

      case 'transfer-start':
        handleControlMessage(fromPeerId, payload)
        break

      case 'file-chunk':
        if (payload.transferId && payload.chunk) {
          const rawBuffer = base64ToArrayBuffer(payload.chunk)
          handleBinaryChunk(fromPeerId, rawBuffer, payload.transferId)
        }
        break

      case 'transfer-cancel':
        handleControlMessage(fromPeerId, payload)
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

  // Handle Control Packets
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

  // Handle Incoming Binary Chunks (WebRTC DataChannel or Signal Relay)
  const handleBinaryChunk = (fromPeerId: string, chunk: ArrayBuffer, transferIdOverride?: string) => {
    const tId = transferIdOverride || activeTransfer.value?.transferId
    if (!tId) return

    const buffer = incomingBuffers.get(tId)
    if (!buffer) return

    buffer.chunks.push(chunk)
    buffer.receivedBytes += chunk.byteLength

    const now = Date.now()
    const dt = (now - buffer.lastTime) / 1000

    if (activeTransfer.value && activeTransfer.value.transferId === tId) {
      if (dt >= 0.25) {
        const bytesDiff = buffer.receivedBytes - buffer.lastBytes
        activeTransfer.value.speed = Math.max(0, Math.round(bytesDiff / dt))
        buffer.lastTime = now
        buffer.lastBytes = buffer.receivedBytes
      }
      activeTransfer.value.bytesTransferred = buffer.receivedBytes
      activeTransfer.value.progress = Math.min(100, Math.round((buffer.receivedBytes / buffer.metadata.size) * 100))
    }

    // Check complete
    if (buffer.receivedBytes >= buffer.metadata.size) {
      if (activeTransfer.value && activeTransfer.value.transferId === tId) {
        activeTransfer.value.status = 'completed'
        activeTransfer.value.progress = 100
      }

      // Assemble final file Blob and trigger browser download
      const finalBlob = new Blob(buffer.chunks, { type: buffer.metadata.mimeType || 'application/octet-stream' })
      const downloadUrl = URL.createObjectURL(finalBlob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = buffer.metadata.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)

      toast.success('Transfer Complete', `Downloaded ${buffer.metadata.name}`)
      incomingBuffers.delete(tId)

      setTimeout(() => {
        if (activeTransfer.value?.transferId === tId) {
          activeTransfer.value = null
        }
      }, 2500)
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

    // Pre-negotiate WebRTC connection in background (non-blocking)
    ensureDataChannel(targetPeer.peerId, 2000).catch(() => {})

    // Send instant consent request to receiver via signaling
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

  // Ensure WebRTC DataChannel is ready with timeout fallback
  const ensureDataChannel = async (targetPeerId: string, timeoutMs = 3000): Promise<RTCDataChannel | null> => {
    let dc = dataChannels.get(targetPeerId)
    if (dc && dc.readyState === 'open') {
      return dc
    }

    const pc = getOrCreatePeerConnection(targetPeerId)

    if (!dc || dc.readyState === 'closed') {
      try {
        dc = pc.createDataChannel('pairdrop-channel')
        setupDataChannel(targetPeerId, dc)

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await sendSignal(targetPeerId, {
          type: 'offer',
          sdp: offer,
        })
      } catch (err) {
        console.warn('WebRTC offer error:', err)
      }
    }

    return new Promise((resolve) => {
      if (dc && dc.readyState === 'open') {
        resolve(dc)
        return
      }

      let timer: any = null

      const onOpen = () => {
        if (timer) clearTimeout(timer)
        resolve(dc || null)
      }

      if (dc) {
        dc.addEventListener('open', onOpen, { once: true })
      }

      timer = setTimeout(() => {
        if (dc) {
          dc.removeEventListener('open', onOpen)
        }
        resolve(dc && dc.readyState === 'open' ? dc : null)
      }, timeoutMs)
    })
  }

  // Stream file chunks via DataChannel (or Signal Relay fallback if P2P NAT fails)
  const startStreamingFile = async (targetPeerId: string, file: File, transferId: string) => {
    if (!activeTransfer.value || activeTransfer.value.transferId !== transferId) return

    activeTransfer.value.status = 'transferring'

    // Try WebRTC DataChannel (max 2.5s wait)
    const dc = await ensureDataChannel(targetPeerId, 2500)
    let useWebRTC = dc !== null && dc.readyState === 'open'

    const startPayload = {
      type: 'transfer-start',
      transferId,
      name: file.name,
      size: file.size,
      mimeType: file.type,
    }

    if (useWebRTC) {
      try {
        dc!.send(JSON.stringify(startPayload))
      } catch {
        useWebRTC = false
        await sendSignal(targetPeerId, startPayload)
      }
    } else {
      // Direct signal relay fallback
      await sendSignal(targetPeerId, startPayload)
    }

    let offset = 0
    let lastTime = Date.now()
    let lastBytes = 0

    const updateProgress = (currentOffset: number) => {
      if (!activeTransfer.value || activeTransfer.value.transferId !== transferId) return
      activeTransfer.value.bytesTransferred = currentOffset
      activeTransfer.value.progress = Math.min(100, Math.round((currentOffset / file.size) * 100))

      const now = Date.now()
      const dt = (now - lastTime) / 1000
      if (dt >= 0.2) {
        const diff = currentOffset - lastBytes
        activeTransfer.value.speed = Math.max(0, Math.round(diff / dt))
        lastTime = now
        lastBytes = currentOffset
      }
    }

    const streamNextChunk = async () => {
      if (isSendingCancelled || !activeTransfer.value || activeTransfer.value.transferId !== transferId) {
        if (useWebRTC && dc?.readyState === 'open') {
          try {
            dc.send(JSON.stringify({ type: 'transfer-cancel', transferId }))
          } catch {}
        } else {
          await sendSignal(targetPeerId, { type: 'transfer-cancel', transferId })
        }
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
        }, 2500)
        return
      }

      // WebRTC flow control & backpressure with safety timeout
      if (useWebRTC && dc && dc.bufferedAmount > 256 * 1024) {
        let resumed = false
        const resume = () => {
          if (resumed) return
          resumed = true
          if (dc) dc.onbufferedamountlow = null
          streamNextChunk()
        }
        dc.onbufferedamountlow = resume
        setTimeout(resume, 60)
        return
      }

      const chunkSize = useWebRTC ? CHUNK_SIZE : 32 * 1024
      const slice = file.slice(offset, offset + chunkSize)

      try {
        const arrayBuffer = await slice.arrayBuffer()

        if (useWebRTC && dc?.readyState === 'open') {
          try {
            dc.send(arrayBuffer)
            offset += arrayBuffer.byteLength
            updateProgress(offset)
            setTimeout(streamNextChunk, 0)
            return
          } catch (dcErr) {
            console.warn('WebRTC DataChannel send failed, switching to signaling relay fallback:', dcErr)
            useWebRTC = false
          }
        }

        // Signaling relay transmission with automatic retry
        const base64Chunk = arrayBufferToBase64(arrayBuffer)
        const sent = await sendSignal(targetPeerId, {
          type: 'file-chunk',
          transferId,
          chunk: base64Chunk,
          offset,
        }, 3)

        if (!sent) {
          throw new Error('Failed to deliver chunk via signaling relay')
        }

        offset += arrayBuffer.byteLength
        updateProgress(offset)
        setTimeout(streamNextChunk, 8)
      } catch (err: any) {
        console.error('Error streaming chunk:', err)
        activeTransfer.value.status = 'error'
        activeTransfer.value.error = err?.message || 'Transfer failed'
        toast.error('Transfer Failed', 'File transfer was interrupted. Please try again.')
      }
    }

    streamNextChunk()
  }

  // Receiver actions
  const acceptIncoming = async () => {
    if (!incomingRequest.value) return
    const req = incomingRequest.value
    incomingRequest.value = null

    // Prepare buffer on receiver
    incomingBuffers.set(req.transferId, {
      metadata: req.file,
      chunks: [],
      receivedBytes: 0,
      startTime: Date.now(),
      lastTime: Date.now(),
      lastBytes: 0,
    })

    activeTransfer.value = {
      transferId: req.transferId,
      direction: 'receive',
      peerId: req.fromPeer.peerId,
      peerName: req.fromPeer.name,
      fileName: req.file.name,
      fileSize: req.file.size,
      mimeType: req.file.mimeType,
      progress: 0,
      bytesTransferred: 0,
      speed: 0,
      status: 'transferring',
    }

    // Send immediate acceptance to sender
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
      } else {
        sendSignal(peerId, { type: 'transfer-cancel', transferId })
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
    onPeerJoined,
  }
}
