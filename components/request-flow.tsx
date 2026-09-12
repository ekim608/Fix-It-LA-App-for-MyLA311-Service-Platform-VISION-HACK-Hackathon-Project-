'use client'

import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { PhotoCapture } from '@/components/photo-capture'
import { ReviewForm } from '@/components/review-form'
import { ConfirmationScreen } from '@/components/confirmation-screen'
import { getService } from '@/lib/services'
import { classifyDemoPhoto } from '@/lib/classify-demo'
import { emptyDraft } from '@/lib/types'
import type { DraftRequest, SubmitResult } from '@/lib/types'

type Step = 'photo' | 'classifying' | 'review' | 'done'

export function RequestFlow() {
  const [step, setStep] = useState<Step>('photo')
  const [draft, setDraft] = useState<DraftRequest>(emptyDraft('photo'))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SubmitResult | null>(null)

  function reset() {
    setDraft(emptyDraft('photo'))
    setError(null)
    setResult(null)
    setStep('photo')
  }

  function patchDraft(patch: Partial<DraftRequest>) {
    setDraft((d) => ({ ...d, ...patch }))
  }

  async function classify(input: { imageDataUrl?: string; note?: string }) {
    setStep('classifying')
    setError(null)
    const base: DraftRequest = {
      ...emptyDraft('photo'),
      description: input.note ?? '',
      photoDataUrl: input.imageDataUrl,
    }

    // Demo mode: the photo is classified locally so the flow needs no backend.
    // It is scripted to a pothole with the location resolved from GPS, and the
    // review form then opens pre-filled with the detected service.
    const c = classifyDemoPhoto(input.note)
    await new Promise((r) => setTimeout(r, 1100))
    const service = getService(c.serviceCode)
    setDraft({
      ...base,
      serviceCode: c.serviceCode,
      title: c.title || service?.name || '',
      description: c.description || base.description,
      confidence: c.confidence,
      address: c.extractedLocation || '',
      lat: c.lat,
      lng: c.lng,
      attributes: c.attributes,
    })
    setStep('review')
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

  const showBack = step === 'review' || step === 'classifying'

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="flex items-center gap-3 px-4 pb-2 pt-5">
        <button
          type="button"
          onClick={reset}
          aria-label="Back to camera"
          className={`flex size-10 items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50 ${
            showBack ? '' : 'invisible'
          }`}
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>
        <span className="text-lg font-extrabold tracking-tight">CityPin</span>
        <span className="ml-auto rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
          LA 311
        </span>
      </header>

      <main className="flex-1 px-4 pb-10 pt-2">
        {step === 'photo' && (
          <PhotoCapture
            onSubmit={(dataUrl, note) =>
              classify({ imageDataUrl: dataUrl, note })
            }
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
