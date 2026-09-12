'use client'

import { useState } from 'react'
import { Send, Sparkles, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LocationPicker } from '@/components/location-picker'
import { ServiceIcon } from '@/components/service-icon'
import { SERVICES, getService } from '@/lib/services'
import type { DraftRequest } from '@/lib/types'

export function ReviewForm({
  draft,
  onChange,
  onSubmit,
  submitting,
  error,
}: {
  draft: DraftRequest
  onChange: (patch: Partial<DraftRequest>) => void
  onSubmit: () => void
  submitting: boolean
  error: string | null
}) {
  const [contactOpen, setContactOpen] = useState(false)
  const service = getService(draft.serviceCode)

  const locationValid = Boolean(
    draft.address.trim() || (draft.lat != null && draft.lng != null),
  )
  const canSubmit =
    draft.serviceCode && draft.description.trim().length >= 5 && locationValid && !submitting

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Review your request</h1>
        <p className="text-muted-foreground">
          Check the details and edit anything before sending it to LA 311.
        </p>
      </div>

      {draft.source !== 'browse' && draft.confidence != null && (
        <div className="flex items-center gap-2 rounded-xl bg-accent/20 px-4 py-3 text-sm text-accent-foreground">
          <Sparkles className="size-4 shrink-0" aria-hidden="true" />
          <span>
            Auto-detected from your {draft.source === 'voice' ? 'voice report' : 'photo'}.
            Please confirm it&apos;s right.
          </span>
        </div>
      )}

      {draft.photoDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={draft.photoDataUrl || '/placeholder.svg'}
          alt="The issue you photographed"
          className="max-h-56 w-full rounded-xl border border-border object-cover"
        />
      )}

      <Field label="Service type" htmlFor="serviceCode">
        <div className="relative">
          {service && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary">
              <ServiceIcon name={service.icon} className="size-5" />
            </span>
          )}
          <select
            id="serviceCode"
            value={draft.serviceCode}
            onChange={(e) => onChange({ serviceCode: e.target.value, attributes: {} })}
            className="w-full appearance-none rounded-xl border border-input bg-card py-3 pl-11 pr-9 text-base outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
          >
            <option value="" disabled>
              Choose a service…
            </option>
            {SERVICES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            ▾
          </span>
        </div>
        {service && (
          <p className="px-1 text-sm text-muted-foreground">{service.summary}</p>
        )}
      </Field>

      <Field label="Description" htmlFor="description">
        <textarea
          id="description"
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={4}
          placeholder="Describe the issue in a sentence or two…"
          className="w-full resize-none rounded-xl border border-input bg-card p-4 text-base outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
        />
      </Field>

      {service?.fields?.length ? (
        <div className="flex flex-col gap-4">
          {service.fields.map((f) => (
            <Field key={f.key} label={f.label} htmlFor={`attr-${f.key}`}>
              {f.type === 'select' ? (
                <select
                  id={`attr-${f.key}`}
                  value={draft.attributes[f.key] ?? ''}
                  onChange={(e) =>
                    onChange({
                      attributes: { ...draft.attributes, [f.key]: e.target.value },
                    })
                  }
                  className="w-full appearance-none rounded-xl border border-input bg-card p-3 text-base outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
                >
                  <option value="">Select…</option>
                  {f.options?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`attr-${f.key}`}
                  type={f.type === 'number' ? 'number' : 'text'}
                  inputMode={f.type === 'number' ? 'numeric' : undefined}
                  value={draft.attributes[f.key] ?? ''}
                  placeholder={f.placeholder}
                  onChange={(e) =>
                    onChange({
                      attributes: { ...draft.attributes, [f.key]: e.target.value },
                    })
                  }
                  className="w-full rounded-xl border border-input bg-card p-3 text-base outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
                />
              )}
            </Field>
          ))}
        </div>
      ) : null}

      <Field label="Location" htmlFor="address">
        <LocationPicker
          address={draft.address}
          lat={draft.lat}
          lng={draft.lng}
          onChange={(v) => onChange(v)}
        />
      </Field>

      <div className="rounded-xl border border-border">
        <button
          type="button"
          onClick={() => setContactOpen((o) => !o)}
          className="flex w-full items-center justify-between p-4 text-left font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
          aria-expanded={contactOpen}
        >
          <span>
            Contact info{' '}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <span className="text-muted-foreground">{contactOpen ? '−' : '+'}</span>
        </button>
        {contactOpen && (
          <div className="flex flex-col gap-4 border-t border-border p-4">
            <p className="text-sm text-muted-foreground">
              Add your details to get status updates. You can also file anonymously.
            </p>
            <div className="flex gap-3">
              <input
                aria-label="First name"
                value={draft.firstName}
                onChange={(e) => onChange({ firstName: e.target.value })}
                placeholder="First name"
                className="w-full rounded-xl border border-input bg-card p-3 text-base outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
              />
              <input
                aria-label="Last name"
                value={draft.lastName}
                onChange={(e) => onChange({ lastName: e.target.value })}
                placeholder="Last name"
                className="w-full rounded-xl border border-input bg-card p-3 text-base outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
              />
            </div>
            <input
              aria-label="Email"
              type="email"
              value={draft.email}
              onChange={(e) => onChange({ email: e.target.value })}
              placeholder="Email"
              className="w-full rounded-xl border border-input bg-card p-3 text-base outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
            />
            <input
              aria-label="Phone"
              type="tel"
              value={draft.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
              placeholder="Phone"
              className="w-full rounded-xl border border-input bg-card p-3 text-base outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
            />
          </div>
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

      {!locationValid && (
        <p className="text-sm text-muted-foreground">
          Add a location to continue — use your GPS or type an address.
        </p>
      )}

      <Button
        size="lg"
        className="h-14 w-full text-base"
        disabled={!canSubmit}
        onClick={onSubmit}
      >
        {submitting ? (
          <>
            <span className="size-5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            Sending to 311…
          </>
        ) : (
          <>
            <Send className="size-5" /> Submit to LA 311
          </>
        )}
      </Button>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="px-1 font-semibold">
        {label}
      </label>
      {children}
    </div>
  )
}
