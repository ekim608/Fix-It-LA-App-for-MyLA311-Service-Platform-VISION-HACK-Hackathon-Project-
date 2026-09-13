import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { SERVICES, SERVICE_CODES, getService } from '@/lib/services'

export const maxDuration = 30

// Vision model used to look at the captured photo and pick the right 311
// service. We call Google Gemini directly (via @ai-sdk/google, which reads the
// free GOOGLE_GENERATIVE_AI_API_KEY) so image analysis runs on Google's free
// tier instead of the paid AI Gateway. Gemini Flash is fast and multimodal,
// keeping the capture-to-review step snappy.
const VISION_MODEL = google('gemini-3.6-flash')

type ClassifyImageBody = {
  imageDataUrl?: string
  note?: string
}

// Describe the whole 311 catalog to the model, including each service's
// form-field keys (and select options) so it can pre-fill them.
function catalogPrompt(): string {
  return SERVICES.map((s) => {
    const fields =
      s.fields && s.fields.length
        ? s.fields
            .map((f) => {
              const opts = f.options ? ` (one of: ${f.options.join(', ')})` : ''
              return `      - ${f.key}: ${f.label}${opts}`
            })
            .join('\n')
        : '      - (no extra fields)'
    return `- code: ${s.code}\n  name: ${s.name}\n  use when: ${s.guidance}\n  fields:\n${fields}`
  }).join('\n')
}

const classificationSchema = z.object({
  serviceCode: z
    .enum(SERVICE_CODES as [string, ...string[]])
    .describe('The single best-matching 311 service code from the catalog.'),
  description: z
    .string()
    .describe(
      'One or two concise sentences describing the issue as seen in the photo, suitable for a 311 request.',
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('How confident the match is, from 0 to 1.'),
  extractedLocation: z
    .string()
    .nullable()
    .describe(
      'Any location cue visible in the image (street sign, business name, address). Null if none is visible.',
    ),
  attributes: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .describe(
      "Values for the chosen service's fields, using the exact field keys from the catalog. Empty if none apply.",
    ),
})

export async function POST(req: Request) {
  let body: ClassifyImageBody
  try {
    body = (await req.json()) as ClassifyImageBody
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const imageDataUrl = body.imageDataUrl?.trim()
  if (!imageDataUrl || !imageDataUrl.startsWith('data:image')) {
    return Response.json({ error: 'A captured image is required.' }, { status: 400 })
  }

  const note = body.note?.trim()

  try {
    const { object } = await generateObject({
      model: VISION_MODEL,
      schema: classificationSchema,
      system:
        'You are an intake assistant for the City of Los Angeles 311 service. ' +
        'Look at the photo a resident just took of a problem in their neighborhood, ' +
        'and choose the single 311 service request that best fits what is visible. ' +
        'Write a clear, factual description of the issue for a city work crew. ' +
        'Only fill attribute values you can actually justify from the image or the note; ' +
        'use the exact field keys shown for the chosen service. ' +
        'If nothing clearly matches, use the OTHER service code.\n\n' +
        `311 service catalog:\n${catalogPrompt()}`,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: note
                ? `Here is the photo of the issue. The resident also added this note: "${note}". Classify it.`
                : 'Here is the photo of the issue. Classify it.',
            },
            { type: 'image', image: imageDataUrl },
          ],
        },
      ],
    })

    // Keep only attribute keys that actually belong to the chosen service so
    // the review form binds them to real fields.
    const service = getService(object.serviceCode)
    const validKeys = new Set((service?.fields ?? []).map((f) => f.key))
    const attributes: Record<string, string> = {}
    for (const { key, value } of object.attributes) {
      if (validKeys.has(key) && value.trim()) attributes[key] = value.trim()
    }

    return Response.json({
      serviceCode: object.serviceCode,
      title: service?.name ?? '',
      description: object.description,
      confidence: object.confidence,
      extractedLocation: object.extractedLocation,
      attributes,
    })
  } catch (err) {
    console.log('[v0] classify-image error:', err instanceof Error ? err.message : err)
    return Response.json(
      { error: 'Could not analyze the image.' },
      { status: 502 },
    )
  }
}
