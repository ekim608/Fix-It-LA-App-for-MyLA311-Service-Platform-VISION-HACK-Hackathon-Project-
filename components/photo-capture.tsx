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
  const [locationLabel, setLocationLabel] = useState('Locating…')

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const listenTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recognitionRef = useRef<any>(null)
  // Note text captured before the current dictation started, so live interim
  // results append to it instead of overwriting what the user already typed.
  const baseNoteRef = useRef('')

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
      try {
        recognitionRef.current?.stop()
      } catch {}
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // Resolve the device's real location for the top pill, reverse-geocoded to a
  // readable place/street. Falls back to a demo label if it's unavailable.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationLabel('Museum of Contemporary Art')
      return
    }
    let active = true
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        try {
          const res = await fetch(`/api/geocode?lat=${latitude}&lon=${longitude}`)
          const data = (await res.json()) as { address?: string | null }
          if (!active) return
          if (data.address) {
            // Nominatim returns a long comma-joined string; keep the first
            // few, most specific parts for a compact pill.
            const short = data.address.split(',').slice(0, 3).join(',').trim()
            setLocationLabel(short)
          } else {
            setLocationLabel(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`)
          }
        } catch {
          if (active) setLocationLabel(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`)
        }
      },
      () => {
        if (active) setLocationLabel('Museum of Contemporary Art')
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    )
    return () => {
      active = false
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

  function startScriptedFallback() {
    // Used only when the browser has no Web Speech API (e.g. the headless
    // preview or unsupported browsers) so the demo still works.
    setListening(true)
    listenTimer.current = setTimeout(() => {
      setNote((n) => (n.trim() ? `${n.trim()} ${SCRIPTED_PHOTO_NOTE}` : SCRIPTED_PHOTO_NOTE))
      setListening(false)
    }, 1600)
  }

  function toggleMic() {
    // Stop if already listening.
    if (listening) {
      try {
        recognitionRef.current?.stop()
      } catch {}
      listenTimer.current && clearTimeout(listenTimer.current)
      setListening(false)
      return
    }

    const SpeechRecognition =
      typeof window !== 'undefined' &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

    // No live speech support: fall back to the scripted note.
    if (!SpeechRecognition) {
      startScriptedFallback()
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    // Non-continuous mode ends recognition automatically after the user
    // pauses, so the mic stops on its own when they're done talking.
    recognition.continuous = false
    recognition.interimResults = true

    baseNoteRef.current = note.trim()

    recognition.onresult = (event: any) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      const base = baseNoteRef.current
      const combined = base ? `${base} ${transcript}` : transcript
      setNote(combined.replace(/\s+/g, ' ').trimStart())

      // Safety net: if the browser keeps the stream open, stop after a short
      // silence gap following the latest speech so it doesn't listen forever.
      listenTimer.current && clearTimeout(listenTimer.current)
      listenTimer.current = setTimeout(() => {
        try {
          recognition.stop()
        } catch {}
      }, 2500)
    }
    recognition.onerror = () => {
      listenTimer.current && clearTimeout(listenTimer.current)
      setListening(false)
    }
    recognition.onend = () => {
      listenTimer.current && clearTimeout(listenTimer.current)
      setListening(false)
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      startScriptedFallback()
    }
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
          <span className="flex max-w-[80%] items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{locationLabel}</span>
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
