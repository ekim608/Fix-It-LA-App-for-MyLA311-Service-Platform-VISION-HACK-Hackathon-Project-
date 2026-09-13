// Client-side demo classifier.
//
// The camera/voice flow tries the AI vision route first; this local classifier
// is the offline fallback so the flow always completes. It matches the user's
// typed/spoken note to the closest real MyLA311 form using each form's keyword
// set, and best-effort fills any select field whose options the note mentions.

import { SERVICES, getService } from './services'
import type { Service } from './services'

export type DemoClassification = {
  serviceCode: string
  title: string
  description: string
  confidence: number
  extractedLocation: string | null
  attributes: Record<string, string>
  lat: number | null
  lng: number | null
}

/** The scripted report used when the user "speaks" in demo mode. */
export const SCRIPTED_VOICE_TRANSCRIPT =
  'There is graffiti tagged on the wall under the bridge.'

/** The scripted note used when the user taps the mic on the camera screen. */
export const SCRIPTED_PHOTO_NOTE =
  'There is graffiti spray painted on the wall.'

/**
 * The location the phone's GPS resolves to for the demo. In a real build this
 * comes from the device's coordinates + reverse geocoding; here it is a
 * plausible fixed LA location so the camera screen and review form agree.
 */
export const DEMO_GPS = {
  address: '200 N Spring St, Los Angeles, CA 90012',
  lat: 34.0537,
  lng: -118.2427,
}

/**
 * Result for the camera flow. When the user adds a note (typed or spoken) the
 * request is classified from that text against the real catalog. With no note,
 * the image-only path falls back to a scripted graffiti report so the flow
 * always demos end to end, since real image recognition needs the vision route.
 */
export function classifyDemoPhoto(note?: string): DemoClassification {
  const trimmed = note?.trim()

  if (!trimmed) {
    const base = classifyDemo(SCRIPTED_PHOTO_NOTE)
    return {
      ...base,
      description: cleanDescription(SCRIPTED_PHOTO_NOTE),
      extractedLocation: null,
      lat: null,
      lng: null,
    }
  }

  const base = classifyDemo(trimmed)
  return {
    ...base,
    description: cleanDescription(trimmed),
    extractedLocation: base.extractedLocation,
    lat: null,
    lng: null,
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Tidy free text into a sentence for the description field. */
function cleanDescription(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ')
  if (!t) return t
  const withCap = t.charAt(0).toUpperCase() + t.slice(1)
  return /[.!?]$/.test(withCap) ? withCap : `${withCap}.`
}

/** Pull a rough location phrase out of a spoken report. */
function extractLocation(text: string): string | null {
  const match = text.match(
    /\b(?:at|near|on|in front of|next to|by|outside)\s+(.+?)(?:[.,!?]|$)/i,
  )
  if (!match) return null
  return capitalize(match[1].trim())
}

/** Best-effort: for each of the service's select fields, if the note clearly
 *  mentions one of the options, pre-select it. Keeps the review form pre-filled
 *  without any per-service hardcoding. */
function matchAttributes(service: Service, text: string): Record<string, string> {
  const lower = text.toLowerCase()
  const attributes: Record<string, string> = {}
  for (const field of service.fields ?? []) {
    if (field.type !== 'select' || !field.options) continue
    const hit = field.options.find((o) => {
      const ol = o.toLowerCase()
      return ol.length > 2 && lower.includes(ol)
    })
    if (hit) attributes[field.key] = hit
  }
  return attributes
}

/** Match free text to the closest 311 service using the keyword catalog. */
export function classifyDemo(text = ''): DemoClassification {
  const lower = text.toLowerCase()

  let best = getService('OTHER')!
  let bestScore = 0
  for (const service of SERVICES) {
    if (service.code === 'OTHER') continue
    let score = 0
    for (const keyword of service.keywords) {
      if (lower.includes(keyword)) score += 1
    }
    if (score > bestScore) {
      bestScore = score
      best = service
    }
  }

  const confidence =
    bestScore === 0 ? 0.4 : Math.min(0.96, 0.62 + bestScore * 0.12)

  return {
    serviceCode: best.code,
    title: best.name,
    description: text,
    confidence,
    extractedLocation: extractLocation(text),
    attributes: matchAttributes(best, text),
    lat: null,
    lng: null,
  }
}
