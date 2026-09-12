'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Mic, Send, MapPin } from 'lucide-react'
import { SCRIPTED_PHOTO_NOTE } from '@/lib/classify-demo'

const MAX_DIMENSION = 1280

export function PhotoCapture({
  onSubmit,
}: {
  onSubmit: (photoDataUrl: string, note: string) => void
}) {
  const [cameraReady, setCameraReady] = useState(false)
  const [note, setNote] = useState('')
  const [listening, setListening] = useState(false)
  const [flash, setFlash] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const listenTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let active = true
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setCameraReady(true)
      } catch {
        // Demo fallback: no camera available (or blocked). Show a styled
        // viewfinder placeholder so the flow still demos for judging.
        setCameraReady(false)
      }
    }
    void start()
    return () => {
      active = false
      listenTimer.current && clearTimeout(listenTimer.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function captureFrame(): string {
    const video = videoRef.current
    if (video && cameraReady && video.videoWidth > 0) {
      const scale = Math.min(
        1,
        MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight),
      )
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        return canvas.toDataURL('image/jpeg', 0.85)
      }
    }
    return ''
  }

  function toggleMic() {
    if (listening) return
    // Demo mode: simulate speech-to-text by filling the note with a scripted
    // phrase. On a real device this is where live transcription would land.
    setListening(true)
    listenTimer.current = setTimeout(() => {
      setNote((n) => (n.trim() ? `${n.trim()} ${SCRIPTED_PHOTO_NOTE}` : SCRIPTED_PHOTO_NOTE))
      setListening(false)
    }, 1600)
  }

  function handleSend() {
    const dataUrl = captureFrame()
    setFlash(true)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    onSubmit(dataUrl, note.trim())
  }

  return (
    <div className="fixed inset-0 z-10 overflow-hidden bg-neutral-950">
      {/* Live camera viewfinder */}
      <video
        ref={videoRef}
        playsInline
        muted
        aria-label="Camera viewfinder"
        className={`absolute inset-0 size-full object-cover ${cameraReady ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Fallback viewfinder when no camera is available */}
      {!cameraReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-neutral-800 to-neutral-950 text-neutral-400">
          <Camera className="size-16" aria-hidden="true" />
          <span className="text-sm">Camera preview</span>
        </div>
      )}

      {/* Shutter flash on capture */}
      {flash && <span className="absolute inset-0 bg-white/80" aria-hidden="true" />}

      {/* Top overlay: branding + detected-location pill */}
      <div className="absolute inset-x-0 top-0 flex flex-col gap-3 bg-gradient-to-b from-black/50 to-transparent px-4 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <span className="text-lg font-extrabold tracking-tight text-white">CityPin</span>
          <span className="ml-auto rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            LA 311
          </span>
        </div>
        <div className="flex justify-center">
          <span className="flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
            <MapPin className="size-3.5" aria-hidden="true" />
            Museum of Contemporary Art
          </span>
        </div>
      </div>

      {/* Helper hint */}
      <p className="pointer-events-none absolute inset-x-0 top-28 px-8 text-center text-sm text-white/70 text-pretty">
        Point at the issue, add a note by typing or speaking, then send.
      </p>

      {/* Bottom text-entry bar with speak option */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8">
        {listening && (
          <p
            className="mb-2 text-center text-sm font-medium text-white"
            aria-live="polite"
          >
            <span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-red-500 align-middle" />
            Listening…
          </p>
        )}
        <div className="mx-auto flex w-full max-w-md items-center gap-2 rounded-full bg-black/50 p-1.5 pl-2 backdrop-blur">
          <button
            type="button"
            onClick={toggleMic}
            aria-label="Speak your note"
            aria-pressed={listening}
            className={`flex size-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40 ${
              listening
                ? 'bg-red-500 text-white'
                : 'bg-white/15 text-white hover:bg-white/25'
            }`}
          >
            <Mic className="size-5" aria-hidden="true" />
          </button>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note…"
            aria-label="Add a note about the issue"
            className="min-w-0 flex-1 bg-transparent px-1 text-base text-white placeholder:text-white/60 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSend}
            aria-label="Send report"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
          >
            <Send className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
