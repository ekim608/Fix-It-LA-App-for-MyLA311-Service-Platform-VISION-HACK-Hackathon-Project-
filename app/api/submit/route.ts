import { getService } from '@/lib/services'

export const maxDuration = 30

type SubmitBody = {
  serviceCode: string
  description: string
  address?: string
  lat?: number
  lng?: number
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  attributes?: Record<string, string>
}

export async function POST(req: Request) {
  let body: SubmitBody
  try {
    body = (await req.json()) as SubmitBody
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const service = getService(body.serviceCode)
  if (!service) {
    return Response.json({ error: 'Unknown service type.' }, { status: 400 })
  }
  if (!body.description || (!body.address && (body.lat == null || body.lng == null))) {
    return Response.json(
      { error: 'A description and a location (address or GPS) are required.' },
      { status: 400 },
    )
  }

  const endpoint = process.env.OPEN311_ENDPOINT
  const apiKey = process.env.OPEN311_API_KEY
  const jurisdiction = process.env.OPEN311_JURISDICTION_ID // e.g. "lacity.org"

  // Without configured Open311 credentials we run in simulated mode so the
  // whole flow works end-to-end. Set OPEN311_ENDPOINT + OPEN311_API_KEY to
  // submit to the real MyLA311 system.
  if (!endpoint || !apiKey) {
    const token = `SIM-${Date.now().toString(36).toUpperCase()}`
    return Response.json({
      simulated: true,
      serviceRequestId: token,
      status: 'open',
      message:
        'Your request has been received. Save your confirmation number to track its status.',
    })
  }

  const params = new URLSearchParams()
  params.set('api_key', apiKey)
  if (jurisdiction) params.set('jurisdiction_id', jurisdiction)
  params.set('service_code', body.serviceCode)
  params.set('description', body.description)

  if (body.lat != null && body.lng != null) {
    params.set('lat', String(body.lat))
    params.set('long', String(body.lng))
  }
  if (body.address) params.set('address_string', body.address)
  if (body.firstName) params.set('first_name', body.firstName)
  if (body.lastName) params.set('last_name', body.lastName)
  if (body.email) params.set('email', body.email)
  if (body.phone) params.set('phone', body.phone)

  // Open311 service-definition attributes: attribute[CODE]=value
  for (const [code, value] of Object.entries(body.attributes ?? {})) {
    if (value) params.set(`attribute[${code}]`, value)
  }

  try {
    const res = await fetch(`${endpoint.replace(/\/$/, '')}/requests.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(20000),
    })

    const raw = await res.text()

    if (!res.ok) {
      console.log('[v0] open311 error response:', res.status, raw.slice(0, 500))
      return Response.json(
        { error: `311 rejected the request (status ${res.status}).`, detail: raw.slice(0, 300) },
        { status: 502 },
      )
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }

    const first = Array.isArray(parsed) ? (parsed[0] as Record<string, unknown>) : null
    const serviceRequestId =
      (first?.service_request_id as string) || (first?.token as string) || null

    return Response.json({
      simulated: false,
      serviceRequestId,
      status: 'open',
      message: serviceRequestId
        ? 'Your request was filed with LA 311.'
        : 'Your request was received by LA 311 and is pending an ID.',
    })
  } catch (err) {
    console.log('[v0] submit error:', err instanceof Error ? err.message : err)
    return Response.json(
      { error: 'Could not reach the 311 system. Please try again.' },
      { status: 502 },
    )
  }
}
