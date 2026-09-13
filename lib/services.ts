// LA 311 (MyLA311) service catalog.
//
// The real catalog is scraped from https://myla311.lacity.gov/s/ into
// lib/myla311-catalog.json (regenerate with `node scripts/build-catalog.mjs`).
// Each entry carries the live report-issue URL, the Salesforce IssueTypeId, and
// the exact multi-step field definitions — everything the Playwright submission
// backend needs to fill and file a real request.
//
// This module derives the UI-friendly `Service[]` (used by the review form and
// the AI classifier) from that raw catalog, so there is a single source of
// truth. `getCatalogForm(code)` returns the raw form (URL + steps) for the
// submitter.

import rawCatalog from './myla311-catalog.json'

export type CatalogField = {
  label: string
  /** 'select' | 'text' | 'textarea' | 'tel' | 'date' | 'dropdown (custom)' | 'checkbox' | 'location' | 'number' */
  type: string
  required: boolean
  options: string[]
}

export type CatalogStep = {
  step: string
  fields: CatalogField[]
}

export type CatalogForm = {
  category: string
  form: string
  url: string
  issueTypeId: string
  steps: CatalogStep[]
  note?: string
}

export const CATALOG = rawCatalog as CatalogForm[]

export type ServiceField = {
  key: string
  /** the exact on-page field label, used to locate the input during submission */
  label: string
  type: 'text' | 'textarea' | 'number' | 'select'
  placeholder?: string
  options?: string[]
  required?: boolean
}

export type Service = {
  code: string
  name: string
  /** Short line shown under the name (the MyLA311 category). */
  summary: string
  /** Longer guidance used by the AI classifier to match intent. */
  guidance: string
  /** lucide-react icon name */
  icon: string
  keywords: string[]
  fields?: ServiceField[]
}

const CATEGORY_ICON: Record<string, string> = {
  'Animal Complaint/Violation': 'PawPrint',
  'Bees or Beehive': 'Bug',
  'ADA/Accessibility/Disability Complaints': 'Accessibility',
  'Graffiti Removal': 'SprayCan',
  'Homeless Encampment': 'Tent',
  'Illegal Activities (Non-Emergency)': 'TriangleAlert',
  'Accessible Parking Zones': 'CircleParking',
  'Building Permit Inspection': 'HardHat',
  'Dockless Mobility Enforcement': 'Bike',
  Containers: 'Container',
  'Accessible Bus Stop Issues': 'BusFront',
  'Traffic Safety': 'TrafficCone',
  'Watershed Protection Division (WPD) Enforcement': 'Droplets',
  Feedback: 'MessageSquare',
}

// Field labels that are handled elsewhere (reporter identity, anonymity toggle,
// the free-text description, the location picker, or boilerplate) and so should
// not appear as extra inputs on the review form.
const IDENTITY_LABELS = new Set([
  'first name',
  'last name',
  'email',
  'phone number',
  'extension',
])

function isHandledElsewhere(label: string): boolean {
  const l = label.toLowerCase().trim()
  if (l === '(unlabeled)' || l === '') return true
  if (IDENTITY_LABELS.has(l)) return true
  if (l.includes('anonymously')) return true
  if (l.includes('disability access barrier')) return true
  if (l.includes('additional comments')) return true
  if (l.includes('any additional comments')) return true
  if (l.includes('type to search')) return true
  return false
}

function slugKey(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'field'
  )
}

function codeFor(form: CatalogForm): string {
  const base = `${form.category} ${form.form}`
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 40)
  return base || 'FORM'
}

function toServiceFieldType(f: CatalogField): ServiceField['type'] {
  if (f.options.length > 0) return 'select'
  if (f.type === 'textarea') return 'textarea'
  if (f.type === 'number') return 'number'
  return 'text'
}

function buildKeywords(form: CatalogForm): string[] {
  const tokens = new Set<string>()
  const add = (s: string) => {
    for (const w of s.toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length > 2) tokens.add(w)
    }
  }
  add(form.category)
  add(form.form)
  for (const step of form.steps) {
    for (const field of step.fields) {
      if (field.options.length && field.options.length <= 8) {
        for (const opt of field.options) add(opt)
      }
    }
  }
  return [...tokens]
}

function primaryOptions(form: CatalogForm): string[] {
  for (const step of form.steps) {
    for (const field of step.fields) {
      if (isHandledElsewhere(field.label)) continue
      if (field.options.length > 1) return field.options
    }
  }
  return []
}

function buildFields(form: CatalogForm): ServiceField[] {
  const fields: ServiceField[] = []
  const seen = new Set<string>()
  for (const step of form.steps) {
    for (const f of step.fields) {
      if (isHandledElsewhere(f.label)) continue
      let key = slugKey(f.label)
      while (seen.has(key)) key = `${key}_2`
      seen.add(key)
      fields.push({
        key,
        label: f.label,
        type: toServiceFieldType(f),
        options: f.options.length ? f.options : undefined,
        required: f.required,
      })
    }
  }
  return fields
}

// Map every real catalog form to a UI/classifier Service, keeping the raw form
// reachable by code for the submission backend.
const catalogByCode = new Map<string, CatalogForm>()

const derived: Service[] = (() => {
  const used = new Set<string>()
  const list: Service[] = []
  for (const form of CATALOG) {
    let code = codeFor(form)
    while (used.has(code)) code = `${code}2`
    used.add(code)
    catalogByCode.set(code, form)

    const opts = primaryOptions(form)
    const name = form.form === form.category ? form.form : form.form
    const guidance =
      `${form.category}. Report type: ${form.form}.` +
      (opts.length ? ` Covers: ${opts.join(', ')}.` : '')

    list.push({
      code,
      name,
      summary: form.category,
      guidance,
      icon: CATEGORY_ICON[form.category] ?? 'CircleHelp',
      keywords: buildKeywords(form),
      fields: buildFields(form),
    })
  }
  return list
})()

const OTHER: Service = {
  code: 'OTHER',
  name: 'Something Else',
  summary: 'Another issue — we will route it for you',
  guidance:
    'A general or uncategorized request. Use when the issue does not clearly match any other service type in the catalog.',
  icon: 'CircleHelp',
  keywords: ['other', 'general', 'help', 'question', 'misc'],
}

export const SERVICES: Service[] = [...derived, OTHER]

export function getService(code: string): Service | undefined {
  return SERVICES.find((s) => s.code === code)
}

/** The raw MyLA311 form (live URL + step/field definitions) for a service code,
 *  used by the Playwright submission backend. `OTHER` has no real form. */
export function getCatalogForm(code: string): CatalogForm | undefined {
  return catalogByCode.get(code)
}

export const SERVICE_CODES = SERVICES.map((s) => s.code)
