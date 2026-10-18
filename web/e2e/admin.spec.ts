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

  test('Kalendár: naplánovanie zákazky sa ukáže v rozvrhu aj v tabuľke', async ({ page }) => {
    await page.goto('/admin/kalendar')
    const today = new Date()
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    await page.locator('.plan-row', { hasText: '#0233' }).getByRole('button', { name: 'Naplánovať' }).click()
    const dialog = page.getByRole('dialog', { name: 'Plán · #0233' })
    await dialog.getByLabel('Dátum').fill(iso)
    await dialog.getByLabel('Čas').fill('15:00')
    await dialog.getByLabel('Trvanie (min)').fill('90')
    await dialog.getByRole('button', { name: 'Uložiť' }).click()

    const block = page.locator('.cal-block', { hasText: '15:00 · BMW' })
    await expect(block).toBeVisible()
    await expect(page.locator('.plan-row', { hasText: '#0233' })).toHaveCount(0)

    await page.goto('/admin/zakazky')
    await page.getByText('Podľa plánu').click()
    await expect(page.locator('tbody tr').first()).toContainText('0233')
    await expect(page.locator('tbody tr').first()).toContainText('dnes 15:00')

    // The plan is editable on the order itself and can be removed from the calendar block.
    await page.goto('/admin/zakazky/3')
    await expect(page.getByLabel('Plánované na')).toHaveValue(iso)
    await expect(page.getByLabel('Plánované trvanie (min)')).toHaveValue('90')
    await page.goto('/admin/kalendar')
    await page.locator('.cal-block', { hasText: '15:00 · BMW' }).click()
    await page.getByRole('dialog', { name: 'Plán · #0233' }).getByRole('button', { name: 'Zrušiť plán' }).click()
    await expect(page.locator('.plan-row', { hasText: '#0233' })).toBeVisible()
  })

  test('Report neukazuje hodinovú sadzbu, kým ju majiteľ nezapne', async ({ page }) => {
    await page.goto('/admin/reporty/4')
    const labor = page.locator('tr', { hasText: 'Spolu práca' })
    await expect(labor).toBeVisible()
    await expect(labor).not.toContainText('€/h')

    await page.goto('/admin/nastavenia')
    await page.getByText('Zobrazovať hodinovú sadzbu na reporte').click()
    await page.getByRole('button', { name: 'Uložiť nastavenia' }).click()
    await expect(page.getByText('Uložené ✓')).toBeVisible()
    await page.goto('/admin/reporty/4')
    await expect(page.locator('tr', { hasText: 'Spolu práca' })).toContainText('€/h')

    await page.goto('/admin/nastavenia')
    await page.getByText('Zobrazovať hodinovú sadzbu na reporte').click()
    await page.getByRole('button', { name: 'Uložiť nastavenia' }).click()
    await expect(page.getByText('Uložené ✓')).toBeVisible()
  })
})
