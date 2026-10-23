import { test, expect, type Page } from '@playwright/test'

async function enterKitchen(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('radiogroup').first().getByRole('radio').first().click()
  await page.getByRole('radiogroup').last().getByRole('radio').nth(2).click()
  await page.getByRole('button', { name: /to the kitchen/i }).click()
}

test('the whole flow runs from select to a dealt counter', async ({ page }) => {
  await enterKitchen(page)
  await page.getByRole('button', { name: /^deal$/i }).click()
  await expect(page.locator('.ctile')).toHaveCount(10)
})

test('the deal is announced to assistive technology', async ({ page }) => {
  await enterKitchen(page)
  await page.getByRole('button', { name: /^deal$/i }).click()
  const live = page.locator('[aria-live="polite"]')
  await expect(live).toContainText(/ten ingredients on the counter/i)
})

test('an excluded tag never reaches the counter', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /^meat & fish$/i }).click()
  await page.getByRole('button', { name: /^animal products$/i }).click()
  await page.getByRole('radiogroup').first().getByRole('radio').first().click()
  await page.getByRole('radiogroup').last().getByRole('radio').nth(2).click()
  await page.getByRole('button', { name: /to the kitchen/i }).click()
  await page.getByRole('button', { name: /^deal$/i }).click()

  const names = (await page.locator('.ctile').allInnerTexts()).join(' ').toLowerCase()
  for (const banned of ['chicken', 'pork', 'cod', 'prawns', 'bacon', 'honey', 'yoghurt']) {
    expect(names, `${banned} leaked onto the counter`).not.toContain(banned)
  }
})

test('the round counter advances with each deal', async ({ page }) => {
  await enterKitchen(page)
  const deal = page.getByRole('button', { name: /^deal$/i })
  await deal.click()
  await expect(page.locator('.st-hud')).toContainText(/round 01/i)
  await deal.click()
  await expect(page.locator('.st-hud')).toContainText(/round 02/i)
})

test('the stage is reachable directly on a return visit', async ({ page }) => {
  await enterKitchen(page)
  await page.reload()
  await expect(page.getByRole('button', { name: /^deal$/i })).toBeVisible()
})

test('reduced motion renders the counter with no animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await enterKitchen(page)
  await page.getByRole('button', { name: /^deal$/i }).click()
  const animation = await page.locator('.ctile').first()
    .evaluate((node) => getComputedStyle(node).animationName)
  expect(animation).toBe('none')
})

test('the app makes no external network requests', async ({ page }) => {
  const external: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    const local = url.startsWith('http://127.0.0.1')
      || url.startsWith('http://localhost')
      || url.startsWith('data:')
    if (!local) external.push(url)
  })
  await enterKitchen(page)
  await page.getByRole('button', { name: /^deal$/i }).click()
  expect(external).toEqual([])
})

test('the app logs no console errors during a full round', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', (error) => errors.push(error.message))
  await enterKitchen(page)
  await page.getByRole('button', { name: /^deal$/i }).click()
  await page.getByRole('button', { name: /^deal$/i }).click()
  expect(errors).toEqual([])
})
