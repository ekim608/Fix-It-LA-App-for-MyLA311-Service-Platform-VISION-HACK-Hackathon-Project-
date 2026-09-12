import { generateObject } from 'ai'
import { z } from 'zod'
import { SERVICES, SERVICE_CODES } from '@/lib/services'

export const maxDuration = 30

const schema = z.object({
  serviceCode: z.enum(SERVICE_CODES as [string, ...string[]]),
  title: z.string().describe('A short 3-6 word title for the request'),
  description: z
    .string()
    .describe('A clear first-person description of the issue for the 311 request'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('How confident you are in the service match, 0 to 1'),
  extractedLocation: z
    .string()
    .nullable()
    .describe('Any address or location mentioned by the user, else null'),
})

const catalogText = SERVICES.map(
  (s) => `- ${s.code}: ${s.name}. ${s.guidance} (keywords: ${s.keywords.join(', ')})`,
).join('\n')

const systemPrompt = `You are the intake assistant for the City of Los Angeles 311 service. 
Given a resident's spoken report or a photo of a problem, choose the single best matching 311 service from this catalog:

${catalogText}

Rules:
- Pick the closest match. If nothing fits well, use OTHER.
- Write the description in clear, first-person, factual language a city dispatcher can act on. Do not invent details that are not present.
- Keep the description to 1-3 sentences.
- If a photo is provided, describe only what is visibly wrong.
- Only extract a location if the user actually states one.`

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { text, imageDataUrl } = body as {
      text?: string
      imageDataUrl?: string
    }

    if (!text && !imageDataUrl) {
      return Response.json({ error: 'Provide text or an image.' }, { status: 400 })
    }

    const userContent: Array<
      | { type: 'text'; text: string }
      | { type: 'image'; image: string }
    > = []

    if (text) {
      userContent.push({ type: 'text', text: `Resident report: "${text}"` })
    }
    if (imageDataUrl) {
      userContent.push({
        type: 'text',
        text: 'Here is a photo of the issue. Identify the problem and the best matching 311 service.',
      })
      userContent.push({ type: 'image', image: imageDataUrl })
    }

    const { object } = await generateObject({
      model: 'openai/gpt-4o-mini',
      schema,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    })

    return Response.json(object)
  } catch (err) {
    console.log('[v0] classify error:', err instanceof Error ? err.message : err)
    return Response.json({ error: 'Could not classify the request.' }, { status: 500 })
  }
}
