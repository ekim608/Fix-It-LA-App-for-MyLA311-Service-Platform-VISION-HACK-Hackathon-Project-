'use client'

import { useState } from 'react'
import { ArrowLeft, MapPin } from 'lucide-react'
import { HomeScreen } from '@/components/home-screen'
import { VoiceCapture } from '@/components/voice-capture'
import { PhotoCapture } from '@/components/photo-capture'
import { ReviewForm } from '@/components/review-form'
import { ConfirmationScreen } from '@/components/confirmation-screen'
import { getService } from '@/lib/services'
import { emptyDraft } from '@/lib/types'
import type {
  CaptureSource,
  Classification,
  DraftRequest,
  SubmitResult,
} from '@/lib/types'

type Step = 'home' | 'voice' | 'photo' | 'classifying' | 'review' | 'done'

export function RequestFlow() {
  const [step, setStep] = useState<Step>('home')
  const [draft, setDraft] = useState<DraftRequest>(emptyDraft('browse'))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SubmitResult | null>(null)

  function reset() {
    setDraft(emptyDraft('browse'))
    setError(null)
    setResult(null)
    setStep('home')
  }

  function patchDraft(patch: Partial<DraftRequest>) {
    setDraft((d) => ({ ...d, ...patch }))
  }

  function pickService(code: string) {
    const service = getService(code)
    setDraft({
      ...emptyDraft('browse'),
      serviceCode: code,
      title: service?.name ?? '',
    })
    setStep('review')
  }

  async function classify(input: {
    source: CaptureSource
    text?: string
    imageDataUrl?: string
  }) {
    setStep('classifying')
    setError(null)
    const base: DraftRequest = {
      ...emptyDraft(input.source),
      description: input.text ?? '',
      transcript: input.source === 'voice' ? input.text : undefined,
      photoDataUrl: input.imageDataUrl,
    }
    try {
      const res = await fetch('/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: input.text,
          imageDataUrl: input.imageDataUrl,
        }),
      })
      const data = (await res.json()) as Partial<Classification> & { error?: string }
      if (!res.ok || !data.serviceCode) {
        throw new Error(data.error || 'Could not classify the report.')
      }
      const service = getService(data.serviceCode)
      setDraft({
        ...base,
        serviceCode: data.serviceCode,
        title: data.title || service?.name || '',
        description: data.description || base.description,
        confidence: data.confidence ?? null,
        address: data.extractedLocation || '',
      })
      setStep('review')
    } catch (err) {
      // Fall back to manual review so the user is never stuck.
      setDraft({ ...base, serviceCode: 'OTHER', confidence: 0 })
      setError(
        err instanceof Error
          ? `${err.message} You can still pick the service yourself below.`
          : 'Something went wrong. Please choose the service below.',
      )
      setStep('review')
    }
  }

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const data = (await res.json()) as SubmitResult & { error?: string }
      if (!res.ok || !data.status) {
        throw new Error(data.error || 'The city system did not accept the request.')
      }
      setResult(data)
      setStep('done')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not submit right now. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const showBack = step !== 'home' && step !== 'done'

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="flex items-center gap-3 px-4 pb-2 pt-5">
        {showBack ? (
          <button
            type="button"
            onClick={reset}
            aria-label="Back to start"
            className="flex size-10 items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </button>
        ) : (
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <MapPin className="size-5" aria-hidden="true" />
          </span>
        )}
        <span className="text-lg font-extrabold tracking-tight">CityPin</span>
        <span className="ml-auto rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
          LA 311
        </span>
      </header>

      <main className="flex-1 px-4 pb-10 pt-2">
        {step === 'home' && (
          <HomeScreen
            onVoice={() => {
              setDraft(emptyDraft('voice'))
              setStep('voice')
            }}
            onPhoto={() => {
              setDraft(emptyDraft('photo'))
              setStep('photo')
            }}
            onPickService={pickService}
          />
        )}

        {step === 'voice' && (
          <VoiceCapture
            onTranscript={(text) => classify({ source: 'voice', text })}
          />
        )}

        {step === 'photo' && (
          <PhotoCapture
            onPhoto={(dataUrl) => classify({ source: 'photo', imageDataUrl: dataUrl })}
          />
        )}

        {step === 'classifying' && (
          <div className="flex flex-col items-center gap-6 pt-24 text-center">
            <span className="size-14 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <div className="flex flex-col gap-1">
              <p className="text-lg font-semibold">Finding the right 311 request…</p>
              <p className="text-muted-foreground">This takes just a moment.</p>
            </div>
          </div>
        )}

        {step === 'review' && (
          <ReviewForm
            draft={draft}
            onChange={patchDraft}
            onSubmit={submit}
            submitting={submitting}
            error={error}
          />
        )}

        {step === 'done' && result && (
          <ConfirmationScreen draft={draft} result={result} onDone={reset} />
        )}
      </main>
    </div>
  )
}
