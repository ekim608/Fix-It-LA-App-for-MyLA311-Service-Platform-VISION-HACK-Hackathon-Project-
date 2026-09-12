export type CaptureSource = 'voice' | 'photo' | 'browse'

export type DraftRequest = {
  source: CaptureSource
  serviceCode: string
  title: string
  description: string
  confidence: number | null
  attributes: Record<string, string>
  address: string
  lat: number | null
  lng: number | null
  firstName: string
  lastName: string
  email: string
  phone: string
  photoDataUrl?: string
  transcript?: string
}

export type Classification = {
  serviceCode: string
  title: string
  description: string
  confidence: number
  extractedLocation: string | null
}

export type SubmitResult = {
  simulated: boolean
  serviceRequestId: string | null
  status: string
  message: string
}

export function emptyDraft(source: CaptureSource): DraftRequest {
  return {
    source,
    serviceCode: '',
    title: '',
    description: '',
    confidence: null,
    attributes: {},
    address: '',
    lat: null,
    lng: null,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  }
}
