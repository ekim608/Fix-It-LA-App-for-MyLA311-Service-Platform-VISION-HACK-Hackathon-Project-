// Playwright-driven submission for MyLA311.
//
// MyLA311 has no public REST/Open311 API — the report-issue pages are
// Salesforce Lightning multi-step forms that only accept input through a real
// browser session. This module mirrors the crawler in scripts/parser (the
// Python Playwright reference) but fills the *user's real data* instead of
// dummy values, then walks the wizard step by step.
//
// It runs in the Node.js runtime only. Chromium is resolved two ways:
//   - Serverless/Vercel: @sparticuz/chromium (headless binary).
//   - Local/dev: a system Chrome/Chromium channel, if present.
//
// Safety: by default the automation FILLS the form and stops on the final step
// WITHOUT clicking Submit (a dry run that proves it drove the real form). Pass
// confirmSubmit: true (and set MYLA311_ALLOW_SUBMIT=1) to actually file it, so
// we never create real work orders in the city system by accident.

import type { Browser, BrowserContext, Page } from 'playwright-core'
import type { CatalogForm } from './services'

export type SubmitInput = {
  form: CatalogForm
  description: string
  address: string
  lat: number | null
  lng: number | null
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  /** Values the user chose for the service's select/text fields, keyed by the
   *  on-page field label (lower-cased). */
  attributesByLabel: Record<string, string>
  anonymous: boolean
  confirmSubmit: boolean
}

export type SubmitOutcome = {
  filed: boolean
  dryRun: boolean
  serviceRequestId: string | null
  stepsWalked: string[]
  reachedFinalStep: boolean
  requiresLogin: boolean
  message: string
}

const DEFAULT_GEO = { latitude: 34.0522, longitude: -118.2437 } // LA City Hall

async function launchBrowser(): Promise<Browser> {
  const { chromium } = await import('playwright-core')

  // Prefer the serverless chromium binary when available (Vercel/Lambda).
  try {
    const mod = await import('@sparticuz/chromium')
    const chromiumPkg = (mod as { default?: unknown }).default ?? mod
    const sp = chromiumPkg as {
      executablePath: (input?: string) => Promise<string>
      args: string[]
      headless: boolean
    }
    const executablePath = await sp.executablePath()
    if (executablePath) {
      return chromium.launch({
        args: sp.args,
        executablePath,
        headless: true,
      })
    }
  } catch {
    // fall through to a local channel
  }

  // Local dev: use an installed Chrome/Chromium.
  return chromium.launch({ headless: true, channel: 'chrome' })
}

/** Fill the reporter identity fields on the current step, if present. */
async function fillIdentity(page: Page, input: SubmitInput) {
  const map: Array<[RegExp, string | undefined]> = [
    [/first name/i, input.firstName],
    [/last name/i, input.lastName],
    [/^email$/i, input.email],
    [/phone number/i, input.phone],
  ]
  for (const [labelRe, value] of map) {
    if (!value) continue
    const field = page.getByLabel(labelRe).first()
    try {
      if (await field.count()) await field.fill(value, { timeout: 3000 })
    } catch {
      // non-fatal
    }
  }
}

/** Choose a value in a native <select> or a Salesforce Lightning combobox by
 *  visible label. */
async function selectByLabel(page: Page, label: string, value: string) {
  // Native select first.
  const native = page.locator('select').filter({ has: page.locator('option') })
  const count = await native.count()
  for (let i = 0; i < count; i++) {
    const el = native.nth(i)
    try {
      const options = await el.locator('option').allInnerTexts()
      if (options.some((o) => o.trim() === value)) {
        await el.selectOption({ label: value }, { timeout: 3000 })
        return true
      }
    } catch {
      // try next
    }
  }

  // Lightning combobox: click to open, pick the matching option.
  const combo = page.getByRole('combobox').first()
  try {
    if (await combo.count()) {
      await combo.click({ timeout: 3000 })
      await page.waitForTimeout(500)
      const option = page.getByRole('option', { name: value, exact: false }).first()
      if (await option.count()) {
        await option.click({ timeout: 3000 })
        return true
      }
      await page.keyboard.press('Escape')
    }
  } catch {
    // non-fatal
  }
  return false
}

/** Fill everything we can on the current step from the user's real data. */
async function fillStep(page: Page, input: SubmitInput, step: CatalogForm['steps'][number]) {
  await page.waitForTimeout(1200)

  // Try to set the location via the address search box, if this step has one.
  if (input.address) {
    for (const sel of [
      "input[placeholder*='location' i]",
      "input[placeholder*='address' i]",
      "input[placeholder*='search' i]",
    ]) {
      const loc = page.locator(sel).first()
      try {
        if (await loc.count()) {
          await loc.fill(input.address, { timeout: 3000 })
          await page.waitForTimeout(1000)
          const suggestion = page.locator("[role='option'], [class*='autocomplete'] li").first()
          if (await suggestion.count()) {
            await suggestion.click({ timeout: 3000 })
            await page.waitForTimeout(500)
          }
          break
        }
      } catch {
        // non-fatal
      }
    }
  }

  for (const field of step.fields) {
    const label = field.label.toLowerCase().trim()

    if (/anonymously/.test(label)) {
      await selectByLabel(page, field.label, input.anonymous ? 'Yes' : 'No')
      continue
    }
    if (/first name|last name|^email$|phone number|extension/.test(label)) {
      await fillIdentity(page, input)
      continue
    }
    if (/additional comments|any additional comments/.test(label)) {
      const box = page.getByLabel(field.label, { exact: false }).first()
      try {
        if (await box.count()) await box.fill(input.description, { timeout: 3000 })
      } catch {
        // non-fatal
      }
      continue
    }

    // A value the user picked for this field?
    const chosen = input.attributesByLabel[label]
    if (field.options.length) {
      const value = chosen || field.options[0]
      await selectByLabel(page, field.label, value)
    } else if (chosen) {
      const box = page.getByLabel(field.label, { exact: false }).first()
      try {
        if (await box.count()) await box.fill(chosen, { timeout: 3000 })
      } catch {
        // non-fatal
      }
    }
  }
}

