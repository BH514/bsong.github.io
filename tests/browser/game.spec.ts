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

/** Spec §11's four motions, read where each one applies. */
function animationNames(page: Page) {
  return page.evaluate(() => {
    const read = (selector: string, pseudo: string | null = null): string => {
      const node = document.querySelector(selector)
      return node === null ? 'missing' : getComputedStyle(node, pseudo).animationName
    }
    return {
      figurine: read('.figurine'),
      vs: read('.vs'),
      ring: read('.vs', '::after'),
      pip: read('.pips i[data-filled="true"]'),
      tile: read('.ctile'),
    }
  })
}

test('every specified motion is actually wired up', async ({ page }) => {
  await enterKitchen(page)
  const onArrival = await animationNames(page)
  expect(onArrival.figurine, 'figurines do not slide in').not.toBe('none')
  expect(onArrival.vs, 'the VS badge does not slam').not.toBe('none')
  expect(onArrival.ring, 'the VS badge throws no shockwave ring').not.toBe('none')

  await page.getByRole('button', { name: /^deal$/i }).click()
  const afterDeal = await animationNames(page)
  expect(afterDeal.pip, 'slot pips do not fill').not.toBe('none')
  expect(afterDeal.tile, 'counter tiles do not pop in').not.toBe('none')
})

test('reduced motion removes every animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await enterKitchen(page)
  const onArrival = await animationNames(page)
  expect(onArrival.figurine).toBe('none')
  expect(onArrival.vs).toBe('none')
  expect(onArrival.ring).toBe('none')

  await page.getByRole('button', { name: /^deal$/i }).click()
  const afterDeal = await animationNames(page)
  expect(afterDeal.pip).toBe('none')
  expect(afterDeal.tile).toBe('none')
})

test('reduced motion still renders the dealt stage correctly', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await enterKitchen(page)
  await page.getByRole('button', { name: /^deal$/i }).click()

  const state = await page.evaluate(() => {
    const pips = [...document.querySelectorAll<HTMLElement>('.pips i')]
    const figurine = document.querySelector('.figurine')
    const vs = document.querySelector('.vs')
    return {
      filled: pips.filter((pip) => pip.dataset['filled'] === 'true')
        .map((pip) => getComputedStyle(pip).opacity),
      figurineTransform: figurine && getComputedStyle(figurine).transform,
      figurineOpacity: figurine && getComputedStyle(figurine).opacity,
      vsOpacity: vs && getComputedStyle(vs).opacity,
      ringContent: vs && getComputedStyle(vs, '::after').content,
    }
  })

  expect(state.filled).toEqual(['1', '1', '1', '1', '1', '1', '1', '1', '1', '1'])
  expect(state.figurineTransform).toBe('none')
  expect(state.figurineOpacity).toBe('1')
  expect(state.vsOpacity).toBe('1')
  expect(state.ringContent, 'the shockwave ring must not exist at all').toBe('none')
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
