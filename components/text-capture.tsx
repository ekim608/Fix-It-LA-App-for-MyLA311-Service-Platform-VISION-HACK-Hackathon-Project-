'use client'

import { useState } from 'react'
import { PenLine, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function TextCapture({ onText }: { onText: (text: string) => void }) {
  const [value, setValue] = useState('')
  const canSubmit = value.trim().length > 0

  return (
    <div className="flex flex-col gap-8 pt-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-secondary text-primary">
          <PenLine className="size-8" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold">Type your report</h1>
        <p className="max-w-xs text-pretty text-muted-foreground">
          Describe the problem in a sentence or two and we&apos;ll find the right 311
          request.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label htmlFor="report-text" className="sr-only">
          Describe the issue
        </label>
        <textarea
          id="report-text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={5}
          autoFocus
          placeholder="e.g. There's a large pothole in the right lane near the crosswalk"
          className="w-full resize-none rounded-xl border border-border bg-card p-4 text-base leading-relaxed shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
        />
        <Button
          size="lg"
          className="h-14 w-full text-base"
          disabled={!canSubmit}
          onClick={() => onText(value.trim())}
        >
          <Send className="size-5" /> Find my request
        </Button>
      </div>
    </div>
  )
}
