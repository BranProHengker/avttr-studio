import { pairdropHub } from '~/server/utils/pairdropHub'

function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36).slice(0, 6)
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const peerId = typeof query.peerId === 'string' ? query.peerId : ''
  const requestedRoom = typeof query.roomId === 'string' && query.roomId.trim() ? query.roomId.trim() : ''
  const name = typeof query.name === 'string' ? query.name.slice(0, 40) : 'Guest'
  const deviceType = ((query.deviceType as string) || 'desktop') as 'desktop' | 'mobile' | 'tablet'
  const os = ((query.os as string) || 'unknown') as 'windows' | 'mac' | 'linux' | 'android' | 'ios' | 'unknown'

  if (!peerId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing peerId parameter',
    })
  }

  // Determine LAN / custom room:
  // If no room is specified, group by client subnet/IP for zero-config Wi-Fi discovery
  const clientIp = getRequestIP(event, { xForwardedFor: true }) || '127.0.0.1'
  const roomId = requestedRoom || `lan-${hashString(clientIp)}`

  const eventStream = createEventStream(event)

  const pushMessage = (data: any) => {
    try {
      eventStream.push(JSON.stringify(data))
    } catch {
      // Stream may have closed
    }
  }

  const peerConn = {
    peerId,
    roomId,
    name,
    deviceType,
    os,
    joinedAt: Date.now(),
    ip: clientIp,
    pushMessage,
    close: () => {
      try {
        eventStream.close()
      } catch {}
    },
  }

  pairdropHub.registerPeer(peerConn)

  // Send initial state to the joining peer
  eventStream.push(
    JSON.stringify({
      type: 'init',
      roomId,
      peerId,
      peers: pairdropHub.getRoomPeers(roomId, peerId),
    })
  )

  // Keep-alive ping every 15s to keep proxy connections alive
  const pingInterval = setInterval(() => {
    try {
      eventStream.push(JSON.stringify({ type: 'ping', ts: Date.now() }))
    } catch {
      clearInterval(pingInterval)
    }
  }, 15000)

  eventStream.onClosed(() => {
    clearInterval(pingInterval)
    pairdropHub.removePeer(peerId)
  })

  return eventStream.send()
})
