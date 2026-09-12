'use client'

import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { PhotoCapture } from '@/components/photo-capture'
import { ReviewForm } from '@/components/review-form'
import { ConfirmationScreen } from '@/components/confirmation-screen'
import { getService } from '@/lib/services'
import { classifyDemoPhoto, DEMO_GPS } from '@/lib/classify-demo'
import { emptyDraft } from '@/lib/types'
import type { DraftRequest, SubmitResult } from '@/lib/types'

type Step = 'photo' | 'classifying' | 'review' | 'done'

type ResolvedLocation = { address: string; lat: number | null; lng: number | null }

/** Turn a place/landmark the user mentioned in their report into a real LA
 *  street address with coordinates. Returns null if nothing matches. */
async function geocodePrompt(place: string): Promise<ResolvedLocation | null> {
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(place)}`)
    const data = await res.json()
    if (!data.address) return null
    return {
      address: data.address as string,
      lat: typeof data.lat === 'number' ? data.lat : null,
      lng: typeof data.lng === 'number' ? data.lng : null,
    }
  } catch {
    return null
  }
}

/** Read the device's real GPS position, then reverse geocode it to a street
 *  address. Returns null if the user denies permission or it is unavailable,
 *  so the caller can fall back. */
async function resolveDeviceLocation(): Promise<ResolvedLocation | null> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return null
  }
  const position = await new Promise<GeolocationPosition | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  })
  if (!position) return null

  const lat = position.coords.latitude
  const lng = position.coords.longitude
  let address = ''
  try {
    const res = await fetch(`/api/geocode?lat=${lat}&lon=${lng}`)
    const data = await res.json()
    if (data.address) address = data.address as string
  } catch {
    // Non-fatal: keep the raw coordinates; the user can type the address.
  }
  return { address, lat, lng }
}

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

    // Demo mode: the note is classified locally so the flow needs no backend.
    // Location priority: (1) a place the user named in their report, resolved
    // to a real LA street address; (2) the device's actual GPS position; and
    // only then (3) the demo fallback.
    const c = classifyDemoPhoto(input.note)
    const [promptLoc, deviceLoc] = await Promise.all([
      c.extractedLocation ? geocodePrompt(c.extractedLocation) : Promise.resolve(null),
      resolveDeviceLocation(),
      new Promise((r) => setTimeout(r, 1100)),
    ])
    const service = getService(c.serviceCode)
    const resolved = promptLoc ??
      deviceLoc ?? {
        address: c.extractedLocation ?? DEMO_GPS.address,
        lat: DEMO_GPS.lat,
        lng: DEMO_GPS.lng,
      }
    setDraft({
      ...base,
      serviceCode: c.serviceCode,
      title: c.title || service?.name || '',
      description: c.description || base.description,
      confidence: c.confidence,
      address: resolved.address || c.extractedLocation || '',
      lat: resolved.lat,
      lng: resolved.lng,
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

  // The camera is a full-screen surface with its own overlay branding, so it
  // renders outside the centered app shell used by the other steps.
  if (step === 'photo') {
    return (
      <PhotoCapture
        onSubmit={(dataUrl, note) => classify({ imageDataUrl: dataUrl, note })}
      />
    )
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="flex items-center gap-3 px-4 pb-2 pt-5">
        <button
          type="button"
          onClick={reset}
          aria-label="Back to camera"
          className="flex size-10 items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>
        <span className="text-lg font-extrabold tracking-tight">CityPin</span>
        <span className="ml-auto rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
          LA 311
        </span>
      </header>

      <main className="flex-1 px-4 pb-10 pt-2">
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
