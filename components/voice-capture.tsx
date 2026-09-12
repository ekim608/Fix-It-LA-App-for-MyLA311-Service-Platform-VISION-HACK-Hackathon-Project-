'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, Square, TriangleAlert, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Phase = 'idle' | 'recording' | 'transcribing' | 'error'

export function VoiceCapture({
  onTranscript,
}: {
  onTranscript: (text: string) => void
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [manual, setManual] = useState('')

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      timerRef.current && clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })
        void transcribe(blob)
      }
      recorder.start()
      mediaRef.current = recorder
      setPhase('recording')
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch {
      setError(
        'Microphone access was blocked. Allow the microphone, or type your report below.',
      )
      setPhase('error')
    }
  }

  function stopRecording() {
    timerRef.current && clearInterval(timerRef.current)
    mediaRef.current?.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    setPhase('transcribing')
  }

  async function transcribe(blob: Blob) {
    try {
      const form = new FormData()
      form.append('audio', blob, 'report.webm')
      const res = await fetch('/api/transcribe', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok || !data.text) {
        throw new Error(data.error || 'No speech detected.')
      }
      onTranscript(String(data.text).trim())
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not understand the audio. Please try again or type below.',
      )
      setPhase('error')
    }
  }

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(
    seconds % 60,
  ).padStart(2, '0')}`

  return (
    <div className="flex flex-col items-center gap-8 pt-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Describe the problem</h1>
        <p className="max-w-xs text-pretty text-muted-foreground">
          Tap the mic and say what you see — like &ldquo;there&apos;s a couch dumped on the
          sidewalk.&rdquo;
        </p>
      </div>

      <div className="relative flex size-48 items-center justify-center">
        {phase === 'recording' && (
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        )}
        <button
          type="button"
          onClick={
            phase === 'recording'
              ? stopRecording
              : phase === 'transcribing'
                ? undefined
                : startRecording
          }
          disabled={phase === 'transcribing'}
          aria-label={phase === 'recording' ? 'Stop recording' : 'Start recording'}
          className="relative flex size-40 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50 disabled:opacity-70"
        >
          {phase === 'recording' ? (
            <Square className="size-14 fill-current" aria-hidden="true" />
          ) : phase === 'transcribing' ? (
            <span className="size-12 animate-spin rounded-full border-4 border-primary-foreground/30 border-t-primary-foreground" />
          ) : (
            <Mic className="size-16" aria-hidden="true" />
          )}
        </button>
      </div>

      <p className="min-h-6 text-lg font-medium tabular-nums" aria-live="polite">
        {phase === 'recording' && (
          <span className="font-mono text-primary">{mmss} · Listening…</span>
        )}
        {phase === 'transcribing' && <span>Transcribing your report…</span>}
        {phase === 'idle' && <span className="text-muted-foreground">Tap to start</span>}
      </p>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {(phase === 'idle' || phase === 'error') && (
        <div className="flex w-full flex-col gap-3">
          {phase === 'error' && (
            <Button
              variant="outline"
              size="lg"
              onClick={startRecording}
              className="h-12 w-full"
            >
              <RotateCcw className="size-5" /> Try recording again
            </Button>
          )}
          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or type it
            <span className="h-px flex-1 bg-border" />
          </div>
          <textarea
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            rows={3}
            placeholder="Describe the issue…"
            className="w-full resize-none rounded-xl border border-input bg-card p-4 text-base outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
          />
          <Button
            size="lg"
            className="h-12 w-full text-base"
            disabled={manual.trim().length < 3}
            onClick={() => onTranscript(manual.trim())}
          >
            Continue
          </Button>
        </div>
      )}
    </div>
  )
}
