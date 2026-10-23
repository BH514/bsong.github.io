import { test, expect } from '@playwright/test'

test('the select screen offers all six chefs to both players', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/cooking battle/i)
  const groups = page.getByRole('radiogroup')
  await expect(groups).toHaveCount(2)
  await expect(groups.first().getByRole('radio')).toHaveCount(6)
})

test('picking a chef for each player enables the start control', async ({ page }) => {
  await page.goto('/')
  const start = page.getByRole('button', { name: /to the kitchen/i })
  await expect(start).toBeDisabled()
  await page.getByRole('radiogroup').first().getByRole('radio').first().click()
  await page.getByRole('radiogroup').last().getByRole('radio').nth(2).click()
  await expect(start).toBeEnabled()
})

test('a picked chef is marked selected for assistive technology', async ({ page }) => {
  await page.goto('/')
  const option = page.getByRole('radiogroup').first().getByRole('radio').nth(1)
  await option.click()
  await expect(option).toHaveAttribute('aria-checked', 'true')
})

test('arrow keys move the selection within a radiogroup', async ({ page }) => {
  await page.goto('/')
  const group = page.getByRole('radiogroup').first()
  await group.getByRole('radio').first().click()
  await group.getByRole('radio').first().press('ArrowRight')
  await expect(group.getByRole('radio').nth(1)).toHaveAttribute('aria-checked', 'true')
  await expect(group.getByRole('radio').nth(1)).toBeFocused()
})

test('up and down arrows also move the selection', async ({ page }) => {
  await page.goto('/')
  const group = page.getByRole('radiogroup').first()
  await group.getByRole('radio').first().click()
  await group.getByRole('radio').first().press('ArrowDown')
  await expect(group.getByRole('radio').nth(1)).toHaveAttribute('aria-checked', 'true')
  await group.getByRole('radio').nth(1).press('ArrowUp')
  await expect(group.getByRole('radio').first()).toHaveAttribute('aria-checked', 'true')
  await expect(group.getByRole('radio').first()).toBeFocused()
})

test('arrow keys wrap around both ends of the roster', async ({ page }) => {
  await page.goto('/')
  const group = page.getByRole('radiogroup').first()
  await group.getByRole('radio').first().click()
  await group.getByRole('radio').first().press('ArrowUp')
  await expect(group.getByRole('radio').nth(5)).toHaveAttribute('aria-checked', 'true')
  await group.getByRole('radio').nth(5).press('ArrowDown')
  await expect(group.getByRole('radio').first()).toHaveAttribute('aria-checked', 'true')
})

test('the select heading sits in a header landmark', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('header.select-head h1')).toHaveCount(1)
})

test('diet chips toggle their pressed state', async ({ page }) => {
  await page.goto('/')
  const chip = page.getByRole('button', { name: /^dairy$/i })
  await expect(chip).toHaveAttribute('aria-pressed', 'false')
  await chip.click()
  await expect(chip).toHaveAttribute('aria-pressed', 'true')
})

test('a chip keeps focus after being toggled', async ({ page }) => {
  await page.goto('/')
  const chip = page.getByRole('button', { name: /^dairy$/i })
  await chip.focus()
  await chip.press('Enter')
  await expect(chip).toHaveAttribute('aria-pressed', 'true')
  await expect(chip).toBeFocused()
})

test('chef picks and chips survive a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('radiogroup').first().getByRole('radio').first().click()
  await page.getByRole('button', { name: /^nuts & seeds$/i }).click()
  await page.reload()
  await expect(page.getByRole('radiogroup').first().getByRole('radio').first())
    .toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('button', { name: /^nuts & seeds$/i }))
    .toHaveAttribute('aria-pressed', 'true')
})

test('the select screen logs no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('radiogroup').first().getByRole('radio').first().click()
  expect(errors).toEqual([])
})
