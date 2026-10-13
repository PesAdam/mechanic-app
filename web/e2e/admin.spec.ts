import { expect, test } from '@playwright/test'
import { loginViaApi, OWNER } from './helpers'

test.describe('desktop majiteľa', () => {
  test.beforeEach(async ({ page }) => { await loginViaApi(page, OWNER) })

  test('Úkony: vozidlo z VIN a norma pre model', async ({ page }) => {
    await page.goto('/admin/ukony')
    const change = page.getByRole('button', { name: 'Zmeniť vozidlo' })
    if (await change.isVisible()) await change.click()

    await page.getByPlaceholder('Značka, ŠPZ alebo VIN…').fill('TMBJG7NE5J0114821')
    const hint = page.locator('.lookup-card', { hasText: 'VIN:' })
    await expect(hint).toContainText('VIN: Škoda Octavia III · r. v. 2018')
    await expect(hint).toContainText('Generácia 2012–2020')
    await hint.getByRole('button', { name: 'Použiť' }).click()

    // The VIN never tells the engine: the picker continues there.
    await page.getByRole('button', { name: 'Všetky motorizácie', exact: true }).click()
    await expect(page.getByText(/Časy pre/)).toContainText('Škoda Octavia III')

    // Set a model norm on the first job, see it applied, then take it back.
    const row = page.locator('tbody tr').first()
    await row.getByRole('button', { name: /Nastaviť normu pre/ }).click()
    await row.locator('.norm-cell input').fill('77')
    await row.getByRole('button', { name: 'Uložiť' }).click()
    await expect(row).toContainText('1 h 17 min')
    await expect(row.locator('.tag', { hasText: 'model' })).toBeVisible()
    await row.getByRole('button', { name: 'Odstrániť normu pre toto vozidlo' }).click()
    await expect(row.locator('.tag', { hasText: 'model' })).toHaveCount(0)
  })

  test('Reporty ukazujú MOC aj NC súčet', async ({ page }) => {
    await page.goto('/admin/reporty')
    const first = page.locator('tbody tr').first()
    await expect(first).toContainText('MOC')
    await expect(first).toContainText('NC')
  })

  test('Tím: majiteľ založí kolegu', async ({ page }) => {
    await page.goto('/admin/tim')
    await page.getByRole('button', { name: 'Pridať kolegu' }).click()
    const dialog = page.getByRole('dialog', { name: 'Nový kolega' })
    // Unique per run: a local run reuses the seeded database between runs.
    const stamp = Date.now()
    const email = `e2e-${stamp}@dielna.sk`
    const name = `E2E Tester ${stamp}`
    await dialog.getByLabel('Meno', { exact: true }).fill(name)
    await dialog.getByLabel('E-mail (prihlasovacie meno)').fill(email)
    await dialog.getByLabel('Heslo').fill('heslo1234')
    await dialog.getByRole('button', { name: 'Uložiť' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText(name)).toBeVisible()
    await expect(page.getByText(email)).toBeVisible()
  })
})
