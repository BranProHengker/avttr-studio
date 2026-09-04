export interface PeerDevice {
  peerId: string
  roomId: string
  name: string
  deviceType: 'desktop' | 'mobile' | 'tablet'
  os: 'windows' | 'mac' | 'linux' | 'android' | 'ios' | 'unknown'
  joinedAt: number
  ip?: string
}

export interface PeerConnection extends PeerDevice {
  pushMessage: (data: any) => void
  close: () => void
}

class PairdropHub {
  private peers = new Map<string, PeerConnection>()
  private rooms = new Map<string, Set<string>>()

  /**
   * Register a new peer in a room
   */
  registerPeer(peer: PeerConnection): void {
    // If peer already registered, cleanly remove old instance
    if (this.peers.has(peer.peerId)) {
      this.removePeer(peer.peerId)
    }

    this.peers.set(peer.peerId, peer)

    if (!this.rooms.has(peer.roomId)) {
      this.rooms.set(peer.roomId, new Set())
    }
    this.rooms.get(peer.roomId)!.add(peer.peerId)

    // Notify other peers in the room
    this.broadcastToRoom(peer.roomId, {
      type: 'peer-joined',
      peer: this.sanitizePeer(peer),
    }, peer.peerId)
  }

  /**
   * Remove peer on disconnect
   */
  removePeer(peerId: string): void {
    const peer = this.peers.get(peerId)
    if (!peer) return

    this.peers.delete(peerId)

    const room = this.rooms.get(peer.roomId)
    if (room) {
      room.delete(peerId)
      if (room.size === 0) {
        this.rooms.delete(peer.roomId)
      } else {
        // Notify remaining peers
        this.broadcastToRoom(peer.roomId, {
          type: 'peer-left',
          peerId,
        })
      }
    }
  }

  /**
   * Get list of sanitized peers in a room
   */
  getRoomPeers(roomId: string, excludePeerId?: string): PeerDevice[] {
    const room = this.rooms.get(roomId)
    if (!room) return []

    const list: PeerDevice[] = []
    for (const id of room) {
      if (id !== excludePeerId) {
        const p = this.peers.get(id)
        if (p) {
          list.push(this.sanitizePeer(p))
        }
      }
    }
    return list
  }

  /**
   * Route signal message from one peer to another
   */
  sendSignal(fromPeerId: string, toPeerId: string, payload: any): boolean {
    const targetPeer = this.peers.get(toPeerId)
    if (!targetPeer) return false

    const sender = this.peers.get(fromPeerId)
    targetPeer.pushMessage({
      type: 'signal',
      from: fromPeerId,
      sender: sender ? this.sanitizePeer(sender) : undefined,
      payload,
    })
    return true
  }

  /**
   * Broadcast an event to all peers in a room (optionally excluding one)
   */
  broadcastToRoom(roomId: string, message: any, excludePeerId?: string): void {
    const room = this.rooms.get(roomId)
    if (!room) return

    for (const id of room) {
      if (id !== excludePeerId) {
        const peer = this.peers.get(id)
        if (peer) {
          peer.pushMessage(message)
        }
      }
    }
  }

  /**
   * Strip sensitive callback references
   */
  private sanitizePeer(peer: PeerConnection): PeerDevice {
    return {
      peerId: peer.peerId,
      roomId: peer.roomId,
      name: peer.name,
      deviceType: peer.deviceType,
      os: peer.os,
      joinedAt: peer.joinedAt,
    }
  }
}

// Global singleton instance for Nitro runtime
export const pairdropHub = new PairdropHub()
