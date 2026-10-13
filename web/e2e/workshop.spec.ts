import { expect, test } from '@playwright/test'
import { apiToken, loginViaApi, MECHANIC, MOBILE } from './helpers'

test.use(MOBILE)

/** The mechanic's day: known car by plate → work → part → close → customer report. */
test('zákazka od ŠPZ cez stopky a diely po report pre zákazníka', async ({ page }) => {
  await loginViaApi(page, MECHANIC)
  await page.goto('/m')

  // Nová zákazka: the plate finds the car and customer from the history.
  await page.getByRole('button', { name: /Nová zákazka/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Nová zákazka' })
  await dialog.getByLabel('ŠPZ').fill('ZA 412')
  await dialog.locator('.lookup-card', { hasText: 'ZA 412 KL' }).getByRole('button', { name: 'Použiť' }).click()
  await expect(dialog.getByLabel('ŠPZ')).toHaveValue('ZA 412 KL')
  await expect(dialog.getByLabel('Zákazník')).toHaveValue('Ján Kováč')
  await expect(dialog.getByText('Auto z histórie')).toBeVisible()
  await dialog.getByLabel('Čo treba spraviť').fill('E2E: výmena oleja a filtrov')
  await dialog.getByRole('button', { name: 'Založiť' }).click()

  await expect(page).toHaveURL(/\/m\/zakazky\/\d+$/)
  await expect(page.getByText('Škoda Octavia III 2.0 TDI')).toBeVisible()
  const orderId = Number(page.url().match(/zakazky\/(\d+)/)?.[1])

  // Stopky: start, then pause.
  await page.getByRole('button', { name: 'Štart' }).click()
  await expect(page.getByRole('button', { name: 'Pauza' })).toBeVisible()
  await page.getByRole('button', { name: 'Pauza' }).click()
  await expect(page.getByRole('button', { name: 'Štart' })).toBeVisible()

  // Diel with both prices.
  await page.getByRole('button', { name: '+ Pridať diel' }).click()
  const part = page.getByRole('dialog', { name: 'Pridať diel' })
  await part.getByLabel('Názov').fill('E2E olejový filter')
  await part.getByLabel(/MOC/).fill('120')
  await part.getByLabel(/NC/).fill('90')
  await part.locator('button[form="add-part"]').click()
  await expect(page.getByText('E2E olejový filter')).toBeVisible()

  // Close with NC prices on the report.
  await page.getByRole('button', { name: 'Uzavrieť a vytvoriť report' }).click()
  const close = page.getByRole('dialog', { name: /Uzavrieť zákazku/ })
  // The radio input is visually hidden; its label is what the mechanic taps.
  await close.getByText('NC · nákupné').click()
  await expect(close.getByLabel('NC · nákupné')).toBeChecked()
  await close.getByRole('button', { name: 'Uzavrieť a vytvoriť report' }).click()
  await expect(page.getByText('Zákazník dostane odkaz na online report')).toBeVisible()

  // The public report: NC total for parts, and no trace of the MOC/NC choice.
  const token = await apiToken(page)
  const res = await page.request.get(`/api/v1/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
  expect(res.ok()).toBeTruthy()
  const order = (await res.json()).data as { public_token: string; parts_pricing: string; status: string }
  expect(order.parts_pricing).toBe('nc')
  expect(['unpaid', 'done']).toContain(order.status)

  await page.context().clearCookies()
  await page.goto(`/r/${order.public_token}`)
  await expect(page.getByText('E2E olejový filter')).toBeVisible()
  await expect(page.locator('tr', { hasText: 'Spolu diely' })).toContainText('90,00 €')
  await expect(page.locator('body')).not.toContainText(/MOC|NC ·|nákupn/)
})
