// Converts the scraped MyLA311 form dump (scripts/data/311-form-fields.txt)
// into a structured JSON catalog (lib/myla311-catalog.json) that the app and
// the Playwright submission backend consume.
//
// Run: node scripts/build-catalog.mjs
//
// The text format looks like:
//   ============================================================
//   Category: <category>
//   Form:     <form>
//   URL:      <url>
//   ============================================================
//     -- Step 1 --
//       Field: *Label (required)
//       Type:  select
//       Options:
//         - Option A
//         - Option B

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const INPUT = join(__dirname, 'data', '311-form-fields.txt')
const OUTPUT = join(__dirname, '..', 'lib', 'myla311-catalog.json')

const raw = readFileSync(INPUT, 'utf8')
const lines = raw.split('\n')

/** @typedef {{label:string,type:string,required:boolean,options:string[]}} Field */
/** @typedef {{step:string,fields:Field[]}} Step */
/** @typedef {{category:string,form:string,url:string,issueTypeId:string,steps:Step[],note?:string}} FormEntry */

/** @type {FormEntry[]} */
const forms = []

let cur = null
let curStep = null
let curField = null
let inOptions = false

function pushField() {
  if (cur && curStep && curField) curStep.fields.push(curField)
  curField = null
  inOptions = false
}
function pushStep() {
  pushField()
  if (cur && curStep) cur.steps.push(curStep)
  curStep = null
}
function pushForm() {
  pushStep()
  if (cur) forms.push(cur)
  cur = null
}

function issueTypeIdFromUrl(url) {
  const m = url.match(/c__IssueTypeId=([^&]+)/)
  return m ? m[1] : ''
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  const trimmed = line.trim()

  const catMatch = trimmed.match(/^Category:\s*(.+)$/)
  const formMatch = trimmed.match(/^Form:\s*(.+)$/)
  const urlMatch = trimmed.match(/^URL:\s*(.+)$/)
  const noteMatch = trimmed.match(/^Note:\s*(.+)$/)
  const stepMatch = trimmed.match(/^--\s*(.+?)\s*--$/)
  const fieldMatch = trimmed.match(/^Field:\s*(.+)$/)
  const typeMatch = trimmed.match(/^Type:\s*(.+)$/)
  const optionMatch = trimmed.match(/^-\s+(.+)$/)

  if (catMatch) {
    // A new Category line marks the start of a new form block.
    pushForm()
    cur = { category: catMatch[1], form: '', url: '', issueTypeId: '', steps: [] }
    continue
  }
  if (!cur) continue

  if (formMatch) {
    cur.form = formMatch[1]
    continue
  }
  if (urlMatch) {
    cur.url = urlMatch[1]
    cur.issueTypeId = issueTypeIdFromUrl(urlMatch[1])
    continue
  }
  if (noteMatch) {
    cur.note = noteMatch[1]
    continue
  }
  if (stepMatch) {
    pushStep()
    curStep = { step: stepMatch[1], fields: [] }
    continue
  }
  if (fieldMatch) {
    pushField()
    let label = fieldMatch[1]
    const required = /\(required\)/.test(label)
    label = label.replace(/\s*\(required\)\s*$/, '').replace(/^\*/, '').trim()
    curField = { label, type: '', required, options: [] }
    continue
  }
  if (typeMatch && curField) {
    curField.type = typeMatch[1].trim()
    continue
  }
  if (/^Options:/.test(trimmed)) {
    inOptions = true
    continue
  }
  if (optionMatch && inOptions && curField) {
    curField.options.push(optionMatch[1].trim())
    continue
  }
}
pushForm()

// De-duplicate fields within a step by label (the scraper occasionally repeats
// the identity fields across steps) and drop truly empty forms.
for (const f of forms) {
  for (const s of f.steps) {
    const seen = new Set()
    s.fields = s.fields.filter((fld) => {
      const key = fld.label.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
}

mkdirSync(dirname(OUTPUT), { recursive: true })
writeFileSync(OUTPUT, JSON.stringify(forms, null, 2), 'utf8')

const withSteps = forms.filter((f) => f.steps.length > 0).length
console.log(
  `Parsed ${forms.length} forms (${withSteps} with steps) across ` +
    `${new Set(forms.map((f) => f.category)).size} categories -> ${OUTPUT}`,
)
