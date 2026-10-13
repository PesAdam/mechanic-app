import { expect, type Page } from '@playwright/test'

/** Demo accounts from the seeder (api/database/seeders/DatabaseSeeder.php). */
export const OWNER = { email: 'adam@dielna.sk', password: 'heslo1234', name: 'Adam' }
export const MECHANIC = { email: 'marek@dielna.sk', password: 'heslo1234', name: 'Marek' }

export const MOBILE = { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true }

export async function login(page: Page, who = OWNER): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(who.email)
  await page.getByLabel('Heslo').fill(who.password)
  await page.locator('form button[type="submit"]').click()
  await expect(page).not.toHaveURL(/\/login/)
}

/** Tokens per account for this worker: one API login per role per run keeps the login throttle far away. */
const tokens = new Map<string, string>()

/** Log in through the API and hand the token to the app, like a returning user with a saved session. */
export async function loginViaApi(page: Page, who = OWNER): Promise<void> {
  let token = tokens.get(who.email)
  if (!token) {
    const res = await page.request.post('/api/v1/auth/login', { data: { email: who.email, password: who.password, device_name: 'e2e' }, headers: { Accept: 'application/json' } })
    if (!res.ok()) throw new Error(`API login failed: ${res.status()} ${await res.text()}`)
    token = (await res.json() as { token: string }).token
    tokens.set(who.email, token)
  }
  await page.addInitScript((t: string) => { localStorage.setItem('mechanic-app:token', t) }, token)
}

/** Bearer token the app stored after login, for direct API checks. */
export async function apiToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('mechanic-app:token'))
  if (!token) throw new Error('not logged in')
  return token
}
