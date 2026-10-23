import { test, expect, type Page } from '@playwright/test'

async function enterKitchen(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('radiogroup').first().getByRole('radio').first().click()
  await page.getByRole('radiogroup').last().getByRole('radio').nth(2).click()
  await page.getByRole('button', { name: /to the kitchen/i }).click()
}

test('the stage shows two panels of five slots and a counter of ten', async ({ page }) => {
  await enterKitchen(page)
  await page.getByRole('button', { name: /^deal$/i }).click()
  await expect(page.locator('.pan')).toHaveCount(2)
  await expect(page.locator('.pan').first().locator('.slot')).toHaveCount(5)
  await expect(page.locator('.ctile')).toHaveCount(10)
})

test('both figurines are present and hidden from assistive technology', async ({ page }) => {
  await enterKitchen(page)
  const figurines = page.locator('.figurine svg')
  await expect(figurines).toHaveCount(2)
  await expect(figurines.first()).toHaveAttribute('aria-hidden', 'true')
})

test('each chef name appears as text, not only as colour', async ({ page }) => {
  await enterKitchen(page)
  await expect(page.locator('.figurine').first()).toContainText(/the grill/i)
})

test('dealing again changes the counter', async ({ page }) => {
  await enterKitchen(page)
  const deal = page.getByRole('button', { name: /^deal$/i })
  await deal.click()
  const first = (await page.locator('.ctile').allInnerTexts()).join()
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await deal.click()
    if ((await page.locator('.ctile').allInnerTexts()).join() !== first) return
  }
  throw new Error('five deals produced an identical counter')
})

test('the deal button keeps focus after being pressed', async ({ page }) => {
  await enterKitchen(page)
  const deal = page.getByRole('button', { name: /^deal$/i })
  await deal.focus()
  await deal.press('Enter')
  await expect(page.locator('.ctile')).toHaveCount(10)
  await expect(deal).toBeFocused()
  await deal.press('Enter')
  await expect(deal).toBeFocused()
})

test('changing chef from a figurine moves focus to the main region', async ({ page }) => {
  await enterKitchen(page)
  const figurine = page.locator('.figurine button').first()
  await figurine.focus()
  await figurine.press('Enter')
  await expect(page.getByRole('radiogroup')).toHaveCount(2)
  await expect(page.locator('#app')).toBeFocused()
})

test('the stage heading sits in a header landmark', async ({ page }) => {
  await enterKitchen(page)
  await expect(page.locator('header.st-hud')).toHaveCount(1)
  await expect(page.locator('header.st-hud h1')).toHaveCount(1)
})

test('every counter tile shows its category in text', async ({ page }) => {
  await enterKitchen(page)
  await page.getByRole('button', { name: /^deal$/i }).click()
  const counter = page.locator('.ctiles')
  for (const label of ['Protein', 'Vegetable', 'Starch', 'Aromatic', 'Wildcard']) {
    await expect(counter.getByText(label, { exact: true })).toHaveCount(2)
  }
})

test('every slot shows its category in text', async ({ page }) => {
  await enterKitchen(page)
  await page.getByRole('button', { name: /^deal$/i }).click()
  const panel = page.locator('.pan').first()
  for (const label of ['Protein', 'Vegetable', 'Starch', 'Aromatic', 'Wildcard']) {
    await expect(panel).toContainText(label)
  }
})

test('the HUD reports the round and the pantry size', async ({ page }) => {
  await enterKitchen(page)
  await page.getByRole('button', { name: /^deal$/i }).click()
  await expect(page.locator('.st-hud')).toContainText(/round/i)
  await expect(page.locator('.st-hud')).toContainText(/\d{2,}/)
})

test('the free shelf is listed on the stage', async ({ page }) => {
  await enterKitchen(page)
  await expect(page.locator('.shelf')).toContainText(/oil/i)
  await expect(page.locator('.shelf')).toContainText(/salt/i)
})

test('excluding dairy removes butter from the shelf', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /^dairy$/i }).click()
  await page.getByRole('radiogroup').first().getByRole('radio').first().click()
  await page.getByRole('radiogroup').last().getByRole('radio').nth(2).click()
  await page.getByRole('button', { name: /to the kitchen/i }).click()
  await expect(page.locator('.shelf')).not.toContainText(/butter/i)
})

test('tapping a figurine returns to chef select', async ({ page }) => {
  await enterKitchen(page)
  await page.locator('.figurine button').first().click()
  await expect(page.getByRole('radiogroup')).toHaveCount(2)
})
