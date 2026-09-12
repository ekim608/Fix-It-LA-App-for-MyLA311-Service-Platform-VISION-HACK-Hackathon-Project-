'use client'

import { Mic, Camera, PenLine, ChevronRight } from 'lucide-react'
import { ServiceIcon } from '@/components/service-icon'
import { SERVICES } from '@/lib/services'

export function HomeScreen({
  onVoice,
  onText,
  onPhoto,
  onPickService,
}: {
  onVoice: () => void
  onText: () => void
  onPhoto: () => void
  onPickService: (code: string) => void
}) {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h1 className="text-balance text-3xl font-extrabold tracking-tight">
          Report a city issue in seconds
        </h1>
        <p className="text-pretty text-base leading-relaxed text-muted-foreground">
          Speak, type, or snap a photo. CityPin finds the right LA 311 request
          and fills it out for you.
        </p>
      </section>

      <section className="flex flex-col gap-4" aria-label="Start a report">
        <button
          type="button"
          onClick={onVoice}
          className="group flex min-h-32 flex-col items-start justify-between rounded-2xl bg-primary p-6 text-left text-primary-foreground shadow-sm transition-transform active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
        >
          <span className="flex size-14 items-center justify-center rounded-xl bg-primary-foreground/15">
            <Mic className="size-7" aria-hidden="true" />
          </span>
          <span className="flex w-full items-end justify-between">
            <span className="flex flex-col">
              <span className="text-xl font-bold">Speak your report</span>
              <span className="text-sm text-primary-foreground/80">
                Describe the problem out loud
              </span>
            </span>
            <ChevronRight className="size-6 opacity-70" aria-hidden="true" />
          </span>
        </button>

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={onText}
            className="flex min-h-32 flex-col items-start justify-between rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-transform active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
          >
            <span className="flex size-12 items-center justify-center rounded-xl bg-secondary text-primary">
              <PenLine className="size-6" aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span className="text-lg font-bold">Type it</span>
              <span className="text-sm text-muted-foreground">Write a short note</span>
            </span>
          </button>

          <button
            type="button"
            onClick={onPhoto}
            className="flex min-h-32 flex-col items-start justify-between rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-transform active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
          >
            <span className="flex size-12 items-center justify-center rounded-xl bg-accent/30 text-accent-foreground">
              <Camera className="size-6" aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span className="text-lg font-bold">Take a photo</span>
              <span className="text-sm text-muted-foreground">Show the issue</span>
            </span>
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-label="Browse services">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Or pick a service
        </h2>
        <ul className="flex flex-col gap-2">
          {SERVICES.map((service) => (
            <li key={service.code}>
              <button
                type="button"
                onClick={() => onPickService(service.code)}
                className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                  <ServiceIcon name={service.icon} className="size-5" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold">{service.name}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {service.summary}
                  </span>
                </span>
                <ChevronRight
                  className="ml-auto size-5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
