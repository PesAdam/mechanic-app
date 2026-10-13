import { expect, test } from '@playwright/test'
import { login, MECHANIC, MOBILE, OWNER } from './helpers'

test.describe('prihlásenie a zóny', () => {
  test('majiteľ na širokej obrazovke pristane v desktopovej zóne', async ({ page }) => {
    await login(page, OWNER)
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('link', { name: 'Zákazky', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Úkony', exact: true })).toBeVisible()
  })

  test('mechanik ide do dielne a do admin zóny sa nedostane', async ({ page }) => {
    await login(page, MECHANIC)
    await expect(page).toHaveURL(/\/m$/)
    await expect(page.getByRole('heading', { name: 'Dielňa' })).toBeVisible()
    await page.goto('/admin/ukony')
    await expect(page).toHaveURL(/\/m$/)
  })

  test('zlé heslo ukáže chybu a nepustí ďalej', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill(OWNER.email)
    await page.getByLabel('Heslo').fill('nespravne')
    await page.locator('form button[type="submit"]').click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('bez prihlásenia presmeruje na login', async ({ page }) => {
    await page.goto('/m')
    await expect(page).toHaveURL(/\/login/)
  })

  test.describe('na telefóne', () => {
    test.use(MOBILE)
    test('aj majiteľ začína v dielni', async ({ page }) => {
      await login(page, OWNER)
      await expect(page).toHaveURL(/\/m$/)
      await expect(page.getByRole('button', { name: /Nová zákazka/ })).toBeVisible()
    })
  })
})
