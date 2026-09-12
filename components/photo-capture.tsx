'use client'

import { useRef, useState } from 'react'
import { Camera, ImageUp, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

const MAX_DIMENSION = 1280
const MAX_BYTES = 8 * 1024 * 1024

export function PhotoCapture({
  onPhoto,
}: {
  onPhoto: (dataUrl: string) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    if (file.size > MAX_BYTES) {
      setError('That image is too large. Please choose one under 8MB.')
      return
    }
    setBusy(true)
    try {
      const dataUrl = await downscale(file)
      onPhoto(dataUrl)
    } catch {
      setError('Could not read that image. Please try another photo.')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-8 pt-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Show us the issue</h1>
        <p className="max-w-xs text-pretty text-muted-foreground">
          Take a clear photo of the problem. We&apos;ll identify it and start the right
          311 request.
        </p>
      </div>

      <div className="flex size-48 items-center justify-center rounded-full bg-accent/25 text-accent-foreground">
        {busy ? (
          <span className="size-12 animate-spin rounded-full border-4 border-accent-foreground/30 border-t-accent-foreground" />
        ) : (
          <Camera className="size-20" aria-hidden="true" />
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex w-full flex-col gap-3">
        <Button
          size="lg"
          className="h-14 w-full text-base"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
        >
          <Camera className="size-5" /> Take a photo
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="h-14 w-full text-base"
          disabled={busy}
          onClick={() => libraryRef.current?.click()}
        >
          <ImageUp className="size-5" /> Choose from library
        </Button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  )
}

async function downscale(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas context')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}
