'use client'

import { CheckCircle2, FlaskConical, MapPin, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ServiceIcon } from '@/components/service-icon'
import { getService } from '@/lib/services'
import type { DraftRequest, SubmitResult } from '@/lib/types'

export function ConfirmationScreen({
  draft,
  result,
  onDone,
}: {
  draft: DraftRequest
  result: SubmitResult
  onDone: () => void
}) {
  const service = getService(draft.serviceCode)
  const [copied, setCopied] = useState(false)

  function copyId() {
    if (!result.serviceRequestId) return
    void navigator.clipboard?.writeText(result.serviceRequestId).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex flex-col items-center gap-6 pt-6 text-center">
      <span className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CheckCircle2 className="size-12" aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-balance">Request submitted</h1>
        <p className="max-w-xs text-pretty text-muted-foreground">{result.message}</p>
      </div>

      {result.serviceRequestId && (
        <button
          type="button"
          onClick={copyId}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
        >
          <span className="flex flex-col">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Confirmation number
            </span>
            <span className="font-mono text-lg font-semibold">
              {result.serviceRequestId}
            </span>
          </span>
          {copied ? (
            <Check className="size-5 text-primary" aria-hidden="true" />
          ) : (
            <Copy className="size-5 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="sr-only">Copy confirmation number</span>
        </button>
      )}

      {result.simulated && (
        <div className="flex items-start gap-3 rounded-xl border border-accent/40 bg-accent/15 p-4 text-left text-sm text-accent-foreground">
          <FlaskConical className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <span>
            <strong className="font-semibold">Demo mode.</strong> This request
            wasn&apos;t sent to the real 311 system. Connect the LA 311 API key to
            submit live requests.
          </span>
        </div>
      )}

      <div className="w-full rounded-xl border border-border bg-card p-4 text-left">
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
            <ServiceIcon name={service?.icon ?? 'CircleHelp'} className="size-5" />
          </span>
          <span className="font-semibold">{service?.name ?? 'Service request'}</span>
        </div>
        <p className="pt-3 text-sm leading-relaxed text-muted-foreground">
          {draft.description}
        </p>
        {draft.address && (
          <p className="flex items-center gap-1.5 pt-2 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            {draft.address}
          </p>
        )}
      </div>

      <Button size="lg" className="h-14 w-full text-base" onClick={onDone}>
        Report another issue
      </Button>
    </div>
  )
}
