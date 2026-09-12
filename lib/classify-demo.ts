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

/** The scripted note used when the user taps the mic on the camera screen. */
export const SCRIPTED_PHOTO_NOTE =
  'There is a deep pothole in the right lane near the crosswalk.'

/**
 * The location the phone's GPS resolves to for the demo. In a real build this
 * comes from the device's coordinates + reverse geocoding; here it is fixed so
 * the camera screen and the review form agree on a plausible LA location.
 */
export const DEMO_GPS = {
  address: 'Museum of Contemporary Art, 250 S Grand Ave, Los Angeles, CA 90012',
  lat: 34.0537,
  lng: -118.2504,
}

/**
 * Result for the camera flow. When the user adds a note (typed or spoken), the
 * request is classified from that real text against the service catalog, so the
 * detected service type and the filled fields reflect what the user actually
 * described. The phone's GPS resolves the location (fixed to MOCA for the demo).
 * With no note, the image-only path falls back to a scripted pothole so the
 * flow always demos, since real image recognition needs a backend.
 */
export function classifyDemoPhoto(note?: string): DemoClassification {
  const trimmed = note?.trim()

  if (!trimmed) {
    const service = getService('POTHOLE')!
    return {
      serviceCode: service.code,
      title: service.name,
      description:
        'Large pothole in the roadway creating a hazard for passing vehicles.',
      confidence: 0.94,
      // The location comes from the device's real GPS, resolved by the flow.
      extractedLocation: null,
      attributes: { laneLocation: 'Right lane near the crosswalk' },
      lat: null,
      lng: null,
    }
  }

  // Classify from the actual words the user typed or spoke.
  const base = classifyDemo(trimmed)
  return {
    ...base,
    description: cleanDescription(trimmed),
    // Only keep a location the user explicitly mentioned; the device's real
    // GPS (resolved by the flow) is the primary source of the actual location.
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

/** Best-effort attribute extraction so each service's form fields pre-fill. */
function extractAttributes(code: string, text: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  switch (code) {
    case 'ILLEGALDUMPINGPICKUP': {
      const m = text.match(
        /dumping of\s+(.+?)\s+(?:at|near|on|in front of|next to|by|outside)\b/i,
      )
      if (m) attributes.itemDescription = capitalize(m[1].trim())
      else {
        const m2 = text.match(
          /(construction debris|building materials|trash bags|garbage|tires|debris|waste|mattress|furniture)/i,
        )
        if (m2) attributes.itemDescription = capitalize(m2[1])
      }
      break
    }
    case 'POTHOLE': {
      const m = text.match(/\b(?:in|on|near|at)\s+(the\s+)?([^.,!?]*lane[^.,!?]*)/i)
      if (m) attributes.laneLocation = capitalize(m[2].trim())
      break
    }
    case 'GRAFFITIREMOVAL': {
      if (/\bwall\b/i.test(text)) attributes.surface = 'Wall'
      else if (/\bfence\b/i.test(text)) attributes.surface = 'Fence'
      else if (/\bsidewalk\b/i.test(text)) attributes.surface = 'Sidewalk'
      else if (/\bpole\b|\bsign\b/i.test(text)) attributes.surface = 'Pole / sign'
      break
    }
    case 'DEADANIMALREMOVAL': {
      const m = text.match(
        /dead\s+(dog|cat|raccoon|possum|opossum|bird|rat|coyote|squirrel|skunk|animal)/i,
      )
      if (m) attributes.animalType = capitalize(m[1])
      break
    }
    case 'BULKYITEM': {
      const m = text.match(
        /(couch|sofa|mattress|box spring|table|chair|dresser|carpet|furniture)/i,
      )
      if (m) attributes.itemDescription = capitalize(m[1])
      break
    }
    case 'METALHOUSEHOLDAPPLIANCES': {
      const m = text.match(
        /(refrigerator|fridge|stove|washing machine|washer|dryer|water heater|oven|appliance)/i,
      )
      if (m) attributes.itemDescription = capitalize(m[1])
      break
    }
    case 'ELECTRONICWASTE': {
      const m = text.match(/(television|tv|computer|monitor|printer|laptop)/i)
      if (m) attributes.itemDescription = capitalize(m[1])
      break
    }
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
