import { experimental_transcribe as transcribe } from 'ai'

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const file = form.get('audio')

    if (!(file instanceof Blob)) {
      return Response.json({ error: 'No audio provided.' }, { status: 400 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())

    const result = await transcribe({
      model: 'openai/whisper-1',
      audio: bytes,
    })

    return Response.json({ text: result.text })
  } catch (err) {
    console.log('[v0] transcribe error:', err instanceof Error ? err.message : err)
    return Response.json(
      { error: 'Could not transcribe the audio. Please try again or type your report.' },
      { status: 500 },
    )
  }
}
