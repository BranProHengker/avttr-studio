import QRCode from 'qrcode'

export type ArtisticStyle = 'lines' | 'isometric' | 'radar' | 'circuit' | 'halftone' | 'diamond'
export type AnchorStyle = 'square' | 'circle' | 'rounded' | 'minimal'
export type LineDirection = 'horizontal' | 'vertical' | 'interlock'

export interface ArtisticQrOptions {
  text: string
  style: ArtisticStyle
  anchorStyle: AnchorStyle
  lineDirection?: LineDirection
  fgColor: string
  bgColor: string
  anchorColor?: string
  isTransparentBg?: boolean
  useGradient?: boolean
  gradientColor2?: string
  size?: number
  margin?: number
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
  dotScale?: number
  cubeHeight?: number
}

export function isFinderPattern(r: number, c: number, size: number): boolean {
  if (r < 7 && c < 7) return true
  if (r < 7 && c >= size - 7) return true
  if (r >= size - 7 && c < 7) return true
  return false
}

export function isFinderOrSeparator(r: number, c: number, size: number): boolean {
  if (r <= 7 && c <= 7) return true
  if (r <= 7 && c >= size - 8) return true
  if (r >= size - 8 && c <= 7) return true
  return false
}

export function adjustBrightness(hex: string, percent: number): string {
  const cleanHex = hex.replace('#', '')
  if (cleanHex.length !== 6 && cleanHex.length !== 3) return hex
  const fullHex = cleanHex.length === 3
    ? cleanHex.split('').map((c) => c + c).join('')
    : cleanHex

  const num = parseInt(fullHex, 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + Math.round(255 * (percent / 100))))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100))))
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + Math.round(255 * (percent / 100))))

  return `#${(0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

export function useArtisticQr() {
  const generateArtisticSvg = (options: ArtisticQrOptions): string => {
    const {
      text = 'https://github.com/BranProHengker/avttr-studio',
      style = 'lines',
      anchorStyle = 'rounded',
      lineDirection = 'horizontal',
      fgColor = '#000000',
      bgColor = '#ffffff',
      anchorColor = '',
      isTransparentBg = false,
      useGradient = false,
      gradientColor2 = '#4F46E5',
      size = 400,
      margin = 2,
      errorCorrectionLevel = 'M',
      dotScale = 0.88,
      cubeHeight = 8,
    } = options

    const qr = QRCode.create(text || 'https://avttr.studio', {
      errorCorrectionLevel,
    })

    const matrixSize = qr.modules.size
    const effectiveMargin = Math.max(1, margin)
    const totalCells = matrixSize + effectiveMargin * 2
    const cellW = size / totalCells
    const actualAnchorColor = anchorColor || fgColor
    const effectiveBg = isTransparentBg ? 'none' : bgColor

    // Helper to get module status
    const isDark = (r: number, c: number): boolean => {
      if (r < 0 || r >= matrixSize || c < 0 || c >= matrixSize) return false
      return !!qr.modules.get(r, c)
    }

    let defsMarkup = ''
    if (useGradient) {
      defsMarkup = `
        <defs>
          <linearGradient id="artisticQrGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${fgColor}" />
            <stop offset="100%" stop-color="${gradientColor2}" />
          </linearGradient>
        </defs>
      `
    }
    const fillAttr = useGradient ? 'url(#artisticQrGrad)' : fgColor

    let dataElements = ''

    // 1. FLUID CONNECTING LINES (A2 Style)
    if (style === 'lines') {
      const radius = (cellW * dotScale) / 2

      if (lineDirection === 'horizontal' || lineDirection === 'interlock') {
        for (let r = 0; r < matrixSize; r++) {
          const isRowInterlockVertical = lineDirection === 'interlock' && r % 2 === 1
          if (isRowInterlockVertical) continue

          let c = 0
          while (c < matrixSize) {
            if (isDark(r, c) && !isFinderPattern(r, c, matrixSize)) {
              let startC = c
              while (c + 1 < matrixSize && isDark(r, c + 1) && !isFinderPattern(r, c + 1, matrixSize)) {
                c++
              }
              const endC = c
              const length = endC - startC + 1
              const x = (startC + effectiveMargin) * cellW + (cellW - cellW * dotScale) / 2
              const y = (r + effectiveMargin) * cellW + (cellW - cellW * dotScale) / 2
              const width = length * cellW - (cellW - cellW * dotScale)
              const height = cellW * dotScale

              dataElements += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}" rx="${radius.toFixed(2)}" ry="${radius.toFixed(2)}" fill="${fillAttr}" />\n`
            }
            c++
          }
        }
      }

      if (lineDirection === 'vertical' || lineDirection === 'interlock') {
        for (let c = 0; c < matrixSize; c++) {
          let r = 0
          while (r < matrixSize) {
            const isColInterlockSkipped = lineDirection === 'interlock' && r % 2 === 0
            if (!isColInterlockSkipped && isDark(r, c) && !isFinderPattern(r, c, matrixSize)) {
              let startR = r
              while (r + 1 < matrixSize && (lineDirection !== 'interlock' || (r + 1) % 2 === 1) && isDark(r + 1, c) && !isFinderPattern(r + 1, c, matrixSize)) {
                r++
              }
              const endR = r
              const length = endR - startR + 1
              const x = (c + effectiveMargin) * cellW + (cellW - cellW * dotScale) / 2
              const y = (startR + effectiveMargin) * cellW + (cellW - cellW * dotScale) / 2
              const width = cellW * dotScale
              const height = length * cellW - (cellW - cellW * dotScale)

              dataElements += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}" rx="${radius.toFixed(2)}" ry="${radius.toFixed(2)}" fill="${fillAttr}" />\n`
            }
            r++
          }
        }
      }
    }

    // 2. ISOMETRIC 3D CUBES (SP-1 Style)
    else if (style === 'isometric') {
      const topColor = fillAttr
      const leftShadow = adjustBrightness(fgColor, -30)
      const rightShadow = adjustBrightness(fgColor, -15)
      const h = cubeHeight

      for (let r = 0; r < matrixSize; r++) {
        for (let c = 0; c < matrixSize; c++) {
          if (isDark(r, c) && !isFinderPattern(r, c, matrixSize)) {
            const x = (c + effectiveMargin) * cellW
            const y = (r + effectiveMargin) * cellW
            const w = cellW * dotScale
            const pad = (cellW - w) / 2
            const bx = x + pad
            const by = y + pad

            // 3D Isometric block
            // Top face
            dataElements += `<rect x="${bx.toFixed(2)}" y="${(by - h).toFixed(2)}" width="${w.toFixed(2)}" height="${w.toFixed(2)}" rx="2" fill="${topColor}" />\n`
            // Front shadow face
            dataElements += `<polygon points="${bx.toFixed(2)},${(by - h + w).toFixed(2)} ${(bx + w).toFixed(2)},${(by - h + w).toFixed(2)} ${(bx + w).toFixed(2)},${(by + w).toFixed(2)} ${bx.toFixed(2)},${(by + w).toFixed(2)}" fill="${leftShadow}" opacity="0.9" />\n`
            // Side shadow edge
            dataElements += `<polygon points="${(bx + w).toFixed(2)},${(by - h).toFixed(2)} ${(bx + w + h * 0.4).toFixed(2)},${(by - h + h * 0.4).toFixed(2)} ${(bx + w + h * 0.4).toFixed(2)},${(by + w + h * 0.4).toFixed(2)} ${(bx + w).toFixed(2)},${(by + w).toFixed(2)}" fill="${rightShadow}" opacity="0.85" />\n`
          }
        }
      }
    }

    // 3. RADAR / CONCENTRIC ORBITS (B1 Style)
    else if (style === 'radar') {
      const centerR = matrixSize / 2
      const centerC = matrixSize / 2

      for (let r = 0; r < matrixSize; r++) {
        for (let c = 0; c < matrixSize; c++) {
          if (isDark(r, c) && !isFinderPattern(r, c, matrixSize)) {
            const cx = (c + effectiveMargin + 0.5) * cellW
            const cy = (r + effectiveMargin + 0.5) * cellW
            const dist = Math.hypot(r - centerR, c - centerC)
            const angle = Math.atan2(r - centerR, c - centerC)

            // Orbit pill segment or circular radar point
            const dotR = (cellW * dotScale * 0.5) * (0.8 + 0.3 * Math.sin(dist * 0.8))
            dataElements += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${dotR.toFixed(2)}" fill="${fillAttr}" />\n`

            // Occasional radial pulse beam lines connecting to nearby dots
            if ((r + c) % 4 === 0) {
              const nx = cx + Math.cos(angle) * (cellW * 0.7)
              const ny = cy + Math.sin(angle) * (cellW * 0.7)
              dataElements += `<line x1="${cx.toFixed(2)}" y1="${cy.toFixed(2)}" x2="${nx.toFixed(2)}" y2="${ny.toFixed(2)}" stroke="${fillAttr}" stroke-width="1.2" stroke-linecap="round" opacity="0.6" />\n`
            }
          }
        }
      }
    }

    // 4. CYBERPUNK CIRCUIT BOARD (Func Style)
    else if (style === 'circuit') {
      const nodeR = cellW * 0.32

      for (let r = 0; r < matrixSize; r++) {
        for (let c = 0; c < matrixSize; c++) {
          if (isDark(r, c) && !isFinderPattern(r, c, matrixSize)) {
            const cx = (c + effectiveMargin + 0.5) * cellW
            const cy = (r + effectiveMargin + 0.5) * cellW

            // Check neighbor connections (Right and Down)
            if (c + 1 < matrixSize && isDark(r, c + 1) && !isFinderPattern(r, c + 1, matrixSize)) {
              const ncx = (c + 1 + effectiveMargin + 0.5) * cellW
              dataElements += `<line x1="${cx.toFixed(2)}" y1="${cy.toFixed(2)}" x2="${ncx.toFixed(2)}" y2="${cy.toFixed(2)}" stroke="${fillAttr}" stroke-width="2.2" stroke-linecap="round" />\n`
            }
            if (r + 1 < matrixSize && isDark(r + 1, c) && !isFinderPattern(r + 1, c, matrixSize)) {
              const ncy = (r + 1 + effectiveMargin + 0.5) * cellW
              dataElements += `<line x1="${cx.toFixed(2)}" y1="${cy.toFixed(2)}" x2="${cx.toFixed(2)}" y2="${ncy.toFixed(2)}" stroke="${fillAttr}" stroke-width="2.2" stroke-linecap="round" />\n`
            }

            // Circuit solder pad (circle with inner ring)
            dataElements += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${nodeR.toFixed(2)}" fill="${fillAttr}" />\n`
            if ((r + c) % 3 === 0) {
              dataElements += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(nodeR * 0.45).toFixed(2)}" fill="${effectiveBg === 'none' ? '#ffffff' : effectiveBg}" />\n`
            }
          }
        }
      }
    }

    // 5. HALFTONE DOT MATRIX (C1 Style)
    else if (style === 'halftone') {
      for (let r = 0; r < matrixSize; r++) {
        for (let c = 0; c < matrixSize; c++) {
          if (isDark(r, c) && !isFinderPattern(r, c, matrixSize)) {
            const cx = (c + effectiveMargin + 0.5) * cellW
            const cy = (r + effectiveMargin + 0.5) * cellW
            // Optical halftone modulation
            const wave = 0.5 + 0.5 * Math.sin(r * 0.45 + c * 0.45)
            const radius = (cellW / 2) * (0.45 + 0.45 * wave) * dotScale

            dataElements += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${radius.toFixed(2)}" fill="${fillAttr}" />\n`
          }
        }
      }
    }

    // 6. DIAMOND CRYSTAL
    else if (style === 'diamond') {
      const dSize = (cellW * dotScale) / 2

      for (let r = 0; r < matrixSize; r++) {
        for (let c = 0; c < matrixSize; c++) {
          if (isDark(r, c) && !isFinderPattern(r, c, matrixSize)) {
            const cx = (c + effectiveMargin + 0.5) * cellW
            const cy = (r + effectiveMargin + 0.5) * cellW

            const pTop = `${cx.toFixed(2)},${(cy - dSize).toFixed(2)}`
            const pRight = `${(cx + dSize).toFixed(2)},${cy.toFixed(2)}`
            const pBottom = `${cx.toFixed(2)},${(cy + dSize).toFixed(2)}`
            const pLeft = `${(cx - dSize).toFixed(2)},${cy.toFixed(2)}`

            dataElements += `<polygon points="${pTop} ${pRight} ${pBottom} ${pLeft}" fill="${fillAttr}" />\n`
          }
        }
      }
    }

    // 7. FINDER ANCHORS (Eyes) RENDERING
    const renderAnchor = (startR: number, startC: number): string => {
      const x = (startC + effectiveMargin) * cellW
      const y = (startR + effectiveMargin) * cellW
      const boxSize = 7 * cellW
      const centerBoxSize = 3 * cellW
      const centerOffset = 2 * cellW

      // A. CLASSIC SQUARE ANCHOR
      if (anchorStyle === 'square') {
        const outerPad = cellW * 0.15
        const innerCutSize = 5 * cellW
        const innerCutOffset = cellW

        return `
          <g>
            <rect x="${(x + outerPad).toFixed(2)}" y="${(y + outerPad).toFixed(2)}" width="${(boxSize - 2 * outerPad).toFixed(2)}" height="${(boxSize - 2 * outerPad).toFixed(2)}" fill="${actualAnchorColor}" rx="3" />
            <rect x="${(x + innerCutOffset).toFixed(2)}" y="${(y + innerCutOffset).toFixed(2)}" width="${innerCutSize.toFixed(2)}" height="${innerCutSize.toFixed(2)}" fill="${effectiveBg === 'none' ? '#ffffff' : effectiveBg}" rx="2" />
            <rect x="${(x + centerOffset).toFixed(2)}" y="${(y + centerOffset).toFixed(2)}" width="${centerBoxSize.toFixed(2)}" height="${centerBoxSize.toFixed(2)}" fill="${actualAnchorColor}" rx="2" />
          </g>
        `
      }

      // B. PLANET / CONCENTRIC CIRCLE ANCHOR
      if (anchorStyle === 'circle') {
        const cx = x + boxSize / 2
        const cy = y + boxSize / 2
        const outerR = (boxSize / 2) * 0.94
        const midCutR = (boxSize / 2) * 0.68
        const innerR = (boxSize / 2) * 0.42

        return `
          <g>
            <circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${outerR.toFixed(2)}" fill="${actualAnchorColor}" />
            <circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${midCutR.toFixed(2)}" fill="${effectiveBg === 'none' ? '#ffffff' : effectiveBg}" />
            <circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${innerR.toFixed(2)}" fill="${actualAnchorColor}" />
          </g>
        `
      }

      // C. SMOOTH ROUNDED SQUIRCLE ANCHOR
      if (anchorStyle === 'rounded') {
        const outerRadius = cellW * 1.8
        const centerRadius = cellW * 1.1
        const innerCutSize = 5 * cellW
        const innerCutOffset = cellW

        return `
          <g>
            <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${boxSize.toFixed(2)}" height="${boxSize.toFixed(2)}" rx="${outerRadius.toFixed(2)}" fill="${actualAnchorColor}" />
            <rect x="${(x + innerCutOffset).toFixed(2)}" y="${(y + innerCutOffset).toFixed(2)}" width="${innerCutSize.toFixed(2)}" height="${innerCutSize.toFixed(2)}" rx="${(outerRadius * 0.7).toFixed(2)}" fill="${effectiveBg === 'none' ? '#ffffff' : effectiveBg}" rx="2" />
            <rect x="${(x + centerOffset).toFixed(2)}" y="${(y + centerOffset).toFixed(2)}" width="${centerBoxSize.toFixed(2)}" height="${centerBoxSize.toFixed(2)}" rx="${centerRadius.toFixed(2)}" fill="${actualAnchorColor}" />
          </g>
        `
      }

      // D. MINIMAL SLIM ANCHOR
      if (anchorStyle === 'minimal') {
        const outerThickness = cellW * 0.8
        const cx = x + boxSize / 2
        const cy = y + boxSize / 2

        return `
          <g>
            <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${boxSize.toFixed(2)}" height="${boxSize.toFixed(2)}" rx="${(cellW * 1.2).toFixed(2)}" fill="none" stroke="${actualAnchorColor}" stroke-width="${outerThickness.toFixed(2)}" />
            <circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(centerBoxSize * 0.45).toFixed(2)}" fill="${actualAnchorColor}" />
          </g>
        `
      }

      return ''
    }

    // Render 3 Anchors
    const anchorTopLeft = renderAnchor(0, 0)
    const anchorTopRight = renderAnchor(0, matrixSize - 7)
    const anchorBottomLeft = renderAnchor(matrixSize - 7, 0)

    // Complete SVG markup
    const svgMarkup = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        ${defsMarkup}
        ${effectiveBg !== 'none' ? `<rect width="100%" height="100%" fill="${effectiveBg}" />` : ''}
        <g id="artistic-data">
          ${dataElements}
        </g>
        <g id="artistic-anchors">
          ${anchorTopLeft}
          ${anchorTopRight}
          ${anchorBottomLeft}
        </g>
      </svg>
    `.trim()

    return svgMarkup
  }

  const exportSvgToPng = (svgMarkup: string, targetSize = 1000): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)

      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = targetSize
        canvas.height = targetSize
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(url)
          reject(new Error('Canvas context unavailable'))
          return
        }
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, targetSize, targetSize)
        URL.revokeObjectURL(url)

        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Failed to create PNG blob'))
        }, 'image/png')
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load SVG into image'))
      }

      img.src = url
    })
  }

  return {
    generateArtisticSvg,
    exportSvgToPng,
  }
}
