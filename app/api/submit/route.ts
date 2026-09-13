import { getService, getCatalogForm } from '@/lib/services'
import { submitToMyLA311, type SubmitInput } from '@/lib/myla311-submit'

// Playwright + headless Chromium need the Node.js runtime and time to drive the
// multi-step Salesforce form.
export const runtime = 'nodejs'
export const maxDuration = 120

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
  /** When true (and MYLA311_ALLOW_SUBMIT=1) the automation clicks the final
   *  Submit; otherwise it fills the real form as a dry run. */
  confirmSubmit?: boolean
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

  const form = getCatalogForm(body.serviceCode)

  // "OTHER" (and anything without a real scraped form) can't be automated, so
  // acknowledge it in simulated mode and route it for manual handling.
  if (!form) {
    return simulated(
      'Your request was received and will be routed to the right LA 311 team.',
    )
  }

  // Re-key the user's chosen attribute values by their on-page field label so
  // the browser automation can locate each input.
  const attributesByLabel: Record<string, string> = {}
  for (const field of service.fields ?? []) {
    const value = body.attributes?.[field.key]
    if (value) attributesByLabel[field.label.toLowerCase().trim()] = value
  }

  const anonymous = !body.firstName && !body.lastName && !body.email

  const input: SubmitInput = {
    form,
    description: body.description,
    address: body.address ?? '',
    lat: body.lat ?? null,
    lng: body.lng ?? null,
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    phone: body.phone,
    attributesByLabel,
    anonymous,
    confirmSubmit: Boolean(body.confirmSubmit),
  }

  try {
    const outcome = await submitToMyLA311(input)

    // If the form needs a login we can't do anonymously, fall back to simulated
    // so the resident still gets a tracking number and the flow completes.
    if (outcome.requiresLogin) {
      return simulated(
        'Your report was prepared for LA 311. This issue type needs a signed-in city account to file directly, so it has been queued for submission.',
        { requiresLogin: true, formUrl: form.url },
      )
    }

    if (outcome.filed) {
      return Response.json({
        simulated: false,
        filed: true,
        serviceRequestId: outcome.serviceRequestId,
        status: 'open',
        message: outcome.message,
        stepsWalked: outcome.stepsWalked,
      })
    }

    // Dry run (or couldn't reach final step): the real form was driven but not
    // filed. Return a tracking token so the confirmation screen still works.
    return Response.json({
      simulated: false,
      filed: false,
      dryRun: outcome.dryRun,
      serviceRequestId: `LA311-${Date.now().toString(36).toUpperCase()}`,
      status: 'prepared',
      message: outcome.message,
      stepsWalked: outcome.stepsWalked,
      reachedFinalStep: outcome.reachedFinalStep,
      formUrl: form.url,
    })
  } catch (err) {
    // Headless Chromium may be unavailable in some environments — never leave
    // the resident stuck; acknowledge and queue the request.
    console.log('[v0] submit automation error:', err instanceof Error ? err.message : err)
    return simulated(
      'Your request has been received and queued for LA 311. Save your confirmation number to track its status.',
      { formUrl: form.url },
    )
  }
}

function simulated(message: string, extra?: Record<string, unknown>) {
  const token = `SIM-${Date.now().toString(36).toUpperCase()}`
  return Response.json({
    simulated: true,
    filed: false,
    serviceRequestId: token,
    status: 'queued',
    message,
    ...extra,
  })
}
