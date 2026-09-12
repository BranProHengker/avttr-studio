export interface WhatsAppStickerMetadata {
  id?: string
  pack?: string
  author?: string
  emojis?: string[]
}

/**
 * Injects WhatsApp sticker EXIF metadata into a WebP binary buffer (100% client-side, zero dependencies)
 */
export function addWhatsAppStickerExif(
  webpBuffer: ArrayBuffer | Uint8Array,
  metadata: WhatsAppStickerMetadata,
  width: number = 512,
  height: number = 512
): Uint8Array {
  const jsonPayload = JSON.stringify({
    'sticker-pack-id': metadata.id || `avttr.${Date.now()}`,
    'sticker-pack-name': metadata.pack || 'Avttr Stickers',
    'sticker-pack-publisher': metadata.author || 'Avttr Studio',
    emojis: metadata.emojis && metadata.emojis.length > 0 ? metadata.emojis : ['✨']
  })

  const textEncoder = new TextEncoder()
  const jsonBytes = textEncoder.encode(jsonPayload)

  // 22-byte little-endian TIFF header for WhatsApp sticker metadata
  const exifHeader = new Uint8Array(22)
  exifHeader.set([
    0x49, 0x49, 0x2a, 0x00, // II*\0
    0x08, 0x00, 0x00, 0x00, // Offset to first IFD (8)
    0x01, 0x00,             // Number of IFD tags (1)
    0x41, 0x57,             // Tag 'WA' (0x5741)
    0x07, 0x00,             // Type: UNDEFINED (7)
    0x00, 0x00, 0x00, 0x00, // Length (filled below at offset 14)
    0x16, 0x00, 0x00, 0x00  // Offset to data (22)
  ])

  const view = new DataView(exifHeader.buffer)
  view.setUint32(14, jsonBytes.length, true)

  // Combine TIFF header + JSON payload
  const exifPayload = new Uint8Array(22 + jsonBytes.length)
  exifPayload.set(exifHeader, 0)
  exifPayload.set(jsonBytes, 22)

  // WebP chunks must be even-byte padded
  const padByte = exifPayload.length % 2 !== 0 ? 1 : 0
  const exifChunkSize = exifPayload.length

  // Build EXIF chunk: 'EXIF' (4 bytes) + Size (4 bytes) + Payload + Pad
  const exifChunk = new Uint8Array(8 + exifChunkSize + padByte)
  exifChunk.set([0x45, 0x58, 0x49, 0x46], 0) // 'EXIF'
  const chunkView = new DataView(exifChunk.buffer)
  chunkView.setUint32(4, exifChunkSize, true)
  exifChunk.set(exifPayload, 8)

  const u8 = webpBuffer instanceof Uint8Array ? webpBuffer : new Uint8Array(webpBuffer)

  // Validate RIFF header and WEBP signature
  const isRIFF = u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46
  const isWEBP = u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50
  if (!isRIFF || !isWEBP) {
    throw new Error('Not a valid WebP image')
  }

  // Check first chunk FourCC after WEBP at byte offset 12
  const chunkFourCC = String.fromCharCode(u8[12], u8[13], u8[14], u8[15])
  let output: Uint8Array

  if (chunkFourCC === 'VP8X') {
    // Already an extended WebP. Enable EXIF flag (bit 3 / 0x08)
    const newU8 = new Uint8Array(u8)
    newU8[20] |= 0x08

    output = new Uint8Array(newU8.length + exifChunk.length)
    output.set(newU8, 0)
    output.set(exifChunk, newU8.length)
  } else {
    // Basic WebP (VP8 or VP8L). Convert to Extended WebP by injecting VP8X chunk
    const vp8xChunk = new Uint8Array(18)
    vp8xChunk.set([0x56, 0x50, 0x38, 0x58], 0) // 'VP8X'
    const vView = new DataView(vp8xChunk.buffer)
    vView.setUint32(4, 10, true) // Chunk payload size is 10 bytes

    // Flags: bit 3 (EXIF = 0x08) + bit 4 (Alpha = 0x10)
    vp8xChunk[8] = 0x08 | 0x10

    // Canvas width - 1 (24-bit uint LE, bytes 12..14)
    const wVal = Math.max(0, width - 1)
    vView.setUint16(12, wVal & 0xffff, true)
    vp8xChunk[14] = (wVal >> 16) & 0xff

    // Canvas height - 1 (24-bit uint LE, bytes 15..17)
    const hVal = Math.max(0, height - 1)
    vView.setUint16(15, hVal & 0xffff, true)
    vp8xChunk[17] = (hVal >> 16) & 0xff

    output = new Uint8Array(12 + vp8xChunk.length + (u8.length - 12) + exifChunk.length)
    output.set(u8.subarray(0, 12), 0) // RIFF + size + WEBP
    output.set(vp8xChunk, 12)          // Injected VP8X
    output.set(u8.subarray(12), 12 + vp8xChunk.length) // Original image chunks
    output.set(exifChunk, 12 + vp8xChunk.length + (u8.length - 12)) // Appended EXIF
  }

  // Update total RIFF file size (totalLength - 8)
  const outView = new DataView(output.buffer)
  outView.setUint32(4, output.length - 8, true)

  return output
}

/**
 * Converts a 512x512 Canvas into a WhatsApp-ready WebP Blob with injected EXIF metadata
 */
export async function createWhatsAppStickerBlob(
  canvas: HTMLCanvasElement,
  metadata: WhatsAppStickerMetadata = {},
  quality: number = 0.88
): Promise<{ blob: Blob; sizeBytes: number }> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (rawBlob) => {
        if (!rawBlob) {
          reject(new Error('Failed to create WebP from canvas'))
          return
        }

        try {
          const buffer = await rawBlob.arrayBuffer()
          const outputBytes = addWhatsAppStickerExif(buffer, metadata, canvas.width, canvas.height)
          const finalBlob = new Blob([outputBytes as any], { type: 'image/webp' })
          resolve({
            blob: finalBlob,
            sizeBytes: finalBlob.size
          })
        } catch (err) {
          reject(err)
        }
      },
      'image/webp',
      quality
    )
  })
}
