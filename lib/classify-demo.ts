// Client-side demo classifier.
//
// For the hackathon demo the app runs without a backend: instead of calling the
// AI classification route, the voice/typed flow is matched to a service here
// using the same keyword catalog. This keeps the whole flow self-contained and
// deterministic for judging.

import { SERVICES, getService } from './services'

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
  'Illegal dumping of construction debris at the Museum of Contemporary Art'

/**
 * Scripted result for the photo demo. The user snaps a picture of a pothole and
 * the app resolves their GPS position to the Museum of Contemporary Art. No
 * backend or real image recognition runs — this keeps the demo deterministic.
 */
export function classifyDemoPhoto(): DemoClassification {
  const service = getService('POTHOLE')!
  return {
    serviceCode: service.code,
    title: service.name,
    description:
      'Large pothole in the roadway creating a hazard for passing vehicles.',
    confidence: 0.94,
    extractedLocation:
      'Museum of Contemporary Art, 250 S Grand Ave, Los Angeles, CA 90012',
    attributes: { laneLocation: 'Right lane near the crosswalk' },
    lat: 34.0537,
    lng: -118.2504,
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Pull a rough location phrase out of a spoken report. */
function extractLocation(text: string): string | null {
  const match = text.match(
    /\b(?:at|near|on|in front of|next to|by|outside)\s+(.+?)(?:[.,!?]|$)/i,
  )
  if (!match) return null
  return capitalize(match[1].trim())
}

/** Best-effort attribute extraction for a few service types. */
function extractAttributes(code: string, text: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  if (code === 'ILLEGALDUMPINGPICKUP') {
    const m = text.match(
      /dumping of\s+(.+?)\s+(?:at|near|on|in front of|next to|by|outside)\b/i,
    )
    if (m) attributes.itemDescription = capitalize(m[1].trim())
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
    attributes: extractAttributes(best.code, text),
    lat: null,
    lng: null,
  }
}