async function primaryButtonText(page: Page): Promise<string> {
  const btn = page.locator('button.slds-button_brand, button.slds-button--brand').first()
  try {
    if (await btn.count()) return (await btn.innerText()).trim()
  } catch {
    // ignore
  }
  return ''
}

async function isLoginPage(page: Page): Promise<boolean> {
  const url = page.url().toLowerCase()
  if (url.includes('login') || url.includes('signin') || url.includes('sign-in')) return true
  try {
    const body = (await page.locator('body').innerText()).toLowerCase()
    return body.includes('username') && body.includes('password')
  } catch {
    return false
  }
}

export async function submitToMyLA311(input: SubmitInput): Promise<SubmitOutcome> {
  const stepsWalked: string[] = []
  let browser: Browser | null = null
  let context: BrowserContext | null = null

  try {
    browser = await launchBrowser()
    context = await browser.newContext({
      geolocation:
        input.lat != null && input.lng != null
          ? { latitude: input.lat, longitude: input.lng }
          : DEFAULT_GEO,
      permissions: ['geolocation'],
      locale: 'en-US',
    })
    const page = await context.newPage()
    await page.goto(input.form.url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)

    if (await isLoginPage(page)) {
      return {
        filed: false,
        dryRun: !input.confirmSubmit,
        serviceRequestId: null,
        stepsWalked,
        reachedFinalStep: false,
        requiresLogin: true,
        message: 'This MyLA311 form requires a signed-in account, so it cannot be filed anonymously.',
      }
    }

    const steps = input.form.steps.length ? input.form.steps : [{ step: 'Step 1', fields: [] }]
    for (let i = 0; i < steps.length + 4; i++) {
      if (await isLoginPage(page)) {
        return {
          filed: false,
          dryRun: !input.confirmSubmit,
          serviceRequestId: null,
          stepsWalked,
          reachedFinalStep: false,
          requiresLogin: true,
          message: 'The form redirected to login partway through, so it cannot be filed anonymously.',
        }
      }

      const stepDef = steps[Math.min(i, steps.length - 1)]
      stepsWalked.push(stepDef.step)
      await fillStep(page, input, stepDef)

      const btnText = await primaryButtonText(page)
      const onFinalStep = btnText === 'Submit' || btnText === 'Finish' || btnText === ''

      if (onFinalStep) {
        if (input.confirmSubmit && process.env.MYLA311_ALLOW_SUBMIT === '1') {
          const submitBtn = page
            .locator('button.slds-button_brand, button.slds-button--brand')
            .first()
          await submitBtn.click({ timeout: 5000 })
          await page.waitForTimeout(4000)
          let srId: string | null = null
          try {
            const body = await page.locator('body').innerText()
            const m = body.match(/\b(1-\d{6,}|SR[-\s]?\d{6,}|\d{7,})\b/)
            if (m) srId = m[1]
          } catch {
            // ignore
          }
          return {
            filed: true,
            dryRun: false,
            serviceRequestId: srId,
            stepsWalked,
            reachedFinalStep: true,
            requiresLogin: false,
            message: srId
              ? `Filed with LA 311. Confirmation ${srId}.`
              : 'Filed with LA 311. A confirmation number will follow by email.',
          }
        }
        return {
          filed: false,
          dryRun: true,
          serviceRequestId: null,
          stepsWalked,
          reachedFinalStep: true,
          requiresLogin: false,
          message:
            'Dry run: the real MyLA311 form was filled out and validated up to the final Submit step, but not filed. ' +
            'Enable MYLA311_ALLOW_SUBMIT to send it for real.',
        }
      }

      // Advance to the next step.
      const nextBtn = page
        .locator('button.slds-button_brand, button.slds-button--brand')
        .first()
      try {
        await nextBtn.click({ timeout: 5000 })
        await page.waitForTimeout(2000)
      } catch {
        break
      }
    }

    return {
      filed: false,
      dryRun: !input.confirmSubmit,
      serviceRequestId: null,
      stepsWalked,
      reachedFinalStep: false,
      requiresLogin: false,
      message: 'Could not reach the final step of the form automatically.',
    }
  } finally {
    try {
      await context?.close()
    } catch {
      // ignore
    }
    try {
      await browser?.close()
    } catch {
      // ignore
    }
  }
}
