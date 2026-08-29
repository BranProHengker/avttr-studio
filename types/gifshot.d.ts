declare module 'gifshot' {
  interface GifshotOptions {
    images?: (string | HTMLCanvasElement | HTMLImageElement)[]
    video?: string[]
    gifWidth?: number
    gifHeight?: number
    interval?: number
    numFrames?: number
    frameDuration?: number
    sampleInterval?: number
    numWorkers?: number
    progressCallback?: (captureProgress: number) => void
    completeCallback?: () => void
  }

  interface GifshotResponse {
    error: boolean
    errorCode?: string
    errorMsg?: string
    image: string
  }

  export function createGIF(
    options: GifshotOptions,
    callback: (obj: GifshotResponse) => void
  ): void

  export function isSupported(): boolean
}
